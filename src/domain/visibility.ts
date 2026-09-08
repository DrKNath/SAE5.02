/**
 * Règles de visibilité des publications.
 *
 * Module volontairement pur : aucune dépendance à la base ou au réseau, afin
 * de rester testable unitairement et réutilisable côté API comme côté rendu.
 */

/** Portée de diffusion choisie par l'auteur d'une publication. */
export type Visibility = 'public' | 'friends';

/** Rôle applicatif d'un compte. */
export type Role = 'user' | 'moderator' | 'admin';

/** Projection minimale d'une publication nécessaire au calcul de visibilité. */
export interface PostVisibilityView {
  /** Identifiant de l'auteur. */
  authorId: number;
  /** Portée choisie par l'auteur. */
  visibility: Visibility;
  /** Horodatage ISO de suppression logique, `null` si active. */
  deletedAt: string | null;
}

/** Contexte du lecteur courant. `null` représente un visiteur anonyme. */
export interface ViewerContext {
  /** Identifiant du lecteur. */
  userId: number;
  /** Identifiants des utilisateurs avec qui l'amitié est acceptée. */
  friendIds: readonly number[];
  /** Identifiants des utilisateurs ayant bloqué le lecteur. */
  blockedByIds: readonly number[];
  /** Rôle applicatif du lecteur. */
  role: Role;
}

/**
 * Détermine si `viewer` a le droit de consulter `post`.
 *
 * Ordre d'évaluation, du plus prioritaire au moins prioritaire :
 * 1. le blocage masque tout, y compris le contenu public ;
 * 2. l'auteur et les modérateurs voient toujours le contenu ;
 * 3. une publication supprimée est masquée aux autres ;
 * 4. la portée `friends` exige un lien d'amitié accepté.
 *
 * @param post Publication à évaluer.
 * @param viewer Lecteur courant, ou `null` pour un visiteur anonyme.
 * @return `true` si la publication doit être affichée.
 */
export function canViewPost(
  post: PostVisibilityView,
  viewer: ViewerContext | null,
): boolean {
  if (viewer === null) {
    return post.visibility === 'public' && post.deletedAt === null;
  }

  // Le blocage prime sur toute autre règle, amitié comprise.
  if (viewer.blockedByIds.includes(post.authorId)) {
    return false;
  }

  const isAuthor = viewer.userId === post.authorId;
  const isStaff = viewer.role === 'admin' || viewer.role === 'moderator';
  if (isAuthor || isStaff) {
    return true;
  }

  if (post.deletedAt !== null) {
    return false;
  }

  if (post.visibility === 'public') {
    return true;
  }

  return viewer.friendIds.includes(post.authorId);
}
