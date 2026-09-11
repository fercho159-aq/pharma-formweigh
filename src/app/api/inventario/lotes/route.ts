import { NextResponse } from "next/server";
import { getDb, generateId, registrarAuditoria } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const db = getDb();
  const lotes = db.prepare(`
    SELECT l.*, m.nombre as materialNombre
    FROM lotes l
    JOIN materiales m ON l.materialId = m.id
    ORDER BY l.createdAt DESC
  `).all();
  return NextResponse.json(lotes);
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const data = await request.json();
  const db = getDb();
  const id = generateId();

  try {
    db.prepare(
      `INSERT INTO lotes (id, numero, materialId, cantidad, cantidadInicial, fechaRecepcion, fechaCaducidad, proveedor, certificado)
       VALUES (?, ?, ?, ?, ?, datetime('now'), ?, ?, ?)`
    ).run(id, data.numero, data.materialId, data.cantidad, data.cantidad, data.fechaCaducidad, data.proveedor, data.certificado || null);

    registrarAuditoria(user.id, "RECEPCION_LOTE", "lotes", id, {
      numero: data.numero,
      materialId: data.materialId,
      cantidad: data.cantidad,
      proveedor: data.proveedor,
    });

    return NextResponse.json({ id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
