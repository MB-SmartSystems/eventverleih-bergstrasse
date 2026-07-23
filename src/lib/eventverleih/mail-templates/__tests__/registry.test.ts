import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { TEMPLATES, UNCOVERED } from '../registry';

/** Every .ts/.tsx file below src/. */
function sourceFiles(dir = 'src'): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sourceFiles(p));
    else if (p.endsWith('.ts') || p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

/**
 * Template keys the code can actually write into the MailQueue.
 *
 * Literal keys are read straight from the source. The four dynamic ones cannot be
 * read that way, so they are listed here with the expansion they produce — if one of
 * those call sites ever gains a third variant, this list is the place that lies, and
 * the mismatch is meant to be noticed here rather than in the customer's inbox.
 */
function alleTreffer(text: string, re: RegExp): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  const rx = new RegExp(re.source, 'g');
  while ((m = rx.exec(text)) !== null) out.push(m[1]);
  return out;
}

function keysInCode(): string[] {
  const found: Record<string, true> = {};
  const patterns = [/Template_Key:\s*"([a-z0-9_]+)"/, /\btpl:\s*"([a-z0-9_]+)"/];
  const files = sourceFiles();
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.indexOf('mail-templates') !== -1) continue; // registry and tests are not senders
    const src = readFileSync(file, 'utf8');
    for (let p = 0; p < patterns.length; p++) {
      const treffer = alleTreffer(src, patterns[p]);
      for (let k = 0; k < treffer.length; k++) found[treffer[k]] = true;
    }
    // templateKey is assigned in several shapes, including a ternary carrying two
    // keys on one line. Only look right of the `?` when there is one — otherwise the
    // ternary CONDITION ("freigeben_anmerkung", an action name) is mistaken for a key.
    const zeilen = src.split('\n');
    for (let z = 0; z < zeilen.length; z++) {
      const zeile = zeilen[z];
      if (!/\btemplateKey\s*=/.test(zeile)) continue;
      const frage = zeile.indexOf('?');
      const rechts = frage !== -1 ? zeile.slice(frage) : zeile.slice(zeile.indexOf('='));
      const treffer = alleTreffer(rechts, /"([a-z0-9_]+)"/);
      for (let k = 0; k < treffer.length; k++) found[treffer[k]] = true;
    }
    if (src.indexOf('Template_Key: `termin_${which}_bestaetigung`') !== -1) {
      found['termin_uebergabe_bestaetigung'] = true;
      found['termin_rueckgabe_bestaetigung'] = true;
    }
    if (src.indexOf('Template_Key: `termin_1h_${c.which}`') !== -1) {
      found['termin_1h_uebergabe'] = true;
      found['termin_1h_rueckgabe'] = true;
    }
  }
  return Object.keys(found);
}

describe('registry', () => {
  const alleBekannten = () => TEMPLATES.map((t) => t.tpl).concat(UNCOVERED.map((u) => u.tpl));

  it('covers every template key the code can produce', () => {
    const bekannt = alleBekannten();
    const fehlend = keysInCode()
      .filter((k) => bekannt.indexOf(k) === -1)
      .sort();
    expect(fehlend, 'Diese Vorlagen verschickt der Code, die Uebersicht kennt sie nicht').toEqual([]);
  });

  it('lists no key that the code cannot produce', () => {
    const imCode = keysInCode();
    // rechnung_beleg lebt in n8n, taucht deshalb bewusst in keiner Quelldatei auf.
    const erfunden = alleBekannten()
      .filter((k) => k !== 'rechnung_beleg' && imCode.indexOf(k) === -1)
      .sort();
    expect(erfunden, 'Diese Vorlagen stehen in der Uebersicht, existieren im Code aber nicht').toEqual([]);
  });

  it('uses each key exactly once', () => {
    const keys = TEMPLATES.map((t) => t.tpl);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('renders every example without leftovers', () => {
    for (const t of TEMPLATES) {
      expect(t.examples.length, `${t.tpl} braucht mindestens einen Beispielfall`).toBeGreaterThan(0);
      for (const ex of t.examples) {
        const out = t.build(ex.ctx);
        expect(out.subject.length, `${t.tpl} / ${ex.label}: leerer Betreff`).toBeGreaterThan(0);
        expect(out.body.length, `${t.tpl} / ${ex.label}: leerer Text`).toBeGreaterThan(50);
        for (const rest of ['undefined', 'null', 'NaN', '{{', '}}', '[object Object]']) {
          expect(out.body.includes(rest), `${t.tpl} / ${ex.label}: "${rest}" im Text`).toBe(false);
        }
      }
    }
  });

  it('gives every template with conditional text more than one example', () => {
    // A single example would hide exactly the branches that need review.
    const mitZweigen = [
      'termin_erinnerung',
      'restzahlung_pre3',
      'anzahlung_pre7',
      'vertrag_bestaetigung',
      'storno_bestaetigung',
      'google_review',
      'angebot_nachhaken',
    ];
    for (const key of mitZweigen) {
      const t = TEMPLATES.find((x) => x.tpl === key);
      expect(t, `${key} fehlt in der Registry`).toBeDefined();
      expect(t!.examples.length, `${key} braucht mehr als einen Beispielfall`).toBeGreaterThan(1);
    }
  });

  it('points at a real source location for every template', () => {
    for (const t of TEMPLATES) {
      expect(t.source, `${t.tpl} ohne Fundstelle`).toMatch(/^src\/.+:\d+/);
      expect(t.trigger.length, `${t.tpl} ohne Ausloeser`).toBeGreaterThan(5);
      expect(t.title.length, `${t.tpl} ohne Titel`).toBeGreaterThan(3);
    }
  });

  it('names a reason for every uncovered template', () => {
    expect(UNCOVERED.length).toBeGreaterThan(0);
    for (const u of UNCOVERED) {
      expect(u.reason.length, `${u.tpl} ohne Begruendung`).toBeGreaterThan(10);
      expect(u.source.length).toBeGreaterThan(3);
    }
  });
});
