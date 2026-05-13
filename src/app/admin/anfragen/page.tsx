/**
 * /admin/anfragen — Liste aller offenen Anfragen
 *
 * Server-side render. Auth via Cookie.
 * Zeigt nur Angebote mit Status="Offen" — also noch nicht freigegeben/abgelehnt.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { listRows, TABLES } from "@/lib/baserow/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AngebotRow = {
  id: number;
  Angebot_ID: number;
  Angebotsnummer: string;
  Status: { value: string } | null;
  Anfragetext: string | null;
  Anfragedatum: string | null;
  Gesamtpreis: string | null;
  Token_Public: string;
  Buchung_Link: Array<{ id: number; value: string }>;
  Kunde_Link: Array<{ id: number; value: string }>;
};

type KundeRow = {
  id: number;
  Vorname: string;
  Nachname: string;
  Email: string;
  Telefon: string;
};

type BuchungRow = {
  id: number;
  Buchung_ID: number;
  Preis_Artikel: string | null;
};

export default async function AnfragenPage() {
  if (!(await isAuthenticated())) redirect("/admin");

  // Lade alle offenen Angebote (Status = "Offen")
  const list = await listRows<AngebotRow>(TABLES.Angebote, { size: 200 });
  const offen = list.results.filter((a) => a.Status?.value === "Offen");

  // Kunden + Buchungen für Detail-Anzeige
  const kundenIds = Array.from(new Set(offen.map((a) => a.Kunde_Link?.[0]?.id).filter(Boolean) as number[]));
  const buchungenIds = Array.from(new Set(offen.map((a) => a.Buchung_Link?.[0]?.id).filter(Boolean) as number[]));

  const kundenAll = await listRows<KundeRow>(TABLES.Kunden, { size: 200 });
  const buchungenAll = await listRows<BuchungRow>(TABLES.Buchungen, { size: 200 });

  const kundenById = new Map(kundenAll.results.filter((k) => kundenIds.includes(k.id)).map((k) => [k.id, k]));
  const buchungenById = new Map(buchungenAll.results.filter((b) => buchungenIds.includes(b.id)).map((b) => [b.id, b]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Offene Anfragen</h1>
          <p className="text-sm text-gray-400 mt-1">
            {offen.length} {offen.length === 1 ? "Anfrage wartet" : "Anfragen warten"} auf deine Freigabe
          </p>
        </div>
      </div>

      {offen.length === 0 ? (
        <div className="p-8 rounded-xl bg-white/5 border border-white/10 text-center text-gray-400">
          Keine offenen Anfragen — du bist auf dem Stand.
        </div>
      ) : (
        <div className="space-y-3">
          {offen.map((a) => {
            const kunde = a.Kunde_Link?.[0]?.id ? kundenById.get(a.Kunde_Link[0].id) : null;
            const buchung = a.Buchung_Link?.[0]?.id ? buchungenById.get(a.Buchung_Link[0].id) : null;
            const preisArtikel = buchung?.Preis_Artikel ? parseFloat(buchung.Preis_Artikel) : 0;
            return (
              <Link
                key={a.id}
                href={`/admin/anfragen/${a.id}`}
                className="block p-5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-gold-500/30 transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs px-2 py-1 rounded bg-gold-500/20 text-gold-300 font-mono">
                        {a.Angebotsnummer}
                      </span>
                      <span className="text-xs text-gray-500">{a.Anfragedatum || "—"}</span>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-1">
                      {kunde ? `${kunde.Vorname} ${kunde.Nachname}` : "Unbekannter Kunde"}
                    </h3>
                    {kunde?.Email && <p className="text-sm text-gray-400">{kunde.Email}</p>}
                    {a.Anfragetext && (
                      <p className="text-sm text-gray-400 mt-2 line-clamp-2">{a.Anfragetext.slice(0, 200)}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {preisArtikel > 0 ? (
                      <div>
                        <div className="text-2xl font-bold text-white">{preisArtikel.toFixed(2)} €</div>
                        <div className="text-xs text-gray-500">Mietsumme</div>
                      </div>
                    ) : (
                      <div className="text-xs text-yellow-400">⚠ Preis fehlt</div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
