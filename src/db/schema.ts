/**
 * Esquema único de PharmaWeigh. Las migraciones salen SOLO de aquí con
 * `npm run db:generate` (ver CLAUDE.md §3). Cantidades en `numeric(14,4)`
 * (nunca float): el dominio compara en diezmilésimas enteras (`@/lib/dominio/cantidades`).
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgEnum,
  pgSequence,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { ESTADOS_LOTE, ESTADOS_ORDEN, ROLES } from "../lib/dominio/catalogos";
import { generarId } from "../lib/ids";

export { ESTADOS_LOTE, ESTADOS_ORDEN, ROLES };
export type { EstadoLote, EstadoOrden, Rol } from "../lib/dominio/catalogos";

export const rolEnum = pgEnum("rol", ROLES);
export const estadoLoteEnum = pgEnum("estado_lote", ESTADOS_LOTE);
export const estadoOrdenEnum = pgEnum("estado_orden", ESTADOS_ORDEN);

/** Folio de órdenes (ORD-00001). Secuencia: sin carreras, a diferencia de COUNT(*)+1. */
export const ordenNumeroSeq = pgSequence("orden_numero_seq", { startWith: 1, increment: 1 });

const id = () => text("id").primaryKey().$defaultFn(generarId);
const cantidad = (nombre: string) => numeric(nombre, { precision: 14, scale: 4, mode: "number" });
const porcentaje = (nombre: string) => numeric(nombre, { precision: 5, scale: 2, mode: "number" });
const fecha = (nombre: string) => timestamp(nombre, { withTimezone: true, mode: "date" });

export const usuarios = pgTable("usuarios", {
  id: id(),
  nombre: text("nombre").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  rol: rolEnum("rol").notNull().default("OPERARIO"),
  badge: text("badge").unique(),
  activo: boolean("activo").notNull().default(true),
  createdAt: fecha("created_at").notNull().defaultNow(),
});

/** Sesión opaca: en la cookie viaja el token; aquí solo su SHA-256 (ADR-002). */
export const sesiones = pgTable(
  "sesiones",
  {
    id: id(),
    tokenHash: text("token_hash").notNull().unique(),
    usuarioId: text("usuario_id").notNull().references(() => usuarios.id, { onDelete: "cascade" }),
    expiraEn: fecha("expira_en").notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: fecha("created_at").notNull().defaultNow(),
  },
  (t) => [index("sesiones_usuario_idx").on(t.usuarioId)],
);

/** Intentos de login y de firma, para el límite de intentos (ADR-003). */
export const intentosAcceso = pgTable(
  "intentos_acceso",
  {
    id: id(),
    tipo: text("tipo").notNull(),
    clave: text("clave").notNull(),
    exito: boolean("exito").notNull(),
    timestamp: fecha("timestamp").notNull().defaultNow(),
  },
  (t) => [index("intentos_clave_idx").on(t.tipo, t.clave, t.timestamp)],
);

export const materiales = pgTable("materiales", {
  id: id(),
  codigo: text("codigo").notNull().unique(),
  nombre: text("nombre").notNull(),
  descripcion: text("descripcion"),
  unidad: text("unidad").notNull(),
  stockMinimo: cantidad("stock_minimo").notNull().default(0),
  activo: boolean("activo").notNull().default(true),
});

