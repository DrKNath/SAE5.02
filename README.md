# Vistagram — SAE5.02

Réseau social — projet SCRUM, IUT R&T Colmar.

Squelette TDD du projet. Le domaine métier est écrit et testé ; l'API HTTP et
le front restent à construire par-dessus.

## Démarrage

```bash
npm install
npm test          # 83 tests
npm run test:cov  # + couverture
npm run typecheck # tsc --noEmit, mode strict
```

## Architecture

```
src/
  domain/          logique métier pure — aucune dépendance base ou réseau
    visibility.ts    règles d'accès aux publications        (E3)
    friendship.ts    machine à états des relations          (E2)
    hashtags.ts      extraction et normalisation des tags   (E5)
    trending.ts      calcul des tendances                   (E5)
    reactions.ts     like / dislike mutuellement exclusifs  (E4)
    moderation.ts    droits et workflow de signalement      (E8)
  db/
    schema.ts        DDL complet
    connection.ts    ouverture SQLite + PRAGMA
    repositories/    accès aux données, requêtes préparées
tests/             miroir de src/, un fichier par module
```

**Règle d'architecture à tenir sur tout le projet :** la logique métier vit
dans `domain/`, en fonctions pures. Les dépôts lisent l'état, appellent la
fonction pure, écrivent le résultat. Aucune règle métier dans une requête SQL,
aucune requête SQL dans `domain/`. C'est ce qui rend les tests rapides et le
code relisible en revue de PR.

## Décisions prises

| Sujet | Choix | Raison |
|---|---|---|
| Suppression | logique (`deleted_at`) | la modération a besoin de l'historique |
| Amitié | une ligne, paire canonique `low_id < high_id` | pas de doublon symétrique, index unique |
| Réactions | table polymorphe `target_type` / `target_id` | un seul mécanisme pour posts et commentaires |
| Tendances | auteurs distincts, pas publications | empêche un compte de propulser son tag |
| Tags | normalisés sans accent | `#Été` et `#ete` alimentent la même tendance |
| Base de test | SQLite `:memory:` | isolation totale, aucun fichier à nettoyer |

## Ce qui reste à faire

- `src/services/` — orchestration (auth, feed, notifications)
- `src/api/` — routes Express + middleware d'authentification
- `src/realtime/` — Socket.io pour messagerie et notifications (E6, E9)
- front React (E7 : filtres et retouche côté client, canvas)
- `Dockerfile` + `docker-compose.yml` (E10)
- Docusaurus + TypeDoc (E11)
- `gts` pour le lint Google Style — à installer au sprint 0

## Convention de test

Trois temps par test : préparer les données, exécuter, vérifier.
Un fichier de test par module, même nom, dans `tests/`.
La Definition of Done exige tests verts + couverture ≥ 70 % avant merge.
