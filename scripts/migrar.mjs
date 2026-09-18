/**
 * Aplica /drizzle a DATABASE_URL. Corre igual en dev
 * (`node --env-file=.env.local scripts/migrar.mjs`) y en el contenedor
 * (`node scripts/migrar.mjs`, env del compose).
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL");
  process.exit(2);
}
const cliente = postgres(url, { max: 1 });
try {
  await migrate(drizzle(cliente), { migrationsFolder: "./drizzle" });
  console.log("Migraciones aplicadas.");
} finally {
  await cliente.end();
}
