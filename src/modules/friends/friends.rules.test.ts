import { describe, it, expect } from 'vitest';
import {
    assertCanAccept,
    assertCanBlock,
    assertCanCancel,
    assertCanRejectOrRemove,
    assertCanUnblock,
    assertNotSelf,
    otherPartyId,
    planRequest,
    toRelationStatus,
} from './friends.rules.js';
import type { RelationView } from './friends.types.js';
import { AppError } from '../../shared/errors/app-error.js';

const ALICE = 1;
const BOB = 2;
const CAROL = 3;

/** Construit une relation de test avec des valeurs par défaut surchargeables. */
function relation(over: Partial<RelationView> = {}): RelationView {
    return { id: 10, requesterId: ALICE, addresseeId: BOB, status: 'PENDING', ...over };
}

describe('assertNotSelf', () => {
    it('laisse passer deux identifiants différents', () => {
        expect(() => assertNotSelf(ALICE, BOB)).not.toThrow();
    });

    it('refuse une relation avec soi-même', () => {
        expect(() => assertNotSelf(ALICE, ALICE)).toThrow(AppError);
    });

    it('renvoie le code SELF_RELATION', () => {
        try {
            assertNotSelf(ALICE, ALICE);
            expect.unreachable('aurait dû lever');
        } catch (error) {
            expect((error as AppError).code).toBe('SELF_RELATION');
            expect((error as AppError).status).toBe(400);
        }
    });
});

describe('otherPartyId', () => {
    it('renvoie le destinataire quand le lecteur est le demandeur', () => {
        expect(otherPartyId(relation(), ALICE)).toBe(BOB);
    });

    it('renvoie le demandeur quand le lecteur est le destinataire', () => {
        expect(otherPartyId(relation(), BOB)).toBe(ALICE);
    });

    it('refuse un lecteur étranger à la relation', () => {
        expect(() => otherPartyId(relation(), CAROL)).toThrow(AppError);
    });
});

describe('planRequest', () => {
    it('crée une demande quand aucune relation n existe', () => {
        expect(planRequest(null, ALICE, BOB)).toEqual({ action: 'create' });
    });

    it('accepte automatiquement une demande croisée', () => {
        // Bob avait déjà sollicité Alice : la demande d'Alice vaut acceptation.
        const existing = relation({ requesterId: BOB, addresseeId: ALICE });
        expect(planRequest(existing, ALICE, BOB)).toEqual({
            action: 'accept',
            friendshipId: 10,
        });
    });

    it('refuse une seconde demande vers la même personne', () => {
        expect(() => planRequest(relation(), ALICE, BOB)).toThrow(AppError);
    });

    it('renvoie REQUEST_ALREADY_SENT sur une demande en double', () => {
        try {
            planRequest(relation(), ALICE, BOB);
            expect.unreachable('aurait dû lever');
        } catch (error) {
            expect((error as AppError).code).toBe('REQUEST_ALREADY_SENT');
        }
    });

    it('refuse une demande entre amis déjà confirmés', () => {
        const accepted = relation({ status: 'ACCEPTED' });
        try {
            planRequest(accepted, ALICE, BOB);
            expect.unreachable('aurait dû lever');
        } catch (error) {
            expect((error as AppError).code).toBe('ALREADY_FRIENDS');
        }
    });

    it('refuse une demande sur une relation bloquée', () => {
        const blocked = relation({ status: 'BLOCKED', requesterId: BOB, addresseeId: ALICE });
        try {
            planRequest(blocked, ALICE, BOB);
            expect.unreachable('aurait dû lever');
        } catch (error) {
            expect((error as AppError).code).toBe('RELATION_BLOCKED');
        }
    });

    it('ne révèle pas qui a bloqué qui', () => {
        // Le message ne doit pas permettre de déduire que la cible a bloqué :
        // c'est une fuite d'information sur un choix privé.
        const blocked = relation({ status: 'BLOCKED', requesterId: BOB, addresseeId: ALICE });
        try {
            planRequest(blocked, ALICE, BOB);
            expect.unreachable('aurait dû lever');
        } catch (error) {
            expect((error as AppError).message.toLowerCase()).not.toContain('bloqué par');
        }
    });

    it('refuse une demande vers soi-même', () => {
        expect(() => planRequest(null, ALICE, ALICE)).toThrow(AppError);
    });
});

describe('assertCanAccept', () => {
    it('autorise le destinataire de la demande', () => {
        expect(() => assertCanAccept(relation(), BOB)).not.toThrow();
    });

    it('interdit au demandeur d accepter sa propre demande', () => {
        try {
            assertCanAccept(relation(), ALICE);
            expect.unreachable('aurait dû lever');
        } catch (error) {
            expect((error as AppError).code).toBe('NOT_ADDRESSEE');
            expect((error as AppError).status).toBe(403);
        }
    });

    it('interdit à un tiers d accepter', () => {
        expect(() => assertCanAccept(relation(), CAROL)).toThrow(AppError);
    });

    it('refuse une relation inexistante', () => {
        try {
            assertCanAccept(null, BOB);
            expect.unreachable('aurait dû lever');
        } catch (error) {
            expect((error as AppError).status).toBe(404);
        }
    });

    it('refuse d accepter une relation déjà acceptée', () => {
        const accepted = relation({ status: 'ACCEPTED' });
        expect(() => assertCanAccept(accepted, BOB)).toThrow(AppError);
    });

    it('refuse d accepter une relation bloquée', () => {
        const blocked = relation({ status: 'BLOCKED' });
        expect(() => assertCanAccept(blocked, BOB)).toThrow(AppError);
    });
});

