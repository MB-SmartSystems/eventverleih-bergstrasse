/**
 * Bestätigungs-Mail "Anzahlung erhalten" in die MailQueue einreihen.
 *
 * Wird vom Stripe-Webhook UND vom manuellen Zahlung-Erfassen
 * (/api/admin/buchung/[id]/zahlung — Bar/Überweisung) genutzt, damit der Kunde
 * IMMER eine Bestätigung bekommt, egal über welchen Weg die Anzahlung kam.
 * (Vorher: nur Stripe löste eine Mail aus — Überweisungs-Kunden hörten nichts,
 * passiert bei B16 Michael Pfeifer.)
 *
 * Approval_Status=Auto_Reply → geht beim nächsten n8n-Poll automatisch raus;
 * die Erfassung der Zahlung ist die Freigabe. Idempotency_Key ist identisch zum
 * Webhook-Key, daher nie doppelt (z.B. manuelle Erfassung NACH Stripe-Webhook).
 */
import { createRow, getRow, listRows, TABLES } from "@/lib/baserow/client";
import { kundeNameAusLink, anredeZeile } from "@/lib/eventverleih/kunde-name";
import { UEBERGABE_HINWEIS } from "@/lib/eventverleih/constants";

export async function queueAnzahlungErhaltenMail(buchungId: number): Promise<void> {
  const b = await getRow<{ Kunde_Link: Array<{ id: number; value: string }> | null }>(
    TABLES.Buchungen,
    buchungId,
  );
  const kid = b.Kunde_Link?.[0]?.id;
  if (!kid) return;

  const idemKey = `B${buchungId}-anzahlung_erhalten`;
  const existing = await listRows<{ id: number; Idempotency_Key: string }>(TABLES.MailQueue, {
    search: idemKey,
    size: 5,
  });
  if (existing.results.some((r) => r.Idempotency_Key === idemKey)) return;

  // NICHT .value — das ist die Kunde_ID-Zahl ("Hallo 12"-Bug). Echten Namen laden.
  const kname = await kundeNameAusLink(b.Kunde_Link);
  await createRow(TABLES.MailQueue, {
    Erstellt_am: new Date().toISOString(),
    Buchung_Link: [buchungId],
    Kunde_Link: [kid],
    Template_Key: "anzahlung_erhalten",
    Subject: "Anzahlung erhalten — Ihr Termin ist reserviert",
    Body: `${anredeZeile(kname)}\n\nvielen Dank — Ihre Anzahlung ist bei uns eingegangen. Ihr Termin ist damit verbindlich für Sie reserviert. Die Restzahlung wird zur Übergabe fällig; wir erinnern Sie rechtzeitig.\n\n${UEBERGABE_HINWEIS}\n\nWir freuen uns auf Ihr Event!\n\nMit freundlichen Grüßen\nManuel Büttner — Eventverleih Bergstraße\nTel/WhatsApp +49 156 79521124`,
    Approval_Status: "Auto_Reply",
    Idempotency_Key: idemKey,
  });
}
