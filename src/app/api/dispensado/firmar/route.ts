import { NextResponse } from "next/server";
import { query, queryOne, generateId, registrarAuditoria, verifyPassword } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { ordenId, faseId, email, password } = await request.json();

  // Verify supervisor credentials
  const supervisor = await queryOne(
    "SELECT id, nombre, password, rol FROM usuarios WHERE email = $1 AND activo = true",
    [email]
  ) as { id: string; nombre: string; password: string; rol: string } | null;

  if (!supervisor) {
    return NextResponse.json({ ok: false, error: "Supervisor no encontrado" });
  }

  if (!["SUPERVISOR", "ADMIN", "CALIDAD"].includes(supervisor.rol)) {
    return NextResponse.json({ ok: false, error: "Solo un SUPERVISOR, CALIDAD o ADMIN puede firmar" });
  }

  if (!verifyPassword(password, supervisor.password)) {
    return NextResponse.json({ ok: false, error: "Contraseña incorrecta" });
  }

  // Insert firma_fase record
  const firmaId = generateId();
  await query(
    `INSERT INTO firmas_fase (id, "ordenId", "faseId", "supervisorId", "firmaElectronica")
     VALUES ($1, $2, $3, $4, $5)`,
    [firmaId, ordenId, faseId, supervisor.id, `Firmado por ${supervisor.nombre} (${email})`]
  );

  // Update dispensados for this phase with firma info
  await query(
    'UPDATE dispensados SET "firmaElectronica" = $1, "supervisorId" = $2 WHERE "ordenId" = $3 AND "faseId" = $4',
    [`Firmado por ${supervisor.nombre} (${email})`, supervisor.id, ordenId, faseId]
  );

  // Check if ALL phases for this order's recipe have been signed
  const orden = await queryOne('SELECT "recetaId" FROM ordenes_produccion WHERE id = $1', [ordenId]) as { recetaId: string };
  const totalFases = await queryOne(
    'SELECT COUNT(*) as count FROM fases WHERE "recetaId" = $1',
    [orden.recetaId]
  ) as { count: string };
  const firmadas = await queryOne(
    'SELECT COUNT(*) as count FROM firmas_fase WHERE "ordenId" = $1',
    [ordenId]
  ) as { count: string };

  if (parseInt(firmadas.count) >= parseInt(totalFases.count)) {
    // All phases signed - mark order as DISPENSADO
    await query(
      `UPDATE ordenes_produccion SET estado = 'DISPENSADO', "updatedAt" = now() WHERE id = $1`,
      [ordenId]
    );

    await registrarAuditoria(user.id, "COMPLETAR_DISPENSADO", "ordenes_produccion", ordenId, {
      firmadoPor: supervisor.nombre,
    });
  }

  await registrarAuditoria(supervisor.id, "FIRMAR_FASE", "firmas_fase", firmaId, {
    ordenId,
    faseId,
    supervisorNombre: supervisor.nombre,
    operarioId: user.id,
  });

  return NextResponse.json({ ok: true });
}
