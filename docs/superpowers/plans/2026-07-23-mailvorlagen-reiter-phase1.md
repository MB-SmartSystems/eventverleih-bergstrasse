# Mailvorlagen-Reiter Phase 1 — Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) oder mb-executing-plans, Task für Task. Steps nutzen Checkbox-Syntax (`- [ ]`).

**Goal:** Ein lesender Admin-Reiter zeigt alle Mailvorlagen mit ihrem echten, aus dem Code gerenderten Text, ihren Auslösern und automatischen Befunden zu Widersprüchen.

**Architecture:** Der Textaufbau jeder Mail wandert aus der Route in eine reine Funktion `(ctx) => { subject, body }` unter `src/lib/eventverleih/mail-templates/build/`. Eine Registry hängt daran Titel, Auslöser, Freigabe-Pflicht, Fundstelle und benannte Beispielfälle. Die Admin-Seite ruft dieselben Funktionen auf, die auch die echten Mails erzeugen — deshalb kann die Anzeige nicht driften.

**Tech Stack:** Next.js 14.2.21 (App Router), TypeScript, Baserow als Datenhaltung, vitest (neu) für die Gleichheitsbeweise.

**Bewusst-Minimal / Nicht-Scope:** Kein Bearbeiten, kein Speichern, kein Versenden, keine Versionierung, keine Übersetzung, keine A/B-Varianten. **Keine einzige Textänderung** — auch nicht am bekannten bar-Widerspruch in `termin_erinnerung`; der Reiter macht ihn sichtbar, korrigiert wird er in einem eigenen, freigegebenen Schritt. Keine Vorlagen aus dem Feld der Admin-Session (Phase 2).

## Global Constraints

- **Branch `eventverleih-mailvorlagen`, NICHT `main`.** Abweichung vom Standard „direkt auf main" — es laufen zwei Sessions am selben Repo. Gemerged wird erst Admin, dann dieser Branch.
- **Kein Push, kein Deploy ohne Freigabe pro Stück.** Push auf `main` löst Vercel-Production aus.
- **Nur diese Pfade werden geschrieben:** `src/lib/eventverleih/mail-templates/**`, `src/app/admin/vorlagen/**`, `src/app/admin/layout.tsx`, plus die 18 Dateien aus der Extraktionsliste. **Niemals** `src/app/admin/buchungen/**`, `src/app/api/admin/buchung/**`, `src/lib/eventverleih/rechnung.ts`, `src/app/api/admin/position/**`.
- **Kein `git add -A`.** Immer gezielte Pfade, sonst wandert fremde Arbeit in den Commit.
- **Zeichengleichheit ist die Abnahme:** Nach jeder Extraktion muss der Vergleich aus Task 1 grün sein. Ein grüner Build ist kein Beweis.
- **Echte Umlaute** in jedem Text, auch in Kommentaren und Commit-Messages. `npm run check:umlaute` läuft ohnehin als `prebuild`.
- **Code-Ebene englisch** (Bezeichner, Kommentare, Commits), **UI-Texte deutsch** (Sie-Form).
- Kontrast jeder neuen Oberfläche wird gemessen, nicht geschätzt: Fließtext ≥ 4,5:1.

---

## Die 18 Dateien der Phase 1

| Gruppe | Datei | Template-Keys |
|---|---|---|
| A | `src/app/api/admin/anfrage/[id]/action/route.ts` | `angebot_freigegeben`, `angebot_freigegeben_anmerkung`, `rueckruf_vorschlag`, `anfrage_abgelehnt` |
| A | `src/lib/eventverleih/anzahlung-reminder.ts` | `anzahlung_post3`, `anzahlung_pre14`, `anzahlung_pre7`, `anzahlung_pre3` (ein Text, vier Öffner) |
| A | `src/app/api/cron/restzahlung-reminder/route.ts` | `restzahlung_pre3` |
| A | `src/lib/eventverleih/review-reminder.ts` | `google_review` |
| B | `src/app/api/admin/angebot/[id]/erneut-senden/route.ts` | `angebot_erneut_gesendet` |
| B | `src/app/api/admin/angebot/[id]/neue-version/route.ts` | `angebot_aktualisiert` |
| B | `src/app/api/admin/angebot/[id]/nachhaken/route.ts` | `angebot_nachhaken` |
| C | `src/app/api/stripe/webhook/route.ts` | `komplettzahlung_erhalten`, `restzahlung_erhalten` |
| C | `src/lib/eventverleih/paypal-verbuchen.ts` | dieselben zwei Texte, zweite Fundstelle |
| C | `src/lib/eventverleih/zahlungsbestaetigung.ts` | `anzahlung_erhalten` |
| D | `src/lib/eventverleih/kaution-mail.ts` | `kaution_hold_link` |
| D | `src/app/api/cron/kaution-reminder/route.ts` | `kaution_bar_hinweis` |
| E | `src/lib/eventverleih/termin-reminder.ts` | `termin_erinnerung`, `rueckgabe_erinnerung` |
| E | `src/app/api/cron/termin-1h-reminder/route.ts` | `termin_1h_uebergabe`, `termin_1h_rueckgabe` |
| F | `src/app/api/contact/route.ts` | `anfrage_eingang` |
| F | `src/app/api/vertrag-akzeptieren/route.ts` | `vertrag_bestaetigung` |
| F | `src/app/api/member/buchung/[id]/storno/route.ts` | `storno_bestaetigung` |
| F | `src/app/api/member/login-link/route.ts` | `login_magic_link` |

