import { redirect } from "next/navigation";

import { exigirPermisoPagina } from "@/lib/auth/paginas";
import { tienePermiso } from "@/lib/auth/permisos";

/**
 * La estación de pesaje es solo para quien puede pesar. Los roles de consulta
 * (Calidad, Auditor, Desarrollo) ven la misma orden en modo lectura en /ordenes/[id].
 */
export default async function Layout({ children, params }: { children: React.ReactNode; params: Promise<{ ordenId: string }> }) {
  const usuario = await exigirPermisoPagina("dispensado.ver");
  if (!tienePermiso(usuario.rol, "dispensado.registrar")) {
    redirect(`/ordenes/${(await params).ordenId}`);
  }
  return children;
}
