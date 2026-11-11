-- TradeFacile : schéma initial (Neon / PostgreSQL)
-- Appliquer avec : npm run db:push
-- (ou exécuter ce fichier dans l'éditeur SQL de Neon)

CREATE TABLE IF NOT EXISTS "users" (
  "id" SERIAL PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "password_hash" TEXT NOT NULL,
  "balance" DOUBLE PRECISION NOT NULL DEFAULT 10000,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "trades" (
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
);
CREATE INDEX IF NOT EXISTS "trades_user_idx" ON "trades" ("user_id", "opened_at" DESC);
CREATE INDEX IF NOT EXISTS "trades_open_idx" ON "trades" ("user_id", "status", "closes_at");

CREATE TABLE IF NOT EXISTS "lessons_progress" (
  "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
  "lesson_id" TEXT NOT NULL,
  "done" BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY ("user_id", "lesson_id")
);
