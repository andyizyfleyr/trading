/** Types partagés entre le client web et les API JSON. */

export interface ApiExactMoney { numerator: string; denominator: string }

export interface ApiUser {
  id: number;
  email: string;
  balance: number;
  balanceExact?: ApiExactMoney;
  /** Devise d'affichage (USD, EUR, XOF…) — tout est stocké en USD. */
  currency: string;
  /** Pays (code : BJ, FR…) ou null si non choisi. */
  country: string | null;
  /** Langue (fr/en/es). */
  lang: string;
  createdAt: string;
}

export type TradeDirection = "UP" | "DOWN";
export type TradeStatus = "OPEN" | "SETTLED";
export type TradeResult = "WIN" | "LOSS" | "TIE";

export interface ApiTrade {
  id: number;
  symbol: string;
  direction: TradeDirection;
  amount: number;
  amountExact?: ApiExactMoney;
  payoutExact?: ApiExactMoney | null;
  openPrice: number;
  closePrice: number | null;
  durationSec: number;
  status: TradeStatus;
  result: TradeResult | null;
  payout: number | null;
  openedAt: string;
  closesAt: string;
}

export interface ApiCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Jambe d'un combiné : comme une prédiction (VOID = annulée, combiné déjà perdu). */
export interface ApiComboLeg {
  id: number;
  symbol: string;
  direction: TradeDirection;
  openPrice: number;
  closePrice: number | null;
  durationSec: number;
  status: TradeStatus;
  result: TradeResult | "VOID" | null;
  openedAt: string;
  closesAt: string;
}

/** Combiné : une mise, 2 à 5 jambes, toutes doivent gagner. */
export interface ApiCombo {
  id: number;
  amount: number;
  amountExact?: ApiExactMoney;
  payoutExact?: ApiExactMoney | null;
  status: TradeStatus;
  result: TradeResult | null;
  payout: number | null;
  createdAt: string;
  legs: ApiComboLeg[];
}

/** Statistiques globales (tous les trades, jamais tronquées). */
export interface ApiStats {
  settled: number;
  wins: number;
  losses: number;
  ties: number;
  winRate: number;
  pnl: number;
  pnlExact?: ApiExactMoney;
  rank: number;
  total: number;
}
