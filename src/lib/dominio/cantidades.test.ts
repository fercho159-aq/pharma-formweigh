import { describe, expect, it } from "vitest";

import { aDiezmilesimas, deDiezmilesimas, ESCALA, multiplicar, normalizar, restar } from "./cantidades";

describe("aDiezmilesimas", () => {
  it("escala a enteros de diezmilésima", () => {
    expect(aDiezmilesimas(1)).toBe(10_000);
    expect(aDiezmilesimas(0.0001)).toBe(1);
    expect(aDiezmilesimas(0)).toBe(0);
    expect(aDiezmilesimas(12.3456)).toBe(123_456);
  });

  it("absorbe el error de punto flotante clásico", () => {
    expect(aDiezmilesimas(0.1 + 0.2)).toBe(3_000);
    expect(aDiezmilesimas(3.5 * 1.02)).toBe(35_700);
  });

  it("redondea el quinto decimal", () => {
    expect(aDiezmilesimas(0.00004)).toBe(0);
    expect(aDiezmilesimas(0.00005)).toBe(1);
    expect(aDiezmilesimas(1.23455)).toBe(12_346);
  });

  it("admite negativos (descuentos de inventario)", () => {
    expect(aDiezmilesimas(-2.5)).toBe(-25_000);
  });

  it("lanza RangeError con NaN e Infinity", () => {
    expect(() => aDiezmilesimas(NaN)).toThrow(RangeError);
    expect(() => aDiezmilesimas(Infinity)).toThrow(RangeError);
    expect(() => aDiezmilesimas(-Infinity)).toThrow(RangeError);
    expect(() => aDiezmilesimas(NaN)).toThrow(/no finita/i);
  });
});

describe("deDiezmilesimas", () => {
  it("es la inversa exacta de aDiezmilesimas", () => {
    for (const v of [0, 0.0001, 0.05, 1, 3.57, 999.9999, 1_000_000]) {
      expect(deDiezmilesimas(aDiezmilesimas(v))).toBe(v);
    }
  });

  it("usa la escala publicada", () => {
    expect(ESCALA).toBe(10_000);
    expect(deDiezmilesimas(ESCALA)).toBe(1);
  });
});

describe("normalizar", () => {
  it("recorta a los 4 decimales de la BD", () => {
    expect(normalizar(1.23456)).toBe(1.2346);
    expect(normalizar(0.1 + 0.2)).toBe(0.3);
    expect(normalizar(2)).toBe(2);
  });

  it("es idempotente", () => {
    const una = normalizar(7.77777);
    expect(normalizar(una)).toBe(una);
  });
});

describe("multiplicar", () => {
  it("evita el arrastre de float en el escalado de la orden", () => {
    expect(multiplicar(3.5, 1.02)).toBe(3.57);
    expect(multiplicar(0.1, 3)).toBe(0.3);
    expect(multiplicar(1.1, 1.1)).toBe(1.21);
  });

  it("redondea el producto a 4 decimales", () => {
    // 0.0001 × 0.5 = 0.00005 → 0.0001
    expect(multiplicar(0.0001, 0.5)).toBe(0.0001);
    // 0.0001 × 0.4 = 0.00004 → 0
    expect(multiplicar(0.0001, 0.4)).toBe(0);
  });

  it("respeta neutro y cero", () => {
    expect(multiplicar(12.3456, 1)).toBe(12.3456);
    expect(multiplicar(12.3456, 0)).toBe(0);
  });

  it("escala cantidades de receta por el multiplicador de la orden", () => {
    expect(multiplicar(0.05, 2.5)).toBe(0.125);
    expect(multiplicar(125.5, 3)).toBe(376.5);
  });

  it("propaga el error con valores no finitos", () => {
    expect(() => multiplicar(NaN, 2)).toThrow(RangeError);
    expect(() => multiplicar(2, Infinity)).toThrow(RangeError);
  });
});

describe("restar", () => {
  it("resta sin error de float", () => {
    expect(restar(0.3, 0.1)).toBe(0.2);
    expect(restar(1.1, 1)).toBe(0.1);
    expect(restar(100, 33.3333)).toBe(66.6667);
  });

  it("llega a cero exacto al agotar un lote", () => {
    expect(restar(2.5, 2.5)).toBe(0);
  });

  it("puede dar negativo (sobreconsumo)", () => {
    expect(restar(1, 1.5)).toBe(-0.5);
  });

  it("propaga el error con valores no finitos", () => {
    expect(() => restar(1, NaN)).toThrow(RangeError);
  });
});
