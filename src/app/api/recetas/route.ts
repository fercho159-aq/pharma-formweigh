import { NextResponse } from "next/server";
import { query, generateId, registrarAuditoria } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const recetas = await query(`
    SELECT r.*, COUNT(DISTINCT f.id) as "numFases", COUNT(i.id) as "numIngredientes"
    FROM recetas r
    LEFT JOIN fases f ON f."recetaId" = r.id
    LEFT JOIN ingredientes i ON i."recetaId" = r.id
    GROUP BY r.id, r.codigo, r.nombre, r.version, r.descripcion, r.rendimiento, r."unidadRendimiento", r.activa, r."createdAt", r."updatedAt"
    ORDER BY r.nombre
  `);
  return NextResponse.json(recetas);
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol === "OPERARIO") return NextResponse.json({ error: "Solo supervisor o admin" }, { status: 403 });

  const data = await request.json();
  const id = generateId();

  try {
    await query(
      `INSERT INTO recetas (id, codigo, nombre, descripcion, rendimiento, "unidadRendimiento")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, data.codigo, data.nombre, data.descripcion || null, data.rendimiento, data.unidadRendimiento]
    );

    let totalIngredientes = 0;
    for (const [faseIndex, fase] of (data.fases || []).entries()) {
      const faseId = generateId();
      await query(
        `INSERT INTO fases (id, "recetaId", nombre, orden, instrucciones) VALUES ($1, $2, $3, $4, $5)`,
        [faseId, id, fase.nombre, faseIndex + 1, fase.instrucciones || null]
      );
      for (const ing of fase.ingredientes || []) {
        const ingId = generateId();
        await query(
          `INSERT INTO ingredientes (id, "recetaId", "faseId", "materialId", orden, "cantidadTarget", "toleranciaMin", "toleranciaMax", instrucciones, peligroso)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [ingId, id, faseId, ing.materialId, ing.orden, ing.cantidadTarget, ing.toleranciaMin, ing.toleranciaMax, ing.instrucciones || null, ing.peligroso ? true : false]
        );
        totalIngredientes++;
      }
    }

    await registrarAuditoria(user.id, "CREAR_RECETA", "recetas", id, { nombre: data.nombre, codigo: data.codigo, fases: data.fases?.length || 0, ingredientes: totalIngredientes });
    return NextResponse.json({ id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
