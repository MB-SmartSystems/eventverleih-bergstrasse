# Design: Gästezahl-basierte Set-Empfehlung (ersetzt Anlass-Sets)

**Datum:** 2026-07-06
**Status:** Design zur Freigabe
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
- **Stehtische** (Sitz-Setup braucht sie nicht zwingend; spätere Entscheidung, ob feste Regel).
- **Heizpilz** — nur in der kalten Jahreszeit (**Okt–Apr**) eingeblendet. Hinweis: Heizstrahler braucht
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
- Aufbau-Service bleibt der bestehende globale Toggle (inkl. des kürzlich gebauten
  Faltzelt-Aufbau-Helfer-Hinweises). Der Set-Vorschlag aktiviert Aufbau **nicht** automatisch —
  das bleibt die Kundenentscheidung.

## Technische Notizen

- `/api/products` muss zusätzlich **`bestandOk`** (aus `Bestand_OK`) je Artikel liefern, damit die
  Grenze client-seitig gerechnet werden kann. Artikel werden über ihren **Namen** (CartItem-Key)
  bzw. Slug referenziert; die Seitenwand-/Gewicht-/Zelt-Artikel müssen eindeutig auffindbar sein
  (Slug/Kategorie prüfen — z. B. Zelt-Kategorie „Zelt", Seitenwand „seitenwand-fenster"/„…-reissverschluss",
  Gewicht-Default „bodenanker-ratsche-set").
- Neue Komponente ersetzt `AnlassSets.tsx` (gleiche Section-Position auf `page.tsx`, `id="sets"` kann
  bleiben oder zu `id="set-finder"` werden — Anker in Hero/FAQ/Contact ggf. mitziehen).

## Randfälle

- `G = 0` / leer → keine Empfehlung, neutraler Hinweis.
- `G` sehr klein (z. B. 2–4) → 1 Tisch, 1× 3×3, konsistent (kein Sonderfall).
- Artikel für die Empfehlung nicht im Bestand (z. B. Lichterkette 0 verfügbar) → betroffene Position
  weglassen oder als „aktuell nicht verfügbar" markieren, Rest trotzdem anbieten.

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

## Explizit NICHT im Scope (v1)

- Zelt-Kombinationen / Mehrfach-Lichterketten (durch Bestand ausgeschlossen).
- Datum-genaue Bestandsgrenze.
- Stehtische/Heizpilz als feste Auto-Positionen (bewusst nur Empfehlung).
- Paketpreise/Rabatte.

## Offene Detailpunkte (beim Bau kurz bestätigen)

- ✅ Default-Gewicht = **Metallplatten-Gewicht** (entschieden 2026-07-06).
- **Warenkorb schon gefüllt + Kunde klickt „Set übernehmen": ersetzen oder dazulegen?** Empfehlung:
  **ersetzen** (mit kurzer Rückfrage, wenn Warenkorb nicht leer) — das Set ist ein frischer Startpunkt;
  „dazulegen" würde Dubletten erzeugen. → mit Manuel bestätigen.
- Genauer Anker/`id` der Section + ob bestehende Verlinkungen (Hero/FAQ) angepasst werden.
- Ergebnisse der Wettbewerbs-Recherche einarbeiten (läuft; ggf. UX-Verbesserungen ergänzen).
