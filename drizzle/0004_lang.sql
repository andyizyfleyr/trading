-- TradeFacile : langue du compte (fr/en/es)
-- Appliquer avec : npm run db:push
-- (ou exécuter ce fichier dans l'éditeur SQL de Neon)

-- Comptes existants : français.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lang" TEXT NOT NULL DEFAULT 'fr';
