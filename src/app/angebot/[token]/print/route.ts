/**
 * GET /angebot/[token]/print
 *
 * Liefert das Angebot als HELLES, druckfertiges HTML-Dokument (renderAngebotHtml).
 * Vom n8n-Render-Flow (eve-pdf-render) via Gotenberg `convert/url` zu PDF gerendert
 * und in Blob abgelegt (In-Portal-Download). Token-gated wie /angebot/[token].
 *
 * Quelle: bevorzugt der eingefrorene Snapshot (was der Kunde sieht), sonst Live-Daten.
 */
import { NextRequest } from "next/server";
import { getRow, listRows, TABLES } from "@/lib/baserow/client";
import { parseSnapshot } from "@/lib/angebot-snapshot";
import { renderAngebotHtml, type AngebotHtmlContext } from "@/lib/angebot-html";

export const dynamic = "force-dynamic";

const FIRMA = {
  name: "Eventverleih Bergstraße",
  inhaber: "Manuel Büttner",
  anschrift: "Schlesierstraße 19a, 64665 Alsbach-Hähnlein",
  telefon: "+49 156 79521124",
  email: "info@eventverleih-bergstrasse.de",
  website: "eventverleih-bergstrasse.de",
  ust_hinweis: "Nicht umsatzsteuerpflichtig nach § 19 Abs. 1 UStG.",
};

function num(v: string | null | undefined): number {
  return parseFloat(v ?? "0") || 0;
}

