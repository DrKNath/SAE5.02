/**
 * Persistance des relations d'amitié.
 *
 * Le dépôt délègue toute la logique de transition au module de domaine
 * `friendship.ts` : il ne fait que lire l'état, appliquer la fonction pure,
 * puis écrire le résultat. Les règles restent ainsi testables sans base.
 */

import type {Database, Statement} from 'better-sqlite3';
import {
  applyFriendshipAction,
  canonicalPair,
} from '../../domain/friendship.js';
import type {
  FriendshipAction,
  FriendshipState,
  FriendshipStatus,
} from '../../domain/friendship.js';

/** État par défaut d'une paire sans relation enregistrée. */
const NONE: FriendshipState = {status: 'none', requestedBy: null};

/** Ligne brute renvoyée par SQLite. */
interface FriendshipRow {
  status: Exclude<FriendshipStatus, 'none'>;
  requested_by: number;
}

/** Dépôt des relations d'amitié. */
export class FriendshipRepository {
  private readonly selectStmt: Statement;
  private readonly upsertStmt: Statement;
  private readonly deleteStmt: Statement;
  private readonly friendsStmt: Statement;
  private readonly blockedByStmt: Statement;

  /**
   * @param db Connexion SQLite ouverte.
   */
  constructor(db: Database) {
    this.selectStmt = db.prepare(
      `SELECT status, requested_by FROM friendships
       WHERE low_id = ? AND high_id = ?`,
    );
    this.upsertStmt = db.prepare(
      `INSERT INTO friendships (low_id, high_id, status, requested_by)
       VALUES (@lowId, @highId, @status, @requestedBy)
       ON CONFLICT (low_id, high_id) DO UPDATE SET
         status = excluded.status,
         requested_by = excluded.requested_by,
         updated_at = datetime('now')`,
    );
    this.deleteStmt = db.prepare(
      'DELETE FROM friendships WHERE low_id = ? AND high_id = ?',
    );
    this.friendsStmt = db.prepare(
      `SELECT CASE WHEN low_id = @id THEN high_id ELSE low_id END AS friend_id
       FROM friendships
       WHERE status = 'accepted' AND (low_id = @id OR high_id = @id)
       ORDER BY friend_id`,
    );
    this.blockedByStmt = db.prepare(
      `SELECT requested_by AS blocker_id FROM friendships
       WHERE status = 'blocked'
         AND requested_by != @id
         AND (low_id = @id OR high_id = @id)
       ORDER BY blocker_id`,
    );
  }

  /**
   * Lit l'état courant d'une relation.
   *
   * L'ordre des arguments est indifférent : la paire est canonisée.
   *
   * @param a Premier utilisateur.
   * @param b Second utilisateur.
   * @return L'état enregistré, ou l'état vierge si aucune ligne n'existe.
   */
  getState(a: number, b: number): FriendshipState {
    const {lowId, highId} = canonicalPair(a, b);
    const row = this.selectStmt.get(lowId, highId) as
      | FriendshipRow
      | undefined;
    return row === undefined
      ? {...NONE}
      : {status: row.status, requestedBy: row.requested_by};
  }

  /**
   * Applique une action et persiste le nouvel état.
   *
   * @param a Premier utilisateur.
   * @param b Second utilisateur.
   * @param action Action demandée.
   * @return Le nouvel état de la relation.
   * @throws {FriendshipError} Si la transition est interdite.
   */
  apply(a: number, b: number, action: FriendshipAction): FriendshipState {
    const {lowId, highId} = canonicalPair(a, b);
    const next = applyFriendshipAction(this.getState(a, b), action);

    if (next.status === 'none') {
      this.deleteStmt.run(lowId, highId);
    } else {
      this.upsertStmt.run({
        lowId,
        highId,
        status: next.status,
        requestedBy: next.requestedBy,
      });
    }
    return next;
  }

  /**
   * Liste les identifiants des amis confirmés d'un utilisateur.
   *
   * @param userId Utilisateur concerné.
   * @return Les identifiants, triés par ordre croissant.
   */
  listFriendIds(userId: number): number[] {
    const rows = this.friendsStmt.all({id: userId}) as Array<{
      friend_id: number;
    }>;
    return rows.map(row => row.friend_id);
  }

  /**
   * Liste les utilisateurs ayant bloqué le compte donné.
   *
   * Alimente directement `ViewerContext.blockedByIds` du module de visibilité.
   *
   * @param userId Utilisateur concerné.
   * @return Les identifiants des bloqueurs, triés par ordre croissant.
   */
  listBlockedByIds(userId: number): number[] {
    const rows = this.blockedByStmt.all({id: userId}) as Array<{
      blocker_id: number;
    }>;
    return rows.map(row => row.blocker_id);
  }
}
