/** Formatages : français simple, chiffres à largeur fixe (via CSS tabular-nums). */
import type { Lang } from "./i18n";
import { tr } from "./i18n";
import { symbolDecimals } from "./symbols";

/** Localisation des nombres et dates selon la langue (1 000 / 1,000 / 1000). */
const LOCALES: Record<Lang, string> = { fr: "fr-FR", en: "en-US", es: "es-ES" };
/** Décimales des montants (1000, 42,5). */
const DEC_BIG = 2;

const fmtCache = new Map<string, Intl.NumberFormat>();

/** Formateur partagé (créé une fois par langue/décimales). */
function numFmt(lang: Lang, min: number, max: number): Intl.NumberFormat {
  const key = `${lang}:${min}:${max}`;
  let fmt = fmtCache.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(LOCALES[lang] ?? LOCALES.fr, {
      minimumFractionDigits: min,
      maximumFractionDigits: max,
    });
    fmtCache.set(key, fmt);
  }
  return fmt;
}

/**
 * Prix d'un jeu avec SES décimales (Lucky 7 : 3, Jackpot et Turbo : 2),
 * comme l'axe du graphique. Même formateur pour les écarts (mouvements).
 */
export function fmtGamePrice(symbol: string, p: number, lang: Lang = "fr"): string {
  const v = Number(p) || 0;
  const dec = symbolDecimals(symbol) >= 3 ? 3 : 2;
  return numFmt(lang, dec, dec).format(v);
}

/** Montant signé : +340 / -400 / ±0 */
export function fmtSigned(n: number, lang: Lang = "fr"): string {
  const v = Math.round(Number(n) || 0);
  if (v > 0) return `+${numFmt(lang, 0, DEC_BIG).format(v)}`;
  if (v < 0) return `-${numFmt(lang, 0, DEC_BIG).format(Math.abs(v))}`;
  return "±0";
}

export function fmtTime(iso: string, lang: Lang = "fr"): string {
  try {
    return new Date(iso).toLocaleTimeString(LOCALES[lang], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

/**
 * Date + heure « 12/11/2026 14:35 » (export CSV : triable, sans virgule
 * pour ne pas casser les colonnes). L'année est obligatoire : sinon deux
 * trades à la même heure semblent identiques.
 */
export function fmtDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  } catch {
    return "";
  }
}

/** Durée « MM:SS » : « 00:03 », « 01:00 », « 05:00 » (grille Durée, champ). */
export function fmtDurMS(sec: number): string {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Compte à rebours « MM:SS » (mises programmées, signaux).
 * Plancher (pas plafond) : on n'affiche jamais plus de temps qu'il n'en
 * reste, sinon l'utilisateur appuie une seconde trop tôt.
 */
export function fmtRemain(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Compte à rebours court : « 1:05 » ou « 42s » (bouton flottant, En cours). */
export function fmtRemainShort(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s >= 60) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  return `${s}s`;
}

/** Étiquette de jour : « Aujourd'hui », « Hier » ou « 12 nov. » (groupes d'historique). */
export function fmtDay(iso: string, lang: Lang = "fr"): string {
  try {
    const d = new Date(iso);
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const day = new Date(d);
    day.setHours(0, 0, 0, 0);
    const diff = Math.round((midnight.getTime() - day.getTime()) / 86400000);
    // Les programmées de demain affichent leur vraie date (pas « Aujourd'hui »).
    if (diff === 0) return tr(lang, "Aujourd'hui");
    if (diff === 1) return tr(lang, "Hier");
    return d.toLocaleDateString(LOCALES[lang], { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

/**
 * Heure locale avec la seconde exacte : « 14h32:00 » (signaux, attente).
 * Le « h » distingue les heures des durées « 01:00 » (sinon « 05:00 » =
 * 5 minutes ou 5h du matin selon la case : incompréhensible).
 */
export function fmtSlot(slotSec: number): string {
  const d = new Date(slotSec * 1000);
  return `${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}:00`;
}

/** Heure courte locale : « 14h32 » (cases, listes, messages). */
export function fmtHM(slotSec: number): string {
  const d = new Date(slotSec * 1000);
  return `${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Heure « 14:32 » (avec deux-points) : axe du graphique (convention des
 * graphiques de trading) et valeur interne du choix d'heure (stable,
 * jamais affichée telle quelle).
 */
export function fmtHM24(slotSec: number): string {
  const d = new Date(slotSec * 1000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
