/** Types partagés entre le client web et les API JSON. */

export interface ApiUser {
  id: number;
  email: string;
  balance: number;
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

/** Statistiques globales (tous les trades, jamais tronquées). */
export interface ApiStats {
  settled: number;
  wins: number;
  losses: number;
  ties: number;
  winRate: number;
  pnl: number;
  rank: number;
  total: number;
}
