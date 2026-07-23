#!/usr/bin/env node
/**
 * Beweist, dass beim Herausziehen der Mailtexte kein Zeichen verändert wurde.
 *
 * Vergleicht die Menge der Template-Literale (Backtick-Zeichenketten) zwischen einer
 * Git-Ref und dem Arbeitsstand. Ein Literal darf in eine andere Datei WANDERN, aber
 * sich nicht ÄNDERN. Damit ein gewandertes Literal wiedergefunden wird, übergibt man
 * alte und neue Datei im selben Aufruf.
 *
 * Aufruf:
 *   node scripts/mail-literals-diff.mjs main src/alt.ts src/lib/.../neu.ts
 *
 * Exit 0 = jedes Literal aus der Ref ist unverändert wiedergefunden worden.
 * Exit 1 = mindestens ein Literal fehlt oder wurde verändert.
 */
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Mindestlänge, ab der ein Literal als Textbaustein gilt und nicht als technische Zeichenkette. */
const MIN_LEN = 40;

/**
 * Alle Backtick-Literale einer Quelldatei, in Quellform.
 * Einzige Normalisierung: führende Einrückung nach einem Zeilenumbruch, damit ein
 * Literal beim Umzug in eine Funktion anders eingerückt werden darf.
 */
/**
 * Alle Backtick-Literale einer Quelldatei.
 *
 * `minLen` steuert NUR, was als schützenswerter Textbaustein GILT — es wird auf die
 * Vorher-Seite angewendet. Die Nachher-Seite wird ungefiltert eingesammelt (minLen 0),
 * sonst verschwindet ein Literal aus dem Suchraum, nur weil es beim Umzug kürzer
 * geworden ist (`${kunde.Vorname}` wird `${vorname}`) — und der Vergleich meldet
 * einen Textverlust, den es nicht gibt.
 */
export function literals(source, minLen = MIN_LEN) {
  const out = [];
  const re = /`(?:\\.|\$\{(?:[^{}]|\{[^}]*\})*\}|[^`\\])*`/gs;
  let m;
  while ((m = re.exec(source)) !== null) {
    const raw = m[0];
    if (raw.length < minLen) continue;
    out.push(raw.replace(/\n[ \t]+/g, '\n'));
  }
  return out;
}

/**
 * Das Textgerüst eines Literals: die festen Zeichen, die der Kunde liest.
 * Jede Einsetzung wird auf `${}` reduziert.
 *
 * Warum das die richtige Prüfgröße ist: Zieht ein Text in eine Bau-Funktion um,
 * heißt die eingesetzte Variable dort oft anders (`${body.anmerkung.trim()}` wird
 * `${anmerkung}`). Am gelesenen Text ändert das nichts. Ein verändertes WORT dagegen
 * verändert das Gerüst sofort.
 *
 * Was diese Prüfung NICHT leistet: Sie merkt nicht, wenn eine falsche Variable
 * eingesetzt wird (Kaution statt Restzahlung). Dafür sind die Tests da — beide
 * zusammen, nicht eines statt des anderen.
 */
export function geruest(literal) {
  return literal.replace(/\$\{(?:[^{}]|\{[^}]*\})*\}/g, '${}');
}

/** Die Einsetzungen eines Literals, zur Anzeige veränderter Ausdrücke. */
export function ausdruecke(literal) {
  return literal.match(/\$\{(?:[^{}]|\{[^}]*\})*\}/g) || [];
}

function fromRef(ref, file) {
  try {
    return execSync(`git show ${ref}:${file}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

/**
 * Vergleicht die Literale einer Ref gegen den Arbeitsstand.
 * @returns {{ gesamt: number, fehlend: Array<{file: string, text: string}> }}
 */
