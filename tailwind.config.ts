import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        fond: "#0A0F1E",
        carte: "#121A2E",
        ligne: "#222D4A",
        texte: "#E8EDF8",
        doux: "#7F8CAB",
        hausse: "#22C55E",
        baisse: "#EF4444",
        action: "#3B82F6",
        /** Bleu bouton : texte blanc dessus ≥ 4,5:1 (WCAG AA). */
        primary: "#2F66F0",
        /** Rouge VENTE : texte blanc dessus ≥ 4,5:1 (WCAG AA). */
        vente: "#DC2626",
        /** Fond des pastilles non sélectionnées. */
        puce: "#1A2440",
        /** Badge JEU : texte clair sur fond bleu nuit. */
        tag: "#7AA2FF",
        tagfond: "#16275A",
        /** Texte sombre sur bouton vert (contraste ≥ 4,5:1). */
        vertfonce: "#06210F",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
