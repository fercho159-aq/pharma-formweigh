import { describe, expect, it } from "vitest";

import {
  BARRA_AMBAR_ANCHO,
  BARRA_VERDE_FIN,
  BARRA_VERDE_INICIO,
  calcularRango,
  dentroDeTolerancia,
  evaluarPeso,
  posicionEnBarra,
  type ReglaIngrediente,
} from "./tolerancia";

const regla = (cantidadTarget: number, toleranciaMin: number, toleranciaMax: number): ReglaIngrediente => ({
  cantidadTarget,
  toleranciaMin,
  toleranciaMax,
});

describe("calcularRango", () => {
  it("escala el target por el multiplicador de la orden", () => {
    expect(calcularRango(regla(2, -2, 2), 1).target).toBe(2);
    expect(calcularRango(regla(2, -2, 2), 3).target).toBe(6);
    expect(calcularRango(regla(0.05, -5, 5), 2.5).target).toBe(0.125);
  });

  it("aplica el porcentaje al target ya escalado, no al de la receta", () => {
    // 1 kg × 10 = 10 kg ± 2 % → 9.8 … 10.2 (no 0.98 … 1.02)
    expect(calcularRango(regla(1, -2, 2), 10)).toEqual({ target: 10, min: 9.8, max: 10.2 });
  });

  it("calcula tolerancias simétricas de manual", () => {
    expect(calcularRango(regla(1, -2, 2), 1)).toEqual({ target: 1, min: 0.98, max: 1.02 });
    expect(calcularRango(regla(125.5, -1, 1), 1)).toEqual({ target: 125.5, min: 124.245, max: 126.755 });
  });

  it("admite tolerancias asimétricas (-1 / +3)", () => {
    expect(calcularRango(regla(10, -1, 3), 1)).toEqual({ target: 10, min: 9.9, max: 10.3 });
  });

  it("admite tolerancia cero: solo el peso exacto", () => {
    expect(calcularRango(regla(1.5, 0, 0), 1)).toEqual({ target: 1.5, min: 1.5, max: 1.5 });
  });

  it("maneja cantidades chicas (0.05 kg ± 5 %)", () => {
    expect(calcularRango(regla(0.05, -5, 5), 1)).toEqual({ target: 0.05, min: 0.0475, max: 0.0525 });
  });

  it("soporta porcentajes fraccionarios (-2.5 % / +2.5 %)", () => {
    expect(calcularRango(regla(1, -2.5, 2.5), 1)).toEqual({ target: 1, min: 0.975, max: 1.025 });
  });

  it("redondea los límites SIEMPRE hacia adentro del rango", () => {
    // 0.0333 kg ± 2 % → exacto 0.032634 … 0.033966; la BD solo admite 4 decimales.
    const r = calcularRango(regla(0.0333, -2, 2), 1);
    expect(r).toEqual({ target: 0.0333, min: 0.0327, max: 0.0339 });
    // El mínimo sube (0.032634 → 0.0327) y el máximo baja (0.033966 → 0.0339):
    // nunca se acepta un peso fuera del rango real por culpa del redondeo.
    expect(r.min).toBeGreaterThan(0.032634);
    expect(r.max).toBeLessThan(0.033966);
  });

  it("no arrastra error de float al escalar (3.5 × 1.02)", () => {
    const r = calcularRango(regla(3.5, -2, 2), 1.02);
    expect(r.target).toBe(3.57);
    expect(r).toEqual({ target: 3.57, min: 3.4986, max: 3.6414 });
  });

  it("colapsa a un punto cuando la tolerancia es menor que una diezmilésima", () => {
    // 0.0001 kg ± 1 % → 0.000099 … 0.000101, imposible de pesar: queda 0.0001.
    expect(calcularRango(regla(0.0001, -1, 1), 1)).toEqual({ target: 0.0001, min: 0.0001, max: 0.0001 });
  });
});

