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

## Limites connues et évolutions

- **Quasi temps réel** : la détection dépend de la fréquence de publication des rédactions (minutes à heures), pas de la seconde.
- **Rappel** : les flux RSS sont soumis aux conditions d'utilisation des éditeurs ; pour un usage public, obtenez les autorisations ou passez par une API agréée.
- **Notifications push** : à ajouter avec `expo-notifications` + envoi depuis le backend lors des nouvelles entrées (`onNewEntries` dans `poller.js`).
- **Améliorations possibles** : extraction du nom de la personne (NER), fiches Wikipédia pour enrichir (photo, biographie), recherche par domaine (cinéma, politique…), source Wikipédia « Décès en 2025 » en complément.
