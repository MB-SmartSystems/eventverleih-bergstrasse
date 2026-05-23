/**
 * /admin/angebot/[id]/preview — Vorschau der nächsten Angebots-Version
 *
 * Baut einen virtuellen Snapshot (nextVersion = currentVersion + 1) aus den
 * aktuellen Live-Daten der verlinkten Buchung + Kunde + Positionen — ohne
 * Snapshot_JSON in Baserow zu schreiben und ohne MailQueue-Eintrag. Rendert
 * dieselbe Komponente wie /angebot/[token], damit Manuel pixelgleich sieht,
 * was der Kunde nach Klick auf "📧 Neue Version senden" angezeigt bekommt.
 *
 * Auth: Admin-Cookie (gleicher Mechanismus wie alle anderen /admin/-Routes).
 */
import { redirect, notFound } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { getRow, TABLES } from "@/lib/baserow/client";
import { buildSnapshot } from "@/lib/angebot-snapshot";
import AngebotView from "@/components/angebot/AngebotView";

type AngebotRow = {
  id: number;
  Angebotsnummer: string;
  Token_Public: string;
  Status: { value: string } | null;
  Snapshot_Version: string | null;
  Akzept_Version: string | null;
  Akzeptiert_am: string | null;
  Buchung_Link: Array<{ id: number }>;
  Kunde_Link: Array<{ id: number }>;
};

type BuchungRow = {
  id: number;
  Event_datum_von: string | null;
  Event_datum_bis: string | null;
  Preis_Artikel: string | null;
  Preis_Lieferung: string | null;
  Preis_Abholung: string | null;
  Preis_Aufbau: string | null;
  Preis_Abbau: string | null;
  Anzahlung_Soll_Eur: string | null;
  Restzahlung_Soll_Eur: string | null;
  Kaution_Soll_Eur: string | null;
  Lieferadresse: string | null;
  Anzahlung_Bezahlt_am: string | null;
  Stripe_Anzahlung_Link: string | null;
  Stripe_Komplettzahlung_Link: string | null;
};

type KundeRow = {
  id: number;
  Vorname: string;
  Nachname: string;
  Firma: string;
  Email: string;
  Telefon: string;
  Adresse_Strasse: string;
  Adresse_PLZ: string;
  Adresse_Ort: string;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AngebotPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAuthenticated())) {
    redirect("/admin");
  }
  const { id } = await params;
  const angebotId = parseInt(id, 10);
  if (!angebotId) notFound();

  const angebot = await getRow<AngebotRow>(TABLES.Angebote, angebotId).catch(() => null);
  if (!angebot) notFound();
  const buchungId = angebot.Buchung_Link?.[0]?.id;
  const kundeId = angebot.Kunde_Link?.[0]?.id;
  if (!buchungId || !kundeId) notFound();

  const [buchung, kunde] = await Promise.all([
    getRow<BuchungRow>(TABLES.Buchungen, buchungId),
    getRow<KundeRow>(TABLES.Kunden, kundeId),
  ]);

  const currentVersion = parseInt(angebot.Snapshot_Version ?? "0", 10) || 0;
  const nextVersion = currentVersion + 1;
  const akzeptVersion = parseInt(angebot.Akzept_Version ?? "0", 10) || 0;

  // Virtuell — kein DB-Write
  const snapshot = await buildSnapshot({
    version: nextVersion,
    buchungId,
    buchung,
    kunde,
  });

  // Simuliere den Zustand wie nach POST .../neue-version:
  // Status → "Versendet", Snapshot_Version → nextVersion. Akzept_Version bleibt unverändert.
  const statusVal = "Versendet";
  const hasUpdateBanner = nextVersion > 0 && akzeptVersion > 0 && nextVersion > akzeptVersion;

  const anrede = `${snapshot.kunde.vorname} ${snapshot.kunde.nachname}`;
  const preisArtikel = snapshot.preis_artikel.toString();
  const preisLieferung = snapshot.preis_lieferung.toString();
  const preisAbholung = (snapshot.preis_abholung ?? 0).toString();
  const preisAufbau = snapshot.preis_aufbau.toString();
  const anzahlungSoll = snapshot.anzahlung_soll_eur.toString();
  const restzahlungSoll = snapshot.restzahlung_soll_eur.toString();
  const kautionSoll = snapshot.kaution_soll_eur.toString();
  const displayPositions = snapshot.positionen.map((p, i) => ({
    id: i,
    bezeichnung: p.bezeichnung,
    anzahl: p.anzahl,
    einzelpreis: p.einzelpreis,
    gesamt: p.gesamt,
  }));
  const hasPrices = parseFloat(preisArtikel) > 0;

  return (
    <AngebotView
      mode="admin-preview"
      token={angebot.Token_Public}
      angebotsnummer={angebot.Angebotsnummer}
      anrede={anrede}
      statusVal={statusVal}
      snapshotVersion={nextVersion}
      hasUpdateBanner={hasUpdateBanner}
      eventVon={snapshot.event_datum_von}
      eventBis={snapshot.event_datum_bis}
      hasPrices={hasPrices}
      displayPositions={displayPositions}
      preisArtikel={preisArtikel}
      preisLieferung={preisLieferung}
      preisAbholung={preisAbholung}
      preisAufbau={preisAufbau}
      anzahlungSoll={anzahlungSoll}
      restzahlungSoll={restzahlungSoll}
      kautionSoll={kautionSoll}
      akzeptiertAm={angebot.Akzeptiert_am}
      anzahlungBezahltAm={buchung.Anzahlung_Bezahlt_am}
      stripeAnzahlungLink={buchung.Stripe_Anzahlung_Link}
      stripeKomplettzahlungLink={buchung.Stripe_Komplettzahlung_Link}
      preisArtikelLive={buchung.Preis_Artikel ?? "0"}
      preisLieferungLive={buchung.Preis_Lieferung ?? "0"}
      preisAbholungLive={buchung.Preis_Abholung ?? "0"}
      preisAufbauLive={buchung.Preis_Aufbau ?? "0"}
      kundeForAccept={{
        Vorname: kunde.Vorname ?? "",
        Nachname: kunde.Nachname ?? "",
        Email: kunde.Email ?? "",
        Telefon: kunde.Telefon ?? "",
        Adresse_Strasse: kunde.Adresse_Strasse ?? "",
        Adresse_PLZ: kunde.Adresse_PLZ ?? "",
        Adresse_Ort: kunde.Adresse_Ort ?? "",
      }}
      previewVersion={nextVersion}
    />
  );
}
