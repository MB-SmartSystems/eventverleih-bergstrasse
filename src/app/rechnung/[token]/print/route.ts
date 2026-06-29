/**
 * GET /rechnung/[token]/print
 *
 * Liefert die Rechnung als HELLES, druckfertiges HTML-Dokument (identische Optik
 * zur E-Mail-Rechnung, `renderRechnungHtml`). Vom n8n-Render-Flow (eve-pdf-render)
 * via Gotenberg `convert/url` zu PDF gerendert und in Blob abgelegt.
 *
 * Token-gated (wie die /rechnung/[token]-Seite). Quelle = GoBD-Snapshot der Rechnung.
 */
import { NextRequest } from "next/server";
import { listRows, TABLES } from "@/lib/baserow/client";
import { renderRechnungHtml, type RechnungContext } from "@/lib/rechnung-html";

export const dynamic = "force-dynamic";

const FIRMA = {
  name: "Eventverleih Bergstraße",
  inhaber: "Manuel Büttner",
  anschrift: "Schlesierstraße 19a, 64665 Alsbach-Hähnlein",
  telefon: "+49 156 79521124",
  email: "info@eventverleih-bergstrasse.de",
  website: "eventverleih-bergstrasse.de",
  iban: "DE84 5001 0517 5420 4742 10",
  ust_hinweis: "Nicht umsatzsteuerpflichtig nach § 19 Abs. 1 UStG.",
};

interface SnapshotKunde {
  firma?: string | null;
  vorname?: string;
  nachname?: string;
  adresse_strasse?: string;
  adresse_plz?: string;
  adresse_ort?: string;
}
interface SnapshotKautionBlock {
  soll_eur?: number;
  schaden_eur?: number;
  erstattung_eur?: number;
  schaden_notiz?: string | null;
  beleg_typ?: string;
}
interface SnapshotBuchung {
  event_datum_von?: string | null;
  event_datum_bis?: string | null;
  preis_lieferung_eur?: number;
  preis_abholung_eur?: number;
  preis_aufbau_eur?: number;
  preis_abbau_eur?: number;
  kaution_soll_eur?: number;
}
interface RechnungSnapshotV2 {
  kaution?: SnapshotKautionBlock;
}
interface SnapshotRechnung {
  rechnungsnummer?: string;
  rechnungsdatum?: string;
  faelligkeit?: string;
  bezahlt?: boolean;
  betrag_gesamt_eur?: number;
}
interface SnapshotPosition {
  artikel?: string;
  anzahl?: number;
  einzelpreis_eur?: number;
  gesamt_eur?: number;
}
interface RechnungSnapshot extends RechnungSnapshotV2 {
  kunde?: SnapshotKunde;
  buchung?: SnapshotBuchung;
  rechnung?: SnapshotRechnung;
  positionen?: SnapshotPosition[];
}

type RechnungRow = {
  id: number;
  Token_Public: string;
  Snapshot_JSON: string | null;
};

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const list = await listRows<RechnungRow>(TABLES.Rechnungen, { search: token, size: 5 });
  const rechnung = list.results.find((r) => r.Token_Public === token);
  if (!rechnung || !rechnung.Snapshot_JSON) {
    return new Response("Rechnung nicht gefunden", { status: 404 });
  }

  let snap: RechnungSnapshot;
  try {
    snap = JSON.parse(rechnung.Snapshot_JSON) as RechnungSnapshot;
  } catch {
    return new Response("Snapshot unlesbar", { status: 500 });
  }

  const b = snap.buchung ?? {};
  const r = snap.rechnung ?? {};
  const k = snap.kunde ?? {};

  const zusatz: Array<{ bezeichnung: string; betrag_eur: number }> = [];
  if ((b.preis_lieferung_eur ?? 0) > 0) zusatz.push({ bezeichnung: "Lieferung", betrag_eur: b.preis_lieferung_eur! });
  if ((b.preis_abholung_eur ?? 0) > 0) zusatz.push({ bezeichnung: "Abholung", betrag_eur: b.preis_abholung_eur! });
  if ((b.preis_aufbau_eur ?? 0) > 0) zusatz.push({ bezeichnung: "Aufbau", betrag_eur: b.preis_aufbau_eur! });
  if ((b.preis_abbau_eur ?? 0) > 0) zusatz.push({ bezeichnung: "Abbau", betrag_eur: b.preis_abbau_eur! });

  const snapKaution = snap.kaution;
  const kaution_block =
    snapKaution && snapKaution.beleg_typ && snapKaution.beleg_typ !== "keine"
      ? {
          soll_eur: snapKaution.soll_eur ?? 0,
          schaden_eur: snapKaution.schaden_eur ?? 0,
          erstattung_eur: snapKaution.erstattung_eur ?? 0,
          schaden_notiz: snapKaution.schaden_notiz ?? null,
          beleg_typ: snapKaution.beleg_typ as "erstattung" | "einbehalt" | "keine",
        }
      : undefined;

  const context: RechnungContext = {
    rechnungsnummer: r.rechnungsnummer ?? "",
    rechnungsdatum: r.rechnungsdatum ?? "",
    faelligkeit: r.faelligkeit ?? "",
    bezahlt: r.bezahlt ?? false,
    leistung_von: b.event_datum_von ?? null,
    leistung_bis: b.event_datum_bis ?? null,
    kunde: {
      vorname: k.vorname ?? "",
      nachname: k.nachname ?? "",
      firma: k.firma ?? undefined,
      adresse: k.adresse_strasse ?? undefined,
      plz: k.adresse_plz ?? undefined,
      ort: k.adresse_ort ?? undefined,
    },
    positionen: (snap.positionen ?? []).map((p) => ({
      bezeichnung: p.artikel ?? "Artikel",
      anzahl: p.anzahl ?? 0,
      einzelpreis_eur: p.einzelpreis_eur ?? 0,
      gesamt_eur: p.gesamt_eur ?? 0,
    })),
    zusatz_positionen: zusatz,
    summe_eur: r.betrag_gesamt_eur ?? 0,
    kaution_eur: b.kaution_soll_eur ?? 0,
    kaution_block,
    firma: FIRMA,
  };

  const html = renderRechnungHtml(context);
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
