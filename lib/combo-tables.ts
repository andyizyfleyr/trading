import { sql } from "drizzle-orm";
import { db } from "./db";

/**
 * Alignement du schéma (même contenu que drizzle/0002_combos.sql) :
 * tables des combinés + solde par défaut à 0 (fini les 10 000 offerts).
 * Appliqué tout seul au premier appel qui en a besoin : le bac à sable
 * ne peut pas joindre Neon, donc aucune migration manuelle n'est possible.
 * IF NOT EXISTS / SET DEFAULT : ré-appeler ne fait jamais rien.
 */
export const COMBO_TABLE_STATEMENTS = [
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
  // Les comptes existants gardent leur solde : seul le défaut change (10 000 → 0).
  `ALTER TABLE "users" ALTER COLUMN "balance" SET DEFAULT 0`,
];

/** Crée les tables des combinés si elles manquent (sans toucher au reste). */
export async function ensureComboTables(): Promise<void> {
  for (const stmt of COMBO_TABLE_STATEMENTS) {
    await db().execute(sql.raw(stmt));
  }
}

function isMissingTable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /relation .* does not exist/i.test(msg);
}

/**
 * Exécute fn ; si les tables des combinés manquent, les crée puis rejoue
 * une seule fois. Toute autre erreur (ou nouvel échec) remonte aussitôt.
 */
export async function withComboTables<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!isMissingTable(err)) throw err;
    await ensureComboTables();
    return await fn();
  }
}
