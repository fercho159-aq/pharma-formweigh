import { NextResponse } from "next/server";
import { getDb, generateId, registrarAuditoria } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const db = getDb();
  const recetas = db.prepare(`
    SELECT r.*, COUNT(i.id) as numIngredientes
    FROM recetas r
    LEFT JOIN ingredientes i ON i.recetaId = r.id
    GROUP BY r.id
    ORDER BY r.nombre
  `).all();
  return NextResponse.json(recetas);
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol === "OPERARIO") return NextResponse.json({ error: "Solo supervisor o admin" }, { status: 403 });

  const data = await request.json();
  const db = getDb();
  const id = generateId();

  const insertReceta = db.prepare(
    `INSERT INTO recetas (id, codigo, nombre, descripcion, rendimiento, unidadRendimiento)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const insertIngrediente = db.prepare(
    `INSERT INTO ingredientes (id, recetaId, materialId, orden, cantidadTarget, toleranciaMin, toleranciaMax, instrucciones, peligroso)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const transaction = db.transaction(() => {
    insertReceta.run(id, data.codigo, data.nombre, data.descripcion || null, data.rendimiento, data.unidadRendimiento);

    for (const ing of data.ingredientes || []) {
      const ingId = generateId();
      insertIngrediente.run(ingId, id, ing.materialId, ing.orden, ing.cantidadTarget, ing.toleranciaMin, ing.toleranciaMax, ing.instrucciones || null, ing.peligroso ? 1 : 0);
    }
  });

  try {
    transaction();
    registrarAuditoria(user.id, "CREAR_RECETA", "recetas", id, { nombre: data.nombre, codigo: data.codigo, ingredientes: data.ingredientes?.length || 0 });
    return NextResponse.json({ id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
