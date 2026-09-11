import { NextResponse } from "next/server";
import { getDb, generateId } from "@/lib/db";

export async function POST() {
  const db = getDb();

  // Check if extra seed already ran
  const check = db.prepare("SELECT COUNT(*) as c FROM materiales WHERE codigo = 'MAT-VIT-009'").get() as { c: number };
  if (check.c > 0) {
    return NextResponse.json({ msg: "Datos extra ya existen." });
  }

  const transaction = db.transaction(() => {
    // === NUEVOS MATERIALES ===
    const newMateriales = [
      { id: generateId(), codigo: "MAT-VIT-009", nombre: "Vitamina C (Ácido Ascórbico)", descripcion: "Vitamina antioxidante, polvo cristalino blanco", unidad: "kg", stockMinimo: 2 },
      { id: generateId(), codigo: "MAT-ZIN-010", nombre: "Óxido de Zinc", descripcion: "Principio activo dermatológico", unidad: "kg", stockMinimo: 1 },
      { id: generateId(), codigo: "MAT-GLI-011", nombre: "Glicerina USP", descripcion: "Humectante y vehículo líquido", unidad: "L", stockMinimo: 5 },
      { id: generateId(), codigo: "MAT-SAC-012", nombre: "Sacarosa", descripcion: "Edulcorante para suspensiones orales", unidad: "kg", stockMinimo: 10 },
      { id: generateId(), codigo: "MAT-MEN-013", nombre: "Mentol Cristales", descripcion: "Saborizante y analgésico tópico", unidad: "kg", stockMinimo: 0.5 },
      { id: generateId(), codigo: "MAT-ALC-014", nombre: "Alcohol Etílico 96%", descripcion: "Solvente y desinfectante - INFLAMABLE", unidad: "L", stockMinimo: 10 },
      { id: generateId(), codigo: "MAT-VAS-015", nombre: "Vaselina Blanca", descripcion: "Base para ungüentos y cremas", unidad: "kg", stockMinimo: 5 },
      { id: generateId(), codigo: "MAT-TAL-016", nombre: "Talco Farmacéutico", descripcion: "Deslizante y diluyente", unidad: "kg", stockMinimo: 3 },
    ];

    for (const m of newMateriales) {
      db.prepare("INSERT INTO materiales (id, codigo, nombre, descripcion, unidad, stockMinimo) VALUES (?, ?, ?, ?, ?, ?)")
        .run(m.id, m.codigo, m.nombre, m.descripcion, m.unidad, m.stockMinimo);
    }

    // === LOTES PARA NUEVOS MATERIALES ===
    const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const nearExpiry = new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const newLotes = [
      { id: generateId(), numero: "LOT-VIT-2024-001", materialId: newMateriales[0].id, cantidad: 10, proveedor: "VitaPharma China", fechaCaducidad: futureDate, estado: "APROBADO" },
      { id: generateId(), numero: "LOT-ZIN-2024-001", materialId: newMateriales[1].id, cantidad: 5, proveedor: "ZincMex SA", fechaCaducidad: futureDate, estado: "APROBADO" },
      { id: generateId(), numero: "LOT-GLI-2024-001", materialId: newMateriales[2].id, cantidad: 20, proveedor: "GlicerPharma", fechaCaducidad: futureDate, estado: "APROBADO" },
      { id: generateId(), numero: "LOT-SAC-2024-001", materialId: newMateriales[3].id, cantidad: 50, proveedor: "Azúcar Refinada SA", fechaCaducidad: futureDate, estado: "APROBADO" },
      { id: generateId(), numero: "LOT-MEN-2024-001", materialId: newMateriales[4].id, cantidad: 2, proveedor: "MentolPure India", fechaCaducidad: nearExpiry, estado: "APROBADO" },
      { id: generateId(), numero: "LOT-ALC-2024-001", materialId: newMateriales[5].id, cantidad: 50, proveedor: "Alcoholes del Centro", fechaCaducidad: futureDate, estado: "APROBADO" },
      { id: generateId(), numero: "LOT-VAS-2024-001", materialId: newMateriales[6].id, cantidad: 15, proveedor: "PetroFarma", fechaCaducidad: futureDate, estado: "CUARENTENA" },
      { id: generateId(), numero: "LOT-TAL-2024-001", materialId: newMateriales[7].id, cantidad: 10, proveedor: "MineralPharma", fechaCaducidad: futureDate, estado: "APROBADO" },
    ];

    for (const l of newLotes) {
      db.prepare(
        "INSERT INTO lotes (id, numero, materialId, cantidad, cantidadInicial, fechaRecepcion, fechaCaducidad, proveedor, estado) VALUES (?, ?, ?, ?, ?, datetime('now'), ?, ?, ?)"
      ).run(l.id, l.numero, l.materialId, l.cantidad, l.cantidad, l.fechaCaducidad, l.proveedor, l.estado);
    }

    // Get existing material IDs for references
    const matPar = db.prepare("SELECT id FROM materiales WHERE codigo = 'MAT-PAR-001'").get() as { id: string };
    const matCel = db.prepare("SELECT id FROM materiales WHERE codigo = 'MAT-CEL-002'").get() as { id: string };
    const matEst = db.prepare("SELECT id FROM materiales WHERE codigo = 'MAT-EST-003'").get() as { id: string };
    const matAlm = db.prepare("SELECT id FROM materiales WHERE codigo = 'MAT-ALM-004'").get() as { id: string };
    const matIbu = db.prepare("SELECT id FROM materiales WHERE codigo = 'MAT-IBU-006'").get() as { id: string };
    const matLac = db.prepare("SELECT id FROM materiales WHERE codigo = 'MAT-LAC-007'").get() as { id: string };

    // === RECETA 4: Jarabe Vitamina C ===
    const receta4Id = generateId();
    db.prepare(
      "INSERT INTO recetas (id, codigo, nombre, descripcion, rendimiento, unidadRendimiento) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(receta4Id, "REC-JAR-VITC", "Jarabe Vitamina C 500mg/5mL", "Jarabe oral de ácido ascórbico con sabor mentol. Envase 120mL.", 200, "L");

    const ingR4 = [
      { materialId: newMateriales[0].id, orden: 1, cantidadTarget: 4.0, tolMin: -1, tolMax: 1, inst: "Disolver completamente en agua purificada a 40°C.", peligroso: false },
      { materialId: newMateriales[3].id, orden: 2, cantidadTarget: 15.0, tolMin: -2, tolMax: 2, inst: "Agregar sacarosa gradualmente con agitación constante.", peligroso: false },
      { materialId: newMateriales[2].id, orden: 3, cantidadTarget: 5.0, tolMin: -2, tolMax: 2, inst: "Agregar como humectante y viscosificante.", peligroso: false },
      { materialId: newMateriales[4].id, orden: 4, cantidadTarget: 0.02, tolMin: -10, tolMax: 10, inst: "PRECAUCIÓN: Irritante en alta concentración. Usar guantes y mascarilla.", peligroso: true },
    ];

    for (const ing of ingR4) {
      db.prepare(
        "INSERT INTO ingredientes (id, recetaId, materialId, orden, cantidadTarget, toleranciaMin, toleranciaMax, instrucciones, peligroso) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(generateId(), receta4Id, ing.materialId, ing.orden, ing.cantidadTarget, ing.tolMin, ing.tolMax, ing.inst, ing.peligroso ? 1 : 0);
    }

    // === RECETA 5: Crema Óxido de Zinc ===
    const receta5Id = generateId();
    db.prepare(
      "INSERT INTO recetas (id, codigo, nombre, descripcion, rendimiento, unidadRendimiento) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(receta5Id, "REC-CRM-ZINC", "Crema Óxido de Zinc 10%", "Crema dermoprotectora para rozaduras. Tarro 100g.", 50, "kg");

    const ingR5 = [
      { materialId: newMateriales[6].id, orden: 1, cantidadTarget: 40.0, tolMin: -1, tolMax: 1, inst: "Fundir vaselina a 65°C en baño maría. Verificar temperatura.", peligroso: false },
      { materialId: newMateriales[1].id, orden: 2, cantidadTarget: 5.0, tolMin: -2, tolMax: 2, inst: "Incorporar óxido de zinc tamizado lentamente con agitación.", peligroso: false },
      { materialId: newMateriales[7].id, orden: 3, cantidadTarget: 3.0, tolMin: -3, tolMax: 3, inst: "Agregar como deslizante.", peligroso: false },
      { materialId: newMateriales[4].id, orden: 4, cantidadTarget: 0.1, tolMin: -5, tolMax: 5, inst: "Saborizante/refrescante tópico. Agregar a 40°C antes del enfriamiento.", peligroso: false },
    ];

    for (const ing of ingR5) {
      db.prepare(
        "INSERT INTO ingredientes (id, recetaId, materialId, orden, cantidadTarget, toleranciaMin, toleranciaMax, instrucciones, peligroso) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(generateId(), receta5Id, ing.materialId, ing.orden, ing.cantidadTarget, ing.tolMin, ing.tolMax, ing.inst, ing.peligroso ? 1 : 0);
    }

    // === RECETA 6: Solución Antiséptica Alcohol ===
    const receta6Id = generateId();
    db.prepare(
      "INSERT INTO recetas (id, codigo, nombre, descripcion, rendimiento, unidadRendimiento) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(receta6Id, "REC-SOL-ANTI", "Solución Antiséptica 70%", "Solución de alcohol etílico al 70% para desinfección. Envase 500mL.", 100, "L");

    const ingR6 = [
      { materialId: newMateriales[5].id, orden: 1, cantidadTarget: 73.0, tolMin: -0.5, tolMax: 0.5, inst: "PELIGRO: MATERIAL INFLAMABLE. Área ventilada. Prohibido fumar. Sin chispas eléctricas.", peligroso: true },
      { materialId: newMateriales[2].id, orden: 2, cantidadTarget: 2.0, tolMin: -5, tolMax: 5, inst: "Agregar como humectante para manos.", peligroso: false },
      { materialId: newMateriales[4].id, orden: 3, cantidadTarget: 0.05, tolMin: -10, tolMax: 10, inst: "Fragancia refrescante. Disolver en el alcohol antes de diluir.", peligroso: false },
    ];

    for (const ing of ingR6) {
      db.prepare(
        "INSERT INTO ingredientes (id, recetaId, materialId, orden, cantidadTarget, toleranciaMin, toleranciaMax, instrucciones, peligroso) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(generateId(), receta6Id, ing.materialId, ing.orden, ing.cantidadTarget, ing.tolMin, ing.tolMax, ing.inst, ing.peligroso ? 1 : 0);
    }

    // === RECETA 7: Comprimidos Ibuprofeno + Paracetamol ===
    const receta7Id = generateId();
    db.prepare(
      "INSERT INTO recetas (id, codigo, nombre, descripcion, rendimiento, unidadRendimiento) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(receta7Id, "REC-COMBO-IP", "Comprimido Ibuprofeno 200mg + Paracetamol 325mg", "Combinación analgésica de liberación rápida. Blister x 10.", 20000, "tabletas");

    const ingR7 = [
      { materialId: matIbu.id, orden: 1, cantidadTarget: 4.0, tolMin: -1, tolMax: 1, inst: "Pesar ibuprofeno con precisión. Polvo blanco cristalino.", peligroso: false },
      { materialId: matPar.id, orden: 2, cantidadTarget: 6.5, tolMin: -1, tolMax: 1, inst: "Pesar paracetamol. Verificar ausencia de grumos.", peligroso: false },
      { materialId: matCel.id, orden: 3, cantidadTarget: 4.0, tolMin: -2, tolMax: 2, inst: "Excipiente diluyente. Tamizar malla 40.", peligroso: false },
      { materialId: matAlm.id, orden: 4, cantidadTarget: 1.5, tolMin: -3, tolMax: 3, inst: "Desintegrante. Mezclar en seco.", peligroso: false },
      { materialId: matLac.id, orden: 5, cantidadTarget: 2.0, tolMin: -2, tolMax: 2, inst: "Diluyente secundario.", peligroso: false },
      { materialId: matEst.id, orden: 6, cantidadTarget: 0.08, tolMin: -5, tolMax: 5, inst: "ÚLTIMO PASO. Lubricante externo. Mezclar máx 3 minutos.", peligroso: false },
    ];

    for (const ing of ingR7) {
      db.prepare(
        "INSERT INTO ingredientes (id, recetaId, materialId, orden, cantidadTarget, toleranciaMin, toleranciaMax, instrucciones, peligroso) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(generateId(), receta7Id, ing.materialId, ing.orden, ing.cantidadTarget, ing.tolMin, ing.tolMax, ing.inst, ing.peligroso ? 1 : 0);
    }

    // === NUEVAS ÓRDENES DE PRODUCCIÓN ===
    // Orden 4: Jarabe Vitamina C - urgente
    db.prepare(
      "INSERT INTO ordenes_produccion (id, numero, recetaId, loteProducto, cantidad, estado, prioridad) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(generateId(), "ORD-00004", receta4Id, "PROD-VITC-2024-001", 0.5, "PENDIENTE", 2);

    // Orden 5: Ibuprofeno tabletas
    const recIbu = db.prepare("SELECT id FROM recetas WHERE codigo = 'REC-IBU-400'").get() as { id: string };
    db.prepare(
      "INSERT INTO ordenes_produccion (id, numero, recetaId, loteProducto, cantidad, estado, prioridad) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(generateId(), "ORD-00005", recIbu.id, "PROD-IBU-2024-001", 1, "PENDIENTE", 1);

    // Orden 6: Combo Ibu+Par
    db.prepare(
      "INSERT INTO ordenes_produccion (id, numero, recetaId, loteProducto, cantidad, estado, prioridad) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(generateId(), "ORD-00006", receta7Id, "PROD-COMBO-2024-001", 1, "PENDIENTE", 1);

    // Orden 7: Crema Zinc
    db.prepare(
      "INSERT INTO ordenes_produccion (id, numero, recetaId, loteProducto, cantidad, estado, prioridad) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(generateId(), "ORD-00007", receta5Id, "PROD-ZINC-2024-001", 1, "PENDIENTE", 0);

    // Orden 8: Solución Antiséptica
    db.prepare(
      "INSERT INTO ordenes_produccion (id, numero, recetaId, loteProducto, cantidad, estado, prioridad) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(generateId(), "ORD-00008", receta6Id, "PROD-ANTI-2024-001", 1, "PENDIENTE", 0);

    // Orden 9: Suspensión pediátrica doble lote
    const recSusp = db.prepare("SELECT id FROM recetas WHERE codigo = 'REC-SUSP-PAR'").get() as { id: string };
    db.prepare(
      "INSERT INTO ordenes_produccion (id, numero, recetaId, loteProducto, cantidad, estado, prioridad) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(generateId(), "ORD-00009", recSusp.id, "PROD-SUSP-2024-002", 1, "PENDIENTE", 0);

    // Orden 10: Paracetamol lote grande x3
    const recPar = db.prepare("SELECT id FROM recetas WHERE codigo = 'REC-PCT-500'").get() as { id: string };
    db.prepare(
      "INSERT INTO ordenes_produccion (id, numero, recetaId, loteProducto, cantidad, estado, prioridad) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(generateId(), "ORD-00010", recPar.id, "PROD-PCT-2024-003", 3, "PENDIENTE", 2);
  });

  try {
    transaction();
    return NextResponse.json({
      ok: true,
      msg: "Seed extra completado: 8 materiales nuevos, 8 lotes nuevos, 4 recetas nuevas, 7 órdenes nuevas"
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
