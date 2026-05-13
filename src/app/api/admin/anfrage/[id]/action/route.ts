/**
 * POST /api/admin/anfrage/[id]/action
 *
 * Body: { action: "freigeben" | "freigeben_anmerkung" | "rueckruf" | "ablehnen", anmerkung?: string }
 *
 * id = Angebote.id (Baserow row id)
 *
 * Verhalten:
 *   - Lädt Angebot + Buchung + Kunde
 *   - Updated Status
 *   - Erstellt MailQueue-Row mit Approval_Status=Approved
 *   - MailQueue-Poll versendet innerhalb 60s
 */
import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { createRow, getRow, updateRow, TABLES } from "@/lib/baserow/client";

type Action = "freigeben" | "freigeben_anmerkung" | "rueckruf" | "ablehnen";

interface ActionBody {
  action: Action;
  anmerkung?: string;
}

const SIGNATURE = `\n\nMit freundlichen Gruessen\nManuel Buettner\n\nEventverleih Bergstrasse\nSchlesierstrasse 19a, 64665 Alsbach-Haehnlein\nTel/WhatsApp: +49 156 79521124\nE-Mail: info@eventverleih-bergstrasse.de\nWeb: eventverleih-bergstrasse.de\n\nNicht umsatzsteuerpflichtig nach Paragraph 19 Abs. 1 UStG.`;

function buildAngebotsMail(opts: {
  vorname: string;
  nachname: string;
  preisArtikel: string;
  anzahlung: string;
  restzahlung: string;
  kaution: string;
  angebotUrl: string;
  anmerkung?: string;
}): { subject: string; body: string } {
  const greeting = `Hallo ${opts.vorname} ${opts.nachname}`;
  const anmerkungBlock = opts.anmerkung
    ? `\n*Persoenliche Anmerkung von Manuel:*\n${opts.anmerkung}\n`
    : "";
  return {
    subject: "Ihr Angebot von Eventverleih Bergstrasse",
    body: `${greeting},
${anmerkungBlock}
vielen Dank fuer Ihre Anfrage. Hier ist Ihr Angebot:

*Preisuebersicht:*
Mietsumme: ${opts.preisArtikel} EUR
Anzahlung bei Bestaetigung (30 %): ${opts.anzahlung} EUR
Restzahlung bei Uebergabe (70 %): ${opts.restzahlung} EUR
Kaution (nach Rueckgabe vollstaendig erstattet): ${opts.kaution} EUR

Sie koennen das Angebot online ansehen und mit einem Klick bestaetigen:
${opts.angebotUrl}

Das Angebot ist 14 Tage gueltig. Bei Fragen am schnellsten per WhatsApp: +49 156 79521124.${SIGNATURE}`,
  };
}

function buildRueckrufMail(opts: { vorname: string; nachname: string }): { subject: string; body: string } {
  return {
    subject: "Ihre Anfrage bei Eventverleih Bergstrasse - kurze Rueckfrage",
    body: `Hallo ${opts.vorname} ${opts.nachname},

vielen Dank fuer Ihre Anfrage. Damit ich Ihnen ein passendes Angebot machen kann, moechte ich gerne kurz mit Ihnen sprechen - meist sind 3-5 Minuten ausreichend, um alle Details zu klaeren.

Koennen wir kurz telefonieren? Sie erreichen mich werktags am besten unter +49 156 79521124 (auch WhatsApp).

Alternativ rufe ich Sie zurueck - lassen Sie mich einfach wissen, wann es Ihnen passt.${SIGNATURE}`,
  };
}

