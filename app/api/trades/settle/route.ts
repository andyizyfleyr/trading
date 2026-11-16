import { NextRequest } from "next/server";
import { and, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { comboLegs, combos, trades, users, type Combo, type ComboLeg, type Trade } from "@/lib/schema";
import { requireUserId } from "@/lib/auth";
import { fail, ok, UNAUTHORIZED } from "@/lib/respond";
import { round2, toApiCombo, toApiTrade } from "@/lib/trade-shape";
import { withComboTables } from "@/lib/combo-tables";
import { getPrice } from "@/lib/market";
import { otcPriceAt } from "@/lib/otc";
import { isOtc, RULES } from "@/lib/symbols";
import type { TradeResult } from "@/lib/types";

export const dynamic = "force-dynamic";

function judge(direction: string, openPrice: number, closePrice: number): TradeResult {
  if (closePrice === openPrice) return "TIE";
  const up = closePrice > openPrice;
  if (direction === "UP") return up ? "WIN" : "LOSS";
  return up ? "LOSS" : "WIN";
}

/**
 * POST /api/trades/settle — Clôture mes prédictions arrivées à échéance (protégé).
 * Corps optionnel : { "ids": [1, 2] } pour ne clôturer que certaines prédictions.
 * Prix de clôture = prix lu côté serveur à l'instant de la clôture,
 * sauf pour les jeux casino : prix exact rejoué à la seconde de fin
 * (la clôture peut arriver en retard, le résultat reste juste).
 * - Bonne prédiction : mise + 85 % de gain (mise × 1,85 rendue au solde)
 * - Mauvaise prédiction : rien rendu
 * - Égalité : mise rendue
 * Clôt aussi les combinés : jambes jugées comme des prédictions, une jambe
 * perdue = combiné perdu aussitôt, sinon mise × 1,85 ^ jambes gagnées.
 */
export async function POST(req: NextRequest) {
  const userId = await requireUserId(req);
  if (!userId) return UNAUTHORIZED();

  let ids: number[] | null = null;
  try {
    const body = (await req.json()) as { ids?: unknown };
    if (Array.isArray(body.ids)) {
      const parsed = body.ids.filter((v): v is number => Number.isInteger(v) && (v as number) > 0);
      if (parsed.length > 0) ids = parsed.slice(0, 50);
    }
  } catch {
    // Corps vide ou illisible : on clôture tout ce qui est échu.
  }

  try {
    const now = new Date();
    const conditions = [
      eq(trades.userId, userId),
      eq(trades.status, "OPEN"),
      lte(trades.closesAt, now),
    ];
    if (ids) conditions.push(inArray(trades.id, ids));

    const expired: Trade[] = await db()
      .select()
      .from(trades)
      .where(and(...conditions))
      .orderBy(desc(trades.closesAt))
      .limit(50);

    // Jambes de combinés échues (combinés encore OPEN uniquement).
    // Tables créées toutes seules au premier appel si elles manquent.
    // Combinés en panne : on clôture quand même les prédictions normales
    // (un combiné ne bloque JAMAIS la clôture — sinon tous les soldes
    // et historiques du site se figent avec des données obsolètes).
    let openCombos: Combo[] = [];
    let dueLegs: ComboLeg[] = [];
    try {
      ({ openCombos, dueLegs } = await withComboTables(async () => {
        const fetched = await db()
          .select()
          .from(combos)
          .where(and(eq(combos.userId, userId), eq(combos.status, "OPEN")))
          .limit(20);
        const fetchedIds = fetched.map((c) => c.id);
        const due: ComboLeg[] =
          fetchedIds.length === 0
            ? []
            : await db()
                .select()
                .from(comboLegs)
                .where(
                  and(
                    inArray(comboLegs.comboId, fetchedIds),
                    eq(comboLegs.status, "OPEN"),
                    lte(comboLegs.closesAt, now)
                  )
                )
                .orderBy(desc(comboLegs.closesAt))
                .limit(50);
        return { openCombos: fetched, dueLegs: due };
      }));
    } catch {
      openCombos = [];
      dueLegs = [];
    }

    if (expired.length === 0 && dueLegs.length === 0) {
      const me = await db().select().from(users).where(eq(users.id, userId)).limit(1);
      return ok({ settled: [], combos: [], pending: 0, balance: round2(me[0]?.balance ?? 0) });
    }

    // Un seul appel prix par actif (les jeux casino rejouent leur prix exact,
    // pas besoin de les lire).
    const symbols = Array.from(
      new Set([...expired.map((t) => t.symbol), ...dueLegs.map((l) => l.symbol)])
    ).filter((s) => !isOtc(s));
    const prices = new Map<string, number>();
    await Promise.all(
      symbols.map(async (symbol) => {
        try {
          prices.set(symbol, await getPrice(symbol as never));
        } catch {
          // Prix indisponible pour cet actif : ses prédictions restent OPEN,
          // le client réessaiera plus tard.
        }
      })
    );

    const settled: Trade[] = [];
    let pending = 0;

    for (const trade of expired) {
      // Jeux casino : le prix change chaque seconde et la clôture arrive
      // souvent en retard → on rejoue le prix exact de la seconde de fin.
      // Marchés réels : prix lu à l'instant de la clôture.
      const closePrice = isOtc(trade.symbol)
        ? otcPriceAt(trade.symbol, Math.floor(new Date(trade.closesAt).getTime() / 1000))
        : prices.get(trade.symbol);
      if (closePrice == null || !Number.isFinite(closePrice) || closePrice <= 0) {
        pending += 1;
        continue;
      }
      const result = judge(trade.direction, trade.openPrice, closePrice);
      const payout =
        result === "WIN"
          ? round2(trade.amount * (1 + RULES.WIN_PAYOUT_RATIO))
          : result === "TIE"
            ? round2(trade.amount)
            : 0;

      // Ne clôture que si encore OPEN (protège des appels en double).
      const updated = await db()
        .update(trades)
        .set({ status: "SETTLED", result, payout, closePrice })
        .where(and(eq(trades.id, trade.id), eq(trades.status, "OPEN")))
        .returning();

      if (updated.length === 0) continue; // Déjà clôturée par un autre appel.
      if (payout > 0) {
        await db()
          .update(users)
          .set({ balance: sql`${users.balance} + ${payout}` })
          .where(eq(users.id, userId));
      }
      settled.push(updated[0]);
    }

    // --- Combinés : on juge les jambes échues, puis on clôt les combinés
    // qui ont perdu (une jambe perdue = tout perdu aussitôt) ou dont toutes
    // les jambes sont jugées (mise × 1,85 ^ jambes gagnées, plafonné).
    const comboById = new Map(openCombos.map((c) => [c.id, c]));
    const dueByCombo = new Map<number, ComboLeg[]>();
    for (const leg of dueLegs) {
      const list = dueByCombo.get(leg.comboId) ?? [];
      list.push(leg);
      dueByCombo.set(leg.comboId, list);
    }
    const settledCombos: (typeof openCombos)[number][] = [];
    for (const [comboId, legs] of dueByCombo) {
      const combo = comboById.get(comboId);
      if (!combo) continue;
      let lost = false;
      for (const leg of legs) {
        const closePrice = isOtc(leg.symbol)
          ? otcPriceAt(leg.symbol, Math.floor(new Date(leg.closesAt).getTime() / 1000))
          : prices.get(leg.symbol);
        if (closePrice == null || !Number.isFinite(closePrice) || closePrice <= 0) {
          pending += 1;
          continue;
        }
        const result = judge(leg.direction, leg.openPrice, closePrice);
        const updated = await db()
          .update(comboLegs)
          .set({ status: "SETTLED", result, closePrice })
          .where(and(eq(comboLegs.id, leg.id), eq(comboLegs.status, "OPEN")))
          .returning();
        if (updated.length === 0) continue; // Déjà jugée par un autre appel.
        if (result === "LOSS") lost = true;
      }
      if (lost) {
        // Perte anticipée : les jambes restantes sont annulées (VOID).
        await db()
          .update(comboLegs)
          .set({ status: "SETTLED", result: "VOID" })
          .where(and(eq(comboLegs.comboId, comboId), eq(comboLegs.status, "OPEN")));
        const updatedCombo = await db()
          .update(combos)
          .set({ status: "SETTLED", result: "LOSS", payout: 0 })
          .where(and(eq(combos.id, comboId), eq(combos.status, "OPEN")))
          .returning();
        if (updatedCombo.length > 0) settledCombos.push(updatedCombo[0]);
        continue;
      }
      const remaining = await db()
        .select({ id: comboLegs.id })
        .from(comboLegs)
        .where(and(eq(comboLegs.comboId, comboId), eq(comboLegs.status, "OPEN")))
        .limit(1);
      if (remaining.length > 0) continue; // D'autres jambes courent encore.
      const judged = await db().select().from(comboLegs).where(eq(comboLegs.comboId, comboId));
      const wins = judged.filter((l) => l.result === "WIN").length;
      // Que des égalités : mise rendue. Sinon les égalités sortent de la cote.
      const result = wins === 0 ? "TIE" : "WIN";
      const payout =
        wins === 0
          ? round2(combo.amount)
          : Math.min(
              round2(combo.amount * Math.pow(1 + RULES.WIN_PAYOUT_RATIO, wins)),
              RULES.COMBO_MAX_PAYOUT
            );
      const updatedCombo = await db()
        .update(combos)
        .set({ status: "SETTLED", result, payout })
        .where(and(eq(combos.id, comboId), eq(combos.status, "OPEN")))
        .returning();
      if (updatedCombo.length === 0) continue; // Déjà clôturé par un autre appel.
      if (payout > 0) {
        await db()
          .update(users)
          .set({ balance: sql`${users.balance} + ${payout}` })
          .where(eq(users.id, userId));
      }
      settledCombos.push(updatedCombo[0]);
    }

    const settledComboIds = settledCombos.map((c) => c.id);
    const settledLegs =
      settledComboIds.length === 0
        ? []
        : await db().select().from(comboLegs).where(inArray(comboLegs.comboId, settledComboIds));
    const legsByCombo = new Map<number, ComboLeg[]>();
    for (const leg of settledLegs) {
      const list = legsByCombo.get(leg.comboId) ?? [];
      list.push(leg);
      legsByCombo.set(leg.comboId, list);
    }

    const me = await db().select().from(users).where(eq(users.id, userId)).limit(1);
    return ok({
      settled: settled.map(toApiTrade),
      combos: settledCombos.map((c) => toApiCombo(c, legsByCombo.get(c.id) ?? [])),
      pending,
      balance: round2(me[0]?.balance ?? 0),
    });
  } catch {
    return fail("ERREUR_SERVEUR", "Clôture impossible pour le moment.", 500);
  }
}
