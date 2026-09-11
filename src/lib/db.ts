import Database from "better-sqlite3";
import path from "path";
import { randomBytes, createHash } from "crypto";

const DB_PATH = path.join(process.cwd(), "pharma.db");

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
  }
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

export function registrarAuditoria(
  usuarioId: string,
  accion: string,
  entidad: string,
  entidadId: string,
  detalles: Record<string, unknown> = {}
) {
  const db = getDb();
  const id = generateId();
  db.prepare(
    "INSERT INTO auditoria (id, usuarioId, accion, entidad, entidadId, detalles) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, usuarioId, accion, entidad, entidadId, JSON.stringify(detalles));
}
