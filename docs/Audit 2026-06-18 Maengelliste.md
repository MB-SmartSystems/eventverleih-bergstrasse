# Eventverleih Bergstraße — System-Audit 2026-06-18

> Voll-Audit: Dashboard, Website, Verlinkungen, Buttons, automatische Mails, Zahlungs-/Buchhaltungspfade.
> Methode: Code-Trace (read-only) + Live-GET-Check der Website + Verifikation am Baserow-Live-Schema.
> **Zahlungs-/Refund-/EÜR-Pfade wurden NICHT live ausgelöst** (Produktion läuft auf Stripe-LIVE, kein Test-System) — statisch geprüft.

---

## A. Behoben (Branch `hermes/audit-fixes-2026-06-18`, TypeScript grün)

| # | Befund | Datei | Schwere | Fix |
|---|--------|-------|---------|-----|
| **S1** | **Kunden-Storno warf 500 „internal".** `updateRow` schrieb `Storno_Grund:"Kunde_Selbst"` und `Storno_Stufe:"0%/50%/…"` — **keine gültigen** Baserow-Single-Select-Optionen (951) → Baserow lehnt PATCH (400) ab → Exception → 500, Button zeigt „internal". | `api/member/buchung/[id]/storno/route.ts` | **kritisch** (Kernfunktion tot) | Auf gültige Optionen gemappt: `Storno_Grund="Kunden_Wunsch"`, `Storno_Stufe` → `keine/>14T_kostenfrei/7T_50/4T_75/2T_100`. |
| **R1** | EÜR-Doppel-Einnahme bei Doppelklick/Retry: „Rechnung bezahlt" prüfte Status nicht atomar, kein Existenz-Check auf Einnahme. | `api/admin/rechnung/[id]/bezahlt/route.ts` | hoch (Steuer) | Vor `createRow(Einnahmen)` prüfen, ob für die Rechnung schon eine Einnahme existiert. |
| **R2** | Rechnungsnummer-Wiedervergabe ab der 201. Rechnung/Jahr (Baserow klemmt `listRows` auf 200 → Max-Berechnung sieht nur älteste 200). GoBD-Verstoß. | `lib/eventverleih/rechnung.ts` | hoch (GoBD) | `listAllRows` (vollständige Pagination) statt `listRows({size:500})`. |
| **R4** | Doppel-Beleg pro Buchung: `createRechnungForBuchung` hatte keinen internen Idempotenz-Guard. | `lib/eventverleih/rechnung.ts` | mittel-hoch (GoBD) | Bestehenden Beleg der Buchung erkennen und idempotent zurückgeben. |
| **W1** | Restzahlung ohne Idempotenz: Stripe liefert Events „at least once" → Re-Delivery überschreibt Restzahlung + dupliziert Audit-Log. | `api/stripe/webhook/route.ts` | hoch | Guard: skip, wenn `Restzahlung_Bezahlt_am` bereits gesetzt. |
| **W4** | Kautions-Hold-Datum wird beim Capture überschrieben (succeeded-Event setzt `Kaution_Hinterlegt_am` neu auf Capture-Datum). | `api/stripe/webhook/route.ts` | niedrig | Nur setzen, wenn Feld noch leer. |

---

## B. Offen — Empfehlung (bewusst NICHT blind auf Live-System gefixt)

| # | Befund | Datei | Schwere | Empfehlung |
|---|--------|-------|---------|------------|
| **R3** | Rechnungsnummer-**Race**: zwei gleichzeitige Erstellungen lesen denselben Max → gleiche RG-Nummer. „read-max-then-create" ist prinzipiell unsicher. | `lib/eventverleih/rechnung.ts` | hoch (GoBD) | Echte Serialisierung nötig: DB-seitige Unique-Constraint auf `Rechnungsnummer` + Retry, oder zentraler Zähler in `System_Konfiguration` mit Lock. **Architektur-Entscheidung — mit dir abstimmen.** |
| **R5** | Stripe-Fehler bei Kaution-Auflösung wird verschluckt: scheitert `cancel/capture`, wird trotzdem `Kaution_Pruefung_Status=abgeschlossen` gesetzt **und** „Kaution kommt zurück"-Mail verschickt → Kunde wartet auf Geld, das Stripe nie freigab. | `api/admin/buchung/[id]/kaution-erstatten/route.ts` | mittel | Bei gesetzter PaymentIntent-ID den Stripe-Fehler **nicht** schlucken: abbrechen (Status nicht auf „abgeschlossen", Mail unterdrücken) oder Fehler-/Retry-Status setzen. |
| **W2** | Keine `event.id`-Deduplizierung des Webhooks insgesamt — Idempotenz hängt rein am fachlichen Status. | `api/stripe/webhook/route.ts` | mittel | Webhook-Event-IDs einmalig persistieren (Audit/Feld) und am Eingang gegen Bestand prüfen. |
| **W3** | Anzahlung/Komplett wird mit dem **Soll**-Betrag verbucht statt dem tatsächlich gezahlten `pi.amount` → unsichtbare Ist/Soll-Divergenz bei stale Payment-Links. | `api/stripe/webhook/route.ts` | mittel | Betrag aus `pi.amount/100` setzen (konsistent zur Restzahlung) und bei Abweichung vom Soll flaggen. **Ggf. Absicht — mit dir klären.** |
| **W5** | `charge.refunded` ohne Guard; PaymentIntent-ID für Anzahlung/Restzahlung wird nie persistiert → Storno-Auto-Refund läuft still ins Leere, wenn die ID nicht manuell mitkommt. | `api/stripe/webhook/route.ts`, `api/admin/buchung/[id]/storno/route.ts` | niedrig-mittel | PI-ID im succeeded-Handler in ein Baserow-Feld schreiben; `charge.refunded` mit Guard. |

