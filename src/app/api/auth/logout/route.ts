import { NextResponse } from "next/server";
import { destroySession, getSession } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/db";

export async function POST() {
  const user = await getSession();
  if (user) {
    registrarAuditoria(user.id, "LOGOUT", "usuarios", user.id);
  }
  await destroySession();
  return NextResponse.json({ ok: true });
}
