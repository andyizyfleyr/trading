import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { isValidEmail, normalizeEmail, signToken, verifyPassword } from "@/lib/auth";
import { fail, ok } from "@/lib/respond";
import { toApiUser } from "@/lib/trade-shape";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/login
 * Corps : { "email": "...", "password": "..." }
 * Réponse : { "data": { "token": "JWT", "user": {...} } }
 */
export async function POST(req: NextRequest) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail("REQUETE_INVALIDE", "Requête illisible.", 400);
  }

  if (!isValidEmail(body.email) || typeof body.password !== "string") {
    return fail("IDENTIFIANTS_INVALIDES", "E-mail ou mot de passe incorrect.", 401);
  }
  const email = normalizeEmail(body.email);

  try {
    const rows = await db().select().from(users).where(eq(users.email, email)).limit(1);
    const user = rows[0];
    if (!user) {
      return fail("IDENTIFIANTS_INVALIDES", "E-mail ou mot de passe incorrect.", 401);
    }
    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) {
      return fail("IDENTIFIANTS_INVALIDES", "E-mail ou mot de passe incorrect.", 401);
    }
    const token = await signToken(user.id);
    return ok({ token, user: toApiUser(user) });
  } catch (err) {
    if (err instanceof Error && err.message.includes("DATABASE_URL")) {
      return fail("ERREUR_SERVEUR", "Service temporairement indisponible.", 500);
    }
    return fail("ERREUR_SERVEUR", "Connexion impossible pour le moment.", 500);
  }
}
