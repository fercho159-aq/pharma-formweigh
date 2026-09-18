import { describe, expect, it } from "vitest";

import { ErrorDominio } from "./errores";
import { type FaseEstado, siguientePaso, todasFirmadas, validarFaseFirmable, validarPasoEnOrden } from "./fases";

/** Receta de dos fases: A (a1, a2) y B (b1, b2). */
function receta(firmadas: { A?: boolean; B?: boolean } = {}): FaseEstado[] {
  return [
    {
      id: "faseA",
      orden: 1,
      ingredientes: [
        { id: "a1", orden: 1 },
        { id: "a2", orden: 2 },
      ],
      firmada: firmadas.A ?? false,
    },
    {
      id: "faseB",
      orden: 2,
      ingredientes: [
        { id: "b1", orden: 1 },
        { id: "b2", orden: 2 },
      ],
      firmada: firmadas.B ?? false,
    },
  ];
}

const disp = (...ids: string[]) => new Set(ids);

function codigoDe(fn: () => void): { codigo: string; status: number } {
  try {
    fn();
  } catch (e) {
    if (e instanceof ErrorDominio) return { codigo: e.codigo, status: e.status };
    throw e;
  }
  throw new Error("Se esperaba un ErrorDominio y no se lanzó ninguno");
}

describe("siguientePaso", () => {
  it("arranca por el primer ingrediente de la primera fase", () => {
    expect(siguientePaso(receta(), disp())).toEqual({ faseId: "faseA", ingredienteId: "a1" });
  });

  it("avanza al siguiente ingrediente de la misma fase", () => {
    expect(siguientePaso(receta(), disp("a1"))).toEqual({ faseId: "faseA", ingredienteId: "a2" });
  });

  it("se detiene cuando la fase queda completa y falta la firma", () => {
    expect(siguientePaso(receta(), disp("a1", "a2"))).toBeNull();
  });

  it("pasa a la siguiente fase solo después de la firma", () => {
    expect(siguientePaso(receta({ A: true }), disp("a1", "a2"))).toEqual({ faseId: "faseB", ingredienteId: "b1" });
  });

  it("devuelve null cuando ya se dispensó y firmó todo", () => {
    expect(siguientePaso(receta({ A: true, B: true }), disp("a1", "a2", "b1", "b2"))).toBeNull();
  });

  it("respeta el orden aunque el arreglo venga desordenado", () => {
    const desordenada = [...receta()].reverse();
    expect(siguientePaso(desordenada, disp())).toEqual({ faseId: "faseA", ingredienteId: "a1" });
    const ingredientesAlReves: FaseEstado[] = [
      { id: "faseA", orden: 1, ingredientes: [{ id: "a2", orden: 2 }, { id: "a1", orden: 1 }], firmada: false },
    ];
    expect(siguientePaso(ingredientesAlReves, disp())).toEqual({ faseId: "faseA", ingredienteId: "a1" });
  });

  it("no muta el arreglo de fases que recibe", () => {
    const fases = [...receta()].reverse();
    const copia = fases.map((f) => f.id);
    siguientePaso(fases, disp());
    expect(fases.map((f) => f.id)).toEqual(copia);
  });

  it("devuelve null con una receta sin fases", () => {
    expect(siguientePaso([], disp())).toBeNull();
  });

  it("una fase vacía sin firmar bloquea el avance", () => {
    const fases: FaseEstado[] = [
      { id: "faseVacia", orden: 1, ingredientes: [], firmada: false },
      ...receta().slice(1),
    ];
    expect(siguientePaso(fases, disp())).toBeNull();
  });
});

