"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";

interface IngredienteDetalle {
  id: string;
  orden: number;
  materialNombre: string;
  materialUnidad: string;
  peligroso: boolean;
  /** Rango de pesaje ya calculado por el servidor (incluye el multiplicador de la orden). */
  rango: { target: number; min: number; max: number };
  dispensado: boolean;
  dispensadoReal?: number;
}

interface FaseDetalle {
  id: string;
  nombre: string;
  orden: number;
  instrucciones: string | null;
  firma: { supervisorNombre: string; timestamp: string } | null;
  ingredientes: IngredienteDetalle[];
}

interface OrdenDetalle {
  id: string;
  numero: string;
  recetaNombre: string;
  recetaCodigo: string;
  loteProducto: string;
  cantidad: number;
  estado: string;
  createdAt: string;
  fases: FaseDetalle[];
}

export default function OrdenDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [orden, setOrden] = useState<OrdenDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      const res = await fetch(`/api/dispensado/${id}`);
      const data = await res.json().catch(() => null);
      if (cancelado) return;
      if (res.ok && data?.id) setOrden(data);
      else setError(data?.error || "Orden no encontrada");
      setLoading(false);
    }
    cargar();
    return () => { cancelado = true; };
  }, [id]);

  if (loading) return <div className="text-center py-12 text-gray-400">Cargando...</div>;
  if (!orden) return <div className="text-center py-12 text-red-500">{error || "Orden no encontrada"}</div>;

  const estadoColor: Record<string, string> = {
    PENDIENTE: "bg-yellow-100 text-yellow-800",
    EN_PROCESO: "bg-blue-100 text-blue-800",
    DISPENSADO: "bg-green-100 text-green-800",
    COMPLETADA: "bg-green-200 text-green-900",
    CANCELADA: "bg-red-100 text-red-800",
  };

  const ingredientes = orden.fases.flatMap((f) => f.ingredientes);
  const completados = ingredientes.filter((i) => i.dispensado).length;
  const fasesFirmadas = orden.fases.filter((f) => f.firma).length;

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link href="/ordenes" className="text-blue-600 hover:underline text-sm">&larr; Volver a órdenes</Link>
      </div>

      <div className="bg-white rounded-xl border p-6 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">{orden.numero}</h1>
            <p className="text-gray-500">{orden.recetaNombre} ({orden.recetaCodigo})</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${estadoColor[orden.estado]}`}>
            {orden.estado.replace("_", " ")}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-4 mt-4">
          <div><p className="text-xs text-gray-500">Lote Producto</p><p className="font-mono font-medium">{orden.loteProducto}</p></div>
          <div><p className="text-xs text-gray-500">Cantidad</p><p className="font-medium">{orden.cantidad}x</p></div>
          <div><p className="text-xs text-gray-500">Pesajes</p><p className="font-medium">{completados}/{ingredientes.length}</p></div>
          <div><p className="text-xs text-gray-500">Fases firmadas</p><p className="font-medium">{fasesFirmadas}/{orden.fases.length}</p></div>
        </div>

        {(orden.estado === "PENDIENTE" || orden.estado === "EN_PROCESO") && (
          <div className="mt-4">
            <Link href={`/dispensado/${orden.id}`} className="inline-block bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-800">
              {completados > 0 ? "Continuar Dispensado" : "Iniciar Dispensado"}
            </Link>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {orden.fases.map((fase) => (
          <div key={fase.id} className="bg-white rounded-xl border overflow-hidden">
            <div className="p-4 border-b flex items-center gap-3">
              <span className="bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0">{fase.orden}</span>
              <div className="flex-1">
                <h2 className="font-semibold">{fase.nombre}</h2>
                {fase.instrucciones && <p className="text-xs text-gray-500">{fase.instrucciones}</p>}
              </div>
              {fase.firma ? (
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  Firmada por {fase.firma.supervisorNombre}
                </span>
              ) : (
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Sin firmar</span>
              )}
            </div>
            <div className="divide-y">
              {fase.ingredientes.map((ing) => (
                <div key={ing.id} className={`p-4 flex items-center gap-4 ${ing.dispensado ? "bg-green-50" : ""}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                    ing.dispensado ? "bg-green-500 text-white" : "bg-gray-200 text-gray-600"
                  }`}>
                    {ing.dispensado ? "✓" : ing.orden}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      {ing.materialNombre}
                      {ing.peligroso && <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Peligroso</span>}
                    </p>
                    <p className="text-xs text-gray-500">
                      Target: {ing.rango.target} {ing.materialUnidad}
                      <span className="ml-2 text-gray-400">(rango {ing.rango.min} &ndash; {ing.rango.max})</span>
                      {ing.dispensado && ing.dispensadoReal !== undefined && (
                        <span className="ml-2 text-green-600 font-medium">
                          | Dispensado: {ing.dispensadoReal} {ing.materialUnidad}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
              {fase.ingredientes.length === 0 && (
                <p className="px-4 py-6 text-center text-gray-400 text-sm">Esta fase no tiene materiales</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
