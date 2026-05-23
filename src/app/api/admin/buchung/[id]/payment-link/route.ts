/**
 * POST /api/admin/buchung/[id]/payment-link
 *
 * Body: { type: "anzahlung" | "restzahlung" | "kaution" | "komplettzahlung", amount_eur?: number }
 *
 * - anzahlung/restzahlung: Stripe-Payment-Link (Standard-Charge), URL in Stripe_*_Link.
 * - komplettzahlung: Stripe-Payment-Link ueber Gesamt-Mietsumme (Preis_Artikel + Lieferung
 *   + Aufbau, ohne Kaution), URL in Stripe_Komplettzahlung_Link. Webhook erkennt anhand
 *   metadata.payment_type und setzt Anzahlung_Bezahlt_am + Restzahlung_Bezahlt_am gleichzeitig.
 * - kaution: Stripe-Checkout-Session mit capture_method=manual (Pre-Auth-Hold). URL in
 *   Stripe_Kaution_Link. Bei Bezahlung blockiert Stripe den Betrag (kein Charge),
 *   Webhook setzt Stripe_Kaution_PaymentIntent. Aufloesung bei Rueckgabe via cancel/capture.
 *
 * amount_eur optional — Default:
 *   anzahlung → Anzahlung_Soll_Eur
 *   restzahlung → Restzahlung_Soll_Eur
 *   komplettzahlung → Preis_Artikel + Preis_Lieferung + Preis_Abholung + Preis_Aufbau (Gesamt ohne Kaution)
 *   kaution → Kaution_Soll_Eur
 */
import { NextRequest, NextResponse } from "next/server";
import { getRow, updateRow, TABLES } from "@/lib/baserow/client";
import { createPaymentLink, createKautionCheckoutSession } from "@/lib/stripe/payment-links";
import { isAuthenticated } from "@/lib/auth";

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

  const body = await req.json().catch(() => ({}));
  const type = body.type as "anzahlung" | "restzahlung" | "kaution" | "komplettzahlung" | undefined;
  if (type !== "anzahlung" && type !== "restzahlung" && type !== "kaution" && type !== "komplettzahlung") {
    return NextResponse.json({ error: "type must be anzahlung|restzahlung|kaution|komplettzahlung" }, { status: 400 });
  }

  try {
    const buchung = await getRow<{
      id: number;
      Anzahlung_Soll_Eur: number | null;
      Restzahlung_Soll_Eur: number | null;
      Kaution_Soll_Eur: number | null;
      Preis_Artikel: string | number | null;
      Preis_Lieferung: string | number | null;
      Preis_Abholung: string | number | null;
      Preis_Aufbau: string | number | null;
      Kunde_Link: Array<{ id: number; value: string }> | null;
      Event_datum_von: string | null;
    }>(TABLES.Buchungen, buchungId);

    const parseDec = (v: string | number | null | undefined): number => {
      if (v === null || v === undefined) return 0;
      if (typeof v === "number") return v;
      const n = parseFloat(String(v));
      return isNaN(n) ? 0 : n;
    };

    // Default-Betrag berechnen je nach Type
    let defaultAmount = 0;
    if (type === "anzahlung") defaultAmount = parseDec(buchung.Anzahlung_Soll_Eur);
    else if (type === "restzahlung") defaultAmount = parseDec(buchung.Restzahlung_Soll_Eur);
    else if (type === "kaution") defaultAmount = parseDec(buchung.Kaution_Soll_Eur);
    else if (type === "komplettzahlung") {
      // Komplettzahlung = Mietsumme + Lieferung + Abholung + Aufbau (ohne Kaution)
      defaultAmount = parseDec(buchung.Preis_Artikel) +
                      parseDec(buchung.Preis_Lieferung) +
                      parseDec(buchung.Preis_Abholung) +
                      parseDec(buchung.Preis_Aufbau);
    }

    const amountEur = body.amount_eur ?? defaultAmount;
    if (!amountEur || amountEur <= 0) {
      return NextResponse.json(
        { error: `Betrag fuer ${type} fehlt — bitte amount_eur im Body uebergeben oder Soll-Felder pflegen` },
        { status: 422 },
      );
    }

    const kundeName = buchung.Kunde_Link?.[0]?.value || "Kunde";

    if (type === "kaution") {
      const session = await createKautionCheckoutSession({
        buchungId,
        amountEur: Number(amountEur),
        kundeName,
      });
      await updateRow(TABLES.Buchungen, buchungId, { Stripe_Kaution_Link: session.url });
      return NextResponse.json({ ok: true, link_url: session.url, session_id: session.session_id });
    }

    const desc =
      type === "anzahlung"
        ? `Anzahlung Buchung #${buchungId} — Event ${buchung.Event_datum_von || ""}`
        : type === "komplettzahlung"
          ? `Komplettzahlung Buchung #${buchungId} — Event ${buchung.Event_datum_von || ""}`
          : `Restzahlung Buchung #${buchungId} — Event ${buchung.Event_datum_von || ""}`;

    const link = await createPaymentLink({
      buchungId,
      paymentType: type,
      amountEur: Number(amountEur),
      kundeName,
      description: desc,
    });

    const updateField =
      type === "anzahlung" ? "Stripe_Anzahlung_Link" :
      type === "komplettzahlung" ? "Stripe_Komplettzahlung_Link" :
      "Stripe_Restzahlung_Link";
    await updateRow(TABLES.Buchungen, buchungId, { [updateField]: link.link_url });

    return NextResponse.json({ ok: true, link_url: link.link_url, link_id: link.link_id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "internal error";
    console.error("[payment-link]", msg);
    return NextResponse.json({ error: "internal", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
