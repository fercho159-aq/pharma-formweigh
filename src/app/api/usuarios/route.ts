import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { usuarios } from "@/db/schema";
import { ruta } from "@/lib/api";
import { registrarAuditoria } from "@/lib/auditoria";
import { hashPassword } from "@/lib/auth/password";
import { esquemaCrearUsuario } from "@/lib/esquemas";

export const GET = ruta({ permiso: "usuarios.ver" }, async () => {
  const lista = await db
    .select({ id: usuarios.id, nombre: usuarios.nombre, email: usuarios.email, rol: usuarios.rol, badge: usuarios.badge, activo: usuarios.activo, createdAt: usuarios.createdAt })
    .from(usuarios)
    .orderBy(asc(usuarios.nombre));
  return NextResponse.json(lista);
});

export const POST = ruta({ permiso: "usuarios.crear", esquema: esquemaCrearUsuario }, async ({ usuario, datos, ip }) => {
  const passwordHash = await hashPassword(datos.password);
  const id = await db.transaction(async (tx) => {
    const [alta] = await tx
      .insert(usuarios)
      .values({ nombre: datos.nombre, email: datos.email, passwordHash, rol: datos.rol, badge: datos.badge })
      .returning({ id: usuarios.id });
    await registrarAuditoria({ usuarioId: usuario.id, accion: "CREAR_USUARIO", entidad: "usuarios", entidadId: alta!.id, ip, detalles: { nombre: datos.nombre, email: datos.email, rol: datos.rol } }, tx);
    return alta!.id;
  });
  return NextResponse.json({ id });
});
