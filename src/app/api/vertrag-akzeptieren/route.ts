/**
 * POST /api/vertrag-akzeptieren
 *
 * Body: form-data oder JSON mit { token: string }
 *
 * Verhalten:
 *   1. Sucht Angebot-Row via Token_Public
 *   2. Updated Angebote.Status = Akzeptiert, Akzeptiert_am = now
 *   3. Updated Buchungen.Status_Erweitert = Bestaetigt
 *   4. Erstellt MailQueue-Eintrag fuer Vertrag-Bestaetigungs-Mail (Approval=Pending)
 *   5. Redirect zur Angebots-Seite (Status zeigt jetzt "akzeptiert")
 */
import { NextRequest, NextResponse } from "next/server";
import { createRow, getRow, listRows, updateRow, TABLES } from "@/lib/baserow/client";

async function handle(token: string, origin: string): Promise<NextResponse> {
  if (!token || typeof token !== "string" || token.length < 8) {
    return NextResponse.json({ error: "invalid token" }, { status: 400 });
  }

  try {
    const angebotList = await listRows<{
      id: number;
      Status: { value: string } | null;
      Buchung_Link: Array<{ id: number; value: string }>;
      Kunde_Link: Array<{ id: number; value: string }>;
      Token_Public: string;
    }>(TABLES.Angebote, { search: token, size: 5 });

    const angebot = angebotList.results.find((a) => a.Token_Public === token);
    if (!angebot) {
      return NextResponse.json({ error: "token nicht gefunden" }, { status: 404 });
    }

    const buchungId = angebot.Buchung_Link?.[0]?.id;
    const kundeId = angebot.Kunde_Link?.[0]?.id;

    // Orphan-Angebote ohne Buchung/Kunde duerfen NICHT akzeptiert werden
    if (!buchungId || !kundeId) {
      return NextResponse.json(
        { error: "Angebot unvollstaendig (keine Buchung/Kunde verlinkt). Bitte Manuel kontaktieren." },
        { status: 422 }
      );
    }

    // Updates IMMER laufen lassen — Baserow ist idempotent bei gleichem Wert (no-op-Write).
    // Verhindert dass nach partial-failure beim ersten POST ein Update silently uebersprungen wird.
    const alreadyAccepted = angebot.Status?.value === "Akzeptiert";
    await updateRow(TABLES.Angebote, angebot.id, {
      Status: "Akzeptiert",
      // Akzeptiert_am NUR setzen falls noch nicht akzeptiert (sonst original-Timestamp bewahren)
      ...(alreadyAccepted ? {} : { Akzeptiert_am: new Date().toISOString() }),
    });

    // Buchung-Update NUR fuer fruehe Workflow-Stati — nicht zurueckspringen
    // wenn Buchung schon weiter ist (Uebergeben/Zurueckgegeben/Abgerechnet/Storniert).
    const buchungFresh = await getRow<{ Status_Erweitert: { value: string } | null }>(
      TABLES.Buchungen,
      buchungId
    );
    const earlyStati = new Set([
      "Anfrage",
      "Angebot_erstellt",
      "Angebot_versendet",
      "Reserviert",
      "Bestaetigt",
    ]);
    const currentStatus = buchungFresh.Status_Erweitert?.value || "";
    if (!currentStatus || earlyStati.has(currentStatus)) {
      await updateRow(TABLES.Buchungen, buchungId, {
        Status: "Reserviert",
        Status_Erweitert: "Bestaetigt",
      });
    }
    // Sonst: Buchung ist bereits weiter im Workflow — keine Regression erlauben.

    // MailQueue-Insert IMMER versuchen (auch bei alreadyAccepted=true) —
    // deckt den Fall ab, dass erster POST nach Status-Update aber vor MailQueue-Insert gefailt ist.
    // Idempotency-Key stabil → kein Duplicate.
    {
      // MailQueue: Vertrag-Bestaetigungs-Mail (mit Manuel-Approval)
      const subject = "Reservierung bestaetigt - Eventverleih Bergstrasse";
      const body = `Hallo,

grossartig - Ihre Reservierung ist bestaetigt. Damit ist Ihr Termin verbindlich vorgemerkt.

Naechste Schritte:
1. Anzahlung von 30 Prozent bitte innerhalb von 7 Tagen ueberweisen oder per PayPal an:
   IBAN: DE84 5001 0517 5420 4742 10
   PayPal: info@eventverleih-bergstrasse.de
2. Restzahlung und Kaution folgen bei Uebergabe - gerne bar, per Ueberweisung oder PayPal.

Etwa 7 Tage vor dem Event melde ich mich fuer die finale Abstimmung von Uebergabe-Ort und -Zeit.

Bei Fragen jederzeit per WhatsApp oder Anruf erreichbar: +49 156 79521124.

Mit freundlichen Gruessen
Manuel Buettner

Eventverleih Bergstrasse
Schlesierstrasse 19a, 64665 Alsbach-Haehnlein
Tel/WhatsApp: +49 156 79521124
E-Mail: info@eventverleih-bergstrasse.de

Nicht umsatzsteuerpflichtig nach Paragraph 19 Abs. 1 UStG.`;

      // Idempotency_Key STABIL (Buchung + Template) — bei Double-Submit kein 2. Eintrag,
      // weil Baserow keinen Unique-Constraint hat aber wir Pre-Check machen
      const idemKey = `B${buchungId}-vertrag_bestaetigung`;
      const existing = await listRows<{ id: number; Idempotency_Key: string }>(TABLES.MailQueue, {
        search: idemKey,
        size: 5,
      });
      const duplicate = existing.results.find((r) => r.Idempotency_Key === idemKey);
      if (!duplicate) {
        await createRow(TABLES.MailQueue, {
          Erstellt_am: new Date().toISOString(),
          "Buchung_Link": [buchungId],
          "Kunde_Link": [kundeId],
          Template_Key: "vertrag_bestaetigung",
          Subject: subject,
          Body: body,
          Approval_Status: "Pending",
          Idempotency_Key: idemKey,
        });
      }
    }

    return NextResponse.redirect(new URL(`/angebot/${token}?bestaetigt=1`, origin), 303);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: "internal error", detail: msg.slice(0, 300) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let token = "";
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    token = body.token || "";
  } else {
    const fd = await req.formData();
    token = String(fd.get("token") || "");
  }
  return handle(token, req.nextUrl.origin);
}
