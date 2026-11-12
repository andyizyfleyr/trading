/**
 * Jeux proposés : prix simulés maison, 100 % hasard (badge JEU).
 * Les vrais actifs (cryptos, actions) ont été retirés du jeu :
 * chaque jeu s'affiche par son seul nom (Lucky 7, Jackpot, Turbo).
 */

/** Sortes d'actifs connues du moteur de prix (cryptos/actions : anciennes données seulement). */
export type SymbolKind = "crypto" | "stock" | "otc";

export const SYMBOLS = [
  { id: "EURUSDOTC", base: "Lucky 7", color: "#FBBF24", kind: "otc" as SymbolKind, decimals: 3 },
  { id: "GBPUSDOTC", base: "Jackpot", color: "#A78BFA", kind: "otc" as SymbolKind, decimals: 2 },
  { id: "USDJPYOTC", base: "Turbo", color: "#F472B6", kind: "otc" as SymbolKind, decimals: 2 },
] as const;

export type SymbolId = (typeof SYMBOLS)[number]["id"];

export const SYMBOL_IDS = new Set<string>(SYMBOLS.map((s) => s.id));

export function isSymbol(v: unknown): v is SymbolId {
  return typeof v === "string" && SYMBOL_IDS.has(v);
}

/** Vrai si l'actif est une action (plus aucun jeu proposé : anciennes données seulement). */
export function isStock(symbol: string): boolean {
  return SYMBOLS.find((s) => s.id === symbol)?.kind === "stock";
}

/** Vrai si l'actif est un jeu casino maison (100 % hasard). */
export function isOtc(symbol: string): boolean {
  return SYMBOLS.find((s) => s.id === symbol)?.kind === "otc";
}

/** Nom affiché du jeu : « Lucky 7 », « Jackpot » ou « Turbo ». */
export function symbolDisplay(symbol: string): string {
  const found = SYMBOLS.find((s) => s.id === symbol);
  if (!found) return symbol;
  return found.base;
}

/** Décimales affichées du prix (Lucky 7 : 3, Jackpot et Turbo : 2). */
export function symbolDecimals(symbol: string): number {
  return SYMBOLS.find((s) => s.id === symbol)?.decimals ?? 2;
}

/** Durées de prédiction autorisées (en secondes). */
export const DURATIONS = [3, 10, 30, 60, 300] as const;
export type DurationSec = (typeof DURATIONS)[number];

export function isDuration(v: unknown): v is DurationSec {
  return v === 3 || v === 10 || v === 30 || v === 60 || v === 300;
}

export function durationLabel(sec: number): string {
  if (sec === 3) return "3 s";
  if (sec === 10) return "10 s";
  if (sec === 30) return "30 s";
  if (sec === 60) return "1 min";
  if (sec === 300) return "5 min";
  return `${sec} s`;
}

/** Intervalles de bougies autorisés pour le graphique. */
export const INTERVALS = ["1m", "5m", "15m"] as const;
export type Interval = (typeof INTERVALS)[number];

export function isInterval(v: unknown): v is Interval {
  return v === "1m" || v === "5m" || v === "15m";
}

/** Règles du jeu (rappelées ici, appliquées côté serveur uniquement). */
export const RULES = {
  /** Solde de départ */
  START_BALANCE: 10000,
  /** Mise minimum (pas de plafond : jusqu'à tout le solde) */
  MIN_BET: 10,
  /** Gain en cas de bonne prédiction : mise + 85 % */
  WIN_PAYOUT_RATIO: 0.85,
  /** Limite : 20 prédictions par minute et par utilisateur */
  MAX_TRADES_PER_MINUTE: 20,
  /** Limite : 50 mises programmées maximum par utilisateur */
  MAX_SCHEDULED: 50,
} as const;
