import { describe, it, expect } from 'vitest';
import { verteileBetrag, erstattungEur, ueberzahlungEur, bezahltEur, parseKassiert } from '../zahlung';
import type { PostenStand } from '../zahlung';

/** Buchung 32, der Fall der die Regel ausgeloest hat: 100 € bar, faellig waren 82,50 €. */
const B32: PostenStand = {
  anzahlungSollEur: 22.5,
  anzahlungBezahltEur: 22.5,
  restzahlungSollEur: 52.5,
  restzahlungBezahltEur: 0,
  kautionSollEur: 30,
  kautionBezahltEur: 0,
};

describe('verteileBetrag', () => {
  it('fills remaining payment, deposit and keeps the rest as overpayment', () => {
    const a = verteileBetrag(100, B32);
    expect(a.zuweisungen).toEqual([
      { typ: 'restzahlung', betragEur: 52.5, offenVorherEur: 52.5, offenNachherEur: 0 },
      { typ: 'kaution', betragEur: 30, offenVorherEur: 30, offenNachherEur: 0 },
    ]);
    expect(a.ueberzahlungEur).toBe(17.5);
    expect(a.vollstaendig).toBe(true);
    expect(a.offenDanach.gesamtEur).toBe(0);
  });

  it('skips a post that is already paid', () => {
    // Die Anzahlung taucht in der Aufteilung gar nicht auf, obwohl sie zuerst kaeme.
    expect(verteileBetrag(100, B32).zuweisungen.map((z) => z.typ)).not.toContain('anzahlung');
  });

  it('leaves no overpayment when the amount fits exactly', () => {
    const a = verteileBetrag(82.5, B32);
    expect(a.ueberzahlungEur).toBe(0);
    expect(a.vollstaendig).toBe(true);
    expect(a.zuweisungen.map((z) => z.betragEur)).toEqual([52.5, 30]);
  });

  it('fills in order and reports what stays open when the money is short', () => {
    const a = verteileBetrag(60, B32);
    expect(a.zuweisungen).toEqual([
      { typ: 'restzahlung', betragEur: 52.5, offenVorherEur: 52.5, offenNachherEur: 0 },
      { typ: 'kaution', betragEur: 7.5, offenVorherEur: 30, offenNachherEur: 22.5 },
    ]);
    expect(a.ueberzahlungEur).toBe(0);
    expect(a.vollstaendig).toBe(false);
    expect(a.offenDanach.kautionEur).toBe(22.5);
    expect(a.offenDanach.gesamtEur).toBe(22.5);
  });

  it('starts at the deposit when it is still open', () => {
    const offen: PostenStand = { ...B32, anzahlungBezahltEur: 0 };
    const a = verteileBetrag(30, offen);
    expect(a.zuweisungen).toEqual([
      { typ: 'anzahlung', betragEur: 22.5, offenVorherEur: 22.5, offenNachherEur: 0 },
      { typ: 'restzahlung', betragEur: 7.5, offenVorherEur: 52.5, offenNachherEur: 45 },
    ]);
    expect(a.offenDanach.restzahlungEur).toBe(45);
    expect(a.offenDanach.kautionEur).toBe(30);
  });

  it('puts everything into the overpayment when nothing is open', () => {
    const bezahlt: PostenStand = { ...B32, restzahlungBezahltEur: 52.5, kautionBezahltEur: 30 };
    const a = verteileBetrag(20, bezahlt);
    expect(a.zuweisungen).toEqual([]);
    expect(a.ueberzahlungEur).toBe(20);
    expect(a.vollstaendig).toBe(true);
  });

  it('rejects zero and negative amounts instead of silently doing nothing', () => {
    expect(() => verteileBetrag(0, B32)).toThrow(RangeError);
    expect(() => verteileBetrag(-5, B32)).toThrow(RangeError);
    expect(() => verteileBetrag(Number.NaN, B32)).toThrow(RangeError);
    expect(() => verteileBetrag(Number.POSITIVE_INFINITY, B32)).toThrow(RangeError);
  });

  it('handles cent amounts without floating point residue', () => {
    const stand: PostenStand = {
      anzahlungSollEur: 0.1,
      anzahlungBezahltEur: 0,
      restzahlungSollEur: 0.2,
      restzahlungBezahltEur: 0,
      kautionSollEur: 0,
      kautionBezahltEur: 0,
    };
    const a = verteileBetrag(0.3, stand);
    // 0.1 + 0.2 === 0.30000000000000004 in Gleitkomma — hier muss glatt 0 herauskommen.
    expect(a.ueberzahlungEur).toBe(0);
    expect(a.vollstaendig).toBe(true);
    expect(a.zuweisungen.map((z) => z.betragEur)).toEqual([0.1, 0.2]);
  });

  it('does not lose a cent across the split', () => {
    const a = verteileBetrag(83.33, B32);
    const summe = a.zuweisungen.reduce((s, z) => s + z.betragEur, 0) + a.ueberzahlungEur;
    expect(Math.round(summe * 100)).toBe(8333);
  });

  it('treats an overpaid post as done, never as negative', () => {
    const ueberbezahlt: PostenStand = { ...B32, restzahlungBezahltEur: 60 };
    const a = verteileBetrag(30, ueberbezahlt);
    expect(a.zuweisungen).toEqual([
      { typ: 'kaution', betragEur: 30, offenVorherEur: 30, offenNachherEur: 0 },
    ]);
    expect(a.offenDanach.restzahlungEur).toBe(0);
  });
});

