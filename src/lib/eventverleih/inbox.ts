/**
 * Inbox-Daten-Aggregation fuer das Admin-Home-Dashboard.
 *
 * Liefert vier Quadranten:
 *   - HEUTE_ZU_TUN  : Manuel-Aktionen, die heute anstehen
 *   - UEBERFAELLIG  : Items, die ueber Schwelle haengen
 *   - WARTET_KUNDE  : Passive Beobachtung (Angebot raus, kein Klick / Bestaetigt ohne Anzahlung)
 *   - WARTET_GELD   : Anzahlung/Restzahlung/Kaution-Rueckzahlung offen, mit Summen
 *
 * Plus ein Mail-Queue-Widget: Anzahl Approval_Status="Pending"
 *
 * Alle Listen begrenzt auf 5 Items + Counter "+N weitere".
 */
import { listAllRows, TABLES } from "@/lib/baserow/client";

export interface InboxItem {
  id: number;
  buchungId?: number;
  title: string;
  subtitle?: string;
  age_days?: number;
  amount_eur?: number;
  link: string;
}

export interface QuadrantData {
  total: number;
  items: InboxItem[];
  sum_eur?: number;
}

export interface InboxData {
  mailqueue_pending: number;
  gerade_bestaetigt: QuadrantData;
  heute_zu_tun: QuadrantData;
  ueberfaellig: QuadrantData;
  wartet_kunde: QuadrantData;
  wartet_geld: QuadrantData;
  generated_at: string;
}

interface BuchungRow {
  id: number;
  Status_Erweitert: { value: string } | null;
  Event_datum_von: string | null;
  Event_datum_bis: string | null;
  Anzahlung_Soll_Eur: number | null;
  Anzahlung_Bezahlt_am: string | null;
  Restzahlung_Soll_Eur: number | null;
  Restzahlung_Bezahlt_am: string | null;
  Kaution_Soll_Eur: number | null;
  Kaution_Hinterlegt_am: string | null;
  Kaution_Rueckzahlung_Eur: number | null;
  Kaution_Rueckzahlung_am: string | null;
  Kunde_Link: Array<{ id: number; value: string }> | null;
  Restzahlung_Mail_Versendet_am: string | null;
}

interface MailQueueRow {
  id: number;
  Approval_Status: { value: string } | null;
  Subject: string | null;
  Buchung_Link: Array<{ id: number; value: string }> | null;
  Erstellt_am: string | null;
}

interface AngebotRow {
  id: number;
  Status: { value: string } | null;
  Angebotsdatum: string | null;
  Anfragedatum: string | null;
  Akzeptiert_am: string | null;
  Buchung_Link: Array<{ id: number; value: string }> | null;
  Kunde_Link: Array<{ id: number; value: string }> | null;
  Gesamtpreis: number | null;
}

const DAY_MS = 86_400_000;

function daysAgo(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / DAY_MS);
}

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

function isPast(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  return d.getTime() < Date.now() - DAY_MS;
}

function kundeName(b: BuchungRow): string {
  return b.Kunde_Link?.[0]?.value || "(unbekannt)";
}

function fmtDate(s: string | null): string {
  if (!s) return "?";
  return s.split("T")[0];
}

