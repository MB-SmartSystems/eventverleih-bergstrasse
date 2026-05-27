/**
 * POST /api/admin/buchung/[id]/kaution-mail
 *
 * Erzeugt eine Stripe-Checkout-Session mit capture_method=manual (Kaution-Hold)
 * und sendet dem Kunden eine Mail mit dem Hold-Link. Der Kunde klickt, hinterlegt
 * die Karte — Stripe blockiert den Betrag, bucht nichts ab. Webhook
 * `payment_intent.amount_capturable_updated` setzt Buchung.Stripe_Kaution_PaymentIntent
 * und Kaution_Hinterlegt_am.
 *
 * Die eigentliche Logik (Link erzeugen, Mail-Body, MailQueue) steckt im Helper
 * queueKautionHoldMail() — denselben nutzt der Auto-Versand-Cron kaution-reminder.
 *
 * Idempotenz: Wenn schon ein Stripe_Kaution_Link existiert UND noch kein
 * Kaution_Hinterlegt_am, wird der bestehende Link wiederverwendet und nochmal
 * gemailt. Wenn Hold schon platziert → 409, kein Re-Send.
 *
 * Body (optional): { amount_eur?: number }  — sonst Kaution_Soll_Eur.
 */
import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { queueKautionHoldMail } from "@/lib/eventverleih/kaution-mail";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const buchungId = parseInt(id, 10);
  if (!buchungId) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  let body: { amount_eur?: number } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  try {
    const res = await queueKautionHoldMail({ buchungId, amountEur: body.amount_eur });
    if (!res.ok) {
      if (res.reason === "already_placed") {
        return NextResponse.json(
          {
            error: "kaution_bereits_hinterlegt",
            detail: `Kaution-Hold ist bereits platziert (${res.detail}). Kein erneuter Versand.`,
          },
          { status: 409 },
        );
      }
      const msgMap: Record<string, string> = {
        no_amount: "Kaution_Soll_Eur fehlt oder ist 0 — bitte amount_eur uebergeben oder Buchung pflegen",
        no_kunde: "Kunde nicht verknuepft",
        no_email: "Kunde hat keine E-Mail-Adresse",
      };
      return NextResponse.json({ error: msgMap[res.reason] || res.reason }, { status: 422 });
    }
    return NextResponse.json({
      ok: true,
      link_url: res.link_url,
      reused: res.reused,
      mail_queued: true,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "internal error";
    console.error("[kaution-mail]", msg);
    return NextResponse.json({ error: "internal", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
