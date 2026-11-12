/**
 * Configuration : TOUTES les valeurs de l'app au même endroit.
 * Les pages et composants importent d'ici — rien en dur ailleurs.
 */
import { RULES, type DurationSec } from "./symbols";

/** Écrans de l'app (adresses). */
export const ROUTES = {
  trader: "/",
  history: "/historique",
  profile: "/profil",
  login: "/connexion",
  signup: "/inscription",
  welcome: "/bienvenue",
  predictions: "/predictions",
} as const;

/** Clés de stockage local. */
export const STORE = {
  symbol: "tf_symbol",
  token: "tf_token",
  guide: "tf_guide",
  calm: "tf_calme",
  /** Durée + Investissement : retrouvés après refresh, déconnexion, fermeture. */
  order: "tf_order",
} as const;

/** Paramètres du lien « Préparer ma mise » (signaux → trader). */
export const SIGNAL_PARAMS = {
  game: "jeu",
  duration: "duree",
  sense: "sens",
  slot: "slot",
  /** Heure programmée d'avance (la mise part à la seconde exacte). */
  prog: "prog",
  /** Valeurs du sens : montée ou baisse. */
  up: "up",
  down: "down",
} as const;

/** Mises. */
export const DEFAULT_BET = 50;
export const DEPOSIT_OPTIONS = [1000, 5000, 10000] as const;
export const WITHDRAW_OPTIONS = [1000, 5000] as const;

/** Durée proposée à l'ouverture (1 min) et bougies du graphique. */
export const DEFAULT_DURATION_SEC: DurationSec = 60;
export const DEFAULT_INTERVAL = "1m" as const;

/** Limites de chargement. */
export const TRADES_PAGE_LIMIT = 50;
/** Historique : 200 derniers trades (maximum du serveur). */
export const HISTORY_LIMIT = 200;
export const CANDLES_LIMIT = 200;
export const RESULTS_SHOWN = 5;

/** Sélecteur d'heure : 12 créneaux, tous les quarts d'heure (les heures lointaines). */
export const TIME_SLOT_COUNT = 12;
export const TIME_SLOT_STEP_MIN = 15;
/**
 * Marge de programmation (grille DÉPART comme sélecteur « Autre ») : seuls
 * les créneaux à plus de 8 s sont proposés, comme le serveur l'exige.
 */
export const TIME_SLOT_BOOK_MARGIN_MS = 8000;

/** Signaux : créneaux affichés + fraîcheur d'un signal pré-rempli. */
export const SIGNAL_SLOT_COUNT = 20;
export const SIGNAL_FRESH_PAST_MS = 10000;
export const SIGNAL_FRESH_FUTURE_MS = 30 * 60000;
/** Un signal raté s'efface 30 s après son heure (sinon « Trop tard » reste affiché). */
export const SIGNAL_LATE_MS = 30000;
/**
 * Tir signalé : appuyer sur le bouton conseillé dans les 3 dernières secondes
 * arme le tir (la mise part à la seconde pile, toute seule). Plus tôt, le
 * verdict ne voudrait plus rien dire : on refuse avec un message clair.
 */
export const SIGNAL_PRESS_WINDOW_MS = 3000;

/** Cadences en millisecondes. */
export const CLOCK_SYNC_MS = 30000;
/** Le graphique recharge ses bougies toutes les 15 s (sinon il se fige). */
export const CANDLES_REFRESH_MS = 15000;
export const SCHEDULED_REFRESH_MS = 30000;
export const TRADES_REFRESH_MS = 15000;
export const LIVE_POLL_MS = 4000;
export const SETTLE_TICK_MS = 1000;
/** Si le serveur n'a pas fini de clôturer, on réessaie au bout de 5 s (pas chaque seconde). */
export const SETTLE_RETRY_MS = 5000;
/** Le trader se rafraîchit chaque seconde (la pastille affiche des secondes). */
export const FLOAT_TICK_MS = 1000;
export const SIGNAL_TICK_MS = 250;
export const PENDING_TICK_MS = 250;
export const RING_TICK_MS = 200;
export const COUNTDOWN_TICK_MS = 100;

/** Seuils d'affichage. */
export const RING_URGENT_MS = 10000;
export const GO_THRESHOLD_MS = 1000;
/** On tire juste après la seconde pile (délai réseau). */
export const SHOT_DELAY_MS = 150;
/** Choix d'heure invalide : jamais de mise surprise. */
export const BAD_TIME = "__bad";
export const RESET_CONFIRM_MS = 5000;

/** Fenêtre anti-double-tap (zoom) : deux touchers plus proches = zoom bloqué. */
export const DOUBLE_TAP_MS = 350;

/** Vibrations (ms) : discrète, action, clôture. */
export const VIBRATE = {
  tap: 15,
  action: 20,
  settle: 30,
} as const;

/** Nom du paramètre « page de retour » après connexion. */
export const NEXT_PARAM = "next";

/** Longueur minimum du mot de passe (client + serveur). */
export const PASSWORD_MIN = 6;

/** Appels API : abandon après 15 s (pas d'écran bloqué si le réseau stagne). */
export const API_TIMEOUT_MS = 15000;

/** Anti brute-force : 10 essais ratés par adresse IP et par 10 minutes. */
export const LOGIN_MAX_ATTEMPTS = 10;
export const LOGIN_WINDOW_MS = 10 * 60 * 1000;

/** Export de l'historique : copié dans le presse-papiers (maquette). */
export const CSV = {
  sep: ",",
  header: "jeu,duree,sens,mise,depart,arrivee,resultat,date",
} as const;

/** Retour visuel « Copié ✓ » après un export. */
export const COPIED_MS = 1500;

/** Point de rupture desktop = `lg` de Tailwind (barre latérale). */
export const BREAKPOINT_LG = 1024;

/** Durée d'affichage du message sur le graphique (mise, gain, perte). */
export const TOAST_MS = 2200;