describe("dentroDeTolerancia", () => {
  const rango = calcularRango(regla(1, -2, 2), 1); // 0.98 … 1.02

  it("acepta los límites exactos (inclusivos)", () => {
    expect(dentroDeTolerancia(0.98, rango)).toBe(true);
    expect(dentroDeTolerancia(1.02, rango)).toBe(true);
    expect(dentroDeTolerancia(1, rango)).toBe(true);
  });

  it("rechaza una diezmilésima fuera del rango", () => {
    expect(dentroDeTolerancia(0.9799, rango)).toBe(false);
    expect(dentroDeTolerancia(1.0201, rango)).toBe(false);
  });

  it("acepta una diezmilésima dentro del rango", () => {
    expect(dentroDeTolerancia(0.9801, rango)).toBe(true);
    expect(dentroDeTolerancia(1.0199, rango)).toBe(true);
  });

  it("rechaza pesos groseramente fuera", () => {
    expect(dentroDeTolerancia(0, rango)).toBe(false);
    expect(dentroDeTolerancia(10, rango)).toBe(false);
  });

  it("no se equivoca con pesos que arrastran float", () => {
    const r = calcularRango(regla(0.3, -10, 10), 1); // 0.27 … 0.33
    expect(dentroDeTolerancia(0.1 + 0.2, r)).toBe(true);
    expect(dentroDeTolerancia(0.27, r)).toBe(true);
    expect(dentroDeTolerancia(0.2699, r)).toBe(false);
  });

  it("rechaza de golpe una lectura de báscula no finita", () => {
    expect(() => dentroDeTolerancia(NaN, rango)).toThrow(RangeError);
    expect(() => dentroDeTolerancia(Infinity, rango)).toThrow(RangeError);
  });

  it("con tolerancia cero solo pasa el peso exacto", () => {
    const r = calcularRango(regla(1.5, 0, 0), 1);
    expect(dentroDeTolerancia(1.5, r)).toBe(true);
    expect(dentroDeTolerancia(1.4999, r)).toBe(false);
    expect(dentroDeTolerancia(1.5001, r)).toBe(false);
  });
});

describe("evaluarPeso", () => {
  const rango = calcularRango(regla(1, -2, 2), 1); // 0.98 … 1.02, margen ámbar = 10 % = 0.004

  it("marca low/high fuera del rango", () => {
    expect(evaluarPeso(0.9799, rango)).toBe("low");
    expect(evaluarPeso(0, rango)).toBe("low");
    expect(evaluarPeso(1.0201, rango)).toBe("high");
    expect(evaluarPeso(5, rango)).toBe("high");
  });

  it("los límites exactos están dentro, pero en ámbar", () => {
    expect(evaluarPeso(0.98, rango)).toBe("warning");
    expect(evaluarPeso(1.02, rango)).toBe("warning");
  });

  it("marca ok en el centro", () => {
    expect(evaluarPeso(1, rango)).toBe("ok");
  });

  it("respeta la frontera exacta del 10 % inferior", () => {
    // min = 0.98, margen = 0.004 → 0.984 ya es ok, 0.9839 sigue ámbar.
    expect(evaluarPeso(0.9839, rango)).toBe("warning");
    expect(evaluarPeso(0.984, rango)).toBe("ok");
  });

  it("respeta la frontera exacta del 10 % superior", () => {
    // max = 1.02, margen = 0.004 → 1.016 ya es ok, 1.0161 vuelve a ámbar.
    expect(evaluarPeso(1.016, rango)).toBe("ok");
    expect(evaluarPeso(1.0161, rango)).toBe("warning");
  });

  it("es coherente con dentroDeTolerancia", () => {
    for (const peso of [0.9, 0.9799, 0.98, 0.99, 1, 1.01, 1.02, 1.0201, 1.5]) {
      const dentro = dentroDeTolerancia(peso, rango);
      const estado = evaluarPeso(peso, rango);
      expect(dentro).toBe(estado === "ok" || estado === "warning");
    }
  });

  it("con rango de un solo punto el peso exacto es ok", () => {
    const r = calcularRango(regla(1.5, 0, 0), 1);
    expect(evaluarPeso(1.5, r)).toBe("ok");
    expect(evaluarPeso(1.4999, r)).toBe("low");
    expect(evaluarPeso(1.5001, r)).toBe("high");
  });

  it("funciona en cantidades chicas (0.05 kg ± 5 %)", () => {
    const r = calcularRango(regla(0.05, -5, 5), 1); // 0.0475 … 0.0525, margen = 0.0005
    expect(evaluarPeso(0.0474, r)).toBe("low");
    expect(evaluarPeso(0.0475, r)).toBe("warning");
    expect(evaluarPeso(0.048, r)).toBe("ok");
    expect(evaluarPeso(0.05, r)).toBe("ok");
    expect(evaluarPeso(0.052, r)).toBe("ok");
    expect(evaluarPeso(0.0521, r)).toBe("warning");
    expect(evaluarPeso(0.0526, r)).toBe("high");
  });

  it("no se descuadra con rangos cuyo 10 % no es entero en diezmilésimas", () => {
    // 0.0333 kg ± 2 % → 0.0327 … 0.0339: ancho 120 diezmilésimas, margen 12.
    const r = calcularRango(regla(0.0333, -2, 2), 1);
    expect(evaluarPeso(0.0338, r)).toBe("warning");
    expect(evaluarPeso(0.0327, r)).toBe("warning");
    expect(evaluarPeso(0.0333, r)).toBe("ok");
  });
});

