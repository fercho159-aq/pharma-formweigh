"use client";

import { useState, useEffect } from "react";

interface Receta {
  id: string;
  codigo: string;
  nombre: string;
  version: number;
  descripcion: string;
  rendimiento: number;
  unidadRendimiento: string;
  activa: boolean;
  numIngredientes: number;
}

interface Material {
  id: string;
  codigo: string;
  nombre: string;
  unidad: string;
}

interface IngredienteForm {
  materialId: string;
  cantidadTarget: string;
  toleranciaMin: string;
  toleranciaMax: string;
  instrucciones: string;
  peligroso: boolean;
}

export default function RecetasPage() {
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    codigo: "",
    nombre: "",
    descripcion: "",
    rendimiento: "",
    unidadRendimiento: "kg",
  });
  const [ingredientes, setIngredientes] = useState<IngredienteForm[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [recRes, matRes] = await Promise.all([
      fetch("/api/recetas"),
      fetch("/api/inventario/materiales"),
    ]);
    setRecetas(await recRes.json());
    setMateriales(await matRes.json());
    setLoading(false);
  }

  function addIngrediente() {
    setIngredientes([
      ...ingredientes,
      { materialId: "", cantidadTarget: "", toleranciaMin: "-2", toleranciaMax: "2", instrucciones: "", peligroso: false },
    ]);
  }

  function removeIngrediente(idx: number) {
    setIngredientes(ingredientes.filter((_, i) => i !== idx));
  }

  function updateIngrediente(idx: number, field: string, value: string | boolean) {
    setIngredientes(ingredientes.map((ing, i) => (i === idx ? { ...ing, [field]: value } : ing)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/recetas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        rendimiento: parseFloat(form.rendimiento),
        ingredientes: ingredientes.map((ing, idx) => ({
          ...ing,
          orden: idx + 1,
          cantidadTarget: parseFloat(ing.cantidadTarget),
          toleranciaMin: parseFloat(ing.toleranciaMin),
          toleranciaMax: parseFloat(ing.toleranciaMax),
        })),
      }),
    });
    if (res.ok) {
      setForm({ codigo: "", nombre: "", descripcion: "", rendimiento: "", unidadRendimiento: "kg" });
      setIngredientes([]);
      setShowForm(false);
      loadData();
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recetas / Formulaciones</h1>
          <p className="text-gray-500">Gestión de fórmulas de producción</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 cursor-pointer"
        >
          + Nueva Receta
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-6 mb-6 space-y-4">
          <h3 className="font-semibold text-lg">Nueva Receta</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
              <input value={form.codigo} onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" placeholder="REC-001" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" placeholder="Tableta Paracetamol 500mg" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rendimiento</label>
              <input type="number" step="0.01" value={form.rendimiento} onChange={(e) => setForm((f) => ({ ...f, rendimiento: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unidad Rendimiento</label>
              <select value={form.unidadRendimiento} onChange={(e) => setForm((f) => ({ ...f, unidadRendimiento: e.target.value }))} className="w-full px-3 py-2 border rounded-lg">
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="L">L</option>
                <option value="unidad">unidades</option>
                <option value="tabletas">tabletas</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea value={form.descripcion} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" rows={2} />
          </div>

          {/* Ingredientes */}
          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-medium">Ingredientes ({ingredientes.length})</h4>
              <button type="button" onClick={addIngrediente} className="text-blue-600 text-sm font-medium hover:underline cursor-pointer">
                + Agregar Ingrediente
              </button>
            </div>

            {ingredientes.map((ing, idx) => (
              <div key={idx} className="bg-gray-50 rounded-lg p-4 mb-3 relative">
                <button type="button" onClick={() => removeIngrediente(idx)} className="absolute top-2 right-2 text-red-400 hover:text-red-600 cursor-pointer text-lg">&times;</button>
                <p className="text-xs font-semibold text-gray-500 mb-2">Paso {idx + 1}</p>
                <div className="grid grid-cols-4 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-600 mb-1">Material</label>
                    <select value={ing.materialId} onChange={(e) => updateIngrediente(idx, "materialId", e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm" required>
                      <option value="">Seleccionar...</option>
                      {materiales.map((m) => (
                        <option key={m.id} value={m.id}>{m.nombre} ({m.unidad})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Cantidad</label>
                    <input type="number" step="0.001" value={ing.cantidadTarget} onChange={(e) => updateIngrediente(idx, "cantidadTarget", e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm" required />
                  </div>
                  <div className="flex gap-2">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Tol. Min %</label>
                      <input type="number" step="0.1" value={ing.toleranciaMin} onChange={(e) => updateIngrediente(idx, "toleranciaMin", e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Tol. Max %</label>
                      <input type="number" step="0.1" value={ing.toleranciaMax} onChange={(e) => updateIngrediente(idx, "toleranciaMax", e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Instrucciones</label>
                    <input value={ing.instrucciones} onChange={(e) => updateIngrediente(idx, "instrucciones", e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm" placeholder="Agregar lentamente..." />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={ing.peligroso} onChange={(e) => updateIngrediente(idx, "peligroso", e.target.checked)} className="rounded" />
                      Material Peligroso
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button type="submit" className="bg-blue-700 text-white px-6 py-2 rounded-lg font-medium cursor-pointer">Guardar Receta</button>
            <button type="button" onClick={() => { setShowForm(false); setIngredientes([]); }} className="text-gray-500 px-4 py-2 cursor-pointer">Cancelar</button>
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
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Código</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Versión</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Rendimiento</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Ingredientes</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recetas.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm">{r.codigo}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-sm">{r.nombre}</p>
                    {r.descripcion && <p className="text-xs text-gray-400">{r.descripcion}</p>}
                  </td>
                  <td className="px-4 py-3 text-center text-sm">v{r.version}</td>
                  <td className="px-4 py-3 text-right text-sm">{r.rendimiento} {r.unidadRendimiento}</td>
                  <td className="px-4 py-3 text-center text-sm">{r.numIngredientes}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${r.activa ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {r.activa ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                </tr>
              ))}
              {recetas.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No hay recetas registradas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
