/**
 * Zentrale Zahlungs-Helfer.
 *
 * WICHTIG: `bezahlt` IMMER aus den Skalar-Feldern Anzahlung_/Restzahlung_Bezahlt_Eur
 * berechnen — die setzen BEIDE Wege (manuelle Erfassung in zahlung/route.ts UND der
 * Stripe-Webhook). Das Feld Zahlungen_JSON fuellt nur der manuelle Weg und ist bei
 * Stripe-bezahlten Buchungen leer -> jede Summe daraus war dort faelschlich 0
 * ("Offen = Gesamt" trotz Zahlung, falsche Storno-Erstattung). Zahlungen_JSON daher
 * nur noch als Historie-Liste nutzen, NIE als Summenquelle.
 */
export type BezahltFelder = {
  Anzahlung_Bezahlt_Eur?: string | number | null;
  Restzahlung_Bezahlt_Eur?: string | number | null;
};

function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

/** Euro auf Cent runden. Alle Zwischenrechnungen laufen in Cent, nie in Gleitkomma-Euro. */
function cent(eur: number): number {
  return Math.round(eur * 100);
}

function eur(c: number): number {
  return Math.round(c) / 100;
}

/** Tatsaechlich bezahlte Mietsumme (Anzahlung + Restzahlung), auf Cent gerundet. */
export function bezahltEur(b: BezahltFelder): number {
  return Math.round((num(b.Anzahlung_Bezahlt_Eur) + num(b.Restzahlung_Bezahlt_Eur)) * 100) / 100;
}

