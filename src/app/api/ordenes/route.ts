import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { ordenesProduccion, recetas } from "@/db/schema";
import { ruta } from "@/lib/api";
import { registrarAuditoria } from "@/lib/auditoria";
import { ErrorDominio } from "@/lib/dominio/errores";
import { formatearNumeroOrden } from "@/lib/dominio/ordenes";
import { esquemaCrearOrden } from "@/lib/esquemas";
import { siguienteConsecutivoOrden } from "@/lib/servicios/dispensado";

export const GET = ruta({ permiso: "ordenes.ver" }, async () => {
  const lista = await db
    .select({
      id: ordenesProduccion.id,
      numero: ordenesProduccion.numero,
      recetaId: ordenesProduccion.recetaId,
      loteProducto: ordenesProduccion.loteProducto,
      cantidad: ordenesProduccion.cantidad,
      estado: ordenesProduccion.estado,
      prioridad: ordenesProduccion.prioridad,
      createdAt: ordenesProduccion.createdAt,
      updatedAt: ordenesProduccion.updatedAt,
      recetaNombre: recetas.nombre,
      recetaCodigo: recetas.codigo,
    })
    .from(ordenesProduccion)
    .innerJoin(recetas, eq(ordenesProduccion.recetaId, recetas.id))
    .orderBy(desc(ordenesProduccion.prioridad), desc(ordenesProduccion.createdAt));
  return NextResponse.json(lista);
});

export const POST = ruta({ permiso: "ordenes.crear", esquema: esquemaCrearOrden }, async ({ usuario, datos, ip }) => {
  const resultado = await db.transaction(async (tx) => {
    const [receta] = await tx.select({ id: recetas.id, activa: recetas.activa }).from(recetas).where(eq(recetas.id, datos.recetaId));
    if (!receta || !receta.activa) throw new ErrorDominio("La receta no existe o está inactiva.", "RECETA_NO_DISPONIBLE", 404);
    const numero = formatearNumeroOrden(await siguienteConsecutivoOrden(tx));
    const [alta] = await tx
      .insert(ordenesProduccion)
      .values({ numero, recetaId: datos.recetaId, loteProducto: datos.loteProducto, cantidad: datos.cantidad, prioridad: datos.prioridad })
      .returning({ id: ordenesProduccion.id });
    await registrarAuditoria({ usuarioId: usuario.id, accion: "CREAR_ORDEN", entidad: "ordenes_produccion", entidadId: alta!.id, ip, detalles: { numero, loteProducto: datos.loteProducto, cantidad: datos.cantidad } }, tx);
    return { id: alta!.id, numero };
  });
  return NextResponse.json(resultado);
});
