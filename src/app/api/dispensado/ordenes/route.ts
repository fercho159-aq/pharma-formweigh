import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  const ordenes = await query(`
    SELECT op.*, r.nombre as "recetaNombre", r.codigo as "recetaCodigo",
      (SELECT COUNT(*) FROM ingredientes i WHERE i."recetaId" = op."recetaId") as "numIngredientes",
      (SELECT COUNT(*) FROM dispensados d WHERE d."ordenId" = op.id) as "numDispensados"
    FROM ordenes_produccion op
    JOIN recetas r ON op."recetaId" = r.id
    WHERE op.estado IN ('PENDIENTE', 'EN_PROCESO')
    ORDER BY op.prioridad DESC, op."createdAt" ASC
  `);
  return NextResponse.json(ordenes);
}
