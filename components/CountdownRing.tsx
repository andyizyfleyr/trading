"use client";

import { useEffect, useState } from "react";

/** Compte à rebours circulaire basé sur l'heure de fin serveur. */
export function CountdownRing({
  closesAt,
  durationSec,
  size = 84,
}: {
  closesAt: string;
  durationSec: number;
  size?: number;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  const end = new Date(closesAt).getTime();
  const total = Math.max(1, durationSec * 1000);
  const remaining = Math.max(0, end - now);
  const frac = remaining / total;
  const secs = Math.ceil(remaining / 1000);
  const urgent = remaining <= 10_000;

  const stroke = size >= 76 ? 8 : 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const big = size >= 76;

  const label =
    remaining <= 0
      ? "Terminé, calcul du résultat…"
      : secs >= 60
        ? `${Math.floor(secs / 60)} min ${String(secs % 60).padStart(2, "0")}`
        : `${secs} s`;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="timer"
      aria-label={`Temps restant : ${label}`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#1E2A44"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={urgent ? "#EF4444" : "#3B82F6"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          className="ring-anim"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`${big ? "text-lg" : "text-base"} font-extrabold tabular-nums leading-none`}>
          {remaining <= 0 ? "…" : secs >= 60 ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}` : secs}
        </span>
        <span className={`${big ? "text-xs" : "text-[10px]"} font-semibold text-doux`}>{remaining <= 0 ? "résultat…" : secs >= 60 ? "min" : "sec"}</span>
      </div>
    </div>
  );
}
