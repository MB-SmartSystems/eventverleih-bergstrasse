/**
 * POST /api/admin/angebot/[id]/nachhaken
 *
 * Freundliche Nachhak-Mail für ein bereits versendetes Angebot, auf das der Kunde
 * noch nicht reagiert hat ("Hast du dir das Angebot überlegt? Bei Bestätigung
 * Anzahlung → erst dann sind die Artikel reserviert").
 *
 * Im Gegensatz zu action(freigeben) / neue-version:
 *   - KEIN Status-Wechsel, KEIN neuer Snapshot, KEINE Stripe-Links, KEIN PDF-Re-Render
 *   - reine Erinnerung; Preise kommen aus dem eingefrorenen Snapshot (= Kundenansicht),
 *     Fallback Live-Buchung
 *   - Angebots-URL ist der Kern (Kunde kann mit einem Klick bestätigen + zahlen)
 */
import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { createRow, getRow, updateRow, TABLES } from "@/lib/baserow/client";
import { parseSnapshot } from "@/lib/angebot-snapshot";
import { memberAutoLoginUrl } from "@/lib/eventverleih/member-auth";
import { formatGermanShort } from "@/lib/eventverleih/constants";

const SIGNATURE = `\n\nMit freundlichen Grüßen\nManuel Büttner\n\nEventverleih Bergstraße\nSchlesierstraße 19a, 64665 Alsbach-Hähnlein\nTel/WhatsApp: +49 156 79521124\nE-Mail: info@eventverleih-bergstrasse.de\nWeb: eventverleih-bergstrasse.de\n\nNicht umsatzsteuerpflichtig nach § 19 Abs. 1 UStG.`;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const angebotId = parseInt(id, 10);
  if (!angebotId) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  try {
    type Angebot = {
      id: number;
      Angebotsnummer: string;
      Token_Public: string;
      Status: { value: string } | null;
      Akzeptiert_am: string | null;
      Nachgehakt_am: string | null;
      Snapshot_JSON: string | null;
      Buchung_Link: Array<{ id: number }>;
      Kunde_Link: Array<{ id: number }>;
    };
    type Buchung = {
      id: number;
      Event_datum_von: string | null;
      Preis_Artikel: string | null;
      Anzahlung_Soll_Eur: string | null;
      Restzahlung_Soll_Eur: string | null;
      Kaution_Soll_Eur: string | null;
    };
    type Kunde = { id: number; Vorname: string; Nachname: string; Email: string };

    const angebot = await getRow<Angebot>(TABLES.Angebote, angebotId);
    const buchungId = angebot.Buchung_Link?.[0]?.id;
    const kundeId = angebot.Kunde_Link?.[0]?.id;
    if (!buchungId || !kundeId) {
      return NextResponse.json({ error: "Angebot unvollständig (Buchung/Kunde fehlt)" }, { status: 422 });
    }

    // Nachhaken nur bei versendeten, noch offenen Angeboten. Offen/Abgelehnt/Abgelaufen
    // haben (noch) keine Kunden-Mail bzw. sind abgeschlossen; akzeptierte brauchen kein Nachhaken.
    const status = angebot.Status?.value || "Offen";
    if (status !== "Versendet") {
      return NextResponse.json(
        { error: `Angebot ist "${status}" — Nachhaken nur bei versendeten, offenen Angeboten möglich` },
        { status: 422 },
      );
    }
    if (angebot.Akzeptiert_am) {
      return NextResponse.json({ error: "Angebot wurde bereits angenommen" }, { status: 422 });
    }
    // Cooldown: nicht öfter als alle 3 Tage nachhaken (sonst nervt es Kunde + dich)
    if (angebot.Nachgehakt_am) {
      const tage = Math.floor((Date.now() - new Date(angebot.Nachgehakt_am).getTime()) / 86_400_000);
      if (tage < 3) {
        return NextResponse.json(
          { error: `Erst vor ${tage} Tag(en) nachgehakt — bitte mindestens 3 Tage warten` },
          { status: 429 },
        );
      }
    }

    const [buchung, kunde] = await Promise.all([
      getRow<Buchung>(TABLES.Buchungen, buchungId),
      getRow<Kunde>(TABLES.Kunden, kundeId),
    ]);

    // Auto-Login-Link für Mein-Bereich (fail-soft wie überall sonst)
    let meinBereichUrl = "";
    try {
      meinBereichUrl = await memberAutoLoginUrl(kundeId);
    } catch (e) {
      console.error("[nachhaken] memberAutoLoginUrl fehlgeschlagen:", e);
    }
    const memberBlock = meinBereichUrl
      ? `\n\nMein Bereich (alle Buchungen + Zahlungen + Rechnungen einsehen):\n${meinBereichUrl}`
      : "";

    const publicUrl = `https://eventverleih-bergstrasse.de/angebot/${angebot.Token_Public}`;
    const datumStr = buchung.Event_datum_von ? ` am ${formatGermanShort(buchung.Event_datum_von)}` : "";

    const mailBody = `Hallo ${kunde.Vorname} ${kunde.Nachname},

vor einigen Tagen habe ich Ihnen Ihr Angebot für Ihren Termin${datumStr} zugeschickt – ich wollte kurz nachfragen, ob alles passt oder ob noch Fragen offen sind.

Falls Sie es annehmen möchten: Sie können das Angebot online mit einem Klick bestätigen und direkt die Anzahlung (30 %) leisten. Erst damit sind die Artikel für Ihren Termin verbindlich reserviert – bis dahin kann sie leider auch jemand anderes anfragen.

Angebot ansehen und bestätigen:
${publicUrl}

Sollte sich Ihr Plan geändert haben, ist das natürlich auch in Ordnung – eine kurze Rückmeldung genügt, dann lege ich die Anfrage zu den Akten.

Bei Fragen am schnellsten per WhatsApp: +49 156 79521124.${memberBlock}${SIGNATURE}`;

    await createRow(TABLES.MailQueue, {
      Erstellt_am: new Date().toISOString(),
      Buchung_Link: [buchungId],
      Kunde_Link: [kundeId],
      Template_Key: "angebot_nachhaken",
      Subject: "Kurze Rückfrage zu Ihrem Angebot – Eventverleih Bergstraße",
      Body: mailBody,
      Approval_Status: "Approved",
      // Zeitstempel im Key: jeder bewusste Klick = eigene Mail (Dedup nur gegen Doppel-Submit)
      Idempotency_Key: `A${angebotId}-nachhaken-${Date.now()}`,
    });

    // Nachhak-Datum für Cooldown + Anzeige merken (fail-soft — Mail ist das Wichtige)
    try {
      await updateRow(TABLES.Angebote, angebotId, {
        Nachgehakt_am: new Date().toISOString().slice(0, 10),
      });
    } catch (e) {
      console.error("[nachhaken] Nachgehakt_am-Update fehlgeschlagen:", e);
    }

    return NextResponse.json({ ok: true, email: kunde.Email, url: publicUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    console.error("[nachhaken] failed:", msg);
    return NextResponse.json({ error: "internal error", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
