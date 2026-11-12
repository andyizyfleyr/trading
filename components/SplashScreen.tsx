"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { SPLASH_FADE_MS, SPLASH_MIN_MS, SPLASH_TIP_MS } from "@/lib/config";
import { INK, SPLASH } from "@/lib/design";
import { RULES } from "@/lib/symbols";

/** Mini-bougies vertes/rouges du chargeur (couleurs du jeu). */
const CANDLES = [INK.hausse, INK.hausse, INK.baisse, INK.hausse, INK.baisse, INK.baisse, INK.hausse];
/** Hauteur de base des bougies (l'animation les étire de 25 % à 100 %). */
const CANDLE_H = 40;
/** Décalage d'animation entre deux bougies (vague de gauche à droite). */
const CANDLE_STAGGER_S = 0.12;

function tips(): string[] {
  return [
    "Astuce : programme tes mises à l'avance, elles partent toutes seules.",
    "Égalité ? Ta mise est rendue.",
    `Si tu gagnes : mise rendue + ${Math.round(RULES.WIN_PAYOUT_RATIO * 100)} % de bénéfice.`,
  ];
}

/** Écran d'ouverture : logo + bougies animées + astuce, le temps que ça charge. */
export function SplashScreen({ leaving }: { leaving: boolean }) {
  const [tip, setTip] = useState(0);
  const list = tips();

  // Sur les réseaux lents, les astuces défilent (sinon l'attente semble figée).
  useEffect(() => {
    if (leaving) return;
    const t = setInterval(() => setTip((i) => (i + 1) % list.length), SPLASH_TIP_MS);
    return () => clearInterval(t);
  }, [leaving, list.length]);

  return (
    <div
      role="status"
      aria-label="Chargement de TradeFacile…"
      className={`${SPLASH.root} ${leaving ? "opacity-0" : "opacity-100"}`}
      style={{ transitionDuration: `${SPLASH_FADE_MS}ms` }}
    >
      <div className={SPLASH.mark} aria-hidden="true">
        <span className={SPLASH.up}>▲</span>
        <span className={SPLASH.down}>▼</span>
      </div>
      <p className={SPLASH.name}>TradeFacile</p>
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
      <p className={SPLASH.loading}>Chargement…</p>
      <p className={SPLASH.tip}>{list[tip]}</p>
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
