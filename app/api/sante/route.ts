import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { withSchema } from "@/lib/schema-ensure";

export const dynamic = "force-dynamic";

/**
 * GET /api/sante — diagnostic technique (sans données personnelles, sans secret).
 * Dit simplement : la base est-elle joignable ? Les tables existent-elles ?
 * Exécute aussi la requête exacte du login (limitée à 1 ligne, comptée
 * seulement) : si le schéma est en retard, elle le répare au passage
 * via withSchema, exactement comme ferait une connexion.
 * Sert à comprendre une panne de connexion au lieu de deviner.
 */
export async function GET() {
  // On ne montre jamais les secrets, juste « configuré oui/non ».
  const dbUrlConfiguree = Boolean(process.env.DATABASE_URL);
  const jwtSecret = process.env.JWT_SECRET ?? "";
  const jwtConfigure = jwtSecret.length >= 16;

  const etat: Record<string, unknown> = {
    dbUrlConfiguree,
    jwtConfigure,
    baseJointe: false,
    requeteLoginOk: false,
    codeErreurLogin: null as string | null,
    erreurLogin: null as string | null,
    tables: { users: false, trades: false, combos: false, combo_legs: false },
    colonnesUsers: { currency: false, country: false, lang: false },
    colonnesExactes: { users: false, trades: false, combos: false },
    erreur: null as string | null,
  };

  try {
    await db().execute(sql.raw("SELECT 1"));
    etat.baseJointe = true;

    // La requête exacte du login : prouve que la connexion peut lire users.
    try {
      const lignes = await withSchema(() => db().select().from(users).limit(1));
      etat.requeteLoginOk = true;
      etat.lignesLues = lignes.length; // nombre seulement, jamais le contenu
    } catch (errLogin: unknown) {
      const msg = errLogin instanceof Error ? errLogin.message : String(errLogin);
      etat.erreurLogin = msg.slice(0, 300);
      if (typeof errLogin === "object" && errLogin !== null) {
        const code = (errLogin as Record<string, unknown>).code;
        if (typeof code === "string" && code) etat.codeErreurLogin = code;
      }
    }

    const tables = await db().execute<{ table_name: string }>(
      sql.raw(
        "SELECT table_name FROM information_schema.tables " +
          "WHERE table_schema = 'public' AND table_name IN ('users','trades','combos','combo_legs')"
      )
    );
    const noms = new Set(tables.rows.map((r) => r.table_name));
    etat.tables = {
      users: noms.has("users"),
      trades: noms.has("trades"),
      combos: noms.has("combos"),
      combo_legs: noms.has("combo_legs"),
    };

    const exactCols = await db().execute<{ table_name: string; column_name: string }>(sql.raw(
      "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('users','trades','combos')"
    ));
    const exact = new Set(exactCols.rows.map((r) => `${r.table_name}.${r.column_name}`));
    etat.colonnesExactes = {
      users: ["balance_numerator", "balance_denominator"].every((c) => exact.has(`users.${c}`)),
      trades: ["amount_numerator", "amount_denominator", "payout_numerator", "payout_denominator"].every((c) => exact.has(`trades.${c}`)),
      combos: ["amount_numerator", "amount_denominator", "payout_numerator", "payout_denominator"].every((c) => exact.has(`combos.${c}`)),
    };

    if (noms.has("users")) {
      const cols = await db().execute<{ column_name: string }>(
        sql.raw(
          "SELECT column_name FROM information_schema.columns WHERE table_name = 'users'"
        )
      );
      const set = new Set(cols.rows.map((r) => r.column_name));
      etat.colonnesUsers = {
        currency: set.has("currency"),
        country: set.has("country"),
        lang: set.has("lang"),
      };
    }
  } catch (err) {
    // Message tronqué, sans risque : les erreurs Neon ne contiennent pas les secrets.
    const msg = err instanceof Error ? err.message : String(err);
    etat.erreur = msg.slice(0, 300);
  }

  return NextResponse.json({ data: etat });
}
