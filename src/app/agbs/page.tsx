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
            Allgemeine Geschäftsbedingungen (AGBs)
          </h1>
          <div className="prose prose-invert max-w-3xl space-y-6 text-gray-300 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-white [&_h2]:mt-8 [&_h3]:text-lg [&_h3]:font-medium [&_h3]:text-white [&_h3]:mt-6 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2">
            <h2>Anzahlung</h2>
            <p>
              Durch die Anzahlung der Kaution stimmen Sie unserem Mietvertrag zu.
              Die Kaution wird Ihnen nach Rückgabe der Mietgegenstände
              zurückgezahlt. Die Zahlung der Kaution führt zur Reservierung der
              Buchung.
            </p>

            <h2>Restzahlung</h2>
            <p>
              Die Restzahlung ist spätestens am Tag des Startes der Buchung
              fällig.
            </p>

            <h2>Abholung/Lieferung</h2>
            <p>
              Der Mieter kann nach Absprache von Datum und Uhrzeit die Mietartikel
              abholen oder liefern und aufbauen lassen. Beim Transport im
              Anhänger/auf Ladeflächen, verwenden Sie bitte Planen/Decken. Die
              geliehenen Artikel müssen gut gesichert werden. Ggfs. leihen wir
              Ihnen gegen Gebühr Planen und Spanngurte. Kontaktieren Sie uns
              jederzeit bei Fragen zur Abholung/Lieferung. Bei Lieferung oder
              Abholung stimmt der Mieter zu, dass alle Mietgegenstände in
              zufriedenstellendem Zustand sind. Falls der Kunde Schäden bei den
              Mietartikeln bemerken möchte, muss dies erfolgen, bevor die Artikel
              zur Abholung verladen werden oder wenn unser Personal bei
              Lieferung/Aufbau anwesend ist. Sollten bei eigenem Aufbau Mängel
              sichtbar werden, sind diese sofort dem Verleiher zu melden.
            </p>

            <h2>Stornierungen</h2>
            <ul>
              <li>
                Bei Stornierung innerhalb von 7 Tagen vor der Veranstaltung werden
                50% der gebuchten Artikel berechnet und 50% der Kaution
                einbehalten.
              </li>
              <li>
                Bei Stornierung innerhalb von 4 Tagen vor der Veranstaltung werden
                75% der gebuchten Artikel berechnet und 75% der Kaution
                einbehalten.
              </li>
              <li>
                Bei Stornierung innerhalb von 2 Tagen vor der Veranstaltung werden
                100% der gebuchten Artikel berechnet und 100% der Kaution
                einbehalten.
              </li>
            </ul>

            <h2>Zelte</h2>
            <p>
              Sollten Sie Zelte selbst auf- und abbauen, beachten Sie bitte den
              sachgemäßen und vorsichtigen Umgang. Der Untergrund muss eben und
              gerade sein. Bauen Sie ein Zelt nie alleine auf oder ab, sondern
              immer mindestens zu zweit oder zu viert. Handeln Sie nach den
              Gebrauchsanweisungen. Zelte sind mit Gewichten oder Bodenankern und
              Spanngurten zu sichern. Sollten Sie diese nicht besitzen, können Sie
              das passende Equipment bei uns mieten. Nasse Zeltplanen sind beim
              Abbau so gut es geht trocknen zu lassen, bevor sie verpackt werden.
              Grillen und Kochen ist unter Zelten strengstens verboten! Nehmen Sie
              dafür bitte einen angemessenen Abstand zum Zelt ein.
            </p>

            <h2>Tische und Stühle</h2>
            <p>
              Tische und Stühle müssen bei Abholung durch den Verleiher oder
              Rückgabe durch den Mieter sauber, trocken und zusammengeklappt sein.
            </p>

            <h2>Tischdecken</h2>
            <p>
              Tischdecken sollten bei Rückgabe in Plastiksäcken gesammelt werden.
              Wenn nicht anders vereinbart, übernehmen wir die Reinigung.
            </p>

            <h2>Befestigungen</h2>
            <p>
              Es dürfen keine Klammern, Reißnägel, Stecknadeln etc. verwendet
              werden, um eigene Dinge an die Ausrüstung zu befestigen. Schäden
              führen zu Kosten für die Reparatur oder den Austausch der
              Ausrüstung.
            </p>

            <h2>Klebeband</h2>
            <p>
              Es darf kein Klebeband an etwas anderem als der Unterseite der
              Tische verwendet werden. Zu keinem Zeitpunkt darf Klebeband auf das
              Vinyl des Zeltes geklebt werden. Schäden führen zu Kosten für die
              Reparatur oder den Austausch der Ausrüstung.
            </p>

            <h2>Heizstrahler</h2>
            <p>
              Heizstrahler dürfen nur nach Einweisung und Lesen der
              Gebrauchsanleitung bedient werden. Mit der Inbetriebnahme bestätigen
              Sie, dass Sie alle relevanten Sicherheitshinweise gelesen und
              verstanden haben.
            </p>

            <h2 className="!mt-12">Mietvertrag</h2>
            <ol className="list-decimal pl-6 space-y-3">
              <li>
                Gebuchte Artikel können vom Kunden kostenlos abgeholt oder gegen
                Gebühr geliefert und aufgebaut werden. Zusatzgebühren wie
                Parkscheine, etc. sind vom Kunden zu tragen.
              </li>
              <li>
                Das gemietete Equipment bleibt das alleinige Eigentum des
                Verleihers. Der Mieter hat nur das Recht zur Nutzung des
                Equipments gemäß den Bedingungen dieses Vertrages.
              </li>
              <li>
                Bei Lieferung und Aufbau bestätigt der Mieter, dass er die
                Möglichkeit hatte, das Equipment persönlich zu inspizieren und es
                in gutem Zustand ist. Der Mieter versteht die ordnungsgemäße
                Nutzung des Equipments. Bei Abholung und Aufbau durch den Kunden
                müssen Mängel sofort dem Vermieter gemeldet werden.
              </li>
              <li>
                Falls das Equipment aus irgendeinem Grund unsicher oder beschädigt
                wird, verpflichtet sich der Mieter, die Nutzung sofort
                einzustellen und den Verleiher zu benachrichtigen. Wenn der Mangel
                durch normale Nutzung verursacht wurde, wird der Verleiher das
                Equipment reparieren oder durch ähnliches Equipment in gutem
                Zustand ersetzen, falls verfügbar.
              </li>
              <li>
                Der Vermieter ist nicht Hersteller oder Vertreter des Herstellers
                der vermieteten Artikel und übernimmt keine Garantie für etwaige
                Mängel durch verbogenes Material, Verarbeitung, etc. Obwohl alle
                Zelte bis zu einem gewissen Grad mit wasserdichtem Material
                behandelt wurden, kann nicht garantiert werden, dass alle Zelte
                absolut wasserdicht sind.
              </li>
              <li>
                Der Mieter verpflichtet sich, den Verleiher von allen Ansprüchen,
                Haftungen, Verlusten, Schadensersatzansprüchen aufgrund von
                Personenschäden, Sachschäden oder sonstigen Ausgaben, die durch die
                Handlungen, Fahrlässigkeit oder andere Handlungen des Mieters oder
                seiner Vertreter entstehen, schadlos zu halten.
              </li>
              <li>
                Das Recht des Mieters auf Besitz endet mit Ablauf des
                Mietzeitraums. Jede Verlängerung muss schriftlich vereinbart
                werden.
              </li>
              <li>
                Der Mieter darf das Equipment ohne schriftliche Genehmigung des
                Verleihers nicht untervermieten oder verleihen. Jegliche angebliche
                Abtretung durch den Mieter ist ungültig.
              </li>
              <li>
                Wenn das Equipment in beschädigtem oder stark abgenutztem Zustand
                zurückgegeben wird, kann der Verleiher den Betrag der
                Kautionsrückzahlung anhand angemessener Reparaturkosten anpassen.
              </li>
              <li>
                Der Mieter übernimmt alle wetterbedingten Risiken, die mit der
                Durchführung einer Zeltveranstaltung im Freien verbunden sind.
                Durch Wetter beschädigtes oder unbrauchbares Equipment wird dem
                Mieter in Rechnung gestellt.
              </li>
              <li>
                Sämtliche Mietartikel außer Zelte sind vor Regen zu schützen. Dies
                ist keine normale Abnutzung und die Artikel werden mit 10% der
                Wiederbeschaffungskosten berechnet.
              </li>
              <li>
                Reinigungskosten für schmutzig zurückgegebene Geräte werden vom
                Mieter übernommen, nach Ermessen des Verleihers (ausgenommen
                Artikel, die inklusive Reinigung angeboten werden).
              </li>
              <li>
                Der Mieter verpflichtet sich, für Equipment (zum
                Wiederbeschaffungspreis bei Mietbeginn) bei allen Arten von
                Diebstahl oder Verlust aufzukommen.
              </li>
              <li>
                Der Verleiher behält sich das Recht vor, das Equipment als
                verloren, gestohlen oder umgewandelt zu betrachten, wenn es nicht
                innerhalb von zwei Tagen nach vereinbartem Datum und der Uhrzeit
                zurückgegeben wird.
              </li>
              <li>
                Dieser Vertrag stellt die gesamte Vereinbarung zwischen dem
                Verleiher und dem Mieter dar und ersetzt alle vorherigen
                Vereinbarungen, Absprachen oder Verständigungen. Änderungen dieses
                Vertrages müssen schriftlich erfolgen und von beiden Parteien
                schriftlich akzeptiert werden.
              </li>
              <li>
                Sollte eine Bestimmung dieses Vertrages als ungültig oder nicht
                durchsetzbar erklärt werden, bleiben die übrigen Bestimmungen in
                vollem Umfang in Kraft und wirksam.
              </li>
              <li>
                Die Zahlung der Kaution/des Gesamtbetrages bedeutet, dass der
                Mieter die Bedingungen gelesen, verstanden und akzeptiert hat.
              </li>
            </ol>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
