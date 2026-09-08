/**
 * Logique des réactions like / dislike.
 *
 * Les deux valeurs sont mutuellement exclusives : une même ligne en base porte
 * la réaction courante d'un utilisateur, et un second clic sur la même valeur
 * la supprime. Le module renvoie l'opération à exécuter, sans l'exécuter.
 */

/** Valeur d'une réaction. */
export type ReactionValue = 'like' | 'dislike';

/** Opération de persistance à appliquer. */
export interface ReactionOutcome {
  /** Nature de l'écriture à effectuer en base. */
  action: 'insert' | 'update' | 'delete';
  /** Valeur à persister, `null` pour une suppression. */
  value: ReactionValue | null;
}

/** Ligne de réaction telle que lue en base. */
export interface ReactionRow {
  /** Auteur de la réaction. */
  userId: number;
  /** Valeur de la réaction. */
  value: ReactionValue;
}

/** Compteurs agrégés destinés à l'affichage. */
export interface ReactionTally {
  /** Nombre total de likes. */
  likes: number;
  /** Nombre total de dislikes. */
  dislikes: number;
  /** Réaction du lecteur courant, `null` s'il n'a pas réagi. */
  viewerReaction: ReactionValue | null;
}

/**
 * Détermine l'écriture à effectuer suite à un clic sur like ou dislike.
 *
 * @param current Réaction existante de l'utilisateur, `null` s'il n'a pas réagi.
 * @param clicked Valeur sur laquelle l'utilisateur vient de cliquer.
 * @return L'opération de persistance correspondante.
 */
export function applyReaction(
  current: ReactionValue | null,
  clicked: ReactionValue,
): ReactionOutcome {
  if (current === null) {
    return {action: 'insert', value: clicked};
  }
  if (current === clicked) {
    return {action: 'delete', value: null};
  }
  return {action: 'update', value: clicked};
}

/**
 * Agrège une liste de réactions pour l'affichage.
 *
 * @param rows Réactions attachées à la publication ou au commentaire.
 * @param viewerId Identifiant du lecteur courant, `null` si anonyme.
 * @return Les compteurs et la réaction du lecteur.
 */
export function tally(
  rows: readonly ReactionRow[],
  viewerId: number | null,
): ReactionTally {
  let likes = 0;
  let dislikes = 0;
  let viewerReaction: ReactionValue | null = null;

  for (const row of rows) {
    if (row.value === 'like') {
      likes++;
    } else {
      dislikes++;
    }
    if (viewerId !== null && row.userId === viewerId) {
      viewerReaction = row.value;
    }
  }

  return {likes, dislikes, viewerReaction};
}
