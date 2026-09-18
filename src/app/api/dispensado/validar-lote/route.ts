import { NextResponse } from "next/server";

import { ruta } from "@/lib/api";
import { esquemaValidarLote } from "@/lib/esquemas";
import { validarLote } from "@/lib/servicios/dispensado";

export const POST = ruta({ permiso: "dispensado.registrar", esquema: esquemaValidarLote }, async ({ datos }) => {
  return NextResponse.json(await validarLote(datos));
});
