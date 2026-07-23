"use client";

import { useState } from "react";
import type { BelegMailStatus } from "@/lib/eventverleih/rechnung";

function fmtZeit(iso: string | null): string {
  if (!iso) return "unbekannt";
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? "unbekannt"
    : d.toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * Die Rückmeldung sagt immer, was mit der BELEGMAIL passiert ist — nicht nur, dass die Rechnung
 * angelegt wurde. Vorher stand hier pauschal "wird per Mail gesendet", auch wenn gar nichts
 * rausging. Genau dieser stille Erfolg hat den Defekt so lange verdeckt.
 */
const MAIL_MELDUNG: Record<
  BelegMailStatus,
  { zeichen: string; box: string; titel: string; text: string; satz: (am: string | null) => string }
> = {
  gesendet: {
    zeichen: "✓",
    box: "bg-green-50 border-green-200",
    titel: "text-green-800",
    text: "text-green-700",
    satz: () => "Belegmail an den Kunden ausgelöst, PDF wird gerendert. Kopie liegt im Postfach.",
  },
  schon_gesendet: {
    zeichen: "•",
    box: "bg-amber-50 border-amber-200",
    titel: "text-amber-900",
    text: "text-amber-800",
    satz: (am) =>
      `Es wurde KEINE weitere Mail gesendet — der Beleg ging bereits am ${fmtZeit(am)} raus. Doppelversand bewusst verhindert.`,
  },
  nicht_angefordert: {
    zeichen: "•",
    box: "bg-amber-50 border-amber-200",
    titel: "text-amber-900",
    text: "text-amber-800",
    satz: () => "Es wurde KEINE Belegmail gesendet — der Versand war bei diesem Aufruf nicht angefordert.",
  },
  kein_webhook: {
    zeichen: "✗",
    box: "bg-red-50 border-red-200",
    titel: "text-red-800",
    text: "text-red-700",
    satz: () =>
      "Es ging KEINE Mail raus: der Mail-Workflow ist nicht konfiguriert (N8N_RECHNUNG_PDF_URL fehlt). Der Kunde hat den Beleg nicht.",
  },
  gesendet_marker_fehlt: {
    zeichen: "!",
    box: "bg-red-50 border-red-200",
    titel: "text-red-800",
    text: "text-red-700",
    satz: (am) =>
      `Die Belegmail IST an den Kunden raus (${fmtZeit(am)}), aber der Versand-Vermerk konnte nicht gespeichert werden. Bitte NICHT erneut auslösen — der Kunde bekäme sie sonst doppelt. Stattdessen in Baserow (Rechnungen, Feld Beleg_Mail_am) den Zeitpunkt von Hand eintragen.`,
  },
  fehlgeschlagen: {
    zeichen: "✗",
    box: "bg-red-50 border-red-200",
    titel: "text-red-800",
    text: "text-red-700",
    satz: () =>
      "Der Mailversand ist FEHLGESCHLAGEN. Der Kunde hat den Beleg nicht. Nochmal auslösen — es entsteht keine zweite Rechnung.",
  },
};

export default function RechnungErstellenButton({
  buchungId,
  hasPrice,
  alreadyHasRechnung,
  belegMailAm = null,
}: {
  buchungId: number;
  hasPrice: boolean;
  alreadyHasRechnung: boolean;
  /** Versand-Marker der vorhandenen Rechnung. Leer heißt unbekannt, nicht "nicht verschickt". */
  belegMailAm?: string | null;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const belegVersendet = alreadyHasRechnung && !!belegMailAm;
  const [created, setCreated] = useState<{
    rechnungsnummer: string;
    url: string;
    mail: BelegMailStatus;
    mail_am: string | null;
  } | null>(null);

  async function exec() {
    if (alreadyHasRechnung) {
      if (
        !confirm(
          "Für diese Buchung existiert bereits eine Rechnung. Es wird KEINE zweite erstellt und keine neue Nummer vergeben. Ist noch keine Belegmail versendet, wird sie jetzt nachgeholt. Fortfahren?",
        )
      )
        return;
    }
    // Preisprüfung nur für die ERSTELLUNG. Existiert die Rechnung schon, holt der Knopf nur die
    // Belegmail nach — die Rechnung ist längst eingefroren, die aktuellen Buchungspreise sind
    // dafür ohne Belang. Der Server prüft seit 2026-07-23 in derselben Reihenfolge.
    if (!alreadyHasRechnung && !hasPrice) {
      setError("Keine Preise gesetzt — Rechnung würde 0 € lauten. Bitte erst in Baserow Preise eintragen.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/buchung/${buchungId}/rechnung-erstellen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = [data.error, data.detail].filter(Boolean).join(" — ");
        setError(msg || `HTTP ${res.status}`);
      } else {
        setCreated({
          rechnungsnummer: data.rechnungsnummer,
          url: data.url,
          mail: (data.mail as BelegMailStatus) ?? "fehlgeschlagen",
          mail_am: data.mail_am ?? null,
        });
        // Reload nur im Erfolgsfall. Ging keine Mail raus, bleibt die Meldung stehen, bis Manuel
        // sie gelesen hat — ein automatisches Wegblenden hätte den Hinweis wieder unsichtbar gemacht.
        if (data.mail === "gesendet") setTimeout(() => window.location.reload(), 2500);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    const m = MAIL_MELDUNG[created.mail];
    return (
      <section className={`p-5 rounded-xl border text-sm ${m.box}`}>
        <div className={`font-medium ${m.titel}`}>
          {m.zeichen} Rechnung {created.rechnungsnummer} erstellt
        </div>
        <div className={`text-xs mt-1 ${m.text}`}>
          {m.satz(created.mail_am)}
        </div>
        <a href={created.url} target="_blank" rel="noreferrer" className={`text-xs underline mt-2 block ${m.text}`}>
          Web-Ansicht öffnen
        </a>
      </section>
    );
  }

  return (
    <section className="p-5 rounded-xl bg-warm-surface border border-warm-border">
      <h2 className="text-lg font-semibold text-warm-text mb-3">Rechnung</h2>
      {error && (
        <div className="mb-3 p-2 rounded bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>
      )}
      <button
        onClick={exec}
        disabled={submitting || belegVersendet}
        className="w-full py-3 px-4 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {submitting
          ? "Wird erstellt …"
          : belegVersendet
            ? "Beleg bereits versendet"
            : alreadyHasRechnung
              ? "Belegmail nachholen"
              : "Rechnung erstellen + Mail senden"}
      </button>
      <p className="text-xs text-warm-muted mt-2">
        {belegVersendet
          ? `Die Belegmail ging am ${fmtZeit(belegMailAm)} an den Kunden. Ein erneuter Versand würde ihn doppelt erreichen und ist deshalb gesperrt.`
          : alreadyHasRechnung
            ? "Die Rechnung existiert bereits, es entsteht keine zweite. Für sie ist kein Mailversand vermerkt — der Knopf holt ihn nach."
            : "Komplettrechnung mit PDF-Anhang an die Kunden-Mail. Web-Ansicht zusätzlich verlinkt."}
      </p>
    </section>
  );
}
