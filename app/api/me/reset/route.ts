import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { requireUserId } from "@/lib/auth";
import { fail, ok, UNAUTHORIZED } from "@/lib/respond";
import { toApiUser } from "@/lib/trade-shape";
import { RULES } from "@/lib/symbols";

export const dynamic = "force-dynamic";

/**
 * POST /api/me/reset — Remet le solde à 10 000 (protégé).
 */
export async function POST(req: NextRequest) {
  const userId = await requireUserId(req);
  if (!userId) return UNAUTHORIZED();

  try {
    const rows = await db()
      .update(users)
      .set({ balance: RULES.START_BALANCE })
      .where(eq(users.id, userId))
      .returning();
    const user = rows[0];
    if (!user) return UNAUTHORIZED();
    return ok({ user: toApiUser(user) });
  } catch {
    return fail("ERREUR_SERVEUR", "Réinitialisation impossible pour le moment.", 500);
  }
}
