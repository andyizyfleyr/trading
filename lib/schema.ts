import {
  pgTable,
  serial,
  text,
  integer,
  doublePrecision,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";

/** Utilisateurs : solde à 0 à la création, rechargé via « Ajouter » (argent fictif). */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  balance: doublePrecision("balance").notNull().default(0),
  balanceNumerator: numeric("balance_numerator").notNull().default("0"),
  balanceDenominator: numeric("balance_denominator").notNull().default("1"),
  /** Devise d'affichage (tout est stocké en USD). Pays ou null. */
  currency: text("currency").notNull().default("USD"),
  country: text("country"),
  /** Langue (fr/en/es). */
  lang: text("lang").notNull().default("fr"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Prédictions (trades). Le client n'envoie jamais ni prix ni résultat. */
export const trades = pgTable("trades", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  symbol: text("symbol").notNull(),
  /** UP = le prix va monter (HAUSSE), DOWN = le prix va descendre (BAISSE) */
  direction: text("direction").notNull(),
  amount: doublePrecision("amount").notNull(),
  amountNumerator: numeric("amount_numerator"),
  amountDenominator: numeric("amount_denominator"),
  payoutNumerator: numeric("payout_numerator"),
  payoutDenominator: numeric("payout_denominator"),
  openPrice: doublePrecision("open_price").notNull(),
  closePrice: doublePrecision("close_price"),
  durationSec: integer("duration_sec").notNull(),
  /** OPEN | SETTLED */
  status: text("status").notNull().default("OPEN"),
  /** WIN | LOSS | TIE (null tant que OPEN) */
  result: text("result"),
  payout: doublePrecision("payout"),
  openedAt: timestamp("opened_at").notNull().defaultNow(),
  closesAt: timestamp("closes_at").notNull(),
});

/** Combinés : une mise, 2 à 5 jambes, toutes doivent gagner. */
export const combos = pgTable("combos", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  amount: doublePrecision("amount").notNull(),
  amountNumerator: numeric("amount_numerator"),
  amountDenominator: numeric("amount_denominator"),
  payoutNumerator: numeric("payout_numerator"),
  payoutDenominator: numeric("payout_denominator"),
  /** OPEN | SETTLED */
  status: text("status").notNull().default("OPEN"),
  /** WIN | LOSS | TIE (null tant que OPEN) */
  result: text("result"),
  payout: doublePrecision("payout"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Jambes d'un combiné : jugées comme des prédictions normales. */
export const comboLegs = pgTable("combo_legs", {
  id: serial("id").primaryKey(),
  comboId: integer("combo_id")
    .notNull()
    .references(() => combos.id),
  symbol: text("symbol").notNull(),
  /** UP = le prix va monter (HAUSSE), DOWN = le prix va descendre (BAISSE) */
  direction: text("direction").notNull(),
  openPrice: doublePrecision("open_price").notNull(),
  closePrice: doublePrecision("close_price"),
  durationSec: integer("duration_sec").notNull(),
  /** OPEN | SETTLED */
  status: text("status").notNull().default("OPEN"),
  /** WIN | LOSS | TIE | VOID (annulée : combiné déjà perdu, null tant que OPEN) */
  result: text("result"),
  openedAt: timestamp("opened_at").notNull().defaultNow(),
  closesAt: timestamp("closes_at").notNull(),
});

export type User = typeof users.$inferSelect;
export type Trade = typeof trades.$inferSelect;
export type Combo = typeof combos.$inferSelect;
export type ComboLeg = typeof comboLegs.$inferSelect;
