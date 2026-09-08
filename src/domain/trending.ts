/**
 * Calcul des tendances sur une fenêtre glissante.
 *
 * Le score combine le nombre d'auteurs distincts et la fraîcheur des usages :
 * à volume égal, un tag utilisé dans la dernière heure remonte devant un tag
 * utilisé la veille. Compter les auteurs plutôt que les publications empêche
 * un compte unique de propulser son propre tag.
 */

/** Une occurrence de tag dans une publication. */
export interface TagUsage {
  /** Tag normalisé. */
  tag: string;
  /** Publication porteuse. */
  postId: number;
  /** Auteur de la publication. */
  authorId: number;
  /** Horodatage ISO de création. */
  createdAt: string;
}

/** Paramètres du calcul. */
export interface TrendingOptions {
  /** Instant de référence, injecté pour rendre le calcul testable. */
  now: Date;
  /** Largeur de la fenêtre en heures. Défaut : 24. */
  windowHours?: number;
  /** Nombre maximum de tendances retournées. Défaut : 10. */
  limit?: number;
}

/** Une tendance calculée. */
export interface Trend {
  /** Tag normalisé. */
  tag: string;
  /** Nombre d'auteurs distincts sur la fenêtre. */
  count: number;
  /** Alias explicite de `count`, conservé pour la lisibilité côté API. */
  uniqueAuthors: number;
  /** Score de classement, décroissant. */
  score: number;
}

const DEFAULT_WINDOW_HOURS = 24;
const DEFAULT_LIMIT = 10;
const MS_PER_HOUR = 3_600_000;

/**
 * Calcule le classement des tags les plus utilisés sur la fenêtre.
 *
 * @param usages Occurrences brutes, typiquement issues de `post_tags`.
 * @param options Paramètres de calcul.
 * @return Les tendances triées par score décroissant, puis alphabétiquement.
 */
export function computeTrending(
  usages: readonly TagUsage[],
  options: TrendingOptions,
): Trend[] {
  const windowHours = options.windowHours ?? DEFAULT_WINDOW_HOURS;
  const limit = options.limit ?? DEFAULT_LIMIT;
  const nowMs = options.now.getTime();
  const floorMs = nowMs - windowHours * MS_PER_HOUR;

  /** Auteurs distincts et somme de fraîcheur, par tag. */
  const buckets = new Map<string, {authors: Set<number>; freshness: number}>();

  for (const usage of usages) {
    const createdMs = new Date(usage.createdAt).getTime();
    if (Number.isNaN(createdMs) || createdMs < floorMs || createdMs > nowMs) {
      continue;
    }

    let bucket = buckets.get(usage.tag);
    if (bucket === undefined) {
      bucket = {authors: new Set<number>(), freshness: 0};
      buckets.set(usage.tag, bucket);
    }

    // Un auteur ne pèse qu'une fois par tag.
    if (bucket.authors.has(usage.authorId)) {
      continue;
    }
    bucket.authors.add(usage.authorId);

    // Décroissance linéaire : 1 à l'instant présent, 0 au bord de la fenêtre.
    const ageHours = (nowMs - createdMs) / MS_PER_HOUR;
    bucket.freshness += Math.max(0, 1 - ageHours / windowHours);
  }

  const trends: Trend[] = [];
  for (const [tag, bucket] of buckets) {
    const count = bucket.authors.size;
    trends.push({
      tag,
      count,
      uniqueAuthors: count,
      // La fraîcheur ne sert qu'à départager, jamais à inverser un écart
      // de volume : elle est bornée par construction à `count`.
      score: count + bucket.freshness / (count + 1),
    });
  }

  trends.sort((a, b) => b.score - a.score || a.tag.localeCompare(b.tag));
  return trends.slice(0, limit);
}
