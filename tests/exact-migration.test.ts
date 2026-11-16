import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration = readFile(new URL("../drizzle/0005_exact_money.sql", import.meta.url), "utf8");

async function createDatabase() {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE users (id integer PRIMARY KEY, balance double precision NOT NULL);
    CREATE TABLE trades (id integer PRIMARY KEY, amount double precision NOT NULL, payout double precision);
    CREATE TABLE combos (id integer PRIMARY KEY, amount double precision NOT NULL, payout double precision);
    INSERT INTO users VALUES (1, 100.25), (2, 0), (3, 0.0000001);
    INSERT INTO trades VALUES (1, 10.87, 20.11), (2, 1000, NULL);
    INSERT INTO combos VALUES (1, 10.5, 0);
  `);
  return db;
}

test("la migration conserve les montants et peut être rejouée", async () => {
  const db = await createDatabase();
  try {
    await db.exec(await migration);
    const before = await db.query(`SELECT id, balance_numerator::text AS n, balance_denominator::text AS d FROM users ORDER BY id`);
    assert.deepEqual(before.rows, [
      { id: 1, n: "10025", d: "100" },
      { id: 2, n: "0", d: "1" },
      { id: 3, n: "1", d: "10000000" },
    ]);
    const trades = await db.query(`SELECT id, amount_numerator::text AS n, amount_denominator::text AS d, payout_numerator::text AS pn, payout_denominator::text AS pd FROM trades ORDER BY id`);
    assert.deepEqual(trades.rows, [
      { id: 1, n: "1087", d: "100", pn: "2011", pd: "100" },
      { id: 2, n: "1000", d: "1", pn: null, pd: null },
    ]);
    await db.exec(await migration);
    assert.deepEqual((await db.query(`SELECT id, balance_numerator::text AS n, balance_denominator::text AS d FROM users ORDER BY id`)).rows, before.rows);
  } finally { await db.close(); }
});

test("la migration refuse une valeur non finie", async () => {
  const db = await createDatabase();
  try {
    await db.exec(`UPDATE users SET balance = 'NaN' WHERE id = 1`);
    await assert.rejects(db.exec(await migration), /Valeur monétaire invalide/);
    await db.exec("ROLLBACK");
    const result = await db.query(`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'balance_numerator'`);
    assert.equal((result.rows[0] as { n: number }).n, 0);
  } finally { await db.close(); }
});

test("un dénominateur invalide bloque une nouvelle migration", async () => {
  const db = await createDatabase();
  try {
    await db.exec(await migration);
    await db.exec(`UPDATE users SET balance_denominator = 0 WHERE id = 1`);
    await assert.rejects(db.exec(await migration), /Fraction monétaire invalide/);
    await db.exec("ROLLBACK");
  } finally { await db.close(); }
});

test("la migration automatique s'exécute en une transaction serveur", async () => {
  const { EXACT_MIGRATION } = await import("../lib/exact-migration");
  const db = await createDatabase();
  try {
    await db.exec(EXACT_MIGRATION);
    const row = await db.query<{ n: string; d: string }>(`SELECT balance_numerator::text n, balance_denominator::text d FROM users WHERE id=1`);
    assert.deepEqual(row.rows[0], { n: "10025", d: "100" });
  } finally { await db.close(); }
});
