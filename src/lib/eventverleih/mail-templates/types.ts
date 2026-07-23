/**
 * Shared types for the mail template registry.
 *
 * The builders below are the single source of truth for what a customer reads.
 * The admin overview at /admin/vorlagen calls exactly the same functions that the
 * live mail paths call, which is why the overview cannot drift away from reality.
 *
 * Rule for every builder: it takes a context and returns text. It reads nothing
 * (no Baserow, no env, no clock) and writes nothing. Data access, createRow,
 * idempotency and error handling stay in the calling route.
 */

/** Result of a mail template: what the customer sees. */
export interface MailText {
  subject: string;
  body: string;
}

/** A pure builder: takes a context, returns text. */
export type TemplateBuilder<Ctx> = (ctx: Ctx) => MailText;

/** One named example context, rendered as a switchable tab in the admin view. */
export interface TemplateExample<Ctx> {
  /** Tab label, German, e.g. "Regelfall, Restzahlung offen". */
  label: string;
  ctx: Ctx;
}

export interface TemplateEntry<Ctx = never> {
  /** Template_Key as written into the Baserow MailQueue (table 969). */
  key: string;
  /** German title shown in the admin view. */
  title: string;
  /** When it fires, German, e.g. "Cron, Vortag der Uebergabe". */
  trigger: string;
  /** true = Auto_Reply, goes out on its own. false = needs approval first. */
  autoSend: boolean;
  /** Where the MailQueue row is created, e.g. "src/lib/eventverleih/termin-reminder.ts:144". */
  source: string;
  build: TemplateBuilder<Ctx>;
  examples: TemplateExample<Ctx>[];
}

/**
 * A template that exists in the system but is not rendered here yet.
 * Shown explicitly in the admin view — an overview that is incomplete without
 * saying so is worse than none.
 */
export interface UncoveredTemplate {
  key: string;
  title: string;
  /** Why it is missing, in German. */
  reason: string;
  source: string;
}
