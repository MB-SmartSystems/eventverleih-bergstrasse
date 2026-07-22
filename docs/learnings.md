# learnings.md — Eventverleih Bergstraße (Website/Dashboard)

Was sich beim Arbeiten an diesem Repo zeigt: Stolpersteine, Eigenheiten, teuer bezahlte Erkenntnisse.
Lokal neben dem Code, statt in einem zentralen Korb. Regel: `learnings-lokal`.

**Was hier hineingehört:** wiederkehrende Wahrheiten über dieses System („Feld X ist ein Formelfeld, nie
in den PATCH-Payload", „Webhook Y feuert auch bei Z").
**Was NICHT:** ein Bug („im Dashboard funktioniert X nicht") — der wird ein Task und gefixt, nicht hier
konserviert. Und nichts, was schon als Rule oder in der `CLAUDE.md` steht.

**Format je Eintrag:** `## YYYY-MM-DD — Titel`, darunter **Kontext** (was passierte), **Folge** (was es
kostete), **Lehre** (was künftig gilt).

---

## Noch nicht hier: die System-Map

Die teuersten Erkenntnisse zu diesem Projekt stehen aktuell noch in `~/.claude/rules/eventverleih-system-map.md`
(Build-Guard, Doppel-Einnahme-Falle in der EÜR, Formelfelder, `charge.refunded`-Webhook-Falle,
Nummern-Schema, Status-Lifecycle). Sie werden von dort **nicht kopiert** — das wäre eine Dublette.

Sie ziehen hierher um, sobald das rules-Entlastungs-Goal läuft (62 % der immer geladenen Rules sind
aufgabenspezifisch). Bis dahin gilt: **die Rule ist die Wahrheit**, diese Datei sammelt alles Neue ab
2026-07-17.

---

## Offen / noch nicht erprobt

- Erster echter Eintrag steht aus. Diese Datei ist bewusst mit Struktur statt mit kopiertem Inhalt
  angelegt — sie füllt sich beim nächsten Fund.
