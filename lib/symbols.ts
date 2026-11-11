/**
 * Actifs disponibles : vrais prix de marché, jamais de faux prix "OTC".
 * - cryptos : prix Binance en direct ;
 * - actions : vrais cours de la Bourse américaine (Yahoo Finance).
 */
export const SYMBOLS = [
  { id: "BTCUSDT", base: "BTC", name: "Bitcoin", color: "#F7931A", kind: "crypto" },
  { id: "ETHUSDT", base: "ETH", name: "Ethereum", color: "#8A9CFF", kind: "crypto" },
  { id: "BNBUSDT", base: "BNB", name: "BNB", color: "#F0B90B", kind: "crypto" },
  { id: "SOLUSDT", base: "SOL", name: "Solana", color: "#14F195", kind: "crypto" },
  { id: "XRPUSDT", base: "XRP", name: "XRP", color: "#4AA8E0", kind: "crypto" },
  { id: "DOGEUSDT", base: "DOGE", name: "Dogecoin", color: "#D3BE5D", kind: "crypto" },
  { id: "ADAUSDT", base: "ADA", name: "Cardano", color: "#4A7DFF", kind: "crypto" },
  { id: "AVAXUSDT", base: "AVAX", name: "Avalanche", color: "#E84142", kind: "crypto" },
  { id: "LINKUSDT", base: "LINK", name: "Chainlink", color: "#8FB4FF", kind: "crypto" },
  { id: "TRXUSDT", base: "TRX", name: "Tron", color: "#FF6B6B", kind: "crypto" },
  { id: "AAPL", base: "AAPL", name: "Apple", color: "#D1D5DB", kind: "stock" },
  { id: "TSLA", base: "TSLA", name: "Tesla", color: "#E31937", kind: "stock" },
  { id: "NVDA", base: "NVDA", name: "NVIDIA", color: "#76B900", kind: "stock" },
  { id: "EURUSDOTC", base: "EUR/USD", name: "Euro / Dollar", color: "#60A5FA", kind: "otc" },
  { id: "GBPUSDOTC", base: "GBP/USD", name: "Livre / Dollar", color: "#A78BFA", kind: "otc" },
  { id: "USDJPYOTC", base: "USD/JPY", name: "Dollar / Yen", color: "#F472B6", kind: "otc" },
] as const;

export type SymbolId = (typeof SYMBOLS)[number]["id"];
export type SymbolKind = (typeof SYMBOLS)[number]["kind"];

export const SYMBOL_IDS = new Set<string>(SYMBOLS.map((s) => s.id));

export function isSymbol(v: unknown): v is SymbolId {
  return typeof v === "string" && SYMBOL_IDS.has(v);
}

/** Vrai si l'actif est une action (sinon c'est une crypto). */
export function isStock(symbol: string): boolean {
  return SYMBOLS.find((s) => s.id === symbol)?.kind === "stock";
}

/** Vrai si l'actif est un actif maison OTC (prix simulés). */
export function isOtc(symbol: string): boolean {
  return SYMBOLS.find((s) => s.id === symbol)?.kind === "otc";
}

/** Nom affiché : "BTC/USDT" pour les cryptos, "AAPL" et "EUR/USD" tels quels. */
export function symbolDisplay(symbol: string): string {
  const found = SYMBOLS.find((s) => s.id === symbol);
  if (!found) return symbol;
  return found.kind === "crypto" ? `${found.base}/USDT` : found.base;
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
} as const;
