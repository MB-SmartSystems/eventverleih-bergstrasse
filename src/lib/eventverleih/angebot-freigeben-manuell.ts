/**
 * Angebot-Freigabe direkt aus der Manuell-Anlage (Plan Task 3 / C3).
 *
 * Spiegelt die "freigeben"-Aktion aus src/app/api/admin/anfrage/[id]/action/route.ts
 * fuer den Fall, dass eine backoffice-angelegte Anfrage sofort freigegeben werden soll,
 * ohne den separaten Freigeben/Ablehnen-Schritt.
 *
 * WICHTIG — Mailversand-Guard:
 * Die regulaere Freigabe legt eine MailQueue-Row mit Approval_Status="Approved" an, die der
 * Poll innerhalb ~60s an den Kunden versendet. Dieser Auto-Versand haengt hier hinter dem
 * Flag AUTO_MAIL_BEI_MANUELLER_FREIGABE, das bewusst AUS ist. Solange es AUS ist, wird die
 * Anfrage vollstaendig auf "Angebot versendet" gesetzt (inkl. Snapshot + Stripe-Links), es geht
 * aber KEINE Mail raus — Manuel versendet das Angebot in diesem Fall manuell weiter.
 * Erst wenn der Auto-Versand fuer diesen Pfad gewollt ist, wird das Flag (bzw. eine ENV) auf true
 * gestellt; dann verhaelt sich dieser Pfad identisch zur bestehenden "Angebot freigeben"-Aktion.
 */
import { createRow, getRow, updateRow, listRows, TABLES } from "@/lib/baserow/client";
import { buildSnapshot } from "@/lib/angebot-snapshot";
import { createPaymentLink } from "@/lib/stripe/payment-links";
import { memberAutoLoginUrl } from "@/lib/eventverleih/member-auth";
import { triggerPdfRender } from "@/lib/eventverleih/pdf-render";
import { buildAngebotsMail } from "@/lib/eventverleih/mail-templates/build/angebot-entscheidung";

/**
 * Auto-Versand der Angebots-Mail bei direkter Freigabe aus der Manuell-Anlage.
 * BEWUSST AUS (Plan Task 3, Global Constraint "kein Mailversand"). Nur den Wert
 * aendern (oder auf eine ENV umstellen), wenn der Auto-Versand hier gewollt ist.
 */
const AUTO_MAIL_BEI_MANUELLER_FREIGABE = false;

interface FreigebenResult {
  freigegeben: true;
  mail_queued: boolean;
}

/**
 * Setzt ein frisch angelegtes Angebot auf "Versendet" (Buchung: "Angebot_versendet"),
 * erzeugt Snapshot + Stripe-Zahlungslinks und — nur wenn der Auto-Versand aktiv ist —
 * die Approved-MailQueue-Row. Fail-soft: einzelne Fehler (Snapshot, Stripe) brechen die
 * Freigabe nicht ab, werden aber geloggt.
 */
