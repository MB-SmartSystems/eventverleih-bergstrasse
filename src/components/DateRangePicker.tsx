"use client";

/**
 * DateRangePicker — gross genuger Popup-Kalender fuer Mietzeitraum (Von / Bis).
 *
 * Zwei separate Felder, jedes oeffnet einen eigenen Monats-Kalender mit Pfeil-Navigation.
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
import { createPortal } from "react-dom";
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

export default function DateRangePicker({ value, onChange, layout = "form", className = "" }: Props) {
  const [openField, setOpenField] = useState<null | "von" | "bis">(null);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => setMounted(true), []);

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
            {value.von ? fmtDe(value.von) : <span className="text-gray-500">Datum wählen</span>}
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
            title={!value.von ? "Erst Von-Datum wählen" : ""}
          >
            {value.bis ? fmtDe(value.bis) : <span className="text-gray-500">Datum wählen</span>}
          </button>
          <input type="hidden" name="event_datum_bis" value={value.bis} />
        </div>
      </div>

      {/* Popup — via React Portal direkt in <body>, damit kein Stacking-Context-Issue */}
      {openField && mounted && createPortal((
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          onClick={() => setOpenField(null)}
        >
          {/* Backdrop — rein visuell, pointer-events-none damit Klicks zum Outer durchgehen */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-none" />

          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-[min(96vw,720px)] rounded-2xl bg-navy-800 border border-white/10 shadow-2xl p-5 sm:p-7 max-h-[92vh] overflow-y-auto"
          >
            {/* Header mit Close */}
            <div className="flex items-center justify-between mb-5">
              <div className="text-white font-semibold text-xl">
                {openField === "von" ? "Mietbeginn wählen" : "Mietende wählen"}
              </div>
              <button
                type="button"
                onClick={() => setOpenField(null)}
                className="text-gray-400 hover:text-white text-2xl px-3 leading-none"
                aria-label="Schließen"
              >
                ✕
              </button>
            </div>

            <DayPicker
              mode="single"
              selected={openField === "von" ? vonDate : bisDate}
              onSelect={openField === "von" ? handleVonSelect : handleBisSelect}
              disabled={openField === "von" ? disabledForVon : disabledForBis}
              locale={de}
              weekStartsOn={1}
              defaultMonth={openField === "von" ? vonDate || minDate : bisDate || vonDate || minDate}
              showOutsideDays
              style={{
                ["--rdp-accent-color" as string]: "#f6c451",
                ["--rdp-accent-background-color" as string]: "rgba(246,196,81,0.15)",
              } as React.CSSProperties}
              classNames={{
                root: "rdp-mb-eventverleih [&_table]:m-0",
                month_caption: "flex justify-center items-center py-4 mb-4 relative",
                caption_label: "text-white font-bold text-2xl tracking-wide",
                nav: "flex items-center justify-between absolute inset-x-0 top-3 px-2 z-10",
                button_previous: "p-3 rounded-lg hover:bg-white/10 cursor-pointer text-gray-200 hover:text-white transition-colors",
                button_next: "p-3 rounded-lg hover:bg-white/10 cursor-pointer text-gray-200 hover:text-white transition-colors",
                chevron: "w-7 h-7 fill-gray-200",
                month_grid: "w-full mt-3 border-separate border-spacing-1",
                weekdays: "flex mb-2",
                weekday: "text-gray-400 text-base font-semibold uppercase tracking-wider w-[72px] text-center py-3",
                weeks: "flex flex-col gap-1",
                week: "flex w-full",
                day: "w-[72px] h-[72px] p-0",
                day_button: "w-full h-full rounded-xl text-2xl text-gray-100 hover:bg-white/10 hover:text-white cursor-pointer transition-colors flex items-center justify-center font-bold tabular-nums",
                selected: "[&_button]:bg-gold-500 [&_button]:text-navy-900 [&_button]:hover:bg-gold-400 [&_button]:hover:text-navy-900",
                today: "[&_button]:ring-2 [&_button]:ring-gold-400/60",
                disabled: "[&_button]:text-gray-600 [&_button]:opacity-40 [&_button]:cursor-not-allowed [&_button]:hover:bg-transparent [&_button]:hover:text-gray-600",
                outside: "[&_button]:text-gray-600 [&_button]:opacity-50",
              }}
            />

            {openField === "bis" && value.von && (
              <div className="mt-3 pt-3 border-t border-white/10 text-xs text-gray-400">
                Mietzeitraum ab <span className="text-gold-400">{fmtDe(value.von)}</span>, maximal {MAX_RANGE_DAYS} Tage.
              </div>
            )}
          </div>
        </div>
      ), document.body)}
    </div>
  );
}
