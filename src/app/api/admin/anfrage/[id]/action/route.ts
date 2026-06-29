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
import { createRow, getRow, updateRow, listRows, TABLES } from "@/lib/baserow/client";
import { buildSnapshot } from "@/lib/angebot-snapshot";
import { createPaymentLink } from "@/lib/stripe/payment-links";
import { memberAutoLoginUrl } from "@/lib/eventverleih/member-auth";
import { triggerPdfRender } from "@/lib/eventverleih/pdf-render";
import { UEBERGABE_HINWEIS } from "@/lib/eventverleih/constants";

type Action = "freigeben" | "freigeben_anmerkung" | "rueckruf" | "ablehnen";

interface ActionBody {
  action: Action;
  anmerkung?: string;
  // Ablehnung: Grund-Kategorie bestimmt den KUNDEN-Text; interne_notiz bleibt intern; ohne_mail = stille Ablehnung (Test/Spam)
  grund_kategorie?: string;
  kunden_text?: string;
  interne_notiz?: string;
  ohne_mail?: boolean;
}

// Vorformulierte, höfliche KUNDEN-Texte je Ablehnungsgrund (NICHT die interne Notiz).
const ABLEHNEN_TEXTE: Record<string, string> = {
  ausgebucht: "Leider sind die von Ihnen gewünschten Artikel für diesen Termin bereits vergeben.",
  liefergebiet: "Leider liegt Ihr Veranstaltungsort außerhalb unseres Liefergebiets.",
  nicht_verfuegbar: "Leider können wir die gewünschten Artikel aktuell nicht anbieten.",
  kurzfristig: "Leider ist der Termin für eine zuverlässige Bereitstellung zu kurzfristig.",
};

/** KUNDEN-Text für die Absage. 'intern' (z.B. „möchte nicht vermieten") = neutral-höflich, KEIN Grund genannt. */
function resolveAblehnenText(kategorie?: string, kundenText?: string): string {
  if (kategorie === "sonstiges") return (kundenText || "").trim();
  if (kategorie === "intern" || !kategorie) return "";
  return ABLEHNEN_TEXTE[kategorie] || "";
}

const SIGNATURE = `\n\nMit freundlichen Grüßen\nManuel Büttner\n\nEventverleih Bergstraße\nSchlesierstraße 19a, 64665 Alsbach-Hähnlein\nTel/WhatsApp: +49 156 79521124\nE-Mail: info@eventverleih-bergstrasse.de\nWeb: eventverleih-bergstrasse.de\n\nNicht umsatzsteuerpflichtig nach § 19 Abs. 1 UStG.`;

function buildAngebotsMail(opts: {
  vorname: string;
  nachname: string;
  preisArtikel: string;
  anzahlung: string;
  restzahlung: string;
  kaution: string;
  angebotUrl: string;
  anmerkung?: string;
  meinBereichUrl?: string;
}): { subject: string; body: string } {
  const greeting = `Hallo ${opts.vorname} ${opts.nachname}`;
  const anmerkungBlock = opts.anmerkung
    ? `\n*Persönliche Anmerkung von Manuel:*\n${opts.anmerkung}\n`
    : "";
  const memberBlock = opts.meinBereichUrl
    ? `\n\nMein Bereich (alle Buchungen + Zahlungen + Rechnungen einsehen):\n${opts.meinBereichUrl}`
    : "";
  return {
    subject: "Ihr Angebot von Eventverleih Bergstraße",
    body: `${greeting},
${anmerkungBlock}
vielen Dank für Ihre Anfrage. Hier ist Ihr Angebot:

*Preisübersicht:*
Mietsumme: ${opts.preisArtikel} EUR
Anzahlung bei Bestätigung (30 %): ${opts.anzahlung} EUR
Restzahlung bei Übergabe (70 %): ${opts.restzahlung} EUR
Kaution (nach Rückgabe vollständig erstattet): ${opts.kaution} EUR

Sie können das Angebot online ansehen und mit einem Klick bestätigen:
${opts.angebotUrl}

${UEBERGABE_HINWEIS}

Lassen Sie sich mit der Entscheidung gern Zeit. Bei Fragen am schnellsten per WhatsApp: +49 156 79521124.${memberBlock}${SIGNATURE}`,
  };
}

