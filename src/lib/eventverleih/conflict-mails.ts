/**
 * Konflikt-Mail-Templates: Hinweis-Mail bei parallelen Buchungen,
 * Storno-Mail an Verlierer wenn Konkurrent die Anzahlung zuerst leistet.
 *
 * Wording bewusst transparent: "Wer zuerst zahlt, bekommt den Zuschlag."
 * Kein juristisches Risiko — Lifecycle ist im Wording offengelegt.
 */
import { createRow, TABLES } from "@/lib/baserow/client";

interface KonfliktMailParams {
  buchungId: number;
  kundeId: number;
  kundeName: string;
  datumVon: string;
  datumBis: string;
  artikelNamen: string[];
}

/**
 * Erstellt einen MailQueue-Eintrag fuer den Hinweis an Kunden,
 * dass eine parallele Anfrage existiert. Approval_Status="Auto_Reply"
 * (kein Manuel-Approval noetig — informativ + transparent).
 */
export async function queueConflictHinweisMail(params: KonfliktMailParams) {
  const subject = `Hinweis zu Ihrer Buchungsanfrage (${params.datumVon}) | Eventverleih Bergstraße`;
  const artikelListe = params.artikelNamen.map((n) => `   - ${n}`).join("\n");
  const body = `Hallo ${params.kundeName},

vielen Dank für Ihre Anfrage / Bestätigung.

Ein kurzer transparenter Hinweis: Aktuell liegt mir eine **parallele Anfrage** für den gleichen Termin und mindestens einen der angefragten Artikel vor:

${artikelListe}

Final reserviert sind die Artikel erst nach Eingang der Anzahlung. Wer zuerst die Anzahlung leistet, bekommt den Zuschlag — der/die andere Anfragende wird informiert und ich bemühe mich um eine Alternative.

Falls Sie unsicher sind: gerne per WhatsApp kurz Bescheid geben (+49 156 79521124), dann besprechen wir die Lage.

Mit freundlichen Grüßen
Manuel Büttner

Eventverleih Bergstraße
Schlesierstraße 19a, 64665 Alsbach-Hähnlein
Tel/WhatsApp: +49 156 79521124
E-Mail: info@eventverleih-bergstrasse.de`;

  const idemKey = `B${params.buchungId}-konflikt_hinweis`;
  return createRow(TABLES.MailQueue, {
    Erstellt_am: new Date().toISOString(),
    Buchung_Link: [params.buchungId],
    Kunde_Link: [params.kundeId],
    Template_Key: "konflikt_hinweis",
    Subject: subject,
    Body: body,
    Approval_Status: "Auto_Reply",
    Idempotency_Key: idemKey,
  });
}

/**
 * Erstellt MailQueue-Eintrag fuer den Verlierer eines Konflikts,
 * wenn der Konkurrent die Anzahlung zuerst geleistet hat. Approval=Pending,
 * weil Manuel ggf. mit Alternativen reagieren will.
 */
export async function queueConflictStornoMail(params: KonfliktMailParams & { gewinnerName: string }) {
  const subject = `Bedauerlich: Ihre Anfrage konnte nicht bestätigt werden (${params.datumVon}) | Eventverleih Bergstraße`;
  const artikelListe = params.artikelNamen.map((n) => `   - ${n}`).join("\n");
  const body = `Hallo ${params.kundeName},

leider muss ich Ihnen mitteilen, dass die Artikel für Ihren Termin am ${params.datumVon} bereits anderweitig vergeben sind:

${artikelListe}

Wie im vorherigen Hinweis erwähnt: Reservierung wird erst mit Eingang der Anzahlung verbindlich. Eine andere Buchung hat die Anzahlung zuerst geleistet.

Ich bemühe mich, Ihnen eine Alternative anzubieten — entweder mit ähnlichen Artikeln oder einem anderen Termin. Bitte melden Sie sich kurz, damit wir gemeinsam schauen können.

Sollten Sie die gesamte Buchung nicht mehr brauchen: einfach kurz Bescheid geben, dann ist die Anfrage gelöscht.

Mit freundlichen Grüßen und Entschuldigung für die Umstände
Manuel Büttner

Eventverleih Bergstraße
Schlesierstraße 19a, 64665 Alsbach-Hähnlein
Tel/WhatsApp: +49 156 79521124
E-Mail: info@eventverleih-bergstrasse.de`;

  const idemKey = `B${params.buchungId}-konflikt_storno`;
  return createRow(TABLES.MailQueue, {
    Erstellt_am: new Date().toISOString(),
    Buchung_Link: [params.buchungId],
    Kunde_Link: [params.kundeId],
    Template_Key: "konflikt_storno",
    Subject: subject,
    Body: body,
    Approval_Status: "Pending",
    Idempotency_Key: idemKey,
  });
}
