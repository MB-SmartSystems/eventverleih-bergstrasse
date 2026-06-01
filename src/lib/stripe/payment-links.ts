/**
 * Payment-Link-Generator fuer Eventverleih-Buchungen.
 *
 * Pro Buchung werden Stripe-Payment-Links erzeugt:
 *   - Anzahlung (typ. 30%)
 *   - Restzahlung (verbleibender Betrag)
 *
 * Metadata: buchung_id + payment_type — Webhook-Handler routet via Metadata.
 *
 * Kaution wird separat als PaymentIntent mit `capture_method: "manual"` gehandled
 * (siehe lib/stripe/kaution.ts).
 */
import { getStripe } from "./client";

export type PaymentType = "anzahlung" | "restzahlung" | "komplettzahlung";

interface CreatePaymentLinkParams {
  buchungId: number;
  paymentType: PaymentType;
  amountEur: number;
  kundeName: string;
  kundeEmail?: string;
  description?: string;
}

interface PaymentLinkResult {
  link_url: string;
  link_id: string;
}

export async function createPaymentLink(
  params: CreatePaymentLinkParams,
): Promise<PaymentLinkResult> {
  const stripe = getStripe();
  const amountCents = Math.round(params.amountEur * 100);
  if (amountCents <= 0) {
    throw new Error(`Invalid amount: ${params.amountEur}`);
  }

  // Stripe Payment Link mit Inline Price (kein vorab-Produkt noetig)
  const product = await stripe.products.create({
    name:
      params.description ||
      `Eventverleih-${params.paymentType} Buchung #${params.buchungId}`,
    metadata: {
      buchung_id: String(params.buchungId),
      payment_type: params.paymentType,
    },
  });

  const price = await stripe.prices.create({
    currency: "eur",
    unit_amount: amountCents,
    product: product.id,
  });

  const link = await stripe.paymentLinks.create({
    line_items: [{ price: price.id, quantity: 1 }],
    metadata: {
      buchung_id: String(params.buchungId),
      payment_type: params.paymentType,
      kunde_name: params.kundeName.slice(0, 250),
    },
    payment_intent_data: {
      metadata: {
        buchung_id: String(params.buchungId),
        payment_type: params.paymentType,
      },
    },
    after_completion: {
      type: "hosted_confirmation",
      hosted_confirmation: {
        custom_message:
          params.paymentType === "anzahlung"
            ? "Vielen Dank! Ihre Anzahlung ist eingegangen — die Reservierung ist jetzt verbindlich. Sie erhalten in Kuerze eine Bestaetigung per Mail."
            : params.paymentType === "komplettzahlung"
              ? "Vielen Dank! Die Buchung ist komplett bezahlt — die Reservierung ist verbindlich. Sie erhalten in Kuerze eine Bestaetigung per Mail."
              : "Vielen Dank! Restzahlung eingegangen — wir freuen uns auf Ihr Event.",
      },
    },
  });

  return { link_url: link.url, link_id: link.id };
}

/**
 * Kaution als Pre-Auth-Hold (capture_method: manual).
 * Wird im Uebergabe-Dialog erzeugt, im Rueckgabe-Dialog gecaptured (Schaden) oder gecancelled (kein Schaden).
 *
 * NOTE: Standard-Hold haelt 7 Tage. Mit `request_extended_authorization: "if_available"`
 * versucht Stripe bis zu 30 Tage Hold zu erreichen (klappt bei Visa/Mastercard, nicht bei
 * AmEx). Bei laengeren Mietzeitraeumen Fallback Bar/Ueberweisung in AGB.
 */
export async function createKautionPreAuth(params: {
  buchungId: number;
  amountEur: number;
  kundeName: string;
  kundeEmail?: string;
}): Promise<{ payment_intent_id: string; client_secret: string }> {
  const stripe = getStripe();
  const amountCents = Math.round(params.amountEur * 100);
  const intent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: "eur",
    capture_method: "manual",
    description: `Kaution Buchung #${params.buchungId} — ${params.kundeName}`,
    metadata: {
      buchung_id: String(params.buchungId),
      payment_type: "kaution",
    },
    automatic_payment_methods: { enabled: true },
    payment_method_options: {
      card: { request_extended_authorization: "if_available" },
    },
  });
  return {
    payment_intent_id: intent.id,
    client_secret: intent.client_secret || "",
  };
}

/**
 * Kaution-Checkout-Session — hosted Stripe-Seite mit Karteneingabe, capture_method=manual.
 * Liefert eine URL die wir dem Kunden per Mail/Link schicken koennen. Stripe blockiert beim
 * Bezahlen den Betrag (Hold), kein Geld fliesst. Webhook `payment_intent.amount_capturable_updated`
 * markiert die Buchung als hold-platziert; Auflösung dann ueber cancelKaution / captureKaution.
 */
