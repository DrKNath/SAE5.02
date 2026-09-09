/**
 * Orchestration du module amis (E2).
 *
 * Le service lit l'état via le dépôt, délègue la décision aux règles pures de
 * `friends.rules.ts`, puis écrit le résultat. Aucune règle métier n'est écrite
 * ici : si une condition apparaît dans ce fichier, elle a sa place dans les
 * règles, où elle sera testable sans dépôt.
 */

import { NotFoundError } from '../../shared/errors/app-error.js';
import type { FriendsRepository } from './friends.repository.js';
import {
    assertCanAccept,
    assertCanBlock,
    assertCanCancel,
    assertCanRejectOrRemove,
    assertCanUnblock,
    assertNotSelf,
    planRequest,
    toRelationStatus,
} from './friends.rules.js';
import type {
    FriendSummary,
    PendingRequest,
    RelationStatus,
    RelationView,
} from './friends.types.js';

/** Cas d'usage du système d'amitié. */
export class FriendsService {
    /**
     * @param repo Dépôt d'accès aux relations.
     */
    constructor(private readonly repo: FriendsRepository) {}

    /**
     * Envoie une demande d'amitié.
     *
     * Si la cible avait déjà sollicité l'auteur, la demande vaut acceptation.
     *
     * @param actorId Auteur de la demande.
     * @param targetId Destinataire.
     * @return La relation résultante.
     * @throws {NotFoundError} Si le compte cible n'existe pas.
     * @throws {AppError} Si les règles refusent la demande.
     */
    async sendRequest(actorId: number, targetId: number): Promise<RelationView> {
        assertNotSelf(actorId, targetId);
        await this.assertUserExists(targetId);

        const existing = await this.repo.findRelation(actorId, targetId);
        const plan = planRequest(existing, actorId, targetId);

        return plan.action === 'accept'
            ? this.repo.markAccepted(plan.friendshipId)
            : this.repo.createPending(actorId, targetId);
    }

    /**
     * Accepte une demande reçue.
     *
     * @param actorId Utilisateur qui accepte.
     * @param friendshipId Demande visée.
     * @return La relation acceptée.
     * @throws {AppError} Si l'acteur n'est pas le destinataire, ou si la
     *     demande n'existe plus.
     */
    async acceptRequest(actorId: number, friendshipId: number): Promise<RelationView> {
        const relation = await this.findById(friendshipId, actorId);
        assertCanAccept(relation, actorId);
        return this.repo.markAccepted(friendshipId);
    }

    /**
     * Refuse une demande reçue.
     *
     * La ligne est supprimée plutôt que marquée : cela permet à l'émetteur de
     * retenter plus tard, et évite d'accumuler des demandes mortes en base.
     *
     * @param actorId Utilisateur qui refuse.
     * @param friendshipId Demande visée.
     * @throws {AppError} Si l'acteur n'appartient pas à la relation.
     */
    async rejectRequest(actorId: number, friendshipId: number): Promise<void> {
        const relation = await this.findById(friendshipId, actorId);
        assertCanRejectOrRemove(relation, actorId);
        await this.repo.remove(friendshipId);
    }

    /**
     * Annule une demande que l'on a soi-même envoyée.
     *
     * @param actorId Auteur de la demande.
     * @param friendshipId Demande visée.
     * @throws {AppError} Si l'acteur n'est pas le demandeur.
     */
    async cancelRequest(actorId: number, friendshipId: number): Promise<void> {
        const relation = await this.findById(friendshipId, actorId);
        assertCanCancel(relation, actorId);
        await this.repo.remove(friendshipId);
    }

    /**
     * Rompt une amitié existante.
     *
     * @param actorId Utilisateur qui rompt.
     * @param targetId L'ancien ami.
     * @throws {AppError} Si aucune relation n'existe, ou si elle est bloquée.
     */
    async removeFriend(actorId: number, targetId: number): Promise<void> {
        const relation = await this.repo.findRelation(actorId, targetId);
        assertCanRejectOrRemove(relation, actorId);
        await this.repo.remove(relation!.id);
    }

