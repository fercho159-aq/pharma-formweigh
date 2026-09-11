import { cookies } from "next/headers";
import { getDb, verifyPassword } from "./db";

export interface SessionUser {
  id: string;
  nombre: string;
  email: string;
  rol: string;
}

const SESSION_COOKIE = "pharma-session";

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE);
  if (!sessionCookie) return null;

  try {
    const data = JSON.parse(
      Buffer.from(sessionCookie.value, "base64").toString("utf-8")
    );
    // Verify user still exists and is active
    const db = getDb();
    const user = db
      .prepare("SELECT id, nombre, email, rol FROM usuarios WHERE id = ? AND activo = 1")
      .get(data.id) as SessionUser | undefined;
    return user || null;
  } catch {
    return null;
  }
}

export async function createSession(email: string, password: string): Promise<SessionUser | null> {
  const db = getDb();
  const user = db
    .prepare("SELECT * FROM usuarios WHERE email = ? AND activo = 1")
    .get(email) as (SessionUser & { password: string }) | undefined;

  if (!user || !verifyPassword(password, user.password)) {
    return null;
  }

  const sessionData = {
    id: user.id,
    nombre: user.nombre,
    email: user.email,
    rol: user.rol,
  };

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, Buffer.from(JSON.stringify(sessionData)).toString("base64"), {
    httpOnly: true,
    secure: process.env.VERCEL ? true : false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 hours
    path: "/",
  });

  return sessionData;
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export function requireRole(user: SessionUser | null, roles: string[]): boolean {
  if (!user) return false;
  return roles.includes(user.rol);
}
