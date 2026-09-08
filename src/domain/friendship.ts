/**
 * Machine à états du système d'amitié.
 *
 * Une relation est stockée en base sur une seule ligne, identifiée par la paire
 * canonique (lowId, highId). Cela évite les doublons symétriques et permet un
 * index unique sur le couple.
 */

/** Erreur levée sur une transition d'amitié interdite. */
export class FriendshipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FriendshipError';
  }
}

/** Statut courant d'une relation entre deux comptes. */
export type FriendshipStatus = 'none' | 'pending' | 'accepted' | 'blocked';

/** État persisté d'une relation. */
export interface FriendshipState {
  /** Statut courant. */
  status: FriendshipStatus;
  /**
   * Auteur de la dernière action structurante : demandeur si `pending`,
   * bloqueur si `blocked`, `null` si `none`.
   */
  requestedBy: number | null;
}

/** Action émise par un utilisateur sur une relation. */
export interface FriendshipAction {
  /** Nature de l'action. */
  type: 'request' | 'accept' | 'reject' | 'remove' | 'block' | 'unblock';
  /** Identifiant de l'utilisateur à l'origine de l'action. */
  actorId: number;
}

/** Paire d'identifiants ordonnée de façon déterministe. */
export interface CanonicalPair {
  /** Le plus petit des deux identifiants. */
  lowId: number;
  /** Le plus grand des deux identifiants. */
  highId: number;
}

const NONE: FriendshipState = {status: 'none', requestedBy: null};

/**
 * Ordonne deux identifiants pour former la clé unique d'une relation.
 *
 * @param a Premier identifiant.
 * @param b Second identifiant.
 * @return La paire ordonnée croissante.
 * @throws {FriendshipError} Si les deux identifiants sont identiques.
 */
export function canonicalPair(a: number, b: number): CanonicalPair {
  if (a === b) {
    throw new FriendshipError('Un utilisateur ne peut pas se lier à lui-même.');
  }
  return a < b ? {lowId: a, highId: b} : {lowId: b, highId: a};
}

/**
 * Applique une action et retourne le nouvel état de la relation.
 *
 * La fonction est pure : elle ne modifie pas `current` et n'écrit rien en base.
 * L'appelant est responsable de la persistance du résultat.
 *
 * @param current État actuel de la relation.
 * @param action Action demandée.
 * @return Le nouvel état.
 * @throws {FriendshipError} Si la transition est interdite.
 */
export function applyFriendshipAction(
  current: FriendshipState,
  action: FriendshipAction,
): FriendshipState {
  const {actorId} = action;

  switch (action.type) {
    case 'request':
      if (current.status === 'blocked') {
        throw new FriendshipError('Relation bloquée.');
      }
      if (current.status === 'accepted') {
        throw new FriendshipError('Les utilisateurs sont déjà amis.');
      }
      if (current.status === 'pending') {
        // Demande croisée : les deux parties se sont sollicitées, on accepte.
        if (current.requestedBy !== actorId) {
          return {status: 'accepted', requestedBy: current.requestedBy};
        }
        throw new FriendshipError('Une demande est déjà en attente.');
      }
      return {status: 'pending', requestedBy: actorId};

    case 'accept':
      if (current.status !== 'pending') {
        throw new FriendshipError('Aucune demande en attente.');
      }
      if (current.requestedBy === actorId) {
        throw new FriendshipError('Impossible d’accepter sa propre demande.');
      }
      return {status: 'accepted', requestedBy: current.requestedBy};

    case 'reject':
    case 'remove':
      if (current.status === 'none' || current.status === 'blocked') {
        throw new FriendshipError('Aucune relation à supprimer.');
      }
      return {...NONE};

    case 'block':
      if (current.status === 'blocked') {
        throw new FriendshipError('Relation déjà bloquée.');
      }
      return {status: 'blocked', requestedBy: actorId};

    case 'unblock':
      if (current.status !== 'blocked') {
        throw new FriendshipError('Relation non bloquée.');
      }
      if (current.requestedBy !== actorId) {
        throw new FriendshipError('Seul l’auteur du blocage peut le lever.');
      }
      return {...NONE};

    default: {
      // Garde d'exhaustivité : échoue à la compilation si un cas est oublié.
      const exhaustive: never = action.type;
      throw new FriendshipError(`Action inconnue : ${String(exhaustive)}`);
    }
  }
}
