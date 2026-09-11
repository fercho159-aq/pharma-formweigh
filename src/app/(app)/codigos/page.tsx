"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Lote {
  id: string;
  numero: string;
  materialNombre: string;
  materialCodigo: string;
  cantidad: number;
  unidad: string;
  estado: string;
  proveedor: string;
}

interface Material {
  id: string;
  codigo: string;
  nombre: string;
  unidad: string;
}

export default function CodigosPage() {
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"lotes" | "materiales" | "badges">("lotes");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [lotRes, matRes] = await Promise.all([
      fetch("/api/inventario/lotes"),
      fetch("/api/inventario/materiales"),
    ]);
    const lotData = await lotRes.json();
    const matData = await matRes.json();
    setLotes(lotData);
    setMateriales(matData);
    setLoading(false);
  }

  const badges = [
    { codigo: "BADGE-ADMIN-001", nombre: "Administrador", rol: "ADMIN" },
    { codigo: "BADGE-SUP-001", nombre: "Supervisor García", rol: "SUPERVISOR" },
    { codigo: "BADGE-OP-001", nombre: "Operario López", rol: "OPERARIO" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Códigos de Barras</h1>
        <p className="text-gray-500">Genera e imprime códigos de barras para escaneo con cámara o pistola</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { key: "lotes" as const, label: "Lotes", count: lotes.length },
          { key: "materiales" as const, label: "Materiales", count: materiales.length },
          { key: "badges" as const, label: "Badges", count: badges.length },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
              tab === t.key ? "bg-blue-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tab === "lotes" &&
            lotes.map((lote) => (
              <BarcodeCard
                key={lote.id}
                code={lote.numero}
                title={lote.materialNombre || "Material"}
                subtitle={`${lote.cantidad} ${lote.unidad} | ${lote.proveedor}`}
                badge={lote.estado}
                badgeColor={lote.estado === "APROBADO" ? "green" : lote.estado === "CUARENTENA" ? "yellow" : "red"}
              />
            ))}
          {tab === "materiales" &&
            materiales.map((mat) => (
              <BarcodeCard
                key={mat.id}
                code={mat.codigo}
                title={mat.nombre}
                subtitle={`Unidad: ${mat.unidad}`}
              />
            ))}
          {tab === "badges" &&
            badges.map((b) => (
              <BarcodeCard
                key={b.codigo}
                code={b.codigo}
                title={b.nombre}
                subtitle={`Rol: ${b.rol}`}
                badge={b.rol}
                badgeColor={b.rol === "ADMIN" ? "red" : b.rol === "SUPERVISOR" ? "blue" : "gray"}
              />
            ))}
        </div>
      )}

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="font-semibold text-blue-800 text-sm mb-2">Cómo usar</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>1. Abre esta página en tu celular o imprime los códigos</li>
          <li>2. En la pantalla de dispensado, toca el botón de cámara</li>
          <li>3. Apunta la cámara al código de barras que quieras escanear</li>
          <li>4. El código se captura automáticamente</li>
        </ul>
      </div>
    </div>
  );
}

function BarcodeCard({
  code,
  title,
  subtitle,
  badge,
  badgeColor = "gray",
}: {
  code: string;
  title: string;
  subtitle: string;
  badge?: string;
  badgeColor?: "green" | "yellow" | "red" | "blue" | "gray";
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [barcodeReady, setBarcodeReady] = useState(false);

  const renderBarcode = useCallback(async () => {
    if (!svgRef.current) return;
    try {
      const JsBarcode = (await import("jsbarcode")).default;
      JsBarcode(svgRef.current, code, {
        format: "CODE128",
        width: 2,
        height: 60,
        displayValue: true,
        fontSize: 14,
        font: "monospace",
        margin: 10,
        background: "#ffffff",
      });
      setBarcodeReady(true);
    } catch {
      // fallback: show code as text
      setBarcodeReady(false);
    }
  }, [code]);

  useEffect(() => {
    renderBarcode();
  }, [renderBarcode]);

  const colors = {
    green: "bg-green-100 text-green-700",
    yellow: "bg-yellow-100 text-yellow-700",
    red: "bg-red-100 text-red-700",
    blue: "bg-blue-100 text-blue-700",
    gray: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="bg-white rounded-xl border p-4 print:border-black print:shadow-none">
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="font-semibold text-sm text-gray-900">{title}</p>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
        {badge && (
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[badgeColor]}`}>
            {badge}
          </span>
        )}
      </div>
      <div className="flex justify-center bg-white rounded-lg py-2">
        <svg ref={svgRef} />
        {!barcodeReady && (
          <div className="text-center py-4">
            <p className="font-mono text-lg font-bold">{code}</p>
          </div>
        )}
      </div>
    </div>
  );
}
