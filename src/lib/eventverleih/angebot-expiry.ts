/**
 * Stiller Auto-Ablauf offener Anfragen/Angebote (Hobby-Plan: kein eigener Cron —
 * wird vom restzahlung-reminder-Cron mit-ausgeführt).
 *
 * Regel (Manuel, 2026-06-16): Ein Angebot lebt, solange es angenommen werden KANN.
 * Sobald das Event-STARTdatum verstrichen ist und der Kunde weder bestätigt noch
 * angezahlt hat, ist die Anfrage tot — wird automatisch auf "Abgelaufen" gesetzt und
 * verschwindet damit aus der Anfragen-Liste (die filtert auf Anfrage/Angebot_erstellt/
 * Angebot_versendet).
 *
 * WICHTIG: KEINE Kundenmail. Der Kunde hat sich nicht gemeldet — eine "Ihre Anfrage ist
 * abgelaufen"-Mail wäre nur Lärm. Rein interne Aufräum-Aktion.
 *
 * Voraussetzung in Baserow: Single-Select-Option "Abgelaufen" muss in BEIDEN Feldern
 * existieren — Buchungen.Status_Erweitert UND Angebote.Status. Fehlt sie, schlägt der
 * updateRow für die Zeile fehl (fail-soft, wird gezählt, nächster Lauf versucht erneut).
 */
import { listAllRows, getRow, updateRow, TABLES } from "@/lib/baserow/client";

interface BuchungRow {
  id: number;
  Status_Erweitert: { value: string } | null;
  Event_datum_von: string | null;
  Anzahlung_Bezahlt_am: string | null;
  Angebote: Array<{ id: number; value: string }> | null;
}

interface AngebotRow {
  id: number;
  Status: { value: string } | null;
  Akzeptiert_am: string | null;
}

// Nur Vorgänge, die noch in der Anfragen-Liste leben, kommen für den Ablauf in Frage.
const OFFENE_STATUS = new Set(["Anfrage", "Angebot_erstellt", "Angebot_versendet"]);

export async function runAngebotExpiry(): Promise<Record<string, unknown>> {
  const result = { pruefte: 0, abgelaufen: 0, skipped_akzeptiert: 0, fehler: 0 };

  const heute = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const all = await listAllRows<BuchungRow>(TABLES.Buchungen);

  for (const b of all.results) {
    const status = b.Status_Erweitert?.value || "";
    if (!OFFENE_STATUS.has(status)) continue;
    if (b.Anzahlung_Bezahlt_am) continue;
    if (!b.Event_datum_von) continue; // ohne Datum nie automatisch ablaufen — bleibt für manuelle Hand
    const eventVon = b.Event_datum_von.slice(0, 10);
    if (eventVon >= heute) continue; // Start noch nicht verstrichen → Angebot lebt weiter

    result.pruefte++;

    // Sicherheits-Pre-Check: frisch laden, falls zwischen listAllRows und hier etwas passiert ist.
    let buchungAktuell: BuchungRow;
    try {
      buchungAktuell = await getRow<BuchungRow>(TABLES.Buchungen, b.id);
    } catch (e) {
      console.error("[angebot-expiry] pre-check getRow fehlgeschlagen:", e);
      result.fehler++;
      continue;
    }
    if (buchungAktuell.Anzahlung_Bezahlt_am) continue;
    if (!OFFENE_STATUS.has(buchungAktuell.Status_Erweitert?.value || "")) continue;

    // Verknüpftes Angebot prüfen: wurde es zwischenzeitlich akzeptiert, NICHT ablaufen lassen.
    const angebotId = b.Angebote?.[0]?.id;
    if (angebotId) {
      try {
        const ang = await getRow<AngebotRow>(TABLES.Angebote, angebotId);
        if (ang.Akzeptiert_am) {
          result.skipped_akzeptiert++;
          continue;
        }
      } catch (e) {
        console.error("[angebot-expiry] angebot-fetch fehlgeschlagen:", e);
        // fail-soft: Buchung trotzdem ablaufen lassen, Angebot beim nächsten Lauf
      }
    }

    try {
      await updateRow(TABLES.Buchungen, b.id, { Status_Erweitert: "Abgelaufen" });
      if (angebotId) {
        await updateRow(TABLES.Angebote, angebotId, {
          Status: "Abgelaufen",
          Abgelehnt_Grund: "Auto-abgelaufen — Eventdatum verstrichen, keine Kundenreaktion",
        });
      }
      result.abgelaufen++;
    } catch (e) {
      result.fehler++;
      console.error("[angebot-expiry] update fehlgeschlagen (Option 'Abgelaufen' in Baserow angelegt?):", e);
    }
  }

  return result;
}
