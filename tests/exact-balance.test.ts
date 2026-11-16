import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { decimalFraction, exactToUsd, fraction } from "../lib/exact-money";
import { exactBalanceChange } from "../lib/exact-balance";

async function setup() {
  const client = new PGlite();
  await client.exec(`CREATE TABLE users (id integer PRIMARY KEY, balance double precision NOT NULL, email text DEFAULT 'test@example.com', currency text DEFAULT 'USD', country text, lang text DEFAULT 'fr', created_at timestamp DEFAULT NOW());
    CREATE TABLE trades (id integer PRIMARY KEY, amount double precision NOT NULL, payout double precision);
    CREATE TABLE combos (id integer PRIMARY KEY, amount double precision NOT NULL, payout double precision);
    INSERT INTO users (id, balance) VALUES (1, 10);`);
  await client.exec(await readFile(new URL("../drizzle/0005_exact_money.sql", import.meta.url), "utf8"));
  return { client, db: drizzle(client) };
}

test("les opérations exactes en base conservent les fractions et refusent un solde insuffisant", async () => {
  const { client, db } = await setup();
  try {
    const stake = exactToUsd(decimalFraction("1000"), "XOF");
    const debit = await db.execute(exactBalanceChange(1, stake, "debit"));
    assert.equal(debit.rows.length, 1);
    const refund = await db.execute(exactBalanceChange(1, stake, "credit"));
    assert.equal(refund.rows.length, 1);
    assert.equal(refund.rows[0].numerator, "10");
    assert.equal(refund.rows[0].denominator, "1");
    const rejected = await db.execute(exactBalanceChange(1, decimalFraction("11"), "debit"));
    assert.equal(rejected.rows.length, 0);
    assert.throws(() => exactBalanceChange(1, fraction(BigInt(0)), "debit"));
  } finally { await client.close(); }
});

test("deux débits simultanés ne peuvent pas dépasser le solde", async () => {
  const { client, db } = await setup();
  try {
    const amount = decimalFraction("6");
    const results = await Promise.all([db.execute(exactBalanceChange(1, amount, "debit")), db.execute(exactBalanceChange(1, amount, "debit"))]);
    assert.equal(results[0].rows.length + results[1].rows.length, 1);
  } finally { await client.close(); }
});
