/**
 * POST /api/admin/buchung/[id]/zahlung
 * Body: { typ: "anzahlung" | "restzahlung" | "kaution", datum: "YYYY-MM-DD" }
 *
 * Setzt das jeweilige Bezahlt_am/Hinterlegt_am-Feld.
 * Bei typ=anzahlung zusätzlich Status_Erweitert=Bestaetigt (verbindliche Reservierung).
 */
import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { updateRow, TABLES } from "@/lib/baserow/client";

const TYPEN = new Set(["anzahlung", "restzahlung", "kaution"]);

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const buchungId = parseInt(id, 10);
  if (!buchungId) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  let body: { typ?: string; datum?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.typ || !TYPEN.has(body.typ)) return NextResponse.json({ error: "invalid typ" }, { status: 400 });
  if (!body.datum || !/^\d{4}-\d{2}-\d{2}$/.test(body.datum)) return NextResponse.json({ error: "datum erwartet YYYY-MM-DD" }, { status: 400 });

  const iso = `${body.datum}T12:00:00Z`;
  const patch: Record<string, unknown> = {};
  if (body.typ === "anzahlung") {
    patch.Anzahlung_Bezahlt_am = iso;
    patch.Status_Erweitert = "Bestaetigt";
  } else if (body.typ === "restzahlung") {
    patch.Restzahlung_Bezahlt_am = iso;
  } else if (body.typ === "kaution") {
    patch.Kaution_Hinterlegt_am = iso;
  }

  try {
    await updateRow(TABLES.Buchungen, buchungId, patch);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: "internal error", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
