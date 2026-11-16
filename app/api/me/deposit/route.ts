import { NextRequest } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { requireUserId } from "@/lib/auth";
import { fail, ok, UNAUTHORIZED } from "@/lib/respond";
import { toApiUser } from "@/lib/trade-shape";
import { formatMoney } from "@/lib/money";
import { RULES } from "@/lib/symbols";
import { userCurrency } from "@/lib/user-currency";

export const dynamic = "force-dynamic";

/**
 * POST /api/me/deposit — Ajoute du solde fictif par incrément (protégé).
 * Corps : { "amount": 1000 }. Aucun paiement réel, jamais.
 */
export async function POST(req: NextRequest) {
  const userId = await requireUserId(req);
  if (!userId) return UNAUTHORIZED();

  let body: { amount?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail("REQUETE_INVALIDE", "Requête illisible.", 400);
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount < RULES.MIN_DEPOSIT || amount > RULES.MAX_DEPOSIT) {
    const cur = await userCurrency(userId);
    return fail(
      "MONTANT_INVALIDE",
      `Le montant doit être entre ${formatMoney(RULES.MIN_DEPOSIT, cur)} et ${formatMoney(RULES.MAX_DEPOSIT, cur)}.`,
      400
    );
  }

  try {
    const rows = await db()
      .update(users)
      .set({ balance: sql`${users.balance} + ${amount}` })
      .where(eq(users.id, userId))
      .returning();
    const user = rows[0];
    if (!user) return UNAUTHORIZED();
    return ok({ user: toApiUser(user) });
  } catch {
    return fail("ERREUR_SERVEUR", "Dépôt impossible pour le moment.", 500);
  }
}
