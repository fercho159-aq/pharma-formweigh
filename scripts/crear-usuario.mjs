/**
 * Alta de usuario desde consola (primer ADMIN de una instalación, o rescate).
 *   dev:  npm run crear-usuario -- correo@dominio "Nombre Completo" ROL
 *   VPS:  docker compose run --rm app node scripts/crear-usuario.mjs correo "Nombre" ROL
 * La contraseña se pide por variable PHARMA_PASSWORD o, si falta, se genera y se imprime UNA vez.
 */
import { randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";
import postgres from "postgres";

const ROLES = ["ADMIN", "SUPERVISOR", "OPERARIO", "DESARROLLO", "CALIDAD", "ALMACEN", "AUDITOR"];
const [email, nombre, rol = "ADMIN", badge] = process.argv.slice(2);
if (!email || !nombre || !ROLES.includes(rol)) {
  console.error(`Uso: crear-usuario <email> "<nombre>" <${ROLES.join("|")}> [badge]`);
  process.exit(2);
}
if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL");
  process.exit(2);
}
const generada = !process.env.PHARMA_PASSWORD;
const password = process.env.PHARMA_PASSWORD ?? randomBytes(12).toString("base64url");
if (password.length < 10) {
  console.error("La contraseña debe tener al menos 10 caracteres.");
  process.exit(2);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  const id = randomBytes(12).toString("hex");
  await sql.begin(async (tx) => {
    await tx`insert into usuarios (id, nombre, email, password_hash, rol, badge)
             values (${id}, ${nombre}, ${email.trim().toLowerCase()}, ${await bcrypt.hash(password, 12)}, ${rol}, ${badge ?? null})`;
    await tx`insert into auditoria (id, usuario_id, accion, entidad, entidad_id, detalles)
             values (${randomBytes(12).toString("hex")}, ${id}, 'CREAR_USUARIO_CONSOLA', 'usuarios', ${id}, ${JSON.stringify({ email, rol })})`;
  });
  console.log(`Usuario creado: ${email} (${rol})`);
  if (generada) console.log(`Contraseña generada (guárdala, no se vuelve a mostrar): ${password}`);
} catch (e) {
  console.error(e?.code === "23505" ? "Ya existe un usuario con ese correo o gafete." : e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
