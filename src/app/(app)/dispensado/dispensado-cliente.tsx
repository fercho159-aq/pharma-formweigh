"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

import { tienePermiso } from "@/lib/auth/permisos";

interface Fase {
  id: string;
  nombre: string;
  orden: number;
  firmada: boolean;
}

interface Orden {
  id: string;
  numero: string;
  recetaNombre: string;
  loteProducto: string;
  cantidad: number;
  estado: string;
  numIngredientes: number;
  numDispensados: number;
  numFases: number;
  numFasesFirmadas: number;
  fases: Fase[];
  createdAt: string;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

const estadoBadge: Record<string, string> = {
  EN_PROCESO: "bg-blue-100 text-blue-800 border-blue-200",
  PENDIENTE: "bg-yellow-100 text-yellow-800 border-yellow-200",
  DISPENSADO: "bg-green-100 text-green-800 border-green-200",
  COMPLETADA: "bg-green-200 text-green-900 border-green-300",
  CANCELADA: "bg-red-100 text-red-800 border-red-200",
};

const estadoLabel: Record<string, string> = {
  EN_PROCESO: "En Proceso",
  PENDIENTE: "Pendiente",
  DISPENSADO: "Dispensado",
  COMPLETADA: "Completada",
  CANCELADA: "Cancelada",
};

function OrderCard({ orden, puedeRegistrar }: { orden: Orden; puedeRegistrar: boolean }) {
  const progressPercent = orden.numFases > 0
    ? Math.round((orden.numFasesFirmadas / orden.numFases) * 100)
    : 0;

  const isActive = orden.estado === "EN_PROCESO";
  const isCompleted = orden.estado === "DISPENSADO" || orden.estado === "COMPLETADA";
  const hasStarted = orden.numDispensados > 0 || orden.numFasesFirmadas > 0;
  // Sin permiso de pesaje, la tarjeta entra al detalle de la orden en modo consulta.
  const destino = puedeRegistrar ? `/dispensado/${orden.id}` : `/ordenes/${orden.id}`;

  return (
    <Link
      href={destino}
      className={`block bg-white rounded-xl border p-5 hover:shadow-lg transition-all group ${
        isActive ? "border-blue-300 ring-1 ring-blue-100" : ""
      }`}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <span className="font-mono font-bold text-lg text-blue-700">{orden.numero}</span>
          <p className="text-xs text-gray-400 mt-0.5">{timeAgo(orden.createdAt)}</p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${estadoBadge[orden.estado] || "bg-gray-100 text-gray-600"}`}>
          {estadoLabel[orden.estado] || orden.estado}
        </span>
      </div>

      {/* Recipe & Batch */}
      <p className="font-semibold text-gray-900 mb-1">{orden.recetaNombre}</p>
      <p className="text-sm text-gray-500 mb-4">
        Lote: <span className="font-mono text-gray-700">{orden.loteProducto}</span>
        <span className="mx-2">|</span>
        Cantidad: {orden.cantidad}x
      </p>

      {/* Phase progress */}
      {orden.fases.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Progreso de Fases</span>
            <span className="text-xs font-semibold text-gray-700">{orden.numFasesFirmadas}/{orden.numFases} firmadas</span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-100 rounded-full h-2.5 mb-3">
            <div
              className={`h-2.5 rounded-full transition-all ${
                isCompleted ? "bg-green-500" : progressPercent > 0 ? "bg-blue-500" : "bg-gray-200"
              }`}
              style={{ width: `${Math.max(progressPercent, 2)}%` }}
            />
          </div>

          {/* Phase list */}
          <div className="space-y-1.5">
            {orden.fases.map((fase) => (
              <div key={fase.id} className="flex items-center gap-2">
                {fase.firmada ? (
                  <svg className="w-4 h-4 text-green-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />
                )}
                <span className={`text-sm ${fase.firmada ? "text-green-700 line-through" : "text-gray-700"}`}>
                  Fase {fase.orden}: {fase.nombre}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dispensing progress */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-gray-500">Ingredientes:</span>
        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
          <div
            className="bg-indigo-500 rounded-full h-1.5 transition-all"
            style={{ width: `${orden.numIngredientes > 0 ? (orden.numDispensados / orden.numIngredientes) * 100 : 0}%` }}
          />
        </div>
        <span className="text-xs font-medium text-gray-600">{orden.numDispensados}/{orden.numIngredientes}</span>
      </div>

      {/* Action button */}
      {!isCompleted && !puedeRegistrar && (
        <div className="pt-3 border-t">
          <span className="flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold bg-gray-50 text-gray-600 group-hover:bg-gray-100 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Ver detalle
          </span>
        </div>
      )}
      {!isCompleted && puedeRegistrar && (
        <div className="pt-3 border-t">
          <span className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-colors ${
            isActive || hasStarted
              ? "bg-blue-50 text-blue-700 group-hover:bg-blue-100"
              : "bg-gray-50 text-gray-700 group-hover:bg-gray-100"
          }`}>
            {hasStarted ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Continuar
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Iniciar
              </>
            )}
          </span>
        </div>
      )}
    </Link>
  );
}

export default function DispensadoCliente({ rol }: { rol: string }) {
  const puedeRegistrar = tienePermiso(rol, "dispensado.registrar");
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    fetch("/api/dispensado/ordenes")
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (Array.isArray(data)) setOrdenes(data);
        else setError(data?.error || "No se pudieron cargar las órdenes");
      })
      .finally(() => setLoading(false));
  }, []);

  const enProceso = ordenes.filter((o) => o.estado === "EN_PROCESO");
  const pendientes = ordenes.filter((o) => o.estado === "PENDIENTE");
  const completadas = ordenes.filter((o) => o.estado === "DISPENSADO" || o.estado === "COMPLETADA");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Estacion de Dispensado</h1>
        <p className="text-gray-500">Vista general de todas las ordenes y su progreso por fases</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-gray-400 mt-3">Cargando ordenes...</p>
        </div>
      ) : ordenes.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <p className="text-gray-500 text-lg">No hay ordenes registradas</p>
          <Link href="/ordenes" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
            Crear una orden de produccion
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {/* En Proceso */}
          {enProceso.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
                <h2 className="text-lg font-bold text-gray-900">En Proceso</h2>
                <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">{enProceso.length}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {enProceso.map((o) => <OrderCard key={o.id} orden={o} puedeRegistrar={puedeRegistrar} />)}
              </div>
            </section>
          )}

          {/* Pendientes */}
          {pendientes.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                <h2 className="text-lg font-bold text-gray-900">Pendientes</h2>
                <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">{pendientes.length}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendientes.map((o) => <OrderCard key={o.id} orden={o} puedeRegistrar={puedeRegistrar} />)}
              </div>
            </section>
          )}

          {/* Completadas */}
          {completadas.length > 0 && (
            <section>
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="flex items-center gap-3 mb-4 group cursor-pointer"
              >
                <div className="w-3 h-3 bg-green-500 rounded-full" />
                <h2 className="text-lg font-bold text-gray-900">Completadas</h2>
                <span className="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">{completadas.length}</span>
                <svg className={`w-5 h-5 text-gray-400 transition-transform ${showCompleted ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showCompleted && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {completadas.map((o) => <OrderCard key={o.id} orden={o} puedeRegistrar={puedeRegistrar} />)}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
