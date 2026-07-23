import type { MailText } from "../types";
import { anredeZeile } from "@/lib/eventverleih/kunde-name";
import { UEBERGABE_HINWEIS } from "@/lib/eventverleih/constants";

/**
 * Payment confirmations.
 *
 * `komplettzahlung_erhalten` and `restzahlung_erhalten` existed twice, byte for
 * byte: once in the Stripe webhook, once in the PayPal path. Both were verified
 * identical (body md5 fa0169b5 and 59b8aeb5, subject 392319a6) before merging, so
 * there is now one text per confirmation instead of two that could drift apart.
 */

export interface ZahlungErhaltenCtx {
  /** Real customer name — never the Kunde_ID (that produced the "Hallo 12" bug). */
  kname: string;
}

/** Full amount paid in one go. */
export function buildKomplettzahlungErhalten(ctx: ZahlungErhaltenCtx): MailText {
  const { kname } = ctx;
  return {
    subject: "Zahlung erhalten — Ihre Buchung ist vollständig bezahlt",
    body: `${anredeZeile(kname)}\n\nvielen Dank, Ihre Zahlung ist bei uns eingegangen. Ihre Buchung ist damit vollständig bezahlt.\n\n${UEBERGABE_HINWEIS}\n\nWir freuen uns auf Ihr Event!\n\nMit freundlichen Grüßen\nManuel Büttner — Eventverleih Bergstraße\nTel/WhatsApp +49 156 79521124`,
  };
}

/** Remaining amount paid, booking now settled. */
export function buildRestzahlungErhalten(ctx: ZahlungErhaltenCtx): MailText {
  const { kname } = ctx;
  return {
    subject: "Zahlung erhalten — Ihre Buchung ist vollständig bezahlt",
    body: `${anredeZeile(kname)}\n\nvielen Dank, Ihre Restzahlung ist bei uns eingegangen. Ihre Buchung ist damit vollständig bezahlt.\n\n${UEBERGABE_HINWEIS}\n\nWir freuen uns auf Ihr Event!\n\nMit freundlichen Grüßen\nManuel Büttner — Eventverleih Bergstraße\nTel/WhatsApp +49 156 79521124`,
  };
}

/** Deposit received, date is now firmly reserved. */
export function buildAnzahlungErhalten(ctx: ZahlungErhaltenCtx): MailText {
  const { kname } = ctx;
  return {
    subject: "Anzahlung erhalten — Ihr Termin ist reserviert",
    body: `${anredeZeile(kname)}\n\nvielen Dank, Ihre Anzahlung ist bei uns eingegangen. Ihr Termin ist damit verbindlich für Sie reserviert. Die Restzahlung wird zur Übergabe fällig; wir erinnern Sie rechtzeitig.\n\n${UEBERGABE_HINWEIS}\n\nWir freuen uns auf Ihr Event!\n\nMit freundlichen Grüßen\nManuel Büttner — Eventverleih Bergstraße\nTel/WhatsApp +49 156 79521124`,
  };
}
