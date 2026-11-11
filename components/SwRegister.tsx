"use client";

import { useEffect } from "react";

/** Enregistre le service worker (PWA installable + fonctionnement hors ligne). */
export function SwRegister() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    ) {
      return;
    }
    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js");
      } catch {
        /* PWA optionnelle : l'app fonctionne sans */
      }
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
