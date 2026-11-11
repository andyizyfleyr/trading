/** Formatages : français simple, chiffres à largeur fixe (via CSS tabular-nums). */

const moneyFmt = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

export function fmtMoney(n: number): string {
  return moneyFmt.format(Number(n) || 0);
}

/** Prix avec un nombre de décimales adapté à l'ordre de grandeur. */
export function fmtPrice(p: number): string {
  const v = Number(p) || 0;
  const d = v >= 100 ? 2 : v >= 1 ? 4 : 5;
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(v);
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
    return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function symbolBase(symbol: string): string {
  return symbol.endsWith("USDT") ? symbol.slice(0, -4) : symbol;
}