describe("validarPasoEnOrden", () => {
  it("deja registrar el paso que toca", () => {
    expect(() => validarPasoEnOrden(receta(), disp(), "a1")).not.toThrow();
    expect(() => validarPasoEnOrden(receta(), disp("a1"), "a2")).not.toThrow();
    expect(() => validarPasoEnOrden(receta({ A: true }), disp("a1", "a2"), "b1")).not.toThrow();
  });

  it("bloquea el doble registro del mismo ingrediente (doble clic)", () => {
    expect(codigoDe(() => validarPasoEnOrden(receta(), disp("a1"), "a1")).codigo).toBe("PASO_YA_DISPENSADO");
  });

  it("bloquea saltarse un ingrediente dentro de la fase", () => {
    expect(codigoDe(() => validarPasoEnOrden(receta(), disp(), "a2")).codigo).toBe("PASO_FUERA_DE_ORDEN");
  });

  it("bloquea saltarse a una fase posterior", () => {
    expect(codigoDe(() => validarPasoEnOrden(receta(), disp(), "b1")).codigo).toBe("PASO_FUERA_DE_ORDEN");
  });

  it("bloquea un ingrediente que no es de esta receta", () => {
    expect(codigoDe(() => validarPasoEnOrden(receta(), disp(), "ajeno")).codigo).toBe("PASO_FUERA_DE_ORDEN");
  });

  it("bloquea con mensaje de firma cuando la fase está completa y sin firmar", () => {
    const e = codigoDe(() => validarPasoEnOrden(receta(), disp("a1", "a2"), "b1"));
    expect(e.codigo).toBe("FASE_ESPERA_FIRMA");
  });

  it("bloquea todo paso cuando ya no queda nada por dispensar", () => {
    const e = codigoDe(() =>
      validarPasoEnOrden(receta({ A: true, B: true }), disp("a1", "a2", "b1", "b2"), "otro"),
    );
    expect(e.codigo).toBe("FASE_ESPERA_FIRMA");
  });

  it("el doble registro se detecta aunque la fase ya esté completa", () => {
    expect(codigoDe(() => validarPasoEnOrden(receta(), disp("a1", "a2"), "a2")).codigo).toBe("PASO_YA_DISPENSADO");
  });
});

describe("validarFaseFirmable", () => {
  it("firma una fase completa sin fases anteriores pendientes", () => {
    expect(() => validarFaseFirmable(receta(), disp("a1", "a2"), "faseA")).not.toThrow();
    expect(() => validarFaseFirmable(receta({ A: true }), disp("a1", "a2", "b1", "b2"), "faseB")).not.toThrow();
  });

  it("rechaza con 404 una fase que no pertenece a la receta", () => {
    const e = codigoDe(() => validarFaseFirmable(receta(), disp("a1", "a2"), "faseZ"));
    expect(e.codigo).toBe("FASE_NO_PERTENECE");
    expect(e.status).toBe(404);
  });

  it("no permite firmar dos veces la misma fase", () => {
    expect(codigoDe(() => validarFaseFirmable(receta({ A: true }), disp("a1", "a2"), "faseA")).codigo).toBe(
      "FASE_YA_FIRMADA",
    );
  });

  it("exige que las fases anteriores estén firmadas", () => {
    const e = codigoDe(() => validarFaseFirmable(receta(), disp("a1", "a2", "b1", "b2"), "faseB"));
    expect(e.codigo).toBe("FASE_ANTERIOR_SIN_FIRMA");
  });

  it("exige que la fase esté completa", () => {
    expect(codigoDe(() => validarFaseFirmable(receta(), disp("a1"), "faseA")).codigo).toBe("FASE_INCOMPLETA");
    expect(codigoDe(() => validarFaseFirmable(receta(), disp(), "faseA")).codigo).toBe("FASE_INCOMPLETA");
  });

  it("no firma una fase sin ingredientes", () => {
    const fases: FaseEstado[] = [{ id: "faseVacia", orden: 1, ingredientes: [], firmada: false }];
    expect(codigoDe(() => validarFaseFirmable(fases, disp(), "faseVacia")).codigo).toBe("FASE_INCOMPLETA");
  });

  it("la firma pendiente de una fase anterior pesa más que la fase incompleta", () => {
    const e = codigoDe(() => validarFaseFirmable(receta(), disp("a1", "a2", "b1"), "faseB"));
    expect(e.codigo).toBe("FASE_ANTERIOR_SIN_FIRMA");
  });
});

describe("todasFirmadas", () => {
  it("es verdadero cuando la firma en curso cierra la última fase pendiente", () => {
    expect(todasFirmadas(receta({ A: true }), "faseB")).toBe(true);
  });

  it("es falso si queda otra fase sin firmar", () => {
    expect(todasFirmadas(receta(), "faseB")).toBe(false);
  });

  it("es falso con una receta sin fases", () => {
    expect(todasFirmadas([], "faseA")).toBe(false);
  });

  it("es verdadero con una sola fase que se acaba de firmar", () => {
    const fases: FaseEstado[] = [{ id: "faseUnica", orden: 1, ingredientes: [{ id: "x", orden: 1 }], firmada: false }];
    expect(todasFirmadas(fases, "faseUnica")).toBe(true);
  });

  it("no se deja engañar por una fase ajena si aún hay pendientes", () => {
    expect(todasFirmadas(receta({ A: true }), "faseZ")).toBe(false);
  });
});
