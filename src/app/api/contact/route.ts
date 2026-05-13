/**
 * POST /api/contact — Anfrage-Formular-Endpoint
 *
 * Body (JSON):
 *   { vorname, nachname, email, telefon?, nachricht, agb_akzeptiert }
 *
 * Verhalten:
 *   1. Validiert Pflichtfelder + DSGVO-Zustimmung
 *   2. Findet/erstellt Kunde anhand E-Mail-Match
 *   3. Erstellt Buchung (Status_Erweitert=Anfrage, Tokens, Quelle=Formular)
 *   4. Erstellt Angebot mit Public-Token
 *   5. Erstellt MailQueue-Eintrag (Auto_Reply, anfrage_eingang Template)
 *   6. Antwortet mit Buchungs-ID + Angebot-Token
 *
 * n8n-MailQueue-Poll-Workflow versendet die Auto-Reply alle 60s.
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createRow, deleteRow, listRows, TABLES } from "@/lib/baserow/client";

interface ContactPayload {
  vorname: string;
  nachname: string;
  email: string;
  telefon?: string;
  nachricht: string;
  agb_akzeptiert: boolean;
}

interface KundenRow {
  id: number;
  Kunde_ID: number;
  Email: string;
}

interface BuchungRow { id: number; Buchung_ID: number }
interface AngebotRow { id: number; Angebot_ID: number; Token_Public: string }

function validate(body: unknown): ContactPayload | string {
  if (!body || typeof body !== "object") return "Invalid body";
  const b = body as Partial<ContactPayload>;
  if (!b.vorname || typeof b.vorname !== "string" || b.vorname.length < 1) return "vorname required";
  if (!b.nachname || typeof b.nachname !== "string" || b.nachname.length < 1) return "nachname required";
  if (!b.email || typeof b.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) return "valid email required";
  if (!b.nachricht || typeof b.nachricht !== "string" || b.nachricht.length < 3) return "nachricht required";
  if (b.agb_akzeptiert !== true) return "agb_akzeptiert must be true";
  if (b.telefon !== undefined && typeof b.telefon !== "string") return "telefon must be string";
  return b as ContactPayload;
}

export async function POST(req: NextRequest) {
  let payload: ContactPayload;
  try {
    const v = validate(await req.json());
    if (typeof v === "string") return NextResponse.json({ error: v }, { status: 400 });
    payload = v;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // Tracking fuer Compensating Action bei Multi-Step-Fehler
  const created: { table: number; id: number }[] = [];

  try {
    const today = new Date().toISOString().slice(0, 10);

    // Kunde via Email-Match suchen — pagination-aware, kein Hard-Cap
    // (search-Term reduziert Treffer-Menge schon stark; full-table-scan unwahrscheinlich nötig)
    const targetEmail = payload.email.toLowerCase();
    let found: KundenRow | undefined;
    let page = 1;
    while (true) {
      const existing = await listRows<KundenRow>(TABLES.Kunden, { search: payload.email, size: 200, page });
      found = existing.results.find((k) => k.Email?.toLowerCase() === targetEmail);
      if (found) break;
      if (existing.results.length < 200) break;
      page++;
      if (page > 500) break; // safety-net gegen runaway-Loop, faktisch nie erreicht
    }
    let kundeId: number;
    let kundeWasCreated = false;
    if (found) {
      kundeId = found.id;
    } else {
      kundeWasCreated = true;
      const newKunde = await createRow<KundenRow>(TABLES.Kunden, {
        Kunde_Typ: "Privat",
        Vorname: payload.vorname,
        Nachname: payload.nachname,
        Email: payload.email,
        Telefon: payload.telefon || "",
        Notizen: "Selbstangelegt via /api/contact",
        Kunden_Status: "Aktiv",
        DSE_Akzeptiert_Version: "1.0",
        DSE_Akzeptiert_am: new Date().toISOString(),
        AGB_Akzeptiert_Version: "2.0",
        AGB_Akzeptiert_am: new Date().toISOString(),
        Marketing_Optin: false,
        Erstanfrage_am: today,
        Letzter_Kontakt_am: today,
        Stammkunde_Wertung: "Neu",
      });
      kundeId = newKunde.id;
      if (kundeWasCreated) created.push({ table: TABLES.Kunden, id: kundeId });
    }

    // Ein einziger Token für Angebot- und Vertrag-Public-Route (gleiche Customer-Journey-Stufe)
    const sharedToken = randomUUID();

    const buchung = await createRow<BuchungRow>(TABLES.Buchungen, {
      Status: "Anfrage",
      Status_Erweitert: "Anfrage",
      Standort_Typ: "Privatgrund_Kunde",
      Notizen: `Anfrage-Text:\n${payload.nachricht}`,
      "Kunde_Link": [kundeId],
      Token_Angebot: sharedToken,
      Token_Vertrag: sharedToken,
      Buchung_Quelle: "Formular",
      Wind_Warn_Pruefung: "nicht_geprueft",
      Standort_Bestaetigt: false,
      Helfer_Bestaetigt: false,
    });
    created.push({ table: TABLES.Buchungen, id: buchung.id });

    const angebot = await createRow<AngebotRow>(TABLES.Angebote, {
      Angebotsnummer: `EVE-${new Date().getFullYear()}-${String(buchung.id).padStart(4, "0")}`,
      Status: "Offen",
      Anfragetext: payload.nachricht,
      Anfragedatum: today,
      "Buchung_Link": [buchung.id],
      "Kunde_Link": [kundeId],
      Token_Public: sharedToken,
    });
    created.push({ table: TABLES.Angebote, id: angebot.id });

    // MailQueue-Eintrag fuer Auto-Reply (anfrage_eingang Template)
    const greeting = `Hallo ${payload.vorname} ${payload.nachname}`;
    const body = `${greeting},

vielen Dank fuer Ihre Anfrage bei Eventverleih Bergstrasse. Ich habe Ihre Nachricht erhalten und melde mich in der Regel innerhalb von 24 Stunden mit einem konkreten Angebot und der Verfuegbarkeitsbestaetigung zurueck.

Ihre Anfrage:
${payload.nachricht}

Falls Sie noch Fragen haben oder etwas ergaenzen moechten, antworten Sie einfach direkt auf diese Mail oder rufen Sie an unter +49 156 79521124 (auch WhatsApp).

Bis gleich,

Mit freundlichen Gruessen
Manuel Buettner

Eventverleih Bergstrasse
Schlesierstrasse 19a, 64665 Alsbach-Haehnlein
Tel/WhatsApp: +49 156 79521124
E-Mail: info@eventverleih-bergstrasse.de
Web: eventverleih-bergstrasse.de

Nicht umsatzsteuerpflichtig nach Paragraph 19 Abs. 1 UStG.`;

    await createRow(TABLES.MailQueue, {
      Erstellt_am: new Date().toISOString(),
      "Buchung_Link": [buchung.id],
      "Kunde_Link": [kundeId],
      Template_Key: "anfrage_eingang",
      Subject: `Eingangsbestaetigung - Ihre Anfrage bei Eventverleih Bergstrasse`,
      Body: body,
      Approval_Status: "Auto_Reply",
      Idempotency_Key: `B${buchung.id}-anfrage_eingang-${Date.now()}`,
    });

    return NextResponse.json(
      {
        ok: true,
        buchung_id: buchung.Buchung_ID,
        angebot_id: angebot.Angebot_ID,
        token_angebot: sharedToken,
      },
      { status: 200 }
    );
  } catch (e) {
    // Compensating Action: alle bereits erstellten Rows zurueckrollen (Child → Parent)
    for (const row of [...created].reverse()) {
      await deleteRow(row.table, row.id).catch(() => {
        // best-effort cleanup, kein Re-Throw
      });
    }
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: "internal error", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
