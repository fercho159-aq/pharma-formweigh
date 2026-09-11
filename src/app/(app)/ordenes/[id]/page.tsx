"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";

interface OrdenDetalle {
  id: string;
  numero: string;
  recetaNombre: string;
  recetaCodigo: string;
  loteProducto: string;
  cantidad: number;
  estado: string;
  createdAt: string;
  ingredientes: Array<{
    materialNombre: string;
    materialUnidad: string;
    cantidadTarget: number;
    orden: number;
    dispensado: boolean;
    dispensadoReal?: number;
  }>;
}

export default function OrdenDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [orden, setOrden] = useState<OrdenDetalle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/dispensado/${id}`)
      .then((r) => r.json())
      .then(setOrden)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-center py-12 text-gray-400">Cargando...</div>;
  if (!orden) return <div className="text-center py-12 text-red-500">Orden no encontrada</div>;

  const estadoColor: Record<string, string> = {
    PENDIENTE: "bg-yellow-100 text-yellow-800",
    EN_PROCESO: "bg-blue-100 text-blue-800",
    DISPENSADO: "bg-green-100 text-green-800",
    COMPLETADA: "bg-green-200 text-green-900",
    CANCELADA: "bg-red-100 text-red-800",
  };

  const completados = orden.ingredientes.filter((i) => i.dispensado).length;

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

        <div className="grid grid-cols-3 gap-4 mt-4">
          <div><p className="text-xs text-gray-500">Lote Producto</p><p className="font-mono font-medium">{orden.loteProducto}</p></div>
          <div><p className="text-xs text-gray-500">Cantidad</p><p className="font-medium">{orden.cantidad}x</p></div>
          <div><p className="text-xs text-gray-500">Progreso</p><p className="font-medium">{completados}/{orden.ingredientes.length} pasos</p></div>
        </div>

        {(orden.estado === "PENDIENTE" || orden.estado === "EN_PROCESO") && (
          <div className="mt-4">
            <Link href={`/dispensado/${orden.id}`} className="inline-block bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-800">
              {completados > 0 ? "Continuar Dispensado" : "Iniciar Dispensado"}
            </Link>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border">
        <div className="p-4 border-b"><h2 className="font-semibold">Ingredientes</h2></div>
        <div className="divide-y">
          {orden.ingredientes.map((ing, idx) => (
            <div key={idx} className={`p-4 flex items-center gap-4 ${ing.dispensado ? "bg-green-50" : ""}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                ing.dispensado ? "bg-green-500 text-white" : "bg-gray-200 text-gray-600"
              }`}>
                {ing.dispensado ? "\u2713" : ing.orden}
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{ing.materialNombre}</p>
                <p className="text-xs text-gray-500">
                  Target: {(ing.cantidadTarget * orden.cantidad).toFixed(3)} {ing.materialUnidad}
                  {ing.dispensado && ing.dispensadoReal !== undefined && (
                    <span className="ml-2 text-green-600 font-medium">
                      | Dispensado: {ing.dispensadoReal.toFixed(3)} {ing.materialUnidad}
                    </span>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
