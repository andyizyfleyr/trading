import { NextRequest } from "next/server";
import { and, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { trades, users, type Trade } from "@/lib/schema";
import { requireUserId } from "@/lib/auth";
import { fail, ok, UNAUTHORIZED } from "@/lib/respond";
import { round2, toApiTrade } from "@/lib/trade-shape";
import { getPrice } from "@/lib/market";
import { otcPriceAt } from "@/lib/otc";
import { isOtc, RULES } from "@/lib/symbols";
import type { TradeResult } from "@/lib/types";

export const dynamic = "force-dynamic";

function judge(direction: string, openPrice: number, closePrice: number): TradeResult {
  if (closePrice === openPrice) return "TIE";
  const up = closePrice > openPrice;
  if (direction === "UP") return up ? "WIN" : "LOSS";
  return up ? "LOSS" : "WIN";
}

/**
 * POST /api/trades/settle — Clôture mes prédictions arrivées à échéance (protégé).
 * Corps optionnel : { "ids": [1, 2] } pour ne clôturer que certaines prédictions.
 * Prix de clôture = prix lu côté serveur à l'instant de la clôture,
 * sauf pour les jeux casino : prix exact rejoué à la seconde de fin
 * (la clôture peut arriver en retard, le résultat reste juste).
 * - Bonne prédiction : mise + 85 % de gain (mise × 1,85 rendue au solde)
 * - Mauvaise prédiction : rien rendu
 * - Égalité : mise rendue
 */
export async function POST(req: NextRequest) {
  const userId = await requireUserId(req);
  if (!userId) return UNAUTHORIZED();

  let ids: number[] | null = null;
  try {
    const body = (await req.json()) as { ids?: unknown };
    if (Array.isArray(body.ids)) {
      const parsed = body.ids.filter((v): v is number => Number.isInteger(v) && (v as number) > 0);
      if (parsed.length > 0) ids = parsed.slice(0, 50);
    }
  } catch {
    // Corps vide ou illisible : on clôture tout ce qui est échu.
  }

  try {
    const now = new Date();
    const conditions = [
      eq(trades.userId, userId),
      eq(trades.status, "OPEN"),
      lte(trades.closesAt, now),
    ];
    if (ids) conditions.push(inArray(trades.id, ids));

    const expired: Trade[] = await db()
      .select()
      .from(trades)
      .where(and(...conditions))
      .orderBy(desc(trades.closesAt))
      .limit(50);

    if (expired.length === 0) {
      const me = await db().select().from(users).where(eq(users.id, userId)).limit(1);
      return ok({ settled: [], pending: 0, balance: round2(me[0]?.balance ?? 0) });
    }

    // Un seul appel prix par actif (les jeux casino rejouent leur prix exact,
    // pas besoin de les lire).
    const symbols = Array.from(new Set(expired.map((t) => t.symbol))).filter((s) => !isOtc(s));
    const prices = new Map<string, number>();
    await Promise.all(
      symbols.map(async (symbol) => {
        try {
          prices.set(symbol, await getPrice(symbol as never));
        } catch {
          // Prix indisponible pour cet actif : ses prédictions restent OPEN,
          // le client réessaiera plus tard.
        }
      })
    );

    const settled: Trade[] = [];
    let pending = 0;

    for (const trade of expired) {
      // Jeux casino : le prix change chaque seconde et la clôture arrive
      // souvent en retard → on rejoue le prix exact de la seconde de fin.
      // Marchés réels : prix lu à l'instant de la clôture.
      const closePrice = isOtc(trade.symbol)
        ? otcPriceAt(trade.symbol, Math.floor(new Date(trade.closesAt).getTime() / 1000))
        : prices.get(trade.symbol);
      if (closePrice == null || !Number.isFinite(closePrice) || closePrice <= 0) {
        pending += 1;
        continue;
      }
      const result = judge(trade.direction, trade.openPrice, closePrice);
      const payout =
        result === "WIN"
          ? round2(trade.amount * (1 + RULES.WIN_PAYOUT_RATIO))
          : result === "TIE"
            ? round2(trade.amount)
            : 0;

      // Ne clôture que si encore OPEN (protège des appels en double).
      const updated = await db()
        .update(trades)
        .set({ status: "SETTLED", result, payout, closePrice })
        .where(and(eq(trades.id, trade.id), eq(trades.status, "OPEN")))
        .returning();

      if (updated.length === 0) continue; // Déjà clôturée par un autre appel.
      if (payout > 0) {
        await db()
          .update(users)
          .set({ balance: sql`${users.balance} + ${payout}` })
          .where(eq(users.id, userId));
      }
      settled.push(updated[0]);
    }

    const me = await db().select().from(users).where(eq(users.id, userId)).limit(1);
    return ok({
      settled: settled.map(toApiTrade),
      pending,
      balance: round2(me[0]?.balance ?? 0),
    });
  } catch {
    return fail("ERREUR_SERVEUR", "Clôture impossible pour le moment.", 500);
  }
}
