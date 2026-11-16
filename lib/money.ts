/**
 * Devises et pays (affichage uniquement : TOUT est stocké en USD en base,
 * 1 unité = 1 $. On ne convertit qu'au moment d'afficher).
 * Symbole APRÈS le montant, style 1xBet : « 1 000 ₣ », « 9,20 € ».
 */
import Decimal from "decimal.js";
import type { Lang } from "./i18n";
import { exactFromUsd, fraction, truncateExact } from "./exact-money";
import type { ApiExactMoney } from "./types";

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

/** Convertit pour préremplir un champ, en coupant les décimales non affichées. */
export function convertUsd(usd: number, currency: CurrencyCode): number {
  const info = CURRENCIES[currency];
  return new Decimal(usd).mul(info.perUsd).toDecimalPlaces(info.decimals, Decimal.ROUND_DOWN).toNumber();
}

/**
 * Convertit un montant tapé dans la devise vers des dollars (champ de
 * mise → contrôles locaux). L'envoi conserve la fraction exacte séparément.
 */
export function convertToUsd(amount: number, currency: CurrencyCode): number {
  return Number(amount) / CURRENCIES[currency].perUsd;
}

/** Coupe à la précision du champ (boutons − / +), sans arrondir. */
export function roundCurrency(value: number, currency: CurrencyCode): number {
  return new Decimal(value).toDecimalPlaces(CURRENCIES[currency].decimals, Decimal.ROUND_DOWN).toNumber();
}

/** Gain théorique dans l'unité saisie, sans arrondir en USD entre les calculs. */
export function potentialPayout(amount: number | null, ratio: number): number {
  // Les nombres binaires peuvent transformer 1,85 × 1000 en 1849,999….
  return amount != null && amount > 0 ? new Decimal(amount).mul(new Decimal(1).plus(ratio)).toNumber() : 0;
}

/** Formate un montant déjà exprimé dans la devise, sans nouvelle conversion. */
export function formatCurrency(amount: number, currency: CurrencyCode, lang: Lang = "fr"): string {
  const info = CURRENCIES[currency];
  // Couper vers zéro plutôt qu'arrondir ; Decimal évite les erreurs binaires.
  const visible = new Decimal(amount).toDecimalPlaces(info.decimals, Decimal.ROUND_DOWN).toNumber();
  return `${numFmt(info.decimals, lang).format(visible)} ${info.symbol}`;
}

/** Affiche une fraction USD exacte sans convertir les chiffres en flottants. */
export function formatExactMoney(value: ApiExactMoney, currency: CurrencyCode, lang: Lang = "fr"): string {
  const info = CURRENCIES[currency];
  const amount = exactFromUsd(fraction(BigInt(value.numerator), BigInt(value.denominator)), currency);
  const digits = truncateExact(amount, info.decimals);
  const [integer, decimal] = digits.split(".");
  const negative = integer.startsWith("-");
  const whole = BigInt(negative ? integer.slice(1) : integer);
  const grouped = new Intl.NumberFormat(LOCALES[lang] ?? LOCALES.fr, { maximumFractionDigits: 0 }).format(whole);
  const separator = (1.1).toLocaleString(LOCALES[lang] ?? LOCALES.fr).replace(/\d/g, "");
  return `${negative ? "-" : ""}${grouped}${decimal === undefined ? "" : separator + decimal} ${info.symbol}`;
}

/**
 * Formate un montant USD dans la devise : « 1 000 ₣ », « 9,20 € »
 * (ponctuation selon la langue : « 1,000 ₣ » en anglais).
 * Les PRIX des jeux/marchés ne passent JAMAIS ici (fmtGamePrice).
 */
export function formatMoney(usd: number, currency: CurrencyCode, lang: Lang = "fr"): string {
  // Ne pas arrondir en USD ou lors de la conversion avant l'affichage.
  return formatCurrency(new Decimal(usd).mul(CURRENCIES[currency].perUsd).toNumber(), currency, lang);
}
