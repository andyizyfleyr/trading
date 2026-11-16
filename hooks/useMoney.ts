"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/lang-context";
import { STORE } from "@/lib/config";
import { DEFAULT_CURRENCY, formatMoney, isCurrency, type CurrencyCode } from "@/lib/money";

/** Devise devinée mémorisée (visiteur, géolocalisation). */
function readGeo(): CurrencyCode | null {
  try {
    const v = window.localStorage.getItem(STORE.geo);
    return isCurrency(v) ? v : null;
  } catch {
    return null;
  }
}

/** Un seul appel /api/geo même si plusieurs composants affichent des montants. */
let geoPromise: Promise<CurrencyCode | null> | null = null;
function fetchGeo(): Promise<CurrencyCode | null> {
  if (!geoPromise) {
    geoPromise = fetch("/api/geo")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const cur: unknown = j?.data?.currency;
        return isCurrency(cur) ? cur : null;
      })
      .catch(() => null);
  }
  return geoPromise;
}

/**
 * Montants dans la devise de l'utilisateur : money(100) → « 60 348 ₣ ».
 * Tout est stocké en USD : la conversion n'a lieu qu'à l'affichage.
 * Sans compte : devise devinée (géolocalisation), sinon USD.
 * La ponctuation suit la langue (1 000 / 1,000 / 1000).
 */
export function useMoney() {
  const { user } = useAuth();
  const { lang } = useLang();
  const [geoCur, setGeoCur] = useState<CurrencyCode | null>(readGeo);

  useEffect(() => {
    if (user || geoCur) return; // compte : sa devise ; déjà devinée : rien à faire
    let alive = true;
    fetchGeo().then((cur) => {
      if (!alive || !cur) return;
      setGeoCur(cur);
      try {
        window.localStorage.setItem(STORE.geo, cur);
      } catch {
        /* stockage indisponible : on re-devinera à la prochaine visite */
      }
    });
    return () => {
      alive = false;
    };
  }, [user, geoCur]);

  const userCur = user && isCurrency(user.currency) ? user.currency : null;
  const currency = userCur ?? geoCur ?? DEFAULT_CURRENCY;
  return useMemo(
    () => ({ currency, money: (usd: number) => formatMoney(usd, currency, lang) }),
    [currency, lang]
  );
}
