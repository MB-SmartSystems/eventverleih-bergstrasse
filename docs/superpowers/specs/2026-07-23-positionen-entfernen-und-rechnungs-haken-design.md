# Design: Entfernen-Kreuz an der Position + Rechnungs-Haken repariert

- **Datum:** 2026-07-23
- **Repo:** `nachhaken/` (git worktree von `website/`), Branch `nachhaken-faellig`
- **Status:** freigegeben von Manuel am 2026-07-23, Umsetzung offen
- **Betrifft:** Admin-Buchungsdetail, Rechnungs-Helper, zwei Entfernen-Routen

## 1. Ausgangslage

Zwei unabhängige Ärgernisse im Buchungsdetail (`src/app/admin/buchungen/[id]/page.tsx`):

1. Unter "Bestellung" steht die Positionsliste, und darunter listet `EntfernenPanel.tsx` jeden Artikel
   ein zweites Mal auf, nur um einen Entfernen-Button danebenzustellen.
2. Der Checklisten-Punkt "Rechnung erstellt + Mail raus" hakt sich nicht selbst ab. Am 2026-07-23
   standen drei Buchungen mit bezahlter Rechnung weiter auf `Zurueckgegeben`: 16 (RG-2026-0002),
   22 (RG-2026-0001), 27 (RG-2026-0003). Manuel hat die Datensätze von Hand korrigiert.

## 2. Befund zu Punkt 2: warum der Automatismus nie greifen konnte

Der Code, der `Status_Erweitert = "Abgerechnet"` setzt, existiert genau einmal:
`src/app/api/admin/rechnung/[id]/bezahlt/route.ts:86`. Er ist auf dem Hauptpfad nicht erreichbar.

**Belegkette:**

| Schritt | Fund |
|---|---|
| Baserow, Rechnungen 950 | RG-2026-0001/0002/0003 haben `Bezahlt_am = null` und `Zahlungs_Methode = null` |
| `bezahlt/route.ts:44-49` | Der Endpoint würde beide Felder setzen. Sie sind leer, also lief er nie |
| `lib/eventverleih/rechnung.ts:200` | `Status: vollBezahlt ? "Bezahlt" : "Gesendet"` bei der Erstellung |
| Buchungen 951, Zahlungsfelder | Alle drei waren bei Rechnungserstellung voll bezahlt (16: 01.06.+17.06. vs. 24.06.; 22: 01.06. vs. 18.06.; 27: 05.06. vs. 29.06.) |
| `RechnungActionPanel.tsx:51` | Der Button "Als bezahlt markieren" hängt hinter `{!isPaid && ...}` |

Eine Rechnung, die bereits als "Bezahlt" entsteht, zeigt den Button nie an. Also wird `/bezahlt` nie
aufgerufen, also wird `Abgerechnet` nie gesetzt. Bei Eventverleih zahlen Kunden vor der Rückgabe und die
Rechnung kommt danach: das ist der Normalfall, nicht der Sonderfall. Zusätzlich liefen alle drei Fälle
über `kaution-erstatten` (`Kaution_Rueckzahlung_am` entspricht dem Rechnungsdatum), das
`createRechnungForBuchung` mit `sendMail: false` aufruft.

**Kein Defekt:** Die EÜR ist sauber. Die Einnahmen für #16/#22/#27 sind über den Zahlungseingang
gebucht (Einnahmen 961, Rows 21 bis 24). Weder Lücke noch Doppelbuchung.

## 3. Design A: Kreuz direkt an der Position

Neue Client-Komponente `src/app/admin/buchungen/[id]/BestellListe.tsx` rendert beide Tabellen
(Artikel und "Zusätzlich gebucht") mit einer schmalen letzten Spalte für das Entfernen-Kreuz.
`EntfernenPanel.tsx` entfällt, seine Logik zieht unverändert um:

- Bestätigungsdialog mit denselben Texten, inklusive Guthaben-Hinweis bei Leistungen
- `POST /api/admin/position/[id]/delete` und `POST /api/admin/buchung/[id]/service-entfernen`
- Fehlerbanner über der Liste, `window.location.reload()` nach Erfolg
- **geteilte Sperre:** läuft eine Entfernung, sind alle Kreuze deaktiviert

Die geteilte Sperre ist der Grund, warum die ganze Liste in die Client-Komponente wandert statt nur ein
Button pro Zeile. Isolierte Button-Inseln können keinen gemeinsamen Zustand halten. Ohne die Sperre
ließen sich zwei Positionen parallel entfernen, und der serverseitige `recalcBuchung` der zweiten
Anfrage rechnet gegen einen Stand, den die erste gerade verändert.

