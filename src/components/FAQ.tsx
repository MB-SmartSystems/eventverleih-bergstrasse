"use client";

// Sorgen-Reihenfolge statt Pflichtenkatalog: jede Antwort beginnt mit der
// Beruhigung, nicht mit der Regel. Die Fakten sind unverändert (AGB-konform).
const faqs = [
  {
    question: "Welches Zelt passt zu meinem Fest?",
    answer:
      "Als Faustregel: Das 3×3-m-Zelt bietet Platz für bis zu 12 Sitzplätze, z. B. für Stehtische und Bar, das 3×6-m-Zelt für bis zu 24, z. B. für Tafel und Buffet — je nach Tafelgröße und Programm wählen Sie einfach die passende Größe. Im Zweifel schicken Sie uns einfach Anlass, Datum und ungefähre Gästezahl — Sie bekommen einen konkreten Vorschlag zurück.",
  },
  {
    question: "Was, wenn am Festtag Regen gemeldet ist?",
    answer:
      "Genau dafür ist das Zelt da: Ihre Gäste sitzen im Trockenen, das Buffet bleibt geschützt, gefeiert wird trotzdem. Nur bei starkem Wind oder Unwetter darf nicht aufgebaut werden — das ist eine Sicherheitsgrenze, keine Schikane.",
  },
  {
    question: "Hält das Zelt bei Wind?",
    answer:
      "Ja — wenn es richtig steht. Deshalb sind ebener Untergrund und die Sicherung mit Gewichten oder Bodenankern und Spanngurten bei uns Pflicht; ohne sichere Befestigung erfolgt keine Übergabe. Beim Aufbau gilt: 3×3-m-Zelte mindestens zu zweit, 3×6-m-Zelte mit vier Personen.",
  },
  {
    question: "Wie läuft die Bezahlung?",
    answer:
      "Bei der Online-Buchung zahlen Sie 30 % an (per Stripe), den Rest erst bei der Übergabe — wenn Sie alles gesehen haben. Dazu kommt eine Kaution als Pfand, die nach der Rückgabe zurückkommt.",
  },
  {
    question: "Was kostet Absagen?",
    answer:
      "Je früher Sie umplanen, desto günstiger: 7 Tage vorher 50 %, 4 Tage vorher 75 %, 2 Tage vorher 100 % der Mietsumme (Artikel, ohne Lieferung, Auf- und Abbau). Die gezahlte Anzahlung wird verrechnet; übersteigt die Stornogebühr die Anzahlung, wird die Differenz nachgefordert.",
  },
  {
    question: "Abholen oder liefern lassen?",
    answer:
      "Beides geht. Übergabe und Rückgabe erfolgen nach Terminvereinbarung an unserem Treffpunkt in Alsbach-Hähnlein — Ort und Uhrzeit stimmen wir nach Ihrer Buchung ab (eine Abholung an der Geschäftsanschrift ist nicht möglich). Auf Wunsch liefern wir direkt zu Ihnen.",
  },
  {
    question: "Was gilt bei Rückgabe, Reinigung und Schäden?",
    answer:
      "Geben Sie alles ordentlich und sauber zurück, bekommen Sie die Kaution vollständig wieder — wir prüfen innerhalb von 1–2 Tagen und erstatten dann. Verschmutztes Material kann zusätzliche Kosten verursachen; beschädigte Artikel werden mit einer angemessenen Reparaturpauschale plus Ersatzteilen berechnet und mit der Kaution verrechnet.",
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
            Die häufigsten Fragen unserer Kunden — beantwortet in der
            Reihenfolge, in der sie einem wirklich durch den Kopf gehen.
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
