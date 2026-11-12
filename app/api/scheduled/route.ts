import { NextRequest } from "next/server";
import { and, count, eq, gt, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { trades, users } from "@/lib/schema";
import { requireUserId } from "@/lib/auth";
import { TIME_SLOT_BOOK_MARGIN_MS } from "@/lib/config";
import { fail, ok, UNAUTHORIZED } from "@/lib/respond";
import { round2, toApiTrade } from "@/lib/trade-shape";
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
  const userId = await requireUserId(req);
  if (!userId) return UNAUTHORIZED();

  let body: {
    symbol?: unknown;
    direction?: unknown;
    amount?: unknown;
    durationSec?: unknown;
    slot?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return fail("REQUETE_INVALIDE", "Requête illisible.", 400);
  }

  if (!isSymbol(body.symbol) || !isOtc(body.symbol)) {
    return fail(
      "JEU_SEULEMENT",
      "La programmation à l'avance est réservée aux jeux casino (Lucky 7, Jackpot, Turbo).",
      400
    );
  }
  if (body.direction !== "UP" && body.direction !== "DOWN") {
    return fail("DIRECTION_INVALIDE", "Choisissez HAUSSE (ça monte) ou BAISSE (ça descend).", 400);
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
  const slot = Number(body.slot);
  const nowMs = Date.now();
  const nowSec = Math.floor(nowMs / 1000);
  if (!Number.isInteger(slot) || slot % 60 !== 0) {
    return fail("HEURE_INVALIDE", "Choisissez une heure pile (ex : 14:35:00).", 400);
  }
  // Même marge que le client (8 s) : un créneau trop proche est refusé
  // avec un message clair, pas « heure passée ».
  if (slot * 1000 <= nowMs + TIME_SLOT_BOOK_MARGIN_MS) {
    return fail("HEURE_TROP_PROCHE", "Heure trop proche : choisissez une heure plus tardive.", 400);
  }
  if (slot > nowSec + 24 * 3600) {
    return fail("HEURE_TROP_LOIN", "On ne programme pas au-delà de 24 heures.", 400);
  }

  try {
    // Limite : 50 mises programmées maximum par utilisateur.
    const programmed = await db()
      .select({ n: count() })
      .from(trades)
      .where(and(eq(trades.userId, userId), eq(trades.status, "OPEN"), gt(trades.openedAt, new Date())));
    if ((programmed[0]?.n ?? 0) >= 50) {
      return fail(
        "LIMITE_ATTEINTE",
        "50 mises programmées maximum. Annulez-en une pour continuer.",
        429
      );
    }

    const userRows = await db().select().from(users).where(eq(users.id, userId)).limit(1);
    const user = userRows[0];
    if (!user) return UNAUTHORIZED();

    const balance = round2(user.balance ?? 0);
    if (amount > balance) {
      return fail("SOLDE_INSUFFISANT", "Solde insuffisant pour cette mise.", 400);
    }

    // Prix d'ouverture exact, rejoué à la seconde pile choisie.
    const openPrice = otcPriceAt(body.symbol, slot);
    const openedAt = new Date(slot * 1000);
    const closesAt = new Date(slot * 1000 + body.durationSec * 1000);

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

    return ok({ scheduled: toApiTrade(created), balance: round2(debited[0].balance ?? 0) }, 201);
  } catch {
    return fail("ERREUR_SERVEUR", "Programmation impossible pour le moment.", 500);
  }
}
