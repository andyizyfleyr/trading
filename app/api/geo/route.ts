import { NextRequest } from "next/server";
import { ok } from "@/lib/respond";
import { countryCurrencyOrDefault, countryLang, headerCountry, knownCountry } from "@/lib/geo";

export const dynamic = "force-dynamic";

/**
 * GET /api/geo — pays, devise et langue devinés (géolocalisation Vercel).
 * Sert aux visiteurs (sans compte) : mêmes choix auto qu'à l'inscription.
 */
export async function GET(req: NextRequest) {
  const raw = headerCountry((n) => req.headers.get(n));
  return ok({
    country: knownCountry(raw),
    currency: countryCurrencyOrDefault(raw),
    lang: countryLang(raw),
  });
}
