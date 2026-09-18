import { NextResponse } from "next/server";

import { ruta } from "@/lib/api";
import { ordenesConAvance } from "@/lib/servicios/tablero";

export const GET = ruta({ permiso: "dispensado.ver" }, async () => {
  return NextResponse.json(await ordenesConAvance());
});
