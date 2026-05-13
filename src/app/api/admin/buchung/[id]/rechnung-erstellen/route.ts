/**
 * POST /api/admin/buchung/[id]/rechnung-erstellen
 *
 * Erstellt eine komplette Rechnung (kein Anzahlung/Schluss-Split).
 *
 * Ablauf:
 *  1. Lädt Buchung + Kunde + Positionen
 *  2. Berechnet Gesamtsumme (Artikel + Lieferung + Aufbau + Abbau, OHNE Kaution)
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
import { createRow, getRow, listRows, TABLES } from "@/lib/baserow/client";

type BuchungRow = {
  id: number;
  Buchung_ID: number;
  Event_datum_von: string | null;
  Event_datum_bis: string | null;
  Preis_Artikel: string | null;
  Preis_Lieferung: string | null;
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

    const summe =
      num(buchung.Preis_Artikel) +
      num(buchung.Preis_Lieferung) +
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
