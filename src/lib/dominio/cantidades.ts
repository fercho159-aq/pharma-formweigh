/**
 * Cantidades (kg, L, …) con 4 decimales. La BD guarda `numeric(14,4)`; para
 * comparar y sumar sin error de punto flotante se trabaja en diezmilésimas enteras.
 */
export const ESCALA = 10_000;

export function aDiezmilesimas(valor: number): number {
  if (!Number.isFinite(valor)) throw new RangeError("Cantidad no finita");
  return Math.round(valor * ESCALA);
}

export function deDiezmilesimas(entero: number): number {
  return entero / ESCALA;
}

/** Redondea a los 4 decimales que admite la BD. */
export function normalizar(valor: number): number {
  return deDiezmilesimas(aDiezmilesimas(valor));
}

export function multiplicar(a: number, b: number): number {
  // a y b traen a lo más 4 decimales: el producto exacto tiene 8; se redondea a 4.
  return deDiezmilesimas(Math.round((aDiezmilesimas(a) * aDiezmilesimas(b)) / ESCALA));
}

export function restar(a: number, b: number): number {
  return deDiezmilesimas(aDiezmilesimas(a) - aDiezmilesimas(b));
}
