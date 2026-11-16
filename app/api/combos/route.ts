import { NextRequest } from "next/server";
import { and, count, desc, eq, gt, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { comboLegs, combos, users } from "@/lib/schema";
import { requireUserId } from "@/lib/auth";
import { fail, ok, UNAUTHORIZED } from "@/lib/respond";
import { reqLang } from "@/lib/respond";
import { tr } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { userCurrency } from "@/lib/user-currency";
import { round2, toApiCombo } from "@/lib/trade-shape";
import { withSchema } from "@/lib/schema-ensure";
import { getPrice, MarketError } from "@/lib/market";
import { isDuration, isSymbol, RULES } from "@/lib/symbols";

export const dynamic = "force-dynamic";

/**
 * GET /api/combos?limit=50 — Mes combinés, jambes incluses (protégé).
 */
export async function GET(req: NextRequest) {
  const lang = reqLang(req);
  const userId = await requireUserId(req);
  if (!userId) return UNAUTHORIZED(lang);

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 200);

  try {
    // Tables créées toutes seules au premier appel si elles manquent.
    const { rows, legs } = await withSchema(async () => {
      const rows = await db()
        .select()
        .from(combos)
        .where(eq(combos.userId, userId))
        .orderBy(desc(combos.createdAt))
        .limit(limit);
      const ids = rows.map((c) => c.id);
      const legs =
        ids.length === 0
          ? []
          : await db().select().from(comboLegs).where(inArray(comboLegs.comboId, ids));
      return { rows, legs };
    });
    const byCombo = new Map<number, typeof legs>();
    for (const leg of legs) {
      const list = byCombo.get(leg.comboId) ?? [];
      list.push(leg);
      byCombo.set(leg.comboId, list);
    }
    return ok({ combos: rows.map((c) => toApiCombo(c, byCombo.get(c.id) ?? [])) });
  } catch {
    return fail("ERREUR_SERVEUR", "Combinés temporairement indisponibles.", 500, lang);
  }
}

/**
 * POST /api/combos — Placer un combiné (protégé).
 * Corps : { "amount": 100, "legs": [{ "symbol", "direction", "durationSec" }, ...] }
 * 2 à 5 jambes, départ immédiat, toutes doivent gagner (cote = 1,85 ^ jambes).
 * Le client n'envoie jamais de prix : les prix d'ouverture sont lus serveur.
 */
