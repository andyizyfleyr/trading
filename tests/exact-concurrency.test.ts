import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

// Essai d'un débit atomique en base : le contrôle du solde doit se faire
// dans l'UPDATE, et non sur une lecture séparée qui pourrait être périmée.
test("deux mises simultanées ne peuvent pas dépenser deux fois le solde", async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE users (id integer PRIMARY KEY, balance double precision NOT NULL);
      CREATE TABLE trades (id integer PRIMARY KEY, amount double precision NOT NULL, payout double precision);
      INSERT INTO users VALUES (1, 10);`);
    await db.exec(await readFile(new URL("../drizzle/0005_exact_money.sql", import.meta.url), "utf8"));
    const debit = `UPDATE users SET
      balance_numerator = balance_numerator * $2::numeric - $1::numeric * balance_denominator,
      balance_denominator = balance_denominator * $2::numeric
      WHERE id = 1 AND balance_numerator * $2::numeric >= $1::numeric * balance_denominator
      RETURNING id`;
    const results = await Promise.all([db.query(debit, ["6", "1"]), db.query(debit, ["6", "1"])]);
    assert.equal(results.reduce((sum, result) => sum + result.rows.length, 0), 1);
    const result = await db.query<{ n: string; d: string }>(`SELECT balance_numerator::text AS n, balance_denominator::text AS d FROM users WHERE id=1`);
    assert.equal(BigInt(result.rows[0].n), BigInt(4) * BigInt(result.rows[0].d));
  } finally { await db.close(); }
});
