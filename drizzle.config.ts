import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit corre fuera de Next: cargamos .env.local a mano.
config({ path: ".env.local", quiet: true });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // `generate` no se conecta; la URL solo la usan `push`/`studio` (no se usan en este proyecto).
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://build:build@127.0.0.1:5432/build" },
  strict: true,
  verbose: true,
});
