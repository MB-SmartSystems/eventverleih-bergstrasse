/**
 * POST /api/vertrag-akzeptieren
 *
 * Body: form-data oder JSON mit { token: string }
 *
 * Verhalten (neue Lifecycle-Logik 2026-05-15):
 *   1. Sucht Angebot-Row via Token_Public
 *   2. Updated Angebote.Status = Akzeptiert, Akzeptiert_am = now, Akzept_Snapshot freezen
 *   3. Updated Buchungen.Status_Erweitert = "Bestaetigt" (Hart-Block, Reserviert erst nach Anzahlung)
 *   4. Erstellt MailQueue-Eintrag fuer Vertrag-Bestaetigungs-Mail (Approval=Pending)
 *   5. Redirect zur Angebots-Seite (Status zeigt jetzt "akzeptiert")
 */
import { NextRequest, NextResponse } from "next/server";
import { createRow, getRow, listRows, updateRow, TABLES } from "@/lib/baserow/client";
import { createPaymentLink } from "@/lib/stripe/payment-links";
import { memberAutoLoginUrl } from "@/lib/eventverleih/member-auth";
import { recalcBuchung } from "@/lib/buchung-recalc";
import { buildSnapshot } from "@/lib/angebot-snapshot";

async function logAudit(buchungId: number, aktion: string, details: Record<string, unknown>) {
  try {
    await createRow(TABLES.Audit_Log, {
      Name: `${aktion} Buchung #${buchungId}`,
      Aktion: aktion,
      Zeitpunkt: new Date().toISOString(),
      Buchung_ID_Ref: String(buchungId),
      Akteur: "System (vertrag-akzeptieren)",
      Details: JSON.stringify(details),
      Aktiv: true,
    });
  } catch (e) {
    console.error("[audit-log]", aktion, e);
  }
}

type KundePatch = {
  Telefon?: string;
  Adresse_Strasse?: string;
  Adresse_PLZ?: string;
  Adresse_Ort?: string;
};

type DeclineFlags = {
  lieferung?: boolean;
  abholung?: boolean;
  aufbau?: boolean;
};

