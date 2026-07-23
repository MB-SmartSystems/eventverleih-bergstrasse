/**
 * POST /api/admin/angebot/[id]/neue-version
 *
 * Erstellt einen neuen Snapshot (v+1) aus den aktuellen Live-Daten der Buchung,
 * verschickt eine "Angebot aktualisiert"-Mail an den Kunden und setzt das Angebot
 * zurück auf Status="Versendet". Akzept_Snapshot bleibt erhalten, bis der Kunde
 * die neue Version bestätigt.
 */
import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { createRow, getRow, listRows, updateRow, TABLES } from "@/lib/baserow/client";
import { buildSnapshot } from "@/lib/angebot-snapshot";
import { buildAngebotAktualisiert } from "@/lib/eventverleih/mail-templates/build/angebot-versand";


export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const angebotId = parseInt(id, 10);
  if (!angebotId) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  let body: { anmerkung?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  try {
    type Angebot = {
      id: number;
      Angebotsnummer: string;
      Token_Public: string;
      Snapshot_Version: string | null;
      Buchung_Link: Array<{ id: number }>;
      Kunde_Link: Array<{ id: number }>;
    };
    type Buchung = {
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
    };
    type Kunde = {
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

    const angebot = await getRow<Angebot>(TABLES.Angebote, angebotId);
    const buchungId = angebot.Buchung_Link?.[0]?.id;
    const kundeId = angebot.Kunde_Link?.[0]?.id;
    if (!buchungId || !kundeId) {
      return NextResponse.json({ error: "Angebot unvollständig" }, { status: 422 });
    }
    const [buchung, kunde] = await Promise.all([
      getRow<Buchung>(TABLES.Buchungen, buchungId),
      getRow<Kunde>(TABLES.Kunden, kundeId),
    ]);

    const currentVersion = parseInt(angebot.Snapshot_Version ?? "0", 10) || 0;
    const nextVersion = currentVersion + 1;

    const snapshot = await buildSnapshot({
      version: nextVersion,
      buchungId,
      buchung,
      kunde,
    });

    await updateRow(TABLES.Angebote, angebotId, {
      Status: "Versendet",
      Angebotsdatum: new Date().toISOString().slice(0, 10),
      Snapshot_JSON: JSON.stringify(snapshot),
      Snapshot_Version: nextVersion,
      Snapshot_Erstellt_am: snapshot.erstellt_am,
      // Neue Version = vorige Annahme ist hinfällig, Kunde muss neu bestätigen. Sonst
      // bleibt Akzeptiert_am gesetzt und "Nachhaken" blockt mit "bereits angenommen".
      Akzeptiert_am: null,
    });

    // Buchungs-Status zurück auf Angebot_versendet (überschreibt evtl. "Reserviert" wenn schon akzeptiert
    // war — der Kunde muss neu bestätigen, Reservierung also auf Eis bis Re-Akzept).
    try {
      await updateRow(TABLES.Buchungen, buchungId, { Status_Erweitert: "Angebot_versendet" });
    } catch (e) {
      console.error("[neue-version] Buchungs-Status-Sync fehlgeschlagen:", e);
    }

    const publicUrl = `https://eventverleih-bergstrasse.de/angebot/${angebot.Token_Public}`;
    const mail = buildAngebotAktualisiert({
      kunde: { Vorname: kunde.Vorname, Nachname: kunde.Nachname },
      angebotsnummer: angebot.Angebotsnummer,
      nextVersion,
      preisArtikel: snapshot.preis_artikel,
      publicUrl,
      anmerkung: body.anmerkung,
    });

    await createRow(TABLES.MailQueue, {
      Erstellt_am: new Date().toISOString(),
      Buchung_Link: [buchungId],
      Kunde_Link: [kundeId],
      Template_Key: "angebot_aktualisiert",
      Subject: mail.subject,
      Body: mail.body,
      Approval_Status: "Approved",
      Idempotency_Key: `A${angebotId}-update-v${nextVersion}`,
    });

    return NextResponse.json({ ok: true, version: nextVersion, url: publicUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    console.error("[neue-version] failed:", msg);
    return NextResponse.json({ error: "internal error", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
