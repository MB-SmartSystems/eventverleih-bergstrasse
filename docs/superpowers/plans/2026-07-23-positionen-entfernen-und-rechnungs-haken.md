# Entfernen-Kreuz an der Position + Rechnungs-Haken — Umsetzungsplan

> **Für agentische Ausführung:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` (empfohlen)
> oder `mb-executing-plans`, Task für Task. Schritte nutzen Checkbox-Syntax (`- [ ]`).

**Goal:** Artikel und Leistungen werden direkt in der Positionsliste per Kreuz entfernt (statt über einen
zweiten Block darunter), und der Checklisten-Punkt "Rechnung erstellt + Mail raus" hakt sich wieder selbst
ab, weil die Ursache im Rechnungs-Helper behoben wird.

**Architecture:** Die Entfernen-Logik aus `EntfernenPanel.tsx` zieht unverändert in eine neue
Client-Komponente `BestellListe.tsx`, die die bestehende Bestellungs-Sektion mitrendert, damit die geteilte
Busy-Sperre erhalten bleibt. Der Statusübergang `Zurueckgegeben → Abgerechnet` wandert in
`createRechnungForBuchung`, weil beide Erstellungspfade dort durchlaufen. Neu ist ein Schutz nach
Rechnungsstellung, doppelt gesichert in UI und Server.

**Tech Stack:** Next.js 14 App Router, React Server Components + Client Components, TypeScript, Tailwind,
Baserow als Datenhaltung.

**Bewusst-Minimal / Nicht-Scope:** Kein Test-Framework wird eingeführt (das Repo hat keins, siehe Global
Constraints). Keine Storno-/Korrekturrechnung wird gebaut, der Guard verweist nur darauf. Die Stripe-Lücke
(Restzahlung markiert die Rechnung nie als bezahlt) ist bewusst ein eigener, direkt folgender Schritt. Das
Abbau-Angebot (Preis, Reinigungsabgrenzung) ist eine Produktentscheidung und nicht Teil dieses Plans.
Keine Änderung an der Anzahl einer Position, nur ganz entfernen.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-23-positionen-entfernen-und-rechnungs-haken-design.md`
- **Kein Test-Framework vorhanden.** `package.json` hat weder Jest noch Vitest noch Playwright, es gibt
  keine einzige Testdatei. Statt TDD-Zyklen gilt als Gate je Task: `tsc --noEmit` grün, `npm run lint`
  grün, plus der im Task genannte manuelle Nachweis. Ein Test-Framework nachzurüsten ist eine eigene
  Entscheidung und nicht Teil dieses Auftrags.
- **Echte Umlaute überall** — Code-Kommentare, UI-Texte, Fehlermeldungen, Commit-Messages. Keine
  Transliteration (`ae/oe/ue`), kein `ss` statt `ß`. Ausnahme nur Baserow-Feldwerte wie `Zurueckgegeben`,
  die Identifier sind.
- **Kommentare auf Deutsch**, abweichend von der allgemeinen MB-Konvention: die berührten Dateien sind
  durchgängig deutsch kommentiert, und der bestehende Stil hat Vorrang vor der Hausregel.
- **Kontrast wird gemessen, nicht geschätzt.** Das Admin-Theme ist dunkel (`warm.surface #151d2e`). Jede
  neue Textfarbe muss 4,5:1 erreichen.
- **Kein Deploy, kein Push** ohne ausdrückliche Freigabe pro Aktion. Commits auf den aktuellen Branch
  `nachhaken-faellig` sind frei.
- **Codex-Review** über den Diff vor jeder Fertig-Meldung, Runde für Runde bis clean (Task 6).
- **Produktions-Baserow.** Der lokale Dev-Server spricht mit der echten Datenbank. Kein Testaufruf, der
  schreiben oder löschen könnte (Task 5 ist entsprechend konstruiert).

---

## Task 1: Server-Guard und Audit-Log in den Entfernen-Routen

`[parallel: Task 4]` — berührt andere Dateien als Task 2/3.

**Files:**
- Modify: `src/lib/eventverleih/rechnung.ts:59-66` (findRechnungForBuchung um Rechnungsnummer erweitern)
- Modify: `src/app/api/admin/position/[id]/delete/route.ts` (komplett)
- Modify: `src/app/api/admin/buchung/[id]/service-entfernen/route.ts:39-60`