function buildAblehnenMail(opts: { vorname: string; nachname: string }): { subject: string; body: string } {
  return {
    subject: "Ihre Anfrage bei Eventverleih Bergstrasse",
    body: `Hallo ${opts.vorname} ${opts.nachname},

vielen Dank fuer Ihre Anfrage. Leider kann ich Ihnen kein Angebot fuer diesen Termin machen.

Falls Sie noch andere Termine in Erwaegung ziehen oder Fragen haben, melden Sie sich gerne - vielleicht finden wir doch eine Loesung. Sie erreichen mich werktags am besten unter +49 156 79521124 (auch WhatsApp).

Ich wuensche Ihnen viel Erfolg bei Ihrer Feier und stehe fuer zukuenftige Anfragen jederzeit zur Verfuegung.${SIGNATURE}`,
  };
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const angebotId = parseInt(id, 10);
  if (!angebotId) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  let body: ActionBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const validActions: Action[] = ["freigeben", "freigeben_anmerkung", "rueckruf", "ablehnen"];
  if (!validActions.includes(body.action)) {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }
  if (body.action === "freigeben_anmerkung" && (!body.anmerkung || body.anmerkung.trim().length < 2)) {
    return NextResponse.json({ error: "anmerkung required for freigeben_anmerkung" }, { status: 400 });
  }

  try {
    type Angebot = {
      id: number;
      Angebotsnummer: string;
      Token_Public: string;
      Buchung_Link: Array<{ id: number }>;
      Kunde_Link: Array<{ id: number }>;
    };
    type Buchung = {
      id: number;
      Preis_Artikel: string | null;
      Anzahlung_Soll_Eur: string | null;
      Restzahlung_Soll_Eur: string | null;
      Kaution_Soll_Eur: string | null;
    };
    type Kunde = { id: number; Vorname: string; Nachname: string };

    const angebot = await getRow<Angebot>(TABLES.Angebote, angebotId);
    const buchungId = angebot.Buchung_Link?.[0]?.id;
    const kundeId = angebot.Kunde_Link?.[0]?.id;
    if (!buchungId || !kundeId) {
      return NextResponse.json({ error: "Anfrage unvollständig (Buchung/Kunde fehlt)" }, { status: 422 });
    }

    const [buchung, kunde] = await Promise.all([
      getRow<Buchung>(TABLES.Buchungen, buchungId),
      getRow<Kunde>(TABLES.Kunden, kundeId),
    ]);

    const publicUrl = `https://eventverleih-bergstrasse.de/angebot/${angebot.Token_Public}`;
    let mail: { subject: string; body: string };
    let newStatus: string;
    let templateKey: string;

    const fmt = (v: string | null) => (v ? parseFloat(v).toFixed(2) : "0.00");

    if (body.action === "freigeben" || body.action === "freigeben_anmerkung") {
      mail = buildAngebotsMail({
        vorname: kunde.Vorname,
        nachname: kunde.Nachname,
        preisArtikel: fmt(buchung.Preis_Artikel),
        anzahlung: fmt(buchung.Anzahlung_Soll_Eur),
        restzahlung: fmt(buchung.Restzahlung_Soll_Eur),
        kaution: fmt(buchung.Kaution_Soll_Eur),
        angebotUrl: publicUrl,
        anmerkung: body.anmerkung,
      });
      newStatus = "Versendet";
      templateKey = body.action === "freigeben_anmerkung" ? "angebot_freigegeben_anmerkung" : "angebot_freigegeben";
    } else if (body.action === "rueckruf") {
      mail = buildRueckrufMail({ vorname: kunde.Vorname, nachname: kunde.Nachname });
      newStatus = "Offen"; // bleibt offen, wartet auf Telefonat
      templateKey = "rueckruf_vorschlag";
    } else {
      // ablehnen
      mail = buildAblehnenMail({ vorname: kunde.Vorname, nachname: kunde.Nachname });
      newStatus = "Abgelehnt";
      templateKey = "anfrage_abgelehnt";
    }

    // Angebote-Status updaten
    const today = new Date().toISOString().slice(0, 10);
    const updateData: Record<string, unknown> = { Status: newStatus };
    if (newStatus === "Versendet") updateData.Angebotsdatum = today;
    if (newStatus === "Abgelehnt") {
      updateData.Abgelehnt_am = new Date().toISOString();
      updateData.Abgelehnt_Grund = "Manuel-Entscheidung im Dashboard";
    }
    await updateRow(TABLES.Angebote, angebotId, updateData);

    // MailQueue-Row anlegen (Approved → Poll versendet)
    await createRow(TABLES.MailQueue, {
      Erstellt_am: new Date().toISOString(),
      Buchung_Link: [buchungId],
      Kunde_Link: [kundeId],
      Template_Key: templateKey,
      Subject: mail.subject,
      Body: mail.body,
      Approval_Status: "Approved",
      Idempotency_Key: `A${angebotId}-${templateKey}`,
    });

    return NextResponse.json({ ok: true, new_status: newStatus, template: templateKey });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: "internal error", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
