"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "./auth-context";
import { apiSetLang, getToken } from "./api";
import { STORE } from "./config";
import { browserLang } from "./geo";
import { isLang, tr, type Lang } from "./i18n";

interface LangState {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** t("Voir les {n} prédictions", { n: 3 }) — français si traduction manque. */
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const LangContext = createContext<LangState | null>(null);

function readLocal(): Lang {
  try {
    const v = window.localStorage.getItem(STORE.lang);
    // Première visite : langue du navigateur (pas toujours le français).
    return isLang(v) ? v : browserLang();
  } catch {
    return "fr";
  }
}

export function LangProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [lang, setLangState] = useState<Lang>(readLocal);

  // Appliqué aussitôt (<html lang> pour les lecteurs d'écran, titre de
  // l'onglet traduit) + mémorisé.
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = tr(lang, "TradeFacile — Prédis si le prix monte ou descend");
    try {
      window.localStorage.setItem(STORE.lang, lang);
    } catch {
      /* stockage indisponible : la langue reste pour la session */
    }
  }, [lang]);

  // Compte connecté : la langue du serveur gagne (même langue partout).
  const serverLang = user && isLang(user.lang) ? user.lang : null;
  useEffect(() => {
    if (serverLang) setLangState(serverLang);
  }, [serverLang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    if (getToken()) {
      apiSetLang(next).catch(() => {
        /* hors ligne : le local suffit, re-sync à la prochaine visite */
      });
    }
  }, []);

  const t = useCallback((key: string, vars?: Record<string, string | number>) => tr(lang, key, vars), [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangState {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang doit être utilisé dans <LangProvider>.");
  return ctx;
}
