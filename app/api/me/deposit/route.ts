import { NextRequest } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { requireUserId } from "@/lib/auth";
import { fail, ok, UNAUTHORIZED } from "@/lib/respond";
import { toApiUser } from "@/lib/trade-shape";

export const dynamic = "force-dynamic";

const MIN_DEPOSIT = 100;
const MAX_DEPOSIT = 50000;

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
  if (!Number.isFinite(amount) || amount < MIN_DEPOSIT || amount > MAX_DEPOSIT) {
    return fail(
      "MONTANT_INVALIDE",
      `Le montant doit être entre ${MIN_DEPOSIT} et ${MAX_DEPOSIT}.`,
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
