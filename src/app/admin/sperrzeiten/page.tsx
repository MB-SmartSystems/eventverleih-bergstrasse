/**
 * /admin/sperrzeiten — Urlaub/Sperrzeiten verwalten.
 *
 * Manuel pflegt hier Zeiträume, in denen keine Übergabe/Rückgabe möglich ist.
 * Sie blocken nichts hart — sie erzeugen eine Warnung auf Anfragen, deren Übergabe/
 * Rückgabe in den Zeitraum fallen würde (siehe lib/eventverleih/sperrzeiten.ts).
 */
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { getSperrzeiten } from "@/lib/eventverleih/sperrzeiten";
import SperrzeitForm from "./SperrzeitForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SperrzeitenPage() {
  if (!(await isAuthenticated())) redirect("/admin");
  const sperrzeiten = await getSperrzeiten();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold text-warm-text">Sperrzeiten</h1>
        <p className="text-sm text-warm-muted mt-0.5">
          Urlaub & Zeiten ohne Übergabe/Rückgabe. Anfragen, deren Übergabe oder Rückgabe in einen
          dieser Zeiträume fällt, werden im Anfrage-Detail gewarnt (keine harte Sperre).
        </p>
      </div>
      <SperrzeitForm initial={sperrzeiten} />
    </div>
  );
}