function buildRueckrufMail(opts: { vorname: string; nachname: string }): { subject: string; body: string } {
  return {
    subject: "Ihre Anfrage bei Eventverleih Bergstraße - kurze Rückfrage",
    body: `Hallo ${opts.vorname} ${opts.nachname},

vielen Dank für Ihre Anfrage. Damit ich Ihnen ein passendes Angebot machen kann, möchte ich gerne kurz mit Ihnen sprechen - meist sind 3-5 Minuten ausreichend, um alle Details zu klären.

Können wir kurz telefonieren? Sie erreichen mich werktags am besten unter +49 156 79521124 (auch WhatsApp).

Alternativ rufe ich Sie zurück - lassen Sie mich einfach wissen, wann es Ihnen passt.${SIGNATURE}`,
  };
}

function buildAblehnenMail(opts: { vorname: string; nachname: string; grund?: string }): { subject: string; body: string } {
  const grundBlock = opts.grund && opts.grund.trim() ? `\n\n${opts.grund.trim()}` : "";
  return {
    subject: "Ihre Anfrage bei Eventverleih Bergstraße",
    body: `Hallo ${opts.vorname} ${opts.nachname},

vielen Dank für Ihre Anfrage. Leider kann ich Ihnen kein Angebot für diesen Termin machen.${grundBlock}

Falls Sie noch andere Termine in Erwägung ziehen oder Fragen haben, melden Sie sich gerne - vielleicht finden wir doch eine Lösung. Sie erreichen mich werktags am besten unter +49 156 79521124 (auch WhatsApp).

Ich wünsche Ihnen viel Erfolg bei Ihrer Feier und stehe für zukünftige Anfragen jederzeit zur Verfügung.${SIGNATURE}`,
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
      Stripe_Anzahlung_Link: string | null;
      Stripe_Komplettzahlung_Link: string | null;
      Stripe_Restzahlung_Link: string | null;
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

    // Auto-Login-Link fuer Mein-Bereich
    let meinBereichUrl = "";
    try {
      meinBereichUrl = await memberAutoLoginUrl(kundeId);
    } catch (e) {
      console.error("[anfrage-action] memberAutoLoginUrl fehlgeschlagen:", e);
    }

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
        meinBereichUrl,
      });
      newStatus = "Versendet";
      templateKey = body.action === "freigeben_anmerkung" ? "angebot_freigegeben_anmerkung" : "angebot_freigegeben";
    } else if (body.action === "rueckruf") {
      mail = buildRueckrufMail({ vorname: kunde.Vorname, nachname: kunde.Nachname });
      newStatus = "Offen"; // bleibt offen, wartet auf Telefonat
      templateKey = "rueckruf_vorschlag";
    } else {
      // ablehnen — Kundentext aus Grund-Kategorie (interne Notiz NICHT verwenden)
      mail = buildAblehnenMail({ vorname: kunde.Vorname, nachname: kunde.Nachname, grund: resolveAblehnenText(body.grund_kategorie, body.kunden_text) });
      newStatus = "Abgelehnt";
      templateKey = "anfrage_abgelehnt";
    }

    // Angebote-Status updaten
    const today = new Date().toISOString().slice(0, 10);
    const updateData: Record<string, unknown> = { Status: newStatus };
    if (newStatus === "Versendet") {
      updateData.Angebotsdatum = today;
      // Snapshot erzeugen — Kundenansicht ab jetzt eingefroren
      try {
        const snapshot = await buildSnapshot({
          version: 1,
          buchungId,
          buchung: {
            Event_datum_von: buchung.Event_datum_von ?? null,
            Event_datum_bis: buchung.Event_datum_bis ?? null,
            Preis_Artikel: buchung.Preis_Artikel,
            Preis_Lieferung: buchung.Preis_Lieferung ?? null,
            Preis_Abholung: buchung.Preis_Abholung ?? null,
            Preis_Aufbau: buchung.Preis_Aufbau ?? null,
            Preis_Abbau: buchung.Preis_Abbau ?? null,
            Anzahlung_Soll_Eur: buchung.Anzahlung_Soll_Eur,
            Restzahlung_Soll_Eur: buchung.Restzahlung_Soll_Eur,
            Kaution_Soll_Eur: buchung.Kaution_Soll_Eur,
            Lieferadresse: buchung.Lieferadresse ?? null,
          },
          kunde: {
            Vorname: kunde.Vorname ?? "",
            Nachname: kunde.Nachname ?? "",
            Firma: kunde.Firma ?? "",
            Email: kunde.Email ?? "",
            Telefon: kunde.Telefon ?? "",
            Adresse_Strasse: kunde.Adresse_Strasse ?? "",
            Adresse_PLZ: kunde.Adresse_PLZ ?? "",
            Adresse_Ort: kunde.Adresse_Ort ?? "",
          },
        });
        updateData.Snapshot_JSON = JSON.stringify(snapshot);
        updateData.Snapshot_Version = 1;
        updateData.Snapshot_Erstellt_am = snapshot.erstellt_am;
      } catch (e) {
        console.error("[anfrage-action] Snapshot-Build fehlgeschlagen:", e);
        // Soft-fail: Mail geht trotzdem raus, Snapshot fehlt → Public rendert Live (Backward-Compat)
      }
    }
    if (newStatus === "Abgelehnt") {
      updateData.Abgelehnt_am = new Date().toISOString();
      // INTERN: Kategorie + interne Notiz — geht NIE an den Kunden
      updateData.Abgelehnt_Grund =
        [body.grund_kategorie, body.interne_notiz?.trim()].filter(Boolean).join(" — ") ||
        "Manuel-Entscheidung im Dashboard";
    }
    await updateRow(TABLES.Angebote, angebotId, updateData);

    // Buchungs-Status_Erweitert mit-aktualisieren (damit Buchungs-Dashboard konsistenter Stand zeigt)
    try {
      let buchungStatus: string | null = null;
      if (body.action === "freigeben" || body.action === "freigeben_anmerkung") {
        buchungStatus = "Angebot_versendet";
      } else if (body.action === "ablehnen") {
        buchungStatus = "Storniert";
      }
      // Rückruf: Buchungs-Status bleibt "Anfrage", weil noch nichts entschieden
      if (buchungStatus === "Storniert") {
        // Konsistent zu den echten Storno-Routen: Grund + Datum mitschreiben, sonst
        // steht eine "stornierte" Buchung ohne Grund/Datum da.
        await updateRow(TABLES.Buchungen, buchungId, {
          Status_Erweitert: buchungStatus,
          Storno_am: new Date().toISOString().slice(0, 10),
          Storno_Grund: "Manuel_Entscheidung",
          Storno_Betrag_Eur: 0,
        });
      } else if (buchungStatus) {
        await updateRow(TABLES.Buchungen, buchungId, { Status_Erweitert: buchungStatus });
      }
    } catch (e) {
      console.error("[anfrage-action] Buchungs-Status-Sync fehlgeschlagen:", e);
    }

    // Auto-Anzahlungs-Link UND Komplettzahlungs-Link erzeugen, damit Kunde im
    // Vertrag-Akzeptieren-Flow direkt zwischen den Optionen waehlen kann.
    // Fail-soft: Stripe-Down darf den Angebots-Versand nicht killen.
    if (body.action === "freigeben" || body.action === "freigeben_anmerkung") {
      const kundeName = `${kunde.Vorname} ${kunde.Nachname}`.trim() || "Kunde";
      const stripeUpdates: Record<string, unknown> = {};

      // Anzahlung
      try {
        const anzahlungSoll = buchung.Anzahlung_Soll_Eur ? parseFloat(buchung.Anzahlung_Soll_Eur) : 0;
        const alreadyLinked = (buchung.Stripe_Anzahlung_Link || "").trim().length > 0;
        if (anzahlungSoll > 0 && !alreadyLinked) {
          const desc = `Anzahlung Buchung #${buchungId} — Event ${buchung.Event_datum_von || ""}`;
          const link = await createPaymentLink({
            buchungId,
            paymentType: "anzahlung",
            amountEur: anzahlungSoll,
            kundeName,
            description: desc,
          });
          stripeUpdates.Stripe_Anzahlung_Link = link.link_url;
        }
      } catch (e) {
        console.error("[anfrage-action] Stripe-Anzahlungs-Link fehlgeschlagen:", e);
      }

      // Komplettzahlung (Gesamt = Mietsumme + Lieferung + Aufbau, ohne Kaution)
      try {
        const preisArtikel = parseFloat(buchung.Preis_Artikel || "0") || 0;
        const preisLieferung = parseFloat(buchung.Preis_Lieferung || "0") || 0;
        const preisAbholung = parseFloat(buchung.Preis_Abholung || "0") || 0;
        const preisAufbau = parseFloat(buchung.Preis_Aufbau || "0") || 0;
        const komplett = preisArtikel + preisLieferung + preisAbholung + preisAufbau;
        const alreadyLinkedK = (buchung.Stripe_Komplettzahlung_Link || "").trim().length > 0;
        if (komplett > 0 && !alreadyLinkedK) {
          const desc = `Komplettzahlung Buchung #${buchungId} — Event ${buchung.Event_datum_von || ""}`;
          const link = await createPaymentLink({
            buchungId,
            paymentType: "komplettzahlung",
            amountEur: komplett,
            kundeName,
            description: desc,
          });
          stripeUpdates.Stripe_Komplettzahlung_Link = link.link_url;
        }
      } catch (e) {
        console.error("[anfrage-action] Stripe-Komplettzahlungs-Link fehlgeschlagen:", e);
      }

      // Restzahlung (70 %) — fuer Online-Restzahlung + Restzahlungs-Reminder-Mail-Link
      try {
        const restSoll = buchung.Restzahlung_Soll_Eur ? parseFloat(buchung.Restzahlung_Soll_Eur) : 0;
        const alreadyLinkedR = (buchung.Stripe_Restzahlung_Link || "").trim().length > 0;
        if (restSoll > 0 && !alreadyLinkedR) {
          const desc = `Restzahlung Buchung #${buchungId} — Event ${buchung.Event_datum_von || ""}`;
          const link = await createPaymentLink({
            buchungId,
            paymentType: "restzahlung",
            amountEur: restSoll,
            kundeName,
            description: desc,
          });
          stripeUpdates.Stripe_Restzahlung_Link = link.link_url;
        }
      } catch (e) {
        console.error("[anfrage-action] Stripe-Restzahlungs-Link fehlgeschlagen:", e);
      }

      if (Object.keys(stripeUpdates).length > 0) {
        try {
          await updateRow(TABLES.Buchungen, buchungId, stripeUpdates);
        } catch (e) {
          console.error("[anfrage-action] Buchung-Update mit Stripe-Links fehlgeschlagen:", e);
        }
      }
    }

    // MailQueue-Row anlegen (Approved → Poll versendet) — bei "ohne Mail ablehnen" (Test/Spam) ueberspringen
    const skipMail = body.action === "ablehnen" && body.ohne_mail === true;
    if (!skipMail) {
      // Idempotenz-Vorprüfung (Audit P2): Doppelklick "Freigeben" darf nicht zwei
      // identische Approved-MailQueue-Rows anlegen (sonst Angebot doppelt an den Kunden).
      // Gleiches Idiom wie in den Reminder-/Übergabe-Pfaden.
      const idemKey = `A${angebotId}-${templateKey}`;
      const dup = await listRows<{ id: number; Idempotency_Key?: string }>(TABLES.MailQueue, { search: idemKey, size: 5 });
      if (!dup.results.find((m) => m.Idempotency_Key === idemKey)) {
        await createRow(TABLES.MailQueue, {
          Erstellt_am: new Date().toISOString(),
          Buchung_Link: [buchungId],
          Kunde_Link: [kundeId],
          Template_Key: templateKey,
          Subject: mail.subject,
          Body: mail.body,
          Approval_Status: "Approved",
          Idempotency_Key: idemKey,
        });
      }
    }

    // Angebots-PDF fuer den In-Portal-Download rendern lassen (Blob + Angebote.PDF_URL).
    // Nur beim Versand, fail-soft (no-op wenn N8N_PDF_RENDER_URL nicht gesetzt).
    if (newStatus === "Versendet") {
      await triggerPdfRender({ table: "angebot", id: angebotId, token: angebot.Token_Public });
    }

    return NextResponse.json({ ok: true, new_status: newStatus, template: templateKey });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: "internal error", detail: msg.slice(0, 300) }, { status: 500 });
  }
}
