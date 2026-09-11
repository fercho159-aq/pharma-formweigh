import { NextResponse } from "next/server";
import { query, queryOne, generateId, registrarAuditoria, resolveUserId } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const data = await request.json();
  const id = generateId();

  try {
    const resolvedUserId = await resolveUserId(user.id, user.email);

    // Register dispensado
    await query(
      `INSERT INTO dispensados (id, "ordenId", "faseId", "loteId", "operarioId", "materialNombre", "cantidadTarget", "cantidadReal", "toleranciaOk", paso)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, data.ordenId, data.faseId || null, data.loteId, resolvedUserId, data.materialNombre, data.cantidadTarget, data.cantidadReal, data.toleranciaOk ? true : false, data.paso]
    );

    // Discount from lot
    await query("UPDATE lotes SET cantidad = cantidad - $1 WHERE id = $2", [data.cantidadReal, data.loteId]);

    // Check if lot is depleted
    const lote = await queryOne("SELECT cantidad FROM lotes WHERE id = $1", [data.loteId]) as { cantidad: number };
    if (lote.cantidad <= 0) {
      await query("UPDATE lotes SET estado = 'AGOTADO' WHERE id = $1", [data.loteId]);
    }

    // Update order status
    await query(
      `UPDATE ordenes_produccion SET estado = 'EN_PROCESO', "updatedAt" = now() WHERE id = $1 AND estado = 'PENDIENTE'`,
      [data.ordenId]
    );

    await registrarAuditoria(user.id, "DISPENSAR", "dispensados", id, {
      ordenId: data.ordenId,
      material: data.materialNombre,
      cantidadTarget: data.cantidadTarget,
      cantidadReal: data.cantidadReal,
      toleranciaOk: data.toleranciaOk,
      paso: data.paso,
      faseId: data.faseId || null,
    });
    return NextResponse.json({ ok: true, id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
