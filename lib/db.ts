import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

/**
 * Client Drizzle (Neon HTTP, compatible serverless).
 * La connexion est paresseuse : sans DATABASE_URL, les requêtes échouent
 * avec une erreur claire au moment de l'appel, jamais au build.
 */
function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Base de données non configurée : définissez DATABASE_URL (voir .env.example)."
    );
  }
  const sql = neon(url);
  return drizzle(sql);
}

let cached: ReturnType<typeof createDb> | null = null;

export function db() {
  if (!cached) cached = createDb();
  return cached;
}
