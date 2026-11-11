import { NextRequest } from "next/server";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { requireUserId } from "@/lib/auth";
import { fail, ok, UNAUTHORIZED } from "@/lib/respond";
import { toApiUser } from "@/lib/trade-shape";

export const dynamic = "force-dynamic";

const MIN_WITHDRAW = 100;

/**
 * POST /api/me/withdraw — Retire du solde fictif par décrément (protégé).
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
  if (!Number.isFinite(amount) || amount < MIN_WITHDRAW) {
    return fail("MONTANT_INVALIDE", `Le montant minimum est de ${MIN_WITHDRAW}.`, 400);
  }

  try {
    const rows = await db()
      .update(users)
      .set({ balance: sql`${users.balance} - ${amount}` })
      .where(and(eq(users.id, userId), gte(users.balance, amount)))
      .returning();
    const user = rows[0];
    if (!user) {
      return fail("SOLDE_INSUFFISANT", "Solde insuffisant pour ce retrait.", 400);
    }
    return ok({ user: toApiUser(user) });
  } catch {
    return fail("ERREUR_SERVEUR", "Retrait impossible pour le moment.", 500);
  }
}
