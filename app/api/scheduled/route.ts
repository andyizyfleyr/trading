import { NextRequest } from "next/server";
import { and, count, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { trades, users } from "@/lib/schema";
import { requireUserId } from "@/lib/auth";
import { TIME_SLOT_BOOK_MARGIN_MS } from "@/lib/config";
import { fail, ok, UNAUTHORIZED } from "@/lib/respond";
import { reqLang } from "@/lib/respond";
import { withSchema } from "@/lib/schema-ensure";
import { tr } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { userCurrency } from "@/lib/user-currency";
import { parseStake, tradeFromSql } from "@/lib/exact-api";
import { compareExact } from "@/lib/exact-ledger";
import { decimalFraction } from "@/lib/exact-money";
import { exactOpenTradeQuery } from "@/lib/exact-open-trade";
import { otcPriceAt } from "@/lib/otc";
import { isDuration, isOtc, isSymbol, RULES } from "@/lib/symbols";

export const dynamic = "force-dynamic";

/**
 * POST /api/scheduled — Programmer une mise casino (protégé).
 * Corps : { "symbol": "USDJPYOTC", "direction": "UP"|"DOWN",
 *           "amount": 100, "durationSec": 60, "slot": 1739990000 }
 * Le slot est une heure pile future (secondes, multiple de 60).
 * Jeux casino uniquement : leur prix est rejouable à l'identique,
 * donc la mise part à l'heure même si l'app est fermée.
 * La mise est retirée aussitôt (annulation = remboursée).
 */
export async function POST(req: NextRequest) {
  const lang = reqLang(req);
  const userId = await requireUserId(req);
  if (!userId) return UNAUTHORIZED(lang);

  let body: {
    symbol?: unknown;
    direction?: unknown;
    amount?: unknown;
    amountExact?: unknown;
    localAmount?: unknown;
    localCurrency?: unknown;
    durationSec?: unknown;
    slot?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return fail("REQUETE_INVALIDE", "Requête illisible.", 400, lang);
  }

  if (!isSymbol(body.symbol) || !isOtc(body.symbol)) {
    return fail(
      "JEU_SEULEMENT",
      "La programmation à l'avance est réservée aux jeux casino (Lucky 7, Jackpot, Turbo).",
      400,
      lang
    );
  }
  if (body.direction !== "UP" && body.direction !== "DOWN") {
    return fail("DIRECTION_INVALIDE", "Choisissez Hausse (ça monte) ou Baisse (ça descend).", 400, lang);
  }
  if (!isDuration(body.durationSec)) {
    return fail("DUREE_INVALIDE", "Choisissez une durée : 3 s, 10 s, 30 s, 1 min ou 5 min.", 400, lang);
  }
  let stake;
  try { stake = parseStake(body, await userCurrency(userId)); }
  catch { return fail("MISE_INVALIDE", "Montant de mise invalide.", 400, lang); }
  if (compareExact(stake, decimalFraction("0")) <= 0) return fail("MISE_INVALIDE", "Montant de mise invalide.", 400, lang);
  if (compareExact(stake, decimalFraction(String(RULES.MIN_BET))) < 0) {
    const cur = await userCurrency(userId);
    return fail("MISE_TROP_PETITE", tr(lang, "La mise minimum est de {x}.", { x: formatMoney(RULES.MIN_BET, cur, lang) }), 400, lang);
  }
  const slot = Number(body.slot);
  const nowMs = Date.now();
  const nowSec = Math.floor(nowMs / 1000);
  if (!Number.isInteger(slot) || slot % 60 !== 0) {
    return fail("HEURE_INVALIDE", "Choisissez une heure pile (ex : 14:35:00).", 400, lang);
  }
  // Même marge que le client (8 s) : un créneau trop proche est refusé
  // avec un message clair, pas « heure passée ».
  if (slot * 1000 <= nowMs + TIME_SLOT_BOOK_MARGIN_MS) {
    return fail("HEURE_TROP_PROCHE", "Heure trop proche : choisissez une heure plus tardive.", 400, lang);
  }
  if (slot > nowSec + 24 * 3600) {
    return fail("HEURE_TROP_LOIN", "On ne programme pas au-delà de 24 heures.", 400, lang);
  }

  try {
    // Limite : 50 mises programmées maximum par utilisateur.
    const programmed = await db()
      .select({ n: count() })
      .from(trades)
      .where(and(eq(trades.userId, userId), eq(trades.status, "OPEN"), gt(trades.openedAt, new Date())));
    if ((programmed[0]?.n ?? 0) >= RULES.MAX_SCHEDULED) {
      return fail(
        "LIMITE_ATTEINTE",
        `${RULES.MAX_SCHEDULED} mises programmées maximum. Annulez-en une pour continuer.`,
        429, lang
      );
    }

    const userRows = await withSchema(() => db().select().from(users).where(eq(users.id, userId)).limit(1));
    const user = userRows[0];
    if (!user) return UNAUTHORIZED(lang);

    // Prix d'ouverture exact, rejoué à la seconde pile choisie.
    const openPrice = otcPriceAt(body.symbol, slot);
    const openedAt = new Date(slot * 1000);
    const closesAt = new Date(slot * 1000 + body.durationSec * 1000);

    const opened = await withSchema(() => db().execute(exactOpenTradeQuery({
      userId, symbol: body.symbol as string, direction: body.direction as "UP" | "DOWN", amount: stake,
      openPrice, durationSec: body.durationSec as number, openedAt, closesAt,
    })));
    const row = opened.rows[0];
    if (!row) return fail("SOLDE_INSUFFISANT", "Solde insuffisant pour cette mise.", 400, lang);
    return ok({ scheduled: tradeFromSql(row), balance: Number(row.balance_after), balanceExact: {
      numerator: String(row.balance_numerator_after), denominator: String(row.balance_denominator_after),
    } }, 201);
  } catch {
    return fail("ERREUR_SERVEUR", "Programmation impossible pour le moment.", 500, lang);
  }
}
