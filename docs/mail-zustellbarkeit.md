# Mail-Zustellbarkeit — Befund & Runbook (Stand 06.06.2026)

## Symptom
Eingangsbestätigungen kommen bei web.de Stunden verspätet an und landen im Spam —
trotz Absender-Zuordnung im Posteingang. Betrifft mit hoher Wahrscheinlichkeit auch
Kunden (web.de/GMX/Gmail-Empfänger), da die Ursache serverseitig ist.

## Verifizierte Versandkette
1. `/api/contact` legt MailQueue-Row an (Baserow Tabelle 969, `Approval_Status: Auto_Reply`)
2. n8n-Workflow `eve-mailqueue-poll` (Cron, jede Minute) → SMTP-Versand als
   `info@eventverleih-bergstrasse.de`, BCC an sich selbst, dann `Mark Sent`
3. Gemessen an den Test-Anfragen 05.06.: Versand jeweils **< 60 s** nach Submit
   (`Sent_am` 19:52:13Z / 22:23:13Z). **Queue + n8n sind NICHT das Problem.**

## Diagnose (DNS, geprüft 06.06.2026)
| Check | Status |
|---|---|
| SPF | ✅ `v=spf1 a mx include:spf.kasserver.com ~all` |
| DKIM | ❌ **kein Record auf gängigen Selektoren** — Domain signiert nicht |
| DMARC | ⚠️ `v=DMARC1; p=none;` (vorhanden, aber ohne Wirkung/Reporting) |
| MX | `w0207210.kasserver.com` (85.13.166.210, All-Inkl) |
| Blacklists | ✅ IP sauber (Spamhaus, SpamCop, Barracuda, SORBS) |
| SPF-Hygiene | ⚠️ `a` zeigt auf Vercel (216.198.79.1) — autorisiert sinnlos den Webserver |

**web.de Postmaster-Anforderungen:** Eine gültige DKIM-Signatur ist **Pflicht**
(„mandatory"), Domain-Alignment erforderlich; SPF allein reicht ausdrücklich nicht.
Quelle: https://postmaster.web.de/en/requirements-and-recommendations
Ohne DKIM: Spam-Einstufung + verzögerte Annahme (Greylisting/Throttling) bei
web.de/GMX, ähnliche Gewichtung bei Gmail.

## Fix (Manuel, ~10 Min) — Aufgabe #3 in Baserow
1. **DKIM aktivieren:** All-Inkl KAS → **Domain** → eventverleih-bergstrasse.de
   → **Bearbeiten** → **„DKIM Signierung" auf „aktiviert"** → speichern.
   All-Inkl generiert den Key und legt den DNS-Record automatisch an.
   (Falls UI abweicht: im KAS nach „DKIM" suchen. Tutorial: all-inkl.com → Anleitungen
   → „DKIM (bei Versand über unsere Mailserver)".)
2. **Hermes Bescheid geben** → Verifikation:
   - DNS: Selektor-Record vorhanden? (Selektor steht nach Aktivierung in den
     KAS-DNS-Einstellungen der Domain)
   - Test-Mail an mail-tester.com (Wegwerf-Kunde via Anfrage-API, danach Cleanup)
   - Header einer echten Mail: `DKIM-Signature` vorhanden, `dkim=pass`?
3. **Erwartung:** Spam-Einstufung bessert sich unmittelbar; die Verzögerungs-
   Problematik nimmt mit wachsender Domain-Reputation ab (nicht schlagartig).

## Nachgelagert (erst wenn DKIM stabil läuft)
- **DMARC anheben:** `v=DMARC1; p=quarantine; rua=mailto:info@eventverleih-bergstrasse.de`
  — Reporting zuerst einige Wochen mitlesen, dann ggf. `p=reject`.
- **SPF straffen:** `v=spf1 mx include:spf.kasserver.com ~all` (das `a` = Vercel raus).

## Ideen-Backlog Zustellbarkeit (bewertet, keine Auto-Umsetzung)
- **Header-Check pro Empfänger-Provider:** Nach DKIM je eine Testanfrage mit
  web.de-, GMX- und Gmail-Adresse → `Authentication-Results` vergleichen. Geringer
  Aufwand, echter Beweis statt Annahme.
- **List-Unsubscribe-Header:** Für Transaktionsmails (Eingangsbestätigung) nicht
  nötig — nur relevant, falls je Marketing-Mails über diesen Weg laufen.
- **Dedizierter Mail-Dienst (Resend/Postmark):** Größter Hebel für Reputation,
  aber neuer Baustein + Kosten. Empfehlung: NICHT jetzt — erst DKIM via All-Inkl,
  das ist das einfache System. Nur eskalieren, wenn danach weiter Spam-Probleme.
- **Monitoring:** mail-tester-Score quartalsweise prüfen oder DMARC-rua-Reports
  auswerten (kostenlos via Postmaster-Tools von Google für gmail-Sicht).

## Offen / nicht verifizierbar ohne Manuel
- Received-Header der verspäteten Mail (beweist Greylisting vs. anderes Delay und
  zeigt, ob All-Inkl evtl. mit exotischem Selektor doch signiert): Mail in web.de
  öffnen → ⋮ → Nachrichtenquelle anzeigen → an Hermes geben.
