import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createFriendsRouter } from './friends.routes.js';
import { FriendsService } from './friends.service.js';
import { InMemoryFriendsRepository } from './friends.repository.memory.js';
import { errorHandler } from '../../middlewares/error-handler.js';

const ALICE = 1;
const BOB = 2;
const CAROL = 3;

let repo: InMemoryFriendsRepository;
let app: express.Express;

beforeEach(() => {
    repo = new InMemoryFriendsRepository();
    repo.addUser(ALICE, 'alice');
    repo.addUser(BOB, 'bob');
    repo.addUser(CAROL, 'carol');

    app = express();
    app.use(express.json());
    app.use('/api/friends', createFriendsRouter(new FriendsService(repo)));
    app.use(errorHandler);
});

/** Ouvre une requête authentifiée en tant que `userId`. */
function as(userId: number) {
    return {
        get: (path: string) => request(app).get(path).set('x-user-id', String(userId)),
        post: (path: string) => request(app).post(path).set('x-user-id', String(userId)),
        delete: (path: string) =>
            request(app).delete(path).set('x-user-id', String(userId)),
    };
}

describe('authentification', () => {
    it('refuse une requête sans en-tête d identité', async () => {
        const res = await request(app).get('/api/friends');
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('UNAUTHENTICATED');
    });

    it('refuse un identifiant non numérique', async () => {
        const res = await request(app).get('/api/friends').set('x-user-id', 'abc');
        expect(res.status).toBe(401);
    });
});

describe('POST /api/friends/requests/:userId', () => {
    it('crée une demande et renvoie 201', async () => {
        const res = await as(ALICE).post(`/api/friends/requests/${BOB}`);
        expect(res.status).toBe(201);
        expect(res.body.status).toBe('PENDING');
    });

    it('renvoie 404 pour un compte inexistant', async () => {
        const res = await as(ALICE).post('/api/friends/requests/999');
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('USER_NOT_FOUND');
    });

    it('renvoie 400 pour un identifiant non numérique', async () => {
        const res = await as(ALICE).post('/api/friends/requests/abc');
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('INVALID_ID');
    });

    it('renvoie 400 sur une demande vers soi-même', async () => {
        const res = await as(ALICE).post(`/api/friends/requests/${ALICE}`);
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('SELF_RELATION');
    });

    it('renvoie 409 sur une demande en double', async () => {
        await as(ALICE).post(`/api/friends/requests/${BOB}`);
        const res = await as(ALICE).post(`/api/friends/requests/${BOB}`);
        expect(res.status).toBe(409);
        expect(res.body.error).toBe('REQUEST_ALREADY_SENT');
    });

    it('accepte automatiquement une demande croisée', async () => {
        await as(BOB).post(`/api/friends/requests/${ALICE}`);
        const res = await as(ALICE).post(`/api/friends/requests/${BOB}`);
        expect(res.body.status).toBe('ACCEPTED');
    });
});

describe('POST /api/friends/requests/:id/accept', () => {
    it('accepte une demande reçue', async () => {
        const created = await as(ALICE).post(`/api/friends/requests/${BOB}`);
        const res = await as(BOB).post(
            `/api/friends/requests/${created.body.friendshipId}/accept`,
        );

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ACCEPTED');
    });

    it('renvoie 403 si le demandeur tente d accepter', async () => {
        const created = await as(ALICE).post(`/api/friends/requests/${BOB}`);
        const res = await as(ALICE).post(
            `/api/friends/requests/${created.body.friendshipId}/accept`,
        );
        expect(res.status).toBe(403);
    });

    it('renvoie 404 à un tiers, sans révéler la demande', async () => {
        const created = await as(ALICE).post(`/api/friends/requests/${BOB}`);
        const res = await as(CAROL).post(
            `/api/friends/requests/${created.body.friendshipId}/accept`,
        );
        expect(res.status).toBe(404);
    });
});

describe('GET /api/friends', () => {
    it('renvoie une liste vide au départ', async () => {
        const res = await as(ALICE).get('/api/friends');
        expect(res.status).toBe(200);
        expect(res.body.friends).toEqual([]);
    });

    it('renvoie l ami après acceptation, des deux côtés', async () => {
        const created = await as(ALICE).post(`/api/friends/requests/${BOB}`);
        await as(BOB).post(`/api/friends/requests/${created.body.friendshipId}/accept`);

        const alice = await as(ALICE).get('/api/friends');
        const bob = await as(BOB).get('/api/friends');

        expect(alice.body.friends.map((u: { id: number }) => u.id)).toEqual([BOB]);
        expect(bob.body.friends.map((u: { id: number }) => u.id)).toEqual([ALICE]);
    });

    it('ne renvoie jamais le mot de passe', async () => {
        repo.seed(ALICE, BOB, 'ACCEPTED');
        const res = await as(ALICE).get('/api/friends');
        expect(JSON.stringify(res.body)).not.toContain('password');
    });
});

