/**
 * POST /api/vertrag-akzeptieren
 *
 * Body: form-data oder JSON mit { token: string }
 *
 * Verhalten (neue Lifecycle-Logik 2026-05-15):
 *   1. Sucht Angebot-Row via Token_Public
 *   2. Updated Angebote.Status = Akzeptiert, Akzeptiert_am = now, Akzept_Snapshot freezen
 *   3. Updated Buchungen.Status_Erweitert = "Bestaetigt" (Hart-Block, Reserviert erst nach Anzahlung)
 *   4. Konflikt-Detection: pruefe parallele Buchungen mit gemeinsamen Artikeln im Zeitraum
 *      → bei Treffer: Konflikt_Mit_Buchung_ID setzen, Hinweis-Mail an alle Beteiligten
 *   5. Erstellt MailQueue-Eintrag fuer Vertrag-Bestaetigungs-Mail (Approval=Pending)
 *   6. Redirect zur Angebots-Seite (Status zeigt jetzt "akzeptiert")
 */
import { NextRequest, NextResponse } from "next/server";
import { createRow, getRow, listRows, updateRow, TABLES } from "@/lib/baserow/client";
import { checkConflicts } from "@/lib/eventverleih/conflicts";
import { queueConflictHinweisMail } from "@/lib/eventverleih/conflict-mails";

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

