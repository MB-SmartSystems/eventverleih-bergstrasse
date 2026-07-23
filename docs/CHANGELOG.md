# Changelog — Eventverleih Bergstraße (Website/Dashboard)

Lesbare Ebene über dem Git-Log: was ist durch, was läuft, wo geht es weiter. Neuester Eintrag oben,
angehängt statt überschrieben. Detailverlauf steht im `git log`, Stolpersteine in `docs/learnings.md`.

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
