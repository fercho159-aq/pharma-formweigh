import { asc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { materiales } from "@/db/schema";
import { ruta } from "@/lib/api";
import { registrarAuditoria } from "@/lib/auditoria";
import { esquemaCrearMaterial } from "@/lib/esquemas";

export const GET = ruta({ permiso: "inventario.ver" }, async () => {
  const lista = await db
    .select({
      id: materiales.id,
      codigo: materiales.codigo,
      nombre: materiales.nombre,
      descripcion: materiales.descripcion,
      unidad: materiales.unidad,
      stockMinimo: materiales.stockMinimo,
      activo: materiales.activo,
      stockActual: sql<number>`coalesce((select sum(l.cantidad) from lotes l where l.material_id = ${materiales.id} and l.estado = 'APROBADO'), 0)::float8`,
      lotesActivos: sql<number>`(select count(*)::int from lotes l where l.material_id = ${materiales.id} and l.estado in ('APROBADO','CUARENTENA'))`,
    })
    .from(materiales)
    .where(eq(materiales.activo, true))
    .orderBy(asc(materiales.nombre));
  return NextResponse.json(lista);
});

export const POST = ruta({ permiso: "inventario.crearMaterial", esquema: esquemaCrearMaterial }, async ({ usuario, datos, ip }) => {
  const id = await db.transaction(async (tx) => {
    const [alta] = await tx.insert(materiales).values(datos).returning({ id: materiales.id });
    await registrarAuditoria({ usuarioId: usuario.id, accion: "CREAR_MATERIAL", entidad: "materiales", entidadId: alta!.id, ip, detalles: { nombre: datos.nombre, codigo: datos.codigo } }, tx);
    return alta!.id;
  });
  return NextResponse.json({ id });
});
