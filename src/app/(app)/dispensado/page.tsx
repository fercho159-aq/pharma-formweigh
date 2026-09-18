import { exigirPermisoPagina } from "@/lib/auth/paginas";

import DispensadoCliente from "./dispensado-cliente";

export default async function DispensadoPage() {
  const usuario = await exigirPermisoPagina("dispensado.ver");
  return <DispensadoCliente rol={usuario.rol} />;
}
