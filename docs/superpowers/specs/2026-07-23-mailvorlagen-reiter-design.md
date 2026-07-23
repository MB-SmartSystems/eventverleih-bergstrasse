# Admin-Reiter „E-Mail-Vorlagen" — Entwurf

**Stand:** 2026-07-23 · **Status:** Entwurf, nicht gebaut · Nachfolger-Dokument: Umsetzungsplan

## Ziel

Ein Ort im Dashboard, an dem sichtbar ist, **welche Mails das System verschickt, wann sie feuern und was
genau drinsteht**. Der Anlass ist ein konkreter Fund: `kaution_hold_link` beschreibt die Kaution als
Stripe-Hold, `termin_erinnerung` behauptet im selben Vorgang, sie werde bar bei der Übergabe erhoben.
Derselbe Kunde kann beide Mails bekommen. Ohne einen Ort, an dem alle Texte nebeneinander stehen, fällt
so etwas niemandem auf.

**Nicht-Ziel:** Bearbeiten. Der Reiter ist lesend. Ob und wie später bearbeitet wird, ist eine eigene
Entscheidung; der Mittelweg (nur logikfreie Vorlagen editierbar) bleibt ausdrücklich offen.

## Getroffene Entscheidungen

### 1. Nur ansehen, nicht bearbeiten

Die Texte sind keine Platzhalter-Vorlagen, sondern Programme. `termin-reminder.ts` setzt den
Restzahlungs-Block nur, wenn die Restzahlung offen ist, den Kautionsblock nur bei offener Kaution, den
Zahlungslink nur, wenn er existiert. Wandert das in eine Datenbank, wandert die Bedingungslogik mit, und
man bearbeitet dann kein Textfeld mehr, sondern ein kleines Programm — an Aussagen, die rechtlich und
finanziell zählen.

### 2. Der Text kommt aus dem Code, über eine Registry

Die Alternative wäre gewesen, die zuletzt versendeten Mails aus der MailQueue anzuzeigen. Das hätte
keinen Code-Eingriff gekostet, zeigt aber die Vergangenheit: nach einer Korrektur bliebe der alte
Wortlaut stehen, bis die Mail das nächste Mal feuert.

