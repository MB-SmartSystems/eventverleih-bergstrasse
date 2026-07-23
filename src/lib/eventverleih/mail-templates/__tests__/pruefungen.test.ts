import { describe, it, expect } from 'vitest';
import { pruefeText, pruefeAlle, befundeFuer } from '../pruefungen';

describe('pruefeText', () => {
  it('flags cash wording, because Stripe is the standard way', () => {
    const befunde = pruefeText({
      subject: 'Erinnerung',
      body: 'Bitte denken Sie an die Kaution (30,00 EUR) - diese wird bar bei der Übergabe erhoben. Eventverleih Bergstraße',
    });
    expect(befunde.map((b) => b.regel)).toContain('bargeld');
    expect(befunde.find((b) => b.regel === 'bargeld')!.schwere).toBe('fehler');
  });

  it('does not mistake words that merely end in -bar', () => {
    const befunde = pruefeText({
      subject: 'Info',
      body: 'Der Termin ist jederzeit erreichbar und die Ausstattung ist wunderbar. Eventverleih Bergstraße',
    });
    expect(befunde.map((b) => b.regel)).not.toContain('bargeld');
  });

  it('flags body em dashes, exempts the signature line, and ignores the subject (B5)', () => {
    // Signature line is house style, matched by the brand name → never flagged.
    const nurSignatur = pruefeText({
      subject: 'Info',
      body: 'Alles klar.\n\nViele Grüße\nManuel Büttner — Eventverleih Bergstraße',
    });
    expect(nurSignatur.map((b) => b.regel)).not.toContain('em-dash');

    // Em dash in the body fliesstext (own line, no brand name) → flagged.
    const imFliesstext = pruefeText({
      subject: 'Info',
      body: 'Danke — bis bald.\n\nEventverleih Bergstraße',
    });
    expect(imFliesstext.map((b) => b.regel)).toContain('em-dash');

    // Em dash only in the subject → NOT flagged; the subject is no longer checked.
    const nurBetreff = pruefeText({
      subject: 'Zahlung erhalten — Ihre Buchung ist vollständig bezahlt',
      body: 'Danke. Eventverleih Bergstraße',
    });
    expect(nurBetreff.map((b) => b.regel)).not.toContain('em-dash');
  });

  it('flags a missing sender identification', () => {
    expect(pruefeText({ subject: 'Hallo', body: 'Kurzer Text ohne Absender.' }).map((b) => b.regel)).toContain(
      'signatur-fehlt',
    );
  });

  it('flags leftovers that would reach the customer as garbage', () => {
    const befunde = pruefeText({
      subject: 'Info',
      body: 'Ihre Kaution von undefined EUR. Eventverleih Bergstraße',
    });
    expect(befunde.map((b) => b.regel)).toContain('rest-im-text');
  });

  it('quotes the offending passage so it can be judged without opening the file', () => {
    const b = pruefeText({
      subject: 'x',
      body: 'Bitte die Kaution bar bei der Übergabe mitbringen. Eventverleih Bergstraße',
    }).find((x) => x.regel === 'bargeld')!;
    expect(b.stelle).toContain('bar bei der Übergabe');
  });
});

describe('pruefeAlle über die echte Registry', () => {
  const alle = pruefeAlle();

  it('finds the cash wording in termin_erinnerung', () => {
    // Only present in the branch where the deposit is still open — this is the
    // reason every template with a conditional block needs more than one example.
    const regeln = befundeFuer('termin_erinnerung').map((b) => b.regel);
    expect(regeln).toContain('bargeld');
  });

  it('finds the cash wording in kaution_bar_hinweis', () => {
    expect(befundeFuer('kaution_bar_hinweis').map((b) => b.regel)).toContain('bargeld');
  });

  it('finds the cash wording in restzahlung_pre3', () => {
    expect(befundeFuer('restzahlung_pre3').map((b) => b.regel)).toContain('bargeld');
  });

  it('finds exactly these three and no other cash template', () => {
    const mitBargeld = Array.from(
      new Set(alle.filter((v) => v.befunde.some((b) => b.regel === 'bargeld')).map((v) => v.tpl)),
    ).sort();
    expect(mitBargeld).toEqual(['kaution_bar_hinweis', 'restzahlung_pre3', 'termin_erinnerung']);
  });

  it('leaves no template with unresolved leftovers', () => {
    const reste = alle.filter((v) => v.befunde.some((b) => b.regel === 'rest-im-text'));
    expect(reste.map((v) => `${v.tpl}/${v.label}`)).toEqual([]);
  });

  it('leaves no template without a sender identification', () => {
    const ohne = alle.filter((v) => v.befunde.some((b) => b.regel === 'signatur-fehlt'));
    expect(ohne.map((v) => `${v.tpl}/${v.label}`)).toEqual([]);
  });
});