26 Keys, 23 eigenständige Texte. **Phase 2 (nicht hier):** `termin_uebergabe_bestaetigung`, `termin_rueckgabe_bestaetigung`, `uebergabe_erfolgt`, `kaution_iban_anfordern`.

---

## Das Extraktions-Rezept (gilt für Task 2 bis 7, jedes Mal identisch)

Wer einen dieser Tasks einzeln bearbeitet, braucht nur diesen Abschnitt und seinen Task.

1. Den Textaufbau **unverändert** in die neue Datei unter `build/` verschieben, samt aller Hilfsvariablen,
   die nur dem Text dienen (`linkLine`, `memberBlock`, `sig`, `opening`, `core`, `restBlock`, `kautionBlock`).
2. Alles, was bisher aus einer Baserow-Zeile gelesen wurde, wird ein Feld des Ctx-Interfaces.
   **Die Namen der lokalen Variablen bleiben unverändert** — sonst ändern sich die `${…}`-Ausdrücke im
   Literal, und der Gleichheitsvergleich schlägt zu Recht fehl.
3. In der Ursprungsdatei die alte Konstruktion löschen, den Builder importieren, mit dem Ctx aufrufen und
   das Ergebnis wie bisher in `Subject`/`Body` schreiben.
4. Datenzugriff, `createRow`, Idempotenz-Key und Fehlerbehandlung bleiben **vollständig** in der
   Ursprungsdatei. Die Bau-Funktion liest nichts und schreibt nichts.
5. Kein Wort am Text ändern. Keine Formulierung glätten, keinen Tippfehler beheben, keinen Em-Dash
   ersetzen — auch dann nicht, wenn er falsch ist. Fehler werden in Task 9 sichtbar gemacht und danach
   einzeln freigegeben.

**Ist ein Task fertig, wenn `mail-literals-diff.mjs` grün ist?** Nur zusammen mit `tsc` und den Tests des
Tasks. Grün heißt: kein Zeichen am Kundentext verändert. Es heißt nicht, dass der Aufruf korrekt verdrahtet
ist — dafür sind die Tests da.

---

### Task 1: Fundament, Typen und der Gleichheitsbeweis

Ohne dieses Werkzeug darf keine Extraktion beginnen — es ist der einzige Grund, warum die Extraktion sicher ist.

**Files:**
- Create: `src/lib/eventverleih/mail-templates/types.ts`
- Create: `scripts/mail-literals-diff.mjs`
- Create: `vitest.config.ts`
- Modify: `package.json` (devDependency `vitest`, Scripts `test`, `check:mail-literals`)
- Create: `docs/mail-templates.md`

**Skills (am Prompt-Anfang laden):** web-stack-gotchas

**Interfaces:**
- Produces: `MailText = { subject: string; body: string }`; `TemplateBuilder<Ctx> = (ctx: Ctx) => MailText`; `TemplateEntry` (Registry-Eintrag, in Task 8 befüllt).
- Produces: `node scripts/mail-literals-diff.mjs <alte-ref> <datei…>` — vergleicht alle Template-Literale einer Datei zwischen einer Git-Ref und dem Arbeitsstand.

- [ ] **Step 1: vitest ergänzen**

```bash
cd /home/manuel/projects/eventverleih-bergstrasse/website
npm install --save-dev vitest@^2
```

- [ ] **Step 2: Scripts eintragen**

In `package.json` unter `"scripts"` ergänzen:

```json
"test": "vitest run",
"check:mail-literals": "node scripts/mail-literals-diff.mjs main"
```

- [ ] **Step 3: Typen anlegen**

`src/lib/eventverleih/mail-templates/types.ts`:

```ts
/** Result of a mail template: what the customer sees. */
export interface MailText {
  subject: string;
  body: string;
}

/** A pure builder: takes a context, returns text. Reads nothing, writes nothing. */
export type TemplateBuilder<Ctx> = (ctx: Ctx) => MailText;

/** One named example context, used for the preview in the admin view. */
export interface TemplateExample<Ctx> {
  /** Shown as the tab label, German, e.g. "Regelfall, alles offen". */
  label: string;
  ctx: Ctx;
}

export interface TemplateEntry<Ctx = unknown> {
  /** Template_Key as written into the Baserow MailQueue. */
  key: string;
  /** German title shown in the admin view. */
  title: string;
  /** When it fires, in German, e.g. "Cron, Vortag der Uebergabe". */
  trigger: string;
  /** true = goes out automatically (Auto_Reply), false = needs approval. */
  autoSend: boolean;
  /** Where the mail row is created, e.g. "src/lib/eventverleih/termin-reminder.ts:144". */
  source: string;
  build: TemplateBuilder<Ctx>;
  examples: TemplateExample<Ctx>[];
}

/** Templates that exist but are not yet covered — shown explicitly, never hidden. */
export interface UncoveredTemplate {
  key: string;
  title: string;
  reason: string;
  source: string;
}
```

- [ ] **Step 4: Literal-Vergleich schreiben**

`scripts/mail-literals-diff.mjs`. Zieht alle Template-Literale (Backtick-Zeichenketten) aus einer Datei in einer Git-Ref und aus dem Arbeitsstand und vergleicht die Mengen. Verschieben ist erlaubt, Ändern nicht.

