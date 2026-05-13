/**
 * POST /api/admin/position/[id]/update — Anzahl + Einzelpreis einer Position aendern
 * Body: { anzahl: number, einzelpreis: number, buchungId: number }
 */
import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { updateRow, TABLES } from "@/lib/baserow/client";
import { recalcBuchung } from "@/lib/buchung-recalc";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const positionId = parseInt(id, 10);
  if (!positionId) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  let body: { anzahl?: number; einzelpreis?: number; buchungId?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (typeof body.anzahl !== "number" || body.anzahl < 1) return NextResponse.json({ error: "anzahl invalid" }, { status: 400 });
  if (typeof body.einzelpreis !== "number" || body.einzelpreis < 0) return NextResponse.json({ error: "einzelpreis invalid" }, { status: 400 });
  if (typeof body.buchungId !== "number") return NextResponse.json({ error: "buchungId required" }, { status: 400 });

  try {
    await updateRow(TABLES.Buchungs_Position, positionId, {
      Anzahl: body.anzahl,
      Einzelpreis_Eur: body.einzelpreis,
    });
    await recalcBuchung(body.buchungId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: "internal error", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
