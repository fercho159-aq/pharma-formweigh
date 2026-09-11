import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ ordenId: string }> }) {
  const { ordenId } = await params;

  const orden = await queryOne(`
    SELECT op.*, r.nombre as "recetaNombre", r.codigo as "recetaCodigo"
    FROM ordenes_produccion op
    JOIN recetas r ON op."recetaId" = r.id
    WHERE op.id = $1
  `, [ordenId]) as { id: string; recetaId: string; [key: string]: unknown } | null;

  if (!orden) return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });

  const ingredientes = await query(`
    SELECT i.*, m.nombre as "materialNombre", m.codigo as "materialCodigo", m.unidad as "materialUnidad"
    FROM ingredientes i
    JOIN materiales m ON i."materialId" = m.id
    WHERE i."recetaId" = $1
    ORDER BY i.orden
  `, [orden.recetaId]) as Array<{ id: string; orden: number; [key: string]: unknown }>;

  // Check which have been dispensed
  const dispensados = await query(
    'SELECT paso, "cantidadReal" FROM dispensados WHERE "ordenId" = $1',
    [ordenId]
  ) as Array<{ paso: number; cantidadReal: number }>;

  const dispensadoMap = new Map(dispensados.map((d) => [d.paso, d.cantidadReal]));

  const ingredientesConEstado = ingredientes.map((ing) => ({
    ...ing,
    dispensado: dispensadoMap.has(ing.orden),
    dispensadoReal: dispensadoMap.get(ing.orden),
  }));

  return NextResponse.json({ ...orden, ingredientes: ingredientesConEstado });
}
