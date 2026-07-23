import { describe, it, expect } from 'vitest';
import { buildKautionHoldLink, buildKautionBarHinweis } from '../build/kaution';

describe('buildKautionHoldLink', () => {
  const basis = {
    vorname: 'Max',
    nachname: 'Mustermann',
    amount: 30,
    kautionUrl: 'https://checkout.stripe.test/k',
    meinBereichUrl: null as string | null,
  };

  it('states clearly that nothing is charged', () => {
    const out = buildKautionHoldLink(basis);
    expect(out.body).toContain('NICHT');
    expect(out.body).toContain('Pre-Authorization');
    expect(out.body).toContain('30,00 EUR');
    expect(out.body).toContain('https://checkout.stripe.test/k');
  });

  it('greets with both names and survives an empty last name', () => {
    expect(buildKautionHoldLink(basis).body.startsWith('Hallo Max Mustermann,')).toBe(true);
    expect(buildKautionHoldLink({ ...basis, nachname: '' }).body.startsWith('Hallo Max,')).toBe(true);
  });

  it('adds the customer area only when a link exists', () => {
    expect(buildKautionHoldLink(basis).body).not.toContain('Mein Bereich');
    expect(buildKautionHoldLink({ ...basis, meinBereichUrl: 'https://example.test/mb' }).body).toContain('Mein Bereich');
  });
});

describe('buildKautionBarHinweis', () => {
  const basis = { kundeName: 'Max Mustermann', kautionSoll: 30, tageBis: 5 };

  it('names the amount and the number of days', () => {
    const out = buildKautionBarHinweis(basis);
    expect(out.body).toContain('30,00 EUR');
    expect(out.body).toContain('ca. 5 Tagen');
  });

  it('says "Kürze" instead of a day count right before the event', () => {
    expect(buildKautionBarHinweis({ ...basis, tageBis: 1 }).body).toContain('in Kürze');
    expect(buildKautionBarHinweis({ ...basis, tageBis: 0 }).body).toContain('in Kürze');
    expect(buildKautionBarHinweis({ ...basis, tageBis: 0 }).body).not.toContain('ca. 0 Tagen');
  });

  it('still contains the cash wording — this text is knowingly unfixed', () => {
    // Guard against a silent "fix": correcting customer text is its own approved step.
    // The overview must flag this, the extraction must not change it.
    expect(buildKautionBarHinweis(basis).body).toContain('bar bei der Übergabe mitzubringen');
  });
});
