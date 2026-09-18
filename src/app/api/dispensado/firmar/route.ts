import { NextResponse } from "next/server";

import { ruta } from "@/lib/api";
import { esquemaFirmarFase } from "@/lib/esquemas";
import { firmarFase } from "@/lib/servicios/dispensado";

export const POST = ruta({ permiso: "dispensado.solicitarFirma", esquema: esquemaFirmarFase }, async ({ usuario, datos, ip }) => {
  return NextResponse.json(await firmarFase(datos, usuario.id, ip));
});
