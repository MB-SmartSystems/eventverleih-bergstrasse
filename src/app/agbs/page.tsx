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
          <div className="prose prose-invert max-w-3xl space-y-6 text-gray-300 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-white [&_h2]:mt-8 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2">

            <p className="text-sm text-gray-400 italic">
              Diese AGB regeln die allgemeinen rechtlichen Grundlagen der Vermietung.
              Die konkreten Vorgangs-Bedingungen für Ihre Buchung (Lieferung, Aufbau,
              Rückgabe, Schadens-Workflow, Reinigung) finden Sie in Ihrem persönlichen
              Mietvertrag, den Sie mit Ihrem Angebot erhalten.
            </p>

            <h2>§ 1 Geltung</h2>
            <p>
              Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für alle Verträge
              zwischen Eventverleih Bergstraße (Manuel Büttner, Schlesierstraße 19a,
              64665 Alsbach-Hähnlein) und dem Mieter über die Vermietung von Zelten,
              Tischen, Stühlen, Beleuchtung, Heizstrahlern und weiterer
              Eventausstattung.
            </p>
            <p>
              Mit der Bestätigung des Angebots erkennt der Mieter diese AGB und den
              persönlichen Mietvertrag als verbindlich an. Abweichende Bedingungen des
              Mieters werden nicht Vertragsbestandteil, es sei denn, der Vermieter
              stimmt ihrer Geltung ausdrücklich in Textform zu.
            </p>

            <h2>§ 2 Kunden, Vertragsschluss, Textform</h2>
            <p>
              Der Vermieter richtet sich an Verbraucher (Privatkunden) für private
              Feste und Feiern. Anfragen können per Formular, E-Mail, Telefon oder
              WhatsApp gestellt werden.
            </p>
            <p>
              Der Mietvertrag kommt durch die Bestätigung des Angebots durch den
              Mieter zustande. Verbindlich reserviert wird der Termin erst mit
              Eingang der Anzahlung. Erklärungen zwischen den Parteien sind in
              Textform im Sinne von § 126b BGB ausreichend — die Bestätigung per
              E-Mail oder über einen Bestätigungs-Link genügt. Eine eigenhändige
              Unterschrift wird nicht verlangt.
            </p>

            <h2>§ 3 Anzahlung, Restzahlung, Kaution</h2>
            <p>
              Mit der Bestätigung des Angebots wird eine{" "}
              <strong>Anzahlung von 30 % der Mietsumme</strong> fällig. Erst mit
              Eingang der Anzahlung wird die Reservierung verbindlich.
            </p>
            <p>
              Die <strong>Restzahlung von 70 % der Mietsumme</strong> sowie die{" "}
              <strong>Kaution</strong> sind spätestens am Tag der Übergabe der
              Mietgegenstände fällig.
            </p>
            <p>
              Die <strong>Kaution</strong> ist eine zusätzliche Sicherheit und kein
              Bestandteil des Mietpreises. Ihre Höhe ergibt sich aus den gebuchten
              Artikeln und wird im Angebot ausgewiesen. Sie wird nach Rückgabe der
              Mietgegenstände in einwandfreiem Zustand vollständig erstattet.
              Berechtigte Ansprüche des Vermieters (Reinigungskosten, Schäden)
              werden gemäß den Regelungen im persönlichen Mietvertrag mit der
              Kaution verrechnet.
            </p>
            <p>
              <strong>Zahlungswege:</strong> Die Anzahlung erfolgt online per Karte
              (Kreditkarte/Stripe) über den im Angebot bzw. in Ihrem Kundenbereich
              hinterlegten Zahlungslink. Die Restzahlung erfolgt ebenfalls online per
              Karte über den hinterlegten Zahlungslink. Die Kaution wird per Karte als
              Vorautorisierung hinterlegt und nach beanstandungsfreier Rückgabe wieder
              freigegeben.
            </p>

            <h2>§ 4 Widerrufsrecht</h2>
            <p>
              Bei der Vermietung von Eventausstattung für einen konkreten Termin
              handelt es sich um eine Dienstleistung im Zusammenhang mit
              Freizeitbetätigungen im Sinne von{" "}
              <strong>§ 312g Abs. 2 Nr. 9 BGB</strong>. Ein gesetzliches
              Widerrufsrecht nach §§ 312g, 355 BGB besteht daher nicht.
            </p>
            <p>Für Stornierungen gilt ausschließlich die Regelung in § 5.</p>

            <h2>§ 5 Stornierung</h2>
            <p>
              Der Mieter kann die Buchung in Textform stornieren. Es gelten folgende
              Stornogebühren bezogen auf die Mietsumme der gebuchten Artikel:
            </p>
            <ul>
              <li>
                <strong>Mehr als 6 Wochen vor der Veranstaltung:</strong> Die
                Anzahlung wird in einen{" "}
                <strong>nicht verfallenden Gutschein</strong> umgewandelt, der für
                eine künftige Buchung bei Eventverleih Bergstraße eingelöst werden
                kann. Es fällt keine zusätzliche Stornogebühr an.
              </li>
              <li>
                7 bis 14 Tage vor der Veranstaltung: <strong>50 %</strong> der
                Mietsumme.
              </li>
              <li>
                4 bis 7 Tage vor der Veranstaltung: <strong>75 %</strong> der
                Mietsumme.
              </li>
              <li>
                Weniger als 4 Tage vor der Veranstaltung: <strong>100 %</strong>{" "}
                der Mietsumme.
              </li>
            </ul>
            <p>
              <strong>Verrechnung:</strong> Die bereits gezahlte Anzahlung wird mit
              der Stornogebühr verrechnet. Übersteigt die Stornogebühr die geleistete
              Anzahlung, fordert der Vermieter die Differenz nach. Ist die Anzahlung
              höher als die Stornogebühr, wird die Differenz erstattet.
            </p>
            <p>
              <strong>Bemessungsgrundlage</strong> ist die Mietsumme der gebuchten
              Artikel (ohne Lieferung, Aufbau und Abbau). Lieferkosten werden nur
              dann berechnet, wenn die Lieferung bereits durchgeführt wurde.
            </p>
            <p>
              Wettbedingte Aufbau-Verweigerungen durch den Vermieter gelten nicht
              als Stornierung durch den Mieter — Details siehe persönlicher
              Mietvertrag.
            </p>

            <h2>§ 6 Persönlicher Mietvertrag</h2>
            <p>
              Die konkreten operativen Bedingungen Ihrer Buchung — Lieferung und
              Aufbau, Helferpflicht im Bedarfsfall, Wetter-Vorbehalt, Übergabe und
              Rückgabe, verspätete Rückgabe, Reinigungs-Pauschalen, Schadens-Workflow,
              Heizstrahler-Einweisung nach DGUV-Regel 110-010, Mieterhaftung
              während der Mietzeit — finden Sie in Ihrem persönlichen Mietvertrag.
              Dieser wird zusammen mit Ihrem Angebot bereitgestellt und gilt
              ergänzend zu diesen AGB.
            </p>
            <p>
              Bei Widersprüchen zwischen AGB und Mietvertrag gelten vorrangig die
              Regelungen des Mietvertrags.
            </p>

            <h2>§ 7 Eigentum und Untervermietung</h2>
            <p>
              Das vermietete Equipment bleibt das alleinige Eigentum des Vermieters.
              Der Mieter hat nur das Recht zur Nutzung des Equipments gemäß den
              Bedingungen dieses Vertrages. Eine Untervermietung oder Überlassung an
              Dritte ist ohne vorherige Zustimmung des Vermieters in Textform{" "}
              <strong>nicht gestattet</strong>. Jegliche unberechtigte Abtretung
              durch den Mieter ist unwirksam.
            </p>

            <h2>§ 8 Haftung des Vermieters</h2>
            <p>
              Der Vermieter haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit
              sowie bei Schäden aus der Verletzung des Lebens, des Körpers oder der
              Gesundheit. Bei leichter Fahrlässigkeit haftet der Vermieter nur bei
              Verletzung wesentlicher Vertragspflichten (Kardinalpflichten) und
              begrenzt auf den typischerweise vorhersehbaren Schaden.
            </p>
            <p>
              Der Vermieter ist nicht Hersteller oder Vertreter des Herstellers der
              vermieteten Artikel und übernimmt keine Garantie für etwaige Mängel
              durch verbogenes Material, Verarbeitung oder dergleichen. Obwohl Zelte
              mit wasserdichtem Material behandelt sind, kann nicht garantiert
              werden, dass Zelte absolut wasserdicht sind.
            </p>

            <h2>§ 9 Haftungsfreistellung durch den Mieter</h2>
            <p>
              Der Mieter stellt den Vermieter von Ansprüchen Dritter frei, die durch
              Handlungen, Fahrlässigkeit oder sonstiges Verschulden des Mieters oder
              seiner Vertreter und Gäste während des Mietzeitraums entstehen. Dies
              umfasst insbesondere Personenschäden, Sachschäden sowie Folgekosten.
            </p>

            <h2>§ 10 Anwendbares Recht</h2>
            <p>
              Es gilt ausschließlich deutsches Recht unter Ausschluss des
              UN-Kaufrechts.
            </p>

            <h2>§ 11 Datenschutz</h2>
            <p>
              Die Verarbeitung Ihrer personenbezogenen Daten erfolgt gemäß unserer{" "}
              <a
                href="/datenschutz"
                className="text-gold-400 hover:text-gold-500 underline"
              >
                Datenschutzerklärung
              </a>
              .
            </p>

            <h2>§ 12 Steuerstatus</h2>
            <p>
              Eventverleih Bergstraße ist Kleinunternehmer im Sinne von{" "}
              <strong>§ 19 Abs. 1 UStG</strong>. Es wird keine Umsatzsteuer
              ausgewiesen.
            </p>

            <h2>§ 13 Salvatorische Klausel</h2>
            <p>
              Sollte eine Bestimmung dieser AGB unwirksam oder nicht durchsetzbar
              sein, bleiben die übrigen Bestimmungen in vollem Umfang wirksam. Die
              unwirksame Bestimmung wird durch eine wirksame Regelung ersetzt, die
              dem Sinn und Zweck der ursprünglichen Bestimmung möglichst nahekommt.
            </p>

            <p className="text-sm text-gray-500 mt-12">
              Stand: 13. Mai 2026 — Version 2.1
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
