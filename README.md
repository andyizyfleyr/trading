# TradeFacile — Jeu éducatif de prédiction de prix

Application web **mobile first** (Next.js App Router + TypeScript + Tailwind) : le joueur
prédit si le prix d'un actif **monte** (ACHAT ▲) ou **descend** (VENTE ▼) pendant une durée
donnée, avec un graphique en bougies et de **vrais prix Binance en direct**.

- PWA installable (manifest + service worker + icônes)
- Base Neon (PostgreSQL) via Drizzle ORM
- Auth e-mail + mot de passe (bcrypt), JWT `Bearer`
- API JSON propres, réutilisables telles quelles par une future app React Native

> Argent d'entraînement uniquement : dépôt = ajout au solde par incrément,
> retrait = retrait par décrément. **Aucun paiement réel, jamais.**

## Démarrage rapide

### 1. Prérequis

- Node.js 18+
- Un compte [Neon](https://neon.tech) (PostgreSQL gratuit)

### 2. Installation

```bash
npm install
cp .env.example .env
```

Renseignez `.env` :

```env
DATABASE_URL="postgresql://user:password@ep-xxx-pooler.region.aws.neon.tech/tradefacile?sslmode=require"
JWT_SECRET="une-longue-chaine-aleatoire-d-au-moins-32-caracteres"
```

### 3. Créer les tables

```bash
npm run db:push
```

(Alternative : exécuter `drizzle/0001_init.sql` dans l'éditeur SQL de Neon.)

### 4. Lancer en local

```bash
npm run dev
```

Ouvrez http://localhost:3000 — créez un compte, vous commencez avec **10 000**.

## Déploiement sur Vercel

1. Poussez ce dépôt sur GitHub, puis **Add New Project** dans Vercel.
2. Ajoutez les variables d'environnement `DATABASE_URL` et `JWT_SECRET`.
3. Déployez. Pensez à exécuter `npm run db:push` une fois (avec la même `DATABASE_URL`).

## Règles du jeu (calculées côté serveur uniquement)

| Règle | Valeur |
|---|---|
| Solde de départ | 10 000 |
| Mise minimum / maximum | 10 / tout le solde |
| Durées | 3 s, 10 s, 30 s, 1 min, 5 min |
| Prix d'ouverture / clôture | Prix Binance lu par le serveur |
| Bonne prédiction | Mise + 85 % de gain (mise × 1,85) |
| Mauvaise prédiction | Rien rendu |
| Égalité | Mise rendue |
| Limite | 20 prédictions / minute / utilisateur |

Le client n'envoie **jamais** ni prix ni résultat : `POST /api/trades` ne prend que
`symbol`, `direction`, `amount`, `durationSec`.

## Documentation API (pour la future app React Native)

Base : même hôte que le web. Sauf `/api/auth/*`, toutes les routes exigent :

```
Authorization: Bearer <token>
```

Format unique :

```jsonc
// Succès
{ "data": { /* ... */ } }
// Erreur
{ "error": { "code": "SOLDE_INSUFFISANT", "message": "Solde insuffisant pour cette mise." } }
```

| Méthode | Route | Description |
|---|---|---|
| POST | `/api/auth/register` | `{email, password}` → `{token, user}` (201) |
| POST | `/api/auth/login` | `{email, password}` → `{token, user}` |
| GET | `/api/me` | Profil + solde |
| POST | `/api/me/reset` | Solde remis à 10 000 |
| POST | `/api/me/deposit` | `{amount}` 100–50 000, ajout au solde |
| POST | `/api/me/withdraw` | `{amount}` ≥ 100, retrait du solde |
| GET | `/api/me/stats` | Victoires, défaites, taux de réussite, gains nets, rang |
| GET | `/api/candles?symbol=BTCUSDT&interval=1m&limit=200` | Bougies `{time, open, high, low, close, volume}` |
| GET | `/api/price?symbol=BTCUSDT` | Prix actuel (secours si WebSocket indisponible) |
| POST | `/api/trades` | `{symbol, direction: UP\|DOWN, amount, durationSec: 3\|10\|30\|60\|300}` → `{trade, balance}` (201) |
| GET | `/api/trades?status=open\|settled\|all&limit=50` | Mes prédictions |
| POST | `/api/trades/settle` | Clôture ce qui est échu (`{ids?}` optionnel) → `{settled, pending, balance}` |
| GET | `/api/leaderboard` | Top 20 des soldes + mon rang |
| GET | `/api/lessons` | Leçons + progression |
| POST | `/api/lessons/progress` | `{lessonId, done}` |

Actifs : cryptos `BTCUSDT, ETHUSDT, BNBUSDT, SOLUSDT, XRPUSDT, DOGEUSDT, ADAUSDT, AVAXUSDT, LINKUSDT, TRXUSDT` (Binance) + actions `AAPL, TSLA, NVDA` (Yahoo Finance).
Intervalles : `1m, 5m, 15m`.

### Objet `trade`

```jsonc
{
  "id": 1, "symbol": "BTCUSDT", "direction": "UP", "amount": 100,
  "openPrice": 67123.4, "closePrice": null, "durationSec": 60,
  "status": "OPEN", "result": null, "payout": null,
  "openedAt": "2026-…", "closesAt": "2026-…"
}
```

## Structure du projet

```
app/
  page.tsx            Écran Trader (graphique + prédictions)
  historique/         Historique des prédictions
  classement/         Classement des soldes
  cours/              Leçons éducatives
  profil/             Solde, dépôt/retrait, réglages
  connexion/ inscription/ bienvenue/   Auth + onboarding (3 écrans)
  api/                Routes API JSON (voir tableau ci-dessus)
components/           PriceChart, TradeForm, TradeCards, BottomNav…
hooks/               useLiveMarket (WebSocket Binance + secours), useOnline
lib/                 db, schema, auth (JWT/bcrypt), binance, api client…
public/              manifest PWA, service worker, icônes
drizzle/0001_init.sql Schéma SQL de référence
```

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | Développement |
| `npm run build` / `npm start` | Production |
| `npm run typecheck` | Vérification TypeScript |
| `npm run db:push` | Crée/met à jour les tables Neon |

## Notes produit

- **Mobile first 360 px** : barre du bas (Trader, Historique, Classement, Cours),
  profil via l'avatar, boutons ≥ 48 px, chiffres tabulaires, français simple.
- **Temps réel** : WebSocket Binance sur le graphique, avec secours automatique
  par sondage de `/api/price` si le WebSocket est bloqué.
- **Hors ligne** : bannière « Reconnexion… », prédictions en cours conservées
  (heures de fin serveur) et clôturées au retour de la connexion.
- **Éthique** : pas de pression artificielle, pas de confettis, pas de séries
  de victoires mises en avant ; aide « ? » sur chaque terme, cours intégrés.
