# Deathswatch

Application mobile qui annonce les décès de personnalités en quasi temps réel, à partir des flux RSS de la presse (Le Monde, Le Figaro, Libération, France Info, 20 Minutes, Ouest-France, BBC, Reuters).

## Architecture

```
deathswatch/
├── backend/          API Node.js/Express
│   └── src/
│       ├── config.js     Flux RSS, mots-clés, intervalle de scrutation
│       ├── filter.js     Détection « décès + notoriété » avec scoring
│       ├── poller.js     Polling des flux + diffusion aux abonnés
│       ├── store.js      Déduplication + rétention 72 h
│       └── server.js     REST + SSE
└── mobile/           Application React Native (Expo)
    └── App.tsx           Liste temps réel, rafraîchissement 30 s
```

## Backend

- **Polling** : chaque flux RSS est lu toutes les 5 min (`POLL_INTERVAL_MS`).
- **Filtrage** : un article est retenu s'il contient un mot-clé de décès **et** un signal de notoriété (acteur, écrivain, ministre, scientifique…) ou un mot-clé de nécrologie fort dans le titre. Les faux positifs (faits divers, attentats, procès) sont pénalisés.
- **API** :
  - `GET /api/deaths?limit=50` — dernières annonces
  - `GET /api/stream` — flux SSE `event: death` en continu
  - `POST /api/poll` — force une scrutation immédiate
  - `GET /health`

```bash
cd backend
npm install
npm start          # http://localhost:3000
```

Variables d'environnement : `PORT`, `POLL_INTERVAL_MS`, `RETENTION_HOURS`.

## Application mobile

```bash
cd mobile
npm install
EXPO_PUBLIC_API_URL=http://<ip-de-votre-machine>:3000 npx expo start
```

Scannez le QR code avec l'application **Expo Go** (Android/iOS). Sur téléphone physique, utilisez l'IP locale de votre machine, pas `localhost`.

## Tester sur iPhone (sans rien payer)

1. Installez **Expo Go** depuis l'App Store sur votre iPhone.
2. Sur votre ordinateur (Mac, Windows ou Linux) :
   ```bash
   cd mobile
   npm install
   EXPO_PUBLIC_API_URL=http://<ip-de-votre-machine>:3000 npx expo start
   ```
3. Scannez le QR code affiché dans le terminal avec l'appareil photo de l'iPhone (iPhone et ordinateur sur le même Wi-Fi).

Pour publier sur l'**App Store** : compte Apple Developer (99 $/an), puis build dans le cloud avec `eas build -p ios` (aucun Mac nécessaire) et soumission via `eas submit`. TestFlight permet de distribuer des versions de test.

## Déploiement cloud gratuit (Render) — l'app accessible partout

Le dépôt contient un blueprint Render (`render.yaml`) prêt à l'emploi :

1. Créez un compte sur **https://dashboard.render.com** (bouton **GitHub** pour s'inscrire)
2. **New +** → **Blueprint** → autorisez l'accès au dépôt `morts-celebres-` → **Apply**
3. Render installe et démarre le backend (~2 min) et vous donne une URL du type
   `https://deathswatch-xxxx.onrender.com`
4. Sur l'iPhone (et depuis n'importe où) : ouvrez cette URL dans Safari → Partager → « Sur l'écran d'accueil »

**Important (palier gratuit)** : Render endort le serveur après 15 min sans visite ; la première ouverture prend alors ~40 s. Pour un réveil automatique en continu, créez un
cron gratuit sur **https://cron-job.org** qui appelle `https://VOTRE-URL.onrender.com/health` toutes les 10 min.

## Limites connues et évolutions

- **Quasi temps réel** : la détection dépend de la fréquence de publication des rédactions (minutes à heures), pas de la seconde.
- **Rappel** : les flux RSS sont soumis aux conditions d'utilisation des éditeurs ; pour un usage public, obtenez les autorisations ou passez par une API agréée.
- **Notifications push** : à ajouter avec `expo-notifications` + envoi depuis le backend lors des nouvelles entrées (`onNewEntries` dans `poller.js`).
- **Améliorations possibles** : extraction du nom de la personne (NER), fiches Wikipédia pour enrichir (photo, biographie), recherche par domaine (cinéma, politique…), source Wikipédia « Décès en 2025 » en complément.
