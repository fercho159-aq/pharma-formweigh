/**
 * Prueba de punta a punta del flujo de dispensado contra un servidor en marcha y una BD
 * DESECHABLE recién sembrada con `PHARMA_DEMO_PASSWORD` (ver docs/OPERACION.md §Pruebas).
 *   E2E_URL=http://localhost:3100 E2E_PASSWORD=... node scripts/e2e.mjs
 * Cubre el camino feliz (alta de material → lote → aprobación → receta → orden → pesaje →
 * firma → DISPENSADO) y cada ataque que el prototipo dejaba pasar.
 */
const BASE = process.env.E2E_URL ?? "http://localhost:3100";
const PASSWORD = process.env.E2E_PASSWORD;
if (!PASSWORD) throw new Error("Falta E2E_PASSWORD (la PHARMA_DEMO_PASSWORD con la que se sembró la BD de pruebas)");
if (!/localhost|127\.0\.0\.1/.test(BASE) && !process.env.E2E_PERMITIR_REMOTO) throw new Error("E2E solo contra localhost: escribe datos.");

let pasadas = 0;
const fallas = [];
function verificar(nombre, condicion, detalle = "") {
  if (condicion) pasadas++;
  else fallas.push(`${nombre} ${detalle}`);
  console.log(`${condicion ? "  ok " : "FALLA"}  ${nombre}${condicion ? "" : "  → " + detalle}`);
}

