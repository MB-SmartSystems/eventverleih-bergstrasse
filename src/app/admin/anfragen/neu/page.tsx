/**
 * /admin/anfragen/neu — Anfrage manuell anlegen (Plan Phase 5 C5)
 *
 * Manuel kann Telefon-/WhatsApp-Anfragen direkt im Backoffice eintragen, ohne dass der
 * Kunde durchs Web-Formular muss. Wiederverwendung der existierenden Buchungs-Anlage-Logik.
 */
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { listAllRows, TABLES } from "@/lib/baserow/client";
import Link from "next/link";
import NeueAnfrageForm from "./NeueAnfrageForm";

export const dynamic = "force-dynamic";

interface KundeRow {
  id: number;
  Vorname?: string;
  Nachname?: string;
  Email?: string;
  Telefon?: string;
}

interface ArtikelRow {
  id: number;
  Bezeichnung: string;
  Mietpreis_WE_Eur: string | number | null;
  Kaution_Pro_Stueck_Eur: string | number | null;
  Aufbau_Pauschale_Eur: string | number | null;
  Aktiv?: boolean | { value: string } | null;
}

function isAktiv(a: ArtikelRow): boolean {
  const v = a.Aktiv;
  if (v === undefined || v === null) return true;
  if (typeof v === "boolean") return v;
  if (typeof v === "object" && "value" in v) {
    const s = String(v.value || "").toLowerCase();
    return s === "ja" || s === "true" || s === "aktiv";
  }
  return Boolean(v);
}

export default async function NeueAnfragePage() {
  if (!(await isAuthenticated())) redirect("/admin");

  const [kundenAll, artikelAll] = await Promise.all([
    listAllRows<KundeRow>(TABLES.Kunden),
    listAllRows<ArtikelRow>(TABLES.Artikel),
  ]);

  const kunden = kundenAll.results
    .map((k) => ({
      id: k.id,
      label: `${k.Vorname || ""} ${k.Nachname || ""}`.trim() || k.Email || `Kunde ${k.id}`,
      email: k.Email || "",
      telefon: k.Telefon || "",
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "de"));

  const artikel = artikelAll.results
    .filter((a) => isAktiv(a))
    .map((a) => ({
      id: a.id,
      bezeichnung: a.Bezeichnung,
      preis: typeof a.Mietpreis_WE_Eur === "number" ? a.Mietpreis_WE_Eur : parseFloat(String(a.Mietpreis_WE_Eur || "0")) || 0,
    }))
    .sort((a, b) => a.bezeichnung.localeCompare(b.bezeichnung, "de"));

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/anfragen" className="text-sm text-warm-muted hover:text-warm-text">
            ← Zurück zu Anfragen
          </Link>
          <h1 className="text-2xl font-bold text-warm-text mt-1">Neue Anfrage anlegen</h1>
          <p className="text-sm text-warm-muted mt-1">
            Manuell-Anlage für Telefon-/WhatsApp-Anfragen. Kunde muss vorab in /admin/kunden existieren.
          </p>
        </div>
      </div>
      <NeueAnfrageForm kunden={kunden} artikel={artikel} />
    </div>
  );
}
