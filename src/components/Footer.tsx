import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-navy-900">
      <div className="container-width section-padding py-12 md:py-16">
        <div className="grid md:grid-cols-3 gap-10">
          {/* Brand */}
          <div>
            <Image
              src="/images/logo-white.png"
              alt="Eventverleih Bergstraße"
              width={180}
              height={45}
              className="h-16 md:h-20 w-auto mb-4"
            />
            <p className="text-gray-400 text-sm leading-relaxed mb-3">
              Zelte & Eventausstattung an der Bergstraße und Umgebung
            </p>
            <p className="text-gray-500 text-sm">
              Schlesierstraße 19a, 64665 Alsbach-Hähnlein
            </p>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white font-semibold mb-4">Kontakt</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="tel:+4915679521124"
                  className="text-gray-400 hover:text-gold-400 transition-colors"
                >
                  Telefon: +49 156 79521124
                </a>
              </li>
              <li>
                <a
                  href="mailto:info@eventverleih-bergstrasse.de"
                  className="text-gray-400 hover:text-gold-400 transition-colors"
                >
                  E-Mail: info@eventverleih-bergstrasse.de
                </a>
              </li>
              <li>
                <a
                  href="https://wa.me/4915679521124"
                  className="text-gray-400 hover:text-gold-400 transition-colors"
                >
                  WhatsApp: +49 156 79521124
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-white font-semibold mb-4">Rechtliches</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/impressum"
                  className="text-gray-400 hover:text-gold-400 transition-colors"
                >
                  Impressum
                </Link>
              </li>
              <li>
                <Link
                  href="/datenschutz"
                  className="text-gray-400 hover:text-gold-400 transition-colors"
                >
                  Datenschutz
                </Link>
              </li>
              <li>
                <Link
                  href="/agbs"
                  className="text-gray-400 hover:text-gold-400 transition-colors"
                >
                  AGB
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/5 mt-10 pt-8 text-center">
          <p className="text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} Eventverleih Bergstraße. Alle
            Rechte vorbehalten.
          </p>
        </div>
      </div>
    </footer>
  );
}
