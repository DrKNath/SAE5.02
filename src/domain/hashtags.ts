/**
 * Extraction et normalisation des hashtags.
 *
 * La normalisation retire les accents afin que `#Été` et `#ete` alimentent la
 * même tendance : sans cela, les tendances françaises se fragmentent.
 */

/** Nombre maximum de tags retenus pour une publication. */
const MAX_TAGS_PER_POST = 30;

/** Longueur maximale d'un tag après normalisation. */
const MAX_TAG_LENGTH = 50;

/**
 * Capture un croisillon précédé d'un début de chaîne ou d'un séparateur,
 * suivi d'au moins un caractère de mot (lettres accentuées incluses).
 */
const HASHTAG_PATTERN = /(?:^|[\s.,;:!?()[\]{}"'])#([\p{L}\p{N}_]+)/gu;

/**
 * Normalise un tag : minuscules, sans croisillon, sans accent, tronqué.
 *
 * @param raw Tag brut, avec ou sans croisillon de tête.
 * @return Le tag normalisé, utilisable comme clé d'unicité en base.
 */
export function normalizeTag(raw: string): string {
  return raw
    .replace(/^#/, '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .slice(0, MAX_TAG_LENGTH);
}

/**
 * Extrait les hashtags distincts d'un texte de publication.
 *
 * Les tags purement numériques sont écartés : ils correspondent presque
 * toujours à des dates ou des prix, et polluent les tendances.
 *
 * @param text Contenu textuel de la publication.
 * @return Les tags normalisés, dans l'ordre d'apparition, sans doublon.
 */
export function extractHashtags(text: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const match of text.matchAll(HASHTAG_PATTERN)) {
    const captured = match[1];
    if (captured === undefined) {
      continue;
    }

    const tag = normalizeTag(captured);
    if (tag.length === 0 || /^\d+$/.test(tag) || seen.has(tag)) {
      continue;
    }

    seen.add(tag);
    result.push(tag);

    if (result.length >= MAX_TAGS_PER_POST) {
      break;
    }
  }

  return result;
}
