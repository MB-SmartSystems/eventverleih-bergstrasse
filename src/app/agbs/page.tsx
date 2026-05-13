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
          <div className="prose prose-invert max-w-3xl space-y-6 text-gray-300 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-white [&_h2]:mt-8 [&_h3]:text-lg [&_h3]:font-medium [&_h3]:text-white [&_h3]:mt-6 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2">

            <h2>§ 1 Geltung</h2>
            <p>
              Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für alle Verträge
              zwischen Eventverleih Bergstraße (Manuel Büttner, Schlesierstraße 19a,
              64665 Alsbach-Hähnlein) und dem Mieter über die Vermietung von Zelten,
              Tischen, Stühlen, Beleuchtung, Heizstrahlern und weiterer
              Eventausstattung.
            </p>
            <p>
              Mit der Buchung und der Zahlung der Anzahlung erkennt der Mieter
              diese AGB als verbindlich an. Abweichende Bedingungen des Mieters
              werden nicht Vertragsbestandteil, es sei denn, der Vermieter stimmt
              ihrer Geltung ausdrücklich in Textform zu.
            </p>

            <h2>§ 2 Kunden, Vertragsschluss, Textform</h2>
            <p>
              Der Vermieter richtet sich an Verbraucher (Privatkunden) für
              private Feste und Feiern. Anfragen können per Formular, E-Mail,
              Telefon oder WhatsApp gestellt werden.
            </p>
            <p>
              Der Mietvertrag kommt durch die Bestätigung des Angebots durch den
              Mieter und die anschließende Zahlung der Anzahlung zustande.
              Erklärungen zwischen den Parteien (Angebot, Annahme, Verlängerung,
              Stornierung, Schadensmeldung) sind in Textform im Sinne von § 126b
              BGB ausreichend — die Bestätigung per E-Mail oder über einen
              Bestätigungs-Link genügt. Eine eigenhändige Unterschrift wird nicht
              verlangt.
            </p>

            <h2>§ 3 Anzahlung, Restzahlung, Kaution</h2>
            <p>
              Mit der Bestätigung des Angebots wird eine <strong>Anzahlung von
              30 % der Mietsumme</strong> fällig. Die Anzahlung ist Bestandteil
              des Mietpreises.
            </p>
            <p>
              Die <strong>Restzahlung von 70 % der Mietsumme</strong> sowie die
              <strong>Kaution</strong> sind spätestens am Tag der Übergabe der
              Mietgegenstände fällig.
            </p>
            <p>
              Die <strong>Kaution</strong> ist eine zusätzliche Sicherheit und
              kein Bestandteil des Mietpreises. Ihre Höhe ergibt sich aus den
              gebuchten Artikeln und wird im Angebot ausgewiesen. Die Kaution
              wird nach Rückgabe der Mietgegenstände in einwandfreiem Zustand
              vollständig erstattet. Berechtigte Ansprüche des Vermieters
              (z. B. Reinigung gemäß § 13, Schäden gemäß § 16) werden mit der
              Kaution verrechnet.
            </p>

            <h2>§ 4 Widerrufsrecht</h2>
            <p>
              Bei der Vermietung von Eventausstattung für einen konkreten Termin
              handelt es sich um eine Dienstleistung im Zusammenhang mit
              Freizeitbetätigungen im Sinne von <strong>§ 312g Abs. 2 Nr. 9
              BGB</strong>. Ein gesetzliches Widerrufsrecht nach §§ 312g, 355 BGB
              besteht daher nicht.
            </p>
            <p>
              Für Stornierungen gilt ausschließlich die Regelung in § 5.
            </p>

            <h2>§ 5 Stornierung</h2>
            <p>
              Der Mieter kann die Buchung in Textform stornieren. Bei Stornierung
              werden folgende Stornogebühren bezogen auf die Mietsumme der
              gebuchten Artikel berechnet:
            </p>
            <ul>
              <li>
                Bei Stornierung innerhalb von 7 Tagen vor der Veranstaltung:
                <strong> 50 %</strong> der Mietsumme.
              </li>
              <li>
                Bei Stornierung innerhalb von 4 Tagen vor der Veranstaltung:
                <strong> 75 %</strong> der Mietsumme.
              </li>
              <li>
                Bei Stornierung innerhalb von 2 Tagen vor der Veranstaltung:
                <strong> 100 %</strong> der Mietsumme.
              </li>
            </ul>
            <p>
              <strong>Verrechnung:</strong> Die bereits gezahlte Anzahlung
              (30 % der Mietsumme, siehe § 3) wird mit der Stornogebühr
              verrechnet. Übersteigt die Stornogebühr die geleistete Anzahlung,
              fordert der Vermieter die Differenz vom Mieter nach. Ist die
              Anzahlung höher als die Stornogebühr, wird die Differenz dem
              Mieter erstattet.
            </p>
            <p>
              <strong>Kaution:</strong> Wurde die Kaution zum Zeitpunkt der
              Stornierung bereits hinterlegt (d. h. bei Stornierung nach der
              Übergabe der Mietartikel — z. B. wegen Wetter-Abbruch während
              laufender Miete), wird sie nach Verrechnung mit der Stornogebühr
              und etwaigen Schadensansprüchen vollständig zurückerstattet. Bei
              Stornierung vor Übergabe fällt keine separate Kaution-Einbehaltung
              an, da die Kaution erst bei Übergabe fällig wird.
            </p>
            <p>
              <strong>Bemessungsgrundlage</strong> ist die Mietsumme der
              gebuchten Artikel (ohne Lieferung, Aufbau und Abbau).
              Lieferkosten werden nur dann berechnet, wenn die Lieferung bereits
              durchgeführt wurde.
            </p>

            <h2>§ 6 Abholung und Lieferung</h2>
            <p>
              Der Mieter kann die Mietartikel nach Absprache von Datum und
              Uhrzeit selbst abholen oder gegen Gebühr liefern lassen. Beim
              Transport im Anhänger oder auf Ladeflächen sind Planen und Gurte
              zu verwenden (auf Wunsch gegen Gebühr von uns erhältlich).
            </p>
            <p>
              Bei Übergabe hat der Mieter die Möglichkeit, die Artikel auf Mängel
              zu prüfen. Mit der Übernahme bestätigt der Mieter, dass die
              Mietgegenstände in zufriedenstellendem Zustand sind. Offensichtliche
              Mängel sind sofort dem Vermieter zu melden, spätere Mängelrügen
              sind nach Übernahme ausgeschlossen, soweit der Mangel bei der
              Übergabe erkennbar war.
            </p>
            <p>
              Sollten Mängel erst nach Übergabe oder während des Mietzeitraums
              auftreten, hat der Mieter die Nutzung des betroffenen Artikels
              sofort einzustellen und den Vermieter unverzüglich zu informieren.
              Bei Mängeln durch normale Nutzung wird der Vermieter den Artikel
              reparieren oder, soweit verfügbar, durch einen vergleichbaren
              Artikel ersetzen.
            </p>

            <h2>§ 7 Aufbau-Service nur auf Privatgrund</h2>
            <p>
              Der Vermieter bietet einen optionalen Aufbau-Service gegen Aufpreis
              an. Dieser Service wird <strong>ausschließlich auf Privatgrund
              des Mieters</strong> erbracht (eigenes Grundstück, eigene
              Hofeinfahrt, eigener Garten). Für den Aufbau auf öffentlichem
              Gelände, Festplätzen, gemieteten Räumen Dritter oder Kommunal-
              Flächen wird kein Aufbau-Service erbracht.
            </p>
            <p>
              Bei Buchung des Aufbau-Services stellt der Mieter eine
              <strong>Hilfsperson</strong> für die Dauer des Auf- bzw. Abbaus
              (durchschnittlich 30–60 Minuten) zur Verfügung. Aus
              Sicherheitsgründen — insbesondere bei Zelten ab 3 × 6 m — kann
              der Aufbau ohne zweite Person nicht durchgeführt werden.
            </p>

            <h2>§ 8 Wetter-Vorbehalt</h2>
            <p>
              Der Mieter trägt grundsätzlich das wetterbedingte Risiko bei
              Veranstaltungen im Freien. Durch Wetter beschädigtes oder
              unbrauchbar gewordenes Equipment wird dem Mieter in Rechnung
              gestellt, soweit der Schaden nicht durch normale Abnutzung
              entstand.
            </p>
            <p>
              <strong>Aufbau-Verweigerungsrecht:</strong> Bei amtlicher Sturm-
              oder Unwetterwarnung des Deutschen Wetterdienstes (ab Stufe 2,
              Wind &gt; 50 km/h prognostiziert) am Tag des Aufbaus oder der
              Veranstaltung behält sich der Vermieter das Recht vor, den Aufbau
              aus Sicherheitsgründen zu verweigern oder zu verschieben. Bereits
              gezahlte Beträge werden in diesem Fall ohne Storno-Abzug erstattet
              oder gutgeschrieben. Dies gilt nicht als Stornierung durch den
              Kunden.
            </p>

            <h2>§ 9 Zelte — Selbst-Aufbau und Sicherheit</h2>
            <p>
              Sollte der Mieter Zelte selbst auf- oder abbauen, ist er
              verpflichtet, sachgemäß und gemäß Gebrauchsanweisung vorzugehen.
              Der Untergrund muss eben sein. Zelte dürfen
              <strong>niemals alleine aufgebaut</strong> werden — Zelte ab
              3 × 6 m benötigen mindestens vier Personen.
            </p>
            <p>
              Zelte sind mit Gewichten oder Bodenankern und Spanngurten zu
              sichern; ohne sichere Befestigung erfolgt keine Übergabe. Nasse
              Zeltplanen sind vor dem Verpacken trocknen zu lassen.
              <strong>Grillen, Kochen und offenes Feuer sind unter Zelten
              untersagt.</strong>
            </p>

            <h2>§ 10 Heizstrahler / Gasgeräte — DGUV 110-010 und BetrSichV</h2>
            <p>
              Heizstrahler dürfen ausschließlich <strong>im Freien</strong>
              betrieben werden. Die Bedienung ist nur nach Einweisung durch den
              Vermieter und nach Lesen der Gebrauchsanleitung zulässig.
            </p>
            <p>
              Der Vermieter weist gemäß <strong>DGUV Regel 110-010</strong>
              („Arbeiten in Gaststätten") und der
              <strong>Betriebssicherheitsverordnung (BetrSichV)</strong> auf
              folgende Sicherheits-Anforderungen hin:
            </p>
            <ul>
              <li>Schlauchbruchsicherung (bei Schlauchlängen &gt; 40 cm)</li>
              <li>Gas-Kippsicherung</li>
              <li>Druckminderer</li>
              <li>ausschließlicher Outdoor-Betrieb</li>
            </ul>
            <p>
              Bei Übergabe des Heizstrahlers wird der Mieter eingewiesen und
              dokumentiert die Einweisung per Unterschrift bzw. digitalem
              Übergabe-Protokoll (Foto-Dokumentation). Mit der Inbetriebnahme
              bestätigt der Mieter, dass er die Sicherheitshinweise gelesen,
              verstanden und akzeptiert hat. Verstöße gegen diese
              Sicherheits-Anforderungen führen zur vollumfänglichen Haftung des
              Mieters und schließen jegliche Mängelansprüche gegen den
              Vermieter aus.
            </p>

            <h2>§ 11 Tische, Stühle, Tischdecken</h2>
            <p>
              Tische und Stühle sind bei Rückgabe sauber, trocken und
              zusammengeklappt abzugeben. Tischdecken sind in Plastiksäcken zu
              sammeln; die Reinigung übernimmt der Vermieter (im Preis
              enthalten).
            </p>

            <h2>§ 12 Befestigungen und Klebeband</h2>
            <p>
              Klammern, Reißnägel oder Stecknadeln dürfen <strong>nicht</strong>
              verwendet werden. Klebeband darf ausschließlich an der Unterseite
              von Tischen verwendet werden; insbesondere nicht auf Zeltplanen
              oder anderen Materialien. Schäden durch Nicht-Einhaltung werden
              dem Mieter in Rechnung gestellt.
            </p>

            <h2>§ 13 Reinigungskosten</h2>
            <p>
              Mietartikel sind bei Rückgabe sauber und trocken abzugeben.
              Ausnahme: Tischdecken (Reinigung im Preis enthalten). Wird ein
              Artikel verschmutzt zurückgegeben, berechnet der Vermieter
              pauschal:
            </p>
            <ul>
              <li>Tische / Stühle / vergleichbare Kleinteile: 5 € pro Stück</li>
              <li>Zelte / Planen: 40 € pro Stück</li>
              <li>
                sonstige Artikel: nach tatsächlichem Aufwand, maximal 10 % des
                Wiederbeschaffungspreises
              </li>
            </ul>
            <p>
              Dem Mieter bleibt der Nachweis unbenommen, dass kein oder ein
              geringerer Schaden entstanden ist.
            </p>

            <h2>§ 14 Eigentum und Untervermietung</h2>
            <p>
              Das vermietete Equipment bleibt das alleinige Eigentum des
              Vermieters. Der Mieter hat nur das Recht zur Nutzung des
              Equipments gemäß den Bedingungen dieses Vertrages. Eine
              Untervermietung oder Überlassung an Dritte ist ohne vorherige
              Zustimmung des Vermieters in Textform <strong>nicht
              gestattet</strong>. Jegliche unberechtigte Abtretung durch den
              Mieter ist unwirksam.
            </p>

            <h2>§ 15 Rückgabe, Verlängerung, Verspätung</h2>
            <p>
              Das Nutzungsrecht des Mieters endet mit Ablauf des im Mietvertrag
              vereinbarten Mietzeitraums. Eine Verlängerung der Mietdauer ist
              möglich, soweit die Artikel nicht für den nachfolgenden Zeitraum
              reserviert sind. Der Mieter informiert den Vermieter in Textform
              mindestens 24 Stunden vor Mietende. Für die Verlängerung wird der
              reguläre Tagessatz berechnet.
            </p>
            <p>
              <strong>Verspätete Rückgabe:</strong> Pro angefangenem Tag nach
              dem vereinbarten Rückgabetermin wird eine Verzugsgebühr in Höhe
              der Tagesmiete berechnet.
            </p>
            <p>
              Wird das Equipment <strong>nicht innerhalb von zwei Tagen</strong>
              nach dem vereinbarten Rückgabetermin zurückgegeben, behält sich
              der Vermieter das Recht vor, das Equipment als verloren oder
              gestohlen zu betrachten und entsprechende Maßnahmen einzuleiten.
              Der Mieter haftet in diesem Fall zum Wiederbeschaffungspreis bei
              Mietbeginn.
            </p>

            <h2>§ 16 Schaden, Verlust, Diebstahl</h2>
            <p>
              Wird das Equipment in beschädigtem oder stark abgenutztem Zustand
              zurückgegeben, wird die Kautionsrückzahlung anhand angemessener
              Reparatur- oder Wiederbeschaffungskosten reduziert. Bei
              Beschädigungen, die die Kaution übersteigen, ist der Mieter zur
              Zahlung der Differenz innerhalb von 14 Tagen nach
              Rechnungsstellung verpflichtet.
            </p>
            <p>
              Der Mieter haftet für Verlust oder Diebstahl der Mietartikel zum
              Wiederbeschaffungspreis bei Mietbeginn. Sämtliche Mietartikel
              außer Zelte sind vor Regen zu schützen; die Beschädigung durch
              Regen gilt nicht als normale Abnutzung und wird mit 10 % des
              Wiederbeschaffungspreises berechnet.
            </p>
            <p>
              Schäden werden bei Rückgabe gemeinsam dokumentiert (inkl. Foto).
              Der Vermieter informiert den Mieter binnen 14 Tagen nach Rückgabe
              über die finalen Reparatur- oder Wiederbeschaffungskosten.
            </p>

            <h2>§ 17 Haftung des Vermieters</h2>
            <p>
              Der Vermieter haftet unbeschränkt bei Vorsatz und grober
              Fahrlässigkeit sowie bei Schäden aus der Verletzung des Lebens,
              des Körpers oder der Gesundheit. Bei leichter Fahrlässigkeit
              haftet der Vermieter nur bei Verletzung wesentlicher
              Vertragspflichten (Kardinalpflichten) und begrenzt auf den
              typischerweise vorhersehbaren Schaden.
            </p>
            <p>
              Der Vermieter ist nicht Hersteller oder Vertreter des Herstellers
              der vermieteten Artikel und übernimmt keine Garantie für etwaige
              Mängel durch verbogenes Material, Verarbeitung oder dergleichen.
              Obwohl Zelte mit wasserdichtem Material behandelt sind, kann nicht
              garantiert werden, dass Zelte absolut wasserdicht sind.
            </p>

            <h2>§ 18 Haftungsfreistellung des Mieters</h2>
            <p>
              Der Mieter stellt den Vermieter von Ansprüchen Dritter frei, die
              durch Handlungen, Fahrlässigkeit oder sonstiges Verschulden des
              Mieters oder seiner Vertreter / Gäste während des Mietzeitraums
              entstehen. Dies umfasst insbesondere Personenschäden,
              Sachschäden sowie Folgekosten.
            </p>

            <h2>§ 19 Anwendbares Recht</h2>
            <p>
              Es gilt ausschließlich deutsches Recht unter Ausschluss des
              UN-Kaufrechts.
            </p>

            <h2>§ 20 Datenschutz</h2>
            <p>
              Die Verarbeitung Ihrer personenbezogenen Daten erfolgt gemäß
              unserer{" "}
              <a
                href="/datenschutz"
                className="text-gold-400 hover:text-gold-500 underline"
              >
                Datenschutzerklärung
              </a>
              .
            </p>

            <h2>§ 21 Salvatorische Klausel</h2>
            <p>
              Sollte eine Bestimmung dieser AGB unwirksam oder nicht
              durchsetzbar sein, bleiben die übrigen Bestimmungen in vollem
              Umfang wirksam. Die unwirksame Bestimmung wird durch eine
              wirksame Regelung ersetzt, die dem Sinn und Zweck der
              ursprünglichen Bestimmung möglichst nahekommt.
            </p>

            <p className="text-sm text-gray-500 mt-12">
              Stand: 13. Mai 2026 — Version 2.0
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
