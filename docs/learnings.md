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

## 2026-07-23 — `decrypt=true` auf der Env-Liste liefert die verschlüsselte Hülle, nicht den Klartext

**Kontext:** Der n8n-Workflow `eve-termin-1h-reminder` lief seit dem 22.06. bei jedem Lauf in HTTP 401.
Beim Nachstellen holte ich `CRON_SECRET` über
`GET /v9/projects/{id}/env?decrypt=true` und bekam einen 1172 Zeichen langen Wert, der mit `ey` beginnt
und auf `==` endet — das sieht wie ein JWT aus, ist aber base64-kodiertes JSON mit den Keys `c`/`k`/`v`,
also Vercels **verschlüsselte Hülle**. Mit diesem Wert antwortete die Live-Route ebenfalls 401. Den
Klartext (64 Zeichen) gibt erst der Einzelabruf `GET /v9/projects/{id}/env/{envId}`.

**Folge:** Die Hülle wurde vorher schon einmal für den echten Wert gehalten und als „ungewöhnlich langes
JWT, offenbar versehentlich hineinkopiert" notiert. Auf dieser Fehlspur wäre der Fix ein Ändern des
Vercel-Secrets gewesen — also ein Eingriff in ein funktionierendes Produktions-Secret, während die
eigentliche Ursache woanders lag.

**Lehre:** Fingerprint-Vergleiche nur über den **Einzelabruf per `envId`**. Plausibilitätsprüfung vor dem
Vergleich: beginnt der Wert mit `ey`, hat er **null** Punkte und endet auf `==`, ist es die Hülle — ein
echtes JWT hat zwei Punkte. Und: gegen die Live-Route testen, bevor irgendetwas geändert wird. Der
401-Test hätte die falsche Ursachenannahme sofort widerlegt.

## 2026-07-23 — Ein leeres `CRON_SECRET` sieht im n8n-Node aus wie ein falsches

**Kontext:** Ursache des 401 war nicht ein Wert-Mismatch zwischen n8n und Vercel, sondern eine **leere**
Zeile `CRON_SECRET=` in der Master-`.env` (`/root/.env` auf dem VPS ist ein Symlink darauf). Der Node
baut `'Bearer ' + $env.CRON_SECRET` und schickte damit `Bearer ` ohne Wert. n8n wirft dabei keinen
Fehler — die Expression ist gültig, nur leer.

**Folge:** Stiller Ausfall über einen Monat. Betroffen war genau ein Workflow (Prüfung über alle 144
Workflows: nur `eve-termin-1h-reminder` nutzt `$env.CRON_SECRET`), deshalb fiel es nirgends sonst auf.

**Lehre:** Bei `Bearer`-401 aus n8n zuerst prüfen, ob die Variable **leer** ist, nicht ob sie
**abweicht** — `docker exec <container> sh -lc 'printf %s "$CRON_SECRET" | md5sum'`. Der md5 des leeren
Strings ist `d41d8cd9`; wer den sieht, sucht keinen Mismatch mehr. Container nach `.env`-Änderung mit
`docker compose up -d n8n` neu erzeugen (nur dieser Service), ein Neustart des ganzen Stacks ist nicht
nötig.

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
