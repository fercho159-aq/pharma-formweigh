import { NextResponse } from "next/server";
import { getDb, registrarAuditoria } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol === "OPERARIO") return NextResponse.json({ error: "Solo supervisor o admin" }, { status: 403 });

  const { id } = await params;
  const data = await request.json();
  const db = getDb();

  const lote = db.prepare("SELECT * FROM lotes WHERE id = ?").get(id) as { estado: string } | undefined;
  if (!lote) return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });

  db.prepare("UPDATE lotes SET estado = ? WHERE id = ?").run(data.estado, id);

  registrarAuditoria(user.id, "CAMBIAR_ESTADO_LOTE", "lotes", id, {
    estadoAnterior: lote.estado,
    estadoNuevo: data.estado,
  });

  return NextResponse.json({ ok: true });
}