async function handle(
  token: string,
  origin: string,
  kundenDaten?: KundePatch
): Promise<NextResponse> {
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
      Snapshot_JSON: string | null;
      Snapshot_Version: string | null;
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

    // Updates IMMER laufen lassen — Baserow ist idempotent bei gleichem Wert (no-op-Write).
    const alreadyAccepted = angebot.Status?.value === "Akzeptiert";
    const angebotUpdate: Record<string, unknown> = {
      Status: "Akzeptiert",
      ...(alreadyAccepted ? {} : { Akzeptiert_am: new Date().toISOString() }),
    };
    // Akzept-Snapshot speichern: was Kunde rechtsverbindlich akzeptiert hat
    if (angebot.Snapshot_JSON) {
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
        Status: "Reserviert", // Legacy-Feld (alte Single-Select), bleibt zur Kompatibilitaet
        Status_Erweitert: "Bestaetigt",
      });
      await logAudit(buchungId, "Status_Change", {
        from: currentStatus || "(neu)",
        to: "Bestaetigt",
        trigger: "kunde_token_klick",
        token_prefix: token.slice(0, 8),
      });

      // Konflikt-Detection: parallele Buchungen mit gemeinsamen Artikeln im Zeitraum?
      try {
        const conflicts = await checkConflicts(buchungId);
        if (conflicts.length > 0) {
          // Verlinke ersten Konflikt am Ziel-Datensatz (Hauptkonflikt)
          await updateRow(TABLES.Buchungen, buchungId, {
            Konflikt_Mit_Buchung_ID: [conflicts[0].buchung_id],
          });
          await logAudit(buchungId, "Konflikt_erkannt", {
            konflikt_mit: conflicts.map((c) => ({
              buchung_id: c.buchung_id,
              status: c.status,
              kunde: c.kunde_name,
              shared_artikel: c.shared_artikel_namen,
            })),
          });

          // Sammle Kunden-Daten der Ziel-Buchung fuer Hinweis-Mail
          const targetKundeName = (await getRow<{ Name: string }>(TABLES.Kunden, kundeId))?.Name || "Kunde";
          const targetVon = buchungFresh.Event_datum_von || "";
          const targetBis = buchungFresh.Event_datum_bis || "";

          // Hinweis-Mail an Ziel-Kunden mit Liste aller Konflikt-Artikel
          const allArtikelNamen = Array.from(
            new Set(conflicts.flatMap((c) => c.shared_artikel_namen)),
          );
          await queueConflictHinweisMail({
            buchungId,
            kundeId,
            kundeName: targetKundeName,
            datumVon: targetVon,
            datumBis: targetBis,
            artikelNamen: allArtikelNamen,
          });

          // Hinweis-Mail an jeden konkurrierenden Kunden
          for (const c of conflicts) {
            const cBuchung = await getRow<{
              Kunde_Link: Array<{ id: number; value: string }> | null;
              Event_datum_von: string | null;
              Event_datum_bis: string | null;
            }>(TABLES.Buchungen, c.buchung_id);
            const cKundeId = cBuchung.Kunde_Link?.[0]?.id;
            const cKundeName = cBuchung.Kunde_Link?.[0]?.value || "Kunde";
            if (cKundeId) {
              await queueConflictHinweisMail({
                buchungId: c.buchung_id,
                kundeId: cKundeId,
                kundeName: cKundeName,
                datumVon: cBuchung.Event_datum_von || c.datum_von,
                datumBis: cBuchung.Event_datum_bis || c.datum_bis,
                artikelNamen: c.shared_artikel_namen,
              });
              // Verlinke umgekehrt auch beim Konkurrenten (falls noch nicht gesetzt)
              await updateRow(TABLES.Buchungen, c.buchung_id, {
                Konflikt_Mit_Buchung_ID: [buchungId],
              });
            }
          }
        }
      } catch (e) {
        console.error("[vertrag-akzeptieren] Konflikt-Check fehlgeschlagen:", e);
        // Nicht-fatal — Akzept soll trotzdem durchlaufen
      }
    }
    // Sonst: Buchung ist bereits weiter im Workflow — keine Regression erlauben.

    // MailQueue-Insert IMMER versuchen (auch bei alreadyAccepted=true) —
    // deckt den Fall ab, dass erster POST nach Status-Update aber vor MailQueue-Insert gefailt ist.
    // Idempotency-Key stabil → kein Duplicate.
    {
      // MailQueue: Vertrag-Bestaetigungs-Mail (mit Manuel-Approval)
      const subject = "Termin vorgemerkt - bitte Anzahlung leisten | Eventverleih Bergstrasse";
      const vertragsUrl = `${origin}/vertrag/${token}`;

      // Hole Stripe-Anzahlungs-Link aus Buchung falls schon generiert
      const stripeLink = (buchungFresh as { Stripe_Anzahlung_Link?: string | null })
        .Stripe_Anzahlung_Link || null;
      const stripeBlock = stripeLink
        ? `Am bequemsten zahlen Sie online per Karte / Klarna / Sofort:
   ${stripeLink}

Alternativ klassisch:
   IBAN: DE84 5001 0517 5420 4742 10
   PayPal: manuelbuettner@web.de`
        : `   IBAN: DE84 5001 0517 5420 4742 10
   PayPal: manuelbuettner@web.de`;

      const body = `Hallo,

vielen Dank fuer Ihre Bestaetigung. Ihr Termin ist zunaechst vorgemerkt.

WICHTIG: Mit Eingang Ihrer Anzahlung von 30 Prozent wird Ihre Reservierung verbindlich bestaetigt. Bitte leisten Sie die Anzahlung innerhalb von 7 Tagen:
${stripeBlock}
Verwendungszweck: bitte Ihre Angebotsnummer angeben.

Restzahlung und Kaution folgen bei Uebergabe - gerne bar, per Ueberweisung oder PayPal.

Etwa 7 Tage vor dem Event melde ich mich fuer die finale Abstimmung von Uebergabe-Ort und -Zeit.

Ihren vollstaendigen Mietvertrag mit allen Bedingungen finden Sie hier:
${vertragsUrl}

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
  } else {
    const fd = await req.formData();
    token = String(fd.get("token") || "");
    kundenDaten = {
      Telefon: fd.get("telefon") ? String(fd.get("telefon")) : undefined,
      Adresse_Strasse: fd.get("adresse_strasse") ? String(fd.get("adresse_strasse")) : undefined,
      Adresse_PLZ: fd.get("adresse_plz") ? String(fd.get("adresse_plz")) : undefined,
      Adresse_Ort: fd.get("adresse_ort") ? String(fd.get("adresse_ort")) : undefined,
    };
  }
  return handle(token, req.nextUrl.origin, kundenDaten);
}
