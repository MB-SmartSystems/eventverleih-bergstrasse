/**
 * POST /api/admin/rechnung/[id]/bezahlt — als bezahlt markieren
 * Body: { zahlungsMethode?: "Bar" | "Ueberweisung" | "PayPal" | "Stripe" }
 *
 * Setzt Status=Bezahlt, Bezahlt_am=heute, Mahnstufe=keine.
 * Legt zusätzlich einen Einnahmen-Eintrag an (für ELSTER-EÜR).
 */
import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { createRow, getRow, updateRow, TABLES } from "@/lib/baserow/client";

const VALID = new Set(["Bar", "Ueberweisung", "PayPal", "Stripe"]);

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const rechnungId = parseInt(id, 10);
  if (!rechnungId) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  let body: { zahlungsMethode?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const methode = body.zahlungsMethode && VALID.has(body.zahlungsMethode) ? body.zahlungsMethode : "Ueberweisung";

  try {
    type R = {
      id: number;
      Rechnungsnummer: string;
      Betrag_Gesamt: string | null;
      Status: { value: string } | null;
    };
    const rechnung = await getRow<R>(TABLES.Rechnungen, rechnungId);
    if (rechnung.Status?.value === "Bezahlt") {
      return NextResponse.json({ ok: true, note: "schon bezahlt" });
    }
    const today = new Date().toISOString().slice(0, 10);
    await updateRow(TABLES.Rechnungen, rechnungId, {
      Status: "Bezahlt",
      Bezahlt_am: today,
      Mahnstufe: "keine",
      Zahlungs_Methode: methode,
    });
    // Einnahmen-Eintrag (best effort, nicht blockierend)
    try {
      const betrag = parseFloat(rechnung.Betrag_Gesamt ?? "0") || 0;
      if (betrag > 0) {
        await createRow(TABLES.Einnahmen, {
          Datum: today,
          Beschreibung: `Rechnung ${rechnung.Rechnungsnummer}`,
          Betrag_Eur: betrag,
          Jahr: new Date().getFullYear(),
          Rechnung_Link: [rechnungId],
        });
      }
    } catch {
      /* Einnahme silent fail — Rechnung-Update wichtiger */
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: "internal error", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
