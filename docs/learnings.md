# learnings.md — Eventverleih Bergstraße (Website/Dashboard)

Was sich beim Arbeiten an diesem Repo zeigt: Stolpersteine, Eigenheiten, teuer bezahlte Erkenntnisse.
Lokal neben dem Code, statt in einem zentralen Korb. Regel: `learnings-lokal`.

**Was hier hineingehört:** wiederkehrende Wahrheiten über dieses System („Feld X ist ein Formelfeld, nie
in den PATCH-Payload", „Webhook Y feuert auch bei Z").
**Was NICHT:** ein Bug („im Dashboard funktioniert X nicht") — der wird ein Task und gefixt, nicht hier
konserviert. Und nichts, was schon als Rule oder in der `CLAUDE.md` steht.

**Format je Eintrag:** `## YYYY-MM-DD — Titel`, darunter **Kontext** (was passierte), **Folge** (was es
kostete), **Lehre** (was künftig gilt).

---

## 2026-07-23 — `decrypt=true` auf der Env-Liste liefert die verschlüsselte Hülle, nicht den Klartext

**Kontext:** Der n8n-Workflow `eve-termin-1h-reminder` lief seit dem 22.06. bei jedem Lauf in HTTP 401.
Beim Nachstellen holte ich `CRON_SECRET` über
`GET /v9/projects/{id}/env?decrypt=true` und bekam einen 1172 Zeichen langen Wert, der mit `ey` beginnt
und auf `==` endet — das sieht wie ein JWT aus, ist aber base64-kodiertes JSON mit den Keys `c`/`k`/`v`,
also Vercels **verschlüsselte Hülle**. Mit diesem Wert antwortete die Live-Route ebenfalls 401. Den
Klartext (64 Zeichen) gibt erst der Einzelabruf `GET /v9/projects/{id}/env/{envId}`.

**Folge:** Die Hülle wurde vorher schon einmal für den echten Wert gehalten und als „ungewöhnlich langes
JWT, offenbar versehentlich hineinkopiert" notiert. Auf dieser Fehlspur wäre der Fix ein Ändern des
Vercel-Secrets gewesen — also ein Eingriff in ein funktionierendes Produktions-Secret, während die
eigentliche Ursache woanders lag.

**Lehre:** Fingerprint-Vergleiche nur über den **Einzelabruf per `envId`**. Plausibilitätsprüfung vor dem
Vergleich: beginnt der Wert mit `ey`, hat er **null** Punkte und endet auf `==`, ist es die Hülle — ein
echtes JWT hat zwei Punkte. Und: gegen die Live-Route testen, bevor irgendetwas geändert wird. Der
401-Test hätte die falsche Ursachenannahme sofort widerlegt.

## 2026-07-23 — Ein leeres `CRON_SECRET` sieht im n8n-Node aus wie ein falsches

**Kontext:** Ursache des 401 war nicht ein Wert-Mismatch zwischen n8n und Vercel, sondern eine **leere**
Zeile `CRON_SECRET=` in der Master-`.env` (`/root/.env` auf dem VPS ist ein Symlink darauf). Der Node
baut `'Bearer ' + $env.CRON_SECRET` und schickte damit `Bearer ` ohne Wert. n8n wirft dabei keinen
Fehler — die Expression ist gültig, nur leer.

**Folge:** Stiller Ausfall über einen Monat. Betroffen war genau ein Workflow (Prüfung über alle 144
Workflows: nur `eve-termin-1h-reminder` nutzt `$env.CRON_SECRET`), deshalb fiel es nirgends sonst auf.

**Lehre:** Bei `Bearer`-401 aus n8n zuerst prüfen, ob die Variable **leer** ist, nicht ob sie
**abweicht** — `docker exec <container> sh -lc 'printf %s "$CRON_SECRET" | md5sum'`. Der md5 des leeren
Strings ist `d41d8cd9`; wer den sieht, sucht keinen Mismatch mehr. Container nach `.env`-Änderung mit
`docker compose up -d n8n` neu erzeugen (nur dieser Service), ein Neustart des ganzen Stacks ist nicht
nötig.

---

## Noch nicht hier: die System-Map

Die teuersten Erkenntnisse zu diesem Projekt stehen aktuell noch in `~/.claude/rules/eventverleih-system-map.md`
(Build-Guard, Doppel-Einnahme-Falle in der EÜR, Formelfelder, `charge.refunded`-Webhook-Falle,
Nummern-Schema, Status-Lifecycle). Sie werden von dort **nicht kopiert** — das wäre eine Dublette.

Sie ziehen hierher um, sobald das rules-Entlastungs-Goal läuft (62 % der immer geladenen Rules sind
aufgabenspezifisch). Bis dahin gilt: **die Rule ist die Wahrheit**, diese Datei sammelt alles Neue ab
2026-07-17.

---

## 2026-07-23 — Wer den Beleg über „Kaution erstatten" anlegt, verschließt den Weg zur Belegmail

**Kontext:** `kaution-erstatten` stellt vor der Einnahme-Buchung sicher, dass ein Beleg existiert
(`src/app/api/admin/buchung/[id]/kaution-erstatten/route.ts:158-162`): erst
`findRechnungForBuchung(buchungId)`, und nur falls nichts da ist
`createRechnungForBuchung(buchungId, { sendMail: false })`. Das `sendMail: false` ist Absicht — die
Kautions-Auflösung ist laut Entscheidung vom 2026-06-24 rein intern und schickt keine Kundenmail.

Der Haken liegt eine Ebene tiefer: `createRechnungForBuchung` prüft als Erstes auf Idempotenz und gibt
eine bereits vorhandene Rechnung **früh zurück** — und dieser `return` steht **vor** dem Block, der den
n8n-Webhook `N8N_RECHNUNG_PDF_URL` auslöst. Der Mail-Trigger hängt also am Neuanlage-Pfad, nicht am
`sendMail`-Flag.

**Folge:** Ist der Beleg einmal über „Kaution erstatten" entstanden, löst der Button „Rechnung erstellen
+ Mail senden" **keine Belegmail mehr aus**. Er meldet Erfolg und liefert die vorhandene Rechnung
zurück — sichtbar passiert nichts Falsches, es passiert nur nichts. Ein stiller Fehlschlag: der Kunde
bekommt seine Rechnung nie per Mail, und niemandem fällt es auf.

Verschärfend: **Es gibt keinen Versand-Nachweis.** Belegmails laufen nicht über die MailQueue (969) —
in 88 Zeilen steht kein einziger Rechnungs-/Beleg-Key —, `EmailLog` (953) ist leer, und die
n8n-Executions werden regelmäßig aufgeräumt. Ob ein konkreter Kunde seine Rechnung erhalten hat, lässt
sich im Nachhinein weder belegen noch widerlegen.

**Lehre:**
1. **Ein Idempotenz-Ausstieg darf keine Nebenwirkung mitverschlucken.** Wenn ein früher `return` eine
   Ressource zurückgibt, gehört geprüft, welche Schritte danach stehen und ob sie für den zweiten
   Aufruf trotzdem laufen müssen. Hier: der Mail-Versand.
2. **Für jede Mail an einen echten Kunden braucht es einen Versand-Marker am Datensatz**, sonst ist
   weder „wurde sie verschickt?" beantwortbar noch ein Nachsenden ohne Dublettenrisiko möglich. Der
   `sendMail`-Parameter allein sagt nur, was gewollt war, nicht was passiert ist.
3. Beim Ändern der Rechnungslogik immer **beide** Erstellungspfade mitdenken: `rechnung-erstellen`
   (mit Mail) und `kaution-erstatten` (ohne). Sie unterscheiden sich genau in dieser einen Zeile.

**Status:** **gefixt am 2026-07-23**, von Manuel freigegeben. Feld `Beleg_Mail_am` (Rechnungen 950,
Datum mit Uhrzeit) ist der Versand-Marker; der Trigger hängt jetzt am `sendMail`-Flag plus Marker
statt am Neuanlage-Pfad, und die Oberfläche meldet den Mail-Status statt pauschal Erfolg.

**Nachtrag aus der Umsetzung — zwei Folgefehler, die derselben Wurzel entstammen:**

1. **Ein Marker schützt nur, wenn er persistiert ist.** Erster Entwurf meldete „gesendet", auch wenn
   das Schreiben des Markers fehlschlug — beim nächsten Klick wäre das Feld leer gewesen und der
   Kunde hätte die Mail doppelt bekommen. Genau der Fall, den der Marker verhindern soll. Jetzt:
   Wiederholversuch, und wenn auch der scheitert, ein eigener Status, der in der Oberfläche sagt
   „Mail ist raus, Vermerk fehlt, NICHT erneut auslösen, bitte von Hand nachtragen".
2. **Validierungen der Erstellung dürfen die Wiederherstellung nicht blockieren.** Die Prüfungen auf
   Kundenadresse und Summe > 0 standen vor dem Idempotenz-Zweig. Für eine längst eingefrorene
   Rechnung sind sie sachfremd: stehen die Buchungspreise inzwischen auf 0, hätte das Nachholen der
   Belegmail an einem 422 scheitern müssen. Die Idempotenz läuft jetzt zuerst — server- **und**
   clientseitig, denn dieselbe Prüfung saß auch im Button.

**Verallgemeinert:** Wenn ein Pfad vom „Normalfall" zum „Reparaturfall" wird, gehören seine
Vorbedingungen überprüft. Bedingungen, die für das Erzeugen richtig sind, sind für das Nachholen oft
falsch. Und: Ein Schutzmechanismus ist erst dann einer, wenn sein Fehlschlag sichtbar wird.

---

## Offen / noch nicht erprobt

- **Der Versand-Marker ist ungetestet im Echtbetrieb.** Der Pfad wurde geprüft, aber bewusst nie
  gefeuert — ein Testlauf hätte eine echte Kundenmail ausgelöst. Belegt ist er erst, wenn bei der
  nächsten echten Rechnung `Beleg_Mail_am` gefüllt ist und der Knopf danach auf „Beleg bereits
  versendet" steht.
