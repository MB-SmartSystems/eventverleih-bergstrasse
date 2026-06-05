/**
 * POST /api/admin/angebot/[id]/erneut-senden
 *
 * Schickt die Angebots-Mail UNVERÄNDERT erneut an den Kunden — für den Fall
 * "Kunde hat die Mail gelöscht / nicht erhalten". Im Gegensatz zu neue-version:
 *   - KEIN neuer Snapshot, KEINE Versionserhöhung
 *   - KEIN Status-Wechsel, KEINE Stripe-Links, KEIN PDF-Re-Render
 * Preise kommen aus dem eingefrorenen Snapshot (= das, was der Kunde auf der
 * Angebotsseite sieht), Fallback auf Live-Buchung wenn kein Snapshot existiert.
 */
import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { createRow, getRow, TABLES } from "@/lib/baserow/client";
import { parseSnapshot } from "@/lib/angebot-snapshot";
import { memberAutoLoginUrl } from "@/lib/eventverleih/member-auth";
import { UEBERGABE_HINWEIS } from "@/lib/eventverleih/constants";

const SIGNATURE = `\n\nMit freundlichen Grüßen\nManuel Büttner\n\nEventverleih Bergstraße\nSchlesierstraße 19a, 64665 Alsbach-Hähnlein\nTel/WhatsApp: +49 156 79521124\nE-Mail: info@eventverleih-bergstrasse.de\nWeb: eventverleih-bergstrasse.de\n\nNicht umsatzsteuerpflichtig nach § 19 Abs. 1 UStG.`;

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
      Status: { value: string } | null;
      Snapshot_JSON: string | null;
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
    type Kunde = {
      id: number;
      Vorname: string;
      Nachname: string;
      Email: string;
    };

    const angebot = await getRow<Angebot>(TABLES.Angebote, angebotId);
    const buchungId = angebot.Buchung_Link?.[0]?.id;
    const kundeId = angebot.Kunde_Link?.[0]?.id;
    if (!buchungId || !kundeId) {
      return NextResponse.json({ error: "Angebot unvollständig (Buchung/Kunde fehlt)" }, { status: 422 });
    }

    // Nur erneut senden, was schon mal rausging — Offen/Abgelehnt haben keine Kunden-Mail
    const status = angebot.Status?.value || "Offen";
    if (status === "Offen" || status === "Abgelehnt") {
      return NextResponse.json(
        { error: `Angebot ist "${status}" — es wurde noch keine Angebots-Mail versendet` },
        { status: 422 },
      );
    }

    const [buchung, kunde] = await Promise.all([
      getRow<Buchung>(TABLES.Buchungen, buchungId),
      getRow<Kunde>(TABLES.Kunden, kundeId),
    ]);

    // Preise aus dem Snapshot (= Kundenansicht), Fallback Live-Buchung
    const snapshot = parseSnapshot(angebot.Snapshot_JSON);
    const fmtNum = (n: number) => n.toFixed(2);
    const fmtStr = (v: string | null) => (v ? parseFloat(v).toFixed(2) : "0.00");
    const preise = snapshot
      ? {
          preisArtikel: fmtNum(snapshot.preis_artikel),
          anzahlung: fmtNum(snapshot.anzahlung_soll_eur),
          restzahlung: fmtNum(snapshot.restzahlung_soll_eur),
          kaution: fmtNum(snapshot.kaution_soll_eur),
        }
      : {
          preisArtikel: fmtStr(buchung.Preis_Artikel),
          anzahlung: fmtStr(buchung.Anzahlung_Soll_Eur),
          restzahlung: fmtStr(buchung.Restzahlung_Soll_Eur),
          kaution: fmtStr(buchung.Kaution_Soll_Eur),
        };

    // Auto-Login-Link fuer Mein-Bereich (fail-soft wie beim Erst-Versand)
    let meinBereichUrl = "";
    try {
      meinBereichUrl = await memberAutoLoginUrl(kundeId);
    } catch (e) {
      console.error("[erneut-senden] memberAutoLoginUrl fehlgeschlagen:", e);
    }

    const publicUrl = `https://eventverleih-bergstrasse.de/angebot/${angebot.Token_Public}`;
    const anmerkungBlock = body.anmerkung?.trim()
      ? `\n*Persönliche Anmerkung von Manuel:*\n${body.anmerkung.trim()}\n`
      : "";
    const memberBlock = meinBereichUrl
      ? `\n\nMein Bereich (alle Buchungen + Zahlungen + Rechnungen einsehen):\n${meinBereichUrl}`
      : "";

    const mailBody = `Hallo ${kunde.Vorname} ${kunde.Nachname},
${anmerkungBlock}
gerne senden wir Ihnen Ihr Angebot erneut zu:

*Preisübersicht:*
Mietsumme: ${preise.preisArtikel} EUR
Anzahlung bei Bestätigung (30 %): ${preise.anzahlung} EUR
Restzahlung bei Übergabe (70 %): ${preise.restzahlung} EUR
Kaution (nach Rückgabe vollständig erstattet): ${preise.kaution} EUR

Sie können das Angebot online ansehen und mit einem Klick bestätigen:
${publicUrl}

${UEBERGABE_HINWEIS}

Bei Fragen am schnellsten per WhatsApp: +49 156 79521124.${memberBlock}${SIGNATURE}`;

    await createRow(TABLES.MailQueue, {
      Erstellt_am: new Date().toISOString(),
      Buchung_Link: [buchungId],
      Kunde_Link: [kundeId],
      Template_Key: "angebot_erneut_gesendet",
      Subject: "Ihr Angebot von Eventverleih Bergstraße (erneut zugesendet)",
      Body: mailBody,
      Approval_Status: "Approved",
      // Zeitstempel im Key: jeder bewusste Klick = eigene Mail (Dedup nur gegen Doppel-Submit via UI)
      Idempotency_Key: `A${angebotId}-erneut-${Date.now()}`,
    });

    return NextResponse.json({ ok: true, email: kunde.Email, url: publicUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    console.error("[erneut-senden] failed:", msg);
    return NextResponse.json({ error: "internal error", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
