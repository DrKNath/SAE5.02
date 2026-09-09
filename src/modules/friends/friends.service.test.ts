import { describe, it, expect, beforeEach } from 'vitest';
import { FriendsService } from './friends.service.js';
import { InMemoryFriendsRepository } from './friends.repository.memory.js';
import { AppError } from '../../shared/errors/app-error.js';

const ALICE = 1;
const BOB = 2;
const CAROL = 3;

let repo: InMemoryFriendsRepository;
let service: FriendsService;

beforeEach(() => {
    repo = new InMemoryFriendsRepository();
    repo.addUser(ALICE, 'alice');
    repo.addUser(BOB, 'bob');
    repo.addUser(CAROL, 'carol');
    service = new FriendsService(repo);
});

/** Extrait le code métier d'une promesse censée échouer. */
async function codeOf(promise: Promise<unknown>): Promise<string> {
    try {
        await promise;
        return 'AUCUNE_ERREUR';
    } catch (error) {
        return error instanceof AppError ? error.code : 'ERREUR_INATTENDUE';
    }
}

describe('sendRequest', () => {
    it('crée une demande en attente', async () => {
        const result = await service.sendRequest(ALICE, BOB);
        expect(result.status).toBe('PENDING');
        expect(repo.all()).toHaveLength(1);
    });

    it('refuse une demande vers un compte inexistant', async () => {
        expect(await codeOf(service.sendRequest(ALICE, 999))).toBe('USER_NOT_FOUND');
    });

    it('refuse une demande vers soi-même', async () => {
        expect(await codeOf(service.sendRequest(ALICE, ALICE))).toBe('SELF_RELATION');
    });

    it('refuse une demande déjà envoyée', async () => {
        await service.sendRequest(ALICE, BOB);
        expect(await codeOf(service.sendRequest(ALICE, BOB))).toBe('REQUEST_ALREADY_SENT');
    });

    it('accepte automatiquement une demande croisée', async () => {
        await service.sendRequest(BOB, ALICE);
        const result = await service.sendRequest(ALICE, BOB);

        expect(result.status).toBe('ACCEPTED');
        // Une seule ligne : la demande croisée ne doit pas en créer une seconde.
        expect(repo.all()).toHaveLength(1);
    });

    it('refuse une demande entre amis confirmés', async () => {
        repo.seed(ALICE, BOB, 'ACCEPTED');
        expect(await codeOf(service.sendRequest(ALICE, BOB))).toBe('ALREADY_FRIENDS');
    });

    it('refuse une demande vers un compte qui a bloqué', async () => {
        repo.seed(BOB, ALICE, 'BLOCKED');
        expect(await codeOf(service.sendRequest(ALICE, BOB))).toBe('RELATION_BLOCKED');
    });
});

describe('acceptRequest', () => {
    it('accepte une demande reçue', async () => {
        const pending = repo.seed(ALICE, BOB, 'PENDING');
        const result = await service.acceptRequest(BOB, pending.id);

        expect(result.status).toBe('ACCEPTED');
        expect(await service.listFriends(BOB)).toHaveLength(1);
    });

    it('interdit au demandeur d accepter sa propre demande', async () => {
        const pending = repo.seed(ALICE, BOB, 'PENDING');
        expect(await codeOf(service.acceptRequest(ALICE, pending.id))).toBe('NOT_ADDRESSEE');
    });

    it('renvoie « introuvable » à un tiers plutôt que « interdit »', async () => {
        // Un 403 confirmerait l'existence de la demande : un tiers pourrait
        // cartographier les relations en énumérant les identifiants.
        const pending = repo.seed(ALICE, BOB, 'PENDING');
        expect(await codeOf(service.acceptRequest(CAROL, pending.id))).toBe(
            'REQUEST_NOT_FOUND',
        );
    });

    it('refuse une demande inexistante', async () => {
        expect(await codeOf(service.acceptRequest(BOB, 404))).toBe('REQUEST_NOT_FOUND');
    });
});

describe('rejectRequest', () => {
    it('supprime la demande refusée', async () => {
        const pending = repo.seed(ALICE, BOB, 'PENDING');
        await service.rejectRequest(BOB, pending.id);
        expect(repo.all()).toHaveLength(0);
    });

    it('permet de redemander après un refus', async () => {
        const pending = repo.seed(ALICE, BOB, 'PENDING');
        await service.rejectRequest(BOB, pending.id);

        const retry = await service.sendRequest(ALICE, BOB);
        expect(retry.status).toBe('PENDING');
    });

    it('renvoie « introuvable » à un tiers plutôt que « interdit »', async () => {
        const pending = repo.seed(ALICE, BOB, 'PENDING');
        expect(await codeOf(service.rejectRequest(CAROL, pending.id))).toBe(
            'RELATION_NOT_FOUND',
        );
    });
});

describe('cancelRequest', () => {
    it('annule une demande envoyée', async () => {
        const pending = repo.seed(ALICE, BOB, 'PENDING');
        await service.cancelRequest(ALICE, pending.id);
        expect(repo.all()).toHaveLength(0);
    });

    it('interdit au destinataire d annuler', async () => {
        const pending = repo.seed(ALICE, BOB, 'PENDING');
        expect(await codeOf(service.cancelRequest(BOB, pending.id))).toBe('NOT_REQUESTER');
    });
});

