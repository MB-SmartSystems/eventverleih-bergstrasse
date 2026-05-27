/**
 * Helper: Kaution-Hold-Link erzeugen (Stripe Checkout, capture_method=manual)
 * + Mail an den Kunden in die MailQueue legen.
 *
 * Genutzt von:
 *   - POST /api/admin/buchung/[id]/kaution-mail  (manueller Button)
 *   - GET  /api/cron/kaution-reminder            (Auto-Versand ~5 Tage vor Event)
 *
 * Idempotenz: wenn Stripe_Kaution_Link schon existiert und Hold noch nicht
 * platziert (Kaution_Hinterlegt_am leer) → bestehenden Link wiederverwenden.
 * Wenn Hold schon platziert → { ok:false, reason:"already_placed" }.
 */
import { createRow, getRow, updateRow, TABLES } from "@/lib/baserow/client";
import { createKautionCheckoutSession } from "@/lib/stripe/payment-links";
import { memberAutoLoginUrl } from "@/lib/eventverleih/member-auth";

type BuchungRow = {
  id: number;
  Event_datum_von: string | null;
  Event_datum_bis: string | null;
  Kaution_Soll_Eur: string | number | null;
  Kaution_Hinterlegt_am: string | null;
  Stripe_Kaution_Link: string | null;
  Kunde_Link: Array<{ id: number; value: string }> | null;
};

type KundeRow = { id: number; Vorname: string; Nachname: string; Email: string };

function parseDec(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

export type QueueKautionResult =
  | { ok: true; link_url: string; reused: boolean; mail_queued: true }
  | { ok: false; reason: "already_placed" | "no_amount" | "no_kunde" | "no_email"; detail?: string };

export async function queueKautionHoldMail(opts: {
  buchungId: number;
  amountEur?: number;
  idempotencyKey?: string;
}): Promise<QueueKautionResult> {
  const { buchungId } = opts;
  const buchung = await getRow<BuchungRow>(TABLES.Buchungen, buchungId);

  if (buchung.Kaution_Hinterlegt_am) {
    return { ok: false, reason: "already_placed", detail: buchung.Kaution_Hinterlegt_am };
  }

  const amount = opts.amountEur ?? parseDec(buchung.Kaution_Soll_Eur);
  if (!amount || amount <= 0) return { ok: false, reason: "no_amount" };

  const kundeId = buchung.Kunde_Link?.[0]?.id;
  if (!kundeId) return { ok: false, reason: "no_kunde" };
  const kunde = await getRow<KundeRow>(TABLES.Kunden, kundeId);
  if (!kunde.Email) return { ok: false, reason: "no_email" };

  // Idempotenz: bestehenden Link wiederverwenden, sonst neu erzeugen
  let kautionUrl = (buchung.Stripe_Kaution_Link || "").trim();
  let reused = false;
  if (kautionUrl) {
    reused = true;
  } else {
    const kundeName = `${kunde.Vorname} ${kunde.Nachname}`.trim() || "Kunde";
    const session = await createKautionCheckoutSession({
      buchungId,
      amountEur: Number(amount),
      kundeName,
    });
    kautionUrl = session.url;
    await updateRow(TABLES.Buchungen, buchungId, { Stripe_Kaution_Link: kautionUrl });
  }

  // Mein-Bereich-Link mit beilegen — Kunde kann den Hold-Status auch dort einsehen
  let meinBereichUrl = "";
  try {
    meinBereichUrl = await memberAutoLoginUrl(kundeId);
  } catch (e) {
    console.error("[kaution-mail] memberAutoLoginUrl fehlgeschlagen:", e);
  }

  const greeting = `Hallo ${kunde.Vorname} ${kunde.Nachname}`.trim();
  const amountFmt = amount.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const memberBlock = meinBereichUrl
    ? `\n\nMein Bereich (Buchungs-Status + Zahlungen + Rechnungen):\n${meinBereichUrl}`
    : "";

  const subject = "Kaution hinterlegen | Eventverleih Bergstrasse";
  const mailBody = `${greeting},

vor der Uebergabe brauchen wir Ihre Kaution als Sicherheit. **Wir buchen die Kaution NICHT ab** — Stripe blockiert den Betrag nur auf Ihrer Karte (sogenannte Pre-Authorization). Bei Rueckgabe ohne Schaeden wird der Hold automatisch aufgeloest, es fliesst kein Geld.

Kautions-Betrag: ${amountFmt} EUR

Bitte hier hinterlegen:
${kautionUrl}

Wichtiges in Kuerze:
  * Karte wird gepruft + Betrag vorgemerkt (kein Abbuchen)
  * Hold ist standardmaessig 7 Tage aktiv. Bei Visa/Mastercard verlaengert Stripe ggf. auf bis zu 30 Tage automatisch.
  * Bei Rueckgabe ohne Schaeden: Aufloesung des Holds in der Regel innerhalb 1-3 Werktagen.
  * Falls Ihre Karte keine Pre-Authorization unterstuetzt: einfach auf diese Mail antworten, dann nehmen wir die Kaution bei Uebergabe in bar.${memberBlock}

Bei Fragen jederzeit per WhatsApp oder Anruf erreichbar: +49 156 79521124.

Mit freundlichen Gruessen
Manuel Buettner

Eventverleih Bergstrasse
Schlesierstrasse 19a, 64665 Alsbach-Haehnlein
Tel/WhatsApp: +49 156 79521124
E-Mail: info@eventverleih-bergstrasse.de

Nicht umsatzsteuerpflichtig nach Paragraph 19 Abs. 1 UStG.`;

  // Idempotenz-Key: Default date-suffixed (Reminder mehrfach erlaubt), Cron uebergibt stabilen Key.
  const today = new Date().toISOString().slice(0, 10);
  const idemKey = opts.idempotencyKey || `B${buchungId}-kaution_hold_link-${today}`;
  await createRow(TABLES.MailQueue, {
    Erstellt_am: new Date().toISOString(),
    Buchung_Link: [buchungId],
    Kunde_Link: [kundeId],
    Template_Key: "kaution_hold_link",
    Subject: subject,
    Body: mailBody,
    Approval_Status: "Auto_Reply",
    Idempotency_Key: idemKey,
  });

  return { ok: true, link_url: kautionUrl, reused, mail_queued: true };
}
