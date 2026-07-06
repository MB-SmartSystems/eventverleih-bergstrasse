# Gästezahl-Set-Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or mb-executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kunde tippt Gästezahl → schematische Live-Grafik + komplettes Miet-Set per Klick in den Warenkorb; ersetzt die drei nicht-funktionalen „Anlass-Sets". Vorab: Kaution-Rundung auf 1 € vereinheitlichen.

**Architecture:** Reine Empfehlungs-Logik als testbare Lib (`set-empfehlung.ts`), gerendert von einer Client-Komponente (`GaestezahlSet.tsx`) mit Inline-SVG-Schema (`SetLayoutSvg.tsx`). Artikel werden per **Slug** aus `/api/products` aufgelöst (API um `slug` + `bestandOk` erweitert). Kein Test-Framework im Repo → Kernlogik per Node-Check-Skript + headless Playwright-Funktionstest verifiziert.

**Tech Stack:** Next.js App Router, React Client Component, Tailwind, Inline-SVG, Baserow (957), CartContext.

**Spec:** `docs/superpowers/specs/2026-07-06-gaestezahl-set-empfehlung-design.md`

---

## Task 1: Kaution-Rundung auf nächsten 1 € (`rundeKaution`)

**Files:**
- Modify: `src/lib/eventverleih/constants.ts` (`rundeKaution`, ~Z.40-47)
- Check: `/tmp/kaution_check.mjs` (Wegwerf-Verifikation)

- [ ] **Step 1: `rundeKaution` von 5 € auf 1 € umstellen**

```ts
/**
 * Kaution auf den nächsten vollen 1 € aufrunden (Manuel 2026-07-06; vorher 5 €).
 * Immer auf, nie ab; Epsilon gegen Float-Artefakte (27.0000001 → 27, nicht 28).
 */
export function rundeKaution(eur: number): number {
  return Math.ceil(eur - 1e-9);
}
```

- [ ] **Step 2: Verifizieren (Node-Check)**

Run: `node -e "const f=x=>Math.ceil(x-1e-9); [[26.5,27],[27,27],[26,26],[0,0],[21.5,22]].forEach(([i,e])=>{const g=f(i); if(g!==e)throw new Error(i+'→'+g+' exp '+e); console.log(i,'→',g)})"`
Expected: `26.5 → 27`, `27 → 27`, `26 → 26`, `0 → 0`, `21.5 → 22` (kein Throw)

- [ ] **Step 3: tsc**

Run: `node_modules/.bin/tsc --noEmit`
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add src/lib/eventverleih/constants.ts
git commit -m "fix(kaution): auf naechsten 1 EUR aufrunden statt 5 EUR (Manuel)"
```

---

## Task 2: Kaution-Rundung konsistent anwenden (Admin-Anlage + recalc)

Aktuell rundet nur der Kunden-/Cart-Pfad; `anfrage/neu` und `recalcBuchung` schreiben roh → Rundung geht verloren.

**Files:**
- Modify: `src/app/api/admin/anfrage/neu/route.ts` (Kaution-Summe ~Z.144 + Write ~Z.168)
- Modify: `src/lib/buchung-recalc.ts` (Kaution-Berechnung ~Z.91 + Write ~Z.120)

- [ ] **Step 1: `anfrage/neu` — `rundeKaution` auf die Kaution-Summe anwenden**

`import { rundeKaution } from "@/lib/eventverleih/constants";` ergänzen (falls nicht vorhanden). Beim Schreiben `Kaution_Soll_Eur: rundeKaution(kautionSumme).toFixed(2)` statt `kautionSumme.toFixed(2)`.

- [ ] **Step 2: `recalcBuchung` — Kaution runden**

In `buchung-recalc.ts` nach `kaution = round2(kaution)` zusätzlich `kaution = rundeKaution(kaution);` (Import ergänzen). So wird der auf die Buchung geschriebene `Kaution_Soll_Eur` konsistent auf 1 € gerundet.

- [ ] **Step 3: tsc + Konsistenz-Check (Node, gegen Live-Baserow read-only)**

Run: `node_modules/.bin/tsc --noEmit` → exit 0.
Manuell prüfen: für eine Beispiel-Positionsmenge ergibt `rundeKaution(sum(anz×snapshot))` einen ganzen Euro.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/anfrage/neu/route.ts src/lib/buchung-recalc.ts
git commit -m "fix(kaution): Rundung konsistent in Admin-Anlage + recalc anwenden"
```

---

## Task 3: `/api/products` um `slug` + `bestandOk` erweitern

