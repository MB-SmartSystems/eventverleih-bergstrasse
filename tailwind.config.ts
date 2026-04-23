import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          900: "#0a0e17",
          800: "#0f1520",
          700: "#151d2e",
          600: "#1c2740",
        },
        gold: {
          400: "#e8c872",
          500: "#d4a853",
          600: "#c4943f",
        },
        // Admin UI (aus unikat-m portiert) — dunkel an Storefront angelehnt
        warm: {
          bg: "#0a0e17",
          surface: "#151d2e",
          text: "#e8e8e8",
          muted: "#9ca3af",
          border: "#1c2740",
        },
        accent: {
          DEFAULT: "#d4a853",
          dark: "#c4943f",
          light: "#3a2f1a",
          50: "#2a2214",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Playfair Display", "Georgia", "serif"],
        body: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
