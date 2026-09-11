import { NextResponse } from "next/server";
import { query, queryOne, generateId, registrarAuditoria } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const ordenes = await query(`
    SELECT op.*, r.nombre as "recetaNombre", r.codigo as "recetaCodigo"
    FROM ordenes_produccion op
    JOIN recetas r ON op."recetaId" = r.id
    ORDER BY op.prioridad DESC, op."createdAt" DESC
  `);
  return NextResponse.json(ordenes);
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const data = await request.json();
  const id = generateId();

  // Auto-generate order number
  const count = await queryOne("SELECT COUNT(*) as c FROM ordenes_produccion") as { c: string };
  const numero = `ORD-${String(parseInt(count.c) + 1).padStart(5, "0")}`;

  try {
    await query(
      `INSERT INTO ordenes_produccion (id, numero, "recetaId", "loteProducto", cantidad, prioridad)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, numero, data.recetaId, data.loteProducto, data.cantidad, data.prioridad || 0]
    );

    await registrarAuditoria(user.id, "CREAR_ORDEN", "ordenes_produccion", id, { numero, loteProducto: data.loteProducto });

    return NextResponse.json({ id, numero });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
