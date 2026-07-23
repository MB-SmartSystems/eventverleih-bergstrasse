# Handoff: Entfernen-Kreuz + Rechnungs-Haken

- **Branch:** `admin-bestellliste`, 9 Commits über `main` (bfafe88), auf GitHub gesichert
  (`c472dac`, per API gegengeprüft). **Nicht nach `main` gemergt** — der Merge ist der Live-Gang und
  braucht Manuels Wort.
- **Spec:** `docs/superpowers/specs/2026-07-23-positionen-entfernen-und-rechnungs-haken-design.md`
- **Plan:** `docs/superpowers/plans/2026-07-23-positionen-entfernen-und-rechnungs-haken.md`
- **Entscheidung:** Vault `Decisions/2026-07-23-positionen-nach-rechnungsstellung-gesperrt.md`

## Was drin ist

1. Entfernen-Kreuz direkt in der Positionszeile (`BestellListe.tsx`), separater Block entfernt,
   `EntfernenPanel.tsx` gelöscht. Geteilte Busy-Sperre und Sicherheitsabfragen unverändert übernommen.
2. Checklisten-Punkt „Rechnung erstellt + Mail raus" hängt an der Existenz der Rechnung.
3. Statusübergang `Zurueckgegeben` → `Abgerechnet` in `createRechnungForBuchung`, mit Kautions-Guard.
4. Beide Entfernen-Routen sperren mit 409, sobald eine Rechnung existiert. Positions-Route leitet die
   Buchung aus `Position.Buchung_Link` ab, nicht aus dem Request-Body.
5. Audit-Log für entfernte Positionen; `Aktion: "Sonstiges"`, echte Aktion in `Details.typ`.

## ⏳ Wartet auf Manuel

- **Merge nach `main`** (= Live-Gang, Vercel deployt bei Push auf main).
- **Belegmail-Lücke** — Befund liegt vor, Fix nicht begonnen. Siehe unten.

## Ungeprüft geblieben — was ein späterer echter Vorgang belegen muss

Der Statusübergang (Punkt 3) ist **reviewed, nicht verifiziert**. Ein Testlauf hätte eine echte
GoBD-Rechnungsnummer verbrannt und eine Beleg-Mail ausgelöst. Er gilt erst als verifiziert, wenn ein
**echter** Vorgang folgendes gezeigt hat:

**Vorbedingung, sonst sagt der Test nichts aus:** Buchung steht auf `Zurueckgegeben`, ist voll bezahlt
(`Anzahlung_Bezahlt_am` **und** `Restzahlung_Bezahlt_am` gesetzt), und die Kaution ist aufgelöst
(`Kaution_Rueckzahlung_am` gesetzt oder `Kaution_Soll_Eur` = 0).

**Zu belegen nach dem Erstellen der Rechnung, auf der neu geladenen Buchungsseite:**

1. `Status_Erweitert` steht auf `Abgerechnet` (Baserow 951 oder Statuszeile im Detail).
2. Checklisten-Punkt „Rechnung erstellt + Mail raus" ist abgehakt und zeigt die Rechnungsnummer.
3. Bei den Positionen sind keine Kreuze mehr, stattdessen der Sperrhinweis mit der Rechnungsnummer.

**Gegenprobe bei ausbleibendem Statuswechsel** (unterscheidet „korrekt nicht ausgelöst" von „defekt"):
In Baserow 950 die neue Rechnung ansehen.
- `Status = Gesendet` → Buchung war nicht voll bezahlt, Guard hat korrekt nicht ausgelöst.
- `Status = Bezahlt` und Buchung trotzdem `Zurueckgegeben` **und** Kaution aufgelöst → **Fix ist defekt**,
  dann `console.error("[rechnung] Buchung-Abschluss fehlgeschlagen")` in den Vercel-Logs suchen.
- `Status = Bezahlt`, Buchung `Zurueckgegeben`, Kaution **offen** → korrekt, so gewollt.

Solange das nicht passiert ist, bleibt dieser Punkt offen. Er hakt sich nicht von selbst ab.

## Befund, nicht gefixt: Belegmail nach „Kaution erstatten"

- **Heute:** `kaution-erstatten` legt den Beleg mit `sendMail: false` an und sendet bewusst keine
  Kundenmail (Route, Zeile 183). `createRechnungForBuchung` steigt bei bereits vorhandener Rechnung
  früh aus — **vor** dem n8n-Mail-Trigger. Ein späterer Klick auf „Rechnung erstellen + Mail senden"
  löst deshalb keine Belegmail mehr aus.
- **Sollte:** Der Button löst die Belegmail auch für eine bereits existierende Rechnung aus, und zwar
  genau einmal.
- **Berührt Manuels Entscheidung:** ja, Sende-Grenze. Kein neuer Text nötig (das Template liegt im
  n8n-Workflow `eve-rechnung-render-mail`), aber es fehlt ein Versand-Marker. Ohne ihn droht eine
  doppelte Belegmail an einen echten Kunden. Sauber wird es erst mit einem Feld an der Rechnung
  (z. B. `Beleg_Mail_am`) → Baserow-Schemaänderung, also Manuels Entscheidung.

**Beweislage, ehrlich:** Ob konkrete Kunden ihre Rechnung per Mail bekamen, lässt sich **nicht mehr
feststellen**. Belegmails laufen nicht über die MailQueue (kein Rechnungs-Key in 88 Zeilen), `EmailLog`
(953) ist leer, und die n8n-Executions aus Juni sind aufgeräumt. Die Lücke ist aus dem Code belegt, der
Einzelfall nicht.

## Lokale Umgebung

- **`nachhaken/.env.local` ist ein Symlink** auf `../website/.env.local`. Der Worktree hatte keine
  eigene Env, ohne sie startet der Dev-Server ohne Baserow-Zugang und der Admin-Login gibt 401.
  Gitignored über `.env*.local`, keine zweite Kopie der Secrets auf der Platte. Nicht löschen, nicht
  in ein Repo kopieren.
- **`npm install` nötig**, wenn der Worktree von einem älteren Branch kommt: `main` hat `@dnd-kit/*`
  dazubekommen, sonst schlägt `tsc` mit TS2307 fehl.
- **Gates:** `node node_modules/.bin/tsc --noEmit -p tsconfig.json` und `npm run check:umlaute`.
  `npm run lint` ist unbrauchbar — ESLint wurde in diesem Repo nie initialisiert, der Befehl öffnet
  einen interaktiven Setup-Dialog.

## Fremdes Feld, nicht angefasst

- `src/app/admin/layout.tsx:136` feuert `fetch('/api/admin/products')` und erzeugt im Buchungsdetail
  zwei 401 in der Browser-Konsole. Gehört der Mail-Session, ist dort gemeldet.
