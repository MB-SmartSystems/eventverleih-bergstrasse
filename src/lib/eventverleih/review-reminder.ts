/**
 * Review-Reminder — bittet ~3 Tage nach dem Event freundlich um eine Google-Bewertung (+ Foto).
 *
 * Als LIB (KEIN eigener Vercel-Cron — Hobby-Plan limitiert Cron-Anzahl, daher als
 * Sub-Pass aus dem kaution-reminder-Cron aufgerufen, analog runAnzahlungReminder).
 *  - Status Zurueckgegeben/Abgerechnet, Event-Ende 3–10 Tage her (Fenster verhindert
 *    Massen-Mails an alte Bestandsbuchungen beim ersten Lauf)
 *  - einmalig je Buchung (Idempotency B<id>-review)
 *  - Approval_Status=Pending → Manuel gibt im Dashboard frei (kein "bitte bewerten"
 *    an einen unzufriedenen Kunden)
 *  - Google-Review-Link aus ENV GOOGLE_REVIEW_URL (optional; ohne Var generischer Verweis)
 */
import { listAllRows, listRows, createRow, TABLES } from "@/lib/baserow/client";

interface BuchungRow {
  id: number;
  Status_Erweitert: { value: string } | null;
  Event_datum_bis: string | null;
  Kunde_Link: Array<{ id: number; value: string }> | null;
}

function daysSince(past: string | null): number {
  if (!past) return -1;
  const d = new Date(past);
  if (isNaN(d.getTime())) return -1;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

function buildReviewMail(kundeName: string): { subject: string; body: string } {
  const reviewUrl = (process.env.GOOGLE_REVIEW_URL || "").trim();
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

export async function runReviewReminder(): Promise<{
  pruefte: number;
  mails: number;
  skipped_duplicate: number;
  skipped_fenster: number;
  fehler: number;
}> {
  const result = { pruefte: 0, mails: 0, skipped_duplicate: 0, skipped_fenster: 0, fehler: 0 };
  const all = await listAllRows<BuchungRow>(TABLES.Buchungen);
  for (const b of all.results) {
    const status = b.Status_Erweitert?.value || "";
    if (status !== "Zurueckgegeben" && status !== "Abgerechnet") continue;
    const tage = daysSince(b.Event_datum_bis);
    if (tage < 3 || tage > 10) {
      result.skipped_fenster++;
      continue;
    }
    const kundeId = b.Kunde_Link?.[0]?.id;
    const kundeName = b.Kunde_Link?.[0]?.value || "";
    if (!kundeId) continue;
    result.pruefte++;

    const idemKey = `B${b.id}-review`;
    const existing = await listRows<{ id: number; Idempotency_Key?: string }>(TABLES.MailQueue, {
      search: idemKey,
      size: 5,
    });
    if (existing.results.find((m) => m.Idempotency_Key === idemKey)) {
      result.skipped_duplicate++;
      continue;
    }

    const mail = buildReviewMail(kundeName);
    try {
      await createRow(TABLES.MailQueue, {
        Erstellt_am: new Date().toISOString(),
        Buchung_Link: [b.id],
        Kunde_Link: [kundeId],
        Template_Key: "google_review",
        Subject: mail.subject,
        Body: mail.body,
        Approval_Status: "Pending",
        Idempotency_Key: idemKey,
      });
      result.mails++;
    } catch (e) {
      console.error("[review-reminder] mailqueue insert fehlgeschlagen:", e);
      result.fehler++;
    }
  }
  return result;
}
