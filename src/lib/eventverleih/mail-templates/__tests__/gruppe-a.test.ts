import { describe, it, expect } from 'vitest';
import { buildGoogleReview } from '../build/google-review';
import { buildRestzahlungInfo } from '../build/restzahlung-info';
import { buildAnzahlungErinnerung } from '../build/anzahlung-erinnerung';
import { buildAngebotsMail, buildRueckrufMail, buildAblehnenMail, resolveAblehnenText } from '../build/angebot-entscheidung';

/**
 * Group A: the four files that already had a build function. These tests pin the
 * two things the extraction must not break — purity and the branches.
 */

describe('buildGoogleReview', () => {
  it('uses the given review link instead of reading the environment', () => {
    const out = buildGoogleReview({ kundeName: 'Maria Musterfrau', reviewUrl: 'https://example.test/r' });
    expect(out.body).toContain('https://example.test/r');
    expect(out.body).toContain('Maria Musterfrau');
    expect(out.subject.length).toBeGreaterThan(0);
  });

  it('falls back to the generic wording when no link is given', () => {
    const out = buildGoogleReview({ kundeName: 'Maria Musterfrau', reviewUrl: '' });
    expect(out.body).toContain('Google-Profil');
    expect(out.body).not.toContain('https://');
  });

  it('greets without a name when the name is empty', () => {
    expect(buildGoogleReview({ kundeName: '', reviewUrl: '' }).body.startsWith('Hallo,')).toBe(true);
  });

  it('is deterministic', () => {
    const ctx = { kundeName: 'Maria Musterfrau', reviewUrl: 'https://example.test/r' };
    expect(buildGoogleReview(ctx)).toEqual(buildGoogleReview(ctx));
  });
});

describe('buildRestzahlungInfo', () => {
  const basis = {
    kundeName: 'Max Mustermann',
    restSoll: 52.5,
    eventDatumVon: '2026-07-24',
    stripeLink: 'https://buy.stripe.test/rest',
    meinBereichUrl: 'https://example.test/mein-bereich',
  };

  it('names the amount in German formatting', () => {
    expect(buildRestzahlungInfo(basis).body).toContain('52,50');
  });

  it('offers the payment link when there is one', () => {
    expect(buildRestzahlungInfo(basis).body).toContain('https://buy.stripe.test/rest');
  });

  it('points to the customer area when the link is missing', () => {
    const out = buildRestzahlungInfo({ ...basis, stripeLink: null });
    expect(out.body).not.toContain('https://buy.stripe.test/rest');
    expect(out.body).toContain('Kundenbereich');
  });
});

describe('buildAnzahlungErinnerung', () => {
  const basis = {
    tpl: 'anzahlung_pre7',
    kundeName: 'Max Mustermann',
    anzahlungSoll: 22.5,
    eventDatumVon: '2026-07-24',
    stripeLink: 'https://buy.stripe.test/anzahlung',
    meinBereichUrl: null as string | null,
  };

  it('names the amount and the link', () => {
    const out = buildAnzahlungErinnerung(basis);
    expect(out.body).toContain('22,50');
    expect(out.body).toContain('https://buy.stripe.test/anzahlung');
  });

  it('varies only the opening sentence between the two stages', () => {
    const post3 = buildAnzahlungErinnerung({ ...basis, tpl: 'anzahlung_post3' }).body;
    const pre7 = buildAnzahlungErinnerung({ ...basis, tpl: 'anzahlung_pre7' }).body;
    expect(post3).not.toEqual(pre7);
    const kern = 'Damit ich die Teile fest für Sie einbuchen kann';
    expect(post3).toContain(kern);
    expect(pre7).toContain(kern);
  });

  it('keeps one subject across both stages', () => {
    const a = buildAnzahlungErinnerung({ ...basis, tpl: 'anzahlung_post3' }).subject;
    const b = buildAnzahlungErinnerung({ ...basis, tpl: 'anzahlung_pre7' }).subject;
    expect(a).toEqual(b);
  });
});

describe('Angebots-Entscheidung', () => {
  const angebot = {
    vorname: 'Max',
    nachname: 'Mustermann',
    preisArtikel: '75.00',
    anzahlung: '22.50',
    restzahlung: '52.50',
    kaution: '30.00',
    angebotUrl: 'https://example.test/angebot/abc',
  };

  it('lists the price breakdown and the offer link', () => {
    const out = buildAngebotsMail(angebot);
    expect(out.body).toContain('75.00');
    expect(out.body).toContain('https://example.test/angebot/abc');
    expect(out.body).not.toContain('Persönliche Anmerkung');
  });

  it('adds the personal note only when there is one', () => {
    const out = buildAngebotsMail({ ...angebot, anmerkung: 'Die Zelte stelle ich Ihnen zusammen.' });
    expect(out.body).toContain('Persönliche Anmerkung');
    expect(out.body).toContain('Die Zelte stelle ich Ihnen zusammen.');
  });

  it('asks for a call without inventing a reason', () => {
    const out = buildRueckrufMail({ vorname: 'Max', nachname: 'Mustermann' });
    expect(out.body).toContain('+49 156 79521124');
  });

  it('declines without naming an internal reason', () => {
    const out = buildAblehnenMail({ vorname: 'Max', nachname: 'Mustermann', grund: '' });
    expect(out.body).toContain('kein Angebot');
    expect(out.body).not.toContain('undefined');
  });

  it('keeps internal rejection categories out of the customer text', () => {
    expect(resolveAblehnenText('intern')).toBe('');
    expect(resolveAblehnenText(undefined)).toBe('');
    expect(resolveAblehnenText('ausgebucht')).toContain('bereits vergeben');
  });
});
