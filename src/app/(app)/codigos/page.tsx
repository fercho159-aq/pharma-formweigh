import { exigirPermisoPagina } from "@/lib/auth/paginas";

import CodigosCliente from "./codigos-cliente";

export default async function CodigosPage() {
  const usuario = await exigirPermisoPagina("codigos.ver");
  return <CodigosCliente rol={usuario.rol} />;
}
