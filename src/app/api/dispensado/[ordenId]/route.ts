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

  // Get phases for the recipe
  const fases = await query(
    'SELECT * FROM fases WHERE "recetaId" = $1 ORDER BY orden',
    [orden.recetaId]
  ) as Array<{ id: string; nombre: string; orden: number; instrucciones: string | null }>;

  // Get all ingredientes for the recipe
  const ingredientes = await query(`
    SELECT i.*, m.nombre as "materialNombre", m.codigo as "materialCodigo", m.unidad as "materialUnidad"
    FROM ingredientes i
    JOIN materiales m ON i."materialId" = m.id
    WHERE i."recetaId" = $1
    ORDER BY i.orden
  `, [orden.recetaId]) as Array<{ id: string; faseId: string; orden: number; [key: string]: unknown }>;

  // Check which have been dispensed
  const dispensados = await query(
    'SELECT paso, "cantidadReal", "faseId" FROM dispensados WHERE "ordenId" = $1',
    [ordenId]
  ) as Array<{ paso: number; cantidadReal: number; faseId: string | null }>;

  // Key by faseId:paso to avoid collision across phases
  const dispensadoMap = new Map(dispensados.map((d) => [`${d.faseId}:${d.paso}`, d.cantidadReal]));

  // Get phase signatures
  const firmas = await query(
    `SELECT ff.*, u.nombre as "supervisorNombre"
     FROM firmas_fase ff
     JOIN usuarios u ON ff."supervisorId" = u.id
     WHERE ff."ordenId" = $1`,
    [ordenId]
  ) as Array<{ faseId: string; supervisorNombre: string; timestamp: string }>;

  const firmaMap = new Map(firmas.map((f) => [f.faseId, { supervisorNombre: f.supervisorNombre, timestamp: f.timestamp }]));

  // Group ingredientes by phase
  const fasesConDatos = fases.map((fase) => {
    const faseIngredientes = ingredientes
      .filter((ing) => ing.faseId === fase.id)
      .map((ing) => ({
        ...ing,
        dispensado: dispensadoMap.has(`${fase.id}:${ing.orden}`),
        dispensadoReal: dispensadoMap.get(`${fase.id}:${ing.orden}`),
      }));

    return {
      id: fase.id,
      nombre: fase.nombre,
      orden: fase.orden,
      instrucciones: fase.instrucciones,
      firma: firmaMap.get(fase.id) || null,
      ingredientes: faseIngredientes,
    };
  });

  return NextResponse.json({ ...orden, fases: fasesConDatos });
}
