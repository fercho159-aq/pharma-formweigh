import { Pool } from "pg";
import { randomBytes, createHash } from "crypto";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

let _initialized = false;

export async function query(text: string, params?: unknown[]) {
  if (!_initialized) {
    await initTables();
    _initialized = true;
  }
  const res = await pool.query(text, params);
  return res.rows;
}

export async function queryOne(text: string, params?: unknown[]) {
  const rows = await query(text, params);
  return rows[0] || null;
}

async function initTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'OPERARIO',
      badge TEXT UNIQUE,
      activo BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS materiales (
      id TEXT PRIMARY KEY,
      codigo TEXT UNIQUE NOT NULL,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      unidad TEXT NOT NULL,
      "stockMinimo" REAL NOT NULL DEFAULT 0,
      activo BOOLEAN NOT NULL DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS lotes (
      id TEXT PRIMARY KEY,
      numero TEXT UNIQUE NOT NULL,
      "materialId" TEXT NOT NULL REFERENCES materiales(id),
      cantidad REAL NOT NULL,
      "cantidadInicial" REAL NOT NULL,
      "fechaRecepcion" TIMESTAMPTZ NOT NULL,
      "fechaCaducidad" TIMESTAMPTZ NOT NULL,
      proveedor TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'CUARENTENA',
      certificado TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS recetas (
      id TEXT PRIMARY KEY,
      codigo TEXT UNIQUE NOT NULL,
      nombre TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      descripcion TEXT,
      rendimiento REAL NOT NULL,
      "unidadRendimiento" TEXT NOT NULL,
      activa BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS fases (
      id TEXT PRIMARY KEY,
      "recetaId" TEXT NOT NULL REFERENCES recetas(id) ON DELETE CASCADE,
      nombre TEXT NOT NULL,
      orden INTEGER NOT NULL,
      instrucciones TEXT
    );

    CREATE TABLE IF NOT EXISTS ingredientes (
      id TEXT PRIMARY KEY,
      "recetaId" TEXT NOT NULL REFERENCES recetas(id) ON DELETE CASCADE,
      "faseId" TEXT REFERENCES fases(id) ON DELETE CASCADE,
      "materialId" TEXT NOT NULL REFERENCES materiales(id),
      orden INTEGER NOT NULL,
      "cantidadTarget" REAL NOT NULL,
      "toleranciaMin" REAL NOT NULL DEFAULT -2,
      "toleranciaMax" REAL NOT NULL DEFAULT 2,
      instrucciones TEXT,
      peligroso BOOLEAN NOT NULL DEFAULT false
    );

    CREATE TABLE IF NOT EXISTS ordenes_produccion (
      id TEXT PRIMARY KEY,
      numero TEXT UNIQUE NOT NULL,
      "recetaId" TEXT NOT NULL REFERENCES recetas(id),
      "loteProducto" TEXT NOT NULL,
      cantidad REAL NOT NULL DEFAULT 1,
      estado TEXT NOT NULL DEFAULT 'PENDIENTE',
      prioridad INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS dispensados (
      id TEXT PRIMARY KEY,
      "ordenId" TEXT NOT NULL REFERENCES ordenes_produccion(id),
      "faseId" TEXT,
      "loteId" TEXT NOT NULL REFERENCES lotes(id),
      "operarioId" TEXT NOT NULL REFERENCES usuarios(id),
      "materialNombre" TEXT NOT NULL,
      "cantidadTarget" REAL NOT NULL,
      "cantidadReal" REAL NOT NULL,
      "toleranciaOk" BOOLEAN NOT NULL,
      paso INTEGER NOT NULL,
      "firmaElectronica" TEXT,
      "supervisorId" TEXT,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS firmas_fase (
      id TEXT PRIMARY KEY,
      "ordenId" TEXT NOT NULL REFERENCES ordenes_produccion(id),
      "faseId" TEXT NOT NULL REFERENCES fases(id),
      "supervisorId" TEXT NOT NULL REFERENCES usuarios(id),
      "firmaElectronica" TEXT NOT NULL,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS auditoria (
      id TEXT PRIMARY KEY,
      "usuarioId" TEXT NOT NULL REFERENCES usuarios(id),
      accion TEXT NOT NULL,
      entidad TEXT NOT NULL,
      "entidadId" TEXT NOT NULL,
      detalles TEXT NOT NULL DEFAULT '{}',
      ip TEXT,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Seed admin user if no users exist
  const res = await pool.query("SELECT COUNT(*) as c FROM usuarios");
  if (parseInt(res.rows[0].c) === 0) {
    const adminId = generateId();
    const hashedPassword = hashPassword("admin123");
    await pool.query(
      `INSERT INTO usuarios (id, nombre, email, password, rol, badge) VALUES ($1, $2, $3, $4, $5, $6)`,
      [adminId, "Administrador", "admin@pharma.com", hashedPassword, "ADMIN", "BADGE-ADMIN-001"]
    );

    const supId = generateId();
    const supPassword = hashPassword("super123");
    await pool.query(
      `INSERT INTO usuarios (id, nombre, email, password, rol, badge) VALUES ($1, $2, $3, $4, $5, $6)`,
      [supId, "Supervisor García", "supervisor@pharma.com", supPassword, "SUPERVISOR", "BADGE-SUP-001"]
    );

    const opId = generateId();
    const opPassword = hashPassword("oper123");
    await pool.query(
      `INSERT INTO usuarios (id, nombre, email, password, rol, badge) VALUES ($1, $2, $3, $4, $5, $6)`,
      [opId, "Operario López", "operario@pharma.com", opPassword, "OPERARIO", "BADGE-OP-001"]
    );

    await seedDemoData();
  }

  // Migrate existing recipes: create default phase for recipes without phases
  const existingRecipes = await pool.query("SELECT id, nombre FROM recetas WHERE id NOT IN (SELECT DISTINCT \"recetaId\" FROM fases)");
  for (const recipe of existingRecipes.rows) {
    const faseId = generateId();
    await pool.query('INSERT INTO fases (id, "recetaId", nombre, orden) VALUES ($1, $2, $3, $4)', [faseId, recipe.id, 'Dispensado', 1]);
    await pool.query('UPDATE ingredientes SET "faseId" = $1 WHERE "recetaId" = $2', [faseId, recipe.id]);
  }
}

async function seedDemoData() {
  const materiales = [
    { id: generateId(), codigo: "MAT-PAR-001", nombre: "Paracetamol (Acetaminofén)", descripcion: "Principio activo analgésico y antipirético", unidad: "kg", stockMinimo: 5 },
    { id: generateId(), codigo: "MAT-CEL-002", nombre: "Celulosa Microcristalina", descripcion: "Excipiente diluyente y aglutinante", unidad: "kg", stockMinimo: 10 },
    { id: generateId(), codigo: "MAT-EST-003", nombre: "Estearato de Magnesio", descripcion: "Lubricante para compresión", unidad: "kg", stockMinimo: 2 },
    { id: generateId(), codigo: "MAT-ALM-004", nombre: "Almidón de Maíz", descripcion: "Desintegrante y diluyente", unidad: "kg", stockMinimo: 8 },
    { id: generateId(), codigo: "MAT-SIO-005", nombre: "Dióxido de Silicio Coloidal", descripcion: "Deslizante y adsorbente", unidad: "kg", stockMinimo: 1 },
    { id: generateId(), codigo: "MAT-IBU-006", nombre: "Ibuprofeno", descripcion: "Principio activo antiinflamatorio", unidad: "kg", stockMinimo: 3 },
    { id: generateId(), codigo: "MAT-LAC-007", nombre: "Lactosa Monohidrato", descripcion: "Excipiente diluyente", unidad: "kg", stockMinimo: 15 },
    { id: generateId(), codigo: "MAT-PVP-008", nombre: "Povidona (PVP K30)", descripcion: "Aglutinante húmedo", unidad: "kg", stockMinimo: 3 },
  ];
  for (const m of materiales) {
    await pool.query(
      `INSERT INTO materiales (id, codigo, nombre, descripcion, unidad, "stockMinimo") VALUES ($1, $2, $3, $4, $5, $6)`,
      [m.id, m.codigo, m.nombre, m.descripcion, m.unidad, m.stockMinimo]
    );
  }

  const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const lotes = [
    { id: generateId(), numero: "LOT-PAR-2024-001", materialId: materiales[0].id, cantidad: 25, proveedor: "Farmaquímicos SA", fechaCaducidad: futureDate, estado: "APROBADO" },
    { id: generateId(), numero: "LOT-PAR-2024-002", materialId: materiales[0].id, cantidad: 10, proveedor: "Química Global", fechaCaducidad: futureDate, estado: "APROBADO" },
    { id: generateId(), numero: "LOT-CEL-2024-001", materialId: materiales[1].id, cantidad: 50, proveedor: "ExcipPharma", fechaCaducidad: futureDate, estado: "APROBADO" },
    { id: generateId(), numero: "LOT-EST-2024-001", materialId: materiales[2].id, cantidad: 5, proveedor: "Lubrichem MX", fechaCaducidad: futureDate, estado: "APROBADO" },
    { id: generateId(), numero: "LOT-ALM-2024-001", materialId: materiales[3].id, cantidad: 30, proveedor: "Almidones del Centro", fechaCaducidad: futureDate, estado: "APROBADO" },
    { id: generateId(), numero: "LOT-SIO-2024-001", materialId: materiales[4].id, cantidad: 3, proveedor: "SilicaPharma", fechaCaducidad: futureDate, estado: "APROBADO" },
    { id: generateId(), numero: "LOT-IBU-2024-001", materialId: materiales[5].id, cantidad: 15, proveedor: "ApiPharma Internacional", fechaCaducidad: futureDate, estado: "APROBADO" },
    { id: generateId(), numero: "LOT-LAC-2024-001", materialId: materiales[6].id, cantidad: 40, proveedor: "Lactosa MX", fechaCaducidad: futureDate, estado: "APROBADO" },
    { id: generateId(), numero: "LOT-PVP-2024-001", materialId: materiales[7].id, cantidad: 8, proveedor: "PolymerPharma", fechaCaducidad: futureDate, estado: "APROBADO" },
  ];
  for (const l of lotes) {
    await pool.query(
      `INSERT INTO lotes (id, numero, "materialId", cantidad, "cantidadInicial", "fechaRecepcion", "fechaCaducidad", proveedor, estado) VALUES ($1, $2, $3, $4, $5, now(), $6, $7, $8)`,
      [l.id, l.numero, l.materialId, l.cantidad, l.cantidad, l.fechaCaducidad, l.proveedor, l.estado]
    );
  }

  const r1 = generateId();
  await pool.query(
    `INSERT INTO recetas (id, codigo, nombre, descripcion, rendimiento, "unidadRendimiento") VALUES ($1, $2, $3, $4, $5, $6)`,
    [r1, "REC-PCT-500", "Tableta Paracetamol 500mg", "Formulación estándar de tabletas de paracetamol 500mg", 10000, "tabletas"]
  );

  // Recipe 1 phases
  const r1f1 = generateId();
  await pool.query(
    'INSERT INTO fases (id, "recetaId", nombre, orden) VALUES ($1, $2, $3, $4)',
    [r1f1, r1, "Dispensado de activos", 1]
  );
  const r1f2 = generateId();
  await pool.query(
    'INSERT INTO fases (id, "recetaId", nombre, orden) VALUES ($1, $2, $3, $4)',
    [r1f2, r1, "Mezclado y lubricación", 2]
  );

  const ingR1 = [
    { faseId: r1f1, mat: materiales[0].id, orden: 1, cant: 5.0, tMin: -1, tMax: 1, inst: "Pesar con precisión. Verificar identidad visual.", peligroso: false },
    { faseId: r1f1, mat: materiales[1].id, orden: 2, cant: 3.5, tMin: -2, tMax: 2, inst: "Tamizar antes de pesar (malla 40).", peligroso: false },
    { faseId: r1f2, mat: materiales[3].id, orden: 3, cant: 1.0, tMin: -3, tMax: 3, inst: null, peligroso: false },
    { faseId: r1f2, mat: materiales[4].id, orden: 4, cant: 0.1, tMin: -5, tMax: 5, inst: "Usar mascarilla. Polvo muy fino.", peligroso: true },
    { faseId: r1f2, mat: materiales[2].id, orden: 5, cant: 0.05, tMin: -5, tMax: 5, inst: "Agregar al final.", peligroso: false },
  ];
  for (const i of ingR1) {
    await pool.query(
      `INSERT INTO ingredientes (id, "recetaId", "faseId", "materialId", orden, "cantidadTarget", "toleranciaMin", "toleranciaMax", instrucciones, peligroso) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [generateId(), r1, i.faseId, i.mat, i.orden, i.cant, i.tMin, i.tMax, i.inst, i.peligroso]
    );
  }

  const r2 = generateId();
  await pool.query(
    `INSERT INTO recetas (id, codigo, nombre, descripcion, rendimiento, "unidadRendimiento") VALUES ($1, $2, $3, $4, $5, $6)`,
    [r2, "REC-IBU-400", "Tableta Ibuprofeno 400mg", "Formulación de tabletas recubiertas de ibuprofeno 400mg", 5000, "tabletas"]
  );

  // Recipe 2 phases
  const r2f1 = generateId();
  await pool.query(
    'INSERT INTO fases (id, "recetaId", nombre, orden) VALUES ($1, $2, $3, $4)',
    [r2f1, r2, "Dispensado principal", 1]
  );
  const r2f2 = generateId();
  await pool.query(
    'INSERT INTO fases (id, "recetaId", nombre, orden) VALUES ($1, $2, $3, $4)',
    [r2f2, r2, "Granulación", 2]
  );

  const ingR2 = [
    { faseId: r2f1, mat: materiales[5].id, orden: 1, cant: 2.0, tMin: -1, tMax: 1, inst: "Verificar certificado de análisis.", peligroso: false },
    { faseId: r2f1, mat: materiales[6].id, orden: 2, cant: 1.5, tMin: -2, tMax: 2, inst: null, peligroso: false },
    { faseId: r2f2, mat: materiales[7].id, orden: 3, cant: 0.3, tMin: -3, tMax: 3, inst: "Disolver en agua purificada.", peligroso: false },
    { faseId: r2f2, mat: materiales[2].id, orden: 4, cant: 0.04, tMin: -5, tMax: 5, inst: "Lubricante - agregar al final.", peligroso: false },
  ];
  for (const i of ingR2) {
    await pool.query(
      `INSERT INTO ingredientes (id, "recetaId", "faseId", "materialId", orden, "cantidadTarget", "toleranciaMin", "toleranciaMax", instrucciones, peligroso) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [generateId(), r2, i.faseId, i.mat, i.orden, i.cant, i.tMin, i.tMax, i.inst, i.peligroso]
    );
  }

  await pool.query(
    `INSERT INTO ordenes_produccion (id, numero, "recetaId", "loteProducto", cantidad, estado, prioridad) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [generateId(), "ORD-00001", r1, "PROD-PCT-2024-001", 1, "PENDIENTE", 1]
  );
  await pool.query(
    `INSERT INTO ordenes_produccion (id, numero, "recetaId", "loteProducto", cantidad, estado, prioridad) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [generateId(), "ORD-00002", r1, "PROD-PCT-2024-002", 2, "PENDIENTE", 0]
  );
  await pool.query(
    `INSERT INTO ordenes_produccion (id, numero, "recetaId", "loteProducto", cantidad, estado, prioridad) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [generateId(), "ORD-00003", r2, "PROD-IBU-2024-001", 1, "PENDIENTE", 1]
  );
}

export function generateId(): string {
  return randomBytes(12).toString("hex");
}

export function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

export async function resolveUserId(sessionUserId: string, email?: string): Promise<string> {
  const byId = await queryOne("SELECT id FROM usuarios WHERE id = $1", [sessionUserId]);
  if (byId) return byId.id;
  if (email) {
    const byEmail = await queryOne("SELECT id FROM usuarios WHERE email = $1", [email]);
    if (byEmail) return byEmail.id;
  }
  const admin = await queryOne("SELECT id FROM usuarios WHERE rol = 'ADMIN' LIMIT 1");
  return admin?.id || sessionUserId;
}

export async function registrarAuditoria(
  usuarioId: string,
  accion: string,
  entidad: string,
  entidadId: string,
  detalles: Record<string, unknown> = {}
) {
  const id = generateId();
  const resolvedId = await resolveUserId(usuarioId);
  await query(
    `INSERT INTO auditoria (id, "usuarioId", accion, entidad, "entidadId", detalles) VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, resolvedId, accion, entidad, entidadId, JSON.stringify(detalles)]
  );
}
