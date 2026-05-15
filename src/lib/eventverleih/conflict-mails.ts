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
  const subject = `Hinweis zu Ihrer Buchungsanfrage (${params.datumVon}) | Eventverleih Bergstrasse`;
  const artikelListe = params.artikelNamen.map((n) => `   - ${n}`).join("\n");
  const body = `Hallo ${params.kundeName},

vielen Dank fuer Ihre Anfrage / Bestaetigung.

Ein kurzer transparenter Hinweis: Aktuell liegt mir eine **parallele Anfrage** fuer den gleichen Termin und mindestens einen der angefragten Artikel vor:

${artikelListe}

Final reserviert sind die Artikel erst nach Eingang der Anzahlung. Wer zuerst die Anzahlung leistet, bekommt den Zuschlag — der/die andere Anfragende wird informiert und ich bemuehe mich um eine Alternative.

Falls Sie unsicher sind: gerne per WhatsApp kurz Bescheid geben (+49 156 79521124), dann besprechen wir die Lage.

Mit freundlichen Gruessen
Manuel Buettner

Eventverleih Bergstrasse
Schlesierstrasse 19a, 64665 Alsbach-Haehnlein
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
  const subject = `Bedauerlich: Ihre Anfrage konnte nicht bestaetigt werden (${params.datumVon}) | Eventverleih Bergstrasse`;
  const artikelListe = params.artikelNamen.map((n) => `   - ${n}`).join("\n");
  const body = `Hallo ${params.kundeName},

leider muss ich Ihnen mitteilen, dass die Artikel fuer Ihren Termin am ${params.datumVon} bereits anderweitig vergeben sind:

${artikelListe}

Wie im vorherigen Hinweis erwaehnt: Reservierung wird erst mit Eingang der Anzahlung verbindlich. Eine andere Buchung hat die Anzahlung zuerst geleistet.

Ich bemuehe mich, Ihnen eine Alternative anzubieten — entweder mit aehnlichen Artikeln oder einem anderen Termin. Bitte melden Sie sich kurz, damit wir gemeinsam schauen koennen.

Sollten Sie die gesamte Buchung nicht mehr brauchen: einfach kurz Bescheid geben, dann ist die Anfrage geloescht.

Mit freundlichen Gruessen und Entschuldigung fuer die Umstaende
Manuel Buettner

Eventverleih Bergstrasse
Schlesierstrasse 19a, 64665 Alsbach-Haehnlein
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