class Cliente {
  cookie = "";
  async pedir(metodo, ruta, cuerpo, extra = {}) {
    const res = await fetch(BASE + ruta, {
      method: metodo,
      redirect: "manual",
      headers: { ...(cuerpo ? { "content-type": "application/json" } : {}), origin: BASE, ...(this.cookie ? { cookie: this.cookie } : {}), ...extra },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    const set = res.headers.get("set-cookie");
    if (set?.startsWith("pharma-session=")) this.cookie = set.split(";")[0];
    const texto = await res.text();
    let json = null;
    try { json = JSON.parse(texto); } catch {}
    return { status: res.status, json, headers: res.headers, setCookie: set };
  }
  async login(email, password = PASSWORD) { return this.pedir("POST", "/api/auth/login", { email, password }); }
}
const sufijo = Date.now().toString(36).toUpperCase();

console.log("— Acceso sin sesión");
const anonimo = new Cliente();
for (const r of ["/api/usuarios", "/api/auditoria", "/api/inventario/lotes", "/api/recetas", "/api/ordenes", "/api/dispensado/ordenes"]) {
  verificar(`GET ${r} sin sesión → 401`, (await anonimo.pedir("GET", r)).status === 401);
}
verificar("GET / sin sesión redirige a /login", [307, 308].includes((await anonimo.pedir("GET", "/")).status));
verificar("/api/seed ya no existe", [401, 404].includes((await anonimo.pedir("POST", "/api/seed")).status));
verificar("/api/salud público → 200", (await anonimo.pedir("GET", "/api/salud")).status === 200);

console.log("— Cookie forjada (el ataque que funcionaba en el prototipo)");
const forjado = new Cliente();
forjado.cookie = "pharma-session=" + Buffer.from(JSON.stringify({ id: "x", nombre: "Forjado", email: "x@x.com", rol: "ADMIN" })).toString("base64");
verificar("cookie base64 forjada → 401 en API", (await forjado.pedir("GET", "/api/usuarios")).status === 401);
verificar("cookie forjada → página redirige a /login", [307, 308].includes((await forjado.pedir("GET", "/usuarios")).status));

console.log("— Login");
const admin = new Cliente();
verificar("password incorrecto → 401", (await new Cliente().login("admin@pharma.com", "incorrecta-1234")).status === 401);
const rLogin = await admin.login("admin@pharma.com");
verificar("login admin → 200", rLogin.status === 200 && rLogin.json?.user?.rol === "ADMIN", JSON.stringify(rLogin.json));
verificar("cookie HttpOnly + SameSite", /HttpOnly/i.test(rLogin.setCookie ?? "") && /SameSite=lax/i.test(rLogin.setCookie ?? ""));
verificar("la cookie NO contiene datos del usuario", !Buffer.from(admin.cookie.split("=")[1] ?? "", "base64").toString().includes("ADMIN"));
verificar("mutación con Origin ajeno → 403", (await admin.pedir("POST", "/api/ordenes", { x: 1 }, { origin: "https://evil.example" })).status === 403);
const cab = (await admin.pedir("GET", "/login")).headers;
verificar("cabeceras CSP + X-Frame-Options", Boolean(cab.get("content-security-policy")) && cab.get("x-frame-options") === "DENY");

const operario = new Cliente(); await operario.login("operario@pharma.com");
const almacen = new Cliente(); await almacen.login("almacen@pharma.com");
const calidad = new Cliente(); await calidad.login("calidad@pharma.com");
const auditor = new Cliente(); await auditor.login("auditor@pharma.com");

console.log("— Permisos por rol");
verificar("OPERARIO no lista usuarios → 403", (await operario.pedir("GET", "/api/usuarios")).status === 403);
verificar("OPERARIO no ve bitácora → 403", (await operario.pedir("GET", "/api/auditoria")).status === 403);
verificar("AUDITOR sí ve bitácora", (await auditor.pedir("GET", "/api/auditoria")).status === 200);
verificar("AUDITOR no crea órdenes → 403", (await auditor.pedir("POST", "/api/ordenes", {})).status === 403);
verificar("usuario con password corto → 400", (await admin.pedir("POST", "/api/usuarios", { nombre: "X", email: `x${sufijo}@x.com`, password: "corta", rol: "OPERARIO" })).status === 400);
verificar("rol inventado → 400", (await admin.pedir("POST", "/api/usuarios", { nombre: "X", email: `y${sufijo}@x.com`, password: "larga-larga-1", rol: "DIOS" })).status === 400);

console.log("— Inventario: material → lote en cuarentena → aprobación");
const rMat = await almacen.pedir("POST", "/api/inventario/materiales", { codigo: `MAT-E2E-${sufijo}`, nombre: `Material E2E ${sufijo}`, unidad: "kg", stockMinimo: 1 });
verificar("ALMACEN crea material", rMat.status === 200 && rMat.json?.id, JSON.stringify(rMat.json));
const materialId = rMat.json.id;
const caducidad = new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10); // fecha de calendario AAAA-MM-DD
const numeroLote = `LOT-E2E-${sufijo}`;
verificar("lote con cantidad negativa → 400", (await almacen.pedir("POST", "/api/inventario/lotes", { numero: numeroLote + "-N", materialId, cantidad: -5, fechaCaducidad: caducidad, proveedor: "P" })).status === 400);
verificar("lote ya caducado → 400", (await almacen.pedir("POST", "/api/inventario/lotes", { numero: numeroLote + "-C", materialId, cantidad: 5, fechaCaducidad: "2020-01-01", proveedor: "P" })).status === 400);
const rLote = await almacen.pedir("POST", "/api/inventario/lotes", { numero: numeroLote, materialId, cantidad: 3, fechaCaducidad: caducidad, proveedor: "Proveedor E2E" });
verificar("ALMACEN recibe lote", rLote.status === 200, JSON.stringify(rLote.json));
verificar("caducidad con hora (no es fecha de calendario) → 400", (await almacen.pedir("POST", "/api/inventario/lotes", { numero: numeroLote + "-H", materialId, cantidad: 1, fechaCaducidad: new Date(Date.now() + 864e7).toISOString(), proveedor: "P" })).status === 400);
const loteId = rLote.json.id;
verificar("lote duplicado → 409", (await almacen.pedir("POST", "/api/inventario/lotes", { numero: numeroLote, materialId, cantidad: 3, fechaCaducidad: caducidad, proveedor: "P" })).status === 409);
verificar("ALMACEN NO puede aprobar su lote → 403", (await almacen.pedir("PATCH", `/api/inventario/lotes/${loteId}`, { estado: "APROBADO" })).status === 403);
verificar("estado inventado → 400", (await calidad.pedir("PATCH", `/api/inventario/lotes/${loteId}`, { estado: "LIBERADO" })).status === 400);
verificar("CUARENTENA→AGOTADO a mano → 409", (await calidad.pedir("PATCH", `/api/inventario/lotes/${loteId}`, { estado: "AGOTADO" })).status === 409);

console.log("— Receta y orden");
const rRec = await admin.pedir("POST", "/api/recetas", {
  codigo: `REC-E2E-${sufijo}`, nombre: `Receta E2E ${sufijo}`, rendimiento: 100, unidadRendimiento: "tabletas",
  fases: [
    { nombre: "Fase A", ingredientes: [{ materialId, orden: 1, cantidadTarget: 1, toleranciaMin: -2, toleranciaMax: 2 }] },
    { nombre: "Fase B", ingredientes: [{ materialId, orden: 2, cantidadTarget: 0.5, toleranciaMin: -1, toleranciaMax: 1 }] },
  ],
});
verificar("crear receta de 2 fases", rRec.status === 200, JSON.stringify(rRec.json));
verificar("receta sin fases → 400", (await admin.pedir("POST", "/api/recetas", { codigo: `R2-${sufijo}`, nombre: "x", rendimiento: 1, unidadRendimiento: "u", fases: [] })).status === 400);
const rOrd = await admin.pedir("POST", "/api/ordenes", { recetaId: rRec.json.id, loteProducto: `PROD-E2E-${sufijo}`, cantidad: 1, prioridad: 1 });
verificar("crear orden con folio ORD-#####", rOrd.status === 200 && /^ORD-\d{5}$/.test(rOrd.json?.numero ?? ""), JSON.stringify(rOrd.json));
const ordenId = rOrd.json.id;
const detalle = async () => (await operario.pedir("GET", `/api/dispensado/${ordenId}`)).json;
let d = await detalle();
const [faseA, faseB] = d.fases;
const ingA = faseA.ingredientes[0], ingB = faseB.ingredientes[0];
verificar("el servidor entrega el rango de pesaje", ingA.rango?.min === 0.98 && ingA.rango?.max === 1.02, JSON.stringify(ingA.rango));

console.log("— Pesaje: el servidor decide, no el navegador");
verificar("lote en CUARENTENA no se puede escanear → 409", (await operario.pedir("POST", "/api/dispensado/validar-lote", { codigoLote: numeroLote, ordenId, ingredienteId: ingA.id })).status === 409);
verificar("CALIDAD aprueba el lote", (await calidad.pedir("PATCH", `/api/inventario/lotes/${loteId}`, { estado: "APROBADO" })).status === 200);
verificar("escaneo válido", (await operario.pedir("POST", "/api/dispensado/validar-lote", { codigoLote: numeroLote, ordenId, ingredienteId: ingA.id })).json?.ok === true);
verificar("AUDITOR no puede pesar → 403", (await auditor.pedir("POST", "/api/dispensado/registrar", { ordenId, ingredienteId: ingA.id, loteId, cantidadReal: 1 })).status === 403);
verificar("peso fuera de tolerancia → 409 (aunque el cliente mienta)", (await operario.pedir("POST", "/api/dispensado/registrar", { ordenId, ingredienteId: ingA.id, loteId, cantidadReal: 1.5, toleranciaOk: true })).status === 409);
verificar("saltarse a la fase B → 409", (await operario.pedir("POST", "/api/dispensado/registrar", { ordenId, ingredienteId: ingB.id, loteId, cantidadReal: 0.5 })).status === 409);
verificar("firmar fase incompleta → 409", (await operario.pedir("POST", "/api/dispensado/firmar", { ordenId, faseId: faseA.id, email: "supervisor@pharma.com", password: PASSWORD })).status === 409);

// Doble clic: 8 peticiones simultáneas del mismo pesaje (el incidente real: −15 kg de stock)
const rafaga = await Promise.all(Array.from({ length: 8 }, () => operario.pedir("POST", "/api/dispensado/registrar", { ordenId, ingredienteId: ingA.id, loteId, cantidadReal: 1.01 })));
verificar("ráfaga de 8 pesajes idénticos → exactamente 1 aceptado", rafaga.filter((r) => r.status === 200).length === 1, rafaga.map((r) => r.status).join(","));
const lotesTras = (await admin.pedir("GET", "/api/inventario/lotes")).json.find((l) => l.id === loteId);
verificar("la caducidad se guarda como el mismo día de calendario en la planta (no un día antes)", new Date(lotesTras.fechaCaducidad).toLocaleDateString("sv-SE", { timeZone: "America/Mexico_City" }) === caducidad, lotesTras.fechaCaducidad);
verificar("el detalle dice si ESTE usuario puede pesar", (await operario.pedir("GET", `/api/dispensado/${ordenId}`)).json.puedeDispensar === true && (await auditor.pedir("GET", `/api/dispensado/${ordenId}`)).json.puedeDispensar === false);
verificar("stock descontado una sola vez (3 − 1.01 = 1.99)", lotesTras.cantidad === 1.99, String(lotesTras.cantidad));

console.log("— Firma electrónica");
verificar("firma con OPERARIO → 403", (await operario.pedir("POST", "/api/dispensado/firmar", { ordenId, faseId: faseA.id, email: "operario@pharma.com", password: PASSWORD })).status === 403);
verificar("firma con password malo → 403", (await operario.pedir("POST", "/api/dispensado/firmar", { ordenId, faseId: faseA.id, email: "supervisor@pharma.com", password: "no-es-la-clave" })).status === 403);
verificar("fase B bloqueada hasta firmar A → 409", (await operario.pedir("POST", "/api/dispensado/registrar", { ordenId, ingredienteId: ingB.id, loteId, cantidadReal: 0.5 })).status === 409);
verificar("firma de SUPERVISOR en fase A", (await operario.pedir("POST", "/api/dispensado/firmar", { ordenId, faseId: faseA.id, email: "supervisor@pharma.com", password: PASSWORD })).status === 200);
verificar("firmar dos veces la misma fase → 409", (await operario.pedir("POST", "/api/dispensado/firmar", { ordenId, faseId: faseA.id, email: "supervisor@pharma.com", password: PASSWORD })).status === 409);
verificar("pesaje fase B", (await operario.pedir("POST", "/api/dispensado/registrar", { ordenId, ingredienteId: ingB.id, loteId, cantidadReal: 0.5 })).status === 200);
verificar("firma de CALIDAD en fase B", (await operario.pedir("POST", "/api/dispensado/firmar", { ordenId, faseId: faseB.id, email: "calidad@pharma.com", password: PASSWORD })).status === 200);
d = await detalle();
verificar("orden queda DISPENSADO", d.estado === "DISPENSADO", d.estado);
verificar("orden cerrada ya no admite pesajes → 409", (await operario.pedir("POST", "/api/dispensado/registrar", { ordenId, ingredienteId: ingB.id, loteId, cantidadReal: 0.5 })).status === 409);

console.log("— Stock insuficiente y agotamiento");
const rOrdX = await admin.pedir("POST", "/api/ordenes", { recetaId: rRec.json.id, loteProducto: `PROD-E2EX-${sufijo}`, cantidad: 2, prioridad: 0 });
const dX = (await operario.pedir("GET", `/api/dispensado/${rOrdX.json.id}`)).json;
const ingX = dX.fases[0].ingredientes[0];
const rEscX = await operario.pedir("POST", "/api/dispensado/validar-lote", { codigoLote: numeroLote, ordenId: rOrdX.json.id, ingredienteId: ingX.id });
verificar("escaneo: quedan 1.49 kg y la orden pide 2 kg → 409 insuficiente", rEscX.status === 409 && rEscX.json?.codigo === "LOTE_INSUFICIENTE", JSON.stringify(rEscX.json));
const rRegX = await operario.pedir("POST", "/api/dispensado/registrar", { ordenId: rOrdX.json.id, ingredienteId: ingX.id, loteId, cantidadReal: 2 });
verificar("pesar 2 kg de un lote con 1.49 kg → 409 (stock nunca negativo)", rRegX.status === 409 && rRegX.json?.codigo === "LOTE_INSUFICIENTE", JSON.stringify(rRegX.json));
const rOrd2 = await admin.pedir("POST", "/api/ordenes", { recetaId: rRec.json.id, loteProducto: `PROD-E2E2-${sufijo}`, cantidad: 1.49, prioridad: 0 });
const d2 = (await operario.pedir("GET", `/api/dispensado/${rOrd2.json.id}`)).json;
verificar("pesar exactamente lo que queda (1.49 kg) sí se acepta", (await operario.pedir("POST", "/api/dispensado/registrar", { ordenId: rOrd2.json.id, ingredienteId: d2.fases[0].ingredientes[0].id, loteId, cantidadReal: 1.49 })).status === 200);
const agotado = (await admin.pedir("GET", "/api/inventario/lotes")).json.find((l) => l.id === loteId);
verificar("lote llega a 0 exacto y pasa a AGOTADO (nunca negativo)", agotado.cantidad === 0 && agotado.estado === "AGOTADO", `${agotado.cantidad} ${agotado.estado}`);

console.log("— Bitácora");
const bitacora = (await auditor.pedir("GET", "/api/auditoria")).json;
const acciones = new Set(bitacora.map((b) => b.accion));
for (const a of ["LOGIN", "LOGIN_FALLIDO", "CREAR_MATERIAL", "RECEPCION_LOTE", "CAMBIAR_ESTADO_LOTE", "CREAR_RECETA", "CREAR_ORDEN", "DISPENSAR", "FIRMA_RECHAZADA", "FIRMAR_FASE", "COMPLETAR_DISPENSADO"]) {
  verificar(`bitácora registra ${a}`, acciones.has(a));
}
verificar("3 pesajes ⇒ 3 asientos DISPENSAR de esta corrida", bitacora.filter((b) => b.accion === "DISPENSAR" && b.detalles.includes(numeroLote)).length === 3);

console.log("— Límite de intentos y cierre de sesión");
const bruto = new Cliente();
let ultimo = 0;
for (let i = 0; i < 7; i++) ultimo = (await bruto.login(`bruto${sufijo}@pharma.com`, "x".repeat(12))).status;
verificar("tras 5 fallos el login responde 429", ultimo === 429, String(ultimo));
verificar("logout", (await auditor.pedir("POST", "/api/auth/logout")).status === 200);
verificar("la sesión cerrada ya no sirve → 401", (await auditor.pedir("GET", "/api/auditoria")).status === 401);

console.log(`\n${pasadas} verificaciones correctas, ${fallas.length} fallas`);
if (fallas.length) { console.log(fallas.join("\n")); process.exit(1); }
