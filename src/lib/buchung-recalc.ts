/**
 * Nach jeder Position-Änderung Buchungs-Summen neu berechnen:
 *   Preis_Artikel = sum(Anzahl * Einzelpreis_Eur)
 *   Anzahlung 30 %, Restzahlung 70 %
 *   Kaution = sum(Anzahl * Artikel.Kaution_Pro_Stueck_Eur)
 * Außerdem Angebot.Gesamtpreis updaten, falls Angebot existiert.
 */
import { listRows, updateRow, TABLES } from "@/lib/baserow/client";

type PositionRow = {
  id: number;
  Anzahl: string;
  Einzelpreis_Eur: string;
  Buchung_Link: Array<{ id: number }>;
  Artikel_Link: Array<{ id: number }>;
};

type ArtikelRow = {
  id: number;
  Kaution_Pro_Stueck_Eur: string | null;
};

type AngebotRow = {
  id: number;
  Buchung_Link: Array<{ id: number }>;
};

function num(v: string | null | undefined): number {
  return parseFloat(v ?? "0") || 0;
}

export async function recalcBuchung(buchungId: number): Promise<void> {
  const [positionenList, artikelList, angeboteList] = await Promise.all([
    listRows<PositionRow>(TABLES.Buchungs_Position, { size: 200 }),
    listRows<ArtikelRow>(TABLES.Artikel, { size: 200 }),
    listRows<AngebotRow>(TABLES.Angebote, { size: 200 }),
  ]);

  const kautionMap = new Map<number, number>();
  for (const a of artikelList.results) kautionMap.set(a.id, num(a.Kaution_Pro_Stueck_Eur));

  const myPositions = positionenList.results.filter((p) => p.Buchung_Link?.[0]?.id === buchungId);
  let mietsumme = 0;
  let kaution = 0;
  for (const p of myPositions) {
    const anz = num(p.Anzahl);
    const ep = num(p.Einzelpreis_Eur);
    mietsumme += anz * ep;
    const artikelId = p.Artikel_Link?.[0]?.id;
    if (artikelId) kaution += anz * (kautionMap.get(artikelId) ?? 0);
  }
  const anzahlung = Math.round(mietsumme * 0.3 * 100) / 100;
  const restzahlung = Math.round((mietsumme - anzahlung) * 100) / 100;

  await updateRow(TABLES.Buchungen, buchungId, {
    Preis_Artikel: mietsumme,
    Anzahlung_Soll_Eur: anzahlung,
    Restzahlung_Soll_Eur: restzahlung,
    Kaution_Soll_Eur: kaution,
    Kaution: kaution,
    Gesamt: Math.round((mietsumme + kaution) * 100) / 100,
  });

  // Angebot.Gesamtpreis mitupdaten
  const myAngebot = angeboteList.results.find((a) => a.Buchung_Link?.[0]?.id === buchungId);
  if (myAngebot) {
    try {
      await updateRow(TABLES.Angebote, myAngebot.id, { Gesamtpreis: mietsumme });
    } catch {
      /* nicht-fatal */
    }
  }
}
