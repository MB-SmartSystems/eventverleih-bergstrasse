import type { MailText } from "./types";
import { TEMPLATES } from "./registry";

/**
 * Checks that run over the RENDERED text, not over the source.
 *
 * The point of the overview is to surface contradictions like the deposit one:
 * `kaution_hold_link` promises a Stripe hold, `kaution_bar_hinweis` asks for cash,
 * both can reach the same customer. A check that runs on source code would miss it,
 * because the sentence only exists once the conditional block is evaluated.
 */

export type Schwere = "fehler" | "hinweis";

export interface Befund {
  regel: string;
  schwere: Schwere;
  /** Short German explanation of what is wrong. */
  text: string;
  /** The offending passage, so it can be judged without opening the file. */
  stelle: string;
}

/**
 * Brand name that identifies the signature line. The signature uses an em dash as a
 * deliberate house style; instead of matching the exact separator string (which broke
 * whenever the surrounding text differed slightly), we treat the whole line that carries
 * the brand name as house style and exempt it from the em-dash check.
 */
const SIGNATUR_MARKE = "Eventverleih Bergstraße";

/** The full line that contains `index`, from the previous newline to the next. */
function zeileUm(text: string, index: number): string {
  const start = text.lastIndexOf("\n", index) + 1;
  let end = text.indexOf("\n", index);
  if (end === -1) end = text.length;
  return text.slice(start, end);
}

function ausschnitt(text: string, index: number, laenge = 90): string {
  const von = Math.max(0, index - 35);
  const bis = Math.min(text.length, index + laenge);
  return (von > 0 ? "…" : "") + text.slice(von, bis).replace(/\n/g, " ") + (bis < text.length ? "…" : "");
}

/**
 * Cash wording anywhere in customer text.
 *
 * Stripe is the standard way for deposit, remaining payment and security. Cash is a
 * last-priority option (Entscheidung 2026-07-23, A2): it may be named, never recommended
 * or put on par with online, and only WITH the two mandatory hints (exact amount / no
 * change; overpayment comes back with the deposit). So the check no longer treats every
 * cash mention as a hard error: a mention that carries the mandatory hints is an
 * informational note (is cash staying secondary?), a mention WITHOUT the hints is an error.
 */
function pruefeBargeld(mail: MailText): Befund[] {
  const befunde: Befund[] = [];
  const re = /\b(bar|bares|bargeld|barzahlung)\b/gi;
  // "kein Wechselgeld" is the tell-tale of the mandatory hint block (BAR_ZAHLUNG_HINWEIS).
  const hatPflichtHinweis = /kein Wechselgeld/i.test(mail.body);
  for (const feld of ["subject", "body"] as const) {
    const text = mail[feld];
    let m: RegExpExecArray | null;
    const rx = new RegExp(re.source, "gi");
    while ((m = rx.exec(text)) !== null) {
      befunde.push({
        regel: "bargeld",
        schwere: hatPflichtHinweis ? "hinweis" : "fehler",
        text: hatPflichtHinweis
          ? "Barzahlung erwähnt. Als nachrangige Option erlaubt und mit den Pflicht-Hinweisen versehen. Nur prüfen, dass bar nicht empfohlen oder mit online gleichgestellt wird."
          : "Barzahlung im Kundentext ohne die Pflicht-Hinweise. Bar ist nachrangig erlaubt, aber nur mit: Betrag passend/kein Wechselgeld und Überzahlung kommt mit der Kaution zurück. Stripe bleibt der Standardweg.",
        stelle: ausschnitt(text, m.index),
      });
    }
  }
  return befunde;
}

/**
 * Em dashes are the strongest AI marker in German copy.
 *
 * Only the BODY is checked (decision B5, 2026-07-23): the subject often carries a
 * legitimate em dash and is short enough to eyeball. The signature line is house style,
 * so any em dash on the line that carries the brand name is exempt — matched by the brand
 * name, not by an exact separator string, so slight wording changes no longer flip the check.
 */