type AngebotRow = {
  id: number;
  Angebotsnummer: string;
  Angebotsdatum: string | null;
  Gueltig_bis: string | null;
  Token_Public: string;
  Snapshot_JSON: string | null;
  Buchung_Link: Array<{ id: number; value: string }>;
  Kunde_Link: Array<{ id: number; value: string }>;
};
type BuchungRow = {
  id: number;
  Event_datum_von: string | null;
  Event_datum_bis: string | null;
  Preis_Artikel: string | null;
  Preis_Lieferung: string | null;
  Preis_Abholung: string | null;
  Preis_Aufbau: string | null;
  Anzahlung_Soll_Eur: string | null;
  Restzahlung_Soll_Eur: string | null;
  Kaution_Soll_Eur: string | null;
};
type KundeRow = {
  Vorname: string;
  Nachname: string;
  Firma: string;
  Email: string;
  Telefon: string;
  Adresse_Strasse: string;
  Adresse_PLZ: string;
  Adresse_Ort: string;
};
type PositionRow = {
  id: number;
  Anzahl: string;
  Einzelpreis_Eur: string;
  Position_Gesamt_Eur: string;
  Artikel_Link: Array<{ id: number; value: string }>;
  Buchung_Link: Array<{ id: number }>;
};
type ArtikelRow = { id: number; Bezeichnung: string };

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const list = await listRows<AngebotRow>(TABLES.Angebote, { search: token, size: 5 });
  const angebot = list.results.find((a) => a.Token_Public === token);
  if (!angebot || !angebot.Buchung_Link?.[0]?.id || !angebot.Kunde_Link?.[0]?.id) {
    return new Response("Angebot nicht gefunden", { status: 404 });
  }

  const buchungId = angebot.Buchung_Link[0].id;
  const [buchung, kunde] = await Promise.all([
    getRow<BuchungRow>(TABLES.Buchungen, buchungId),
    getRow<KundeRow>(TABLES.Kunden, angebot.Kunde_Link[0].id),
  ]);

  const snap = parseSnapshot(angebot.Snapshot_JSON);

  // Positionen: aus Snapshot (eingefroren) oder live nachladen
  let positionen: AngebotHtmlContext["positionen"];
  if (snap) {
    positionen = snap.positionen.map((p) => ({
      bezeichnung: p.bezeichnung,
      anzahl: p.anzahl,
      einzelpreis_eur: p.einzelpreis,
      gesamt_eur: p.gesamt,
    }));
  } else {
    const [positionenAll, artikelAll] = await Promise.all([
      listRows<PositionRow>(TABLES.Buchungs_Position, { size: 200 }),
      listRows<ArtikelRow>(TABLES.Artikel, { size: 200 }),
    ]);
    const artikelById = new Map(artikelAll.results.map((a) => [a.id, a.Bezeichnung]));
    positionen = positionenAll.results
      .filter((p) => p.Buchung_Link?.[0]?.id === buchungId)
      .map((p) => {
        const aid = p.Artikel_Link?.[0]?.id ?? 0;
        return {
          bezeichnung: artikelById.get(aid) ?? `Artikel ${aid}`,
          anzahl: parseInt(p.Anzahl, 10) || 1,
          einzelpreis_eur: num(p.Einzelpreis_Eur),
          gesamt_eur: num(p.Position_Gesamt_Eur),
        };
      });
  }

  const preisLieferung = snap ? snap.preis_lieferung : num(buchung.Preis_Lieferung);
  const preisAbholung = snap ? snap.preis_abholung : num(buchung.Preis_Abholung);
  const preisAufbau = snap ? snap.preis_aufbau : num(buchung.Preis_Aufbau);
  const zusatz: Array<{ bezeichnung: string; betrag_eur: number }> = [];
  if (preisLieferung > 0) zusatz.push({ bezeichnung: "Lieferung", betrag_eur: preisLieferung });
  if (preisAbholung > 0) zusatz.push({ bezeichnung: "Abholung", betrag_eur: preisAbholung });
  if (preisAufbau > 0) zusatz.push({ bezeichnung: "Aufbau", betrag_eur: preisAufbau });

  const mietsumme = snap ? snap.preis_artikel : num(buchung.Preis_Artikel);
  const gesamt = Math.round((mietsumme + preisLieferung + preisAbholung + preisAufbau) * 100) / 100;

  // Gueltig-bis-Fallback: Angebotsdatum + 14 Tage (Angebot ist 14 Tage gueltig)
  let gueltigBis = angebot.Gueltig_bis;
  if (!gueltigBis && angebot.Angebotsdatum) {
    const d = new Date(angebot.Angebotsdatum);
    if (!isNaN(d.getTime())) {
      d.setDate(d.getDate() + 14);
      gueltigBis = d.toISOString().slice(0, 10);
    }
  }

  const context: AngebotHtmlContext = {
    angebotsnummer: angebot.Angebotsnummer,
    angebotsdatum: angebot.Angebotsdatum,
    gueltig_bis: gueltigBis,
    leistung_von: snap ? snap.event_datum_von : buchung.Event_datum_von,
    leistung_bis: snap ? snap.event_datum_bis : buchung.Event_datum_bis,
    kunde: {
      vorname: snap ? snap.kunde.vorname : (kunde.Vorname ?? ""),
      nachname: snap ? snap.kunde.nachname : (kunde.Nachname ?? ""),
      firma: (snap ? snap.kunde.firma : kunde.Firma) || undefined,
      adresse: (snap ? snap.kunde.adresse_strasse : kunde.Adresse_Strasse) || undefined,
      plz: (snap ? snap.kunde.adresse_plz : kunde.Adresse_PLZ) || undefined,
      ort: (snap ? snap.kunde.adresse_ort : kunde.Adresse_Ort) || undefined,
      email: (snap ? snap.kunde.email : kunde.Email) || undefined,
      telefon: (snap ? snap.kunde.telefon : kunde.Telefon) || undefined,
    },
    positionen,
    zusatz_positionen: zusatz,
    gesamt_eur: gesamt,
    anzahlung_eur: snap ? snap.anzahlung_soll_eur : num(buchung.Anzahlung_Soll_Eur),
    restzahlung_eur: snap ? snap.restzahlung_soll_eur : num(buchung.Restzahlung_Soll_Eur),
    kaution_eur: snap ? snap.kaution_soll_eur : num(buchung.Kaution_Soll_Eur),
    firma: FIRMA,
  };

  const html = renderAngebotHtml(context);
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
