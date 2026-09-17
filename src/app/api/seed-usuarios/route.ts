import { NextResponse } from "next/server";
import { query, queryOne, generateId, hashPassword } from "@/lib/db";

export async function POST() {
  const nuevosUsuarios = [
    { nombre: "Ing. Ramírez Desarrollo", email: "desarrollo@pharma.com", password: "desarrollo123", rol: "DESARROLLO", badge: "BADGE-DES-001" },
    { nombre: "QA Martínez Calidad", email: "calidad@pharma.com", password: "calidad123", rol: "CALIDAD", badge: "BADGE-CAL-001" },
    { nombre: "Almacenista Torres", email: "almacen@pharma.com", password: "almacen123", rol: "ALMACEN", badge: "BADGE-ALM-001" },
    { nombre: "Auditor Hernández", email: "auditor@pharma.com", password: "auditor123", rol: "AUDITOR", badge: "BADGE-AUD-001" },
  ];

  const creados: string[] = [];
  const existentes: string[] = [];

  for (const u of nuevosUsuarios) {
    const existe = await queryOne("SELECT id FROM usuarios WHERE email = $1", [u.email]);
    if (existe) {
      existentes.push(u.email);
      continue;
    }
    const id = generateId();
    await query(
      `INSERT INTO usuarios (id, nombre, email, password, rol, badge) VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, u.nombre, u.email, hashPassword(u.password), u.rol, u.badge]
    );
    creados.push(u.email);
  }

  return NextResponse.json({ creados, existentes, mensaje: `${creados.length} usuarios creados, ${existentes.length} ya existían` });
}
