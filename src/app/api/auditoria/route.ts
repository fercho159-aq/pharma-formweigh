import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  const entries = await query(`
    SELECT a.*, u.nombre as "usuarioNombre", u.rol as "usuarioRol"
    FROM auditoria a
    JOIN usuarios u ON a."usuarioId" = u.id
    ORDER BY a.timestamp DESC
    LIMIT 500
  `);
  return NextResponse.json(entries);
}
