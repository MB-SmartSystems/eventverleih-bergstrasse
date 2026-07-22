# Design: Gästezahl-basierte Set-Empfehlung (ersetzt Anlass-Sets)

**Datum:** 2026-07-06
**Status:** Design komplett — alle offenen Punkte mit Manuel geklärt (2026-07-06), bereit für Umsetzungsplan
**Ton:** warm + einladend (kurzer einladender Einstiegssatz wie bei den alten Anlass-Kacheln, dann sachlich der Vorschlag)
**Verwandt (eigener Change VOR dem Tool):** Kaution überall auf nächsten **1 €** aufrunden (siehe Projekt-Memory)
**Betrifft:** `src/components/AnlassSets.tsx` (Ersatz), Warenkorb (`CartContext`/`CartPage`), `/api/products`

## Problem

Die aktuellen drei „Anlass-Sets" (Geburtstags-/Gartenfest-/Hochzeits-Set) in `AnlassSets.tsx` sind
reine **Text-Kacheln** ohne hinterlegte Artikel. Der Button „Artikel ansehen & anpassen" ist nur ein
`<a href="#sortiment">` (Scroll-Anker) — es landet **nichts** im Warenkorb. Zudem ist die Aufteilung
nach Anlass sachlich inkonsistent (Gartenfest 3×3, Geburtstag/Hochzeit 3×6; Stehtische mal ja, mal
nein). Der **echte Treiber ist die Gästezahl**, nicht die Art der Feier.

## Ziel

Ein einziges **Gästezahl-Tool**: Kunde tippt seine Gästezahl ein → bekommt (a) eine **Live-Grafik**
(schematische Draufsicht: Zelt + zusammengeschobene Tafel + Stühle) und (b) ein **konkretes, komplettes
Set**, das er mit einem Klick **wirklich in den Warenkorb** legt und danach frei anpasst.
Die drei Anlass-Kacheln entfallen.

## Empfehlungs-Logik (Kunde tippt Gästezahl **G** ein)

**Auto in den Warenkorb:**

| Position | Regel |
|---|---|
| Stühle | = G |
| Klapptische | `ceil(G / 8)` (ab 9 → 2, ab 17 → 3) |
| Tischdecken | 1 pro Tisch |
| Zelt | `G ≤ 12` → Faltzelt **3×3** · `13 ≤ G ≤ 24` → Faltzelt **3×6** |
| Seitenwände | 3×3: **2× Reißverschluss + 2× Fenster** (4) · 3×6: **2× Reißverschluss + 4× Fenster** (6) |
| Gewichte/Anker | 1 pro Zeltbein — 3×3 → **4**, 3×6 → **6**. Volle Anzahl (KEINE Ersparnis bei Kombi). Default-Artikel: **Metallplatten-Gewicht** (Manuels Wahl 2026-07-06: am einfachsten zu handhaben; Bestand 12); Kunde kann im Warenkorb auf Wasser-Gewicht/Bodenanker wechseln. |
| Lichterkette 18 m | 1 |

**Nur als „passt dazu?"-Empfehlung daneben (NICHT automatisch im Warenkorb, 1-Klick zum Hinzufügen):**
- **Stehtische** — dezente „passt dazu?"-Empfehlung, immer eingeblendet (in v1 enthalten, Manuel 2026-07-06). Nicht im Warenkorb, 1-Klick zum Hinzufügen.
- **Heizpilz** — Empfehlung nur in der kalten Jahreszeit (**Okt–Apr**) eingeblendet (in v1 enthalten). Hinweis: Heizstrahler braucht
  eine **Gasflasche 11 kg** zum Betrieb → wird der Heizpilz hinzugefügt, die Gasflasche mit-empfehlen
  (sonst steht der Kunde ohne Gas da).

**Regeln, die aktuell NICHT gebraucht werden** (durch Bestand ausgeschlossen, siehe unten), aber als
Notiz für später: Bei Zelt-Kombinationen wäre `Lichterketten = Anzahl(3×6) + ceil(Anzahl(3×3) / 2)`
(1× 3×6→1, 3×6+3×3→2, 2× 3×6→2, 2× 3×6 + 2× 3×3→3). Da bis 24 Gäste stets **ein** Zelt reicht, greift
das derzeit nie.

## Bestandsgrenze (dynamisch)

Die Obergrenze wird **live aus dem Baserow-Bestand (`Bestand_OK`)** berechnet, nicht hart codiert —
ABER mit einer dritten, in v1 bindenden Schranke: der **Kapazität EINES Zeltes** (weil v1 nie zwei
Zelte kombiniert):

