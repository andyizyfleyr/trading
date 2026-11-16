"use client";

import { useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/lang-context";
import { DEFAULT_CURRENCY, formatMoney, isCurrency } from "@/lib/money";

/**
 * Montants dans la devise de l'utilisateur : money(100) → « 60 348 F ».
 * Tout est stocké en USD : la conversion n'a lieu qu'à l'affichage.
 * La ponctuation suit la langue (1 000 / 1,000 / 1000).
 */
export function useMoney() {
  const { user } = useAuth();
  const { lang } = useLang();
  const currency = user && isCurrency(user.currency) ? user.currency : DEFAULT_CURRENCY;
  return useMemo(
    () => ({ currency, money: (usd: number) => formatMoney(usd, currency, lang) }),
    [currency, lang]
  );
}
