"use client";

import { useEffect, useState } from "react";
import { Btn } from "./ui";

const STEPS = [
  {
    id: "guide-symbol",
    title: "1. Choisis un actif",
    text: "Touche « BTC/USDT » pour ouvrir la liste : Bitcoin, Ethereum… Les prix sont réels.",
  },
  {
    id: "guide-chart",
    title: "2. Lis le graphique",
    text: "Bougie verte ▲ : le prix a monté. Bougie rouge ▼ : il a baissé.",
  },
  {
    id: "guide-duration",
    title: "3. Choisis une durée",
    text: "30 secondes, 1 minute ou 5 minutes. À la fin du compte à rebours, on compare le prix de fin au prix de départ.",
  },
  {
    id: "guide-amount",
    title: "4. Choisis ta mise",
    text: "Tape un montant ou touche 10, 50, 100 ou Max (10 % du solde). Gain : mise + 85 %.",
  },
  {
    id: "guide-buttons",
    title: "5. Prédis la direction",
    text: "ACHAT ▲ si ça monte, VENTE ▼ si ça descend. Tes prédictions apparaissent dans le bouton « En cours ».",
  },
];

const GUIDE_KEY = "tf_guide";

/** Premier trade guidé : bulles d'aide pas à pas. */
export function GuideBubbles({
  onDone,
  onStep,
}: {
  onDone: () => void;
  onStep?: (step: number) => void;
}) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    onStep?.(step);
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
      window.localStorage.setItem(GUIDE_KEY, "1");
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
      <div className="pointer-events-none fixed inset-0 z-40 bg-fond/60" aria-hidden="true" />
      <div className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-xl">
        <div className="anim-in rounded-2xl border border-action bg-carte p-4 shadow-2xl">
          <p className="text-sm font-semibold text-doux">
            Premier trade guidé · {step + 1}/{STEPS.length}
          </p>
          <p className="mt-1 text-lg font-extrabold">{current.title}</p>
          <p className="mt-1 text-base text-texte">{current.text}</p>
          <div className="mt-3 flex gap-2">
            <Btn variant="ghost" onClick={finish} className="flex-1">
              Passer
            </Btn>
            <Btn
              onClick={() => (last ? finish() : setStep((s) => s + 1))}
              className="flex-[2]"
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
    return window.localStorage.getItem(GUIDE_KEY) === "1";
  } catch {
    return true;
  }
}