export async function POST(req: NextRequest) {
  const lang = reqLang(req);
  const userId = await requireUserId(req);
  if (!userId) return UNAUTHORIZED(lang);

  let body: { amount?: unknown; legs?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail("REQUETE_INVALIDE", "Requête illisible.", 400, lang);
  }

  const legs = Array.isArray(body.legs) ? body.legs : [];
  if (legs.length < RULES.COMBO_MIN_LEGS || legs.length > RULES.COMBO_MAX_LEGS) {
    return fail(
      "JAMBES_INVALIDES",
      `Un combiné, c'est ${RULES.COMBO_MIN_LEGS} à ${RULES.COMBO_MAX_LEGS} prédictions.`,
      400, lang
    );
  }
  for (const leg of legs) {
    const l = leg as { symbol?: unknown; direction?: unknown; durationSec?: unknown };
    if (!isSymbol(l.symbol)) {
      return fail("ACTIF_INVALIDE", "Choisissez des jeux proposés dans la liste.", 400, lang);
    }
    if (l.direction !== "UP" && l.direction !== "DOWN") {
      return fail("DIRECTION_INVALIDE", "Choisissez Hausse (ça monte) ou Baisse (ça descend).", 400, lang);
    }
    if (!isDuration(l.durationSec)) {
      return fail("DUREE_INVALIDE", "Choisissez une durée : 3 s, 10 s, 30 s, 1 min ou 5 min.", 400, lang);
    }
  }
  // Pas deux fois la même sélection, ni deux sens opposés sur le même
  // jeu et la même durée (sinon le combiné est perdu d'avance).
  const seen = new Set<string>();
  const dirs = new Map<string, string>();
  for (const leg of legs) {
    const l = leg as { symbol: string; direction: string; durationSec: number };
    const key = `${l.symbol}|${l.direction}|${l.durationSec}`;
    if (seen.has(key)) {
      return fail("DOUBLON", "Deux jambes identiques : ça ne compte pas double.", 400, lang);
    }
    seen.add(key);
    const game = `${l.symbol}|${l.durationSec}`;
    if (dirs.has(game) && dirs.get(game) !== l.direction) {
      return fail(
        "SENS_OPPOSES",
        "Hausse et Baisse sur le même jeu : combiné perdu d'avance.",
        400, lang
      );
    }
    dirs.set(game, l.direction);
  }

  const amount = round2(Number(body.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    return fail("MISE_INVALIDE", "Montant de mise invalide.", 400, lang);
  }
  if (amount < RULES.MIN_BET) {
    const cur = await userCurrency(userId);
    return fail(
      "MISE_TROP_PETITE",
      tr(lang, "La mise minimum est de {x}.", { x: formatMoney(RULES.MIN_BET, cur) }),
      400,
      lang
    );
  }

  try {
    // Limite : 20 combinés par minute et par utilisateur (anti-rafale).
    // Premier accès aux tables : les crée au besoin (la suite suit).
    const since = new Date(Date.now() - 60_000);
    const recent = await withSchema(() =>
      db()
        .select({ n: count() })
        .from(combos)
        .where(and(eq(combos.userId, userId), gt(combos.createdAt, since)))
    );
    if ((recent[0]?.n ?? 0) >= RULES.MAX_TRADES_PER_MINUTE) {
      return fail(
        "LIMITE_ATTEINTE",
        "Doucement : 20 combinés par minute maximum. Attendez quelques secondes.",
        429, lang
      );
    }

    const userRows = await withSchema(() => db().select().from(users).where(eq(users.id, userId)).limit(1));
    const user = userRows[0];
    if (!user) return UNAUTHORIZED(lang);

    const balance = round2(user.balance ?? 0);
    if (amount > balance) {
      return fail("SOLDE_INSUFFISANT", "Solde insuffisant pour cette mise.", 400, lang);
    }

    // Prix serveurs AVANT de débiter (un prix indisponible = pas de débit).
    // Un seul appel par jeu (deux jambes sur le même jeu partagent le prix).
    const symbols = Array.from(new Set(legs.map((l) => (l as { symbol: string }).symbol)));
    const prices = new Map<string, number>();
    try {
      await Promise.all(
        symbols.map(async (symbol) => {
          prices.set(symbol, await getPrice(symbol as never));
        })
      );
    } catch (err) {
      if (err instanceof MarketError) {
        return fail("PRIX_INDISPONIBLES", err.message, 503, lang);
      }
      return fail("PRIX_INDISPONIBLES", "Prix temporairement indisponibles.", 503, lang);
    }
    const openedAt = new Date();

    // Retire la mise du solde de façon atomique.
    const debited = await db()
      .update(users)
      .set({ balance: sql`${users.balance} - ${amount}` })
      .where(and(eq(users.id, userId), gte(users.balance, amount)))
      .returning({ balance: users.balance });
    if (debited.length === 0) {
      return fail("SOLDE_INSUFFISANT", "Solde insuffisant pour cette mise.", 400, lang);
    }

    const [created] = await db()
      .insert(combos)
      .values({ userId, amount, status: "OPEN" })
      .returning();
    const inserted = await db()
      .insert(comboLegs)
      .values(
        legs.map((leg) => {
          const l = leg as { symbol: string; direction: "UP" | "DOWN"; durationSec: number };
          return {
            comboId: created.id,
            symbol: l.symbol,
            direction: l.direction,
            openPrice: prices.get(l.symbol) ?? 0,
            durationSec: l.durationSec,
            status: "OPEN",
            openedAt,
            closesAt: new Date(openedAt.getTime() + l.durationSec * 1000),
          };
        })
      )
      .returning();

    return ok(
      { combo: toApiCombo(created, inserted), balance: round2(debited[0].balance ?? 0) },
      201
    );
  } catch {
    return fail("ERREUR_SERVEUR", "Combiné impossible pour le moment.", 500, lang);
  }
}
