import { describe, expect, it } from "vitest";

import { ErrorDominio } from "./errores";

describe("ErrorDominio", () => {
  it("es un Error con nombre propio", () => {
    const e = new ErrorDominio("Lote caducado", "LOTE_CADUCADO");
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(ErrorDominio);
    expect(e.name).toBe("ErrorDominio");
    expect(e.message).toBe("Lote caducado");
  });

  it("expone código y status 409 por defecto", () => {
    const e = new ErrorDominio("Conflicto", "X");
    expect(e.codigo).toBe("X");
    expect(e.status).toBe(409);
  });

  it("acepta otros status de la API", () => {
    expect(new ErrorDominio("no existe", "N", 404).status).toBe(404);
    expect(new ErrorDominio("prohibido", "P", 403).status).toBe(403);
    expect(new ErrorDominio("inválido", "I", 400).status).toBe(400);
    expect(new ErrorDominio("demasiadas", "R", 429).status).toBe(429);
  });

  it("se puede distinguir de errores genéricos al capturarlo", () => {
    const capturar = (fn: () => void) => {
      try {
        fn();
        return null;
      } catch (e) {
        return e instanceof ErrorDominio ? e.codigo : "DESCONOCIDO";
      }
    };
    expect(
      capturar(() => {
        throw new ErrorDominio("x", "MI_CODIGO");
      }),
    ).toBe("MI_CODIGO");
    expect(
      capturar(() => {
        throw new TypeError("x");
      }),
    ).toBe("DESCONOCIDO");
  });
});