**Button:** graues Kreuz, bei Hover und Fokus rot, Touch-Fläche rund 36 px,
`aria-label="<Artikel> entfernen"`. Der Kontrast des grauen Kreuzes auf `bg-warm-surface` wird gemessen
und muss 4,5:1 erreichen, sonst wird der Ton angepasst.

**Abbau-Zeile:** Die Anzeigetabelle listet heute Lieferung, Abholung und Aufbau, obwohl auch
`Preis_Abbau` entfernbar ist. Die Zeile wird ergänzt, damit Anzeige und Entfernbarkeit
übereinstimmen. Das ist rein intern: sie erscheint nur bei `Preis_Abbau > 0`, also nur wenn Manuel
selbst einen Abbau-Preis gesetzt hat. Es ist keine Aussage darüber, ob Abbau als Leistung angeboten
wird (offenes Thema, siehe Abschnitt 7).

## 4. Design B: Haken sitzt beim Rausschicken, Status stimmt wieder

**B1, Checklisten-Punkt** (`page.tsx`, Auto-Item `abgerechnet`):
`checked: rechnungen.length > 0` statt `status === "Abgerechnet"`. Damit sagt der Punkt, was auf ihm
steht: eine Rechnung existiert, also ist sie erstellt und die Mail raus. `meta` zeigt Rechnungsnummer
und Rechnungsdatum der ersten Rechnung.

**B2, Status-Automatik** in `lib/eventverleih/rechnung.ts`, nach erfolgreichem `createRow`:
Entsteht die Rechnung mit `vollBezahlt === true` und steht die Buchung auf `Zurueckgegeben`, wird sie
auf `Abgerechnet` gesetzt. Derselbe Guard wie im `bezahlt`-Endpoint, damit eine früh bezahlte Rechnung
keine Buchung schließt, deren Material noch draußen ist. Fail-soft in `try/catch` mit
`console.error`: ein Baserow-Fehler darf die Rechnungserstellung nicht kippen.

Der Fix sitzt im Helper und nicht in einer Route, weil beide Erstellungspfade dort durchlaufen:
`rechnung-erstellen` (mit Mail) und `kaution-erstatten` (Beleg-Link in der Abschluss-Mail). Die drei
gemeldeten Fälle liefen über den zweiten.

Idempotent, weil der Übergang nur aus `Zurueckgegeben` heraus stattfindet.

## 5. Design C: Schutz nach Rechnungsstellung

Existiert für die Buchung bereits eine Rechnung, sind Positionen und Leistungen nicht mehr entfernbar:

- **UI:** keine Kreuze, stattdessen eine Zeile Hinweis mit der Rechnungsnummer
- **Server:** `position/[id]/delete` und `buchung/[id]/service-entfernen` lehnen mit **409** ab, wenn
  `findRechnungForBuchung(buchungId)` einen Treffer liefert

Beides ist nötig. Eine reine UI-Sperre wäre Kosmetik, weil ein direkter API-Aufruf sie umgeht.

Hintergrund: Der Rechnungs-Snapshot ist GoBD-eingefroren und ändert sich nicht mit. Die Buchung schon.
Ohne Guard läuft die Buchungssumme still von der ausgestellten Rechnung weg, ohne dass irgendwo etwas
auffällt. Der richtige Weg für eine Änderung nach Rechnungsstellung ist eine Storno- oder
Korrekturrechnung, nicht ein stilles Löschen.

**Audit-Log:** `position/[id]/delete` schreibt bisher gar nichts, während `service-entfernen` bereits
protokolliert. Das wird symmetrisch ergänzt (Artikel, Anzahl, Einzelpreis, Gesamtbetrag vor dem
Löschen), fail-soft wie beim Service. Begründung: die Aktion wird durch das Inline-Kreuz leichter
auslösbar, eine geldrelevante Änderung soll eine Spur hinterlassen.

## 6. Zahlungskontext

Berührt wird kein Kundentext. Die Bestätigungsdialoge und der Guthaben-Hinweis sind Backoffice-intern,
der `Zahlungs_Methode`-Default im `bezahlt`-Endpoint bleibt unverändert. Die seit 2026-07-23
verbindliche Regel (Stripe ist Standardweg für Anzahlung, Restzahlung und Kaution als Pre-Auth-Hold,
Bargeld nur als stille Ausnahme, nie von sich aus angeboten) wird durch dieses Design nicht berührt.
Es entsteht kein neuer Text, der Bargeld nennt.

## 7. Nicht im Scope