export const lotes = pgTable(
  "lotes",
  {
    id: id(),
    numero: text("numero").notNull().unique(),
    materialId: text("material_id").notNull().references(() => materiales.id),
    cantidad: cantidad("cantidad").notNull(),
    cantidadInicial: cantidad("cantidad_inicial").notNull(),
    fechaRecepcion: fecha("fecha_recepcion").notNull().defaultNow(),
    fechaCaducidad: fecha("fecha_caducidad").notNull(),
    proveedor: text("proveedor").notNull(),
    estado: estadoLoteEnum("estado").notNull().default("CUARENTENA"),
    certificado: text("certificado"),
    createdAt: fecha("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("lotes_material_idx").on(t.materialId),
    check("lotes_cantidad_no_negativa", sql`${t.cantidad} >= 0`),
    check("lotes_inicial_positiva", sql`${t.cantidadInicial} > 0`),
  ],
);

export const recetas = pgTable("recetas", {
  id: id(),
  codigo: text("codigo").notNull().unique(),
  nombre: text("nombre").notNull(),
  version: integer("version").notNull().default(1),
  descripcion: text("descripcion"),
  rendimiento: cantidad("rendimiento").notNull(),
  unidadRendimiento: text("unidad_rendimiento").notNull(),
  activa: boolean("activa").notNull().default(true),
  createdAt: fecha("created_at").notNull().defaultNow(),
  updatedAt: fecha("updated_at").notNull().defaultNow(),
});

export const fases = pgTable(
  "fases",
  {
    id: id(),
    recetaId: text("receta_id").notNull().references(() => recetas.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    orden: integer("orden").notNull(),
    instrucciones: text("instrucciones"),
  },
  (t) => [uniqueIndex("fases_receta_orden_uq").on(t.recetaId, t.orden)],
);

export const ingredientes = pgTable(
  "ingredientes",
  {
    id: id(),
    recetaId: text("receta_id").notNull().references(() => recetas.id, { onDelete: "cascade" }),
    faseId: text("fase_id").notNull().references(() => fases.id, { onDelete: "cascade" }),
    materialId: text("material_id").notNull().references(() => materiales.id),
    orden: integer("orden").notNull(),
    cantidadTarget: cantidad("cantidad_target").notNull(),
    toleranciaMin: porcentaje("tolerancia_min").notNull().default(-2),
    toleranciaMax: porcentaje("tolerancia_max").notNull().default(2),
    instrucciones: text("instrucciones"),
    peligroso: boolean("peligroso").notNull().default(false),
  },
  (t) => [
    uniqueIndex("ingredientes_receta_orden_uq").on(t.recetaId, t.orden),
    check("ingredientes_target_positivo", sql`${t.cantidadTarget} > 0`),
    check("ingredientes_tolerancia_valida", sql`${t.toleranciaMin} <= 0 AND ${t.toleranciaMax} >= 0`),
  ],
);

export const ordenesProduccion = pgTable(
  "ordenes_produccion",
  {
    id: id(),
    numero: text("numero").notNull().unique(),
    recetaId: text("receta_id").notNull().references(() => recetas.id),
    loteProducto: text("lote_producto").notNull(),
    /** Multiplicador de la receta (1 = un lote estándar). */
    cantidad: cantidad("cantidad").notNull().default(1),
    estado: estadoOrdenEnum("estado").notNull().default("PENDIENTE"),
    prioridad: integer("prioridad").notNull().default(0),
    createdAt: fecha("created_at").notNull().defaultNow(),
    updatedAt: fecha("updated_at").notNull().defaultNow(),
  },
  (t) => [check("ordenes_cantidad_positiva", sql`${t.cantidad} > 0`)],
);

export const dispensados = pgTable(
  "dispensados",
  {
    id: id(),
    ordenId: text("orden_id").notNull().references(() => ordenesProduccion.id),
    faseId: text("fase_id").notNull().references(() => fases.id),
    ingredienteId: text("ingrediente_id").notNull().references(() => ingredientes.id),
    loteId: text("lote_id").notNull().references(() => lotes.id),
    operarioId: text("operario_id").notNull().references(() => usuarios.id),
    materialNombre: text("material_nombre").notNull(),
    cantidadTarget: cantidad("cantidad_target").notNull(),
    cantidadReal: cantidad("cantidad_real").notNull(),
    toleranciaOk: boolean("tolerancia_ok").notNull(),
    paso: integer("paso").notNull(),
    firmaElectronica: text("firma_electronica"),
    supervisorId: text("supervisor_id").references(() => usuarios.id),
    timestamp: fecha("timestamp").notNull().defaultNow(),
  },
  (t) => [
    // Idempotencia: un ingrediente se dispensa una sola vez por orden (doble clic incluido).
    uniqueIndex("dispensados_orden_ingrediente_uq").on(t.ordenId, t.ingredienteId),
    check("dispensados_real_positiva", sql`${t.cantidadReal} > 0`),
  ],
);

export const firmasFase = pgTable(
  "firmas_fase",
  {
    id: id(),
    ordenId: text("orden_id").notNull().references(() => ordenesProduccion.id),
    faseId: text("fase_id").notNull().references(() => fases.id),
    supervisorId: text("supervisor_id").notNull().references(() => usuarios.id),
    firmaElectronica: text("firma_electronica").notNull(),
    timestamp: fecha("timestamp").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("firmas_orden_fase_uq").on(t.ordenId, t.faseId)],
);

/** Bitácora inmutable: un trigger bloquea UPDATE/DELETE (migración custom, ADR-004). */
export const auditoria = pgTable(
  "auditoria",
  {
    id: id(),
    /** Nulo solo en eventos sin usuario identificado (login fallido). */
    usuarioId: text("usuario_id").references(() => usuarios.id),
    accion: text("accion").notNull(),
    entidad: text("entidad").notNull(),
    entidadId: text("entidad_id").notNull(),
    detalles: text("detalles").notNull().default("{}"),
    ip: text("ip"),
    timestamp: fecha("timestamp").notNull().defaultNow(),
  },
  (t) => [index("auditoria_timestamp_idx").on(t.timestamp), index("auditoria_usuario_idx").on(t.usuarioId)],
);
