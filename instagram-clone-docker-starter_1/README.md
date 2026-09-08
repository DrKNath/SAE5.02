# Instagram Clone — SAÉ 5.02 (BUT RT3)

Squelette de départ : Node.js + TypeScript + Express + Prisma (SQLite) + Socket.io,
prêt à être lancé avec Docker. Ce dépôt est un point de départ pour le sprint 0 :
chaque story du backlog viendra étoffer `src/`, le schéma Prisma, etc.

## Prérequis

- Docker et Docker Compose v2 (`docker compose version`)
- Node.js 20+ en local si vous préférez ne pas utiliser Docker pour développer

## Démarrage rapide (développement, avec Docker)

```bash
cp .env.example .env
docker compose up --build
```

- L'API est disponible sur http://localhost:3000 (endpoint de test : `/health`)
- Le code source est monté en volume : toute modification dans `src/` recharge
  automatiquement le serveur (hot reload via `ts-node-dev`)
- La base SQLite et les fichiers uploadés sont conservés entre deux redémarrages
  grâce aux volumes Docker nommés `sqlite_data` et `uploads_data`

Pour arrêter : `docker compose down` (les volumes sont conservés).
Pour tout réinitialiser (⚠️ supprime aussi les données) : `docker compose down -v`.

## Démarrage sans Docker (optionnel)

```bash
npm install
cp .env.example .env   # adapter DATABASE_URL en local, ex: file:./data/dev.db
npx prisma generate
npm run dev
```

## Production / démo

```bash
cp .env.example .env   # penser à changer JWT_SECRET
docker compose -f docker-compose.prod.yml up --build -d
```

Cette configuration utilise l'image de production (multi-stage, sans
dépendances de dev, utilisateur non-root, `HEALTHCHECK` intégré) — c'est
l'image qui sera publiée par la CI sur GitHub Container Registry
(`ghcr.io/<org>/<repo>:latest`) à chaque merge sur `main`.

## Organisation du projet

```
src/                point d'entrée de l'application (Express + Socket.io)
prisma/schema.prisma modèle de données (à compléter au fil des sprints)
Dockerfile           build multi-stage : dev / build / prod
docker-compose.yml       environnement de développement (hot reload)
docker-compose.prod.yml  environnement de production / démo
.github/workflows/ci.yml lint + build + tests, puis publication de l'image
```

## Ajouter une dépendance qui a besoin de librairies système

Certaines fonctionnalités du sujet (filtres photo, retouche d'image) reposent
souvent sur des libs comme `sharp` ou `node-canvas`, qui nécessitent des
paquets système à la compilation. Si `npm install` échoue dans le conteneur
avec une erreur de compilation native :

1. Ajoutez le paquet Debian nécessaire (ex. `libvips-dev`) avec un `RUN apt-get
   install -y ...` dans le stage `base` du `Dockerfile`
2. Relancez `docker compose up --build`

Le responsable Docker de l'équipe doit être prévenu **avant** qu'une story de
ce type ne soit prise en sprint, pour préparer l'image en amont.

## Documentation à compléter

- [ ] Documentation utilisateur (installation, utilisation)
- [ ] Documentation technique (architecture, choix, endpoints API)
- [ ] Rapport de gestion de projet (SCRUM, outils, usage de l'IA)