```js
#!/usr/bin/env node
// Compares the set of template literals of given files between a git ref and the
// working tree. Extraction may MOVE a literal, never change it.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const [ref, ...files] = process.argv.slice(2);
if (!ref || files.length === 0) {
  console.error('usage: mail-literals-diff.mjs <git-ref> <file...>');
  process.exit(2);
}

/** All backtick literals, in source form, normalised only for indentation. */
function literals(source) {
  const out = [];
  const re = /`(?:\\.|\$\{(?:[^{}]|\{[^}]*\})*\}|[^`\\])*`/gs;
  let m;
  while ((m = re.exec(source)) !== null) {
    const raw = m[0];
    if (raw.length < 40) continue;          // skip short technical strings
    out.push(raw.replace(/\n[ \t]+/g, '\n'));
  }
  return out.sort();
}

let failed = false;
for (const file of files) {
  let before;
  try {
    before = execSync(`git show ${ref}:${file}`, { encoding: 'utf8' });
  } catch {
    console.log(`  neu (in ${ref} nicht vorhanden): ${file}`);
    continue;
  }
  const after = readFileSync(file, 'utf8');
  const a = literals(before);
  const b = literals(after);
  const missing = a.filter((x) => !b.includes(x));
  if (missing.length) {
    failed = true;
    console.error(`FEHLER ${file}: ${missing.length} Literal(e) verändert oder verschwunden`);
    for (const x of missing) console.error('  ---\n' + x.slice(0, 400));
  } else {
    console.log(`  ok ${file} (${a.length} Literale unverändert)`);
  }
}
process.exit(failed ? 1 : 0);
```

**Wichtig:** Wandert ein Literal aus Datei X in die neue Datei Y, wird der Vergleich mit **beiden** Dateien aufgerufen (`node scripts/mail-literals-diff.mjs main src/alt.ts src/lib/eventverleih/mail-templates/build/neu.ts`) — dann findet er es wieder. Verschwindet es ganz oder ändert sich ein Zeichen, schlägt er fehl.

- [ ] **Step 5: Werkzeug gegen eine unveränderte Datei prüfen**

Run: `node scripts/mail-literals-diff.mjs main src/lib/eventverleih/termin-reminder.ts`
Expected: `ok src/lib/eventverleih/termin-reminder.ts (N Literale unverändert)`, Exit 0.

- [ ] **Step 6: Werkzeug gegen eine absichtliche Änderung prüfen**

Ein Zeichen in einem Literal von `termin-reminder.ts` ändern, Vergleich erneut laufen lassen.
Expected: `FEHLER`, Exit 1. Änderung danach mit `git checkout -- src/lib/eventverleih/termin-reminder.ts` zurücknehmen.
**Ein Prüfwerkzeug, das nie rot war, ist nicht geprüft.**

- [ ] **Step 7: Kurzdoku schreiben**

`docs/mail-templates.md`: wo die Vorlagen liegen, dass die Bau-Funktionen rein sein müssen, dass jede neue Mail einen Registry-Eintrag braucht, und dass `ops-daten/templates/mails/` überholt ist.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts scripts/mail-literals-diff.mjs \
        src/lib/eventverleih/mail-templates/types.ts docs/mail-templates.md
git commit -m "feat(mail-templates): add types and literal equality check"
```

---

### Task 2: Gruppe A extrahieren — die vier Dateien mit vorhandenen Bau-Funktionen

Der leichteste Einstieg: hier existiert die Funktion schon, sie muss nur umziehen und rein werden.

**Files:**
- Create: `src/lib/eventverleih/mail-templates/build/angebot-entscheidung.ts`, `anzahlung-erinnerung.ts`, `restzahlung-info.ts`, `google-review.ts`
- Modify: `src/app/api/admin/anfrage/[id]/action/route.ts`, `src/lib/eventverleih/anzahlung-reminder.ts`, `src/app/api/cron/restzahlung-reminder/route.ts`, `src/lib/eventverleih/review-reminder.ts`
- Test: `src/lib/eventverleih/mail-templates/__tests__/gruppe-a.test.ts`

**Skills:** web-stack-gotchas

**Interfaces:**
- Produces: `buildAngebotEntscheidung(ctx: AngebotEntscheidungCtx): MailText`, `buildAnzahlungErinnerung(ctx: AnzahlungErinnerungCtx): MailText`, `buildRestzahlungInfo(ctx: RestzahlungInfoCtx): MailText`, `buildGoogleReview(ctx: GoogleReviewCtx): MailText`. Jeder Ctx ist ein Interface im selben Modul, exportiert.

**Vorgehen:** siehe „Das Extraktions-Rezept" weiter oben. In dieser Gruppe existiert die Bau-Funktion bereits — sie zieht nur um und wird rein.

- [ ] **Step 1: Test schreiben, der die Reinheit erzwingt**

`src/lib/eventverleih/mail-templates/__tests__/gruppe-a.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildGoogleReview } from '../build/google-review';

describe('buildGoogleReview', () => {
  it('returns subject and body without touching the outside world', () => {
    const out = buildGoogleReview({ kundeName: 'Maria Musterfrau', reviewUrl: 'https://example.test/r' });
    expect(out.subject).toBeTruthy();
    expect(out.body).toContain('Maria Musterfrau');
  });

  it('is deterministic — same input, same output', () => {
    const ctx = { kundeName: 'Maria Musterfrau', reviewUrl: 'https://example.test/r' };
    expect(buildGoogleReview(ctx)).toEqual(buildGoogleReview(ctx));
  });
});
```

