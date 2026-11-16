import {
  pgTable,
  serial,
  text,
  integer,
  doublePrecision,
  timestamp,
} from "drizzle-orm/pg-core";

/** Utilisateurs : solde à 0 à la création, rechargé via « Ajouter » (argent fictif). */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  balance: doublePrecision("balance").notNull().default(0),
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
