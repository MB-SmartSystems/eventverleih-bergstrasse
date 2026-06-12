// Die fünf Fakten, die Vergleicher suchen — scanbar statt im FAQ vergraben.
const fakten = [
  {
    title: "Bis zu 5 Tage mieten",
    text: "Genug Zeit für Aufbau, Fest und Abbau — ohne Tagesdruck.",
  },
  {
    title: "30 % online, Rest bei Übergabe",
    text: "Anzahlung per Stripe, der Großteil erst, wenn Sie alles gesehen haben.",
  },
  {
    title: "Kaution ist Pfand, kein Preis",
    text: "Bei ordentlicher Rückgabe kommt sie vollständig zurück.",
  },
  {
    title: "Zelte stehen sicher",
    text: "Ebener Untergrund plus Gewichte oder Bodenanker sind Pflicht — wir planen das mit ein.",
  },
  {
    title: "Storno-Staffel ohne Überraschung",
    text: "Bis 7 Tage vorher 50 %, bis 4 Tage 75 %, ab 2 Tage 100 % der Mietsumme.",
  },
];

export default function FaktenKompakt() {
  return (
    <section id="fakten" className="section-padding bg-navy-800">
      <div className="container-width">
        <div className="text-center mb-12">
          <p className="text-gold-400 text-sm font-medium tracking-widest uppercase mb-3">
            Das Wichtigste
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-bold">
            Fakten in 30 Sekunden
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-5">
          {fakten.map((fakt) => (
            <div key={fakt.title} className="glass-card p-5 text-center">
              <h3 className="text-white font-semibold text-sm mb-2">
                {fakt.title}
              </h3>
              <p className="text-gray-400 text-xs leading-relaxed">
                {fakt.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
