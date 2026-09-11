import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const codigo = searchParams.get("codigo");
  if (!codigo) return NextResponse.json({ error: "Código requerido" }, { status: 400 });

  const db = getDb();
  const material = db.prepare(
    "SELECT id, nombre, unidad FROM materiales WHERE codigo = ? AND activo = 1"
  ).get(codigo);

  if (!material) return NextResponse.json({ error: "Material no encontrado" }, { status: 404 });

  return NextResponse.json(material);
}
