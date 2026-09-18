/**
 * Regenera las capturas de pantalla de los manuales (docs/manual/capturas).
 *
 * Uso:
 *   MANUAL_PASSWORD='...' node docs/manual/take-screenshots.cjs
 *
 * Variables de entorno:
 *   MANUAL_URL       URL base de la app        (default http://localhost:3100)
 *   MANUAL_PASSWORD  contraseña de los usuarios demo  (OBLIGATORIA, sin default)
 *   CHROME_PATH      binario de Chrome         (default: Chrome de macOS)
 *
 * Nunca escribas la contraseña en este archivo: se pasa por entorno y sólo
 * aparece en pantalla dentro de un campo type="password" (enmascarado).
 *
 * El recorrido de pesaje CONSUME la primera orden pendiente de la base:
 * está pensado para una base local desechable, no para la del cliente.
 */
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const CAPTURAS = path.join(__dirname, "capturas");
const BASE = (process.env.MANUAL_URL || "http://localhost:3100").replace(/\/$/, "");
const PASSWORD = process.env.MANUAL_PASSWORD;
const CHROME_PATH =
  process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const VIEWPORT = { width: 1440, height: 900 };

/** Usuarios demo del seed, uno por rol. Todos comparten MANUAL_PASSWORD. */
const USUARIOS = {
  admin: "admin@pharma.com",
  supervisor: "supervisor@pharma.com",
  operario: "operario@pharma.com",
  desarrollo: "desarrollo@pharma.com",
  calidad: "calidad@pharma.com",
  almacen: "almacen@pharma.com",
  auditor: "auditor@pharma.com",
};

/** Código de material → lote aprobado del seed que lo surte. */
const LOTE_DE_MATERIAL = {
  "MAT-PAR-001": "LOT-PAR-2024-001",
  "MAT-CEL-002": "LOT-CEL-2024-001",
  "MAT-EST-003": "LOT-EST-2024-001",
  "MAT-ALM-004": "LOT-ALM-2024-001",
  "MAT-SIO-005": "LOT-SIO-2024-001",
  "MAT-IBU-006": "LOT-IBU-2024-001",
  "MAT-LAC-007": "LOT-LAC-2024-001",
  "MAT-PVP-008": "LOT-PVP-2024-001",
};

/**
 * Lotes que el recorrido da de alta desde Recepción, los dos en CUARENTENA:
 *   [0] para la captura de Calidad con los botones Aprobar/Rechazar disponibles;
 *   [1] para fotografiar la confirmación en dos pasos de Rechazar, que después
 *       se cancela — ningún lote se destruye.
 * En una segunda corrida el alta falla por duplicado (se avisa en consola) pero los
 * lotes ya están en CUARENTENA y las capturas salen igual.
 */
const LOTES_CUARENTENA = ["LOT-LAC-2026-CT1", "LOT-LAC-2026-CT2"];

