import { NextRequest } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { trades, users } from "@/lib/schema";
import { requireUserId } from "@/lib/auth";
import { fail, ok, UNAUTHORIZED } from "@/lib/respond";
import { round2 } from "@/lib/trade-shape";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/scheduled/[id] — Annuler une mise programmée (protégé).
 * Possible seulement si la mise n'est pas encore partie.
 * La mise est remboursée aussitôt.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await requireUserId(req);
  if (!userId) return UNAUTHORIZED();

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return fail("REQUETE_INVALIDE", "Programmation introuvable.", 404);
  }

  try {
    const rows = await db()
      .select()
      .from(trades)
      .where(and(eq(trades.id, id), eq(trades.userId, userId)))
      .limit(1);
    const row = rows[0];
    if (!row || row.status !== "OPEN") {
      return fail("INTROUVABLE", "Programmation introuvable ou déjà traitée.", 404);
    }
    if (new Date(row.openedAt).getTime() <= Date.now()) {
      return fail("TROP_TARD", "Trop tard : la mise est déjà partie.", 400);
    }

    // Supprime seulement si encore OPEN (protège d'une clôture simultanée).
    const deleted = await db()
      .delete(trades)
      .where(and(eq(trades.id, id), eq(trades.status, "OPEN")))
      .returning({ amount: trades.amount });
    if (deleted.length === 0) {
      return fail("TROP_TARD", "Trop tard : la mise est déjà partie.", 400);
    }

    const refunded = await db()
      .update(users)
      .set({ balance: sql`${users.balance} + ${deleted[0].amount}` })
      .where(eq(users.id, userId))
      .returning({ balance: users.balance });

    return ok({ balance: round2(refunded[0]?.balance ?? 0) });
  } catch {
    return fail("ERREUR_SERVEUR", "Annulation impossible pour le moment.", 500);
  }
}
