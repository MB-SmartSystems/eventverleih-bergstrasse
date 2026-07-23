/**
 * Rechnung/Beleg für eine Buchung erzeugen — gemeinsamer Helper.
 *
 * Genutzt von:
 *  - /api/admin/buchung/[id]/rechnung-erstellen  (sendMail: true → eigener Beleg-Mail-Flow)
 *  - /api/admin/buchung/[id]/kaution-erstatten   (sendMail: false → Beleg-Link in Abschluss-Mail)
 *
 * Legt Rechnung-Row (GoBD-Snapshot) an, triggert den PDF-Render für den In-Portal-Download
 * und — nur wenn sendMail — den n8n-Beleg-Mail-Workflow.
 */
import { randomUUID } from "crypto";
import { createRow, getRow, listAllRows, updateRow, TABLES } from "@/lib/baserow/client";
import { triggerPdfRender } from "@/lib/eventverleih/pdf-render";

type BuchungRow = {
  id: number;
  Buchung_ID: number;
  Event_datum_von: string | null;
  Event_datum_bis: string | null;
  Preis_Artikel: string | null;
  Preis_Lieferung: string | null;
  Preis_Abholung: string | null;
  Preis_Aufbau: string | null;
  Preis_Abbau: string | null;
  Kaution_Soll_Eur: string | null;
  Kaution_Hinterlegt_am: string | null;
  Kaution_Rueckzahlung_Eur: string | null;
  Kaution_Rueckzahlung_am: string | null;
  Kaution_Pruefung_Status: { value: string } | null;
  Schaden_Betrag_Eur: string | null;
  Kaution_Schaden_Notiz: string | null;
  Status_Erweitert: { value: string } | null;
  Anzahlung_Bezahlt_am: string | null;
  Restzahlung_Bezahlt_am: string | null;
  Kunde_Link: Array<{ id: number }>;
};

type RechnungRow = {
  id: number;
  Rechnungsnummer: string;
  Rechnungsdatum: string | null;
  Token_Public?: string | null;
  Buchung_Link?: Array<{ id: number }>;
  Beleg_Mail_am?: string | null;
};

/**
 * Was mit der Belegmail passiert ist. Der Aufrufer MUSS das anzeigen: ein Erfolg ohne Mail
 * darf nie wie ein Versand aussehen — genau dieser stille Fehlschlag war der Defekt.
 *
 * - `gesendet`        → Versand wurde ausgelöst, `Beleg_Mail_am` ist gesetzt
 * - `schon_gesendet`  → `Beleg_Mail_am` war bereits gefüllt, bewusst keine zweite Mail
 * - `nicht_angefordert` → Aufruf mit `sendMail: false` (kaution-erstatten)
 * - `kein_webhook`    → `N8N_RECHNUNG_PDF_URL` fehlt, es ging nichts raus
 * - `fehlgeschlagen`  → Versand wurde versucht und schlug fehl, `Beleg_Mail_am` bleibt leer
 * - `gesendet_marker_fehlt` → Mail IST raus, der Marker konnte aber nicht gespeichert werden. Der
 *   Schutz vor einer zweiten Mail fehlt damit für den nächsten Klick; das muss die Oberfläche sagen.
 */
export type BelegMailStatus =
  | "gesendet"
  | "schon_gesendet"
  | "nicht_angefordert"
  | "kein_webhook"
  | "fehlgeschlagen"
  | "gesendet_marker_fehlt";

export type RechnungErgebnis =
  | {
      ok: true;
      rechnung_id: number;
      rechnungsnummer: string;
      token: string;
      url: string;
      mail: BelegMailStatus;
      /** ISO-Zeitpunkt des belegten Versands, falls bekannt. */
      mail_am?: string | null;
    }
  | { ok: false; status: number; error: string };

function num(v: string | null | undefined): number {
  return parseFloat(v ?? "0") || 0;
}

