import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { isValidEmail, normalizeEmail, signToken, verifyPassword } from "@/lib/auth";
import { LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS } from "@/lib/config";
import { fail, ok } from "@/lib/respond";
import { toApiUser } from "@/lib/trade-shape";

export const dynamic = "force-dynamic";

/**
 * Anti brute-force : 10 essais ratés par adresse IP et par 10 minutes.
 * (En mémoire : freine déjà les robots. Un compteur partagé en base
 * serait plus strict sur plusieurs serveurs.)
 */
const attempts = new Map<string, { count: number; resetAt: number }>();

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim() || "unknown";
  return "unknown";
}

function tooManyAttempts(ip: string): boolean {
  const rec = attempts.get(ip);
  if (!rec) return false;
  if (Date.now() >= rec.resetAt) {
    attempts.delete(ip);
    return false;
  }
  return rec.count >= LOGIN_MAX_ATTEMPTS;
}

function recordFailure(ip: string): void {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (rec && now < rec.resetAt) {
    rec.count += 1;
  } else {
    // Nettoyage au passage (la carte ne grossit jamais).
    if (attempts.size > 10000) {
      attempts.forEach((r, k) => {
        if (now >= r.resetAt) attempts.delete(k);
      });
    }
    attempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  }
}

/**
 * POST /api/auth/login
 * Corps : { "email": "...", "password": "..." }
 * Réponse : { "data": { "token": "JWT", "user": {...} } }
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (tooManyAttempts(ip)) {
    return fail(
      "TROP_DE_TENTATIVES",
      "Trop de tentatives. Réessayez dans quelques minutes.",
      429
    );
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail("REQUETE_INVALIDE", "Requête illisible.", 400);
  }

  if (!isValidEmail(body.email) || typeof body.password !== "string") {
    recordFailure(ip);
    return fail("IDENTIFIANTS_INVALIDES", "E-mail ou mot de passe incorrect.", 401);
  }
  const email = normalizeEmail(body.email);

  try {
    const rows = await db().select().from(users).where(eq(users.email, email)).limit(1);
    const user = rows[0];
    if (!user) {
      recordFailure(ip);
      return fail("IDENTIFIANTS_INVALIDES", "E-mail ou mot de passe incorrect.", 401);
    }
    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) {
      recordFailure(ip);
      return fail("IDENTIFIANTS_INVALIDES", "E-mail ou mot de passe incorrect.", 401);
    }
    attempts.delete(ip);
    const token = await signToken(user.id);
    return ok({ token, user: toApiUser(user) });
  } catch (err) {
    if (err instanceof Error && err.message.includes("DATABASE_URL")) {
      return fail("ERREUR_SERVEUR", "Service temporairement indisponible.", 500);
    }
    return fail("ERREUR_SERVEUR", "Connexion impossible pour le moment.", 500);
  }
}
