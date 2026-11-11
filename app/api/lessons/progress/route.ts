import { NextRequest } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { lessonsProgress } from "@/lib/schema";
import { requireUserId } from "@/lib/auth";
import { fail, ok, UNAUTHORIZED } from "@/lib/respond";
import { isLessonId } from "@/lib/lessons";

export const dynamic = "force-dynamic";

/**
 * POST /api/lessons/progress — Marquer une leçon comme terminée (protégé).
 * Corps : { "lessonId": "bougies", "done": true }
 */
export async function POST(req: NextRequest) {
  const userId = await requireUserId(req);
  if (!userId) return UNAUTHORIZED();

  let body: { lessonId?: unknown; done?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail("REQUETE_INVALIDE", "Requête illisible.", 400);
  }

  if (!isLessonId(body.lessonId)) {
    return fail("LECON_INVALIDE", "Leçon inconnue.", 400);
  }
  const done = body.done !== false;

  try {
    await db()
      .insert(lessonsProgress)
      .values({ userId, lessonId: body.lessonId, done })
      .onConflictDoUpdate({
        target: [lessonsProgress.userId, lessonsProgress.lessonId],
        set: { done },
      });

    const rows = await db()
      .select()
      .from(lessonsProgress)
      .where(
        and(eq(lessonsProgress.userId, userId), eq(lessonsProgress.lessonId, body.lessonId))
      )
      .limit(1);
    return ok({ lessonId: body.lessonId, done: rows[0]?.done ?? done });
  } catch {
    return fail("ERREUR_SERVEUR", "Sauvegarde impossible pour le moment.", 500);
  }
}
