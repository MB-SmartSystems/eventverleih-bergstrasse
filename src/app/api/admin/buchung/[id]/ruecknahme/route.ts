/**
 * POST /api/admin/buchung/[id]/ruecknahme
 *
 * Body JSON: {
 *   foto_urls: string[],
 *   schaden: Array<{ position_id?: number, beschreibung: string, betrag_eur: number }>,
 *   schaden_betrag_eur: number,     // Summe (kann auch frei gesetzt werden)
 *   kaution_aufloesung: "cancel" | "capture_full" | "capture_partial",
 *   kaution_capture_eur?: number,
 *   notiz?: string,
 *   ruecknahme_datum?: string,
 * }
 *
 * Setzt Status_Erweitert = "Zurueckgegeben", speichert alle Felder.
 * Wenn capture_partial/capture_full: Stripe-Capture via lib/stripe/payment-links.
 */
import { NextRequest, NextResponse } from "next/server";
import { getRow, updateRow, createRow, TABLES } from "@/lib/baserow/client";
import { captureKaution, cancelKaution } from "@/lib/stripe/payment-links";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const buchungId = parseInt(params.id, 10);
  if (!buchungId) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  try {
    const body = await req.json();
    const fotoUrls = Array.isArray(body.foto_urls) ? body.foto_urls : [];
    const schaden = Array.isArray(body.schaden) ? body.schaden : [];
    const schadenBetrag = Number(body.schaden_betrag_eur || 0);
    const kautionAufloesung = body.kaution_aufloesung as
      | "cancel"
      | "capture_full"
      | "capture_partial"
      | undefined;

    // Stripe-Kaution behandeln (wenn Pre-Auth gesetzt)
    const buchung = await getRow<{
      Stripe_Kaution_PaymentIntent: string | null;
      Kaution_Soll_Eur: number | null;
    }>(TABLES.Buchungen, buchungId);

    let stripeResult: string | null = null;
    if (buchung.Stripe_Kaution_PaymentIntent && kautionAufloesung) {
      try {
        if (kautionAufloesung === "cancel") {
          await cancelKaution(buchung.Stripe_Kaution_PaymentIntent);
          stripeResult = "kaution_canceled";
        } else if (kautionAufloesung === "capture_full") {
          await captureKaution(buchung.Stripe_Kaution_PaymentIntent);
          stripeResult = "kaution_captured_full";
        } else if (kautionAufloesung === "capture_partial") {
          const capEur = Number(body.kaution_capture_eur || schadenBetrag);
          if (capEur > 0) {
            await captureKaution(buchung.Stripe_Kaution_PaymentIntent, capEur);
            stripeResult = `kaution_captured_${capEur}eur`;
          }
        }
      } catch (e) {
        console.error("[ruecknahme stripe]", e);
        return NextResponse.json(
          { error: "stripe_failed", detail: String(e).slice(0, 200) },
          { status: 500 },
        );
      }
    }

    const patch: Record<string, unknown> = {
      Status_Erweitert: "Zurueckgegeben",
      Ruecknahme_Foto_URLs: JSON.stringify(fotoUrls),
      Ruecknahme_Schaden_JSON: JSON.stringify(schaden),
      Ruecknahme_Datum: body.ruecknahme_datum || new Date().toISOString().slice(0, 10),
    };
    if (schadenBetrag > 0) {
      patch.Schaden_Betrag_Eur = schadenBetrag;
      patch.Schaden_Dokumentiert_am = new Date().toISOString().slice(0, 10);
      patch.Schaden_Foto_URLs = JSON.stringify(fotoUrls);
    }
    if (kautionAufloesung === "cancel" && buchung.Kaution_Soll_Eur) {
      patch.Kaution_Rueckzahlung_Eur = buchung.Kaution_Soll_Eur;
      patch.Kaution_Rueckzahlung_am = new Date().toISOString().slice(0, 10);
    }

    await updateRow(TABLES.Buchungen, buchungId, patch);

    // Audit-Log
    try {
      await createRow(TABLES.Audit_Log, {
        Name: `Ruecknahme Buchung #${buchungId}`,
        Aktion: schadenBetrag > 0 ? "Schaden_dokumentiert" : "Buchung_erstellt",
        Zeitpunkt: new Date().toISOString(),
        Buchung_ID_Ref: String(buchungId),
        Akteur: "Backoffice",
        Details: JSON.stringify({
          schaden_betrag: schadenBetrag,
          schaden_count: schaden.length,
          foto_count: fotoUrls.length,
          stripe: stripeResult,
          notiz: body.notiz || "",
        }),
        Aktiv: true,
      });
    } catch (e) {
      console.error("[ruecknahme audit-log]", e);
    }

    return NextResponse.json({ ok: true, stripe: stripeResult });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "internal error";
    return NextResponse.json({ error: "internal", detail: msg.slice(0, 200) }, { status: 500 });
  }
}
