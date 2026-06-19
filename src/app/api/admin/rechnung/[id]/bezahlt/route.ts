/**
 * POST /api/admin/rechnung/[id]/bezahlt — als bezahlt markieren
 * Body: { zahlungsMethode?: "Bar" | "Ueberweisung" | "PayPal" | "Stripe" }
 *
 * Setzt Status=Bezahlt, Bezahlt_am=heute, Mahnstufe=keine.
 * Legt zusätzlich einen Einnahmen-Eintrag an (für ELSTER-EÜR).
 */
import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getRow, updateRow, TABLES } from "@/lib/baserow/client";
import { bucheEinnahme, bookingHatEinnahme } from "@/lib/eventverleih/einnahme";

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
      Buchung_Link: Array<{ id: number }> | null;
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
    // Einnahme (best effort, nicht blockierend). Modell A = Zuflussprinzip: die
    // Einnahme entsteht normalerweise schon beim Zahlungseingang (Stripe-Webhook /
    // manuelle Erfassung). Hier deshalb nur als FALLBACK buchen, wenn die Buchung noch
    // gar keine Zufluss-Einnahme hat (z. B. Bar direkt über die Rechnung markiert) —
    // sonst entstünde eine doppelte EÜR-Einnahme. `bucheEinnahme` ist zusätzlich
    // idempotent über den Marker `rechnung-<id>`.
    try {
      const betrag = parseFloat(rechnung.Betrag_Gesamt ?? "0") || 0;
      const buchungId = rechnung.Buchung_Link?.[0]?.id;
      const schonGebucht = buchungId ? await bookingHatEinnahme(buchungId) : false;
      if (betrag > 0 && !schonGebucht) {
        await bucheEinnahme({
          buchungId: buchungId ?? 0,
          quelle: `rechnung-${rechnungId}`,
          betragEur: betrag,
          datum: today,
          beschreibung: `Rechnung ${rechnung.Rechnungsnummer}`,
          rechnungId,
        });
      }
    } catch {
      /* Einnahme silent fail — Rechnung-Update wichtiger */
    }
    // Verknuepfte Buchung abschliessen: zurueckgegeben + Rechnung bezahlt -> Abgerechnet.
    // Guard auf "Zurueckgegeben", damit eine frueh bezahlte Rechnung (Equipment noch draussen)
    // die Buchung nicht vorzeitig schliesst.
    try {
      const buchungId = rechnung.Buchung_Link?.[0]?.id;
      if (buchungId) {
        const b = await getRow<{ Status_Erweitert: { value: string } | null }>(TABLES.Buchungen, buchungId);
        if (b.Status_Erweitert?.value === "Zurueckgegeben") {
          await updateRow(TABLES.Buchungen, buchungId, { Status_Erweitert: "Abgerechnet" });
        }
      }
    } catch (e) {
      console.error("[rechnung-bezahlt] Buchung-Abschluss fehlgeschlagen:", e);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: "internal error", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
