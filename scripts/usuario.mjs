/**
 * Gestión de cuentas desde consola (no hay pantalla para esto; ver Manual del Admin §4).
 *   restablecer <email>   nueva contraseña (PHARMA_PASSWORD o aleatoria impresa UNA vez), cierra sus sesiones y limpia bloqueos
 *   desactivar  <email>   activo=false y cierra sus sesiones (el historial y la bitácora se conservan)
 *   activar     <email>
 *   desbloquear <email>   borra los intentos fallidos de login y firma de ese correo
 * dev:  npm run usuario -- restablecer correo@dominio
 * VPS:  docker compose -f docker-compose.yml --env-file .env -p pharmaweigh run --rm --no-deps app node scripts/usuario.mjs restablecer correo@dominio
 * Cada operación deja asiento en la bitácora (accion *_CONSOLA).
 */
import { randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";
import postgres from "postgres";

const ACCIONES = ["restablecer", "desactivar", "activar", "desbloquear"];
const [accion, emailCrudo] = process.argv.slice(2);
const email = emailCrudo?.trim().toLowerCase();
if (!ACCIONES.includes(accion) || !email) {
  console.error(`Uso: usuario <${ACCIONES.join("|")}> <email>`);
  process.exit(2);
}
if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL");
  process.exit(2);
}
const id = () => randomBytes(12).toString("hex");
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  const [usuario] = await sql`select id, rol, activo from usuarios where email = ${email}`;
  if (!usuario) {
    console.error(`No existe un usuario con el correo ${email}`);
    process.exit(1);
  }
  let generada = null;
  await sql.begin(async (tx) => {
    if (accion === "restablecer") {
      const password = process.env.PHARMA_PASSWORD ?? (generada = randomBytes(9).toString("base64url"));
      if (password.length < 10) throw new Error("La contraseña debe tener al menos 10 caracteres.");
      await tx`update usuarios set password_hash = ${await bcrypt.hash(password, 12)} where id = ${usuario.id}`;
    }
    if (accion === "desactivar" || accion === "activar") {
      await tx`update usuarios set activo = ${accion === "activar"} where id = ${usuario.id}`;
    }
    if (accion === "restablecer" || accion === "desactivar") {
      await tx`delete from sesiones where usuario_id = ${usuario.id}`;
    }
    if (accion === "restablecer" || accion === "desbloquear") {
      await tx`delete from intentos_acceso where clave = ${"email:" + email}`;
    }
    await tx`insert into auditoria (id, usuario_id, accion, entidad, entidad_id, detalles)
             values (${id()}, ${usuario.id}, ${accion.toUpperCase() + "_USUARIO_CONSOLA"}, 'usuarios', ${usuario.id}, ${JSON.stringify({ email, rol: usuario.rol })})`;
  });
  console.log(`${accion}: ${email} (${usuario.rol}) — hecho`);
  if (generada) console.log(`Contraseña generada (guárdala, no se vuelve a mostrar): ${generada}`);
} catch (e) {
  console.error(e?.message ?? e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
