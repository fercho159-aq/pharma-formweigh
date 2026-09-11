import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function POST(request: Request) {
  const { codigoLote, materialId, cantidadRequerida } = await request.json();
  const db = getDb();

  const lote = db.prepare(`
    SELECT l.*, m.nombre as materialNombre
    FROM lotes l
    JOIN materiales m ON l.materialId = m.id
    WHERE l.numero = ?
  `).get(codigoLote) as {
    id: string;
    materialId: string;
    materialNombre: string;
    cantidad: number;
    estado: string;
    fechaCaducidad: string;
  } | undefined;

  if (!lote) {
    return NextResponse.json({ ok: false, error: "Lote no encontrado. Verifica el código de barras." });
  }

  if (lote.materialId !== materialId) {
    return NextResponse.json({ ok: false, error: `Material incorrecto. Se esperaba el material requerido, pero este lote es de: ${lote.materialNombre}` });
  }

  if (lote.estado !== "APROBADO") {
    return NextResponse.json({ ok: false, error: `Lote en estado ${lote.estado}. Solo se pueden usar lotes APROBADOS.` });
  }

  const caducidad = new Date(lote.fechaCaducidad);
  if (caducidad < new Date()) {
    return NextResponse.json({ ok: false, error: `Lote CADUCADO (${caducidad.toLocaleDateString("es-MX")}). No se puede utilizar.` });
  }

  if (lote.cantidad < cantidadRequerida) {
    return NextResponse.json({ ok: false, error: `Cantidad insuficiente. Disponible: ${lote.cantidad}, Requerido: ${cantidadRequerida}` });
  }

  return NextResponse.json({
    ok: true,
    loteId: lote.id,
    materialNombre: lote.materialNombre,
    cantidad: lote.cantidad,
  });
}
