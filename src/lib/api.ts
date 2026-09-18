import "server-only";

import { NextResponse } from "next/server";
import type { z } from "zod";

import { getSession, type SessionUser } from "@/lib/auth/sesion";
import { tienePermiso, type Permiso } from "@/lib/auth/permisos";
import { ErrorDominio } from "@/lib/dominio/errores";

export interface Contexto<D, P> {
  usuario: SessionUser;
  datos: D;
  params: P;
  ip: string | null;
  request: Request;
}

/** IP real: nginx del host la pone en X-Real-IP / X-Forwarded-For. */
export function ipDe(request: Request): string | null {
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  const reenviada = request.headers.get("x-forwarded-for");
  return reenviada ? reenviada.split(",")[0]!.trim() : null;
}

/**
 * Defensa CSRF para mutaciones: el Origin debe ser el del sitio. Se compara contra
 * NEXT_PUBLIC_SITE_URL (nunca contra un Host que el cliente controla) y, en desarrollo,
 * contra el host local.
 */
export function origenValido(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const permitidos = new Set<string>();
  if (process.env.NEXT_PUBLIC_SITE_URL) permitidos.add(new URL(process.env.NEXT_PUBLIC_SITE_URL).origin);
  if (process.env.NODE_ENV !== "production") permitidos.add(new URL(request.url).origin);
  return permitidos.has(origin);
}

function codigoPostgres(e: unknown): string | null {
  for (let actual: unknown = e, i = 0; typeof actual === "object" && actual !== null && i < 4; i++) {
    const codigo = (actual as { code?: unknown }).code;
    if (typeof codigo === "string" && /^[0-9A-Z]{5}$/.test(codigo)) return codigo;
    actual = (actual as { cause?: unknown }).cause;
  }
  return null;
}

export function responderError(e: unknown): NextResponse {
  if (e instanceof ErrorDominio) {
    return NextResponse.json({ ok: false, error: e.message, codigo: e.codigo }, { status: e.status });
  }
  // Violación de unique de Postgres (Drizzle la envuelve en `cause`): mensaje neutro, sin nombres de columnas.
  if (codigoPostgres(e) === "23505") {
    return NextResponse.json({ ok: false, error: "Ya existe un registro con esos datos.", codigo: "DUPLICADO" }, { status: 409 });
  }
  console.error("[api] error no controlado:", e);
  return NextResponse.json({ ok: false, error: "Error interno. Intenta de nuevo.", codigo: "INTERNO" }, { status: 500 });
}

interface Opciones<S extends z.ZodType | undefined> {
  permiso: Permiso;
  /** Esquema Zod del cuerpo JSON (mutaciones). El servidor SIEMPRE re-valida. */
  esquema?: S;
}

type Manejador<P> = (request: Request, segmento: { params: Promise<P> }) => Promise<NextResponse>;

/**
 * Envoltura de toda ruta API protegida. Falla cerrada, en este orden:
 * sesión (401) → permiso del rol leído de BD (403) → Origin en mutaciones (403) → Zod (400).
 */
export function ruta<S extends z.ZodType | undefined = undefined, P = Record<string, never>>(
  opciones: Opciones<S>,
  manejar: (ctx: Contexto<S extends z.ZodType ? z.infer<S> : undefined, P>) => Promise<NextResponse>,
): Manejador<P> {
  return async (request, segmento) => {
    try {
      const usuario = await getSession();
      if (!usuario) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
      if (!tienePermiso(usuario.rol, opciones.permiso)) {
        return NextResponse.json({ ok: false, error: "Tu rol no tiene permiso para esta acción." }, { status: 403 });
      }
      if (request.method !== "GET" && request.method !== "HEAD" && !origenValido(request)) {
        return NextResponse.json({ ok: false, error: "Origen no permitido." }, { status: 403 });
      }
      let datos: unknown = undefined;
      if (opciones.esquema) {
        const cuerpo: unknown = await request.json().catch(() => null);
        const resultado = opciones.esquema.safeParse(cuerpo);
        if (!resultado.success) {
          const detalle = resultado.error.issues.map((i) => `${i.path.join(".") || "cuerpo"}: ${i.message}`).join("; ");
          return NextResponse.json({ ok: false, error: `Datos inválidos — ${detalle}`, codigo: "VALIDACION" }, { status: 400 });
        }
        datos = resultado.data;
      }
      const params = (await segmento.params) as P;
      return await manejar({
        usuario,
        datos: datos as S extends z.ZodType ? z.infer<S> : undefined,
        params,
        ip: ipDe(request),
        request,
      });
    } catch (e) {
      return responderError(e);
    }
  };
}
