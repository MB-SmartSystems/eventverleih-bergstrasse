/**
 * Notfall-Kontakt-Box für /vertrag/[token].
 * Prominent, damit Kunden bei Problemen während des Events schnell handeln können.
 */
export default function NotfallKontaktBox({ telefon }: { telefon: string }) {
  return (
    <section className="my-6 p-5 rounded-xl bg-red-50 border-l-4 border-red-500 print:break-inside-avoid">
      <h3 className="font-semibold text-red-900 mb-2">Notfall während Ihres Events?</h3>
      <p className="text-sm text-red-800">
        Sollte während des Events ein Problem auftreten (defektes Equipment, fehlende Teile, akuter Bedarf), erreichen
        Sie mich jederzeit unter:
      </p>
      <p className="text-base font-bold text-red-900 mt-2">
        <a href={`tel:${telefon.replace(/\s/g, "")}`} className="underline">
          {telefon}
        </a>{" "}
        <span className="font-normal text-sm">(Anruf oder WhatsApp)</span>
      </p>
      <p className="text-xs text-red-700 mt-2">
        Bitte dokumentieren Sie Probleme nach Möglichkeit mit Foto oder Video, das beschleunigt eine Lösung deutlich.
      </p>
    </section>
  );
}