describe('GET /api/friends/requests', () => {
    it('sépare les demandes reçues et envoyées', async () => {
        await as(BOB).post(`/api/friends/requests/${ALICE}`);
        await as(ALICE).post(`/api/friends/requests/${CAROL}`);

        const res = await as(ALICE).get('/api/friends/requests');

        expect(res.body.incoming.map((r: { user: { id: number } }) => r.user.id)).toEqual([
            BOB,
        ]);
        expect(res.body.outgoing.map((r: { user: { id: number } }) => r.user.id)).toEqual([
            CAROL,
        ]);
    });
});

describe('DELETE /api/friends/requests/:id', () => {
    it('permet au destinataire de refuser', async () => {
        const created = await as(ALICE).post(`/api/friends/requests/${BOB}`);
        const res = await as(BOB).delete(
            `/api/friends/requests/${created.body.friendshipId}`,
        );

        expect(res.status).toBe(204);
        expect((await as(BOB).get('/api/friends/requests')).body.incoming).toEqual([]);
    });

    it('permet au demandeur d annuler', async () => {
        const created = await as(ALICE).post(`/api/friends/requests/${BOB}`);
        const res = await as(ALICE).delete(
            `/api/friends/requests/${created.body.friendshipId}`,
        );

        expect(res.status).toBe(204);
        expect((await as(ALICE).get('/api/friends/requests')).body.outgoing).toEqual([]);
    });
});

describe('DELETE /api/friends/:userId', () => {
    it('rompt une amitié', async () => {
        repo.seed(ALICE, BOB, 'ACCEPTED');
        const res = await as(ALICE).delete(`/api/friends/${BOB}`);

        expect(res.status).toBe(204);
        expect((await as(BOB).get('/api/friends')).body.friends).toEqual([]);
    });

    it('renvoie 404 sans relation existante', async () => {
        const res = await as(ALICE).delete(`/api/friends/${CAROL}`);
        expect(res.status).toBe(404);
    });
});

describe('blocage', () => {
    it('bloque un compte et le liste', async () => {
        const res = await as(ALICE).post(`/api/friends/block/${BOB}`);
        expect(res.status).toBe(201);

        const blocked = await as(ALICE).get('/api/friends/blocked');
        expect(blocked.body.blocked.map((u: { id: number }) => u.id)).toEqual([BOB]);
    });

    it('empêche le compte bloqué de redemander en ami', async () => {
        await as(ALICE).post(`/api/friends/block/${BOB}`);
        const res = await as(BOB).post(`/api/friends/requests/${ALICE}`);
        expect(res.status).toBe(403);
    });

    it('ne révèle pas le blocage à la personne bloquée', async () => {
        await as(ALICE).post(`/api/friends/block/${BOB}`);
        const res = await as(BOB).get(`/api/friends/status/${ALICE}`);
        expect(res.body).toEqual({ status: 'NONE', direction: null });
    });

    it('lève le blocage et permet de redemander', async () => {
        await as(ALICE).post(`/api/friends/block/${BOB}`);
        expect((await as(ALICE).delete(`/api/friends/block/${BOB}`)).status).toBe(204);
        expect((await as(BOB).post(`/api/friends/requests/${ALICE}`)).status).toBe(201);
    });

    it('interdit au compte bloqué de se débloquer', async () => {
        await as(ALICE).post(`/api/friends/block/${BOB}`);
        const res = await as(BOB).delete(`/api/friends/block/${ALICE}`);
        expect(res.status).toBe(403);
    });
});

describe('GET /api/friends/status/:userId', () => {
    it('renvoie NONE sans relation', async () => {
        const res = await as(ALICE).get(`/api/friends/status/${BOB}`);
        expect(res.body).toEqual({ status: 'NONE', direction: null });
    });

    it('indique le sens de la demande en attente', async () => {
        await as(ALICE).post(`/api/friends/requests/${BOB}`);

        expect((await as(ALICE).get(`/api/friends/status/${BOB}`)).body.direction).toBe(
            'sent',
        );
        expect((await as(BOB).get(`/api/friends/status/${ALICE}`)).body.direction).toBe(
            'received',
        );
    });
});
