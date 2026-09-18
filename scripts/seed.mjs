/**
 * Datos de DEMOSTRACIÓN (no son datos del cliente): 7 usuarios (uno por rol), 8 materiales,
 * 9 lotes aprobados, 2 recetas por fases y 3 órdenes. Sustituye a los endpoints /api/seed*
 * del prototipo, que cualquiera podía invocar sin sesión.
 *   dev:  npm run db:seed
 *   VPS:  docker compose run --rm app node scripts/seed.mjs
 * Se niega a correr si ya hay materiales. Las contraseñas se generan al azar y se imprimen
 * UNA sola vez (o se toma PHARMA_DEMO_PASSWORD para todas). Nunca hay contraseñas en el código.
 */
import { randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL");
  process.exit(2);
}
const id = () => randomBytes(12).toString("hex");
const sql = postgres(process.env.DATABASE_URL, { max: 1 });

const USUARIOS = [
  ["Administrador", "admin@pharma.com", "ADMIN", "BADGE-ADMIN-001"],
  ["Supervisor García", "supervisor@pharma.com", "SUPERVISOR", "BADGE-SUP-001"],
  ["Operario López", "operario@pharma.com", "OPERARIO", "BADGE-OP-001"],
  ["Ing. Ramírez Desarrollo", "desarrollo@pharma.com", "DESARROLLO", "BADGE-DES-001"],
  ["QA Martínez Calidad", "calidad@pharma.com", "CALIDAD", "BADGE-CAL-001"],
  ["Almacenista Torres", "almacen@pharma.com", "ALMACEN", "BADGE-ALM-001"],
  ["Auditor Hernández", "auditor@pharma.com", "AUDITOR", "BADGE-AUD-001"],
];
const MATERIALES = [
  ["MAT-PAR-001", "Paracetamol (Acetaminofén)", "Principio activo analgésico y antipirético", "kg", 5],
  ["MAT-CEL-002", "Celulosa Microcristalina", "Excipiente diluyente y aglutinante", "kg", 10],
  ["MAT-EST-003", "Estearato de Magnesio", "Lubricante para compresión", "kg", 2],
  ["MAT-ALM-004", "Almidón de Maíz", "Desintegrante y diluyente", "kg", 8],
  ["MAT-SIO-005", "Dióxido de Silicio Coloidal", "Deslizante y adsorbente", "kg", 1],
  ["MAT-IBU-006", "Ibuprofeno", "Principio activo antiinflamatorio", "kg", 3],
  ["MAT-LAC-007", "Lactosa Monohidrato", "Excipiente diluyente", "kg", 15],
  ["MAT-PVP-008", "Povidona (PVP K30)", "Aglutinante húmedo", "kg", 3],
];
// [numero, índice de material, cantidad, proveedor]
const LOTES = [
  ["LOT-PAR-2024-001", 0, 25, "Farmaquímicos SA"],
  ["LOT-PAR-2024-002", 0, 10, "Química Global"],
  ["LOT-CEL-2024-001", 1, 50, "ExcipPharma"],
  ["LOT-EST-2024-001", 2, 5, "Lubrichem MX"],
  ["LOT-ALM-2024-001", 3, 30, "Almidones del Centro"],
  ["LOT-SIO-2024-001", 4, 3, "SilicaPharma"],
  ["LOT-IBU-2024-001", 5, 15, "ApiPharma Internacional"],
  ["LOT-LAC-2024-001", 6, 40, "Lactosa MX"],
  ["LOT-PVP-2024-001", 7, 8, "PolymerPharma"],
];
// fases: [nombre, [[índice material, cantidad, tolMin, tolMax, instrucciones, peligroso], …]]
const RECETAS = [
  {
    codigo: "REC-PCT-500", nombre: "Tableta Paracetamol 500mg", descripcion: "Formulación estándar de tabletas de paracetamol 500mg", rendimiento: 10000,
    fases: [
      ["Dispensado de activos", [[0, 5.0, -1, 1, "Pesar con precisión. Verificar identidad visual.", false], [1, 3.5, -2, 2, "Tamizar antes de pesar (malla 40).", false]]],
      ["Mezclado y lubricación", [[3, 1.0, -3, 3, null, false], [4, 0.1, -5, 5, "Usar mascarilla. Polvo muy fino.", true], [2, 0.05, -5, 5, "Agregar al final.", false]]],
    ],
  },
  {
    codigo: "REC-IBU-400", nombre: "Tableta Ibuprofeno 400mg", descripcion: "Formulación de tabletas recubiertas de ibuprofeno 400mg", rendimiento: 5000,
    fases: [
      ["Dispensado principal", [[5, 2.0, -1, 1, "Verificar certificado de análisis.", false], [6, 1.5, -2, 2, null, false]]],
      ["Granulación", [[7, 0.3, -3, 3, "Disolver en agua purificada.", false], [2, 0.04, -5, 5, "Lubricante - agregar al final.", false]]],
    ],
  },
];
// [índice de receta, lote de producto, multiplicador, prioridad]
const ORDENES = [[0, "PROD-PCT-2024-001", 1, 1], [0, "PROD-PCT-2024-002", 2, 0], [1, "PROD-IBU-2024-001", 1, 1]];

