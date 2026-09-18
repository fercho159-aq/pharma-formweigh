import "server-only";

import { asc, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { auditoria, fases, firmasFase, ordenesProduccion, recetas, usuarios } from "@/db/schema";

interface FaseResumen {
  id: string;
  nombre: string;
  orden: number;
}

/** Fases por receta y firmas por orden, en dos consultas para todo el listado. */
async function avanceDe(ordenes: ReadonlyArray<{ id: string; recetaId: string }>) {
  const fasesPorReceta = new Map<string, FaseResumen[]>();
  const firmadas = new Set<string>();
  if (ordenes.length === 0) return { fasesPorReceta, firmadas };

  const recetaIds = [...new Set(ordenes.map((o) => o.recetaId))];
  const listaFases = await db
    .select({ id: fases.id, recetaId: fases.recetaId, nombre: fases.nombre, orden: fases.orden })
    .from(fases)
    .where(inArray(fases.recetaId, recetaIds))
    .orderBy(asc(fases.orden));
  for (const f of listaFases) {
    const lista = fasesPorReceta.get(f.recetaId) ?? [];
    lista.push({ id: f.id, nombre: f.nombre, orden: f.orden });
    fasesPorReceta.set(f.recetaId, lista);
  }
  const firmas = await db
    .select({ ordenId: firmasFase.ordenId, faseId: firmasFase.faseId })
    .from(firmasFase)
    .where(inArray(firmasFase.ordenId, ordenes.map((o) => o.id)));
  for (const f of firmas) firmadas.add(`${f.ordenId}:${f.faseId}`);
  return { fasesPorReceta, firmadas };
}

const columnasOrden = {
  id: ordenesProduccion.id,
  numero: ordenesProduccion.numero,
  recetaId: ordenesProduccion.recetaId,
  loteProducto: ordenesProduccion.loteProducto,
  cantidad: ordenesProduccion.cantidad,
  estado: ordenesProduccion.estado,
  prioridad: ordenesProduccion.prioridad,
  createdAt: ordenesProduccion.createdAt,
  updatedAt: ordenesProduccion.updatedAt,
  recetaNombre: recetas.nombre,
  recetaCodigo: recetas.codigo,
};

const ordenPorEstado = sql`case ${ordenesProduccion.estado}
  when 'EN_PROCESO' then 0 when 'PENDIENTE' then 1 when 'DISPENSADO' then 2 when 'COMPLETADA' then 3 else 4 end`;

/** Listado de la pantalla de Dispensado: cada orden con sus fases y cuáles están firmadas. */
export async function ordenesConAvance() {
  const ordenes = await db
    .select({
      ...columnasOrden,
      numIngredientes: sql<number>`(select count(*)::int from ingredientes i where i.receta_id = ${ordenesProduccion.recetaId})`,
      numDispensados: sql<number>`(select count(*)::int from dispensados d where d.orden_id = ${ordenesProduccion.id})`,
    })
    .from(ordenesProduccion)
    .innerJoin(recetas, eq(ordenesProduccion.recetaId, recetas.id))
    .orderBy(ordenPorEstado, desc(ordenesProduccion.prioridad), asc(ordenesProduccion.createdAt));
  const { fasesPorReceta, firmadas } = await avanceDe(ordenes);
  return ordenes.map((o) => {
    const lista = (fasesPorReceta.get(o.recetaId) ?? []).map((f) => ({ ...f, firmada: firmadas.has(`${o.id}:${f.id}`) }));
    return { ...o, fases: lista, numFases: lista.length, numFasesFirmadas: lista.filter((f) => f.firmada).length };
  });
}

const contar = async (consulta: ReturnType<typeof sql>) => {
  const filas = await db.execute<{ c: number }>(consulta);
  return { c: Number(filas[0]?.c ?? 0) };
};

export async function datosDashboard() {
  const [ordenesPendientes, ordenesEnProceso, ordenesCompletadas, totalMateriales, lotesCuarentena, lotesPorCaducar, recetasActivas, dispensadosHoy] =
    await Promise.all([
      contar(sql`select count(*)::int c from ordenes_produccion where estado = 'PENDIENTE'`),
      contar(sql`select count(*)::int c from ordenes_produccion where estado = 'EN_PROCESO'`),
      contar(sql`select count(*)::int c from ordenes_produccion where estado in ('DISPENSADO','COMPLETADA')`),
      contar(sql`select count(*)::int c from materiales where activo`),
      contar(sql`select count(*)::int c from lotes where estado = 'CUARENTENA'`),
      contar(sql`select count(*)::int c from lotes where estado = 'APROBADO' and fecha_caducidad <= now() + interval '30 days'`),
      contar(sql`select count(*)::int c from recetas where activa`),
      contar(sql`select count(*)::int c from dispensados where (timestamp at time zone 'America/Mexico_City')::date = (now() at time zone 'America/Mexico_City')::date`),
    ]);

  const activos = await db
    .select(columnasOrden)
    .from(ordenesProduccion)
    .innerJoin(recetas, eq(ordenesProduccion.recetaId, recetas.id))
    .where(inArray(ordenesProduccion.estado, ["EN_PROCESO", "PENDIENTE"]))
    .orderBy(ordenPorEstado, desc(ordenesProduccion.prioridad), asc(ordenesProduccion.createdAt))
    .limit(6);
  const recientes = await db
    .select(columnasOrden)
    .from(ordenesProduccion)
    .innerJoin(recetas, eq(ordenesProduccion.recetaId, recetas.id))
    .orderBy(desc(ordenesProduccion.createdAt))
    .limit(5);
  const { fasesPorReceta, firmadas } = await avanceDe([...activos, ...recientes]);

  const enriquecer = <T extends { id: string; recetaId: string }>(o: T, etiquetaFin: string) => {
    const lista = fasesPorReceta.get(o.recetaId) ?? [];
    const numFases = lista.length;
    const numFirmadas = lista.filter((f) => firmadas.has(`${o.id}:${f.id}`)).length;
    const actual = lista.find((f) => !firmadas.has(`${o.id}:${f.id}`));
    const currentFaseLabel = actual ? `Fase ${actual.orden}/${numFases}: ${actual.nombre}` : numFases > 0 ? etiquetaFin : "";
    const progressPercent = numFases > 0 ? Math.round((numFirmadas / numFases) * 100) : 0;
    return { ...o, numFases, numFirmadas, currentFaseLabel, progressPercent };
  };

  return {
    ordenesPendientes,
    ordenesEnProceso,
    ordenesCompletadas,
    totalMateriales,
    lotesCuarentena,
    lotesPorCaducar,
    recetasActivas,
    dispensadosHoy,
    procesosEnriquecidos: activos.map((o) => enriquecer(o, "Todas las fases firmadas")),
    ultimasOrdenesEnriquecidas: recientes.map((o) => enriquecer(o, "Completado")),
  };
}

export async function ultimaAuditoria(limite = 8) {
  return db
    .select({ id: auditoria.id, accion: auditoria.accion, entidad: auditoria.entidad, timestamp: auditoria.timestamp, usuarioNombre: usuarios.nombre })
    .from(auditoria)
    .leftJoin(usuarios, eq(auditoria.usuarioId, usuarios.id))
    .orderBy(desc(auditoria.timestamp))
    .limit(limite);
}
