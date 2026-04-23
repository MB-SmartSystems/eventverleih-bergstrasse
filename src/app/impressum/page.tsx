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
          <div className="prose prose-invert max-w-3xl space-y-6 text-gray-300 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-white [&_h2]:mt-8">
            <h2>Erklärungen gemäß § 5 DDG</h2>
            <p>
              Eventverleih Bergstraße<br />
              Schlesierstraße 19a<br />
              64665 Alsbach-Hähnlein
            </p>
            <p>Vertreten durch: Manuel Büttner</p>
            <p>Rechtsform: Einzelunternehmen</p>

            <h2>Kontakt</h2>
            <p>
              Telefon: +49 156 79521124<br />
              E-Mail: info@eventverleih-bergstrasse.de
            </p>
            <p>Nicht umsatzsteuerpflichtig nach § 19 Abs. 1 UStG (Kleinunternehmer).</p>

            <h2>Aufsichtsbehörde (Datenschutz)</h2>
            <p>
              Der Hessische Beauftragte für Datenschutz und Informationsfreiheit (HBDI)<br />
              Postfach 3163, 65021 Wiesbaden<br />
              <a href="https://datenschutz.hessen.de" target="_blank" rel="noopener noreferrer" className="text-gold-400 hover:text-gold-500">datenschutz.hessen.de</a>
            </p>

            <h2>Verbraucherstreitbeilegung (§ 36 VSBG)</h2>
            <p>
              Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor
              einer Verbraucherschlichtungsstelle teilzunehmen.
            </p>

            <h2>Online-Streitbeilegung (Art. 14 ODR-VO)</h2>
            <p>
              Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{" "}
              <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer" className="text-gold-400 hover:text-gold-500">
                https://ec.europa.eu/consumers/odr/
              </a>
              . Unsere E-Mail-Adresse finden Sie oben.
            </p>

            <h2>Haftungsausschluss</h2>

            <h3 className="text-lg font-medium text-white mt-6">Haftung für Inhalte</h3>
            <p>
              Die Inhalte unserer Seiten wurden mit größter Sorgfalt erstellt. Für die
              Richtigkeit, Vollständigkeit und Aktualität der Inhalte können wir jedoch
              keine Gewähr übernehmen. Als Diensteanbieter sind wir gemäß § 7 Abs.1 DDG
              für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen
              verantwortlich. Nach §§ 8 bis 10 DDG sind wir als Diensteanbieter jedoch
              nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu
              überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige
              Tätigkeit hinweisen. Verpflichtungen zur Entfernung oder Sperrung der
              Nutzung von Informationen nach den allgemeinen Gesetzen bleiben hiervon
              unberührt. Eine diesbezügliche Haftung ist jedoch erst ab dem Zeitpunkt der
              Kenntnis einer konkreten Rechtsverletzung möglich. Bei Bekanntwerden von
              entsprechenden Rechtsverletzungen werden wir diese Inhalte umgehend
              entfernen.
            </p>

            <h3 className="text-lg font-medium text-white mt-6">Haftung für Links</h3>
            <p>
              Unser Angebot enthält Links zu externen Webseiten Dritter, auf deren Inhalte
              wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch
              keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der
              jeweilige Anbieter oder Betreiber der Seiten verantwortlich. Die verlinkten
              Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße
              überprüft. Rechtswidrige Inhalte waren zum Zeitpunkt der Verlinkung nicht
              erkennbar. Eine permanente inhaltliche Kontrolle der verlinkten Seiten ist
              jedoch ohne konkrete Anhaltspunkte einer Rechtsverletzung nicht zumutbar. Bei
              Bekanntwerden von Rechtsverletzungen werden wir derartige Links umgehend
              entfernen.
            </p>

            <h3 className="text-lg font-medium text-white mt-6">Urheberrecht</h3>
            <p>
              Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten
              unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung,
              Verbreitung und jede Art der Verwertung außerhalb der Grenzen des
              Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors
              bzw. Erstellers. Downloads und Kopien dieser Seite sind nur für den privaten,
              nicht kommerziellen Gebrauch gestattet. Soweit die Inhalte auf dieser Seite
              nicht vom Betreiber erstellt wurden, werden die Urheberrechte Dritter
              beachtet. Insbesondere werden Inhalte Dritter als solche gekennzeichnet.
              Sollten Sie trotzdem auf eine Urheberrechtsverletzung aufmerksam werden,
              bitten wir um einen entsprechenden Hinweis. Bei Bekanntwerden von
              Rechtsverletzungen werden wir derartige Inhalte umgehend entfernen.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
