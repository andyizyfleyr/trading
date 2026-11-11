import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { NextRequest } from "next/server";

function jwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    // Secret de secours pour le développement local uniquement.
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET manquant ou trop court (32 caractères minimum).");
    }
    return new TextEncoder().encode("dev-secret-local-uniquement-ne-pas-utiliser-en-prod");
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Crée un token JWT valable 30 jours. */
export async function signToken(userId: number): Promise<string> {
  return new SignJWT({ sub: String(userId) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(jwtSecret());
}

/** Vérifie un token et retourne l'id utilisateur, ou null. */
export async function verifyToken(token: string): Promise<number | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret());
    const id = Number(payload.sub);
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

/**
 * Lit l'en-tête `Authorization: Bearer <token>` et retourne l'id utilisateur.
 * Utilisé par toutes les routes protégées.
 */
export async function requireUserId(req: NextRequest): Promise<number | null> {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer (.+)$/.exec(header.trim());
  if (!match) return null;
  return verifyToken(match[1]);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: unknown): email is string {
  return typeof email === "string" && email.length <= 120 && EMAIL_RE.test(email.trim());
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
