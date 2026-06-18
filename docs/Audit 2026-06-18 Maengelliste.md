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
