import type { Candle } from "./binance";
import type { Interval } from "./symbols";

/**
 * Vrais cours des actions américaines (Yahoo Finance, données publiques).
 * La Bourse est fermée le soir et le week-end : le prix affiché est alors
 * le dernier cours réel (la clôture), jamais un prix inventé.
 */
const HOSTS = [
  "https://query1.finance.yahoo.com",
  "https://query2.finance.yahoo.com",
];

export class StockError extends Error {
  constructor(message = "Cours temporairement indisponibles. Réessayez dans quelques secondes.") {
    super(message);
    this.name = "StockError";
  }
}

const RANGE: Record<Interval, { interval: string; range: string }> = {
  "1m": { interval: "1m", range: "1d" },
  "5m": { interval: "5m", range: "5d" },
  "15m": { interval: "15m", range: "1mo" },
};

interface YahooChart {
  chart?: {
    result?: Array<{
      meta?: { regularMarketPrice?: number };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
          close?: (number | null)[];
          volume?: (number | null)[];
        }>;
      };
    }>;
    error?: unknown;
  };
}

async function fetchChart(symbol: string, interval: Interval): Promise<YahooChart> {
  const { interval: yInterval, range } = RANGE[interval];
  const path = `/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${yInterval}&range=${range}`;
  let lastError: unknown = null;
  for (const host of HOSTS) {
    try {
      const res = await fetch(`${host}${path}`, {
        signal: AbortSignal.timeout(8000),
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; TradeFacile/1.0)",
        },
        cache: "no-store",
      });
      if (res.ok) return (await res.json()) as YahooChart;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new StockError();
}

/**
 * Nettoie les bougies Yahoo : le flux contient parfois de fausses impressions
 * (une bougie à un prix absurde) qui écrasent l'échelle du graphique.
 * Sont supprimées : les bougies corrompues (prix absents, négatifs ou
 * incohérents), les doublons, et celles qui s'écartent de plus de moitié
 * de la clôture médiane (aucun vrai mouvement n'est aussi violent).
 */
export function cleanCandles(raw: Candle[]): Candle[] {
  const sane: Candle[] = [];
  const seen = new Set<number>();
  for (const c of raw) {
    if (
      !Number.isFinite(c.time) ||
      c.time <= 0 ||
      !Number.isFinite(c.open) ||
      !Number.isFinite(c.high) ||
      !Number.isFinite(c.low) ||
      !Number.isFinite(c.close) ||
      c.open <= 0 ||
      c.high <= 0 ||
      c.low <= 0 ||
      c.close <= 0 ||
      c.high < c.low ||
      c.high < c.open ||
      c.high < c.close ||
      c.low > c.open ||
      c.low > c.close ||
      seen.has(c.time)
    ) {
      continue;
    }
    seen.add(c.time);
    sane.push(c);
  }
  if (sane.length >= 5) {
    const closes = sane.map((c) => c.close).sort((a, b) => a - b);
    const median = closes[Math.floor(closes.length / 2)];
    return sane.filter((c) => c.high <= median * 2 && c.low >= median * 0.5);
  }
  return sane;
}

/** Dernier cours réel d'une action (ou la clôture si la Bourse est fermée). */
export async function getStockPrice(symbol: string): Promise<number> {
  try {
    const json = await fetchChart(symbol, "1m");
    const result = json.chart?.result?.[0];
    const fromMeta = Number(result?.meta?.regularMarketPrice);
    if (Number.isFinite(fromMeta) && fromMeta > 0) return fromMeta;
    // Secours : dernière clôture des bougies.
    const closes = result?.indicators?.quote?.[0]?.close ?? [];
    for (let i = closes.length - 1; i >= 0; i--) {
      const c = Number(closes[i]);
      if (Number.isFinite(c) && c > 0) return c;
    }
    throw new StockError();
  } catch (err) {
    if (err instanceof StockError) throw err;
    throw new StockError();
  }
}

/** Bougies d'une action, même format que les bougies crypto. */
export async function getStockCandles(
  symbol: string,
  interval: Interval = "1m",
  limit = 200
): Promise<Candle[]> {
  const safeLimit = Math.min(Math.max(Math.floor(limit) || 200, 10), 500);
  const json = await fetchChart(symbol, interval).catch(() => {
    throw new StockError();
  });
  const result = json.chart?.result?.[0];
  const times = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];
  if (!quote) throw new StockError();

  const raw: Candle[] = [];
  for (let i = 0; i < times.length; i++) {
    raw.push({
      time: Number(times[i]),
      open: Number(quote.open?.[i]),
      high: Number(quote.high?.[i]),
      low: Number(quote.low?.[i]),
      close: Number(quote.close?.[i]),
      volume: Number(quote.volume?.[i] ?? 0),
    });
  }
  const candles = cleanCandles(raw);
  if (candles.length === 0) throw new StockError();
  return candles.slice(-safeLimit);
}
