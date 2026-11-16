import { COUNTRIES, countryCurrency, DEFAULT_CURRENCY, type CurrencyCode } from "./money";
import type { Lang } from "./i18n";

/**
 * Choix automatiques selon le pays (Vercel envoie `x-vercel-ip-country`
 * avec chaque requête : pas de service externe, pas de permission).
 * L'utilisateur garde toujours le dernier mot (profil, sélecteur de langue).
 */

/** Pays de langue anglaise (l'app ne parle que fr/en/es). */
const EN_COUNTRIES = new Set([
  "US", "GB", "NG", "GH", "CA", "AU", "NZ", "IE", "ZA", "IN", "PK",
  "KE", "UG", "TZ", "RW", "CM", "LR", "SL", "GM", "ZW",
]);

/** Pays de langue espagnole. */
const ES_COUNTRIES = new Set([
  "ES", "MX", "AR", "CL", "CO", "PE", "VE", "EC", "BO", "PY", "UY",
  "CU", "DO", "CR", "PA", "GT", "HN", "NI", "SV", "GQ",
]);

/** Langue probable d'un pays (défaut : français). */
export function countryLang(code: string | null): Lang {
  if (!code) return "fr";
  const c = code.trim().toUpperCase();
  if (ES_COUNTRIES.has(c)) return "es";
  if (EN_COUNTRIES.has(c)) return "en";
  return "fr";
}

/** Devise d'un pays (inconnu → USD, la base, aucune conversion). */
export function countryCurrencyOrDefault(code: string | null): CurrencyCode {
  if (!code) return DEFAULT_CURRENCY;
  return countryCurrency(code.trim().toUpperCase()) ?? DEFAULT_CURRENCY;
}

/** Pays s'il fait partie des 20 proposés, sinon null (choix manuel). */
export function knownCountry(code: string | null): string | null {
  if (!code) return null;
  const c = code.trim().toUpperCase();
  return COUNTRIES.some((k) => k.code === c) ? c : null;
}

/** Pays depuis les en-têtes (Vercel : `x-vercel-ip-country`). */
export function headerCountry(get: (name: string) => string | null): string | null {
  const v = get("x-vercel-ip-country");
  if (!v || !/^[A-Za-z]{2}$/.test(v.trim())) return null;
  return v.trim().toUpperCase();
}

/** Langue du navigateur (première visite, avant tout choix). */
export function browserLang(): Lang {
  try {
    const tag = (typeof navigator === "undefined" ? "" : navigator.language || "").toLowerCase();
    if (tag.startsWith("es")) return "es";
    if (tag.startsWith("en")) return "en";
    return "fr";
  } catch {
    return "fr";
  }
}
