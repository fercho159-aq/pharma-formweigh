"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import BarcodeInput from "@/components/barcode-input";
import { BARRA_VERDE_FIN, BARRA_VERDE_INICIO, evaluarPeso, posicionEnBarra } from "@/lib/dominio/tolerancia";

interface Ingrediente {
  id: string;
  materialId: string;
  materialNombre: string;
  materialCodigo: string;
  materialUnidad: string;
  cantidadTarget: number;
  toleranciaMin: number;
  toleranciaMax: number;
  instrucciones: string;
  peligroso: boolean;
  orden: number;
  dispensado: boolean;
  dispensadoReal?: number;
  /** Límites calculados por el servidor (target × cantidad de la orden, en 4 decimales). */
  rango: { target: number; min: number; max: number };
}

interface Fase {
  id: string;
  nombre: string;
  orden: number;
  instrucciones: string | null;
  firma: { supervisorNombre: string; timestamp: string } | null;
  ingredientes: Ingrediente[];
}

interface OrdenDetalle {
  id: string;
  numero: string;
  recetaNombre: string;
  loteProducto: string;
  cantidad: number;
  estado: string;
  fases: Fase[];
}

export default function DispensadoOrdenPage({ params }: { params: Promise<{ ordenId: string }> }) {
  const { ordenId } = use(params);
  const router = useRouter();
  const [orden, setOrden] = useState<OrdenDetalle | null>(null);
  const [loading, setLoading] = useState(true);

  // Phase-level state
  const [currentPhaseIdx, setCurrentPhaseIdx] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);

  // Step states
  const [phase, setPhase] = useState<"scan" | "weigh" | "confirm" | "done">("scan");
  const [scanResult, setScanResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [scannedLoteId, setScannedLoteId] = useState("");
  const [peso, setPeso] = useState("");
  const [pesoStatus, setPesoStatus] = useState<"none" | "low" | "ok" | "warning" | "high">("none");
  const [registroError, setRegistroError] = useState("");

  // Firma
  const [showFirma, setShowFirma] = useState(false);
  const [firmaEmail, setFirmaEmail] = useState("");
  const [firmaPassword, setFirmaPassword] = useState("");
  const [firmaError, setFirmaError] = useState("");
  const [firmaLoading, setFirmaLoading] = useState(false);
  const [registrando, setRegistrando] = useState(false);

  // All phases completed
  const [allCompleted, setAllCompleted] = useState(false);

  useEffect(() => { loadOrden(); }, [ordenId]);

  async function loadOrden() {
    setLoading(true);
    const res = await fetch(`/api/dispensado/${ordenId}`);
    if (res.ok) {
      const data: OrdenDetalle = await res.json();
      setOrden(data);
      initializeState(data);
    }
    setLoading(false);
  }

  function initializeState(data: OrdenDetalle) {
    // Find the first phase that is not fully signed
    const firstActivePhaseIdx = data.fases.findIndex((f) => !f.firma);
    if (firstActivePhaseIdx < 0) {
      // All phases signed
      setAllCompleted(true);
      setPhase("done");
      return;
    }

    setAllCompleted(false);
    setCurrentPhaseIdx(firstActivePhaseIdx);

    const activeFase = data.fases[firstActivePhaseIdx];
    const nextIngIdx = activeFase.ingredientes.findIndex((i) => !i.dispensado);

    if (nextIngIdx < 0) {
      // All ingredients dispensed but not signed yet
      setCurrentStep(activeFase.ingredientes.length);
      setShowFirma(true);
      setPhase("done");
    } else {
      setCurrentStep(nextIngIdx);
      setShowFirma(false);
      setPhase("scan");
    }

    // Reset input states
    setPeso("");
    setPesoStatus("none");
    setScanResult(null);
    setScannedLoteId("");
    setFirmaEmail("");
    setFirmaPassword("");
    setFirmaError("");
  }

  function getCurrentFase(): Fase | null {
    if (!orden || currentPhaseIdx >= orden.fases.length) return null;
    return orden.fases[currentPhaseIdx];
  }

  function getCurrentIngrediente(): Ingrediente | null {
    const fase = getCurrentFase();
    if (!fase || currentStep >= fase.ingredientes.length) return null;
    return fase.ingredientes[currentStep];
  }

  async function handleScan(code: string) {
    const ing = getCurrentIngrediente();
    if (!ing || !orden) return;

    const res = await fetch(`/api/dispensado/validar-lote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        codigoLote: code,
        ordenId: orden.id,
        ingredienteId: ing.id,
      }),
    });
    const data = await res.json();

    if (data.ok) {
      setScanResult({ ok: true, msg: `Lote ${code} verificado: ${data.materialNombre} - ${data.cantidad} ${ing.materialUnidad} disponibles` });
      setScannedLoteId(data.loteId);
      setPhase("weigh");
    } else {
      setScanResult({ ok: false, msg: data.error });
    }
  }

  function handlePesoChange(value: string) {
    setPeso(value);
    const ing = getCurrentIngrediente();
    if (!ing || !orden || !value) {
      setPesoStatus("none");
      return;
    }

    const pesoNum = parseFloat(value);
    if (!Number.isFinite(pesoNum)) {
      setPesoStatus("none");
      return;
    }
    setRegistroError("");
    setPesoStatus(evaluarPeso(pesoNum, ing.rango));
  }

  async function handleConfirmPeso() {
    const ing = getCurrentIngrediente();
    const fase = getCurrentFase();
    if (!ing || !orden || !peso || registrando || !fase) return;
    setRegistrando(true);

    const pesoNum = parseFloat(peso);
    setRegistroError("");

    const res = await fetch(`/api/dispensado/registrar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ordenId: orden.id,
        ingredienteId: ing.id,
        loteId: scannedLoteId,
        cantidadReal: pesoNum,
      }),
    });

    if (res.ok) {
      const nextStep = currentStep + 1;
      if (nextStep < fase.ingredientes.length) {
        setCurrentStep(nextStep);
        setPhase("scan");
        setPeso("");
        setPesoStatus("none");
        setScanResult(null);
        setScannedLoteId("");
        loadOrden();
      } else {
        // All ingredients in this phase done - show firma
        setPhase("done");
        setShowFirma(true);
        loadOrden();
      }
    } else {
      // El servidor es quien decide (tolerancia, lote, orden de pasos): se muestra su motivo.
      const data = await res.json().catch(() => null);
      setRegistroError(data?.error || "No se pudo registrar el pesaje. Intenta de nuevo.");
      loadOrden();
    }
    setRegistrando(false);
  }

  async function handleFirma(e: React.FormEvent) {
    e.preventDefault();
    setFirmaError("");
    setFirmaLoading(true);

    const fase = getCurrentFase();
    if (!fase || !orden) return;

    const res = await fetch(`/api/dispensado/firmar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ordenId: orden.id,
        faseId: fase.id,
        email: firmaEmail,
        password: firmaPassword,
      }),
    });

    const data = await res.json();
    if (data.ok) {
      // Reset firma form state
      setShowFirma(false);
      setFirmaEmail("");
      setFirmaPassword("");
      setFirmaError("");
      setFirmaLoading(false);
      // Reload data - initializeState will figure out the next phase or mark as completed
      await loadOrden();
    } else {
      setFirmaError(data.error || "Error al firmar");
      setFirmaLoading(false);
    }
  }

  if (loading) return <div className="text-center py-12 text-gray-400">Cargando orden...</div>;
  if (!orden) return <div className="text-center py-12 text-red-500">Orden no encontrada</div>;

  const currentFase = getCurrentFase();
  const ing = getCurrentIngrediente();
  const target = ing ? ing.rango.target : 0;
  const min = ing ? ing.rango.min : 0;
  const max = ing ? ing.rango.max : 0;

  // Overall progress
  const totalIngredientes = orden.fases.reduce((sum, f) => sum + f.ingredientes.length, 0);
  const completedIngredientes = orden.fases.reduce((sum, f) => sum + f.ingredientes.filter((i) => i.dispensado).length, 0);
  const completedFases = orden.fases.filter((f) => f.firma).length;

  const statusColors = {
    none: { bg: "bg-gray-100", border: "border-gray-300", text: "text-gray-600", label: "Esperando peso" },
    low: { bg: "bg-red-50", border: "border-red-500", text: "text-red-700", label: "BAJO - Fuera de tolerancia" },
    ok: { bg: "bg-green-50", border: "border-green-500", text: "text-green-700", label: "OK - Dentro de tolerancia" },
    warning: { bg: "bg-yellow-50", border: "border-yellow-500", text: "text-yellow-700", label: "PRECAUCIÓN - Cerca del límite" },
    high: { bg: "bg-red-50", border: "border-red-500", text: "text-red-700", label: "ALTO - Fuera de tolerancia" },
  };

  const status = statusColors[pesoStatus];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-xl border p-4 mb-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">Dispensado: {orden.numero}</h1>
          <p className="text-sm text-gray-500">{orden.recetaNombre} | Lote: {orden.loteProducto} | Cantidad: {orden.cantidad}x</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Progreso</p>
          <p className="text-2xl font-bold text-blue-700">{completedFases}/{orden.fases.length} fases</p>
          <p className="text-xs text-gray-400">{completedIngredientes}/{totalIngredientes} ingredientes</p>
        </div>
      </div>

      {/* Phase Progress Bar */}
      <div className="flex gap-2 mb-6">
        {orden.fases.map((fase, idx) => {
          const isSigned = !!fase.firma;
          const isActive = idx === currentPhaseIdx && !allCompleted;
          const faseCompleted = fase.ingredientes.filter((i) => i.dispensado).length;
          const faseTotal = fase.ingredientes.length;

          return (
            <div
              key={fase.id}
              className={`flex-1 rounded-lg p-3 border-2 transition-colors text-center ${
                isSigned
                  ? "bg-green-50 border-green-400"
                  : isActive
                  ? "bg-blue-50 border-blue-400"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <div className="flex items-center justify-center gap-1 mb-1">
                {isSigned ? (
                  <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : isActive ? (
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                ) : (
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                )}
                <span className={`text-xs font-semibold ${isSigned ? "text-green-700" : isActive ? "text-blue-700" : "text-gray-400"}`}>
                  Fase {idx + 1}
                </span>
              </div>
              <p className={`text-xs truncate ${isSigned ? "text-green-600" : isActive ? "text-blue-600" : "text-gray-400"}`}>
                {fase.nombre}
              </p>
              <p className={`text-xs mt-0.5 ${isSigned ? "text-green-500" : isActive ? "text-blue-500" : "text-gray-300"}`}>
                {faseCompleted}/{faseTotal} ingredientes
              </p>
            </div>
          );
        })}
      </div>

      {/* All phases completed */}
      {allCompleted ? (
        <div className="bg-green-50 border-2 border-green-300 rounded-xl p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-green-800 mb-2">Orden Completada</h2>
          <p className="text-green-600 mb-4">Todas las fases han sido dispensadas y firmadas correctamente.</p>
          <button onClick={() => router.push("/dispensado")} className="bg-green-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-800 cursor-pointer">
            Volver a Órdenes
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Completed Phases - collapsed cards */}
          {orden.fases.map((fase, idx) => {
            if (!fase.firma || idx >= currentPhaseIdx) return null;
            return (
              <div key={fase.id} className="bg-green-50 border border-green-300 rounded-xl p-4 flex items-center gap-3">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-green-800">Fase {idx + 1}: {fase.nombre}</p>
                  <p className="text-xs text-green-600">
                    {fase.ingredientes.length} ingredientes dispensados - Firmado por {fase.firma.supervisorNombre}
                  </p>
                </div>
                <span className="text-xs text-green-500">{new Date(fase.firma.timestamp).toLocaleString()}</span>
              </div>
            );
          })}

          {/* Active Phase */}
          {currentFase && (
            <>
              {/* Phase Header */}
              <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-blue-500 uppercase">Fase activa {currentPhaseIdx + 1} de {orden.fases.length}</p>
                    <h2 className="text-lg font-bold text-blue-800">{currentFase.nombre}</h2>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-blue-700">
                      {currentFase.ingredientes.filter((i) => i.dispensado).length}/{currentFase.ingredientes.length}
                    </p>
                    <p className="text-xs text-blue-500">ingredientes</p>
                  </div>
                </div>
                {currentFase.instrucciones && (
                  <div className="bg-white border border-blue-200 rounded-lg p-3 mt-3">
                    <p className="text-sm text-blue-800"><strong>Instrucciones de fase:</strong> {currentFase.instrucciones}</p>
                  </div>
                )}
              </div>

              {/* Ingredient progress bar within phase */}
              <div className="flex gap-1">
                {currentFase.ingredientes.map((ingItem, idx) => (
                  <div
                    key={ingItem.id}
                    className={`flex-1 h-2 rounded-full transition-colors ${
                      ingItem.dispensado ? "bg-green-500" : idx === currentStep ? "bg-blue-500 animate-pulse" : "bg-gray-200"
                    }`}
                  />
                ))}
              </div>

              {/* Firma form for this phase */}
              {showFirma ? (
                <div className="bg-white rounded-xl border-2 border-blue-300 p-8 max-w-md mx-auto">
                  <h2 className="text-lg font-bold text-center mb-2">Firma Electrónica del Supervisor</h2>
                  <p className="text-sm text-blue-600 text-center font-semibold mb-1">
                    Firma para fase: {currentFase.nombre}
                  </p>
                  <p className="text-sm text-gray-500 text-center mb-6">
                    Un supervisor debe firmar para confirmar el dispensado de esta fase en la orden {orden.numero}
                  </p>
                  {firmaError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
                      {firmaError}
                    </div>
                  )}
                  <form onSubmit={handleFirma} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email del Supervisor</label>
                      <input type="email" value={firmaEmail} onChange={(e) => setFirmaEmail(e.target.value)} className="w-full px-4 py-3 border rounded-lg" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                      <input type="password" value={firmaPassword} onChange={(e) => setFirmaPassword(e.target.value)} className="w-full px-4 py-3 border rounded-lg" required />
                    </div>
                    <button type="submit" disabled={firmaLoading} className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 cursor-pointer disabled:bg-blue-400 disabled:cursor-wait">
                      {firmaLoading ? "Firmando..." : "Firmar y Aprobar Fase"}
                    </button>
                  </form>
                </div>
              ) : ing ? (
                <>
                  {/* Current Step Info */}
                  <div className={`rounded-xl border-2 p-6 ${ing.peligroso ? "border-red-400 bg-red-50" : "border-blue-200 bg-white"}`}>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase">Paso {currentStep + 1} de {currentFase.ingredientes.length}</p>
                        <h2 className="text-2xl font-bold mt-1">{ing.materialNombre}</h2>
                        <p className="text-sm text-gray-500 font-mono">Código: {ing.materialCodigo}</p>
                      </div>
                      {ing.peligroso && (
                        <div className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                          <span className="font-bold text-sm">MATERIAL PELIGROSO</span>
                        </div>
                      )}
                    </div>

                    {ing.instrucciones && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                        <p className="text-sm text-blue-800"><strong>Instrucciones:</strong> {ing.instrucciones}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500">Mínimo</p>
                        <p className="text-lg font-bold text-red-600">{min.toFixed(3)} {ing.materialUnidad}</p>
                        <p className="text-xs text-gray-400">{ing.toleranciaMin}%</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-3 border-2 border-green-300">
                        <p className="text-xs text-gray-500">Target</p>
                        <p className="text-2xl font-bold text-green-700">{target.toFixed(3)} {ing.materialUnidad}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500">Máximo</p>
                        <p className="text-lg font-bold text-red-600">{max.toFixed(3)} {ing.materialUnidad}</p>
                        <p className="text-xs text-gray-400">+{ing.toleranciaMax}%</p>
                      </div>
                    </div>
                  </div>

                  {/* Scan Phase */}
                  {phase === "scan" && (
                    <div className="bg-white rounded-xl border p-6">
                      <BarcodeInput
                        onScan={handleScan}
                        label="Escanear código de barras del lote"
                        placeholder="Escanea el contenedor del material..."
                      />
                      {scanResult && (
                        <div className={`mt-4 px-4 py-3 rounded-lg text-sm ${
                          scanResult.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
                        }`}>
                          {scanResult.msg}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Weigh Phase */}
                  {phase === "weigh" && (
                    <div className="bg-white rounded-xl border p-6 space-y-4">
                      <h3 className="font-semibold text-lg">Registro de Peso</h3>

                      {/* Semáforo de peso */}
                      <div className={`${status.bg} border-2 ${status.border} rounded-xl p-6 text-center transition-colors`}>
                        <p className="text-xs font-semibold uppercase mb-2">{status.label}</p>
                        <div className="flex items-center justify-center gap-4 mb-4">
                          <input
                            type="number"
                            step="0.001"
                            value={peso}
                            onChange={(e) => handlePesoChange(e.target.value)}
                            className={`text-5xl font-bold text-center w-64 bg-transparent border-b-4 ${status.border} ${status.text} focus:outline-none`}
                            placeholder="0.000"
                            autoFocus
                          />
                          <span className="text-2xl text-gray-500">{ing.materialUnidad}</span>
                        </div>

                        {/* Progress bar visual */}
                        {peso && (
                          <div className="max-w-md mx-auto">
                            <div className="relative h-6 bg-gray-200 rounded-full overflow-hidden">
                              {/* Rojo bajo · verde (tolerancia, tercio central) · rojo alto */}
                              <div className="absolute left-0 top-0 h-full bg-red-300" style={{ width: `${BARRA_VERDE_INICIO}%` }} />
                              <div className="absolute top-0 h-full bg-green-400" style={{ left: `${BARRA_VERDE_INICIO}%`, width: `${BARRA_VERDE_FIN - BARRA_VERDE_INICIO}%` }} />
                              <div className="absolute right-0 top-0 h-full bg-red-300" style={{ width: `${100 - BARRA_VERDE_FIN}%` }} />
                              {/* Marker for current weight */}
                              <div
                                className="absolute top-0 h-full w-1 bg-black transition-all"
                                style={{ left: `${Number.isFinite(parseFloat(peso)) ? posicionEnBarra(parseFloat(peso), ing.rango) : 0}%` }}
                              />
                            </div>
                            <div className="relative h-4 text-xs text-gray-500 mt-1">
                              <span className="absolute -translate-x-1/2" style={{ left: `${BARRA_VERDE_INICIO}%` }}>{min.toFixed(3)}</span>
                              <span className="absolute -translate-x-1/2 font-bold" style={{ left: "50%" }}>{target.toFixed(3)}</span>
                              <span className="absolute -translate-x-1/2" style={{ left: `${BARRA_VERDE_FIN}%` }}>{max.toFixed(3)}</span>
                            </div>
                          </div>
                        )}

                        {/* Semáforo visual */}
                        <div className="flex justify-center gap-3 mt-4">
                          <div className={`w-8 h-8 rounded-full border-2 ${pesoStatus === "low" || pesoStatus === "high" ? "bg-red-500 border-red-600 shadow-lg shadow-red-300" : "bg-red-200 border-red-300"}`} />
                          <div className={`w-8 h-8 rounded-full border-2 ${pesoStatus === "warning" ? "bg-yellow-500 border-yellow-600 shadow-lg shadow-yellow-300" : "bg-yellow-200 border-yellow-300"}`} />
                          <div className={`w-8 h-8 rounded-full border-2 ${pesoStatus === "ok" ? "bg-green-500 border-green-600 shadow-lg shadow-green-300" : "bg-green-200 border-green-300"}`} />
                        </div>
                      </div>

                      {(pesoStatus === "low" || pesoStatus === "high") && (
                        <div className="bg-red-100 border-2 border-red-400 rounded-lg p-4 flex items-center gap-3">
                          <svg className="w-8 h-8 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                          <div>
                            <p className="font-bold text-red-800 text-lg">FUERA DE TOLERANCIA - NO PERMITIDO</p>
                            <p className="text-red-600 text-sm">
                              {pesoStatus === "low"
                                ? `El peso es menor al mínimo permitido (${min.toFixed(3)} ${ing.materialUnidad}). Agregue más material.`
                                : `El peso excede el máximo permitido (${max.toFixed(3)} ${ing.materialUnidad}). Retire material.`}
                            </p>
                          </div>
                        </div>
                      )}

                      {registroError && (
                        <div role="alert" className="mb-4 p-3 rounded-lg border-2 border-red-500 bg-red-50 text-red-700 text-sm font-medium">
                          {registroError}
                        </div>
                      )}

                      <button
                        onClick={handleConfirmPeso}
                        disabled={!peso || pesoStatus === "none" || pesoStatus === "low" || pesoStatus === "high" || registrando}
                        className={`w-full py-4 rounded-lg font-bold text-lg transition-colors cursor-pointer ${
                          pesoStatus === "ok"
                            ? "bg-green-600 text-white hover:bg-green-700"
                            : pesoStatus === "warning"
                            ? "bg-yellow-500 text-white hover:bg-yellow-600"
                            : "bg-gray-300 text-gray-500 cursor-not-allowed"
                        } disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed`}
                      >
                        {registrando
                          ? "Registrando..."
                          : pesoStatus === "ok"
                          ? "Confirmar Peso"
                          : pesoStatus === "warning"
                          ? "Confirmar con Precaución"
                          : pesoStatus === "low" || pesoStatus === "high"
                          ? "BLOQUEADO - Ajuste el peso dentro de tolerancia"
                          : "Ingresa el peso"}
                      </button>
                    </div>
                  )}

                  {/* Steps Summary for current phase */}
                  <div className="bg-white rounded-xl border p-4">
                    <h3 className="font-semibold text-sm text-gray-700 mb-3">Ingredientes de esta fase</h3>
                    <div className="space-y-2">
                      {currentFase.ingredientes.map((step, idx) => (
                        <div
                          key={step.id}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                            idx === currentStep ? "bg-blue-50 border border-blue-200" : step.dispensado ? "bg-green-50" : "bg-gray-50"
                          }`}
                        >
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            step.dispensado ? "bg-green-500 text-white" : idx === currentStep ? "bg-blue-500 text-white" : "bg-gray-300 text-white"
                          }`}>
                            {step.dispensado ? "\u2713" : idx + 1}
                          </div>
                          <span className={step.dispensado ? "text-green-700" : "text-gray-600"}>
                            {step.materialNombre}
                          </span>
                          <span className="text-gray-400 ml-auto">
                            {step.dispensado && step.dispensadoReal !== undefined
                              ? `${step.dispensadoReal} ${step.materialUnidad}`
                              : `${step.rango.target.toFixed(3)} ${step.materialUnidad}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </>
          )}

          {/* Future Phases */}
          {orden.fases.map((fase, idx) => {
            if (idx <= currentPhaseIdx) return null;
            return (
              <div key={fase.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center gap-3 opacity-60">
                <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-500">Fase {idx + 1}: {fase.nombre}</p>
                  <p className="text-xs text-gray-400">{fase.ingredientes.length} ingredientes - Pendiente</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
