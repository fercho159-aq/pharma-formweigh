const puppeteer = require("puppeteer");
const path = require("path");
const CAPTURAS = path.join(__dirname, "capturas");
const BASE = "http://localhost:3000";

async function run() {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Login page
  await page.goto(BASE + "/login", { waitUntil: "networkidle0" });
  await page.screenshot({ path: CAPTURAS + "/01_login.png" });
  console.log("01_login.png");

  await page.type('input[type="email"]', "admin@pharma.com");
  await page.type('input[type="password"]', "admin123");
  await page.screenshot({ path: CAPTURAS + "/02_login_lleno.png" });
  console.log("02_login_lleno.png");

  // Click login button and wait for navigation
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0", timeout: 15000 }).catch(() => {}),
    page.click('button[type="submit"]')
  ]);
  await new Promise(r => setTimeout(r, 3000));
  
  // After login window.location.href redirects, so wait and check
  const afterLoginUrl = page.url();
  console.log("After login URL:", afterLoginUrl);
  
  // Check cookies
  const cookies = await page.cookies();
  const hasCookie = cookies.some(c => c.name === "pharma-session");
  console.log("Has session cookie:", hasCookie);
  
  if (!hasCookie) {
    console.log("No cookie after login, trying to set manually...");
    // The login API returned the cookie but page navigated away
    // Let's re-login by directly hitting the API from the page
    await page.goto(BASE + "/login", { waitUntil: "networkidle0" });
    
    // Intercept the login response to capture cookie
    await page.setRequestInterception(true);
    page.on('request', req => req.continue());
    
    const responsePromise = page.waitForResponse(r => r.url().includes("/api/auth/login"));
    await page.evaluate(() => {
      fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: "admin@pharma.com", password: "admin123" }),
      });
    });
    const response = await responsePromise;
    console.log("API response status:", response.status());
    const setCookieHeaders = response.headers()["set-cookie"];
    console.log("Set-Cookie:", setCookieHeaders ? "YES" : "NO");
    
    await new Promise(r => setTimeout(r, 1000));
    const cookies2 = await page.cookies();
    console.log("Cookies after API:", cookies2.map(c => c.name));
  }

  // Take screenshots
  async function screenshot(url, filename) {
    await page.goto(BASE + url, { waitUntil: "networkidle0" });
    await new Promise(r => setTimeout(r, 2000));
    const currentUrl = page.url();
    if (currentUrl.includes("/login")) {
      console.log(filename, "- REDIRECTED TO LOGIN, skipping");
      return false;
    }
    await page.screenshot({ path: CAPTURAS + "/" + filename, fullPage: true });
    console.log(filename);
    return true;
  }

  if (await screenshot("/", "03_dashboard.png")) {
    await screenshot("/ordenes", "04_ordenes.png");
    await screenshot("/dispensado", "05_dispensado_lista.png");

    // Dispensado detail
    await page.goto(BASE + "/dispensado", { waitUntil: "networkidle0" });
    await new Promise(r => setTimeout(r, 2000));
    const links = await page.$$eval('a[href*="/dispensado/"]', els => els.map(e => e.getAttribute("href")));
    if (links.length > 0) {
      await page.goto(BASE + links[0], { waitUntil: "networkidle0" });
      await new Promise(r => setTimeout(r, 2000));
      await page.screenshot({ path: CAPTURAS + "/06_dispensado_paso.png", fullPage: true });
      console.log("06_dispensado_paso.png");

      const bi = await page.$('input[placeholder*="Escanea"]');
      if (bi) {
        await bi.type("LOT-PAR-2024-001");
        await page.screenshot({ path: CAPTURAS + "/07_dispensado_scan.png", fullPage: true });
        console.log("07_dispensado_scan.png");
        await page.keyboard.press("Enter");
        await new Promise(r => setTimeout(r, 2000));
        await page.screenshot({ path: CAPTURAS + "/08_dispensado_lote_ok.png", fullPage: true });
        console.log("08_dispensado_lote_ok.png");

        const pi = await page.$('input[type="number"][step="0.001"]');
        if (pi) {
          await pi.type("5.001");
          await new Promise(r => setTimeout(r, 1000));
          await page.screenshot({ path: CAPTURAS + "/09_peso_verde.png", fullPage: true });
          console.log("09_peso_verde.png");
          await pi.click({ clickCount: 3 }); await pi.type("4.5");
          await new Promise(r => setTimeout(r, 1000));
          await page.screenshot({ path: CAPTURAS + "/10_peso_rojo.png", fullPage: true });
          console.log("10_peso_rojo.png");
          await pi.click({ clickCount: 3 }); await pi.type("4.952");
          await new Promise(r => setTimeout(r, 1000));
          await page.screenshot({ path: CAPTURAS + "/11_peso_amarillo.png", fullPage: true });
          console.log("11_peso_amarillo.png");
        }
      }
    }

    await screenshot("/recetas", "12_recetas.png");
    // Open new recipe form
    for (const btn of await page.$$("button")) {
      const t = await page.evaluate(el => el.textContent, btn);
      if (t.includes("Nueva Receta")) { await btn.click(); await new Promise(r => setTimeout(r, 1000)); break; }
    }
    await page.screenshot({ path: CAPTURAS + "/13_receta_nueva.png", fullPage: true }); console.log("13_receta_nueva.png");

    await screenshot("/inventario", "14_inventario_materiales.png");
    for (const btn of await page.$$("button")) {
      const t = await page.evaluate(el => el.textContent, btn);
      if (t.trim() === "Lotes") { await btn.click(); await new Promise(r => setTimeout(r, 2000)); break; }
    }
    await page.screenshot({ path: CAPTURAS + "/15_inventario_lotes.png", fullPage: true }); console.log("15_inventario_lotes.png");
    for (const btn of await page.$$("button")) {
      const t = await page.evaluate(el => el.textContent, btn);
      if (t.trim() === "Recepción") { await btn.click(); await new Promise(r => setTimeout(r, 1000)); break; }
    }
    await page.screenshot({ path: CAPTURAS + "/16_inventario_recepcion.png", fullPage: true }); console.log("16_inventario_recepcion.png");

    await screenshot("/auditoria", "17_auditoria.png");
    await screenshot("/usuarios", "18_usuarios.png");
  }

  await browser.close();
  console.log("\nDone!");
}
run().catch(console.error);
