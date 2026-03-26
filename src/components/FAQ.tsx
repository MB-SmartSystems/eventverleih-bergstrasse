"use client";

const faqs = [
  {
    question: "Muss ich beim Aufbau der Zelte etwas beachten?",
    answer:
      "Ja. 3×3-m-Zelte müssen mindestens zu zweit aufgebaut werden, 3×6-m-Zelte mit vier Personen. Alle Zelte müssen auf ebenem Untergrund stehen und verpflichtend mit Gewichten oder Bodenankern gesichert werden; der Aufbau bei starkem Wind oder Unwetter ist verboten.",
  },
  {
    question: "Brauche ich für ein Zelt zwingend Gewichte oder Bodenanker?",
    answer:
      "Ja. Jedes Zelt muss mit Gewichten oder Bodenankern und Spanngurten gesichert werden; ohne sichere Befestigung erfolgt keine Übergabe.",
  },
  {
    question:
      "Was passiert, wenn ein Artikel beschädigt zurückgegeben wird?",
    answer:
      "Beschädigte oder stark abgenutzte Mietartikel werden mit einer angemessenen Reparaturpauschale und zusätzlich benötigten Ersatzteilen berechnet; die Gesamtkosten werden mit der Kaution verrechnet.",
  },
  {
    question: "Muss Zubehör gereinigt zurückgegeben werden?",
    answer:
      "Ja. Zubehör muss sauber zurückgegeben werden; verschmutztes Material kann zusätzliche Kosten verursachen.",
  },
  {
    question: "Wie läuft die Rückgabe und Kautionsprüfung ab?",
    answer:
      "Nach der Nutzung bringen Sie die Artikel zurück. Wir prüfen alles innerhalb von 1–2 Tagen und erstatten die Kaution anschließend zurück; bei Schäden oder fehlenden Teilen wird die entsprechende Summe einbehalten.",
  },
  {
    question: "Kann ich meine Reservierung kurzfristig stornieren?",
    answer:
      "Ja, eine Stornierung ist möglich. Es gelten die in den AGB angegebenen Gebühren: 7 Tage vorher 50 % der Mietkosten und 50 % der Kaution, 4 Tage vorher 75 % der Mietkosten und 75 % der Kaution, 2 Tage vorher 100 % der Mietkosten und 100 % der Kaution.",
  },
];

export default function FAQ() {
  return (
    <section id="faq" className="section-padding">
      <div className="container-width">
        <div className="text-center mb-16">
          <p className="text-gold-400 text-sm font-medium tracking-widest uppercase mb-3">
            Häufige Fragen
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            Ihre Fragen an uns
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Wir haben die häufigsten Fragen unserer Kunden gesammelt und
            beantwortet.
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-4">
          {faqs.map((faq, i) => (
            <details
              key={i}
              className="glass-card group"
            >
              <summary className="flex items-center justify-between cursor-pointer p-5 md:p-6 list-none">
                <span className="text-white font-medium pr-4">
                  {faq.question}
                </span>
                <svg
                  className="faq-chevron w-5 h-5 text-gold-400 flex-shrink-0 transition-transform duration-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </summary>
              <div className="px-5 md:px-6 pb-5 md:pb-6 text-gray-400 leading-relaxed border-t border-white/5 pt-4">
                {faq.answer}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
