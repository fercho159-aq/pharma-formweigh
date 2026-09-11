import { NextResponse } from "next/server";
import { query, queryOne, registrarAuditoria, verifyPassword } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { ordenId, email, password } = await request.json();

  // Verify supervisor credentials
  const supervisor = await queryOne(
    "SELECT id, nombre, password, rol FROM usuarios WHERE email = $1 AND activo = true",
    [email]
  ) as { id: string; nombre: string; password: string; rol: string } | null;

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
  await query(
    'UPDATE dispensados SET "firmaElectronica" = $1, "supervisorId" = $2 WHERE "ordenId" = $3',
    [`Firmado por ${supervisor.nombre} (${email})`, supervisor.id, ordenId]
  );

  // Update order status
  await query(
    `UPDATE ordenes_produccion SET estado = 'DISPENSADO', "updatedAt" = now() WHERE id = $1`,
    [ordenId]
  );

  await registrarAuditoria(supervisor.id, "FIRMAR_DISPENSADO", "ordenes_produccion", ordenId, {
    supervisorNombre: supervisor.nombre,
    operarioId: user.id,
  });

  await registrarAuditoria(user.id, "COMPLETAR_DISPENSADO", "ordenes_produccion", ordenId, {
    firmadoPor: supervisor.nombre,
  });

  return NextResponse.json({ ok: true });
}
