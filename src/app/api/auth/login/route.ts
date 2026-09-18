import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { usuarios } from "@/db/schema";
import { ipDe, origenValido, responderError } from "@/lib/api";
import { registrarAuditoria } from "@/lib/auditoria";
import { exigirSinBloqueo, registrarIntento } from "@/lib/auth/limite";
import { verificarPassword } from "@/lib/auth/password";
import { crearSesion } from "@/lib/auth/sesion";
import { esquemaLogin } from "@/lib/esquemas";

export async function POST(request: Request) {
  try {
    if (!origenValido(request)) return NextResponse.json({ ok: false, error: "Origen no permitido." }, { status: 403 });
    const entrada = esquemaLogin.safeParse(await request.json().catch(() => null));
    if (!entrada.success) return NextResponse.json({ ok: false, error: "Credenciales inválidas" }, { status: 401 });
    const { email, password } = entrada.data;
    const ip = ipDe(request);
    const claves = [`email:${email}`, ...(ip ? [`ip:${ip}`] : [])];
    await exigirSinBloqueo("login", claves);

    const [usuario] = await db
      .select()
      .from(usuarios)
      .where(and(eq(usuarios.email, email), eq(usuarios.activo, true)));
    if (!(await verificarPassword(password, usuario?.passwordHash)) || !usuario) {
      await registrarIntento("login", claves, false);
      await registrarAuditoria({ usuarioId: usuario?.id ?? null, accion: "LOGIN_FALLIDO", entidad: "usuarios", entidadId: usuario?.id ?? "desconocido", ip, detalles: { email } });
      return NextResponse.json({ ok: false, error: "Credenciales inválidas" }, { status: 401 });
    }

    await registrarIntento("login", claves, true);
    await crearSesion(usuario.id, ip, request.headers.get("user-agent"));
    await registrarAuditoria({ usuarioId: usuario.id, accion: "LOGIN", entidad: "usuarios", entidadId: usuario.id, ip, detalles: { email } });
    return NextResponse.json({ ok: true, user: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol } });
  } catch (e) {
    return responderError(e);
  }
}
