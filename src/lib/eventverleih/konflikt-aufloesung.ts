/**
 * Konflikt-Aufloesung: Wenn ein Kunde die Anzahlung leistet und damit Buchung A
 * auf "Reserviert" wechselt, muessen konkurrierende Buchungen (Status Bestaetigt/
 * Angebot_versendet mit gemeinsamen Artikeln im Zeitraum) auto-storniert werden.
 *
 * Aufruf: aus dem Stripe-Webhook-Handler nach Status-Update auf "Reserviert".
 */
import { createRow, getRow, updateRow, TABLES } from "@/lib/baserow/client";
import { checkConflicts } from "./conflicts";
import { queueConflictStornoMail } from "./conflict-mails";

async function logAudit(buchungId: number, aktion: string, details: Record<string, unknown>) {
  try {
    await createRow(TABLES.Audit_Log, {
      Name: `${aktion} Buchung #${buchungId}`,
      Aktion: aktion,
      Zeitpunkt: new Date().toISOString(),
      Buchung_ID_Ref: String(buchungId),
      Akteur: "System (konflikt-aufloesung)",
      Details: JSON.stringify(details),
      Aktiv: true,
    });
  } catch (e) {
    console.error("[audit-log]", aktion, e);
  }
}

interface BuchungRow {
  id: number;
  Status_Erweitert: { value: string } | null;
  Event_datum_von: string | null;
  Event_datum_bis: string | null;
  Kunde_Link: Array<{ id: number; value: string }> | null;
}

/**
 * Wird ausgeloest wenn Buchung `winnerBuchungId` gerade ihre Anzahlung erhalten
 * hat (Status -> "Reserviert"). Stornt alle Konkurrenten + sendet Mails.
 */
export async function resolveKonfliktAfterAnzahlung(winnerBuchungId: number) {
  const winner = await getRow<BuchungRow>(TABLES.Buchungen, winnerBuchungId);
  const winnerName = winner.Kunde_Link?.[0]?.value || "Kunde";

  const conflicts = await checkConflicts(winnerBuchungId);
  if (conflicts.length === 0) return { resolved: 0 };

  let resolved = 0;
  for (const c of conflicts) {
    try {
      // Hole vollstaendige Konkurrent-Buchung fuer Kunde-ID
      const loser = await getRow<BuchungRow>(TABLES.Buchungen, c.buchung_id);
      const loserKundeId = loser.Kunde_Link?.[0]?.id;
      const loserKundeName = loser.Kunde_Link?.[0]?.value || "Kunde";

      // Konkurrent stornieren
      await updateRow(TABLES.Buchungen, c.buchung_id, {
        Status_Erweitert: "Storniert",
        Storno_Grund: "Konflikt_verloren",
        Storno_am: new Date().toISOString().slice(0, 10),
        Konflikt_Aufgeloest_am: new Date().toISOString().slice(0, 10),
      });
      await logAudit(c.buchung_id, "Konflikt_aufgeloest", {
        verloren_gegen_buchung_id: winnerBuchungId,
        gewinner_kunde: winnerName,
        shared_artikel: c.shared_artikel_namen,
      });

      // Mail an Verlierer
      if (loserKundeId) {
        await queueConflictStornoMail({
          buchungId: c.buchung_id,
          kundeId: loserKundeId,
          kundeName: loserKundeName,
          datumVon: loser.Event_datum_von || c.datum_von,
          datumBis: loser.Event_datum_bis || c.datum_bis,
          artikelNamen: c.shared_artikel_namen,
          gewinnerName: winnerName,
        });
      }
      resolved++;
    } catch (e) {
      console.error(`[konflikt-aufloesung] Buchung ${c.buchung_id}:`, e);
    }
  }

  // Auch beim Gewinner Konflikt-Aufgeloest-Marker setzen
  await updateRow(TABLES.Buchungen, winnerBuchungId, {
    Konflikt_Aufgeloest_am: new Date().toISOString().slice(0, 10),
  });

  return { resolved };
}
