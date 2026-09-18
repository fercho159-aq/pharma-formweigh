import { ErrorDominio } from "./errores";

export interface FaseEstado {
  id: string;
  orden: number;
  /** ids de ingredientes de la fase, en orden de receta */
  ingredientes: ReadonlyArray<{ id: string; orden: number }>;
  firmada: boolean;
}

/**
 * "No puedes saltarte pasos ni cambiar el orden" (Manual del Operario §3):
 * el siguiente pesaje válido es el primer ingrediente sin dispensar de la primera
 * fase sin firmar, y solo si todas las fases anteriores ya están firmadas.
 */
export function siguientePaso(
  fases: readonly FaseEstado[],
  dispensados: ReadonlySet<string>,
): { faseId: string; ingredienteId: string } | null {
  const ordenadas = [...fases].sort((a, b) => a.orden - b.orden);
  for (const fase of ordenadas) {
    const pendiente = [...fase.ingredientes].sort((a, b) => a.orden - b.orden).find((i) => !dispensados.has(i.id));
    if (pendiente) return { faseId: fase.id, ingredienteId: pendiente.id };
    if (!fase.firmada) return null; // fase completa esperando firma: bloquea las siguientes
  }
  return null;
}

export function validarPasoEnOrden(
  fases: readonly FaseEstado[],
  dispensados: ReadonlySet<string>,
  ingredienteId: string,
): void {
  if (dispensados.has(ingredienteId)) {
    throw new ErrorDominio("Este ingrediente ya fue dispensado en esta orden.", "PASO_YA_DISPENSADO");
  }
  const siguiente = siguientePaso(fases, dispensados);
  if (!siguiente) {
    throw new ErrorDominio("La fase actual está completa y espera firma del supervisor.", "FASE_ESPERA_FIRMA");
  }
  if (siguiente.ingredienteId !== ingredienteId) {
    throw new ErrorDominio("No puedes saltarte pasos ni cambiar el orden de la receta.", "PASO_FUERA_DE_ORDEN");
  }
}

export function validarFaseFirmable(
  fases: readonly FaseEstado[],
  dispensados: ReadonlySet<string>,
  faseId: string,
): void {
  const ordenadas = [...fases].sort((a, b) => a.orden - b.orden);
  const fase = ordenadas.find((f) => f.id === faseId);
  if (!fase) throw new ErrorDominio("La fase no pertenece a la receta de esta orden.", "FASE_NO_PERTENECE", 404);
  if (fase.firmada) throw new ErrorDominio("Esta fase ya está firmada.", "FASE_YA_FIRMADA");
  if (ordenadas.some((f) => f.orden < fase.orden && !f.firmada)) {
    throw new ErrorDominio("Hay fases anteriores sin firmar.", "FASE_ANTERIOR_SIN_FIRMA");
  }
  if (fase.ingredientes.length === 0 || fase.ingredientes.some((i) => !dispensados.has(i.id))) {
    throw new ErrorDominio("La fase aún tiene ingredientes sin dispensar.", "FASE_INCOMPLETA");
  }
}

/** La orden pasa a DISPENSADO cuando todas sus fases quedan firmadas. */
export function todasFirmadas(fases: readonly FaseEstado[], faseRecienFirmada: string): boolean {
  return fases.length > 0 && fases.every((f) => f.firmada || f.id === faseRecienFirmada);
}
