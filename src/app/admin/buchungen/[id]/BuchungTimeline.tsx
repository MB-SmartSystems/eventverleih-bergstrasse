/**
 * Buchungs-Timeline — chronologische Anzeige aller Ereignisse einer Buchung (Plan Phase 5 B8).
 *
 * Datenquelle: Buchungs-Felder (Anfragedatum, Akzeptiert_am, *_Bezahlt_am, etc.)
 * + Status-Erweitert.
 * Server-Component — kein State, nur Anzeige.
 */
interface TimelineProps {
  buchung: {
    Status_Erweitert?: { value: string } | string | null;
    Event_datum_von?: string | null;
    Event_datum_bis?: string | null;
    Anzahlung_Bezahlt_am?: string | null;
    Restzahlung_Bezahlt_am?: string | null;
    Kaution_Hinterlegt_am?: string | null;
    Kaution_Rueckzahlung_am?: string | null;
    Storno_am?: string | null;
    Uebergabe_Termin?: string | null;
    Uebergabe_Datum?: string | null;
    Ruecknahme_Datum?: string | null;
    Kaution_Prueffrist_bis?: string | null;
  };
  angebot?: {
    Anfragedatum?: string | null;
    Angebotsdatum?: string | null;
    Akzeptiert_am?: string | null;
  } | null;
  rechnungen?: Array<{ Rechnungsnummer?: string | null; Rechnungsdatum?: string | null }>;
}

interface TimelineItem {
  ts: number; // sortierbar
  datum: string; // human-readable
  label: string;
  done: boolean;
  icon: string;
  tone: "blue" | "green" | "amber" | "red" | "gray";
}

function fmtDe(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtDeTime(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function tsOf(s: string | null | undefined): number {
  if (!s) return 0;
  const d = new Date(s);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

const TONE_CLASS: Record<TimelineItem["tone"], string> = {
  blue: "text-blue-600",
  green: "text-green-600",
  amber: "text-amber-600",
  red: "text-red-600",
  gray: "text-gray-400",
};

export default function BuchungTimeline({ buchung, angebot, rechnungen }: TimelineProps) {
  const status = typeof buchung.Status_Erweitert === "object" && buchung.Status_Erweitert ? buchung.Status_Erweitert.value : (buchung.Status_Erweitert || "");

  const items: TimelineItem[] = [];

  if (angebot?.Anfragedatum) {
    items.push({ ts: tsOf(angebot.Anfragedatum), datum: fmtDe(angebot.Anfragedatum), label: "Anfrage eingegangen", done: true, icon: "📥", tone: "blue" });
  }
  if (angebot?.Angebotsdatum) {
    items.push({ ts: tsOf(angebot.Angebotsdatum), datum: fmtDe(angebot.Angebotsdatum), label: "Angebot versendet", done: true, icon: "📧", tone: "blue" });
  }
  if (angebot?.Akzeptiert_am) {
    items.push({ ts: tsOf(angebot.Akzeptiert_am), datum: fmtDeTime(angebot.Akzeptiert_am), label: "Kunde hat Angebot bestaetigt", done: true, icon: "✓", tone: "green" });
  }
  if (buchung.Anzahlung_Bezahlt_am) {
    items.push({ ts: tsOf(buchung.Anzahlung_Bezahlt_am), datum: fmtDe(buchung.Anzahlung_Bezahlt_am), label: "Anzahlung eingegangen — Reservierung verbindlich", done: true, icon: "💰", tone: "green" });
  }
  if (buchung.Restzahlung_Bezahlt_am) {
    items.push({ ts: tsOf(buchung.Restzahlung_Bezahlt_am), datum: fmtDe(buchung.Restzahlung_Bezahlt_am), label: "Restzahlung eingegangen", done: true, icon: "💰", tone: "green" });
  }
  if (buchung.Kaution_Hinterlegt_am) {
    items.push({ ts: tsOf(buchung.Kaution_Hinterlegt_am), datum: fmtDe(buchung.Kaution_Hinterlegt_am), label: "Kaution hinterlegt", done: true, icon: "🔒", tone: "blue" });
  }
  if (buchung.Uebergabe_Termin) {
    items.push({ ts: tsOf(buchung.Uebergabe_Termin), datum: fmtDeTime(buchung.Uebergabe_Termin), label: "Uebergabe-Termin", done: ["Uebergeben", "In_Miete", "Zurueckgegeben", "Abgerechnet"].includes(status), icon: "📦", tone: "blue" });
  }
  if (buchung.Uebergabe_Datum) {
    items.push({ ts: tsOf(buchung.Uebergabe_Datum), datum: fmtDe(buchung.Uebergabe_Datum), label: "Uebergabe durchgefuehrt", done: true, icon: "✓", tone: "green" });
  }
  if (buchung.Event_datum_von) {
    const t = tsOf(buchung.Event_datum_von);
    const inPast = t < Date.now();
    items.push({ ts: t, datum: fmtDe(buchung.Event_datum_von) + " – " + fmtDe(buchung.Event_datum_bis), label: "Event", done: inPast, icon: "🎉", tone: inPast ? "gray" : "amber" });
  }
  if (buchung.Ruecknahme_Datum) {
    items.push({ ts: tsOf(buchung.Ruecknahme_Datum), datum: fmtDe(buchung.Ruecknahme_Datum), label: "Rueckgabe durchgefuehrt", done: true, icon: "📦", tone: "green" });
  }
  if (buchung.Kaution_Prueffrist_bis && !buchung.Kaution_Rueckzahlung_am) {
    items.push({ ts: tsOf(buchung.Kaution_Prueffrist_bis), datum: fmtDe(buchung.Kaution_Prueffrist_bis), label: "Kaution-Pruefung — Frist", done: false, icon: "🔍", tone: "amber" });
  }
  if (buchung.Kaution_Rueckzahlung_am) {
    items.push({ ts: tsOf(buchung.Kaution_Rueckzahlung_am), datum: fmtDe(buchung.Kaution_Rueckzahlung_am), label: "Kaution aufgeloest", done: true, icon: "🔓", tone: "green" });
  }
  if (rechnungen && rechnungen.length > 0) {
    for (const r of rechnungen) {
      if (r.Rechnungsdatum) {
        items.push({ ts: tsOf(r.Rechnungsdatum), datum: fmtDe(r.Rechnungsdatum), label: `Rechnung ${r.Rechnungsnummer || ""} erstellt`, done: true, icon: "🧾", tone: "blue" });
      }
    }
  }
  if (buchung.Storno_am) {
    items.push({ ts: tsOf(buchung.Storno_am), datum: fmtDe(buchung.Storno_am), label: "Buchung storniert", done: true, icon: "✗", tone: "red" });
  }

  items.sort((a, b) => a.ts - b.ts);

  return (
    <section className="p-5 rounded-xl bg-warm-surface border border-warm-border">
      <h2 className="text-lg font-semibold text-warm-text mb-3">Timeline</h2>
      {items.length === 0 ? (
        <p className="text-sm text-warm-muted italic">Noch keine Ereignisse — Buchung gerade erst angelegt.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className={`flex items-start gap-3 text-sm ${item.done ? "" : "opacity-70"}`}>
              <div className={`text-base ${TONE_CLASS[item.tone]} w-6 text-center`}>
                {item.done ? item.icon : "○"}
              </div>
              <div className="w-32 text-xs text-warm-muted shrink-0">{item.datum}</div>
              <div className={`flex-1 ${item.done ? "text-warm-text" : "text-warm-muted"}`}>{item.label}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