describe('removeFriend', () => {
    it('rompt une amitié depuis le demandeur initial', async () => {
        repo.seed(ALICE, BOB, 'ACCEPTED');
        await service.removeFriend(ALICE, BOB);
        expect(await service.listFriends(ALICE)).toHaveLength(0);
    });

    it('rompt une amitié depuis l autre partie', async () => {
        repo.seed(ALICE, BOB, 'ACCEPTED');
        await service.removeFriend(BOB, ALICE);
        expect(repo.all()).toHaveLength(0);
    });

    it('refuse de rompre une relation inexistante', async () => {
        expect(await codeOf(service.removeFriend(ALICE, CAROL))).toBe('RELATION_NOT_FOUND');
    });
});

describe('blockUser', () => {
    it('bloque un compte sans relation préalable', async () => {
        await service.blockUser(ALICE, BOB);
        const blocked = await service.listBlocked(ALICE);
        expect(blocked.map(user => user.id)).toEqual([BOB]);
    });

    it('rompt l amitié existante en bloquant', async () => {
        repo.seed(ALICE, BOB, 'ACCEPTED');
        await service.blockUser(ALICE, BOB);

        expect(await service.listFriends(ALICE)).toHaveLength(0);
        expect(await service.listFriends(BOB)).toHaveLength(0);
    });

    it('conserve une seule ligne après blocage', async () => {
        repo.seed(BOB, ALICE, 'PENDING');
        await service.blockUser(ALICE, BOB);
        expect(repo.all()).toHaveLength(1);
    });

    it('enregistre le bloqueur comme auteur de la relation', async () => {
        repo.seed(BOB, ALICE, 'PENDING');
        await service.blockUser(ALICE, BOB);

        const [row] = repo.all();
        expect(row?.requesterId).toBe(ALICE);
        expect(row?.status).toBe('BLOCKED');
    });

    it('empêche le compte bloqué de redemander en ami', async () => {
        await service.blockUser(ALICE, BOB);
        expect(await codeOf(service.sendRequest(BOB, ALICE))).toBe('RELATION_BLOCKED');
    });

    it('refuse un blocage déjà en place', async () => {
        await service.blockUser(ALICE, BOB);
        expect(await codeOf(service.blockUser(ALICE, BOB))).toBe('ALREADY_BLOCKED');
    });

    it('refuse de se bloquer soi-même', async () => {
        expect(await codeOf(service.blockUser(ALICE, ALICE))).toBe('SELF_RELATION');
    });
});

describe('unblockUser', () => {
    it('lève le blocage posé par l utilisateur', async () => {
        await service.blockUser(ALICE, BOB);
        await service.unblockUser(ALICE, BOB);
        expect(repo.all()).toHaveLength(0);
    });

    it('permet de redemander en ami après déblocage', async () => {
        await service.blockUser(ALICE, BOB);
        await service.unblockUser(ALICE, BOB);

        const result = await service.sendRequest(BOB, ALICE);
        expect(result.status).toBe('PENDING');
    });

    it('interdit au compte bloqué de se débloquer', async () => {
        await service.blockUser(ALICE, BOB);
        expect(await codeOf(service.unblockUser(BOB, ALICE))).toBe('NOT_BLOCKER');
    });
});

describe('listes', () => {
    it('renvoie les amis triés par nom d utilisateur', async () => {
        repo.addUser(4, 'aaron');
        repo.seed(ALICE, BOB, 'ACCEPTED');
        repo.seed(4, ALICE, 'ACCEPTED');

        const friends = await service.listFriends(ALICE);
        expect(friends.map(user => user.username)).toEqual(['aaron', 'bob']);
    });

    it('exclut les demandes en attente de la liste d amis', async () => {
        repo.seed(ALICE, BOB, 'PENDING');
        expect(await service.listFriends(ALICE)).toHaveLength(0);
    });

    it('sépare les demandes reçues et envoyées', async () => {
        repo.seed(BOB, ALICE, 'PENDING');
        repo.seed(ALICE, CAROL, 'PENDING');

        const incoming = await service.listIncomingRequests(ALICE);
        const outgoing = await service.listOutgoingRequests(ALICE);

        expect(incoming.map(item => item.user.id)).toEqual([BOB]);
        expect(outgoing.map(item => item.user.id)).toEqual([CAROL]);
    });
});

describe('getRelationStatus', () => {
    it('renvoie NONE sans relation', async () => {
        const status = await service.getRelationStatus(ALICE, BOB);
        expect(status).toEqual({ status: 'NONE', direction: null });
    });

    it('distingue une demande envoyée d une demande reçue', async () => {
        repo.seed(ALICE, BOB, 'PENDING');
        expect((await service.getRelationStatus(ALICE, BOB)).direction).toBe('sent');
        expect((await service.getRelationStatus(BOB, ALICE)).direction).toBe('received');
    });

    it('masque à la personne bloquée le fait qu elle l est', async () => {
        await service.blockUser(ALICE, BOB);
        expect(await service.getRelationStatus(BOB, ALICE)).toEqual({
            status: 'NONE',
            direction: null,
        });
    });

    it('expose le blocage à son auteur', async () => {
        await service.blockUser(ALICE, BOB);
        expect((await service.getRelationStatus(ALICE, BOB)).status).toBe('BLOCKED');
    });
});

describe('areFriends', () => {
    it('renvoie true pour deux amis confirmés', async () => {
        repo.seed(ALICE, BOB, 'ACCEPTED');
        expect(await service.areFriends(ALICE, BOB)).toBe(true);
    });

    it('renvoie false pour une demande en attente', async () => {
        repo.seed(ALICE, BOB, 'PENDING');
        expect(await service.areFriends(ALICE, BOB)).toBe(false);
    });

    it('renvoie false sans relation', async () => {
        expect(await service.areFriends(ALICE, CAROL)).toBe(false);
    });
});
