import Header from "@/components/Header";
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
      <Header />
      <main>
        <Hero />
        <Gallery />
        <Sortiment />
        <Ablauf />
        <FAQ />
        <Contact />
      </main>
      <Footer />
      <CartBar />
    </CartProvider>
  );
}
