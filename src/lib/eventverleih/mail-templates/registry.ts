import type { TemplateEntry, UncoveredTemplate } from "./types";
import * as B from "./beispiele";
import { buildAnfrageEingang, buildVertragBestaetigung, buildStornoBestaetigung, buildLoginMagicLink } from "./build/anfrage-und-member";
import { buildAngebotsMail, buildRueckrufMail, buildAblehnenMail } from "./build/angebot-entscheidung";
import { buildAngebotErneutGesendet, buildAngebotNachhaken, buildAngebotAktualisiert } from "./build/angebot-versand";
import { buildAnzahlungErinnerung } from "./build/anzahlung-erinnerung";
import { buildRestzahlungInfo } from "./build/restzahlung-info";
import {
  buildKomplettzahlungErhalten,
  buildRestzahlungErhalten,
  buildAnzahlungErhalten,
} from "./build/zahlung-erhalten";
import { buildKautionHoldLink, buildKautionBarHinweis } from "./build/kaution";
import { buildTerminErinnerung, buildRueckgabeErinnerung, buildTermin1h } from "./build/termin-erinnerung";
import { buildGoogleReview } from "./build/google-review";
import { buildUebergabeErfolgt, buildKautionIbanAnfordern } from "./build/uebergabe";

/**
 * Every mail this system can send, keyed by the Template_Key that ends up in the
 * Baserow MailQueue (table 969).
 *
 * One entry per key, not per builder: the four deposit reminder stages share a
 * builder but produce four different opening sentences, and all four can appear in
 * the queue. The overview shows what actually goes out, not how it is implemented.
 *
 * `source` points at the line where the MailQueue row is created — that is where the
 * decision to send is made, which is what you want to find when something looks wrong.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Entry = TemplateEntry<any>;

export const TEMPLATES: Entry[] = [
  {
    tpl: "anfrage_eingang",
    title: "Eingangsbestätigung der Anfrage",
    trigger: "Kunde schickt das Kontaktformular ab",
    freigabe: "automatisch",
    source: "src/app/api/contact/route.ts:416",
    build: buildAnfrageEingang,
    examples: B.BEISPIEL_ANFRAGE_EINGANG,
  },
  {
    tpl: "angebot_freigegeben",
    title: "Angebot versendet",
    trigger: "Admin gibt die Anfrage im Dashboard frei",
    freigabe: "durch-admin-aktion",
    source: "src/app/api/admin/anfrage/[id]/action/route.ts:318",
    build: buildAngebotsMail,
    examples: [B.BEISPIEL_ANGEBOT[0]],
  },
  {
    tpl: "angebot_freigegeben_anmerkung",
    title: "Angebot versendet, mit persönlicher Anmerkung",
    trigger: "Admin gibt frei und schreibt eine Anmerkung dazu",
    freigabe: "durch-admin-aktion",
    source: "src/app/api/admin/anfrage/[id]/action/route.ts:318",
    build: buildAngebotsMail,
    examples: [B.BEISPIEL_ANGEBOT[1]],
  },
  {
    tpl: "rueckruf_vorschlag",
    title: "Rückruf vorschlagen",
    trigger: "Admin wählt im Dashboard „Rückruf“ statt Angebot",
    freigabe: "durch-admin-aktion",
    source: "src/app/api/admin/anfrage/[id]/action/route.ts:318",
    build: buildRueckrufMail,
    examples: B.BEISPIEL_RUECKRUF,
  },
  {
    tpl: "anfrage_abgelehnt",
    title: "Absage auf eine Anfrage",
    trigger: "Admin lehnt die Anfrage ab (interne Notiz geht nie mit raus)",
    freigabe: "durch-admin-aktion",
    source: "src/app/api/admin/anfrage/[id]/action/route.ts:318",
    build: buildAblehnenMail,
    examples: B.BEISPIEL_ABLEHNUNG,
  },
  {
    tpl: "angebot_erneut_gesendet",
    title: "Angebot erneut zusenden",
    trigger: "Admin klickt „erneut senden“ am Angebot",
    freigabe: "durch-admin-aktion",
    source: "src/app/api/admin/angebot/[id]/erneut-senden/route.ts:118",
    build: buildAngebotErneutGesendet,
    examples: B.BEISPIEL_ANGEBOT_ERNEUT,
  },
  {
    tpl: "angebot_aktualisiert",
    title: "Neue Angebotsversion",
    trigger: "Admin erstellt eine neue Version des Angebots",
    freigabe: "durch-admin-aktion",
    source: "src/app/api/admin/angebot/[id]/neue-version/route.ts:120",
    build: buildAngebotAktualisiert,
    examples: B.BEISPIEL_ANGEBOT_AKTUALISIERT,
  },
  {
    tpl: "angebot_nachhaken",
    title: "Nachfassen zum Angebot",
    trigger: "Admin klickt „nachhaken“ einige Tage nach dem Versand",
    freigabe: "durch-admin-aktion",
    source: "src/app/api/admin/angebot/[id]/nachhaken/route.ts:106",
    build: buildAngebotNachhaken,
    examples: B.BEISPIEL_ANGEBOT_NACHHAKEN,
  },
  {
    tpl: "vertrag_bestaetigung",
    title: "Termin vorgemerkt, Anzahlung erbeten",
    trigger: "Kunde bestätigt das Angebot online",
    freigabe: "automatisch",
    source: "src/app/api/vertrag-akzeptieren/route.ts:392",
    build: buildVertragBestaetigung,
    examples: B.BEISPIEL_VERTRAG,
  },
  {
    tpl: "anzahlung_erhalten",
    title: "Anzahlung eingegangen",
    trigger: "Stripe-Webhook oder manuelle Zahlungserfassung im Dashboard",
    freigabe: "automatisch",
    source: "src/lib/eventverleih/zahlungsbestaetigung.ts:40",
    build: buildAnzahlungErhalten,
    examples: B.BEISPIEL_ZAHLUNG,
  },
  {
    tpl: "anzahlung_post3",
    title: "Anzahlung fehlt, 3 Tage nach Bestätigung",
    trigger: "Cron, 3 Tage nach Angebotsannahme, Anzahlung noch offen",
    freigabe: "wartet-auf-freigabe",
    source: "src/lib/eventverleih/anzahlung-reminder.ts:156",
    build: buildAnzahlungErinnerung,
    examples: B.BEISPIEL_ANZAHLUNG_ERINNERUNG("anzahlung_post3"),
  },
  {
    tpl: "anzahlung_pre14",
    title: "Anzahlung fehlt, 14 Tage vor dem Event",
    trigger: "Cron, T-14, Anzahlung noch offen",
    freigabe: "wartet-auf-freigabe",
    source: "src/lib/eventverleih/anzahlung-reminder.ts:156",
    build: buildAnzahlungErinnerung,
    examples: B.BEISPIEL_ANZAHLUNG_ERINNERUNG("anzahlung_pre14"),
  },
  {
    tpl: "anzahlung_pre7",
    title: "Anzahlung fehlt, 7 Tage vor dem Event",
    trigger: "Cron, T-7, Anzahlung noch offen",
    freigabe: "wartet-auf-freigabe",
    source: "src/lib/eventverleih/anzahlung-reminder.ts:156",
    build: buildAnzahlungErinnerung,
    examples: B.BEISPIEL_ANZAHLUNG_ERINNERUNG("anzahlung_pre7"),
  },
  {
    tpl: "anzahlung_pre3",
    title: "Anzahlung fehlt, 3 Tage vor dem Event",
    trigger: "Cron, T-3, Anzahlung noch offen",
    freigabe: "wartet-auf-freigabe",
    source: "src/lib/eventverleih/anzahlung-reminder.ts:156",
    build: buildAnzahlungErinnerung,
    examples: B.BEISPIEL_ANZAHLUNG_ERINNERUNG("anzahlung_pre3"),
  },
  {
    tpl: "restzahlung_pre3",
    title: "Service-Info zur Restzahlung",
    trigger: "Cron täglich 07:30 UTC, T-3 vor dem Event, Restzahlung offen",
    freigabe: "automatisch",
    source: "src/app/api/cron/restzahlung-reminder/route.ts:142",
    build: buildRestzahlungInfo,
    examples: B.BEISPIEL_RESTZAHLUNG_INFO,
  },
  {
    tpl: "restzahlung_erhalten",
    title: "Restzahlung eingegangen",
    trigger: "Stripe-Webhook oder PayPal-Verbuchung",
    freigabe: "automatisch",
    source: "src/app/api/stripe/webhook/route.ts:275 · src/lib/eventverleih/paypal-verbuchen.ts:207",
    build: buildRestzahlungErhalten,
    examples: B.BEISPIEL_ZAHLUNG,
  },
  {
    tpl: "komplettzahlung_erhalten",
    title: "Komplettzahlung eingegangen",
    trigger: "Stripe-Webhook oder PayPal-Verbuchung",
    freigabe: "automatisch",
    source: "src/app/api/stripe/webhook/route.ts:152 · src/lib/eventverleih/paypal-verbuchen.ts:133",
    build: buildKomplettzahlungErhalten,
    examples: B.BEISPIEL_ZAHLUNG,
  },
  {
    tpl: "kaution_hold_link",
    title: "Kaution als Stripe-Hold hinterlegen",
    trigger: "Admin löst den Kautions-Link aus",
    freigabe: "automatisch",
    source: "src/lib/eventverleih/kaution-mail.ts:100",
    build: buildKautionHoldLink,
    examples: B.BEISPIEL_KAUTION_HOLD,
  },
  {
    tpl: "kaution_bar_hinweis",
    title: "Kaution bar mitbringen",
    trigger: "Cron täglich 08:00 UTC, T-5 bis T-0, Kaution nicht hinterlegt",
    freigabe: "automatisch",
    source: "src/app/api/cron/kaution-reminder/route.ts:101",
    build: buildKautionBarHinweis,
    examples: B.BEISPIEL_KAUTION_BAR,
  },
  {
    tpl: "termin_erinnerung",
    title: "Erinnerung an die Übergabe (Vortag)",
    trigger: "Cron, Vortag der Übergabe, Status Bestätigt oder Reserviert",
    freigabe: "automatisch",
    source: "src/lib/eventverleih/termin-reminder.ts:127",
    build: buildTerminErinnerung,
    examples: B.BEISPIEL_TERMIN_ERINNERUNG,
  },
  {
    tpl: "rueckgabe_erinnerung",
    title: "Erinnerung an die Rückgabe (Vortag)",
    trigger: "Cron, Vortag der Rückgabe, Status_Erweitert = In_Miete | Uebergeben (Baserow-Werte)",
    freigabe: "automatisch",
    source: "src/lib/eventverleih/termin-reminder.ts:178",
    build: buildRueckgabeErinnerung,
    examples: B.BEISPIEL_RUECKGABE_ERINNERUNG,
  },
  {
    tpl: "termin_1h_uebergabe",
    title: "Kurz-Erinnerung Übergabe (1 Stunde vorher)",
    trigger: "n8n-Schedule alle 20 Min, Termin innerhalb der nächsten 75 Minuten",
    freigabe: "automatisch",
    source: "src/app/api/cron/termin-1h-reminder/route.ts:149",
    build: buildTermin1h,
    examples: B.BEISPIEL_TERMIN_1H("Übergabe"),
  },
  {
    tpl: "termin_1h_rueckgabe",
    title: "Kurz-Erinnerung Rückgabe (1 Stunde vorher)",
    trigger: "n8n-Schedule alle 20 Min, Termin innerhalb der nächsten 75 Minuten",
    freigabe: "automatisch",
    source: "src/app/api/cron/termin-1h-reminder/route.ts:149",
    build: buildTermin1h,
    examples: B.BEISPIEL_TERMIN_1H("Rückgabe"),
  },
  {
    tpl: "google_review",
    title: "Bitte um eine Google-Bewertung",
    trigger: "Cron, 3 bis 10 Tage nach Eventende, Kaution noch nicht abgerechnet",
    freigabe: "wartet-auf-freigabe",
    source: "src/lib/eventverleih/review-reminder.ts:85",
    build: buildGoogleReview,
    examples: B.BEISPIEL_GOOGLE_REVIEW,
  },
  {
    tpl: "storno_bestaetigung",
    title: "Stornierung bestätigt",
    trigger: "Kunde storniert selbst im Kundenbereich",
    freigabe: "automatisch",
    source: "src/app/api/member/buchung/[id]/storno/route.ts:136",
    build: buildStornoBestaetigung,
    examples: [...B.BEISPIEL_STORNO, B.BEISPIEL_STORNO_UEBERZAHLUNG],
  },
  {
    tpl: "login_magic_link",
    title: "Login-Link für Mein Bereich",
    trigger: "Kunde fordert den Login-Link an",
    freigabe: "automatisch",
    source: "src/app/api/member/login-link/route.ts:48",
    build: buildLoginMagicLink,
    examples: B.BEISPIEL_LOGIN_LINK,
  },
  {
    tpl: "uebergabe_erfolgt",
    title: "Übergabe erfolgt",
    trigger: "Admin schließt den Übergabe-Dialog ab",
    freigabe: "automatisch",
    source: "src/app/api/admin/buchung/[id]/uebergabe/route.ts:214",
    build: buildUebergabeErfolgt,
    examples: B.BEISPIEL_UEBERGABE_ERFOLGT,
  },
  {
    tpl: "kaution_iban_anfordern",
    title: "Bankverbindung für die Rückzahlung anfordern",
    trigger: "Admin klickt im Buchungsdetail auf IBAN anfordern",
    freigabe: "durch-admin-aktion",
    source: "src/app/api/admin/buchung/[id]/kaution-iban-anfordern/route.ts:84",
    build: buildKautionIbanAnfordern,
    examples: B.BEISPIEL_KAUTION_IBAN,
  },
];

/**
 * Templates that exist but are not rendered here. Shown in the overview with the
 * reason — an overview that is incomplete without saying so is worse than none.
 */
export const UNCOVERED: UncoveredTemplate[] = [
  {
    tpl: "termin_uebergabe_bestaetigung",
    title: "Übergabe-Termin bestätigt",
    reason: "Phase 2 — die Datei gehört gerade einer parallelen Session",
    source: "src/app/api/admin/buchung/[id]/termin/route.ts:118",
  },
  {
    tpl: "termin_rueckgabe_bestaetigung",
    title: "Rückgabe-Termin bestätigt",
    reason: "Phase 2 — die Datei gehört gerade einer parallelen Session",
    source: "src/app/api/admin/buchung/[id]/termin/route.ts:118",
  },
  {
    tpl: "rechnung_beleg",
    title: "Rechnung / Beleg",
    reason: "Liegt nicht in diesem Repo, sondern im n8n-Workflow eve-rechnung-render-mail",
    source: "n8n · N8N_RECHNUNG_PDF_URL",
  },
];
