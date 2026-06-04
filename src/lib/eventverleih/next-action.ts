/**
 * Naechste-Aktion-Logik fuer Buchungen.
 *
 * Wird im Admin-Dashboard pro Karte angezeigt: was hat Manuel als naechstes zu tun?
 * Ableitung aus Status_Erweitert + Datums-Differenzen + Bezahlt-Flags. Kein neues
 * Baserow-Feld noetig.
 *
 * Plan ich-hab-mal-bitte-snappy-boole, Punkt 11.
 */

export type NextActionTone = "blue" | "amber" | "red" | "green" | "gray";

export interface NextAction {
  label: string;
  tone: NextActionTone;
  ageDays?: number;
}

export interface BuchungForAction {
  Status_Erweitert: { value: string } | null | string;
  Event_datum_von: string | null;
  Event_datum_bis: string | null;
  Anzahlung_Soll_Eur?: number | string | null;
  Anzahlung_Bezahlt_am: string | null;
  Restzahlung_Soll_Eur?: number | string | null;
  Restzahlung_Bezahlt_am: string | null;
  Kaution_Hinterlegt_am?: string | null;
  Kaution_Rueckzahlung_am?: string | null;
  Akzeptiert_am?: string | null;
}

const DAY_MS = 86_400_000;

function daysFromNow(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.floor((d.getTime() - Date.now()) / DAY_MS);
}

function statusValue(b: BuchungForAction): string {
  if (typeof b.Status_Erweitert === "string") return b.Status_Erweitert;
  return b.Status_Erweitert?.value || "";
}

function parseNum(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

/**
 * Liefert die naechste Aktion fuer eine Buchung.
 *
 * Regeln (Plan-Punkt 11):
 *   - Anfrage                      → Angebot freigeben oder ablehnen (blue)
 *   - Angebot_versendet, >7d       → Erinnerung schicken / nachhaken (amber)
 *   - Angebot_versendet, <=7d      → Wartet auf Kunden-Klick (gray)
 *   - Bestaetigt, keine Anzahlung  → Anzahlung nachhaken (amber/red je nach Alter)
 *   - Reserviert, Restzahlung offen → Info "faellig bei Uebergabe" (gray, KEIN Mahnen —
 *     Restzahlung ist laut AGB §3 erst bei Uebergabe faellig, Entscheidung 2026-06-04)
 *   - Reserviert, Event morgen     → Uebergabe vorbereiten (blue; amber wenn Restzahlung offen)
 *   - Uebergeben                   → Auf Rueckgabe warten (gray)
 *   - In_Miete, datum_bis vergangen → Rueckgabe ueberfaellig (red)
 *   - Zurueckgegeben, Kaution offen → Kaution freigeben oder einbehalten (amber)
 *   - Abgerechnet                  → Fertig — Archiv (green)
 *   - Storniert/No_Show            → Abgeschlossen (gray)
 */
export function getNextAction(b: BuchungForAction): NextAction {
  const status = statusValue(b);
  const eventInDays = daysFromNow(b.Event_datum_von);
  const eventEndInDays = daysFromNow(b.Event_datum_bis);
  const hasAnzahlung = !!b.Anzahlung_Bezahlt_am;
  const hasRestzahlung = !!b.Restzahlung_Bezahlt_am;

  switch (status) {
    case "Anfrage":
    case "Angebot_erstellt":
      return { label: "Angebot freigeben oder ablehnen", tone: "blue" };

    case "Angebot_versendet": {
      // Wie lange wartet das Angebot schon auf Kunden-Klick?
      const wartetSeitTagen = b.Akzeptiert_am ? null : eventInDays;
      // Heuristik: > 7 Tage ohne Klick + Event in der Zukunft → nachhaken
      if (wartetSeitTagen !== null && wartetSeitTagen > 7) {
        return { label: "Beim Kunden nachhaken (Angebot offen)", tone: "amber" };
      }
      return { label: "Wartet auf Kunden-Klick", tone: "gray" };
    }

    case "Bestaetigt": {
      if (!hasAnzahlung) {
        if (eventInDays !== null && eventInDays < 7) {
          return { label: "Anzahlung dringend mahnen (Event in " + eventInDays + "d)", tone: "red" };
        }
        return { label: "Anzahlung nachhaken", tone: "amber" };
      }
      // Anzahlung da, aber Status nicht gewechselt → seltener Fall, Manuel manuell
      return { label: "Status auf Reserviert pruefen", tone: "amber" };
    }

    case "Reserviert": {
      const restOffen = !hasRestzahlung && parseNum(b.Restzahlung_Soll_Eur) > 0;
      if (eventInDays !== null && eventInDays <= 1) {
        if (restOffen) {
          return { label: "Uebergabe vorbereiten — Restzahlung offen (bar/online)", tone: "amber" };
        }
        return { label: "Uebergabe vorbereiten / Vertrag drucken", tone: "blue" };
      }
      if (restOffen) {
        return { label: "Restzahlung offen — faellig bei Uebergabe", tone: "gray" };
      }
      return { label: "Buchung laeuft — naechste Aktion bei Uebergabe", tone: "gray" };
    }

    case "Uebergeben":
      return { label: "Auf Rueckgabe warten", tone: "gray" };

    case "In_Miete": {
      if (eventEndInDays !== null && eventEndInDays < 0) {
        return { label: `Rueckgabe ueberfaellig (${Math.abs(eventEndInDays)}d)`, tone: "red" };
      }
      return { label: "Rueckgabe steht an", tone: "blue" };
    }

    case "Zurueckgegeben": {
      if (b.Kaution_Hinterlegt_am && !b.Kaution_Rueckzahlung_am) {
        return { label: "Kaution freigeben oder einbehalten", tone: "amber" };
      }
      return { label: "Rechnung erstellen / abrechnen", tone: "blue" };
    }

    case "Abgerechnet":
      return { label: "Fertig — Archiv", tone: "green" };

    case "Storniert":
    case "No_Show":
      return { label: "Abgeschlossen", tone: "gray" };

    default:
      return { label: "Status unbekannt", tone: "gray" };
  }
}