describe('assertCanRejectOrRemove', () => {
    it('autorise le destinataire à refuser une demande', () => {
        expect(() => assertCanRejectOrRemove(relation(), BOB)).not.toThrow();
    });

    it('autorise chacun des deux amis à rompre une amitié', () => {
        const accepted = relation({ status: 'ACCEPTED' });
        expect(() => assertCanRejectOrRemove(accepted, ALICE)).not.toThrow();
        expect(() => assertCanRejectOrRemove(accepted, BOB)).not.toThrow();
    });

    it('interdit à un tiers de rompre la relation', () => {
        const accepted = relation({ status: 'ACCEPTED' });
        expect(() => assertCanRejectOrRemove(accepted, CAROL)).toThrow(AppError);
    });

    it('refuse de supprimer une relation bloquée', () => {
        // Le retrait passe par le déblocage, sinon la personne bloquée lèverait son propre blocage.
        const blocked = relation({ status: 'BLOCKED' });
        expect(() => assertCanRejectOrRemove(blocked, BOB)).toThrow(AppError);
    });

    it('refuse une relation inexistante', () => {
        expect(() => assertCanRejectOrRemove(null, ALICE)).toThrow(AppError);
    });
});

describe('assertCanCancel', () => {
    it('autorise le demandeur à annuler sa demande', () => {
        expect(() => assertCanCancel(relation(), ALICE)).not.toThrow();
    });

    it('interdit au destinataire d annuler (il doit refuser)', () => {
        try {
            assertCanCancel(relation(), BOB);
            expect.unreachable('aurait dû lever');
        } catch (error) {
            expect((error as AppError).code).toBe('NOT_REQUESTER');
        }
    });

    it('refuse d annuler une amitié acceptée', () => {
        const accepted = relation({ status: 'ACCEPTED' });
        expect(() => assertCanCancel(accepted, ALICE)).toThrow(AppError);
    });
});

describe('assertCanBlock', () => {
    it('autorise le blocage sans relation préalable', () => {
        expect(() => assertCanBlock(null, ALICE, BOB)).not.toThrow();
    });

    it('autorise le blocage d une demande en attente', () => {
        expect(() => assertCanBlock(relation(), BOB, ALICE)).not.toThrow();
    });

    it('autorise le blocage d un ami confirmé', () => {
        const accepted = relation({ status: 'ACCEPTED' });
        expect(() => assertCanBlock(accepted, ALICE, BOB)).not.toThrow();
    });

    it('refuse de se bloquer soi-même', () => {
        expect(() => assertCanBlock(null, ALICE, ALICE)).toThrow(AppError);
    });

    it('refuse un second blocage par le même auteur', () => {
        const blocked = relation({ status: 'BLOCKED' });
        try {
            assertCanBlock(blocked, ALICE, BOB);
            expect.unreachable('aurait dû lever');
        } catch (error) {
            expect((error as AppError).code).toBe('ALREADY_BLOCKED');
        }
    });

    it('refuse de bloquer quand l autre partie a déjà bloqué', () => {
        // Limitation assumée du modèle à une seule ligne : le blocage mutuel
        // n'est pas représentable. Voir la note dans friends.rules.ts.
        const blocked = relation({ status: 'BLOCKED', requesterId: BOB, addresseeId: ALICE });
        expect(() => assertCanBlock(blocked, ALICE, BOB)).toThrow(AppError);
    });
});

describe('assertCanUnblock', () => {
    it('autorise l auteur du blocage à le lever', () => {
        const blocked = relation({ status: 'BLOCKED' });
        expect(() => assertCanUnblock(blocked, ALICE)).not.toThrow();
    });

    it('interdit au compte bloqué de lever son propre blocage', () => {
        const blocked = relation({ status: 'BLOCKED' });
        try {
            assertCanUnblock(blocked, BOB);
            expect.unreachable('aurait dû lever');
        } catch (error) {
            expect((error as AppError).code).toBe('NOT_BLOCKER');
        }
    });

    it('refuse de débloquer une relation non bloquée', () => {
        expect(() => assertCanUnblock(relation(), ALICE)).toThrow(AppError);
    });

    it('refuse une relation inexistante', () => {
        expect(() => assertCanUnblock(null, ALICE)).toThrow(AppError);
    });
});

describe('toRelationStatus', () => {
    it('renvoie NONE sans relation', () => {
        expect(toRelationStatus(null, ALICE)).toEqual({ status: 'NONE', direction: null });
    });

    it('indique une demande envoyée par le lecteur', () => {
        expect(toRelationStatus(relation(), ALICE)).toEqual({
            status: 'PENDING',
            direction: 'sent',
        });
    });

    it('indique une demande reçue par le lecteur', () => {
        expect(toRelationStatus(relation(), BOB)).toEqual({
            status: 'PENDING',
            direction: 'received',
        });
    });

    it('ne donne pas de direction pour une amitié acceptée', () => {
        const accepted = relation({ status: 'ACCEPTED' });
        expect(toRelationStatus(accepted, ALICE).direction).toBeNull();
    });

    it('masque le blocage subi en NONE pour ne rien révéler', () => {
        // Alice est bloquée par Bob : elle ne doit pas pouvoir le déduire.
        const blocked = relation({ status: 'BLOCKED', requesterId: BOB, addresseeId: ALICE });
        expect(toRelationStatus(blocked, ALICE)).toEqual({ status: 'NONE', direction: null });
    });

    it('expose le blocage à son auteur', () => {
        const blocked = relation({ status: 'BLOCKED', requesterId: ALICE, addresseeId: BOB });
        expect(toRelationStatus(blocked, ALICE)).toEqual({
            status: 'BLOCKED',
            direction: 'sent',
        });
    });
});
