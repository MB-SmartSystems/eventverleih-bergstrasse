import Header from "@/components/Header";
import PromoBanner from "@/components/PromoBanner";
import Hero from "@/components/Hero";
import GaestezahlSet from "@/components/GaestezahlSet";
import WetterSektion from "@/components/WetterSektion";
import PreisKlartext from "@/components/PreisKlartext";
import Gallery from "@/components/Gallery";
import Sortiment from "@/components/Sortiment";
import Ablauf from "@/components/Ablauf";
import FaktenKompakt from "@/components/FaktenKompakt";
import FAQ from "@/components/FAQ";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";
import CartBar from "@/components/CartBar";
import StickyDateBar from "@/components/StickyDateBar";

// Sektions-Reihenfolge nach Judge-Panel-Spec (12.06.2026): Anlass-Einstieg →
// Sets → Wetter-Hook → Preis-Klartext → Sortiment → Beweis-Galerie → Ablauf →
// Fakten kompakt → FAQ (Sorgen-Reihenfolge) → Kontakt.
export default function Home() {
  return (
    <>
      <StickyDateBar />
      <PromoBanner />
      <Header />
      <main>
        <Hero />
        <GaestezahlSet />
        <WetterSektion />
        <PreisKlartext />
        <Sortiment />
        <Gallery />
        <Ablauf />
        <FaktenKompakt />
        <FAQ />
        <Contact />
      </main>
      <Footer />
      <CartBar />
    </>
  );
}