- [ ] **Step 2: Test laufen lassen, er muss scheitern**

Run: `npx vitest run src/lib/eventverleih/mail-templates/__tests__/gruppe-a.test.ts`
Expected: FAIL, `Cannot find module '../build/google-review'`.

- [ ] **Step 3: Die vier Dateien nach dem Rezept extrahieren**

Reihenfolge: `review-reminder.ts` (kleinste, ein Text) → `restzahlung-reminder` → `anzahlung-reminder` → `anfrage/[id]/action`.

- [ ] **Step 4: Test laufen lassen, er muss bestehen**

Run: `npx vitest run src/lib/eventverleih/mail-templates/__tests__/gruppe-a.test.ts`
Expected: PASS.

- [ ] **Step 5: Der Gleichheitsbeweis**

```bash
node scripts/mail-literals-diff.mjs main \
  src/lib/eventverleih/review-reminder.ts src/lib/eventverleih/mail-templates/build/google-review.ts \
  src/app/api/cron/restzahlung-reminder/route.ts src/lib/eventverleih/mail-templates/build/restzahlung-info.ts \
  src/lib/eventverleih/anzahlung-reminder.ts src/lib/eventverleih/mail-templates/build/anzahlung-erinnerung.ts \
  "src/app/api/admin/anfrage/[id]/action/route.ts" src/lib/eventverleih/mail-templates/build/angebot-entscheidung.ts
```

Expected: nur `ok`-Zeilen, Exit 0. Bei `FEHLER` wird **nicht** der Vergleich angepasst, sondern die Extraktion korrigiert.

- [ ] **Step 6: Typprüfung**

Run: `node node_modules/.bin/tsc --noEmit -p tsconfig.json`
Expected: keine Ausgabe, Exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/lib/eventverleih/mail-templates/ src/lib/eventverleih/review-reminder.ts \
        src/lib/eventverleih/anzahlung-reminder.ts src/app/api/cron/restzahlung-reminder/route.ts \
        "src/app/api/admin/anfrage/[id]/action/route.ts"
git commit -m "refactor(mail-templates): extract group A builders, texts unchanged"
```

---

### Task 3: Gruppe B extrahieren — Angebots-Mails

**Files:**
- Create: `src/lib/eventverleih/mail-templates/build/angebot-versand.ts` (drei Builder in einem Modul, weil sie denselben Kontext und dieselbe Signatur teilen)
- Modify: `src/app/api/admin/angebot/[id]/erneut-senden/route.ts`, `.../neue-version/route.ts`, `.../nachhaken/route.ts`
- Test: `src/lib/eventverleih/mail-templates/__tests__/gruppe-b.test.ts`

**Skills:** web-stack-gotchas

**Interfaces:**
- Consumes: `MailText`, `TemplateBuilder` aus Task 1.
- Produces: `buildAngebotErneutGesendet(ctx: AngebotVersandCtx): MailText`, `buildAngebotAktualisiert(ctx: AngebotVersandCtx): MailText`, `buildAngebotNachhaken(ctx: AngebotVersandCtx): MailText`.

- [ ] **Step 1: Test schreiben**

```ts
import { describe, it, expect } from 'vitest';
import { buildAngebotNachhaken } from '../build/angebot-versand';

it('mentions the offer link and stays deterministic', () => {
  const ctx = { kundeName: 'Max Mustermann', angebotLink: 'https://example.test/angebot/abc' };
  const out = buildAngebotNachhaken(ctx);
  expect(out.body).toContain('https://example.test/angebot/abc');
  expect(buildAngebotNachhaken(ctx)).toEqual(out);
});
```

- [ ] **Step 2: Test laufen lassen, er muss scheitern**

Run: `npx vitest run src/lib/eventverleih/mail-templates/__tests__/gruppe-b.test.ts` → FAIL (Modul fehlt).

- [ ] **Step 3: Nach dem Rezept aus Task 2 extrahieren**

- [ ] **Step 4: Test laufen lassen** → PASS.

- [ ] **Step 5: Gleichheitsbeweis**

```bash
node scripts/mail-literals-diff.mjs main \
  "src/app/api/admin/angebot/[id]/erneut-senden/route.ts" \
  "src/app/api/admin/angebot/[id]/neue-version/route.ts" \
  "src/app/api/admin/angebot/[id]/nachhaken/route.ts" \
  src/lib/eventverleih/mail-templates/build/angebot-versand.ts
```
Expected: Exit 0.

- [ ] **Step 6: `node node_modules/.bin/tsc --noEmit -p tsconfig.json`** → Exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/lib/eventverleih/mail-templates/ "src/app/api/admin/angebot/"
git commit -m "refactor(mail-templates): extract offer mails, texts unchanged"
```

---

### Task 4: Gruppe C extrahieren — Zahlungsbestätigungen, inklusive Dublette

Hier steckt ein echter Fund: `komplettzahlung_erhalten` und `restzahlung_erhalten` existieren **zweimal wortgleich**, in `stripe/webhook/route.ts` und in `paypal-verbuchen.ts`. Nach der Extraktion gibt es je einen Text, den beide aufrufen. Das ist keine ungefragte Verbesserung, sondern die Voraussetzung dafür, dass der Reiter eine Vorlage zeigt und nicht zwei, die auseinanderlaufen können.

