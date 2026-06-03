/**
 * Klartext-Status fuer eine Buchung — sagt Manuel auf einen Blick, was los ist
 * bzw. was als Naechstes zu tun ist. Abgeleitet aus Status_Erweitert + Termin-Feldern
 * + heutigem Datum. Reine Funktion → in Detail- UND Listen-Ansichten wiederverwendbar.
 */

export type StatusTon = "todo" | "live" | "ok" | "neutral" | "danger";

export type BuchungStatusFelder = {
  Status_Erweitert?: { value: string } | string | null;
  Uebergabe_Termin?: string | null;
  Uebergabe_Adresse?: string | null;
  Lieferadresse?: string | null;
  Event_datum_von?: string | null;
  Event_datum_bis?: string | null;
  Kaution_Soll_Eur?: string | number | null;
  Kaution_Rueckzahlung_am?: string | null;
};

function statusValue(s: BuchungStatusFelder["Status_Erweitert"]): string {
  if (!s) return "Anfrage";
  return typeof s === "string" ? s : s.value || "Anfrage";
}

function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function fmtTermin(d: string | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  // Wenn keine Uhrzeit-Info (reines Datum), nur Datum zeigen
  const hasTime = /\d{2}:\d{2}/.test(d);
  return date.toLocaleString("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(hasTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

/** Heute im [von..bis]-Zeitraum? (Datums-Vergleich auf Tagesebene) */
function eventLaeuft(von: string | null | undefined, bis: string | null | undefined): boolean {
  if (!von) return false;
  const today = new Date().toISOString().slice(0, 10);
  const v = von.slice(0, 10);
  const b = (bis || von).slice(0, 10);
  return today >= v && today <= b;
}

export function statusKlartext(b: BuchungStatusFelder): { text: string; ton: StatusTon } {
  const status = statusValue(b.Status_Erweitert);

  switch (status) {
    case "Anfrage":
      return { text: "Neue Anfrage — Angebot erstellen", ton: "todo" };
    case "Angebot_erstellt":
      return { text: "Angebot erstellt — noch nicht versendet", ton: "todo" };
    case "Angebot_versendet":
      return { text: "Angebot beim Kunden — wartet auf Zusage", ton: "neutral" };
    case "Bestaetigt":
    case "Reserviert": {
      const termin = fmtTermin(b.Uebergabe_Termin);
      if (!termin) return { text: "Übergabe-Termin noch ausmachen", ton: "todo" };
      const ort = b.Uebergabe_Adresse || b.Lieferadresse || "Treffpunkt";
      return { text: `Übergabe vereinbart: ${ort}, ${termin}`, ton: "ok" };
    }
    case "Uebergeben":
    case "In_Miete":
      return eventLaeuft(b.Event_datum_von, b.Event_datum_bis)
        ? { text: "Event läuft gerade", ton: "live" }
        : { text: "Artikel beim Kunden", ton: "live" };
    case "Zurueckgegeben":
      if (num(b.Kaution_Soll_Eur) > 0 && !b.Kaution_Rueckzahlung_am) {
        return { text: "Zurück — Kaution noch abrechnen", ton: "todo" };
      }
      return { text: "Zurückgegeben — Rechnung erstellen", ton: "todo" };
    case "Abgerechnet":
      return { text: "Abgeschlossen", ton: "ok" };
    case "Storniert":
      return { text: "Storniert", ton: "danger" };
    default:
      return { text: status.replace(/_/g, " "), ton: "neutral" };
  }
}
