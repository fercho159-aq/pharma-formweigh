import bcrypt from "bcryptjs";

/** bcrypt costo 12 (ADR-002). Sustituye al SHA-256 sin sal del prototipo. */
const COSTO = 12;

// Hash señuelo (se calcula una vez): cuando el usuario no existe se compara contra él,
// para que el tiempo de respuesta no revele qué correos están dados de alta.
let senuelo: Promise<string> | undefined;
const hashSenuelo = () => (senuelo ??= bcrypt.hash("usuario-inexistente", COSTO));

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COSTO);
}

export async function verificarPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  const coincide = await bcrypt.compare(password, hash ?? (await hashSenuelo()));
  return Boolean(hash) && coincide;
}
