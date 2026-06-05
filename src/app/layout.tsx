import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/components/CartContext";
import CartDrawer from "@/components/CartDrawer";
import Analytics from "@/components/Analytics";

export const metadata: Metadata = {
  title: "Eventverleih Bergstraße – Zelte, Tische, Stühle & Beleuchtung mieten",
  description:
    "Partyzelte, Tische, Stühle & Beleuchtung an der Bergstraße mieten – transparente Preise online, direkt anfragen, Lieferung oder Abholung möglich.",
  keywords: [
    "Eventverleih",
    "Zeltverleih",
    "Bergstraße",
    "Partyzelt mieten",
    "Eventausstattung",
    "Tische und Stühle mieten",
    "Alsbach-Hähnlein",
  ],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Eventverleih",
  },
  openGraph: {
    title: "Eventverleih Bergstraße – Zelte, Tische, Stühle & Beleuchtung mieten",
    description:
      "Partyzelte, Tische, Stühle & Beleuchtung an der Bergstraße mieten – transparente Preise online, Lieferung oder Abholung möglich.",
    url: "https://eventverleih-bergstrasse.de",
    siteName: "Eventverleih Bergstraße",
    locale: "de_DE",
    type: "website",
  },
};

// Static Schema.org JSON-LD — hardcoded business data, no user input involved
const schemaOrgJsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Eventverleih Bergstraße",
  url: "https://eventverleih-bergstrasse.de",
  telephone: "+4915679521124",
  email: "info@eventverleih-bergstrasse.de",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Schlesierstraße 19a",
    addressLocality: "Alsbach-Hähnlein",
    postalCode: "64665",
    addressCountry: "DE",
  },
  areaServed: "Bergstraße und Umgebung",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body>
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: schemaOrgJsonLd }}
        />
        <Analytics />
        <CartProvider>
          {children}
          <CartDrawer />
        </CartProvider>
      </body>
    </html>
  );
}