**Files:**
- Create: `src/lib/eventverleih/mail-templates/build/zahlung-erhalten.ts`
- Modify: `src/app/api/stripe/webhook/route.ts`, `src/lib/eventverleih/paypal-verbuchen.ts`, `src/lib/eventverleih/zahlungsbestaetigung.ts`
- Test: `src/lib/eventverleih/mail-templates/__tests__/gruppe-c.test.ts`

**Skills:** web-stack-gotchas · stripe

**Interfaces:**
- Produces: `buildKomplettzahlungErhalten(ctx: ZahlungCtx): MailText`, `buildRestzahlungErhalten(ctx: ZahlungCtx): MailText`, `buildAnzahlungErhalten(ctx: AnzahlungCtx): MailText`.

- [ ] **Step 1: Test schreiben, der die Dublette festnagelt**

```ts
import { describe, it, expect } from 'vitest';
import { buildKomplettzahlungErhalten } from '../build/zahlung-erhalten';

it('produces one single text for both payment paths', () => {
  const ctx = { kundeName: 'Max Mustermann', buchungId: 32 };
  const viaStripe = buildKomplettzahlungErhalten(ctx);
  const viaPaypal = buildKomplettzahlungErhalten(ctx);
  expect(viaStripe).toEqual(viaPaypal);
  expect(viaStripe.subject).toContain('Zahlung erhalten');
});
```

- [ ] **Step 2: Test laufen lassen** → FAIL.

- [ ] **Step 3: Vor der Extraktion die Wortgleichheit belegen**

```bash
git show main:src/app/api/stripe/webhook/route.ts   | sed -n '140,170p' > /tmp/a.txt
git show main:src/lib/eventverleih/paypal-verbuchen.ts | sed -n '120,145p' > /tmp/b.txt
diff /tmp/a.txt /tmp/b.txt
```

Sind die Texte **nicht** wortgleich, wird nicht zusammengelegt: dann bekommt jede Fundstelle ihren eigenen Builder, und der Unterschied wird gemeldet. Zusammenlegen von Texten, die nur ähnlich aussehen, wäre eine verdeckte Textänderung.

- [ ] **Step 4: Extrahieren, beide Fundstellen rufen denselben Builder**

- [ ] **Step 5: Test laufen lassen** → PASS.

- [ ] **Step 6: Gleichheitsbeweis**

```bash
node scripts/mail-literals-diff.mjs main \
  src/app/api/stripe/webhook/route.ts src/lib/eventverleih/paypal-verbuchen.ts \
  src/lib/eventverleih/zahlungsbestaetigung.ts \
  src/lib/eventverleih/mail-templates/build/zahlung-erhalten.ts
```
Expected: Exit 0.

- [ ] **Step 7: `node node_modules/.bin/tsc --noEmit -p tsconfig.json`** → Exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/lib/eventverleih/mail-templates/ src/app/api/stripe/webhook/route.ts \
        src/lib/eventverleih/paypal-verbuchen.ts src/lib/eventverleih/zahlungsbestaetigung.ts
git commit -m "refactor(mail-templates): extract payment mails, deduplicate stripe/paypal text"
```

---

### Task 5: Gruppe D extrahieren — Kautions-Mails

**Files:**
- Create: `src/lib/eventverleih/mail-templates/build/kaution.ts`
- Modify: `src/lib/eventverleih/kaution-mail.ts`, `src/app/api/cron/kaution-reminder/route.ts`
- Test: `src/lib/eventverleih/mail-templates/__tests__/gruppe-d.test.ts`

**Skills:** web-stack-gotchas

**Interfaces:**
- Produces: `buildKautionHoldLink(ctx: KautionHoldCtx): MailText`, `buildKautionBarHinweis(ctx: KautionBarCtx): MailText`.

**Achtung:** `kaution_bar_hinweis` widerspricht der Zahlungs-Policy. **In diesem Task wird der Text nicht angefasst.** Er wird extrahiert, wie er ist, und in Task 9 vom Prüfer angeschlagen. Die Korrektur ist eine eigene, freizugebende Änderung.

- [ ] **Step 1: Test schreiben**

```ts
import { describe, it, expect } from 'vitest';
import { buildKautionHoldLink } from '../build/kaution';

it('states that nothing is charged', () => {
  const out = buildKautionHoldLink({
    kundeName: 'Max Mustermann', amount: 30, kautionUrl: 'https://example.test/k', meinBereichUrl: null,
  });
  expect(out.body).toContain('30,00');
  expect(out.body).toContain('NICHT');
});
```

- [ ] **Step 2: Test laufen lassen** → FAIL.
- [ ] **Step 3: Nach dem Rezept extrahieren.**
- [ ] **Step 4: Test laufen lassen** → PASS.

- [ ] **Step 5: Gleichheitsbeweis**

```bash
node scripts/mail-literals-diff.mjs main \
  src/lib/eventverleih/kaution-mail.ts src/app/api/cron/kaution-reminder/route.ts \
  src/lib/eventverleih/mail-templates/build/kaution.ts
```
Expected: Exit 0.

- [ ] **Step 6: `node node_modules/.bin/tsc --noEmit -p tsconfig.json`** → Exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/lib/eventverleih/mail-templates/ src/lib/eventverleih/kaution-mail.ts \
        src/app/api/cron/kaution-reminder/route.ts
git commit -m "refactor(mail-templates): extract deposit mails, texts unchanged"
```

---

