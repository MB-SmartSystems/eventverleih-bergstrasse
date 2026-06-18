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
import { createRow, deleteRow, listRows, updateRow, TABLES } from "@/lib/baserow/client";
import { getAvailability } from "@/lib/eventverleih/availability";
import { memberAutoLoginUrl } from "@/lib/eventverleih/member-auth";
import { rundeKaution } from "@/lib/eventverleih/constants";
import { matchByName } from "@/lib/eventverleih/artikel-match";

interface CartItemPayload {
  name: string;
  quantity: number;
}

interface ContactPayload {
  vorname: string;
  nachname: string;
  email: string;
  telefon?: string;
  adresse_strasse?: string;
  adresse_plz?: string;
  adresse_ort?: string;
  event_datum_von: string;
  event_datum_bis: string;
  nachricht: string;
  agb_akzeptiert: boolean;
  cart_items?: CartItemPayload[];
  // Phase 8.5: Aufbau-Komplettpaket + Lieferung/Abholung
  aufbau_komplett?: boolean;
  lieferung_gewuenscht?: boolean;
  abholung_gewuenscht?: boolean;
  liefer_strasse?: string;
  liefer_hausnr?: string;
  distance_km?: number | null;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 5;

interface KundenRow {
  id: number;
  Kunde_ID: number;
  Email: string;
  Telefon?: string;
  Adresse_Strasse?: string;
  Adresse_PLZ?: string;
  Adresse_Ort?: string;
}
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
  if (b.adresse_strasse !== undefined && typeof b.adresse_strasse !== "string") return "adresse_strasse must be string";
  if (b.adresse_plz !== undefined && typeof b.adresse_plz !== "string") return "adresse_plz must be string";
  if (b.adresse_ort !== undefined && typeof b.adresse_ort !== "string") return "adresse_ort must be string";
  if (b.cart_items !== undefined && !Array.isArray(b.cart_items)) return "cart_items must be array";

  if (!b.event_datum_von || typeof b.event_datum_von !== "string" || !ISO_DATE_RE.test(b.event_datum_von)) {
    return "event_datum_von erforderlich (Format YYYY-MM-DD)";
  }
  if (!b.event_datum_bis || typeof b.event_datum_bis !== "string" || !ISO_DATE_RE.test(b.event_datum_bis)) {
    return "event_datum_bis erforderlich (Format YYYY-MM-DD)";
  }
  const today = new Date().toISOString().slice(0, 10);
  if (b.event_datum_von < today) return "event_datum_von darf nicht in der Vergangenheit liegen";
  if (b.event_datum_bis < b.event_datum_von) return "event_datum_bis muss >= event_datum_von sein";
  const von = new Date(b.event_datum_von);
  const bis = new Date(b.event_datum_bis);
  const days = Math.round((bis.getTime() - von.getTime()) / 86_400_000);
  if (days > MAX_RANGE_DAYS) return `Mietzeitraum darf maximal ${MAX_RANGE_DAYS} Tage betragen`;

  return b as ContactPayload;
}

