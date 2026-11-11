import type { Candle } from "./binance";
import type { Interval } from "./symbols";

/**
 * Jeux casino maison (Lucky 7, Jackpot, Turbo) : 100 % hasard, indépendants
 * des vrais marchés. Chaque jeu a son tempérament (doux, mouvementé, nerveux).
 * Équité garantie par construction : le prix ne dépend que du jeu et de
 * la seconde (fonction déterministe), donc tout le monde voit le même prix
 * à la même seconde, à l'ouverture comme à la clôture. Personne ne peut le
 * modifier au cas par cas, pas même le serveur.
 */
const GAMES: Record<
  string,
  { base: number; decimals: number; vol: number; waveSeed: number }
> = {
  EURUSDOTC: { base: 7.777, decimals: 3, vol: 1, waveSeed: 11 }, // Lucky 7 : doux
  GBPUSDOTC: { base: 1000, decimals: 2, vol: 2, waveSeed: 47 }, // Jackpot : mouvementé
  USDJPYOTC: { base: 100, decimals: 2, vol: 3.5, waveSeed: 83 }, // Turbo : nerveux
};

const BUCKET: Record<Interval, number> = { "1m": 60, "5m": 300, "15m": 900 };

export class OtcError extends Error {
  constructor(message = "Jeu casino inconnu.") {
    super(message);
    this.name = "OtcError";
  }
}

/**
 * Hachage FNV-1a + finalisation splitmix32 → nombre entre 0 (inclus) et 1
 * (exclu), stable sur toutes les plateformes. La finalisation est essentielle :
 * sans elle, des secondes consécutives donneraient des valeurs en rampe lente
 * au lieu de mouvements imprévisibles.
 */
function hash01(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 0x100000000;
}

/**
 * Prix simulé d'un jeu casino à une seconde donnée.
 * Mélange de vagues (tendance) et de sauts imprévisibles à chaque seconde,
 * amplifiés selon le tempérament du jeu.
 */
export function otcPriceAt(symbol: string, sec: number): number {
  const cfg = GAMES[symbol];
  if (!cfg) throw new OtcError();
  const s = Math.floor(sec);
  const seed = cfg.waveSeed;
  // Tendance : deux vagues décalées par jeu.
  const trend =
    cfg.vol * 0.0015 * Math.sin((2 * Math.PI * s) / (2700 + seed * 37) + seed) +
    cfg.vol * 0.0008 * Math.sin((2 * Math.PI * s) / (720 + seed * 13) + seed * 2);
  // Saut de la seconde : imprévisible mais déterministe (±0,1 % × tempérament).
  const noise = (hash01(`${symbol}:${s}`) - 0.5) * 0.002 * cfg.vol;
  const price = cfg.base * (1 + trend + noise);
  const factor = 10 ** cfg.decimals;
  return Math.round(price * factor) / factor;
}

/** Prix casino actuel (prix serveur, utilisé pour ouvrir et clôturer). */
export async function getOtcPrice(symbol: string): Promise<number> {
  return otcPriceAt(symbol, Date.now() / 1000);
}

/** Bougies casino, même format que les bougies crypto et actions. */
export async function getOtcCandles(
  symbol: string,
  interval: Interval = "1m",
  limit = 200
): Promise<Candle[]> {
  if (!GAMES[symbol]) throw new OtcError();
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
