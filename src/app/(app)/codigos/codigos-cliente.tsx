"use client";

import { useState, useEffect, useRef } from "react";

import { tienePermiso } from "@/lib/auth/permisos";

interface Lote {
  id: string;
  numero: string;
  materialNombre: string;
  cantidad: number;
  /** El listado de lotes no trae la unidad del material; se omite si no viene. */
  unidad?: string;
  estado: string;
  proveedor: string;
}

interface Material {
  id: string;
  codigo: string;
  nombre: string;
  unidad: string;
}

interface UsuarioGafete {
  id: string;
  nombre: string;
  rol: string;
  badge: string | null;
  activo: boolean;
}

const colorDeRol: Record<string, "green" | "yellow" | "red" | "blue" | "gray"> = {
  ADMIN: "red",
  SUPERVISOR: "blue",
  DESARROLLO: "blue",
  CALIDAD: "yellow",
  ALMACEN: "green",
};

export default function CodigosCliente({ rol }: { rol: string }) {
  const puedeVerUsuarios = tienePermiso(rol, "usuarios.ver");
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [gafetes, setGafetes] = useState<UsuarioGafete[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"lotes" | "materiales" | "badges">("lotes");

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      const respuestas = await Promise.all([
        fetch("/api/inventario/lotes"),
        fetch("/api/inventario/materiales"),
        ...(puedeVerUsuarios ? [fetch("/api/usuarios")] : []),
      ]);
      const [lotData, matData, usrData] = await Promise.all(respuestas.map((r) => r.json().catch(() => null)));
      if (cancelado) return;
      if (Array.isArray(lotData)) setLotes(lotData);
      if (Array.isArray(matData)) setMateriales(matData);
      // Solo los usuarios activos con gafete asignado tienen código que imprimir.
      if (Array.isArray(usrData)) setGafetes(usrData.filter((u: UsuarioGafete) => u.activo && u.badge));
      if (!Array.isArray(lotData) || !Array.isArray(matData)) {
        setError(lotData?.error || matData?.error || "No se pudieron cargar los códigos");
      }
      setLoading(false);
    }
    cargar();
    return () => { cancelado = true; };
  }, [puedeVerUsuarios]);

  const tabs = [
    { key: "lotes" as const, label: "Lotes", count: lotes.length },
    { key: "materiales" as const, label: "Materiales", count: materiales.length },
    ...(puedeVerUsuarios ? [{ key: "badges" as const, label: "Gafetes", count: gafetes.length }] : []),
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Códigos de Barras</h1>
        <p className="text-gray-500">Genera e imprime códigos de barras para escaneo con cámara o pistola</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map((t) => (
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
                subtitle={[`${lote.cantidad}${lote.unidad ? ` ${lote.unidad}` : ""}`, lote.proveedor].filter(Boolean).join(" | ")}
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
          {tab === "badges" && puedeVerUsuarios &&
            gafetes.map((u) => (
              <BarcodeCard
                key={u.id}
                code={u.badge!}
                title={u.nombre}
                subtitle={`Rol: ${u.rol}`}
                badge={u.rol}
                badgeColor={colorDeRol[u.rol] ?? "gray"}
              />
            ))}
          {tab === "badges" && puedeVerUsuarios && gafetes.length === 0 && (
            <p className="text-gray-400 text-sm">Ningún usuario activo tiene gafete asignado.</p>
          )}
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
  const respaldoRef = useRef<HTMLDivElement>(null);

  // Pintar el SVG es sincronizar con el DOM, no estado de React: si jsbarcode no
  // carga, se muestra el código en texto.
  useEffect(() => {
    let cancelado = false;
    const svg = svgRef.current;
    if (!svg) return;
    (async () => {
      try {
        const JsBarcode = (await import("jsbarcode")).default;
        if (cancelado) return;
        JsBarcode(svg, code, {
          format: "CODE128",
          width: 2,
          height: 60,
          displayValue: true,
          fontSize: 14,
          font: "monospace",
          margin: 10,
          background: "#ffffff",
        });
      } catch {
        if (!cancelado && respaldoRef.current) respaldoRef.current.hidden = false;
      }
    })();
    return () => { cancelado = true; };
  }, [code]);

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
        <div ref={respaldoRef} hidden className="text-center py-4">
          <p className="font-mono text-lg font-bold">{code}</p>
        </div>
      </div>
    </div>
  );
}