if (!PASSWORD) {
  console.error(
    "Falta MANUAL_PASSWORD.\n" +
      "  MANUAL_PASSWORD='tu-contraseña' node docs/manual/take-screenshots.cjs",
  );
  process.exit(1);
}
if (!fs.existsSync(CHROME_PATH)) {
  console.error(`No existe el Chrome indicado: ${CHROME_PATH}\nDefine CHROME_PATH.`);
  process.exit(1);
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** Captura la ventana completa y avisa en consola. */
async function foto(page, nombre, { fullPage = false } = {}) {
  await esperar(500);
  await page.screenshot({ path: path.join(CAPTURAS, nombre), fullPage });
  console.log("  ✓", nombre);
}

/** Texto de un elemento por selector, o "" si no existe. */
function texto(page, selector) {
  return page.$eval(selector, (el) => el.textContent.trim()).catch(() => "");
}

/** Hace clic en el primer <button> cuyo texto contenga `etiqueta`. */
async function clicBoton(page, etiqueta, selector = "button") {
  const handle = await page.evaluateHandle(
    (sel, txt) => [...document.querySelectorAll(sel)].find((b) => b.textContent.includes(txt)) || null,
    selector,
    etiqueta,
  );
  const el = handle.asElement();
  if (!el) throw new Error(`No encontré el botón "${etiqueta}"`);
  await el.click();
  await esperar(900);
}

/**
 * Llena el campo cuyo <label> empieza con `etiqueta` (los formularios de la app
 * no ponen `type` ni `name` en varios inputs, así que la etiqueta es el ancla
 * más estable). Un input[type=date] no acepta `type()`: se fija con el setter
 * nativo + evento `input` para que React registre el cambio.
 */
async function llenarCampo(page, etiqueta, valor) {
  const handle = await page.evaluateHandle((txt) => {
    const lab = [...document.querySelectorAll("label")].find((l) => l.textContent.trim().startsWith(txt));
    return lab ? lab.parentElement.querySelector("input, select, textarea") : null;
  }, etiqueta);
  const el = handle.asElement();
  if (!el) throw new Error(`No encontré el campo "${etiqueta}"`);
  const tipo = await page.evaluate((e) => e.type, el);
  if (tipo === "date" || tipo === "select-one") {
    await page.evaluate(
      (e, v) => {
        const proto = e.tagName === "SELECT" ? HTMLSelectElement : HTMLInputElement;
        Object.getOwnPropertyDescriptor(proto.prototype, "value").set.call(e, v);
        e.dispatchEvent(new Event(e.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
      },
      el,
      String(valor),
    );
  } else {
    await el.type(String(valor));
  }
  await esperar(200);
}

/**
 * Pulsa el botón `etiqueta` dentro de la fila que contiene el texto `fila`.
 * Acotar a la fila importa: en la tabla de lotes hay un botón por renglón y la
 * confirmación de rechazo añade un «Cancelar» que también existe en otros formularios.
 */
async function clicEnFila(page, fila, etiqueta) {
  const handle = await page.evaluateHandle(
    (txtFila, txtBoton) => {
      const tr = [...document.querySelectorAll("tr")].find((r) => r.textContent.includes(txtFila));
      if (!tr) return null;
      return [...tr.querySelectorAll("button")].find((b) => b.textContent.trim() === txtBoton) || null;
    },
    fila,
    etiqueta,
  );
  const el = handle.asElement();
  if (!el) throw new Error(`No encontré el botón "${etiqueta}" en la fila de ${fila}`);
  await el.click();
  await esperar(900);
}

/** Inicia sesión por el formulario real y espera el dashboard. */
async function entrar(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle0" });
  await page.type('input[type="email"]', email);
  await page.type('input[type="password"]', PASSWORD);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0", timeout: 20000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await esperar(1500);
  if (page.url().includes("/login")) {
    const err = await texto(page, "form div.bg-red-50");
    throw new Error(`No pude entrar como ${email}. Mensaje en pantalla: ${err || "(ninguno)"}`);
  }
}

async function salir(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle0" }).catch(() => {});
  await page.evaluate(() => fetch("/api/auth/logout", { method: "POST" })).catch(() => {});
  await esperar(400);
}

/** Navega y avisa si la ruta rebotó (sin permiso → dashboard, sin sesión → login). */
async function ir(page, ruta) {
  await page.goto(BASE + ruta, { waitUntil: "networkidle0" });
  await esperar(1200);
  const destino = page.url().replace(BASE, "");
  if (destino !== ruta && !destino.startsWith(ruta)) {
    console.log(`    (aviso) ${ruta} rebotó a ${destino}`);
  }
  return destino;
}

// ─────────────────────────────────────────────────────────────────────
// 1. Login, dashboard y pantallas de administración (sesión ADMIN)
// ─────────────────────────────────────────────────────────────────────
async function capturasAdmin(page) {
  console.log("[ADMIN]");

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle0" });
  await foto(page, "01_login.png");

  await page.type('input[type="email"]', USUARIOS.admin);
  await page.type('input[type="password"]', PASSWORD);
  await foto(page, "02_login_lleno.png");

  // Error de credenciales: usuario inexistente, para no gastar intentos de una
  // cuenta real (5 fallos en 15 min bloquean ese correo 15 min).
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle0" });
  await page.type('input[type="email"]', "usuario.inexistente@pharma.com");
  await page.type('input[type="password"]', "clave-que-no-existe");
  await page.click('button[type="submit"]');
  await esperar(2000);
  await foto(page, "19_login_error.png");

  await entrar(page, USUARIOS.admin);
  await foto(page, "03_dashboard.png");

  await ir(page, "/ordenes");
  await foto(page, "04_ordenes.png");
  // Se da de alta una orden para que el recorrido de pesaje siempre tenga
  // material fresco: el recorrido consume por completo la orden que trabaja.
  await clicBoton(page, "Nueva Orden");
  const receta = await page.$eval("form select option:nth-child(2), select option:nth-child(2)", (o) => o.value);
  await llenarCampo(page, "Receta", receta);
  await llenarCampo(page, "Lote del Producto Final", `PROD-QA-${Date.now().toString().slice(-6)}`);
  await llenarCampo(page, "Prioridad", "2");
  await foto(page, "20_orden_nueva.png");
  await clicBoton(page, "Crear Orden");
  await esperar(1500);
  const errOrden = await texto(page, "div.bg-red-50");
  if (errOrden) console.log("    (aviso) alta de orden:", errOrden);

  await ir(page, "/recetas");
  await foto(page, "12_recetas.png");
  await clicBoton(page, "Nueva Receta");
  await clicBoton(page, "Agregar Fase");
  await clicBoton(page, "Agregar Material");
  await foto(page, "13_receta_nueva.png");

  await ir(page, "/inventario");
  await foto(page, "14_inventario_materiales.png");
  await clicBoton(page, "Lotes");
  await foto(page, "15_inventario_lotes.png");

  // Recepción: deja dos lotes en CUARENTENA para las capturas de Calidad.
  await clicBoton(page, "Recepción");
  for (const [i, numero] of LOTES_CUARENTENA.entries()) {
    const scan = await page.$('input[placeholder*="código del material"]');
    if (!scan) throw new Error("No encontré el campo de escaneo de Recepción");
    await scan.type("MAT-LAC-007");
    await page.keyboard.press("Enter");
    await esperar(1800);

    await llenarCampo(page, "Número de Lote", numero);
    await llenarCampo(page, "Cantidad (", "12");
    await llenarCampo(page, "Proveedor", "Lactosa MX");
    await llenarCampo(page, "Fecha de Caducidad", "2027-12-31");
    await llenarCampo(page, "Certificado de Análisis", `COA-2026-CT${i + 1}`);
    // El formulario lleno sólo se fotografía una vez.
    if (i === 0) await foto(page, "16_inventario_recepcion.png");

    await clicBoton(page, "Registrar Lote");
    await esperar(1500);
    console.log(`    recepción ${numero}:`, await texto(page, "div.bg-green-50, div.bg-red-50"));
  }

  await ir(page, "/auditoria");
  await foto(page, "17_auditoria.png");

  await ir(page, "/usuarios");
  await foto(page, "18_usuarios.png");
  await clicBoton(page, "Nuevo Usuario");
  await foto(page, "21_usuario_nuevo.png");

  // Error de formulario: correo ya registrado (con una contraseña válida de 10+).
  await llenarCampo(page, "Nombre", "Usuario Duplicado");
  await llenarCampo(page, "Email", USUARIOS.admin);
  await llenarCampo(page, "Contraseña", "ClaveDePrueba2026");
  await clicBoton(page, "Crear Usuario");
  await esperar(1200);
  await foto(page, "28_error_formulario.png");
  console.log("    error mostrado:", await texto(page, "div.bg-red-50"));

  await ir(page, "/codigos");
  await foto(page, "26_codigos.png");
}

// ─────────────────────────────────────────────────────────────────────
// 2. Recorrido real de pesaje (sesión OPERARIO + firma de SUPERVISOR)
// ─────────────────────────────────────────────────────────────────────

/** Lee el paso actual de la estación: material, código y rango. */
function leerPaso(page) {
  return page.evaluate(() => {
    const t = (sel) => document.querySelector(sel)?.textContent.trim() || "";
    const codigo = [...document.querySelectorAll("p, span, div")]
      .map((e) => e.textContent.trim())
      .find((s) => /^Código:\s*MAT-/.test(s));
    const num = (etiqueta) => {
      const nodos = [...document.querySelectorAll("p, div, span")];
      const i = nodos.findIndex((e) => e.textContent.trim() === etiqueta);
      if (i < 0) return null;
      const m = nodos.slice(i, i + 4).map((e) => e.textContent.match(/(\d+\.\d{3})/));
      const hit = m.find(Boolean);
      return hit ? parseFloat(hit[1]) : null;
    };
    return {
      material: t("h2.text-2xl"),
      codigo: codigo ? codigo.replace(/^Código:\s*/, "") : null,
      min: num("Mínimo"),
      target: num("Target"),
      max: num("Máximo"),
      hayFirma: document.body.textContent.includes("Firma Electrónica del Supervisor"),
      completada: document.body.textContent.includes("Orden Completada"),
    };
  });
}

/** Escanea el lote del material del paso actual. */
async function escanear(page, codigoMaterial) {
  const lote = LOTE_DE_MATERIAL[codigoMaterial];
  if (!lote) throw new Error(`Sin lote conocido para ${codigoMaterial}`);
  const input = await page.$('input[placeholder*="Escanea el contenedor"]');
  if (!input) throw new Error("No encontré el campo de escaneo de la estación");
  await input.type(lote);
  return { lote, input };
}

/**
 * Teclea un peso en el campo grande y espera a que reaccione el semáforo.
 * Un `type="number"` no se vacía con triple clic + Backspace (los valores se
 * concatenan), así que se limpia con el setter nativo + evento `input` para que
 * React se entere del cambio.
 */
async function teclearPeso(page, valor) {
  const SEL = 'input[type="number"][step="0.001"]';
  const input = await page.$(SEL);
  if (!input) throw new Error("No encontré el campo de peso");
  await page.$eval(SEL, (el) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(el, "");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await input.focus();
  await input.type(String(valor));
  await esperar(800);
  const leido = await page.$eval(SEL, (el) => el.value);
  if (leido !== String(valor)) throw new Error(`El campo de peso quedó en "${leido}", esperaba "${valor}"`);
}

/** Desplaza el panel principal (el <main> tiene su propio scroll, no el body). */
async function desplazar(page, px) {
  await page.evaluate((y) => {
    const m = document.querySelector("main");
    if (m) m.scrollTop = y;
  }, px);
  await esperar(500);
}

async function capturasDispensado(page) {
  console.log("[OPERARIO] recorrido de pesaje");
  await entrar(page, USUARIOS.operario);

  await ir(page, "/dispensado");
  await foto(page, "05_dispensado_lista.png");

  const href = await page
    .$eval('a[href^="/dispensado/"]', (a) => a.getAttribute("href"))
    .catch(() => null);
  if (!href) {
    console.log("    (aviso) no hay órdenes con estación disponible");
    return;
  }
  await ir(page, href);

  let paso = await leerPaso(page);
  console.log("    paso inicial:", paso.material, paso.codigo, paso.min, paso.target, paso.max);
  await foto(page, "06_dispensado_paso.png");

  // --- Capturas del primer ingrediente: escaneo y semáforo ---

  // Lote de otro material: el sistema lo rechaza y no deja avanzar.
  const equivocado = Object.entries(LOTE_DE_MATERIAL).find(([m]) => m !== paso.codigo)[1];
  const campoScan = await page.$('input[placeholder*="Escanea el contenedor"]');
  await campoScan.type(equivocado);
  await page.keyboard.press("Enter");
  await esperar(2000);
  await desplazar(page, 300);
  await foto(page, "29_lote_rechazado.png");
  console.log("    lote rechazado:", await texto(page, "div.bg-red-50"));
  await desplazar(page, 0);

  const { lote } = await escanear(page, paso.codigo);
  await foto(page, "07_dispensado_scan.png");
  await page.keyboard.press("Enter");
  await esperar(2000);
  await desplazar(page, 400);
  await foto(page, "08_dispensado_lote_ok.png");
  await desplazar(page, 0);
  console.log("    lote escaneado:", lote);

  // El panel de pesaje cae bajo el pliegue: hay que desplazar el <main>.
  const VER_PESAJE = 620;

  // Verde: el target exacto siempre cae dentro de tolerancia.
  await teclearPeso(page, paso.target.toFixed(3));
  await desplazar(page, VER_PESAJE);
  await foto(page, "09_peso_verde.png");

  // Rojo: por debajo del mínimo; el botón queda BLOQUEADO y no se envía nada.
  await teclearPeso(page, (paso.min - (paso.max - paso.min)).toFixed(3));
  await desplazar(page, VER_PESAJE);
  await foto(page, "10_peso_rojo.png");

  // Ámbar: dentro del rango pero en su 10 % exterior.
  const margen = (paso.max - paso.min) * 0.1;
  await teclearPeso(page, (paso.min + margen * 0.4).toFixed(3));
  await desplazar(page, VER_PESAJE);
  await foto(page, "11_peso_amarillo.png");

  // Confirmar con el peso correcto y seguir hasta terminar la orden.
  await teclearPeso(page, paso.target.toFixed(3));
  await clicBoton(page, "Confirmar");
  await esperar(2500);

  let firmaCapturada = false;
  for (let i = 0; i < 20; i++) {
    paso = await leerPaso(page);

    if (paso.completada) {
      await desplazar(page, 0);
      await foto(page, "23_orden_completada.png");
      console.log("    orden completada");
      return;
    }

    if (paso.hayFirma) {
      if (!firmaCapturada) {
        await desplazar(page, 260);
        await foto(page, "22_firma_fase.png");
        firmaCapturada = true;
        await desplazar(page, 0);
      }
      // Firma un supervisor con su propio correo y contraseña.
      const campos = await page.$$('form input[type="email"], form input[type="password"]');
      await campos[0].type(USUARIOS.supervisor);
      await campos[1].type(PASSWORD);
      await clicBoton(page, "Firmar y Aprobar Fase");
      await esperar(3000);
      const err = await texto(page, "div.bg-red-50");
      if (err) console.log("    (aviso) firma:", err);
      continue;
    }

    if (!paso.codigo) {
      console.log("    (aviso) no hay paso activo; detengo el recorrido");
      return;
    }

    await escanear(page, paso.codigo);
    await page.keyboard.press("Enter");
    await esperar(2000);
    await teclearPeso(page, paso.target.toFixed(3));
    await clicBoton(page, "Confirmar");
    await esperar(2500);
    const alerta = await texto(page, '[role="alert"]');
    if (alerta) console.log("    (aviso) pesaje:", alerta);
  }
  console.log("    (aviso) el recorrido no llegó a 'Orden Completada'");
}

// ─────────────────────────────────────────────────────────────────────
// 3. Vistas de consulta y de otros roles
// ─────────────────────────────────────────────────────────────────────
async function capturasCalidad(page) {
  console.log("[CALIDAD]");
  await entrar(page, USUARIOS.calidad);

  // Orden abierta desde Dispensado: Calidad aterriza en la vista de consulta.
  await ir(page, "/dispensado");
  const href = await page
    .$eval('a[href^="/ordenes/"]', (a) => a.getAttribute("href"))
    .catch(() => null);
  if (href) {
    await ir(page, href);
    await foto(page, "24_orden_consulta.png");
  } else {
    await ir(page, "/ordenes");
    const fila = await page
      .$eval('a[href^="/ordenes/"]', (a) => a.getAttribute("href"))
      .catch(() => null);
    if (fila) {
      await ir(page, fila);
      await foto(page, "24_orden_consulta.png");
    } else {
      console.log("    (aviso) no encontré una orden para la vista de consulta");
    }
  }

  await ir(page, "/inventario");
  await clicBoton(page, "Lotes");
  await foto(page, "25_inventario_lotes_calidad.png");

  // Confirmación en dos pasos de Rechazar, sobre el segundo lote de cuarentena.
  // Se fotografía el paso intermedio y después se CANCELA: no se rechaza nada.
  await clicEnFila(page, LOTES_CUARENTENA[1], "Rechazar");
  await foto(page, "30_confirmar_rechazo.png");
  await clicEnFila(page, LOTES_CUARENTENA[1], "Cancelar");
  await esperar(800);
  const sigueEnCuarentena = await page.evaluate(
    (n) => [...document.querySelectorAll("tr")].find((r) => r.textContent.includes(n))?.textContent.includes("CUARENTENA"),
    LOTES_CUARENTENA[1],
  );
  console.log(`    ${LOTES_CUARENTENA[1]} sigue en cuarentena tras cancelar:`, sigueEnCuarentena);
  if (!sigueEnCuarentena) throw new Error("El cancelar del rechazo no dejó el lote en CUARENTENA");
}

async function capturasAlmacen(page) {
  console.log("[ALMACEN]");
  await entrar(page, USUARIOS.almacen);
  await ir(page, "/inventario");
  await clicBoton(page, "Lotes");
  await foto(page, "27_inventario_lotes_almacen.png");
}

// ─────────────────────────────────────────────────────────────────────
async function run() {
  fs.mkdirSync(CAPTURAS, { recursive: true });
  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: CHROME_PATH,
    args: ["--no-sandbox", "--disable-dev-shm-usage", `--window-size=${VIEWPORT.width},${VIEWPORT.height}`],
    defaultViewport: VIEWPORT,
  });

  const errores = [];
  for (const [nombre, fn] of [
    ["admin", capturasAdmin],
    ["dispensado", capturasDispensado],
    ["calidad", capturasCalidad],
    ["almacen", capturasAlmacen],
  ]) {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);
    page.on("console", (m) => {
      if (m.type() === "error") console.log(`    [consola] ${m.text()}`);
    });
    page.on("response", (r) => {
      if (r.status() >= 400) console.log(`    [http ${r.status()}] ${r.url().replace(BASE, "")}`);
    });
    try {
      await salir(page);
      await fn(page);
    } catch (e) {
      console.error(`  ✗ bloque ${nombre}:`, e.message);
      errores.push(`${nombre}: ${e.message}`);
    }
    await page.close();
  }

  await browser.close();
  console.log(errores.length ? `\nTerminado con avisos:\n - ${errores.join("\n - ")}` : "\nListo.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
