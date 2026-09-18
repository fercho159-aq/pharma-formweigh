import { aDiezmilesimas, deDiezmilesimas, multiplicar } from "./cantidades";

export interface ReglaIngrediente {
  /** Cantidad de la receta para un lote estándar. */
  cantidadTarget: number;
  /** Porcentaje ≤ 0 (ej. -2 = hasta 2 % por debajo). */
  toleranciaMin: number;
  /** Porcentaje ≥ 0. */
  toleranciaMax: number;
}

export interface RangoPesaje {
  target: number;
  min: number;
  max: number;
}

export type EstadoPesaje = "low" | "warning" | "ok" | "high";

/** Target real = cantidad de receta × multiplicador de la orden; límites por porcentaje. */
export function calcularRango(regla: ReglaIngrediente, multiplicadorOrden: number): RangoPesaje {
  const target = multiplicar(regla.cantidadTarget, multiplicadorOrden);
  const t = aDiezmilesimas(target);
  // Centésimas de porcentaje enteras: -2.5 % → -250. Todo redondeo va hacia ADENTRO del rango
  // (un tercer decimal nunca ensancha la tolerancia); 1e-6 absorbe el ruido de float de x*100.
  const pMin = Math.ceil(regla.toleranciaMin * 100 - 1e-6);
  const pMax = Math.floor(regla.toleranciaMax * 100 + 1e-6);
  const min = Math.ceil((t * (10_000 + pMin)) / 10_000);
  const max = Math.floor((t * (10_000 + pMax)) / 10_000);
  return { target, min: deDiezmilesimas(min), max: deDiezmilesimas(max) };
}

export function dentroDeTolerancia(peso: number, rango: RangoPesaje): boolean {
  const p = aDiezmilesimas(peso);
  return p >= aDiezmilesimas(rango.min) && p <= aDiezmilesimas(rango.max);
}

/** Semáforo: ámbar cuando el peso cae en el 10 % exterior del rango permitido. */
export function evaluarPeso(peso: number, rango: RangoPesaje): EstadoPesaje {
  const p = aDiezmilesimas(peso);
  const min = aDiezmilesimas(rango.min);
  const max = aDiezmilesimas(rango.max);
  if (p < min) return "low";
  if (p > max) return "high";
  const margen = (max - min) * 0.1;
  if (p < min + margen || p > max - margen) return "warning";
  return "ok";
}
