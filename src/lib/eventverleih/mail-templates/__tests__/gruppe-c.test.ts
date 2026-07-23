import { describe, it, expect } from 'vitest';
import {
  buildKomplettzahlungErhalten,
  buildRestzahlungErhalten,
  buildAnzahlungErhalten,
} from '../build/zahlung-erhalten';

const ctx = { kname: 'Max Mustermann' };

describe('Zahlungsbestätigungen', () => {
  it('confirms a full payment as settled', () => {
    const out = buildKomplettzahlungErhalten(ctx);
    expect(out.subject).toBe('Zahlung erhalten — Ihre Buchung ist vollständig bezahlt');
    expect(out.body).toContain('Ihre Zahlung ist bei uns eingegangen');
    expect(out.body).toContain('vollständig bezahlt');
  });

  it('confirms a remaining payment as settled', () => {
    const out = buildRestzahlungErhalten(ctx);
    expect(out.body).toContain('Ihre Restzahlung ist bei uns eingegangen');
    expect(out.body).toContain('vollständig bezahlt');
  });

  it('does NOT call a deposit fully paid — that would be wrong towards the customer', () => {
    const out = buildAnzahlungErhalten(ctx);
    expect(out.body).toContain('Ihre Anzahlung ist bei uns eingegangen');
    expect(out.body).toContain('verbindlich für Sie reserviert');
    expect(out.body).not.toContain('vollständig bezahlt');
    expect(out.subject).toBe('Anzahlung erhalten — Ihr Termin ist reserviert');
  });

  it('greets with the real name, never with a customer id', () => {
    // Regression guard for the "Hallo 12" bug: the id must never end up as the name.
    const out = buildAnzahlungErhalten({ kname: 'Maria Musterfrau' });
    expect(out.body).toContain('Maria Musterfrau');
    expect(out.body).not.toMatch(/Hallo \d+/);
  });

  it('serves both payment routes from one text — Stripe and PayPal cannot drift apart', () => {
    // The two used to be byte-identical copies in two files. One builder, one text.
    expect(buildKomplettzahlungErhalten(ctx)).toEqual(buildKomplettzahlungErhalten({ kname: 'Max Mustermann' }));
    expect(buildKomplettzahlungErhalten(ctx).body).not.toEqual(buildRestzahlungErhalten(ctx).body);
  });

  it('always carries the handover note', () => {
    for (const build of [buildKomplettzahlungErhalten, buildRestzahlungErhalten, buildAnzahlungErhalten]) {
      expect(build(ctx).body.length).toBeGreaterThan(200);
      expect(build(ctx).body).toContain('Eventverleih Bergstraße');
    }
  });
});
