import { redirect } from "next/navigation";

import Sidebar from "@/components/sidebar";
import { getSession } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={{ nombre: user.nombre, rol: user.rol }} />
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