```
MAX_G = min( Bestand_OK[Stuhl] , Bestand_OK[Klapptisch] × 8 , EINZELZELT_KAPAZITAET=24 )
```

Aktuell: `min(30, 3×8, 24) = 24`. **Wichtige Korrektur (Denkfehler im Erstentwurf):** Ein einzelnes
3×6-Zelt fasst max. 24 Sitzplätze. Da v1 immer nur EIN Zelt vorschlägt, kann der Auto-Vorschlag NIE
über 24 gehen — auch nicht, wenn Manuel einen 4. Tisch oder mehr Stühle kauft (dann bleibt die Grenze
bei 24, weil das Zelt limitiert). **Über 24 zu kommen ist keine Bestands-, sondern eine Feature-Frage:**
es braucht die Zelt-Kombi-Logik (unten als v2 dokumentiert). Diese lohnt aber erst, wenn Manuel auch
den Tisch-Bestand über 3 erhöht (Tische deckeln aktuell ohnehin bei 24). → v1 bleibt sauber bei 24;
die Stock-Formel sorgt dafür, dass die Grenze automatisch sinkt/steigt, sobald Stühle/Tische UND die
Einzelzelt-Kapazität es zulassen.

**Eingabe:** Zahlenfeld (beliebige positive Ganzzahl) + Slider (Bereich `1 .. MAX_G`). Wird per
Zahlenfeld eine Zahl `> MAX_G` eingegeben, greift der Fallback (kein Set, keine Grafik).

**`G > MAX_G`:** kein Auto-Set. Stattdessen Hinweis:
> „Für größere Feiern (mehr als N Gäste) stellst du dir dein Set unten im Sortiment selbst zusammen —
> oder melde dich für ein persönliches Angebot." (N = MAX_G, dynamisch)

**Abgrenzung v1:** Die Grenze zieht aus dem **Gesamtbestand** (Eigentum). Datum-spezifische
Verfügbarkeit (an dem Tag schon anderweitig gebucht) fängt weiterhin die bestehende
Verfügbarkeitsprüfung im Warenkorb/Checkout ab — unverändert. (Mögliche v2: datum-genaue Grenze.)

## Visualisierung

Schematische **Draufsicht als Inline-SVG** (Marken-Look, kein Foto, keine Fremd-Bibliothek),
**live** bei jeder Eingabe:
- Zelt als Rahmen (Seitenverhältnis 3×3 quadratisch bzw. 3×6 länglich).
- Tische als Rechtecke, zu einer **Tafel** zusammengeschoben (in Reihe).
- Stühle als Punkte gleichmäßig rundherum (G Stück).
- Deterministisch aus G berechnet; rein illustrativ (Positionierung im Garten macht der Kunde).

## Warenkorb-Integration

- Bestehender `CartContext` (`addItem(name, price)`, `setAufbauKomplett`, …) wird genutzt.
- „Set in den Warenkorb"-Button fügt alle Auto-Positionen mit ihren Mengen hinzu (Namen + Preise aus
  `/api/products`), danach frei im Warenkorb anpassbar.
- **Preis = Summe der Auswahl**, kein Paketaufschlag (bestehende Zusage bleibt).
- Aufbau-Service wird im Tool **NICHT beworben oder vorgeschlagen** (Manuel 2026-07-06: nicht proaktiv
  anbieten). Der bestehende Warenkorb-Toggle bleibt opt-in (nicht vorausgewählt, inkl. Faltzelt-Aufbau-
  Helfer-Hinweis) — bucht ihn jemand aktiv, wird er gemacht. Das Tool aktiviert/erwähnt ihn nicht.
- **Mengen exakt setzen:** `addItem(name, price)` erhöht nur um 1 → für N Stück `updateQuantity(name, N)`
  nutzen (Key = exakter `product.name` inkl. Suffix). Preis-String im **gleichen Format wie die
  bestehenden Produktkarten** übergeben, damit `matchProduct`/`parsePriceString` im Warenkorb weiter
  greifen — den bestehenden Add-to-Cart-Codepfad wiederverwenden, kein eigenes Preisformat erfinden.
- **Warenkorb schon gefüllt** + Klick „Set übernehmen": den Kunden **fragen** — *ersetzen* oder
  *dazulegen* (Manuel 2026-07-06: Kunde wählt selbst). Leerer Warenkorb → direkt übernehmen.

## Technische Notizen

