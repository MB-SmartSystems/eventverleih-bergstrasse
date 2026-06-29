# Eventverleih Bergstraße — Full-System-Audit (read-only)

_Stand 2026-06-25, Hermes-Autopilot. 6 Dimensionen über 3 parallele read-only Agenten (Money-Flow, Lifecycle/Mail, Daten/Security). Jeder Befund mit Datei:Zeile belegt. **Nichts wurde geändert** — reine Mängelliste. Fixes = separate Freigabe._

**Gesamtbild:** Das System ist reif und überdurchschnittlich sauber gebaut (Zuflussprinzip, §19 durchgängig, Stripe-Signatur verifiziert, Link-Feld-Auflösung korrekt, Blob-Race entschärft, Handbuch deckungsgleich mit Code — Drift-Check grün). Die realen Lücken sitzen am Storno-Rand, bei Nebenläufigkeits-Idempotenz und an Security-Rändern. Keine Architektur-Eingriffe nötig.

## 🔴 P1 — echtes Geld-/EÜR-Risiko

**1. Nicht-Stripe-Erstattung erzeugt keine negative Einnahme → EÜR überzeichnet dauerhaft.**
`api/admin/buchung/[id]/storno/route.ts:58-69` + `api/member/buchung/[id]/storno/route.ts:104-114` (Handbuch Z.142). Negative Gegenbuchung entsteht NUR über `charge.refunded`-Webhook (`stripe/webhook/route.ts:318-366`). Bar-/Überweisungs-Zahler werden laut Handbuch bewusst manuell erstattet (nie Stripe-Refund) — ihre positive Einnahme (`zahlung/route.ts:143`) bleibt dann stehen. Member-Storno löst nie einen Stripe-Refund aus. **Fix:** bei nicht-Stripe-Erstattung im Storno-Pfad `bucheEinnahme(betrag=-erstattung, quelle=storno-<id>)`.

## 🟡 P2 — wichtig (Geld-Korrektheit, Doppelversand, Security-Härtung)

**2. Einnahme-Buchung nicht atomar (Doppelbuchungs-Race).** `lib/eventverleih/einnahme.ts:96-108` — read-check-write ohne DB-Unique-Constraint; gleichzeitige Stripe-Re-Deliveries (at-least-once) können dieselbe Einnahme doppelt buchen. (Von 2 Agenten unabhängig bestätigt; Handbuch Z.247 kennt die Grenze.) **Fix:** Unique-Feld auf dem Marker oder `processed_events`-Tabelle mit `event.id`.

**3. Kautions-Pre-Auth-Hold wird bei Storno nicht freigegeben.** admin+member `storno/route.ts` rufen kein `cancelKaution` → Hold bleibt ~7 Tage auf der Kundenkarte geblockt. **Fix:** im Storno-Pfad vorhandenen Hold canceln + offene Pending/Auto_Reply-MailQueue-Rows der Buchung auf „Rejected".

**4. Member-Storno verspricht Erstattung ohne Wiedervorlage.** `member/.../storno/route.ts:116-186` sendet „Sie erhalten X € zurück", der Refund ist aber manuell. Schlägt der Telegram-Notify fehl / fehlt die `N8N_*_NOTIFY_URL`, hält nur ein Audit-Flag `refund_pending` das fest — keiner löst aus. **Fix:** fällige Erstattung als sichtbaren Task/Dead-Letter führen.

**5. ELSTER-Zeile wird bei programmatischen Einnahmen nie gesetzt.** `einnahme.ts:100-108` vs `admin/elster/export/route.ts:83` — alle Miet-Einnahmen haben leere `ELSTER_Zeile_Link` → manuell nachzutragen vor Filing. **Fix:** Standard-Einnahmen-Zeile (Mapping 956) als Default-Link in `bucheEinnahme`.

**6. Rechnungsnummern-Kollision unter Nebenläufigkeit.** `lib/eventverleih/rechnung.ts:48-57` — `max+1` ohne Lock; zwei gleichzeitige `rechnung-erstellen` für verschiedene Buchungen → identische `RG-YYYY-NNNN` (GoBD-Eindeutigkeit). Geringe Wahrscheinlichkeit (manuell), strukturell möglich. **Fix:** Counter-Row mit atomarem Increment oder Unique-Index + Retry.

