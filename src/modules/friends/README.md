# Module Amis (E2)

109 tests. Aucun ne nécessite de base de données.

## Fichiers

| Fichier | Rôle |
|---|---|
| `friends.types.ts` | types partagés |
| `friends.rules.ts` | **règles métier pures** — transitions, autorisations |
| `friends.repository.ts` | interface `FriendsRepository` + implémentation Prisma |
| `friends.repository.memory.ts` | implémentation en mémoire, **tests uniquement** |
| `friends.service.ts` | orchestration : lit, décide via les règles, écrit |
| `friends.controller.ts` | handlers HTTP |
| `friends.routes.ts` | routeur Express |

Le service dépend de l'**interface** du dépôt, pas de Prisma. C'est ce qui
permet aux 109 tests de tourner sans `prisma generate` ni fichier `.db`.

## Routes

Toutes exigent une authentification. Montées sur `/api/friends`.

| Méthode | Chemin | Effet |
|---|---|---|
| `GET` | `/` | liste des amis confirmés |
| `GET` | `/requests` | demandes reçues et envoyées |
| `GET` | `/blocked` | comptes bloqués |
| `GET` | `/status/:userId` | relation avec un compte |
| `POST` | `/requests/:userId` | envoyer une demande → 201 |
| `POST` | `/requests/:id/accept` | accepter → 200 |
| `DELETE` | `/requests/:id` | refuser ou annuler → 204 |
| `DELETE` | `/:userId` | rompre une amitié → 204 |
| `POST` | `/block/:userId` | bloquer → 201 |
| `DELETE` | `/block/:userId` | débloquer → 204 |

### Codes d'erreur

`SELF_RELATION` 400 · `INVALID_ID` 400 · `UNAUTHENTICATED` 401 ·
`NOT_ADDRESSEE` 403 · `NOT_REQUESTER` 403 · `NOT_BLOCKER` 403 ·
`RELATION_BLOCKED` 403 · `USER_NOT_FOUND` 404 · `REQUEST_NOT_FOUND` 404 ·
`RELATION_NOT_FOUND` 404 · `ALREADY_FRIENDS` 409 · `REQUEST_ALREADY_SENT` 409 ·
`ALREADY_BLOCKED` 409

## Décisions

| Sujet | Choix | Raison |
|---|---|---|
| Demande croisée | acceptation automatique | sinon deux personnes qui se sollicitent restent bloquées |
| Refus | suppression de la ligne | permet de retenter, évite les demandes mortes en base |
| Blocage | remplace toute relation | rompt l'amitié et efface la demande en attente |
| Blocage subi | présenté comme `NONE` | la personne bloquée ne doit pas pouvoir le déduire |
| Tiers sur une demande | **404**, pas 403 | un 403 confirmerait l'existence de la relation |
| Statuts | `PENDING` / `ACCEPTED` / `BLOCKED` | le champ Prisma est un `String` : aucune migration |

## Limitation connue

`Friendship` ne stocke **qu'une ligne par couple**, avec un seul `status`. Le
blocage mutuel (A bloque B *et* B bloque A) n'est donc pas représentable : le
second blocage est refusé avec `ALREADY_BLOCKED`.

Corriger cela demande un modèle `Block` distinct :

```prisma
model Block {
  id        Int      @id @default(autoincrement())
  blockerId Int
  blockedId Int
  createdAt DateTime @default(now())

  blocker User @relation("Blocker", fields: [blockerId], references: [id], onDelete: Cascade)
  blocked User @relation("Blocked", fields: [blockedId], references: [id], onDelete: Cascade)

  @@unique([blockerId, blockedId])
}
```

C'est une migration : elle touche tout le monde et passe par une PR dédiée,
annoncée au daily. À arbitrer en équipe.

## Pour les autres modules

`FriendsService.areFriends(a, b)` est le point d'entrée pour les modules qui
dépendent du graphe social :

- **E3** — filtrer le fil sur les publications en visibilité `FRIENDS`
- **E6** — autoriser l'ouverture d'une conversation
- **E9** — décider qui reçoit une notification

N'interrogez pas `prisma.friendship` directement depuis un autre module :
la logique de direction et de blocage serait dupliquée, et divergerait.

## Authentification

`src/middlewares/require-auth.ts` est **provisoire**. Il lit l'en-tête
`x-user-id` sans aucune vérification, uniquement pour permettre de développer
et tester les modules avant E1.

Contrat à respecter par le module auth : après le middleware, `req.user`
contient `{ id, role }`. Si E1 respecte ce contrat, ce module n'aura rien à
changer.

## Tests

```bash
npx vitest run src/modules/friends/
```

- `friends.rules.test.ts` (44) — règles pures, aucune dépendance
- `friends.service.test.ts` (39) — orchestration, dépôt en mémoire
- `friends.routes.test.ts` (26) — HTTP réel via Supertest, dépôt en mémoire
