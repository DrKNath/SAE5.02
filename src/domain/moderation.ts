/**
 * Droits de modération et workflow de traitement des signalements.
 */

import type {Role} from './visibility.js';

/** Erreur levée sur une action de modération interdite. */
export class ModerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModerationError';
  }
}

/** Acteur d'une action de modération. */
export interface Actor {
  /** Identifiant du compte. */
  id: number;
  /** Rôle applicatif. */
  role: Role;
}

/** Cible minimale nécessaire au contrôle de suppression. */
export interface OwnedResource {
  /** Auteur de la ressource. */
  authorId: number;
}

/** Statut d'un signalement. */
export type ReportStatus = 'open' | 'upheld' | 'dismissed';

/** État persisté d'un signalement. */
export interface ReportState {
  /** Statut courant. */
  status: ReportStatus;
  /** Modérateur ayant tranché, `null` tant que le signalement est ouvert. */
  handledBy: number | null;
}

/** Décision rendue sur un signalement. */
export interface ReportDecision {
  /** Issue retenue. */
  decision: 'upheld' | 'dismissed';
  /** Modérateur à l'origine de la décision. */
  moderator: Actor;
}

/**
 * Indique si un rôle donne accès aux outils de modération.
 *
 * @param role Rôle à tester.
 * @return `true` pour un modérateur ou un administrateur.
 */
export function canModerate(role: Role): boolean {
  return role === 'moderator' || role === 'admin';
}

/**
 * Indique si un acteur peut supprimer une ressource.
 *
 * @param actor Utilisateur demandant la suppression.
 * @param resource Ressource ciblée.
 * @return `true` si l'acteur est l'auteur ou dispose des droits de modération.
 */
export function canDeletePost(actor: Actor, resource: OwnedResource): boolean {
  return actor.id === resource.authorId || canModerate(actor.role);
}

/**
 * Clôt un signalement ouvert.
 *
 * @param current État courant du signalement.
 * @param decision Décision rendue.
 * @return Le nouvel état du signalement.
 * @throws {ModerationError} Si l'acteur n'est pas habilité ou si le
 *     signalement est déjà clos.
 */
export function resolveReport(
  current: ReportState,
  decision: ReportDecision,
): ReportState {
  if (!canModerate(decision.moderator.role)) {
    throw new ModerationError('Droits de modération requis.');
  }
  if (current.status !== 'open') {
    throw new ModerationError('Signalement déjà traité.');
  }
  return {status: decision.decision, handledBy: decision.moderator.id};
}
