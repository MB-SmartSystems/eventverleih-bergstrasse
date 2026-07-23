# Eventverleih Bergstraße — Projekt-Instruktionen

Nebengewerbe von Manuel. Website `eventverleih-bergstrasse.de`. Repo hier: `~/code/eventverleih-bergstrasse`,
**Vercel-Auto-Deploy bei Push auf `main`**. Marke duzt NICHT pauschal — B2C-Vermietung, freundlich-sachlich.

## Deploy / Push-Konvention
- Verifizierte Changes selbst auf `main` pushen (Build vorher verifizieren; reine Docs/Safe-Changes direkt).
  gitleaks-pre-push-Hook läuft automatisch. Frühere „Push macht Manuel selbst"-Notiz ist überholt.
- **Kundensichtbare Änderungen vor Live mit Manuel absprechen** (Copy/Design/Preise).

## ⚠️ Baserow — richtige DB (häufige Verwechslung, Manuel mehrfach frustriert)
Eventverleih lebt in **DB 267**: Buchungen **951** · Kunden **949** · Angebote **952** · Rechnungen **950** ·
Einnahmen **961** · MailQueue **969** · Artikel **957**. Kunden/Anfragen IMMER über **Kunden 949**/**Buchungen 951**
suchen (Status „Anfrage" ist ein Feld, es gibt KEINE eigene Anfragen-Tabelle). Es gibt eine FREMDE DB **276**
mit gleichnamigen Tabellen (Namensschilder/Spardosen) — NICHT Eventverleih. **Tabellen nie über den Namen matchen.**

## Zahlungs-Policy (Manuel nachdrücklich — Fakten vor Kundentexten im Code/AGB verifizieren)
- Standard = **Stripe: 30 % Anzahlung, 70 % Rest spätestens bei Übergabe, Kaution als Hold.**
  Zahlweg-Rangfolge in ALLEN Kundentexten: **Stripe (empfohlen) → PayPal → Überweisung → Bar (nie priorisiert)**;
  Komplettzahlung ist der empfohlene Default vor Anzahlung+Rest.
- **Restzahlung ist „weich": KEINE Mahn-Eskalation** (nur die freundliche T-3-Übergabe-Info, kein „fällig").
  Mahn-Mechanik NIE erneut vorschlagen. Anzahlungs-Reminder = 2 Stufen (post3 + pre7), freundlicher Nudge.
  Echtes Risiko = No-Show (Anzahlung deckt), nicht Zahlungsausfall (Übergabe = Zug um Zug).
- Barzahlung ist nachrangige Ausnahme nach Absprache: darf als **letzte Option** in Kundentexten genannt werden,
  nie empfohlen, nie gleichgestellt. Wird Bar genannt, IMMER die zwei Pflicht-Hinweise (Betrag passend/kein
  Wechselgeld; Überzahlung mit der Kaution zurück — Baustein `BAR_ZAHLUNG_HINWEIS` in `src/lib/eventverleih/constants.ts`).
  Steht so in AGB §3. (Revidiert 2026-07-23, Entscheidung A2 — ersetzt die frühere „bar nie im Kundentext"-Regel.)

## Weiteres
- **Das Dashboard sendet KEINE Kundenmail automatisch** — Kundenkontakt immer nur als Draft, Freigabe je Stück.
- Kundentexte: keine Füllsätze, Claims belegbar, keine erfundenen Zahlen.
- Gästezahl-Set-Tool ist live (Gästezahl → Set in den Warenkorb); Regeln stehen im Code (`AnlassSets`/Set-Logik).
- Tiefes Projektwissen: Memory-Archiv `project_eventverleih_bergstrasse.md` + Obsidian-Vault (bei Bedarf abrufen).
- **Stolpersteine/Erkenntnisse zu diesem Repo: `docs/learnings.md`** — vor der Arbeit lesen, Neues sofort dort eintragen (Regel `learnings-lokal`).
- **Mailvorlagen: `docs/mail-templates.md`** — wo die Texte leben, warum Bau-Funktionen rein sein müssen,
  wie `npm test` und `node scripts/mail-literals-diff.mjs main <alt> <neu>` beim Verschieben von
  Kundentexten die Zeichengleichheit beweisen. Vor jeder Arbeit an einem Mailtext lesen.