### Task 6: Gruppe E extrahieren — Termin- und Kurz-Erinnerungen

Die inhaltsreichste Gruppe: hier sitzen die Bedingungsblöcke, wegen derer es überhaupt mehrere Beispielfälle braucht.

**Files:**
- Create: `src/lib/eventverleih/mail-templates/build/termin-erinnerung.ts`
- Modify: `src/lib/eventverleih/termin-reminder.ts`, `src/app/api/cron/termin-1h-reminder/route.ts`
- Test: `src/lib/eventverleih/mail-templates/__tests__/gruppe-e.test.ts`

**Skills:** web-stack-gotchas

**Interfaces:**
- Produces: `buildTerminErinnerung(ctx: TerminErinnerungCtx): MailText`, `buildRueckgabeErinnerung(ctx: RueckgabeErinnerungCtx): MailText`, `buildTermin1h(ctx: Termin1hCtx): MailText`.
- `TerminErinnerungCtx` enthält u. a. `kundeName`, `terminText`, `ort`, `restSoll`, `restBezahlt`, `restLink`, `kautionSoll`, `kautionHinterlegt` — genau die Felder, aus denen die Blöcke heute berechnet werden.

- [ ] **Step 1: Test schreiben, der beide Zweige festhält**

```ts
import { describe, it, expect } from 'vitest';
import { buildTerminErinnerung } from '../build/termin-erinnerung';

const basis = {
  kundeName: 'Max Mustermann',
  terminText: 'Donnerstag, 23.07.2026 um 15:00 Uhr',
  ort: 'Schlesierstraße 19a, 64665 Alsbach-Hähnlein',
  restSoll: 52.5, restBezahlt: null, restLink: 'https://example.test/rest',
  kautionSoll: 30, kautionHinterlegt: null,
};

it('names the open amounts when nothing is paid yet', () => {
  const out = buildTerminErinnerung(basis);
  expect(out.body).toContain('52,50');
  expect(out.body).toContain('30,00');
});

it('leaves both blocks out once everything is paid', () => {
  const out = buildTerminErinnerung({
    ...basis, restBezahlt: '2026-07-20', kautionHinterlegt: '2026-07-20',
  });
  expect(out.body).not.toContain('52,50');
  expect(out.body).not.toContain('30,00');
});
```

- [ ] **Step 2: Test laufen lassen** → FAIL.
- [ ] **Step 3: Extrahieren. Die Blockberechnung (`restBlock`, `kautionBlock`) zieht mit in die Bau-Funktion, die Statusabfrage der Buchung bleibt in der Route.**
- [ ] **Step 4: Test laufen lassen** → PASS, beide Fälle.

- [ ] **Step 5: Gleichheitsbeweis**

```bash
node scripts/mail-literals-diff.mjs main \
  src/lib/eventverleih/termin-reminder.ts src/app/api/cron/termin-1h-reminder/route.ts \
  src/lib/eventverleih/mail-templates/build/termin-erinnerung.ts
```
Expected: Exit 0.

- [ ] **Step 6: `node node_modules/.bin/tsc --noEmit -p tsconfig.json`** → Exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/lib/eventverleih/mail-templates/ src/lib/eventverleih/termin-reminder.ts \
        src/app/api/cron/termin-1h-reminder/route.ts
git commit -m "refactor(mail-templates): extract appointment reminders, texts unchanged"
```

---

### Task 7: Gruppe F extrahieren — Anfrage, Vertrag, Kundenbereich

**Files:**
- Create: `src/lib/eventverleih/mail-templates/build/anfrage-und-member.ts`
- Modify: `src/app/api/contact/route.ts`, `src/app/api/vertrag-akzeptieren/route.ts`, `src/app/api/member/buchung/[id]/storno/route.ts`, `src/app/api/member/login-link/route.ts`
- Test: `src/lib/eventverleih/mail-templates/__tests__/gruppe-f.test.ts`

**Skills:** web-stack-gotchas

**Interfaces:**
- Produces: `buildAnfrageEingang(ctx): MailText`, `buildVertragBestaetigung(ctx): MailText`, `buildStornoBestaetigung(ctx): MailText`, `buildLoginMagicLink(ctx): MailText`.

- [ ] **Step 1: Test schreiben**

```ts
import { describe, it, expect } from 'vitest';
import { buildLoginMagicLink } from '../build/anfrage-und-member';

it('contains exactly the given login link and nothing invented', () => {
  const out = buildLoginMagicLink({ kundeName: 'Max Mustermann', loginUrl: 'https://example.test/login/xyz' });
  expect(out.body).toContain('https://example.test/login/xyz');
  expect(out.body).not.toContain('undefined');
});
```

- [ ] **Step 2: Test laufen lassen** → FAIL.
- [ ] **Step 3: Nach dem Rezept extrahieren.**
- [ ] **Step 4: Test laufen lassen** → PASS.

- [ ] **Step 5: Gleichheitsbeweis**

```bash
node scripts/mail-literals-diff.mjs main \
  src/app/api/contact/route.ts src/app/api/vertrag-akzeptieren/route.ts \
  "src/app/api/member/buchung/[id]/storno/route.ts" src/app/api/member/login-link/route.ts \
  src/lib/eventverleih/mail-templates/build/anfrage-und-member.ts
