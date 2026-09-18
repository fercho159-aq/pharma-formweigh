import { formatearFecha } from "../fechas";
import { aDiezmilesimas } from "./cantidades";
import type { EstadoLote, Rol } from "./catalogos";
import { ErrorDominio } from "./errores";

export interface LoteParaDispensar {
  materialId: string;
  materialNombre: string;
  cantidad: number;
  estado: EstadoLote;
  fechaCaducidad: Date;
}

/** Única regla que decide si un lote puede usarse en un pesaje. La usan validar-lote y registrar. */
export function validarLoteParaDispensar(
  lote: LoteParaDispensar | null,
  materialIdEsperado: string,
  cantidadRequerida: number,
  ahora: Date,
): void {
  if (!lote) throw new ErrorDominio("Lote no encontrado. Verifica el código de barras.", "LOTE_NO_ENCONTRADO", 404);
  if (lote.materialId !== materialIdEsperado) {
    throw new ErrorDominio(
      `Material incorrecto. Se esperaba el material requerido, pero este lote es de: ${lote.materialNombre}`,
      "LOTE_MATERIAL_INCORRECTO",
    );
  }
  if (lote.estado !== "APROBADO") {
    throw new ErrorDominio(`Lote en estado ${lote.estado}. Solo se pueden usar lotes APROBADOS.`, "LOTE_NO_APROBADO");
  }
  if (lote.fechaCaducidad.getTime() < ahora.getTime()) {
    throw new ErrorDominio(
      `Lote CADUCADO (${formatearFecha(lote.fechaCaducidad)}). No se puede utilizar.`,
      "LOTE_CADUCADO",
    );
  }
  if (aDiezmilesimas(lote.cantidad) < aDiezmilesimas(cantidadRequerida)) {
    throw new ErrorDominio(
      `Cantidad insuficiente. Disponible: ${lote.cantidad}, Requerido: ${cantidadRequerida}`,
      "LOTE_INSUFICIENTE",
    );
  }
}

/**
 * Máquina de estados del lote (manuales de Almacén y Calidad): todo lote entra en
 * CUARENTENA; Calidad aprueba o rechaza; un lote aprobado puede volver a cuarentena.
 * AGOTADO lo pone el sistema al llegar a cero. RECHAZADO, AGOTADO y CADUCADO son finales.
 */
const TRANSICIONES_LOTE: Record<EstadoLote, readonly EstadoLote[]> = {
  CUARENTENA: ["APROBADO", "RECHAZADO"],
  APROBADO: ["CUARENTENA"],
  RECHAZADO: [],
  AGOTADO: [],
  CADUCADO: [],
};

const ROLES_LIBERAN: readonly Rol[] = ["ADMIN", "SUPERVISOR", "CALIDAD"];
const ROLES_RETIENEN: readonly Rol[] = ["ADMIN", "SUPERVISOR", "CALIDAD", "ALMACEN"];

export function validarCambioEstadoLote(actual: EstadoLote, nuevo: EstadoLote, rol: Rol): void {
  if (!TRANSICIONES_LOTE[actual].includes(nuevo)) {
    throw new ErrorDominio(`Un lote ${actual} no puede pasar a ${nuevo}.`, "LOTE_TRANSICION_INVALIDA");
  }
  const permitidos = nuevo === "CUARENTENA" ? ROLES_RETIENEN : ROLES_LIBERAN;
  if (!permitidos.includes(rol)) {
    throw new ErrorDominio(
      nuevo === "CUARENTENA"
        ? "Tu rol no puede poner lotes en cuarentena."
        : "Solo Calidad, Supervisor o Admin pueden aprobar o rechazar lotes.",
      "LOTE_ROL_NO_AUTORIZADO",
      403,
    );
  }
}

export function estadoTrasDescuento(cantidadRestante: number): EstadoLote | null {
  return aDiezmilesimas(cantidadRestante) <= 0 ? "AGOTADO" : null;
}
