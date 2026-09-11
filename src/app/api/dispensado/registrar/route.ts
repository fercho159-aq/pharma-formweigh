import { NextResponse } from "next/server";
import { getDb, generateId, registrarAuditoria, resolveUserId } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const data = await request.json();
  const db = getDb();
  const id = generateId();

  const transaction = db.transaction(() => {
    // Register dispensado
    db.prepare(
      `INSERT INTO dispensados (id, ordenId, loteId, operarioId, materialNombre, cantidadTarget, cantidadReal, toleranciaOk, paso)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, data.ordenId, data.loteId, resolveUserId(user.id, user.email), data.materialNombre, data.cantidadTarget, data.cantidadReal, data.toleranciaOk ? 1 : 0, data.paso);

    // Discount from lot
    db.prepare("UPDATE lotes SET cantidad = cantidad - ? WHERE id = ?").run(data.cantidadReal, data.loteId);

    // Check if lot is depleted
    const lote = db.prepare("SELECT cantidad FROM lotes WHERE id = ?").get(data.loteId) as { cantidad: number };
    if (lote.cantidad <= 0) {
      db.prepare("UPDATE lotes SET estado = 'AGOTADO' WHERE id = ?").run(data.loteId);
    }

    // Update order status
    db.prepare("UPDATE ordenes_produccion SET estado = 'EN_PROCESO', updatedAt = datetime('now') WHERE id = ? AND estado = 'PENDIENTE'").run(data.ordenId);
  });

  try {
    transaction();
    registrarAuditoria(user.id, "DISPENSAR", "dispensados", id, {
      ordenId: data.ordenId,
      material: data.materialNombre,
      cantidadTarget: data.cantidadTarget,
      cantidadReal: data.cantidadReal,
      toleranciaOk: data.toleranciaOk,
      paso: data.paso,
    });
    return NextResponse.json({ ok: true, id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
