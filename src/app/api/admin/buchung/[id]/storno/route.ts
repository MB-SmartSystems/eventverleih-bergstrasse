/**
 * POST /api/admin/buchung/[id]/storno
 *
 * Body: {
 *   storno_grund: "Konflikt_verloren"|"Kunden_Wunsch"|"Manuel_Entscheidung"|"No_Show"|"Anzahlung_nicht_geleistet"|"Sonstig",
 *   erstattung_eur: number,         // berechnet aus Settings, kann von Manuel ueberschrieben werden
 *   refund_via_stripe: boolean,     // wenn true: Stripe-Refund triggern
 *   stripe_payment_intent_id?: string,  // wird ggf. spaeter durch Webhook automatisiert
 *   notiz?: string,
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import { getRow, updateRow, createRow, TABLES } from "@/lib/baserow/client";
import { invalidateAvailabilityCache } from "@/lib/eventverleih/availability";
import { refundPayment } from "@/lib/stripe/payment-links";
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
    const grund = body.storno_grund || "Sonstig";
    const erstattungEur = Number(body.erstattung_eur || 0);
    const refundViaStripe = !!body.refund_via_stripe;

    // PaymentIntent für den Refund: explizit aus dem Body, sonst die gespeicherte
    // Miet-Zahlungs-PI der Buchung (NICHT die Kaution-Hold-PI).
    let intentId: string | undefined = body.stripe_payment_intent_id || undefined;
    if (refundViaStripe && erstattungEur > 0 && !intentId) {
      const b = await getRow<{ Stripe_Zahlung_PaymentIntent: string | null }>(TABLES.Buchungen, buchungId);
      intentId = b.Stripe_Zahlung_PaymentIntent || undefined;
    }
    // Refund gewünscht, aber keine PI auffindbar: Buchung NICHT still als storniert
    // markieren — sonst gilt sie als erstattet, ohne dass je Geld zurückfloss.
    if (refundViaStripe && erstattungEur > 0 && !intentId) {
      return NextResponse.json(
        {
          error: "kein_payment_intent",
          detail:
            "Refund angefordert, aber keine Stripe-Zahlungs-PaymentIntent-ID hinterlegt. Bitte den Refund direkt in Stripe ausführen.",
        },
        { status: 422 },
      );
    }

    let stripeResult: string | null = null;
    if (refundViaStripe && intentId && erstattungEur > 0) {
      try {
        const refund = await refundPayment(intentId, erstattungEur);
        stripeResult = `refunded_${refund.id}`;
      } catch (e) {
        console.error("[storno stripe-refund]", e);
        return NextResponse.json(
          { error: "stripe_refund_failed", detail: String(e).slice(0, 200) },
          { status: 500 },
        );
      }
    }

    await updateRow(TABLES.Buchungen, buchungId, {
      Status_Erweitert: grund === "No_Show" ? "No_Show" : "Storniert",
      Storno_Grund: grund,
      Storno_am: new Date().toISOString().slice(0, 10),
      Storno_Betrag_Eur: erstattungEur,
    });

    // Audit
    try {
      await createRow(TABLES.Audit_Log, {
        Name: `Storno Buchung #${buchungId}`,
        Aktion: "Storno",
        Zeitpunkt: new Date().toISOString(),
        Buchung_ID_Ref: String(buchungId),
        Akteur: "Backoffice",
        Details: JSON.stringify({
          grund,
          erstattung_eur: erstattungEur,
          stripe: stripeResult,
          notiz: body.notiz || "",
        }),
        Aktiv: true,
      });
    } catch (e) {
      console.error("[storno audit-log]", e);
    }

    invalidateAvailabilityCache();
    return NextResponse.json({ ok: true, stripe: stripeResult });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "internal error";
    return NextResponse.json({ error: "internal", detail: msg.slice(0, 200) }, { status: 500 });
  }
}
