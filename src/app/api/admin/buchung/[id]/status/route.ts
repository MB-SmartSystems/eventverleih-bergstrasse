/**
 * POST /api/admin/buchung/[id]/status — Buchungs-Status updaten
 * Body: { status: <Status_Erweitert-Wert> }
 */
import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { updateRow, TABLES } from "@/lib/baserow/client";

const VALID = new Set([
  "Anfrage",
  "Angebot_erstellt",
  "Angebot_versendet",
  "Reserviert",
  "Bestaetigt",
  "Uebergeben",
  "In_Miete",
  "Zurueckgegeben",
  "Abgerechnet",
  "Storniert",
  "No_Show",
]);

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const buchungId = parseInt(id, 10);
  if (!buchungId) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.status || !VALID.has(body.status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = { Status_Erweitert: body.status };
  if (body.status === "Storniert") {
    updateData.Storno_am = new Date().toISOString().slice(0, 10);
  }
  try {
    await updateRow(TABLES.Buchungen, buchungId, updateData);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: "internal error", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
