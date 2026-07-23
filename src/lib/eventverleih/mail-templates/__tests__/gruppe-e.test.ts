import { describe, it, expect } from 'vitest';
import {
  buildTerminErinnerung,
  buildRueckgabeErinnerung,
  buildTermin1h,
  offeneBetraegeBlock,
} from '../build/termin-erinnerung';

const basis = {
  kundeName: 'Max Mustermann',
  terminText: 'Donnerstag, 23.07.2026 um 15:00 Uhr',
  ort: 'Schlesierstraße 19a, 64665 Alsbach-Hähnlein',
  restSoll: 52.5,
  restBezahltAm: null as string | null,
  restLink: 'https://buy.stripe.test/rest',
  kautionSoll: 30,
  kautionHinterlegtAm: null as string | null,
};

describe('buildTerminErinnerung', () => {
  it('names both open amounts when nothing is paid', () => {
    const body = buildTerminErinnerung(basis).body;
    expect(body).toContain('52,50 EUR');
    expect(body).toContain('30,00 EUR');
    expect(body).toContain('https://buy.stripe.test/rest');
  });

  it('drops both blocks once everything is settled', () => {
    const body = buildTerminErinnerung({
      ...basis,
      restBezahltAm: '2026-07-20',
      kautionHinterlegtAm: '2026-07-20',
    }).body;
    expect(body).not.toContain('52,50');
    expect(body).not.toContain('30,00');
    expect(body).toContain('Erinnerung an unseren Übergabe-Termin');
  });

  it('drops only the settled block, not both', () => {
    const nurKaution = buildTerminErinnerung({ ...basis, restBezahltAm: '2026-07-20' }).body;
    expect(nurKaution).not.toContain('52,50');
    expect(nurKaution).toContain('30,00');
  });

  it('leaves out the payment link when there is none, without a dangling label', () => {
    const body = buildTerminErinnerung({ ...basis, restLink: null }).body;
    expect(body).toContain('52,50 EUR');
    expect(body).not.toContain('Ihr Zahlungslink');
  });

  it('offers the deposit online first, cash as the last option with the hints', () => {
    // Entscheidung 2026-07-23: Stripe-Hold zuerst, bar mit den zwei Pflicht-Hinweisen.
    const body = buildTerminErinnerung(basis).body;
    const onlineIdx = body.indexOf('online');
    const barIdx = body.indexOf('bar zur Übergabe');
    expect(onlineIdx).toBeGreaterThanOrEqual(0);
    expect(barIdx).toBeGreaterThan(onlineIdx);
    expect(body).toContain('kein Wechselgeld');
  });

  it('says "ich liefere" only when Manuel delivers', () => {
    expect(buildTerminErinnerung(basis).body).toContain('unseren Übergabe-Termin');
    expect(buildTerminErinnerung({ ...basis, manuelLiefert: true }).body).toContain('ich liefere Ihnen die Artikel');
  });

  it('treats string amounts from Baserow like numbers', () => {
    const alsText = buildTerminErinnerung({ ...basis, restSoll: '52.50', kautionSoll: '30.00' }).body;
    expect(alsText).toContain('52,50 EUR');
    expect(alsText).toContain('30,00 EUR');
  });
});

describe('buildRueckgabeErinnerung', () => {
  it('asks for complete and clean return, and promises the deposit back', () => {
    const out = buildRueckgabeErinnerung({
      kundeName: basis.kundeName,
      terminText: basis.terminText,
      ort: basis.ort,
    });
    expect(out.subject).toContain('Rückgabe-Termin');
    expect(out.body).toContain('vollständig und sauber');
    expect(out.body).toContain('Kaution erstatte ich');
  });

  it('says "ich hole ... ab" and never "bringen Sie zurück" when Manuel picks up', () => {
    const out = buildRueckgabeErinnerung({
      kundeName: basis.kundeName,
      terminText: basis.terminText,
      ort: basis.ort,
      manuelHoltAb: true,
    });
    expect(out.body).toContain('ich hole die Artikel');
    expect(out.body).not.toContain('bringen Sie die Artikel');
    expect(out.body).toContain('vollständig und sauber');
  });
});

describe('offeneBetraegeBlock', () => {
  const offen = {
    restSoll: 52.5,
    restBezahltAm: null as string | null,
    restLink: 'https://buy.stripe.test/rest',
    kautionSoll: 30,
    kautionHinterlegtAm: null as string | null,
    kautionLink: 'https://checkout.stripe.test/k',
  };

  it('is empty when nothing is open — the reminder stays a plain appointment mail', () => {
    expect(
      offeneBetraegeBlock({ ...offen, restBezahltAm: '2026-07-20', kautionHinterlegtAm: '2026-07-20' }),
    ).toBe('');
  });

  it('joins two open items with "und" and lists both links', () => {
    const block = offeneBetraegeBlock(offen);
    expect(block).toContain('Restzahlung 52,50 EUR und Kaution 30,00 EUR');
    expect(block).toContain('https://buy.stripe.test/rest');
    expect(block).toContain('https://checkout.stripe.test/k');
  });

  it('never offers cash — Stripe is the standard way', () => {
    expect(offeneBetraegeBlock(offen)).toContain('vorab online');
    expect(offeneBetraegeBlock(offen).toLowerCase()).not.toContain(' bar ');
  });

  it('does not show a link belonging to an already settled item', () => {
    const block = offeneBetraegeBlock({ ...offen, kautionHinterlegtAm: '2026-07-20' });
    expect(block).toContain('Restzahlung 52,50 EUR');
    expect(block).not.toContain('Kaution 30,00 EUR');
    expect(block).not.toContain('https://checkout.stripe.test/k');
  });
});

describe('buildTermin1h', () => {
  it('names the time in subject and body', () => {
    const out = buildTermin1h({
      kundeName: 'Max Mustermann',
      label: 'Übergabe',
      zeit: '15:00 Uhr',
      ort: basis.ort,
      zahlungsHinweis: '',
    });
    expect(out.subject).toBe('Gleich: Ihr Übergabe-Termin um 15:00 Uhr');
    expect(out.body).toContain('um 15:00 Uhr');
    expect(out.body).toContain('Bis gleich!');
  });

  it('carries the payment note through when one was computed', () => {
    const out = buildTermin1h({
      kundeName: 'Max Mustermann',
      label: 'Übergabe',
      zeit: '15:00 Uhr',
      ort: basis.ort,
      zahlungsHinweis: offeneBetraegeBlock({
        restSoll: 52.5,
        restBezahltAm: null,
        restLink: 'https://buy.stripe.test/rest',
        kautionSoll: 30,
        kautionHinterlegtAm: null,
        kautionLink: null,
      }),
    });
    expect(out.body).toContain('Restzahlung 52,50 EUR und Kaution 30,00 EUR');
  });
});
