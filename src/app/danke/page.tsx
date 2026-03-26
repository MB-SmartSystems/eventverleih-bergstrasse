import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";

export const metadata = {
  title: "Vielen Dank — Eventverleih Bergstraße",
};

export default function Danke() {
  return (
    <>
      <Header />
      <main className="pt-24 pb-16 min-h-[60vh] flex items-center">
        <div className="container-width px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gold-500/10 text-gold-400 mb-6">
            <svg
              className="w-10 h-10"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-4">
            Vielen Dank für Ihre Anfrage!
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto mb-8">
            Wir haben Ihre Anfrage erhalten und melden uns schnellstmöglich mit
            einem Angebot bei Ihnen.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 border border-white/20 text-white font-medium rounded-lg hover:bg-white/5 transition-all"
          >
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
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Zurück zur Startseite
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
