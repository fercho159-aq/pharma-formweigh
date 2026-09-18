import type { EstadoLote, Rol } from "./catalogos";

import { describe, expect, it } from "vitest";

import { ErrorDominio } from "./errores";
import { estadoTrasDescuento, type LoteParaDispensar, validarCambioEstadoLote, validarLoteParaDispensar } from "./lotes";

const AHORA = new Date("2026-09-18T12:00:00.000Z");
const MATERIAL = "mat_paracetamol";

const lote = (cambios: Partial<LoteParaDispensar> = {}): LoteParaDispensar => ({
  materialId: MATERIAL,
  materialNombre: "Paracetamol USP",
  cantidad: 25,
  estado: "APROBADO",
  fechaCaducidad: new Date("2027-01-01T00:00:00.000Z"),
  ...cambios,
});

/** Devuelve el código de ErrorDominio o falla si no lanzó. */
function codigoDe(fn: () => void): { codigo: string; status: number; mensaje: string } {
  try {
    fn();
  } catch (e) {
    if (e instanceof ErrorDominio) return { codigo: e.codigo, status: e.status, mensaje: e.message };
    throw e;
  }
  throw new Error("Se esperaba un ErrorDominio y no se lanzó ninguno");
}

describe("validarLoteParaDispensar", () => {
  it("acepta un lote aprobado, vigente y con existencia suficiente", () => {
    expect(() => validarLoteParaDispensar(lote(), MATERIAL, 10, AHORA)).not.toThrow();
  });

  it("rechaza un lote inexistente con 404", () => {
    const e = codigoDe(() => validarLoteParaDispensar(null, MATERIAL, 10, AHORA));
    expect(e.codigo).toBe("LOTE_NO_ENCONTRADO");
    expect(e.status).toBe(404);
  });

  it("rechaza un lote de otro material y nombra el material escaneado", () => {
    const e = codigoDe(() =>
      validarLoteParaDispensar(lote({ materialId: "mat_otro", materialNombre: "Lactosa" }), MATERIAL, 10, AHORA),
    );
    expect(e.codigo).toBe("LOTE_MATERIAL_INCORRECTO");
    expect(e.mensaje).toContain("Lactosa");
  });

  it.each<EstadoLote>(["CUARENTENA", "RECHAZADO", "AGOTADO", "CADUCADO"])("rechaza un lote %s", (estado) => {
    const e = codigoDe(() => validarLoteParaDispensar(lote({ estado }), MATERIAL, 10, AHORA));
    expect(e.codigo).toBe("LOTE_NO_APROBADO");
    expect(e.mensaje).toContain(estado);
  });

  it("el material se valida antes que el estado", () => {
    const e = codigoDe(() =>
      validarLoteParaDispensar(lote({ materialId: "mat_otro", estado: "RECHAZADO" }), MATERIAL, 10, AHORA),
    );
    expect(e.codigo).toBe("LOTE_MATERIAL_INCORRECTO");
  });

  it("rechaza un lote caducado", () => {
    const e = codigoDe(() =>
      validarLoteParaDispensar(lote({ fechaCaducidad: new Date("2026-09-17T23:59:59.999Z") }), MATERIAL, 10, AHORA),
    );
    expect(e.codigo).toBe("LOTE_CADUCADO");
  });

  it("acepta un lote que caduca justo en este instante", () => {
    expect(() => validarLoteParaDispensar(lote({ fechaCaducidad: new Date(AHORA) }), MATERIAL, 10, AHORA)).not.toThrow();
  });

  it("rechaza un lote que caducó un milisegundo antes", () => {
    const e = codigoDe(() =>
      validarLoteParaDispensar(lote({ fechaCaducidad: new Date(AHORA.getTime() - 1) }), MATERIAL, 10, AHORA),
    );
    expect(e.codigo).toBe("LOTE_CADUCADO");
  });

  it("acepta un lote que caduca un milisegundo después", () => {
    expect(() =>
      validarLoteParaDispensar(lote({ fechaCaducidad: new Date(AHORA.getTime() + 1) }), MATERIAL, 10, AHORA),
    ).not.toThrow();
  });

  it("rechaza cantidad insuficiente informando disponible y requerido", () => {
    const e = codigoDe(() => validarLoteParaDispensar(lote({ cantidad: 9.9999 }), MATERIAL, 10, AHORA));
    expect(e.codigo).toBe("LOTE_INSUFICIENTE");
    expect(e.mensaje).toContain("9.9999");
    expect(e.mensaje).toContain("10");
  });

  it("acepta cuando la existencia alcanza exactamente", () => {
    expect(() => validarLoteParaDispensar(lote({ cantidad: 10 }), MATERIAL, 10, AHORA)).not.toThrow();
    expect(() => validarLoteParaDispensar(lote({ cantidad: 0.0001 }), MATERIAL, 0.0001, AHORA)).not.toThrow();
  });

  it("compara existencias en diezmilésimas, sin error de float", () => {
    expect(() => validarLoteParaDispensar(lote({ cantidad: 0.1 + 0.2 }), MATERIAL, 0.3, AHORA)).not.toThrow();
  });

  it("rechaza un lote vacío aunque siga APROBADO", () => {
    const e = codigoDe(() => validarLoteParaDispensar(lote({ cantidad: 0 }), MATERIAL, 0.0001, AHORA));
    expect(e.codigo).toBe("LOTE_INSUFICIENTE");
  });

  it("la caducidad se valida antes que la existencia", () => {
    const e = codigoDe(() =>
      validarLoteParaDispensar(lote({ cantidad: 0, fechaCaducidad: new Date("2020-01-01") }), MATERIAL, 10, AHORA),
    );
    expect(e.codigo).toBe("LOTE_CADUCADO");
  });
});