**7. Mail-Dedup-Vorprüfung fehlt in `anfrage/[id]/action`.** `api/admin/anfrage/[id]/action/route.ts:385-396` legt die MailQueue-Row ohne den sonst überall genutzten `search:idemKey`-Pre-Check an → Doppelklick „Freigeben" = Angebot doppelt an den Kunden. **Fix:** gleichen `existing.find(...)`-Pre-Check wie in den anderen Routen.

**8. Cron-Endpoints fail-open ohne `CRON_SECRET`.** `api/cron/{review-reminder:17, restzahlung-reminder:96, kaution-reminder:53, termin-1h-reminder:52}` — `if (expected && auth !== ...)`: fehlt die Env-Var, entfällt die Prüfung → jeder kann mail-versendende/Baserow-mutierende Crons triggern. **Fix:** fail-closed (`if (!expected || auth !== ...)` → 401), Pattern wie store-pdf.

**9. Kein Rate-Limit/Lockout auf Admin-Login.** `api/admin/login/route.ts` + `lib/auth.ts:53` — ein Env-Passwort, unbegrenzte Versuche. **Fix:** Versuchszähler/Verzögerung (Upstash) oder Vercel-Firewall-Rule.

## 🟢 P3 — Aufräumen / Robustheit (Auswahl)
- **Lifecycle-Zustände:** `In_Miete` quasi unerreichbar (keine Auto-Transition, `status.ts:77-81`); `Abgelaufen` (`angebot-expiry.ts:75`) fehlt in `VALID` + hat keinen Case in `next-action.ts`/`status.ts` → Dashboard zeigt „Status unbekannt". Keine Transition-Guards (jeder Sprung erlaubt).
- **Stripe-Feld-Splits:** Webhook überschreibt `Restzahlung_Bezahlt_Eur` statt zu summieren (`webhook:229-233` vs `zahlung:131`); Unterzahlung → negativer Feld-Split (`webhook:101`). EÜR bleibt korrekt, nur Storno-Erstattungsbasis falsch.
- **`Storno_Betrag_Eur`-Semantik uneinheitlich** (Erstattung vs. Gebühr je nach Pfad) → jede Auswertung mehrdeutig.
- **`kaution-erstatten` ohne früh-Idempotenz-Guard** (`route.ts:58-130`): Doppel-Submit → Stripe-Doppelcapture (502); fixer Marker `schaden-${id}` verhindert Nachbuchen eines korrigierten Schadensbetrags. Phantom-Einnahme bei Schaden ohne je hinterlegte Kaution möglich.
- **Auth-Härtung:** keine `timingSafeEqual`-Vergleiche; Admin-HMAC-Token ohne serverseitiges Max-Alter; Member-Token 30d plaintext in T949 + als `?token=` in Magic-Links (URL-Leak); keine Security-Header (CSP/HSTS/X-Frame-Options) in `next.config.mjs`/`vercel.json`.
- **`contact/route.ts`-Rollback** best-effort → bei Hard-Kill verwaiste Rows möglich.

## ⚙️ Config-Check (nicht-Vuln, aber prüfen)
Code liest `ADMIN_PASSWORD` (`auth.ts:8,53`); Projekt-Memory nennt die Env `EVENTVERLEIH_ADMIN_PASSWORT`. Wenn der Login funktioniert, heißt die Vercel-Var real `ADMIN_PASSWORD` → Memory-Notiz korrigieren; sonst bräche der Login. **Kurz gegenchecken.**

## Bewusste Design-Entscheidungen (KEIN Defekt)
Kaution wird korrekt NICHT als Einnahme gebucht (Hold = kein Zufluss). Doppelbuchung desselben Artikels ist absichtlich „first-to-pay-wins, weich" (Verfügbarkeit zieht nur committete Buchungen ab, Engpass wird nur geflaggt, nie auto-storniert) — konsistent umgesetzt + im Handbuch dokumentiert. Manuelle Restzahlung sendet bewusst keine Auto-Bestätigung (Policy „Dashboard-Aktion = keine Auto-Kundenmail").

## Empfohlene Reihenfolge
P1 (#1) zuerst — einziges dauerhaftes EÜR-Verfälschungs-Risiko. Dann die zwei Security-Schnellschüsse #8 (Cron fail-closed) + #9 (Login-Rate-Limit). Dann #2/#6 (Idempotenz/Nummern unter Nebenläufigkeit) + #3/#4 (Storno-Rand). P3 als Sammel-PR.
