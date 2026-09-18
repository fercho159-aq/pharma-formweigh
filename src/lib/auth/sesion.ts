import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { and, eq, gt, lt } from "drizzle-orm";
import { cookies } from "next/headers";

import { db } from "@/db";
import { sesiones, usuarios } from "@/db/schema";
import type { Rol } from "@/lib/dominio/catalogos";

export interface SessionUser {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
}

export const COOKIE_SESION = "pharma-session";
const DURACION_MS = 24 * 60 * 60 * 1000;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Sesión opaca (ADR-002): la cookie lleva 32 bytes aleatorios; la BD guarda su hash.
 * Rol y `activo` se leen de la BD en CADA petición: desactivar un usuario o cambiarle
 * el rol surte efecto de inmediato y nada de lo que diga la cookie se cree.
 */
export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE_SESION)?.value;
  if (!token || token.length < 32) return null;
  const [fila] = await db
    .select({ id: usuarios.id, nombre: usuarios.nombre, email: usuarios.email, rol: usuarios.rol })
    .from(sesiones)
    .innerJoin(usuarios, eq(sesiones.usuarioId, usuarios.id))
    .where(and(eq(sesiones.tokenHash, hashToken(token)), gt(sesiones.expiraEn, new Date()), eq(usuarios.activo, true)))
    .limit(1);
  return fila ?? null;
}

export async function crearSesion(usuarioId: string, ip: string | null, userAgent: string | null): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiraEn = new Date(Date.now() + DURACION_MS);
  await db.delete(sesiones).where(lt(sesiones.expiraEn, new Date()));
  await db.insert(sesiones).values({ tokenHash: hashToken(token), usuarioId, expiraEn, ip, userAgent: userAgent?.slice(0, 300) });
  (await cookies()).set(COOKIE_SESION, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiraEn,
    path: "/",
  });
}

export async function destruirSesion(): Promise<void> {
  const almacen = await cookies();
  const token = almacen.get(COOKIE_SESION)?.value;
  if (token) await db.delete(sesiones).where(eq(sesiones.tokenHash, hashToken(token)));
  almacen.delete(COOKIE_SESION);
}
