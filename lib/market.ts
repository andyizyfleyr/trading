import {
  getKlines as getCryptoKlines,
  getPrice as getCryptoPrice,
  type Candle,
} from "./binance";
import { getOtcCandles, getOtcPrice } from "./otc";
import { getStockCandles, getStockPrice } from "./stocks";
import { isOtc, isStock, type Interval, type SymbolId } from "./symbols";

/**
 * Prix du marché : route chaque actif vers sa vraie source
 * (Binance pour les cryptos, Yahoo Finance pour les actions,
 * moteur maison déterministe pour les actifs OTC).
 * Mêmes signatures que lib/binance pour les routes API.
 */
export class MarketError extends Error {
  constructor(message = "Prix temporairement indisponibles. Réessayez dans quelques secondes.") {
    super(message);
    this.name = "MarketError";
  }
}

export type { Candle };

/** Prix actuel d'un actif (prix serveur, utilisé pour ouvrir et clôturer). */
export async function getPrice(symbol: SymbolId): Promise<number> {
  try {
    if (isOtc(symbol)) return await getOtcPrice(symbol);
    return isStock(symbol) ? await getStockPrice(symbol) : await getCryptoPrice(symbol);
  } catch {
    throw new MarketError();
  }
}

/** Bougies pour le graphique. */
export async function getKlines(
  symbol: SymbolId,
  interval: Interval = "1m",
  limit = 200
): Promise<Candle[]> {
  try {
    if (isOtc(symbol)) return await getOtcCandles(symbol, interval, limit);
    return isStock(symbol)
      ? await getStockCandles(symbol, interval, limit)
      : await getCryptoKlines(symbol, interval, limit);
  } catch {
    throw new MarketError();
  }
}
