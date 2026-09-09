/**
 * Types du module amis (E2).
 *
 * Le modèle Prisma `Friendship` est *directionnel* : une ligne porte
 * `userId` (l'initiateur) et `friendId` (le destinataire). Une relation entre
 * deux comptes peut donc être stockée dans un sens ou dans l'autre, et tout
 * le code doit interroger les deux directions.
 */

/**
 * Statut d'une relation.
 *
 * Le champ Prisma est un `String` libre : ajouter `BLOCKED` n'a demandé
 * aucune migration. Ces trois valeurs sont les seules acceptées côté code.
 */
export type FriendshipStatus = 'PENDING' | 'ACCEPTED' | 'BLOCKED';

/**
 * Vue neutre d'une relation, telle que lue en base.
 *
 * `requesterId` correspond au `userId` de la ligne, `addresseeId` au
 * `friendId`. Pour un statut `BLOCKED`, `requesterId` est l'auteur du blocage.
 */
export interface RelationView {
  /** Identifiant de la ligne Friendship. */
  id: number;
  /** Auteur de la demande, ou du blocage. */
  requesterId: number;
  /** Destinataire de la demande, ou compte bloqué. */
  addresseeId: number;
  /** Statut courant. */
  status: FriendshipStatus;
}

/** Profil public minimal renvoyé dans les listes. */
export interface FriendSummary {
  /** Identifiant du compte. */
  id: number;
  /** Nom d'utilisateur. */
  username: string;
  /** URL de l'avatar, `null` si non renseignée. */
  avatar: string | null;
}

/** Demande en attente, vue depuis l'un des deux côtés. */
export interface PendingRequest {
  /** Identifiant de la ligne Friendship, utilisé pour accepter ou refuser. */
  friendshipId: number;
  /** L'autre partie : demandeur pour une demande reçue, cible pour une envoyée. */
  user: FriendSummary;
  /** Date de création de la demande, au format ISO. */
  createdAt: string;
}

/** État de la relation entre le lecteur courant et un autre compte. */
export interface RelationStatus {
  /** Statut, ou `NONE` si aucune relation n'existe. */
  status: FriendshipStatus | 'NONE';
  /**
   * Position du lecteur dans la relation. `null` quand il n'y a pas de
   * relation, ou quand le statut ne distingue pas les deux rôles.
   */
  direction: 'sent' | 'received' | null;
}
