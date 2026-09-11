import Database from "better-sqlite3";
import path from "path";
import { randomBytes, createHash } from "crypto";

const DB_PATH = process.env.VERCEL
  ? path.join("/tmp", "pharma.db")
  : path.join(process.cwd(), "pharma.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initTables(_db);
  }
  return _db;
}

function initTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'OPERARIO',
      badge TEXT UNIQUE,
      activo INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS materiales (
      id TEXT PRIMARY KEY,
      codigo TEXT UNIQUE NOT NULL,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      unidad TEXT NOT NULL,
      stockMinimo REAL NOT NULL DEFAULT 0,
      activo INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS lotes (
      id TEXT PRIMARY KEY,
      numero TEXT UNIQUE NOT NULL,
      materialId TEXT NOT NULL,
      cantidad REAL NOT NULL,
      cantidadInicial REAL NOT NULL,
      fechaRecepcion TEXT NOT NULL,
      fechaCaducidad TEXT NOT NULL,
      proveedor TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'CUARENTENA',
      certificado TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (materialId) REFERENCES materiales(id)
    );

    CREATE TABLE IF NOT EXISTS recetas (
      id TEXT PRIMARY KEY,
      codigo TEXT UNIQUE NOT NULL,
      nombre TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      descripcion TEXT,
      rendimiento REAL NOT NULL,
      unidadRendimiento TEXT NOT NULL,
      activa INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ingredientes (
      id TEXT PRIMARY KEY,
      recetaId TEXT NOT NULL,
      materialId TEXT NOT NULL,
      orden INTEGER NOT NULL,
      cantidadTarget REAL NOT NULL,
      toleranciaMin REAL NOT NULL DEFAULT -2,
      toleranciaMax REAL NOT NULL DEFAULT 2,
      instrucciones TEXT,
      peligroso INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (recetaId) REFERENCES recetas(id) ON DELETE CASCADE,
      FOREIGN KEY (materialId) REFERENCES materiales(id)
    );

    CREATE TABLE IF NOT EXISTS ordenes_produccion (
      id TEXT PRIMARY KEY,
      numero TEXT UNIQUE NOT NULL,
      recetaId TEXT NOT NULL,
      loteProducto TEXT NOT NULL,
      cantidad REAL NOT NULL DEFAULT 1,
      estado TEXT NOT NULL DEFAULT 'PENDIENTE',
      prioridad INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (recetaId) REFERENCES recetas(id)
    );

    CREATE TABLE IF NOT EXISTS dispensados (
      id TEXT PRIMARY KEY,
      ordenId TEXT NOT NULL,
      loteId TEXT NOT NULL,
      operarioId TEXT NOT NULL,
      materialNombre TEXT NOT NULL,
      cantidadTarget REAL NOT NULL,
      cantidadReal REAL NOT NULL,
      toleranciaOk INTEGER NOT NULL,
      paso INTEGER NOT NULL,
      firmaElectronica TEXT,
      supervisorId TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (ordenId) REFERENCES ordenes_produccion(id),
      FOREIGN KEY (loteId) REFERENCES lotes(id),
      FOREIGN KEY (operarioId) REFERENCES usuarios(id)
    );

    CREATE TABLE IF NOT EXISTS auditoria (
      id TEXT PRIMARY KEY,
      usuarioId TEXT NOT NULL,
      accion TEXT NOT NULL,
      entidad TEXT NOT NULL,
      entidadId TEXT NOT NULL,
      detalles TEXT NOT NULL DEFAULT '{}',
      ip TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (usuarioId) REFERENCES usuarios(id)
    );
  `);

  // Seed admin user if no users exist
  const count = db.prepare("SELECT COUNT(*) as c FROM usuarios").get() as { c: number };
  if (count.c === 0) {
    const adminId = generateId();
    const hashedPassword = hashPassword("admin123");
    db.prepare(
      "INSERT INTO usuarios (id, nombre, email, password, rol, badge) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(adminId, "Administrador", "admin@pharma.com", hashedPassword, "ADMIN", "BADGE-ADMIN-001");

    const supId = generateId();
    const supPassword = hashPassword("super123");
    db.prepare(
      "INSERT INTO usuarios (id, nombre, email, password, rol, badge) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(supId, "Supervisor García", "supervisor@pharma.com", supPassword, "SUPERVISOR", "BADGE-SUP-001");

    const opId = generateId();
    const opPassword = hashPassword("oper123");
    db.prepare(
      "INSERT INTO usuarios (id, nombre, email, password, rol, badge) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(opId, "Operario López", "operario@pharma.com", opPassword, "OPERARIO", "BADGE-OP-001");

    // Auto-seed demo data
    seedDemoData(db);
  }
}

function seedDemoData(db: Database.Database) {
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
    db.prepare("INSERT INTO materiales (id, codigo, nombre, descripcion, unidad, stockMinimo) VALUES (?, ?, ?, ?, ?, ?)").run(m.id, m.codigo, m.nombre, m.descripcion, m.unidad, m.stockMinimo);
  }

  const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
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
    db.prepare("INSERT INTO lotes (id, numero, materialId, cantidad, cantidadInicial, fechaRecepcion, fechaCaducidad, proveedor, estado) VALUES (?, ?, ?, ?, ?, datetime('now'), ?, ?, ?)").run(l.id, l.numero, l.materialId, l.cantidad, l.cantidad, l.fechaCaducidad, l.proveedor, l.estado);
  }

  // Receta 1: Paracetamol 500mg
  const r1 = generateId();
  db.prepare("INSERT INTO recetas (id, codigo, nombre, descripcion, rendimiento, unidadRendimiento) VALUES (?, ?, ?, ?, ?, ?)").run(r1, "REC-PCT-500", "Tableta Paracetamol 500mg", "Formulación estándar de tabletas de paracetamol 500mg", 10000, "tabletas");
  const ingR1 = [
    { mat: materiales[0].id, orden: 1, cant: 5.0, tMin: -1, tMax: 1, inst: "Pesar con precisión. Verificar identidad visual.", peligroso: 0 },
    { mat: materiales[1].id, orden: 2, cant: 3.5, tMin: -2, tMax: 2, inst: "Tamizar antes de pesar (malla 40).", peligroso: 0 },
    { mat: materiales[3].id, orden: 3, cant: 1.0, tMin: -3, tMax: 3, inst: null, peligroso: 0 },
    { mat: materiales[4].id, orden: 4, cant: 0.1, tMin: -5, tMax: 5, inst: "Usar mascarilla. Polvo muy fino.", peligroso: 1 },
    { mat: materiales[2].id, orden: 5, cant: 0.05, tMin: -5, tMax: 5, inst: "Agregar al final.", peligroso: 0 },
  ];
  for (const i of ingR1) {
    db.prepare("INSERT INTO ingredientes (id, recetaId, materialId, orden, cantidadTarget, toleranciaMin, toleranciaMax, instrucciones, peligroso) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(generateId(), r1, i.mat, i.orden, i.cant, i.tMin, i.tMax, i.inst, i.peligroso);
  }

  // Receta 2: Ibuprofeno 400mg
  const r2 = generateId();
  db.prepare("INSERT INTO recetas (id, codigo, nombre, descripcion, rendimiento, unidadRendimiento) VALUES (?, ?, ?, ?, ?, ?)").run(r2, "REC-IBU-400", "Tableta Ibuprofeno 400mg", "Formulación de tabletas recubiertas de ibuprofeno 400mg", 5000, "tabletas");
  const ingR2 = [
    { mat: materiales[5].id, orden: 1, cant: 2.0, tMin: -1, tMax: 1, inst: "Verificar certificado de análisis.", peligroso: 0 },
    { mat: materiales[6].id, orden: 2, cant: 1.5, tMin: -2, tMax: 2, inst: null, peligroso: 0 },
    { mat: materiales[7].id, orden: 3, cant: 0.3, tMin: -3, tMax: 3, inst: "Disolver en agua purificada.", peligroso: 0 },
    { mat: materiales[2].id, orden: 4, cant: 0.04, tMin: -5, tMax: 5, inst: "Lubricante - agregar al final.", peligroso: 0 },
  ];
  for (const i of ingR2) {
    db.prepare("INSERT INTO ingredientes (id, recetaId, materialId, orden, cantidadTarget, toleranciaMin, toleranciaMax, instrucciones, peligroso) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(generateId(), r2, i.mat, i.orden, i.cant, i.tMin, i.tMax, i.inst, i.peligroso);
  }

  // Órdenes
  db.prepare("INSERT INTO ordenes_produccion (id, numero, recetaId, loteProducto, cantidad, estado, prioridad) VALUES (?, ?, ?, ?, ?, ?, ?)").run(generateId(), "ORD-00001", r1, "PROD-PCT-2024-001", 1, "PENDIENTE", 1);
  db.prepare("INSERT INTO ordenes_produccion (id, numero, recetaId, loteProducto, cantidad, estado, prioridad) VALUES (?, ?, ?, ?, ?, ?, ?)").run(generateId(), "ORD-00002", r1, "PROD-PCT-2024-002", 2, "PENDIENTE", 0);
  db.prepare("INSERT INTO ordenes_produccion (id, numero, recetaId, loteProducto, cantidad, estado, prioridad) VALUES (?, ?, ?, ?, ?, ?, ?)").run(generateId(), "ORD-00003", r2, "PROD-IBU-2024-001", 1, "PENDIENTE", 1);
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

export function resolveUserId(sessionUserId: string, email?: string): string {
  const db = getDb();
  // Try by ID first
  const byId = db.prepare("SELECT id FROM usuarios WHERE id = ?").get(sessionUserId) as { id: string } | undefined;
  if (byId) return byId.id;
  // If ID doesn't exist (Vercel cold start), find by email
  if (email) {
    const byEmail = db.prepare("SELECT id FROM usuarios WHERE email = ?").get(email) as { id: string } | undefined;
    if (byEmail) return byEmail.id;
  }
  // Fallback: return first admin
  const admin = db.prepare("SELECT id FROM usuarios WHERE rol = 'ADMIN' LIMIT 1").get() as { id: string } | undefined;
  return admin?.id || sessionUserId;
}

export function registrarAuditoria(
  usuarioId: string,
  accion: string,
  entidad: string,
  entidadId: string,
  detalles: Record<string, unknown> = {}
) {
  const db = getDb();
  const id = generateId();
  const resolvedId = resolveUserId(usuarioId);
  db.prepare(
    "INSERT INTO auditoria (id, usuarioId, accion, entidad, entidadId, detalles) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, resolvedId, accion, entidad, entidadId, JSON.stringify(detalles));
}
