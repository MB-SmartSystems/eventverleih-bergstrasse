/**
 * POST /api/admin/buchung/[id]/uebergabe-typ
 * Body: { typ: "Standard" | "Beim_Kunden" | "Lieferung" }
 *
 * Setzt das Übergabe_Typ-Feld auf Buchung #id.
 */
import { NextRequest, NextResponse } from "next/server";
import { updateRow, TABLES } from "@/lib/baserow/client";
import { isAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

const VALID = new Set(["Standard", "Beim_Kunden", "Lieferung"]);

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const buchungId = parseInt(id, 10);
  if (!buchungId) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  let body: { typ?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const typ = body.typ ?? "";
  if (!VALID.has(typ)) {
    return NextResponse.json({ error: "invalid typ", valid: ["Standard", "Beim_Kunden", "Lieferung"] }, { status: 400 });
  }

  try {
    await updateRow(TABLES.Buchungen, buchungId, { Übergabe_Typ: typ });
    return NextResponse.json({ ok: true, typ });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "internal error";
    return NextResponse.json({ error: "internal", detail: msg.slice(0, 200) }, { status: 500 });
  }
}
