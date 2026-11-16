/** Migration atomique ; tenir synchronisée avec drizzle/0005_exact_money.sql. */
export const EXACT_MIGRATION = `DO $migration$ BEGIN
-- Préparation du stockage exact : la fraction représente des USD.
-- IMPORTANT : ne pas exécuter en production tant que TOUTES les écritures
-- (dépôts, retraits, mises, annulations, clôtures et combinés) n'utilisent
-- pas ces colonnes dans les mêmes transactions. Les colonnes historiques
-- restent en place pour permettre une transition contrôlée.
--
-- Chaque ancienne valeur est reprise depuis sa représentation PostgreSQL :
-- les centimes déjà arrondis avant cette migration ne sont pas récupérables.
-- Les verrous empêchent une écriture entre la lecture et la copie des soldes.
LOCK TABLE "users", "trades", "combos" IN ACCESS EXCLUSIVE MODE;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "balance_numerator" numeric;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "balance_denominator" numeric;
ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "amount_numerator" numeric;
ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "amount_denominator" numeric;
ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "payout_numerator" numeric;
ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "payout_denominator" numeric;
ALTER TABLE "combos" ADD COLUMN IF NOT EXISTS "amount_numerator" numeric;
ALTER TABLE "combos" ADD COLUMN IF NOT EXISTS "amount_denominator" numeric;
ALTER TABLE "combos" ADD COLUMN IF NOT EXISTS "payout_numerator" numeric;
ALTER TABLE "combos" ADD COLUMN IF NOT EXISTS "payout_denominator" numeric;

-- Arrêter plutôt que d'inventer une fraction si la base contient une valeur
-- non finie ou une ancienne tentative de migration partiellement écrite.
BEGIN
  IF EXISTS (SELECT 1 FROM "users" WHERE "balance"::text IN ('NaN', 'Infinity', '-Infinity')
             OR (("balance_numerator" IS NULL) <> ("balance_denominator" IS NULL)))
    OR EXISTS (SELECT 1 FROM "trades" WHERE "amount"::text IN ('NaN', 'Infinity', '-Infinity')
             OR "payout"::text IN ('NaN', 'Infinity', '-Infinity')
             OR (("amount_numerator" IS NULL) <> ("amount_denominator" IS NULL))
             OR (("payout_numerator" IS NULL) <> ("payout_denominator" IS NULL))
             OR ("payout" IS NULL AND "payout_numerator" IS NOT NULL))
    OR EXISTS (SELECT 1 FROM "combos" WHERE "amount"::text IN ('NaN', 'Infinity', '-Infinity')
             OR "payout"::text IN ('NaN', 'Infinity', '-Infinity')
             OR (("amount_numerator" IS NULL) <> ("amount_denominator" IS NULL))
             OR (("payout_numerator" IS NULL) <> ("payout_denominator" IS NULL))
             OR ("payout" IS NULL AND "payout_numerator" IS NOT NULL))
  THEN RAISE EXCEPTION 'Valeur monétaire invalide ou fraction incomplète'; END IF;
END;

-- Le cast texte conserve la valeur décimale connue de PostgreSQL, y compris
-- sa notation exponentielle. NUMERIC ne perd pas les décimales du texte.
UPDATE "users" SET
  "balance_numerator" = trim_scale("balance"::text::numeric * power(10::numeric, scale("balance"::text::numeric))),
  "balance_denominator" = trim_scale(power(10::numeric, scale("balance"::text::numeric)))
WHERE "balance_numerator" IS NULL;
UPDATE "trades" SET
  "amount_numerator" = trim_scale("amount"::text::numeric * power(10::numeric, scale("amount"::text::numeric))),
  "amount_denominator" = trim_scale(power(10::numeric, scale("amount"::text::numeric)))
WHERE "amount_numerator" IS NULL;
UPDATE "trades" SET
  "payout_numerator" = trim_scale("payout"::text::numeric * power(10::numeric, scale("payout"::text::numeric))),
  "payout_denominator" = trim_scale(power(10::numeric, scale("payout"::text::numeric)))
WHERE "payout" IS NOT NULL AND "payout_numerator" IS NULL;
UPDATE "combos" SET
  "amount_numerator" = trim_scale("amount"::text::numeric * power(10::numeric, scale("amount"::text::numeric))),
  "amount_denominator" = trim_scale(power(10::numeric, scale("amount"::text::numeric)))
WHERE "amount_numerator" IS NULL;
UPDATE "combos" SET
  "payout_numerator" = trim_scale("payout"::text::numeric * power(10::numeric, scale("payout"::text::numeric))),
  "payout_denominator" = trim_scale(power(10::numeric, scale("payout"::text::numeric)))
WHERE "payout" IS NOT NULL AND "payout_numerator" IS NULL;

-- Les nouveaux comptes commencent avec le même solde nul que le champ historique.
ALTER TABLE "users" ALTER COLUMN "balance_numerator" SET DEFAULT 0;
ALTER TABLE "users" ALTER COLUMN "balance_denominator" SET DEFAULT 1;

-- Les fractions stockées doivent rester des entiers et leur dénominateur
-- doit être strictement positif, même si la migration est rejouée.
BEGIN
  IF EXISTS (SELECT 1 FROM "users" WHERE "balance_denominator" <= 0
             OR "balance_numerator" <> trunc("balance_numerator")
             OR "balance_denominator" <> trunc("balance_denominator"))
    OR EXISTS (SELECT 1 FROM "trades" WHERE "amount_denominator" <= 0
             OR "amount_numerator" <> trunc("amount_numerator")
             OR "amount_denominator" <> trunc("amount_denominator")
             OR ("payout_numerator" IS NOT NULL AND ("payout_denominator" <= 0
                 OR "payout_numerator" <> trunc("payout_numerator")
                 OR "payout_denominator" <> trunc("payout_denominator"))))
    OR EXISTS (SELECT 1 FROM "combos" WHERE "amount_denominator" <= 0
             OR "amount_numerator" <> trunc("amount_numerator")
             OR "amount_denominator" <> trunc("amount_denominator")
             OR ("payout_numerator" IS NOT NULL AND ("payout_denominator" <= 0
                 OR "payout_numerator" <> trunc("payout_numerator")
                 OR "payout_denominator" <> trunc("payout_denominator"))))
  THEN RAISE EXCEPTION 'Fraction monétaire invalide'; END IF;
END;

END $migration$`;
