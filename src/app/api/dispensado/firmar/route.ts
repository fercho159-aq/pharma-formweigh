import { NextResponse } from "next/server";
import { getDb, registrarAuditoria, verifyPassword } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { ordenId, email, password } = await request.json();
  const db = getDb();

  // Verify supervisor credentials
  const supervisor = db.prepare(
    "SELECT id, nombre, password, rol FROM usuarios WHERE email = ? AND activo = 1"
  ).get(email) as { id: string; nombre: string; password: string; rol: string } | undefined;

  if (!supervisor) {
    return NextResponse.json({ ok: false, error: "Supervisor no encontrado" });
  }

  if (supervisor.rol !== "SUPERVISOR" && supervisor.rol !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Solo un SUPERVISOR o ADMIN puede firmar" });
  }

  if (!verifyPassword(password, supervisor.password)) {
    return NextResponse.json({ ok: false, error: "Contraseña incorrecta" });
  }

  // Update all dispensados for this order with firma
  db.prepare(
    "UPDATE dispensados SET firmaElectronica = ?, supervisorId = ? WHERE ordenId = ?"
  ).run(`Firmado por ${supervisor.nombre} (${email})`, supervisor.id, ordenId);

  // Update order status
  db.prepare(
    "UPDATE ordenes_produccion SET estado = 'DISPENSADO', updatedAt = datetime('now') WHERE id = ?"
  ).run(ordenId);

  registrarAuditoria(supervisor.id, "FIRMAR_DISPENSADO", "ordenes_produccion", ordenId, {
    supervisorNombre: supervisor.nombre,
    operarioId: user.id,
  });

  registrarAuditoria(user.id, "COMPLETAR_DISPENSADO", "ordenes_produccion", ordenId, {
    firmadoPor: supervisor.nombre,
  });

  return NextResponse.json({ ok: true });
}
