/**
 * /vertrag/[token] — Public Vertrag-Bestaetigungs-Seite
 *
 * Redirected zur /angebot/[token]-Seite (gleiche Token).
 * Dort kann Kunde Angebot bestaetigen via Form-POST zu /api/vertrag-akzeptieren.
 */
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function VertragPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  redirect(`/angebot/${token}`);
}