- `/api/products` muss zusätzlich **`bestandOk`** (aus `Bestand_OK`) je Artikel liefern (aktuell nur
  name/mietpreisEur/kautionEur/aufbauEur/category), damit die Grenze client-seitig gerechnet werden kann.
- **Artikel werden über ihren stabilen `Slug` aufgelöst** (NICHT über den Anzeigenamen — der trägt
  Suffixe wie „(Reinigung inkl.)"). Zuordnung Empfehlungs-Slot → Slug (aus Baserow 957 verifiziert):

  | Slot | Slug |
  |---|---|
  | Zelt 3×3 | `faltzelt-3x3m` |
  | Zelt 3×6 | `faltzelt-3x6m` |
  | Stuhl | `stuhl` |
  | Klapptisch | `klapptisch` |
  | Tischdecke | `tischdecke` |
  | Seitenwand Fenster | `seitenwand-fenster` |
  | Seitenwand Reißverschluss | `seitenwand-reissverschluss` |
  | Gewicht (Default) | `metallplatten-gewicht` |
  | Lichterkette | `lichterkette-18m` |
  | Stehtisch (Empfehlung) | `stehtisch-mit-husse` |
  | Heizpilz (Empfehlung, Okt–Apr) | `heizstrahler` |
  | Gasflasche (mit Heizpilz) | `gasflasche-11kg` |

- Neue Komponente ersetzt `AnlassSets.tsx` (gleiche Section-Position auf `page.tsx`, `id="sets"` kann
  bleiben oder zu `id="set-finder"` werden — Anker in Hero/FAQ/Contact ggf. mitziehen).
- Die bestehende **„andere Feiern / Kontakt"-Zeile** aus `AnlassSets` als schlanke Zeile unter dem Tool
  erhalten (Soft-Fallback für Taufe/Jubiläum/Sonderfälle + „mehr als N Gäste").

## Randfälle

- `G = 0` / leer → keine Empfehlung, neutraler Hinweis.
- `G` sehr klein (z. B. 2–4) → 1 Tisch, 1× 3×3, konsistent (kein Sonderfall).
- Besitzt Manuel einen empfohlenen Rand-Artikel gar nicht (`Bestand_OK = 0`, z. B. Lichterkette): diese
  **eine** Position aus dem Set weglassen (nicht in den Warenkorb) + dezent „aktuell nicht verfügbar"
  anzeigen, Rest normal. (Betrifft nur Rand-Artikel — Zelt/Tisch/Stuhl sind vorhanden und über MAX_G
  ohnehin gedeckelt.)

## Wettbewerbs-Erkenntnisse & UX-Ergänzungen (Recherche 2026-07-06)

7 Anbieter geprüft (DACH + US, u. a. Daschners, Fischer, M&M Event, Profizelt24, Bright, Victory).
**Keiner** bietet Live-Anordnungs-Grafik UND Direkt-Warenkorb aus der Gästezahl — sie enden bei einer
m²-Zahl oder einer Anfrage. → Grafik + „in den Warenkorb" ist das Alleinstellungsmerkmal; bleibt Kern.

**Aus der Recherche übernehmen (kleine, lohnende Ergänzungen):**
- **Eingabe = Slider + Zahlenfeld kombiniert** (Slider fürs schnelle mobile Gefühl, Zahlenfeld daneben
  für die exakte Zahl, z. B. 18). Daschners nutzt Slider, Victory Zahlenfeld — beides zusammen ist besser.
- **Schwellen sichtbar machen** statt stillem Rundungs-Rätsel: kurze Zeile wie „ab 9 Gästen kommt ein
  2. Tisch dazu" / „ab 13 Gästen das größere 3×6-Zelt". Reduziert Rückfragen/Reklamationen.
- **Vorschlag bleibt editierbar** (ist durch die Warenkorb-Anpassung schon gegeben) — aktiv so kommunizieren.

**Bewusst NICHT übernommen:** eine zweite Eingabe-Achse „Veranstaltungsart" (Steh-Empfang / Bankett /
mit Tanzfläche), wie sie größere Verleiher nutzen. Für den sitzplatz-fokussierten Garten-Verleih ist das
Overkill; der Steh-Fall ist bei uns über die optionale **Stehtisch**-Empfehlung bereits abgedeckt.
Single-Axis (nur Gästezahl) bleibt — deckt sich mit Manuels Wunsch nach Einfachheit.

**Faustregel-Abgleich:** Eigene Werte (8 Personen/Klapptisch, 3×3 = 12, 3×6 = 24 sitzend) sind plausibel;
Branchenquellen nennen 6–8 Personen/Tisch bei Bankett-Stil (Einzelstühle) — passt. Kein Änderungsbedarf.
(Referenz: Bierzeltgarnitur-Bänke fassen mehr/Tisch als Banketttisch+Einzelstühle — für uns irrelevant,
da wir Klapptisch + Einzelstühle vermieten.)

## Akzeptanzkriterien (Worked Examples — dienen zugleich als Testfälle)

Warenkorb-Inhalt nach „Set übernehmen" (Gewicht-Default = Metallplatten):

| G | Stühle | Klapptische | Tischdecken | Zelt | Seitenw. Reißv. | Seitenw. Fenster | Gewichte | Lichterkette |
|---|---|---|---|---|---|---|---|---|
| 10 | 10 | 2 | 2 | 1× 3×3 | 2 | 2 | 4 | 1 |
| 12 | 12 | 2 | 2 | 1× 3×3 | 2 | 2 | 4 | 1 |
| 13 | 13 | 2 | 2 | 1× 3×6 | 2 | 4 | 6 | 1 |
| 18 | 18 | 3 | 3 | 1× 3×6 | 2 | 4 | 6 | 1 |
| 24 | 24 | 3 | 3 | 1× 3×6 | 2 | 4 | 6 | 1 |

- `G = 25` (> MAX_G = 24) → **kein** Set, kein Warenkorb-Add, Fallback-Hinweis, keine Grafik.
- `G = 0` / leer → nichts.
- Grafik-Check bei `G = 18`: 3 Tische als Tafel in Reihe, 18 Stühle rundherum, länglicher 3×6-Rahmen.
- Grenz-Check: `G = 12` → 3×3 · `G = 13` → 3×6 (Zeltwechsel exakt bei 13).

## Explizit NICHT im Scope (v1)

- Zelt-Kombinationen / Mehrfach-Lichterketten (durch Bestand ausgeschlossen).
- Datum-genaue Bestandsgrenze.
- Stehtische/Heizpilz als feste Auto-Positionen (bewusst nur Empfehlung).
- Paketpreise/Rabatte.

## Offene Detailpunkte (beim Bau kurz bestätigen)

- ✅ Default-Gewicht = **Metallplatten-Gewicht** (entschieden 2026-07-06).
- ✅ **Warenkorb schon gefüllt → Kunde wählt selbst** (ersetzen ODER dazulegen), Rückfrage beim Klick
  (entschieden 2026-07-06). Leerer Warenkorb: direkt übernehmen.
- ✅ **Keine Live-Preis-Schätzung im Tool** (Manuel 2026-07-06: „sieht man im Warenkorb"). Der Preis wird
  erst im Warenkorb angezeigt.
- ✅ Zusatz-Empfehlungen (Stehtisch + Heizpilz saisonal) **beide in v1** (Manuel 2026-07-06).
- ✅ Aufbau im Tool **nicht** anbieten (Manuel 2026-07-06). Ton: warm + einladend.
- Section bleibt an gleicher Stelle; Überschrift „Wie viele Gäste? – wir stellen dein Set zusammen"
  (Default, von Hermes gesetzt); Anker-`id`/Verlinkungen beim Bau prüfen. Mindest-Gästezahl = 2.

## v2 — Zweitzelt / „Mehr Platz" (2026-07-07, mit Manuel abgestimmt)

Optionaler Schalter **„Mehr Platz"**, der die Tische statt in ein Zelt auf **zwei Zelte** verteilt
(luftiger). Der Standard (ein Zelt) bleibt unverändert der Default; „Mehr Platz" ist opt-in.

**Bestandsgrenze folgt jetzt dem Tisch-Bestand statt einer festen Einzelzelt-Kapazität:**

```
MAX_G = min( Bestand_OK[Stuhl] , Bestand_OK[Klapptisch] × 8 )
```

Die feste Kappung bei 24 (ein Zelt) entfällt. Aktuell (3 Klapptische) bleibt die Grenze weiterhin bei
`min(30, 24) = 24` — kauft Manuel einen **4. Klapptisch** (+1 Tischdecke), steigt der Deckel automatisch
auf `min(30, 32) = 30`. Das ist bewusst ein Einkaufs-Hebel: mehr Tische = mehr Reichweite, ohne Code-Änderung.

**Toggle „Mehr Platz":** wird dem Kunden erst **ab 3 Tischen** angeboten (`mehrPlatzMoeglich = tische >= 3`,
also ab ca. 15 Gästen). Bei weniger Tischen ist er wirkungslos und bleibt ausgeblendet.

**Zeltaufteilung bei 3 Tischen (der Standardfall des Umschaltens):** 2 Tische ins 3×6-Zelt, 1 Tisch ins
3×3-Zelt (statt aller 3 Tische in einem 3×6). Allgemein regelt das ein **Greedy-Planer**: großes Zelt
(3×6) nimmt bis zu 3 Tische im Standard-Modus, aber nur bis zu **2** Tische im „Mehr Platz"-Modus (daher
verteilt sich der Rest auf ein zweites Zelt); ein letzter Rest-Tisch wandert bevorzugt in ein kleines
3×3-Zelt statt ein weiteres großes Zelt anzubrechen. Bestand: 2× Faltzelt 3×6, 2× Faltzelt 3×3 (Default,
falls kein Bestandswert vorliegt).

