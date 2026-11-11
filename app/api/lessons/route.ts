import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { lessonsProgress } from "@/lib/schema";
import { requireUserId } from "@/lib/auth";
import { fail, ok, UNAUTHORIZED } from "@/lib/respond";
import { LESSONS } from "@/lib/lessons";

export const dynamic = "force-dynamic";

/**
 * GET /api/lessons — Leçons + ma progression (protégé).
 */
export async function GET(req: NextRequest) {
  const userId = await requireUserId(req);
  if (!userId) return UNAUTHORIZED();

  try {
    const rows = await db()
      .select()
      .from(lessonsProgress)
      .where(eq(lessonsProgress.userId, userId));
    const progress: Record<string, boolean> = {};
    for (const r of rows) progress[r.lessonId] = r.done;
    return ok({ lessons: LESSONS, progress });
  } catch {
    return fail("ERREUR_SERVEUR", "Leçons temporairement indisponibles.", 500);
  }
}
