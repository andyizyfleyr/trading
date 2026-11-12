"use client";

import { useEffect, useState } from "react";
import { RING_TICK_MS, RING_URGENT_MS } from "@/lib/config";
import { LAYOUT, RING, RINGTEXT } from "@/lib/design";

/** Compte à rebours circulaire basé sur l'heure de fin serveur. */
export function CountdownRing({
  closesAt,
  durationSec,
  size = RING.big,
}: {
  closesAt: string;
  durationSec: number;
  size?: number;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), RING_TICK_MS);
    return () => clearInterval(t);
  }, []);

  const end = new Date(closesAt).getTime();
  const total = Math.max(1, durationSec * 1000);
  const remaining = Math.max(0, end - now);
  const frac = remaining / total;
  const secs = Math.ceil(remaining / 1000);
  const urgent = remaining <= RING_URGENT_MS;

  const big = size >= RING.bigFrom;
  const stroke = big ? RING.strokeBig : RING.strokeSmall;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  const label =
    remaining <= 0
      ? "Terminé, calcul du résultat…"
      : secs >= 60
        ? `${Math.floor(secs / 60)} min ${String(secs % 60).padStart(2, "0")}`
        : `${secs} s`;

  return (
    <div
      className={LAYOUT.ringWrap}
      style={{ width: size, height: size }}
      role="timer"
      aria-label={`Temps restant : ${label}`}
    >
      <svg width={size} height={size} className={LAYOUT.ringFlip}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={RING.track}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={urgent ? RING.urgent : RING.line}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          className="ring-anim"
        />
      </svg>
      <div className={LAYOUT.ringCenter}>
        <span className={big ? RINGTEXT.numBig : RINGTEXT.numSmall}>
          {remaining <= 0 ? "…" : secs >= 60 ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}` : secs}
        </span>
        <span className={big ? RINGTEXT.unitBig : RINGTEXT.unitSmall}>{remaining <= 0 ? "résultat…" : secs >= 60 ? "min" : "sec"}</span>
      </div>
    </div>
  );
}
