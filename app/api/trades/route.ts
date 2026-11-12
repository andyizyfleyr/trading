import { NextRequest } from "next/server";
import { and, count, desc, eq, gt, lte } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { trades, users } from "@/lib/schema";
import { requireUserId } from "@/lib/auth";
import { fail, ok, UNAUTHORIZED } from "@/lib/respond";
import { round2, toApiTrade } from "@/lib/trade-shape";
import { getPrice, MarketError } from "@/lib/market";
import { isDuration, isSymbol, RULES } from "@/lib/symbols";

export const dynamic = "force-dynamic";

/**
 * GET /api/trades?status=open|scheduled|settled|all&limit=50 — Mes prédictions (protégé).
 * « open » = parties (ouverture passée), « scheduled » = programmées (ouverture à venir).
 */
export async function GET(req: NextRequest) {
  const userId = await requireUserId(req);
  if (!userId) return UNAUTHORIZED();

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

    const rows = await db()
      .select()
      .from(trades)
      .where(and(...conditions))
      .orderBy(desc(trades.openedAt))
      .limit(limit);

    return ok({ trades: rows.map(toApiTrade) });
  } catch {
    return fail("ERREUR_SERVEUR", "Historique temporairement indisponible.", 500);
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
  const userId = await requireUserId(req);
  if (!userId) return UNAUTHORIZED();

  let body: { symbol?: unknown; direction?: unknown; amount?: unknown; durationSec?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail("REQUETE_INVALIDE", "Requête illisible.", 400);
  }

  if (!isSymbol(body.symbol)) {
    return fail("ACTIF_INVALIDE", "Choisissez un jeu proposé dans la liste.", 400);
  }
  if (body.direction !== "UP" && body.direction !== "DOWN") {
    return fail("DIRECTION_INVALIDE", "Choisissez ACHAT (ça monte) ou VENTE (ça descend).", 400);
  }
  if (!isDuration(body.durationSec)) {
    return fail("DUREE_INVALIDE", "Choisissez une durée : 3 s, 10 s, 30 s, 1 min ou 5 min.", 400);
  }
  const amount = round2(Number(body.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    return fail("MISE_INVALIDE", "Montant de mise invalide.", 400);
  }
  if (amount < RULES.MIN_BET) {
    return fail("MISE_TROP_PETITE", `La mise minimum est de ${RULES.MIN_BET}.`, 400);
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
        429
      );
    }

    const userRows = await db().select().from(users).where(eq(users.id, userId)).limit(1);
    const user = userRows[0];
    if (!user) return UNAUTHORIZED();

    // Pas de plafond : l'utilisateur mise librement jusqu'à tout son solde.
    const balance = round2(user.balance ?? 0);
    if (amount > balance) {
      return fail("SOLDE_INSUFFISANT", "Solde insuffisant pour cette mise.", 400);
    }

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
        return fail("PRIX_INDISPONIBLES", err.message, 503);
      }
      return fail("PRIX_INDISPONIBLES", "Prix temporairement indisponibles.", 503);
    }

    // Retire la mise du solde de façon atomique.
    const debited = await db()
      .update(users)
      .set({ balance: sql`${users.balance} - ${amount}` })
      .where(and(eq(users.id, userId), gte(users.balance, amount)))
      .returning({ balance: users.balance });
    if (debited.length === 0) {
      return fail("SOLDE_INSUFFISANT", "Solde insuffisant pour cette mise.", 400);
    }

    const [created] = await db()
      .insert(trades)
      .values({
        userId,
        symbol: body.symbol,
        direction: body.direction,
        amount,
        openPrice,
        durationSec: body.durationSec,
        status: "OPEN",
        openedAt,
        closesAt,
      })
      .returning();

    return ok({ trade: toApiTrade(created), balance: round2(debited[0].balance ?? 0) }, 201);
  } catch {
    return fail("ERREUR_SERVEUR", "Prédiction impossible pour le moment.", 500);
  }
}
