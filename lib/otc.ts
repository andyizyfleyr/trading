import type { Candle } from "./binance";
import { symbolDecimals, type Interval } from "./symbols";

/**
 * Jeux casino maison (Lucky 7, Jackpot, Turbo) : 100 % hasard, indépendants
 * des vrais marchés. Chaque jeu a son tempérament (doux, mouvementé, nerveux).
 *
 * Moteur multi-échelles : dérive lente (heures), vagues jouables (minutes),
 * bruit fractal lisse (secondes), régimes calme/nerveux et secousses
 * piégeuses (saut brutal qui retombe : faux signal naturel).
 *
 * Équité garantie par construction : le prix ne dépend que du jeu et de
 * la seconde (fonction déterministe), donc tout le monde voit le même prix
 * à la même seconde, à l'ouverture comme à la clôture. Personne ne peut le
 * modifier au cas par cas, pas même le serveur.
 */
interface GameCfg {
  base: number;
  vol: number;
  seed: number;
}

const GAMES: Record<string, GameCfg> = {
  EURUSDOTC: { base: 7.777, vol: 1, seed: 11 }, // Lucky 7 : doux
  GBPUSDOTC: { base: 1000, vol: 2, seed: 47 }, // Jackpot : mouvementé
  USDJPYOTC: { base: 100, vol: 3.5, seed: 83 }, // Turbo : nerveux
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

/** Bruit lisse entre -1 et 1 : paliers hachés reliés en douceur. */
function vnoise(key: string, s: number, period: number): number {
  const x = s / period;
  const i = Math.floor(x);
  const f = x - i;
  const a = hash01(`${key}:${i}`);
  const b = hash01(`${key}:${i + 1}`);
  const u = f * f * (3 - 2 * f);
  return (a + (b - a) * u) * 2 - 1;
}

/**
 * Secousse (« ruse ») : de temps en temps, un palier tire un saut brutal
 * qui retombe ensuite (piège classique). Zéro la plupart du temps.
 */
function spike(key: string, s: number, len: number, prob: number, tau: number): number {
  const b = Math.floor(s / len);
  if (hash01(`${key}:t:${b}`) >= prob) return 0;
  const m = hash01(`${key}:m:${b}`) * 2 - 1;
  return m * Math.exp(-(s - b * len) / tau);
}

/**
 * Prix simulé d'un jeu casino à une seconde donnée.
 * Dérive lente + vagues jouables + texture fractale + secousses,
 * le tout dosé par le tempérament du jeu et le régime du moment.
 */
export function otcPriceAt(symbol: string, sec: number): number {
  const cfg = GAMES[symbol];
  if (!cfg) throw new OtcError();
  const s = Math.floor(sec);
  const v = cfg.vol;
  const seed = cfg.seed;
  // Dérive lente : deux grandes vagues propres à chaque jeu (heures).
  const drift =
    0.002 * Math.sin((2 * Math.PI * s) / (12600 + ((seed * 733) % 3600)) + seed) +
    0.001 * Math.sin((2 * Math.PI * s) / (2700 + ((seed * 91) % 1200)) + seed * 2 + 1);
  // Vagues jouables : oscillations de quelques minutes, déphasées par jeu.
  const waves =
    0.0015 * Math.sin((2 * Math.PI * s) / (480 + ((seed * 37) % 360)) + seed * 3 + 2) +
    0.001 * Math.sin((2 * Math.PI * s) / (150 + ((seed * 17) % 120)) + seed * 5 + 4);
  // Texture fractale : 3 échelles lisses imbriquées (3 min, 45 s, 9 s).
  const texture =
    0.5 * vnoise(`${symbol}:a`, s, 180) +
    0.3 * vnoise(`${symbol}:b`, s, 45) +
    0.2 * vnoise(`${symbol}:c`, s, 9);
  // Régime : alterne calme et nerveux toutes les ~25-40 minutes.
  const regime = 1 + 0.45 * vnoise(`${symbol}:r`, s, 1500 + ((seed * 53) % 900));
  // Ruses : secousse brutale de temps en temps, qui retombe (piège).
  const trap = spike(symbol, s, 45 + (seed % 45), 0.14 + (seed % 5) * 0.02, 25);
  // Frémissement de chaque seconde : du mouvement même à 3 s.
  const jitter = (hash01(`${symbol}:${s}`) - 0.5) * 2;
  const rel =
    (drift + waves) * v + (texture * 0.002 + trap * 0.004 + jitter * 0.0007) * regime * v;
  const price = cfg.base * (1 + rel);
  const factor = 10 ** symbolDecimals(symbol);
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
    // Bougie en formation : bornée à la seconde actuelle (jamais de prix futur).
    const endCap = Math.min(start + len - 1, now);
    const open = otcPriceAt(symbol, start);
    const close = otcPriceAt(symbol, Math.max(start, endCap));
    let high = Math.max(open, close);
    let low = Math.min(open, close);
    for (let t = start; t <= endCap; t += step) {
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
