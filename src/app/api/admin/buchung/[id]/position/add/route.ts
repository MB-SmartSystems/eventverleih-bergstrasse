/**
 * POST /api/admin/buchung/[id]/position/add
 * Body: { artikelId: number, anzahl: number, einzelpreis: number }
 */
import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { createRow, TABLES } from "@/lib/baserow/client";
import { recalcBuchung } from "@/lib/buchung-recalc";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const buchungId = parseInt(id, 10);
  if (!buchungId) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  let body: { artikelId?: number; anzahl?: number; einzelpreis?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (typeof body.artikelId !== "number") return NextResponse.json({ error: "artikelId required" }, { status: 400 });
  if (typeof body.anzahl !== "number" || body.anzahl < 1) return NextResponse.json({ error: "anzahl invalid" }, { status: 400 });
  if (typeof body.einzelpreis !== "number" || body.einzelpreis < 0) return NextResponse.json({ error: "einzelpreis invalid" }, { status: 400 });

  try {
    await createRow(TABLES.Buchungs_Position, {
      Buchung_Link: [buchungId],
      Artikel_Link: [body.artikelId],
      Anzahl: body.anzahl,
      Einzelpreis_Eur: body.einzelpreis,
    });
    await recalcBuchung(buchungId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: "internal error", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
