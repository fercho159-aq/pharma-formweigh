"use client";

import { useState, useEffect } from "react";
import BarcodeInput from "@/components/barcode-input";

import { tienePermiso } from "@/lib/auth/permisos";

interface Material {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  unidad: string;
  stockMinimo: number;
  stockActual: number;
  lotesActivos: number;
}

interface Lote {
  id: string;
  numero: string;
  materialId: string;
  materialNombre: string;
  cantidad: number;
  cantidadInicial: number;
  fechaRecepcion: string;
  fechaCaducidad: string;
  proveedor: string;
  estado: string;
}

/** Aprobar y rechazar los libera Calidad; retener (volver a cuarentena) también Almacén. */
const ROLES_LIBERAN = ["ADMIN", "SUPERVISOR", "CALIDAD"];

export default function InventarioCliente({ rol }: { rol: string }) {
  const puedeCrearMaterial = tienePermiso(rol, "inventario.crearMaterial");
  const puedeRecibir = tienePermiso(rol, "inventario.recibirLote");
  const puedeCambiarEstado = tienePermiso(rol, "inventario.cambiarEstadoLote");
  const puedeLiberar = puedeCambiarEstado && ROLES_LIBERAN.includes(rol);

  const [tab, setTab] = useState<"materiales" | "lotes" | "recepcion">("materiales");
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Material form
  const [matForm, setMatForm] = useState({ codigo: "", nombre: "", descripcion: "", unidad: "kg", stockMinimo: "0" });

  // Lote reception form
  const [recForm, setRecForm] = useState({ codigoMaterial: "", numeroLote: "", cantidad: "", proveedor: "", fechaCaducidad: "", certificado: "" });
  const [recMaterial, setRecMaterial] = useState<{ id: string; nombre: string; unidad: string } | null>(null);
  const [recMsg, setRecMsg] = useState({ type: "", text: "" });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [matRes, lotRes] = await Promise.all([
      fetch("/api/inventario/materiales"),
      fetch("/api/inventario/lotes"),
    ]);
    const matData = await matRes.json().catch(() => null);
    const lotData = await lotRes.json().catch(() => null);
    if (Array.isArray(matData)) setMateriales(matData);
    if (Array.isArray(lotData)) setLotes(lotData);
    if (!Array.isArray(matData) || !Array.isArray(lotData)) {
      setError(matData?.error || lotData?.error || "No se pudo cargar el inventario");
    }
    setLoading(false);
  }

  async function handleCreateMaterial(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/inventario/materiales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        codigo: matForm.codigo,
        nombre: matForm.nombre,
        descripcion: matForm.descripcion.trim() || null,
        unidad: matForm.unidad,
        stockMinimo: Number(matForm.stockMinimo || 0),
      }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setMatForm({ codigo: "", nombre: "", descripcion: "", unidad: "kg", stockMinimo: "0" });
      setShowForm(false);
      loadData();
    } else {
      setError(data?.error || "No se pudo crear el material");
    }
  }

  async function handleScanRecepcion(codigo: string) {
    const res = await fetch(`/api/inventario/materiales/buscar?codigo=${encodeURIComponent(codigo)}`);
    const data = await res.json().catch(() => null);
    if (res.ok && data?.id) {
      setRecMaterial(data);
      setRecForm((f) => ({ ...f, codigoMaterial: codigo }));
      setRecMsg({ type: "success", text: `Material encontrado: ${data.nombre}` });
    } else {
      setRecMaterial(null);
      setRecMsg({ type: "error", text: data?.error || "Material no encontrado. Registra el material primero." });
    }
  }

  async function handleRecepcion(e: React.FormEvent) {
    e.preventDefault();
    if (!recMaterial) return;
    const res = await fetch("/api/inventario/lotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        materialId: recMaterial.id,
        numero: recForm.numeroLote,
        cantidad: Number(recForm.cantidad),
        fechaCaducidad: recForm.fechaCaducidad,
        proveedor: recForm.proveedor,
        certificado: recForm.certificado.trim() || null,
      }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setRecForm({ codigoMaterial: "", numeroLote: "", cantidad: "", proveedor: "", fechaCaducidad: "", certificado: "" });
      setRecMaterial(null);
      setRecMsg({ type: "success", text: "Lote registrado exitosamente en CUARENTENA" });
      loadData();
    } else {
      setRecMsg({ type: "error", text: data?.error || "Error al registrar lote" });
    }
  }

  async function handleCambiarEstadoLote(loteId: string, nuevoEstado: string) {
    setError("");
    const res = await fetch(`/api/inventario/lotes/${loteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: nuevoEstado }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) loadData();
    else setError(data?.error || "No se pudo cambiar el estado del lote");
  }

  const estadoColor: Record<string, string> = {
    CUARENTENA: "bg-yellow-100 text-yellow-800 border-yellow-300",
    APROBADO: "bg-green-100 text-green-800 border-green-300",
    RECHAZADO: "bg-red-100 text-red-800 border-red-300",
    AGOTADO: "bg-gray-100 text-gray-800 border-gray-300",
    CADUCADO: "bg-red-200 text-red-900 border-red-400",
  };

  const tabs = [
    { key: "materiales", label: "Materiales" },
    { key: "lotes", label: "Lotes" },
    ...(puedeRecibir ? [{ key: "recepcion", label: "Recepción" }] : []),
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
          <p className="text-gray-500">Gestión de materiales y lotes</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
              tab === t.key ? "bg-white shadow text-blue-700" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando...</div>
      ) : tab === "materiales" ? (
        <div>
          {puedeCrearMaterial && (
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setShowForm(!showForm)}
                className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 cursor-pointer"
              >
                + Nuevo Material
              </button>
            </div>
          )}

          {puedeCrearMaterial && showForm && (
            <form onSubmit={handleCreateMaterial} className="bg-white rounded-xl border p-6 mb-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Código (barras)</label>
                  <input
                    value={matForm.codigo}
                    onChange={(e) => setMatForm((f) => ({ ...f, codigo: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input
                    value={matForm.nombre}
                    onChange={(e) => setMatForm((f) => ({ ...f, nombre: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unidad</label>
                  <select
                    value={matForm.unidad}
                    onChange={(e) => setMatForm((f) => ({ ...f, unidad: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="kg">Kilogramos (kg)</option>
                    <option value="g">Gramos (g)</option>
                    <option value="L">Litros (L)</option>
                    <option value="mL">Mililitros (mL)</option>
                    <option value="mg">Miligramos (mg)</option>
                    <option value="unidad">Unidades</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock Mínimo</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={matForm.stockMinimo}
                    onChange={(e) => setMatForm((f) => ({ ...f, stockMinimo: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <input
                  value={matForm.descripcion}
                  onChange={(e) => setMatForm((f) => ({ ...f, descripcion: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm cursor-pointer">Guardar</button>
                <button type="button" onClick={() => setShowForm(false)} className="text-gray-500 px-4 py-2 text-sm cursor-pointer">Cancelar</button>
              </div>
            </form>
          )}

          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Código</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Material</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Unidad</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Stock Actual</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Stock Mín</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Lotes</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {materiales.map((m) => (
                  <tr key={m.id} className={`hover:bg-gray-50 ${m.stockActual < m.stockMinimo ? "bg-red-50" : ""}`}>
                    <td className="px-4 py-3 font-mono text-sm">{m.codigo}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-sm">{m.nombre}</p>
                      {m.descripcion && <p className="text-xs text-gray-400">{m.descripcion}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm">{m.unidad}</td>
                    <td className={`px-4 py-3 text-sm text-right font-semibold ${m.stockActual < m.stockMinimo ? "text-red-600" : ""}`}>
                      {m.stockActual.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">{m.stockMinimo}</td>
                    <td className="px-4 py-3 text-sm text-center">{m.lotesActivos}</td>
                  </tr>
                ))}
                {materiales.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No hay materiales registrados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === "lotes" ? (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Lote</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Material</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Cantidad</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Proveedor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Caducidad</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                {puedeCambiarEstado && (
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Acciones</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {lotes.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm">{l.numero}</td>
                  <td className="px-4 py-3 text-sm">{l.materialNombre}</td>
                  <td className="px-4 py-3 text-sm text-right">{l.cantidad.toFixed(2)} / {l.cantidadInicial.toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm">{l.proveedor}</td>
                  <td className="px-4 py-3 text-sm">{new Date(l.fechaCaducidad).toLocaleDateString("es-MX")}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${estadoColor[l.estado]}`}>
                      {l.estado}
                    </span>
                  </td>
                  {puedeCambiarEstado && (
                    <td className="px-4 py-3 text-center">
                      {l.estado === "CUARENTENA" && puedeLiberar && (
                        <div className="flex gap-1 justify-center">
                          <button
                            onClick={() => handleCambiarEstadoLote(l.id, "APROBADO")}
                            className="text-green-600 hover:bg-green-50 px-2 py-1 rounded text-xs font-medium cursor-pointer"
                          >
                            Aprobar
                          </button>
                          <button
                            onClick={() => handleCambiarEstadoLote(l.id, "RECHAZADO")}
                            className="text-red-600 hover:bg-red-50 px-2 py-1 rounded text-xs font-medium cursor-pointer"
                          >
                            Rechazar
                          </button>
                        </div>
                      )}
                      {l.estado === "APROBADO" && (
                        <button
                          onClick={() => handleCambiarEstadoLote(l.id, "CUARENTENA")}
                          className="text-yellow-700 hover:bg-yellow-50 px-2 py-1 rounded text-xs font-medium cursor-pointer"
                        >
                          Retener
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {lotes.length === 0 && (
                <tr><td colSpan={puedeCambiarEstado ? 7 : 6} className="px-4 py-8 text-center text-gray-400">No hay lotes registrados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Tab Recepción */
        <div className="max-w-2xl">
          <div className="bg-white rounded-xl border p-6 space-y-6">
            <h2 className="text-lg font-semibold">Recepción de Material</h2>

            <BarcodeInput
              onScan={handleScanRecepcion}
              label="1. Escanear código del material"
              placeholder="Escanea o escribe el código del material..."
            />

            {recMsg.text && (
              <div className={`px-4 py-3 rounded-lg text-sm ${
                recMsg.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
              }`}>
                {recMsg.text}
              </div>
            )}

            {recMaterial && (
              <form onSubmit={handleRecepcion} className="space-y-4 pt-4 border-t">
                <p className="text-sm text-gray-600">
                  Material: <strong>{recMaterial.nombre}</strong> ({recMaterial.unidad})
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Número de Lote</label>
                    <input
                      value={recForm.numeroLote}
                      onChange={(e) => setRecForm((f) => ({ ...f, numeroLote: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg font-mono"
                      placeholder="LOT-2024-001"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad ({recMaterial.unidad})</label>
                    <input
                      type="number"
                      step="0.0001"
                      min="0.0001"
                      value={recForm.cantidad}
                      onChange={(e) => setRecForm((f) => ({ ...f, cantidad: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
                    <input
                      value={recForm.proveedor}
                      onChange={(e) => setRecForm((f) => ({ ...f, proveedor: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Caducidad</label>
                    <input
                      type="date"
                      value={recForm.fechaCaducidad}
                      onChange={(e) => setRecForm((f) => ({ ...f, fechaCaducidad: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Certificado de Análisis (referencia)</label>
                  <input
                    value={recForm.certificado}
                    onChange={(e) => setRecForm((f) => ({ ...f, certificado: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="COA-2024-001"
                  />
                </div>

                <button type="submit" className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 cursor-pointer">
                  Registrar Lote (Cuarentena)
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
