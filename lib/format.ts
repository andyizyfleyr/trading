/** Formatages : français simple, chiffres à largeur fixe (via CSS tabular-nums). */

const LOCALE = "fr-FR";
/** Seuils d'ordre de grandeur pour les décimales des prix. */
const PRICE_BIG = 100;
const PRICE_UNIT = 1;
/** Décimales : gros prix (1000,00), moyens (7,7770), petits (0,12345). */
const DEC_BIG = 2;
const DEC_MID = 4;
const DEC_SMALL = 5;

const moneyFmt = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: DEC_BIG });

export function fmtMoney(n: number): string {
  return moneyFmt.format(Number(n) || 0);
}

/** Gain net (+85 %) avec 1 décimale : « 42,5 » (boutons HAUSSE/BAISSE, En cours). */
const gainFmt = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function fmtGain(n: number): string {
  return gainFmt.format(Number(n) || 0);
}

/** Prix avec un nombre de décimales adapté à l'ordre de grandeur. */
const priceFmtBig = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: DEC_BIG,
  maximumFractionDigits: DEC_BIG,
});
const priceFmtMid = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: DEC_MID,
  maximumFractionDigits: DEC_MID,
});
const priceFmtSmall = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: DEC_SMALL,
  maximumFractionDigits: DEC_SMALL,
});

export function fmtPrice(p: number): string {
  const v = Number(p) || 0;
  return (v >= PRICE_BIG ? priceFmtBig : v >= PRICE_UNIT ? priceFmtMid : priceFmtSmall).format(v);
}

/** Montant signé : +340 / -400 / ±0 */
export function fmtSigned(n: number): string {
  const v = Math.round(Number(n) || 0);
  if (v > 0) return `+${moneyFmt.format(v)}`;
  if (v < 0) return `-${moneyFmt.format(Math.abs(v))}`;
  return "±0";
}

export function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(LOCALE, {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/** Durée « MM:SS » : « 00:03 », « 01:00 », « 05:00 » (grille Minuteur, champ). */
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
export function fmtDay(iso: string): string {
  try {
    const d = new Date(iso);
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const day = new Date(d);
    day.setHours(0, 0, 0, 0);
    const diff = Math.round((midnight.getTime() - day.getTime()) / 86400000);
    if (diff <= 0) return "Aujourd'hui";
    if (diff === 1) return "Hier";
    return d.toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

/** Heure locale avec la seconde exacte : « 14:32:00 ». */
export function fmtSlot(slotSec: number): string {
  const d = new Date(slotSec * 1000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:00`;
}

/** Heure courte locale : « 14:32 ». */
export function fmtHM(slotSec: number): string {
  const d = new Date(slotSec * 1000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
