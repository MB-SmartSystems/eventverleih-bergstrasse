import { describe, it, expect } from 'vitest';
import { buildUebergabeErfolgt, buildKautionIbanAnfordern } from '../build/uebergabe';
import type { UebergabeErfolgtCtx } from '../build/uebergabe';
import { pruefeText } from '../pruefungen';

const BASIS: UebergabeErfolgtCtx = {
  kundeName: 'Natascha Schneider',
  artikelZeilen: ['- 30× Stuhl'],
  rueckgabeZeile: '\n\nRückgabe-Termin: Montag, 27.07.2026 um 14:30 Uhr (Grillhütte Sandwiese).',
  kautionSollEur: 30,
  kautionHinterlegt: false,
  offenRestzahlungEur: 0,
  offenKautionEur: 0,
};

describe('buildUebergabeErfolgt — die drei Fälle', () => {
  it('case 1: everything paid in advance says so and names the deposit state', () => {
    const m = buildUebergabeErfolgt({ ...BASIS, kautionHinterlegt: true });
    expect(m.body).toContain('30× Stuhl');
    expect(m.body).toContain('vollständig bezahlt');
    expect(m.body).toContain('Ihre Kaution (30,00 EUR) ist hinterlegt');
    expect(m.body).not.toContain('Offen sind noch');
    expect(m.body).not.toContain('Heute erhalten');
  });

  it('case 2: collected at handover lists what the money was used for', () => {
    const m = buildUebergabeErfolgt({
      ...BASIS,
      kassiert: { gesamtEur: 100, restzahlungEur: 52.5, kautionEur: 30, ueberzahlungEur: 17.5 },
      kautionHinterlegt: true,
    });
    expect(m.body).toContain('Heute erhalten habe ich 100,00 EUR');
    expect(m.body).toContain('Restzahlung: 52,50 EUR');
    expect(m.body).toContain('Kaution: 30,00 EUR');
    expect(m.body).toContain('Zu viel gezahlt: 17,50 EUR');
    // Der Satz, auf den sich die Kundin am 27.07. berufen kann.
    expect(m.body).toContain('47,50 EUR');
    expect(m.body).not.toContain('Offen sind noch');
  });

  it('case 2 without overpayment does not invent one', () => {
    const m = buildUebergabeErfolgt({
      ...BASIS,
      kassiert: { gesamtEur: 82.5, restzahlungEur: 52.5, kautionEur: 30, ueberzahlungEur: 0 },
      kautionHinterlegt: true,
    });
    expect(m.body).not.toContain('Zu viel gezahlt');
    expect(m.body).toContain('Die Kaution bekommen Sie nach der Rückgabe');
  });

  it('case 3: what stays open is named with its payment link', () => {
    const m = buildUebergabeErfolgt({
      ...BASIS,
      offenRestzahlungEur: 52.5,
      offenKautionEur: 30,
      restLink: 'https://buy.stripe.com/rest',
      kautionLink: 'https://checkout.stripe.com/kaution',
    });
    expect(m.body).toContain('Offen sind noch 82,50 EUR');
    expect(m.body).toContain('Restzahlung: 52,50 EUR');
    expect(m.body).toContain('https://buy.stripe.com/rest');
    expect(m.body).toContain('https://checkout.stripe.com/kaution');
  });

  it('mixed case: collected something and still names the rest', () => {
    const m = buildUebergabeErfolgt({
      ...BASIS,
      kassiert: { gesamtEur: 60, restzahlungEur: 52.5, kautionEur: 7.5, ueberzahlungEur: 0 },
      offenKautionEur: 22.5,
      kautionLink: 'https://checkout.stripe.com/kaution',
    });
    expect(m.body).toContain('Heute erhalten habe ich 60,00 EUR');
    expect(m.body).toContain('Offen sind noch 22,50 EUR');
  });

  it('never offers cash and carries no AI markers', () => {
    const faelle = [
      { ...BASIS, kautionHinterlegt: true },
      { ...BASIS, kassiert: { gesamtEur: 100, restzahlungEur: 52.5, kautionEur: 30, ueberzahlungEur: 17.5 } },
      { ...BASIS, offenRestzahlungEur: 52.5, offenKautionEur: 30, restLink: 'https://buy.stripe.com/x' },
    ];
    for (const f of faelle) {
      const befunde = pruefeText(buildUebergabeErfolgt(f)).map((b) => b.regel);
      expect(befunde, JSON.stringify(f.kassiert ?? f.offenRestzahlungEur)).not.toContain('bargeld');
      expect(befunde).not.toContain('em-dash');
      expect(befunde).not.toContain('rest-im-text');
      expect(befunde).not.toContain('signatur-fehlt');
    }
  });

  it('survives a booking without positions', () => {
    const m = buildUebergabeErfolgt({ ...BASIS, artikelZeilen: [], kautionHinterlegt: true });
    expect(m.body).toContain('keine Positionen erfasst');
    expect(m.body).not.toContain('undefined');
  });
});

describe('buildKautionIbanAnfordern', () => {
  it('names deposit plus overpayment, broken down', () => {
    const m = buildKautionIbanAnfordern({ kundeName: 'Natascha Schneider', kautionEur: 30, ueberzahlungEur: 17.5 });
    expect(m.body).toContain('Zurück gehen 47,50 EUR');
    expect(m.body).toContain('Kaution: 30,00 EUR');
    expect(m.body).toContain('Zu viel gezahlt: 17,50 EUR');
    expect(m.body).toContain('IBAN');
  });

  it('stays plain when there is no overpayment', () => {
    const m = buildKautionIbanAnfordern({ kundeName: 'Max Mustermann', kautionEur: 30, ueberzahlungEur: 0 });
    expect(m.body).toContain('Zurück gehen 30,00 EUR an Sie (Kaution).');
    expect(m.body).not.toContain('Zu viel gezahlt');
  });

  it('no longer claims the deposit was handed over in cash', () => {
    // Der alte Text sagte "Da Sie die Kaution in bar hinterlegt haben" — das widerspricht
    // der Stripe-Regel und stimmte auch nicht immer.
    const m = buildKautionIbanAnfordern({ kundeName: 'Max Mustermann', kautionEur: 30, ueberzahlungEur: 0 });
    expect(pruefeText(m).map((b) => b.regel)).not.toContain('bargeld');
  });
});

describe('Nachbesserungen aus dem Codex-Review', () => {
  it('names the deposit already on file, not only what was collected today', () => {
    // Kaution lag schon als Hold auf der Karte, heute kam nur die Ueberzahlung dazu.
    const m = buildUebergabeErfolgt({
      ...BASIS,
      kautionHinterlegt: true,
      kassiert: { gesamtEur: 17.5, restzahlungEur: 0, kautionEur: 0, ueberzahlungEur: 17.5 },
    });
    // Ohne die Korrektur stuende hier 17,50 statt 47,50.
    expect(m.body).toContain('also 47,50 EUR');
  });

  it('names only what was collected when the deposit is still partial', () => {
    const m = buildUebergabeErfolgt({
      ...BASIS,
      kautionHinterlegt: false,
      kassiert: { gesamtEur: 25, restzahlungEur: 0, kautionEur: 7.5, ueberzahlungEur: 17.5 },
      offenKautionEur: 22.5,
    });
    expect(m.body).toContain('also 25,00 EUR');
  });
});
