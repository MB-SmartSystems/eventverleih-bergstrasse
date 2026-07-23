"use client";

import { useState } from "react";

type Position = {
  id: number;
  name: string;
  anzahl: string | null;
  einzelpreis: string | null;
  gesamt: string | null;
};

type Service = { key: string; label: string; eur: number };

// Bewusste Kopie des Helfers aus page.tsx: der ist dort lokal und nicht exportiert,
// und ein Server-Modul nur für drei Zeilen Formatierung wäre mehr Umstand als Nutzen.
function fmtEur(v: string | null): string {
  if (!v) return "—";
  return `${parseFloat(v).toFixed(2).replace(".", ",")} €`;
}

/**
 * Entfernen-Kreuz. Grau auf dunklem Grund (6,5:1), bei Hover und Fokus rot (6,0:1).
 * Bewusst NICHT die Tailwind-Standardrots der hellen Palette: text-red-700 auf
 * warm-surface ergibt nur 2,6:1 und ist praktisch unlesbar.
 */
function Kreuz({
  label,
  pending,
  disabled,
  onClick,
}: {
  label: string;
  pending: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`${label} entfernen`}
      title={`${label} entfernen`}
      className="w-9 h-9 rounded text-warm-muted hover:text-red-400 hover:bg-red-400/10 focus-visible:text-red-400 focus-visible:outline focus-visible:outline-1 focus-visible:outline-red-400 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-warm-muted"
    >
      {pending ? "…" : "×"}
    </button>
  );
}

/**
 * Bestellung: Artikel-Positionen und zusätzlich gebuchte Leistungen, jeweils mit
 * Entfernen-Kreuz direkt in der Zeile. Ersetzt die frühere Kombination aus
 * server-gerenderter Tabelle plus EntfernenPanel darunter, das jeden Artikel ein
 * zweites Mal aufgelistet hat.
 *
 * Die Entfernen-Logik ist unverändert übernommen: Sicherheitsabfrage, API-Aufruf,
 * serverseitiger recalc, Reload. Die geteilte Busy-Sperre ist zwingend und der Grund,
 * warum die ganze Liste hier liegt statt nur der Button: zwei parallel laufende
 * Entfernungen würden gegen einen Stand rechnen, den die jeweils andere gerade ändert.
 *
 * Existiert bereits eine Rechnung, verschwinden die Kreuze. Der Server lehnt zusätzlich
 * mit 409 ab, damit die Sperre nicht per direktem API-Aufruf umgangen werden kann.
 */
export default function BestellListe({
  buchungId,
  positionen,
  services,
  rechnungsnummer,
}: {
  buchungId: number;
  positionen: Position[];
  services: Service[];
  rechnungsnummer: string | null;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const gesperrt = rechnungsnummer !== null;

  async function entferne(key: string, url: string, body: unknown, frage: string) {
    if (!confirm(frage)) return;
    setBusy(key);
    setError("");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) setError([data.error, data.detail].filter(Boolean).join(" — ") || `HTTP ${res.status}`);
      else window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerk-Fehler");
    } finally {
      setBusy(null);
    }
  }

  const entfernePosition = (p: Position) =>
    entferne(
      `pos-${p.id}`,
      `/api/admin/position/${p.id}/delete`,
      { buchungId },
      `„${p.name}“ wirklich aus der Buchung entfernen? Beträge werden neu berechnet.`,
    );

  const entferneService = (s: Service) =>
    entferne(
      `svc-${s.key}`,
      `/api/admin/buchung/${buchungId}/service-entfernen`,
      { service: s.key },
      `„${s.label}“ (${s.eur.toFixed(2)} €) entfernen? Beträge werden neu berechnet; bei bereits bezahlter Buchung entsteht ein Guthaben.`,
    );

  return (
    <section className="p-5 rounded-xl bg-warm-surface border border-warm-border">
      <h2 className="text-lg font-semibold text-warm-text mb-3">Bestellung ({positionen.length})</h2>

      {error && (
        <div className="mb-3 p-2 rounded bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>
      )}

      {positionen.length === 0 ? (
        <p className="text-sm text-warm-muted">Keine Artikel-Positionen.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-warm-muted border-b border-warm-border">
              <th className="py-2">Artikel</th>
              <th className="text-right">Anzahl</th>
              <th className="text-right">Einzel</th>
              <th className="text-right">Gesamt</th>
              {!gesperrt && (
                <th className="w-10">
                  <span className="sr-only">Entfernen</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {positionen.map((p) => (
              <tr key={p.id} className="border-b border-warm-border/50 last:border-0">
                <td className="py-2 text-warm-text">{p.name}</td>
                <td className="text-right text-warm-text">{p.anzahl}</td>
                <td className="text-right text-warm-muted">{fmtEur(p.einzelpreis)}</td>
                <td className="text-right text-warm-text font-medium">{fmtEur(p.gesamt)}</td>
                {!gesperrt && (
                  <td className="text-right">
                    <Kreuz
                      label={p.name}
                      pending={busy === `pos-${p.id}`}
                      disabled={busy !== null}
                      onClick={() => entfernePosition(p)}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {services.length > 0 && (
        <div className="mt-4 pt-3 border-t border-warm-border">
          <p className="text-xs uppercase tracking-wide text-warm-muted mb-2">Zusätzlich gebucht</p>
          <table className="w-full text-sm">
            <tbody>
              {services.map((s) => (
                <tr key={s.key} className="border-b border-warm-border/50 last:border-0">
                  <td className="py-2 text-warm-text">{s.label}</td>
                  <td className="text-right text-warm-text font-medium">{fmtEur(s.eur.toFixed(2))}</td>
                  {!gesperrt && (
                    <td className="w-10 text-right">
                      <Kreuz
                        label={s.label}
                        pending={busy === `svc-${s.key}`}
                        disabled={busy !== null}
                        onClick={() => entferneService(s)}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {gesperrt && (
        <p className="mt-4 pt-3 border-t border-warm-border text-xs text-warm-muted">
          Rechnung {rechnungsnummer} ist erstellt. Positionen und Leistungen lassen sich nicht mehr
          entfernen. Für eine Korrektur braucht es eine Storno- oder Korrekturrechnung.
        </p>
      )}
    </section>
  );
}
