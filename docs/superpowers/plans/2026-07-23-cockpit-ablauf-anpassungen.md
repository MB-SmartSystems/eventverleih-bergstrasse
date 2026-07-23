# Cockpit-Ablauf-Anpassungen (Eventverleih) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or mb-executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 14 gegrillte Cockpit-/Mail-Anpassungen umsetzen und als EIN Deploy live bringen (Stripe-Auto-Import-Ausbau ist NICHT Teil dieses Plans — separat morgen).

**Architecture:** Reine Änderungen im bestehenden Next.js-Repo. Zwei Ebenen: (1) Admin-UI (`src/app/admin/**`) — Sortierung, Aktions-Gating, Anlege-Modal, Vorschau-Label, Geviertstrich-Prüfer. (2) Mail-Vorlagen (`src/lib/eventverleih/mail-templates/**`) — reine Bau-Funktionen, kein Versand. Verifikation über die vorhandenen Gates: `tsc`, `npm test` (vitest, inkl. mail-literals + pruefeAlle), `npm run check:umlaute`.

**Tech Stack:** Next.js App Router, TypeScript, Baserow, Vitest.

**Bewusst-Minimal / Nicht-Scope:** KEIN Stripe-Auto-Import-Ausbau (existiert für Stripe/PayPal bereits via Webhook; „mehr auf Stripe lenken" passiert über die Mailtexte — der API-Feinschliff ist morgen). KEINE neue Mahn-Mechanik. KEIN echter Mailversand. KEIN neues Rollen-/Rechtekonzept. Nur die 14 entschiedenen Punkte.

## Global Constraints

- **Kein Mailversand.** Nur die reinen Vorlagen-Bau-Funktionen ändern; keinen Sende-Pfad (`sendMail`, MailQueue-Insert mit Auto_Reply) auslösen oder testen.
- **Zahlungs-Rangfolge in ALLEN Kunden-Mails:** Stripe (empfohlen) → PayPal → Überweisung → Bar (nie priorisiert).
- **Bar-Hinweise, wo Bar erwähnt wird:** (1) Betrag passend, kein Wechselgeld; (2) Überzahlung kommt mit der Kaution zurück.
- **Echte Umlaute** überall im Kundentext (`ä ö ü ß`), Gate `check:umlaute` muss grün sein.
- **Keine KI-Slop-Tells** im neuen Kundentext (keine Em-Dashes im Fließtext, keine Buzz-Trikolons, keine „Whether/In today's"-Öffner).
- **Kontrast** bei UI-Farb-Änderungen ≥ 4,5:1 (hier kaum betroffen, aber gilt).
- **Code englisch, Kundentext deutsch (Sie-Form).**
- **Commits pro Task direkt auf `main`; Push EINMAL am Ende (ein Deploy).**
- **Deploy = live**; danach Live-Zustand verifizieren (nicht nur Exit 0).

---

### Task 1: Buchungsliste — Standard-Sortierung aufsteigend (C4)

**Files:**
- Modify: `src/app/admin/buchungen/page.tsx` (defaultSort `:129`, buildHref natural `:158`)

**Skills (am Prompt-Anfang laden):** —

- [ ] Arbeits-Ansichten (`alle`/`anstehend`/`aktiv`) default `event_asc`, Archiv (`abgeschlossen`/`storniert`) default `event_desc`. `buildHref`-`natural` entsprechend anpassen, damit saubere URLs bleiben.
- [ ] `npm test` + `node node_modules/.bin/tsc --noEmit` grün.
- [ ] Commit: `feat(admin): Buchungsliste sortiert Arbeits-Ansichten aufsteigend (naechstes Event oben)`

### Task 2: Beleg-Button — Gating + Wording (C1/C2)

**Files:**
- Modify: `src/app/admin/buchungen/[id]/page.tsx` (RechnungErstellenButton `:451`)
- Modify: `src/app/admin/buchungen/[id]/RechnungErstellenButton.tsx` (disabled-Zustand + Begründung; Label „Beleg" bleibt)

**Skills:** —

- [ ] Neue Prop `gate: { ok: boolean; grund: string | null }` an den Button. `ok` = Status ∈ {Zurueckgegeben, Abgerechnet} UND Kaution abgerechnet (`Kaution_Rueckzahlung_am` gesetzt ODER `Kaution_Soll_Eur`==0) UND Miete voll bezahlt (`bezahlt >= gesamt-kaution`). Sonst `grund` = konkreter fehlender Schritt.
- [ ] Button bei `!ok` **ausgegraut + sichtbarer Begründungstext** („Beleg erst nach Rückgabe, Schadensprüfung und Kaution-Abrechnung"). Kein Verstecken.
- [ ] Wording-Sweep: kundenseitige „Rechnung"→„Beleg" nur wo der Kunde es sieht; RG-Nummer/EÜR intern unangetastet lassen (KEINE Logikänderung an Einnahmen).
- [ ] `tsc` + `npm test` grün. Commit: `feat(admin): Beleg-Button erst nach Kaution-Abrechnung, ausgegraut mit Begruendung`

### Task 3: Anlege-Modal — Speichern vs. Direkt freigeben (C3)

**Files:**
- Modify: `src/app/admin/anfragen/neu/NeueAnfrageForm.tsx` (zweiter Button + `mode`)
- Modify: `src/app/api/admin/anfrage/neu/route.ts` (optional `freigeben:true` → Status `Angebot_versendet` + Angebots-Mail als QUEUE-Eintrag mit Status … **ACHTUNG kein Auto-Versand heute** → Mail-Insert NICHT als `Auto_Reply`; nur Status setzen, Mail-Queue-Verhalten unverändert lassen bzw. `Pending`)

**Skills:** —

- [ ] Modal: zwei Buttons „Anfrage speichern" und „Anlegen + Angebot freigeben".
- [ ] Route: bei `freigeben` Status direkt `Angebot_versendet`. **Wichtig (Global Constraint):** keinen sendenden Mailpfad neu auslösen — Verhalten identisch zur bestehenden „Angebot freigeben"-Aktion (die die Mail regulär über die Queue schickt); nur den manuellen Anlege-Fall daran anschließen. Falls die reguläre Freigabe Auto-Versand triggert, in diesem Plan NUR die UI/Route-Struktur bauen und den Versand-Schritt hinter einem Flag lassen, das heute AUS ist. Beim Bauen prüfen und im Commit vermerken.
- [ ] `tsc` + `npm test`. Commit: `feat(admin): manuelle Anfrage direkt freigebbar (Modal-Wahl)`

### Task 4: Mailvorlagen-Reiter + Geviertstrich-Prüfer (B5/B6)

**Files:**
- Modify: `src/lib/eventverleih/mail-templates/pruefungen.ts` (`pruefeEmDash`)
- Modify: Reiter-Anzeige (Vorschau-Varianten-Überschrift) — Datei beim Bauen lokalisieren (`grep -rl "befundeFuer\|pruefeAlle\|Regelfall" src/app/admin`)

**Skills:** —

- [ ] `pruefeEmDash`: nur noch `body` prüfen (nicht `subject`). Signatur-Whitelist robust machen (Trenner-Erkennung unabhängig von exaktem Reststring, z. B. Zeile mit `Eventverleih Bergstraße` ausklammern) → keine „mal ja/mal nein"-Inkonsistenz mehr.
- [ ] Reiter: kurze Überschrift „Vorschau-Varianten (nur intern, keine Auswahl)" über den Beispiel-Labels.
- [ ] `npm test` (pruefeAlle-Tests) grün. Commit: `fix(admin): Geviertstrich-Pruefer nur im Body, Signatur robust; Vorschau-Label klargestellt`

### Task 5: Mailtexte — Zahlweg-Rangfolge + Bar-Hinweise (A1/A2)

**Files:**
- Modify: `src/lib/eventverleih/mail-templates/build/anfrage-und-member.ts`, `restzahlung-info.ts`, `kaution.ts`, `anzahlung-erinnerung.ts` (Zahlweg-Reihenfolge/Bar)
- Modify: `src/lib/eventverleih/constants.ts` (`UEBERGABE_HINWEIS`, falls Bar/Wechselgeld dort gebündelt)

**Skills:** copywriting · marketing-psychology

- [ ] Überall wo Zahlwege genannt werden: Reihenfolge Stripe (empfohlen) → PayPal → Überweisung → Bar. Komplettzahlung als empfohlener Default vor Anzahlung+Rest.
- [ ] Wo Bar vorkommt (`kaution_bar_hinweis`, ggf. Übergabe-Hinweis): Bar als letzte Option, plus die zwei Pflicht-Hinweise (Betrag passend/kein Wechselgeld; Überzahlung mit Kaution zurück).
- [ ] `check:umlaute` + `npm test` (mail-literals ggf. anpassen). Commit: `feat(mails): Zahlweg-Rangfolge Stripe zuerst, Bar zuletzt mit Wechselgeld-/Ueberzahlungs-Hinweis`

### Task 6: Mailtexte — Reminder entschärfen (A4/A5)

**Files:**
- Modify: `src/lib/eventverleih/anzahlung-reminder.ts` (Stufen 4→2: nur `post3` + `pre7`; `pre14`+`pre3` deaktivieren)
- Modify: `src/lib/eventverleih/mail-templates/build/anzahlung-erinnerung.ts` (freundlicher Nudge)
- Modify: `src/lib/eventverleih/mail-templates/build/restzahlung-info.ts` (`restzahlung_pre3` → reine Übergabe-Info, kein „fällig")
- Modify: `src/lib/eventverleih/mail-templates/registry.ts` (Einträge/Trigger anpassen)

**Skills:** copywriting

- [ ] Anzahlungs-Kaskade auf 2 Stufen; Ton „Reservierung sichern / bequem online zahlen", keine Mahnsprache.
- [ ] T-3-Restzahlung → Übergabe-Info (Termin + falls noch offen: Rest+Kaution passend zur Übergabe, kein Wechselgeld, Überzahlung mit Kaution zurück).
- [ ] `npm test` + `check:umlaute`. Commit: `feat(mails): Anzahlungs-Reminder auf 2 Stufen, T-3 wird reine Uebergabe-Info`

### Task 7: Mailtexte — Absage, Rückruf, Logistik, Body-Striche (B1/B2/B4/B5-content)

**Files:**
- Modify: `src/lib/eventverleih/mail-templates/build/angebot-entscheidung.ts` (Absage doppeltes „leider"; Rückruf → „ich melde mich telefonisch")
- Modify: `src/lib/eventverleih/mail-templates/build/termin-erinnerung.ts` + weitere Übergabe/Rückgabe-Builder (logistik-abhängig)
- Modify: alle Builder mit Em-Dash im Body (aus Task-4-Prüferlauf ermittelt)

**Skills:** copywriting

- [ ] Absage: nur ein „leider", wärmer; Grund-Vorlagen (`beispiele.ts`/Grund-Presets) ebenfalls entschärfen.
- [ ] Rückruf: Text sagt, DU rufst an (kein „rufen Sie an").
- [ ] Logistik: Abholung gebucht → „ich hole am [Datum] bei Ihnen ab"; Lieferung → „ich liefere"; sonst Selbstabholung/Rückgabe zum Treffpunkt. Auf `Preis_Abholung`/`Preis_Lieferung`/`Preis_Aufbau` verzweigen. `termin-erinnerung.ts:89` (statisches „bringen Sie zurück") ist der Kernfall.
- [ ] Body-Em-Dashes durch Komma/Punkt ersetzen (Signatur bleibt).
- [ ] `npm test` (pruefeAlle jetzt sauber) + `check:umlaute`. Commit: `feat(mails): Absage waermer, Rueckruf-Text gedreht, Uebergabe/Rueckgabe logistik-abhaengig, Body-Gedankenstriche raus`

### Task 8: Konsistenz, Review, Deploy, Verifikation

**Files:**
- Modify: `CLAUDE.md`-Kaskade Eventverleih (Bar-Policy: bar wird genannt, niedrigste Priorität) + AGB §3-Text (falls im Repo)
- Modify: `docs/cockpit-ablauf-ideen-2026-07-23.md` (Status → umgesetzt)

**Skills:** —

- [ ] Bar-Policy in `~/projects/eventverleih-bergstrasse/CLAUDE.md` + `website/CLAUDE.md` + AGB nachziehen (A2 revidiert die alte „bar nie im Kundentext"-Regel — Konsistenz herstellen).
- [ ] **Codex-Review** über die Logik-lastigen Diffs (Task 2 Gating, Task 3 Route, Task 5/6 Reminder-Logik): `codex review --uncommitted`. P1/P2 fixen, re-review.
- [ ] Volle Gate-Runde: `tsc` + `npm test` + `check:umlaute` alle grün.
- [ ] **EÜR-Guard:** verifizieren, dass keine der Änderungen die Einnahmen-Verbuchung berührt (C2 war reines Wording/Gating).
- [ ] **Einmal** `git push origin main`. Deployment abwarten, **Live verifizieren** (Prod-URL erreichbar, Admin-Seite lädt; Stichprobe an einer Buchung, dass Sortierung + Beleg-Gate greifen).
- [ ] Commit: `docs+config: Bar-Policy nachgezogen, Ideendoc auf umgesetzt`

## Self-Review
1. Spec-Coverage: A1✓T5 A2✓T5 A4✓T6 A5✓T6 B1✓T7 B2✓T7 B4✓T7 B5✓T4/T7 B6✓T4 C1✓T2 C2✓T2 C3✓T3 C4✓T1. Alle 14 abgedeckt.
2. Placeholder: keine offenen TBD.
3. Secrets: keine Credentials im Plan.
