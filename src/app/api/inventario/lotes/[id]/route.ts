import { NextResponse } from "next/server";
import { query, queryOne, registrarAuditoria } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!["ADMIN", "SUPERVISOR", "CALIDAD", "ALMACEN"].includes(user.rol)) return NextResponse.json({ error: "Solo supervisor, calidad, almacén o admin" }, { status: 403 });

  const { id } = await params;
  const data = await request.json();

  const lote = await queryOne("SELECT * FROM lotes WHERE id = $1", [id]) as { estado: string } | null;
  if (!lote) return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });

  await query("UPDATE lotes SET estado = $1 WHERE id = $2", [data.estado, id]);

  await registrarAuditoria(user.id, "CAMBIAR_ESTADO_LOTE", "lotes", id, {
    estadoAnterior: lote.estado,
    estadoNuevo: data.estado,
  });

  return NextResponse.json({ ok: true });
}
