import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Datenschutz — Eventverleih Bergstraße",
};

export default function Datenschutz() {
  return (
    <>
      <Header />
      <main className="pt-24 pb-16">
        <div className="container-width px-4 sm:px-6 lg:px-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-8">
            Datenschutzerklärung
          </h1>
          <div className="prose prose-invert max-w-3xl space-y-6 text-gray-300 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-white [&_h2]:mt-8 [&_a]:text-gold-400 hover:[&_a]:text-gold-500">

            <h2>1. Allgemeine Hinweise</h2>
            <p>
              Wir behandeln deine personenbezogenen Daten vertraulich und entsprechend
              den gesetzlichen Datenschutzvorschriften (DSGVO, BDSG, TTDSG) sowie dieser
              Datenschutzerklärung.
            </p>

            <h2>2. Verantwortlicher</h2>
            <p>
              Manuel Büttner · Eventverleih Bergstraße<br />
              Schlesierstraße 19a, 64665 Alsbach-Hähnlein<br />
              E-Mail: info@eventverleih-bergstrasse.de
            </p>
            <p>
              Wir sind nicht verpflichtet, einen Datenschutzbeauftragten zu bestellen
              (§ 38 BDSG).
            </p>

            <h2>3. Hosting (Vercel)</h2>
            <p>
              Diese Website wird gehostet bei Vercel Inc., 440 N Barranca Ave #4133,
              Covina, CA 91723, USA. Unser Projekt ist für die Region Frankfurt (fra1)
              konfiguriert — die Auslieferung der Website erfolgt üblicherweise über
              EU-Server.
            </p>
            <p>
              Beim Besuch der Website verarbeitet Vercel automatisch technische Daten
              wie IP-Adresse, Datum/Uhrzeit, Browsertyp, Betriebssystem und aufgerufene
              Seite zum Zweck des Betriebs der Website (Art. 6 Abs. 1 lit. f DSGVO —
              berechtigtes Interesse an einer technisch fehlerfreien Auslieferung).
            </p>
            <p>
              <strong>Datenübermittlung in die USA:</strong> Vercel Inc. ist nach dem
              EU-US Data Privacy Framework (DPF) zertifiziert. Zusätzlich haben wir mit
              Vercel Standardvertragsklauseln (SCC) gemäß Art. 46 Abs. 2 lit. c DSGVO
              abgeschlossen.
            </p>
            <p>Speicherdauer Server-Logs: 14 Tage.</p>

            <h2>4. Cookies</h2>
            <p>
              Diese Website setzt ausschließlich technisch notwendige Cookies, die für
              den Betrieb der Website erforderlich sind (z.B. Warenkorb-Session,
              Admin-Login). Es findet kein Tracking und keine Analyse statt. Eine
              Einwilligung nach § 25 Abs. 1 TTDSG ist daher nicht erforderlich
              (§ 25 Abs. 2 Nr. 2 TTDSG).
            </p>

            <h2>5. Kontaktformular und Anfragen</h2>
            <p>
              Wenn du uns per Kontaktformular oder E-Mail Anfragen zukommen lässt,
              werden deine Angaben aus dem Formular inklusive der dort angegebenen
              Kontaktdaten zwecks Bearbeitung der Anfrage und für den Fall von
              Anschlussfragen bei uns gespeichert. Diese Daten geben wir nicht ohne
              deine Einwilligung weiter.
            </p>
            <p>
              <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO
              (Durchführung vorvertraglicher Maßnahmen) bzw. lit. f DSGVO (berechtigtes
              Interesse an der Beantwortung).
            </p>
            <p>
              <strong>Speicherdauer:</strong> bis zur vollständigen Bearbeitung deiner
              Anfrage, danach drei Jahre zur Dokumentation (handelsrechtliche
              Aufbewahrungsfristen) — es sei denn, du widersprichst vorher.
            </p>
            <p>
              Das Kontaktformular wird technisch über den Dienstleister Formspree
              (Formspree Inc., 1007 N Orange St 4th Floor Ste 1382, Wilmington, DE
              19801, USA) verarbeitet. Formspree ist nach dem EU-US Data Privacy
              Framework (DPF) zertifiziert; zusätzlich bestehen
              Standardvertragsklauseln.
            </p>

            <h2>6. Telefon und WhatsApp</h2>
            <p>
              Kontaktieren Sie uns per Telefon oder WhatsApp, werden die Telefon- bzw.
              WhatsApp-Nummer sowie Ihr Gesprächsinhalt zur Bearbeitung Ihrer Anfrage
              verarbeitet (Art. 6 Abs. 1 lit. b DSGVO).
            </p>
            <p>
              <strong>Hinweis:</strong> WhatsApp wird von Meta Platforms Ireland Ltd.
              betrieben; bei Nutzung werden Daten an Meta übermittelt, teils außerhalb
              der EU. Nutze ausschließlich Telefon oder E-Mail, wenn du das nicht
              wünschst.
            </p>

            <h2>7. Deine Rechte</h2>
            <p>Du hast nach DSGVO jederzeit das Recht auf:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17)</li>
              <li>Einschränkung der Verarbeitung (Art. 18)</li>
              <li>Datenübertragbarkeit (Art. 20)</li>
              <li>Widerspruch gegen Verarbeitung (Art. 21)</li>
              <li>Widerruf einer Einwilligung für die Zukunft (Art. 7 Abs. 3 DSGVO)</li>
            </ul>
            <p>
              Wende dich dafür an{" "}
              <a href="mailto:info@eventverleih-bergstrasse.de">
                info@eventverleih-bergstrasse.de
              </a>
              .
            </p>

            <h2>8. Beschwerderecht</h2>
            <p>
              Du hast das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu
              beschweren. Zuständig für uns:
            </p>
            <p>
              Der Hessische Beauftragte für Datenschutz und Informationsfreiheit<br />
              Postfach 3163, 65021 Wiesbaden<br />
              <a href="https://datenschutz.hessen.de" target="_blank" rel="noopener noreferrer">
                datenschutz.hessen.de
              </a>
            </p>

            <h2>9. Automatisierte Entscheidungsfindung</h2>
            <p>
              Wir setzen keine automatisierte Entscheidungsfindung oder Profiling im
              Sinne von Art. 22 DSGVO ein.
            </p>

            <p className="text-sm text-gray-500 mt-12">Stand: April 2026</p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
