import { NextResponse } from "next/server";
import { getDb, generateId, registrarAuditoria } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const db = getDb();
  const ordenes = db.prepare(`
    SELECT op.*, r.nombre as recetaNombre, r.codigo as recetaCodigo
    FROM ordenes_produccion op
    JOIN recetas r ON op.recetaId = r.id
    ORDER BY op.prioridad DESC, op.createdAt DESC
  `).all();
  return NextResponse.json(ordenes);
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const data = await request.json();
  const db = getDb();
  const id = generateId();

  // Auto-generate order number
  const count = db.prepare("SELECT COUNT(*) as c FROM ordenes_produccion").get() as { c: number };
  const numero = `ORD-${String(count.c + 1).padStart(5, "0")}`;

  try {
    db.prepare(
      `INSERT INTO ordenes_produccion (id, numero, recetaId, loteProducto, cantidad, prioridad)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, numero, data.recetaId, data.loteProducto, data.cantidad, data.prioridad || 0);

    registrarAuditoria(user.id, "CREAR_ORDEN", "ordenes_produccion", id, { numero, loteProducto: data.loteProducto });

    return NextResponse.json({ id, numero });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
