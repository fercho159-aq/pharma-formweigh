"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Orden {
  id: string;
  numero: string;
  recetaNombre: string;
  loteProducto: string;
  cantidad: number;
  estado: string;
  numIngredientes: number;
  numDispensados: number;
}

export default function DispensadoPage() {
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dispensado/ordenes")
      .then((r) => r.json())
      .then(setOrdenes)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Estación de Dispensado</h1>
        <p className="text-gray-500">Selecciona una orden para iniciar el proceso de pesaje</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando...</div>
      ) : ordenes.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <p className="text-gray-500">No hay órdenes pendientes de dispensado</p>
          <Link href="/ordenes" className="text-blue-600 hover:underline text-sm mt-2 inline-block">Crear una orden de producción</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ordenes.map((o) => (
            <Link
              key={o.id}
              href={`/dispensado/${o.id}`}
              className="bg-white rounded-xl border p-6 hover:shadow-lg transition-shadow group"
            >
              <div className="flex justify-between items-start mb-3">
                <span className="font-mono font-bold text-lg text-blue-700">{o.numero}</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  o.estado === "EN_PROCESO" ? "bg-blue-100 text-blue-800" : "bg-yellow-100 text-yellow-800"
                }`}>
                  {o.estado.replace("_", " ")}
                </span>
              </div>
              <p className="font-medium text-gray-900 mb-1">{o.recetaNombre}</p>
              <p className="text-sm text-gray-500 mb-3">Lote: {o.loteProducto} | Cantidad: {o.cantidad}x</p>

              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-blue-600 rounded-full h-2 transition-all"
                    style={{ width: `${o.numIngredientes > 0 ? (o.numDispensados / o.numIngredientes) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500">{o.numDispensados}/{o.numIngredientes}</span>
              </div>

              <div className="mt-4 text-center">
                <span className="text-blue-600 font-medium text-sm group-hover:underline">
                  {o.numDispensados > 0 ? "Continuar dispensado" : "Iniciar dispensado"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
