import { describe, it, expect } from 'vitest';
import { literals, geruest, ausdruecke } from '../../../../../scripts/mail-literals-diff.mjs';

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

/**
 * The skeleton is the actual thing under protection: the fixed characters a customer
 * reads. Renaming a variable is plumbing and must pass; changing a word must not.
 */
describe('geruest()', () => {
  it('treats a renamed interpolation as the same text', () => {
    const alt = 'Guten Tag ${body.anmerkung.trim()}, Ihr Termin steht fest und wir freuen uns.';
    const neu = 'Guten Tag ${anmerkung}, Ihr Termin steht fest und wir freuen uns.';
    expect(geruest(alt)).toEqual(geruest(neu));
  });

  it('still separates texts that differ by a single word', () => {
    const alt = 'Ihre Kaution von ${betrag} EUR wird bar bei der Übergabe erhoben.';
    const neu = 'Ihre Kaution von ${betrag} EUR wird online hinterlegt.';
    expect(geruest(alt)).not.toEqual(geruest(neu));
  });

  it('does not paper over a removed interpolation', () => {
    expect(geruest('Offen: ${rest} und ${kaution}.')).not.toEqual(geruest('Offen: ${rest}.'));
  });

  it('does not lose a literal that got shorter than the threshold while moving', () => {
    // Real bug, found while extracting the deposit mails: `Hallo ${kunde.Vorname}
    // ${kunde.Nachname}` is 42 characters, `Hallo ${vorname} ${nachname}` only 32.
    // With the length filter on both sides the shorter one vanished from the search
    // space and the comparison reported a text loss that never happened.
    const kurz = 'const g = `Hallo ${vorname} ${nachname}`;';
    expect(literals(kurz)).toHaveLength(0);
    expect(literals(kurz, 0)).toHaveLength(1);
  });

  it('lists the interpolations so a swap stays visible in the report', () => {
    expect(ausdruecke('Offen sind ${restSoll} EUR und ${kautionSoll} EUR.')).toEqual([
      '${restSoll}',
      '${kautionSoll}',
    ]);
  });
});
