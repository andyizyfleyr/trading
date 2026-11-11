import type { Candle } from "./binance";
import type { Interval } from "./symbols";

/**
 * Prix simulés des actifs maison OTC (euro/dollar, livre/dollar, dollar/yen).
 * Équité garantie par construction : le prix ne dépend que de l'actif et de
 * la seconde (fonction déterministe), donc tout le monde voit le même prix
 * à la même seconde, à l'ouverture comme à la clôture. Personne ne peut le
 * modifier au cas par cas, pas même le serveur.
 */
const ASSETS: Record<string, { base: number; decimals: number; waveSeed: number }> = {
  EURUSDOTC: { base: 1.085, decimals: 5, waveSeed: 11 },
  GBPUSDOTC: { base: 1.27, decimals: 5, waveSeed: 47 },
  USDJPYOTC: { base: 155, decimals: 3, waveSeed: 83 },
};

const BUCKET: Record<Interval, number> = { "1m": 60, "5m": 300, "15m": 900 };

export class OtcError extends Error {
  constructor(message = "Actif OTC inconnu.") {
    super(message);
    this.name = "OtcError";
  }
}

/** Hachage FNV-1a → nombre entre 0 (inclus) et 1 (exclu), stable partout. */
function hash01(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0x100000000;
}

/**
 * Prix simulé d'un actif OTC à une seconde donnée.
 * Mélange de vagues lentes (tendance) et de petits mouvements imprévisibles
 * à chaque seconde, calibré comme le vrai marché des devises.
 */
export function otcPriceAt(symbol: string, sec: number): number {
  const cfg = ASSETS[symbol];
  if (!cfg) throw new OtcError();
  const s = Math.floor(sec);
  const seed = cfg.waveSeed;
  // Tendance : deux vagues lentes décalées par actif (±0,15 % et ±0,08 %).
  const trend =
    0.0015 * Math.sin((2 * Math.PI * s) / (2700 + seed * 37) + seed) +
    0.0008 * Math.sin((2 * Math.PI * s) / (720 + seed * 13) + seed * 2);
  // Mouvement de la seconde : ±0,03 %, imprévisible mais déterministe.
  const noise = (hash01(`${symbol}:${s}`) - 0.5) * 0.0006;
  const price = cfg.base * (1 + trend + noise);
  const factor = 10 ** cfg.decimals;
  return Math.round(price * factor) / factor;
}

/** Prix OTC actuel (prix serveur, utilisé pour ouvrir et clôturer). */
export async function getOtcPrice(symbol: string): Promise<number> {
  return otcPriceAt(symbol, Date.now() / 1000);
}

/** Bougies OTC, même format que les bougies crypto et actions. */
export async function getOtcCandles(
  symbol: string,
  interval: Interval = "1m",
  limit = 200
): Promise<Candle[]> {
  if (!ASSETS[symbol]) throw new OtcError();
  const safeLimit = Math.min(Math.max(Math.floor(limit) || 200, 10), 500);
  const len = BUCKET[interval];
  const step = Math.max(1, Math.floor(len / 12));
  const now = Math.floor(Date.now() / 1000);
  const lastStart = Math.floor(now / len) * len;

  const candles: Candle[] = [];
  for (let i = safeLimit - 1; i >= 0; i--) {
    const start = lastStart - i * len;
    const open = otcPriceAt(symbol, start);
    const close = otcPriceAt(symbol, start + len - 1);
    let high = Math.max(open, close);
    let low = Math.min(open, close);
    for (let t = start; t < start + len; t += step) {
      const p = otcPriceAt(symbol, t);
      if (p > high) high = p;
      if (p < low) low = p;
    }
    candles.push({
      time: start,
      open,
      high,
      low,
      close,
      volume: 50 + Math.floor(hash01(`${symbol}:v:${start}`) * 450),
    });
  }
  return candles;
}
