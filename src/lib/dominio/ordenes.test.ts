import type { EstadoOrden } from "./catalogos";

import { describe, expect, it } from "vitest";

import { ErrorDominio } from "./errores";
import { formatearNumeroOrden, puedeTransicionarOrden, validarOrdenAdmiteDispensado } from "./ordenes";

const TODOS: readonly EstadoOrden[] = ["PENDIENTE", "EN_PROCESO", "DISPENSADO", "COMPLETADA", "CANCELADA"];
const VALIDAS: ReadonlyArray<[EstadoOrden, EstadoOrden]> = [
  ["PENDIENTE", "EN_PROCESO"],
  ["PENDIENTE", "CANCELADA"],
  ["EN_PROCESO", "DISPENSADO"],
  ["EN_PROCESO", "CANCELADA"],
  ["DISPENSADO", "COMPLETADA"],
];

describe("puedeTransicionarOrden", () => {
  it.each(VALIDAS)("permite %s → %s", (actual, nuevo) => {
    expect(puedeTransicionarOrden(actual, nuevo)).toBe(true);
  });

  it("niega cualquier otra combinación de la tabla", () => {
    const invalidas = TODOS.flatMap((actual) =>
      TODOS.filter((nuevo) => !VALIDAS.some(([a, n]) => a === actual && n === nuevo)).map(
        (nuevo) => [actual, nuevo] as const,
      ),
    );
    expect(invalidas).toHaveLength(20);
    for (const [actual, nuevo] of invalidas) {
      expect(puedeTransicionarOrden(actual, nuevo), `${actual} → ${nuevo}`).toBe(false);
    }
  });

  it("no permite retroceder ni saltarse el dispensado", () => {
    expect(puedeTransicionarOrden("EN_PROCESO", "PENDIENTE")).toBe(false);
    expect(puedeTransicionarOrden("PENDIENTE", "DISPENSADO")).toBe(false);
    expect(puedeTransicionarOrden("PENDIENTE", "COMPLETADA")).toBe(false);
    expect(puedeTransicionarOrden("DISPENSADO", "EN_PROCESO")).toBe(false);
  });

  it("COMPLETADA y CANCELADA son finales (ni siquiera se cancela lo dispensado)", () => {
    for (const nuevo of TODOS) {
      expect(puedeTransicionarOrden("COMPLETADA", nuevo)).toBe(false);
      expect(puedeTransicionarOrden("CANCELADA", nuevo)).toBe(false);
    }
    expect(puedeTransicionarOrden("DISPENSADO", "CANCELADA")).toBe(false);
  });

  it("ningún estado transiciona a sí mismo", () => {
    for (const estado of TODOS) {
      expect(puedeTransicionarOrden(estado, estado)).toBe(false);
    }
  });
});

describe("validarOrdenAdmiteDispensado", () => {
  it.each<EstadoOrden>(["PENDIENTE", "EN_PROCESO"])("deja pesar una orden %s", (estado) => {
    expect(() => validarOrdenAdmiteDispensado(estado)).not.toThrow();
  });

  it.each<EstadoOrden>(["DISPENSADO", "COMPLETADA", "CANCELADA"])("bloquea el pesaje en una orden %s", (estado) => {
    try {
      validarOrdenAdmiteDispensado(estado);
      throw new Error("Se esperaba un ErrorDominio");
    } catch (e) {
      expect(e).toBeInstanceOf(ErrorDominio);
      const err = e as ErrorDominio;
      expect(err.codigo).toBe("ORDEN_NO_ADMITE_DISPENSADO");
      expect(err.status).toBe(409);
      expect(err.message).toContain(estado);
    }
  });
});

describe("formatearNumeroOrden", () => {
  it("rellena a 5 dígitos", () => {
    expect(formatearNumeroOrden(1)).toBe("ORD-00001");
    expect(formatearNumeroOrden(42)).toBe("ORD-00042");
    expect(formatearNumeroOrden(12_345)).toBe("ORD-12345");
  });

  it("no trunca al pasar de 99999", () => {
    expect(formatearNumeroOrden(100_000)).toBe("ORD-100000");
  });

  it("acepta el cero de la secuencia", () => {
    expect(formatearNumeroOrden(0)).toBe("ORD-00000");
  });
});
