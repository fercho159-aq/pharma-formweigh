import { ROLES, type Rol } from "@/lib/dominio/catalogos";

import { describe, expect, it } from "vitest";

import { esRol, MENU, type Permiso, PERMISOS, permisoDeRuta, puedeFirmar, tienePermiso } from "./permisos";

const PERMISOS_TODOS = Object.keys(PERMISOS) as Permiso[];

/** Permisos que modifican datos: ningún rol de solo lectura debe tener alguno. */
const DE_ESCRITURA: readonly Permiso[] = [
  "ordenes.crear",
  "dispensado.registrar",
  "dispensado.solicitarFirma",
  "recetas.crear",
  "inventario.crearMaterial",
  "inventario.recibirLote",
  "inventario.cambiarEstadoLote",
  "usuarios.crear",
];

describe("esRol", () => {
  it.each(ROLES)("reconoce %s", (rol) => {
    expect(esRol(rol)).toBe(true);
  });

  it("falla cerrada ante cualquier valor que no sea un rol", () => {
    for (const valor of [null, undefined, "", "SUPERADMIN", "admin", "Operario", 1, {}, ["ADMIN"], true]) {
      expect(esRol(valor), String(valor)).toBe(false);
    }
  });
});

describe("tienePermiso", () => {
  it("ADMIN tiene todos los permisos de la matriz", () => {
    for (const permiso of PERMISOS_TODOS) {
      expect(tienePermiso("ADMIN", permiso), permiso).toBe(true);
    }
  });

  it("falla cerrada con rol desconocido, nulo o mal tipado", () => {
    for (const rol of [null, undefined, "", "SUPERADMIN", "admin", 0, {}]) {
      for (const permiso of PERMISOS_TODOS) {
        expect(tienePermiso(rol, permiso), `${String(rol)} / ${permiso}`).toBe(false);
      }
    }
  });

  it("todo rol ve el dashboard y el inventario", () => {
    for (const rol of ROLES) {
      expect(tienePermiso(rol, "dashboard.ver"), rol).toBe(true);
      expect(tienePermiso(rol, "inventario.ver"), rol).toBe(true);
    }
  });

  it("solo ADMIN y SUPERVISOR crean órdenes", () => {
    const pueden = ROLES.filter((r) => tienePermiso(r, "ordenes.crear"));
    expect(pueden).toEqual(["ADMIN", "SUPERVISOR"]);
  });

  it("solo ADMIN crea usuarios y solo ADMIN/SUPERVISOR los ven", () => {
    expect(ROLES.filter((r) => tienePermiso(r, "usuarios.crear"))).toEqual(["ADMIN"]);
    expect(ROLES.filter((r) => tienePermiso(r, "usuarios.ver"))).toEqual(["ADMIN", "SUPERVISOR"]);
  });

  it("el pesaje lo registra quien está en la estación, no Calidad ni Almacén", () => {
    const pueden = ROLES.filter((r) => tienePermiso(r, "dispensado.registrar"));
    expect(pueden).toEqual(["ADMIN", "SUPERVISOR", "OPERARIO"]);
  });

  it("los cambios de estado de lote los piden Calidad y Almacén (el detalle lo filtra el dominio)", () => {
    const pueden = ROLES.filter((r) => tienePermiso(r, "inventario.cambiarEstadoLote"));
    expect(pueden).toEqual(["ADMIN", "SUPERVISOR", "CALIDAD", "ALMACEN"]);
  });

  it("el alta de material y la recepción de lotes son de Almacén", () => {
    for (const permiso of ["inventario.crearMaterial", "inventario.recibirLote"] as const) {
      expect(ROLES.filter((r) => tienePermiso(r, permiso))).toEqual(["ADMIN", "SUPERVISOR", "ALMACEN"]);
    }
  });

  it("DESARROLLO mantiene recetas pero no pesa ni toca inventario", () => {
    expect(tienePermiso("DESARROLLO", "recetas.crear")).toBe(true);
    expect(tienePermiso("DESARROLLO", "dispensado.registrar")).toBe(false);
    expect(tienePermiso("DESARROLLO", "inventario.recibirLote")).toBe(false);
    expect(tienePermiso("DESARROLLO", "ordenes.crear")).toBe(false);
  });

  it("AUDITOR es de solo lectura", () => {
    for (const permiso of DE_ESCRITURA) {
      expect(tienePermiso("AUDITOR", permiso), permiso).toBe(false);
    }
    expect(tienePermiso("AUDITOR", "auditoria.ver")).toBe(true);
    expect(tienePermiso("AUDITOR", "ordenes.ver")).toBe(true);
  });

  it("OPERARIO no ve auditoría ni usuarios", () => {
    expect(tienePermiso("OPERARIO", "auditoria.ver")).toBe(false);
    expect(tienePermiso("OPERARIO", "usuarios.ver")).toBe(false);
    expect(tienePermiso("OPERARIO", "dispensado.registrar")).toBe(true);
  });

  it("ALMACEN se queda en inventario y códigos: no entra a producción", () => {
    expect(tienePermiso("ALMACEN", "ordenes.ver")).toBe(false);
    expect(tienePermiso("ALMACEN", "dispensado.ver")).toBe(false);
    expect(tienePermiso("ALMACEN", "recetas.ver")).toBe(false);
    expect(tienePermiso("ALMACEN", "auditoria.ver")).toBe(false);
    expect(tienePermiso("ALMACEN", "codigos.ver")).toBe(true);
  });

  it("ningún permiso queda sin roles ni con roles repetidos o inexistentes", () => {
    for (const permiso of PERMISOS_TODOS) {
      const roles = PERMISOS[permiso] as readonly Rol[];
      expect(roles.length, permiso).toBeGreaterThan(0);
      expect(new Set(roles).size, permiso).toBe(roles.length);
      for (const rol of roles) expect(esRol(rol), `${permiso}: ${rol}`).toBe(true);
    }
  });
});

