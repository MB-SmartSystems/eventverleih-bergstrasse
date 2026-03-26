import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Gallery from "@/components/Gallery";
import Sortiment from "@/components/Sortiment";
import Ablauf from "@/components/Ablauf";
import FAQ from "@/components/FAQ";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
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
    </>
  );
}
