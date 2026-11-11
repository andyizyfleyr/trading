import { NextRequest } from "next/server";
import { and, count, eq, gt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { trades, users } from "@/lib/schema";
import { requireUserId } from "@/lib/auth";
import { fail, ok, UNAUTHORIZED } from "@/lib/respond";
import { round2 } from "@/lib/trade-shape";

export const dynamic = "force-dynamic";

/**
 * GET /api/me/stats — Mes statistiques réelles (protégé) :
 * prédictions terminées, victoires, défaites, égalités,
 * taux de réussite, gains nets, rang et nombre de joueurs.
 */
export async function GET(req: NextRequest) {
  const userId = await requireUserId(req);
  if (!userId) return UNAUTHORIZED();

  try {
    const rows = await db()
      .select({
        result: trades.result,
        n: count(),
        staked: sql<number>`coalesce(sum(${trades.amount}), 0)`,
        paid: sql<number>`coalesce(sum(${trades.payout}), 0)`,
      })
      .from(trades)
      .where(and(eq(trades.userId, userId), eq(trades.status, "SETTLED")))
      .groupBy(trades.result);

    let wins = 0;
    let losses = 0;
    let ties = 0;
    let pnl = 0;
    for (const r of rows) {
      const n = Number(r.n ?? 0);
      const staked = Number(r.staked ?? 0);
      const paid = Number(r.paid ?? 0);
      if (r.result === "WIN") {
        wins = n;
        pnl += paid - staked;
      } else if (r.result === "LOSS") {
        losses = n;
        pnl += paid - staked;
      } else if (r.result === "TIE") {
        ties = n;
      }
    }
    const settled = wins + losses + ties;
    const winRate = settled > 0 ? Math.round((wins / settled) * 100) : 0;

    const me = await db().select().from(users).where(eq(users.id, userId)).limit(1);
    if (!me[0]) return UNAUTHORIZED();
    const above = await db()
      .select({ n: count() })
      .from(users)
      .where(gt(users.balance, me[0].balance ?? 0));
    const total = await db().select({ n: count() }).from(users);

    return ok({
      stats: {
        settled,
        wins,
        losses,
        ties,
        winRate,
        pnl: round2(pnl),
        rank: (above[0]?.n ?? 0) + 1,
        total: total[0]?.n ?? 1,
      },
    });
  } catch {
    return fail("ERREUR_SERVEUR", "Statistiques temporairement indisponibles.", 500);
  }
}
