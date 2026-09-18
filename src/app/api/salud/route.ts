import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";

export const dynamic = "force-dynamic";

/** Salud para Docker, el wrapper de deploy y el monitoreo: 200 solo si la BD responde. */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ ok: true, bd: "ok" });
  } catch {
    return NextResponse.json({ ok: false, bd: "caida" }, { status: 503 });
  }
}
