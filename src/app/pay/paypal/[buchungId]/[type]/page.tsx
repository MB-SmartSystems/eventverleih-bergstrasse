/**
 * Kundenseitige PayPal-Zahlseite: /pay/paypal/<buchungId>/<type>?sig=...
 *
 * Signatur-geschuetzt, kein Login. Zeigt den aktuellen Betrag + einen "Mit PayPal bezahlen"-Button.
 * Der Link laeuft nicht ab; der Betrag wird bei jedem Aufruf frisch aus der Buchung berechnet.
 */
import { getRow, TABLES } from "@/lib/baserow/client";
import {
  verifyPayLink,
  defaultAmountFor,
  type PayPalPaymentType,
  type BetragsFelder,
} from "@/lib/paypal/pay-link";
import PayPalPayButton from "./PayPalPayButton";

export const dynamic = "force-dynamic";

const LABEL: Record<PayPalPaymentType, string> = {
  anzahlung: "Anzahlung",
  restzahlung: "Restzahlung",
  komplettzahlung: "Komplettzahlung",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-warm-bg px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-warm-border bg-warm-surface p-7 shadow-sm">
        <div className="mb-5 text-center">
          <p className="text-sm font-semibold tracking-wide text-accent-dark">Eventverleih Bergstraße</p>
        </div>
        {children}
      </div>
    </main>
  );
}

export default async function PayPalPayPage({
  params,
  searchParams,
}: {
  params: { buchungId: string; type: string };
  searchParams: { sig?: string; abgebrochen?: string };
}) {
  const buchungId = parseInt(params.buchungId, 10);
  const type = params.type as PayPalPaymentType;
  const sig = searchParams.sig || "";
  const validType = type === "anzahlung" || type === "restzahlung" || type === "komplettzahlung";

  if (!buchungId || !validType || !verifyPayLink(buchungId, type, sig)) {
    return (
      <Shell>
        <h1 className="mb-2 text-center text-lg font-semibold text-warm-text">Link ungültig</h1>
        <p className="text-center text-sm text-warm-muted">
          Dieser Zahlungslink ist nicht gültig. Bitte fordern Sie einen neuen Link an oder wenden Sie
          sich an uns.
        </p>
      </Shell>
    );
  }

  let buchung: BetragsFelder & {
    Status_Erweitert: { value: string } | null;
    Restzahlung_Bezahlt_am: string | null;
    Event_datum_von: string | null;
  };
  try {
    buchung = await getRow(TABLES.Buchungen, buchungId);
  } catch {
    return (
      <Shell>
        <h1 className="mb-2 text-center text-lg font-semibold text-warm-text">Buchung nicht gefunden</h1>
        <p className="text-center text-sm text-warm-muted">Bitte wenden Sie sich an uns.</p>
      </Shell>
    );
  }

  const status = buchung.Status_Erweitert?.value || "";
  const reserviert = new Set(["Reserviert", "Uebergeben", "In_Miete", "Zurueckgegeben", "Abgerechnet"]);
  const bereitsBezahlt =
    (type === "anzahlung" || type === "komplettzahlung")
      ? reserviert.has(status)
      : Boolean(buchung.Restzahlung_Bezahlt_am);

  if (bereitsBezahlt) {
    return (
      <Shell>
        <h1 className="mb-2 text-center text-lg font-semibold text-warm-text">Bereits bezahlt ✓</h1>
        <p className="text-center text-sm text-warm-muted">
          Diese Zahlung ist bereits bei uns eingegangen — es ist nichts weiter zu tun. Vielen Dank!
        </p>
      </Shell>
    );
  }

  const amount = defaultAmountFor(buchung, type);
  if (!amount || amount <= 0) {
    return (
      <Shell>
        <h1 className="mb-2 text-center text-lg font-semibold text-warm-text">Kein Betrag hinterlegt</h1>
        <p className="text-center text-sm text-warm-muted">
          Für diese Zahlung ist noch kein Betrag hinterlegt. Bitte wenden Sie sich an uns.
        </p>
      </Shell>
    );
  }

  const betragStr = amount.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Shell>
      <h1 className="mb-1 text-center text-lg font-semibold text-warm-text">
        {LABEL[type]} bezahlen
      </h1>
      <p className="mb-5 text-center text-sm text-warm-muted">Buchung #{buchungId}</p>

      <div className="mb-6 rounded-xl bg-warm-bg/60 p-5 text-center">
        <p className="text-xs uppercase tracking-wide text-warm-muted">Betrag</p>
        <p className="mt-1 text-3xl font-bold text-warm-text">{betragStr} €</p>
      </div>

      {searchParams.abgebrochen === "1" && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-center text-sm text-amber-700">
          Zahlung abgebrochen — Sie können es unten erneut versuchen.
        </p>
      )}

      <PayPalPayButton buchungId={buchungId} type={type} sig={sig} />

      {type !== "restzahlung" && (
        <p className="mt-5 text-center text-xs leading-relaxed text-warm-muted">
          Hinweis: Eine eventuelle Kaution ist bei Zahlung per PayPal separat in bar bei Abholung oder
          per Überweisung zu hinterlegen.
        </p>
      )}
    </Shell>
  );
}
