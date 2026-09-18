import { asc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { fases, ingredientes, materiales, recetas } from "@/db/schema";
import { ruta } from "@/lib/api";
import { registrarAuditoria } from "@/lib/auditoria";
import { ErrorDominio } from "@/lib/dominio/errores";
import { esquemaCrearReceta } from "@/lib/esquemas";

export const GET = ruta({ permiso: "recetas.ver" }, async () => {
  const lista = await db
    .select({
      id: recetas.id,
      codigo: recetas.codigo,
      nombre: recetas.nombre,
      version: recetas.version,
      descripcion: recetas.descripcion,
      rendimiento: recetas.rendimiento,
      unidadRendimiento: recetas.unidadRendimiento,
      activa: recetas.activa,
      createdAt: recetas.createdAt,
      updatedAt: recetas.updatedAt,
      numFases: sql<number>`(select count(*)::int from fases f where f.receta_id = ${recetas.id})`,
      numIngredientes: sql<number>`(select count(*)::int from ingredientes i where i.receta_id = ${recetas.id})`,
    })
    .from(recetas)
    .orderBy(asc(recetas.nombre));
  return NextResponse.json(lista);
});

export const POST = ruta({ permiso: "recetas.crear", esquema: esquemaCrearReceta }, async ({ usuario, datos, ip }) => {
  const id = await db.transaction(async (tx) => {
    const [alta] = await tx
      .insert(recetas)
      .values({ codigo: datos.codigo, nombre: datos.nombre, descripcion: datos.descripcion, rendimiento: datos.rendimiento, unidadRendimiento: datos.unidadRendimiento })
      .returning({ id: recetas.id });
    let totalIngredientes = 0;
    for (const [indice, fase] of datos.fases.entries()) {
      const [altaFase] = await tx
        .insert(fases)
        .values({ recetaId: alta!.id, nombre: fase.nombre, orden: indice + 1, instrucciones: fase.instrucciones })
        .returning({ id: fases.id });
      for (const ing of fase.ingredientes) {
        const [material] = await tx.select({ id: materiales.id }).from(materiales).where(eq(materiales.id, ing.materialId));
        if (!material) throw new ErrorDominio("Un ingrediente usa un material que no existe.", "MATERIAL_NO_ENCONTRADO", 404);
        await tx.insert(ingredientes).values({ recetaId: alta!.id, faseId: altaFase!.id, ...ing });
        totalIngredientes++;
      }
    }
    await registrarAuditoria({ usuarioId: usuario.id, accion: "CREAR_RECETA", entidad: "recetas", entidadId: alta!.id, ip, detalles: { nombre: datos.nombre, codigo: datos.codigo, fases: datos.fases.length, ingredientes: totalIngredientes } }, tx);
    return alta!.id;
  });
  return NextResponse.json({ id });
});
