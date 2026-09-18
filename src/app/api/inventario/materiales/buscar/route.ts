import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { materiales } from "@/db/schema";
import { ruta } from "@/lib/api";

export const GET = ruta({ permiso: "inventario.ver" }, async ({ request }) => {
  const codigo = new URL(request.url).searchParams.get("codigo")?.trim();
  if (!codigo || codigo.length > 40) return NextResponse.json({ ok: false, error: "Código requerido", codigo: "VALIDACION" }, { status: 400 });
  const [material] = await db
    .select({ id: materiales.id, nombre: materiales.nombre, unidad: materiales.unidad })
    .from(materiales)
    .where(and(eq(materiales.codigo, codigo), eq(materiales.activo, true)));
  if (!material) return NextResponse.json({ ok: false, error: "Material no encontrado", codigo: "MATERIAL_NO_ENCONTRADO" }, { status: 404 });
  return NextResponse.json(material);
});
