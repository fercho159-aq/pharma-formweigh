import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  const ordenes = await query(`
    SELECT op.*, r.nombre as "recetaNombre", r.codigo as "recetaCodigo",
      (SELECT COUNT(*) FROM ingredientes i WHERE i."recetaId" = op."recetaId") as "numIngredientes",
      (SELECT COUNT(*) FROM dispensados d WHERE d."ordenId" = op.id) as "numDispensados"
    FROM ordenes_produccion op
    JOIN recetas r ON op."recetaId" = r.id
    ORDER BY
      CASE op.estado
        WHEN 'EN_PROCESO' THEN 0
        WHEN 'PENDIENTE' THEN 1
        WHEN 'DISPENSADO' THEN 2
        WHEN 'COMPLETADA' THEN 3
        WHEN 'CANCELADA' THEN 4
      END,
      op.prioridad DESC, op."createdAt" ASC
  `);

  // Fetch fases and firmas for all orders at once
  const ordenIds = ordenes.map((o: { id: string }) => o.id);
  const recetaIds = [...new Set(ordenes.map((o: { recetaId: string }) => o.recetaId))];

  let fasesMap: Record<string, Array<{ id: string; nombre: string; orden: number }>> = {};
  let firmasSet: Set<string> = new Set();

  if (recetaIds.length > 0) {
    const placeholders = recetaIds.map((_: unknown, i: number) => `$${i + 1}`).join(",");
    const fases = await query(
      `SELECT id, "recetaId", nombre, orden FROM fases WHERE "recetaId" IN (${placeholders}) ORDER BY orden`,
      recetaIds
    ) as Array<{ id: string; recetaId: string; nombre: string; orden: number }>;

    for (const f of fases) {
      if (!fasesMap[f.recetaId]) fasesMap[f.recetaId] = [];
      fasesMap[f.recetaId].push({ id: f.id, nombre: f.nombre, orden: f.orden });
    }
  }

  if (ordenIds.length > 0) {
    const placeholders = ordenIds.map((_: unknown, i: number) => `$${i + 1}`).join(",");
    const firmas = await query(
      `SELECT "ordenId", "faseId" FROM firmas_fase WHERE "ordenId" IN (${placeholders})`,
      ordenIds
    ) as Array<{ ordenId: string; faseId: string }>;

    for (const f of firmas) {
      firmasSet.add(`${f.ordenId}:${f.faseId}`);
    }
  }

  const result = ordenes.map((o: Record<string, unknown>) => {
    const recetaFases = fasesMap[o.recetaId as string] || [];
    const fases = recetaFases.map((f) => ({
      id: f.id,
      nombre: f.nombre,
      orden: f.orden,
      firmada: firmasSet.has(`${o.id}:${f.id}`),
    }));
    const numFases = fases.length;
    const numFasesFirmadas = fases.filter((f) => f.firmada).length;

    return {
      ...o,
      fases,
      numFases,
      numFasesFirmadas,
    };
  });

  return NextResponse.json(result);
}