// Matching (exact → contains → token-sort) lebt zentral in artikel-match.ts.
// Token-Stufe ist Pflicht: "Gewicht — Metallplatte" (Shop) ↔ "Metallplatten-Gewicht" (Baserow).
function matchArtikel(cartName: string, artikel: ArtikelRow[]): ArtikelRow | null {
  return matchByName(cartName, artikel, (a) => a.Bezeichnung);
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
      // Bestehenden Kunden mit neuen Stammdaten anreichern, aber NICHT überschreiben
      const patch: Record<string, unknown> = {};
      if (!foundKunde.Telefon?.trim() && payload.telefon?.trim()) patch.Telefon = payload.telefon;
      if (!foundKunde.Adresse_Strasse?.trim() && payload.adresse_strasse?.trim()) patch.Adresse_Strasse = payload.adresse_strasse;
      if (!foundKunde.Adresse_PLZ?.trim() && payload.adresse_plz?.trim()) patch.Adresse_PLZ = payload.adresse_plz;
      if (!foundKunde.Adresse_Ort?.trim() && payload.adresse_ort?.trim()) patch.Adresse_Ort = payload.adresse_ort;
      patch.Letzter_Kontakt_am = today;
      if (Object.keys(patch).length > 0) {
        try {
          await updateRow(TABLES.Kunden, kundeId, patch);
        } catch (e) {
          // nicht-fatal — Anfrage soll trotzdem durchlaufen
          console.error("[contact] Kunde-Update fehlgeschlagen:", e);
        }
      }
    } else {
      const newKunde = await createRow<KundenRow>(TABLES.Kunden, {
        Kunde_Typ: "Privat",
        Vorname: payload.vorname,
        Nachname: payload.nachname,
        Email: payload.email,
        Telefon: payload.telefon || "",
        Adresse_Strasse: payload.adresse_strasse || "",
        Adresse_PLZ: payload.adresse_plz || "",
        Adresse_Ort: payload.adresse_ort || "",
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
      auf_anfrage: boolean;
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
          auf_anfrage: false, // wird nach Availability-Check gesetzt
        });
      }
    }
    const mietsumme = matched.reduce((s, m) => s + m.position_summe, 0);
    const kautionSumme = rundeKaution(matched.reduce((s, m) => s + m.kaution_pro_stueck * m.anzahl, 0));
    const aufbauSumme = payload.aufbau_komplett
      ? matched.reduce((s, m) => s + m.aufbau_pauschale * m.anzahl, 0)
      : 0;

    // Lieferung + Abholung: 2 €/km pro Service
    const distKm = typeof payload.distance_km === "number" && payload.distance_km > 0 ? payload.distance_km : 0;
    const billKm = Math.ceil(distKm); // angefangene km voll berechnen
    const lieferpreis = payload.lieferung_gewuenscht && distKm > 0 ? billKm * 2 : 0;
    const abholpreis = payload.abholung_gewuenscht && distKm > 0 ? billKm * 2 : 0;
    const lieferGesamt = lieferpreis + abholpreis;

    // Lieferadresse als Text fuer Baserow
    const lieferStrasse = (payload.liefer_strasse || "").trim();
    const lieferHausnr = (payload.liefer_hausnr || "").trim();
    const lieferAktiv = payload.lieferung_gewuenscht || payload.abholung_gewuenscht;
    const lieferadresseStr = lieferAktiv && lieferStrasse
      ? `${lieferStrasse} ${lieferHausnr}, ${payload.adresse_plz || ""}`.trim()
      : null;

    // === Safety-Net: Verfuegbarkeits-Check fuer alle gematchten Artikel
    // Falls inzwischen jemand anderes hart-reserviert hat (Stripe-Anzahlung), lehnen wir die
    // Anfrage ab mit klarem Hinweis welche Artikel nicht verfuegbar sind.
    // Items mit on_request=true zaehlen als verfuegbar (Bestand_Bestellbar=true Pattern).
    if (matched.length > 0) {
      try {
        const availMap = await getAvailability(
          matched.map((m) => m.artikelId),
          payload.event_datum_von,
          payload.event_datum_bis,
        );
        // on_request-Flag pro Item snapshot'en fuer Position-Marker
        for (const m of matched) {
          m.auf_anfrage = availMap.get(m.artikelId)?.on_request ?? false;
        }
        const ausgebucht = matched.filter((m) => availMap.get(m.artikelId)?.available === false);
        if (ausgebucht.length > 0) {
          const namen = ausgebucht.map((m) => m.bezeichnung).join(", ");
          return NextResponse.json(
            {
              error: "artikel_nicht_verfuegbar",
              detail: `Im gewuenschten Zeitraum nicht verfuegbar: ${namen}. Bitte aus dem Warenkorb entfernen oder Datum aendern.`,
              unavailable: ausgebucht.map((m) => ({ artikel_id: m.artikelId, name: m.bezeichnung })),
            },
            { status: 409 },
          );
        }
      } catch (e) {
        // Fail-soft: Verfuegbarkeits-Check darf den Anfrage-Submit nicht killen wenn Baserow lahmt.
        console.error("[contact] Verfuegbarkeits-Check fehlgeschlagen, fahre fort:", e);
      }
    }

    // === Schritt 4: Buchung anlegen mit aggregierten Preisen
    const sharedToken = randomUUID();
    // Anzahlung 30 % auf Mietsumme + Aufbau + Lieferung (NICHT Kaution).
    const anzahlungBasis = mietsumme + aufbauSumme + lieferGesamt;
    const anzahlungSoll = anzahlungBasis * 0.3;
    const restzahlungSoll = anzahlungBasis - anzahlungSoll;
    const lieferDetails: string[] = [];
    if (payload.aufbau_komplett && aufbauSumme > 0) {
      lieferDetails.push(`Aufbau-Service: ${aufbauSumme.toFixed(2)} EUR`);
    }
    if (payload.lieferung_gewuenscht) {
      lieferDetails.push(`Lieferung gewuenscht (${billKm} km, ${lieferpreis.toFixed(2)} EUR)`);
    }
    if (payload.abholung_gewuenscht) {
      lieferDetails.push(`Abholung gewuenscht (${billKm} km, ${abholpreis.toFixed(2)} EUR)`);
    }
    if (lieferadresseStr) {
      lieferDetails.push(`Event-Adresse: ${lieferadresseStr}`);
    }
    const notizenBlock = [
      `Anfrage-Text:\n${payload.nachricht}`,
      lieferDetails.length > 0 ? `\nZusatzleistungen:\n${lieferDetails.join("\n")}` : "",
      unmatched.length ? `\nNicht automatisch zugeordnet (manuell pruefen):\n${unmatched.join("\n")}` : "",
    ].join("");

    const buchung = await createRow<BuchungRow>(TABLES.Buchungen, {
      Status_Erweitert: "Anfrage",
      Standort_Typ: lieferAktiv ? "Privatgrund_Kunde" : "Privatgrund_Kunde",
      Event_datum_von: payload.event_datum_von,
      Event_datum_bis: payload.event_datum_bis,
      Notizen: notizenBlock,
      Kunde_Link: [kundeId],
      Token_Angebot: sharedToken,
      Token_Vertrag: sharedToken,
      Buchung_Quelle: "Formular",
      Wind_Warn_Pruefung: "nicht_geprueft",
      Standort_Bestaetigt: false,
      Helfer_Bestaetigt: false,
      ...(lieferadresseStr ? { Lieferadresse: lieferadresseStr } : {}),
      ...(payload.aufbau_komplett && aufbauSumme > 0 ? { Aufbau_gewuenscht: "Ja", Preis_Aufbau: aufbauSumme.toFixed(2) } : {}),
      ...(lieferpreis > 0 ? { Preis_Lieferung: lieferpreis.toFixed(2) } : {}),
      ...(abholpreis > 0 ? { Preis_Abholung: abholpreis.toFixed(2) } : {}),
      // Preise nur setzen wenn Cart-Items zugeordnet wurden
      ...(matched.length > 0
        ? {
            Preis_Artikel: mietsumme.toFixed(2),
            Anzahlung_Soll_Eur: anzahlungSoll.toFixed(2),
            Restzahlung_Soll_Eur: restzahlungSoll.toFixed(2),
            Kaution_Soll_Eur: kautionSumme.toFixed(2),
            Gesamt: (anzahlungBasis + kautionSumme).toFixed(2),
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
        Auf_Anfrage_Bei_Buchung: m.auf_anfrage,
        Notizen: m.auf_anfrage
          ? "Auto-erstellt aus Anfrage-Formular Cart. ITEM AUF BESTELLUNG — bitte Beschaffung pruefen."
          : "Auto-erstellt aus Anfrage-Formular Cart",
      }).then((p) => {
        created.push({ table: TABLES.Buchungs_Position, id: p.id });
        return p;
      })
    );

    // Auto-Reply-Mail: nur Eingangsbestätigung — KEIN Link, KEINE Preise.
    // Kunde bekommt erst nach Manuel-Telegram-Freigabe die Angebots-Mail.
    const greeting = `Hallo ${payload.vorname} ${payload.nachname}`;
    const summary = matched.length
      ? matched.map((m) => `  ${m.anzahl}× ${m.bezeichnung}`).join("\n") +
        (unmatched.length ? `\n\nWeitere Wuensche: ${unmatched.join(", ")}` : "")
      : `${payload.nachricht}`;
    const fmtDe = (iso: string) => {
      const [y, m, d] = iso.split("-");
      return `${d}.${m}.${y}`;
    };
    const zeitraum = `${fmtDe(payload.event_datum_von)} bis ${fmtDe(payload.event_datum_bis)}`;

    // Auto-Login-Link fuer Mein-Bereich (Token wird einmal pro Kunde generiert/rotiert)
    let meinBereichUrl = "";
    try {
      meinBereichUrl = await memberAutoLoginUrl(kundeId);
    } catch (e) {
      console.error("[contact] memberAutoLoginUrl fehlgeschlagen:", e);
    }

    const mailBody = `${greeting},

vielen Dank für Ihre Anfrage bei Eventverleih Bergstraße. Ich habe Ihre Nachricht erhalten und melde mich in der Regel innerhalb von 24 Stunden mit einem konkreten Angebot und der Verfügbarkeitsbestätigung zurück.

Gewünschter Mietzeitraum:
  ${zeitraum}

Was Sie angefragt haben:
${summary}

Hinweis: Wir vermieten standardmäßig zur Selbstabholung an unserem Treffpunkt (Grillhütte Sandwiese / Freizeitanlage in Alsbach-Hähnlein). Den genauen Übergabe-Termin sprechen wir telefonisch ab. Falls Sie Lieferung oder Aufbau brauchen, gehen wir im Angebot konkret darauf ein.${meinBereichUrl ? `

Mein Bereich (Buchung jederzeit einsehen, Status nachverfolgen, später Rechnung herunterladen):
${meinBereichUrl}` : ""}

Falls Sie noch Fragen haben oder etwas ergänzen möchten, antworten Sie einfach direkt auf diese Mail oder rufen Sie an unter +49 156 79521124 (auch WhatsApp).

Bis gleich,

Mit freundlichen Grüßen
Manuel Büttner

Eventverleih Bergstraße
Schlesierstraße 19a, 64665 Alsbach-Hähnlein
Tel/WhatsApp: +49 156 79521124
E-Mail: info@eventverleih-bergstrasse.de
Web: eventverleih-bergstrasse.de

Nicht umsatzsteuerpflichtig nach § 19 Abs. 1 UStG.`;

    const mailQueuePromise = createRow<{ id: number }>(TABLES.MailQueue, {
      Erstellt_am: nowIso,
      Buchung_Link: [buchung.id],
      Kunde_Link: [kundeId],
      Template_Key: "anfrage_eingang",
      Subject: `Eingangsbestätigung - Ihre Anfrage bei Eventverleih Bergstraße`,
      Body: mailBody,
      Approval_Status: "Auto_Reply",
      Idempotency_Key: `B${buchung.id}-anfrage_eingang`, // stabil — kein timestamp
    }).then((m) => {
      created.push({ table: TABLES.MailQueue, id: m.id });
      return m;
    });

    const [angebot] = await Promise.all([angebotPromise, ...positionsPromises, mailQueuePromise]);

    // === Schritt 6: Telegram-Notification an Manuel (fire-and-forget, blockt Response nicht)
    // Failure dieser Notification soll Anfrage NICHT in 500 verwandeln
    // Unmatched Items MUESSEN in der Telegram-Notification auftauchen — sonst geht ein
    // Angebot ohne diese Positionen raus (passiert bei B28: 6× Metallgewicht fehlte).
    const unmatchedWarnung = unmatched.length
      ? `\n\nNICHT ZUGEORDNET — manuell pruefen:\n${unmatched.map((u) => `${u} ?!`).join("\n")}`
      : "";
    const cartSummary = (matched.length
      ? matched.map((m) => `${m.anzahl}× ${m.bezeichnung} (${m.einzelpreis.toFixed(2)} €)`).join("\n")
      : payload.nachricht.slice(0, 300)) + unmatchedWarnung;

    // Vercel Serverless killt fire-and-forget nach Response-Return — daher AWAITEN.
    // Latenz +200-500 ms ist akzeptabel weil Manuel-Notification kritisch ist.
    const notifyUrl = process.env.N8N_ANFRAGE_NOTIFY_URL || "";
    if (notifyUrl) {
      try {
        await fetch(notifyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            buchung_id: buchung.Buchung_ID,
            angebot_id: angebot.id, // Baserow Row-ID (nicht Angebot_ID-autonumber)
            kunde_name: `${payload.vorname} ${payload.nachname}`,
            kunde_email: payload.email,
            kunde_telefon: payload.telefon || "",
            event_datum_von: payload.event_datum_von,
            event_datum_bis: payload.event_datum_bis,
            zeitraum_display: zeitraum,
            cart_summary: cartSummary,
            preise_berechnet: matched.length > 0,
            mietsumme: mietsumme.toFixed(2),
            anzahlung: anzahlungSoll.toFixed(2),
            kaution: kautionSumme.toFixed(2),
            aufbau: aufbauSumme.toFixed(2),
            lieferung: lieferGesamt.toFixed(2),
            angebot_url: publicUrl,
          }),
          signal: AbortSignal.timeout(5000),
        });
      } catch {
        // Telegram-Down? Anfrage steht trotzdem in Baserow. Manuel sieht sie im Dashboard.
      }
    }

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
