import { NextResponse } from "next/server";

/**
 * Format JSON unique de toutes les API (pensé pour être réutilisé
 * tel quel par une future app React Native) :
 * - succès : { "data": ... }
 * - erreur : { "error": { "code": "...", "message": "..." } }
 */
export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

export function fail(code: string, message: string, status = 400): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

export const UNAUTHORIZED = () =>
  fail("NON_CONNECTE", "Connectez-vous pour continuer.", 401);
