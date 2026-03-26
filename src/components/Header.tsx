"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

const navItems = [
  { label: "Start", href: "#start" },
  { label: "Sortiment", href: "#sortiment" },
  { label: "Ablauf", href: "#ablauf" },
  { label: "FAQ", href: "#faq" },
  { label: "Kontakt", href: "#kontakt" },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-navy-900/80 backdrop-blur-md border-b border-white/5">
      <div className="container-width flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16 md:h-20">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/images/logo-white.png"
            alt="Eventverleih Bergstraße"
            width={160}
            height={40}
            className="h-8 md:h-10 w-auto"
          />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm text-gray-300 hover:text-gold-400 transition-colors"
            >
              {item.label}
            </a>
          ))}
          <a
            href="#kontakt"
            className="px-5 py-2.5 bg-gradient-to-r from-gold-500 to-gold-600 text-navy-900 font-semibold text-sm rounded-lg hover:from-gold-400 hover:to-gold-500 transition-all"
          >
            Anfrage senden
          </a>
        </nav>

        {/* Mobile Toggle */}
        <button
          className="md:hidden text-white p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Menü"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {mobileOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <nav className="md:hidden bg-navy-800 border-t border-white/5 px-4 py-4 space-y-3">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="block text-gray-300 hover:text-gold-400 transition-colors py-2"
              onClick={() => setMobileOpen(false)}
            >
              {item.label}
            </a>
          ))}
          <a
            href="#kontakt"
            className="block text-center px-5 py-2.5 bg-gradient-to-r from-gold-500 to-gold-600 text-navy-900 font-semibold text-sm rounded-lg mt-3"
            onClick={() => setMobileOpen(false)}
          >
            Anfrage senden
          </a>
        </nav>
      )}
    </header>
  );
}
