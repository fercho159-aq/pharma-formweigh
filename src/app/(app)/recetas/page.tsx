import { exigirPermisoPagina } from "@/lib/auth/paginas";

import RecetasCliente from "./recetas-cliente";

export default async function RecetasPage() {
  const usuario = await exigirPermisoPagina("recetas.ver");
  return <RecetasCliente rol={usuario.rol} />;
}
