# TradeFacile mobile — Expo SDK 52

Application **React Native native (Expo SDK 52), sans WebView**, alignée à l'identique sur le design, les sections et la disposition du site web mobile. Les écrans appellent les API du site en HTTPS et partagent le même compte et le même solde fictif (aucun paiement réel). La session est stockée dans le stockage sécurisé de l'appareil (`expo-secure-store`).

## Écrans et structure

- `App.js` : coquille globale (écran d'ouverture à 7 bougies animées, en-tête fixe avec logo `▲/▼ TradeFacile` et pastille solde, bandeau hors ligne, barre de navigation basse 3 onglets `Trader` / `Signaux` / `Historique`).
- `screens/AuthScreens.js` : `Connexion`, `Inscription` et `Bienvenue` (3 écrans avec illustrations SVG, points de progression et sélecteur de langue).
- `screens/TraderScreen.js` + `components/CandleChart.js` + `components/TradeCards.js` : vue plein écran sans défilement, graphique en bougies interactif (glisser, pincer pour zoomer, double-toucher, pastille prix/mise, bouton `Direct ▸`, toast flottant, pastille `N en cours`), panneau d'ordres façon Quotex (jeu + `85%`, cadres `Durée`/`Départ` et `Investissement` avec `−`/`+`, ligne `Gain potentiel` pointillée, boutons `Hausse` / `Baisse`) et panneaux coulissants (`Choisir un jeu`, `Durée ou départ`, `Choisir l'heure`, `En cours`, `Résultat` avec `Rejouer` immédiat), ainsi que le guide premier trade en 5 étapes.
- `screens/SignauxScreen.js` : consigne encadrée en bleu, pastille géante `Hausse ▲`/`Baisse ▼`, compte à rebours géant + jauge, bouton `Préparer ma mise →`, guide en 3 étapes numérotées, grilles jeu/durée et liste des 20 coups à venir avec badge `À JOUER`.
- `screens/HistoriqueScreen.js` : en-tête compacte (`Exporter` CSV + `↻`), bandeau statistiques 3 colonnes (`Terminés`, `Réussite`, `Net`), filtre jeu + onglets `Toutes` / `En cours` / `Terminées` et lignes compactes groupées par jour.
- `screens/ProfilScreen.js` : carte identité + solde, boutons `Ajouter` / `Retirer` ouvrant les panneaux de montants prédéfinis, sélecteurs `Pays` / `Devise` / `Langue`, interrupteurs `Mode clair` et `Réduire les animations`, section `Mises à jour automatiques` (OTA) et déconnexion.
- `theme.js`, `api.js`, `money.js`, `otc.js`, `ota.js`, `i18n.js`, `components/Icons.js`, `components/Ui.js` : palette Quotex, client API, fractions exactes, moteur OTC, client OTA `expo-updates` et dictionnaires synchronisés avec le site.

## Lancement local (Expo SDK 52)

```sh
cd mobile
npm ci
npx expo start
```

Scannez le QR code avec **Expo Go SDK 52** sur Android (le téléphone et l'ordinateur doivent être sur le même réseau).

## Essayer avec Snack (SDK 52)

Comme l'import Git de Snack est temporairement désactivé, un fichier unique **`mobile/snack/App.js`** (généré par `npm run snack`) est prêt à copier-coller :

1. Installez Expo Go compatible **SDK 52** : https://expo.dev/go?sdkVersion=52&platform=android&device=true
2. Ouvrez https://snack.expo.dev/ et choisissez **SDK 52** en bas à droite.
3. Remplacez le contenu de `App.js` par celui de **`mobile/snack/App.js`** (lien brut sur GitHub : `https://raw.githubusercontent.com/andyizyfleyr/trading/main/mobile/snack/App.js`).
4. Dans le fichier `package.json` de Snack, ajoutez dans `"dependencies"` (ou cliquez sur les boutons *Add dependency* proposés par Snack) :
   ```json
   "big-integer": "^1.6.52",
   "expo-secure-store": "~14.0.1",
   "react-native-svg": "15.8.0"
   ```
5. Scannez le QR code avec **Expo Go SDK 52** sur Android.

## Construire un APK Android (avec OTA intégré)

### 1. Build automatique via GitHub Actions (recommandé, zéro setup local)

Le workflow `.github/workflows/android-apk.yml` compile l'APK release Android (`com.tradefacile.mobile`, `expo-updates` préconfiguré vers `https://tradefacile-sand.vercel.app/api/updates`) et le publie automatiquement dans **GitHub Releases (`apk-latest`)** ainsi qu'en artefact du workflow :

- Téléchargement direct après exécution du workflow sur `main` :
  `https://github.com/andyizyfleyr/trading/releases/download/apk-latest/TradeFacile.apk`
- Pour signer avec un keystore de production personnalisé, ajoutez les secrets GitHub `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` et `ANDROID_KEY_PASSWORD`.

### 2. Build via Expo Workflows / EAS Build (cloud Expo, zéro setup local)

- **Expo Workflows (automatique sur push `main`)** : `mobile/.eas/workflows/build-apk.yml` lance un build Android APK sur `expo.dev` avec le profil `preview` (`withoutCredentials: true`).
- **EAS Build CLI** :
  ```sh
  cd mobile
  npx eas-cli login
  npx eas-cli build --platform android --profile preview
  ```

### 3. Build local Android (JDK 17 + Android SDK)

```sh
cd mobile
npm ci
CI=1 npx expo prebuild --platform android --clean
cd android && ./gradlew assembleRelease
# APK généré : mobile/android/app/build/outputs/apk/release/app-release.apk
```

## Mises à jour automatiques OTA (sans réinstaller l'APK)

L'APK embarque `expo-updates` pointant vers le serveur OTA auto-hébergé **`https://tradefacile-sand.vercel.app/api/updates`** (protocole Expo Updates v1, servi directement par Next.js/Vercel).

- **Côté application** : vérification automatique au démarrage et au retour au premier plan (`mobile/ota.js` + `mobile/App.js`), téléchargement silencieux en arrière-plan, bandeau `Nouvelle version prête · Redémarrer` et bouton manuel `Vérifier` dans `Profil`.
- **Publier une mise à jour OTA** (après toute modification JS/UI dans `mobile/`) :
  ```sh
  npm run ota:publish
  ```
  Cette commande exporte le bundle Hermes dans `public/ota/<runtimeVersion>/` et met à jour `lib/ota-manifest.json`. Dès que le commit est déployé sur Vercel (`main`), tous les APK installés reçoivent la mise à jour automatiquement.
- **Quand reconstruire l'APK ?** Uniquement lors d'un ajout/mise à jour de module natif ou d'un changement de `runtimeVersion` dans `mobile/app.json`.

## Vérification

```sh
cd mobile
npm test
npm run export
```