export function vergleiche(ref, files) {
  const before = [];
  const after = [];
  for (const file of files) {
    const alt = fromRef(ref, file);
    if (alt !== null) before.push(...literals(alt).map((text) => ({ file, text })));
    if (existsSync(file)) after.push(...literals(readFileSync(file, 'utf8'), 0));
  }

  const nachherGeruest = after.map(geruest);
  const fehlend = before.filter((b) => !nachherGeruest.includes(geruest(b.text)));

  // Gleiches Gerüst, andere Einsetzung: kein Textfehler, aber sichtbar machen.
  const umbenannt = [];
  for (const b of before) {
    if (after.includes(b.text)) continue;
    const treffer = after.find((a) => geruest(a) === geruest(b.text));
    if (treffer) umbenannt.push({ file: b.file, vorher: ausdruecke(b.text), nachher: ausdruecke(treffer) });
  }

  return { gesamt: before.length, fehlend, umbenannt };
}

/**
 * Ohne Dateiliste: alle Dateien, die Mailtexte erzeugen — im Arbeitsstand UND in der
 * Ref, damit auch die gefunden werden, aus denen ein Text gerade herausgezogen wurde.
 * Dadurch ist `npm run check:mail-literals` ohne Argumente ein vollständiges Gate,
 * statt einer Fehlermeldung.
 */
function alleMailDateien(ref) {
  const menge = new Set();
  const sammle = (cmd) => {
    try {
      const out = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      for (const zeile of out.split('\n')) if (zeile.trim()) menge.add(zeile.trim());
    } catch {
      /* kein Treffer ist kein Fehler */
    }
  };
  sammle('git grep -l "Template_Key" -- src');
  sammle(`git grep -l "Template_Key" ${ref} -- src`);
  sammle('git ls-files src/lib/eventverleih/mail-templates/build');
  // Treffer aus der Ref kommen als "<ref>:<pfad>" zurück
  return [...menge].map((p) => (p.startsWith(`${ref}:`) ? p.slice(ref.length + 1) : p));
}

function main() {
  const [ref, ...argFiles] = process.argv.slice(2);
  if (!ref) {
    console.error('Aufruf: mail-literals-diff.mjs <git-ref> [datei...]');
    console.error('Ohne Dateiliste werden alle Mailtext-Dateien geprüft.');
    process.exit(2);
  }
  const files = argFiles.length > 0 ? argFiles : alleMailDateien(ref);
  if (files.length === 0) {
    console.error('FEHLER: keine Mailtext-Dateien gefunden. Ein leerer Vergleich ist kein bestandener Vergleich.');
    process.exit(1);
  }

  const { gesamt, fehlend, umbenannt } = vergleiche(ref, files);

  if (gesamt === 0) {
    console.error(`FEHLER: in ${ref} wurde in den angegebenen Dateien kein einziges Literal gefunden.`);
    console.error('Stimmen die Pfade? Ein leerer Vergleich ist kein bestandener Vergleich.');
    process.exit(1);
  }

  if (fehlend.length > 0) {
    console.error(`FEHLER: ${fehlend.length} von ${gesamt} Literalen verändert oder verschwunden.`);
    for (const f of fehlend) {
      console.error(`\n--- aus ${f.file} (${ref}) ---`);
      console.error(f.text.length > 500 ? `${f.text.slice(0, 500)}\n[...gekürzt]` : f.text);
    }
    console.error('\nNicht den Vergleich anpassen, sondern die Extraktion korrigieren.');
    process.exit(1);
  }

  if (umbenannt.length > 0) {
    console.log(`Hinweis: bei ${umbenannt.length} Literal(en) ist der Text gleich, aber die Einsetzung heißt anders.`);
    console.log('Das ist beim Umzug normal. Ob die RICHTIGE Variable eingesetzt wird, prüfen die Tests, nicht dieser Vergleich.');
    for (const u of umbenannt) {
      console.log(`  ${u.file}`);
      console.log(`    vorher:  ${u.vorher.join(' ')}`);
      console.log(`    nachher: ${u.nachher.join(' ')}`);
    }
  }

  console.log(`ok — ${gesamt} Textgerüst(e) unverändert wiedergefunden (${files.length} Datei(en) geprüft).`);
  process.exit(0);
}

// Nur ausführen, wenn direkt aufgerufen — beim Import aus einem Test passiert nichts.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
