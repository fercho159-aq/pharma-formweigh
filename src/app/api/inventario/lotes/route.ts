import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { lotes, materiales } from "@/db/schema";
import { ruta } from "@/lib/api";
import { registrarAuditoria } from "@/lib/auditoria";
import { ErrorDominio } from "@/lib/dominio/errores";
import { esquemaRecibirLote } from "@/lib/esquemas";

export const GET = ruta({ permiso: "inventario.ver" }, async () => {
  const lista = await db
    .select({
      id: lotes.id,
      numero: lotes.numero,
      materialId: lotes.materialId,
      cantidad: lotes.cantidad,
      cantidadInicial: lotes.cantidadInicial,
      fechaRecepcion: lotes.fechaRecepcion,
      fechaCaducidad: lotes.fechaCaducidad,
      proveedor: lotes.proveedor,
      estado: lotes.estado,
      certificado: lotes.certificado,
      createdAt: lotes.createdAt,
      materialNombre: materiales.nombre,
      materialUnidad: materiales.unidad,
    })
    .from(lotes)
    .innerJoin(materiales, eq(lotes.materialId, materiales.id))
    .orderBy(desc(lotes.createdAt));
  return NextResponse.json(lista);
});

export const POST = ruta({ permiso: "inventario.recibirLote", esquema: esquemaRecibirLote }, async ({ usuario, datos, ip }) => {
  if (datos.fechaCaducidad.getTime() <= Date.now()) {
    throw new ErrorDominio("No se puede recibir un lote ya caducado.", "LOTE_CADUCADO", 400);
  }
  const id = await db.transaction(async (tx) => {
    const [material] = await tx.select({ id: materiales.id }).from(materiales).where(eq(materiales.id, datos.materialId));
    if (!material) throw new ErrorDominio("Material no encontrado.", "MATERIAL_NO_ENCONTRADO", 404);
    // Todo lote nuevo entra en CUARENTENA (default de BD): el cliente no elige el estado.
    const [alta] = await tx
      .insert(lotes)
      .values({ numero: datos.numero, materialId: datos.materialId, cantidad: datos.cantidad, cantidadInicial: datos.cantidad, fechaCaducidad: datos.fechaCaducidad, proveedor: datos.proveedor, certificado: datos.certificado })
      .returning({ id: lotes.id });
    await registrarAuditoria({ usuarioId: usuario.id, accion: "RECEPCION_LOTE", entidad: "lotes", entidadId: alta!.id, ip, detalles: { numero: datos.numero, materialId: datos.materialId, cantidad: datos.cantidad, proveedor: datos.proveedor } }, tx);
    return alta!.id;
  });
  return NextResponse.json({ id });
});
