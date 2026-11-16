import { addExact, decimalFraction, multiplyExact, subtractExact, type ExactMoney } from "./exact-money";
import { RULES } from "./symbols";

/** Compare deux fractions sans conversion en nombre flottant. */
export function compareExact(a: ExactMoney, b: ExactMoney): number {
  const difference = a.numerator * b.denominator - b.numerator * a.denominator;
  return difference < BigInt(0) ? -1 : difference > BigInt(0) ? 1 : 0;
}

/** Débiter une mise ou un retrait ; ne jamais accepter un solde négatif. */
export function debitExact(balance: ExactMoney, amount: ExactMoney): ExactMoney {
  if (compareExact(amount, decimalFraction("0")) <= 0) throw new Error("Montant invalide");
  if (compareExact(balance, amount) < 0) throw new Error("Solde insuffisant");
  return subtractExact(balance, amount);
}

/** Créditer un dépôt, un remboursement ou un gain sans perdre les fractions. */
export function creditExact(balance: ExactMoney, amount: ExactMoney): ExactMoney {
  if (compareExact(amount, decimalFraction("0")) < 0) throw new Error("Montant invalide");
  return addExact(balance, amount);
}

/** Résultat d'une prédiction : défaite, mise rendue, ou mise plus 85 %. */
export function tradePayoutExact(stake: ExactMoney, result: "WIN" | "LOSS" | "TIE"): ExactMoney {
  if (compareExact(stake, decimalFraction("0")) <= 0) throw new Error("Mise invalide");
  if (result === "LOSS") return decimalFraction("0");
  return result === "TIE" ? stake : multiplyExact(stake, addExact(decimalFraction("1"), decimalFraction(String(RULES.WIN_PAYOUT_RATIO))));
}
