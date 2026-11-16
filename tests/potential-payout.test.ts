import { strict as assert } from "node:assert";
import { test } from "node:test";
import { formatCurrency, formatMoney, potentialPayout, type CurrencyCode } from "../lib/money";
import { RULES } from "../lib/symbols";

const expected: Record<CurrencyCode, string> = {
  USD: "185,00 $", EUR: "185,00 €", GBP: "185,00 £",
  XOF: "185 ₣", NGN: "185 ₦", GHS: "185 ₵",
};

test("le gain est calculé dans la devise saisie, sans conversion intermédiaire", () => {
  for (const [currency, value] of Object.entries(expected)) {
    assert.equal(formatCurrency(potentialPayout(100, RULES.WIN_PAYOUT_RATIO), currency as CurrencyCode), value);
  }
  assert.equal(formatCurrency(potentialPayout(1000, RULES.WIN_PAYOUT_RATIO), "XOF"), "1 850 ₣");
  assert.equal(formatCurrency(potentialPayout(10, RULES.WIN_PAYOUT_RATIO), "EUR"), "18,50 €");
  assert.equal(formatCurrency(potentialPayout(100, RULES.WIN_PAYOUT_RATIO), "EUR", "en"), "185.00 €");
  assert.equal(potentialPayout(null, RULES.WIN_PAYOUT_RATIO), 0);
  assert.equal(potentialPayout(-1, RULES.WIN_PAYOUT_RATIO), 0);
});

test("les décimales en trop sont coupées, jamais arrondies à l'affichage", () => {
  assert.equal(formatCurrency(12.999, "EUR"), "12,99 €");
  assert.equal(formatCurrency(-12.999, "EUR"), "-12,99 €");
  assert.equal(formatCurrency(1850.99, "XOF"), "1 850 ₣");
  assert.equal(formatMoney(1.999, "USD"), "1,99 $");
  assert.equal(formatMoney(10, "EUR"), "9,20 €");
});