type KonfigRow = { id: number; Schluessel: string; Wert_Zahl: string | null };

/**
 * Reserviert die nächste Rechnungsnummer GoBD-eindeutig über einen zentralen
 * Zähler in System_Konfiguration (Schlüssel `rechnung.counter.<jahr>`) — statt
 * max+1 in JS zu rechnen. Zwei gleichzeitige/kurz aufeinanderfolgende
 * Erstellungen dürfen nie dieselbe RG-Nummer ziehen.
 *
 * Ablauf: Zähler lesen → auf max(Zähler, höchste bestehende Nummer) HEILEN
 * (falls der Zähler frisch ist oder alte max+1-Rechnungen davor existieren) →
 * +1, dabei bereits vergebene Nummern überspringen (Kollisions-Retry) → den
 * Zähler persistieren, BEVOR die Rechnung angelegt wird, damit ein paralleler
 * Aufruf den erhöhten Stand sieht. Baserow hat keine atomare Compare-and-Swap;
 * Zähler + Kollisions-Retry ist der praktikable saubere Weg (für das reale
 * Rechnungsvolumen GoBD-eindeutig; ein Rest-Fenster echter Millisekunden-
 * Gleichzeitigkeit bleibt theoretisch, ist bei manueller/Webhook-Erstellung aber
 * vernachlässigbar).
 */
async function reserviereRechnungsnummer(year: number, existing: RechnungRow[]): Promise<string> {
  const prefix = `RG-${year}-`;
  const key = `rechnung.counter.${year}`;

  // Höchste bereits vergebene Nummer + Menge aller vergebenen (Seed/Heilung + Kollisions-Check).
  let maxBestand = 0;
  const vergeben = new Set<number>();
  for (const r of existing) {
    if (!r.Rechnungsnummer?.startsWith(prefix)) continue;
    const m = r.Rechnungsnummer.slice(prefix.length).match(/^(\d+)/);
    if (m) {
      const n = parseInt(m[1], 10);
      vergeben.add(n);
      if (n > maxBestand) maxBestand = n;
    }
  }

  const konfig = await listAllRows<KonfigRow>(TABLES.System_Konfiguration);
  const counterRow = konfig.results.find((r) => (r.Schluessel || "").trim() === key);
  const counterVal = counterRow?.Wert_Zahl ? parseInt(counterRow.Wert_Zahl, 10) || 0 : 0;

  // Nie hinter den Bestand fallen; nächste freie Nummer suchen.
  let next = Math.max(counterVal, maxBestand) + 1;
  while (vergeben.has(next)) next++;

  // Zähler VOR dem Anlegen der Rechnung fortschreiben (paralleler Aufruf sieht den erhöhten Stand).
  if (counterRow) {
    await updateRow(TABLES.System_Konfiguration, counterRow.id, { Wert_Zahl: next });
  } else {
    await createRow(TABLES.System_Konfiguration, { Schluessel: key, Wert_Zahl: next });
  }

  return `${prefix}${String(next).padStart(4, "0")}`;
}

/** Bestehende Rechnung für eine Buchung finden (vermeidet Doppel-Belege). */
export async function findRechnungForBuchung(
  buchungId: number,
): Promise<{ id: number; rechnungsnummer: string; token: string | null; url: string | null } | null> {
  const all = await listAllRows<RechnungRow>(TABLES.Rechnungen);
  const r = all.results.find((x) => x.Buchung_Link?.[0]?.id === buchungId);
  if (!r) return null;
  const token = r.Token_Public ?? null;
  return {
    id: r.id,
    rechnungsnummer: r.Rechnungsnummer,
    token,
    url: token ? `https://eventverleih-bergstrasse.de/rechnung/${token}` : null,
  };
}