```
Expected: Exit 0.

- [ ] **Step 6: `node node_modules/.bin/tsc --noEmit -p tsconfig.json`** → Exit 0.

- [ ] **Step 7: Alle Extraktions-Tests zusammen**

Run: `npx vitest run`
Expected: alle Suites grün.

- [ ] **Step 8: Commit**

```bash
git add src/lib/eventverleih/mail-templates/ src/app/api/contact/route.ts \
        src/app/api/vertrag-akzeptieren/route.ts "src/app/api/member/"
git commit -m "refactor(mail-templates): extract request, contract and member mails"
```

---

### Task 8: Registry und Beispielfälle

**Files:**
- Create: `src/lib/eventverleih/mail-templates/beispiele.ts`, `src/lib/eventverleih/mail-templates/registry.ts`
- Test: `src/lib/eventverleih/mail-templates/__tests__/registry.test.ts`

**Skills:** web-stack-gotchas

**Interfaces:**
- Consumes: alle `build*`-Funktionen aus Task 2 bis 7, `TemplateEntry`/`UncoveredTemplate` aus Task 1.
- Produces: `TEMPLATES: TemplateEntry[]` (23 Einträge), `UNCOVERED: UncoveredTemplate[]` (5 Einträge: die vier aus Phase 2 plus die Rechnungs-Mail aus n8n).

- [ ] **Step 1: Test schreiben, der Vollständigkeit erzwingt**

```ts
import { describe, it, expect } from 'vitest';
import { TEMPLATES, UNCOVERED } from '../registry';

it('covers 23 templates and declares every gap', () => {
  expect(TEMPLATES).toHaveLength(23);
  expect(UNCOVERED.map((u) => u.key)).toEqual([
    'termin_uebergabe_bestaetigung',
    'termin_rueckgabe_bestaetigung',
    'uebergabe_erfolgt',
    'kaution_iban_anfordern',
    'rechnung_beleg',
  ]);
});

it('gives every template at least one example that renders', () => {
  for (const t of TEMPLATES) {
    expect(t.examples.length, `${t.key} braucht Beispiele`).toBeGreaterThan(0);
    for (const ex of t.examples) {
      const out = t.build(ex.ctx as never);
      expect(out.subject.length, `${t.key}/${ex.label}: leerer Betreff`).toBeGreaterThan(0);
      expect(out.body).not.toContain('undefined');
      expect(out.body).not.toMatch(/\{\{|\}\}/);
    }
  }
});

it('uses unique keys', () => {
  const keys = TEMPLATES.map((t) => t.key);
  expect(new Set(keys).size).toBe(keys.length);
});
```

- [ ] **Step 2: Test laufen lassen** → FAIL (Module fehlen).

- [ ] **Step 3: Beispielfälle anlegen**

`beispiele.ts` enthält benannte Kontexte aus echten Buchungsformen, keine Fantasiewerte. Mindestens für jede Vorlage mit Bedingungsblock zwei Fälle. Beispiel:

```ts
export const TERMIN_BEISPIELE = [
  {
    label: 'Regelfall — Restzahlung und Kaution offen',
    ctx: {
      kundeName: 'Max Mustermann',
      terminText: 'Donnerstag, 23.07.2026 um 15:00 Uhr',
      ort: 'Schlesierstraße 19a, 64665 Alsbach-Hähnlein',
      restSoll: 52.5, restBezahlt: null, restLink: 'https://buy.stripe.com/beispiel',
      kautionSoll: 30, kautionHinterlegt: null,
    },
  },
  {
    label: 'Alles bezahlt — reine Terminmail',
    ctx: {
      kundeName: 'Max Mustermann',
      terminText: 'Donnerstag, 23.07.2026 um 15:00 Uhr',
      ort: 'Schlesierstraße 19a, 64665 Alsbach-Hähnlein',
      restSoll: 52.5, restBezahlt: '2026-07-20', restLink: null,
      kautionSoll: 30, kautionHinterlegt: '2026-07-20',
    },
  },
];
```

- [ ] **Step 4: Registry anlegen**

Ein Eintrag je Vorlage mit `key`, `title`, `trigger`, `autoSend`, `source` (Pfad **mit Zeilennummer** der `createRow`-Stelle), `build`, `examples`.

- [ ] **Step 5: Test laufen lassen** → PASS, alle drei Fälle.

- [ ] **Step 6: `node node_modules/.bin/tsc --noEmit -p tsconfig.json`** → Exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/lib/eventverleih/mail-templates/
git commit -m "feat(mail-templates): add registry with named example contexts"
```

---

### Task 9: Die Prüfungen

Der eigentliche Zweck des Reiters. Eine Prüfung, die die bereits bekannten Fehler nicht findet, prüft nichts.

**Files:**
- Create: `src/lib/eventverleih/mail-templates/pruefungen.ts`
- Test: `src/lib/eventverleih/mail-templates/__tests__/pruefungen.test.ts`

**Skills:** anti-ki-slop-reviewer

**Interfaces:**
- Consumes: `MailText`, `TEMPLATES`.
- Produces: `type Befund = { regel: string; schwere: 'fehler' | 'hinweis'; stelle: string }`; `pruefeText(text: MailText): Befund[]`; `pruefeAlle(): Array<{ key: string; label: string; befunde: Befund[] }>`.

- [ ] **Step 1: Test schreiben, der die bekannten Funde erzwingt**

