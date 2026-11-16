/**
 * Calculs monétaires rationnels : une fraction conserve toute la précision,
 * même quand une conversion produit une infinité de décimales.
 * Les API stockent ces fractions en base ; seules les présentations sont tronquées.
 */
import type { CurrencyCode } from "./money";

export interface ExactMoney {
  numerator: bigint;
  denominator: bigint;
}

const ZERO = BigInt(0);
const ONE = BigInt(1);
const TEN = BigInt(10);

function gcd(a: bigint, b: bigint): bigint {
  a = a < ZERO ? -a : a;
  b = b < ZERO ? -b : b;
  while (b !== ZERO) [a, b] = [b, a % b];
  return a;
}

export function fraction(numerator: bigint, denominator: bigint = ONE): ExactMoney {
  if (denominator === ZERO) throw new Error("Division par zéro");
  if (denominator < ZERO) { numerator = -numerator; denominator = -denominator; }
  const divisor = gcd(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

/** Lit une chaîne décimale sans passer par un nombre flottant. */
export function decimalFraction(value: string): ExactMoney {
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match) throw new Error("Montant décimal invalide");
  const digits = match[3] ?? "";
  const numerator = BigInt(match[2] + digits) * (match[1] === "-" ? -ONE : ONE);
  return fraction(numerator, TEN ** BigInt(digits.length));
}

export function addExact(a: ExactMoney, b: ExactMoney): ExactMoney {
  return fraction(a.numerator * b.denominator + b.numerator * a.denominator, a.denominator * b.denominator);
}

export function subtractExact(a: ExactMoney, b: ExactMoney): ExactMoney {
  return fraction(a.numerator * b.denominator - b.numerator * a.denominator, a.denominator * b.denominator);
}

export function multiplyExact(a: ExactMoney, b: ExactMoney): ExactMoney {
  return fraction(a.numerator * b.numerator, a.denominator * b.denominator);
}

export function divideExact(a: ExactMoney, b: ExactMoney): ExactMoney {
  return fraction(a.numerator * b.denominator, a.denominator * b.numerator);
}

/** Taux écrits en décimal : jamais convertis en flottants avant le calcul. */
const EXACT_RATES: Record<CurrencyCode, string> = {
  USD: "1", EUR: "0.92", XOF: "603.48044", GBP: "0.79", NGN: "1530", GHS: "15.2",
};

/** Convertit une somme de la devise vers USD en gardant la fraction exacte. */
export function exactToUsd(amount: ExactMoney, currency: CurrencyCode): ExactMoney {
  return divideExact(amount, decimalFraction(EXACT_RATES[currency]));
}

/** Convertit une fraction USD vers la devise sans arrondir. */
export function exactFromUsd(amount: ExactMoney, currency: CurrencyCode): ExactMoney {
  return multiplyExact(amount, decimalFraction(EXACT_RATES[currency]));
}

/** Pour l'affichage seulement : coupe vers zéro, sans modifier la fraction. */
export function truncateExact(value: ExactMoney, decimals: number): string {
  if (!Number.isSafeInteger(decimals) || decimals < 0 || decimals > 100) throw new Error("Précision invalide");
  const scale = TEN ** BigInt(decimals);
  const units = value.numerator * scale / value.denominator;
  const negative = units < ZERO;
  const digits = (negative ? -units : units).toString().padStart(decimals + 1, "0");
  const result = decimals ? `${digits.slice(0, -decimals)}.${digits.slice(-decimals)}` : digits;
  return `${negative ? "-" : ""}${result}`;
}