| Thema | Warum nicht |
|---|---|
| Stripe-Lücke: Restzahlung per Stripe markiert die Rechnung nie als bezahlt. Der Webhook setzt `Restzahlung_Bezahlt_am` auf der Buchung, rührt Tabelle 950 nie an. Die Rechnung bleibt auf "Gesendet", erscheint unter "Offen" und ist Mahnungs-Kandidat. Erreichbar, weil "Rechnung erstellen" keinen Status-Guard hat | Eigener Schritt direkt im Anschluss, eigener Diff, eigenes Codex-Review. Ein Geld-Webhook mit Idempotenz und EÜR-Berührung gehört nicht als Anhängsel in einen UI-Umbau |
| Abbau als Leistung: Preis (vermutlich wie Aufbau) und Abgrenzung zur Reinigung ("Abbau nur, wenn alle Artikel gereinigt übergeben werden, Reinigung ist nicht Teil des Abbaus") | Produkt- und Preisentscheidung, kein Admin-Refactor. Die Anzeigezeile aus Abschnitt 3 nimmt sie nicht vorweg |
| `isPaid`-Guard am Button "Als bezahlt markieren" | Verhält sich korrekt, kein Defekt |
| Anzahl einer Position ändern statt sie ganz zu entfernen | Nicht Teil des Auftrags |

## 8. Verifikation

- `tsc --noEmit`, danach Codex-Review über den Diff, Runde für Runde bis clean
- **A, B1 und C (UI-Teil)** lokal am echten Datenstand: Dev-Server, Buchung 16 öffnen. Haken muss
  sitzen, Kreuze müssen an der richtigen Stelle stehen, und weil für #16 eine Rechnung existiert,
  dürfen dort gar keine Kreuze erscheinen. Rein lesend
- **C (Server-Guard)** per `curl` gegen den lokalen Dev-Server: Aufruf ohne UI muss 409 liefern. Nicht
  gegen Produktion
- **B2 wird nicht live getestet.** Ein Testlauf würde eine echte GoBD-Rechnungsnummer verbrennen und
  eine Beleg-Mail auslösen. B2 gilt als *reviewed*, nicht als *verifiziert*

**Was Manuel bei der nächsten echten Rechnung prüft** (Reihenfolge einhalten, dauert unter einer
Minute):

1. **Vorher:** Buchungsdetail öffnen, Status notieren. Er muss `Zurueckgegeben` sein, sonst greift der
   Guard bewusst nicht und der Test sagt nichts aus
2. Rechnung wie gewohnt erstellen, über "Rechnung erstellen" oder über "Kaution erstatten"
3. **Nachher, dieselbe Seite neu laden.** Drei Dinge müssen zutreffen:
   - Status steht auf **Abgerechnet**, nicht mehr auf `Zurueckgegeben`
   - Checklisten-Punkt "Rechnung erstellt + Mail raus" ist **abgehakt**, mit Rechnungsnummer daneben
   - Bei den Positionen sind **keine Kreuze** mehr, stattdessen der Hinweis mit der Rechnungsnummer
4. **Wenn der Status auf `Zurueckgegeben` bleibt:** in Baserow Tabelle 950 die neue Rechnung ansehen.
   Steht dort `Status = Gesendet`, war die Buchung bei der Erstellung noch nicht voll bezahlt. Dann hat
   der Guard korrekt nicht ausgelöst und der Status kommt erst mit "Als bezahlt markieren". Steht dort
   `Status = Bezahlt` und die Buchung trotzdem auf `Zurueckgegeben`, ist B2 defekt und ich schaue drauf

Der Haken aus B1 sitzt in beiden Fällen, weil er nur an der Existenz der Rechnung hängt.

## 9. Risiken

| Risiko | Umgang |
|---|---|
| B2 läuft ungetestet in Produktion | Fail-soft, der Übergang nur aus `Zurueckgegeben`. Schlimmster Fall ist der heutige Zustand: Status bleibt stehen und wird von Hand gesetzt |
| Der Guard aus C sperrt einen legitimen Fall aus, den wir nicht bedacht haben | 409 mit klarer Meldung. Fällt sofort auf, statt still zu wirken. Nachjustieren ist billig |
| Client-Komponente lädt die Positionsliste in den Browser | Nur Daten, die die Seite ohnehin rendert. Kein neuer Endpunkt, keine neuen Daten |

## 10. Freigaben und Grenzen

- Kein Deploy und kein Push ohne ausdrückliche Freigabe pro Aktion
- Codex-Review läuft vor jeder Fertig-Meldung
- `EntfernenPanel.tsx` wird gelöscht, nachdem die Logik nachweislich umgezogen ist. Braucht Manuels
  ausdrückliches Okay, auch wenn die Datei über git wiederherstellbar bleibt
