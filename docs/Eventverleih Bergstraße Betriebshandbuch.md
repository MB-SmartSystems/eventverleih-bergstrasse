# Eventverleih Bergstraße — Betriebshandbuch (Dashboard & Mail-System)

> **Zweck.** Eine Quelle der Wahrheit dafür, *wann welche E-Mail* an den Kunden geht, *wer sie auslöst* (Klick oder Automatik) und *wo im Code* sie lebt. Teil A erklärt das in Alltagssprache (für Manuel / Dashboard). Teil B ist die Code-Landkarte (für Hermes), damit Mail-Änderungen nicht jedes Mal eine Komplett-Suche brauchen.
>
> **Stand:** 2026-06-18, Repo-Commit `059d066`. Beschreibt den **Repo-Code**.
>
> ⚠️ **Drift-Warnung:** Produktion lief in der Vergangenheit Code, der in keinem lokalen Commit stand (Mail-Betreffe, die nirgends im Repo auffindbar waren). Wenn eine real zugestellte Mail von diesem Dokument abweicht: nicht annehmen Repo == Prod. Mit `git grep "<Betreff>" $(git rev-list --all)` über *alle* Commits suchen und gegen die **Live-Baserow-Rows** (Tabelle MailQueue) prüfen.
>
> 🔧 **Wartungsregel (wichtig):** Wird eine Mail geändert, hinzugefügt oder entfernt → **die Tabelle in Teil B im selben Commit mitpflegen.** Genau das spart künftig die Code-Sucherei.

---

## Teil A — Was passiert wann? (für Manuel)

### Die vier Sendemodi

Jede Mail liegt zuerst in der **MailQueue** (Baserow). Wie sie von dort rausgeht, steuert das Feld `Approval_Status`:

