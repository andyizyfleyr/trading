"use client";

import { useEffect, useState } from "react";
import { apiGetPrice } from "@/lib/api";
import { LIVE_POLL_MS } from "@/lib/config";
import { useOnline } from "./useOnline";

/**
 * Prix des jeux en direct : sondage de /api/price toutes les 4 secondes.
 * (Les jeux n'ont pas de flux temps réel : pas de WebSocket.)
 */
export function useLiveMarket(symbol: string, interval: string) {
  // `interval` : gardé pour l'API (les futurs marchés réels en auront besoin).
  void interval;
  const [price, setPrice] = useState<number | null>(null);
  const online = useOnline();

  useEffect(() => {
    setPrice(null);
    if (!online) return;

    let stopped = false;
    // Garde anti-chevauchement : un appel lent (jusqu'à 15 s) ne doit pas
    // être doublé par le tour suivant, sinon les prix arrivent en désordre.
    let inFlight = false;

    const pollOnce = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const p = await apiGetPrice(symbol);
        if (!stopped) setPrice(p);
      } catch {
        /* on réessaiera au prochain tour */
      } finally {
        inFlight = false;
      }
    };

    pollOnce();
    const timer = setInterval(pollOnce, LIVE_POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [symbol, online]);

  return { price, tickCandle: null, online };
}
