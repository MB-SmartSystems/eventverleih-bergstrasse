/**
 * AngebotView — Server-Komponente fuer die Kundenansicht (/angebot/[token])
 * und die Admin-Vorschau (/admin/angebot/[id]/preview).
 *
 * Header + Begruessung + Update-Banner + Mietzeitraum stehen hier (statisch).
 * Preise + Hinweise + AcceptForm leben in <AngebotPreiseAccept> (Client) — dort
 * sind im Customer-Modus die Service-Toggles (Lieferung/Abholung/Aufbau abwaehlbar)
 * und der client-seitige Anzahlungs-Recalc untergebracht.
 *
 * mode="customer"     → Toggles aktiv, AcceptForm sichtbar.
 * mode="admin-preview"→ Preview-Banner oben, statische Preise, Platzhalter statt AcceptForm.
 */
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AngebotPreiseAccept from "@/components/angebot/AngebotPreiseAccept";

function fmtDate(d: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
}

export interface AngebotViewProps {
  mode: "customer" | "admin-preview";
  token: string;
  angebotsnummer: string;
  anrede: string;
  statusVal: string;
  snapshotVersion: number;
  hasUpdateBanner: boolean;
  eventVon: string | null;
  eventBis: string | null;
  hasPrices: boolean;
  displayPositions: Array<{
    id: number;
    bezeichnung: string;
    anzahl: number;
    einzelpreis: number;
    gesamt: number;
  }>;
  preisArtikel: string;
  preisLieferung: string;
  preisAbholung: string;
  preisAufbau: string;
  anzahlungSoll: string;
  restzahlungSoll: string;
  kautionSoll: string;
  akzeptiertAm: string | null;
  anzahlungBezahltAm: string | null;
  stripeAnzahlungLink: string | null;
  stripeKomplettzahlungLink: string | null;
  preisArtikelLive: string;
  preisLieferungLive: string;
  preisAbholungLive: string;
  preisAufbauLive: string;
  kundeForAccept: {
    Vorname: string;
    Nachname: string;
    Email: string;
    Telefon: string;
    Adresse_Strasse: string;
    Adresse_PLZ: string;
    Adresse_Ort: string;
  };
  previewVersion?: number;
}

export default function AngebotView(props: AngebotViewProps) {
  const {
    mode,
    token,
    angebotsnummer,
    anrede,
    statusVal,
    snapshotVersion,
    hasUpdateBanner,
    eventVon,
    eventBis,
    hasPrices,
    displayPositions,
    preisArtikel,
    preisLieferung,
    preisAbholung,
    preisAufbau,
    anzahlungSoll,
    restzahlungSoll,
    kautionSoll,
    akzeptiertAm,
    anzahlungBezahltAm,
    stripeAnzahlungLink,
    stripeKomplettzahlungLink,
    preisArtikelLive,
    preisLieferungLive,
    preisAbholungLive,
    preisAufbauLive,
    kundeForAccept,
    previewVersion,
  } = props;

  const isPreview = mode === "admin-preview";

  return (
    <>
      <Header />
      <main className="pt-24 pb-16">
        <div className="container-width px-4 sm:px-6 lg:px-8 max-w-3xl">
          {isPreview && (
            <div className="mb-6 p-4 rounded-lg bg-red-500/15 border-2 border-red-400/60 text-red-100">
              <p className="font-bold text-base">
                ⚠️ Admin-Vorschau{previewVersion ? ` (v${previewVersion})` : ""} — diese Mail wurde noch <u>nicht</u> an den Kunden versendet.
              </p>
              <p className="text-sm text-red-200 mt-1">
                Was du hier siehst, würde der Kunde nach Klick auf „📧 Neue Version senden" angezeigt bekommen. Schließe diesen Tab, wenn die Ansicht passt — der Versand erfolgt erst über den Button auf der Anfragen-Seite.
              </p>
            </div>
          )}

          <p className="text-gold-400 text-sm font-medium tracking-widest uppercase mb-3">
            Angebot {angebotsnummer}
          </p>
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-6">
            Ihr Angebot von Eventverleih Bergstraße
          </h1>

          <div className="text-gray-300 space-y-6">
            <p>Hallo {anrede}, vielen Dank für Ihre Anfrage.</p>

            {hasUpdateBanner && (
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-400/40 text-blue-200 text-sm">
                <strong>Aktualisierte Version {snapshotVersion}</strong> — bitte prüfen und erneut bestätigen.
              </div>
            )}

            <div>
              <h2 className="text-xl font-semibold text-white">Mietzeitraum</h2>
              <p className="mt-1">
                {fmtDate(eventVon)}
                {eventBis && eventBis !== eventVon ? ` – ${fmtDate(eventBis)}` : ""}
              </p>
            </div>

            <AngebotPreiseAccept
              mode={mode}
              token={token}
              statusVal={statusVal}
              hasPrices={hasPrices}
              hasUpdateBanner={hasUpdateBanner}
              displayPositions={displayPositions}
              preisArtikel={preisArtikel}
              preisLieferung={preisLieferung}
              preisAbholung={preisAbholung}
              preisAufbau={preisAufbau}
              anzahlungSoll={anzahlungSoll}
              restzahlungSoll={restzahlungSoll}
              kautionSoll={kautionSoll}
              akzeptiertAm={akzeptiertAm}
              anzahlungBezahltAm={anzahlungBezahltAm}
              stripeAnzahlungLink={stripeAnzahlungLink}
              stripeKomplettzahlungLink={stripeKomplettzahlungLink}
              preisArtikelLive={preisArtikelLive}
              preisLieferungLive={preisLieferungLive}
              preisAbholungLive={preisAbholungLive}
              preisAufbauLive={preisAufbauLive}
              kundeForAccept={kundeForAccept}
            />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
