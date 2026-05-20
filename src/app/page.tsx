import { Suspense } from "react";
import Header from "@/components/Header";
import PromoBanner from "@/components/PromoBanner";
import Hero from "@/components/Hero";
import Gallery from "@/components/Gallery";
import Sortiment from "@/components/Sortiment";
import Ablauf from "@/components/Ablauf";
import FAQ from "@/components/FAQ";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";
import CartBar from "@/components/CartBar";
import { CartProvider } from "@/components/CartContext";

export default function Home() {
  return (
    <CartProvider>
      <PromoBanner />
      <Header />
      <main>
        {/* Suspense-Boundaries: Hero/Sortiment/Contact nutzen useSearchParams (Verfuegbarkeits-Datepicker, Sortiment-Badges, Form-Prefill).
            Ohne Boundary verweigert Next.js 14 den Static-Build. */}
        <Suspense fallback={null}>
          <Hero />
        </Suspense>
        <Gallery />
        <Suspense fallback={null}>
          <Sortiment />
        </Suspense>
        <Ablauf />
        <FAQ />
        <Suspense fallback={null}>
          <Contact />
        </Suspense>
      </main>
      <Footer />
      <CartBar />
    </CartProvider>
  );
}
