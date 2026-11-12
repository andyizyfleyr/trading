"use client";

import { useEffect, useMemo, useRef } from "react";
import { Btn } from "./ui";
import { ClockIcon } from "./Icons";

function parseHM(v: string): { hour: number; minute: number } | null {
  const m = /^(\d{2}):(\d{2})$/.exec(v);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

const pad = (n: number) => String(n).padStart(2, "0");
const ROW_H = 40; // hauteur d'une ligne (centrage du défilement)

// Les chiffres s'effacent en haut et en bas, comme un vrai rouleau.
const reelFade = {
  WebkitMaskImage: "linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)",
  maskImage: "linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)",
} as const;

/**
 * Sélecteur d'heure esprit « machine à sous » : deux rouleaux qui défilent
 * dans une fenêtre dorée, affichage lumineux, 24 heures, libellés français.
 * `value` = « HH:MM » ou « » (vide = rien choisi).
 */
export function TimePickerPanel({
  value,
  onChange,
  onConfirm,
}: {
  value: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
}) {
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);
  const parsed = parseHM(value);
  const now = new Date();
  const selHour = parsed?.hour ?? now.getHours();
  const selMinute = parsed?.minute ?? now.getMinutes();

  const hourRef = useRef<HTMLDivElement>(null);
  const minuteRef = useRef<HTMLDivElement>(null);

  // Centre chaque rouleau sur sa ligne choisie.
  useEffect(() => {
    const hourEl = hourRef.current;
    if (hourEl) hourEl.scrollTop = selHour * ROW_H;
    const minuteEl = minuteRef.current;
    if (minuteEl) minuteEl.scrollTop = selMinute * ROW_H;
  }, [selHour, selMinute]);

  const set = (hour: number, minute: number) => onChange(`${pad(hour)}:${pad(minute)}`);
  const setNow = () => {
    const d = new Date();
    onChange(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
  };

  const renderReel = (
    items: number[],
    selected: number,
    onPick: (v: number) => void,
    label: string,
    listRef: React.RefObject<HTMLDivElement>
  ) => (
    <div className="relative min-w-0 flex-1">
      <div
        ref={listRef}
        role="listbox"
        aria-label={label}
        style={reelFade}
        className="h-40 snap-y snap-mandatory overflow-y-auto rounded-xl border border-ligne bg-black/40 py-[60px]"
      >
        {items.map((v) => {
          const active = v === selected;
          return (
            <button
              key={v}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => onPick(v)}
              className={`flex h-10 w-full snap-center items-center justify-center tabular-nums ${
                active
                  ? "text-lg font-black text-amber-300"
                  : "text-base font-bold text-doux/60 active:text-texte"
              }`}
            >
              {pad(v)}
            </button>
          );
        })}
      </div>
      {/* Fenêtre dorée : la ligne gagnante */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-1 top-1/2 h-10 -translate-y-1/2 rounded-lg border border-amber-300/60 bg-amber-300/10 shadow-[0_0_16px_rgba(251,191,36,0.25)]"
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      {/* Affichage lumineux */}
      <div className="rounded-xl border border-ligne bg-black/50 px-3 py-1.5 text-center">
        <p className="text-xs font-bold tracking-widest text-doux">HEURE DE TA MISE</p>
        <p
          className="text-3xl font-black tabular-nums text-amber-300 [text-shadow:0_0_14px_rgba(251,191,36,0.5)]"
          aria-live="polite"
        >
          {pad(selHour)}:{pad(selMinute)}
        </p>
      </div>

      {/* Rouleaux */}
      <div>
        <div className="mb-1 flex gap-2" aria-hidden="true">
          <p className="flex-1 text-center text-xs font-bold tracking-widest text-doux">HEURES</p>
          <p className="flex-1 text-center text-xs font-bold tracking-widest text-doux">MINUTES</p>
        </div>
        <div className="relative">
          <div className="flex gap-2">
            {renderReel(hours, selHour, (h) => set(h, selMinute), "Heures", hourRef)}
            {renderReel(minutes, selMinute, (m) => set(selHour, m), "Minutes", minuteRef)}
          </div>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xl font-black text-amber-300 [text-shadow:0_0_10px_rgba(251,191,36,0.5)]"
          >
            :
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <Btn variant="ghost" onClick={setNow} className="min-h-[44px] w-full font-extrabold">
          <span className="flex items-center justify-center gap-1.5">
            <ClockIcon className="h-4 w-4" />
            Maintenant
          </span>
        </Btn>
        <Btn variant="ghost" onClick={() => onChange("")} className="min-h-[44px] w-full font-extrabold">
          Effacer
        </Btn>
      </div>
      <Btn onClick={onConfirm} className="min-h-[48px] w-full text-base font-extrabold">
        {value === "" ? "Revenir à Maintenant" : `Valider ${value} →`}
      </Btn>
    </div>
  );
}
