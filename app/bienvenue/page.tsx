"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ROUTES } from "@/lib/config";
import { AUTH, FLEX, INK } from "@/lib/design";
import { fmtMoney } from "@/lib/format";
import { RULES } from "@/lib/symbols";
import { Btn } from "@/components/ui";

/** Petites illustrations SVG (légères, pas d'images à télécharger). */
function SlideArt({ variant }: { variant: number }) {
  if (variant === 0) {
    return (
      <svg viewBox="0 0 200 140" className={AUTH.art} aria-hidden="true">
        <rect x="30" y="70" width="16" height="40" rx="3" fill={INK.hausse} />
        <rect x="36" y="58" width="4" height="64" fill={INK.hausse} />
        <rect x="62" y="50" width="16" height="46" rx="3" fill={INK.hausse} />
        <rect x="68" y="40" width="4" height="66" fill={INK.hausse} />
        <rect x="94" y="66" width="16" height="42" rx="3" fill={INK.baisse} />
        <rect x="100" y="52" width="4" height="66" fill={INK.baisse} />
        <rect x="126" y="34" width="16" height="50" rx="3" fill={INK.hausse} />
        <rect x="132" y="24" width="4" height="70" fill={INK.hausse} />
        <rect x="158" y="52" width="16" height="38" rx="3" fill={INK.baisse} />
        <rect x="164" y="42" width="4" height="58" fill={INK.baisse} />
        <text x="100" y="130" textAnchor="middle" fill={INK.doux} fontSize="14">
          ▲ monte · ▼ descend
        </text>
      </svg>
    );
  }
  if (variant === 1) {
    return (
      <svg viewBox="0 0 200 140" className={AUTH.art} aria-hidden="true">
        <path
          d="M10 110 L50 90 L80 100 L120 60 L150 70 L190 30"
          fill="none"
          stroke={INK.action}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="190" cy="30" r="7" fill={INK.hausse} />
        <text x="100" y="130" textAnchor="middle" fill={INK.doux} fontSize="14">
          prix en direct
        </text>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 200 140" className={AUTH.art} aria-hidden="true">
      <rect x="55" y="25" width="90" height="70" rx="10" fill={INK.carte} stroke={INK.action} strokeWidth="3" />
      <text x="100" y="58" textAnchor="middle" fill={INK.texte} fontSize="22" fontWeight="800">
        {fmtMoney(RULES.START_BALANCE)}
      </text>
      <text x="100" y="80" textAnchor="middle" fill={INK.doux} fontSize="13">
        pour t&apos;entraîner
      </text>
      <path d="M85 108l10 10 20-22" fill="none" stroke={INK.hausse} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const SLIDES = [
  {
    title: "Prédis si le prix monte ou descend",
    text: "Regarde le graphique en bougies, choisis une durée et une mise, puis touche HAUSSE ▲ ou BAISSE ▼.",
  },
  {
    title: "3 jeux, 100 % hasard",
    text: "Lucky 7, Jackpot et Turbo : des jeux de hasard pur, sans lien avec les vrais marchés.",
  },
  {
    title: "Apprends sans risque",
    text: `Tu commences avec ${fmtMoney(RULES.START_BALANCE)} pour t'entraîner. Aucun argent réel, jamais.`,
  },
];

export default function BienvenuePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [slide, setSlide] = useState(0);
  const last = slide === SLIDES.length - 1;

  const finish = () => {
    router.replace(user ? ROUTES.trader : ROUTES.signup);
  };

  return (
    <div className={AUTH.shell}>
      <div className={AUTH.topRow}>
        <div className={AUTH.brandRow}>
          <span className={AUTH.brandMark}>
            <span className={AUTH.brandUp}>▲</span>
            <span className={AUTH.brandDown}>▼</span>
          </span>
          <span className={AUTH.brandName}>TradeFacile</span>
        </div>
        {!last && (
          <button
            type="button"
            onClick={finish}
            className={AUTH.skip}
          >
            Passer
          </button>
        )}
      </div>

      <div key={slide} className={AUTH.slideBox}>
        <SlideArt variant={slide} />
        <h1 className={AUTH.title}>{SLIDES[slide].title}</h1>
        <p className={AUTH.slideText}>{SLIDES[slide].text}</p>
      </div>

      <div className={AUTH.dots} aria-label={`Écran ${slide + 1} sur ${SLIDES.length}`}>
        {SLIDES.map((_, i) => (
          <span
            key={i}
            className={i === slide ? AUTH.dotOn : AUTH.dotOff}
          />
        ))}
      </div>

      <div className={AUTH.bottomBar}>
        {slide > 0 && (
          <Btn variant="ghost" onClick={() => setSlide((s) => s - 1)} className={FLEX.fill}>
            Retour
          </Btn>
        )}
        <Btn onClick={() => (last ? finish() : setSlide((s) => s + 1))} className={FLEX.wide}>
          {last ? "Commencer" : "Suivant"}
        </Btn>
      </div>
    </div>
  );
}
