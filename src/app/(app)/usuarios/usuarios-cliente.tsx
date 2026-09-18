"use client";

import { useState, useEffect } from "react";

import { tienePermiso } from "@/lib/auth/permisos";

interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  badge: string;
  activo: boolean;
  createdAt: string;
}

export default function UsuariosCliente({ rol }: { rol: string }) {
  const puedeCrear = tienePermiso(rol, "usuarios.crear");
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ nombre: "", email: "", password: "", rol: "OPERARIO", badge: "" });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const res = await fetch("/api/usuarios");
    const data = await res.json().catch(() => null);
    if (res.ok && Array.isArray(data)) setUsuarios(data);
    else setError(data?.error || "No se pudo cargar la lista de usuarios");
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, badge: form.badge.trim() || null }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setForm({ nombre: "", email: "", password: "", rol: "OPERARIO", badge: "" });
      setShowForm(false);
      loadData();
    } else {
      setError(data?.error || "No se pudo crear el usuario");
    }
  }

  const rolColor: Record<string, string> = {
    ADMIN: "bg-red-100 text-red-700",
    SUPERVISOR: "bg-blue-100 text-blue-700",
    DESARROLLO: "bg-purple-100 text-purple-700",
    CALIDAD: "bg-amber-100 text-amber-700",
    ALMACEN: "bg-teal-100 text-teal-700",
    OPERARIO: "bg-green-100 text-green-700",
    AUDITOR: "bg-gray-100 text-gray-700",
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-gray-500">Gestión de usuarios y roles</p>
        </div>
        {puedeCrear && (
          <button onClick={() => setShowForm(!showForm)} className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 cursor-pointer">
            + Nuevo Usuario
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}

      {puedeCrear && showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-6 mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" minLength={10} autoComplete="new-password" required />
              <p className="text-xs text-gray-400 mt-1">Mínimo 10 caracteres</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
              <select value={form.rol} onChange={(e) => setForm((f) => ({ ...f, rol: e.target.value }))} className="w-full px-3 py-2 border rounded-lg">
                <option value="OPERARIO">Operario</option>
                <option value="SUPERVISOR">Supervisor</option>
                <option value="DESARROLLO">Desarrollo</option>
                <option value="CALIDAD">Calidad</option>
                <option value="ALMACEN">Almacén</option>
                <option value="AUDITOR">Auditor</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Badge (código de barras)</label>
              <input value={form.badge} onChange={(e) => setForm((f) => ({ ...f, badge: e.target.value }))} className="w-full px-3 py-2 border rounded-lg font-mono" placeholder="BADGE-001" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-blue-700 text-white px-6 py-2 rounded-lg font-medium cursor-pointer">Crear Usuario</button>
            <button type="button" onClick={() => setShowForm(false)} className="text-gray-500 px-4 py-2 cursor-pointer">Cancelar</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando...</div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Email</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Rol</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Badge</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {usuarios.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-sm">{u.nombre}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${rolColor[u.rol]}`}>{u.rol}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm text-gray-500">{u.badge || "-"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${u.activo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {u.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                </tr>
              ))}
              {usuarios.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No hay usuarios registrados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
