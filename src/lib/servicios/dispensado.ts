import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";

import { db, type Tx } from "@/db";
import {
  dispensados,
  fases,
  firmasFase,
  ingredientes,
  lotes,
  materiales,
  ordenesProduccion,
  recetas,
  usuarios,
} from "@/db/schema";
import { registrarAuditoria } from "@/lib/auditoria";
import { exigirSinBloqueo, registrarIntento } from "@/lib/auth/limite";
import { verificarPassword } from "@/lib/auth/password";
import { puedeFirmar } from "@/lib/auth/permisos";
import { restar } from "@/lib/dominio/cantidades";
import { ErrorDominio } from "@/lib/dominio/errores";
import { todasFirmadas, validarFaseFirmable, validarPasoEnOrden, type FaseEstado } from "@/lib/dominio/fases";
import { estadoTrasDescuento, validarLoteParaDispensar } from "@/lib/dominio/lotes";
import { puedeTransicionarOrden, validarOrdenAdmiteDispensado } from "@/lib/dominio/ordenes";
import { calcularRango, dentroDeTolerancia } from "@/lib/dominio/tolerancia";

type Ejecutor = Tx | typeof db;

/** Estado completo de una orden: receta, fases, ingredientes, pesajes y firmas. */
export async function cargarOrden(ex: Ejecutor, ordenId: string, bloquear = false) {
  const consulta = ex
    .select({
      id: ordenesProduccion.id,
      numero: ordenesProduccion.numero,
      recetaId: ordenesProduccion.recetaId,
      loteProducto: ordenesProduccion.loteProducto,
      cantidad: ordenesProduccion.cantidad,
      estado: ordenesProduccion.estado,
      prioridad: ordenesProduccion.prioridad,
      createdAt: ordenesProduccion.createdAt,
      updatedAt: ordenesProduccion.updatedAt,
    })
    .from(ordenesProduccion)
    .where(eq(ordenesProduccion.id, ordenId));
  // FOR UPDATE serializa los pesajes y firmas concurrentes de una misma orden.
  const [orden] = bloquear ? await consulta.for("update") : await consulta;
  if (!orden) throw new ErrorDominio("Orden no encontrada", "ORDEN_NO_ENCONTRADA", 404);

  const [receta] = await ex
    .select({ nombre: recetas.nombre, codigo: recetas.codigo })
    .from(recetas)
    .where(eq(recetas.id, orden.recetaId));
  const listaFases = await ex.select().from(fases).where(eq(fases.recetaId, orden.recetaId)).orderBy(asc(fases.orden));
  const listaIngredientes = await ex
    .select({
      id: ingredientes.id,
      faseId: ingredientes.faseId,
      materialId: ingredientes.materialId,
      orden: ingredientes.orden,
      cantidadTarget: ingredientes.cantidadTarget,
      toleranciaMin: ingredientes.toleranciaMin,
      toleranciaMax: ingredientes.toleranciaMax,
      instrucciones: ingredientes.instrucciones,
      peligroso: ingredientes.peligroso,
      materialNombre: materiales.nombre,
      materialCodigo: materiales.codigo,
      materialUnidad: materiales.unidad,
    })
    .from(ingredientes)
    .innerJoin(materiales, eq(ingredientes.materialId, materiales.id))
    .where(eq(ingredientes.recetaId, orden.recetaId))
    .orderBy(asc(ingredientes.orden));
  const pesajes = await ex
    .select({ ingredienteId: dispensados.ingredienteId, cantidadReal: dispensados.cantidadReal })
    .from(dispensados)
    .where(eq(dispensados.ordenId, ordenId));
  const firmas = await ex
    .select({ faseId: firmasFase.faseId, timestamp: firmasFase.timestamp, supervisorNombre: usuarios.nombre })
    .from(firmasFase)
    .innerJoin(usuarios, eq(firmasFase.supervisorId, usuarios.id))
    .where(eq(firmasFase.ordenId, ordenId));

  const pesado = new Map(pesajes.map((p) => [p.ingredienteId, p.cantidadReal]));
  const firmado = new Map(firmas.map((f) => [f.faseId, f]));
  const estadoFases: FaseEstado[] = listaFases.map((f) => ({
    id: f.id,
    orden: f.orden,
    firmada: firmado.has(f.id),
    ingredientes: listaIngredientes.filter((i) => i.faseId === f.id).map((i) => ({ id: i.id, orden: i.orden })),
  }));

  return { orden, receta, listaFases, listaIngredientes, pesado, firmado, estadoFases, dispensadosSet: new Set(pesado.keys()) };
}

