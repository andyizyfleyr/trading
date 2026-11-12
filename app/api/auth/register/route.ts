import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { hashPassword, isValidEmail, normalizeEmail, signToken } from "@/lib/auth";
import { fail, ok } from "@/lib/respond";
import { isUniqueViolation, toApiUser } from "@/lib/trade-shape";
import { PASSWORD_MIN } from "@/lib/config";
import { RULES } from "@/lib/symbols";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/register
 * Corps : { "email": "...", "password": "..." } (mot de passe : 6 caractères minimum)
 * Réponse 201 : { "data": { "token": "JWT", "user": {...} } }
 */
export async function POST(req: NextRequest) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail("REQUETE_INVALIDE", "Requête illisible.", 400);
  }

  if (!isValidEmail(body.email)) {
    return fail("EMAIL_INVALIDE", "Adresse e-mail invalide.", 400);
  }
  if (typeof body.password !== "string" || body.password.length < PASSWORD_MIN) {
    return fail(
      "MOT_DE_PASSE_TROP_COURT",
      `Le mot de passe doit contenir au moins ${PASSWORD_MIN} caractères.`,
      400
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
      return fail("EMAIL_DEJA_UTILISE", "Un compte existe déjà avec cet e-mail.", 409);
    }

    const passwordHash = await hashPassword(body.password);
    const [created] = await db()
      .insert(users)
      .values({ email, passwordHash, balance: RULES.START_BALANCE })
      .returning();

    const token = await signToken(created.id);
    return ok({ token, user: toApiUser(created) }, 201);
  } catch (err) {
    if (isUniqueViolation(err)) {
      return fail("EMAIL_DEJA_UTILISE", "Un compte existe déjà avec cet e-mail.", 409);
    }
    return fail("ERREUR_SERVEUR", "Inscription impossible pour le moment.", 500);
  }
}
