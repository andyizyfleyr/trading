import {
  pgTable,
  serial,
  text,
  integer,
  doublePrecision,
  timestamp,
  boolean,
  primaryKey,
} from "drizzle-orm/pg-core";

/** Utilisateurs : solde de départ 10 000 (argent fictif). */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  balance: doublePrecision("balance").notNull().default(10000),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Prédictions (trades). Le client n'envoie jamais ni prix ni résultat. */
export const trades = pgTable("trades", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  symbol: text("symbol").notNull(),
  /** UP = le prix va monter (ACHAT), DOWN = le prix va descendre (VENTE) */
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

/** Progression dans les leçons éducatives. */
export const lessonsProgress = pgTable(
  "lessons_progress",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    lessonId: text("lesson_id").notNull(),
    done: boolean("done").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.userId, t.lessonId] })]
);

export type User = typeof users.$inferSelect;
export type Trade = typeof trades.$inferSelect;
export type LessonProgress = typeof lessonsProgress.$inferSelect;
