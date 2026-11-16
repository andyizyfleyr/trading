"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { STORE } from "./config";
import { INK_DARK, INK_LIGHT, type ThemeInk, type ThemeMode } from "./design";

interface ThemeCtx {
  theme: ThemeMode;
  isLight: boolean;
  ink: ThemeInk;
  setTheme: (next: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeCtx>({
  theme: "dark",
  isLight: false,
  ink: INK_DARK,
  setTheme: () => {},
  toggleTheme: () => {},
});

function applyDomTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (mode === "light") root.setAttribute("data-theme", "light");
  else root.removeAttribute("data-theme");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", mode === "light" ? INK_LIGHT.fond : INK_DARK.fond);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("dark");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORE.theme);
      const initial: ThemeMode = saved === "light" ? "light" : "dark";
      setThemeState(initial);
      applyDomTheme(initial);
    } catch {
      /* ignore */
    }
  }, []);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
    applyDomTheme(next);
    try {
      window.localStorage.setItem(STORE.theme, next);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: ThemeMode = prev === "light" ? "dark" : "light";
      applyDomTheme(next);
      try {
        window.localStorage.setItem(STORE.theme, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = useMemo<ThemeCtx>(
    () => ({
      theme,
      isLight: theme === "light",
      ink: theme === "light" ? INK_LIGHT : INK_DARK,
      setTheme,
      toggleTheme,
    }),
    [theme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
