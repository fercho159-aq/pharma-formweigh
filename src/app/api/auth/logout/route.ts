import { NextResponse } from "next/server";

import { ipDe, origenValido, responderError } from "@/lib/api";
import { registrarAuditoria } from "@/lib/auditoria";
import { destruirSesion, getSession } from "@/lib/auth/sesion";

export async function POST(request: Request) {
  try {
    if (!origenValido(request)) return NextResponse.json({ ok: false, error: "Origen no permitido." }, { status: 403 });
    const usuario = await getSession();
    if (usuario) {
      await registrarAuditoria({ usuarioId: usuario.id, accion: "LOGOUT", entidad: "usuarios", entidadId: usuario.id, ip: ipDe(request) });
    }
    await destruirSesion();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return responderError(e);
  }
}
