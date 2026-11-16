# TradeFacile mobile — Expo SDK 52

Cette première application React Native utilise une **WebView** pour afficher le site de production, et reprend donc ses écrans et fonctionnalités à l'identique. Les écrans ne sont pas encore réécrits en composants natifs. L'application nécessite Internet et utilise le même compte et la même base que le site. Les montants sont fictifs, comme sur le site.

## Essayer avec Snack sur Android

1. Installer sur Android une version d'Expo Go compatible avec **SDK 52** (la version actuelle d'Expo Go ne prend pas forcément en charge ce SDK ancien). Voir les versions officielles : https://expo.dev/go?sdkVersion=52&platform=android&device=true .
2. Sur https://snack.expo.dev/, créer un Snack et choisir **SDK 52** si cette option est disponible. Si Snack ne propose plus SDK 52, utiliser le lancement local ci-dessous : le dépôt seul ne crée pas automatiquement un Snack ni un QR code.
3. Copier le contenu de `mobile/App.js` dans le fichier `App.js` du Snack.
4. Dans Dependencies, ajouter `react-native-webview` version **13.12.5** (les autres imports viennent de React et React Native).
5. Enregistrer le Snack puis ouvrir son QR code avec Expo Go compatible sur le téléphone. Il faut une connexion Internet.

La prise en charge du SDK 52 dans Snack peut changer ; la compatibilité réelle doit être vérifiée sur l'appareil. Les icônes et l'écran de démarrage de ce dépôt sont destinés à une application construite, ils ne remplacent pas l'icône Expo Go pendant un essai Snack.

## Lancement local

```sh
cd mobile
npm ci
npx expo start
```

Ouvrir le QR code avec Expo Go SDK 52. L'ordinateur et le téléphone doivent pouvoir communiquer sur le réseau. Au besoin, suivre les instructions de connexion d'Expo.

## Construire un APK Android

Le profil `preview` dans `eas.json` demande un **APK** ; `production` demande un AAB pour une distribution Play Store. Depuis `mobile/` :

```sh
npx eas-cli login
npx eas-cli build --platform android --profile preview
```

EAS demandera éventuellement de configurer le projet et les identifiants Android. L'APK est produit par EAS, pas par Snack ; aucun APK n'est inclus dans le dépôt. Tester l'installation sur un appareil avant toute distribution. Le nom de package `com.tradefacile.mobile` est provisoire : vérifier sa disponibilité avant publication.

## Ressources

- `assets/icon.png` : icône de l'application, reprise du logo du site.
- `assets/adaptive-icon.png` : avant-plan de l'icône adaptative Android.
- `assets/splash.png` : logo de l'écran de démarrage.

Les liens vers des sites externes s'ouvrent hors de la WebView. Le bouton Retour Android revient dans l'historique interne. Le stockage de la session reste celui de la WebView ; la déconnexion du navigateur habituel est indépendante.
