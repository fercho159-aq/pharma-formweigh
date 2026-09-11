import { NextResponse } from "next/server";
import { getDb, generateId, hashPassword, registrarAuditoria } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const db = getDb();
  const usuarios = db.prepare(
    "SELECT id, nombre, email, rol, badge, activo, createdAt FROM usuarios ORDER BY nombre"
  ).all();
  return NextResponse.json(usuarios);
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "ADMIN") return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  const data = await request.json();
  const db = getDb();
  const id = generateId();
  const hashedPw = hashPassword(data.password);

  try {
    db.prepare(
      "INSERT INTO usuarios (id, nombre, email, password, rol, badge) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(id, data.nombre, data.email, hashedPw, data.rol, data.badge || null);

    registrarAuditoria(user.id, "CREAR_USUARIO", "usuarios", id, { nombre: data.nombre, rol: data.rol });

    return NextResponse.json({ id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