export async function createKautionCheckoutSession(params: {
  buchungId: number;
  amountEur: number;
  kundeName: string;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<{ url: string; session_id: string }> {
  const stripe = getStripe();
  const amountCents = Math.round(params.amountEur * 100);
  if (amountCents <= 0) {
    throw new Error(`Invalid amount: ${params.amountEur}`);
  }
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://eventverleih-bergstrasse.de";
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: amountCents,
          product_data: {
            name: `Kaution Buchung #${params.buchungId}`,
            description: "Kaution wird als Pre-Authorization auf der Karte vorgemerkt — kein Abbuchen vor Rueckgabe. Bei Rueckgabe ohne Schaden wird der Hold aufgeloest, es fliesst kein Geld.",
          },
        },
      },
    ],
    payment_intent_data: {
      capture_method: "manual",
      description: `Kaution Buchung #${params.buchungId} — ${params.kundeName}`,
      metadata: {
        buchung_id: String(params.buchungId),
        payment_type: "kaution",
      },
    },
    metadata: {
      buchung_id: String(params.buchungId),
      payment_type: "kaution",
      kunde_name: params.kundeName.slice(0, 250),
    },
    success_url: params.successUrl || `${baseUrl}/danke?type=kaution`,
    // Abbruch -> Startseite. /angebot existiert nicht (nur /angebot/[token]) und
    // der Token liegt hier nicht vor -> waere eine 404 gewesen.
    cancel_url: params.cancelUrl || `${baseUrl}/`,
  });
  return { url: session.url || "", session_id: session.id };
}

/**
 * Captures (= bucht ab) einen Teil oder den vollen Pre-Auth-Hold.
 * Bei Schaden: amount_to_capture = schaden_eur.
 */
export async function captureKaution(paymentIntentId: string, amountEur?: number) {
  const stripe = getStripe();
  const opts: { amount_to_capture?: number } = {};
  if (amountEur !== undefined) {
    opts.amount_to_capture = Math.round(amountEur * 100);
  }
  return stripe.paymentIntents.capture(paymentIntentId, opts);
}

/**
 * Cancelt den Pre-Auth-Hold komplett — Geld verfaellt vom Kunden-Konto.
 * Aufruf wenn keine Schaeden festgestellt wurden.
 */
export async function cancelKaution(paymentIntentId: string) {
  const stripe = getStripe();
  return stripe.paymentIntents.cancel(paymentIntentId);
}

/**
 * Deaktiviert alle aktiven Payment-Links fuer eine Buchung + Payment-Type. Bestehende Link-URL
 * gibt dem Kunden dann eine "no longer available"-Page. Brauchen wir nach Buchungs-Update um
 * stale Links mit altem Betrag aus dem Verkehr zu ziehen.
 * Match via metadata.buchung_id + metadata.payment_type. Fail-soft.
 */
export async function deactivatePaymentLinksFor(
  buchungId: number,
  paymentType: PaymentType,
): Promise<number> {
  try {
    const stripe = getStripe();
    let deactivated = 0;
    let starting_after: string | undefined;
    // Pagination — sollte selten >100 sein, Safety-Cap 5 Seiten
    for (let i = 0; i < 5; i++) {
      const page = await stripe.paymentLinks.list({
        active: true,
        limit: 100,
        ...(starting_after ? { starting_after } : {}),
      });
      for (const link of page.data) {
        const m = link.metadata || {};
        if (m.buchung_id === String(buchungId) && m.payment_type === paymentType) {
          try {
            await stripe.paymentLinks.update(link.id, { active: false });
            deactivated++;
          } catch (e) {
            console.error("[stripe] deactivate", link.id, e);
          }
        }
      }
      if (!page.has_more) break;
      starting_after = page.data[page.data.length - 1]?.id;
    }
    return deactivated;
  } catch (e) {
    console.error("[stripe] deactivatePaymentLinksFor fehlgeschlagen:", buchungId, paymentType, e);
    return 0;
  }
}

/**
 * Refund auf eine bereits abgebuchte Anzahlung/Restzahlung — fuer Storno-Workflow.
 */
export async function refundPayment(paymentIntentId: string, amountEur?: number) {
  const stripe = getStripe();
  const opts: { payment_intent: string; amount?: number } = { payment_intent: paymentIntentId };
  if (amountEur !== undefined) {
    opts.amount = Math.round(amountEur * 100);
  }
  return stripe.refunds.create(opts);
}
