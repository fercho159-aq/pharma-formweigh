/**
 * Matriz única de permisos (pura, sin BD). La usan las rutas API, el layout y el
 * menú lateral. Falla cerrada: rol desconocido o permiso no listado = sin acceso.
 * Fuente de las reglas: manuales por rol en docs/manual (ver PLAN.md §6.1).
 */
import { ROLES, type Rol } from "@/lib/dominio/catalogos";

const TODOS: readonly Rol[] = ROLES;

export const PERMISOS = {
  "dashboard.ver": TODOS,
  "ordenes.ver": ["ADMIN", "SUPERVISOR", "CALIDAD", "OPERARIO", "AUDITOR", "DESARROLLO"],
  "ordenes.crear": ["ADMIN", "SUPERVISOR"],
  "dispensado.ver": ["ADMIN", "SUPERVISOR", "CALIDAD", "OPERARIO", "AUDITOR", "DESARROLLO"],
  "dispensado.registrar": ["ADMIN", "SUPERVISOR", "OPERARIO"],
  /** Quién puede abrir el diálogo de firma en la estación (el firmante se valida aparte). */
  "dispensado.solicitarFirma": ["ADMIN", "SUPERVISOR", "OPERARIO", "CALIDAD"],
  "recetas.ver": ["ADMIN", "SUPERVISOR", "DESARROLLO", "CALIDAD", "AUDITOR", "OPERARIO"],
  "recetas.crear": ["ADMIN", "SUPERVISOR", "DESARROLLO"],
  "inventario.ver": TODOS,
  "inventario.crearMaterial": ["ADMIN", "SUPERVISOR", "ALMACEN"],
  "inventario.recibirLote": ["ADMIN", "SUPERVISOR", "ALMACEN"],
  /** El detalle (quién aprueba vs. quién retiene) lo decide `validarCambioEstadoLote`. */
  "inventario.cambiarEstadoLote": ["ADMIN", "SUPERVISOR", "CALIDAD", "ALMACEN"],
  "auditoria.ver": ["ADMIN", "SUPERVISOR", "CALIDAD", "AUDITOR", "DESARROLLO"],
  "usuarios.ver": ["ADMIN", "SUPERVISOR"],
  "usuarios.crear": ["ADMIN"],
  "codigos.ver": ["ADMIN", "SUPERVISOR", "ALMACEN", "OPERARIO"],
} as const satisfies Record<string, readonly Rol[]>;

export type Permiso = keyof typeof PERMISOS;

/** Roles cuya contraseña vale como firma electrónica de una fase. */
export const ROLES_FIRMANTES: readonly Rol[] = ["SUPERVISOR", "CALIDAD", "ADMIN"];

export function esRol(valor: unknown): valor is Rol {
  return typeof valor === "string" && (ROLES as readonly string[]).includes(valor);
}

export function tienePermiso(rol: unknown, permiso: Permiso): boolean {
  if (!esRol(rol)) return false;
  // `?? []`: un permiso que no exista en la matriz (cadena dinámica) también falla cerrado.
  return ((PERMISOS[permiso] as readonly Rol[] | undefined) ?? []).includes(rol);
}

export function puedeFirmar(rol: unknown): boolean {
  return esRol(rol) && ROLES_FIRMANTES.includes(rol);
}

/** Entradas del menú lateral: cada una exige un permiso de la matriz. */
export const MENU: ReadonlyArray<{ href: string; label: string; permiso: Permiso }> = [
  { href: "/", label: "Dashboard", permiso: "dashboard.ver" },
  { href: "/ordenes", label: "Órdenes", permiso: "ordenes.ver" },
  { href: "/dispensado", label: "Dispensado", permiso: "dispensado.ver" },
  { href: "/recetas", label: "Recetas", permiso: "recetas.ver" },
  { href: "/inventario", label: "Inventario", permiso: "inventario.ver" },
  { href: "/auditoria", label: "Auditoría", permiso: "auditoria.ver" },
  { href: "/usuarios", label: "Usuarios", permiso: "usuarios.ver" },
  { href: "/codigos", label: "Códigos de Barras", permiso: "codigos.ver" },
];

/** Permiso que exige cada sección de páginas (lo aplica el layout de cada ruta). */
export function permisoDeRuta(pathname: string): Permiso | null {
  const entrada = [...MENU]
    .sort((a, b) => b.href.length - a.href.length)
    .find((m) => (m.href === "/" ? pathname === "/" : pathname === m.href || pathname.startsWith(`${m.href}/`)));
  return entrada?.permiso ?? null;
}