describe('ueberzahlungEur', () => {
  it('reads the scalar field', () => {
    expect(ueberzahlungEur({ Ueberzahlung_Eur: '17.50' })).toBe(17.5);
    expect(ueberzahlungEur({ Ueberzahlung_Eur: 17.5 })).toBe(17.5);
  });

  it('is zero when the field is unset', () => {
    expect(ueberzahlungEur({})).toBe(0);
    expect(ueberzahlungEur({ Ueberzahlung_Eur: null })).toBe(0);
    expect(ueberzahlungEur({ Ueberzahlung_Eur: 0 })).toBe(0);
  });

  it('ignores the payment history entirely', () => {
    // Der Rueckfall auf Zahlungen_JSON ist am 23.07.2026 entfallen, nachdem der
    // Bestand nachgetragen war. Das Feld ist die einzige Quelle.
    const b = { Ueberzahlung_Eur: null } as Record<string, unknown>;
    b.Zahlungen_JSON = '[{"typ":"ueberzahlung","betrag":17.5}]';
    expect(ueberzahlungEur(b)).toBe(0);
  });
});

describe('erstattungEur', () => {
  it('pays back deposit plus overpayment', () => {
    expect(erstattungEur({ Kaution_Soll_Eur: 30, Ueberzahlung_Eur: 17.5 })).toEqual({
      kautionEur: 30,
      ueberzahlungEur: 17.5,
      gesamtEur: 47.5,
    });
  });

  it('reaches 47,50 for booking 32 as it is stored after the backfill', () => {
    // Genau der Datensatz, wie er seit dem 23.07.2026 in Baserow steht.
    const b32 = { Kaution_Soll_Eur: '30.00', Ueberzahlung_Eur: '17.50' };
    expect(erstattungEur(b32).gesamtEur).toBe(47.5);
  });

  it('lets damage reduce only the deposit, never the overpayment', () => {
    expect(erstattungEur({ Kaution_Soll_Eur: 30, Ueberzahlung_Eur: 17.5 }, 10)).toEqual({
      kautionEur: 20,
      ueberzahlungEur: 17.5,
      gesamtEur: 37.5,
    });
    // Voller Einzug: die Kaution ist weg, das zuviel gezahlte Geld bleibt dem Kunden.
    expect(erstattungEur({ Kaution_Soll_Eur: 30, Ueberzahlung_Eur: 17.5 }, 30)).toEqual({
      kautionEur: 0,
      ueberzahlungEur: 17.5,
      gesamtEur: 17.5,
    });
    // Schaden groesser als die Kaution zieht die Erstattung nicht ins Minus.
    expect(erstattungEur({ Kaution_Soll_Eur: 30 }, 50).gesamtEur).toBe(0);
  });

  it('stays at zero without a deposit', () => {
    expect(erstattungEur({}).gesamtEur).toBe(0);
  });
});

describe('bezahltEur bleibt unveraendert', () => {
  it('still sums only the scalar fields', () => {
    expect(bezahltEur({ Anzahlung_Bezahlt_Eur: '22.50', Restzahlung_Bezahlt_Eur: '52.50' })).toBe(75);
    expect(bezahltEur({})).toBe(0);
  });
});

describe('parseKassiert', () => {
  it('treats a missing or fully empty payload as nothing collected', () => {
    expect(parseKassiert(undefined)).toEqual({ ok: true, wert: null });
    expect(parseKassiert(null)).toEqual({ ok: true, wert: null });
    expect(parseKassiert({})).toEqual({ ok: true, wert: null });
    expect(parseKassiert({ gesamt_eur: 0, restzahlung_eur: 0 })).toEqual({ ok: true, wert: null });
  });

  it('rejects parts without a total instead of silently dropping the money', () => {
    // Codex-Befund: sonst nennt die Uebergabe-Mail den kassierten Betrag gar nicht.
    const r = parseKassiert({ restzahlung_eur: 52.5, kaution_eur: 30 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fehler).toMatch(/Gesamtsumme/);
  });

  it('rejects parts that do not add up', () => {
    const r = parseKassiert({ gesamt_eur: 100, restzahlung_eur: 52.5, kaution_eur: 30, ueberzahlung_eur: 5 });
    expect(r.ok).toBe(false);
  });

  it('accepts a consistent payload', () => {
    const r = parseKassiert({ gesamt_eur: 100, restzahlung_eur: 52.5, kaution_eur: 30, ueberzahlung_eur: 17.5 });
    expect(r).toEqual({
      ok: true,
      wert: { gesamtEur: 100, restzahlungEur: 52.5, kautionEur: 30, ueberzahlungEur: 17.5 },
    });
  });

  it('rejects negative and unparsable amounts', () => {
    expect(parseKassiert({ gesamt_eur: -1 }).ok).toBe(false);
    expect(parseKassiert({ gesamt_eur: 'viel' }).ok).toBe(false);
    expect(parseKassiert({ gesamt_eur: 10, restzahlung_eur: -10, kaution_eur: 20 }).ok).toBe(false);
  });
});
