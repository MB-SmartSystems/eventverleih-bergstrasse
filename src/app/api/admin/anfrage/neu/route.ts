/**
 * POST /api/admin/anfrage/neu
 *
 * Body: {
 *   kunde_id: number,
 *   event_datum_von: string (YYYY-MM-DD),
 *   event_datum_bis: string,
 *   cart_items: Array<{ artikel_id: number, anzahl: number }>,
 *   notiz?: string
 * }
 *
 * Manuell-Anlage einer Anfrage durchs Backoffice (Plan Phase 5 C5).
 * Erzeugt Buchung + Buchungs_Position-Rows + Angebot — keine Auto-Reply-Mail.
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { isAuthenticated } from "@/lib/auth";
import { createRow, getRow, listRows, listAllRows, TABLES } from "@/lib/baserow/client";
import { rundeKaution } from "@/lib/eventverleih/constants";

interface CartItem { artikel_id: number; anzahl: number }
interface ArtikelRow {
  id: number;
  Bezeichnung: string;
  Mietpreis_WE_Eur: string | number | null;
  Kaution_Pro_Stueck_Eur: string | number | null;
  Aufbau_Pauschale_Eur: string | number | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 5;

function parseDec(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: {
    kunde_id?: number;
    kunde_neu?: { vorname?: string; nachname?: string; email?: string; telefon?: string };
    event_datum_von?: string;
    event_datum_bis?: string;
    cart_items?: CartItem[];
    notiz?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // Validation: entweder kunde_id ODER kunde_neu mit Pflichtfeldern
  let kundeId = Number(body.kunde_id || 0);
  const kundeNeu = body.kunde_neu;
  if (!kundeId && !kundeNeu) {
    return NextResponse.json({ error: "kunde_id oder kunde_neu erforderlich" }, { status: 400 });
  }
  if (!kundeId && kundeNeu) {
    if (!kundeNeu.vorname || !kundeNeu.nachname) {
      return NextResponse.json({ error: "kunde_neu.vorname und kunde_neu.nachname erforderlich" }, { status: 400 });
    }
    if (!kundeNeu.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(kundeNeu.email)) {
      return NextResponse.json({ error: "kunde_neu.email muss valide sein" }, { status: 400 });
    }
  }

  const von = body.event_datum_von || "";
  const bis = body.event_datum_bis || "";
  if (!ISO_DATE.test(von) || !ISO_DATE.test(bis)) {
    return NextResponse.json({ error: "event_datum_von/bis müssen YYYY-MM-DD sein" }, { status: 400 });
  }
  const today = new Date().toISOString().slice(0, 10);
  if (von < today) return NextResponse.json({ error: "event_datum_von in der Vergangenheit" }, { status: 400 });
  if (bis < von) return NextResponse.json({ error: "bis < von" }, { status: 400 });
  const days = Math.round((new Date(bis).getTime() - new Date(von).getTime()) / 86_400_000);
  if (days > MAX_RANGE_DAYS) {
    return NextResponse.json({ error: `Mietzeitraum max ${MAX_RANGE_DAYS} Tage` }, { status: 400 });
  }
  const items = Array.isArray(body.cart_items) ? body.cart_items : [];
  if (items.length === 0) return NextResponse.json({ error: "mindestens 1 cart_item" }, { status: 400 });

  try {
    // Wenn kunde_neu: erst Kunde anlegen mit Email-Duplikat-Check
    if (!kundeId && kundeNeu) {
      const targetEmail = kundeNeu.email!.toLowerCase().trim();
      const existing = await listRows<{ id: number; Email?: string }>(TABLES.Kunden, { search: targetEmail, size: 50 });
      const dup = existing.results.find((k) => (k.Email || "").toLowerCase() === targetEmail);
      if (dup) {
        // Statt zu blocken: bestehenden Kunden wiederverwenden
        kundeId = dup.id;
      } else {
        const todayShort = new Date().toISOString().slice(0, 10);
        const nowIsoShort = new Date().toISOString();
        const neu = await createRow<{ id: number }>(TABLES.Kunden, {
          Kunde_Typ: "Privat",
          Vorname: kundeNeu.vorname,
          Nachname: kundeNeu.nachname,
          Email: kundeNeu.email,
          Telefon: kundeNeu.telefon || "",
          Notizen: `Inline angelegt bei Manuell-Anfrage am ${todayShort}`,
          Kunden_Status: "Aktiv",
          DSE_Akzeptiert_Version: "1.0",
          DSE_Akzeptiert_am: nowIsoShort,
          AGB_Akzeptiert_Version: "2.0",
          AGB_Akzeptiert_am: nowIsoShort,
          Marketing_Optin: false,
          Erstanfrage_am: todayShort,
          Letzter_Kontakt_am: todayShort,
          Stammkunde_Wertung: "Neu",
        });
        kundeId = neu.id;
      }
    }

    // Kunde verifizieren (existiert?)
    const kundeRow = await getRow<{ id: number; Vorname?: string; Nachname?: string }>(TABLES.Kunden, kundeId);
    if (!kundeRow?.id) {
      return NextResponse.json({ error: "kunde_not_found" }, { status: 404 });
    }

    // Artikel laden + match
    const artikelAll = await listAllRows<ArtikelRow>(TABLES.Artikel);
    const artikelById = new Map(artikelAll.results.map((a) => [a.id, a]));

    let mietsumme = 0;
    let kautionSumme = 0;
    const matched: Array<{ artikelId: number; bezeichnung: string; anzahl: number; einzelpreis: number; kaution_pro_stueck: number; aufbau_pauschale: number; position_summe: number }> = [];
    for (const it of items) {
      const a = artikelById.get(Number(it.artikel_id));
      if (!a) {
        return NextResponse.json({ error: `Artikel ${it.artikel_id} nicht gefunden` }, { status: 400 });
      }
      const anzahl = Math.max(1, Math.floor(Number(it.anzahl) || 1));
      const einzelpreis = parseDec(a.Mietpreis_WE_Eur);
      const kps = parseDec(a.Kaution_Pro_Stueck_Eur);
      const ap = parseDec(a.Aufbau_Pauschale_Eur);
      const pos = einzelpreis * anzahl;
      mietsumme += pos;
      kautionSumme += kps * anzahl;
      matched.push({ artikelId: a.id, bezeichnung: a.Bezeichnung, anzahl, einzelpreis, kaution_pro_stueck: kps, aufbau_pauschale: ap, position_summe: pos });
    }

    const sharedToken = randomUUID();
    const created: { table: number; id: number }[] = [];

    // Buchung anlegen
    const buchung = await createRow<{ id: number; Buchung_ID: number }>(TABLES.Buchungen, {
      Status_Erweitert: "Anfrage",
      Standort_Typ: "Privatgrund_Kunde",
      Event_datum_von: von,
      Event_datum_bis: bis,
      Notizen: `Manuell-Anlage durch Backoffice am ${today}.${body.notiz ? `\n\nNotiz: ${body.notiz}` : ""}`,
      Kunde_Link: [kundeId],
      Token_Angebot: sharedToken,
      Token_Vertrag: sharedToken,
      Buchung_Quelle: "Backoffice",
      Wind_Warn_Pruefung: "nicht_geprueft",
      Standort_Bestaetigt: false,
      Helfer_Bestaetigt: false,
      Preis_Artikel: mietsumme.toFixed(2),
      Anzahlung_Soll_Eur: (mietsumme * 0.3).toFixed(2),
      Restzahlung_Soll_Eur: (mietsumme * 0.7).toFixed(2),
      Kaution_Soll_Eur: rundeKaution(kautionSumme).toFixed(2),
      Gesamt: (mietsumme + kautionSumme).toFixed(2),
    });
    created.push({ table: TABLES.Buchungen, id: buchung.id });

    // Buchungs_Position-Rows
    for (const m of matched) {
      try {
        const p = await createRow<{ id: number }>(TABLES.Buchungs_Position, {
          Name: `B${buchung.id}-${m.bezeichnung}`,
          Buchung_Link: [buchung.id],
          Artikel_Link: [m.artikelId],
          Anzahl: m.anzahl.toString(),
          Einzelpreis_Eur: m.einzelpreis.toFixed(2),
          Aufbau_gebucht: false,
          Aufbau_Pauschale_Snapshot_Eur: m.aufbau_pauschale.toFixed(2),
          Kaution_Pro_Stueck_Snapshot_Eur: m.kaution_pro_stueck.toFixed(2),
          Notizen: "Manuell durch Backoffice",
        });
        created.push({ table: TABLES.Buchungs_Position, id: p.id });
      } catch (e) {
        console.error("[anfrage-neu] Position-Anlage fehlgeschlagen:", e);
      }
    }

    // Angebot anlegen (Status Offen — wartet auf Manuel-Freigabe)
    const publicUrl = `https://eventverleih-bergstrasse.de/angebot/${sharedToken}`;
    const angebot = await createRow<{ id: number }>(TABLES.Angebote, {
      Angebotsnummer: `EVE-${new Date().getFullYear()}-${String(buchung.id).padStart(4, "0")}`,
      Status: "Offen",
      Anfragetext: body.notiz || "",
      Anfragedatum: today,
      Buchung_Link: [buchung.id],
      Kunde_Link: [kundeId],
      Token_Public: sharedToken,
      Angebot_URL: publicUrl,
      Gesamtpreis: (mietsumme + kautionSumme).toFixed(2),
    });
    created.push({ table: TABLES.Angebote, id: angebot.id });

    return NextResponse.json({
      ok: true,
      buchung_id: buchung.id,
      buchung_nr: buchung.Buchung_ID,
      angebot_id: angebot.id,
      token: sharedToken,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: "internal", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
