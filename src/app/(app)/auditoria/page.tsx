"use client";

import { useState, useEffect } from "react";

interface AuditEntry {
  id: string;
  accion: string;
  entidad: string;
  entidadId: string;
  detalles: string;
  /** Los eventos sin usuario (login fallido) pueden venir nulos. */
  usuarioNombre: string | null;
  usuarioRol: string | null;
  ip: string | null;
  timestamp: string;
}

const SIN_USUARIO = "(sin identificar)";

export default function AuditoriaPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtroAccion, setFiltroAccion] = useState("");
  const [filtroUsuario, setFiltroUsuario] = useState("");

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      const res = await fetch("/api/auditoria");
      const data = await res.json().catch(() => null);
      if (cancelado) return;
      if (Array.isArray(data)) setEntries(data);
      else setError(data?.error || "No se pudo cargar la bitácora");
      setLoading(false);
    }
    cargar();
    return () => { cancelado = true; };
  }, []);

  const nombreDe = (e: AuditEntry) => e.usuarioNombre || SIN_USUARIO;

  const acciones = [...new Set(entries.map((e) => e.accion))].sort();
  const usuarios = [...new Set(entries.map(nombreDe))].sort();

  const filtered = entries.filter((e) => {
    if (filtroAccion && e.accion !== filtroAccion) return false;
    if (filtroUsuario && nombreDe(e) !== filtroUsuario) return false;
    return true;
  });

  const accionColor: Record<string, string> = {
    LOGIN: "bg-gray-100 text-gray-700",
    LOGOUT: "bg-gray-100 text-gray-600",
    CREAR_MATERIAL: "bg-blue-100 text-blue-700",
    CREAR_RECETA: "bg-purple-100 text-purple-700",
    CREAR_ORDEN: "bg-indigo-100 text-indigo-700",
    RECEPCION_LOTE: "bg-teal-100 text-teal-700",
    LOGIN_FALLIDO: "bg-red-100 text-red-700",
    FIRMA_RECHAZADA: "bg-red-100 text-red-700",
    CREAR_USUARIO: "bg-blue-100 text-blue-700",
    FIRMAR_FASE: "bg-green-200 text-green-800",
    CAMBIAR_ESTADO_LOTE: "bg-yellow-100 text-yellow-700",
    DISPENSAR: "bg-green-100 text-green-700",
    FIRMAR_DISPENSADO: "bg-green-200 text-green-800",
    COMPLETAR_DISPENSADO: "bg-green-300 text-green-900",
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Audit Trail</h1>
        <p className="text-gray-500">Registro inmutable de todas las acciones del sistema</p>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <select
          value={filtroAccion}
          onChange={(e) => setFiltroAccion(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="">Todas las acciones</option>
          {acciones.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select
          value={filtroUsuario}
          onChange={(e) => setFiltroUsuario(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="">Todos los usuarios</option>
          {usuarios.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <span className="text-sm text-gray-400 self-center">{filtered.length} registros</span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando...</div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fecha/Hora</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Usuario</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Acción</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Entidad</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">IP</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Detalles</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((e) => {
                let detalles: Record<string, unknown> = {};
                try { detalles = JSON.parse(e.detalles); } catch {}
                return (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs font-mono text-gray-600 whitespace-nowrap">
                      {new Date(e.timestamp).toLocaleString("es-MX")}
                    </td>
                    <td className="px-4 py-3">
                      <p className={`text-sm font-medium ${e.usuarioNombre ? "" : "text-gray-400 italic"}`}>{nombreDe(e)}</p>
                      <p className="text-xs text-gray-400">{e.usuarioRol || "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${accionColor[e.accion] || "bg-gray-100 text-gray-700"}`}>
                        {e.accion}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{e.entidad}</td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-500 whitespace-nowrap">{e.ip || "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">
                      {Object.entries(detalles).map(([k, v]) => `${k}: ${v}`).join(", ")}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No hay registros de auditoría</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