/** Vista para la pantalla de dispensado; el rango de pesaje lo calcula el servidor. */
export async function detalleOrden(ordenId: string) {
  const e = await cargarOrden(db, ordenId);
  return {
    ...e.orden,
    recetaNombre: e.receta?.nombre ?? "",
    recetaCodigo: e.receta?.codigo ?? "",
    fases: e.listaFases.map((f) => {
      const firma = e.firmado.get(f.id);
      return {
        id: f.id,
        nombre: f.nombre,
        orden: f.orden,
        instrucciones: f.instrucciones,
        firma: firma ? { supervisorNombre: firma.supervisorNombre, timestamp: firma.timestamp } : null,
        ingredientes: e.listaIngredientes
          .filter((i) => i.faseId === f.id)
          .map((i) => ({
            ...i,
            rango: calcularRango(i, e.orden.cantidad),
            dispensado: e.pesado.has(i.id),
            dispensadoReal: e.pesado.get(i.id),
          })),
      };
    }),
  };
}

async function cargarLote(ex: Ejecutor, filtro: { id: string } | { numero: string }, bloquear = false) {
  const consulta = ex
    .select({
      id: lotes.id,
      numero: lotes.numero,
      materialId: lotes.materialId,
      materialNombre: materiales.nombre,
      cantidad: lotes.cantidad,
      estado: lotes.estado,
      fechaCaducidad: lotes.fechaCaducidad,
    })
    .from(lotes)
    .innerJoin(materiales, eq(lotes.materialId, materiales.id))
    .where("id" in filtro ? eq(lotes.id, filtro.id) : eq(lotes.numero, filtro.numero));
  const [lote] = bloquear ? await consulta.for("update", { of: lotes }) : await consulta;
  return lote ?? null;
}

/** Escaneo del lote: mismas reglas que aplicará `registrarDispensado`, sin escribir nada. */
export async function validarLote(datos: { codigoLote: string; ordenId: string; ingredienteId: string }) {
  const e = await cargarOrden(db, datos.ordenId);
  validarOrdenAdmiteDispensado(e.orden.estado);
  validarPasoEnOrden(e.estadoFases, e.dispensadosSet, datos.ingredienteId);
  const ing = e.listaIngredientes.find((i) => i.id === datos.ingredienteId)!;
  const rango = calcularRango(ing, e.orden.cantidad);
  const lote = await cargarLote(db, { numero: datos.codigoLote });
  validarLoteParaDispensar(lote, ing.materialId, rango.target, new Date());
  return { ok: true as const, loteId: lote!.id, materialNombre: lote!.materialNombre, cantidad: lote!.cantidad };
}

/**
 * Pesaje. Todo en UNA transacción: alta del dispensado, descuento del lote, estado de
 * la orden y asiento de auditoría. El cliente solo aporta orden, ingrediente, lote y
 * peso; target, tolerancia, fase y paso salen de la BD.
 */
export async function registrarDispensado(
  datos: { ordenId: string; ingredienteId: string; loteId: string; cantidadReal: number },
  operarioId: string,
  ip: string | null,
) {
  return db.transaction(async (tx) => {
    const e = await cargarOrden(tx, datos.ordenId, true);
    validarOrdenAdmiteDispensado(e.orden.estado);
    const ing = e.listaIngredientes.find((i) => i.id === datos.ingredienteId);
    if (!ing) throw new ErrorDominio("El ingrediente no pertenece a la receta de esta orden.", "INGREDIENTE_AJENO", 404);
    validarPasoEnOrden(e.estadoFases, e.dispensadosSet, ing.id);

    const rango = calcularRango(ing, e.orden.cantidad);
    if (!dentroDeTolerancia(datos.cantidadReal, rango)) {
      throw new ErrorDominio(
        `Peso fuera de tolerancia (${rango.min}–${rango.max} ${ing.materialUnidad}). Ajusta el peso.`,
        "FUERA_DE_TOLERANCIA",
      );
    }

    const lote = await cargarLote(tx, { id: datos.loteId }, true);
    validarLoteParaDispensar(lote, ing.materialId, datos.cantidadReal, new Date());
    const restante = restar(lote!.cantidad, datos.cantidadReal);

    const [alta] = await tx
      .insert(dispensados)
      .values({
        ordenId: e.orden.id,
        faseId: ing.faseId,
        ingredienteId: ing.id,
        loteId: lote!.id,
        operarioId,
        materialNombre: ing.materialNombre,
        cantidadTarget: rango.target,
        cantidadReal: datos.cantidadReal,
        toleranciaOk: true,
        paso: ing.orden,
      })
      .returning({ id: dispensados.id });

    await tx
      .update(lotes)
      .set({ cantidad: restante, ...(estadoTrasDescuento(restante) ? { estado: "AGOTADO" as const } : {}) })
      .where(eq(lotes.id, lote!.id));

    if (e.orden.estado === "PENDIENTE" && puedeTransicionarOrden("PENDIENTE", "EN_PROCESO")) {
      await tx
        .update(ordenesProduccion)
        .set({ estado: "EN_PROCESO", updatedAt: new Date() })
        .where(eq(ordenesProduccion.id, e.orden.id));
    }

    await registrarAuditoria(
      {
        usuarioId: operarioId,
        accion: "DISPENSAR",
        entidad: "dispensados",
        entidadId: alta!.id,
        ip,
        detalles: {
          ordenId: e.orden.id,
          ordenNumero: e.orden.numero,
          faseId: ing.faseId,
          paso: ing.orden,
          material: ing.materialNombre,
          lote: lote!.numero,
          cantidadTarget: rango.target,
          cantidadReal: datos.cantidadReal,
          rangoMin: rango.min,
          rangoMax: rango.max,
          loteRestante: restante,
        },
      },
      tx,
    );
    return { ok: true as const, id: alta!.id };
  });
}

