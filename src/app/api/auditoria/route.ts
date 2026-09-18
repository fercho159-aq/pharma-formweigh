import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { auditoria, usuarios } from "@/db/schema";
import { ruta } from "@/lib/api";

export const GET = ruta({ permiso: "auditoria.ver" }, async () => {
  const entradas = await db
    .select({
      id: auditoria.id,
      usuarioId: auditoria.usuarioId,
      accion: auditoria.accion,
      entidad: auditoria.entidad,
      entidadId: auditoria.entidadId,
      detalles: auditoria.detalles,
      ip: auditoria.ip,
      timestamp: auditoria.timestamp,
      usuarioNombre: usuarios.nombre,
      usuarioRol: usuarios.rol,
    })
    .from(auditoria)
    .leftJoin(usuarios, eq(auditoria.usuarioId, usuarios.id))
    .orderBy(desc(auditoria.timestamp))
    .limit(500);
  return NextResponse.json(entradas.map((e) => ({ ...e, usuarioNombre: e.usuarioNombre ?? "(sin identificar)", usuarioRol: e.usuarioRol ?? "—" })));
});