**Files:**
- Modify: `src/lib/types.ts` (`RentalProduct` + `slug`)
- Modify: `src/lib/baserow-data.ts` (`rowToProduct` ~Z.163-176: `slug` mappen)
- Modify: `src/app/api/products/route.ts` (publicProducts-Map ~Z.55-69)

- [ ] **Step 1: `slug` zum Typ**

In `RentalProduct` (types.ts) ergänzen: `slug: string;`

- [ ] **Step 2: `rowToProduct` — Slug mappen**

In `baserow-data.ts` `rowToProduct` ergänzen: `slug: r.Slug || slugify(r.Bezeichnung || ""),` (r.Slug existiert Z.81; `slugify` existiert Z.148).

- [ ] **Step 3: Public-API exponiert `slug` + `bestandOk`**

In der `publicProducts`-Map (route.ts) ergänzen: `slug: p.slug,` und `bestandOk: p.quantityOk,` (quantityOk = Bestand_OK, existiert im RentalProduct).

- [ ] **Step 4: tsc + Live-Check**

Run: `node_modules/.bin/tsc --noEmit` → exit 0.
Nach Deploy: `curl -s "https://eventverleih-bergstrasse.de/api/products?v=$(date +%s)"` → jedes Produkt hat `slug` + `bestandOk`. Slugs enthalten `faltzelt-3x6m`, `stuhl`, `klapptisch`, `seitenwand-fenster`, `seitenwand-reissverschluss`, `metallplatten-gewicht`, `lichterkette-18m`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/baserow-data.ts src/app/api/products/route.ts
git commit -m "feat(products): slug + bestandOk in Public-API (fuer Gaestezahl-Tool)"
```

---

## Task 4: Empfehlungs-Logik (pure Lib) + Node-Verifikation

**Files:**
- Create: `src/lib/eventverleih/set-empfehlung.ts`
- Check: `/tmp/set_check.mjs`

- [ ] **Step 1: Lib schreiben**

```ts
// Reine Gästezahl → Set-Logik. Keine React/Baserow-Abhängigkeit (testbar).
export const SLUGS = {
  zelt3x3: "faltzelt-3x3m",
  zelt3x6: "faltzelt-3x6m",
  stuhl: "stuhl",
  tisch: "klapptisch",
  tischdecke: "tischdecke",
  wandFenster: "seitenwand-fenster",
  wandReissverschluss: "seitenwand-reissverschluss",
  gewicht: "metallplatten-gewicht",
  lichterkette: "lichterkette-18m",
  stehtisch: "stehtisch-mit-husse",
  heizpilz: "heizstrahler",
  gasflasche: "gasflasche-11kg",
} as const;

export const MIN_GAESTE = 2;
const EINZELZELT_KAP = 24; // ein 3×6-Zelt

export interface SetPos { slug: string; anzahl: number; }
export interface SetEmpfehlung {
  gueltig: boolean;          // false wenn G < MIN oder G > maxGaeste
  zelt: "3x3" | "3x6";
  tische: number;
  stuehle: number;
  positionen: SetPos[];      // Auto-in-Warenkorb
  maxGaeste: number;
}

/** MAX_G aus Bestand: min(Stühle, Tische×8, Einzelzelt-Kapazität). */
export function maxGaeste(bestand: { stuhl: number; tisch: number }): number {
  return Math.max(0, Math.min(bestand.stuhl, bestand.tisch * 8, EINZELZELT_KAP));
}

export function empfehlung(g: number, bestand: { stuhl: number; tisch: number }): SetEmpfehlung {
  const maxG = maxGaeste(bestand);
  const zelt: "3x3" | "3x6" = g <= 12 ? "3x3" : "3x6";
  const tische = Math.ceil(g / 8);
  const gueltig = Number.isInteger(g) && g >= MIN_GAESTE && g <= maxG;
  const beine = zelt === "3x6" ? 6 : 4;
  const fenster = zelt === "3x6" ? 4 : 2; // immer 2 Reißverschluss, Rest Fenster
  const positionen: SetPos[] = [
    { slug: SLUGS.stuhl, anzahl: g },
    { slug: SLUGS.tisch, anzahl: tische },
    { slug: SLUGS.tischdecke, anzahl: tische },
    { slug: zelt === "3x6" ? SLUGS.zelt3x6 : SLUGS.zelt3x3, anzahl: 1 },
    { slug: SLUGS.wandReissverschluss, anzahl: 2 },
    { slug: SLUGS.wandFenster, anzahl: fenster },
    { slug: SLUGS.gewicht, anzahl: beine },
    { slug: SLUGS.lichterkette, anzahl: 1 },
  ];
  return { gueltig, zelt, tische, stuehle: g, positionen, maxGaeste: maxG };
}

