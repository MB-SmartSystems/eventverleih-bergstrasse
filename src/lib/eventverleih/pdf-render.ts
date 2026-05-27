/**
 * Feuert den n8n-Render-Flow (eve-pdf-render) fire-and-forget an: rendert die
 * oeffentliche Kundenseite (/rechnung/<token> bzw. /angebot/<token>) via Gotenberg
 * zu PDF und legt sie ueber /api/internal/store-pdf in Vercel Blob + Baserow
 * PDF_URL ab. Damit erscheint im Kundenbereich der Download-Button.
 *
 * No-op wenn N8N_PDF_RENDER_URL nicht gesetzt ist (Feature inaktiv) — der
 * aufrufende Flow (Rechnung-Erstellen / Angebot-Versand) laeuft ungestoert weiter.
 * Der bestehende Rechnungs-MAIL-Workflow wird hiervon NICHT beruehrt.
 */
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://eventverleih-bergstrasse.de";

export async function triggerPdfRender(opts: {
  table: "rechnung" | "angebot";
  id: number;
  token: string;
}): Promise<void> {
  const webhook = process.env.N8N_PDF_RENDER_URL;
  if (!webhook) return;
  const pageUrl = `${SITE}/${opts.table}/${opts.token}/print`;
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: opts.table, id: opts.id, url: pageUrl }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    console.error("[pdf-render] trigger fehlgeschlagen:", e);
  }
}
