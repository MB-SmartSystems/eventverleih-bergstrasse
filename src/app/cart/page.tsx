import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartPage from "@/components/CartPage";

export const metadata: Metadata = {
  title: "Warenkorb — Eventverleih Bergstraße",
  description:
    "Übersicht Ihrer Wunsch-Artikel. Mietpreis, Kaution und optionaler Aufbau transparent vorab kalkuliert. Anfrage unverbindlich.",
  robots: { index: false, follow: true },
};

export default function CartRoute() {
  return (
    <>
      <Header />
      <main className="pt-24 md:pt-28 min-h-[60vh]">
        <CartPage />
      </main>
      <Footer />
    </>
  );
}