**Interfaces:**
- Produces: `findRechnungForBuchung(buchungId: number): Promise<{ id: number; rechnungsnummer: string; token: string | null; url: string | null } | null>` — Task 2 nutzt die Rechnungsnummer nicht direkt (die kommt in page.tsx aus `rechnungen[0]`), die Routen aber schon.
- Produces: Beide Routen antworten mit **409** und `{ error, detail }`, wenn eine Rechnung existiert.

**Skills (am Prompt-Anfang der Ausführung laden):** keine spezifischen.

- [ ] **Step 1: `findRechnungForBuchung` um die Rechnungsnummer erweitern**

In `src/lib/eventverleih/rechnung.ts` die Funktion ersetzen:

```ts
/** Bestehende Rechnung für eine Buchung finden (vermeidet Doppel-Belege). */
export async function findRechnungForBuchung(
  buchungId: number,
): Promise<{ id: number; rechnungsnummer: string; token: string | null; url: string | null } | null> {
  const all = await listAllRows<RechnungRow>(TABLES.Rechnungen);
  const r = all.results.find((x) => x.Buchung_Link?.[0]?.id === buchungId);
  if (!r) return null;
  const token = r.Token_Public ?? null;
  return {
    id: r.id,
    rechnungsnummer: r.Rechnungsnummer,
    token,
    url: token ? `https://eventverleih-bergstrasse.de/rechnung/${token}` : null,
  };
}
```

Der bestehende Aufrufer `kaution-erstatten` nutzt nur `id`, `token` und `url` und bleibt unverändert
lauffähig, weil nur ein Feld dazukommt.

- [ ] **Step 2: `position/[id]/delete` mit Guard und Audit-Log neu schreiben**

Datei `src/app/api/admin/position/[id]/delete/route.ts` vollständig ersetzen:

```ts
/**
 * POST /api/admin/position/[id]/delete
 * Body: { buchungId: number }
 *
 * Entfernt eine Artikel-Position und rechnet die Buchung serverseitig neu.
 *
 * Gesperrt (409), sobald für die Buchung eine Rechnung existiert: der Rechnungs-Snapshot ist
 * GoBD-eingefroren und ändert sich nicht mit, die Buchung schon. Ohne Sperre liefe die
 * Buchungssumme still von der ausgestellten Rechnung weg. Korrekturen laufen danach über eine
 * Storno- oder Korrekturrechnung.
 */
import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { createRow, deleteRow, getRow, TABLES } from "@/lib/baserow/client";
import { recalcBuchung } from "@/lib/buchung-recalc";
import { findRechnungForBuchung } from "@/lib/eventverleih/rechnung";

