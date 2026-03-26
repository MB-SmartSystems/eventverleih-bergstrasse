const steps = [
  {
    number: "01",
    title: "Anfrage senden",
    description:
      "Sie wählen die gewünschten Artikel und senden uns Ihre Anfrage.",
    icon: (
      <svg
        className="w-8 h-8"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
        />
      </svg>
    ),
  },
  {
    number: "02",
    title: "Angebot erhalten",
    description:
      "Wir prüfen die Verfügbarkeit und bestätigen Ihre Reservierung.",
    icon: (
      <svg
        className="w-8 h-8"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  {
    number: "03",
    title: "Abholung oder Lieferung",
    description:
      "Zum vereinbarten Zeitpunkt holen Sie die Ausstattung ab oder lassen sie liefern.",
    icon: (
      <svg
        className="w-8 h-8"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"
        />
      </svg>
    ),
  },
  {
    number: "04",
    title: "Bis zu 5 Tage nutzen",
    description:
      "Genügend Zeit für Aufbau, Feste und Feiern — ohne Tagesdruck.",
    icon: (
      <svg
        className="w-8 h-8"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
        />
      </svg>
    ),
  },
];

export default function Ablauf() {
  return (
    <section id="ablauf" className="section-padding bg-navy-800">
      <div className="container-width">
        <div className="text-center mb-16">
          <p className="text-gold-400 text-sm font-medium tracking-widest uppercase mb-3">
            Unser Ablauf
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            So läuft Ihre Miete bei uns ab
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Einfacher Ablauf für Zelte & Eventausstattung — klar, flexibel und
            ohne unnötigen Aufwand.
          </p>
        </div>

        <div className="grid md:grid-cols-4 gap-6 md:gap-8 mb-12">
          {steps.map((step, i) => (
            <div key={step.number} className="relative">
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-10 left-[60%] w-[80%] h-px bg-gradient-to-r from-gold-500/40 to-gold-500/10" />
              )}

              <div className="glass-card p-6 text-center h-full">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gold-500/10 text-gold-400 mb-4">
                  {step.icon}
                </div>
                <div className="text-gold-500 text-xs font-bold tracking-widest uppercase mb-2">
                  Schritt {step.number}
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">
                  {step.title}
                </h3>
                <p className="text-gray-400 text-sm">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Return & Deposit */}
        <div className="glass-card p-6 md:p-8 text-center max-w-2xl mx-auto border-gold-500/20">
          <div className="text-gold-400 text-xs font-bold tracking-widest uppercase mb-2">
            Danach
          </div>
          <h3 className="text-white font-semibold text-xl mb-3">
            Rückgabe & Kaution
          </h3>
          <p className="text-gray-400">
            Nach der Rückgabe prüfen wir die Artikel und erstatten die Kaution
            zuverlässig zurück.
          </p>
        </div>

        <div className="text-center mt-10">
          <a
            href="#kontakt"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-gold-500 to-gold-600 text-navy-900 font-semibold rounded-lg hover:from-gold-400 hover:to-gold-500 transition-all"
          >
            Jetzt Anfrage starten
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
