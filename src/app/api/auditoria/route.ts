import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const entries = db.prepare(`
    SELECT a.*, u.nombre as usuarioNombre, u.rol as usuarioRol
    FROM auditoria a
    JOIN usuarios u ON a.usuarioId = u.id
    ORDER BY a.timestamp DESC
    LIMIT 500
  `).all();
  return NextResponse.json(entries);
}
