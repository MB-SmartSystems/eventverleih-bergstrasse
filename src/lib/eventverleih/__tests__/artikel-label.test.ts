import { describe, it, expect } from 'vitest';
import { artikelName, artikelLabel, artikelNamenById } from '../artikel-label';

const STUHL = { Bezeichnung: 'Stuhl', Mehrzahl: 'Stühle' };
const OHNE = { Bezeichnung: 'Riesenjenga', Mehrzahl: null };

describe('artikelName', () => {
  it('uses the plural from two pieces on', () => {
    expect(artikelName(2, STUHL, '—')).toBe('Stühle');
    expect(artikelName(30, STUHL, '—')).toBe('Stühle');
  });

  it('keeps the singular for exactly one', () => {
    expect(artikelName(1, STUHL, '—')).toBe('Stuhl');
  });

  it('falls back to the old spelling while the field is empty', () => {
    // Der Normalfall, bis Manuel die 24 Eintraege gefuellt hat.
    expect(artikelName(30, OHNE, '—')).toBe('Riesenjenga');
    expect(artikelName(30, { Bezeichnung: 'Stuhl' }, '—')).toBe('Stuhl');
    expect(artikelName(30, { Bezeichnung: 'Stuhl', Mehrzahl: '   ' }, '—')).toBe('Stuhl');
  });

  it('uses the caller fallback when the article is unknown', () => {
    expect(artikelName(3, null, 'Artikel 42')).toBe('Artikel 42');
    expect(artikelName(3, undefined, 'Artikel 42')).toBe('Artikel 42');
  });
});

describe('artikelLabel', () => {
  it('writes the line the customer reads', () => {
    expect(artikelLabel(30, STUHL, '—')).toBe('30× Stühle');
    expect(artikelLabel(1, STUHL, '—')).toBe('1× Stuhl');
    expect(artikelLabel(30, OHNE, '—')).toBe('30× Riesenjenga');
  });
});

describe('artikelNamenById', () => {
  it('keeps both forms per row', () => {
    const m = artikelNamenById([
      { id: 1, Bezeichnung: 'Stuhl', Mehrzahl: 'Stühle' },
      { id: 2, Bezeichnung: 'Klapptisch' },
    ]);
    expect(artikelName(5, m.get(1), '—')).toBe('Stühle');
    expect(artikelName(5, m.get(2), '—')).toBe('Klapptisch');
    expect(artikelName(5, m.get(99), 'Artikel 99')).toBe('Artikel 99');
  });
});
