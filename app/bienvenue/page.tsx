"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Btn } from "@/components/ui";

/** Petites illustrations SVG (légères, pas d'images à télécharger). */
function SlideArt({ variant }: { variant: number }) {
  if (variant === 0) {
    return (
      <svg viewBox="0 0 200 140" className="h-40 w-full" aria-hidden="true">
        <rect x="30" y="70" width="16" height="40" rx="3" fill="#22C55E" />
        <rect x="36" y="58" width="4" height="64" fill="#22C55E" />
        <rect x="62" y="50" width="16" height="46" rx="3" fill="#22C55E" />
        <rect x="68" y="40" width="4" height="66" fill="#22C55E" />
        <rect x="94" y="66" width="16" height="42" rx="3" fill="#EF4444" />
        <rect x="100" y="52" width="4" height="66" fill="#EF4444" />
        <rect x="126" y="34" width="16" height="50" rx="3" fill="#22C55E" />
        <rect x="132" y="24" width="4" height="70" fill="#22C55E" />
        <rect x="158" y="52" width="16" height="38" rx="3" fill="#EF4444" />
        <rect x="164" y="42" width="4" height="58" fill="#EF4444" />
        <text x="100" y="130" textAnchor="middle" fill="#9CA3AF" fontSize="14">
          ▲ monte · ▼ descend
        </text>
      </svg>
    );
  }
  if (variant === 1) {
    return (
      <svg viewBox="0 0 200 140" className="h-40 w-full" aria-hidden="true">
        <path
          d="M10 110 L50 90 L80 100 L120 60 L150 70 L190 30"
          fill="none"
          stroke="#3B82F6"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="190" cy="30" r="7" fill="#22C55E" />
        <text x="100" y="130" textAnchor="middle" fill="#9CA3AF" fontSize="14">
          prix en direct
        </text>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 200 140" className="h-40 w-full" aria-hidden="true">
      <rect x="55" y="25" width="90" height="70" rx="10" fill="#131A2E" stroke="#3B82F6" strokeWidth="3" />
      <text x="100" y="58" textAnchor="middle" fill="#E5E7EB" fontSize="22" fontWeight="800">
        10 000
      </text>
      <text x="100" y="80" textAnchor="middle" fill="#9CA3AF" fontSize="13">
        pour t&apos;entraîner
      </text>
      <path d="M85 108l10 10 20-22" fill="none" stroke="#22C55E" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const SLIDES = [
  {
    title: "Prédis si le prix monte ou descend",
    text: "Regarde le graphique en bougies, choisis une durée et une mise, puis touche ACHAT ▲ ou VENTE ▼.",
  },
  {
    title: "De vrais prix, en direct",
    text: "Bitcoin, Ethereum et d'autres actifs : les prix viennent du marché en temps réel, jamais inventés.",
  },
  {
    title: "Apprends sans risque",
    text: "Tu commences avec 10 000 pour t'entraîner. Des cours simples t'expliquent tout, pas à pas.",
  },
];

export default function BienvenuePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [slide, setSlide] = useState(0);
  const last = slide === SLIDES.length - 1;

  const finish = () => {
    router.replace(user ? "/" : "/inscription");
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-carte text-lg font-extrabold">
            <span className="text-hausse">▲</span>
            <span className="text-baisse">▼</span>
          </span>
          <span className="text-xl font-extrabold">TradeFacile</span>
        </div>
        {!last && (
          <button
            type="button"
            onClick={finish}
            className="min-h-[48px] px-3 text-base font-semibold text-doux active:text-texte"
          >
            Passer
          </button>
        )}
      </div>

      <div key={slide} className="anim-in flex flex-1 flex-col justify-center gap-4 py-8 text-center">
        <SlideArt variant={slide} />
        <h1 className="text-2xl font-extrabold">{SLIDES[slide].title}</h1>
        <p className="text-lg text-doux">{SLIDES[slide].text}</p>
      </div>

      <div className="flex items-center justify-center gap-2 pb-6" aria-label={`Écran ${slide + 1} sur 3`}>
        {SLIDES.map((_, i) => (
          <span
            key={i}
            className={`h-2 rounded-full transition-all duration-200 ${i === slide ? "w-8 bg-action" : "w-2 bg-ligne"}`}
          />
        ))}
      </div>

      <div className="safe-bottom flex gap-2 pb-2">
        {slide > 0 && (
          <Btn variant="ghost" onClick={() => setSlide((s) => s - 1)} className="flex-1">
            Retour
          </Btn>
        )}
        <Btn onClick={() => (last ? finish() : setSlide((s) => s + 1))} className="flex-[2]">
          {last ? "Commencer" : "Suivant"}
        </Btn>
      </div>
    </div>
  );
}
