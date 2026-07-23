import type { MailText } from "../types";
import { eurMail } from "../../zahlung";

/**
 * Mails rund um die Uebergabe und die Rueckzahlung.
 *
 * Reine Bau-Funktionen: nehmen Zahlen und Namen, geben Text zurueck. Kein Baserow,
 * kein Datum, kein Zufall — damit der Geldteil testbar ist, bevor er beim Kunden landet.
 */

const SIGNATUR_KURZ = `\n\nViele Grüße\nManuel Büttner — Eventverleih Bergstraße\nTel/WhatsApp +49 156 79521124`;

const SIGNATUR_LANG = `\n\nMit freundlichen Grüßen\nManuel Büttner\n\nEventverleih Bergstraße\nSchlesierstraße 19a, 64665 Alsbach-Hähnlein\nTel/WhatsApp: +49 156 79521124\nE-Mail: info@eventverleih-bergstrasse.de\nWeb: eventverleih-bergstrasse.de\n\nNicht umsatzsteuerpflichtig nach § 19 Abs. 1 UStG.`;

export interface UebergabeErfolgtCtx {
  kundeName: string;
  /** Fertig formatierte Zeilen, z.B. "- 30× Stuhl". */
  artikelZeilen: string[];
  /** Fertig formatierter Satz zum Rueckgabe-Termin, beginnt mit einem Zeilenumbruch. */
  rueckgabeZeile: string;
  kautionSollEur: number;
  kautionHinterlegt: boolean;
  /**
   * Was bei DIESER Uebergabe kassiert wurde. Fehlt oder 0 heisst: nichts kassiert.
   * Die Aufteilung kommt aus `verteileBetrag`, hier wird nur noch geschrieben.
   */
  kassiert?: {
    gesamtEur: number;
    restzahlungEur: number;
    kautionEur: number;
    ueberzahlungEur: number;
  } | null;
  /** Was nach der Uebergabe offen bleibt. */
  offenRestzahlungEur: number;
  offenKautionEur: number;
  restLink?: string | null;
  kautionLink?: string | null;
}

function kautionZustand(ctx: UebergabeErfolgtCtx): string {
  if (ctx.kautionSollEur <= 0) return "";
  if (ctx.kautionHinterlegt) {
    return `\n\nIhre Kaution (${eurMail(ctx.kautionSollEur)} EUR) ist hinterlegt und wird nach der Rückgabe ohne Schäden vollständig zurückgegeben.`;
  }
  return "";
}

/**
 * "Übergabe erfolgt" in drei Faellen (Manuel, 2026-07-23):
 * alles vorab bezahlt · bei der Übergabe kassiert · danach noch offen.
 *
 * Bargeld wird nirgends angeboten: Stripe ist der Standardweg, offene Betraege
 * bekommen einen Zahlungslink.
 */
