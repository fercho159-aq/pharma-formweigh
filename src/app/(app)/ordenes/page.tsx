import { exigirPermisoPagina } from "@/lib/auth/paginas";

import OrdenesCliente from "./ordenes-cliente";

export default async function OrdenesPage() {
  const usuario = await exigirPermisoPagina("ordenes.ver");
  return <OrdenesCliente rol={usuario.rol} />;
}
