"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/lang-context";
import { SPLASH_FADE_MS, SPLASH_MIN_MS } from "@/lib/config";
import { INK, SPLASH } from "@/lib/design";

/** Mini-bougies vertes/rouges du chargeur (couleurs du jeu). */
const CANDLES = [INK.hausse, INK.hausse, INK.baisse, INK.hausse, INK.baisse, INK.baisse, INK.hausse];
/** Hauteur de base des bougies (l'animation les étire de 25 % à 100 %). */
const CANDLE_H = 40;
/** Décalage d'animation entre deux bougies (vague de gauche à droite). */
const CANDLE_STAGGER_S = 0.12;

/** Écran d'ouverture : bougies animées seules, le temps que ça charge. */
export function SplashScreen({ leaving }: { leaving: boolean }) {
  const { t } = useLang();
  return (
    <div
      role="status"
      aria-label={t("Chargement de TradeFacile…")}
      className={`${SPLASH.root} ${leaving ? "opacity-0" : "opacity-100"}`}
      style={{ transitionDuration: `${SPLASH_FADE_MS}ms` }}
    >
      <div className={SPLASH.candles} aria-hidden="true">
        {CANDLES.map((color, i) => (
          <span
            key={i}
            className={SPLASH.candle}
            style={{
              height: CANDLE_H,
              backgroundColor: color,
              animationDelay: `${i * CANDLE_STAGGER_S}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Affiche le splash pendant la validation de la session (toutes les pages).
 * Minimum 900 ms : sans cela, il flashe et fait plus cheap que pas de splash.
 */
export function SplashGate() {
  const { loading } = useAuth();
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const startRef = useRef(0);

  useEffect(() => {
    startRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (loading) return;
    const elapsed = Date.now() - (startRef.current || Date.now());
    const wait = Math.max(0, SPLASH_MIN_MS - elapsed);
    const t1 = setTimeout(() => setLeaving(true), wait);
    const t2 = setTimeout(() => setVisible(false), wait + SPLASH_FADE_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [loading]);

  if (!visible) return null;
  return <SplashScreen leaving={leaving} />;
}
