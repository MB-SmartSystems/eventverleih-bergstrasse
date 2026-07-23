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
import { buildStornoBestaetigung } from "@/lib/eventverleih/mail-templates/build/anfrage-und-member";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/eventverleih/member-auth";
import { berechneStorno } from "@/lib/eventverleih/storno";
import { getRow, createRow, updateRow, TABLES } from "@/lib/baserow/client";
import { bezahltEur, ueberzahlungEur } from "@/lib/eventverleih/zahlung";

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
  Anzahlung_Bezahlt_Eur: string | number | null;
  Restzahlung_Bezahlt_Eur: string | number | null;
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
    // Bezahlt aus Skalar-Feldern (Source of Truth) — Zahlungen_JSON war bei Stripe-Zahlern
    // leer -> Erstattung wurde faelschlich mit bezahlt=0 berechnet (Kunde verlor sein Geld).
    const bezahlt = bezahltEur(buchung);
    // Zu viel gezahltes Geld war nie Teil der Mietsumme: Es unterliegt keiner
    // Storno-Staffel und geht ungekuerzt zurueck. Es wird deshalb NICHT in `bezahlt`
    // eingerechnet, sondern separat ausgewiesen — sonst wuerde die Gebuehr darauf
    // erhoben. Der Refund selbst laeuft hier ohnehin von Hand.
    const ueberzahlung = ueberzahlungEur(buchung);

    // GATE (Phase 0): Storno-Staffel greift NUR bei verbindlicher Buchung.
    // Anzahlung-Modell: ein Vertrag besteht erst ab Bestaetigt/Reserviert. Eine
    // unverbindliche Anfrage / ein offenes Angebot wird KOSTENFREI zurueckgezogen
    // (keine Gebuehr, keine Nachzahlung) — verhindert "35 EUR Stornogebuehr auf eine
    // 5 Minuten alte Anfrage".
    const bindend = status === "Bestaetigt" || status === "Reserviert";
    const calc = bindend
      ? berechneStorno({
          eventDatumVon: buchung.Event_datum_von,
          mietsummeEur: mietsumme,
          bereitsBezahltEur: bezahlt,
        })
      : {
          stornogebuehr_prozent: 0,
          stornogebuehr_eur: 0,
          erstattung_eur: bezahlt,
          nachzahlung_eur: 0,
          staffel_label: "Unverbindliche Anfrage — kostenfreier Rückzug",
          tage_bis_event: buchung.Event_datum_von
            ? Math.floor((new Date(buchung.Event_datum_von).getTime() - Date.now()) / 86_400_000)
            : 0,
        };

    // Storno_Stufe + Storno_Grund MUESSEN gueltige Baserow-Single-Select-Optionen
    // (Tabelle 951) sein, sonst lehnt Baserow das PATCH mit HTTP 400 ab und updateRow
    // wirft -> 500 "internal" (genau der Member-Storno-Bug). Gueltige Storno_Stufe-
    // Optionen: keine | >14T_kostenfrei | 7T_50 | 4T_75 | 2T_100 | Wetter_Vermieter.
    const stornoStufe = !bindend
      ? "keine"
      : calc.stornogebuehr_prozent >= 100
        ? "2T_100"
        : calc.stornogebuehr_prozent >= 75
          ? "4T_75"
          : calc.stornogebuehr_prozent >= 50
            ? "7T_50"
            : ">14T_kostenfrei";

    // Status auf Storniert + Storno-Felder
    await updateRow(TABLES.Buchungen, buchungId, {
      Status_Erweitert: "Storniert",
      Storno_am: new Date().toISOString().slice(0, 10),
      Storno_Stufe: stornoStufe,
      Storno_Betrag_Eur: calc.stornogebuehr_eur,
      // Gueltige Storno_Grund-Optionen (T951): Konflikt_verloren | Kunden_Wunsch |
      // Manuel_Entscheidung | No_Show | Anzahlung_nicht_geleistet | Sonstig.
      // Kunden-Selbst-Storno wird als Kunden_Wunsch erfasst ("Kunde_Selbst" gibt es nicht).
      Storno_Grund: "Kunden_Wunsch",
    });

    // Mail an Kunde
    const mail = buildStornoBestaetigung({
      vorname: kunde.Vorname || "",
      nachname: kunde.Nachname || "",
      buchungId,
      stornogebuehrProzent: calc.stornogebuehr_prozent,
      staffelLabel: calc.staffel_label,
      mietsumme,
      stornogebuehrEur: calc.stornogebuehr_eur,
      bezahlt,
      erstattungEur: calc.erstattung_eur,
      nachzahlungEur: calc.nachzahlung_eur,
      ueberzahlungEur: ueberzahlung,
    });

    try {
      await createRow(TABLES.MailQueue, {
        Erstellt_am: new Date().toISOString(),
        Buchung_Link: [buchungId],
        Kunde_Link: [kunde.id],
        Template_Key: "storno_bestaetigung",
        Subject: mail.subject,
        Body: mail.body,
        Approval_Status: "Auto_Reply",
        Idempotency_Key: `B${buchungId}-storno-mail`,
      });
    } catch (e) {
      console.error("[member-storno] mail-queue insert fehlgeschlagen:", e);
    }

    // Telegram-Push an Manuel: Refund manuell triggern!
    let notifyResult = "kein_notify_url";
    const notifyUrl = process.env.N8N_STORNO_NOTIFY_URL || process.env.N8N_ANFRAGE_NOTIFY_URL || "";
    if (notifyUrl) {
      try {
        const res = await fetch(notifyUrl, {
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
            ueberzahlung_eur: ueberzahlung.toFixed(2),
            auszahlung_gesamt_eur: (calc.erstattung_eur + ueberzahlung).toFixed(2),
            nachzahlung_eur: calc.nachzahlung_eur.toFixed(2),
            tage_bis_event: calc.tage_bis_event,
            hinweis: calc.erstattung_eur + ueberzahlung > 0
              ? ueberzahlung > 0
                ? `Manueller Stripe-Refund nötig: ${(calc.erstattung_eur + ueberzahlung).toFixed(2)} EUR — davon ${ueberzahlung.toFixed(2)} EUR zu viel gezahlt, die NICHT unter die Storno-Staffel fallen`
                : "Manueller Stripe-Refund nötig — sicherheitshalber nicht automatisch ausgeloest"
              : "Keine Erstattung fällig",
          }),
          signal: AbortSignal.timeout(5000),
        });
        notifyResult = res.ok ? "gesendet" : `http_${res.status}`;
      } catch (e) {
        console.error("[member-storno] notify fehlgeschlagen:", e);
        notifyResult = "fehlgeschlagen";
      }
    }

    // Audit-Log (wie alle anderen Lifecycle-Routen). Hält insbesondere fest, ob der
    // Refund-Notify an Manuel rausging — eine fällige Erstattung ohne Notify bliebe
    // sonst unsichtbar (Geld könnte liegenbleiben).
    try {
      await createRow(TABLES.Audit_Log, {
        Name: `Storno (Kunde) Buchung #${buchungId}`,
        Aktion: "Storno",
        Zeitpunkt: new Date().toISOString(),
        Buchung_ID_Ref: String(buchungId),
        Akteur: "Kunde",
        Details: JSON.stringify({
          grund: "Kunden_Wunsch",
          stornogebuehr_eur: calc.stornogebuehr_eur,
          erstattung_eur: calc.erstattung_eur,
          ueberzahlung_eur: ueberzahlung,
          auszahlung_gesamt_eur: Math.round((calc.erstattung_eur + ueberzahlung) * 100) / 100,
          refund_notify: notifyResult,
          refund_pending: calc.erstattung_eur + ueberzahlung > 0,
        }),
        Aktiv: true,
      });
    } catch (e) {
      console.error("[member-storno] audit-log fehlgeschlagen:", e);
    }

    return NextResponse.json({
      ok: true,
      calc,
      ueberzahlung_eur: ueberzahlung,
      auszahlung_gesamt_eur: Math.round((calc.erstattung_eur + ueberzahlung) * 100) / 100,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    console.error("[member-storno]", msg);
    return NextResponse.json({ error: "internal", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