Ausschlaggebend war das vorhandene Gegenbeispiel im eigenen Haus: `ops-daten/templates/mails/` —
13 Markdown-Vorlagen mit `{{platzhalter}}`, angelegt am 13.05.2026, vom Code **nie gelesen**, inhaltlich
überholt (`11-mahnung-stufe-1.md` widerspricht der Policy „keine Mahn-Eskalation"). Eine Ansicht, die
sich von der Wahrheit lösen *kann*, löst sich irgendwann. Eine driftende Zweitquelle würde neue
Widersprüche erzeugen, statt bestehende zu zeigen.

Die Registry kann strukturell nicht driften, weil sie **dieselben Bau-Funktionen aufruft, die auch die
echten Mails erzeugen**.

### 3. Mehrere benannte Beispielfälle je Vorlage

Mit einer einzigen Beispiel-Buchung zeigt jede Vorlage genau einen Zweig. Wäre die Beispiel-Buchung
vollständig bezahlt, würde der Reiter den bar-Widerspruch **nicht** anzeigen — er steht in einem
`if (kautionOffen)`. Deshalb hinterlegt die Registry je Vorlage die Fälle, die wirklich andere Texte
erzeugen (typisch zwei bis drei: alles offen, alles bezahlt, ohne Zahlungslink), und die Seite macht sie
umschaltbar.

## Ist-Zustand

30 Template-Keys in **21 Dateien**, davon 27 eigenständige Texte (die vier Anzahlungs-Stufen teilen sich
eine Bau-Funktion, nur der Eröffnungssatz variiert). Alle schreiben eine Zeile in die Baserow-MailQueue
(Tabelle 969); versendet wird vom n8n-Workflow `eve-mailqueue-poll`.

In **4 Dateien** liegt der Textaufbau schon in eigenen Funktionen (`anzahlung-reminder`,
`restzahlung-reminder`, `review-reminder`, `anfrage/[id]/action`). In den übrigen **17** entsteht der
Text direkt an der `createRow`-Stelle.

Nicht im Repo und deshalb nicht im Reiter: die Rechnungs-/Beleg-Mail, deren Text im n8n-Workflow
`eve-rechnung-render-mail` liegt (`N8N_RECHNUNG_PDF_URL`). Der Reiter weist sie als extern aus, statt sie
zu verschweigen.

## Architektur

```
src/lib/eventverleih/mail-templates/
  build/…            je Vorlage eine exportierte, reine Funktion  (ctx) => { subject, body }
  beispiele.ts       benannte Beispiel-Kontexte
  registry.ts        key, Titel, Auslöser, Freigabe-Pflicht, Fundstelle, build, Beispielfälle
  pruefungen.ts      Regeln über den gerenderten Text
src/app/admin/vorlagen/page.tsx
```

Die Bau-Funktionen sind **rein**: sie bekommen einen Kontext und geben Text zurück, sie lesen nichts und
schreiben nichts. Nur so lassen sie sich ohne Nebenwirkung für eine Vorschau aufrufen. Die aufrufenden
Routen behalten ihre Zuständigkeit für Daten holen, `createRow` und Idempotenz.

### Die Prüfungen

Laufen über den **gerenderten** Text, nicht über den Quelltext, und zeigen ihren Befund an der Vorlage
selbst, nicht in einem Bericht, den niemand öffnet:

| Prüfung | Warum |
|---|---|
| Bargeld-Formulierung im Zahlungs-/Kautionszusammenhang | Verstößt gegen die Stripe-Regel (Projekt-CLAUDE.md, 2026-07-23). Fängt genau den heutigen Fund |
| Em-Dash und andere KI-Marker | Kundensichtbarer Text soll nicht nach KI klingen. Betrifft aktuell mehrere Betreffzeilen |
| Fehlende Signatur / Kontaktangabe | Abbruchkante bei zusammengesetzten Texten |
| Leergebliebener Platzhalter, doppelte Leerzeile, `undefined` im Text | Klassische Zusammenbau-Fehler |

## Umsetzung in Schritten

1. **Herausziehen ohne Verhaltensänderung.** Je Datei den Textaufbau in eine reine Funktion verschieben,
   Aufrufstelle ruft sie auf. Kein neuer Text, keine neue Bedingung.
2. **Beweis, dass sich kein Zeichen geändert hat.** Ein Skript zieht alle Text-Literale einer Datei aus
   `git show main:<datei>` und aus dem Arbeitsstand und vergleicht sie **zeichengleich**. Verschieben ist
   erlaubt, Ändern nicht. Das ist die Abnahme des Schritts, nicht ein grüner Build.

   *Korrektur gegenüber der ersten Fassung dieses Entwurfs (2026-07-23):* Dort stand „vor dem Umbau
   Snapshot erzeugen, nach dem Umbau vergleichen". Das geht nicht — vor der Extraktion gibt es keine
   aufrufbare Funktion, deren Ausgabe man festhalten könnte. Der Literal-Vergleich gegen `main` leistet
   dasselbe und ist unabhängig davon, ob eine Funktion schon existiert. Renderende Snapshots kommen
   zusätzlich in Task 8 dazu, dann als Regressionsschutz für die Zukunft.
3. Registry und Beispielfälle anlegen.
4. Admin-Seite `/admin/vorlagen` plus Eintrag in der Navigation (`src/app/admin/layout.tsx`).
5. Prüfungen ergänzen und die bekannten Befunde gegenprüfen: der bar-Text in `termin_erinnerung` **muss**
   anschlagen, sonst prüft die Prüfung nichts.
6. Fremdmodell-Review über den Diff, danach erst Freigabe zum Deploy.

## Verifikation

- Snapshot-Vergleich aus Schritt 2 ist die harte Abnahme des Refactorings.
- Die Seite selbst wird im Browser angesehen, nicht nur gebaut — inklusive Kontrastmessung, weil neue
  Oberfläche entsteht.
- Ein bekannter Widerspruch (bar-Text) und ein bekannter KI-Marker (Em-Dash im Betreff der
  Zahlungsbestätigung) müssen in der Anzeige erscheinen. Findet der Reiter die Fehler nicht, die wir
  bereits kennen, ist er nicht fertig.

## Risiken

| Risiko | Umgang |
|---|---|
| Beim Herausziehen ändert sich unbemerkt ein Kundentext | Snapshot-Vergleich, zeichengleich |
| 21 berührte Dateien in einem Diff | Schrittweise, pro Bereich abgeschlossen und geprüft; kein Deploy vor Freigabe |
| Beispielfälle bilden die Wirklichkeit nicht ab | Sie stammen aus echten Buchungsformen (offen / bezahlt / ohne Link), nicht aus Fantasiewerten |
| Der Reiter suggeriert Vollständigkeit | Die extern liegende Rechnungs-Mail wird ausdrücklich als extern ausgewiesen |

## Bewusst nicht enthalten

Bearbeiten, Speichern, Versenden, Versionierung von Texten, Übersetzung, A/B-Varianten. Nichts davon ist
heute gefragt, und jedes davon würde die Entscheidung „nur ansehen" unterlaufen.

## Überholter Vorläufer: `ops-daten/templates/mails/`

Die 13 Markdown-Dateien plus README vom 13.05.2026 **bleiben liegen** (Löschungen gehen bei uns pro Stück
über Manuel), gelten aber als überholt und werden durch diesen Reiter ersetzt. Sie wurden vom Code nie
gelesen, ihre Platzhalter-Konvention entspricht nicht der Wirklichkeit, und mindestens
`11-mahnung-stufe-1.md` widerspricht der geltenden Zahlungs-Policy. Damit niemand sie später für aktuell
hält, trägt die README einen entsprechenden Statushinweis.

## KI-Prüfung

**Ja, Beiwerk — aber nicht in diesem Schritt.** Der Reiter selbst braucht kein Modell; er zeigt Text an,
und die Prüfungen sind Regeln, die deterministisch billiger und verlässlicher sind. Sinnvoll wäre ein
Modell später an einer anderen Stelle: eine Durchsicht aller Vorlagen auf Ton, Widersprüche zwischen
Vorlagen und KI-Sprache, angestoßen auf Knopfdruck statt bei jedem Seitenaufruf. Das setzt genau die
Registry voraus, die hier entsteht, und wird erst vorgeschlagen, wenn der Reiter steht.

## Agenten-Zugang

**Tür offen halten.** Die Registry ist von sich aus eine benannte, typisierte Aktions-Ebene: „gib mir
Vorlage X mit Kontext Y" ist eine reine Funktion mit klarer Signatur. Ein späterer Zugriff wäre damit
Anschlussarbeit statt Umbau. Gebaut wird dafür jetzt nichts, es gibt keinen Nutzer dafür.
