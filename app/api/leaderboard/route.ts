import { NextRequest } from "next/server";
import { count, desc, gt } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { requireUserId } from "@/lib/auth";
import { fail, ok, UNAUTHORIZED } from "@/lib/respond";
import { round2 } from "@/lib/trade-shape";
import type { LeaderboardEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

/**
 * GET /api/leaderboard — Les 20 meilleurs soldes + mon rang (protégé).
 * Les e-mails ne sont jamais exposés (pseudos "Trader #id").
 */
export async function GET(req: NextRequest) {
  const userId = await requireUserId(req);
  if (!userId) return UNAUTHORIZED();

  try {
    const top = await db()
      .select({ id: users.id, balance: users.balance })
      .from(users)
      .orderBy(desc(users.balance))
      .limit(PAGE_SIZE);

    const me = await db().select().from(users).where(eq(users.id, userId)).limit(1);
    if (!me[0]) return UNAUTHORIZED();
    const myBalance = round2(me[0].balance ?? 0);

    const above = await db()
      .select({ n: count() })
      .from(users)
      .where(gt(users.balance, me[0].balance ?? 0));
    const total = await db().select({ n: count() }).from(users);

    const entries: LeaderboardEntry[] = top.map((u, i) => ({
      rank: i + 1,
      userId: u.id,
      label: `Trader #${u.id}`,
      balance: round2(u.balance ?? 0),
      isMe: u.id === userId,
    }));

    return ok({
      entries,
      me: { rank: (above[0]?.n ?? 0) + 1, balance: myBalance },
      total: total[0]?.n ?? entries.length,
    });
  } catch {
    return fail("ERREUR_SERVEUR", "Classement temporairement indisponible.", 500);
  }
}
