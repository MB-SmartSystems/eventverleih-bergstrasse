// Anlass-Sets: kuratierte Startpunkte pro Fest-Typ. Der Besucher muss nicht
// selbst von "Geburtstag" auf "Zelt + Tische + Licht" übersetzen — das Set
// tut es; angepasst wird trotzdem Artikel für Artikel im Sortiment.
const sets = [
  {
    name: "Geburtstags-Set",
    claim: "Der Geburtstag, über den noch lange geredet wird",
    text:
      "30, 50 oder einfach so: Zelt 3×6 m, Stehtische für den Empfang, Tische und Stühle fürs Essen, Lichterkette für später — wird es abends kühl, kommt der Heizpilz dazu.",
  },
  {
    name: "Gartenfest-Set",
    claim: "Das Gartenfest mit Nachbarn und Freunden",
    text:
      "Grillabend oder Sommerfest: Pavillon 3×3 m als Schatten- und Regenschutz, Stehtische für lockeres Stehen und Reden, dazu Spiele für Kinder und Erwachsene. Auf- und abgebaut an einem Nachmittag.",
  },
  {
    name: "Hochzeits-Set",
    claim: "Die kleine Hochzeit im eigenen Garten",
    text:
      "Standesamt am Vormittag, Feier zu Hause: Zelt 3×6 m für die Tafel, Lichterketten für die Stunden nach Sonnenuntergang, Deko nach Ihrem Geschmack. Bis zu 5 Tage Mietdauer — in Ruhe vorher aufbauen, danach ohne Hektik abbauen.",
  },
];

export default function AnlassSets() {
  return (
    <section id="sets" className="section-padding bg-navy-800">
      <div className="container-width">
        <div className="text-center mb-16">
          <p className="text-gold-400 text-sm font-medium tracking-widest uppercase mb-3">
            Anlass-Sets
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            Drei Feste, an die schon gedacht ist
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Sie müssen keine Packliste schreiben — wählen Sie Ihren Anlass, an
            den Rest ist gedacht. Jedes Set lässt sich Artikel für Artikel
            anpassen.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 md:gap-8 mb-10">
          {sets.map((set) => (
            <div key={set.name} className="glass-card p-6 md:p-8 flex flex-col h-full">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-xl font-semibold text-white">
                  {set.name}
                </h3>
                <span className="px-2 py-0.5 rounded-full border border-gold-500/40 text-gold-400 text-[11px] font-medium whitespace-nowrap">
                  anpassbar
                </span>
              </div>
              <p className="text-gold-400 text-sm font-medium mb-3">
                „{set.claim}"
              </p>
              <p className="text-gray-400 text-sm leading-relaxed mb-5">
                {set.text}
              </p>
              <div className="mt-auto">
                <a
                  href="#sortiment"
                  className="block text-center w-full py-3 border border-gold-500/30 text-gold-400 font-medium rounded-lg hover:bg-gold-500/10 transition-all text-sm"
                >
                  Artikel ansehen & anpassen
                </a>
                <p className="text-xs text-gray-500 text-center mt-2">
                  Preis = Summe Ihrer Auswahl, keine Paketaufschläge
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Größen-Orientierung */}
        <div className="glass-card p-6 md:p-8 max-w-3xl mx-auto border-gold-500/20 text-center mb-8">
          <p className="text-gray-300 leading-relaxed">
            Als Faustregel: Das 3×3-m-Zelt bietet Platz für bis zu 12
            Sitzplätze, z. B. für Stehtische und Bar, das 3×6-m-Zelt für bis
            zu 24, z. B. für Tafel und Buffet — je nach Tafelgröße und
            Programm wählen Sie einfach die passende Größe.{" "}
            <span className="text-white font-medium">
              Unsicher bei Ihrer Gästezahl?
            </span>{" "}
            <a href="#kontakt" className="text-gold-400 underline underline-offset-2 hover:text-gold-500 transition-colors">
              Schreiben Sie uns Anlass, Datum und ungefähre Gästezahl
            </a>{" "}
            — Sie bekommen einen konkreten Vorschlag zurück.
          </p>
        </div>

        {/* Anderes Fest */}
        <p className="text-center text-gray-400 text-sm max-w-2xl mx-auto">
          Taufe, Einschulung, Abschlussfeier, Jubiläum?{" "}
          <a href="#kontakt" className="text-gold-400 hover:text-gold-500 transition-colors underline underline-offset-2">
            Anlass, Datum und Gästezahl schicken
          </a>
          , wir schlagen ein Setup aus unseren Artikeln vor. Lieber selbst
          stöbern?{" "}
          <a href="#sortiment" className="text-gold-400 hover:text-gold-500 transition-colors underline underline-offset-2">
            Zum Sortiment
          </a>
          .
        </p>
      </div>
    </section>
  );
}