describe("calcularRango — porcentajes con más de 2 decimales", () => {
  it("un tercer decimal nunca ensancha la tolerancia (redondeo hacia adentro)", () => {
    const amplio = calcularRango({ cantidadTarget: 100, toleranciaMin: -2.345, toleranciaMax: 2.345 }, 1);
    expect(amplio.min).toBe(97.66); // -2.34 %, no -2.35 %
    expect(amplio.max).toBe(102.34);
  });
  it("el ruido de float de x*100 no recorta un porcentaje exacto", () => {
    const r = calcularRango({ cantidadTarget: 100, toleranciaMin: -1.15, toleranciaMax: 1.15 }, 1);
    expect(r.min).toBe(98.85);
    expect(r.max).toBe(101.15);
  });
});

describe("posicionEnBarra", () => {
  const rango = { target: 5, min: 4.95, max: 5.05 };
  it("los límites caen en los bordes del tercio verde y el target al centro", () => {
    expect(posicionEnBarra(4.95, rango)).toBeCloseTo(BARRA_VERDE_INICIO, 6);
    expect(posicionEnBarra(5.05, rango)).toBeCloseTo(BARRA_VERDE_FIN, 6);
    expect(posicionEnBarra(5, rango)).toBeCloseTo(50, 6);
  });
  it("todo peso dentro de tolerancia queda dentro del verde, y fuera queda fuera", () => {
    for (const p of [4.95, 4.9731, 5, 5.0499, 5.05]) {
      const x = posicionEnBarra(p, rango);
      expect(x).toBeGreaterThanOrEqual(BARRA_VERDE_INICIO - 1e-9);
      expect(x).toBeLessThanOrEqual(BARRA_VERDE_FIN + 1e-9);
    }
    expect(posicionEnBarra(4.9499, rango)).toBeLessThan(BARRA_VERDE_INICIO);
    expect(posicionEnBarra(5.0501, rango)).toBeGreaterThan(BARRA_VERDE_FIN);
  });
  it("se satura en 0 y 100, y no divide entre cero con tolerancia 0", () => {
    expect(posicionEnBarra(0, rango)).toBe(0);
    expect(posicionEnBarra(99, rango)).toBe(100);
    const punto = { target: 1, min: 1, max: 1 };
    expect([posicionEnBarra(0.9, punto), posicionEnBarra(1, punto), posicionEnBarra(1.1, punto)]).toEqual([0, 50, 100]);
  });
});

describe("barra y semáforo comparten zonas", () => {
  it("un peso ámbar cae en la franja ámbar de la barra; uno verde, en la verde", () => {
    const rango = { target: 2, min: 1.98, max: 2.02 };
    for (const p of [1.98, 1.982, 1.9839, 1.984, 1.99, 2, 2.016, 2.0161, 2.02]) {
      const x = posicionEnBarra(p, rango);
      const enAmbar = x < BARRA_VERDE_INICIO + BARRA_AMBAR_ANCHO - 1e-9 || x > BARRA_VERDE_FIN - BARRA_AMBAR_ANCHO + 1e-9;
      expect(enAmbar).toBe(evaluarPeso(p, rango) === "warning");
    }
  });
});
