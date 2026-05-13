/**
 * POST /api/admin/rechnung/[id]/mahnung — Mahnstufe setzen
 * Body: { stufe: "keine" | "M1" | "M2" | "M3" | "Inkasso" }
 */
import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { updateRow, TABLES } from "@/lib/baserow/client";

const VALID = new Set(["keine", "M1", "M2", "M3", "Inkasso"]);

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const rechnungId = parseInt(id, 10);
  if (!rechnungId) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  let body: { stufe?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.stufe || !VALID.has(body.stufe)) {
    return NextResponse.json({ error: "invalid stufe" }, { status: 400 });
  }
  const data: Record<string, unknown> = { Mahnstufe: body.stufe };
  if (body.stufe !== "keine") {
    data.Mahn_Datum = new Date().toISOString().slice(0, 10);
  }
  try {
    await updateRow(TABLES.Rechnungen, rechnungId, data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: "internal error", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
