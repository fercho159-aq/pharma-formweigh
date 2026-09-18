import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { lotes } from "@/db/schema";
import { ruta } from "@/lib/api";
import { registrarAuditoria } from "@/lib/auditoria";
import { ErrorDominio } from "@/lib/dominio/errores";
import { validarCambioEstadoLote } from "@/lib/dominio/lotes";
import { esquemaCambiarEstadoLote } from "@/lib/esquemas";

export const PATCH = ruta<typeof esquemaCambiarEstadoLote, { id: string }>(
  { permiso: "inventario.cambiarEstadoLote", esquema: esquemaCambiarEstadoLote },
  async ({ usuario, datos, params, ip }) => {
    await db.transaction(async (tx) => {
      const [lote] = await tx.select({ estado: lotes.estado, numero: lotes.numero }).from(lotes).where(eq(lotes.id, params.id)).for("update");
      if (!lote) throw new ErrorDominio("Lote no encontrado", "LOTE_NO_ENCONTRADO", 404);
      validarCambioEstadoLote(lote.estado, datos.estado, usuario.rol);
      await tx.update(lotes).set({ estado: datos.estado }).where(eq(lotes.id, params.id));
      await registrarAuditoria({ usuarioId: usuario.id, accion: "CAMBIAR_ESTADO_LOTE", entidad: "lotes", entidadId: params.id, ip, detalles: { numero: lote.numero, estadoAnterior: lote.estado, estadoNuevo: datos.estado } }, tx);
    });
    return NextResponse.json({ ok: true });
  },
);
