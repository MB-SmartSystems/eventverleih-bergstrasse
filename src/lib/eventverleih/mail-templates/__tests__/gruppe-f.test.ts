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

  // 100 % Gebuehr: die Erstattung besteht NUR aus zu viel gezahltem Geld. "Darin
  // enthalten sind 17,50" waere formal richtig und trotzdem irrefuehrend.
  const voll = {
    ...basis,
    stornogebuehrProzent: 100,
    staffelLabel: 'Weniger als 4 Tage vor Event — 100 % Stornogebühr',
    stornogebuehrEur: 75,
    bezahlt: 75,
    erstattungEur: 0,
    ueberzahlungEur: 17.5,
  };

  it('explains a refund that is nothing but the overpayment', () => {
    const body = buildStornoBestaetigung(voll).body;
    expect(body).toContain('Sie erhalten 17,50 EUR zurück');
    expect(body).toContain('den Sie zu viel gezahlt hatten');
    expect(body).toContain('eine Erstattung der Miete gibt es deshalb nicht');
    expect(body).not.toContain('Darin enthalten sind');
  });

  it('keeps the wording of a partial fee untouched', () => {
    const body = buildStornoBestaetigung({ ...basis, erstattungEur: 37.5, ueberzahlungEur: 17.5 }).body;
    expect(body).toContain('Sie erhalten 55,00 EUR zurück');
    expect(body).toContain('Darin enthalten sind 17,50 EUR');
    expect(body).not.toContain('eine Erstattung der Miete gibt es deshalb nicht');
  });

  // Manuel, 2026-07-23: der Erstattungsweg richtet sich nach der Zahlungsart.
  it('asks for the bank details when the customer paid cash', () => {
    const body = buildStornoBestaetigung({ ...basis, erstattungEur: 22.5, erstattungsweg: 'bank' as const }).body;
    expect(body).toContain('Sie erhalten 22,50 EUR zurück');
    expect(body).toContain('brauche ich Ihre Bankverbindung');
    expect(body).toContain('IBAN und Kontoinhaber');
    expect(body).not.toContain('Stripe');
  });

  it('names PayPal instead of Stripe when PayPal was used', () => {
    const body = buildStornoBestaetigung({ ...basis, erstattungEur: 22.5, erstattungsweg: 'paypal' as const }).body;
    expect(body).toContain('über PayPal auf Ihr ursprüngliches Zahlungsmittel');
    expect(body).not.toContain('Stripe');
  });

  it('is byte-identical to today without the new fields', () => {
    // Gegenprobe: der Normalfall Karte darf sich durch die Erweiterung nicht bewegen.
    expect(buildStornoBestaetigung({ ...basis, erstattungEur: 22.5 }).body).toBe(
      buildStornoBestaetigung({ ...basis, erstattungEur: 22.5, erstattungsweg: 'karte' as const, ueberzahlungEur: 0 }).body,
    );
  });

  it('routes the cash case through the full-fee wording too', () => {
    const body = buildStornoBestaetigung({ ...voll, erstattungsweg: 'bank' as const }).body;
    expect(body).toContain('eine Erstattung der Miete gibt es deshalb nicht');
    expect(body).toContain('brauche ich Ihre Bankverbindung');
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
