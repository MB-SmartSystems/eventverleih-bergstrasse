import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Impressum — Eventverleih Bergstraße",
};

export default function Impressum() {
  return (
    <>
      <Header />
      <main className="pt-24 pb-16">
        <div className="container-width px-4 sm:px-6 lg:px-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-8">
            Impressum
          </h1>
          <div className="prose prose-invert prose-gold max-w-3xl space-y-6 text-gray-300">
            <h2 className="text-xl font-semibold text-white">Angaben gemäß § 5 TMG</h2>
            <p>
              Manuel Büttner<br />
              Eventverleih Bergstraße<br />
              Schlesierstraße 19a<br />
              64665 Alsbach-Hähnlein
            </p>

            <h2 className="text-xl font-semibold text-white">Kontakt</h2>
            <p>
              Telefon: +49 156 79521124<br />
              E-Mail: info@eventverleih-bergstrasse.de
            </p>

            <h2 className="text-xl font-semibold text-white">Umsatzsteuer-ID</h2>
            <p>
              Umsatzsteuerbefreit nach § 19 UStG (Kleinunternehmerregelung).
            </p>

            <h2 className="text-xl font-semibold text-white">
              Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV
            </h2>
            <p>
              Manuel Büttner<br />
              Schlesierstraße 19a<br />
              64665 Alsbach-Hähnlein
            </p>

            <h2 className="text-xl font-semibold text-white">
              Streitschlichtung
            </h2>
            <p>
              Die Europäische Kommission stellt eine Plattform zur
              Online-Streitbeilegung (OS) bereit:{" "}
              <a
                href="https://ec.europa.eu/consumers/odr/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold-400 hover:text-gold-500"
              >
                https://ec.europa.eu/consumers/odr/
              </a>
            </p>
            <p>
              Wir sind nicht bereit oder verpflichtet, an
              Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
              teilzunehmen.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
