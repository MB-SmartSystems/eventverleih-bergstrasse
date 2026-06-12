// Wetter-Beruhigung: der stärkste emotionale Hebel bei Festen im Freien —
// bewusst eine kompakte Sektion, kein Versprechen über das Belegbare hinaus.
const faelle = [
  {
    title: "Regen",
    text: "Ein Schauer um 18 Uhr? Unterm Zelt merkt ihn keiner.",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75l-2.489 4.978a.563.563 0 01-1.022-.014L10.5 15.75m5.25 0H10.5m5.25 0a4.5 4.5 0 10-9.064-.713 3.75 3.75 0 10.814 7.463h8.25a3.75 3.75 0 000-7.5c-.18 0-.357.013-.53.038" />
      </svg>
    ),
  },
  {
    title: "Hitze",
    text: "Mittagssonne? Das Zelt spendet Schatten für Buffet und Gäste.",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
      </svg>
    ),
  },
  {
    title: "Kühler Abend",
    text: "Ab zehn wird's frisch. Der Heizpilz hält die Runde zusammen.",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
      </svg>
    ),
  },
];

export default function WetterSektion() {
  return (
    <section id="wetter" className="section-padding">
      <div className="container-width">
        <div className="text-center mb-12">
          <p className="text-gold-400 text-sm font-medium tracking-widest uppercase mb-3">
            Feste im Freien
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            Und wenn das Wetter kippt?
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6 md:gap-8 mb-10">
          {faelle.map((fall) => (
            <div key={fall.title} className="glass-card p-6 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gold-500/10 text-gold-400 mb-4">
                {fall.icon}
              </div>
              <h3 className="text-white font-semibold text-lg mb-2">
                {fall.title}
              </h3>
              <p className="text-gray-400 text-sm">{fall.text}</p>
            </div>
          ))}
        </div>

        {/* Sicherheitsregel als Beruhigung statt Pflicht */}
        <div className="glass-card p-6 md:p-8 max-w-3xl mx-auto border-gold-500/20 text-center mb-8">
          <p className="text-gray-300 leading-relaxed">
            <span className="text-white font-semibold">
              Hält das Zelt bei Wind? Ja — wenn es richtig steht.
            </span>{" "}
            Ebener Untergrund und Gewichte oder Bodenanker sind deshalb bei uns
            Pflicht, keine Option. Was Sie dafür brauchen, klären wir vor der
            Übergabe.
          </p>
        </div>

        <p className="text-center font-display text-xl md:text-2xl font-semibold">
          Das Wetter können Sie nicht buchen.{" "}
          <span className="gold-text">Das Dach darüber schon.</span>
        </p>
      </div>
    </section>
  );
}
