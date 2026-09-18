import "server-only";

import { redirect } from "next/navigation";

import { tienePermiso, type Permiso } from "./permisos";
import { getSession, type SessionUser } from "./sesion";

/** Guarda de páginas (Server Components). Sin sesión → /login; sin permiso → dashboard. */
export async function exigirPermisoPagina(permiso: Permiso): Promise<SessionUser> {
  const usuario = await getSession();
  if (!usuario) redirect("/login");
  if (!tienePermiso(usuario.rol, permiso)) redirect("/");
  return usuario;
}
