"use client";

/**
 * DateRangePicker — gross genuger Popup-Kalender fuer Mietzeitraum (Von / Bis).
 *
 * Zwei separate Felder, jedes oeffnet einen eigenen Monats-Kalender mit Pfeil-Navigation.
 * Quick-Picks im "Von"-Picker fuer typische Mietdauern (Wochenende, Lang-Wochenende, 5 Tage).
 * Smart-Default: nach Von-Auswahl wird Bis auf Von+3 vorgeschlagen (Lang-Wochenend-Muster).
 *
 * Constraints (Plan ich-hab-mal-bitte-snappy-boole, Punkt 7 + Manuel-Klarstellung):
 *   - Von >= heute + 1
 *   - Bis >= Von
 *   - Bis - Von <= 5 Tage (max Mietdauer)
 *
 * Nutzt react-day-picker v9 mit deutsch-Locale + Tailwind-Styling.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { DayPicker } from "react-day-picker";
import { de } from "date-fns/locale";
import "react-day-picker/style.css";

export interface DateRange {
  von: string;
  bis: string;
}

interface Props {
  value: DateRange;
  onChange: (range: DateRange) => void;
  layout?: "hero" | "form";
  className?: string;
}

const MAX_RANGE_DAYS = 5;

function todayPlus(days: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

function isoFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateFromIso(iso: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function fmtDe(iso: string): string {
  if (!iso) return "";
  const d = dateFromIso(iso);
  if (!d) return "";
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function addDays(d: Date, days: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + days);
  return c;
}

/**
 * Berechnet das naechste Wochenende ab `from`.
 * weekday: 5=Freitag, 6=Samstag, 0=Sonntag, 1=Montag.
 */
function nextWeekday(from: Date, targetWeekday: number): Date {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const cur = d.getDay();
  let delta = (targetWeekday - cur + 7) % 7;
  if (delta === 0) delta = 7; // immer „naechstes" — nicht „heute"
  d.setDate(d.getDate() + delta);
  return d;
}

const QUICK_PICKS: Array<{ label: string; build: (from: Date) => { von: Date; bis: Date } }> = [
  {
    label: "Wochenende (Sa–So)",
    build: (from) => {
      const sat = nextWeekday(from, 6);
      const sun = addDays(sat, 1);
      return { von: sat, bis: sun };
    },
  },
  {
    label: "Lang-Wochenende (Fr–Mo)",
    build: (from) => {
      const fri = nextWeekday(from, 5);
      const mon = addDays(fri, 3);
      return { von: fri, bis: mon };
    },
  },
  {
    label: "5 Tage (Do–Mo)",
    build: (from) => {
      const thu = nextWeekday(from, 4);
      const mon = addDays(thu, 4);
      return { von: thu, bis: mon };
    },
  },
];

