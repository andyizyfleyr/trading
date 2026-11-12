import { NextRequest, NextResponse } from "next/server";
import { getKlines, MarketError } from "@/lib/market";
import { isInterval, isSymbol } from "@/lib/symbols";
import { fail } from "@/lib/respond";

export const dynamic = "force-dynamic";

/** Petit cache mémoire (5 s). */
const cache = new Map<string, { at: number; data: unknown }>();
const TTL_MS = 5_000;

/**
 * GET /api/candles?symbol=EURUSDOTC&interval=1m&limit=200 — Bougies (protégé).
 * Prix des jeux. Réponse : { "data": { "symbol", "interval", "candles": [...] } }
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol") ?? "EURUSDOTC";
  const interval = searchParams.get("interval") ?? "1m";
  const limit = Number(searchParams.get("limit") ?? 200);

  if (!isSymbol(symbol)) {
    return fail("ACTIF_INVALIDE", "Choisissez un jeu proposé dans la liste.", 400);
  }
  if (!isInterval(interval)) {
    return fail("INTERVALLE_INVALIDE", "Choisissez un intervalle : 1m, 5m ou 15m.", 400);
  }

  const key = `${symbol}:${interval}:${limit}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return NextResponse.json(
      { data: hit.data },
      { headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10" } }
    );
  }

  try {
    const candles = await getKlines(symbol, interval, limit);
    const data = { symbol, interval, candles };
    cache.set(key, { at: Date.now(), data });
    if (cache.size > 60) cache.clear();
    return NextResponse.json(
      { data },
      { headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10" } }
    );
  } catch (err) {
    if (err instanceof MarketError) {
      return fail("PRIX_INDISPONIBLES", err.message, 503);
    }
    return fail("PRIX_INDISPONIBLES", "Graphique temporairement indisponible.", 503);
  }
}
