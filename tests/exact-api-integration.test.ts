import { strict as assert } from "node:assert";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { NextRequest } from "next/server";
import { setDbForTests } from "../lib/db";
import { SCHEMA_STATEMENTS } from "../lib/schema-ensure";
import { signToken } from "../lib/auth";
import { decimalFraction, exactToUsd, exactFromUsd, fraction, truncateExact } from "../lib/exact-money";
import { POST as deposit } from "../app/api/me/deposit/route";
import { POST as open } from "../app/api/trades/route";
import { POST as settle } from "../app/api/trades/settle/route";
import { POST as schedule } from "../app/api/scheduled/route";
import { DELETE as cancel } from "../app/api/scheduled/[id]/route";
import { GET as stats } from "../app/api/me/stats/route";
import { POST as withdraw } from "../app/api/me/withdraw/route";
import { GET as me } from "../app/api/me/route";
import { GET as health } from "../app/api/sante/route";
import { POST as register } from "../app/api/auth/register/route";

test("parcours API réel : migration, dépôt, mise, gain, programmation et annulation", async () => {
  const client = new PGlite();
  const db = drizzle(client);
  try {
    setDbForTests(db);
    for (const statement of SCHEMA_STATEMENTS) await client.exec(statement);
    await client.exec(`INSERT INTO users (id,email,password_hash,balance,currency) VALUES (1,'test@example.com','hash',0,'XOF')`);
    const token = await signToken(1);
    const request = (path: string, data: unknown, method = "POST") => new NextRequest(`http://localhost${path}`, {
      method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      ...(method === "POST" ? { body: JSON.stringify(data) } : {}),
    });
    const read = async (response: Response) => {
      const body = await response.json();
      assert.equal(response.status, 200 + (response.status === 201 ? 1 : 0), JSON.stringify(body));
      return body.data;
    };
    const profile = await read(await me(request("/api/me", null, "GET")));
    assert.equal(profile.user.balanceExact.numerator, "0");
    const diagnostic = (await (await health()).json()).data;
    assert.deepEqual(diagnostic.colonnesExactes, { users: true, trades: true });
    const dep = await read(await deposit(request("/api/me/deposit", { amount: 100 })));
    assert.equal(dep.user.balanceExact.numerator, "100");
    const malformed = await open(request("/api/trades", { symbol: "EURUSDOTC", direction: "UP", amount: 1, amountExact: { numerator: "1", denominator: "0" }, durationSec: 60 }));
    assert.equal(malformed.status, 400);
    const excessive = await open(request("/api/trades", { symbol: "EURUSDOTC", direction: "UP", amount: 0, amountExact: { numerator: "1000", denominator: "1" }, durationSec: 60 }));
    assert.equal(excessive.status, 400);
    const stake = exactToUsd(decimalFraction("10000"), "XOF");
    const amountExact = { numerator: stake.numerator.toString(), denominator: stake.denominator.toString() };
    const placed = await read(await open(request("/api/trades", { symbol: "EURUSDOTC", direction: "UP", amount: 0, amountExact, durationSec: 60 })));
    assert.deepEqual(placed.trade.amountExact, amountExact);
    await client.exec(`UPDATE trades SET open_price = 0.001, closes_at = NOW() - interval '1 minute' WHERE id = ${Number(placed.trade.id)}`);
    const paid = await read(await settle(request("/api/trades/settle", {})));
    assert.equal(paid.settled[0].result, "WIN");
    const got = paid.settled[0].payoutExact;
    assert.equal(truncateExact(exactFromUsd(fraction(BigInt(got.numerator), BigInt(got.denominator)), "XOF"), 0), "18500");
    const resultStats = await read(await stats(request("/api/me/stats", null, "GET")));
    const pnl = resultStats.stats.pnlExact;
    assert.equal(truncateExact(exactFromUsd(fraction(BigInt(pnl.numerator), BigInt(pnl.denominator)), "XOF"), 0), "8500");
    const slot = (Math.floor(Date.now() / 60000) + 3) * 60;
    const future = await read(await schedule(request("/api/scheduled", { symbol: "EURUSDOTC", direction: "UP", amount: 0, amountExact, durationSec: 60, slot })));
    const otherToken = await signToken(2);
    const outsider = new NextRequest(`http://localhost/api/scheduled/${future.scheduled.id}`, { method: "DELETE", headers: { authorization: `Bearer ${otherToken}` } });
    assert.equal((await cancel(outsider, { params: Promise.resolve({ id: String(future.scheduled.id) }) })).status, 400);
    const cancelled = await read(await cancel(request(`/api/scheduled/${future.scheduled.id}`, null, "DELETE"), { params: Promise.resolve({ id: String(future.scheduled.id) }) }));
    assert.deepEqual(cancelled.balanceExact, paid.balanceExact);
    const removed = await read(await withdraw(request("/api/me/withdraw", { amount: 100 })));
    assert.ok(removed.user.balanceExact);
    assert.equal((await withdraw(request("/api/me/withdraw", { amount: 100 }))).status, 400);
  } finally { setDbForTests(null); await client.close(); }
});

test("une ancienne mise ouverte est migrée puis réglée sans perte de solde", async () => {
  const client = new PGlite();
  try {
    setDbForTests(drizzle(client));
    for (const statement of SCHEMA_STATEMENTS) await client.exec(statement);
    await client.exec(`INSERT INTO users (id,email,password_hash,balance,currency) VALUES (1,'old@example.com','hash',50,'USD');
      INSERT INTO trades (id,user_id,symbol,direction,amount,open_price,duration_sec,status,opened_at,closes_at)
      VALUES (1,1,'EURUSDOTC','UP',10,0.001,60,'OPEN',NOW() - interval '2 minutes', NOW() - interval '1 minute');`);
    const token = await signToken(1);
    const req = () => new NextRequest("http://localhost/api/trades/settle", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: "{}" });
    const response = await settle(req());
    assert.equal(response.status, 200, await response.clone().text());
    const result = (await response.json()).data;
    assert.equal(result.settled[0].result, "WIN");
    assert.deepEqual(result.settled[0].payoutExact, { numerator: "37", denominator: "2" });
    assert.deepEqual(result.balanceExact, { numerator: "137", denominator: "2" });
    const retry = (await (await settle(req())).json()).data;
    assert.equal(retry.settled.length, 0);
    assert.deepEqual(retry.balanceExact, result.balanceExact);
  } finally { setDbForTests(null); await client.close(); }
});

test("inscription sur une ancienne base déclenche la migration et crée un solde exact nul", async () => {
  const client = new PGlite();
  try {
    setDbForTests(drizzle(client));
    for (const statement of SCHEMA_STATEMENTS) await client.exec(statement);
    const req = new NextRequest("http://localhost/api/auth/register", { method: "POST",
      headers: { "content-type": "application/json", "x-vercel-ip-country": "BJ" },
      body: JSON.stringify({ email: "new@example.com", password: "password123" }) });
    const response = await register(req);
    assert.equal(response.status, 201, await response.clone().text());
    const user = (await response.json()).data.user;
    assert.equal(user.currency, "XOF");
    assert.deepEqual(user.balanceExact, { numerator: "0", denominator: "1" });
  } finally { setDbForTests(null); await client.close(); }
});
