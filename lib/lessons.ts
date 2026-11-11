import type { ApiLesson } from "./types";

/** Contenu éducatif servi par GET /api/lessons (français simple, sans jargon). */
export const LESSONS: ApiLesson[] = [
  {
    id: "bougies",
    title: "Lire un graphique en bougies",
    summary: "Comprendre les bâtons verts et rouges du graphique.",
    minutes: 3,
    blocks: [
      {
        heading: "Une bougie = une période",
        text: "Chaque bougie résume ce qu'a fait le prix pendant une période : 1 minute, 5 minutes, etc. Le graphique montre ces bougies les unes après les autres, de gauche (passé) à droite (présent).",
      },
      {
        heading: "Verte : ça monte",
        text: "Une bougie verte (▲) veut dire que le prix a fini plus haut qu'il n'a commencé. Le bas du rectangle est le prix de départ, le haut est le prix de fin.",
      },
      {
        heading: "Rouge : ça descend",
        text: "Une bougie rouge (▼) veut dire que le prix a fini plus bas qu'il n'a commencé. Les petites mèches en haut et en bas montrent le prix le plus haut et le plus bas de la période.",
      },
    ],
    takeaway: "Vert = le prix a monté. Rouge = le prix a baissé.",
  },
  {
    id: "tendance",
    title: "Hausse ou baisse : suivre la tendance",
    summary: "Repérer si le prix monte ou descend en ce moment.",
    minutes: 3,
    blocks: [
      {
        heading: "La tendance, c'est la direction générale",
        text: "Regardez les 10 ou 20 dernières bougies. Si elles montent globalement en escalier, on parle de hausse. Si elles descendent, on parle de baisse.",
      },
      {
        heading: "Plusieurs bougies de suite",
        text: "Trois bougies vertes de suite suggèrent que les acheteurs ont la main. Trois bougies rouges de suite suggèrent l'inverse. Mais rien n'est jamais sûr : le prix peut changer de sens à tout moment.",
      },
    ],
    takeaway: "Observez plusieurs bougies avant de prédire, pas une seule.",
  },
  {
    id: "durees",
    title: "Bien choisir la durée : 3 s, 10 s, 30 s, 1 min, 5 min",
    summary: "Chaque durée demande une lecture différente du graphique.",
    minutes: 2,
    blocks: [
      {
        heading: "3 et 10 secondes : l'éclair",
        text: "En quelques secondes, le résultat dépend d'un seul petit mouvement du prix. C'est amusant mais très imprévisible : misez petit sur ces durées.",
      },
      {
        heading: "30 secondes : très rapide",
        text: "En 30 secondes, le prix bouge peu mais de façon imprévisible. C'est une durée nerveuse : un petit mouvement suffit à changer le résultat.",
      },
      {
        heading: "1 minute : l'équilibre",
        text: "Une minute laisse le temps à un petit mouvement de se dessiner. C'est un bon choix pour commencer et observer le graphique en direct.",
      },
      {
        heading: "5 minutes : laisser respirer",
        text: "Sur 5 minutes, la tendance générale compte plus que les petits soubresauts. Idéal quand le graphique montre une direction claire.",
      },
    ],
    takeaway: "Débutant ? Commencez par 1 minute et regardez le graphique.",
  },
  {
    id: "budget",
    title: "Gérer son solde comme un pro",
    summary: "Miser petit et régulier pour jouer longtemps.",
    minutes: 3,
    blocks: [
      {
        heading: "Ne misez jamais gros d'un coup",
        text: "Vous pouvez miser jusqu'à tout votre solde, mais c'est risqué : une seule prédiction ratée et il ne reste presque plus rien. Misez une petite partie du solde pour pouvoir continuer à jouer et apprendre même après plusieurs ratés.",
      },
      {
        heading: "La mise minimum suffit pour apprendre",
        text: "Avec une mise de 10, une bonne prédiction rapporte 18,5 (la mise + 85 %). Miser petit permet de tester vos lectures du graphique sans stress.",
      },
      {
        heading: "En cas d'égalité, la mise est rendue",
        text: "Si le prix de fin est exactement égal au prix de départ, vous récupérez votre mise. Ni gagné, ni perdu.",
      },
    ],
    takeaway: "Petites mises = plus de parties = plus d'apprentissage.",
  },
  {
    id: "volatilite",
    title: "Quand le prix bouge vite",
    summary: "Reconnaître les moments agités du marché.",
    minutes: 2,
    blocks: [
      {
        heading: "Les grandes bougies préviennent",
        text: "Quand les bougies deviennent grandes avec de longues mèches, le prix bouge vite. Les résultats sont alors plus incertains, surtout sur 30 secondes.",
      },
      {
        heading: "Le calme après la tempête",
        text: "Après une série de grandes bougies, le prix se calme souvent avec des petites bougies. Observer ce rythme aide à choisir le bon moment.",
      },
    ],
    takeaway: "Grandes bougies = marché agité = prudence sur les durées courtes.",
  },
  {
    id: "emotions",
    title: "Rester calme : gagner et perdre",
    summary: "Le bon état d'esprit pour apprendre sereinement.",
    minutes: 2,
    blocks: [
      {
        heading: "Perdre fait partie du jeu",
        text: "Même les meilleurs se trompent souvent. Une prédiction ratée n'est pas un échec : regardez ce que le graphique a fait et essayez de comprendre pourquoi.",
      },
      {
        heading: "Faites des pauses",
        text: "Après plusieurs parties, faites une pause, relisez une leçon ou regardez le classement. Jouer calmement aide à mieux lire le graphique.",
      },
    ],
    takeaway: "Ici, on joue pour apprendre. Le score ne mesure pas votre valeur.",
  },
  {
    id: "actions",
    title: "Les actions : la Bourse dort la nuit",
    summary: "Apple, Tesla, NVIDIA : pareil que les cryptos, sauf les horaires.",
    minutes: 2,
    blocks: [
      {
        heading: "La Bourse ouvre et ferme",
        text: "Les cryptos bougent jour et nuit, mais la Bourse américaine n'ouvre qu'en semaine, l'après-midi heure d'Europe. Le soir et le week-end, le prix affiché est le dernier cours réel : la clôture.",
      },
      {
        heading: "Que se passe-t-il si je joue Bourse fermée ?",
        text: "Le prix ne bouge plus, donc le prix de fin est souvent égal au prix de départ : c'est une égalité et votre mise vous est rendue. Pour vibrer, jouez les actions quand la Bourse est ouverte.",
      },
    ],
    takeaway: "Bourse ouverte = prix qui bouge. Bourse fermée = égalité probable, mise rendue.",
  },
];

export const LESSON_IDS = new Set(LESSONS.map((l) => l.id));

export function isLessonId(v: unknown): v is string {
  return typeof v === "string" && LESSON_IDS.has(v);
}