export async function loadInboxData(): Promise<InboxData> {
  const [buchungenRes, mailqueueRes, angeboteRes] = await Promise.all([
    listAllRows<BuchungRow>(TABLES.Buchungen),
    listAllRows<MailQueueRow>(TABLES.MailQueue),
    listAllRows<AngebotRow>(TABLES.Angebote),
  ]);
  const buchungen = buchungenRes.results;
  const mailqueue = mailqueueRes.results;
  const angebote = angeboteRes.results;

  // ----- Mail-Queue Widget -----
  const mailqueue_pending = mailqueue.filter(
    (m) => m.Approval_Status?.value === "Pending",
  ).length;

  // ----- HEUTE ZU TUN -----
  const heuteItems: InboxItem[] = [];
  // Anfragen offen (Status = Anfrage oder Angebot_erstellt)
  const offeneAnfragen = buchungen.filter((b) => {
    const s = b.Status_Erweitert?.value || "";
    return s === "Anfrage" || s === "Angebot_erstellt";
  });
  for (const b of offeneAnfragen) {
    heuteItems.push({
      id: b.id,
      buchungId: b.id,
      title: kundeName(b),
      subtitle: `Anfrage offen — Termin ${fmtDate(b.Event_datum_von)}`,
      link: `/admin/buchungen/${b.id}`,
    });
  }
  // Mail-Queue Pending → Drill-Down
  const pendingMails = mailqueue.filter(
    (m) => m.Approval_Status?.value === "Pending",
  );
  for (const m of pendingMails) {
    heuteItems.push({
      id: m.id,
      buchungId: m.Buchung_Link?.[0]?.id,
      title: m.Subject || `MailQueue #${m.id}`,
      subtitle: `Mail wartet auf Freigabe`,
      link: m.Buchung_Link?.[0]?.id
        ? `/admin/buchungen/${m.Buchung_Link[0].id}`
        : `/admin/anfragen`,
    });
  }
  // Uebergaben heute (Datum_Beginn = heute)
  const uebergabenHeute = buchungen.filter(
    (b) =>
      isToday(b.Event_datum_von) &&
      b.Status_Erweitert?.value === "Reserviert",
  );
  for (const b of uebergabenHeute) {
    heuteItems.push({
      id: b.id,
      buchungId: b.id,
      title: kundeName(b),
      subtitle: `Uebergabe heute (${fmtDate(b.Event_datum_von)})`,
      link: `/admin/buchungen/${b.id}`,
    });
  }
  // Rueckgaben heute
  const ruecknahmenHeute = buchungen.filter(
    (b) =>
      isToday(b.Event_datum_bis) &&
      b.Status_Erweitert?.value === "In_Miete",
  );
  for (const b of ruecknahmenHeute) {
    heuteItems.push({
      id: b.id,
      buchungId: b.id,
      title: kundeName(b),
      subtitle: `Rueckgabe heute (${fmtDate(b.Event_datum_bis)})`,
      link: `/admin/buchungen/${b.id}`,
    });
  }

  // ----- UEBERFAELLIG -----
  const ueberItems: InboxItem[] = [];
  // Anfragen >7d ohne Bewegung
  for (const b of offeneAnfragen) {
    const a = daysAgo(b.Event_datum_von) ?? 0;
    if (a > 7) {
      ueberItems.push({
        id: b.id,
        buchungId: b.id,
        title: kundeName(b),
        subtitle: `Anfrage seit ${a}d ohne Bewegung`,
        age_days: a,
        link: `/admin/buchungen/${b.id}`,
      });
    }
  }
  // Anzahlung 3d nach Bestaetigt-Versand ausstehend
  const wartetAnzahlung = buchungen.filter(
    (b) => b.Status_Erweitert?.value === "Bestaetigt",
  );
  for (const b of wartetAnzahlung) {
    // Heuristik: wenn Event_datum_von in <14d und keine Anzahlung, ueberfaellig
    const eventIn = b.Event_datum_von
      ? Math.floor((new Date(b.Event_datum_von).getTime() - Date.now()) / DAY_MS)
      : null;
    if (eventIn !== null && eventIn < 14 && !b.Anzahlung_Bezahlt_am) {
      ueberItems.push({
        id: b.id,
        buchungId: b.id,
        title: kundeName(b),
        subtitle: `Anzahlung offen, Event in ${eventIn}d`,
        amount_eur: b.Anzahlung_Soll_Eur || undefined,
        link: `/admin/buchungen/${b.id}`,
      });
    }
  }
  // Rueckgaben ueberzogen (Status In_Miete + Datum_bis vergangen)
  const ruecknahmenUeber = buchungen.filter(
    (b) =>
      b.Status_Erweitert?.value === "In_Miete" &&
      isPast(b.Event_datum_bis),
  );
  for (const b of ruecknahmenUeber) {
    const a = daysAgo(b.Event_datum_bis) ?? 0;
    ueberItems.push({
      id: b.id,
      buchungId: b.id,
      title: kundeName(b),
      subtitle: `Rueckgabe ueberzogen seit ${a}d`,
      age_days: a,
      link: `/admin/buchungen/${b.id}`,
    });
  }

  // ----- WARTET AUF KUNDE -----
  const wartKundeItems: InboxItem[] = [];
  // Angebot_versendet ohne Token-Klick
  const angebotVersendet = buchungen.filter(
    (b) => b.Status_Erweitert?.value === "Angebot_versendet",
  );
  for (const b of angebotVersendet) {
    const a = daysAgo(b.Event_datum_von) ?? 0;
    wartKundeItems.push({
      id: b.id,
      buchungId: b.id,
      title: kundeName(b),
      subtitle: `Angebot versendet, kein Klick (Termin ${fmtDate(b.Event_datum_von)})`,
      age_days: a,
      link: `/admin/buchungen/${b.id}`,
    });
  }
  // Bestaetigt ohne Anzahlung
  for (const b of wartetAnzahlung) {
    if (!b.Anzahlung_Bezahlt_am) {
      wartKundeItems.push({
        id: b.id,
        buchungId: b.id,
        title: kundeName(b),
        subtitle: `Bestaetigt, Anzahlung ausstehend`,
        amount_eur: b.Anzahlung_Soll_Eur || undefined,
        link: `/admin/buchungen/${b.id}`,
      });
    }
  }

  // ----- WARTET AUF GELD -----
  const wartGeldItems: InboxItem[] = [];
  let geldSumme = 0;
  // Anzahlung offen
  for (const b of buchungen) {
    if (
      b.Anzahlung_Soll_Eur &&
      b.Anzahlung_Soll_Eur > 0 &&
      !b.Anzahlung_Bezahlt_am &&
      ["Bestaetigt", "Reserviert"].includes(b.Status_Erweitert?.value || "")
    ) {
      geldSumme += b.Anzahlung_Soll_Eur;
      wartGeldItems.push({
        id: b.id,
        buchungId: b.id,
        title: kundeName(b),
        subtitle: `Anzahlung offen`,
        amount_eur: b.Anzahlung_Soll_Eur,
        link: `/admin/buchungen/${b.id}`,
      });
    }
  }
  // Restzahlung offen
  for (const b of buchungen) {
    if (
      b.Restzahlung_Soll_Eur &&
      b.Restzahlung_Soll_Eur > 0 &&
      !b.Restzahlung_Bezahlt_am &&
      ["Reserviert", "Uebergeben", "In_Miete", "Zurueckgegeben"].includes(
        b.Status_Erweitert?.value || "",
      )
    ) {
      geldSumme += b.Restzahlung_Soll_Eur;
      wartGeldItems.push({
        id: b.id,
        buchungId: b.id,
        title: kundeName(b),
        subtitle: `Restzahlung offen`,
        amount_eur: b.Restzahlung_Soll_Eur,
        link: `/admin/buchungen/${b.id}`,
      });
    }
  }
  // Kaution-Rueckzahlung offen (Zurueckgegeben + Kaution hinterlegt + nicht zurueckgezahlt)
  for (const b of buchungen) {
    if (
      b.Status_Erweitert?.value === "Zurueckgegeben" &&
      b.Kaution_Hinterlegt_am &&
      !b.Kaution_Rueckzahlung_am &&
      b.Kaution_Soll_Eur
    ) {
      geldSumme += b.Kaution_Soll_Eur;
      wartGeldItems.push({
        id: b.id,
        buchungId: b.id,
        title: kundeName(b),
        subtitle: `Kaution-Rueckzahlung ausstehend`,
        amount_eur: b.Kaution_Soll_Eur,
        link: `/admin/buchungen/${b.id}`,
      });
    }
  }

  // ----- GERADE BESTAETIGT (letzte 48h) -----
  // Kunde hat ueber den Token-Link Angebot akzeptiert (Status_Erweitert=Bestaetigt
  // UND Angebot.Akzeptiert_am > now-48h). Banner verschwindet automatisch nach 48h.
  const FRESH_MS = 48 * 60 * 60 * 1000;
  const cutoffFresh = Date.now() - FRESH_MS;
  const angebotByBuchungId = new Map<number, AngebotRow>();
  for (const a of angebote) {
    const bid = a.Buchung_Link?.[0]?.id;
    if (bid && !angebotByBuchungId.has(bid)) angebotByBuchungId.set(bid, a);
  }
  const geradeBestaetigtItems: InboxItem[] = [];
  for (const b of buchungen) {
    if (b.Status_Erweitert?.value !== "Bestaetigt") continue;
    const angebot = angebotByBuchungId.get(b.id);
    if (!angebot?.Akzeptiert_am) continue;
    const ts = new Date(angebot.Akzeptiert_am).getTime();
    if (isNaN(ts) || ts < cutoffFresh) continue;
    const hrsAgo = Math.max(0, Math.floor((Date.now() - ts) / (60 * 60 * 1000)));
    geradeBestaetigtItems.push({
      id: b.id,
      buchungId: b.id,
      title: kundeName(b),
      subtitle: hrsAgo === 0
        ? "Soeben bestaetigt — Anzahlung steht aus"
        : `Vor ${hrsAgo}h bestaetigt — Anzahlung steht aus`,
      amount_eur: b.Anzahlung_Soll_Eur || undefined,
      link: `/admin/buchungen/${b.id}`,
    });
  }
  // Frischeste zuerst
  geradeBestaetigtItems.sort((a, b) => {
    const aHr = parseInt((a.subtitle || "").match(/(\d+)h/)?.[1] || "0", 10);
    const bHr = parseInt((b.subtitle || "").match(/(\d+)h/)?.[1] || "0", 10);
    return aHr - bHr;
  });

  return {
    mailqueue_pending,
    gerade_bestaetigt: {
      total: geradeBestaetigtItems.length,
      items: geradeBestaetigtItems.slice(0, 5),
    },
    heute_zu_tun: { total: heuteItems.length, items: heuteItems.slice(0, 5) },
    ueberfaellig: { total: ueberItems.length, items: ueberItems.slice(0, 5) },
    wartet_kunde: { total: wartKundeItems.length, items: wartKundeItems.slice(0, 5) },
    wartet_geld: {
      total: wartGeldItems.length,
      items: wartGeldItems.slice(0, 5),
      sum_eur: Math.round(geldSumme),
    },
    generated_at: new Date().toISOString(),
  };
}
