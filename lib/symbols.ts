/** Actifs disponibles : vrais prix Binance, jamais de faux prix "OTC". */
export const SYMBOLS = [
  { id: "BTCUSDT", base: "BTC", name: "Bitcoin", color: "#F7931A" },
  { id: "ETHUSDT", base: "ETH", name: "Ethereum", color: "#8A9CFF" },
  { id: "BNBUSDT", base: "BNB", name: "BNB", color: "#F0B90B" },
  { id: "SOLUSDT", base: "SOL", name: "Solana", color: "#14F195" },
  { id: "XRPUSDT", base: "XRP", name: "XRP", color: "#4AA8E0" },
  { id: "DOGEUSDT", base: "DOGE", name: "Dogecoin", color: "#D3BE5D" },
] as const;

export type SymbolId = (typeof SYMBOLS)[number]["id"];

export const SYMBOL_IDS = new Set<string>(SYMBOLS.map((s) => s.id));

export function isSymbol(v: unknown): v is SymbolId {
  return typeof v === "string" && SYMBOL_IDS.has(v);
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
  /** Mise minimum */
  MIN_BET: 10,
  /** Mise maximum = 10 % du solde */
  MAX_BET_RATIO: 0.1,
  /** Gain en cas de bonne prédiction : mise + 85 % */
  WIN_PAYOUT_RATIO: 0.85,
  /** Limite : 20 prédictions par minute et par utilisateur */
  MAX_TRADES_PER_MINUTE: 20,
} as const;
