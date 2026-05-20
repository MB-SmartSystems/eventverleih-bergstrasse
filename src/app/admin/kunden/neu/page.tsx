/**
 * /admin/kunden/neu — Neuen Kunden anlegen (Plan Phase 5 C6)
 */
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import Link from "next/link";
import NeuerKundeForm from "./NeuerKundeForm";

export const dynamic = "force-dynamic";

export default async function NeuerKundePage() {
  if (!(await isAuthenticated())) redirect("/admin");
  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <Link href="/admin/kunden" className="text-sm text-warm-muted hover:text-warm-text">
          ← Zurueck zu Kunden
        </Link>
        <h1 className="text-2xl font-bold text-warm-text mt-1">Neuer Kunde</h1>
      </div>
      <NeuerKundeForm />
    </div>
  );
}
