"use client";

import { useEffect, useState } from "react";
import { STORE } from "@/lib/config";
import { FLEX, GUIDE } from "@/lib/design";
import { useLang } from "@/lib/lang-context";
import { DURATIONS, RULES, SYMBOLS, durationLabel } from "@/lib/symbols";
import { Btn } from "./ui";

/**
 * Premier trade guidé : bulles d'aide pas à pas.
 * Textes construits dans le composant (pas en constantes module) pour suivre la langue.
 */
export function GuideBubbles({ onDone }: { onDone: () => void }) {
  const { t } = useLang();
  const [step, setStep] = useState(0);

  const gamesList = SYMBOLS.map((s) => s.base).join(", ");
  const durationsList = DURATIONS.map((d) => durationLabel(d)).join(", ");
  const steps = [
    {
      id: "guide-symbol",
      title: t("1. Choisis un jeu"),
      text: t("Touche « {game} » pour ouvrir la liste des {n} jeux : {list} (badge JEU).", {
        game: SYMBOLS[0].base,
        n: SYMBOLS.length,
        list: gamesList,
      }),
    },
    {
      id: "guide-chart",
      title: t("2. Lis le graphique"),
      text: t("Bougie verte ▲ : le prix a monté. Bougie rouge ▼ : il a baissé."),
    },
    {
      id: "guide-duration",
      title: t("3. Choisis une durée"),
      text: t("{list}. À la fin du compte à rebours, on compare le prix de fin au prix de départ.", {
        list: durationsList,
      }),
    },
    {
      id: "guide-amount",
      title: t("4. Choisis ta mise"),
      text: t("Tape un montant ou ajuste avec − et +. Si tu gagnes : mise rendue + {pct} % de bénéfice.", {
        pct: Math.round(RULES.WIN_PAYOUT_RATIO * 100),
      }),
    },
    {
      id: "guide-buttons",
      title: t("5. Prédis la direction"),
      text: t("Hausse ▲ si ça monte, Baisse ▼ si ça descend. Tes prédictions en cours s'affichent ici : touche la pastille « N en cours » sur le graphique pour les suivre avec leur compte à rebours."),
    },
  ];

  useEffect(() => {
    const el = document.getElementById(steps[step].id);
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

  const current = steps[step];
  const last = step === steps.length - 1;

  return (
    <>
      <div className={GUIDE.veil} aria-hidden="true" />
      <div className={GUIDE.pos}>
        <div className={GUIDE.card}>
          <p className={GUIDE.step}>
            {t("Premier trade guidé · {a}/{b}", { a: step + 1, b: steps.length })}
          </p>
          <p className={GUIDE.title}>{current.title}</p>
          <p className={GUIDE.text}>{current.text}</p>
          <div className={GUIDE.btns}>
            <Btn variant="ghost" onClick={finish} className={FLEX.fill}>
              {t("Passer")}
            </Btn>
            <Btn
              onClick={() => (last ? finish() : setStep((s) => s + 1))}
              className={FLEX.wide}
            >
              {last ? t("C'est parti !") : t("Suivant")}
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
