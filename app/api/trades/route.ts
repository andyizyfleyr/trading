import { NextRequest } from "next/server";
import { and, count, desc, eq, gt, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { trades, users } from "@/lib/schema";
import { requireUserId } from "@/lib/auth";
import { fail, ok, UNAUTHORIZED } from "@/lib/respond";
import { reqLang } from "@/lib/respond";
import { withSchema } from "@/lib/schema-ensure";
import { tr } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { userCurrency } from "@/lib/user-currency";
import { toApiTrade } from "@/lib/trade-shape";
import { parseStake, tradeFromSql } from "@/lib/exact-api";
import { compareExact } from "@/lib/exact-ledger";
import { decimalFraction } from "@/lib/exact-money";
import { exactOpenTradeQuery } from "@/lib/exact-open-trade";
import { getPrice, MarketError } from "@/lib/market";
import { isDuration, isSymbol, RULES } from "@/lib/symbols";

export const dynamic = "force-dynamic";

/**
 * GET /api/trades?status=open|scheduled|settled|all&limit=50 — Mes prédictions (protégé).
 * « open » = parties (ouverture passée), « scheduled » = programmées (ouverture à venir).
 */
export async function GET(req: NextRequest) {
  const lang = reqLang(req);
  const userId = await requireUserId(req);
  if (!userId) return UNAUTHORIZED(lang);

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "all";
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 200);

  try {
    const conditions = [eq(trades.userId, userId)];
    const now = new Date();
    if (status === "open")
      conditions.push(eq(trades.status, "OPEN"), lte(trades.openedAt, now));
    if (status === "scheduled")
      conditions.push(eq(trades.status, "OPEN"), gt(trades.openedAt, now));
    if (status === "settled") conditions.push(eq(trades.status, "SETTLED"));

    const rows = await withSchema(() => db()
      .select()
      .from(trades)
      .where(and(...conditions))
      .orderBy(desc(trades.openedAt))
      .limit(limit));

    return ok({ trades: rows.map(toApiTrade) });
  } catch {
    return fail("ERREUR_SERVEUR", "Historique temporairement indisponible.", 500, lang);
  }
}

/**
 * POST /api/trades — Ouvrir une prédiction (protégé).
 * Corps : { "symbol": "EURUSDOTC", "direction": "UP"|"DOWN",
 *           "amount": 100, "durationSec": 3|10|30|60|300 }
 * Le client n'envoie jamais ni prix ni résultat : le prix d'ouverture
 * est le prix du jeu rejoué côté serveur, la mise est retirée du solde.
 */
export async function POST(req: NextRequest) {
  const lang = reqLang(req);
  const userId = await requireUserId(req);
  if (!userId) return UNAUTHORIZED(lang);

  let body: { symbol?: unknown; direction?: unknown; amount?: unknown; amountExact?: unknown; durationSec?: unknown; localAmount?: unknown; localCurrency?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail("REQUETE_INVALIDE", "Requête illisible.", 400, lang);
  }

  if (!isSymbol(body.symbol)) {
    return fail("ACTIF_INVALIDE", "Choisissez un jeu proposé dans la liste.", 400, lang);
  }
  if (body.direction !== "UP" && body.direction !== "DOWN") {
    return fail("DIRECTION_INVALIDE", "Choisissez Hausse (ça monte) ou Baisse (ça descend).", 400, lang);
  }
  if (!isDuration(body.durationSec)) {
    return fail("DUREE_INVALIDE", "Choisissez une durée : 3 s, 10 s, 30 s, 1 min ou 5 min.", 400, lang);
  }
  let stake;
  try {
    stake = parseStake(body, await userCurrency(userId));
  } catch {
    return fail("MISE_INVALIDE", "Montant de mise invalide.", 400, lang);
  }
  if (compareExact(stake, decimalFraction("0")) <= 0) return fail("MISE_INVALIDE", "Montant de mise invalide.", 400, lang);
  if (compareExact(stake, decimalFraction(String(RULES.MIN_BET))) < 0) {
    const cur = await userCurrency(userId);
    return fail("MISE_TROP_PETITE", tr(lang, "La mise minimum est de {x}.", { x: formatMoney(RULES.MIN_BET, cur, lang) }), 400, lang);
  }

  try {
    // Limite : 20 prédictions par minute et par utilisateur.
    const since = new Date(Date.now() - 60_000);
    const recent = await db()
      .select({ n: count() })
      .from(trades)
      .where(and(eq(trades.userId, userId), gt(trades.openedAt, since)));
    if ((recent[0]?.n ?? 0) >= RULES.MAX_TRADES_PER_MINUTE) {
      return fail(
        "LIMITE_ATTEINTE",
        "Doucement : 20 prédictions par minute maximum. Attendez quelques secondes.",
        429, lang
      );
    }

    const userRows = await withSchema(() => db().select().from(users).where(eq(users.id, userId)).limit(1));
    const user = userRows[0];
    if (!user) return UNAUTHORIZED(lang);

    // Prix serveur (jamais fourni par le client). L'heure d'ouverture est
    // prise aussitôt, dans la même seconde que le prix lu.
    let openPrice: number;
    let openedAt: Date;
    let closesAt: Date;
    try {
      openPrice = await getPrice(body.symbol);
      openedAt = new Date();
      closesAt = new Date(openedAt.getTime() + body.durationSec * 1000);
    } catch (err) {
      if (err instanceof MarketError) {
        return fail("PRIX_INDISPONIBLES", err.message, 503, lang);
      }
      return fail("PRIX_INDISPONIBLES", "Prix temporairement indisponibles.", 503, lang);
    }

    const opened = await withSchema(() => db().execute(exactOpenTradeQuery({
      userId, symbol: body.symbol as string, direction: body.direction as "UP" | "DOWN",
      amount: stake, openPrice, durationSec: body.durationSec as number, openedAt, closesAt,
    })));
    const row = opened.rows[0];
    if (!row) return fail("SOLDE_INSUFFISANT", "Solde insuffisant pour cette mise.", 400, lang);
    return ok({ trade: tradeFromSql(row), balance: Number(row.balance_after), balanceExact: {
      numerator: String(row.balance_numerator_after), denominator: String(row.balance_denominator_after),
    } }, 201);
  } catch {
    return fail("ERREUR_SERVEUR", "Prédiction impossible pour le moment.", 500, lang);
  }
}
