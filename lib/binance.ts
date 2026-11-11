import { isInterval, isSymbol, type Interval, type SymbolId } from "./symbols";

/**
 * Accès aux vrais prix Binance (données publiques de marché).
 * On essaie plusieurs hôtes publics pour être robuste selon les régions.
 */
const HOSTS = [
  "https://data-api.binance.vision",
  "https://api.binance.com",
  "https://api.binance.us",
];

export interface Candle {
  /** Horodatage UNIX en secondes (ouverture de la bougie) */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export class BinanceError extends Error {
  constructor(message = "Prix temporairement indisponibles. Réessayez dans quelques secondes.") {
    super(message);
    this.name = "BinanceError";
  }
}

async function fetchFromHosts(path: string, timeoutMs = 8000): Promise<Response> {
  let lastError: unknown = null;
  for (const host of HOSTS) {
    try {
      const res = await fetch(`${host}${path}`, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (res.ok) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new BinanceError();
}

/** Prix actuel d'un actif (prix serveur, utilisé pour ouvrir et clôturer). */
export async function getPrice(symbol: SymbolId): Promise<number> {
  try {
    const res = await fetchFromHosts(`/api/v3/ticker/price?symbol=${symbol}`);
    const json = (await res.json()) as { price?: string };
    const price = Number(json.price);
    if (!Number.isFinite(price) || price <= 0) throw new BinanceError();
    return price;
  } catch {
    throw new BinanceError();
  }
}

/** Bougies (klines) pour le graphique. */
export async function getKlines(
  symbol: SymbolId,
  interval: Interval = "1m",
  limit = 200
): Promise<Candle[]> {
  const safeLimit = Math.min(Math.max(Math.floor(limit) || 200, 10), 500);
  try {
    const res = await fetchFromHosts(
      `/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${safeLimit}`
    );
    const json = (await res.json()) as unknown;
    if (!Array.isArray(json)) throw new BinanceError();
    return (json as Array<Array<string | number>>)
      .map((k) => ({
        time: Math.floor(Number(k[0]) / 1000),
        open: Number(k[1]),
        high: Number(k[2]),
        low: Number(k[3]),
        close: Number(k[4]),
        volume: Number(k[5]),
      }))
      .filter(
        (c) =>
          Number.isFinite(c.time) &&
          Number.isFinite(c.open) &&
          Number.isFinite(c.high) &&
          Number.isFinite(c.low) &&
          Number.isFinite(c.close)
      );
  } catch (err) {
    if (err instanceof BinanceError) throw err;
    throw new BinanceError();
  }
}

export { isInterval, isSymbol };
export type { Interval, SymbolId };
