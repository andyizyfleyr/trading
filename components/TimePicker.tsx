"use client";

import { useEffect, useMemo, useRef } from "react";
import { Btn } from "./ui";

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

/**
 * Sélecteur d'heure façon ReUI (colonnes heures/minutes à faire défiler,
 * avec Maintenant, Effacer et rappel en direct), adapté à l'app :
 * 24 heures, libellés français, sans dépendance lourde.
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

  // Centre chaque colonne sur sa ligne choisie.
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

  const renderColumn = (
    items: number[],
    selected: number,
    onPick: (v: number) => void,
    label: string,
    listRef: React.RefObject<HTMLDivElement>
  ) => (
    <div className="min-w-0 flex-1">
      <p className="mb-1 text-center text-xs font-bold text-doux">{label}</p>
      <div
        ref={listRef}
        role="listbox"
        aria-label={label}
        className="h-40 snap-y snap-mandatory overflow-y-auto rounded-xl bg-fond py-[60px]"
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
              className={`flex h-10 w-full snap-center items-center justify-center text-base font-extrabold tabular-nums ${
                active ? "bg-primary text-white" : "text-doux active:text-texte"
              }`}
            >
              {pad(v)}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-center text-2xl font-extrabold tabular-nums" aria-live="polite">
        {pad(selHour)}:{pad(selMinute)}
      </p>
      <div className="flex gap-2">
        {renderColumn(hours, selHour, (h) => set(h, selMinute), "Heures", hourRef)}
        {renderColumn(minutes, selMinute, (m) => set(selHour, m), "Minutes", minuteRef)}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <Btn variant="ghost" onClick={setNow} className="min-h-[44px] w-full font-extrabold">
          Maintenant
        </Btn>
        <Btn variant="ghost" onClick={() => onChange("")} className="min-h-[44px] w-full font-extrabold">
          Effacer
        </Btn>
      </div>
      <Btn onClick={onConfirm} className="min-h-[48px] w-full text-base font-extrabold">
        {value === "" ? "Revenir à Maintenant" : `Valider ${value}`}
      </Btn>
    </div>
  );
}
