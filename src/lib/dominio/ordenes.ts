import type { EstadoOrden } from "./catalogos";
import { ErrorDominio } from "./errores";

/** Único módulo que decide transiciones de una orden de producción. */
const TRANSICIONES_ORDEN: Record<EstadoOrden, readonly EstadoOrden[]> = {
  PENDIENTE: ["EN_PROCESO", "CANCELADA"],
  EN_PROCESO: ["DISPENSADO", "CANCELADA"],
  DISPENSADO: ["COMPLETADA"],
  COMPLETADA: [],
  CANCELADA: [],
};

export function puedeTransicionarOrden(actual: EstadoOrden, nuevo: EstadoOrden): boolean {
  return TRANSICIONES_ORDEN[actual].includes(nuevo);
}

export function validarOrdenAdmiteDispensado(estado: EstadoOrden): void {
  if (estado !== "PENDIENTE" && estado !== "EN_PROCESO") {
    throw new ErrorDominio(`La orden está ${estado}: ya no admite pesajes.`, "ORDEN_NO_ADMITE_DISPENSADO");
  }
}

export function formatearNumeroOrden(consecutivo: number): string {
  return `ORD-${String(consecutivo).padStart(5, "0")}`;
}
