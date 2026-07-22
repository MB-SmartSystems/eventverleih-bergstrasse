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
  Angebotsdatum?: string | null;
}

const DAY_MS = 86_400_000;

function daysFromNow(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.floor((d.getTime() - Date.now()) / DAY_MS);
}

/** Wie viele Tage liegt ein vergangenes Datum zurück (z.B. Versanddatum)? */
function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / DAY_MS);
}

/**
 * Darf für ein versendetes, noch offenes Angebot nachgehakt werden?
 * Regel: ab 10 Tagen seit Versand ODER wenn das Event ≤3 Tage entfernt ist
 * (Kurzfrist-Fall, sonst käme das Nachhaken nie rechtzeitig).
 */
export function darfNachgehaktWerden(angebotsdatum: string | null | undefined, eventInDays: number | null): boolean {
  const seitVersand = daysSince(angebotsdatum);
  // Mindestabstand: nie am selben/nächsten Tag nachhaken — der Kunde hatte noch keine Zeit.
  // (Deckt "heute gebucht, morgen Übergabe" ab: kein Nachhak-Druck.)
  if (seitVersand === null || seitVersand < 2) return false;
  const langGenug = seitVersand >= 10;
  const kurzfristNah = eventInDays !== null && eventInDays <= 3; // Event steht vor der Tür
  return langGenug || kurzfristNah;
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
      // Nachhaken NUR ab Tag 10 seit Versand (oder Kurzfrist: Event ≤3 Tage).
      // Vorher: noch auf den Kunden warten, kein Nachhak-Druck.
      if (!b.Akzeptiert_am && darfNachgehaktWerden(b.Angebotsdatum, eventInDays)) {
        return { label: "Beim Kunden nachhaken (Angebot offen)", tone: "amber" };
      }
      const seitVersand = daysSince(b.Angebotsdatum);
      if (seitVersand !== null && seitVersand < 10) {
        return { label: `Wartet auf Kunden-Klick (nachhaken ab Tag 10)`, tone: "gray" };
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
      return { label: "Status auf Reserviert prüfen", tone: "amber" };
    }

    case "Reserviert": {
      const restOffen = !hasRestzahlung && parseNum(b.Restzahlung_Soll_Eur) > 0;
      if (eventInDays !== null && eventInDays <= 1) {
        if (restOffen) {
          return { label: "Übergabe vorbereiten — Restzahlung offen", tone: "amber" };
        }
        return { label: "Übergabe vorbereiten / Vertrag drucken", tone: "blue" };
      }
      if (restOffen) {
        return { label: "Restzahlung offen — fällig bei Übergabe", tone: "gray" };
      }
      return { label: "Buchung läuft — nächste Aktion bei Übergabe", tone: "gray" };
    }

    case "Uebergeben":
      return { label: "Auf Rückgabe warten", tone: "gray" };

    case "In_Miete": {
      if (eventEndInDays !== null && eventEndInDays < 0) {
        return { label: `Rückgabe ueberfaellig (${Math.abs(eventEndInDays)}d)`, tone: "red" };
      }
      return { label: "Rückgabe steht an", tone: "blue" };
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