---

## C. Website / Verlinkungen / Buttons — Live-Check

- **Alle öffentlichen Seiten** (`/`, `/cart`, `/impressum`, `/datenschutz`, `/agbs`, `/danke`, `/mein-bereich`, Login, Sitemap, robots) liefern **200** bzw. sauberen 307-Redirect. ✅
- **Alle internen Links** der Startseite (Footer-Recht, Galerie-Bilder, Assets) **200**, keine toten Links. ✅
- **Externer Link** Analytics erreichbar. ✅
- **Buttons/Form-Actions**: jeder Admin- und Kunden-Button ist an eine existierende API-Route verdrahtet, keine `onClick`-ohne-Handler, keine 404-Ziele. Disabled-Logik (Submit während Laufzeit, Pflichtfelder) sauber.

---

## D. UX / Klarheit „was ist wann zu tun" (Verbesserungsvorschläge)

Fokus laut Auftrag. Keine Bugs, sondern Hebel für Übersicht:

1. **Fehlermeldung beim Kunden-Storno entschärfen.** Aktuell wurde der rohe Server-Fehler `internal` 1:1 in der roten Box gezeigt. Besser: generische, freundliche Meldung („Storno konnte nicht abgeschlossen werden, bitte melde dich kurz bei uns") + technisches Detail nur ins Log. (Der auslösende Bug ist gefixt; die Fehler-Darstellung bleibt als UX-Härtung sinnvoll.)
2. **Dashboard-Inbox als einzige Tagesansicht betonen.** Die 4-Quadranten-Inbox (`/admin`) ist faktisch deine „To-do-Liste". Vorschlag: pro Quadrant eine klare Zahl + „nächste Aktion" (z. B. „3 Mails warten auf Freigabe").
3. **Pending-Mail-Freigabe sichtbarer machen.** Anzahlungs-Erinnerungen und Bewertungsbitten brauchen deine Freigabe — wenn die untergehen, gehen Reminder/Reviews nie raus. Vorschlag: Badge/Zähler im Header.
4. **Storno-Refund-Reminder.** Nach Kunden-Storno mit Erstattung kommt nur eine Telegram-Nachricht. Vorschlag: zusätzlich ein offener Posten „Refund ausstehend" im Dashboard, bis du ihn als erledigt markierst — sonst kann ein Refund vergessen werden.
5. **n8n-MailQueue-Health im Blick.** Da der gesamte Mailversand an n8n hängt, wäre ein simpler „letzte Mail versendet vor X min"-Indikator im Admin ein Frühwarnsystem.

---

## E. Nicht-Befunde (geprüft, in Ordnung)

- `bezahltEur()` liest korrekt die Skalar-Felder (der alte „Stripe-Zahler = 0 €"-Erstattungsbug ist **weg**).
- Webhook-Signatur-Verify korrekt (Raw-Body, Verify vor Verarbeitung, 400 bei Fehler).
- Kaution voll/teil/einzug → cancel/capture-Mapping inkl. Rundung korrekt.
- Reservierungs-Zahlung (Anzahlung/Komplett) ist idempotent (persistenter Status-Guard, überlebt Serverless-Kaltstarts).
- Magic-Link-Login mit Enumeration-Schutz (immer 200).

---

## F. Status & nächste Schritte

- **Branch:** `hermes/audit-fixes-2026-06-18` — 6 Fixes, `tsc --noEmit` grün, **noch nicht deployed**.
- **Deploy:** Push auf `main` löst Vercel-Auto-Deploy auf die Live-Seite aus. Bewusst auf deine Freigabe wartend (Live-Stripe + Buchhaltung).
- **Empfohlene Live-Verifikation nach Deploy:** ein echter Kunden-Storno einer unverbindlichen Test-Anfrage (kostenfrei, kein Geld) mit `manuelbuettner@web.de` → bestätigt S1-Fix end-to-end.
- **Offene Architektur-Entscheidungen:** R3 (Rechnungsnummer-Race), W2 (Event-Dedup), W3 (Ist/Soll) — brauchen deine Richtungsentscheidung.

---

## Nachtrag 2026-06-20 — Stand nach den Folge-Fixes (verifiziert am Code, HEAD ~`bf08aeb`)

### Status der 18.06-Befunde
| ID | Status | Beleg |
|----|--------|-------|
| S1, R1, R2, R4, W1, W4 | **BEHOBEN** (auf main) | Abschnitt A — gemerged + zusätzlich gehärtet |
| **R5** | **BEHOBEN** | `kaution-erstatten/route.ts` — Stripe-Fehler → 502, kein „abgeschlossen", keine Mail |
| **W3** | **BEHOBEN** | `webhook/route.ts` — Ist-Betrag `pi.amount`, Divergenz-Audit `betrag_divergenz` |
| **W5** | **TEILWEISE** | PI-Persistenz behoben (`Stripe_Zahlung_PaymentIntent`, Refund-Pfad nutzt sie). `charge.refunded`-Guard fehlt weiter (loggt nur → kein Geldrisiko, deckungsgleich mit W2) |
| **R3** | **OFFEN** | `rechnung.ts` `nextRechnungsnummer` = max+1 in JS, kein Lock/Unique/Retry → GoBD-Risiko (Doppel-Nummer) |
| **W2** | **OFFEN** | Webhook ohne `event.id`-Dedup; Idempotenz hängt am Fachstatus |

Zusätzlich seit 18.06: Stripe-Webhook abonniert jetzt `payment_intent.amount_capturable_updated` (Kaution-Hold landete vorher nie in Baserow); Einnahmen laufen nach **Zuflussprinzip (Modell A)** — siehe Betriebshandbuch-Abschnitte „Stripe-Webhook" + „Einnahmen / Finanzen-Reiter".

### Neue Befunde (2026-06-20-Audit) — noch OFFEN
**Klasse „Geld fließt, erreicht aber nie die Buchhaltung":**
| # | Stelle | Schwere | Befund |
|---|--------|---------|--------|
| N1 | `kaution-erstatten` (teil/einzug) | hoch | Kautions-**Schaden-Einzug** (Stripe capture) wird nur ins Audit-Log geschrieben, **nicht als Einnahme** → fehlt in Finanzen + EÜR. Fix: `bucheEinnahme()` in beiden Capture-Zweigen |
| N2 | `admin/storno` + `member/storno` | hoch | Einbehaltene **Stornogebühr** (bei Stripe-Zahlern bereits geflossen) wird nie als Einnahme gebucht. Fix: einbehaltenen Teil als Einnahme buchen |
| N3 | `elster/export` | hoch | ELSTER-CSV nutzt `listRows` (Cap 200) statt `listAllRows` → **Steuer-Export schneidet ab 201. Zeile still ab**. Fix: `listAllRows` |

**Klasse „Status/Konsistenz-Hänger":**
| # | Stelle | Schwere | Befund |
|---|--------|---------|--------|
| N4 | `angebot/[id]/neue-version` | hoch | Setzt `Versendet`, lässt `Akzeptiert_am` stehen → „Nachhaken" blockt mit „bereits angenommen". Fix: `Akzeptiert_am: null` mitsetzen |
| N5 | `anfrage/[id]/action` (ablehnen) | hoch | Setzt `Storniert` ohne Storno-Felder (Grund/Datum). Fix: `Storno_am` + `Storno_Grund` mitschreiben |
| N6 | `member/storno` | mittel | Leere n8n-Notify-URLs → „Refund auslösen"-Ping still verschluckt (kein Audit/Fallback) → Erstattung kann liegenbleiben. Fix: Audit/Mail-Fallback |
| N7 | `buchung-recalc.ts` | mittel | Überschreibt `Anzahlung_Soll_Eur` auch nach gesetzter `Anzahlung_Bezahlt_am`. Fix: Anzahlung nicht neu berechnen wenn bezahlt |
| N8 | `member/storno` | niedrig | Kein Audit-Log-Eintrag (Inkonsistenz zu allen anderen Routen) |

**Geprüft & OK:** Button-/Form-Verdrahtung (keine toten Buttons), MailQueue-Freigabe, Finanzen-/ELSTER-**Seite** (lesen via `listAllRows`), heutige Zahlungspfade (idempotent), Übergabe/Rücknahme/Kaution-Hold/-IBAN.