type PositionRow = {
  id: number;
  Anzahl: string | null;
  Einzelpreis_Eur: string | null;
  Position_Gesamt_Eur: string | null;
  Artikel_Link: Array<{ id: number; value: string }> | null;
};

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const positionId = parseInt(id, 10);
  if (!positionId) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  let body: { buchungId?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (typeof body.buchungId !== "number") return NextResponse.json({ error: "buchungId required" }, { status: 400 });
  const buchungId = body.buchungId;

  try {
    // Guard VOR jedem Lese- oder Schreibzugriff auf die Position: eine gesperrte Buchung darf
    // auch dann nichts verändern, wenn die Positions-ID gar nicht existiert.
    const rechnung = await findRechnungForBuchung(buchungId);
    if (rechnung) {
      return NextResponse.json(
        {
          error: "Rechnung bereits erstellt",
          detail: `Für diese Buchung existiert bereits Rechnung ${rechnung.rechnungsnummer}. Positionen lassen sich danach nicht mehr entfernen. Eine Korrektur läuft über eine Storno- oder Korrekturrechnung.`,
        },
        { status: 409 },
      );
    }

    const vorher = await getRow<PositionRow>(TABLES.Buchungs_Position, positionId);
    await deleteRow(TABLES.Buchungs_Position, positionId);
    await recalcBuchung(buchungId);

    // Audit-Log best effort: eine geldrelevante Änderung soll eine Spur hinterlassen, ein
    // fehlgeschlagener Log-Eintrag darf die bereits vollzogene Löschung aber nicht kippen.
    try {
      const artikelId = vorher.Artikel_Link?.[0]?.id;
      let artikel = vorher.Artikel_Link?.[0]?.value ?? "Artikel";
      if (artikelId) {
        const a = await getRow<{ Bezeichnung: string }>(TABLES.Artikel, artikelId);
        if (a.Bezeichnung) artikel = a.Bezeichnung;
      }
      await createRow(TABLES.Audit_Log, {
        Name: `Position entfernt (${artikel}) Buchung #${buchungId}`,
        Aktion: "Sonstiges",
        Zeitpunkt: new Date().toISOString(),
        Buchung_ID_Ref: String(buchungId),
        Akteur: "Backoffice",
        Details: JSON.stringify({
          typ: "Position_entfernt",
          position_id: positionId,
          artikel,
          anzahl: vorher.Anzahl,
          einzelpreis_eur: vorher.Einzelpreis_Eur,
          gesamt_eur: vorher.Position_Gesamt_Eur,
        }),
        Aktiv: true,
      });
    } catch (e) {
      console.error("[position-delete] audit-log fehlgeschlagen:", e);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: "internal error", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
```

**Warum `Aktion: "Sonstiges"` und nicht `"Position_entfernt"`:** `Audit_Log.Aktion` ist ein
Single-Select mit fester Optionsliste (`DSE_Akzeptanz`, `AGB_Akzeptanz`, `Buchung_erstellt`, `Storno`,
`Schaden_dokumentiert`, `Kaution_erstattet`, vier DSGVO-Werte, `Datenexport_angefordert`, `Sonstiges`,
`Status_Change`, `Konflikt_erkannt`, `Konflikt_aufgeloest`, `Uebergabe`, `Ruecknahme`,
`Anzahlung_eingegangen`, `Restzahlung_eingegangen`, `Stripe_Event`). Ein unbekannter Wert wird von
Baserow mit 400 abgelehnt. Die eigentliche Aktion steht deshalb in `Details.typ` und im `Name`.

- [ ] **Step 3: Denselben Guard in `service-entfernen` einsetzen und den kaputten Audit-Wert korrigieren**

In `src/app/api/admin/buchung/[id]/service-entfernen/route.ts` den Import ergänzen:

```ts
import { findRechnungForBuchung } from "@/lib/eventverleih/rechnung";
```

Im `try`-Block direkt vor `const before = await getRow...` einfügen:

```ts
    const rechnung = await findRechnungForBuchung(buchungId);
    if (rechnung) {
      return NextResponse.json(
        {
          error: "Rechnung bereits erstellt",
          detail: `Für diese Buchung existiert bereits Rechnung ${rechnung.rechnungsnummer}. Leistungen lassen sich danach nicht mehr entfernen. Eine Korrektur läuft über eine Storno- oder Korrekturrechnung.`,
        },
        { status: 409 },
      );
    }
```

Im Audit-Log-Block derselben Datei `Aktion: "Service_entfernt"` ersetzen durch:

```ts
        Aktion: "Sonstiges",
```

und in das `Details`-Objekt als erstes Feld `typ: "Service_entfernt",` aufnehmen.

**Begründung:** `Service_entfernt` ist keine gültige Select-Option (Liste siehe Step 2). Der bestehende
Audit-Schreibvorgang läuft in einen 400 und wird vom `try/catch` verschluckt — dieses Protokoll hat nie
funktioniert. Es gibt in Tabelle 970 keinen einzigen Eintrag dieser Art. Ohne die Korrektur wäre der neue
Positions-Log symmetrisch zu etwas Kaputtem.

- [ ] **Step 4: Typprüfung**

```bash
node node_modules/.bin/tsc --noEmit -p tsconfig.json; echo "tsc exit: $?"
```
Erwartet: `tsc exit: 0`, keine Ausgabe davor.

- [ ] **Step 5: Commit**

```bash
git add src/lib/eventverleih/rechnung.ts "src/app/api/admin/position/[id]/delete/route.ts" "src/app/api/admin/buchung/[id]/service-entfernen/route.ts"
git commit -m "Entfernen-Routen: 409 sobald eine Rechnung existiert, Audit-Log für Positionen"
# Push erfolgt am Plan-Ende und nur nach ausdrücklicher Freigabe
```

---

## Task 2: Bestellliste mit Entfernen-Kreuz in der Zeile

**Files:**
- Create: `src/app/admin/buchungen/[id]/BestellListe.tsx`
- Modify: `src/app/admin/buchungen/[id]/page.tsx:27` (Import), `:440-508` (Sektion ersetzen)
- Bleibt vorerst liegen: `src/app/admin/buchungen/[id]/EntfernenPanel.tsx` (Löschung erst in Task 7)

**Interfaces:**
- Consumes: die 409-Antwort aus Task 1 (nur als Fehlertext, kein Vertrag im Code).
- Produces: `BestellListe({ buchungId, positionen, services, rechnungsnummer })` mit
  `positionen: Array<{ id: number; name: string; anzahl: string | null; einzelpreis: string | null; gesamt: string | null }>`,
  `services: Array<{ key: string; label: string; eur: number }>`, `rechnungsnummer: string | null`.

**Skills (am Prompt-Anfang der Ausführung laden):** `frontend-design` für die Tabellen-Details.

- [ ] **Step 1: Komponente anlegen**

Neue Datei `src/app/admin/buchungen/[id]/BestellListe.tsx`:

```tsx
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
```

- [ ] **Step 2: Import in `page.tsx` austauschen**

Zeile 27 ersetzen:

```tsx
import BestellListe from "./BestellListe";
```

- [ ] **Step 3: Bestellungs-Sektion in `page.tsx` ersetzen**

Den kompletten Block von `{/* 3. Bestellung */}` (Zeile 440) bis zum schließenden `</section>` (Zeile 508)
ersetzen durch:

```tsx
      {/* 3. Bestellung */}
      <BestellListe
        buchungId={buchung.id}
        positionen={positionen.map((p) => ({
          id: p.id,
          name: (p.Artikel_Link?.[0]?.id ? artikelNameById.get(p.Artikel_Link[0].id) : null) ?? "Artikel",
          anzahl: p.Anzahl,
          einzelpreis: p.Einzelpreis_Eur,
          gesamt: p.Position_Gesamt_Eur,
        }))}
        services={[
          { key: "lieferung", label: "Lieferung", eur: parseFloat(buchung.Preis_Lieferung || "0") || 0 },
          { key: "abholung", label: "Abholung", eur: parseFloat(buchung.Preis_Abholung || "0") || 0 },
          { key: "aufbau", label: "Aufbau-Service", eur: parseFloat(buchung.Preis_Aufbau || "0") || 0 },
          { key: "abbau", label: "Abbau-Service", eur: parseFloat(buchung.Preis_Abbau || "0") || 0 },
        ].filter((s) => s.eur > 0)}
        rechnungsnummer={rechnungen[0]?.Rechnungsnummer ?? null}
      />
```

Damit erscheint auch die bisher fehlende Abbau-Zeile in der Anzeige, sobald `Preis_Abbau > 0` ist. Sie war
im alten `EntfernenPanel` entfernbar, aber in der Anzeigetabelle nie sichtbar.

- [ ] **Step 4: Typprüfung und Lint**

```bash
node node_modules/.bin/tsc --noEmit -p tsconfig.json; echo "tsc exit: $?"
npm run lint
```
Erwartet: `tsc exit: 0`; Lint ohne Fehler. Warnung, falls `EntfernenPanel` jetzt ungenutzt ist, ist
erwartet und wird in Task 7 aufgelöst.

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/buchungen/[id]/BestellListe.tsx" "src/app/admin/buchungen/[id]/page.tsx"
git commit -m "Bestellung: Entfernen-Kreuz direkt an der Position, doppelte Auflistung entfällt"
```

---

## Task 3: Checklisten-Punkt an die Existenz der Rechnung binden

**Files:**
- Modify: `src/app/admin/buchungen/[id]/page.tsx` — **Anker statt Zeilennummer:** das Objekt mit
  `key: "abgerechnet"` im `autoItems`-Array. Task 2 hat die Zeilen davor bereits verschoben.

**Interfaces:**
- Consumes: `rechnungen` (bereits in `page.tsx:190` berechnet, Typ mit `Rechnungsnummer: string` und
  `Rechnungsdatum: string | null`) und den `AutoItem`-Typ aus `BuchungChecklist.tsx`
  (`{ key, label, checked, meta?, phase }`).

**Skills (am Prompt-Anfang der Ausführung laden):** keine spezifischen.

- [ ] **Step 1: Auto-Item ersetzen**

Das letzte Element des `autoItems`-Arrays ersetzen:

```tsx
          {
            key: "abgerechnet",
            phase: "Abrechnung",
            label: "Rechnung erstellt + Mail raus",
            checked: rechnungen.length > 0,
            meta: rechnungen[0]
              ? [
                  rechnungen[0].Rechnungsnummer,
                  rechnungen[0].Rechnungsdatum
                    ? new Date(rechnungen[0].Rechnungsdatum).toLocaleDateString("de-DE")
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : undefined,
          },
```

Der Punkt hing vorher an `status === "Abgerechnet"` und behauptete damit etwas anderes, als auf ihm steht:
`Abgerechnet` bedeutet "Vorgang vollständig geschlossen", der Text sagt "Rechnung erstellt und Mail raus".
Genau diese Lücke war das gemeldete Symptom.

- [ ] **Step 2: Typprüfung**

```bash
node node_modules/.bin/tsc --noEmit -p tsconfig.json; echo "tsc exit: $?"
```
Erwartet: `tsc exit: 0`.

- [ ] **Step 3: Commit**

```bash
git add "src/app/admin/buchungen/[id]/page.tsx"
git commit -m "Checkliste: Rechnungs-Haken hängt an der Rechnung, nicht am Buchungsstatus"
```

---

## Task 4: Statusübergang beim Erstellen einer bereits bezahlten Rechnung

`[parallel: Task 1]` — andere Stelle derselben Datei wie Task 1 Step 1; bei paralleler Ausführung Task 1
zuerst committen lassen oder beide Änderungen an `rechnung.ts` in einem Durchgang machen.

**Files:**
- Modify: `src/lib/eventverleih/rechnung.ts` — **Anker statt Zeilennummer:** die Import-Zeile mit
  `from "@/lib/baserow/client"` und der Block direkt nach `const created = await createRow<RechnungRow>(`.
  Task 1 hat `findRechnungForBuchung` darüber bereits verändert.

**Interfaces:**
- Consumes: `buchung.Status_Erweitert` aus dem bereits am Funktionsanfang geladenen `BuchungRow`
  (`getRow<BuchungRow>(TABLES.Buchungen, buchungId)`), sowie `vollBezahlt` aus Zeile 108.

**Skills (am Prompt-Anfang der Ausführung laden):** keine spezifischen.

- [ ] **Step 1: `updateRow` importieren**

Zeile 11 ersetzen:

```ts
import { createRow, getRow, listAllRows, updateRow, TABLES } from "@/lib/baserow/client";
```

- [ ] **Step 2: Statusübergang direkt nach `createRow` einfügen**

Unmittelbar nach dem `const created = await createRow<RechnungRow>(...)`-Block einfügen:

```ts
  // Ursache-Fix: der Übergang "Zurueckgegeben" -> "Abgerechnet" lag bisher ausschließlich in
  // /api/admin/rechnung/[id]/bezahlt. Entsteht eine Rechnung aber bereits als "Bezahlt" (Kunde
  // hat vor der Rückgabe gezahlt, Normalfall), wird der dortige Button nie angezeigt, der
  // Endpoint nie aufgerufen und der Status nie gesetzt. Deshalb hier, im Helper, den beide
  // Erstellungspfade durchlaufen (rechnung-erstellen und kaution-erstatten).
  //
  // Gleicher Guard wie im bezahlt-Endpoint: nur aus "Zurueckgegeben" heraus, damit eine früh
  // bezahlte Rechnung keine Buchung schließt, deren Material noch draußen ist.
  if (vollBezahlt && buchung.Status_Erweitert?.value === "Zurueckgegeben") {
    try {
      await updateRow(TABLES.Buchungen, buchungId, { Status_Erweitert: "Abgerechnet" });
    } catch (e) {
      console.error("[rechnung] Buchung-Abschluss fehlgeschlagen:", e);
    }
  }
```

Fail-soft: ein Baserow-Fehler darf die bereits angelegte Rechnung nicht kippen. Der Zustand entspricht
dann dem heutigen und wird von Hand gesetzt.

- [ ] **Step 3: Typprüfung**

```bash
node node_modules/.bin/tsc --noEmit -p tsconfig.json; echo "tsc exit: $?"
```
Erwartet: `tsc exit: 0`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/eventverleih/rechnung.ts
git commit -m "Rechnung: Buchung wird beim Erstellen abgerechnet, wenn sie zurück und bezahlt ist"
```

---

## Task 5: Verifikation am laufenden System

**Files:** keine Änderungen, reine Prüfung.

**Skills (am Prompt-Anfang der Ausführung laden):** keine spezifischen.

- [ ] **Step 1: Kontrast messen statt schätzen**

```bash
python3 - <<'PY'
def lum(h):
    c=[int(h[i:i+2],16)/255 for i in (1,3,5)]
    c=[x/12.92 if x<=0.03928 else ((x+0.055)/1.055)**2.4 for x in c]
    return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]
def ratio(a,b):
    la,lb=lum(a),lum(b); hi,lo=max(la,lb),min(la,lb)
    return (hi+0.05)/(lo+0.05)
bg="#151d2e"  # warm.surface
for name,fg in [("warm-muted (Ruhezustand)","#9ca3af"),("red-400 (Hover/Fokus)","#f87171"),("red-700 (alter Button, zum Vergleich)","#b91c1c")]:
    print(f"{name}: {ratio(fg,bg):.2f}:1")
PY
```
Erwartet: `warm-muted` etwa 6,5:1, `red-400` etwa 6,0:1, beide über 4,5:1. Der Vergleichswert `red-700`
liegt bei etwa 2,6:1 und dokumentiert, dass der alte Button-Text auf dem dunklen Admin-Grund unlesbar war.
Liegt ein neuer Wert unter 4,5:1, Farbe anpassen und erneut messen.

- [ ] **Step 2: Dev-Server starten**

```bash
npm run dev
```
Erwartet: `Local: http://localhost:3000`.

- [ ] **Step 3: Gesperrten Fall im Browser prüfen**

`http://localhost:3000/admin/buchungen/16` öffnen (Buchung 16 hat Rechnung RG-2026-0002).
Erwartet, alle drei Punkte:
- Bestellung zeigt die Positionen **ohne** Kreuze, darunter den Hinweis "Rechnung RG-2026-0002 ist erstellt…"
- Checklisten-Punkt "Rechnung erstellt + Mail raus" ist **abgehakt**, `meta` zeigt `RG-2026-0002 · 24.06.2026`
- Keine Konsolen-Fehler

- [ ] **Step 4: Offenen Fall im Browser prüfen**

Eine Buchung ohne Rechnung öffnen (im Admin unter Buchungen eine mit Status `Reserviert` oder
`Bestaetigt` wählen). Erwartet:
- Kreuze stehen rechts in jeder Positionszeile und, falls Leistungen gebucht sind, auch dort
- Kein Extra-Block "Position / Leistung entfernen" mehr
- Tab-Taste erreicht die Kreuze, Fokus ist sichtbar rot
- **Nicht klicken** — das würde eine echte Position aus der Produktionsdatenbank löschen

- [ ] **Step 5: Server-Guard ohne UI prüfen**

Der Aufruf nutzt bewusst eine **nicht existierende Positions-ID** an einer **gesperrten** Buchung: greift
der Guard, kommt 409 zurück, bevor irgendetwas gelesen oder gelöscht wird. Greift er nicht, läuft der
Aufruf in einen Baserow-404 und liefert 500 — in beiden Fällen wird nichts Echtes gelöscht.

```bash
PW=$(grep -m1 '^ADMIN_PASSWORD=' .env.local | cut -d= -f2- | tr -d '"'"'"'')
curl -s -c /tmp/evb-cookies.txt -X POST http://localhost:3000/api/admin/login \
  -H 'Content-Type: application/json' \
  --data "$(PW="$PW" python3 -c 'import json,os;print(json.dumps({"password":os.environ["PW"]}))')" >/dev/null
PW=""
curl -s -o /tmp/evb-guard.json -w '%{http_code}\n' -b /tmp/evb-cookies.txt \
  -X POST http://localhost:3000/api/admin/position/999999/delete \
  -H 'Content-Type: application/json' -d '{"buchungId":16}'
cat /tmp/evb-guard.json
```
Erwartet: `409` und ein `detail`, das `RG-2026-0002` nennt. Kommt `500`, greift der Guard nicht und Task 1
ist defekt. Danach `rm -f /tmp/evb-cookies.txt /tmp/evb-guard.json`.

Das Passwort wird aus `.env.local` gelesen und nie ausgegeben.

- [ ] **Step 6: Prüfergebnis festhalten**

Die gemessenen Kontrastwerte und die drei Browser-Befunde im Abschlussbericht nennen. Kein Commit nötig.

---

## Task 6: Codex-Review bis clean

**Files:** je nach Befund.

**Skills (am Prompt-Anfang der Ausführung laden):** keine spezifischen.

- [ ] **Step 1: Review über die Commits dieses Plans**

```bash
codex review --base 66aebaf --title "Entfernen-Kreuz + Rechnungs-Haken" < /dev/null 2>&1 | tee /tmp/codex-evb-positionen.log
```
`66aebaf` ist der Stand vor der Design-Spec. Ist bereits gepusht worden, stattdessen `--uncommitted`
nutzen.

- [ ] **Step 2: P1 und P2 beheben, dann erneut reviewen**

Befunde der Stufen P1 und P2 sofort fixen, committen, Review wiederholen. Nicht nach Runde 1 abbrechen.

**Stop-Regel:** Drehen sich drei aufeinanderfolgende Runden um dasselbe Systemverhalten, ist das ein
Architektur- und kein Iterationsproblem. Dann stoppen und eskalieren, statt weiterzupatchen.

- [ ] **Step 3: Ergebnis dokumentieren**

Im Abschlussbericht nennen, dass Codex lief, mit Rundenzahl und verbliebenen Befunden. Auch wenn ohne
Findings.

---

## Task 7: Aufräumen und Handbuch

**Files:**
- Delete: `src/app/admin/buchungen/[id]/EntfernenPanel.tsx` — **erst nach Manuels ausdrücklichem Okay**
- Modify: `docs/Eventverleih Bergstraße Betriebshandbuch.md`

**Skills (am Prompt-Anfang der Ausführung laden):** keine spezifischen.

- [ ] **Step 1: Prüfen, dass die Datei wirklich niemand mehr nutzt**

```bash
grep -rn "EntfernenPanel" src/ || echo "keine Referenz mehr"
```
Erwartet: `keine Referenz mehr`.

- [ ] **Step 2: Okay einholen und dann löschen**

Ohne ausdrückliches Okay von Manuel bleibt die Datei liegen. Mit Okay:

```bash
git rm "src/app/admin/buchungen/[id]/EntfernenPanel.tsx"
git commit -m "EntfernenPanel entfernt, Logik liegt jetzt in BestellListe"
```

- [ ] **Step 3: Betriebshandbuch um die neue Sperre ergänzen**

Im Abschnitt zur Buchungsbearbeitung ergänzen:

```markdown
**Positionen ändern nach Rechnungsstellung:** Sobald für eine Buchung eine Rechnung existiert,
lassen sich Positionen und Leistungen nicht mehr entfernen. Die Kreuze verschwinden, und ein
direkter API-Aufruf wird mit 409 abgelehnt. Grund: Der Rechnungs-Snapshot ist GoBD-eingefroren und
ändert sich nicht mit, die Buchung schon. Eine Korrektur nach Rechnungsstellung läuft über eine
Storno- oder Korrekturrechnung, nicht über stilles Löschen.
```

- [ ] **Step 4: Commit**

```bash
git add "docs/Eventverleih Bergstraße Betriebshandbuch.md"
git commit -m "Handbuch: Positionen sind nach Rechnungsstellung gesperrt"
```

---

## Nach dem Plan

1. **Bericht an Manuel** mit Kontrastwerten, Browser-Befunden, Codex-Ergebnis und der ausdrücklichen
   Kennzeichnung, dass Task 4 *reviewed* und nicht *verifiziert* ist.
2. **Prüfanleitung für die nächste echte Rechnung** aus Abschnitt 9 der Spec mitgeben.
3. **Kein Push und kein Deploy** ohne ausdrückliche Freigabe pro Aktion.
4. **Direkt danach als eigener Schritt:** Stripe-Lücke — Restzahlung per Stripe markiert die zugehörige
   Rechnung nie als bezahlt, dadurch bleibt sie unter "Offen" und ist Mahnungs-Kandidat. Eigener Diff,
   eigenes Codex-Review.
