/**
 * Proxy de Next 16 (sucesor de middleware.ts). Primera barrera, barata y sin BD:
 * sin cookie de sesión no se llega ni a páginas ni a la API. La validación REAL
 * (token contra BD, usuario activo, permiso del rol) vive en `ruta()` y en los
 * layouts (`exigirPermisoPagina`): una cookie inventada pasa este filtro y muere ahí.
 */
import { NextResponse, type NextRequest } from "next/server";

const COOKIE_SESION = "pharma-session";
const PUBLICAS = ["/login", "/api/auth/login", "/api/salud"];

export default function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  if (PUBLICAS.includes(pathname)) return NextResponse.next();
  if (request.cookies.get(COOKIE_SESION)?.value) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Todo excepto estáticos de Next y archivos de /public.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
