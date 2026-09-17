import { NextResponse } from "next/server";
import { query, generateId, registrarAuditoria } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const lotes = await query(`
    SELECT l.*, m.nombre as "materialNombre"
    FROM lotes l
    JOIN materiales m ON l."materialId" = m.id
    ORDER BY l."createdAt" DESC
  `);
  return NextResponse.json(lotes);
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!["ADMIN", "SUPERVISOR", "ALMACEN"].includes(user.rol)) return NextResponse.json({ error: "Solo almacén, supervisor o admin pueden registrar lotes" }, { status: 403 });

  const data = await request.json();
  const id = generateId();

  try {
    await query(
      `INSERT INTO lotes (id, numero, "materialId", cantidad, "cantidadInicial", "fechaRecepcion", "fechaCaducidad", proveedor, certificado)
       VALUES ($1, $2, $3, $4, $5, now(), $6, $7, $8)`,
      [id, data.numero, data.materialId, data.cantidad, data.cantidad, data.fechaCaducidad, data.proveedor, data.certificado || null]
    );

    await registrarAuditoria(user.id, "RECEPCION_LOTE", "lotes", id, {
      numero: data.numero,
      materialId: data.materialId,
      cantidad: data.cantidad,
      proveedor: data.proveedor,
    });

    return NextResponse.json({ id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
