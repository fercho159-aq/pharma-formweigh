import { NextResponse } from "next/server";
import { query, generateId, registrarAuditoria } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const materiales = await query(`
    SELECT m.*,
      COALESCE(SUM(CASE WHEN l.estado = 'APROBADO' THEN l.cantidad ELSE 0 END), 0) as "stockActual",
      COUNT(CASE WHEN l.estado IN ('APROBADO', 'CUARENTENA') THEN 1 END) as "lotesActivos"
    FROM materiales m
    LEFT JOIN lotes l ON l."materialId" = m.id
    WHERE m.activo = true
    GROUP BY m.id, m.codigo, m.nombre, m.descripcion, m.unidad, m."stockMinimo", m.activo
    ORDER BY m.nombre
  `);
  return NextResponse.json(materiales);
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const data = await request.json();
  const id = generateId();

  await query(
    'INSERT INTO materiales (id, codigo, nombre, descripcion, unidad, "stockMinimo") VALUES ($1, $2, $3, $4, $5, $6)',
    [id, data.codigo, data.nombre, data.descripcion || null, data.unidad, data.stockMinimo || 0]
  );

  await registrarAuditoria(user.id, "CREAR_MATERIAL", "materiales", id, { nombre: data.nombre, codigo: data.codigo });

  return NextResponse.json({ id });
}
