/**
 * POST /api/member/buchung/[id]/storno
 *
 * Body: { confirm: true }
 *
 * Member-Storno: Auth via member_session Cookie, prueft dass Buchung dem Kunde gehoert,
 * berechnet Stornogebuehr aus 4-Stufen-Staffel, setzt Status=Storniert, schickt Mail an
 * Kunde + Telegram an Manuel (KEIN Auto-Stripe-Refund — Manuel triggert manuell wegen
 * Live-Charge-Sicherheit).
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/eventverleih/member-auth";
import { berechneStorno } from "@/lib/eventverleih/storno";
import { getRow, createRow, updateRow, TABLES } from "@/lib/baserow/client";

export const dynamic = "force-dynamic";

interface BuchungData {
  id: number;
  Status_Erweitert: { value: string } | null;
  Event_datum_von: string | null;
  Event_datum_bis: string | null;
  Preis_Artikel: string | number | null;
  Preis_Lieferung: string | number | null;
  Preis_Abholung: string | number | null;
  Preis_Aufbau: string | number | null;
  Zahlungen_JSON: string | null;
  Kunde_Link: Array<{ id: number; value: string }> | null;
}

function parseDec(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const kunde = await getCurrentMember();
  if (!kunde) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const buchungId = parseInt(id, 10);
  if (!buchungId) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  try {
    const buchung = await getRow<BuchungData>(TABLES.Buchungen, buchungId);
    // Auth-Check: gehoert Buchung dem eingeloggten Kunden?
    if (buchung.Kunde_Link?.[0]?.id !== kunde.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const status = buchung.Status_Erweitert?.value || "";
    if (["Storniert", "Abgerechnet", "Zurueckgegeben", "Uebergeben", "In_Miete", "No_Show"].includes(status)) {
      return NextResponse.json({ error: "buchung_nicht_stornierbar", status }, { status: 422 });
    }

    // Mietsumme + bereits bezahlt
    const mietsumme = parseDec(buchung.Preis_Artikel) + parseDec(buchung.Preis_Lieferung) + parseDec(buchung.Preis_Abholung) + parseDec(buchung.Preis_Aufbau);
    let bezahlt = 0;
    try {
      if (buchung.Zahlungen_JSON) {
        const arr = JSON.parse(buchung.Zahlungen_JSON);
        if (Array.isArray(arr)) {
          bezahlt = arr
            .filter((z) => z.typ === "anzahlung" || z.typ === "restzahlung")
            .reduce((s, z) => s + (typeof z.betrag === "number" ? z.betrag : 0), 0);
        }
      }
    } catch { /* ignore */ }

    const calc = berechneStorno({
      eventDatumVon: buchung.Event_datum_von,
      mietsummeEur: mietsumme,
      bereitsBezahltEur: bezahlt,
    });

    const stufeLabel = `${calc.stornogebuehr_prozent}%`;

    // Status auf Storniert + Storno-Felder
    await updateRow(TABLES.Buchungen, buchungId, {
      Status_Erweitert: "Storniert",
      Storno_am: new Date().toISOString().slice(0, 10),
      Storno_Stufe: stufeLabel,
      Storno_Betrag_Eur: calc.stornogebuehr_eur,
      Storno_Grund: "Kunde_Selbst",
    });

    // Mail an Kunde
    const erstattungText = calc.erstattung_eur > 0
      ? `Sie erhalten ${calc.erstattung_eur.toFixed(2)} EUR zurück. Die Überweisung erfolgt in den nächsten 5 Werktagen.`
      : calc.nachzahlung_eur > 0
        ? `Die Stornogebühr ist höher als Ihre Anzahlung. Bitte überweisen Sie ${calc.nachzahlung_eur.toFixed(2)} EUR an unsere Kontoverbindung.`
        : `Es ist keine Erstattung fällig (kostenfreie Stornierung).`;

    const mailBody = `Hallo ${kunde.Vorname || ""} ${kunde.Nachname || ""},

Ihre Stornierung der Buchung #${buchungId} ist eingegangen.

Stornogebühr (laut AGB): ${calc.stornogebuehr_prozent} % der Mietsumme
  ${calc.staffel_label}
  Mietsumme: ${mietsumme.toFixed(2)} EUR
  Stornogebühr: ${calc.stornogebuehr_eur.toFixed(2)} EUR
  Bereits bezahlt: ${bezahlt.toFixed(2)} EUR

${erstattungText}

Bei Rückfragen melden Sie sich gerne per WhatsApp/Tel +49 156 79521124.

Mit freundlichen Grüßen
Manuel Büttner — Eventverleih Bergstrasse`;

    try {
      await createRow(TABLES.MailQueue, {
        Erstellt_am: new Date().toISOString(),
        Buchung_Link: [buchungId],
        Kunde_Link: [kunde.id],
        Template_Key: "storno_bestaetigung",
        Subject: `Stornierung Ihrer Buchung #${buchungId} — Eventverleih Bergstrasse`,
        Body: mailBody,
        Approval_Status: "Auto_Reply",
        Idempotency_Key: `B${buchungId}-storno-mail`,
      });
    } catch (e) {
      console.error("[member-storno] mail-queue insert fehlgeschlagen:", e);
    }

    // Telegram-Push an Manuel: Refund manuell triggern!
    const notifyUrl = process.env.N8N_STORNO_NOTIFY_URL || process.env.N8N_ANFRAGE_NOTIFY_URL || "";
    if (notifyUrl) {
      try {
        await fetch(notifyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "kunde_storno",
            buchung_id: buchungId,
            kunde_name: `${kunde.Vorname} ${kunde.Nachname}`,
            kunde_email: kunde.Email,
            mietsumme: mietsumme.toFixed(2),
            bereits_bezahlt: bezahlt.toFixed(2),
            stornogebuehr_prozent: calc.stornogebuehr_prozent,
            stornogebuehr_eur: calc.stornogebuehr_eur.toFixed(2),
            erstattung_eur: calc.erstattung_eur.toFixed(2),
            nachzahlung_eur: calc.nachzahlung_eur.toFixed(2),
            tage_bis_event: calc.tage_bis_event,
            hinweis: calc.erstattung_eur > 0
              ? "Manueller Stripe-Refund noetig — sicherheitshalber nicht automatisch ausgeloest"
              : "Keine Erstattung faellig",
          }),
          signal: AbortSignal.timeout(5000),
        });
      } catch (e) {
        console.error("[member-storno] notify fehlgeschlagen:", e);
      }
    }

    return NextResponse.json({ ok: true, calc });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    console.error("[member-storno]", msg);
    return NextResponse.json({ error: "internal", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
