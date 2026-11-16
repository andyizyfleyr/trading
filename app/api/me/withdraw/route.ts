import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { fail, ok, UNAUTHORIZED } from "@/lib/respond";
import { reqLang } from "@/lib/respond";
import { withSchema } from "@/lib/schema-ensure";
import { tr } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { RULES } from "@/lib/symbols";
import { exactBalanceChange } from "@/lib/exact-balance";
import { decimalFraction } from "@/lib/exact-money";
import Decimal from "decimal.js";
import { userCurrency } from "@/lib/user-currency";

export const dynamic = "force-dynamic";

/**
 * POST /api/me/withdraw — Retire du solde fictif par décrément (protégé).
 * Corps : { "amount": 1000 }. Aucun paiement réel, jamais.
 */
export async function POST(req: NextRequest) {
  const lang = reqLang(req);
  const userId = await requireUserId(req);
  if (!userId) return UNAUTHORIZED(lang);

  let body: { amount?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail("REQUETE_INVALIDE", "Requête illisible.", 400, lang);
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount < RULES.MIN_WITHDRAW) {
    const cur = await userCurrency(userId);
    return fail(
      "MONTANT_INVALIDE",
      tr(lang, "Le montant minimum est de {x}.", { x: formatMoney(RULES.MIN_WITHDRAW, cur, lang) }),
      400
    ,
      lang
    );
  }

  try {
    // Un seul UPDATE atomique : la fraction exacte reste la source du solde.
    const moved = await withSchema(() => db().execute(exactBalanceChange(userId, decimalFraction(new Decimal(amount).toFixed()), "debit")));
    if (moved.rows.length === 0) {
      return fail("SOLDE_INSUFFISANT", "Solde insuffisant pour cette opération.", 400, lang);
    }
    const row = moved.rows[0];
    return ok({ user: {
      id: Number(row.id), email: String(row.email), balance: Number(row.balance),
      balanceExact: { numerator: String(row.numerator), denominator: String(row.denominator) },
      currency: String(row.currency), country: row.country == null ? null : String(row.country),
      lang: String(row.lang), createdAt: new Date(String(row.created_at)).toISOString(),
    } });
  } catch {
    return fail("ERREUR_SERVEUR", "Retrait impossible pour le moment.", 500, lang);
  }
}