```ts
import { describe, it, expect } from 'vitest';
import { pruefeText, pruefeAlle } from '../pruefungen';

it('flags cash wording, because Stripe is the standard', () => {
  const befunde = pruefeText({
    subject: 'Erinnerung',
    body: 'Bitte denken Sie an die Kaution (30,00 EUR) — diese wird bar bei der Übergabe erhoben.',
  });
  expect(befunde.map((b) => b.regel)).toContain('bargeld');
});

it('flags em dashes as an AI marker', () => {
  const befunde = pruefeText({ subject: 'Zahlung erhalten — Ihre Buchung ist bezahlt', body: 'Hallo' });
  expect(befunde.map((b) => b.regel)).toContain('em-dash');
});

it('finds the two defects we already know about in the real registry', () => {
  const alle = pruefeAlle();
  const terminBefunde = alle.filter((a) => a.key === 'termin_erinnerung').flatMap((a) => a.befunde);
  expect(terminBefunde.map((b) => b.regel)).toContain('bargeld');
});
```

- [ ] **Step 2: Test laufen lassen** → FAIL.

- [ ] **Step 3: Prüfungen umsetzen**

Regeln: `bargeld` (Wortstamm „bar" im Umfeld von Kaution/Zahlung/Übergabe, mit Wortgrenzen, damit „Bargeldloses" oder „bares" nicht falsch anschlägt), `em-dash` (`—` in Betreff oder Text), `signatur-fehlt` (kein „Eventverleih Bergstraße" im Text), `platzhalter-rest` (`{{`, `}}`, `undefined`, `NaN`), `leerzeilen` (drei oder mehr Leerzeilen in Folge).

- [ ] **Step 4: Test laufen lassen** → PASS. **Schlägt der dritte Fall nicht an, ist die Regel zu eng — nicht der Test zu streng.**

- [ ] **Step 5: Vollständigen Befundstand festhalten**

Run: `npx vitest run` und die Ausgabe von `pruefeAlle()` einmal vollständig ansehen.
Der bekannte bar-Text und die Em-Dash-Betreffzeilen **müssen** in der Liste stehen. Ergebnis wird im Bericht an Manuel genannt, **nicht** korrigiert.

- [ ] **Step 6: Commit**

```bash
git add src/lib/eventverleih/mail-templates/
git commit -m "feat(mail-templates): add contradiction and AI-marker checks"
```

---

### Task 10: Der Reiter

**Files:**
- Create: `src/app/admin/vorlagen/page.tsx`
- Modify: `src/app/admin/layout.tsx` (nur der `NAV`-Eintrag, Zeile 9 bis 19)

**Skills:** frontend-design · kontrast-lesbarkeit

**Interfaces:**
- Consumes: `TEMPLATES`, `UNCOVERED`, `pruefeAlle` aus Task 8 und 9.
- Produces: Route `/admin/vorlagen`.

- [ ] **Step 1: Seite bauen**

Serverkomponente, kein Datenzugriff nötig — die Registry ist statisch. Liste aller Vorlagen; je Vorlage Titel, Key, Auslöser, ob Freigabe nötig ist, Fundstelle, umschaltbare Beispielfälle, Betreff und Text in Monospace, sowie die Befunde direkt an der Vorlage. Am Ende ein eigener Abschnitt **„Noch nicht erfasst"** mit `UNCOVERED` samt Grund und Pfad.

- [ ] **Step 2: Navigationseintrag ergänzen**

In `src/app/admin/layout.tsx` im `NAV`-Array, nach `kategorien`:

```tsx
{ href: '/admin/vorlagen', label: 'E-Mail-Vorlagen', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
```

- [ ] **Step 3: Bauen**

Run: `npm run build`
Expected: Exit 0, und das `prebuild`-Umlaut-Gate läuft grün mit.

- [ ] **Step 4: Die Seite ansehen, nicht nur bauen**

`npm run dev`, `/admin/vorlagen` im Browser öffnen. Prüfen: erscheinen 23 Vorlagen, schalten die Beispielfälle wirklich um, steht der bar-Befund sichtbar an `termin_erinnerung`, ist der Abschnitt „Noch nicht erfasst" mit fünf Einträgen da.

- [ ] **Step 5: Kontrast messen**

Berechnete Farben über `getComputedStyle` auslesen und Verhältnis rechnen. Fließtext ≥ 4,5:1, Befund-Markierungen ≥ 4,5:1. Gemessene Zahlen im Bericht nennen, nicht „sieht gut aus".

- [ ] **Step 6: Fremdmodell-Review**

```bash
cd /home/manuel/projects/eventverleih-bergstrasse/website
codex review --uncommitted --title "Mailvorlagen-Reiter Phase 1" < /dev/null 2>&1 | tee /tmp/codex-mailvorlagen.log
```
P1 und P2 sofort beheben, danach erneut reviewen, bis sauber.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/vorlagen/ src/app/admin/layout.tsx
git commit -m "feat(admin): add read-only mail template overview"
```

- [ ] **Step 8: Abschluss, ohne Push**

`git log --oneline main..HEAD` zeigt die Task-Commits. **Kein Push, kein Deploy** — der Branch wartet auf den Merge der Admin-Session und auf Manuels Freigabe.

---

## Was danach offen bleibt

- **Phase 2:** die vier Vorlagen aus `src/app/api/admin/buchung/**`, nach dem Merge der Admin-Session.
- **Zur Entscheidung vorlegen:** der bar-Text in `termin_erinnerung` und die Em-Dashes in den Betreffzeilen. Beides ist in diesem Plan bewusst nur sichtbar gemacht, nicht geändert.
