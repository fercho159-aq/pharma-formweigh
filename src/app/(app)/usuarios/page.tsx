import { exigirPermisoPagina } from "@/lib/auth/paginas";

import UsuariosCliente from "./usuarios-cliente";

export default async function UsuariosPage() {
  const usuario = await exigirPermisoPagina("usuarios.ver");
  return <UsuariosCliente rol={usuario.rol} />;
}
