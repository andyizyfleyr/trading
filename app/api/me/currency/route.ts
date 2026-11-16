import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { requireUserId } from "@/lib/auth";
import { fail, ok, UNAUTHORIZED } from "@/lib/respond";
import { reqLang } from "@/lib/respond";
import { withSchema } from "@/lib/schema-ensure";
import { toApiUser } from "@/lib/trade-shape";
import { countryCurrency, isCurrency } from "@/lib/money";

export const dynamic = "force-dynamic";

/**
 * PUT /api/me/currency — Devise et pays d'affichage (protégé).
 * Corps : { "currency": "XOF" } et/ou { "country": "BJ" }.
 * Un pays règle sa devise (sauf devise explicite, qui gagne).
 * Tout reste stocké en USD : seule l'affichage change.
 */
export async function PUT(req: NextRequest) {
  const lang = reqLang(req);
  const userId = await requireUserId(req);
  if (!userId) return UNAUTHORIZED(lang);

  let body: { currency?: unknown; country?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail("REQUETE_INVALIDE", "Requête illisible.", 400, lang);
  }

  const patch: { currency?: string; country?: string } = {};
  if (body.country !== undefined) {
    const cur = countryCurrency(body.country);
    if (!cur || typeof body.country !== "string") {
      return fail("PAYS_INVALIDE", "Choisissez un pays proposé dans la liste.", 400, lang);
    }
    patch.country = body.country;
    patch.currency = cur;
  }
  if (body.currency !== undefined) {
    if (!isCurrency(body.currency)) {
      return fail("DEVISE_INVALIDE", "Choisissez une devise proposée dans la liste.", 400, lang);
    }
    patch.currency = body.currency; // la devise explicite gagne sur le pays
  }
  if (patch.currency === undefined) {
    return fail("REQUETE_INVALIDE", "Précisez une devise ou un pays.", 400, lang);
  }

  try {
    const rows = await withSchema(() =>
      db()
        .update(users)
        .set(patch)
        .where(eq(users.id, userId))
        .returning()
    );
    const user = rows[0];
    if (!user) return UNAUTHORIZED(lang);
    return ok({ user: toApiUser(user) });
  } catch {
    return fail("ERREUR_SERVEUR", "Devise impossible pour le moment.", 500, lang);
  }
}