export function buildUebergabeErfolgt(ctx: UebergabeErfolgtCtx): MailText {
  const artikel = ctx.artikelZeilen.length > 0 ? ctx.artikelZeilen.join("\n") : "- (keine Positionen erfasst)";
  const kassiertGesamt = ctx.kassiert?.gesamtEur ?? 0;
  const offenGesamt =
    Math.round((Math.max(0, ctx.offenRestzahlungEur) + Math.max(0, ctx.offenKautionEur)) * 100) / 100;

  let geldBlock = "";

  if (kassiertGesamt > 0) {
    // Fall 2: bei der Übergabe kassiert.
    const zeilen: string[] = [];
    if (ctx.kassiert!.restzahlungEur > 0) zeilen.push(`  Restzahlung: ${eurMail(ctx.kassiert!.restzahlungEur)} EUR`);
    if (ctx.kassiert!.kautionEur > 0) zeilen.push(`  Kaution: ${eurMail(ctx.kassiert!.kautionEur)} EUR`);
    if (ctx.kassiert!.ueberzahlungEur > 0) {
      zeilen.push(`  Zu viel gezahlt: ${eurMail(ctx.kassiert!.ueberzahlungEur)} EUR`);
    }
    geldBlock = `\n\nHeute erhalten habe ich ${eurMail(kassiertGesamt)} EUR:\n${zeilen.join("\n")}`;
    if (ctx.kassiert!.ueberzahlungEur > 0) {
      // Zurueck geht die Kaution, die am Ende auf der Buchung liegt — nicht nur der
      // heute kassierte Anteil. War sie vorher schon hinterlegt und heute kam nur die
      // Ueberzahlung dazu, waere die genannte Summe sonst zu niedrig.
      const kautionZurueck = ctx.kautionHinterlegt ? ctx.kautionSollEur : ctx.kassiert!.kautionEur;
      const summe = Math.round((kautionZurueck + ctx.kassiert!.ueberzahlungEur) * 100) / 100;
      geldBlock +=
        `\n\nDen zu viel gezahlten Betrag bekommen Sie zusammen mit der Kaution zurück, ` +
        `nach der Rückgabe ohne Schäden also ${eurMail(summe)} EUR.`;
    } else if (ctx.kassiert!.kautionEur > 0) {
      geldBlock += `\n\nDie Kaution bekommen Sie nach der Rückgabe ohne Schäden vollständig zurück.`;
    }
  }

  if (offenGesamt > 0) {
    // Fall 3: danach bleibt etwas offen.
    const zeilen: string[] = [];
    if (ctx.offenRestzahlungEur > 0) {
      zeilen.push(`  Restzahlung: ${eurMail(ctx.offenRestzahlungEur)} EUR`);
      if (ctx.restLink) zeilen.push(`  ${ctx.restLink}`);
    }
    if (ctx.offenKautionEur > 0) {
      zeilen.push(`  Kaution: ${eurMail(ctx.offenKautionEur)} EUR`);
      if (ctx.kautionLink) zeilen.push(`  ${ctx.kautionLink}`);
    }
    geldBlock += `\n\nOffen sind noch ${eurMail(offenGesamt)} EUR:\n${zeilen.join("\n")}\n\nAm einfachsten online über den jeweiligen Link.`;
  }

  if (kassiertGesamt === 0 && offenGesamt === 0) {
    // Fall 1: alles vorab bezahlt.
    geldBlock = `\n\nIhre Buchung ist vollständig bezahlt, offen ist nichts mehr.${kautionZustand(ctx)}`;
  }

  return {
    subject: "Übergabe erfolgt: Ihre Mietartikel",
    body: `Hallo ${ctx.kundeName},\n\nIhre Mietartikel sind übergeben:\n${artikel}${geldBlock}${ctx.rueckgabeZeile}\n\nViel Freude bei Ihrer Feier!${SIGNATUR_KURZ}`,
  };
}

export interface KautionIbanCtx {
  kundeName: string;
  kautionEur: number;
  ueberzahlungEur: number;
}

/**
 * Bitte um die Bankverbindung fuer die Rueckzahlung.
 *
 * Nennt den Betrag, der wirklich zurueckgeht: Kaution PLUS zu viel gezahltes Geld.
 * Genau hier waere es am 27.07. schiefgegangen — die Mail haette 30,00 EUR genannt,
 * obwohl der Kundin schriftlich 47,50 EUR zugesagt sind.
 */
export function buildKautionIbanAnfordern(ctx: KautionIbanCtx): MailText {
  const gesamt = Math.round((ctx.kautionEur + ctx.ueberzahlungEur) * 100) / 100;
  const aufschluesselung =
    ctx.ueberzahlungEur > 0
      ? `Zurück gehen ${eurMail(gesamt)} EUR an Sie:\n\n• Kaution: ${eurMail(ctx.kautionEur)} EUR\n• Zu viel gezahlt: ${eurMail(ctx.ueberzahlungEur)} EUR`
      : `Zurück gehen ${eurMail(gesamt)} EUR an Sie (Kaution).`;

  return {
    subject: "Rückerstattung – Eventverleih Bergstraße",
    body: `Hallo ${ctx.kundeName},

vielen Dank für die Rückgabe. Ich prüfe die Artikel in den nächsten 1–2 Tagen auf Vollständigkeit und Schäden.

${aufschluesselung}

Dafür brauche ich noch Ihre Bankverbindung – bitte antworten Sie kurz auf diese E-Mail mit:

• IBAN
• Kontoinhaber

Sobald die Prüfung abgeschlossen ist (in der Regel innerhalb von 1–2 Tagen), überweise ich Ihnen den Betrag umgehend.

Bei Fragen am schnellsten per WhatsApp: +49 156 79521124.${SIGNATUR_LANG}`,
  };
}
