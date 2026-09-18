"use client";

import { useState, useEffect } from "react";

import { tienePermiso } from "@/lib/auth/permisos";

interface Receta {
  id: string;
  codigo: string;
  nombre: string;
  version: number;
  descripcion: string;
  rendimiento: number;
  unidadRendimiento: string;
  activa: boolean;
  numFases: number;
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

interface FaseForm {
  nombre: string;
  instrucciones: string;
  ingredientes: IngredienteForm[];
}

export default function RecetasCliente({ rol }: { rol: string }) {
  const puedeCrear = tienePermiso(rol, "recetas.crear");
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    codigo: "",
    nombre: "",
    descripcion: "",
    rendimiento: "",
    unidadRendimiento: "kg",
  });
  const [fases, setFases] = useState<FaseForm[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [recRes, matRes] = await Promise.all([
      fetch("/api/recetas"),
      fetch("/api/inventario/materiales"),
    ]);
    const recData = await recRes.json().catch(() => null);
    const matData = await matRes.json().catch(() => null);
    if (Array.isArray(recData)) setRecetas(recData);
    if (Array.isArray(matData)) setMateriales(matData);
    if (!Array.isArray(recData)) setError(recData?.error || "No se pudieron cargar las recetas");
    setLoading(false);
  }

  function addFase() {
    setFases([...fases, { nombre: "", instrucciones: "", ingredientes: [] }]);
  }

  function removeFase(idx: number) {
    setFases(fases.filter((_, i) => i !== idx));
  }

  function updateFase(idx: number, field: string, value: string) {
    setFases(fases.map((f, i) => (i === idx ? { ...f, [field]: value } : f)));
  }

  function addIngredienteToFase(faseIdx: number) {
    setFases(fases.map((f, i) =>
      i === faseIdx
        ? { ...f, ingredientes: [...f.ingredientes, { materialId: "", cantidadTarget: "", toleranciaMin: "-2", toleranciaMax: "2", instrucciones: "", peligroso: false }] }
        : f
    ));
  }

  function removeIngredienteFromFase(faseIdx: number, ingIdx: number) {
    setFases(fases.map((f, i) =>
      i === faseIdx
        ? { ...f, ingredientes: f.ingredientes.filter((_, j) => j !== ingIdx) }
        : f
    ));
  }

  function updateIngredienteInFase(faseIdx: number, ingIdx: number, field: string, value: string | boolean) {
    setFases(fases.map((f, i) =>
      i === faseIdx
        ? { ...f, ingredientes: f.ingredientes.map((ing, j) => j === ingIdx ? { ...ing, [field]: value } : ing) }
        : f
    ));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    // El `orden` debe ser único en TODA la receta, no por fase: contador corrido.
    let orden = 0;
    const res = await fetch("/api/recetas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        codigo: form.codigo,
        nombre: form.nombre,
        descripcion: form.descripcion.trim() || null,
        rendimiento: Number(form.rendimiento),
        unidadRendimiento: form.unidadRendimiento,
        fases: fases.map((fase) => ({
          nombre: fase.nombre,
          instrucciones: fase.instrucciones.trim() || null,
          ingredientes: fase.ingredientes.map((ing) => ({
            materialId: ing.materialId,
            orden: ++orden,
            cantidadTarget: Number(ing.cantidadTarget),
            toleranciaMin: Number(ing.toleranciaMin),
            toleranciaMax: Number(ing.toleranciaMax),
            instrucciones: ing.instrucciones.trim() || null,
            peligroso: ing.peligroso,
          })),
        })),
      }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setForm({ codigo: "", nombre: "", descripcion: "", rendimiento: "", unidadRendimiento: "kg" });
      setFases([]);
      setShowForm(false);
      loadData();
    } else {
      setError(data?.error || "No se pudo guardar la receta");
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recetas / Formulaciones</h1>
          <p className="text-gray-500">Gestión de fórmulas de producción</p>
        </div>
        {puedeCrear && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 cursor-pointer"
          >
            + Nueva Receta
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
          <h3 className="font-semibold text-lg">Nueva Receta</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="receta-codigo" className="block text-sm font-medium text-gray-700 mb-1">Código</label>
              <input id="receta-codigo" name="codigo" autoComplete="off" value={form.codigo} onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" placeholder="REC-001" required />
            </div>
            <div>
              <label htmlFor="receta-nombre" className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input id="receta-nombre" name="nombre" autoComplete="off" value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" placeholder="Tableta Paracetamol 500mg" required />
            </div>
            <div>
              <label htmlFor="receta-rendimiento" className="block text-sm font-medium text-gray-700 mb-1">Rendimiento</label>
              <input id="receta-rendimiento" name="rendimiento" type="number" step="0.01" autoComplete="off" value={form.rendimiento} onChange={(e) => setForm((f) => ({ ...f, rendimiento: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" required />
            </div>
            <div>
              <label htmlFor="receta-unidad-rendimiento" className="block text-sm font-medium text-gray-700 mb-1">Unidad Rendimiento</label>
              <select id="receta-unidad-rendimiento" name="unidadRendimiento" value={form.unidadRendimiento} onChange={(e) => setForm((f) => ({ ...f, unidadRendimiento: e.target.value }))} className="w-full px-3 py-2 border rounded-lg">
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="L">L</option>
                <option value="unidad">unidades</option>
                <option value="tabletas">tabletas</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="receta-descripcion" className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea id="receta-descripcion" name="descripcion" value={form.descripcion} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" rows={2} />
          </div>

          {/* Fases de Fabricación */}
          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-medium">Fases de Fabricación ({fases.length})</h4>
              <button type="button" onClick={addFase} className="text-blue-600 text-sm font-medium hover:underline cursor-pointer">
                + Agregar Fase
              </button>
            </div>

            {fases.length === 0 && (
              <div className="text-center py-6 text-gray-400 border-2 border-dashed rounded-lg">
                <p className="text-sm">Agrega al menos una fase de fabricación</p>
                <p className="text-xs mt-1">Cada fase contiene los materiales a dispensar en ese paso del proceso</p>
              </div>
            )}

            {fases.map((fase, fIdx) => (
              <div key={fIdx} className="border-2 border-blue-200 rounded-xl mb-4 overflow-hidden">
                {/* Fase Header */}
                <div className="bg-blue-50 px-4 py-3 flex items-center gap-3">
                  <span className="bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">{fIdx + 1}</span>
                  <input
                    id={`fase-${fIdx}-nombre`}
                    name={`fase-${fIdx}-nombre`}
                    aria-label={`Nombre de la fase ${fIdx + 1}`}
                    autoComplete="off"
                    value={fase.nombre}
                    onChange={(e) => updateFase(fIdx, "nombre", e.target.value)}
                    className="flex-1 px-3 py-1.5 border rounded-lg text-sm font-medium"
                    placeholder="Nombre de la fase (ej: Dispensado de activos)"
                    required
                  />
                  <button type="button" onClick={() => removeFase(fIdx)} className="text-red-400 hover:text-red-600 cursor-pointer text-lg font-bold">&times;</button>
                </div>

                <div className="p-4 space-y-3">
                  <div>
                    <label htmlFor={`fase-${fIdx}-instrucciones`} className="block text-xs text-gray-600 mb-1">Instrucciones de la fase (opcional)</label>
                    <input id={`fase-${fIdx}-instrucciones`} name={`fase-${fIdx}-instrucciones`} autoComplete="off" value={fase.instrucciones} onChange={(e) => updateFase(fIdx, "instrucciones", e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm" placeholder="Instrucciones generales para esta fase..." />
                  </div>

                  {/* Ingredientes de esta fase */}
                  <div className="flex justify-between items-center">
                    <p className="text-xs font-semibold text-gray-500 uppercase">Materiales ({fase.ingredientes.length})</p>
                    <button type="button" onClick={() => addIngredienteToFase(fIdx)} className="text-blue-600 text-xs font-medium hover:underline cursor-pointer">
                      + Agregar Material
                    </button>
                  </div>

                  {fase.ingredientes.map((ing, ingIdx) => (
                    <div key={ingIdx} className="bg-gray-50 rounded-lg p-3 relative">
                      <button type="button" onClick={() => removeIngredienteFromFase(fIdx, ingIdx)} className="absolute top-2 right-2 text-red-400 hover:text-red-600 cursor-pointer">&times;</button>
                      <p className="text-xs font-semibold text-gray-400 mb-2">Material {ingIdx + 1}</p>
                      <div className="grid grid-cols-4 gap-3">
                        <div className="col-span-2">
                          <label htmlFor={`fase-${fIdx}-ing-${ingIdx}-material`} className="block text-xs text-gray-600 mb-1">Material</label>
                          <select id={`fase-${fIdx}-ing-${ingIdx}-material`} name={`fase-${fIdx}-ing-${ingIdx}-material`} value={ing.materialId} onChange={(e) => updateIngredienteInFase(fIdx, ingIdx, "materialId", e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm" required>
                            <option value="">Seleccionar...</option>
                            {materiales.map((m) => (
                              <option key={m.id} value={m.id}>{m.nombre} ({m.unidad})</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label htmlFor={`fase-${fIdx}-ing-${ingIdx}-cantidad`} className="block text-xs text-gray-600 mb-1">Cantidad</label>
                          <input id={`fase-${fIdx}-ing-${ingIdx}-cantidad`} name={`fase-${fIdx}-ing-${ingIdx}-cantidad`} type="number" step="0.001" autoComplete="off" value={ing.cantidadTarget} onChange={(e) => updateIngredienteInFase(fIdx, ingIdx, "cantidadTarget", e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm" required />
                        </div>
                        <div className="flex gap-2">
                          <div>
                            <label htmlFor={`fase-${fIdx}-ing-${ingIdx}-tolerancia-min`} className="block text-xs text-gray-600 mb-1">Tol -</label>
                            <input id={`fase-${fIdx}-ing-${ingIdx}-tolerancia-min`} name={`fase-${fIdx}-ing-${ingIdx}-tolerancia-min`} type="number" step="0.1" autoComplete="off" value={ing.toleranciaMin} onChange={(e) => updateIngredienteInFase(fIdx, ingIdx, "toleranciaMin", e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm" />
                          </div>
                          <div>
                            <label htmlFor={`fase-${fIdx}-ing-${ingIdx}-tolerancia-max`} className="block text-xs text-gray-600 mb-1">Tol +</label>
                            <input id={`fase-${fIdx}-ing-${ingIdx}-tolerancia-max`} name={`fase-${fIdx}-ing-${ingIdx}-tolerancia-max`} type="number" step="0.1" autoComplete="off" value={ing.toleranciaMax} onChange={(e) => updateIngredienteInFase(fIdx, ingIdx, "toleranciaMax", e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm" />
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-2">
                        <div>
                          <label htmlFor={`fase-${fIdx}-ing-${ingIdx}-instrucciones`} className="block text-xs text-gray-600 mb-1">Instrucciones</label>
                          <input id={`fase-${fIdx}-ing-${ingIdx}-instrucciones`} name={`fase-${fIdx}-ing-${ingIdx}-instrucciones`} autoComplete="off" value={ing.instrucciones} onChange={(e) => updateIngredienteInFase(fIdx, ingIdx, "instrucciones", e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm" placeholder="Agregar lentamente..." />
                        </div>
                        <div className="flex items-end">
                          <label htmlFor={`fase-${fIdx}-ing-${ingIdx}-peligroso`} className="flex items-center gap-2 text-sm cursor-pointer">
                            <input id={`fase-${fIdx}-ing-${ingIdx}-peligroso`} name={`fase-${fIdx}-ing-${ingIdx}-peligroso`} type="checkbox" checked={ing.peligroso} onChange={(e) => updateIngredienteInFase(fIdx, ingIdx, "peligroso", e.target.checked)} className="rounded" />
                            Peligroso
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}

                  {fase.ingredientes.length === 0 && (
                    <div className="text-center py-3 text-gray-400 border border-dashed rounded-lg text-xs">
                      Agrega materiales a esta fase
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={fases.length === 0 || fases.some((f) => f.ingredientes.length === 0)} className="bg-blue-700 text-white px-6 py-2 rounded-lg font-medium cursor-pointer disabled:bg-gray-300 disabled:cursor-not-allowed">Guardar Receta</button>
            <button type="button" onClick={() => { setShowForm(false); setFases([]); }} className="text-gray-500 px-4 py-2 cursor-pointer">Cancelar</button>
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
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fases</th>
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
                  <td className="px-4 py-3 text-center text-sm">{r.numFases}</td>
                  <td className="px-4 py-3 text-center text-sm">{r.numIngredientes}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${r.activa ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {r.activa ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                </tr>
              ))}
              {recetas.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No hay recetas registradas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
