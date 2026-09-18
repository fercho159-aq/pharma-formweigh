import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * Cliente Drizzle sobre postgres-js. SOLO servidor.
 * Inicialización perezosa: `next build` recolecta módulos sin DATABASE_URL;
 * en runtime falla con mensaje claro si falta. Aquí NO se crean tablas ni se
 * siembran datos: eso es de `npm run db:migrate` y `npm run db:seed`.
 */
declare global {
  // Reutiliza la conexión en dev (HMR) para no agotar el pool.
  var __pharmaDbClient: ReturnType<typeof postgres> | undefined;
}

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

let dbInstancia: DrizzleDb | undefined;

function obtenerDb(): DrizzleDb {
  if (dbInstancia) return dbInstancia;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Falta la variable de entorno DATABASE_URL");
  }
  const client =
    globalThis.__pharmaDbClient ??
    // Un solo contenedor Node con Postgres dedicado (max_connections=30): pool pequeño.
    postgres(connectionString, { max: 5, prepare: true });
  if (process.env.NODE_ENV !== "production") {
    globalThis.__pharmaDbClient = client;
  }
  dbInstancia = drizzle(client, { schema });
  return dbInstancia;
}

export const db: DrizzleDb = new Proxy({} as DrizzleDb, {
  get(_objetivo, propiedad) {
    const real = obtenerDb();
    const valor = Reflect.get(real, propiedad, real);
    return typeof valor === "function" ? valor.bind(real) : valor;
  },
  has(_objetivo, propiedad) {
    return Reflect.has(obtenerDb(), propiedad);
  },
});

export type Db = typeof db;
/** Transacción de Drizzle (para servicios que reciben `tx`). */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export { schema };
