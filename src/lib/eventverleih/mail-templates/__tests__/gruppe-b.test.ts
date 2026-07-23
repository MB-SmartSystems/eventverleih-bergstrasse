import { describe, it, expect } from 'vitest';
import {
  buildAngebotErneutGesendet,
  buildAngebotNachhaken,
  buildAngebotAktualisiert,
} from '../build/angebot-versand';
import { SIGNATURE } from '../build/bausteine';

const kunde = { Vorname: 'Max', Nachname: 'Mustermann' };
const preise = { preisArtikel: '75.00', anzahlung: '22.50', restzahlung: '52.50', kaution: '30.00' };

describe('buildAngebotErneutGesendet', () => {
  const basis = {
    kunde,
    preise,
    publicUrl: 'https://example.test/angebot/abc',
    meinBereichUrl: null as string | null,
  };

  it('puts each price on its own line, in the right role', () => {
    const body = buildAngebotErneutGesendet(basis).body;
    expect(body).toContain('Mietsumme: 75.00 EUR');
    expect(body).toContain('Anzahlung bei Bestätigung (30 %): 22.50 EUR');
    expect(body).toContain('Restzahlung bei Übergabe (70 %): 52.50 EUR');
    expect(body).toContain('Kaution (nach Rückgabe vollständig erstattet): 30.00 EUR');
  });

  it('leaves out the note block when there is no note', () => {
    expect(buildAngebotErneutGesendet(basis).body).not.toContain('Persönliche Anmerkung');
    expect(buildAngebotErneutGesendet({ ...basis, anmerkung: '   ' }).body).not.toContain('Persönliche Anmerkung');
  });

  it('adds the customer area only when a link exists', () => {
    expect(buildAngebotErneutGesendet(basis).body).not.toContain('Mein Bereich');
    const mit = buildAngebotErneutGesendet({ ...basis, meinBereichUrl: 'https://example.test/mb' });
    expect(mit.body).toContain('https://example.test/mb');
  });

  it('carries the legal signature', () => {
    expect(buildAngebotErneutGesendet(basis).body.endsWith(SIGNATURE)).toBe(true);
  });
});

describe('buildAngebotNachhaken', () => {
  const basis = {
    kunde,
    publicUrl: 'https://example.test/angebot/abc',
    eventDatumVon: '2026-07-24',
    meinBereichUrl: null as string | null,
  };

  it('names the event date in the sentence', () => {
    expect(buildAngebotNachhaken(basis).body).toContain('Ihren Termin am 24.07.2026 zugeschickt');
  });

  it('keeps the sentence intact when there is no date', () => {
    const body = buildAngebotNachhaken({ ...basis, eventDatumVon: null }).body;
    expect(body).toContain('Ihren Termin zugeschickt');
    expect(body).not.toContain('undefined');
    expect(body).not.toContain('null');
  });
});

describe('buildAngebotAktualisiert', () => {
  const basis = {
    kunde,
    angebotsnummer: 'AN-2026-027',
    nextVersion: 2,
    preisArtikel: 75,
    publicUrl: 'https://example.test/angebot/abc',
  };

  it('names offer number and version, and formats the amount German style', () => {
    const out = buildAngebotAktualisiert(basis);
    expect(out.subject).toContain('AN-2026-027');
    expect(out.body).toContain('(Version 2)');
    expect(out.body).toContain('75,00 EUR');
  });

  it('takes the rental sum, not some other amount', () => {
    expect(buildAngebotAktualisiert({ ...basis, preisArtikel: 52.5 }).body).toContain('52,50 EUR');
  });
});
