/**
 * Règles métier du système d'amitié (E2).
 *
 * Module volontairement pur : aucune dépendance à Prisma, Express ou au
 * réseau. Chaque fonction reçoit l'état lu en base et décide ; le service se
 * charge ensuite d'écrire. Cela rend les règles testables en millisecondes et
 * relisibles sans ouvrir la couche d'accès aux données.
 *
 * ## Limitation connue du modèle
 * `Friendship` ne stocke qu'une ligne par couple, avec un seul `status`. Le
 * blocage mutuel (A bloque B *et* B bloque A) n'est donc pas représentable :
 * le second blocage est refusé. Corriger cela demande un modèle `Block`
 * distinct — à arbitrer en équipe, via une PR de migration dédiée.
 */

import {
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
} from '../../shared/errors/app-error.js';
import type { RelationStatus, RelationView } from './friends.types.js';

/** Décision prise face à une demande d'amitié. */
export type RequestPlan =
    /** Aucune relation : créer une ligne `PENDING`. */
    | { action: 'create' }
    /** Demande croisée : accepter la ligne existante. */
    | { action: 'accept'; friendshipId: number };

/**
 * Vérifie qu'un utilisateur n'agit pas sur lui-même.
 *
 * @param actorId Utilisateur à l'origine de l'action.
 * @param targetId Utilisateur ciblé.
 * @throws {BadRequestError} Si les deux identifiants sont identiques.
 */
export function assertNotSelf(actorId: number, targetId: number): void {
    if (actorId === targetId) {
        throw new BadRequestError(
            'SELF_RELATION',
            'Impossible de créer une relation avec soi-même.',
        );
    }
}

/**
 * Renvoie l'identifiant de l'autre partie d'une relation.
 *
 * @param relation Relation concernée.
 * @param viewerId Utilisateur courant, nécessairement l'une des deux parties.
 * @return L'identifiant de l'autre partie.
 * @throws {ForbiddenError} Si le lecteur n'appartient pas à la relation.
 */
export function otherPartyId(relation: RelationView, viewerId: number): number {
    if (relation.requesterId === viewerId) {
        return relation.addresseeId;
    }
    if (relation.addresseeId === viewerId) {
        return relation.requesterId;
    }
    throw new ForbiddenError('NOT_A_PARTY', 'Relation étrangère à cet utilisateur.');
}

/**
 * Détermine ce qu'il faut faire d'une demande d'amitié.
 *
 * Cas particulier : si la cible avait déjà sollicité l'acteur, la nouvelle
 * demande vaut acceptation. Sans cela, deux personnes qui se sollicitent
 * mutuellement resteraient bloquées avec deux demandes en attente.
 *
 * @param existing Relation déjà en base entre les deux comptes, ou `null`.
 * @param actorId Auteur de la demande.
 * @param targetId Destinataire de la demande.
 * @return L'opération à effectuer.
 * @throws {BadRequestError} Sur une demande vers soi-même.
 * @throws {ConflictError} Si une relation empêche la demande.
 * @throws {ForbiddenError} Si la relation est bloquée.
 */
export function planRequest(
    existing: RelationView | null,
    actorId: number,
    targetId: number,
): RequestPlan {
    assertNotSelf(actorId, targetId);

    if (existing === null) {
        return { action: 'create' };
    }

    switch (existing.status) {
        case 'ACCEPTED':
            throw new ConflictError('ALREADY_FRIENDS', 'Vous êtes déjà amis.');

        case 'BLOCKED':
            // Message volontairement neutre : révéler qui a bloqué qui
            // renseignerait l'émetteur sur un choix privé de la cible.
            throw new ForbiddenError(
                'RELATION_BLOCKED',
                'Cette demande ne peut pas aboutir.',
            );

        case 'PENDING':
            if (existing.requesterId === actorId) {
                throw new ConflictError(
                    'REQUEST_ALREADY_SENT',
                    'Une demande est déjà en attente.',
                );
            }
            return { action: 'accept', friendshipId: existing.id };

        default: {
            // Garde d'exhaustivité : échoue à la compilation si un statut est ajouté.
            const exhaustive: never = existing.status;
            throw new BadRequestError('UNKNOWN_STATUS', `Statut inconnu : ${String(exhaustive)}`);
        }
    }
}

/**
 * Vérifie qu'un utilisateur peut accepter une demande.
 *
 * Seul le destinataire peut accepter : c'est ce qui empêche un demandeur de
 * s'auto-ajouter comme ami.
 *
 * @param relation Relation visée, ou `null` si elle n'existe pas.
 * @param actorId Utilisateur qui accepte.
 * @throws {NotFoundError} Si aucune demande n'existe.
 * @throws {ConflictError} Si la relation n'est plus en attente.
 * @throws {ForbiddenError} Si l'acteur n'est pas le destinataire.
 */
export function assertCanAccept(relation: RelationView | null, actorId: number): void {
    if (relation === null) {
        throw new NotFoundError('REQUEST_NOT_FOUND', 'Aucune demande à traiter.');
    }
    if (relation.status !== 'PENDING') {
        throw new ConflictError('REQUEST_NOT_PENDING', 'Cette demande n’est plus en attente.');
    }
    if (relation.addresseeId !== actorId) {
        throw new ForbiddenError(
            'NOT_ADDRESSEE',
            'Seul le destinataire peut accepter cette demande.',
        );
    }
}

