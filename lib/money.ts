/**
 * Devises et pays (affichage uniquement : TOUT est stocké en USD en base,
 * 1 unité = 1 $. On ne convertit qu'au moment d'afficher).
 * Symbole APRÈS le montant, style 1xBet : « 1 000 ₣ », « 9,20 € ».
 */
import type { Lang } from "./i18n";

/** Ponctuation des nombres selon la langue (1 000 / 1,000 / 1000). */
const LOCALES: Record<Lang, string> = { fr: "fr-FR", en: "en-US", es: "es-ES" };

export type CurrencyCode = "USD" | "EUR" | "XOF" | "GBP" | "NGN" | "GHS";

/** Devise de base (aussi le défaut des comptes). */
export const DEFAULT_CURRENCY: CurrencyCode = "USD";

/** Taux fixes : unités de la devise pour 1 $. À réviser s'ils dérivent. */
const EUR_PER_USD = 0.92;

interface CurrencyInfo {
  symbol: string;
  decimals: number;
  perUsd: number;
  label: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  USD: { symbol: "$", decimals: 2, perUsd: 1, label: "Dollar américain" },
  EUR: { symbol: "€", decimals: 2, perUsd: EUR_PER_USD, label: "Euro" },
  // Franc CFA BCEAO : parité FIXE avec l'euro (1 € = 655,957 ₣, UEMOA) :
  // dérivé du taux euro, jamais approximatif.
  XOF: { symbol: "₣", decimals: 0, perUsd: EUR_PER_USD * 655.957, label: "Franc CFA (UEMOA)" },
  GBP: { symbol: "£", decimals: 2, perUsd: 0.79, label: "Livre sterling" },
  // Monnaies flottantes : taux fixes à réviser quand le marché dérive.
  NGN: { symbol: "₦", decimals: 0, perUsd: 1530, label: "Naira" },
  GHS: { symbol: "₵", decimals: 0, perUsd: 15.2, label: "Cedi" },
};

export function isCurrency(v: unknown): v is CurrencyCode {
  return typeof v === "string" && v in CURRENCIES;
}

/** Pays proposés : choisir un pays règle sa devise. */
export const COUNTRIES: { code: string; name: string; currency: CurrencyCode }[] = [
  { code: "BJ", name: "Bénin", currency: "XOF" },
  { code: "BF", name: "Burkina Faso", currency: "XOF" },
  { code: "CI", name: "Côte d'Ivoire", currency: "XOF" },
  { code: "GW", name: "Guinée-Bissau", currency: "XOF" },
  { code: "ML", name: "Mali", currency: "XOF" },
  { code: "NE", name: "Niger", currency: "XOF" },
  { code: "SN", name: "Sénégal", currency: "XOF" },
  { code: "TG", name: "Togo", currency: "XOF" },
  { code: "NG", name: "Nigeria", currency: "NGN" },
  { code: "GH", name: "Ghana", currency: "GHS" },
  { code: "US", name: "États-Unis", currency: "USD" },
  { code: "FR", name: "France", currency: "EUR" },
  { code: "DE", name: "Allemagne", currency: "EUR" },
  { code: "BE", name: "Belgique", currency: "EUR" },
  { code: "ES", name: "Espagne", currency: "EUR" },
  { code: "IT", name: "Italie", currency: "EUR" },
  { code: "PT", name: "Portugal", currency: "EUR" },
  { code: "NL", name: "Pays-Bas", currency: "EUR" },
  { code: "EU", name: "Autre zone euro", currency: "EUR" },
  { code: "GB", name: "Royaume-Uni", currency: "GBP" },
];

/** Devise d'un pays (null si code inconnu). */
export function countryCurrency(code: unknown): CurrencyCode | null {
  if (typeof code !== "string") return null;
  return COUNTRIES.find((c) => c.code === code)?.currency ?? null;
}

const numFmtCache = new Map<string, Intl.NumberFormat>();

function numFmt(decimals: number, lang: Lang): Intl.NumberFormat {
  const key = `${lang}:${decimals}`;
  let fmt = numFmtCache.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(LOCALES[lang] ?? LOCALES.fr, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    numFmtCache.set(key, fmt);
  }
  return fmt;
}

/** Convertit des dollars vers la devise (arrondi à ses décimales). */
export function convertUsd(usd: number, currency: CurrencyCode): number {
  const info = CURRENCIES[currency];
  const f = 10 ** info.decimals;
  return Math.round(Number(usd) * info.perUsd * f) / f;
}

/**
 * Convertit un montant tapé dans la devise vers des dollars (champ de
 * mise → API). Arrondi aux centimes : la base stocke des USD à 2 décimales.
 */
export function convertToUsd(amount: number, currency: CurrencyCode): number {
  const usd = Number(amount) / CURRENCIES[currency].perUsd;
  return Math.round(usd * 100) / 100;
}

/** Arrondit à la précision d'affichage de la devise (boutons − / +). */
export function roundCurrency(value: number, currency: CurrencyCode): number {
  const f = 10 ** CURRENCIES[currency].decimals;
  return Math.round(Number(value) * f) / f;
}

/**
 * Formate un montant USD dans la devise : « 1 000 ₣ », « 9,20 € »
 * (ponctuation selon la langue : « 1,000 ₣ » en anglais).
 * Les PRIX des jeux/marchés ne passent JAMAIS ici (fmtGamePrice).
 */
export function formatMoney(usd: number, currency: CurrencyCode, lang: Lang = "fr"): string {
  const info = CURRENCIES[currency];
  return `${numFmt(info.decimals, lang).format(convertUsd(usd, currency))} ${info.symbol}`;
}
