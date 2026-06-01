/**
 * /mein-bereich/login?token=XYZ   — fallback fuer alte Mail-Links
 * /mein-bereich/login?reason=invalid — Re-Send-Form fuer abgelaufene Tokens
 *
 * Cookie-Set passiert NICHT mehr hier (Server-Component-Page kann keine Cookies
 * setzen in Next.js 14.2). Mit Token-Param leiten wir an den Route-Handler
 * /api/member/auto-login weiter, der den Cookie korrekt setzt.
 */
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function MemberLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; reason?: string }>;
}) {
  const params = await searchParams;
  const token = params.token || "";
  const reason = params.reason || "";

  // Token vorhanden → Route-Handler uebernimmt (Cookie + Redirect).
  if (token) {
    redirect(`/api/member/auto-login?token=${encodeURIComponent(token)}`);
  }

  return (
    <main className="min-h-screen bg-navy-900 text-white py-20 px-4">
      <div className="max-w-md mx-auto">
        <Link href="/" className="text-gold-400 hover:text-gold-500 text-sm">
          ← Zurück zur Startseite
        </Link>
        <h1 className="font-display text-3xl font-bold mt-8 mb-4">Mein Bereich</h1>
        {reason === "sent" && (
          <div className="mb-6 p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-green-200 text-sm">
            Falls eine Buchung mit dieser Adresse existiert, ist der Login-Link unterwegs. Bitte prüfen Sie Ihr E-Mail-Postfach (auch den Spam-Ordner).
          </div>
        )}
        {(reason === "invalid" || reason === "invalid_email" || reason === "error") && (
          <div className="mb-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
            {reason === "invalid_email"
              ? "Bitte geben Sie eine gültige E-Mail-Adresse ein."
              : reason === "error"
                ? "Es ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut."
                : "Der Login-Link ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen an."}
          </div>
        )}
        <p className="text-gray-400 mb-6">
          Geben Sie Ihre E-Mail-Adresse ein, mit der Sie bei uns eine Buchung haben. Wir schicken Ihnen einen Login-Link.
        </p>
        <form method="POST" action="/api/member/login-link" className="space-y-4">
          <input
            type="email"
            name="email"
            required
            placeholder="ihre@email.de"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/50 transition-all"
          />
          <button
            type="submit"
            className="w-full py-3 bg-gradient-to-r from-gold-500 to-gold-600 text-navy-900 font-semibold rounded-lg hover:from-gold-400 hover:to-gold-500 transition-all"
          >
            Login-Link senden
          </button>
        </form>
        <p className="text-xs text-gray-500 mt-6">
          Der Link wird in den nächsten Minuten an Ihre E-Mail-Adresse versendet. Falls keine
          Buchung mit dieser Adresse bei uns existiert, erhalten Sie keine Mail.
        </p>
      </div>
    </main>
  );
}
