/**
 * Nach jeder Position-Änderung Buchungs-Summen neu berechnen:
 *   Preis_Artikel = sum(Anzahl * Einzelpreis_Eur)
 *   Anzahlung 30 %, Restzahlung 70 %
 *   Kaution = sum(Anzahl * Artikel.Kaution_Pro_Stueck_Eur)
 * Außerdem Angebot.Gesamtpreis updaten, falls Angebot existiert.
 *
 * Stripe-Links: wenn Anzahlung / Komplettzahlung sich geandert hat UND die jeweilige
 * Zahlung noch nicht eingegangen ist, wird der alte Payment-Link in Stripe deaktiviert
 * und ein neuer mit aktuellem Betrag erzeugt. Sonst wuerde der Kunde an den alten Link
 * geraten und einen falschen Betrag bezahlen.
 */
import { getRow, listRows, updateRow, TABLES } from "@/lib/baserow/client";
import { createPaymentLink, deactivatePaymentLinksFor } from "@/lib/stripe/payment-links";
import { kundeNameAusLink } from "@/lib/eventverleih/kunde-name";

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

type BuchungFresh = {
  Preis_Artikel: string | null;
  Preis_Lieferung: string | null;
  Preis_Abholung: string | null;
  Preis_Aufbau: string | null;
  Anzahlung_Soll_Eur: string | null;
  Anzahlung_Bezahlt_am: string | null;
  Restzahlung_Bezahlt_am: string | null;
  Event_datum_von: string | null;
  Stripe_Anzahlung_Link: string | null;
  Stripe_Komplettzahlung_Link: string | null;
  Kunde_Link: Array<{ id: number; value: string }>;
};

function num(v: string | null | undefined): number {
  return parseFloat(v ?? "0") || 0;
}

export async function recalcBuchung(buchungId: number): Promise<void> {
  // Pre-Snapshot fuer Stripe-Link-Refresh
  let preState: BuchungFresh | null = null;
  try {
    preState = await getRow<BuchungFresh>(TABLES.Buchungen, buchungId);
  } catch (e) {
    console.error("[recalc] pre-state read fehlgeschlagen, fahre fort:", e);
  }

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

  // Lieferung + Abholung + Aufbau bleiben aus dem Pre-State erhalten (recalc setzt nur Artikel).
  // Anzahlung/Gesamt berücksichtigen sie aber, damit Stripe-Links und Sidebar konsistent
  // mit dem Cart-Flow sind.
  const lieferung = num(preState?.Preis_Lieferung);
  const abholung = num(preState?.Preis_Abholung);
  const aufbau = num(preState?.Preis_Aufbau);
  const anzahlungBasis = mietsumme + lieferung + abholung + aufbau;
  const anzahlung = Math.round(anzahlungBasis * 0.3 * 100) / 100;
  const restzahlung = Math.round((anzahlungBasis - anzahlung) * 100) / 100;

  await updateRow(TABLES.Buchungen, buchungId, {
    Preis_Artikel: mietsumme,
    Anzahlung_Soll_Eur: anzahlung,
    Restzahlung_Soll_Eur: restzahlung,
    Kaution_Soll_Eur: kaution,
    Kaution: kaution,
    Gesamt: Math.round((anzahlungBasis + kaution) * 100) / 100,
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

  // Stripe-Link-Refresh — fail-soft, blockt die Recalc nicht
  if (preState) {
    await refreshStripeLinks(buchungId, preState, {
      anzahlung,
      preisArtikel: mietsumme,
    });
  }
}

interface RefreshContext {
  anzahlung: number;
  preisArtikel: number;
}

async function refreshStripeLinks(
  buchungId: number,
  pre: BuchungFresh,
  next: RefreshContext,
): Promise<void> {
  const oldAnzahlung = num(pre.Anzahlung_Soll_Eur);
  const oldPreisArtikel = num(pre.Preis_Artikel);
  const oldLieferung = num(pre.Preis_Lieferung);
  const oldAbholung = num(pre.Preis_Abholung);
  const oldAufbau = num(pre.Preis_Aufbau);
  const oldKomplett = oldPreisArtikel + oldLieferung + oldAbholung + oldAufbau;
  // Neuer Komplett = neuer Preis_Artikel + bestehende Liefer-/Abhol-/Aufbau-Werte (recalc setzt nur Artikel)
  const newKomplett = next.preisArtikel + oldLieferung + oldAbholung + oldAufbau;

  // NICHT .value — das ist die Kunde_ID-Zahl ("Hallo 12"-Bug). Echten Namen laden.
  const kundeName = await kundeNameAusLink(pre.Kunde_Link, "Kunde");
  const eventDatum = pre.Event_datum_von || "";

  // Anzahlungs-Link refreshen
  const anzahlungChanged = Math.abs(oldAnzahlung - next.anzahlung) > 0.005;
  const anzahlungOpen = !pre.Anzahlung_Bezahlt_am;
  const hadAnzahlungLink = (pre.Stripe_Anzahlung_Link || "").trim().length > 0;
  if (anzahlungChanged && anzahlungOpen && hadAnzahlungLink && next.anzahlung > 0) {
    try {
      await deactivatePaymentLinksFor(buchungId, "anzahlung");
      const link = await createPaymentLink({
        buchungId,
        paymentType: "anzahlung",
        amountEur: next.anzahlung,
        kundeName,
        description: `Anzahlung Buchung #${buchungId} — Event ${eventDatum}`,
      });
      await updateRow(TABLES.Buchungen, buchungId, { Stripe_Anzahlung_Link: link.link_url });
    } catch (e) {
      console.error("[recalc] Stripe-Anzahlungs-Link-Refresh fehlgeschlagen:", e);
    }
  }

  // Komplettzahlungs-Link refreshen
  const komplettChanged = Math.abs(oldKomplett - newKomplett) > 0.005;
  // Wir haben keinen direkten "Komplettzahlung_Bezahlt_am"-Marker — solange Anzahlung
  // nicht durch ist, ist auch die Komplettzahlung noch offen (Konsumenten zahlen nicht beides).
  const komplettOpen = !pre.Anzahlung_Bezahlt_am && !pre.Restzahlung_Bezahlt_am;
  const hadKomplettLink = (pre.Stripe_Komplettzahlung_Link || "").trim().length > 0;
  if (komplettChanged && komplettOpen && hadKomplettLink && newKomplett > 0) {
    try {
      await deactivatePaymentLinksFor(buchungId, "komplettzahlung");
      const link = await createPaymentLink({
        buchungId,
        paymentType: "komplettzahlung",
        amountEur: newKomplett,
        kundeName,
        description: `Komplettzahlung Buchung #${buchungId} — Event ${eventDatum}`,
      });
      await updateRow(TABLES.Buchungen, buchungId, { Stripe_Komplettzahlung_Link: link.link_url });
    } catch (e) {
      console.error("[recalc] Stripe-Komplettzahlungs-Link-Refresh fehlgeschlagen:", e);
    }
  }
}
