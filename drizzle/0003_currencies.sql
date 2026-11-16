-- TradeFacile : devise et pays d'affichage (tout reste stocké en USD)
-- Appliquer avec : npm run db:push
-- (ou exécuter ce fichier dans l'éditeur SQL de Neon)

-- Comptes existants : USD (la base, aucune conversion) ; pays vide.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "country" TEXT;