async function handle(
  token: string,
  origin: string,
  kundenDaten?: KundePatch,
  declineFlags?: DeclineFlags,
): Promise<NextResponse> {
  if (!token || typeof token !== "string" || token.length < 8) {
    return NextResponse.json({ error: "invalid token" }, { status: 400 });
  }

  try {
    const angebotList = await listRows<{
      id: number;
      Angebotsnummer: string;
      Status: { value: string } | null;
      Buchung_Link: Array<{ id: number; value: string }>;
      Kunde_Link: Array<{ id: number; value: string }>;
      Token_Public: string;
      Snapshot_JSON: string | null;
      Snapshot_Version: string | null;
      Akzept_Version: string | null;
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

    // GATE (Phase 0): Nur ein VERSENDETES Angebot ist akzeptierbar — oder ein Re-Accept
    // einer neueren Version. Verhindert, dass ein Kunde ueber einen alten Token-Link ein
    // abgelehntes / storniertes / noch-nicht-freigegebenes Angebot selbst bestaetigt
    // (sonst: Status "Abgelehnt" + Zahllinks + "bitte Anzahlung leisten"-Mail an einen abgesagten Kunden).
    {
      const st = angebot.Status?.value || "";
      const snapV0 = parseInt(angebot.Snapshot_Version ?? "0", 10) || 0;
      const akzV0 = parseInt(angebot.Akzept_Version ?? "0", 10) || 0;
      const reAcceptNewVersion = snapV0 > 0 && akzV0 > 0 && snapV0 > akzV0;
      if (st === "Akzeptiert" && !reAcceptNewVersion) {
        // bereits bestaetigt → idempotent zurueck zur Angebotsseite, kein erneutes Verarbeiten
        return NextResponse.redirect(new URL(`/angebot/${token}?bestaetigt=1`, origin), 303);
      }
      if (st !== "Versendet" && !reAcceptNewVersion) {
        return NextResponse.json(
          { error: "Dieses Angebot ist aktuell nicht zur Bestätigung verfügbar. Bei Fragen melden Sie sich gern bei uns." },
          { status: 409 }
        );
      }
    }

    // Kundendaten updaten falls geliefert — Pflicht für rechtsverbindliche Bestätigung
    if (kundenDaten) {
      const patch: Record<string, string> = {};
      if (kundenDaten.Telefon?.trim()) patch.Telefon = kundenDaten.Telefon.trim();
      if (kundenDaten.Adresse_Strasse?.trim()) patch.Adresse_Strasse = kundenDaten.Adresse_Strasse.trim();
      if (kundenDaten.Adresse_PLZ?.trim()) {
        if (!/^\d{4,5}$/.test(kundenDaten.Adresse_PLZ.trim())) {
          return NextResponse.json({ error: "PLZ ungültig" }, { status: 400 });
        }
        patch.Adresse_PLZ = kundenDaten.Adresse_PLZ.trim();
      }
      if (kundenDaten.Adresse_Ort?.trim()) patch.Adresse_Ort = kundenDaten.Adresse_Ort.trim();
      if (Object.keys(patch).length > 0) {
        try {
          await updateRow(TABLES.Kunden, kundeId, patch);
        } catch (e) {
          console.error("[vertrag-akzeptieren] Kunde-Update fehlgeschlagen:", e);
          // Nicht-fatal — Akzept soll trotzdem durchlaufen
        }
      }
    }

    // Service-Abwahl: Kunde hat im Angebot Lieferung/Abholung/Aufbau abgewaehlt.
    // Reihenfolge: erst Preise nullen, dann recalc (Anzahlung + Stripe-Links), dann
    // Akzept-Snapshot aus dem NEUEN Live-State neu bauen (statt eingefrorenen Snapshot
    // zu kopieren), damit das rechtsverbindliche Dokument widerspiegelt was Kunde
    // tatsaechlich akzeptiert hat.
    //
    // GATE: Nur bei first-time accept ODER re-accept einer neuen Version anwenden.
    // Sonst koennte ein Kunde nach erster Akzept-Bestaetigung erneut POST mit
    // decline_*=true schicken und Preise nachtraeglich reduzieren (P1-Risk).
    const wasAlreadyAccepted = angebot.Status?.value === "Akzeptiert";
    const angebotSnapshotV = parseInt(angebot.Snapshot_Version ?? "0", 10) || 0;
    const angebotAkzeptV = parseInt(angebot.Akzept_Version ?? "0", 10) || 0;
    const isReAcceptingNewVersion =
      angebotSnapshotV > 0 && angebotAkzeptV > 0 && angebotSnapshotV > angebotAkzeptV;
    const declineAllowed = !wasAlreadyAccepted || isReAcceptingNewVersion;
    const hasDecline =
      declineAllowed &&
      !!(declineFlags?.lieferung || declineFlags?.abholung || declineFlags?.aufbau);
    if (hasDecline) {
      const pricePatch: Record<string, string> = {};
      if (declineFlags?.lieferung) pricePatch.Preis_Lieferung = "0.00";
      if (declineFlags?.abholung) pricePatch.Preis_Abholung = "0.00";
      if (declineFlags?.aufbau) {
        pricePatch.Preis_Aufbau = "0.00";
        pricePatch.Aufbau_gewuenscht = "Nein";
      }
      try {
        await updateRow(TABLES.Buchungen, buchungId, pricePatch);
        await recalcBuchung(buchungId);
      } catch (e) {
        console.error("[vertrag-akzeptieren] Service-Decline-Apply fehlgeschlagen:", e);
        // Nicht-fatal — Akzept laeuft weiter, Snapshot kann inkonsistent sein.
      }
    }

    // Updates IMMER laufen lassen — Baserow ist idempotent bei gleichem Wert (no-op-Write).
    const alreadyAccepted = wasAlreadyAccepted;
    const angebotUpdate: Record<string, unknown> = {
      Status: "Akzeptiert",
      ...(alreadyAccepted ? {} : { Akzeptiert_am: new Date().toISOString() }),
    };
    // Akzept-Snapshot speichern: was Kunde rechtsverbindlich akzeptiert hat.
    // Bei Service-Decline: aus aktuellem Live-State neu bauen. Sonst: eingefrorenen Snapshot kopieren.
    if (hasDecline) {
      try {
        type BuchungFull = {
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
        type KundeFull = {
          Vorname: string;
          Nachname: string;
          Firma: string;
          Email: string;
          Telefon: string;
          Adresse_Strasse: string;
          Adresse_PLZ: string;
          Adresse_Ort: string;
        };
        const [buchungFull, kundeFull] = await Promise.all([
          getRow<BuchungFull>(TABLES.Buchungen, buchungId),
          getRow<KundeFull>(TABLES.Kunden, kundeId),
        ]);
        const newVersion = (parseInt(angebot.Snapshot_Version ?? "0", 10) || 0) + 1;
        const rebuilt = await buildSnapshot({
          version: newVersion,
          buchungId,
          buchung: buchungFull,
          kunde: kundeFull,
        });
        const rebuiltJson = JSON.stringify(rebuilt);
        angebotUpdate.Snapshot_JSON = rebuiltJson;
        angebotUpdate.Snapshot_Version = newVersion;
        angebotUpdate.Snapshot_Erstellt_am = rebuilt.erstellt_am;
        angebotUpdate.Akzept_Snapshot_JSON = rebuiltJson;
        angebotUpdate.Akzept_Version = newVersion;
      } catch (e) {
        console.error("[vertrag-akzeptieren] Snapshot-Rebuild nach Decline fehlgeschlagen:", e);
        // Fallback: alten Snapshot einfrieren — besser als nichts.
        if (angebot.Snapshot_JSON) {
          angebotUpdate.Akzept_Snapshot_JSON = angebot.Snapshot_JSON;
          const v = parseInt(angebot.Snapshot_Version ?? "0", 10) || 0;
          if (v > 0) angebotUpdate.Akzept_Version = v;
        }
      }
    } else if (angebot.Snapshot_JSON) {
      angebotUpdate.Akzept_Snapshot_JSON = angebot.Snapshot_JSON;
      const v = parseInt(angebot.Snapshot_Version ?? "0", 10) || 0;
      if (v > 0) angebotUpdate.Akzept_Version = v;
    }
    await updateRow(TABLES.Angebote, angebot.id, angebotUpdate);

    // Buchung-Update NUR fuer fruehe Workflow-Stati — nicht zurueckspringen
    // wenn Buchung schon weiter ist (Uebergeben/Zurueckgegeben/Abgerechnet/Storniert).
    const buchungFresh = await getRow<{
      Status_Erweitert: { value: string } | null;
      Event_datum_von: string | null;
      Event_datum_bis: string | null;
      Stripe_Anzahlung_Link: string | null;
      Stripe_Komplettzahlung_Link: string | null;
      Stripe_Restzahlung_Link: string | null;
      Anzahlung_Soll_Eur: string | number | null;
      Anzahlung_Bezahlt_am: string | null;
      Restzahlung_Soll_Eur: string | number | null;
      Restzahlung_Bezahlt_am: string | null;
      Preis_Artikel: string | number | null;
      Preis_Lieferung: string | number | null;
      Preis_Abholung: string | number | null;
      Preis_Aufbau: string | number | null;
    }>(TABLES.Buchungen, buchungId);
    const earlyStati = new Set([
      "Anfrage",
      "Angebot_erstellt",
      "Angebot_versendet",
      "Reserviert",
      "Bestaetigt",
    ]);
    const currentStatus = buchungFresh.Status_Erweitert?.value || "";
    if (!currentStatus || earlyStati.has(currentStatus)) {
      // Status auf "Bestaetigt" — Hart-Block, Reserviert erst nach Anzahlung (Stripe-Webhook)
      await updateRow(TABLES.Buchungen, buchungId, {
        Status_Erweitert: "Bestaetigt",
      });
      await logAudit(buchungId, "Status_Change", {
        from: currentStatus || "(neu)",
        to: "Bestaetigt",
        trigger: "kunde_token_klick",
        token_prefix: token.slice(0, 8),
      });

    }
    // Sonst: Buchung ist bereits weiter im Workflow — keine Regression erlauben.

    // MailQueue-Insert IMMER versuchen (auch bei alreadyAccepted=true) —
    // deckt den Fall ab, dass erster POST nach Status-Update aber vor MailQueue-Insert gefailt ist.
    // Idempotency-Key stabil → kein Duplicate.
    {
      // MailQueue: Vertrag-Bestaetigungs-Mail (mit Manuel-Approval)
      const subject = "Termin vorgemerkt - bitte Anzahlung leisten | Eventverleih Bergstraße";
      const vertragsUrl = `${origin}/vertrag/${token}`;

      // Kundenname fuer persoenliche Anrede + Stripe-Link-Beschreibung
      let kundeName = "";
      try {
        const k = await getRow<{ Vorname?: string; Nachname?: string }>(TABLES.Kunden, kundeId);
        kundeName = `${k?.Vorname ?? ""} ${k?.Nachname ?? ""}`.trim();
      } catch (e) {
        console.error("[vertrag-akzeptieren] Kunde-Name-Lookup fehlgeschlagen:", e);
      }

      // Stripe-Zahllinks bei Bestaetigung automatisch erzeugen (fail-soft):
      // Anzahlung + Komplettzahlung, falls noch nicht vorhanden, Betrag > 0 und noch nichts bezahlt.
      // Stripe-Fehler duerfen den Accept nicht brechen — Mail faellt dann auf Bankblock zurueck.
      const num = (v: string | number | null | undefined): number => {
        if (v === null || v === undefined) return 0;
        if (typeof v === "number") return v;
        const n = parseFloat(String(v));
        return isNaN(n) ? 0 : n;
      };
      const anzahlungSoll = num(buchungFresh.Anzahlung_Soll_Eur);
      const komplettBetrag =
        num(buchungFresh.Preis_Artikel) +
        num(buchungFresh.Preis_Lieferung) +
        num(buchungFresh.Preis_Abholung) +
        num(buchungFresh.Preis_Aufbau);
      const nichtsBezahlt = !buchungFresh.Anzahlung_Bezahlt_am && !buchungFresh.Restzahlung_Bezahlt_am;

      let stripeLink = (buchungFresh.Stripe_Anzahlung_Link || "").trim() || null;
      let komplettLink = (buchungFresh.Stripe_Komplettzahlung_Link || "").trim() || null;

      if (!stripeLink && anzahlungSoll > 0 && !buchungFresh.Anzahlung_Bezahlt_am) {
        try {
          const l = await createPaymentLink({
            buchungId,
            paymentType: "anzahlung",
            amountEur: anzahlungSoll,
            kundeName: kundeName || "Kunde",
            description: `Anzahlung Buchung #${buchungId} — Event ${buchungFresh.Event_datum_von || ""}`,
          });
          await updateRow(TABLES.Buchungen, buchungId, { Stripe_Anzahlung_Link: l.link_url });
          stripeLink = l.link_url;
        } catch (e) {
          console.error("[vertrag-akzeptieren] Anzahlungs-Link-Erzeugung fehlgeschlagen:", e);
        }
      }
      if (!komplettLink && komplettBetrag > 0 && nichtsBezahlt) {
        try {
          const l = await createPaymentLink({
            buchungId,
            paymentType: "komplettzahlung",
            amountEur: komplettBetrag,
            kundeName: kundeName || "Kunde",
            description: `Komplettzahlung Buchung #${buchungId} — Event ${buchungFresh.Event_datum_von || ""}`,
          });
          await updateRow(TABLES.Buchungen, buchungId, { Stripe_Komplettzahlung_Link: l.link_url });
          komplettLink = l.link_url;
        } catch (e) {
          console.error("[vertrag-akzeptieren] Komplettzahlungs-Link-Erzeugung fehlgeschlagen:", e);
        }
      }

      // Restzahlungs-Link (Fallback — Hauptort ist anfrage/action bei Freigabe)
      const restSoll = num(buchungFresh.Restzahlung_Soll_Eur);
      if (!(buchungFresh.Stripe_Restzahlung_Link || "").trim() && restSoll > 0 && !buchungFresh.Restzahlung_Bezahlt_am) {
        try {
          const l = await createPaymentLink({
            buchungId,
            paymentType: "restzahlung",
            amountEur: restSoll,
            kundeName: kundeName || "Kunde",
            description: `Restzahlung Buchung #${buchungId} — Event ${buchungFresh.Event_datum_von || ""}`,
          });
          await updateRow(TABLES.Buchungen, buchungId, { Stripe_Restzahlung_Link: l.link_url });
        } catch (e) {
          console.error("[vertrag-akzeptieren] Restzahlungs-Link-Erzeugung fehlgeschlagen:", e);
        }
      }

      const bankblock = `   Kontoinhaber: Manuel Büttner
   IBAN: DE84 5001 0517 5420 4742 10
   BIC:  INGDDEFFXXX
   Bank: ING-DiBa AG`;
      const komplettZeile = komplettLink
        ? `

Oder direkt komplett zahlen (dann ist alles erledigt):
   ${komplettLink}`
        : "";
      const stripeBlock = stripeLink
        ? `Am bequemsten zahlen Sie online per Karte / Klarna / Sofort:
   ${stripeLink}${komplettZeile}

Alternativ klassisch per Überweisung:
${bankblock}`
        : bankblock;

      // Auto-Login-Link fuer Mein-Bereich
      let meinBereichUrl = "";
      try {
        meinBereichUrl = await memberAutoLoginUrl(kundeId, origin);
      } catch (e) {
        console.error("[vertrag-akzeptieren] memberAutoLoginUrl fehlgeschlagen:", e);
      }

      const anrede = kundeName ? `Hallo ${kundeName},` : "Hallo,";
      const body = `${anrede}

vielen Dank für Ihre Bestätigung. Ihr Termin ist zunächst vorgemerkt.

WICHTIG: Mit Eingang Ihrer Anzahlung von 30 Prozent wird Ihre Reservierung verbindlich bestätigt. Bitte leisten Sie die Anzahlung innerhalb von 7 Tagen:
${stripeBlock}
Verwendungszweck: ${angebot.Angebotsnummer}

Restzahlung und Kaution folgen bei Übergabe - gerne bar oder per Überweisung.

Etwa 7 Tage vor dem Event melde ich mich für die finale Abstimmung von Übergabe-Ort und -Zeit.

Ihren vollständigen Mietvertrag mit allen Bedingungen finden Sie hier:
${vertragsUrl}${meinBereichUrl ? `

Mein Bereich (Buchungs-Status + Zahlungen + Rechnungen):
${meinBereichUrl}` : ""}

Bei Fragen jederzeit per WhatsApp oder Anruf erreichbar: +49 156 79521124.

Mit freundlichen Grüßen
Manuel Büttner

Eventverleih Bergstraße
Schlesierstraße 19a, 64665 Alsbach-Hähnlein
Tel/WhatsApp: +49 156 79521124
E-Mail: info@eventverleih-bergstrasse.de

Nicht umsatzsteuerpflichtig nach § 19 Abs. 1 UStG.`;

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
          // Auto_Reply: Mail geht direkt ueber n8n-Poll raus, kein Manuel-Approval mehr
          // Manuels Freigabe geschah schon beim "Angebot freigeben" — die Bestaetigung ist
          // die logische Folge des Kunden-Klicks
          Approval_Status: "Auto_Reply",
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
  let kundenDaten: KundePatch | undefined;
  let declineFlags: DeclineFlags | undefined;
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    token = body.token || "";
    kundenDaten = {
      Telefon: typeof body.telefon === "string" ? body.telefon : undefined,
      Adresse_Strasse: typeof body.adresse_strasse === "string" ? body.adresse_strasse : undefined,
      Adresse_PLZ: typeof body.adresse_plz === "string" ? body.adresse_plz : undefined,
      Adresse_Ort: typeof body.adresse_ort === "string" ? body.adresse_ort : undefined,
    };
    declineFlags = {
      lieferung: body.decline_lieferung === true,
      abholung: body.decline_abholung === true,
      aufbau: body.decline_aufbau === true,
    };
  } else {
    const fd = await req.formData();
    token = String(fd.get("token") || "");
    kundenDaten = {
      Telefon: fd.get("telefon") ? String(fd.get("telefon")) : undefined,
      Adresse_Strasse: fd.get("adresse_strasse") ? String(fd.get("adresse_strasse")) : undefined,
      Adresse_PLZ: fd.get("adresse_plz") ? String(fd.get("adresse_plz")) : undefined,
      Adresse_Ort: fd.get("adresse_ort") ? String(fd.get("adresse_ort")) : undefined,
    };
    declineFlags = {
      lieferung: fd.get("decline_lieferung") === "true",
      abholung: fd.get("decline_abholung") === "true",
      aufbau: fd.get("decline_aufbau") === "true",
    };
  }
  return handle(token, req.nextUrl.origin, kundenDaten, declineFlags);
}
