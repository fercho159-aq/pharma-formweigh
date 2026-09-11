import { NextResponse } from "next/server";
import { query, generateId, registrarAuditoria } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const recetas = await query(`
    SELECT r.*, COUNT(i.id) as "numIngredientes"
    FROM recetas r
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

    for (const ing of data.ingredientes || []) {
      const ingId = generateId();
      await query(
        `INSERT INTO ingredientes (id, "recetaId", "materialId", orden, "cantidadTarget", "toleranciaMin", "toleranciaMax", instrucciones, peligroso)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [ingId, id, ing.materialId, ing.orden, ing.cantidadTarget, ing.toleranciaMin, ing.toleranciaMax, ing.instrucciones || null, ing.peligroso ? true : false]
      );
    }

    await registrarAuditoria(user.id, "CREAR_RECETA", "recetas", id, { nombre: data.nombre, codigo: data.codigo, ingredientes: data.ingredientes?.length || 0 });
    return NextResponse.json({ id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
