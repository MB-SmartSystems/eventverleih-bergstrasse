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

**Status:** Befund vorgelegt, **nicht gefixt**. Der naheliegende Fix (Marker `Beleg_Mail_am` an
Rechnungen 950 + Trigger im Idempotenz-Zweig) berührt die Sende-Grenze und braucht eine
Baserow-Schemaänderung — beides Manuels Entscheidung. Details im Handoff
`docs/superpowers/2026-07-23-handoff-admin-bestellliste.md`.

---

## Offen / noch nicht erprobt

- Belegmail-Lücke (Eintrag oben): Entscheidung über den Fix liegt bei Manuel.