**Stuhlverteilung:** die Gesamtstühle (= Gästezahl) verteilen sich über ALLE Tische (in Zelt-Reihenfolge)
möglichst gleich, Rest auf die ersten Tische — z. B. 24 Gäste / 3 Tische → 8/8/8; das erste Zelt (2 Tische)
bekommt dann 16, das zweite Zelt (1 Tisch) bekommt 8.

**Positionen-Aggregation (pro Zelt, über alle Zelte summiert):**
- 3×6-Zelt: 2× Seitenwand Reißverschluss, 4× Seitenwand Fenster, 6× Gewicht.
- 3×3-Zelt: 2× Seitenwand Reißverschluss, 2× Seitenwand Fenster, 4× Gewicht.
- Lichterkette: `Anzahl(3×6) + ceil(Anzahl(3×3) / 2)` — z. B. 1× 3×6 + 1× 3×3 → 1 + 1 = 2 Lichterketten.

**Beispiel (24 Gäste, „Mehr Platz" an):** 1× Faltzelt 3×6 (2 Tische, 16 Stühle) + 1× Faltzelt 3×3 (1 Tisch,
8 Stühle). Positionen: 3 Klapptische, 3 Tischdecken, 1× Zelt 3×6 + 1× Zelt 3×3, 4× Reißverschluss,
6× Fenster, 10× Gewicht, 24 Stühle, 2 Lichterketten.

