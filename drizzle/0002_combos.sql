-- TradeFacile : combinés (une mise, 2 à 5 jambes, toutes doivent gagner)
-- Appliquer avec : npm run db:push
-- (ou exécuter ce fichier dans l'éditeur SQL de Neon)

CREATE TABLE IF NOT EXISTS "combos" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
  "amount" DOUBLE PRECISION NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "result" TEXT,
  "payout" DOUBLE PRECISION,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "combos_user_idx" ON "combos" ("user_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "combo_legs" (
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
);
CREATE INDEX IF NOT EXISTS "combo_legs_combo_idx" ON "combo_legs" ("combo_id");
CREATE INDEX IF NOT EXISTS "combo_legs_open_idx" ON "combo_legs" ("status", "closes_at");

-- Fini les 10 000 offerts : les nouveaux comptes commencent à 0
-- (les comptes existants gardent leur solde, seul le défaut change).
ALTER TABLE "users" ALTER COLUMN "balance" SET DEFAULT 0;
