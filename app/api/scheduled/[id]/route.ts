import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { fail, ok, UNAUTHORIZED } from "@/lib/respond";
import { reqLang } from "@/lib/respond";
import { exactCancelTradeQuery } from "@/lib/exact-cancel-trade";
import { withSchema } from "@/lib/schema-ensure";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/scheduled/[id] — Annuler une mise programmée (protégé).
 * Possible seulement si la mise n'est pas encore partie.
 * La mise est remboursée aussitôt.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const lang = reqLang(req);
  const userId = await requireUserId(req);
  if (!userId) return UNAUTHORIZED(lang);

  // Next 15+ : params est une promesse (à attendre).
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return fail("REQUETE_INVALIDE", "Programmation introuvable.", 404, lang);
  }

  try {
    const cancelled = await withSchema(() => db().execute(exactCancelTradeQuery(userId, id, new Date())));
    const row = cancelled.rows[0];
    if (!row) return fail("TROP_TARD", "Trop tard : la mise est déjà partie ou introuvable.", 400, lang);
    return ok({ balance: Number(row.balance), balanceExact: {
      numerator: String(row.numerator), denominator: String(row.denominator),
    } });
  } catch {
    return fail("ERREUR_SERVEUR", "Annulation impossible pour le moment.", 500, lang);
  }
}
