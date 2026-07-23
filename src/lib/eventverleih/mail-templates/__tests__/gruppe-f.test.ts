import { describe, it, expect } from 'vitest';
import {
  buildAnfrageEingang,
  buildVertragBestaetigung,
  buildStornoBestaetigung,
  buildLoginMagicLink,
} from '../build/anfrage-und-member';

describe('buildAnfrageEingang', () => {
  const basis = {
    greeting: 'Hallo Max Mustermann',
    zeitraum: '24.07.2026 bis 27.07.2026',
    summary: '  40x Stuhl',
    meinBereichUrl: '',
  };

  it('repeats period and request back to the customer', () => {
    const body = buildAnfrageEingang(basis).body;
    expect(body).toContain('24.07.2026 bis 27.07.2026');
    expect(body).toContain('40x Stuhl');
    expect(body).toContain('innerhalb von 24 Stunden');
  });

  it('adds the customer area block only with a link', () => {
    expect(buildAnfrageEingang(basis).body).not.toContain('Mein Bereich');
    expect(buildAnfrageEingang({ ...basis, meinBereichUrl: 'https://example.test/mb' }).body).toContain('Mein Bereich');
  });
});

describe('buildVertragBestaetigung', () => {
  const basis = {
    kundeName: 'Max Mustermann',
    stripeLink: 'https://buy.stripe.test/anzahlung',
    komplettLink: null as string | null,
    angebotsnummer: 'AN-2026-027',
    vertragsUrl: 'https://example.test/vertrag/abc',
    meinBereichUrl: '',
    aufbauAbsatz: '',
  };

  it('is explicit that the deposit makes the booking binding', () => {
    const body = buildVertragBestaetigung(basis).body;
    expect(body).toContain('WICHTIG');
    expect(body).toContain('verbindlich bestätigt');
    expect(body).toContain('innerhalb von 7 Tagen');
    expect(body).toContain('AN-2026-027');
  });

  it('offers the full payment only when that link exists', () => {
    expect(buildVertragBestaetigung(basis).body).not.toContain('komplett zahlen');
    const mit = buildVertragBestaetigung({ ...basis, komplettLink: 'https://buy.stripe.test/komplett' });
    expect(mit.body).toContain('komplett zahlen');
    expect(mit.body).toContain('https://buy.stripe.test/komplett');
  });

  it('promises to send a link instead of going silent when there is none', () => {
    const ohne = buildVertragBestaetigung({ ...basis, stripeLink: null, komplettLink: null }).body;
    expect(ohne).toContain('sende ich Ihnen umgehend zu');
    expect(ohne).not.toContain('undefined');
    expect(ohne).not.toContain('null');
  });

  it('greets without a name when none is known', () => {
    expect(buildVertragBestaetigung({ ...basis, kundeName: '' }).body.startsWith('Hallo,')).toBe(true);
  });
});

describe('buildStornoBestaetigung', () => {
  const basis = {
    vorname: 'Max',
    nachname: 'Mustermann',
    buchungId: 32,
    stornogebuehrProzent: 50,
    staffelLabel: '7 bis 13 Tage vor Event',
    mietsumme: 75,
    stornogebuehrEur: 37.5,
    bezahlt: 22.5,
    erstattungEur: 0,
    nachzahlungEur: 0,
  };

  it('shows the fee breakdown with German amounts', () => {
    const body = buildStornoBestaetigung(basis).body;
    expect(body).toContain('50 % der Mietsumme');
    expect(body).toContain('Mietsumme: 75,00 EUR');
    expect(body).toContain('Stornogebühr: 37,50 EUR');
    expect(body).toContain('Bereits bezahlt: 22,50 EUR');
  });

  it('announces a refund when one is due', () => {
    const body = buildStornoBestaetigung({ ...basis, erstattungEur: 22.5 }).body;
    expect(body).toContain('Sie erhalten 22,50 EUR zurück');
    expect(body).toContain('Stripe');
  });

  it('announces an invoice when the fee exceeds what was paid', () => {
    const body = buildStornoBestaetigung({ ...basis, nachzahlungEur: 15 }).body;
    expect(body).toContain('Differenz von 15,00 EUR');
    expect(body).not.toContain('Sie erhalten');
  });

  it('says plainly that nothing is refunded when neither applies', () => {
    expect(buildStornoBestaetigung(basis).body).toContain('keine Erstattung fällig');
  });

  it('never claims both a refund and an extra invoice at once', () => {
    const body = buildStornoBestaetigung({ ...basis, erstattungEur: 22.5, nachzahlungEur: 15 }).body;
    expect(body).toContain('Sie erhalten 22,50 EUR zurück');
    expect(body).not.toContain('Differenz von');
  });
});

describe('buildLoginMagicLink', () => {
  it('carries the link and states how long it is valid', () => {
    const out = buildLoginMagicLink({ magicLink: 'https://example.test/mein-bereich/login?token=xyz' });
    expect(out.body).toContain('https://example.test/mein-bereich/login?token=xyz');
    expect(out.body).toContain('30 Tage gültig');
    expect(out.body).toContain('ignorieren Sie diese Mail');
  });

  it('stays nameless — the mail address is the identity here', () => {
    expect(buildLoginMagicLink({ magicLink: 'https://example.test/l' }).body.startsWith('Hallo,')).toBe(true);
  });
});
