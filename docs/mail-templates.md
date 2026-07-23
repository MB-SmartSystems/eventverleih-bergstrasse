# Mailvorlagen — wo sie leben und wie man sie prüft

Alle Kundenmails entstehen im Code und landen als Zeile in der Baserow-MailQueue (Tabelle 969).
Versendet wird nicht von dieser Anwendung, sondern vom n8n-Workflow `eve-mailqueue-poll`.

## Der Aufbau

```
src/lib/eventverleih/mail-templates/
  types.ts       MailText, TemplateBuilder, TemplateEntry, UncoveredTemplate
  build/         je Vorlage eine reine Funktion (ctx) => { subject, body }
  beispiele.ts   benannte Beispiel-Kontexte für die Vorschau
  registry.ts    Titel, Auslöser, Freigabe-Pflicht, Fundstelle, Beispiele
  pruefungen.ts  Regeln über den gerenderten Text
```

Angezeigt wird das unter **`/admin/vorlagen`**. Die Seite ruft dieselben Bau-Funktionen auf, die auch die
echten Mails erzeugen — deshalb kann die Anzeige nicht von der Wirklichkeit abweichen.

## Die eine Regel für Bau-Funktionen

Eine Bau-Funktion **liest nichts und schreibt nichts**. Kein Baserow, keine Umgebungsvariablen, keine Uhr.
Sie bekommt einen Kontext und gibt Text zurück. Datenzugriff, `createRow`, Idempotenz-Key und
Fehlerbehandlung bleiben in der aufrufenden Route.

Der Grund ist nicht Stilfrage: Nur eine Funktion ohne Nebenwirkung darf für eine Vorschau aufgerufen
werden. Sobald eine Bau-Funktion etwas schreibt, würde das Öffnen der Übersichtsseite Mails erzeugen.

## Neue Mail hinzufügen

1. Bau-Funktion unter `build/` anlegen, rein halten.
2. Eintrag in `registry.ts` mit `key`, `title`, `trigger`, `autoSend`, `source` (Pfad **mit Zeilennummer**)
   und mindestens einem Beispielfall. Hat die Mail Bedingungsblöcke, gehören **beide** Fälle hinein —
   sonst zeigt die Übersicht nur einen Zweig und blendet genau die interessanten Stellen aus.
3. Der Registry-Test schlägt fehl, solange die Zählung nicht stimmt. Das ist Absicht.

## Prüfen

```bash
npm test                                  # alle Tests, inklusive Registry und Prüfungen
npx vitest run src/lib/.../datei.test.ts  # einzeln
```

### Der Gleichheitsbeweis beim Verschieben von Texten

Wird ein Text aus einer Route in eine Bau-Funktion gezogen, darf er **wandern, aber sich nicht ändern**.
Das prüft:

```bash
npm run check:mail-literals          # alle Mailtext-Dateien gegen main
node scripts/mail-literals-diff.mjs main <alte-datei> <neue-datei>   # gezielt beim Umzug
```

Beim gezielten Aufruf alte **und** neue Datei im selben Aufruf übergeben, sonst gilt das gewanderte
Literal als verschwunden. Der Fehler geht bewusst in diese Richtung: Vergessen führt zum Fehlalarm, nie
zum stillen Freispruch.

Verglichen wird das **Textgerüst**: die festen Zeichen zwischen den Einsetzungen. Eine umbenannte Variable
(`${body.anmerkung.trim()}` wird `${anmerkung}`) ändert am gelesenen Text nichts und geht durch, wird aber
im Bericht aufgeführt. Ein verändertes Wort geht nicht durch.

Exit 0 heißt: kein Zeichen am Kundentext verändert. Es heißt **nicht**, dass die richtige Variable
eingesetzt wird und auch nicht, dass der Aufruf korrekt verdrahtet ist — dafür sind die Tests da, und für
den Rest ein Fremdmodell-Review. Beides zusammen, nicht eines statt des anderen: beim ersten Durchgang
dieser Umstellung ging genau so ein optionales Funktionsargument verloren, das weder `tsc` noch der
Textvergleich sehen konnte. Schlägt der Vergleich fehl, wird die Extraktion korrigiert, nicht der
Vergleich.

## Was nicht mehr gilt

`ops-daten/templates/mails/` (13 Markdown-Dateien mit `{{platzhalter}}`, Mai 2026) wird **vom Code nicht
gelesen** und ist überholt. Historischer Kontext, keine Quelle.

Die Rechnungs-/Beleg-Mail liegt nicht in diesem Repo, sondern im n8n-Workflow `eve-rechnung-render-mail`
(`N8N_RECHNUNG_PDF_URL`). Sie erscheint in der Übersicht als „nicht erfasst" mit Begründung.