/**
 * Firma electrónica de fase: re-autenticación de un SUPERVISOR / CALIDAD / ADMIN.
 * Mensaje de error único para no revelar si el correo existe; límite de intentos por
 * correo y por IP; los rechazos también quedan en bitácora.
 */
export async function firmarFase(
  datos: { ordenId: string; faseId: string; email: string; password: string },
  solicitanteId: string,
  ip: string | null,
) {
  const claves = [`email:${datos.email}`, ...(ip ? [`ip:${ip}`] : [])];
  await exigirSinBloqueo("firma", claves);

  const [firmante] = await db
    .select({ id: usuarios.id, nombre: usuarios.nombre, passwordHash: usuarios.passwordHash, rol: usuarios.rol })
    .from(usuarios)
    .where(and(eq(usuarios.email, datos.email), eq(usuarios.activo, true)));
  const passwordOk = await verificarPassword(datos.password, firmante?.passwordHash);
  if (!firmante || !passwordOk || !puedeFirmar(firmante.rol)) {
    await registrarIntento("firma", claves, false);
    await registrarAuditoria({
      usuarioId: solicitanteId,
      accion: "FIRMA_RECHAZADA",
      entidad: "ordenes_produccion",
      entidadId: datos.ordenId,
      ip,
      detalles: { faseId: datos.faseId, emailFirmante: datos.email },
    });
    throw new ErrorDominio(
      "Firma rechazada: credenciales inválidas o el usuario no es Supervisor, Calidad ni Admin.",
      "FIRMA_RECHAZADA",
      403,
    );
  }
  await registrarIntento("firma", claves, true);

  return db.transaction(async (tx) => {
    const e = await cargarOrden(tx, datos.ordenId, true);
    validarOrdenAdmiteDispensado(e.orden.estado);
    validarFaseFirmable(e.estadoFases, e.dispensadosSet, datos.faseId);

    const leyenda = `Firmado por ${firmante.nombre} (${datos.email})`;
    const [firma] = await tx
      .insert(firmasFase)
      .values({ ordenId: e.orden.id, faseId: datos.faseId, supervisorId: firmante.id, firmaElectronica: leyenda })
      .returning({ id: firmasFase.id });
    await tx
      .update(dispensados)
      .set({ firmaElectronica: leyenda, supervisorId: firmante.id })
      .where(and(eq(dispensados.ordenId, e.orden.id), eq(dispensados.faseId, datos.faseId)));

    await registrarAuditoria(
      {
        usuarioId: firmante.id,
        accion: "FIRMAR_FASE",
        entidad: "firmas_fase",
        entidadId: firma!.id,
        ip,
        detalles: { ordenId: e.orden.id, ordenNumero: e.orden.numero, faseId: datos.faseId, solicitadaPor: solicitanteId },
      },
      tx,
    );

    const completa = todasFirmadas(e.estadoFases, datos.faseId);
    if (completa && puedeTransicionarOrden(e.orden.estado, "DISPENSADO")) {
      await tx
        .update(ordenesProduccion)
        .set({ estado: "DISPENSADO", updatedAt: new Date() })
        .where(eq(ordenesProduccion.id, e.orden.id));
      await registrarAuditoria(
        {
          usuarioId: firmante.id,
          accion: "COMPLETAR_DISPENSADO",
          entidad: "ordenes_produccion",
          entidadId: e.orden.id,
          ip,
          detalles: { ordenNumero: e.orden.numero, firmadoPor: firmante.nombre },
        },
        tx,
      );
    }
    return { ok: true as const, ordenCompleta: completa };
  });
}

/** Consecutivo de órdenes desde la secuencia de Postgres (sin carreras). */
export async function siguienteConsecutivoOrden(ex: Ejecutor): Promise<number> {
  const filas = await ex.execute<{ n: string }>(sql`select nextval('orden_numero_seq') as n`);
  return Number(filas[0]!.n);
}
