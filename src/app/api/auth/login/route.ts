import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { getDb, registrarAuditoria } from "@/lib/db";

export async function POST(request: Request) {
  const { email, password } = await request.json();

  const user = await createSession(email, password);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Credenciales inválidas" }, { status: 401 });
  }

  registrarAuditoria(user.id, "LOGIN", "usuarios", user.id, { email: user.email });

  return NextResponse.json({ ok: true, user });
}
