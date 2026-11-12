"use client";

import { useEffect, useState } from "react";
import { apiServerTime } from "@/lib/api";
import { CLOCK_SYNC_MS } from "@/lib/config";

/**
 * Écart d'horloge avec le serveur (ms), null tant que non mesuré.
 * Une seule mesure partagée : clôtures, programmées, anneaux et signaux
 * parlent tous de la même heure (l'heure serveur), pas de l'horloge
 * du téléphone qui peut être fausse.
 */
export function useServerOffset(): number | null {
  const [offsetMs, setOffsetMs] = useState<number | null>(null);

  useEffect(() => {
    let stopped = false;
    const sync = async () => {
      const t0 = Date.now();
      try {
        const serverTime = await apiServerTime();
        if (!stopped && Number.isFinite(serverTime)) {
          setOffsetMs(serverTime - (t0 + Date.now()) / 2);
        }
      } catch {
        /* horloge locale en secours */
      }
    };
    sync();
    const t = setInterval(sync, CLOCK_SYNC_MS);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, []);

  return offsetMs;
}
