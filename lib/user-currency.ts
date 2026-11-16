import { eq } from "drizzle-orm";
import { db } from "./db";
import { users } from "./schema";
import { DEFAULT_CURRENCY, isCurrency, type CurrencyCode } from "./money";

/**
 * Devise d'affichage d'un utilisateur (SERVEUR uniquement : touche la base).
 * Inconnue ou compte introuvable → USD (la base, aucune conversion).
 */
export async function userCurrency(userId: number): Promise<CurrencyCode> {
  try {
    const rows = await db()
      .select({ currency: users.currency })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const cur = rows[0]?.currency;
    return isCurrency(cur) ? cur : DEFAULT_CURRENCY;
  } catch {
    return DEFAULT_CURRENCY;
  }
}
