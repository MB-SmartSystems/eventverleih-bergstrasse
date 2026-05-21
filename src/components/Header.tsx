"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "./CartContext";

const navItems = [
  { label: "Start", href: "/#start" },
  { label: "Sortiment", href: "/#sortiment" },
  { label: "Ablauf", href: "/#ablauf" },
  { label: "FAQ", href: "/#faq" },
  { label: "Kontakt", href: "/#kontakt" },
];

function CartIconButton({ onClick, label }: { onClick: () => void; label: string }) {
  const { totalItems, hydrated } = useCart();
  const showBadge = hydrated && totalItems > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="relative inline-flex items-center justify-center w-11 h-11 rounded-lg text-white hover:bg-white/10 transition-colors"
    >
      <svg
        className="w-6 h-6 text-gold-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
        />
      </svg>
      {showBadge && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[20px] h-5 px-1 rounded-full bg-gold-500 text-navy-900 text-[11px] font-bold flex items-center justify-center">
          {totalItems}
        </span>
      )}
    </button>
  );
}

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { openDrawer } = useCart();

  const handleCartClick = () => {
    setMobileOpen(false);
    openDrawer();
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-navy-900/80 backdrop-blur-md border-b border-white/5">
      <div className="container-width flex items-center justify-between px-4 sm:px-6 lg:px-8 h-20 md:h-24">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/images/logo-white.png"
            alt="Eventverleih Bergstraße"
            width={160}
            height={40}
            className="h-12 md:h-16 w-auto"
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
          <CartIconButton onClick={handleCartClick} label="Warenkorb öffnen" />
        </nav>

        {/* Mobile Right: Cart-Icon + Hamburger */}
        <div className="md:hidden flex items-center gap-1">
          <CartIconButton onClick={handleCartClick} label="Warenkorb öffnen" />
          <button
            className="text-white p-2"
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
        </nav>
      )}
    </header>
  );
}