/**
 * Löst die Belegmail für eine Rechnung aus — genau einmal.
 *
 * Der Versand-Marker `Beleg_Mail_am` (Rechnungen 950) ist die Wahrheit darüber, ob der Kunde die
 * Mail bekommen hat. Ohne ihn war beides unmöglich: nachsehen, ob etwas rausging, und gefahrlos
 * nachsenden. Er wird erst NACH dem erfolgreichen Webhook-Aufruf gesetzt; schlägt der fehl, bleibt
 * er leer, damit ein zweiter Versuch möglich ist.
 *
 * Ein LEERES Feld heißt "unbekannt", nicht "nicht verschickt" — es existiert erst seit 2026-07-23.
 */
async function sendeBelegMail(
  rechnungId: number,
  faelligkeit: string,
  bereitsGesendetAm: string | null | undefined,
): Promise<{ status: BelegMailStatus; mailAm: string | null }> {
  if (bereitsGesendetAm) return { status: "schon_gesendet", mailAm: bereitsGesendetAm };

  const webhookUrl = process.env.N8N_RECHNUNG_PDF_URL;
  if (!webhookUrl) {
    console.error("[rechnung] N8N_RECHNUNG_PDF_URL fehlt — keine Belegmail ausgeloest");
    return { status: "kein_webhook", mailAm: null };
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rechnung_id: rechnungId, faelligkeit }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error(`[rechnung] Beleg-Mail-Webhook antwortete ${res.status}`);
      return { status: "fehlgeschlagen", mailAm: null };
    }
  } catch (e) {
    console.error("n8n rechnung-pdf webhook failed", e);
    return { status: "fehlgeschlagen", mailAm: null };
  }

  // Marker erst nach erfolgreichem Versand schreiben. Scheitert das, ist die Mail trotzdem draußen,
  // aber der Schutz vor einer zweiten fehlt: beim nächsten Klick wäre das Feld wieder leer und der
  // Guard würde durchlassen. Deshalb ein Wiederholversuch — und wenn auch der scheitert, ein eigener
  // Status, den die Oberfläche sichtbar macht. Ein „gesendet" zu melden, dessen Dublettenschutz gar
  // nicht persistiert ist, wäre wieder genau die stille Zusage, die den Defekt ausgemacht hat.
  const jetzt = new Date().toISOString();
  for (const versuch of [1, 2]) {
    try {
      await updateRow(TABLES.Rechnungen, rechnungId, { Beleg_Mail_am: jetzt });
      return { status: "gesendet", mailAm: jetzt };
    } catch (e) {
      console.error(`[rechnung] Beleg_Mail_am Schreibversuch ${versuch} fehlgeschlagen:`, e);
      if (versuch === 1) await new Promise((r) => setTimeout(r, 500));
    }
  }
  console.error(
    `[rechnung] Belegmail für Rechnung ${rechnungId} ist RAUS, Beleg_Mail_am konnte nicht gesetzt werden. ` +
      `Marker bitte von Hand auf ${jetzt} setzen, sonst droht ein Doppelversand.`,
  );
  return { status: "gesendet_marker_fehlt", mailAm: jetzt };
}

