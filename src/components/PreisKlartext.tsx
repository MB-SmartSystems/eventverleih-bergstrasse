// Preis-Transparenz als eine Karte, keine Bühne: holt den Vergleicher-Typ ab,
// ohne Erstmieter mit Konditionen-Wänden zu verschrecken.
export default function PreisKlartext() {
  return (
    <section id="preis" className="section-padding bg-navy-800">
      <div className="container-width">
        <div className="glass-card p-6 md:p-10 max-w-3xl mx-auto border-gold-500/20">
          <p className="text-gold-400 text-sm font-medium tracking-widest uppercase mb-3 text-center">
            Preis-Klartext
          </p>
          <h2 className="font-display text-2xl md:text-3xl font-bold mb-6 text-center">
            Ihre Rechnung in einer Zeile
          </h2>
          <p className="text-gray-300 leading-relaxed mb-5 text-center">
            <span className="text-white font-medium">
              Mietpreis + Kaution (kommt zurück)
            </span>{" "}
            — mehr Posten gibt es nicht. Der Mietpreis gilt pauschal für die
            gesamte Miete, egal ob 1 oder 5 Tage, und steht an jedem Artikel.
            30&nbsp;% zahlen Sie bei der Buchung online (Stripe),{" "}
            <span className="text-white font-medium">
              den Rest erst bei der Übergabe — wenn Sie alles gesehen haben.
            </span>
          </p>
          <p className="text-gray-400 text-sm leading-relaxed mb-3 text-center">
            Absagen kostet: 7 Tage vorher 50&nbsp;%, 4 Tage vorher 75&nbsp;%,
            2 Tage vorher 100&nbsp;% der Mietsumme. Je früher Sie umplanen,
            desto günstiger — deshalb steht das hier und nicht im
            Kleingedruckten.
          </p>
          <p className="text-gray-400 text-sm leading-relaxed text-center">
            Lieferung und Abholung auf Wunsch — 2&nbsp;€ pro Kilometer und
            Fahrt, transparent im Warenkorb ausgewiesen.
          </p>
        </div>
      </div>
    </section>
  );
}