function pruefeEmDash(mail: MailText): Befund[] {
  const befunde: Befund[] = [];
  const text = mail.body;
  let index = text.indexOf("—");
  while (index !== -1) {
    if (!zeileUm(text, index).includes(SIGNATUR_MARKE)) {
      befunde.push({
        regel: "em-dash",
        schwere: "hinweis",
        text: "Geviertstrich im Fließtext. Stärkster KI-Marker; durch Komma, Punkt oder Umformulierung ersetzen.",
        stelle: ausschnitt(text, index),
      });
    }
    index = text.indexOf("—", index + 1);
  }
  return befunde;
}

/** A mail without sender identification looks like spam and is legally thin. */
function pruefeSignatur(mail: MailText): Befund[] {
  if (mail.body.includes("Eventverleih Bergstraße")) return [];
  return [
    {
      regel: "signatur-fehlt",
      schwere: "fehler",
      text: "Kein Absenderhinweis im Text.",
      stelle: mail.body.slice(-90).replace(/\n/g, " "),
    },
  ];
}

/** Classic assembly failures that reach the customer as visible garbage. */
function pruefeReste(mail: MailText): Befund[] {
  const befunde: Befund[] = [];
  const muster: Array<[string, RegExp]> = [
    ["platzhalter", /\{\{|\}\}/],
    ["undefined", /\bundefined\b/],
    ["null", /\bnull\b/],
    ["NaN", /\bNaN\b/],
    ["objekt", /\[object Object\]/],
  ];
  for (const feld of ["subject", "body"] as const) {
    const text = mail[feld];
    for (const [name, re] of muster) {
      const m = re.exec(text);
      if (m) {
        befunde.push({
          regel: "rest-im-text",
          schwere: "fehler",
          text: `Unaufgelöster Rest im Text: ${name}.`,
          stelle: ausschnitt(text, m.index),
        });
      }
    }
  }
  return befunde;
}

/** Three or more blank lines in a row means a block was left out without tidying up. */
function pruefeLeerzeilen(mail: MailText): Befund[] {
  const m = /\n[ \t]*\n[ \t]*\n[ \t]*\n/.exec(mail.body);
  if (!m) return [];
  return [
    {
      regel: "leerzeilen",
      schwere: "hinweis",
      text: "Drei oder mehr Leerzeilen hintereinander — meist ein weggefallener Block.",
      stelle: ausschnitt(mail.body, m.index),
    },
  ];
}

export function pruefeText(mail: MailText): Befund[] {
  return [
    ...pruefeBargeld(mail),
    ...pruefeEmDash(mail),
    ...pruefeSignatur(mail),
    ...pruefeReste(mail),
    ...pruefeLeerzeilen(mail),
  ];
}

export interface VorlagenBefund {
  tpl: string;
  title: string;
  /** Which example produced the finding — the branch matters. */
  label: string;
  befunde: Befund[];
}

/**
 * Runs every check over every template and every example case.
 *
 * Iterating ALL examples is essential, not thorough-for-its-own-sake: the cash
 * sentence in `termin_erinnerung` only exists in the branch where the deposit is
 * still open. With one example per template it would stay invisible.
 */
export function pruefeAlle(): VorlagenBefund[] {
  const out: VorlagenBefund[] = [];
  for (const t of TEMPLATES) {
    for (const ex of t.examples) {
      const befunde = pruefeText(t.build(ex.ctx));
      if (befunde.length > 0) {
        out.push({ tpl: t.tpl, title: t.title, label: ex.label, befunde });
      }
    }
  }
  return out;
}

/** Findings for one template across all its examples, deduplicated by rule and passage. */
export function befundeFuer(tpl: string): Befund[] {
  const gesehen: Record<string, true> = {};
  const out: Befund[] = [];
  for (const v of pruefeAlle()) {
    if (v.tpl !== tpl) continue;
    for (const b of v.befunde) {
      const schluessel = `${b.regel}|${b.stelle}`;
      if (gesehen[schluessel]) continue;
      gesehen[schluessel] = true;
      out.push(b);
    }
  }
  return out;
}
