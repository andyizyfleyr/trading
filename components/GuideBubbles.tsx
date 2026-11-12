"use client";

import { useEffect, useState } from "react";
import { STORE } from "@/lib/config";
import { FLEX, GUIDE } from "@/lib/design";
import { DURATIONS, RULES, SYMBOLS, durationLabel } from "@/lib/symbols";
import { Btn } from "./ui";

const GAMES_LIST = SYMBOLS.map((s) => s.base).join(", ");
const DURATIONS_LIST = DURATIONS.map((d) => durationLabel(d)).join(", ");

const STEPS = [
  {
    id: "guide-symbol",
    title: "1. Choisis un jeu",
    text: `Touche « ${SYMBOLS[0].base} » pour ouvrir la liste des ${SYMBOLS.length} jeux : ${GAMES_LIST} (badge JEU).`,
  },
  {
    id: "guide-chart",
    title: "2. Lis le graphique",
    text: "Bougie verte ▲ : le prix a monté. Bougie rouge ▼ : il a baissé.",
  },
  {
    id: "guide-duration",
    title: "3. Choisis une durée",
    text: `${DURATIONS_LIST}. À la fin du compte à rebours, on compare le prix de fin au prix de départ.`,
  },
  {
    id: "guide-amount",
    title: "4. Choisis ta mise",
    text: `Tape un montant ou ajuste avec \u2212 et +. Gain potentiel : mise + ${Math.round(RULES.WIN_PAYOUT_RATIO * 100)} %.`,
  },
  {
    id: "guide-buttons",
    title: "5. Prédis la direction",
    text: "ACHAT ▲ si ça monte, VENTE ▼ si ça descend. Tes prédictions en cours s'affichent avec leur compte à rebours.",
  },
];

/** Premier trade guidé : bulles d'aide pas à pas. */
export function GuideBubbles({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const el = document.getElementById(STEPS[step].id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("guide-spot");
    }
    return () => {
      document.querySelectorAll(".guide-spot").forEach((n) => n.classList.remove("guide-spot"));
    };
  }, [step]);

  const finish = () => {
    try {
      window.localStorage.setItem(STORE.guide, "1");
    } catch {
      /* ignore */
    }
    document.querySelectorAll(".guide-spot").forEach((n) => n.classList.remove("guide-spot"));
    onDone();
  };

  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <>
      <div className={GUIDE.veil} aria-hidden="true" />
      <div className={GUIDE.pos}>
        <div className={GUIDE.card}>
          <p className={GUIDE.step}>
            Premier trade guidé · {step + 1}/{STEPS.length}
          </p>
          <p className={GUIDE.title}>{current.title}</p>
          <p className={GUIDE.text}>{current.text}</p>
          <div className={GUIDE.btns}>
            <Btn variant="ghost" onClick={finish} className={FLEX.fill}>
              Passer
            </Btn>
            <Btn
              onClick={() => (last ? finish() : setStep((s) => s + 1))}
              className={FLEX.wide}
            >
              {last ? "C'est parti !" : "Suivant"}
            </Btn>
          </div>
        </div>
      </div>
    </>
  );
}

export function hasSeenGuide(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(STORE.guide) === "1";
  } catch {
    return true;
  }
}
