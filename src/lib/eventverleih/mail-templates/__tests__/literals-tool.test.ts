import { describe, it, expect } from 'vitest';
import { literals } from '../../../../../scripts/mail-literals-diff.mjs';

/**
 * The literal comparison is the safety net for the whole extraction. If it stops
 * catching changes, every later task loses its proof — so its behaviour is pinned here.
 */
describe('literals()', () => {
  it('picks up template literals long enough to be customer text', () => {
    const src = 'const a = `Hallo Herr Mustermann, hier folgt Ihre Terminbestätigung.`;';
    expect(literals(src)).toHaveLength(1);
  });

  it('ignores short technical strings', () => {
    const src = 'const url = `${base}/api`; const k = `B${id}-1h`;';
    expect(literals(src)).toHaveLength(0);
  });

  it('keeps interpolations as part of the literal, so a changed variable is a change', () => {
    const a = literals('const t = `Ihre Kaution von ${kautionSoll} EUR wird zurückerstattet.`;');
    const b = literals('const t = `Ihre Kaution von ${restSoll} EUR wird zurückerstattet.`;');
    expect(a[0]).not.toEqual(b[0]);
  });

  it('treats a re-indented literal as unchanged, because moving it is allowed', () => {
    const flach = literals('const t = `Guten Tag,\n\nvielen Dank für Ihre Anfrage bei uns.`;');
    const tief = literals('    const t = `Guten Tag,\n      \n      vielen Dank für Ihre Anfrage bei uns.`;');
    expect(tief[0]).toEqual(flach[0]);
  });

  it('sees a single changed word as a different literal', () => {
    const alt = literals('const t = `eine kurze Erinnerung an unseren Übergabe-Termin morgen.`;');
    const neu = literals('const t = `eine kurze Erinnerung an Ihren Übergabe-Termin morgen.`;');
    expect(alt[0]).not.toEqual(neu[0]);
  });
});