**Grafik:** bei einem Zelt bleibt die bisherige Draufsicht (single/block/row/parallel) unverändert. Bei
zwei Zelten wird jedes Zelt als **eigene 8-Plätze-Insel-Anordnung** dargestellt (jeder Tisch = eigene
Insel, NICHT als Reihe oder hochkant) — luftiger und klarer lesbar als die kompakten Ein-Zelt-Modi. Die
Zelte werden nebeneinander gezeichnet (SVG-Gruppen mit horizontalem Versatz).

## v2.1 — Korrekturen nach Manuel (2026-07-07 nachmittags)

Ergänzt/ersetzt einzelne Punkte des v2-Abschnitts:

- **Obergrenze auf 30 Gäste (statt 24):** `maxGaeste = min(Stühle, 4 Tische × 8)` — NICHT mehr am
  aktuellen Tisch-Bestand (3) gedeckelt. Ab 25 Gästen empfiehlt das Tool **4 Tische**. Der 4. Klapptisch
  (+ 4. Tischdecke) ist bewusst NICHT im Dauerbestand — Manuel kauft ihn erst, wenn tatsächlich eine
  25–30-Personen-Anfrage kommt. Grund: das Tool soll solche Anfragen überhaupt reinlassen (die
  Verfügbarkeitsprüfung in `/api/contact` ist presence-basiert: `restzahl > 0 || on_request` — 4 angefragte
  Tische bei 3 Bestand blockieren die Anfrage NICHT, sie erreicht Manuel). Über 30 → Fallback
  (persönliches Angebot).
- **Zwei-Zelt-Grafik:** Tische stehen **hochkant/parallel** (wie der Ein-Zelt-„parallel"-Modus), NICHT
  als horizontale Inseln. Die Zelte grenzen **Fuß an Fuß** direkt aneinander (kein Abstand; kantenbasierte
  Platzierung — linke Kante von Zelt i+1 = rechte Kante von Zelt i).
- **4-Tisch-Aufteilung (25–30 Gäste):** Standard/Kompakt → `[3×6: 3 Tische, 3×3: 1 Tisch]`; „Mehr Platz" →
  `[3×6: 2, 3×6: 2]`. Beide sind 2 Zelte. Toggle-Beschriftung daher neutral „Kompakt" / „Mehr Platz"
  (nicht „1 Zelt / 2 Zelte", da bei 4 Tischen auch Kompakt schon 2 Zelte hat).
