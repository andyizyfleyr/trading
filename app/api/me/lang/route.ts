import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { requireUserId } from "@/lib/auth";
import { fail, ok, UNAUTHORIZED } from "@/lib/respond";
import { reqLang } from "@/lib/respond";
import { toApiUser } from "@/lib/trade-shape";
import { isLang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/**
 * PUT /api/me/lang — Langue du compte (protégé). Corps : { "lang": "fr"|"en"|"es" }.
 */
export async function PUT(req: NextRequest) {
  const lang = reqLang(req);
  const userId = await requireUserId(req);
  if (!userId) return UNAUTHORIZED(lang);

  let body: { lang?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail("REQUETE_INVALIDE", "Requête illisible.", 400, lang);
  }
  if (!isLang(body.lang)) {
    return fail("LANGUE_INVALIDE", "Choisissez fr, en ou es.", 400, lang);
  }

  try {
    const rows = await db().update(users).set({ lang: body.lang }).where(eq(users.id, userId)).returning();
    const user = rows[0];
    if (!user) return UNAUTHORIZED(lang);
    return ok({ user: toApiUser(user) });
  } catch {
    return fail("ERREUR_SERVEUR", "Langue impossible pour le moment.", 500, lang);
  }
}