export default function DateRangePicker({ value, onChange, layout = "form", className = "" }: Props) {
  const [openField, setOpenField] = useState<null | "von" | "bis">(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const minDate = todayPlus(1);
  const vonDate = dateFromIso(value.von);
  const bisDate = dateFromIso(value.bis);

  // Click-outside zum Schliessen
  useEffect(() => {
    if (!openField) return;
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenField(null);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [openField]);

  // ESC zum Schliessen
  useEffect(() => {
    if (!openField) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenField(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openField]);

  const handleVonSelect = useCallback(
    (d: Date | undefined) => {
      if (!d) return;
      const iso = isoFromDate(d);
      // Smart-Default: wenn Bis leer oder vor neuem Von oder > 5 Tage Range, dann Bis = Von+3 (Lang-Wochenende)
      let newBis = value.bis;
      const bisCur = dateFromIso(value.bis);
      const dayDiff = bisCur ? Math.round((bisCur.getTime() - d.getTime()) / 86_400_000) : -1;
      if (!bisCur || dayDiff < 0 || dayDiff > MAX_RANGE_DAYS) {
        newBis = isoFromDate(addDays(d, 3));
      }
      onChange({ von: iso, bis: newBis });
      setOpenField("bis"); // sofort zu Bis-Picker springen
    },
    [value.bis, onChange],
  );

  const handleBisSelect = useCallback(
    (d: Date | undefined) => {
      if (!d) return;
      onChange({ ...value, bis: isoFromDate(d) });
      setOpenField(null);
    },
    [value, onChange],
  );

  const handleQuickPick = useCallback(
    (idx: number) => {
      const today = todayPlus(0);
      const { von, bis } = QUICK_PICKS[idx].build(today);
      onChange({ von: isoFromDate(von), bis: isoFromDate(bis) });
      setOpenField(null);
    },
    [onChange],
  );

  // Disable-Funktionen
  const disabledForVon = { before: minDate };
  const disabledForBis = vonDate
    ? [{ before: vonDate }, { after: addDays(vonDate, MAX_RANGE_DAYS) }]
    : { before: minDate };

  // Styling
  const fieldClass = layout === "hero"
    ? "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm cursor-pointer hover:border-gold-500/50 transition-all text-left"
    : "w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white cursor-pointer hover:border-gold-500/50 transition-all text-left";

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {/* Von */}
        <div>
          <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">Von</label>
          <button
            type="button"
            onClick={() => setOpenField(openField === "von" ? null : "von")}
            className={fieldClass}
            aria-haspopup="dialog"
            aria-expanded={openField === "von"}
          >
            {value.von ? fmtDe(value.von) : <span className="text-gray-500">Datum waehlen</span>}
          </button>
          {/* Hidden inputs damit der Wert in FormData landet */}
          <input type="hidden" name="event_datum_von" value={value.von} />
        </div>

        {/* Bis */}
        <div>
          <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">Bis</label>
          <button
            type="button"
            onClick={() => setOpenField(openField === "bis" ? null : "bis")}
            disabled={!value.von}
            className={`${fieldClass} ${!value.von ? "opacity-50 cursor-not-allowed" : ""}`}
            aria-haspopup="dialog"
            aria-expanded={openField === "bis"}
            title={!value.von ? "Erst Von-Datum waehlen" : ""}
          >
            {value.bis ? fmtDe(value.bis) : <span className="text-gray-500">Datum waehlen</span>}
          </button>
          <input type="hidden" name="event_datum_bis" value={value.bis} />
        </div>
      </div>

      {/* Popup */}
      {openField && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end sm:items-start sm:absolute sm:inset-auto sm:top-full sm:left-0 sm:right-0 sm:mt-2 sm:z-40"
          onClick={(e) => {
            // Mobile-Backdrop click → close
            if (e.target === e.currentTarget) setOpenField(null);
          }}
        >
          {/* Mobile-Backdrop */}
          <div className="absolute inset-0 bg-black/50 sm:hidden" onClick={() => setOpenField(null)} />

          <div className="relative w-full sm:w-auto sm:min-w-[360px] sm:max-w-[420px] rounded-t-2xl sm:rounded-xl bg-navy-800 border border-white/10 shadow-2xl p-4 sm:p-5 max-h-[90vh] overflow-y-auto">
            {/* Header mit Close */}
            <div className="flex items-center justify-between mb-3 sm:hidden">
              <div className="text-white font-medium">
                {openField === "von" ? "Mietbeginn waehlen" : "Mietende waehlen"}
              </div>
              <button
                type="button"
                onClick={() => setOpenField(null)}
                className="text-gray-400 hover:text-white"
                aria-label="Schliessen"
              >
                ✕
              </button>
            </div>

            {/* Quick-Picks nur im Von-Picker */}
            {openField === "von" && (
              <div className="mb-3 pb-3 border-b border-white/10">
                <div className="text-xs text-gray-400 mb-2 uppercase tracking-wider">Schnellauswahl</div>
                <div className="flex flex-wrap gap-2">
                  {QUICK_PICKS.map((qp, i) => (
                    <button
                      key={qp.label}
                      type="button"
                      onClick={() => handleQuickPick(i)}
                      className="px-3 py-1.5 text-xs rounded-full bg-gold-500/15 text-gold-300 hover:bg-gold-500/25 hover:text-gold-200 transition-all cursor-pointer"
                    >
                      {qp.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <DayPicker
              mode="single"
              selected={openField === "von" ? vonDate : bisDate}
              onSelect={openField === "von" ? handleVonSelect : handleBisSelect}
              disabled={openField === "von" ? disabledForVon : disabledForBis}
              locale={de}
              weekStartsOn={1}
              defaultMonth={openField === "von" ? vonDate || minDate : bisDate || vonDate || minDate}
              showOutsideDays
              classNames={{
                root: "rdp-mb-eventverleih",
                month_caption: "flex justify-center items-center py-2 mb-1",
                caption_label: "text-white font-medium text-sm",
                nav: "flex items-center justify-between absolute inset-x-0 top-2 px-1 z-10",
                button_previous: "p-1.5 rounded hover:bg-white/10 cursor-pointer text-gray-300 hover:text-white transition-colors",
                button_next: "p-1.5 rounded hover:bg-white/10 cursor-pointer text-gray-300 hover:text-white transition-colors",
                month_grid: "w-full mt-1",
                weekdays: "flex",
                weekday: "text-gray-500 text-[10px] font-medium uppercase tracking-wider flex-1 text-center py-2",
                weeks: "flex flex-col gap-0.5",
                week: "flex w-full",
                day: "flex-1 aspect-square p-0.5",
                day_button: "w-full h-full rounded text-sm text-gray-300 hover:bg-white/10 hover:text-white cursor-pointer transition-colors flex items-center justify-center",
                selected: "[&_button]:bg-gold-500 [&_button]:text-navy-900 [&_button]:font-semibold [&_button]:hover:bg-gold-400 [&_button]:hover:text-navy-900",
                today: "[&_button]:ring-1 [&_button]:ring-gold-400/40",
                disabled: "[&_button]:text-gray-700 [&_button]:opacity-40 [&_button]:cursor-not-allowed [&_button]:hover:bg-transparent [&_button]:hover:text-gray-700",
                outside: "[&_button]:text-gray-700 [&_button]:opacity-50",
              }}
            />

            {openField === "bis" && value.von && (
              <div className="mt-3 pt-3 border-t border-white/10 text-xs text-gray-400">
                Mietzeitraum ab <span className="text-gold-400">{fmtDe(value.von)}</span>, maximal {MAX_RANGE_DAYS} Tage.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
