"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Orden {
  id: string;
  numero: string;
  recetaNombre: string;
  recetaCodigo: string;
  loteProducto: string;
  cantidad: number;
  estado: string;
  createdAt: string;
}

interface Receta {
  id: string;
  codigo: string;
  nombre: string;
}

export default function OrdenesPage() {
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ recetaId: "", loteProducto: "", cantidad: "1", prioridad: "0" });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [ordRes, recRes] = await Promise.all([
      fetch("/api/ordenes"),
      fetch("/api/recetas"),
    ]);
    setOrdenes(await ordRes.json());
    setRecetas(await recRes.json());
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/ordenes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recetaId: form.recetaId,
        loteProducto: form.loteProducto,
        cantidad: parseFloat(form.cantidad),
        prioridad: parseInt(form.prioridad),
      }),
    });
    if (res.ok) {
      setForm({ recetaId: "", loteProducto: "", cantidad: "1", prioridad: "0" });
      setShowForm(false);
      loadData();
    }
  }

  const estadoColor: Record<string, string> = {
    PENDIENTE: "bg-yellow-100 text-yellow-800",
    EN_PROCESO: "bg-blue-100 text-blue-800",
    DISPENSADO: "bg-green-100 text-green-800",
    EN_PRODUCCION: "bg-purple-100 text-purple-800",
    COMPLETADA: "bg-green-200 text-green-900",
    CANCELADA: "bg-red-100 text-red-800",
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Órdenes de Producción</h1>
          <p className="text-gray-500">Gestión de lotes de fabricación</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 cursor-pointer">
          + Nueva Orden
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-6 mb-6 space-y-4">
          <h3 className="font-semibold">Nueva Orden de Producción</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Receta</label>
              <select value={form.recetaId} onChange={(e) => setForm((f) => ({ ...f, recetaId: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" required>
                <option value="">Seleccionar receta...</option>
                {recetas.map((r) => (
                  <option key={r.id} value={r.id}>{r.codigo} - {r.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lote del Producto Final</label>
              <input value={form.loteProducto} onChange={(e) => setForm((f) => ({ ...f, loteProducto: e.target.value }))} className="w-full px-3 py-2 border rounded-lg font-mono" placeholder="PROD-2024-001" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad (multiplicador)</label>
              <input type="number" step="0.01" min="0.01" value={form.cantidad} onChange={(e) => setForm((f) => ({ ...f, cantidad: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
              <select value={form.prioridad} onChange={(e) => setForm((f) => ({ ...f, prioridad: e.target.value }))} className="w-full px-3 py-2 border rounded-lg">
                <option value="0">Normal</option>
                <option value="1">Alta</option>
                <option value="2">Urgente</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-blue-700 text-white px-6 py-2 rounded-lg font-medium cursor-pointer">Crear Orden</button>
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
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Orden</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Receta</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Lote Producto</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Cantidad</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {ordenes.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm font-semibold">{o.numero}</td>
                  <td className="px-4 py-3 text-sm">{o.recetaNombre}</td>
                  <td className="px-4 py-3 font-mono text-sm">{o.loteProducto}</td>
                  <td className="px-4 py-3 text-sm text-right">{o.cantidad}x</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${estadoColor[o.estado]}`}>
                      {o.estado.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{new Date(o.createdAt).toLocaleDateString("es-MX")}</td>
                  <td className="px-4 py-3 text-center">
                    {(o.estado === "PENDIENTE" || o.estado === "EN_PROCESO") && (
                      <Link href={`/dispensado/${o.id}`} className="text-blue-600 hover:underline text-sm font-medium">
                        Dispensar
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
              {ordenes.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No hay órdenes registradas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
