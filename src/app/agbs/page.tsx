import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata = {
  title: "AGB — Eventverleih Bergstraße",
};

export default function AGB() {
  return (
    <>
      <Header />
      <main className="pt-24 pb-16">
        <div className="container-width px-4 sm:px-6 lg:px-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-8">
            Allgemeine Geschäftsbedingungen
          </h1>
          <div className="prose prose-invert prose-gold max-w-3xl space-y-6 text-gray-300 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-white [&_h2]:mt-8 [&_h3]:text-lg [&_h3]:font-medium [&_h3]:text-white [&_h3]:mt-6">
            <h2>§ 1 Geltungsbereich</h2>
            <p>
              Diese Allgemeinen Geschäftsbedingungen gelten für alle
              Mietverhältnisse zwischen dem Eventverleih Bergstraße (nachfolgend
              &ldquo;Vermieter&rdquo;) und dem Kunden (nachfolgend
              &ldquo;Mieter&rdquo;).
            </p>

            <h2>§ 2 Vertragsschluss</h2>
            <p>
              Der Mietvertrag kommt durch die schriftliche Bestätigung der
              Reservierung durch den Vermieter zustande. Die Buchungsanfrage des
              Mieters stellt ein verbindliches Angebot dar.
            </p>

            <h2>§ 3 Mietdauer</h2>
            <p>
              Die Mietdauer beträgt bis zu 5 Tage ab dem vereinbarten
              Übergabetermin. Verlängerungen sind nach Absprache möglich und
              werden gesondert berechnet.
            </p>

            <h2>§ 4 Preise und Zahlung</h2>
            <p>
              Alle Preise verstehen sich inklusive Mehrwertsteuer
              (Kleinunternehmerregelung nach § 19 UStG). Die Zahlung der
              Mietgebühr sowie der Kaution erfolgt bei Übergabe der Mietartikel
              in bar oder per Überweisung.
            </p>

            <h2>§ 5 Kaution</h2>
            <p>
              Für die Mietartikel wird eine Kaution erhoben. Die Höhe der
              Kaution wird im Mietvertrag festgelegt. Die Kaution wird nach
              Rückgabe und Prüfung der Mietartikel innerhalb von 1–2
              Werktagen zurückerstattet, sofern keine Schäden oder fehlende
              Teile festgestellt werden.
            </p>

            <h2>§ 6 Pflichten des Mieters</h2>
            <p>Der Mieter verpflichtet sich:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                Die Mietartikel pfleglich zu behandeln und nur bestimmungsgemäß
                zu verwenden.
              </li>
              <li>
                Zelte verpflichtend mit Gewichten oder Bodenankern zu sichern.
              </li>
              <li>
                3×3-m-Zelte mindestens zu zweit, 3×6-m-Zelte mit mindestens
                vier Personen aufzubauen.
              </li>
              <li>
                Zelte nicht bei starkem Wind oder Unwetter aufzubauen oder
                stehen zu lassen.
              </li>
              <li>
                Alle Mietartikel sauber und vollständig zurückzugeben.
              </li>
            </ul>

            <h2>§ 7 Haftung und Schäden</h2>
            <p>
              Der Mieter haftet für alle Schäden, die während der Mietzeit an
              den Mietartikeln entstehen. Beschädigte oder stark abgenutzte
              Mietartikel werden mit einer angemessenen Reparaturpauschale und
              zusätzlich benötigten Ersatzteilen berechnet. Die Gesamtkosten
              werden mit der Kaution verrechnet.
            </p>

            <h2>§ 8 Stornierung</h2>
            <p>Stornierungen sind wie folgt möglich:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                Bis 7 Tage vor Mietbeginn: 50 % der Mietkosten und 50 % der
                Kaution.
              </li>
              <li>
                Bis 4 Tage vor Mietbeginn: 75 % der Mietkosten und 75 % der
                Kaution.
              </li>
              <li>
                Bis 2 Tage vor Mietbeginn: 100 % der Mietkosten und 100 % der
                Kaution.
              </li>
            </ul>

            <h2>§ 9 Lieferung und Abholung</h2>
            <p>
              Die Lieferung und Abholung der Mietartikel erfolgt nach
              Vereinbarung. Lieferkosten werden je nach Entfernung gesondert
              berechnet. Alternativ können die Mietartikel nach Absprache am
              Standort des Vermieters abgeholt und zurückgebracht werden.
            </p>

            <h2>§ 10 Schlussbestimmungen</h2>
            <p>
              Es gilt das Recht der Bundesrepublik Deutschland. Sollten einzelne
              Bestimmungen dieser AGB unwirksam sein, bleibt die Wirksamkeit der
              übrigen Bestimmungen davon unberührt.
            </p>

            <p className="text-gray-500 text-sm mt-8">
              Stand: März 2025
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
