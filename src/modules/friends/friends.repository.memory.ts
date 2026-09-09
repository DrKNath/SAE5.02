/**
 * Dépôt en mémoire, réservé aux tests.
 *
 * Reproduit le comportement du dépôt Prisma sans base : les tests du service
 * s'exécutent en millisecondes et restent isolés les uns des autres. Ce
 * fichier n'est jamais importé par le code de production.
 */

import type { FriendsRepository } from './friends.repository.js';
import type { FriendSummary, PendingRequest, RelationView } from './friends.types.js';

/** Ligne stockée en mémoire. */
interface MemoryRow extends RelationView {
    /** Date de création, pour reproduire le tri des listes. */
    createdAt: Date;
}

/** Implémentation en mémoire du dépôt des amitiés. */
export class InMemoryFriendsRepository implements FriendsRepository {
    private rows: MemoryRow[] = [];
    private nextId = 1;
    private clock = 0;

    /**
     * @param users Comptes connus, indexés par identifiant.
     */
    constructor(private readonly users: Map<number, FriendSummary> = new Map()) {}

    /**
     * Enregistre un compte utilisable dans les tests.
     *
     * @param id Identifiant du compte.
     * @param username Nom d'utilisateur.
     * @return Le profil créé.
     */
    addUser(id: number, username: string): FriendSummary {
        const user: FriendSummary = { id, username, avatar: null };
        this.users.set(id, user);
        return user;
    }

    /**
     * Insère directement une relation, pour préparer un état de départ.
     *
     * @param requesterId Auteur de la relation.
     * @param addresseeId Destinataire.
     * @param status Statut initial.
     * @return La relation créée.
     */
    seed(
        requesterId: number,
        addresseeId: number,
        status: RelationView['status'],
    ): RelationView {
        const row: MemoryRow = {
            id: this.nextId++,
            requesterId,
            addresseeId,
            status,
            createdAt: new Date(this.clock++),
        };
        this.rows.push(row);
        return { ...row };
    }

    /** Renvoie une copie de toutes les lignes, pour les assertions. */
    all(): RelationView[] {
        return this.rows.map(row => ({ ...row }));
    }

    async findRelation(a: number, b: number): Promise<RelationView | null> {
        const found = this.rows.find(
            row =>
                (row.requesterId === a && row.addresseeId === b) ||
                (row.requesterId === b && row.addresseeId === a),
        );
        return found === undefined ? null : { ...found };
    }

    async userExists(userId: number): Promise<boolean> {
        return this.users.has(userId);
    }

    async createPending(requesterId: number, addresseeId: number): Promise<RelationView> {
        return this.seed(requesterId, addresseeId, 'PENDING');
    }

    async markAccepted(friendshipId: number): Promise<RelationView> {
        const row = this.mustFind(friendshipId);
        row.status = 'ACCEPTED';
        return { ...row };
    }

    async replaceWithBlock(blockerId: number, blockedId: number): Promise<RelationView> {
        this.rows = this.rows.filter(
            row =>
                !(
                    (row.requesterId === blockerId && row.addresseeId === blockedId) ||
                    (row.requesterId === blockedId && row.addresseeId === blockerId)
                ),
        );
        return this.seed(blockerId, blockedId, 'BLOCKED');
    }

    async remove(friendshipId: number): Promise<void> {
        this.rows = this.rows.filter(row => row.id !== friendshipId);
    }

    async listFriends(userId: number): Promise<FriendSummary[]> {
        return this.rows
            .filter(
                row =>
                    row.status === 'ACCEPTED' &&
                    (row.requesterId === userId || row.addresseeId === userId),
            )
            .map(row =>
                this.mustUser(row.requesterId === userId ? row.addresseeId : row.requesterId),
            )
            .sort((a, b) => a.username.localeCompare(b.username));
    }

    async listIncoming(userId: number): Promise<PendingRequest[]> {
        return this.pending(row => row.addresseeId === userId, row => row.requesterId);
    }

    async listOutgoing(userId: number): Promise<PendingRequest[]> {
        return this.pending(row => row.requesterId === userId, row => row.addresseeId);
    }

    async listBlocked(userId: number): Promise<FriendSummary[]> {
        return this.rows
            .filter(row => row.status === 'BLOCKED' && row.requesterId === userId)
            .map(row => this.mustUser(row.addresseeId));
    }

    /** Filtre les demandes en attente et projette l'autre partie. */
    private pending(
        match: (row: MemoryRow) => boolean,
        otherId: (row: MemoryRow) => number,
    ): PendingRequest[] {
        return this.rows
            .filter(row => row.status === 'PENDING' && match(row))
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .map(row => ({
                friendshipId: row.id,
                user: this.mustUser(otherId(row)),
                createdAt: row.createdAt.toISOString(),
            }));
    }

    /** Retrouve une ligne ou échoue bruyamment : un test ne doit pas masquer un bug. */
    private mustFind(friendshipId: number): MemoryRow {
        const row = this.rows.find(item => item.id === friendshipId);
        if (row === undefined) {
            throw new Error(`Relation ${friendshipId} absente du dépôt de test.`);
        }
        return row;
    }

    /** Retrouve un profil ou échoue bruyamment. */
    private mustUser(userId: number): FriendSummary {
        const user = this.users.get(userId);
        if (user === undefined) {
            throw new Error(`Utilisateur ${userId} absent du dépôt de test.`);
        }
        return user;
    }
}
