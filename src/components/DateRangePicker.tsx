"use client";

import { DayPicker, type DateRange } from "react-day-picker";
import { de } from "date-fns/locale";
import { useEffect, useMemo, useState } from "react";
import {
  MAX_RANGE_DAYS,
  dateToIso,
  isoToDate,
  rangeDays,
} from "@/lib/eventverleih/constants";
import "react-day-picker/dist/style.css";

export interface DateRangePickerProps {
  rangeVon: string | null;
  rangeBis: string | null;
  onChange: (von: string | null, bis: string | null) => void;
  variant?: "public" | "admin";
  /** Override responsive default (1 Monat mobile, 2 Monate desktop). */
  numberOfMonths?: number;
  /** Max. Range-Laenge. Default = MAX_RANGE_DAYS (Mietdauer). Fuer Sperrzeiten hochsetzen. */
  maxRangeDays?: number;
  /** Vergangene Tage erlauben (Admin-Sperrzeiten brauchen das ggf. nicht, default je variant). */
  allowPast?: boolean;
}

export default function DateRangePicker({
  rangeVon,
  rangeBis,
  onChange,
  variant = "public",
  numberOfMonths,
  maxRangeDays = MAX_RANGE_DAYS,
  allowPast,
}: DateRangePickerProps) {
  const [error, setError] = useState<string | null>(null);
  const [months, setMonths] = useState<number>(numberOfMonths ?? 1);

  useEffect(() => {
    if (numberOfMonths) {
      setMonths(numberOfMonths);
      return;
    }
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setMonths(mq.matches ? 2 : 1);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [numberOfMonths]);

  const selected = useMemo<DateRange | undefined>(() => {
    if (!rangeVon) return undefined;
    const from = isoToDate(rangeVon);
    // Nur "von" gewaehlt: als 1-Tages-Range rendern (from==to), damit der Tag sichtbar
    // markiert wird (range_start+range_end). Der generische "selected"-Slot ist ungestylt.
    const to = rangeBis ? isoToDate(rangeBis) : from;
    return { from, to };
  }, [rangeVon, rangeBis]);

  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 1);
    return d;
  }, []);

  const disabledMatcher =
    variant === "public" && !allowPast ? { before: tomorrow } : undefined;

  // Eigene Zwei-Klick-Logik (unabhaengig von react-day-picker v10, das bei EINEM Klick
  // via addToRange schon eine komplette {from,to}-Range liefert → Sheet schloss sofort).
  // 1. Klick = "von" (Kalender bleibt offen), 2. Klick = "bis". Reihenfolge wird normalisiert.
  // `triggerDate` (2. onSelect-Arg) ist der tatsaechlich geklickte Tag.
  function handleSelect(_next: DateRange | undefined, triggerDate?: Date) {
    if (!triggerDate) {
      setError(null);
      onChange(null, null);
      return;
    }
    const clickedIso = dateToIso(triggerDate);

    // 1. Klick (oder Neustart nach bereits kompletter Range): nur "von" setzen.
    if (!rangeVon || (rangeVon && rangeBis)) {
      setError(null);
      onChange(clickedIso, null);
      return;
    }

    // 2. Klick: "bis" setzen, ggf. von/bis tauschen wenn rueckwaerts geklickt.
    let von = rangeVon;
    let bis = clickedIso;
    if (isoToDate(bis).getTime() < isoToDate(von).getTime()) {
      [von, bis] = [bis, von];
    }
    if (rangeDays(von, bis) > maxRangeDays) {
      setError(`Maximal ${maxRangeDays} Tage${variant === "public" ? " Mietdauer" : ""}.`);
      onChange(von, null); // "bis" verwerfen, "von" behalten — Kalender bleibt offen
      return;
    }
    setError(null);
    onChange(von, bis);
  }

  const isPublic = variant === "public";

  // Tailwind-Klassen pro UI-Slot. KEIN globales CSS, KEIN Variable-Override.
  const classNames = isPublic
    ? {
        root: "rdp-root text-white",
        months: "flex flex-col md:flex-row gap-6 justify-center",
        month: "space-y-3",
        month_caption: "flex items-center justify-center pt-1 pb-2",
        caption_label: "text-base font-display font-semibold text-white",
        nav: "absolute top-1 left-0 right-0 flex justify-between px-1 z-10",
        button_previous:
          "h-8 w-8 inline-flex items-center justify-center rounded-md text-gold-400 hover:bg-white/10 transition-colors",
        button_next:
          "h-8 w-8 inline-flex items-center justify-center rounded-md text-gold-400 hover:bg-white/10 transition-colors",
        chevron: "w-4 h-4 fill-current",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "w-10 h-8 flex items-center justify-center text-[11px] font-semibold text-gold-400/70 uppercase tracking-wider",
        weeks: "",
        week: "flex w-full",
        day: "w-10 h-10 p-0 align-middle relative",
        day_button:
          "w-10 h-10 inline-flex items-center justify-center rounded-md text-sm text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent",
        today: "ring-1 ring-gold-500/40 rounded-md",
        selected: "",
        range_start:
          "bg-gold-500 [&>button]:bg-gold-500 [&>button]:text-navy-900 [&>button]:font-semibold rounded-l-md",
        range_end:
          "bg-gold-500 [&>button]:bg-gold-500 [&>button]:text-navy-900 [&>button]:font-semibold rounded-r-md",
        range_middle:
          "bg-gold-500/20 [&>button]:bg-transparent [&>button]:text-white [&>button]:hover:bg-gold-500/30",
        outside: "[&>button]:text-gray-600",
        disabled: "[&>button]:opacity-30 [&>button]:cursor-not-allowed",
        hidden: "invisible",
      }
    : {
        // Admin-Variante: warm-theme
        root: "rdp-root text-warm-text",
        months: "flex flex-col md:flex-row gap-6 justify-center",
        month: "space-y-3",
        month_caption: "flex items-center justify-center pt-1 pb-2",
        caption_label: "text-sm font-semibold text-warm-text",
        nav: "absolute top-1 left-0 right-0 flex justify-between px-1 z-10",
        button_previous:
          "h-7 w-7 inline-flex items-center justify-center rounded text-accent hover:bg-warm-border/50 transition-colors",
        button_next:
          "h-7 w-7 inline-flex items-center justify-center rounded text-accent hover:bg-warm-border/50 transition-colors",
        chevron: "w-3.5 h-3.5 fill-current",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "w-9 h-7 flex items-center justify-center text-[10px] font-semibold text-warm-muted uppercase tracking-wider",
        weeks: "",
        week: "flex w-full",
        day: "w-9 h-9 p-0 align-middle relative",
        day_button:
          "w-9 h-9 inline-flex items-center justify-center rounded text-sm text-warm-text hover:bg-warm-border/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent",
        today: "ring-1 ring-accent/40 rounded",
        selected: "",
        range_start:
          "bg-accent [&>button]:bg-accent [&>button]:text-white [&>button]:font-semibold rounded-l",
        range_end:
          "bg-accent [&>button]:bg-accent [&>button]:text-white [&>button]:font-semibold rounded-r",
        range_middle:
          "bg-accent/20 [&>button]:bg-transparent [&>button]:text-warm-text [&>button]:hover:bg-accent/30",
        outside: "[&>button]:text-warm-muted/40",
        disabled: "[&>button]:opacity-30 [&>button]:cursor-not-allowed",
        hidden: "invisible",
      };

  return (
    <div className="space-y-2">
      <div className="relative inline-block">
        <DayPicker
          mode="range"
          selected={selected}
          onSelect={handleSelect}
          locale={de}
          weekStartsOn={1}
          numberOfMonths={months}
          disabled={disabledMatcher}
          classNames={classNames}
          showOutsideDays={false}
        />
      </div>
      {error && (
        <div
          role="status"
          aria-live="polite"
          className={`text-xs ${
            isPublic ? "text-amber-300" : "text-red-600"
          }`}
        >
          {error}
        </div>
      )}
    </div>
  );
}