export async function createRechnungForBuchung(
  buchungId: number,
  opts: { sendMail: boolean },
): Promise<RechnungErgebnis> {
  const buchung = await getRow<BuchungRow>(TABLES.Buchungen, buchungId);

  // Vollstaendig paginiert (nicht listRows size:500 -> Baserow klemmt auf 200, dann
  // saehe die Nummernvergabe ab der 201. Rechnung/Jahr nur die aeltesten 200 und
  // vergaebe eine bereits genutzte RG-Nummer). GoBD: Nummern muessen eindeutig sein.
  const existing = await listAllRows<RechnungRow>(TABLES.Rechnungen);
  // Idempotenz ZUERST, vor jeder Validierung: existiert schon ein Beleg, wird keiner erzeugt
  // (kein Doppel-Beleg; jeder verbraucht sonst eine Nummer -> Stornopflicht). Die Prüfungen
  // darunter gehören zur ERSTELLUNG — eine längst eingefrorene Rechnung nachträglich an ihnen
  // zu messen, würde nur das Nachholen der Belegmail blockieren, etwa wenn die Preise der
  // Buchung inzwischen auf 0 stehen oder eine Adresse geleert wurde.
  const vorhanden = existing.results.find((x) => x.Buchung_Link?.[0]?.id === buchungId);
  if (vorhanden) {
    const t = vorhanden.Token_Public ?? "";
    // Der frühe Ausstieg gibt zwar die vorhandene Rechnung zurück, hat aber bis 2026-07-23 auch den
    // Mail-Trigger mitverschluckt: Wer den Beleg über kaution-erstatten (sendMail: false) angelegt
    // hatte, konnte danach über "Rechnung erstellen + Mail senden" keine Belegmail mehr auslösen —
    // der Button meldete Erfolg, es passierte nur nichts. Der Versand hängt jetzt am sendMail-Flag
    // plus Marker, nicht mehr am Neuanlage-Pfad.
    let mail: BelegMailStatus = "nicht_angefordert";
    let mailAm: string | null = vorhanden.Beleg_Mail_am ?? null;
    if (opts.sendMail) {
      const basis = (vorhanden.Rechnungsdatum ?? new Date().toISOString()).slice(0, 10);
      const faelligBestand = new Date(new Date(basis).getTime() + 14 * 86400 * 1000)
        .toISOString()
        .slice(0, 10);
      const r = await sendeBelegMail(vorhanden.id, faelligBestand, vorhanden.Beleg_Mail_am);
      mail = r.status;
      mailAm = r.mailAm;
    }
    return {
      ok: true,
      rechnung_id: vorhanden.id,
      rechnungsnummer: vorhanden.Rechnungsnummer,
      token: t,
      url: t ? `https://eventverleih-bergstrasse.de/rechnung/${t}` : "",
      mail,
      mail_am: mailAm,
    };
  }

  const kundeId = buchung.Kunde_Link?.[0]?.id;
  if (!kundeId) return { ok: false, status: 422, error: "Buchung hat keinen Kunden" };

  // §14 Abs. 4 Nr. 1 UStG: Empfänger-Anschrift Pflicht.
  type Kunde = {
    id: number;
    Vorname: string;
    Nachname: string;
    Firma: string | null;
    Adresse_Strasse: string;
    Adresse_PLZ: string;
    Adresse_Ort: string;
  };
  const kunde = await getRow<Kunde>(TABLES.Kunden, kundeId);
  const missing: string[] = [];
  if (!kunde.Vorname?.trim() && !kunde.Nachname?.trim()) missing.push("Name");
  if (!kunde.Adresse_Strasse?.trim()) missing.push("Straße");
  if (!kunde.Adresse_PLZ?.trim()) missing.push("PLZ");
  if (!kunde.Adresse_Ort?.trim()) missing.push("Ort");
  if (missing.length > 0) {
    return {
      ok: false,
      status: 422,
      error: `Kunde unvollständig — fehlt: ${missing.join(", ")}. Bitte erst im Kunden-Dashboard ergänzen.`,
    };
  }

  const summe =
    num(buchung.Preis_Artikel) +
    num(buchung.Preis_Lieferung) +
    num(buchung.Preis_Abholung) +
    num(buchung.Preis_Aufbau) +
    num(buchung.Preis_Abbau);
  if (summe <= 0) {
    return { ok: false, status: 422, error: "Keine Preise gesetzt — Rechnung würde 0,00 € lauten" };
  }

  const vollBezahlt = !!buchung.Anzahlung_Bezahlt_am && !!buchung.Restzahlung_Bezahlt_am;

  const year = new Date().getFullYear();
  const rechnungsnummer = await reserviereRechnungsnummer(year, existing.results);
  const token = randomUUID();
  const heute = new Date().toISOString().slice(0, 10);
  const faelligkeit = new Date(Date.now() + 14 * 86400 * 1000).toISOString().slice(0, 10);

  // GoBD-Snapshot
  type Position = {
    id: number;
    Anzahl: string | null;
    Einzelpreis_Eur: string | null;
    Position_Gesamt_Eur: string | null;
    Artikel_Link: Array<{ id: number; value: string }> | null;
    Buchung_Link: Array<{ id: number }> | null;
  };
  const positionenAll = await listAllRows<Position>(TABLES.Buchungs_Position);
  // Artikel_Link.value ist das (numerische) Artikel-Primaerfeld, NICHT der Name.
  // Echten Namen ueber die Artikel-Tabelle (Bezeichnung) aufloesen.
  const artikelAll = await listAllRows<{ id: number; Bezeichnung: string }>(TABLES.Artikel);
  const artikelNameById = new Map(artikelAll.results.map((a) => [a.id, a.Bezeichnung]));
  const positionen = positionenAll.results
    .filter((p) => p.Buchung_Link?.[0]?.id === buchungId)
    .map((p) => ({
      artikel:
        artikelNameById.get(p.Artikel_Link?.[0]?.id ?? -1) || p.Artikel_Link?.[0]?.value || "Artikel",
      anzahl: parseFloat(p.Anzahl ?? "0"),
      einzelpreis_eur: parseFloat(p.Einzelpreis_Eur ?? "0"),
      gesamt_eur: parseFloat(p.Position_Gesamt_Eur ?? "0"),
    }));

  const kautionSoll = num(buchung.Kaution_Soll_Eur);
  const kautionAbgeschlossen = buchung.Kaution_Pruefung_Status?.value === "abgeschlossen";
  const kautionSchadenEur = num(buchung.Schaden_Betrag_Eur);
  const kautionErstattungEur = num(buchung.Kaution_Rueckzahlung_Eur);
  type KautionBelegTyp = "erstattung" | "einbehalt" | "keine";
  const kautionBelegTyp: KautionBelegTyp =
    !kautionAbgeschlossen || kautionSoll === 0
      ? "keine"
      : kautionSchadenEur > 0
      ? "einbehalt"
      : "erstattung";

  const snapshot = {
    schema_version: 2,
    gobd_frozen_at: new Date().toISOString(),
    kunde: {
      anrede_form: kunde.Firma ? "firma" : "person",
      firma: kunde.Firma || null,
      vorname: kunde.Vorname,
      nachname: kunde.Nachname,
      adresse_strasse: kunde.Adresse_Strasse,
      adresse_plz: kunde.Adresse_PLZ,
      adresse_ort: kunde.Adresse_Ort,
    },
    buchung: {
      buchung_id: buchung.Buchung_ID,
      event_datum_von: buchung.Event_datum_von,
      event_datum_bis: buchung.Event_datum_bis,
      preis_artikel_eur: num(buchung.Preis_Artikel),
      preis_lieferung_eur: num(buchung.Preis_Lieferung),
      preis_abholung_eur: num(buchung.Preis_Abholung),
      preis_aufbau_eur: num(buchung.Preis_Aufbau),
      preis_abbau_eur: num(buchung.Preis_Abbau),
      kaution_soll_eur: kautionSoll,
    },
    kaution: {
      soll_eur: kautionSoll,
      hinterlegt_am: buchung.Kaution_Hinterlegt_am ?? null,
      schaden_eur: kautionSchadenEur,
      erstattung_eur: kautionErstattungEur,
      schaden_notiz: buchung.Kaution_Schaden_Notiz ?? null,
      beleg_typ: kautionBelegTyp,
      abgeschlossen: kautionAbgeschlossen,
    },
    positionen,
    rechnung: {
      rechnungsnummer,
      rechnungsdatum: heute,
      bezahlt: vollBezahlt,
      faelligkeit,
      betrag_netto_eur: summe,
      betrag_ust_eur: 0,
      betrag_gesamt_eur: summe,
      ust_satz: 0,
      ust_hinweis: "Nicht umsatzsteuerpflichtig nach § 19 Abs. 1 UStG.",
    },
  };

  const created = await createRow<RechnungRow>(TABLES.Rechnungen, {
    Rechnungsnummer: rechnungsnummer,
    Rechnungsdatum: heute,
    Typ_Erweitert: "Komplett",
    Status: vollBezahlt ? "Bezahlt" : "Gesendet",
    Betrag_Netto: summe,
    Betrag_USt: 0,
    Betrag_Gesamt: summe,
    USt_Satz: 0,
    Mahnstufe: "keine",
    Buchung_Link: [buchungId],
    Kunde_Link: [kundeId],
    Token_Public: token,
    Snapshot_JSON: JSON.stringify(snapshot),
  });

  // Ursache-Fix: der Übergang "Zurueckgegeben" -> "Abgerechnet" lag bisher ausschließlich in
  // /api/admin/rechnung/[id]/bezahlt. Entsteht eine Rechnung aber bereits als "Bezahlt" (Kunde
  // hat vor der Rückgabe gezahlt, bei uns der Normalfall), wird der dortige Button "Als bezahlt
  // markieren" nie angezeigt, der Endpoint nie aufgerufen und der Status nie gesetzt. Deshalb
  // hier im Helper, den beide Erstellungspfade durchlaufen (rechnung-erstellen und
  // kaution-erstatten).
  //
  // Gleicher Guard wie im bezahlt-Endpoint: nur aus "Zurueckgegeben" heraus, damit eine früh
  // bezahlte Rechnung keine Buchung schließt, deren Material noch draußen ist.
  //
  // Zusätzlich: eine noch offene Kaution hält die Buchung aktiv (Manuel 2026-06-16, "solange eine
  // Kautionsrückzahlung fällig ist, darf die Buchung nicht abgeschlossen erscheinen"). Praktisch
  // hängt daran auch das Kaution-erstatten-Panel im Backoffice, das nur bei "Zurueckgegeben"
  // gerendert wird — ein vorzeitiges "Abgerechnet" würde Manuel die Erstattungs-Oberfläche
  // wegnehmen. Beim Weg über kaution-erstatten ist Kaution_Rueckzahlung_am zu diesem Zeitpunkt
  // bereits gesetzt, dort greift die Automatik also weiterhin.
  const kautionOffen = num(buchung.Kaution_Soll_Eur) > 0 && !buchung.Kaution_Rueckzahlung_am;
  if (vollBezahlt && !kautionOffen && buchung.Status_Erweitert?.value === "Zurueckgegeben") {
    try {
      await updateRow(TABLES.Buchungen, buchungId, { Status_Erweitert: "Abgerechnet" });
    } catch (e) {
      console.error("[rechnung] Buchung-Abschluss fehlgeschlagen:", e);
    }
  }

  // n8n-Beleg-Mail (nur wenn gewünscht — kaution-erstatten verlinkt den Beleg stattdessen).
  // Frisch angelegt, also ist der Marker zwangsläufig leer.
  let mail: BelegMailStatus = "nicht_angefordert";
  let mailAm: string | null = null;
  if (opts.sendMail) {
    const r = await sendeBelegMail(created.id, faelligkeit, null);
    mail = r.status;
    mailAm = r.mailAm;
  }

  // Render-Flow für In-Portal-Download (Blob + Rechnungen.PDF_URL), fail-soft.
  await triggerPdfRender({ table: "rechnung", id: created.id, token });

  return {
    ok: true,
    rechnung_id: created.id,
    rechnungsnummer,
    token,
    url: `https://eventverleih-bergstrasse.de/rechnung/${token}`,
    mail,
    mail_am: mailAm,
  };
}
