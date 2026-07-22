/**
 * POST /api/paypal/create-order
 * Body: { buchungId: number, type: "anzahlung"|"restzahlung"|"komplettzahlung", sig: string }
 *
 * Oeffentlich, aber signatur-geschuetzt (sig aus buildPayUrl). Erzeugt eine PayPal-Order
 * mit dem AKTUELLEN Soll-Betrag der Buchung und liefert die approveUrl (PayPal-Zahlseite).
 * Der Kunde wird dorthin weitergeleitet; nach Zustimmung ruft PayPal unseren return_url auf.
 */
import { NextRequest, NextResponse } from "next/server";
import { getRow, TABLES } from "@/lib/baserow/client";
import { createOrder } from "@/lib/paypal/orders";
import {
  verifyPayLink,
  defaultAmountFor,
  siteBaseUrl,
  type PayPalPaymentType,
  type BetragsFelder,
} from "@/lib/paypal/pay-link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: PayPalPaymentType[] = ["anzahlung", "restzahlung", "komplettzahlung"];

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const buchungId = parseInt(String(body.buchungId ?? ""), 10);
  const type = body.type as PayPalPaymentType;
  const sig = String(body.sig ?? "");

  if (!buchungId || !TYPES.includes(type)) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  }
  if (!verifyPayLink(buchungId, type, sig)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 403 });
  }

  try {
    const buchung = await getRow<
      BetragsFelder & {
        Status_Erweitert: { value: string } | null;
        Restzahlung_Bezahlt_am: string | null;
        Anzahlung_Bezahlt_am: string | null;
      }
    >(TABLES.Buchungen, buchungId);

    // Doppelzahlungs-Guard (weich): schon bezahlt → nicht erneut zur Kasse.
    const status = buchung.Status_Erweitert?.value || "";
    const reserviertStati = new Set(["Reserviert", "Uebergeben", "In_Miete", "Zurueckgegeben", "Abgerechnet"]);
    if ((type === "anzahlung" || type === "komplettzahlung") && reserviertStati.has(status)) {
      return NextResponse.json({ error: "bereits_bezahlt", note: `status:${status}` }, { status: 409 });
    }
    if (type === "restzahlung" && buchung.Restzahlung_Bezahlt_am) {
      return NextResponse.json({ error: "bereits_bezahlt", note: "restzahlung" }, { status: 409 });
    }

    const amount = defaultAmountFor(buchung, type);
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "kein_betrag", note: `type:${type}` }, { status: 422 });
    }

    const base = siteBaseUrl();
    const { orderId, approveUrl } = await createOrder({
      buchungId,
      paymentType: type,
      amountEur: amount,
      returnUrl: `${base}/api/paypal/return?buchungId=${buchungId}&type=${type}`,
      cancelUrl: `${base}/pay/paypal/${buchungId}/${type}?sig=${sig}&abgebrochen=1`,
    });

    return NextResponse.json({ ok: true, orderId, approveUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "internal";
    console.error("[paypal-create-order]", msg);
    return NextResponse.json({ error: "internal", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
