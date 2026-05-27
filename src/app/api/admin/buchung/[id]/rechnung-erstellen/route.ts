/**
 * POST /api/admin/buchung/[id]/rechnung-erstellen
 *
 * Erstellt eine komplette Rechnung (kein Anzahlung/Schluss-Split).
 *
 * Ablauf:
 *  1. Lädt Buchung + Kunde + Positionen
 *  2. Berechnet Gesamtsumme (Artikel + Lieferung + Abholung + Aufbau + Abbau, OHNE Kaution)
 *  3. Generiert Rechnungsnummer RG-YYYY-NNNN
 *  4. Erstellt Public-Token (UUIDv4)
 *  5. Legt Rechnung-Row in Baserow an (Status=Gesendet, Typ=Komplett)
 *  6. Triggert n8n-Webhook eve-rechnung-pdf-mail mit { rechnung_id }
 *  7. Antwortet sofort {ok, rechnung_id, token, url}
 *
 * Der n8n-Workflow rendert HTML → Gotenberg → PDF, lädt das PDF zu
 * Vercel Blob hoch, aktualisiert Rechnungen.PDF_URL und versendet die
 * Mail mit Attachment.
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { isAuthenticated } from "@/lib/auth";
import { createRow, getRow, listRows, listAllRows, TABLES } from "@/lib/baserow/client";
import { triggerPdfRender } from "@/lib/eventverleih/pdf-render";

type BuchungRow = {
  id: number;
  Buchung_ID: number;
  Event_datum_von: string | null;
  Event_datum_bis: string | null;
  Preis_Artikel: string | null;
  Preis_Lieferung: string | null;
  Preis_Abholung: string | null;
  Preis_Aufbau: string | null;
  Preis_Abbau: string | null;
  Kaution_Soll_Eur: string | null;
  Status_Erweitert: { value: string } | null;
  Kunde_Link: Array<{ id: number }>;
};

type RechnungRow = {
  id: number;
  Rechnungsnummer: string;
  Rechnungsdatum: string | null;
};

function num(v: string | null | undefined): number {
  return parseFloat(v ?? "0") || 0;
}

function nextRechnungsnummer(year: number, existing: RechnungRow[]): string {
  const prefix = `RG-${year}-`;
  let max = 0;
  for (const r of existing) {
    if (!r.Rechnungsnummer?.startsWith(prefix)) continue;
    const m = r.Rechnungsnummer.slice(prefix.length).match(/^(\d+)/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const buchungId = parseInt(id, 10);
  if (!buchungId) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  try {
    const buchung = await getRow<BuchungRow>(TABLES.Buchungen, buchungId);
    const kundeId = buchung.Kunde_Link?.[0]?.id;
    if (!kundeId) {
      return NextResponse.json({ error: "Buchung hat keinen Kunden" }, { status: 422 });
    }

    // §14 Abs. 4 Nr. 1 UStG: Empfänger-Anschrift Pflicht. Daher Kunde komplett laden + prüfen.
    type Kunde = {
      id: number;
      Vorname: string;
      Nachname: string;
      Firma: string | null;
      Adresse_Strasse: string;
      Adresse_PLZ: string;
      Adresse_Ort: string;
    };
    const kunde = await getRow<Kunde>(TABLES.Kunden, kundeId);
    const missing: string[] = [];
    if (!kunde.Vorname?.trim() && !kunde.Nachname?.trim()) missing.push("Name");
    if (!kunde.Adresse_Strasse?.trim()) missing.push("Straße");
    if (!kunde.Adresse_PLZ?.trim()) missing.push("PLZ");
    if (!kunde.Adresse_Ort?.trim()) missing.push("Ort");
    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: `Kunde unvollständig — fehlt: ${missing.join(", ")}. Bitte erst im Kunden-Dashboard ergänzen.`,
        },
        { status: 422 }
      );
    }

    const summe =
      num(buchung.Preis_Artikel) +
      num(buchung.Preis_Lieferung) +
      num(buchung.Preis_Abholung) +
      num(buchung.Preis_Aufbau) +
      num(buchung.Preis_Abbau);
    if (summe <= 0) {
      return NextResponse.json({ error: "Keine Preise gesetzt — Rechnung würde 0,00 € lauten" }, { status: 422 });
    }

    // Rechnungsnummer
    const existing = await listRows<RechnungRow>(TABLES.Rechnungen, { size: 500 });
    const year = new Date().getFullYear();
    const rechnungsnummer = nextRechnungsnummer(year, existing.results);
    const token = randomUUID();
    const heute = new Date().toISOString().slice(0, 10);
    const faelligkeit = new Date(Date.now() + 14 * 86400 * 1000).toISOString().slice(0, 10);

    // GoBD-Snapshot: alle relevanten Daten zum Rechnungs-Zeitpunkt einfrieren
    type Position = {
      id: number;
      Anzahl: string | null;
      Einzelpreis_Eur: string | null;
      Position_Gesamt_Eur: string | null;
      Artikel_Link: Array<{ id: number; value: string }> | null;
      Buchung_Link: Array<{ id: number }> | null;
    };
    const positionenAll = await listAllRows<Position>(TABLES.Buchungs_Position);
    const positionen = positionenAll.results
      .filter((p) => p.Buchung_Link?.[0]?.id === buchungId)
      .map((p) => ({
        artikel: p.Artikel_Link?.[0]?.value || "Artikel",
        anzahl: parseFloat(p.Anzahl ?? "0"),
        einzelpreis_eur: parseFloat(p.Einzelpreis_Eur ?? "0"),
        gesamt_eur: parseFloat(p.Position_Gesamt_Eur ?? "0"),
      }));

    const snapshot = {
      schema_version: 1,
      gobd_frozen_at: new Date().toISOString(),
      kunde: {
        anrede_form: kunde.Firma ? "firma" : "person",
        firma: kunde.Firma || null,
        vorname: kunde.Vorname,
        nachname: kunde.Nachname,
        adresse_strasse: kunde.Adresse_Strasse,
        adresse_plz: kunde.Adresse_PLZ,
        adresse_ort: kunde.Adresse_Ort,
      },
      buchung: {
        buchung_id: buchung.Buchung_ID,
        event_datum_von: buchung.Event_datum_von,
        event_datum_bis: buchung.Event_datum_bis,
        preis_artikel_eur: num(buchung.Preis_Artikel),
        preis_lieferung_eur: num(buchung.Preis_Lieferung),
        preis_abholung_eur: num(buchung.Preis_Abholung),
        preis_aufbau_eur: num(buchung.Preis_Aufbau),
        preis_abbau_eur: num(buchung.Preis_Abbau),
        kaution_soll_eur: num(buchung.Kaution_Soll_Eur),
      },
      positionen,
      rechnung: {
        rechnungsnummer,
        rechnungsdatum: heute,
        faelligkeit,
        betrag_netto_eur: summe,
        betrag_ust_eur: 0,
        betrag_gesamt_eur: summe,
        ust_satz: 0,
        ust_hinweis: "Nicht umsatzsteuerpflichtig nach § 19 Abs. 1 UStG.",
      },
    };

    const created = await createRow<RechnungRow>(TABLES.Rechnungen, {
      Rechnungsnummer: rechnungsnummer,
      Rechnungsdatum: heute,
      Typ_Erweitert: "Komplett",
      Status: "Gesendet",
      Betrag_Netto: summe,
      Betrag_USt: 0,
      Betrag_Gesamt: summe,
      USt_Satz: 0,
      Mahnstufe: "keine",
      Buchung_Link: [buchungId],
      Kunde_Link: [kundeId],
      Token_Public: token,
      Snapshot_JSON: JSON.stringify(snapshot),
    });

    // n8n-Webhook triggern (fire-and-await mit kurzem Timeout, damit Server-Action nicht hängt)
    const webhookUrl = process.env.N8N_RECHNUNG_PDF_URL;
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rechnung_id: created.id, faelligkeit }),
          signal: AbortSignal.timeout(10_000),
        });
      } catch (e) {
        // PDF-Render läuft asynchron — Fehler hier blockieren nicht die Rechnungs-Erstellung
        console.error("n8n rechnung-pdf webhook failed", e);
      }
    }

    // Render-Flow fuer den In-Portal-Download (Blob + Rechnungen.PDF_URL). Unabhaengig
    // vom Mail-Workflow oben, fail-soft (no-op wenn N8N_PDF_RENDER_URL nicht gesetzt).
    await triggerPdfRender({ table: "rechnung", id: created.id, token });

    return NextResponse.json({
      ok: true,
      rechnung_id: created.id,
      rechnungsnummer,
      token,
      url: `https://eventverleih-bergstrasse.de/rechnung/${token}`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    const stack = e instanceof Error ? e.stack : undefined;
    console.error("[rechnung-erstellen] failed:", msg, stack);
    return NextResponse.json({ error: "internal error", detail: msg.slice(0, 500) }, { status: 500 });
  }
}