/** Optionale Zusatz-Empfehlungen (NICHT auto): Stehtisch immer, Heizpilz Okt–Apr. */
export function zusatzEmpfehlungen(monat1bis12: number): string[] {
  const out = [SLUGS.stehtisch];
  if (monat1bis12 >= 10 || monat1bis12 <= 4) out.push(SLUGS.heizpilz);
  return out;
}
```

- [ ] **Step 2: Node-Check gegen die Akzeptanzkriterien der Spec**

Erstelle `/tmp/set_check.mjs`, das `empfehlung(g, {stuhl:30,tisch:3})` für G=10/12/13/18/24 gegen die Spec-Tabelle prüft (10→3×3/2 Tische/2 Fenster/4 Gewichte; 13→3×6/2/4/6; 18→3×6/3/4/6; 24→3×6/3/4/6) und G=25 → `gueltig:false`, G=1 → `gueltig:false`. (Lib vorher mit `esbuild`/`tsc` nach JS transpilen ODER die Funktion im mjs spiegeln.)
Expected: alle Assertions grün.

- [ ] **Step 3: tsc + Commit**

```bash
node_modules/.bin/tsc --noEmit
git add src/lib/eventverleih/set-empfehlung.ts
git commit -m "feat(set-tool): reine Gaestezahl->Set-Empfehlungslogik + Node-Check"
```

---

## Task 5: SVG-Schema-Komponente (`SetLayoutSvg.tsx`)

**Files:**
- Create: `src/components/SetLayoutSvg.tsx`

- [ ] **Step 1: Komponente schreiben**

Props: `{ zelt: "3x3"|"3x6"; tische: number; stuehle: number }`. Rendert Inline-SVG (viewBox), Marken-Farben (`gold`/`navy`/`warm`):
- Zelt-Rahmen: `3x3` quadratisch (z. B. 200×200), `3x6` länglich (320×160).
- Tische: `tische` Rechtecke, mittig in Reihe zu einer Tafel zusammengeschoben.
- Stühle: `stuehle` kleine Kreise, gleichmäßig auf die zwei Langseiten der Tafel verteilt (Rest ggf. an die Enden). Rein schematisch, nicht maßstabsgetreu.
Deterministisch, keine Zufalls-/Datumsfunktionen. `aria-label` mit Textbeschreibung.

- [ ] **Step 2: tsc + Commit**

```bash
node_modules/.bin/tsc --noEmit
git add src/components/SetLayoutSvg.tsx
git commit -m "feat(set-tool): schematische SVG-Draufsicht Zelt+Tafel+Stuehle"
```

---

## Task 6: `GaestezahlSet.tsx` + Einbau in `page.tsx` (ersetzt AnlassSets)

**Files:**
- Create: `src/components/GaestezahlSet.tsx`
- Modify: `src/app/page.tsx` (`<AnlassSets/>` → `<GaestezahlSet/>`)
- Delete (am Ende): `src/components/AnlassSets.tsx`

- [ ] **Step 1: Komponente bauen**

Client Component (`"use client"`). Nutzt `useCart()`, lädt `/api/products` (für Namen/Preise/`bestandOk`/`slug`). Ablauf:
- **Eingabe:** Zahlenfeld (min 2) + Slider (1..`maxGaeste`), warmer Einstiegssatz (Ton: einladend), Überschrift „Wie viele Gäste? – wir stellen dein Set zusammen".
- `bestand` aus Products: `stuhl` = bestandOk von slug `stuhl`, `tisch` = bestandOk von slug `klapptisch`. → `empfehlung(g, bestand)`.
- **G > maxGaeste oder < 2:** kein Set/keine Grafik, Fallback-Hinweis „Für größere Feiern (mehr als N Gäste) stell dir dein Set unten im Sortiment zusammen oder melde dich".
- **Gültig:** `<SetLayoutSvg .../>` + Positionsliste (Name + Menge), Schwellen-Hinweis („ab 9 Gästen 2 Tische" / „ab 13 das 3×6-Zelt"), Button **„Set in den Warenkorb"**.
- **Button-Logik:** Positionen slug→Produkt auflösen; `Bestand_OK==0` → Position weglassen + „aktuell nicht verfügbar". Mengen via `updateQuantity(product.name, anzahl)` setzen (nicht N× addItem). Warenkorb nicht leer → Kunden fragen (ersetzen `clearCart()` dann setzen / oder dazulegen). **Aufbau NICHT anfassen/erwähnen.**
- **Zusatz-Empfehlungen** (`zusatzEmpfehlungen(monat)`): Stehtisch + (saisonal) Heizpilz als dezente „passt dazu?"-Zeile mit 1-Klick-Add (Heizpilz-Add nimmt Gasflasche mit). Monat via Prop vom Server ODER `new Date().getMonth()+1` im Client (Client-Datum ok, kein SSR-Determinismus-Zwang).
- **Kontakt-Zeile** aus AnlassSets erhalten (Taufe/Jubiläum/„anderes Fest" → `#kontakt`).

