# Eventverleih-Cockpit an den echten Ablauf anpassen — Ideensammlung

Erfasst 2026-07-23 aus Manuels Ideen-Dump. Status: **umgesetzt (2026-07-24), Deploy ausstehend.**
Alle 14 Punkte gebaut lt. Plan `docs/superpowers/plans/2026-07-23-cockpit-ablauf-anpassungen.md`
(Tasks 1-7 committet, Push/Deploy als gebündelter Schlussschritt durch die Cockpit-Session).

## A — Zahlungsstrategie & -kommunikation
- **A1 Zahlweg-Reihenfolge in ALLEN Kunden-Mails umdrehen:** Komplettzahlung primär/empfohlen zuerst,
  Anzahlung + Restzahlung als sekundäre Option („nur Anzahlung, dann Restzahlung"). Aktuell wird zuerst
  die Anzahlung vorgeschlagen. Deckt sich mit Decision `2026-07-23-zahlungsablauf-eventverleih.md`.
- **A2 „Bar"-Erwähnungen raus:** in mehreren Mails steht noch Bar. Bug. In einer früheren Session heute
  schon angefasst — verifizieren, ob gespeichert/deployt. Regel: Stripe Standard, bar nur Ausnahme.
- **A3 Richtung Stripe-Vorabzahlung:** Kunden sollen möglichst ALLES vorab über Stripe zahlen (inkl.
  Kaution als Hold) → Zahlungsdaten automatisch über die Stripe-API ins Dashboard, kein manuelles
  Eintragen. **Bar bleibt erlaubt** (Restzahlung + Kaution bei Übergabe), wird aber nicht mehr forciert.
- **A4 Mail 14 Tage vor Event bei fehlender Anzahlung** — behalten / anpassen / streichen? Hinterfragen.
- **A5 Restzahlungs-Erinnerungen (T-3-Mail „Restzahlung fällig") überdenken:** Manuel reicht Restzahlung +
  Kaution bei Übergabe. (Referenz Lee/306partyrentals: Restzahlung spätestens 7 Tage vorher — NICHT
  zwingend übernehmen.) Als Gedanke markiert.

## B — Mail-Inhalte & -Struktur
- **B1 Absage-Mail neu formulieren:** doppeltes „leider" raus, freundlicher/knapper. Aktuell:
  „Leider kann ich Ihnen kein Angebot für diesen Termin machen. Leider sind die von Ihnen gewünschten
  Artikel für diesen Termin bereits vergeben."
- **B2 „Rückruf"-Aktion überdenken:** kein Rückruf-Vorschlag an den Kunden — bei Klärungsbedarf ruft
  Manuel an. (`admin/anfragen`, Aktion `rueckruf`.)
- **B3 Unterschied „Angebot versendet"- vs. „Termin vorgemerkt"-Mail klären** — Redundanz? Zweck? → recherchieren.
- **B4 Logistik-Korrektheit in ALLEN Mails:** berücksichtigt jede Mail Lieferung/Abholung/Aufbau? Speziell:
  bei gebuchter **Abholung** (Manuel holt beim Kunden ab) darf die Mail NICHT sagen, der Kunde solle die
  Artikel zurückbringen. → Mail-Text-Audit gegen die Logistik-Optionen.
- **B5 Dashboard-Hinweise „Geviertstrich im Fließtext" etc.** — warum, sinnvoll, reduzieren? → recherchieren
  (vermutlich Anti-KI-Slop-Check im Admin).
- **B6 Optionen „Regelfall" und „ohne Kundenbereich-Link"** — warum gibt es die? → recherchieren.

## C — Ablauf/Lifecycle & Dokumente
- **C1 Aktionen an den Lifecycle koppeln:** „Beleg erstellen + Mail senden" (und ähnliche) erst freischalten,
  wenn der Schritt davor erledigt ist (Rückgabe → Kontrolle → Kaution/Überzahlung ausgezahlt → dann Beleg).
  Heute immer klickbar.
- **C2 Beleg statt Rechnung:** am Ende ein Beleg (nach dem Event, wenn alles bezahlt), keine „Rechnung" —
  Begriff/Dokumenttyp klären. Verknüpft mit C1.
- **C3 Manuell angelegte Anfrage direkt freigebbar** — kein Zwang durch den Freigeben/Ablehnen-Schritt.
- **C4 Standard-Sortierung Buchungsliste aufsteigend**, nächstes Event oben (Archiv-Ansichten ggf. absteigend).

---

## Entscheidungen aus dem Grill (2026-07-23)

- **A3 Zahlungsstrategie:** kein Stripe-Zwang. Rangfolge in den Mails: **Stripe (empfohlen) → PayPal →
  Überweisung → Bar** (bei Übergabe möglich, nie priorisiert). Online (Stripe+PayPal) existiert bereits.
- **A2 Bar in Mails:** bar wird genannt, aber als **niedrigste Priorität**, nie empfohlen. Bei Bar
  zusätzlich kommunizieren: (1) **Betrag passend, kein Wechselgeld**; (2) **Überzahlung kommt mit der
  Kaution zurück**. → **Revidiert** die bisherige Regel „bar nie im Kundentext" (CLAUDE.md/Decision
  23.07./AGB §3) — muss nachgezogen werden.
- **A1 Zahlweg-Reihenfolge:** Komplettzahlung via Stripe = empfohlener Default; Anzahlung+Rest als Option.
- **A4 Anzahlungs-Reminder:** Kaskade von 4 auf **2 Stufen** kürzen (post-3 + T-7), freundlich umtexten
  (Nudge „Reservierung sichern / online zahlen", keine Mahnsprache).
- **A5 T-3-Restzahlungs-Mail:** zu **reiner Übergabe-Info** umbauen (Termin + falls noch nicht online
  gezahlt: Rest+Kaution passend zur Übergabe, kein Wechselgeld, Überzahlung mit Kaution zurück).
- **B1 Absage-Mail:** doppeltes „leider" raus (Basis-Satz + Grund-Vorlagen), wärmer.
- **B2 Rückruf-Aktion:** bleibt, aber umtexten zu **„Ich melde mich telefonisch"** (Kunde wird nicht zum
  Anrufen aufgefordert).
- **B3 Angebot-versendet vs. Termin-vorgemerkt:** zwei verschiedene Schritte, **beide behalten**.
- **B4 Logistik in Mails:** **alle** Übergabe-/Rückgabe-Mails logistik-abhängig machen (Abholung → „ich
  hole ab", Lieferung → „ich liefere", sonst Selbstabholung/Rückgabe; Aufbau/Abbau-Zusätze). Konkreter
  Bug: `termin-erinnerung.ts:89` sagt statisch „bringen Sie zurück".
- **B5 Geviertstrich-Prüfer:** Betreff **nicht** prüfen; Body-Striche in den Vorlagen **entfernen**;
  Signatur-Strich bleibt Hausstil, **robust** whitelisten (behebt die Inkonsistenz).
- **B6 Vorschau-Labels:** kurze Klarstellung im Reiter („Vorschau-Varianten, nur intern").
- **C1 Aktions-Gating:** ablauf-fremde Aktionen **ausgegraut + Begründung**. Beleg-Button erst aktiv nach
  **Schritt 12** (Rückgabe erfasst + Schadensprüfung + Kaution abgerechnet + Miete voll bezahlt).
- **C2 Beleg statt Rechnung:** kundenseitig durchgängig **„Beleg"**, intern RG-Nummer + EÜR-Einnahme
  behalten. (Build-Guard: EÜR-Doppelzählung Stripe-Webhook vs. „bezahlt markieren" prüfen.)
- **C3 Manuelle Anfrage:** im Anlege-Modal **Wahl zwischen „Speichern" und „Direkt freigeben"**.
- **C4 Sortierung:** Arbeits-Ansichten (Alle/Anstehend/Aktiv) **aufsteigend** (nächstes Event oben),
  Archiv (Abgeschlossen/Storniert) **absteigend**.

**Umsetzung (2026-07-24):** alle 14 Punkte gebaut. Kundentexte (A1/A2/A4/A5/B1/B2/B4) neu formuliert
(Freigabe je Stück über die Cockpit-Review vor dem Push). C2/EÜR: keine Einnahmen-Logik berührt (reines
Wording/Gating). CLAUDE.md (Repo-Ebene) + AGB §3 an A2 nachgezogen; die Geschäfts-Ebene-CLAUDE.md
(Symlink in den Config-Store, außerhalb des Website-Repos) ist als Cockpit-Follow-up vermerkt.
