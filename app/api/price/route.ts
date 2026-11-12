import { NextRequest, NextResponse } from "next/server";
import { getPrice, MarketError } from "@/lib/market";
import { isSymbol } from "@/lib/symbols";
import { fail } from "@/lib/respond";

export const dynamic = "force-dynamic";

const cache = new Map<string, { at: number; price: number }>();
const TTL_MS = 2_000;

/**
 * GET /api/price?symbol=EURUSDOTC — Prix actuel (protégé).
 * Prix servi par sondage régulier.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol") ?? "EURUSDOTC";

  if (!isSymbol(symbol)) {
    return fail("ACTIF_INVALIDE", "Choisissez un jeu proposé dans la liste.", 400);
  }

  const hit = cache.get(symbol);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return NextResponse.json({ data: { symbol, price: hit.price, time: Date.now() } });
  }

  try {
    const price = await getPrice(symbol);
    cache.set(symbol, { at: Date.now(), price });
    return NextResponse.json({ data: { symbol, price, time: Date.now() } });
  } catch (err) {
    if (err instanceof MarketError) {
      return fail("PRIX_INDISPONIBLES", err.message, 503);
    }
    return fail("PRIX_INDISPONIBLES", "Prix temporairement indisponible.", 503);
  }
}