describe("validarCambioEstadoLote", () => {
  const TODOS: readonly EstadoLote[] = ["CUARENTENA", "APROBADO", "RECHAZADO", "AGOTADO", "CADUCADO"];
  const VALIDAS: ReadonlyArray<[EstadoLote, EstadoLote]> = [
    ["CUARENTENA", "APROBADO"],
    ["CUARENTENA", "RECHAZADO"],
    ["APROBADO", "CUARENTENA"],
  ];

  it.each(VALIDAS)("Calidad puede pasar un lote de %s a %s", (actual, nuevo) => {
    expect(() => validarCambioEstadoLote(actual, nuevo, "CALIDAD")).not.toThrow();
  });

  it("rechaza toda transición que no esté en la máquina de estados", () => {
    const invalidas = TODOS.flatMap((actual) =>
      TODOS.map((nuevo) => [actual, nuevo] as const).filter(
        ([a, n]) => !VALIDAS.some(([va, vn]) => va === a && vn === n),
      ),
    );
    expect(invalidas).toHaveLength(22);
    for (const [actual, nuevo] of invalidas) {
      const e = codigoDe(() => validarCambioEstadoLote(actual, nuevo, "ADMIN"));
      expect(e.codigo, `${actual} → ${nuevo}`).toBe("LOTE_TRANSICION_INVALIDA");
    }
  });

  it("RECHAZADO, AGOTADO y CADUCADO son finales", () => {
    for (const final of ["RECHAZADO", "AGOTADO", "CADUCADO"] as const) {
      for (const nuevo of TODOS) {
        expect(() => validarCambioEstadoLote(final, nuevo, "ADMIN")).toThrow(ErrorDominio);
      }
    }
  });

  it("no permite reaprobar un lote ya APROBADO ni mandarlo directo a RECHAZADO", () => {
    expect(codigoDe(() => validarCambioEstadoLote("APROBADO", "APROBADO", "CALIDAD")).codigo).toBe(
      "LOTE_TRANSICION_INVALIDA",
    );
    expect(codigoDe(() => validarCambioEstadoLote("APROBADO", "RECHAZADO", "CALIDAD")).codigo).toBe(
      "LOTE_TRANSICION_INVALIDA",
    );
  });

  it.each<Rol>(["ADMIN", "SUPERVISOR", "CALIDAD"])("%s libera y retiene lotes", (rol) => {
    expect(() => validarCambioEstadoLote("CUARENTENA", "APROBADO", rol)).not.toThrow();
    expect(() => validarCambioEstadoLote("CUARENTENA", "RECHAZADO", rol)).not.toThrow();
    expect(() => validarCambioEstadoLote("APROBADO", "CUARENTENA", rol)).not.toThrow();
  });

  it("ALMACEN puede mandar a cuarentena pero no aprobar ni rechazar", () => {
    expect(() => validarCambioEstadoLote("APROBADO", "CUARENTENA", "ALMACEN")).not.toThrow();
    for (const nuevo of ["APROBADO", "RECHAZADO"] as const) {
      const e = codigoDe(() => validarCambioEstadoLote("CUARENTENA", nuevo, "ALMACEN"));
      expect(e.codigo).toBe("LOTE_ROL_NO_AUTORIZADO");
      expect(e.status).toBe(403);
    }
  });

  it.each<Rol>(["OPERARIO", "AUDITOR", "DESARROLLO"])("%s no puede cambiar el estado de un lote", (rol) => {
    for (const [actual, nuevo] of VALIDAS) {
      const e = codigoDe(() => validarCambioEstadoLote(actual, nuevo, rol));
      expect(e.codigo, `${actual} → ${nuevo}`).toBe("LOTE_ROL_NO_AUTORIZADO");
      expect(e.status).toBe(403);
    }
  });

  it("la transición se valida antes que el rol", () => {
    // Un operario que intenta algo imposible ve el error de la máquina de estados.
    expect(codigoDe(() => validarCambioEstadoLote("RECHAZADO", "APROBADO", "OPERARIO")).codigo).toBe(
      "LOTE_TRANSICION_INVALIDA",
    );
  });
});

describe("estadoTrasDescuento", () => {
  it("agota el lote al llegar exactamente a cero", () => {
    expect(estadoTrasDescuento(0)).toBe("AGOTADO");
  });

  it("agota el lote si el restante queda por debajo de media diezmilésima", () => {
    expect(estadoTrasDescuento(0.00004)).toBe("AGOTADO");
  });

  it("mantiene el estado mientras quede al menos una diezmilésima", () => {
    expect(estadoTrasDescuento(0.0001)).toBeNull();
    expect(estadoTrasDescuento(0.00005)).toBeNull();
    expect(estadoTrasDescuento(12.5)).toBeNull();
  });

  it("también agota ante un restante negativo", () => {
    expect(estadoTrasDescuento(-0.5)).toBe("AGOTADO");
  });
});
