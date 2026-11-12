import type { Config } from "tailwindcss";

/** Palette Quotex (échantillonnée sur les captures) : bleu nuit, vert/rouge vifs, bleu ciel. */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        fond: "#1C1F2E",
        carte: "#2A3040",
        ligne: "#3D4356",
        texte: "#F0F0F0",
        doux: "#8E93A7",
        hausse: "#0CAF56",
        baisse: "#E55D4F",
        action: "#2E99FB",
        /** Bleu sélection (onglets, pastilles actives). */
        primary: "#0270D1",
        /** Rouge VENTE. */
        vente: "#DC4633",
        /** Fond des pastilles non sélectionnées. */
        puce: "#424554",
        /** Badge JEU : texte clair sur fond bleu nuit. */
        tag: "#7AA2FF",
        tagfond: "#16275A",
        /** Texte sombre sur pastille verte (contraste ≥ 4,5:1). */
        vertfonce: "#06210F",
        /** Pourcentage de gain (ex. « 85 % » orange). */
        payout: "#E09038",
        /** Bordure des champs (Minuteur, Investissement). */
        cadre: "#4E5463",
        /** Pastilles de la grille horaire (durées, heures). */
        grille: "#474955",
        /** Onglet inactif du panneau Minuteur/Temps. */
        onglet: "#353A4D",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
