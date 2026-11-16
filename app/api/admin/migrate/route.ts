import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/respond";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/migrate — TEMPORAIRE, À SUPPRIMER APRÈS USAGE.
 * Crée les tables des combinés en production (drizzle/0002_combos.sql rejoué
 * ici car le bac à sable ne peut pas joindre Neon : un seul appel suffit,
 * les CREATE sont IF NOT EXISTS donc ré-appeler ne fait rien).
 * Corps : { "key": "<JWT_SECRET>" } — sans la clé, refusé.
 */
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "combos" (
    "id" SERIAL PRIMARY KEY,
    "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "result" TEXT,
    "payout" DOUBLE PRECISION,
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS "combos_user_idx" ON "combos" ("user_id", "created_at" DESC)`,
  `CREATE TABLE IF NOT EXISTS "combo_legs" (
    "id" SERIAL PRIMARY KEY,
    "combo_id" INTEGER NOT NULL REFERENCES "combos"("id"),
    "symbol" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "open_price" DOUBLE PRECISION NOT NULL,
    "close_price" DOUBLE PRECISION,
    "duration_sec" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "result" TEXT,
    "opened_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "closes_at" TIMESTAMP NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "combo_legs_combo_idx" ON "combo_legs" ("combo_id")`,
  `CREATE INDEX IF NOT EXISTS "combo_legs_open_idx" ON "combo_legs" ("status", "closes_at")`,
];

export async function POST(req: NextRequest) {
  const secret = process.env.JWT_SECRET;
  let key: unknown = null;
  try {
    key = ((await req.json()) as { key?: unknown }).key;
  } catch {
    /* corps illisible : refusé ci-dessous */
  }
  if (!secret || typeof key !== "string" || key !== secret) {
    return fail("INTERDIT", "Clé manquante ou invalide.", 403);
  }
  try {
    for (const stmt of STATEMENTS) {
      await db().execute(sql.raw(stmt));
    }
    const rows = (await db().execute(
      sql`SELECT COUNT(*)::int AS n FROM "combos"`
    )) as unknown as { n: number }[];
    return ok({ migrated: true, combos: rows[0]?.n ?? 0 });
  } catch {
    return fail("ERREUR_SERVEUR", "Migration impossible pour le moment.", 500);
  }
}
