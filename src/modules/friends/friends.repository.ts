/**
 * Accès aux données du module amis.
 *
 * Le service dépend de l'interface `FriendsRepository`, pas de Prisma
 * directement : c'est ce qui permet de tester l'orchestration avec un dépôt
 * en mémoire, sans base ni client généré.
 */

import { prisma } from '../../config/db.js';
import type { FriendSummary, PendingRequest, RelationView } from './friends.types.js';

/** Contrat d'accès aux données, implémenté par Prisma et par les tests. */
export interface FriendsRepository {
    /**
     * Recherche la relation entre deux comptes, dans les deux sens.
     *
     * @param a Premier compte.
     * @param b Second compte.
     * @return La relation, ou `null` si aucune n'existe.
     */
    findRelation(a: number, b: number): Promise<RelationView | null>;

    /**
     * Vérifie l'existence d'un compte.
     *
     * @param userId Compte recherché.
     * @return `true` si le compte existe.
     */
    userExists(userId: number): Promise<boolean>;

    /**
     * Crée une demande en attente.
     *
     * @param requesterId Auteur de la demande.
     * @param addresseeId Destinataire.
     * @return La relation créée.
     */
    createPending(requesterId: number, addresseeId: number): Promise<RelationView>;

    /**
     * Passe une relation au statut accepté.
     *
     * @param friendshipId Identifiant de la relation.
     * @return La relation mise à jour.
     */
    markAccepted(friendshipId: number): Promise<RelationView>;

    /**
     * Remplace une relation par un blocage posé par `blockerId`.
     *
     * L'ancienne ligne est supprimée puis recréée dans le sens du bloqueur,
     * afin que `requesterId` désigne toujours l'auteur du blocage.
     *
     * @param blockerId Auteur du blocage.
     * @param blockedId Compte bloqué.
     * @return La relation bloquée.
     */
    replaceWithBlock(blockerId: number, blockedId: number): Promise<RelationView>;

    /**
     * Supprime une relation.
     *
     * @param friendshipId Identifiant de la relation.
     */
    remove(friendshipId: number): Promise<void>;

    /**
     * Liste les amis confirmés d'un compte.
     *
     * @param userId Compte concerné.
     * @return Les profils publics des amis, triés par nom d'utilisateur.
     */
    listFriends(userId: number): Promise<FriendSummary[]>;

    /**
     * Liste les demandes reçues et non traitées.
     *
     * @param userId Destinataire des demandes.
     * @return Les demandes, de la plus récente à la plus ancienne.
     */
    listIncoming(userId: number): Promise<PendingRequest[]>;

    /**
     * Liste les demandes envoyées et non traitées.
     *
     * @param userId Auteur des demandes.
     * @return Les demandes, de la plus récente à la plus ancienne.
     */
    listOutgoing(userId: number): Promise<PendingRequest[]>;

    /**
     * Liste les comptes bloqués par un utilisateur.
     *
     * @param userId Auteur des blocages.
     * @return Les profils publics des comptes bloqués.
     */
    listBlocked(userId: number): Promise<FriendSummary[]>;
}

/** Champs de profil exposés dans les listes. */
const USER_SUMMARY_SELECT = { id: true, username: true, avatar: true } as const;

/** Ligne Friendship telle que renvoyée par Prisma. */
interface FriendshipRow {
    id: number;
    userId: number;
    friendId: number;
    status: string;
}

/** Convertit une ligne Prisma en vue métier. */
function toRelation(row: FriendshipRow): RelationView {
    return {
        id: row.id,
        requesterId: row.userId,
        addresseeId: row.friendId,
        status: row.status as RelationView['status'],
    };
}

/** Implémentation Prisma du dépôt. */
export class PrismaFriendsRepository implements FriendsRepository {
    async findRelation(a: number, b: number): Promise<RelationView | null> {
        // Le modèle est directionnel : il faut interroger les deux sens.
        const row = await prisma.friendship.findFirst({
            where: {
                OR: [
                    { userId: a, friendId: b },
                    { userId: b, friendId: a },
                ],
            },
        });
        return row === null ? null : toRelation(row);
    }

    async userExists(userId: number): Promise<boolean> {
        const found = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true },
        });
        return found !== null;
    }

    async createPending(requesterId: number, addresseeId: number): Promise<RelationView> {
        const row = await prisma.friendship.create({
            data: { userId: requesterId, friendId: addresseeId, status: 'PENDING' },
        });
        return toRelation(row);
    }

    async markAccepted(friendshipId: number): Promise<RelationView> {
        const row = await prisma.friendship.update({
            where: { id: friendshipId },
            data: { status: 'ACCEPTED' },
        });
        return toRelation(row);
    }

    async replaceWithBlock(blockerId: number, blockedId: number): Promise<RelationView> {
        // Transaction : la suppression et la recréation doivent être atomiques,
        // sinon un incident laisse le couple sans aucune relation. La forme
        // tableau garantit l'ordre et l'atomicité sans callback à typer.
        const [, row] = await prisma.$transaction([
            prisma.friendship.deleteMany({
                where: {
                    OR: [
                        { userId: blockerId, friendId: blockedId },
                        { userId: blockedId, friendId: blockerId },
                    ],
                },
            }),
            prisma.friendship.create({
                data: { userId: blockerId, friendId: blockedId, status: 'BLOCKED' },
            }),
        ]);
        return toRelation(row as FriendshipRow);
    }

    async remove(friendshipId: number): Promise<void> {
        await prisma.friendship.delete({ where: { id: friendshipId } });
    }

    async listFriends(userId: number): Promise<FriendSummary[]> {
        const rows = await prisma.friendship.findMany({
            where: {
                status: 'ACCEPTED',
                OR: [{ userId }, { friendId: userId }],
            },
            include: {
                user: { select: USER_SUMMARY_SELECT },
                friend: { select: USER_SUMMARY_SELECT },
            },
        });

        // Selon le sens de stockage, l'ami est dans `user` ou dans `friend`.
        const joined = rows as Array<{
            userId: number;
            user: FriendSummary;
            friend: FriendSummary;
        }>;
        return joined
            .map(row => (row.userId === userId ? row.friend : row.user))
            .sort((a, b) => a.username.localeCompare(b.username));
    }

    async listIncoming(userId: number): Promise<PendingRequest[]> {
        const rows = await prisma.friendship.findMany({
            where: { friendId: userId, status: 'PENDING' },
            include: { user: { select: USER_SUMMARY_SELECT } },
            orderBy: { createdAt: 'desc' },
        });
        const joined = rows as Array<{ id: number; user: FriendSummary; createdAt: Date }>;
        return joined.map(row => ({
            friendshipId: row.id,
            user: row.user,
            createdAt: row.createdAt.toISOString(),
        }));
    }

    async listOutgoing(userId: number): Promise<PendingRequest[]> {
        const rows = await prisma.friendship.findMany({
            where: { userId, status: 'PENDING' },
            include: { friend: { select: USER_SUMMARY_SELECT } },
            orderBy: { createdAt: 'desc' },
        });
        const joined = rows as Array<{ id: number; friend: FriendSummary; createdAt: Date }>;
        return joined.map(row => ({
            friendshipId: row.id,
            user: row.friend,
            createdAt: row.createdAt.toISOString(),
        }));
    }

    async listBlocked(userId: number): Promise<FriendSummary[]> {
        const rows = await prisma.friendship.findMany({
            where: { userId, status: 'BLOCKED' },
            include: { friend: { select: USER_SUMMARY_SELECT } },
        });
        return (rows as Array<{ friend: FriendSummary }>).map(row => row.friend);
    }
}