| Modus | Was es bedeutet |
|---|---|
| **`Pending`** | Wartet auf **deine** Freigabe im Dashboard-Backoffice. Geht erst raus, wenn du auf „freigeben" klickst. |
| **`Auto_Reply`** | Geht **sofort** raus — der n8n-Poll `eve-mailqueue-poll` holt die Queue ~jede Minute ab. Keine Freigabe nötig. |
| **`Approved`** | Folge einer Aktion von dir (z. B. „Angebot freigeben"): die Aktion *ist* die Freigabe → geht sofort raus. |
| **`Rejected`** | Abgelehnt, wird nie versendet. |

Faustregel: **`Pending`** = „ich schaue nochmal drüber" · **`Auto_Reply`/`Approved`** = „läuft automatisch, ich muss nichts tun".

### Der Lebenszyklus einer Buchung (Zeitstrahl)

Status-Feld der Buchung: `Status_Erweitert`. Werte:
`Anfrage → Angebot_versendet → Bestaetigt → Reserviert → Uebergeben → (In_Miete) → Zurueckgegeben → Abgerechnet`.
Seitenpfade: `Abgelaufen` (Angebot verstrichen), `Storniert`, `No_Show`.

```
①  ANFRAGE
    Kunde füllt Website-Formular aus
    → Auto: Eingangsbestätigung an den Kunden
    Du im Dashboard: Angebot freigeben | mit Anmerkung | Rückruf vorschlagen | ablehnen

②  ANGEBOT VERSENDET
    Du klickst „Angebot freigeben + Mail senden"
    → Mail: Angebot an Kunden
    Bleibt aktiv bis Annahme ODER Eventdatum verstreicht.
    Läuft es ungenutzt ab → STILL (keine Kundenmail).
    Nach ~10 Tagen ohne Reaktion: Button „Nachhaken" (NICHT Angebot 1:1 neu schicken).
    Preise/Daten geändert? → „Neue Version" verschickt aktualisiertes Angebot.

③  ANZAHLUNG / BESTÄTIGT → RESERVIERT
    Kunde zahlt Anzahlung (Stripe) oder du erfasst Überweisung manuell
    → Auto: „Anzahlung erhalten — Ihr Termin ist reserviert"
    (Komplettzahlung möglich → Auto: „Zahlung erhalten — vollständig bezahlt")
    Erst ab Anzahlung sind die Artikel reserviert.
    Cron schickt ggf. Anzahlungs-Reminder (T-14/-7/-3 vor Event, oder 3 Tage nach Bestätigung) — als Pending, du gibst frei.

④  VOR DEM TERMIN
    Kaution-Hold-Link: manuell (Button) oder Auto-Cron (T-5 vor Event) → Auto
    Restzahlungs-Info (T-3) → Auto
    Termin-Erinnerung Übergabe (T-1) → Auto
    1 Stunde vor Übergabe „Gleich: Ihr Termin um …" → Auto (Schedule alle ~15 Min)

⑤  ÜBERGABE
    Du dokumentierst Übergabe (Fotos + Checkliste) im Dashboard
    → Auto: „Übergabe erfolgt — Ihre Mietartikel"
    Status: Uebergeben (ggf. In_Miete)

⑥  VOR / BEI RÜCKGABE
    Termin-Erinnerung Rückgabe (T-1) → Auto
    1 Stunde vor Rückgabe → Auto
    Du dokumentierst Rückgabe → Status: Zurueckgegeben

⑦  KAUTION & ABSCHLUSS
    Du prüfst Kaution + Schäden (Prüffrist ~1–2 Tage).
    Button „Kaution erstatten":
      · voll          → Auto: Kaution kommt zurück
      · Teilerstattung → Auto: Teilerstattung wegen Schaden
      · Kompletter Einzug → Auto: kompletter Einzug wegen Schaden
    Bar-Kaution ohne Stripe-Hold: „IBAN anfordern" (Pending) → du überweist manuell per Bank-App.
    Status: Abgerechnet

⑧  BEWERTUNG
    3–10 Tage nach Event-Ende: Bewertungsbitte als Pending (du gibst frei).
    Timing-Gate: erst NACHDEM die Kaution zurück ist — nie während du noch Kundengeld hältst.
    Manuels Wunsch: Bewertungs-CTA in EINE warme Abschluss-Mail bündeln (nicht standalone).
```

### Dauerhafte Geschäftsregeln (gelten projektweit)

- **Kaution = durchlaufender Posten / Sicherheit, KEINE Einnahme.** Nie auf die Mietrechnung, nie abgezogen. Schäden separat über die Kaution, nicht über die Mietsumme.
- **Refund-Methode folgt der Zahlungsmethode.** Stripe-bezahlt → Stripe-Refund (Button löst Auto-Mail aus). Bar/Überweisung → manuelle (Termin-)Überweisung, **nie** Stripe-Refund.
- **Zahlungsgebühren nie an den Kunden weitergeben** (§270a BGB). Entfällt eine bezahlte Leistung → volle Differenz erstatten, ohne Gebühren-Abzug.
- **Rechnung nach der Rückgabe** (Leistung erbracht), **entkoppelt** von der Kautionsrückzahlung — nicht darauf warten.
- **Offene Kautionsrückzahlung = Buchung gilt NICHT als abgeschlossen** (bleibt offene Aktion bis erstattet).
- **Angebot läuft still ab** (keine „Angebot abgelaufen"-Mail). Gültigkeit ~14 Tage. Nachhaken erst nach ~10 Tagen, „erneut senden" nur Ausnahme.
- **Mail-Ton:** Erfolgsfall (volle Erstattung) warm + persönlich inkl. Bewertungsbitte; Schadensfälle (Teil/Einzug) sachlich-neutral. Stil-Grundregeln (`schreibstil-manu`) immer durchsetzen.

---

## Teil B — Code-Landkarte (für Hermes)

### MailQueue-Mechanik

- **Baserow-Tabelle:** `MailQueue` = **969** (definiert in `src/lib/baserow/client.ts`, Konstante `TABLES`).
- **Schreiben:** Routen/Reminder legen eine Row mit `createRow(TABLES.MailQueue, { Template_Key, Approval_Status, … })` an. Idempotency-Key (Buchungs-ID + Template + ggf. Datum/Suffix) verhindert Doppel-Versand; manuelle Erfassung und Stripe-Webhook teilen sich denselben Key.
- **Versenden:** n8n-Schedule **`eve-mailqueue-poll`** holt die Queue ~jede Minute ab und versendet alles mit `Auto_Reply`/`Approved`. `Pending` bleibt liegen bis Freigabe über `POST /api/admin/mailqueue/[id]/approve` (bzw. `…/reject`).
- **Texte:** Betreff + Body liegen derzeit **inline** in der jeweiligen Route/Reminder-Datei (kein zentrales Template-Verzeichnis). Bei Text-Änderung also in der unten genannten Datei:Zeile editieren.

### Mail-Inventar (alle 30, nach Lebenszyklus-Phase)

Spalten: **Auslöser · Sendemodus · Datei:Zeile · `Template_Key` · Betreff**

#### Anfrage / Angebot
| Mail | Auslöser | Modus | Datei:Zeile | Template_Key |
|---|---|---|---|---|
| Eingangsbestätigung | Website-Formular `POST /api/contact` | `Auto_Reply` | `api/contact/route.ts:434` | `anfrage_eingang` |
| Angebot freigegeben | Aktion `freigeben` | `Approved` | `api/admin/anfrage/[id]/action/route.ts:206` | `angebot_freigegeben` |
| Angebot freigegeben + Anmerkung | Aktion `freigeben_anmerkung` | `Approved` | `api/admin/anfrage/[id]/action/route.ts:206` | `angebot_freigegeben_anmerkung` |
| Rückruf-Vorschlag | Aktion `rueckruf` | `Approved` | `api/admin/anfrage/[id]/action/route.ts:219` | `rueckruf_vorschlag` |
| Anfrage abgelehnt | Aktion `ablehnen` | `Approved` | `api/admin/anfrage/[id]/action/route.ts:224` | `anfrage_abgelehnt` |
| Angebot erneut gesendet | `POST …/angebot/[id]/erneut-senden` | `Approved` | `api/admin/angebot/[id]/erneut-senden/route.ts:131` | `angebot_erneut_gesendet` |
| Angebot nachhaken (~T+10) | `POST …/angebot/[id]/nachhaken` | `Approved` | `api/admin/angebot/[id]/nachhaken/route.ts:115` | `angebot_nachhaken` |
| Angebot neue Version | `POST …/angebot/[id]/neue-version` | `Approved` | `api/admin/angebot/[id]/neue-version/route.ts:123` | `angebot_aktualisiert` |

#### Zahlung
| Mail | Auslöser | Modus | Datei:Zeile | Template_Key |
|---|---|---|---|---|
| Anzahlung erhalten | Stripe-Webhook `payment_intent.succeeded` (anzahlung) **oder** manuelle Erfassung `…/buchung/[id]/zahlung` | `Auto_Reply` | `lib/eventverleih/zahlungsbestaetigung.ts:35` | `anzahlung_erhalten` |
| Komplettzahlung erhalten | Stripe-Webhook (komplettzahlung) | `Auto_Reply` | `api/stripe/webhook/route.ts:113` | `komplettzahlung_erhalten` |

#### Reminder (Cron-gesteuert)
| Mail | Auslöser | Modus | Datei:Zeile | Template_Key |
|---|---|---|---|---|
| Anzahlungs-Reminder T-14 | Cron `restzahlung-reminder` | `Pending` | `lib/eventverleih/anzahlung-reminder.ts:186` | `anzahlung_pre14` |
| Anzahlungs-Reminder T-7 | Cron `restzahlung-reminder` | `Pending` | `lib/eventverleih/anzahlung-reminder.ts:186` | `anzahlung_pre7` |
| Anzahlungs-Reminder T-3 | Cron `restzahlung-reminder` | `Pending` | `lib/eventverleih/anzahlung-reminder.ts:186` | `anzahlung_pre3` |
| Anzahlungs-Reminder T+3 n. Bestätigung | Cron `restzahlung-reminder` (Status=Bestaetigt) | `Pending` | `lib/eventverleih/anzahlung-reminder.ts:186` | `anzahlung_post3` |
| Restzahlung-Info T-3 | Cron `restzahlung-reminder` (Status=Reserviert) | `Auto_Reply` | `api/cron/restzahlung-reminder/route.ts:168` | `restzahlung_pre3` |
| Termin-Erinnerung Übergabe T-1 | Cron `restzahlung-reminder` (Sub-Pass) | `Auto_Reply` | `lib/eventverleih/termin-reminder.ts:156` | `termin_erinnerung` |
| Termin-Erinnerung Rückgabe T-1 | Cron `restzahlung-reminder` (Sub-Pass) | `Auto_Reply` | `lib/eventverleih/termin-reminder.ts:214` | `rueckgabe_erinnerung` |
| Termin 1 h vor Übergabe | Cron `termin-1h-reminder` (~alle 15 Min) | `Auto_Reply` | `api/cron/termin-1h-reminder/route.ts:111` | `termin_1h_uebergabe` |
| Termin 1 h vor Rückgabe | Cron `termin-1h-reminder` | `Auto_Reply` | `api/cron/termin-1h-reminder/route.ts:111` | `termin_1h_rueckgabe` |
| Bewertungsbitte (Google) | Cron `kaution-reminder` Sub-Pass `runReviewReminder` (3–10 T nach Event) | `Pending` | `lib/eventverleih/review-reminder.ts:99` | `google_review` |

#### Termin / Übergabe
| Mail | Auslöser | Modus | Datei:Zeile | Template_Key |
|---|---|---|---|---|
| Übergabe-Termin bestätigt | `POST …/buchung/[id]/termin` (uebergabe_termin) | `Approved` | `api/admin/buchung/[id]/termin/route.ts:103` | `termin_uebergabe_bestaetigung` |
| Rückgabe-Termin bestätigt | `POST …/buchung/[id]/termin` (rueckgabe_termin) | `Approved` | `api/admin/buchung/[id]/termin/route.ts:103` | `termin_rueckgabe_bestaetigung` |
| Übergabe erfolgt | `POST …/buchung/[id]/uebergabe` | `Auto_Reply` | `api/admin/buchung/[id]/uebergabe/route.ts:152` | `uebergabe_erfolgt` |

#### Kaution
| Mail | Auslöser | Modus | Datei:Zeile | Template_Key |
|---|---|---|---|---|
| Kaution-Hold-Link | `POST …/buchung/[id]/kaution-mail` (manuell) **oder** Cron `kaution-reminder` (T-5) | `Auto_Reply` | `lib/eventverleih/kaution-mail.ts:124` | `kaution_hold_link` |
| Kaution-Erstattung voll | `POST …/buchung/[id]/kaution-erstatten` action=`voll` | `Auto_Reply` | `api/admin/buchung/[id]/kaution-erstatten/route.ts:197` | `kaution_rueckzahlung` |
| Kaution-Teilerstattung | …/kaution-erstatten action=`teil` | `Auto_Reply` | `api/admin/buchung/[id]/kaution-erstatten/route.ts:197` | `kaution_teilerstattung` |
| Kaution-Einzug | …/kaution-erstatten action=`einzug` | `Auto_Reply` | `api/admin/buchung/[id]/kaution-erstatten/route.ts:197` | `kaution_einzug` |
| Kaution IBAN anfordern (Bar) | `POST …/buchung/[id]/kaution-iban-anfordern` | `Approved` | `api/admin/buchung/[id]/kaution-iban-anfordern/route.ts:77` | `kaution_iban_anfordern` |

#### Sonstiges / Member
| Mail | Auslöser | Modus | Datei:Zeile | Template_Key |
|---|---|---|---|---|
| Storno-Bestätigung | `POST /api/member/buchung/[id]/storno` (Kunde) | `Auto_Reply` | `api/member/buchung/[id]/storno/route.ts:126` | `storno_bestaetigung` |
| Login Magic-Link | `POST /api/member/login-link` | `Auto_Reply` | `api/member/login-link/route.ts:56` | `login_magic_link` |

### Status-Felder (Buchung)

- **Haupt-Status:** `Status_Erweitert` → `Anfrage · Angebot_versendet · Abgelaufen · Bestaetigt · Reserviert · Uebergeben · In_Miete · Zurueckgegeben · Abgerechnet · Storniert · No_Show`
- **Termine:** `Uebergabe_Termin`, `Rueckgabe_Termin` (ISO-DateTime)
- **Zahlung:** `Anzahlung_Bezahlt_am/_Eur`, `Restzahlung_Bezahlt_am/_Eur`
- **Kaution:** `Kaution_Soll_Eur`, `Kaution_Hinterlegt_am`, `Kaution_Rueckzahlung_am`, `Stripe_Kaution_PaymentIntent`, `Kaution_Pruefung_Status`, `Kaution_Prueffrist_bis`
- **Schaden:** `Schaden_Betrag_Eur`, `Schaden_Dokumentiert_am`
- **Storno:** `Storno_am`, `Storno_Stufe`, `Storno_Betrag_Eur`, `Storno_Grund`
- **Engpass-Flag:** `Konflikt_Mit_Buchung_ID`

### Cron-Map (Vercel Hobby-Limit → wenige Crons mit Sub-Passes)

| Cron-Route | Takt | löst aus |
|---|---|---|
| `api/cron/restzahlung-reminder` | täglich ~07:30 | Restzahlung-Info + Sub-Passes: Anzahlungs-Reminder, Termin-Reminder (T-1), Angebots-Expiry |
| `api/cron/kaution-reminder` | täglich | Kaution-Hold (T-5) + Sub-Pass `runReviewReminder` (Bewertungsbitte) |
| `api/cron/termin-1h-reminder` | ~alle 15 Min (n8n) | 1-h-Mails Übergabe/Rückgabe |

Alle Sub-Passes laufen fail-soft (Fehler in einem killt nicht die anderen).

### Mail-Logik-Dateien (Direktsprung)

- `lib/eventverleih/zahlungsbestaetigung.ts` — Anzahlungs-Eingang
- `lib/eventverleih/anzahlung-reminder.ts` — 4 Anzahlungs-Reminder
- `lib/eventverleih/termin-reminder.ts` — Termin-Reminder T-1 (Übergabe + Rückgabe)
- `lib/eventverleih/kaution-mail.ts` — Kaution-Hold-Link
- `lib/eventverleih/review-reminder.ts` — Bewertungsbitte
- Freigabe/Ablehnung von `Pending`-Mails: `api/admin/mailqueue/[id]/approve|reject/route.ts`

### Neue Mail hinzufügen — Checkliste

1. `createRow(TABLES.MailQueue, { Template_Key: "<neu>", Approval_Status: "<Pending|Auto_Reply|Approved>", … })`.
2. Idempotency-Key setzen (Buchungs-ID + Template + ggf. Timestamp) → kein Doppel-Versand.
3. Neuer zeitgesteuerter Reminder → als `export async function run<Name>()` in `lib/eventverleih/`, dann als **Sub-Pass** in einen bestehenden Cron einbinden (Hobby-Plan-Limit, keine neue Cron-Route).
4. Betreff + Body inline in der Route/Reminder-Datei.
5. **Diese Tabelle in Teil B aktualisieren** (Wartungsregel).

---

## Teil C — Lücken im Ist-Zustand

Was die Geschäftslogik erwarten ließe, aber im Repo **nicht** existiert (Stand 2026-06-18) — rein deskriptiv, keine geplanten Features:

- **Keine dedizierte Rechnungs-Mail.** Die Rechnung/Beleg läuft aktuell über die Beleg-URL in der Kaution-Erstattungs-Mail; eine eigenständige „Rechnung im Anhang"-Mail nach Rückgabe gibt es im Code nicht.
- **Keine Mahnung / Zahlungserinnerung** bei ausbleibender Restzahlung (über die freundlichen Reminder hinaus).
- **Keine Rechnungskorrektur / Gutschrift-Mail.**
