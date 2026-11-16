import { sql } from "drizzle-orm";
import { db } from "./db";

/**
 * Alignement du schéma (cumul de drizzle/0001 + 0002 + 0003 + 0004, rejouable
 * sans risque) : base users/trades PUIS combinés, solde par défaut à 0,
 * colonnes devise/pays/langue. L'ordre compte (clés étrangères).
 * Sans la base, une table users absente ne pouvait jamais se réparer
 * (combos référence users) et tout tombait en erreur 500.
 * Appliqué tout seul au premier appel qui en a besoin : le bac à sable
 * ne peut pas joindre Neon, donc aucune migration manuelle n'est possible.
 * IF NOT EXISTS / SET DEFAULT : ré-appeler ne fait jamais rien.
 */
export const SCHEMA_STATEMENTS = [
  // Base (drizzle/0001) : d'abord users, puis trades qui la référence.
  // Les retouches de users viennent aussitôt après : la connexion et
  // l'inscription en dépendent, elles doivent passer en premier.
  `CREATE TABLE IF NOT EXISTS "users" (
    "id" SERIAL PRIMARY KEY,
    "email" TEXT NOT NULL UNIQUE,
    "password_hash" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 10000,
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  // Les comptes existants gardent leur solde : seul le défaut change (10 000 → 0).
  `ALTER TABLE "users" ALTER COLUMN "balance" SET DEFAULT 0`,
  // Devise d'affichage (comptes existants : USD, la base) + pays (vide).
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'USD'`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "country" TEXT`,
  // Langue (comptes existants : français).
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lang" TEXT NOT NULL DEFAULT 'fr'`,
  `CREATE TABLE IF NOT EXISTS "trades" (
    "id" SERIAL PRIMARY KEY,
    "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
    "symbol" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "open_price" DOUBLE PRECISION NOT NULL,
    "close_price" DOUBLE PRECISION,
    "duration_sec" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "result" TEXT,
    "payout" DOUBLE PRECISION,
    "opened_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "closes_at" TIMESTAMP NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "trades_user_idx" ON "trades" ("user_id", "opened_at" DESC)`,
  `CREATE INDEX IF NOT EXISTS "trades_open_idx" ON "trades" ("user_id", "status", "closes_at")`,
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

/** Crée les tables des combinés si elles manquent (sans toucher au reste). */
export async function ensureSchema(): Promise<void> {
  for (const stmt of SCHEMA_STATEMENTS) {
    await db().execute(sql.raw(stmt));
  }
}

/** Codes Postgres : table inconnue (42P01), colonne inconnue (42703). */
const MISSING_SCHEMA_CODES = new Set(["42P01", "42703"]);

/**
 * Lit le message et le code d'erreur, en suivant la chaîne `cause`
 * (certains pilotes enveloppent l'erreur d'origine).
 */
function errorTexts(err: unknown): { messages: string[]; codes: string[] } {
  const messages: string[] = [];
  const codes: string[] = [];
  let cur: unknown = err;
  for (let i = 0; i < 5 && cur != null; i++) {
    if (cur instanceof Error) messages.push(cur.message);
    else if (typeof cur === "string") messages.push(cur);
    if (typeof cur === "object") {
      const rec = cur as Record<string, unknown>;
      if (typeof rec.code === "string" && rec.code) codes.push(rec.code);
      // NeonDbError expose aussi table/colonne : une erreur qui nomme
      // users/trades/combos sans autre détail vient du schéma.
      cur = rec.cause ?? rec.sourceError ?? null;
    } else {
      cur = null;
    }
  }
  return { messages, codes };
}

function isMissingSchema(err: unknown): boolean {
  const { messages, codes } = errorTexts(err);
  // Le code Postgres est la preuve la plus fiable (insensible au texte).
  if (codes.some((c) => MISSING_SCHEMA_CODES.has(c))) return true;
  // Table absente (« relation ... does not exist ») OU colonne absente
  // (« column ... does not exist », ex. users.lang après un déploiement) :
  // dans les deux cas, l'alignement du schéma peut réparer.
  return messages.some(
    (msg) =>
      /relation .* does not exist/i.test(msg) ||
      /column .* does not exist/i.test(msg) ||
      /table .* does not exist/i.test(msg)
  );
}

/**
 * Exécute fn ; si le schéma est en retard (table ou colonne manquante),
 * l'aligne puis rejoue une seule fois. Toute autre erreur (ou nouvel
 * échec) remonte aussitôt.
 */
export async function withSchema<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!isMissingSchema(err)) throw err;
    await ensureSchema();
    return await fn();
  }
}
