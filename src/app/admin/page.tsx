import Link from "next/link";
import { loadInboxData, type InboxItem, type QuadrantData } from "@/lib/eventverleih/inbox";
import { PendingMailRow } from "@/components/admin/PendingMailRow";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function fmtEur(n: number | undefined): string {
  if (n === undefined || n === null) return "";
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function ItemRow({ item }: { item: InboxItem }) {
  return (
    <Link
      href={item.link}
      className="flex items-start justify-between gap-2 px-3 py-2 -mx-3 rounded-lg hover:bg-warm-bg/60 transition-colors group"
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-warm-text truncate group-hover:text-accent">
          {item.title}
        </div>
        {item.subtitle && (
          <div className="text-xs text-warm-muted truncate">{item.subtitle}</div>
        )}
      </div>
      {item.amount_eur !== undefined && (
        <div className="text-sm font-medium text-warm-text whitespace-nowrap">
          {fmtEur(item.amount_eur)}
        </div>
      )}
      {item.age_days !== undefined && item.amount_eur === undefined && (
        <div className="text-xs text-warm-muted whitespace-nowrap">{item.age_days}d</div>
      )}
    </Link>
  );
}

function Quadrant({
  title,
  data,
  emptyHint,
  accent,
}: {
  title: string;
  data: QuadrantData;
  emptyHint: string;
  accent: "blue" | "red" | "amber" | "green";
}) {
  const dotClasses = {
    blue: "bg-blue-400",
    red: "bg-red-400",
    amber: "bg-amber-400",
    green: "bg-green-400",
  };
  return (
    <div className="rounded-xl border border-warm-border bg-warm-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-base font-semibold text-warm-text flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${dotClasses[accent]}`} />
          {title}
        </h2>
        <div className="text-sm text-warm-muted font-medium">
          {data.sum_eur !== undefined && data.sum_eur > 0 ? (
            <span className="font-semibold">{fmtEur(data.sum_eur)}</span>
          ) : (
            <span>{data.total}</span>
          )}
        </div>
      </div>
      {data.items.length === 0 ? (
        <p className="text-xs text-warm-muted italic py-2">{emptyHint}</p>
      ) : (
        <div className="space-y-0.5">
          {data.items.map((item) => (
            <ItemRow key={`${item.id}-${item.subtitle}`} item={item} />
          ))}
          {data.total > data.items.length && (
            <div className="text-xs text-warm-muted pt-2 px-3">
              + {data.total - data.items.length} weitere
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default async function AdminInboxHome() {
  const data = await loadInboxData();

  return (
    <div className="space-y-4 max-w-6xl">
      {/* Konflikt-Banner (Mengen-Engpass unter bezahlten Reservierungen — Entscheidung noetig) */}
      {data.konflikte.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-warm-surface px-4 py-3">
          <div className="font-display font-semibold text-red-400 mb-1">
            {data.konflikte.length === 1
              ? "Konflikt – Entscheidung nötig"
              : `${data.konflikte.length} Konflikte – Entscheidung nötig`}
          </div>
          <p className="text-xs text-warm-muted mb-2">
            Mehrere bezahlte Reservierungen teilen sich knappen Bestand. Entscheide: Artikel
            nachkaufen (auf „bestellbar" setzen) oder eine Buchung stornieren — der Storno-Button
            auf der Buchung löst den Refund aus.
          </p>
          <div className="space-y-0.5">
            {data.konflikte.map((k, i) => (
              <Link
                key={`${k.buchungId}-${i}`}
                href={k.link}
                className="block px-3 py-2 -mx-3 rounded-lg hover:bg-red-500/10 transition-colors group"
              >
                <div className="text-sm font-medium text-warm-text group-hover:text-red-300">
                  {k.title}
                </div>
                <div className="text-xs text-warm-muted">{k.subtitle}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Gerade-Bestaetigt-Banner (frisch akzeptierte Anfragen, letzte 48h) */}
      {data.gerade_bestaetigt.total > 0 && (
        <div className="rounded-xl border border-green-500/30 bg-warm-surface px-4 py-3">
          <div className="flex items-center gap-3 mb-2">
            <div className="font-display font-semibold text-green-400">
              {data.gerade_bestaetigt.total}{" "}
              {data.gerade_bestaetigt.total === 1
                ? "Kunde hat gerade bestätigt"
                : "Kunden haben gerade bestätigt"}
              {" "}— Anzahlung steht aus
            </div>
          </div>
          <div className="space-y-0.5 ml-9">
            {data.gerade_bestaetigt.items.map((item) => (
              <Link
                key={item.id}
                href={item.link}
                className="flex items-start justify-between gap-2 px-3 py-2 -mx-3 rounded-lg hover:bg-green-500/10 transition-colors group"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-warm-text truncate group-hover:text-green-300">
                    {item.title}
                  </div>
                  {item.subtitle && (
                    <div className="text-xs text-warm-muted">{item.subtitle}</div>
                  )}
                </div>
                {item.amount_eur !== undefined && (
                  <div className="text-sm font-medium text-warm-text whitespace-nowrap">
                    {fmtEur(item.amount_eur)}
                  </div>
                )}
              </Link>
            ))}
            {data.gerade_bestaetigt.total > data.gerade_bestaetigt.items.length && (
              <div className="text-xs text-warm-muted pt-1 px-3">
                + {data.gerade_bestaetigt.total - data.gerade_bestaetigt.items.length} weitere
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mail-Queue Pending — inline Approve/Reject pro Mail */}
      {data.pending_mails.length > 0 && (
        <div className="rounded-xl border border-warm-border bg-warm-surface px-4 py-3">
          <div className="font-display font-semibold text-warm-text mb-2">
            {data.pending_mails.length}{" "}
            {data.pending_mails.length === 1 ? "Mail wartet" : "Mails warten"} auf Freigabe
          </div>
          <p className="text-xs text-warm-muted mb-3">
            Reminder-Mails an Kunden — vor dem Versand kurz prüfen ob die Zahlung wirklich noch offen ist.
          </p>
          <div className="space-y-2">
            {data.pending_mails.map((m) => (
              <PendingMailRow key={m.id} mail={m} />
            ))}
          </div>
        </div>
      )}

      <div>
        <h1 className="font-display text-2xl font-semibold text-warm-text mb-1">
          Backoffice
        </h1>
        <p className="text-sm text-warm-muted">
          Was heute auf dich wartet — letzte Aktualisierung{" "}
          {new Date(data.generated_at).toLocaleString("de-DE", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Quadrant
          title="Heute zu tun"
          data={data.heute_zu_tun}
          emptyHint="Nichts heute fällig — gönn dir einen Kaffee."
          accent="blue"
        />
        <Quadrant
          title="Überfällig"
          data={data.ueberfaellig}
          emptyHint="Alles in Bewegung. Top."
          accent="red"
        />
        <Quadrant
          title="Wartet auf Kunde"
          data={data.wartet_kunde}
          emptyHint="Kein Angebot wartet aktuell auf eine Kundenreaktion."
          accent="amber"
        />
        <Quadrant
          title="Wartet auf Geld"
          data={data.wartet_geld}
          emptyHint="Alle Zahlungen sind eingegangen."
          accent="green"
        />
      </div>
    </div>
  );
}
