import "server-only";

import { and, eq, gt, sql } from "drizzle-orm";

import { db } from "@/db";
import { intentosAcceso } from "@/db/schema";
import { ErrorDominio } from "@/lib/dominio/errores";

/**
 * Límite de intentos (ADR-003), en BD para sobrevivir reinicios. Por correo: 5 fallos en
 * 15 min. Por IP el tope es más alto: en planta todas las estaciones salen por la misma IP
 * y los errores de dedo de un turno no deben bloquear a los demás.
 */
export const MAX_FALLOS = 5;
export const MAX_FALLOS_IP = 30;
export const VENTANA_MS = 15 * 60 * 1000;

export type TipoIntento = "login" | "firma";

export async function exigirSinBloqueo(tipo: TipoIntento, claves: readonly string[]): Promise<void> {
  const desde = new Date(Date.now() - VENTANA_MS);
  for (const clave of claves) {
    const [fila] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(intentosAcceso)
      .where(
        and(
          eq(intentosAcceso.tipo, tipo),
          eq(intentosAcceso.clave, clave),
          eq(intentosAcceso.exito, false),
          gt(intentosAcceso.timestamp, desde),
        ),
      );
    if ((fila?.n ?? 0) >= (clave.startsWith("ip:") ? MAX_FALLOS_IP : MAX_FALLOS)) {
      throw new ErrorDominio("Demasiados intentos fallidos. Espera 15 minutos e inténtalo de nuevo.", "DEMASIADOS_INTENTOS", 429);
    }
  }
}

export async function registrarIntento(tipo: TipoIntento, claves: readonly string[], exito: boolean): Promise<void> {
  if (claves.length === 0) return;
  await db.insert(intentosAcceso).values(claves.map((clave) => ({ tipo, clave, exito })));
  if (exito) {
    // Un acceso correcto limpia los fallos previos de esas claves.
    for (const clave of claves) {
      await db
        .delete(intentosAcceso)
        .where(and(eq(intentosAcceso.tipo, tipo), eq(intentosAcceso.clave, clave), eq(intentosAcceso.exito, false)));
    }
  }
}
