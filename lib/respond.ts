import { NextResponse } from "next/server";
import { isLang, tr, type Lang } from "./i18n";

/** Langue demandée par le client (en-tête x-lang), français par défaut. */
export function reqLang(req: Request): Lang {
  const v = req.headers.get("x-lang");
  return isLang(v) ? v : "fr";
}

/**
 * Format JSON unique de toutes les API (pensé pour être réutilisé
 * tel quel par une future app React Native) :
 * - succès : { "data": ... }
 * - erreur : { "error": { "code": "...", "message": "..." } }
 * Le message est traduit dans la langue du client (français si absent).
 */
export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

export function fail(code: string, message: string, status = 400, lang: Lang = "fr"): NextResponse {
  return NextResponse.json({ error: { code, message: tr(lang, message) } }, { status });
}

export const UNAUTHORIZED = (lang: Lang = "fr") =>
  fail("NON_CONNECTE", "Connectez-vous pour continuer.", 401, lang);
