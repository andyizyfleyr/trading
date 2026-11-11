import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        fond: "#0B1020",
        carte: "#131A2E",
        ligne: "#1E2A44",
        texte: "#E5E7EB",
        doux: "#9CA3AF",
        hausse: "#22C55E",
        baisse: "#EF4444",
        action: "#3B82F6",
        /** Bleu bouton : texte blanc dessus ≥ 4,5:1 (WCAG AA). */
        primary: "#2563EB",
        /** Rouge VENTE : texte blanc dessus ≥ 4,5:1 (WCAG AA). */
        vente: "#DC2626",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
