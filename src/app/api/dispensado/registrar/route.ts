import { NextResponse } from "next/server";

import { ruta } from "@/lib/api";
import { esquemaRegistrarDispensado } from "@/lib/esquemas";
import { registrarDispensado } from "@/lib/servicios/dispensado";

export const POST = ruta({ permiso: "dispensado.registrar", esquema: esquemaRegistrarDispensado }, async ({ usuario, datos, ip }) => {
  return NextResponse.json(await registrarDispensado(datos, usuario.id, ip));
});