try {
  const [{ n }] = await sql`select count(*)::int n from materiales`;
  if (n > 0) {
    console.log("Ya hay materiales: seed omitido (no se toca una base con datos).");
    process.exit(0);
  }
  const credenciales = [];
  await sql.begin(async (tx) => {
    for (const [nombre, email, rol, badge] of USUARIOS) {
      const [existe] = await tx`select 1 from usuarios where email = ${email}`;
      if (existe) continue;
      const password = process.env.PHARMA_DEMO_PASSWORD ?? randomBytes(9).toString("base64url");
      await tx`insert into usuarios (id, nombre, email, password_hash, rol, badge)
               values (${id()}, ${nombre}, ${email}, ${await bcrypt.hash(password, 12)}, ${rol}, ${badge})`;
      credenciales.push([rol, email, password]);
    }
    const matIds = [];
    for (const [codigo, nombre, descripcion, unidad, stockMinimo] of MATERIALES) {
      const mid = id();
      matIds.push(mid);
      await tx`insert into materiales (id, codigo, nombre, descripcion, unidad, stock_minimo)
               values (${mid}, ${codigo}, ${nombre}, ${descripcion}, ${unidad}, ${stockMinimo})`;
    }
    const caducidad = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    for (const [numero, mi, cantidad, proveedor] of LOTES) {
      await tx`insert into lotes (id, numero, material_id, cantidad, cantidad_inicial, fecha_caducidad, proveedor, estado)
               values (${id()}, ${numero}, ${matIds[mi]}, ${cantidad}, ${cantidad}, ${caducidad}, ${proveedor}, 'APROBADO')`;
    }
    const recetaIds = [];
    for (const r of RECETAS) {
      const rid = id();
      recetaIds.push(rid);
      await tx`insert into recetas (id, codigo, nombre, descripcion, rendimiento, unidad_rendimiento)
               values (${rid}, ${r.codigo}, ${r.nombre}, ${r.descripcion}, ${r.rendimiento}, 'tabletas')`;
      let orden = 0;
      for (const [fi, [nombreFase, ings]] of r.fases.entries()) {
        const fid = id();
        await tx`insert into fases (id, receta_id, nombre, orden) values (${fid}, ${rid}, ${nombreFase}, ${fi + 1})`;
        for (const [mi, cant, tMin, tMax, inst, peligroso] of ings) {
          orden++;
          await tx`insert into ingredientes (id, receta_id, fase_id, material_id, orden, cantidad_target, tolerancia_min, tolerancia_max, instrucciones, peligroso)
                   values (${id()}, ${rid}, ${fid}, ${matIds[mi]}, ${orden}, ${cant}, ${tMin}, ${tMax}, ${inst}, ${peligroso})`;
        }
      }
    }
    for (const [ri, loteProducto, cantidad, prioridad] of ORDENES) {
      const [{ n: consecutivo }] = await tx`select nextval('orden_numero_seq') as n`;
      const numero = `ORD-${String(consecutivo).padStart(5, "0")}`;
      await tx`insert into ordenes_produccion (id, numero, receta_id, lote_producto, cantidad, prioridad)
               values (${id()}, ${numero}, ${recetaIds[ri]}, ${loteProducto}, ${cantidad}, ${prioridad})`;
    }
  });
  console.log("Datos de demostración cargados.");
  if (credenciales.length > 0) {
    console.log("\nCredenciales DEMO (se muestran una sola vez; guárdalas fuera del repo):");
    for (const [rol, email, password] of credenciales) console.log(`  ${rol.padEnd(11)} ${email.padEnd(24)} ${password}`);
  }
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
