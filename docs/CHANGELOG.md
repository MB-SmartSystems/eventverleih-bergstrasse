# Changelog — Eventverleih Bergstraße (Website/Dashboard)

Lesbare Ebene über dem Git-Log: was ist durch, was läuft, wo geht es weiter. Neuester Eintrag oben,
angehängt statt überschrieben. Detailverlauf steht im `git log`, Stolpersteine in `docs/learnings.md`.

## 2026-07-24 (Cockpit-Ablauf-Anpassungen — 14 Grill-Punkte, live)
- **Fertig:** 14 gegrillte Punkte gebaut, reviewt und deployt (`1c05b4f`…`57f48a3`, live verifiziert an der
  AGB-Seite). Buchungsliste sortiert Arbeits-Ansichten aufsteigend (nächstes Event oben); Beleg-Button erst
  nach Rückgabe+Miete+Kaution-Abrechnung (ausgegraut mit Begründung); Anlege-Modal „Speichern" vs. „Direkt
  freigeben"; Überzahlung ab Erfassung sichtbar + ganze Buchungszeile klickbar. Mailtexte: Zahlweg-Rangfolge
  Stripe→PayPal→Überweisung→Bar (Komplett zuerst), Bar-Pflichthinweise (kein Wechselgeld / Überzahlung mit
  Kaution zurück), Anzahlungs-Reminder 4→2 Stufen, T-3 wird reine Übergabe-Info, Absage wärmer, Rückruf
  gedreht („ich melde mich"), Übergabe/Rückgabe logistik-abhängig (Abholung ≠ „zurückbringen"),
  Geviertstrich-Prüfer body-only + Signatur robust. AGB §3 + CLAUDE.md-Kaskade an die Bar-Policy (A2)
  nachgezogen. Kein Mailversand ausgelöst.
- **Läuft noch:** Stripe-Vorabzahlung als „festes Design" + Auto-Import (Manuel vertagt) — WIP
  `eventverleih-stripe-vorab-import`. Bestehend: Stripe/PayPal-Webhooks importieren Zahlungen schon automatisch.
- **Nächster Schritt:** Codex-Endverdikt nachholen (Quota war leer); `AUTO_MAIL_BEI_MANUELLER_FREIGABE` auf
  `true`, wenn die Direkt-Freigabe auch die Angebotsmail schicken soll; Stripe-Vorab-Scope grillen.

## 2026-07-23 (Session zahlung-aufteilen)
- **Fertig:** Zahlungs-/Text-Paket auf Branch `zahlung-aufteilen` (6 neue Commits, lokal, `a6696c7`…`d398262`).
  Storno-Mail: eigener Satz bei 100 % Gebühr (Erstattung = nur Überzahlung), Erstattungsweg nach Zahlungsart
  (Karte/PayPal = Rückbuchung, bar/Überweisung = Bitte um Bankverbindung), abgeleitet aus `erstattungsweg()`.
  `verteileBetrag`: aktive Kartenreservierung (`kautionReserviert`) gilt als gedeckte Kaution. Fehlende
  Kaution bei übergebener Ware wird rot statt gelb ausgewiesen (Detail, Tagesliste, Buchungsliste; 6,80:1).
  Neues Feld `Mehrzahl` in Artikel-Tabelle 957 (id 11458) + `artikel-label.ts`, Rückfall auf die Bezeichnung
  wenn leer — angewendet nur in Fließtext-Mails, nicht in Angebot/Vertrag/Beleg. Umlaut-Gate: `Stornogebühr`
  mit ß, Satzende-Heuristik ergänzt (fand direkt eine zweite Live-Stelle). Alles grün: tsc, 147 Tests,
  Umlaut-Gate, Codex ohne Befund.
- **Live (2026-07-23 20:07):** `zahlung-aufteilen` per Fast-Forward nach `main` (Cockpit), Prod-Deployment
  `765o5hrfi` READY, Domain 200. Danach ein Anzeige-Nachtrag: `KautionErstattenPanel` zeigte nur die Kaution,
  nicht die Überzahlung — Manuel sah am Handy die 17,50 € nicht. Reine Anzeige (page.tsx reicht
  `Ueberzahlung_Eur` durch, Panel zeigt bei >0 „Zu viel gezahlt" + „Auszahlung gesamt", bei 0 unverändert),
  Commit `4969e0c`, Prod-Deployment `dpl_3ENGCqLxv2tZg4p77nvKU9hiFC4Q` READY, `eventverleih-bergstrasse.de`
  HTTP 200. tsc/147 Tests/Umlaut-Gate/Codex je grün.
- **Nächster Schritt:** Einzig offen — Manuels eigene Sichtprüfung im eingeloggten Live-Admin, dass Buchung 32
  die Auszahlung 47,50 € zeigt (Produktions-Passwort nur bei ihm, für morgen hinterlegt). Danach separat
  Plan Teil 2 (`plan-zahlungsablauf-teil2.md`): eine Bezahlseite/QR, PayPal-Links für Miete,
  Kautions-Erinnerung (rechnet ab Eventbeginn statt 5 Tage vor Rückgabe; sagt noch „bar mitbringen").

## 2026-07-23
- **Fertig:** Buchungsdetail — Entfernen-Kreuz direkt in der Positionszeile (separater Entfernen-Block
  und `EntfernenPanel.tsx` entfallen), Checklisten-Punkt „Rechnung erstellt + Mail raus" hängt jetzt an
  der Existenz der Rechnung, Statusübergang `Zurueckgegeben → Abgerechnet` beim Erstellen einer bereits
  bezahlten Rechnung (mit Guard für offene Kaution). Beide Entfernen-Routen sperren mit 409, sobald eine
  Rechnung existiert; Positions-Route leitet die Buchung aus `Position.Buchung_Link` ab statt aus dem
  Request-Body. Audit-Log für entfernte Positionen. Neuer Versand-Marker `Beleg_Mail_am` (Rechnungen 950):
  die Belegmail geht genau einmal raus, der Knopf meldet den Mail-Status statt pauschal Erfolg.
- **Läuft noch:** Branch `admin-bestellliste` (12 Commits, GitHub `e20b60f`) — **nicht** nach `main`
  gemergt, der Merge ist der Live-Gang.
- **Nächster Schritt:** Merge nach `main` nach Manuels Freigabe. Bei der nächsten echten Rechnung den
  Prüfauftrag aus `docs/superpowers/2026-07-23-handoff-admin-bestellliste.md` abarbeiten — Status-Automatik
  und Versand-Marker sind reviewed, aber bewusst nicht live getestet.
