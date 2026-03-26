"use client";

import { useCart } from "./CartContext";

export default function CartBar() {
  const { items, totalItems, removeItem, updateQuantity } = useCart();

  if (totalItems === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-navy-800/95 backdrop-blur-md border-t border-gold-500/20 shadow-lg shadow-black/20">
      <div className="container-width px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Item summary */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <svg
                className="w-5 h-5 text-gold-400 flex-shrink-0"
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
              <span className="text-white font-semibold text-sm">
                {totalItems} {totalItems === 1 ? "Artikel" : "Artikel"} ausgewählt
              </span>
            </div>
            <p className="text-gray-400 text-xs truncate hidden sm:block">
              {items.map((i) => `${i.quantity}x ${i.name}`).join(", ")}
            </p>
          </div>

          {/* CTA */}
          <a
            href="#kontakt"
            className="flex-shrink-0 px-6 py-2.5 bg-gradient-to-r from-gold-500 to-gold-600 text-navy-900 font-semibold text-sm rounded-lg hover:from-gold-400 hover:to-gold-500 transition-all"
          >
            Anfrage senden
          </a>
        </div>
      </div>
    </div>
  );
}
