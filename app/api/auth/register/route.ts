import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { hashPassword, isValidEmail, normalizeEmail, signToken } from "@/lib/auth";
import { fail, ok } from "@/lib/respond";
import { reqLang } from "@/lib/respond";
import { withSchema } from "@/lib/schema-ensure";
import { isUniqueViolation, toApiUser } from "@/lib/trade-shape";
import { countryCurrencyOrDefault, countryLang, headerCountry, knownCountry } from "@/lib/geo";
import { PASSWORD_MIN } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/register
 * Corps : { "email": "...", "password": "..." } (mot de passe : 6 caractères minimum)
 * Réponse 201 : { "data": { "token": "JWT", "user": {...} } }
 */
export async function POST(req: NextRequest) {
  const lang = reqLang(req);
  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail("REQUETE_INVALIDE", "Requête illisible.", 400, lang);
  }

  if (!isValidEmail(body.email)) {
    return fail("EMAIL_INVALIDE", "Adresse e-mail invalide.", 400, lang);
  }
  if (typeof body.password !== "string" || body.password.length < PASSWORD_MIN) {
    return fail(
      "MOT_DE_PASSE_TROP_COURT",
      `Le mot de passe doit contenir au moins ${PASSWORD_MIN} caractères.`,
      400, lang
    );
  }

  const email = normalizeEmail(body.email);

  try {
    const existing = await db()
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existing.length > 0) {
      return fail("EMAIL_DEJA_UTILISE", "Un compte existe déjà avec cet e-mail.", 409, lang);
    }

    const passwordHash = await hashPassword(body.password);
    // Pays, devise et langue devinés (géolocalisation) : modifiables ensuite.
    const geo = headerCountry((n) => req.headers.get(n));
    const [created] = await withSchema(() =>
      db()
        .insert(users)
        // Solde de départ 0 : l'utilisateur le recharge via « Ajouter » (aucun cadeau auto).
        .values({
          email,
          passwordHash,
          balance: 0,
          currency: countryCurrencyOrDefault(geo),
          country: knownCountry(geo),
          lang: countryLang(geo),
        })
        .returning()
    );

    const token = await signToken(created.id);
    return ok({ token, user: toApiUser(created) }, 201);
  } catch (err) {
    if (isUniqueViolation(err)) {
      return fail("EMAIL_DEJA_UTILISE", "Un compte existe déjà avec cet e-mail.", 409, lang);
    }
    return fail("ERREUR_SERVEUR", "Inscription impossible pour le moment.", 500, lang);
  }
}
