import { NextResponse } from "next/server";
import { getDb, generateId, hashPassword } from "@/lib/db";

export async function POST() {
  const db = getDb();

  // Check if seed already ran
  const matCount = db.prepare("SELECT COUNT(*) as c FROM materiales").get() as { c: number };
  if (matCount.c > 0) {
    return NextResponse.json({ msg: "Datos ya existen. Seed omitido." });
  }

  const transaction = db.transaction(() => {
    // === MATERIALES ===
    const materiales = [
      { id: generateId(), codigo: "MAT-PAR-001", nombre: "Paracetamol (Acetaminofén)", descripcion: "Principio activo analgésico y antipirético", unidad: "kg", stockMinimo: 5 },
      { id: generateId(), codigo: "MAT-CEL-002", nombre: "Celulosa Microcristalina", descripcion: "Excipiente diluyente y aglutinante", unidad: "kg", stockMinimo: 10 },
      { id: generateId(), codigo: "MAT-EST-003", nombre: "Estearato de Magnesio", descripcion: "Lubricante para compresión", unidad: "kg", stockMinimo: 2 },
      { id: generateId(), codigo: "MAT-ALM-004", nombre: "Almidón de Maíz", descripcion: "Desintegrante y diluyente", unidad: "kg", stockMinimo: 8 },
      { id: generateId(), codigo: "MAT-SIO-005", nombre: "Dióxido de Silicio Coloidal", descripcion: "Deslizante y adsorbente", unidad: "kg", stockMinimo: 1 },
      { id: generateId(), codigo: "MAT-IBU-006", nombre: "Ibuprofeno", descripcion: "Principio activo antiinflamatorio", unidad: "kg", stockMinimo: 3 },
      { id: generateId(), codigo: "MAT-LAC-007", nombre: "Lactosa Monohidrato", descripcion: "Excipiente diluyente", unidad: "kg", stockMinimo: 15 },
      { id: generateId(), codigo: "MAT-PVP-008", nombre: "Povidona (PVP K30)", descripcion: "Aglutinante húmedo", unidad: "kg", stockMinimo: 3 },
    ];

    for (const m of materiales) {
      db.prepare("INSERT INTO materiales (id, codigo, nombre, descripcion, unidad, stockMinimo) VALUES (?, ?, ?, ?, ?, ?)")
        .run(m.id, m.codigo, m.nombre, m.descripcion, m.unidad, m.stockMinimo);
    }

    // === LOTES ===
    const now = new Date();
    const futureDate = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString().split("T")[0];
    const nearExpiry = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString().split("T")[0];

    const lotes = [
      { id: generateId(), numero: "LOT-PAR-2024-001", materialId: materiales[0].id, cantidad: 25, proveedor: "Farmaquímicos SA", fechaCaducidad: futureDate, estado: "APROBADO" },
      { id: generateId(), numero: "LOT-PAR-2024-002", materialId: materiales[0].id, cantidad: 10, proveedor: "Química Global", fechaCaducidad: nearExpiry, estado: "APROBADO" },
      { id: generateId(), numero: "LOT-CEL-2024-001", materialId: materiales[1].id, cantidad: 50, proveedor: "ExcipPharma", fechaCaducidad: futureDate, estado: "APROBADO" },
      { id: generateId(), numero: "LOT-EST-2024-001", materialId: materiales[2].id, cantidad: 5, proveedor: "Lubrichem MX", fechaCaducidad: futureDate, estado: "APROBADO" },
      { id: generateId(), numero: "LOT-ALM-2024-001", materialId: materiales[3].id, cantidad: 30, proveedor: "Almidones del Centro", fechaCaducidad: futureDate, estado: "APROBADO" },
      { id: generateId(), numero: "LOT-SIO-2024-001", materialId: materiales[4].id, cantidad: 3, proveedor: "SilicaPharma", fechaCaducidad: futureDate, estado: "APROBADO" },
      { id: generateId(), numero: "LOT-IBU-2024-001", materialId: materiales[5].id, cantidad: 15, proveedor: "ApiPharma Internacional", fechaCaducidad: futureDate, estado: "CUARENTENA" },
      { id: generateId(), numero: "LOT-LAC-2024-001", materialId: materiales[6].id, cantidad: 40, proveedor: "Lactosa MX", fechaCaducidad: futureDate, estado: "APROBADO" },
      { id: generateId(), numero: "LOT-PVP-2024-001", materialId: materiales[7].id, cantidad: 8, proveedor: "PolymerPharma", fechaCaducidad: futureDate, estado: "APROBADO" },
    ];

    for (const l of lotes) {
      db.prepare(
        "INSERT INTO lotes (id, numero, materialId, cantidad, cantidadInicial, fechaRecepcion, fechaCaducidad, proveedor, estado) VALUES (?, ?, ?, ?, ?, datetime('now'), ?, ?, ?)"
      ).run(l.id, l.numero, l.materialId, l.cantidad, l.cantidad, l.fechaCaducidad, l.proveedor, l.estado);
    }

    // === RECETAS ===
    const receta1Id = generateId();
    db.prepare(
      "INSERT INTO recetas (id, codigo, nombre, descripcion, rendimiento, unidadRendimiento) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(receta1Id, "REC-PCT-500", "Tableta Paracetamol 500mg", "Formulación estándar de tabletas de paracetamol 500mg. Lote de 10,000 tabletas.", 10000, "tabletas");

    const ingredientesR1 = [
      { materialId: materiales[0].id, orden: 1, cantidadTarget: 5.0, toleranciaMin: -1, toleranciaMax: 1, instrucciones: "Pesar con precisión. Verificar identidad visual del polvo blanco cristalino.", peligroso: false },
      { materialId: materiales[1].id, orden: 2, cantidadTarget: 3.5, toleranciaMin: -2, toleranciaMax: 2, instrucciones: "Tamizar antes de pesar (malla 40).", peligroso: false },
      { materialId: materiales[3].id, orden: 3, cantidadTarget: 1.0, toleranciaMin: -3, toleranciaMax: 3, instrucciones: null, peligroso: false },
      { materialId: materiales[4].id, orden: 4, cantidadTarget: 0.1, toleranciaMin: -5, toleranciaMax: 5, instrucciones: "Usar mascarilla. Polvo muy fino.", peligroso: true },
      { materialId: materiales[2].id, orden: 5, cantidadTarget: 0.05, toleranciaMin: -5, toleranciaMax: 5, instrucciones: "Agregar al final. No mezclar con otros excipientes húmedos.", peligroso: false },
    ];

    for (const ing of ingredientesR1) {
      db.prepare(
        "INSERT INTO ingredientes (id, recetaId, materialId, orden, cantidadTarget, toleranciaMin, toleranciaMax, instrucciones, peligroso) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(generateId(), receta1Id, ing.materialId, ing.orden, ing.cantidadTarget, ing.toleranciaMin, ing.toleranciaMax, ing.instrucciones, ing.peligroso ? 1 : 0);
    }

    const receta2Id = generateId();
    db.prepare(
      "INSERT INTO recetas (id, codigo, nombre, descripcion, rendimiento, unidadRendimiento) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(receta2Id, "REC-IBU-400", "Tableta Ibuprofeno 400mg", "Formulación de tabletas recubiertas de ibuprofeno 400mg.", 5000, "tabletas");

    const ingredientesR2 = [
      { materialId: materiales[5].id, orden: 1, cantidadTarget: 2.0, toleranciaMin: -1, toleranciaMax: 1, instrucciones: "Verificar certificado de análisis. Polvo blanco cristalino.", peligroso: false },
      { materialId: materiales[6].id, orden: 2, cantidadTarget: 1.5, toleranciaMin: -2, toleranciaMax: 2, instrucciones: null, peligroso: false },
      { materialId: materiales[7].id, orden: 3, cantidadTarget: 0.3, toleranciaMin: -3, toleranciaMax: 3, instrucciones: "Disolver en agua purificada antes de usar como granulante.", peligroso: false },
      { materialId: materiales[2].id, orden: 4, cantidadTarget: 0.04, toleranciaMin: -5, toleranciaMax: 5, instrucciones: "Lubricante - agregar al final de la mezcla.", peligroso: false },
    ];

    for (const ing of ingredientesR2) {
      db.prepare(
        "INSERT INTO ingredientes (id, recetaId, materialId, orden, cantidadTarget, toleranciaMin, toleranciaMax, instrucciones, peligroso) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(generateId(), receta2Id, ing.materialId, ing.orden, ing.cantidadTarget, ing.toleranciaMin, ing.toleranciaMax, ing.instrucciones, ing.peligroso ? 1 : 0);
    }

    const receta3Id = generateId();
    db.prepare(
      "INSERT INTO recetas (id, codigo, nombre, descripcion, rendimiento, unidadRendimiento) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(receta3Id, "REC-SUSP-PAR", "Suspensión Pediátrica Paracetamol", "Suspensión oral pediátrica 120mg/5mL.", 100, "L");

    const ingredientesR3 = [
      { materialId: materiales[0].id, orden: 1, cantidadTarget: 2.4, toleranciaMin: -1, toleranciaMax: 1, instrucciones: "Pesar con balanza analítica. Verificar pureza >= 99.5%", peligroso: false },
      { materialId: materiales[1].id, orden: 2, cantidadTarget: 1.0, toleranciaMin: -2, toleranciaMax: 2, instrucciones: "Usar como agente de suspensión.", peligroso: false },
    ];

    for (const ing of ingredientesR3) {
      db.prepare(
        "INSERT INTO ingredientes (id, recetaId, materialId, orden, cantidadTarget, toleranciaMin, toleranciaMax, instrucciones, peligroso) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(generateId(), receta3Id, ing.materialId, ing.orden, ing.cantidadTarget, ing.toleranciaMin, ing.toleranciaMax, ing.instrucciones, ing.peligroso ? 1 : 0);
    }

    // === ÓRDENES DE PRODUCCIÓN ===
    const orden1Id = generateId();
    db.prepare(
      "INSERT INTO ordenes_produccion (id, numero, recetaId, loteProducto, cantidad, estado, prioridad) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(orden1Id, "ORD-00001", receta1Id, "PROD-PCT-2024-001", 1, "PENDIENTE", 1);

    const orden2Id = generateId();
    db.prepare(
      "INSERT INTO ordenes_produccion (id, numero, recetaId, loteProducto, cantidad, estado, prioridad) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(orden2Id, "ORD-00002", receta1Id, "PROD-PCT-2024-002", 2, "PENDIENTE", 0);

    const orden3Id = generateId();
    db.prepare(
      "INSERT INTO ordenes_produccion (id, numero, recetaId, loteProducto, cantidad, estado, prioridad) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(orden3Id, "ORD-00003", receta3Id, "PROD-SUSP-2024-001", 0.5, "PENDIENTE", 0);
  });

  try {
    transaction();
    return NextResponse.json({ ok: true, msg: "Seed completado: 8 materiales, 9 lotes, 3 recetas, 3 órdenes" });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