/**
 * Vérifie qu'un utilisateur peut refuser une demande ou rompre une amitié.
 *
 * Les deux actions partagent la même règle : appartenir à la relation, et que
 * celle-ci ne soit pas bloquée (une relation bloquée se lève par déblocage).
 *
 * @param relation Relation visée, ou `null` si elle n'existe pas.
 * @param actorId Utilisateur qui agit.
 * @throws {NotFoundError} Si la relation n'existe pas.
 * @throws {ConflictError} Si la relation est bloquée.
 * @throws {ForbiddenError} Si l'acteur n'appartient pas à la relation.
 */
export function assertCanRejectOrRemove(
    relation: RelationView | null,
    actorId: number,
): void {
    if (relation === null) {
        throw new NotFoundError('RELATION_NOT_FOUND', 'Aucune relation à supprimer.');
    }
    if (relation.status === 'BLOCKED') {
        throw new ConflictError(
            'RELATION_BLOCKED',
            'Relation bloquée : utilisez le déblocage.',
        );
    }
    otherPartyId(relation, actorId);
}

/**
 * Vérifie qu'un utilisateur peut annuler la demande qu'il a envoyée.
 *
 * @param relation Relation visée, ou `null` si elle n'existe pas.
 * @param actorId Utilisateur qui annule.
 * @throws {NotFoundError} Si la relation n'existe pas.
 * @throws {ConflictError} Si la demande n'est plus en attente.
 * @throws {ForbiddenError} Si l'acteur n'est pas le demandeur.
 */
export function assertCanCancel(relation: RelationView | null, actorId: number): void {
    if (relation === null) {
        throw new NotFoundError('REQUEST_NOT_FOUND', 'Aucune demande à annuler.');
    }
    if (relation.status !== 'PENDING') {
        throw new ConflictError('REQUEST_NOT_PENDING', 'Cette demande n’est plus en attente.');
    }
    if (relation.requesterId !== actorId) {
        throw new ForbiddenError(
            'NOT_REQUESTER',
            'Seul l’auteur de la demande peut l’annuler.',
        );
    }
}

/**
 * Vérifie qu'un utilisateur peut en bloquer un autre.
 *
 * Le blocage est possible depuis n'importe quel état, sauf si l'autre partie
 * a déjà posé un blocage — le modèle à une seule ligne ne sait pas représenter
 * un blocage mutuel.
 *
 * @param relation Relation existante, ou `null`.
 * @param actorId Utilisateur qui bloque.
 * @param targetId Utilisateur bloqué.
 * @throws {BadRequestError} Sur un blocage de soi-même.
 * @throws {ConflictError} Si un blocage est déjà en place.
 */
export function assertCanBlock(
    relation: RelationView | null,
    actorId: number,
    targetId: number,
): void {
    assertNotSelf(actorId, targetId);

    if (relation !== null && relation.status === 'BLOCKED') {
        throw new ConflictError(
            'ALREADY_BLOCKED',
            'Un blocage est déjà en place sur cette relation.',
        );
    }
}

/**
 * Vérifie qu'un utilisateur peut lever un blocage.
 *
 * Seul l'auteur du blocage peut le lever, sinon la personne bloquée pourrait
 * se débloquer elle-même et la fonctionnalité n'aurait aucun effet.
 *
 * @param relation Relation visée, ou `null` si elle n'existe pas.
 * @param actorId Utilisateur qui débloque.
 * @throws {NotFoundError} Si la relation n'existe pas.
 * @throws {ConflictError} Si la relation n'est pas bloquée.
 * @throws {ForbiddenError} Si l'acteur n'est pas l'auteur du blocage.
 */
export function assertCanUnblock(relation: RelationView | null, actorId: number): void {
    if (relation === null) {
        throw new NotFoundError('RELATION_NOT_FOUND', 'Aucune relation à débloquer.');
    }
    if (relation.status !== 'BLOCKED') {
        throw new ConflictError('NOT_BLOCKED', 'Cette relation n’est pas bloquée.');
    }
    if (relation.requesterId !== actorId) {
        throw new ForbiddenError(
            'NOT_BLOCKER',
            'Seul l’auteur du blocage peut le lever.',
        );
    }
}

/**
 * Projette une relation en statut affichable pour un lecteur donné.
 *
 * Un blocage subi est présenté comme une absence de relation : la personne
 * bloquée ne doit pas pouvoir déduire qu'elle l'a été.
 *
 * @param relation Relation existante, ou `null`.
 * @param viewerId Lecteur courant.
 * @return Le statut et, le cas échéant, le sens de la demande.
 */
export function toRelationStatus(
    relation: RelationView | null,
    viewerId: number,
): RelationStatus {
    const none: RelationStatus = { status: 'NONE', direction: null };

    if (relation === null) {
        return none;
    }

    if (relation.status === 'BLOCKED') {
        return relation.requesterId === viewerId
            ? { status: 'BLOCKED', direction: 'sent' }
            : none;
    }

    if (relation.status === 'ACCEPTED') {
        return { status: 'ACCEPTED', direction: null };
    }

    return {
        status: 'PENDING',
        direction: relation.requesterId === viewerId ? 'sent' : 'received',
    };
}
