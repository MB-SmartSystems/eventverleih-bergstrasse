import type { MailText } from "../types";

export interface GoogleReviewCtx {
  kundeName: string;
  /** Already trimmed GOOGLE_REVIEW_URL. Empty string means: no link available. */
  reviewUrl: string;
}

/**
 * Friendly ask for a Google review, roughly 3 days after the event.
 * Needs approval before it goes out — no review request to an unhappy customer.
 */
export function buildGoogleReview(ctx: GoogleReviewCtx): MailText {
  const { kundeName, reviewUrl } = ctx;
  const linkBlock = reviewUrl
    ? `Hier geht's direkt zur Bewertung (dort können Sie auch gern ein Foto Ihrer Feier anhängen):\n${reviewUrl}\n\n`
    : `Am einfachsten über unser Google-Profil „Eventverleih Bergstraße" — dort können Sie auch gern ein Foto Ihrer Feier anhängen.\n\n`;
  const anrede = kundeName ? `Hallo ${kundeName},` : "Hallo,";
  return {
    subject: "Wie war Ihre Feier? Über eine kurze Bewertung freue ich mich",
    body: `${anrede}

ich hoffe, Ihre Feier war ein voller Erfolg und die Ausstattung hat alles mitgemacht!

Wenn Sie zufrieden waren, würde mir eine kurze Google-Bewertung enorm helfen — als kleiner Betrieb lebe ich von Weiterempfehlungen.

${linkBlock}Vielen Dank und bis zum nächsten Fest!

Viele Grüße
Manuel Büttner — Eventverleih Bergstraße
Tel/WhatsApp +49 156 79521124`,
  };
}
