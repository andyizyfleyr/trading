"use client";

import { useMemo } from "react";
import { TIME_SLOT_COUNT, TIME_SLOT_MARGIN_SEC, TIME_SLOT_STEP_MIN } from "@/lib/config";
import { BTN, FLEX, STACK, TIME, TRADER } from "@/lib/design";
import { fmtHM } from "@/lib/format";
import { Btn } from "./ui";

function parseHM(v: string): { hour: number; minute: number } | null {
  const m = /^(\d{2}):(\d{2})$/.exec(v);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

/** « HH:MM » → prochaine occurrence (aujourd'hui, ou demain si l'heure est passée). */
function nextOccurrence(hour: number, minute: number, fromMs: number): number {
  const d = new Date(fromMs);
  d.setHours(hour, minute, 0, 0);
  let slot = Math.floor(d.getTime() / 1000);
  if (slot * 1000 <= fromMs) slot += 24 * 3600;
  return slot;
}

/** Le créneau tombe-t-il un autre jour calendaire (ex. 00:15 quand il est 23:50) ? */
function isNextDay(slot: number, fromMs: number): boolean {
  return new Date(slot * 1000).getDate() !== new Date(fromMs).getDate();
}

/**
 * Liste des prochaines heures : on touche une heure, on valide.
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
  const { list, selected } = useMemo(() => {
    const nowMs = Date.now();
    const step = TIME_SLOT_STEP_MIN * 60;
    const first = Math.ceil((nowMs + TIME_SLOT_MARGIN_SEC * 1000) / (step * 1000)) * step;
    const slots = Array.from({ length: TIME_SLOT_COUNT }, (_, i) => first + i * step);
    // Choix précédent hors liste (panneau rouvert) : on le garde, trié avec les autres.
    const preset = parseHM(value);
    const sel = preset ? nextOccurrence(preset.hour, preset.minute, nowMs) : null;
    if (sel != null && !slots.includes(sel)) {
      slots.push(sel);
      slots.sort((a, b) => a - b);
    }
    return { list: slots, selected: sel };
  }, [value]);

  const selectedTomorrow = selected != null && isNextDay(selected, Date.now());

  // Retoucher l'heure choisie = la désélectionner.
  const toggle = (slot: number) => onChange(slot === selected ? "" : fmtHM(slot));

  return (
    <div className={STACK.c2}>
      <div className={TIME.box}>
        <div className={TIME.grid} role="group" aria-label="Heures proposées">
          {list.map((s) => {
            const active = s === selected;
            const label = fmtHM(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggle(s)}
                aria-pressed={active}
                aria-label={isNextDay(s, Date.now()) ? `demain ${label}` : label}
                className={`${active ? TRADER.chipOn : TRADER.chipOff} ${FLEX.fill}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
      <Btn onClick={onConfirm} className={BTN.block}>
        {value === ""
          ? "Revenir à Maintenant"
          : selectedTomorrow
            ? `Valider demain ${value} →`
            : `Valider ${value} →`}
      </Btn>
    </div>
  );
}
