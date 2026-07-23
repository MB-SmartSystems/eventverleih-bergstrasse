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

6. **Versand-Marker `Beleg_Mail_am`** (Rechnungen 950, Datum mit Uhrzeit, Zeitzone Europe/Berlin,
   Feld-ID 11385). Die Belegmail geht genau einmal raus, der Knopf sagt vor **und** nach dem Klick,
   was mit der Mail passiert. Freigegeben von Manuel inklusive Schemaänderung.

## ⏳ Wartet auf Manuel

- **Merge nach `main`** (= Live-Gang, Vercel deployt bei Push auf main).

## Versand-Marker: was im Datenbestand steht

`Beleg_Mail_am` wurde für den Altbestand aus dem **BCC-Postfach** nachgetragen — der Workflow
`eve-rechnung-render-mail` setzt `bccEmail = info@eventverleih-bergstrasse.de`, dort liegt der
Nachweis. Eingetragen wurde jeweils das belegte Datum, nicht das heutige:

| Rechnung | Buchung | `Beleg_Mail_am` | Beleg |
|---|---|---|---|
| RG-2026-0001 | 22 | 18.06.2026 11:35 | Mail an `ute-reinhard@gmx.de` |
| RG-2026-0002 | 16 | 24.06.2026 14:14 | Mail an `ski-michael@web.de` |
| RG-2026-0003 | 27 | 29.06.2026 21:17 | Mail an `m.kraemer9208@yahoo.com`, **erste** von mehreren |
| ZV-0007_01, ZV-0008 | 3, 4 | leer | Altimporte aus PDF, kein Versandnachweis |

**Ein leeres Feld heißt „unbekannt", nicht „nicht verschickt".** Das steht so auch in der
Feldbeschreibung in Baserow und im Betriebshandbuch, weil es sonst zwangsläufig falsch gelesen wird.

Bei RG-2026-0003 ist eine **Dublette belegt**: fünf Sendezeitpunkte am 29.06. (21:17, 21:38, 21:42,
21:44, 21:47). Genau davor schützt der Marker jetzt.

## Ungeprüft geblieben — was ein späterer echter Vorgang belegen muss

Zwei Punkte sind **reviewed, nicht verifiziert** — der Statusübergang (Punkt 3) und der Versand-Marker
(Punkt 6). Beim Marker wurde der Pfad geprüft, aber bewusst nie gefeuert: ein Testlauf hätte eine echte
Kundenmail ausgelöst. Er gilt als belegt, sobald bei der nächsten echten Rechnung `Beleg_Mail_am`
gefüllt ist und der Knopf danach auf „Beleg bereits versendet" steht.

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

## Gefixt: Belegmail nach dem Weg ueber Kaution erstatten

**War:** `kaution-erstatten` legt den Beleg mit `sendMail: false` an. `createRechnungForBuchung` stieg
bei bereits vorhandener Rechnung früh aus, **vor** dem n8n-Mail-Trigger. Ein späterer Klick auf
Rechnung erstellen + Mail senden löste deshalb keine Belegmail mehr aus: der Knopf meldete Erfolg,
es passierte nur nichts.

**Ist:** Der Versand hängt am `sendMail`-Flag plus Marker, nicht mehr am Neuanlage-Pfad. Die
Idempotenz-Prüfung läuft jetzt **vor** den Erstellungs-Validierungen (Kundenadresse, Summe > 0),
sonst wäre das Nachholen an Bedingungen gescheitert, die nur für das Erzeugen gelten. Dieselbe
Reihenfolge gilt im Button.

**Wenn der Marker nicht geschrieben werden kann:** Wiederholversuch, und wenn auch der scheitert,
meldet die Oberfläche ausdrücklich, dass die Mail raus ist, der Vermerk aber fehlt, samt Anweisung,
`Beleg_Mail_am` von Hand nachzutragen und NICHT erneut auszulösen. Ein Erfolg zu melden, dessen
Dublettenschutz gar nicht persistiert ist, wäre wieder dieselbe stille Zusage gewesen.

**Beweislage zum Altbestand:** Der Versandnachweis liegt im BCC-Postfach, nicht in Baserow. Die
MailQueue führt keine Belegmails (kein Rechnungs-Key in 88 Zeilen), `EmailLog` (953) ist leer. Über
das Postfach ist belegt: alle drei App-Rechnungen sind beim Kunden angekommen, kein Kunde ist ohne
Rechnung geblieben.

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

### Für die Mail-Session: eine Belegmail in Du-Form

Eventverleih siezt. Im Postfach `info@eventverleih-bergstrasse.de` liegt eine Belegmail mit
Du-Anrede im Betreff:

- **29.06.2026, 21:47**, Ordner **Gesendet**
- Betreff: `Dein Beleg RG-2026-0003 – Eventverleih Bergstraße`
- Empfänger: `m.kraemer9208@yahoo.com`

Zum Vergleich: Die vier automatischen Mails desselben Vorgangs (21:17 bis 21:44) tragen alle
`Ihr Beleg RG-2026-0003 – …`. Die Vorlage im n8n-Workflow `eve-rechnung-render-mail` erzeugt
ausschließlich die Sie-Form (`Ihr Beleg ${rgNr} – Eventverleih Bergstraße` bzw.
`Rechnung ${rgNr} – …`). Die Du-Variante stammt also **nicht** aus diesem Workflow — vermutlich
Handversand oder eine zweite Vorlage. Wenn es kein Codefall ist, ist hier nichts zu tun; falls doch
eine zweite Vorlage existiert, gehört sie in den Vorlagen-Reiter.
