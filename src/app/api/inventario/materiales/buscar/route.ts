import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const codigo = searchParams.get("codigo");
  if (!codigo) return NextResponse.json({ error: "Código requerido" }, { status: 400 });

  const material = await queryOne(
    "SELECT id, nombre, unidad FROM materiales WHERE codigo = $1 AND activo = true",
    [codigo]
  );

  if (!material) return NextResponse.json({ error: "Material no encontrado" }, { status: 404 });

  return NextResponse.json(material);
}
