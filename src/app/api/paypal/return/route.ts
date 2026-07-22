/**
 * GET /api/paypal/return?buchungId=..&type=..   (PayPal haengt ?token=<orderId>&PayerID=.. an)
 *
 * Landepunkt nach Kunden-Zustimmung auf PayPal. Zieht die Order ein (capture) und verbucht
 * die Zahlung in Baserow (idempotent — der Webhook macht dasselbe als Backstop, ohne Doppel).
 * Danach Redirect auf die Danke-Seite. So funktioniert der Flow auch, bevor der Webhook
 * registriert ist.
 */
import { NextRequest, NextResponse } from "next/server";
import { captureOrder } from "@/lib/paypal/orders";
import { verbuchePayPalZahlung, type PayPalPaymentType } from "@/lib/eventverleih/paypal-verbuchen";
import { siteBaseUrl } from "@/lib/paypal/pay-link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const base = siteBaseUrl();
  const url = new URL(req.url);
  const orderId = url.searchParams.get("token");
  const typeParam = url.searchParams.get("type");
  const buchungIdParam = parseInt(url.searchParams.get("buchungId") || "", 10);

  if (!orderId) {
    return NextResponse.redirect(`${base}/?paypal=fehler`, { status: 303 });
  }

  try {
    const cap = await captureOrder(orderId);
    // buchungId/type primaer aus der Order (custom_id), Fallback aus den Query-Params.
    const buchungId = cap.buchungId ?? (buchungIdParam || null);
    const paymentType = (cap.paymentType ?? (typeParam as PayPalPaymentType | null)) || null;

    if (cap.alreadyCaptured && cap.captureId && buchungId && paymentType) {
      await verbuchePayPalZahlung({
        buchungId,
        paymentType,
        captureId: cap.captureId,
        amountEur: cap.amountEur,
      });
      return NextResponse.redirect(`${base}/danke?type=${paymentType}&method=paypal`, { status: 303 });
    }

    // Nicht abgeschlossen (z. B. Kunde hat nicht bestaetigt) → zurueck zur Startseite.
    console.warn("[paypal-return] capture nicht abgeschlossen", { orderId, status: cap.status });
    return NextResponse.redirect(`${base}/?paypal=nicht_abgeschlossen`, { status: 303 });
  } catch (e) {
    console.error("[paypal-return]", e instanceof Error ? e.message : e);
    return NextResponse.redirect(`${base}/?paypal=fehler`, { status: 303 });
  }
}