    /**
     * Bloque un compte.
     *
     * Le blocage remplace toute relation existante : une amitié est rompue et
     * une demande en attente disparaît.
     *
     * @param actorId Auteur du blocage.
     * @param targetId Compte bloqué.
     * @return La relation bloquée.
     * @throws {NotFoundError} Si le compte cible n'existe pas.
     * @throws {AppError} Si un blocage est déjà en place.
     */
    async blockUser(actorId: number, targetId: number): Promise<RelationView> {
        assertNotSelf(actorId, targetId);
        await this.assertUserExists(targetId);

        const existing = await this.repo.findRelation(actorId, targetId);
        assertCanBlock(existing, actorId, targetId);

        return this.repo.replaceWithBlock(actorId, targetId);
    }

    /**
     * Lève un blocage que l'on a posé.
     *
     * @param actorId Auteur du blocage.
     * @param targetId Compte bloqué.
     * @throws {AppError} Si l'acteur n'est pas l'auteur du blocage.
     */
    async unblockUser(actorId: number, targetId: number): Promise<void> {
        const relation = await this.repo.findRelation(actorId, targetId);
        assertCanUnblock(relation, actorId);
        await this.repo.remove(relation!.id);
    }

    /**
     * Liste les amis confirmés d'un utilisateur.
     *
     * @param userId Compte concerné.
     * @return Les profils publics, triés par nom d'utilisateur.
     */
    async listFriends(userId: number): Promise<FriendSummary[]> {
        return this.repo.listFriends(userId);
    }

    /**
     * Liste les demandes reçues et non traitées.
     *
     * @param userId Destinataire.
     * @return Les demandes, de la plus récente à la plus ancienne.
     */
    async listIncomingRequests(userId: number): Promise<PendingRequest[]> {
        return this.repo.listIncoming(userId);
    }

    /**
     * Liste les demandes envoyées et non traitées.
     *
     * @param userId Émetteur.
     * @return Les demandes, de la plus récente à la plus ancienne.
     */
    async listOutgoingRequests(userId: number): Promise<PendingRequest[]> {
        return this.repo.listOutgoing(userId);
    }

    /**
     * Liste les comptes bloqués par un utilisateur.
     *
     * @param userId Auteur des blocages.
     * @return Les profils publics des comptes bloqués.
     */
    async listBlocked(userId: number): Promise<FriendSummary[]> {
        return this.repo.listBlocked(userId);
    }

    /**
     * Donne l'état de la relation entre le lecteur et un autre compte.
     *
     * Un blocage subi est présenté comme une absence de relation.
     *
     * @param viewerId Lecteur courant.
     * @param otherId Autre compte.
     * @return Le statut affichable.
     */
    async getRelationStatus(viewerId: number, otherId: number): Promise<RelationStatus> {
        const relation = await this.repo.findRelation(viewerId, otherId);
        return toRelationStatus(relation, viewerId);
    }

    /**
     * Indique si deux comptes sont amis.
     *
     * Méthode destinée aux autres modules : le filtrage du fil (E3) et l'accès
     * aux conversations (E6) en dépendent.
     *
     * @param a Premier compte.
     * @param b Second compte.
     * @return `true` si l'amitié est acceptée.
     */
    async areFriends(a: number, b: number): Promise<boolean> {
        const relation = await this.repo.findRelation(a, b);
        return relation?.status === 'ACCEPTED';
    }

    /**
     * Charge une relation par identifiant, en s'assurant qu'elle concerne
     * bien l'acteur.
     *
     * Le dépôt n'expose pas de lecture par identifiant seul : la recherche
     * passe par les listes de l'acteur, ce qui empêche de sonder les
     * relations d'autrui en énumérant les identifiants.
     */
    private async findById(
        friendshipId: number,
        actorId: number,
    ): Promise<RelationView | null> {
        const candidates = [
            ...(await this.repo.listIncoming(actorId)),
            ...(await this.repo.listOutgoing(actorId)),
        ];
        const match = candidates.find(item => item.friendshipId === friendshipId);
        if (match === undefined) {
            return null;
        }
        return this.repo.findRelation(actorId, match.user.id);
    }

    /** Vérifie l'existence d'un compte cible. */
    private async assertUserExists(userId: number): Promise<void> {
        if (!(await this.repo.userExists(userId))) {
            throw new NotFoundError('USER_NOT_FOUND', 'Utilisateur introuvable.');
        }
    }
}
