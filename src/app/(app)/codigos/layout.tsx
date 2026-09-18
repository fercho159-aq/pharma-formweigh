import { exigirPermisoPagina } from "@/lib/auth/paginas";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await exigirPermisoPagina("codigos.ver");
  return children;
}
