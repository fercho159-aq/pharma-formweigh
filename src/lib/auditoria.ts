import "server-only";

import { db, type Tx } from "@/db";
import { auditoria } from "@/db/schema";

export interface EventoAuditoria {
  usuarioId: string | null;
  accion: string;
  entidad: string;
  entidadId: string;
  detalles?: Record<string, unknown>;
  ip: string | null;
}

/**
 * Asiento de bitácora. Pasa `tx` para que el asiento viva o muera con la operación
 * que documenta. La tabla es inmutable (trigger en BD): aquí solo se inserta.
 */
export async function registrarAuditoria(evento: EventoAuditoria, tx: Tx | typeof db = db): Promise<void> {
  await tx.insert(auditoria).values({
    usuarioId: evento.usuarioId,
    accion: evento.accion,
    entidad: evento.entidad,
    entidadId: evento.entidadId,
    detalles: JSON.stringify(evento.detalles ?? {}),
    ip: evento.ip,
  });
}