export async function freigebenNachManuellerAnlage(opts: {
  angebotId: number;
  buchungId: number;
  kundeId: number;
  token: string;
}): Promise<FreigebenResult> {
  const { angebotId, buchungId, kundeId, token } = opts;

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

  const [buchung, kunde] = await Promise.all([
    getRow<Buchung>(TABLES.Buchungen, buchungId),
    getRow<Kunde>(TABLES.Kunden, kundeId),
  ]);

  const publicUrl = `https://eventverleih-bergstrasse.de/angebot/${token}`;
  const fmt = (v: string | null) => (v ? parseFloat(v).toFixed(2) : "0.00");

  let meinBereichUrl = "";
  try {
    meinBereichUrl = await memberAutoLoginUrl(kundeId);
  } catch (e) {
    console.error("[anfrage-neu-freigeben] memberAutoLoginUrl fehlgeschlagen:", e);
  }

  const mail = buildAngebotsMail({
    vorname: kunde.Vorname,
    nachname: kunde.Nachname,
    preisArtikel: fmt(buchung.Preis_Artikel),
    anzahlung: fmt(buchung.Anzahlung_Soll_Eur),
    restzahlung: fmt(buchung.Restzahlung_Soll_Eur),
    kaution: fmt(buchung.Kaution_Soll_Eur),
    angebotUrl: publicUrl,
    meinBereichUrl,
  });

  // Angebote-Status auf Versendet + Snapshot (Kundenansicht ab jetzt eingefroren)
  const today = new Date().toISOString().slice(0, 10);
  const updateData: Record<string, unknown> = { Status: "Versendet", Angebotsdatum: today };
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
    console.error("[anfrage-neu-freigeben] Snapshot-Build fehlgeschlagen:", e);
  }
  await updateRow(TABLES.Angebote, angebotId, updateData);

  // Buchungs-Status mitziehen
  try {
    await updateRow(TABLES.Buchungen, buchungId, { Status_Erweitert: "Angebot_versendet" });
  } catch (e) {
    console.error("[anfrage-neu-freigeben] Buchungs-Status-Sync fehlgeschlagen:", e);
  }

  // Stripe-Links (Anzahlung, Komplettzahlung, Restzahlung) — fail-soft
  const kundeName = `${kunde.Vorname} ${kunde.Nachname}`.trim() || "Kunde";
  const stripeUpdates: Record<string, unknown> = {};
  try {
    const anzahlungSoll = buchung.Anzahlung_Soll_Eur ? parseFloat(buchung.Anzahlung_Soll_Eur) : 0;
    if (anzahlungSoll > 0 && !(buchung.Stripe_Anzahlung_Link || "").trim()) {
      const link = await createPaymentLink({
        buchungId,
        paymentType: "anzahlung",
        amountEur: anzahlungSoll,
        kundeName,
        description: `Anzahlung Buchung #${buchungId} — Event ${buchung.Event_datum_von || ""}`,
      });
      stripeUpdates.Stripe_Anzahlung_Link = link.link_url;
    }
  } catch (e) {
    console.error("[anfrage-neu-freigeben] Stripe-Anzahlungs-Link fehlgeschlagen:", e);
  }
  try {
    const preisArtikel = parseFloat(buchung.Preis_Artikel || "0") || 0;
    const preisLieferung = parseFloat(buchung.Preis_Lieferung || "0") || 0;
    const preisAbholung = parseFloat(buchung.Preis_Abholung || "0") || 0;
    const preisAufbau = parseFloat(buchung.Preis_Aufbau || "0") || 0;
    const komplett = preisArtikel + preisLieferung + preisAbholung + preisAufbau;
    if (komplett > 0 && !(buchung.Stripe_Komplettzahlung_Link || "").trim()) {
      const link = await createPaymentLink({
        buchungId,
        paymentType: "komplettzahlung",
        amountEur: komplett,
        kundeName,
        description: `Komplettzahlung Buchung #${buchungId} — Event ${buchung.Event_datum_von || ""}`,
      });
      stripeUpdates.Stripe_Komplettzahlung_Link = link.link_url;
    }
  } catch (e) {
    console.error("[anfrage-neu-freigeben] Stripe-Komplettzahlungs-Link fehlgeschlagen:", e);
  }
  try {
    const restSoll = buchung.Restzahlung_Soll_Eur ? parseFloat(buchung.Restzahlung_Soll_Eur) : 0;
    if (restSoll > 0 && !(buchung.Stripe_Restzahlung_Link || "").trim()) {
      const link = await createPaymentLink({
        buchungId,
        paymentType: "restzahlung",
        amountEur: restSoll,
        kundeName,
        description: `Restzahlung Buchung #${buchungId} — Event ${buchung.Event_datum_von || ""}`,
      });
      stripeUpdates.Stripe_Restzahlung_Link = link.link_url;
    }
  } catch (e) {
    console.error("[anfrage-neu-freigeben] Stripe-Restzahlungs-Link fehlgeschlagen:", e);
  }
  if (Object.keys(stripeUpdates).length > 0) {
    try {
      await updateRow(TABLES.Buchungen, buchungId, stripeUpdates);
    } catch (e) {
      console.error("[anfrage-neu-freigeben] Buchung-Update mit Stripe-Links fehlgeschlagen:", e);
    }
  }

  // MailQueue nur bei aktivem Auto-Versand (heute AUS → kein Mailversand)
  let mailQueued = false;
  if (AUTO_MAIL_BEI_MANUELLER_FREIGABE) {
    const templateKey = "angebot_freigegeben";
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
      mailQueued = true;
    }
  }

  // Angebots-PDF fuer den In-Portal-Download rendern lassen (fail-soft, no-op ohne ENV)
  try {
    await triggerPdfRender({ table: "angebot", id: angebotId, token });
  } catch (e) {
    console.error("[anfrage-neu-freigeben] triggerPdfRender fehlgeschlagen:", e);
  }

  return { freigegeben: true, mail_queued: mailQueued };
}