describe("puedeFirmar", () => {
  it("solo SUPERVISOR, CALIDAD y ADMIN firman fases", () => {
    expect(ROLES.filter((r) => puedeFirmar(r))).toEqual(["ADMIN", "SUPERVISOR", "CALIDAD"]);
  });

  it("el operario que pesa no puede firmar su propia fase", () => {
    expect(puedeFirmar("OPERARIO")).toBe(false);
  });

  it("falla cerrada con rol desconocido", () => {
    for (const valor of [null, undefined, "", "SUPERVISOR ", "supervisor", 7]) {
      expect(puedeFirmar(valor), String(valor)).toBe(false);
    }
  });
});

describe("MENU", () => {
  it("cada entrada exige un permiso existente en la matriz", () => {
    for (const entrada of MENU) {
      expect(PERMISOS_TODOS, entrada.href).toContain(entrada.permiso);
    }
  });

  it("no repite rutas", () => {
    expect(new Set(MENU.map((m) => m.href)).size).toBe(MENU.length);
  });
});

describe("permisoDeRuta", () => {
  it("resuelve la raíz solo de forma exacta", () => {
    expect(permisoDeRuta("/")).toBe("dashboard.ver");
    expect(permisoDeRuta("/otra-cosa")).toBeNull();
  });

  it("resuelve las secciones del menú", () => {
    expect(permisoDeRuta("/ordenes")).toBe("ordenes.ver");
    expect(permisoDeRuta("/inventario")).toBe("inventario.ver");
    expect(permisoDeRuta("/usuarios")).toBe("usuarios.ver");
  });

  it("resuelve las subrutas de una sección", () => {
    expect(permisoDeRuta("/ordenes/ord_123")).toBe("ordenes.ver");
    expect(permisoDeRuta("/dispensado/ord_123/fase_1")).toBe("dispensado.ver");
  });

  it("no confunde una ruta con otra que solo comparte prefijo de texto", () => {
    expect(permisoDeRuta("/ordenes-antiguas")).toBeNull();
    expect(permisoDeRuta("/codigosbarras")).toBeNull();
  });

  it("devuelve null para rutas fuera del menú (el layout decide qué hacer)", () => {
    expect(permisoDeRuta("/login")).toBeNull();
    expect(permisoDeRuta("")).toBeNull();
  });

  it("toda ruta del menú se resuelve a su propio permiso", () => {
    for (const entrada of MENU) {
      expect(permisoDeRuta(entrada.href), entrada.href).toBe(entrada.permiso);
    }
  });
});
