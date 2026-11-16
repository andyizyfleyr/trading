import type { Config } from "tailwindcss";

/** Palette Quotex sombre/clair pilotée par variables CSS RGB (supporte /opacité). */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        fond: "rgb(var(--c-fond) / <alpha-value>)",
        carte: "rgb(var(--c-carte) / <alpha-value>)",
        ligne: "rgb(var(--c-ligne) / <alpha-value>)",
        texte: "rgb(var(--c-texte) / <alpha-value>)",
        doux: "rgb(var(--c-doux) / <alpha-value>)",
        hausse: "rgb(var(--c-hausse) / <alpha-value>)",
        baisse: "rgb(var(--c-baisse) / <alpha-value>)",
        action: "rgb(var(--c-action) / <alpha-value>)",
        /** Bleu sélection (onglets, pastilles actives). */
        primary: "rgb(var(--c-primary) / <alpha-value>)",
        /** Rouge VENTE. */
        vente: "rgb(var(--c-vente) / <alpha-value>)",
        /** Fond des pastilles non sélectionnées. */
        puce: "rgb(var(--c-puce) / <alpha-value>)",
        /** Badge JEU : texte contrasté sur fond bleu léger. */
        tag: "rgb(var(--c-tag) / <alpha-value>)",
        tagfond: "rgb(var(--c-tagfond) / <alpha-value>)",
        /** Texte sombre sur pastille verte (contraste ≥ 4,5:1). */
        vertfonce: "rgb(var(--c-vertfonce) / <alpha-value>)",
        /** Pourcentage de gain (ex. « 85 % » orange). */
        payout: "rgb(var(--c-payout) / <alpha-value>)",
        /** Bordure des champs (Minuteur, Investissement). */
        cadre: "rgb(var(--c-cadre) / <alpha-value>)",
        /** Pastilles de la grille horaire (durées, heures). */
        grille: "rgb(var(--c-grille) / <alpha-value>)",
        /** Onglet inactif du panneau Minuteur/Temps. */
        onglet: "rgb(var(--c-onglet) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
