import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { requireUserId } from "@/lib/auth";
import { fail, ok, UNAUTHORIZED } from "@/lib/respond";
import { toApiUser } from "@/lib/trade-shape";

export const dynamic = "force-dynamic";

/**
 * GET /api/me — Profil de l'utilisateur connecté (protégé).
 * En-tête requis : Authorization: Bearer <token>
 */
export async function GET(req: NextRequest) {
  const userId = await requireUserId(req);
  if (!userId) return UNAUTHORIZED();

  try {
    const rows = await db().select().from(users).where(eq(users.id, userId)).limit(1);
    const user = rows[0];
    if (!user) return UNAUTHORIZED();
    return ok({ user: toApiUser(user) });
  } catch {
    return fail("ERREUR_SERVEUR", "Profil temporairement indisponible.", 500);
  }
}
