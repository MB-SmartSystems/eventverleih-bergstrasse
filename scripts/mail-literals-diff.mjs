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
export function literals(source) {
  const out = [];
  const re = /`(?:\\.|\$\{(?:[^{}]|\{[^}]*\})*\}|[^`\\])*`/gs;
  let m;
  while ((m = re.exec(source)) !== null) {
    const raw = m[0];
    if (raw.length < MIN_LEN) continue;
    out.push(raw.replace(/\n[ \t]+/g, '\n'));
  }
  return out;
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
    if (existsSync(file)) after.push(...literals(readFileSync(file, 'utf8')));
  }
  return { gesamt: before.length, fehlend: before.filter((b) => !after.includes(b.text)) };
}

function main() {
  const [ref, ...files] = process.argv.slice(2);
  if (!ref || files.length === 0) {
    console.error('Aufruf: mail-literals-diff.mjs <git-ref> <datei...>');
    process.exit(2);
  }

  const { gesamt, fehlend } = vergleiche(ref, files);

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

  console.log(`ok — ${gesamt} Literal(e) unverändert wiedergefunden (${files.length} Datei(en) geprüft).`);
  process.exit(0);
}

// Nur ausführen, wenn direkt aufgerufen — beim Import aus einem Test passiert nichts.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
