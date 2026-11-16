# TradeFacile mobile — Expo SDK 52

Application **React Native native, sans WebView**. Les écrans appellent les API du site en HTTPS. Le site et l'application utilisent le même compte et le même solde fictif ; il n'y a aucun paiement réel. La session est stockée dans le stockage sécurisé de l'appareil.

L'application comprend bienvenue, connexion, inscription, graphique en bougies, mises simples, programmées et combinées, signaux, historique, solde, dépôt/retrait fictifs et choix du pays, de la devise et de la langue. Elle reprend les couleurs et la structure du site ; la correspondance visuelle et les parcours restent à vérifier sur un téléphone Android.

## Essayer avec Snack sur Android

1. Installez une version d'Expo Go compatible **SDK 52** : https://expo.dev/go?sdkVersion=52&platform=android&device=true . La version récente d'Expo Go ne prend pas forcément en charge ce SDK ancien.
2. Ouvrez https://snack.expo.dev/ et choisissez **SDK 52**, si Snack le propose encore.
3. Copiez le contenu de `mobile/App.js` dans le fichier `App.js` de Snack, puis créez `otc.js`, `money.js` et `i18n.js` et copiez-y les fichiers correspondants du dossier `mobile/`.
4. Dans Dependencies, ajoutez `expo-secure-store` **~14.0.1**, `react-native-svg` **15.8.0** et `big-integer` **1.6.52**.
5. Enregistrez le Snack et ouvrez son QR code avec Expo Go compatible sur Android.

La disponibilité de SDK 52 dans Snack et le fonctionnement sur votre téléphone doivent être vérifiés : aucun Snack publié ni test sur appareil réel n'ont été réalisés ici. Si Snack ne propose plus SDK 52, utilisez le lancement local ci-dessous. Les icônes du dépôt sont utilisées pour un APK construit, pas pour l'icône d'Expo Go.

## Lancement local

```sh
cd mobile
npm ci
npx expo start
```

Ouvrez le QR code avec Expo Go SDK 52 ; l'ordinateur et le téléphone doivent pouvoir communiquer sur le réseau. Une connexion Internet est nécessaire pour les API.

## Construire un APK Android

Le profil `preview` dans `eas.json` demande un APK ; `production` demande un AAB pour le Play Store. Depuis `mobile/` :

```sh
npx eas-cli login
npx eas-cli build --platform android --profile preview
```

EAS peut demander la configuration du projet et des identifiants Android. L'APK est produit par EAS, pas par Snack ; aucun APK n'est inclus. Testez l'installation sur un appareil avant distribution. Le nom de package `com.tradefacile.mobile` est provisoire : vérifiez sa disponibilité avant publication.

## Ressources

- `assets/icon.png` : icône d'application issue du logo du site.
- `assets/adaptive-icon.png` : avant-plan de l'icône adaptative Android.
- `assets/splash.png` : écran de démarrage.
- `otc.js` et `i18n.js` : moteur et dictionnaires à garder synchronisés avec ceux du site.
- `money.js` : fractions et troncature pour les six devises.
