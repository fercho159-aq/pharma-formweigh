import { NextResponse } from "next/server";

import { ruta } from "@/lib/api";
import { detalleOrden } from "@/lib/servicios/dispensado";

export const GET = ruta<undefined, { ordenId: string }>({ permiso: "dispensado.ver" }, async ({ params }) => {
  return NextResponse.json(await detalleOrden(params.ordenId));
});