/** Geldbetrag fuer Kunden-Mails: deutsches Komma-Format, z.B. 12,50. */
export function eurMail(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

/* ------------------------------------------------------------------------- *
 * Verteilung eines erhaltenen Gesamtbetrags
 * ------------------------------------------------------------------------- */

/** Die drei Posten, die Geld aufnehmen koennen — in genau dieser Reihenfolge. */
export type PostenTyp = "anzahlung" | "restzahlung" | "kaution";

/** Feste Fuell-Reihenfolge. Aendern heisst: Geld landet woanders. */
export const REIHENFOLGE: readonly PostenTyp[] = ["anzahlung", "restzahlung", "kaution"] as const;

/**
 * Soll- und Ist-Stand der drei Posten.
 *
 * `kautionBezahltEur` gibt es in Baserow nicht als eigenes Feld — dort steht nur
 * `Kaution_Hinterlegt_am`. Der Aufrufer setzt deshalb `kautionSollEur`, sobald das
 * Datum gesetzt ist. Diese Funktion rechnet bewusst nur mit Zahlen und liest nichts.
 */
export interface PostenStand {
  anzahlungSollEur: number;
  anzahlungBezahltEur: number;
  restzahlungSollEur: number;
  restzahlungBezahltEur: number;
  kautionSollEur: number;
  kautionBezahltEur: number;
}

export interface Zuweisung {
  typ: PostenTyp;
  /** Was von der Eingabe auf diesen Posten faellt. Immer > 0. */
  betragEur: number;
  offenVorherEur: number;
  offenNachherEur: number;
}

export interface Aufteilung {
  eingabeEur: number;
  /** Nur Posten, auf die wirklich etwas entfaellt, in fester Reihenfolge. */
  zuweisungen: Zuweisung[];
  /** Was nach dem Fuellen aller Posten uebrig bleibt. Gehoert dem Kunden. */
  ueberzahlungEur: number;
  offenDanach: { anzahlungEur: number; restzahlungEur: number; kautionEur: number; gesamtEur: number };
  /** true, wenn nach dieser Zahlung nichts mehr offen ist. */
  vollstaendig: boolean;
}

/**
 * Verteilt einen erhaltenen Gesamtbetrag auf Anzahlung, Restzahlung, Kaution und
 * legt den Rest als Ueberzahlung ab.
 *
 * Reine Funktion: liest nichts, schreibt nichts, kein Datum, kein Zufall. Bereits
 * bezahlte Posten werden uebersprungen; reicht das Geld nicht, wird der Reihe nach
 * aufgefuellt und `offenDanach` sagt, was stehen bleibt.
 *
 * Rechnet durchgehend in Cent. In Euro waeren 100 - 22.50 - 52.50 - 30 nicht 0,
 * sondern 2.8e-14 — und genau daraus entstuende eine Ueberzahlung von 0,00 €, die
 * das Panel als vorhanden anzeigt.
 *
 * @throws RangeError bei 0, negativen und nicht-endlichen Betraegen. Ein Eingang
 *   ueber 0 € ist kein Vorgang, den dieses System abbilden soll — der Aufrufer
 *   soll das als Eingabefehler melden, nicht als leere Aufteilung durchwinken.
 */
export function verteileBetrag(betragEur: number, stand: PostenStand): Aufteilung {
  if (!Number.isFinite(betragEur) || betragEur <= 0) {
    throw new RangeError(`Betrag muss größer als 0 sein, war: ${betragEur}`);
  }

  const offenCent: Record<PostenTyp, number> = {
    anzahlung: Math.max(0, cent(stand.anzahlungSollEur) - cent(stand.anzahlungBezahltEur)),
    restzahlung: Math.max(0, cent(stand.restzahlungSollEur) - cent(stand.restzahlungBezahltEur)),
    kaution: Math.max(0, cent(stand.kautionSollEur) - cent(stand.kautionBezahltEur)),
  };

  let restCent = cent(betragEur);
  const zuweisungen: Zuweisung[] = [];

  for (let i = 0; i < REIHENFOLGE.length; i++) {
    const typ = REIHENFOLGE[i];
    const offen = offenCent[typ];
    if (offen <= 0 || restCent <= 0) continue;
    const anteil = Math.min(offen, restCent);
    restCent -= anteil;
    offenCent[typ] = offen - anteil;
    zuweisungen.push({
      typ,
      betragEur: eur(anteil),
      offenVorherEur: eur(offen),
      offenNachherEur: eur(offen - anteil),
    });
  }

  const offenGesamt = offenCent.anzahlung + offenCent.restzahlung + offenCent.kaution;

  return {
    eingabeEur: eur(cent(betragEur)),
    zuweisungen,
    ueberzahlungEur: eur(restCent),
    offenDanach: {
      anzahlungEur: eur(offenCent.anzahlung),
      restzahlungEur: eur(offenCent.restzahlung),
      kautionEur: eur(offenCent.kaution),
      gesamtEur: eur(offenGesamt),
    },
    vollstaendig: offenGesamt === 0,
  };
}

/* ------------------------------------------------------------------------- *
 * Erstattung nach der Rueckgabe
 * ------------------------------------------------------------------------- */

export interface ErstattungFelder {
  Kaution_Soll_Eur?: string | number | null;
  Ueberzahlung_Eur?: string | number | null;
}

/**
 * Zuviel gezahlter Betrag einer Buchung.
 *
 * Einzige Quelle ist das Skalar-Feld `Ueberzahlung_Eur` — dieselbe Regel wie im
 * Dateikopf fuer Anzahlung und Restzahlung. `Zahlungen_JSON` bleibt Historie.
 *
 * Bis zum 23.07.2026 gab es hier einen Rueckfall auf die Historie, weil das Feld
 * neu war und Buchung 32 ihre 17,50 EUR nur dort stehen hatte. Der Bestand wurde
 * geprueft (genau eine betroffene Buchung) und nachgetragen, danach ist der
 * Rueckfall entfallen: zwei Quellen fuer denselben Betrag sind eine Quelle zu viel.
 */
export function ueberzahlungEur(b: ErstattungFelder): number {
  return Math.round(num(b.Ueberzahlung_Eur) * 100) / 100;
}

export interface Erstattung {
  kautionEur: number;
  ueberzahlungEur: number;
  /** Was tatsaechlich an den Kunden zurueckgeht. */
  gesamtEur: number;
}

/**
 * Was nach der Rueckgabe an den Kunden zurueckgeht: Kaution plus Ueberzahlung.
 *
 * `schadenEur` mindert ausschliesslich die Kaution. Eine Ueberzahlung ist Geld des
 * Kunden, das nie eine Sicherheit war — sie geht auch bei vollem Kautions-Einzug
 * vollstaendig zurueck.
 */
export function erstattungEur(b: ErstattungFelder, schadenEur = 0): Erstattung {
  const kautionOffen = Math.max(0, cent(num(b.Kaution_Soll_Eur)) - cent(Math.max(0, schadenEur)));
  const ueber = cent(ueberzahlungEur(b));
  return {
    kautionEur: eur(kautionOffen),
    ueberzahlungEur: eur(ueber),
    gesamtEur: eur(kautionOffen + ueber),
  };
}

/* ------------------------------------------------------------------------- *
 * Weg, auf dem Geld zurueckgeht
 * ------------------------------------------------------------------------- */

/**
 * Wie eine Erstattung den Kunden erreicht.
 *
 * `karte` und `paypal` sind Rueckbuchungen auf das Zahlungsmittel, `bank` braucht
 * eine Bankverbindung vom Kunden — bar oder per Ueberweisung eingegangenes Geld
 * laesst sich nicht zurueckbuchen.
 */
export type Erstattungsweg = "karte" | "paypal" | "bank";

/**
 * Leitet den Erstattungsweg aus der Zahlungs-Historie ab.
 *
 * Vorrang: bank > paypal > karte. Sobald EIN Teilbetrag bar oder per Ueberweisung
 * kam, geht die gesamte Erstattung auf ein Konto — es gibt nur eine Rueckzahlung,
 * und sie muss den Weg nehmen, der fuer jeden Teil funktioniert.
 *
 * Leere Historie heisst `karte`: `Zahlungen_JSON` fuellt nur die manuelle Erfassung,
 * der Stripe-Webhook schreibt ausschliesslich die Skalar-Felder. Keine Historie ist
 * damit der Normalfall einer reinen Kartenzahlung.
 */
export function erstattungsweg(zahlungenJson: string | null | undefined): Erstattungsweg {
  if (!zahlungenJson) return "karte";
  let eintraege: Array<{ typ?: unknown; methode?: unknown }>;
  try {
    const roh = JSON.parse(zahlungenJson);
    eintraege = Array.isArray(roh) ? roh : [];
  } catch {
    return "karte";
  }
  let paypal = false;
  for (let i = 0; i < eintraege.length; i++) {
    const e = eintraege[i];
    if (e.typ !== "anzahlung" && e.typ !== "restzahlung") continue;
    const m = String(e.methode ?? "").toLowerCase();
    if (m === "bar" || m === "ueberweisung") return "bank";
    if (m === "paypal") paypal = true;
  }
  return paypal ? "paypal" : "karte";
}

/* ------------------------------------------------------------------------- *
 * Bei der Uebergabe kassierter Betrag (Eingabe pruefen)
 * ------------------------------------------------------------------------- */

/**
 * Optionale Aufteilung eines bei der Uebergabe kassierten Betrags.
 *
 * Der Aufrufer erfasst das Geld weiterhin ueber /zahlung — dort entstehen Einnahme,
 * Status und Historie. Hier wird nur BERICHTET, was gerade kassiert wurde, damit die
 * Uebergabe-Mail es aufzaehlen kann. Deshalb prueft der Server die Summe gegen die
 * Teilbetraege: eine Mail darf keine Zahlen nennen, die nicht aufgehen.
 */
export interface KassiertBody {
  gesamt_eur?: unknown;
  restzahlung_eur?: unknown;
  kaution_eur?: unknown;
  ueberzahlung_eur?: unknown;
}

export function parseKassiert(
  roh: KassiertBody | undefined | null,
): { ok: true; wert: null | { gesamtEur: number; restzahlungEur: number; kautionEur: number; ueberzahlungEur: number } } | { ok: false; fehler: string } {
  if (roh === undefined || roh === null) return { ok: true, wert: null };
  if (typeof roh !== "object") return { ok: false, fehler: "kassiert muss ein Objekt sein" };
  const z = (v: unknown): number => {
    if (v === undefined || v === null || v === "") return 0;
    const n = typeof v === "number" ? v : parseFloat(String(v));
    return Number.isFinite(n) ? n : NaN;
  };
  const gesamt = z(roh.gesamt_eur);
  const teile = [z(roh.restzahlung_eur), z(roh.kaution_eur), z(roh.ueberzahlung_eur)];
  if ([gesamt, ...teile].some((n) => Number.isNaN(n) || n < 0)) {
    return { ok: false, fehler: "kassiert enthält keine gültigen Beträge >= 0" };
  }
  const summeCent = teile.reduce((s, n) => s + Math.round(n * 100), 0);
  // Nur ein rundum leeres Objekt heisst "nichts kassiert". Fehlt die Gesamtsumme,
  // waehrend Teilbetraege da sind, ist das ein Fehler und kein Nullfall — sonst
  // verschluckt die Mail still das Geld, das gerade eingenommen wurde.
  if (gesamt === 0 && summeCent === 0) return { ok: true, wert: null };
  if (summeCent !== Math.round(gesamt * 100)) {
    return { ok: false, fehler: "kassiert: Teilbeträge ergeben nicht die Gesamtsumme" };
  }
  return {
    ok: true,
    wert: { gesamtEur: gesamt, restzahlungEur: teile[0], kautionEur: teile[1], ueberzahlungEur: teile[2] },
  };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
