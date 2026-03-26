import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Eventverleih Bergstraße — Zelte & Eventausstattung für Ihre Feste",
  description:
    "Zelte, Tische, Stühle, Beleuchtung und Eventausstattung mieten an der Bergstraße. Zuverlässig, transparent und regional. Jetzt Anfrage senden.",
  keywords: [
    "Eventverleih",
    "Zeltverleih",
    "Bergstraße",
    "Partyzelt mieten",
    "Eventausstattung",
    "Tische und Stühle mieten",
    "Alsbach-Hähnlein",
  ],
  openGraph: {
    title: "Eventverleih Bergstraße — Zelte & Eventausstattung",
    description:
      "Zelte, Tische, Stühle und mehr für Ihre Feste und Feiern an der Bergstraße.",
    url: "https://eventverleih-bergstrasse.de",
    siteName: "Eventverleih Bergstraße",
    locale: "de_DE",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
