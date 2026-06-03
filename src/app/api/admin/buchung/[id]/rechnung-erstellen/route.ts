/**
 * POST /api/admin/buchung/[id]/rechnung-erstellen
 *
 * Erstellt eine komplette Rechnung (Beleg) + triggert den n8n-Beleg-Mail-Workflow.
 * Kernlogik liegt im Helper createRechnungForBuchung (auch von kaution-erstatten genutzt).
 */
import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { createRechnungForBuchung } from "@/lib/eventverleih/rechnung";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const buchungId = parseInt(id, 10);
  if (!buchungId) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  try {
    const res = await createRechnungForBuchung(buchungId, { sendMail: true });
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status });
    }
    return NextResponse.json({
      ok: true,
      rechnung_id: res.rechnung_id,
      rechnungsnummer: res.rechnungsnummer,
      token: res.token,
      url: res.url,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    console.error("[rechnung-erstellen] failed:", msg);
    return NextResponse.json({ error: "internal error", detail: msg.slice(0, 500) }, { status: 500 });
  }
}
