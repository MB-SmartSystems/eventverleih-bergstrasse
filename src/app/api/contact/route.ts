/**
 * POST /api/contact — Anfrage-Formular-Endpoint
 *
 * Body (JSON):
 *   {
 *     vorname, nachname, email, telefon?, nachricht,
 *     agb_akzeptiert: boolean,
 *     cart_items?: Array<{ name, quantity }>
 *   }
 *
 * Verhalten:
 *   1. Validiert Pflichtfelder + DSGVO-Zustimmung
 *   2. Parallel: Kunde-Lookup + Artikel-Tabelle laden
 *   3. Kunde finden oder erstellen
 *   4. Cart-Items mit Artikel-Tabelle matchen → Preise berechnen
 *   5. Buchung mit aggregierten Preisen anlegen
 *   6. Parallel: Angebot, Buchungs_Position-Rows, MailQueue-Auto-Reply
 *   7. Compensating Action bei Fehler: alle bereits erstellten Rows zurueckrollen
 *   8. Antwortet mit Buchungs-ID + Angebot-Token
 *
 * n8n-MailQueue-Poll-Workflow versendet die Auto-Reply alle 60s.
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createRow, deleteRow, listRows, TABLES } from "@/lib/baserow/client";

interface CartItemPayload {
  name: string;
  quantity: number;
}

interface ContactPayload {
  vorname: string;
  nachname: string;
  email: string;
  telefon?: string;
  nachricht: string;
  agb_akzeptiert: boolean;
  cart_items?: CartItemPayload[];
}

interface KundenRow { id: number; Kunde_ID: number; Email: string }
interface BuchungRow { id: number; Buchung_ID: number }
interface AngebotRow { id: number; Angebot_ID: number; Token_Public: string }
interface ArtikelRow {
  id: number;
  Bezeichnung: string;
  Mietpreis_WE_Eur: string | null;
  Kaution_Pro_Stueck_Eur: string | null;
  Aufbau_Pauschale_Eur: string | null;
}

function validate(body: unknown): ContactPayload | string {
  if (!body || typeof body !== "object") return "Invalid body";
  const b = body as Partial<ContactPayload>;
  if (!b.vorname || typeof b.vorname !== "string" || b.vorname.length < 1) return "vorname required";
  if (!b.nachname || typeof b.nachname !== "string" || b.nachname.length < 1) return "nachname required";
  if (!b.email || typeof b.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) return "valid email required";
  if (!b.nachricht || typeof b.nachricht !== "string" || b.nachricht.length < 3) return "nachricht required";
  if (b.agb_akzeptiert !== true) return "agb_akzeptiert must be true";
  if (b.telefon !== undefined && typeof b.telefon !== "string") return "telefon must be string";
  if (b.cart_items !== undefined && !Array.isArray(b.cart_items)) return "cart_items must be array";
  return b as ContactPayload;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[äöüß]/g, (c) => ({ ä: "a", ö: "o", ü: "u", ß: "ss" }[c] || c))
    .replace(/×/g, "x") // Storefront-Catalog nutzt Unicode-Multiplikation, Baserow ASCII
    .trim();
}

function matchArtikel(cartName: string, artikel: ArtikelRow[]): ArtikelRow | null {
  const target = normalize(cartName);
  // 1. exact match
  let found = artikel.find((a) => normalize(a.Bezeichnung) === target);
  if (found) return found;
  // 2. contains match (z.B. "Faltzelt 3x6" → "Faltzelt 3x6 m")
  found = artikel.find((a) => normalize(a.Bezeichnung).includes(target) || target.includes(normalize(a.Bezeichnung)));
  if (found) return found;
  return null;
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
    const nowIso = new Date().toISOString();

    // === Schritt 1: parallele Reads (Kunden-Lookup + Artikel-Stamm)
    const kundenLookupPromise = (async () => {
      // pagination-aware Email-Match
      const targetEmail = payload.email.toLowerCase();
      let page = 1;
      while (true) {
        const existing = await listRows<KundenRow>(TABLES.Kunden, { search: payload.email, size: 200, page });
        const found = existing.results.find((k) => k.Email?.toLowerCase() === targetEmail);
        if (found) return found;
        if (existing.results.length < 200) return null;
        page++;
        if (page > 500) return null;
      }
    })();
    // Artikel-Stamm nur laden wenn Cart-Items vorhanden — sonst sparen wir den Call
    const artikelPromise = (payload.cart_items && payload.cart_items.length > 0)
      ? listRows<ArtikelRow>(TABLES.Artikel, { size: 200 }).then((r) => r.results)
      : Promise.resolve([] as ArtikelRow[]);

    const [foundKunde, artikel] = await Promise.all([kundenLookupPromise, artikelPromise]);

    // === Schritt 2: Kunde finden oder erstellen
    let kundeId: number;
    if (foundKunde) {
      kundeId = foundKunde.id;
    } else {
      const newKunde = await createRow<KundenRow>(TABLES.Kunden, {
        Kunde_Typ: "Privat",
        Vorname: payload.vorname,
        Nachname: payload.nachname,
        Email: payload.email,
        Telefon: payload.telefon || "",
        Notizen: "Selbstangelegt via /api/contact",
        Kunden_Status: "Aktiv",
        DSE_Akzeptiert_Version: "1.0",
        DSE_Akzeptiert_am: nowIso,
        AGB_Akzeptiert_Version: "2.0",
        AGB_Akzeptiert_am: nowIso,
        Marketing_Optin: false,
        Erstanfrage_am: today,
        Letzter_Kontakt_am: today,
        Stammkunde_Wertung: "Neu",
      });
      kundeId = newKunde.id;
      created.push({ table: TABLES.Kunden, id: kundeId });
    }

    // === Schritt 3: Cart-Items mit Artikel-Tabelle matchen + Preise berechnen
    interface MatchedItem {
      artikelId: number;
      bezeichnung: string;
      anzahl: number;
      einzelpreis: number;
      kaution_pro_stueck: number;
      aufbau_pauschale: number;
      position_summe: number;
    }
    const matched: MatchedItem[] = [];
    const unmatched: string[] = [];
    if (payload.cart_items) {
      for (const ci of payload.cart_items) {
        if (!ci.name || !ci.quantity || ci.quantity < 1) continue;
        const art = matchArtikel(ci.name, artikel);
        if (!art) {
          unmatched.push(`${ci.quantity}× ${ci.name}`);
          continue;
        }
        const ep = parseFloat(art.Mietpreis_WE_Eur || "0");
        const kps = parseFloat(art.Kaution_Pro_Stueck_Eur || "0");
        const ap = parseFloat(art.Aufbau_Pauschale_Eur || "0");
        matched.push({
          artikelId: art.id,
          bezeichnung: art.Bezeichnung,
          anzahl: ci.quantity,
          einzelpreis: ep,
          kaution_pro_stueck: kps,
          aufbau_pauschale: ap,
          position_summe: ep * ci.quantity,
        });
      }
    }
    const mietsumme = matched.reduce((s, m) => s + m.position_summe, 0);
    const kautionSumme = matched.reduce((s, m) => s + m.kaution_pro_stueck * m.anzahl, 0);

    // === Schritt 4: Buchung anlegen mit aggregierten Preisen
    const sharedToken = randomUUID();
    const buchung = await createRow<BuchungRow>(TABLES.Buchungen, {
      Status: "Anfrage",
      Status_Erweitert: "Anfrage",
      Standort_Typ: "Privatgrund_Kunde",
      Notizen: `Anfrage-Text:\n${payload.nachricht}${unmatched.length ? `\n\nNicht automatisch zugeordnet (manuell pruefen):\n${unmatched.join("\n")}` : ""}`,
      Kunde_Link: [kundeId],
      Token_Angebot: sharedToken,
      Token_Vertrag: sharedToken,
      Buchung_Quelle: "Formular",
      Wind_Warn_Pruefung: "nicht_geprueft",
      Standort_Bestaetigt: false,
      Helfer_Bestaetigt: false,
      // Preise nur setzen wenn Cart-Items zugeordnet wurden
      ...(matched.length > 0
        ? {
            Preis_Artikel: mietsumme.toFixed(2),
            Anzahlung_Soll_Eur: (mietsumme * 0.3).toFixed(2),
            Restzahlung_Soll_Eur: (mietsumme * 0.7).toFixed(2),
            Kaution_Soll_Eur: kautionSumme.toFixed(2),
            Gesamt: (mietsumme + kautionSumme).toFixed(2),
          }
        : {}),
    });
    created.push({ table: TABLES.Buchungen, id: buchung.id });

    // === Schritt 5: parallel — Angebot + Buchungs_Position[*] + MailQueue-Auto-Reply
    // Bei parallelen Inserts: jede erfolgreiche Row sofort in created tracken
    // (auch wenn andere parallel-Calls noch fehlschlagen koennten — Rollback braucht alle IDs)
    const publicUrl = `https://eventverleih-bergstrasse.de/angebot/${sharedToken}`;
    const angebotPromise = createRow<AngebotRow>(TABLES.Angebote, {
      Angebotsnummer: `EVE-${new Date().getFullYear()}-${String(buchung.id).padStart(4, "0")}`,
      Status: "Offen",
      Anfragetext: payload.nachricht,
      Anfragedatum: today,
      Buchung_Link: [buchung.id],
      Kunde_Link: [kundeId],
      Token_Public: sharedToken,
      Angebot_URL: publicUrl, // URL-Field → in Baserow direkt klickbar
      ...(matched.length > 0 ? { Gesamtpreis: (mietsumme + kautionSumme).toFixed(2) } : {}),
    }).then((a) => {
      created.push({ table: TABLES.Angebote, id: a.id });
      return a;
    });

    const positionsPromises = matched.map((m) =>
      createRow<{ id: number }>(TABLES.Buchungs_Position, {
        Name: `B${buchung.id}-${m.bezeichnung}`,
        Buchung_Link: [buchung.id],
        Artikel_Link: [m.artikelId],
        Anzahl: m.anzahl.toString(),
        Einzelpreis_Eur: m.einzelpreis.toFixed(2),
        Aufbau_gebucht: false,
        Aufbau_Pauschale_Snapshot_Eur: m.aufbau_pauschale.toFixed(2),
        Kaution_Pro_Stueck_Snapshot_Eur: m.kaution_pro_stueck.toFixed(2),
        Notizen: "Auto-erstellt aus Anfrage-Formular Cart",
      }).then((p) => {
        created.push({ table: TABLES.Buchungs_Position, id: p.id });
        return p;
      })
    );

    // Auto-Reply-Mail vorrendern (Variablen aufgeloest)
    const greeting = `Hallo ${payload.vorname} ${payload.nachname}`;
    const summary = matched.length
      ? matched.map((m) => `  ${m.anzahl}× ${m.bezeichnung}`).join("\n") +
        (unmatched.length ? `\n\nNicht eindeutig zuordbar (Manuel pruefe das):\n${unmatched.map((u) => `  ${u}`).join("\n")}` : "")
      : `${payload.nachricht}`;

    // Link in Mail nur wenn Preise schon berechnet sind (Cart-Match erfolgreich).
    // Sonst macht der Link wenig Sinn — Kunde sieht nur "Manuel meldet sich"-Hinweis.
    const linkBlock = matched.length > 0
      ? `\n\nIhr Angebot mit allen Preisen koennen Sie hier direkt online ansehen und bestaetigen:\n${publicUrl}\n`
      : "";

    const mailBody = `${greeting},

vielen Dank fuer Ihre Anfrage bei Eventverleih Bergstrasse. Ich habe Ihre Nachricht erhalten und melde mich in der Regel innerhalb von 24 Stunden mit einem konkreten Angebot und der Verfuegbarkeitsbestaetigung zurueck.

Was Sie angefragt haben:
${summary}${linkBlock}

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

    const mailQueuePromise = createRow<{ id: number }>(TABLES.MailQueue, {
      Erstellt_am: nowIso,
      Buchung_Link: [buchung.id],
      Kunde_Link: [kundeId],
      Template_Key: "anfrage_eingang",
      Subject: `Eingangsbestaetigung - Ihre Anfrage bei Eventverleih Bergstrasse`,
      Body: mailBody,
      Approval_Status: "Auto_Reply",
      Idempotency_Key: `B${buchung.id}-anfrage_eingang`, // stabil — kein timestamp
    }).then((m) => {
      created.push({ table: TABLES.MailQueue, id: m.id });
      return m;
    });

    const [angebot] = await Promise.all([angebotPromise, ...positionsPromises, mailQueuePromise]);

    return NextResponse.json(
      {
        ok: true,
        buchung_id: buchung.Buchung_ID,
        angebot_id: angebot.Angebot_ID,
        token_angebot: sharedToken,
        cart_matched: matched.length,
        cart_unmatched: unmatched.length,
      },
      { status: 200 }
    );
  } catch (e) {
    // Compensating Action: alle bereits erstellten Rows zurueckrollen (Child → Parent)
    for (const row of [...created].reverse()) {
      await deleteRow(row.table, row.id).catch(() => {
        // best-effort cleanup
      });
    }
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: "internal error", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
