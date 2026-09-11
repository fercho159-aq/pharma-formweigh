import { getSession } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import Link from "next/link";

export default async function DashboardPage() {
  const user = await getSession();

  const ordenesPendientes = await queryOne("SELECT COUNT(*) as c FROM ordenes_produccion WHERE estado = 'PENDIENTE'") as { c: string };
  const ordenesEnProceso = await queryOne("SELECT COUNT(*) as c FROM ordenes_produccion WHERE estado = 'EN_PROCESO'") as { c: string };
  const ordenesCompletadas = await queryOne("SELECT COUNT(*) as c FROM ordenes_produccion WHERE estado IN ('DISPENSADO', 'COMPLETADA')") as { c: string };
  const totalMateriales = await queryOne("SELECT COUNT(*) as c FROM materiales WHERE activo = true") as { c: string };
  const lotesCuarentena = await queryOne("SELECT COUNT(*) as c FROM lotes WHERE estado = 'CUARENTENA'") as { c: string };
  const lotesPorCaducar = await queryOne(`SELECT COUNT(*) as c FROM lotes WHERE estado = 'APROBADO' AND "fechaCaducidad" <= now() + interval '30 days'`) as { c: string };
  const recetasActivas = await queryOne("SELECT COUNT(*) as c FROM recetas WHERE activa = true") as { c: string };
  const dispensadosHoy = await queryOne("SELECT COUNT(*) as c FROM dispensados WHERE date(timestamp) = CURRENT_DATE") as { c: string };

  // Active processes with phase info
  const procesosActivos = await query(`
    SELECT op.id, op.numero, op.estado, op."loteProducto", op."createdAt", op."recetaId",
      r.nombre as "recetaNombre"
    FROM ordenes_produccion op
    JOIN recetas r ON op."recetaId" = r.id
    WHERE op.estado IN ('EN_PROCESO', 'PENDIENTE')
    ORDER BY
      CASE op.estado WHEN 'EN_PROCESO' THEN 0 ELSE 1 END,
      op.prioridad DESC, op."createdAt" ASC
    LIMIT 6
  `) as Array<{ id: string; numero: string; estado: string; loteProducto: string; createdAt: string; recetaId: string; recetaNombre: string }>;

  // Get fases and firmas for active processes
  const recetaIds = [...new Set(procesosActivos.map((p) => p.recetaId))];
  const ordenIds = procesosActivos.map((p) => p.id);

  let fasesMap: Record<string, Array<{ id: string; nombre: string; orden: number }>> = {};
  let firmasMap: Record<string, Set<string>> = {};

  if (recetaIds.length > 0) {
    const placeholders = recetaIds.map((_, i) => `$${i + 1}`).join(",");
    const fases = await query(
      `SELECT id, "recetaId", nombre, orden FROM fases WHERE "recetaId" IN (${placeholders}) ORDER BY orden`,
      recetaIds
    ) as Array<{ id: string; recetaId: string; nombre: string; orden: number }>;
    for (const f of fases) {
      if (!fasesMap[f.recetaId]) fasesMap[f.recetaId] = [];
      fasesMap[f.recetaId].push({ id: f.id, nombre: f.nombre, orden: f.orden });
    }
  }

  if (ordenIds.length > 0) {
    const placeholders = ordenIds.map((_, i) => `$${i + 1}`).join(",");
    const firmas = await query(
      `SELECT "ordenId", "faseId" FROM firmas_fase WHERE "ordenId" IN (${placeholders})`,
      ordenIds
    ) as Array<{ ordenId: string; faseId: string }>;
    for (const f of firmas) {
      if (!firmasMap[f.ordenId]) firmasMap[f.ordenId] = new Set();
      firmasMap[f.ordenId].add(f.faseId);
    }
  }

  // Build enriched active processes
  const procesosEnriquecidos = procesosActivos.map((p) => {
    const fases = fasesMap[p.recetaId] || [];
    const firmas = firmasMap[p.id] || new Set<string>();
    const numFases = fases.length;
    const numFirmadas = fases.filter((f) => firmas.has(f.id)).length;

    // Determine current phase (first unsigned)
    const currentFase = fases.find((f) => !firmas.has(f.id));
    const currentFaseLabel = currentFase
      ? `Fase ${currentFase.orden}/${numFases}: ${currentFase.nombre}`
      : numFases > 0 ? "Todas las fases firmadas" : "Sin fases";

    const progressPercent = numFases > 0 ? Math.round((numFirmadas / numFases) * 100) : 0;

    return { ...p, numFases, numFirmadas, currentFaseLabel, progressPercent };
  });

  // Recent orders with phase info
  const ultimasOrdenes = await query(`
    SELECT op.id, op.numero, op.estado, op."loteProducto", op."createdAt", op."recetaId",
      r.nombre as "recetaNombre"
    FROM ordenes_produccion op
    JOIN recetas r ON op."recetaId" = r.id
    ORDER BY op."createdAt" DESC LIMIT 5
  `) as Array<{ id: string; numero: string; recetaNombre: string; estado: string; createdAt: string; loteProducto: string; recetaId: string }>;

  // Enrich recent orders with phase info too
  const recentRecetaIds = [...new Set(ultimasOrdenes.map((o) => o.recetaId))];
  const recentOrdenIds = ultimasOrdenes.map((o) => o.id);

  if (recentRecetaIds.length > 0) {
    const placeholders = recentRecetaIds.map((_, i) => `$${i + 1}`).join(",");
    const fases = await query(
      `SELECT id, "recetaId", nombre, orden FROM fases WHERE "recetaId" IN (${placeholders}) ORDER BY orden`,
      recentRecetaIds
    ) as Array<{ id: string; recetaId: string; nombre: string; orden: number }>;
    for (const f of fases) {
      if (!fasesMap[f.recetaId]) fasesMap[f.recetaId] = [];
      // Avoid duplicates
      if (!fasesMap[f.recetaId].some((x) => x.id === f.id)) {
        fasesMap[f.recetaId].push({ id: f.id, nombre: f.nombre, orden: f.orden });
      }
    }
  }

  if (recentOrdenIds.length > 0) {
    const placeholders = recentOrdenIds.map((_, i) => `$${i + 1}`).join(",");
    const firmas = await query(
      `SELECT "ordenId", "faseId" FROM firmas_fase WHERE "ordenId" IN (${placeholders})`,
      recentOrdenIds
    ) as Array<{ ordenId: string; faseId: string }>;
    for (const f of firmas) {
      if (!firmasMap[f.ordenId]) firmasMap[f.ordenId] = new Set();
      firmasMap[f.ordenId].add(f.faseId);
    }
  }

  const ultimasOrdenesEnriquecidas = ultimasOrdenes.map((o) => {
    const fases = fasesMap[o.recetaId] || [];
    const firmas = firmasMap[o.id] || new Set<string>();
    const numFases = fases.length;
    const numFirmadas = fases.filter((f) => firmas.has(f.id)).length;
    const currentFase = fases.find((f) => !firmas.has(f.id));
    const currentFaseLabel = currentFase
      ? `Fase ${currentFase.orden}/${numFases}: ${currentFase.nombre}`
      : numFases > 0 ? "Completado" : "";
    return { ...o, numFases, numFirmadas, currentFaseLabel };
  });

  const ultimaAuditoria = await query(`
    SELECT a.*, u.nombre as "usuarioNombre"
    FROM auditoria a
    JOIN usuarios u ON a."usuarioId" = u.id
    ORDER BY a.timestamp DESC LIMIT 8
  `) as Array<{ id: string; accion: string; entidad: string; usuarioNombre: string; timestamp: string }>;

  const estadoColor: Record<string, string> = {
    PENDIENTE: "bg-yellow-100 text-yellow-800",
    EN_PROCESO: "bg-blue-100 text-blue-800",
    DISPENSADO: "bg-green-100 text-green-800",
    COMPLETADA: "bg-green-200 text-green-900",
    CANCELADA: "bg-red-100 text-red-800",
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Bienvenido, {user?.nombre} ({user?.rol})</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Link href="/ordenes" className="bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500">Ordenes Pendientes</p>
              <p className="text-3xl font-bold text-yellow-600 mt-1">{ordenesPendientes.c}</p>
            </div>
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </Link>

        <Link href="/ordenes" className="bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500">En Proceso</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">{ordenesEnProceso.c}</p>
            </div>
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
        </Link>

        <Link href="/dispensado" className="bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500">Dispensados Hoy</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{dispensadosHoy.c}</p>
            </div>
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </Link>

        <Link href="/inventario" className="bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500">Lotes en Cuarentena</p>
              <p className="text-3xl font-bold text-orange-600 mt-1">{lotesCuarentena.c}</p>
            </div>
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          </div>
        </Link>
      </div>

      {/* Second row of KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <p className="text-sm text-gray-500">Materiales</p>
          <p className="text-2xl font-bold mt-1">{totalMateriales.c}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <p className="text-sm text-gray-500">Recetas Activas</p>
          <p className="text-2xl font-bold mt-1">{recetasActivas.c}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <p className="text-sm text-gray-500">Completadas</p>
          <p className="text-2xl font-bold mt-1">{ordenesCompletadas.c}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <p className="text-sm text-gray-500 text-orange-600">Por Caducar (30 dias)</p>
          <p className="text-2xl font-bold text-orange-600 mt-1">{lotesPorCaducar.c}</p>
        </div>
      </div>

      {/* Active Processes Section */}
      {procesosEnriquecidos.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border mb-6">
          <div className="p-4 border-b flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse" />
              <h2 className="font-semibold text-gray-900">Procesos Activos</h2>
            </div>
            <Link href="/dispensado" className="text-sm text-blue-600 hover:underline">Ver todos</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {procesosEnriquecidos.map((p) => (
              <Link
                key={p.id}
                href={`/dispensado/${p.id}`}
                className={`rounded-xl border p-4 hover:shadow-md transition-all ${
                  p.estado === "EN_PROCESO" ? "border-blue-200 bg-blue-50/30" : "border-gray-200 bg-gray-50/30"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-mono font-bold text-blue-700">{p.numero}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${estadoColor[p.estado]}`}>
                    {p.estado === "EN_PROCESO" ? "En Proceso" : "Pendiente"}
                  </span>
                </div>
                <p className="text-sm font-semibold text-gray-900 mb-1">{p.recetaNombre}</p>
                <p className="text-xs text-gray-500 mb-3">Lote: {p.loteProducto}</p>

                {/* Current phase indicator */}
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-xs font-medium text-blue-700">{p.currentFaseLabel}</span>
                </div>

                {/* Phase progress bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className={`rounded-full h-2 transition-all ${p.progressPercent === 100 ? "bg-green-500" : "bg-blue-500"}`}
                      style={{ width: `${Math.max(p.progressPercent, 4)}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-gray-600">{p.progressPercent}%</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-4 border-b flex justify-between items-center">
            <h2 className="font-semibold text-gray-900">Ultimas Ordenes</h2>
            <Link href="/ordenes" className="text-sm text-blue-600 hover:underline">Ver todas</Link>
          </div>
          <div className="divide-y">
            {ultimasOrdenesEnriquecidas.length === 0 ? (
              <p className="p-4 text-gray-400 text-sm">No hay ordenes registradas</p>
            ) : (
              ultimasOrdenesEnriquecidas.map((o) => (
                <Link key={o.id} href={`/dispensado/${o.id}`} className="flex items-center justify-between p-4 hover:bg-gray-50 gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-medium text-sm">{o.numero}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${estadoColor[o.estado] || "bg-gray-100"}`}>
                        {o.estado.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">{o.recetaNombre} - Lote: {o.loteProducto}</p>
                    {o.currentFaseLabel && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className="flex gap-0.5">
                          {Array.from({ length: o.numFases }).map((_, i) => (
                            <div
                              key={i}
                              className={`w-2 h-2 rounded-full ${
                                i < o.numFirmadas ? "bg-green-500" : "bg-gray-300"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-gray-400">{o.currentFaseLabel}</span>
                      </div>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent Audit */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-4 border-b flex justify-between items-center">
            <h2 className="font-semibold text-gray-900">Actividad Reciente</h2>
            <Link href="/auditoria" className="text-sm text-blue-600 hover:underline">Ver todo</Link>
          </div>
          <div className="divide-y">
            {ultimaAuditoria.length === 0 ? (
              <p className="p-4 text-gray-400 text-sm">No hay actividad registrada</p>
            ) : (
              ultimaAuditoria.map((a) => (
                <div key={a.id} className="p-4">
                  <div className="flex justify-between">
                    <p className="text-sm font-medium">{a.accion}</p>
                    <p className="text-xs text-gray-400">{new Date(a.timestamp).toLocaleString("es-MX")}</p>
                  </div>
                  <p className="text-xs text-gray-500">{a.usuarioNombre} - {a.entidad}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
