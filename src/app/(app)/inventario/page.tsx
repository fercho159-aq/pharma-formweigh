import { exigirPermisoPagina } from "@/lib/auth/paginas";

import InventarioCliente from "./inventario-cliente";

export default async function InventarioPage() {
  const usuario = await exigirPermisoPagina("inventario.ver");
  return <InventarioCliente rol={usuario.rol} />;
}