- [ ] **Step 2: In `page.tsx` einbauen**

`import GaestezahlSet from "@/components/GaestezahlSet";`, `<AnlassSets/>` durch `<GaestezahlSet/>` ersetzen (Section-`id` beibehalten, damit Hero/FAQ-Anker weiter greifen).

- [ ] **Step 3: tsc + Build**

Run: `node_modules/.bin/tsc --noEmit` (exit 0), dann Dev-Server-Funktionstest (Task 7). AnlassSets.tsx erst löschen, wenn nichts mehr darauf verweist (`grep -rn AnlassSets src/`).

- [ ] **Step 4: Commit**

```bash
git add src/components/GaestezahlSet.tsx src/app/page.tsx
git commit -m "feat(set-tool): Gaestezahl-Tool ersetzt Anlass-Sets (Grafik + Warenkorb)"
```

---

## Task 7: Verifikation (headless Funktionstest) + Deploy + Live-Check

**Files:**
- Check: `/tmp/set_e2e.py` (Playwright, `~/.venvs/notebooklm/bin/python3`)

- [ ] **Step 1: Dev-Server + Playwright-Funktionstest**

Dev-Server (`next dev -p 3199`, run_in_background). Test:
- `/` öffnen, zur Set-Section scrollen. Gästezahl 18 eingeben → Grafik erscheint (SVG vorhanden), „Set in den Warenkorb" klicken → Warenkorb enthält **18 Stuhl, 3 Klapptisch, 3 Tischdecke, 1 Faltzelt 3×6, 2 Seitenwand Reißverschluss, 4 Seitenwand Fenster, 6 Metallplatten-Gewicht, 1 Lichterkette** (Cart-State/localStorage prüfen).
- Gästezahl 25 → kein Set, Fallback-Hinweis sichtbar.
- Browser-Console ohne Fehler.
Expected: alle Checks PASS.

- [ ] **Step 2: Dev-Server stoppen (`fuser -k 3199/tcp`), Push (deploy)**

```bash
GT=$(grep -E '^GITHUB_TOKEN=' /home/manuel/projects/mb-smartsystems-master/.env | head -1 | cut -d= -f2- | tr -d '"')
git push "https://Manuel:${GT}@github.com/MB-SmartSystems/eventverleih-bergstrasse.git" main
```

- [ ] **Step 3: Vercel READY + Live-Check**

Deployment `state==READY` für den HEAD-SHA (Vercel-API). Dann Live: `/api/products` liefert `slug`+`bestandOk`; Startseite zeigt das Tool statt der drei Kacheln. Kurzer Live-Funktionstest (Gästezahl → Grafik) headless gegen die Live-URL.

- [ ] **Step 4: AnlassSets.tsx löschen (wenn referenzfrei) + Commit + Push**

```bash
grep -rn "AnlassSets" src/ || (git rm src/components/AnlassSets.tsx && git commit -m "chore: alte AnlassSets entfernt" && git push …)
```

---

## Definition of Done (Goal erreicht)

- Kaution rundet überall auf 1 € (Cart, Admin-Anlage, recalc) — tsc grün, verifiziert.
- `/api/products` liefert `slug` + `bestandOk` (live geprüft).
- Startseite zeigt das Gästezahl-Tool statt der drei Anlass-Kacheln; Eingabe → Live-Grafik.
- „Set in den Warenkorb" legt für G=18 exakt das Spec-Set an (headless verifiziert); G=25 → Fallback.
- Stehtisch/Heizpilz(saisonal) als dezente Empfehlung; Aufbau wird NICHT vorgeschlagen.
- Live deployed + Live-Funktionstest bestanden. Bestehende Anfragen/Angebote unberührt (Preise/Kaution eingefroren).
