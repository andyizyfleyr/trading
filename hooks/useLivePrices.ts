"use client";

import { useEffect, useState } from "react";
import { apiGetPrice } from "@/lib/api";
import { LIVE_POLL_MS } from "@/lib/config";
import { useOnline } from "./useOnline";

/**
 * Prix en direct de plusieurs jeux (panneau « En cours » quand on joue sur
 * plusieurs jeux à la fois). Sans cela, les trades des autres jeux
 * affichent « … » et « = » en permanence, sans explication.
 */
export function useLivePrices(symbols: string[]): Record<string, number> {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const online = useOnline();
  const key = [...symbols].sort().join(",");

  useEffect(() => {
    setPrices({});
    const list = key === "" ? [] : key.split(",");
    if (!online || list.length === 0) return;

    let stopped = false;
    // Garde anti-chevauchement : un tour lent ne doit pas être doublé.
    let inFlight = false;

    const pollOnce = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const entries = await Promise.all(
          list.map(async (s) => [s, await apiGetPrice(s)] as const)
        );
        if (!stopped) {
          const next: Record<string, number> = {};
          for (const [s, p] of entries) next[s] = p;
          setPrices(next);
        }
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
    // `key` résume la liste (un tableau change d'identité à chaque rendu).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, online]);

  return prices;
}
