import { NextResponse } from "next/server";

import { ruta } from "@/lib/api";
import { tienePermiso } from "@/lib/auth/permisos";
import { detalleOrden } from "@/lib/servicios/dispensado";

export const GET = ruta<undefined, { ordenId: string }>({ permiso: "dispensado.ver" }, async ({ params, usuario }) => {
  const detalle = await detalleOrden(params.ordenId);
  return NextResponse.json({ ...detalle, puedeDispensar: tienePermiso(usuario.rol, "dispensado.registrar") });
});
