import { strict as assert } from "node:assert";
import { test } from "node:test";
import { addExact, decimalFraction, divideExact, exactFromUsd, exactToUsd, multiplyExact, subtractExact, truncateExact } from "../lib/exact-money";
import { formatExactMoney, type CurrencyCode } from "../lib/money";

const d = decimalFraction;

test("conversion et gain exacts, sans arrondir la fraction USD", () => {
  const rate = multiplyExact(d("0.92"), d("655.957"));
  const stake = d("1000");
  const usd = divideExact(stake, rate);
  const payoutUsd = multiplyExact(usd, d("1.85"));
  assert.equal(truncateExact(multiplyExact(payoutUsd, rate), 0), "1850");
  assert.equal(truncateExact(multiplyExact(divideExact(d("100"), d("0.92")), d("1.85")), 8), "201.08695652");
  assert.equal(truncateExact(multiplyExact(multiplyExact(divideExact(d("100"), d("0.92")), d("1.85")), d("0.92")), 2), "185.00");
});

test("toutes les devises gardent la mise et le gain exacts après conversion", () => {
  const currencies: CurrencyCode[] = ["USD", "EUR", "XOF", "GBP", "NGN", "GHS"];
  for (const currency of currencies) {
    const stake = d("1000");
    const usd = exactToUsd(stake, currency);
    assert.deepEqual(exactFromUsd(usd, currency), stake);
    const gain = exactFromUsd(multiplyExact(usd, d("1.85")), currency);
    assert.equal(truncateExact(gain, 2), "1850.00", currency);
  }
});

test("débit et remboursement préservent le solde, affichage coupé vers zéro", () => {
  const balance = d("10000.005");
  const stake = divideExact(d("1000"), d("603.48044"));
  assert.deepEqual(addExact(subtractExact(balance, stake), stake), balance);
  assert.equal(truncateExact(d("-12.999"), 2), "-12.99");
  assert.equal(truncateExact(d("12.999"), 2), "12.99");
  assert.throws(() => divideExact(d("1"), d("0")));
  assert.throws(() => d("Infinity"));
});

test("affichage localisé d'une fraction exacte, y compris les grands nombres", () => {
  const usd = exactToUsd(d("100.00"), "EUR");
  const wire = { numerator: usd.numerator.toString(), denominator: usd.denominator.toString() };
  assert.equal(formatExactMoney(wire, "EUR", "fr"), "100,00 €");
  assert.equal(formatExactMoney(wire, "EUR", "en"), "100.00 €");
  assert.equal(formatExactMoney({ numerator: "-12999", denominator: "1000" }, "USD", "fr"), "-12,99 $");
  assert.equal(formatExactMoney({ numerator: "123456789012345678901234567890", denominator: "1" }, "USD", "en"), "123,456,789,012,345,678,901,234,567,890.00 $");
});
