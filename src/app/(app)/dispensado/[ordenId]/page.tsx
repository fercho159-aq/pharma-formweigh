"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import BarcodeInput from "@/components/barcode-input";

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
}

interface OrdenDetalle {
  id: string;
  numero: string;
  recetaNombre: string;
  loteProducto: string;
  cantidad: number;
  estado: string;
  ingredientes: Ingrediente[];
}

export default function DispensadoOrdenPage({ params }: { params: Promise<{ ordenId: string }> }) {
  const { ordenId } = use(params);
  const router = useRouter();
  const [orden, setOrden] = useState<OrdenDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);

  // Step states
  const [phase, setPhase] = useState<"scan" | "weigh" | "confirm" | "done">("scan");
  const [scanResult, setScanResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [scannedLoteId, setScannedLoteId] = useState("");
  const [peso, setPeso] = useState("");
  const [pesoStatus, setPesoStatus] = useState<"none" | "low" | "ok" | "warning" | "high">("none");

  // Firma
  const [showFirma, setShowFirma] = useState(false);
  const [firmaEmail, setFirmaEmail] = useState("");
  const [firmaPassword, setFirmaPassword] = useState("");
  const [firmaError, setFirmaError] = useState("");

  useEffect(() => { loadOrden(); }, [ordenId]);

  async function loadOrden() {
    setLoading(true);
    const res = await fetch(`/api/dispensado/${ordenId}`);
    if (res.ok) {
      const data = await res.json();
      setOrden(data);
      // Find first non-dispensed step
      const nextStep = data.ingredientes.findIndex((i: Ingrediente) => !i.dispensado);
      if (nextStep >= 0) {
        setCurrentStep(nextStep);
        setPhase("scan");
      } else {
        setPhase("done");
      }
    }
    setLoading(false);
  }

  function getCurrentIngrediente(): Ingrediente | null {
    if (!orden || currentStep >= orden.ingredientes.length) return null;
    return orden.ingredientes[currentStep];
  }

  async function handleScan(code: string) {
    const ing = getCurrentIngrediente();
    if (!ing || !orden) return;

    const res = await fetch(`/api/dispensado/validar-lote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        codigoLote: code,
        materialId: ing.materialId,
        cantidadRequerida: ing.cantidadTarget * orden.cantidad,
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
    const target = ing.cantidadTarget * orden.cantidad;
    const min = target * (1 + ing.toleranciaMin / 100);
    const max = target * (1 + ing.toleranciaMax / 100);
    const warningRange = (max - min) * 0.1; // 10% of range for warning zone

    if (pesoNum < min) setPesoStatus("low");
    else if (pesoNum > max) setPesoStatus("high");
    else if (pesoNum < min + warningRange || pesoNum > max - warningRange) setPesoStatus("warning");
    else setPesoStatus("ok");
  }

  async function handleConfirmPeso() {
    const ing = getCurrentIngrediente();
    if (!ing || !orden || !peso) return;

    const target = ing.cantidadTarget * orden.cantidad;
    const min = target * (1 + ing.toleranciaMin / 100);
    const max = target * (1 + ing.toleranciaMax / 100);
    const pesoNum = parseFloat(peso);
    const toleranciaOk = pesoNum >= min && pesoNum <= max;

    const res = await fetch(`/api/dispensado/registrar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ordenId: orden.id,
        loteId: scannedLoteId,
        cantidadTarget: target,
        cantidadReal: pesoNum,
        toleranciaOk,
        paso: ing.orden,
        materialNombre: ing.materialNombre,
      }),
    });

    if (res.ok) {
      // Move to next step
      const nextStep = currentStep + 1;
      if (nextStep < orden.ingredientes.length) {
        setCurrentStep(nextStep);
        setPhase("scan");
        setPeso("");
        setPesoStatus("none");
        setScanResult(null);
        setScannedLoteId("");
        // Reload to get updated dispensado status
        loadOrden();
      } else {
        setPhase("done");
        setShowFirma(true);
        loadOrden();
      }
    }
  }

  async function handleFirma(e: React.FormEvent) {
    e.preventDefault();
    setFirmaError("");

    const res = await fetch(`/api/dispensado/firmar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ordenId: orden?.id,
        email: firmaEmail,
        password: firmaPassword,
      }),
    });

    const data = await res.json();
    if (data.ok) {
      router.push("/dispensado");
    } else {
      setFirmaError(data.error || "Error al firmar");
    }
  }

  if (loading) return <div className="text-center py-12 text-gray-400">Cargando orden...</div>;
  if (!orden) return <div className="text-center py-12 text-red-500">Orden no encontrada</div>;

  const ing = getCurrentIngrediente();
  const target = ing ? ing.cantidadTarget * orden.cantidad : 0;
  const min = ing ? target * (1 + ing.toleranciaMin / 100) : 0;
  const max = ing ? target * (1 + ing.toleranciaMax / 100) : 0;
  const completedSteps = orden.ingredientes.filter((i) => i.dispensado).length;

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
          <p className="text-2xl font-bold text-blue-700">{completedSteps}/{orden.ingredientes.length}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex gap-1 mb-6">
        {orden.ingredientes.map((ing, idx) => (
          <div
            key={ing.id}
            className={`flex-1 h-2 rounded-full transition-colors ${
              ing.dispensado ? "bg-green-500" : idx === currentStep ? "bg-blue-500 animate-pulse" : "bg-gray-200"
            }`}
          />
        ))}
      </div>

      {phase === "done" && !showFirma ? (
        <div className="bg-green-50 border-2 border-green-300 rounded-xl p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-green-800 mb-2">Dispensado Completado</h2>
          <p className="text-green-600 mb-4">Todos los materiales han sido dispensados correctamente.</p>
          <button onClick={() => setShowFirma(true)} className="bg-green-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-800 cursor-pointer">
            Firmar y Cerrar Orden
          </button>
        </div>
      ) : showFirma ? (
        <div className="bg-white rounded-xl border-2 border-blue-300 p-8 max-w-md mx-auto">
          <h2 className="text-lg font-bold text-center mb-4">Firma Electrónica del Supervisor</h2>
          <p className="text-sm text-gray-500 text-center mb-6">
            Un supervisor debe firmar para confirmar el dispensado completo de la orden {orden.numero}
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
            <button type="submit" className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold hover:bg-blue-800 cursor-pointer">
              Firmar y Aprobar
            </button>
          </form>
        </div>
      ) : ing ? (
        <div className="space-y-4">
          {/* Current Step Info */}
          <div className={`rounded-xl border-2 p-6 ${ing.peligroso ? "border-red-400 bg-red-50" : "border-blue-200 bg-white"}`}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Paso {currentStep + 1} de {orden.ingredientes.length}</p>
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
                      {/* Red zone low */}
                      <div className="absolute left-0 top-0 h-full bg-red-300" style={{ width: `${(min / max) * 100}%` }} />
                      {/* Green zone */}
                      <div className="absolute top-0 h-full bg-green-400" style={{ left: `${(min / max) * 100}%`, width: `${((max - min) / max) * 100}%` }} />
                      {/* Marker for current weight */}
                      <div
                        className="absolute top-0 h-full w-1 bg-black transition-all"
                        style={{ left: `${Math.min(Math.max((parseFloat(peso) / (max * 1.1)) * 100, 0), 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>0</span>
                      <span>{min.toFixed(2)}</span>
                      <span className="font-bold">{target.toFixed(2)}</span>
                      <span>{max.toFixed(2)}</span>
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

              <button
                onClick={handleConfirmPeso}
                disabled={!peso || pesoStatus === "none" || pesoStatus === "low" || pesoStatus === "high"}
                className={`w-full py-4 rounded-lg font-bold text-lg transition-colors cursor-pointer ${
                  pesoStatus === "ok"
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : pesoStatus === "warning"
                    ? "bg-yellow-500 text-white hover:bg-yellow-600"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                } disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed`}
              >
                {pesoStatus === "ok"
                  ? "Confirmar Peso"
                  : pesoStatus === "warning"
                  ? "Confirmar con Precaución"
                  : pesoStatus === "low" || pesoStatus === "high"
                  ? "BLOQUEADO - Ajuste el peso dentro de tolerancia"
                  : "Ingresa el peso"}
              </button>
            </div>
          )}

          {/* Steps Summary */}
          <div className="bg-white rounded-xl border p-4">
            <h3 className="font-semibold text-sm text-gray-700 mb-3">Resumen de pasos</h3>
            <div className="space-y-2">
              {orden.ingredientes.map((step, idx) => (
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
                      : `${(step.cantidadTarget * orden.cantidad).toFixed(3)} ${step.materialUnidad}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
