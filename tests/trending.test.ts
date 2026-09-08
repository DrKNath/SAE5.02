import {describe, it, expect} from 'vitest';
import {computeTrending} from '../src/domain/trending.js';
import type {TagUsage} from '../src/domain/trending.js';

const NOW = new Date('2026-01-10T12:00:00.000Z');

/** Renvoie un horodatage ISO situe `hours` heures avant NOW. */
function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * 3_600_000).toISOString();
}

describe('computeTrending', () => {
  it('renvoie une liste vide sans usage', () => {
    expect(computeTrending([], {now: NOW})).toEqual([]);
  });

  it('classe les tags par nombre d usages decroissant', () => {
    const usages: TagUsage[] = [
      {tag: 'alsace', postId: 1, authorId: 1, createdAt: hoursAgo(1)},
      {tag: 'alsace', postId: 2, authorId: 2, createdAt: hoursAgo(2)},
      {tag: 'colmar', postId: 3, authorId: 3, createdAt: hoursAgo(1)},
    ];
    const result = computeTrending(usages, {now: NOW});
    expect(result.map(r => r.tag)).toEqual(['alsace', 'colmar']);
    expect(result[0]?.count).toBe(2);
  });

  it('exclut les usages hors de la fenetre glissante', () => {
    const usages: TagUsage[] = [
      {tag: 'vieux', postId: 1, authorId: 1, createdAt: hoursAgo(48)},
      {tag: 'recent', postId: 2, authorId: 2, createdAt: hoursAgo(3)},
    ];
    const result = computeTrending(usages, {now: NOW, windowHours: 24});
    expect(result.map(r => r.tag)).toEqual(['recent']);
  });

  it('compte un auteur une seule fois par tag pour limiter le spam', () => {
    const usages: TagUsage[] = [
      {tag: 'spam', postId: 1, authorId: 1, createdAt: hoursAgo(1)},
      {tag: 'spam', postId: 2, authorId: 1, createdAt: hoursAgo(1)},
      {tag: 'spam', postId: 3, authorId: 1, createdAt: hoursAgo(1)},
    ];
    const result = computeTrending(usages, {now: NOW});
    expect(result[0]?.count).toBe(1);
    expect(result[0]?.uniqueAuthors).toBe(1);
  });

  it('favorise un tag recent a nombre d usages egal', () => {
    const usages: TagUsage[] = [
      {tag: 'ancien', postId: 1, authorId: 1, createdAt: hoursAgo(20)},
      {tag: 'ancien', postId: 2, authorId: 2, createdAt: hoursAgo(20)},
      {tag: 'frais', postId: 3, authorId: 3, createdAt: hoursAgo(1)},
      {tag: 'frais', postId: 4, authorId: 4, createdAt: hoursAgo(1)},
    ];
    const result = computeTrending(usages, {now: NOW});
    expect(result[0]?.tag).toBe('frais');
  });

  it('respecte la limite de resultats demandee', () => {
    const usages: TagUsage[] = Array.from({length: 20}, (_, i) => ({
      tag: `tag${i}`,
      postId: i,
      authorId: i,
      createdAt: hoursAgo(1),
    }));
    expect(computeTrending(usages, {now: NOW, limit: 5})).toHaveLength(5);
  });

  it('ignore les usages postérieurs a maintenant', () => {
    const usages: TagUsage[] = [
      {tag: 'futur', postId: 1, authorId: 1, createdAt: hoursAgo(-5)},
    ];
    expect(computeTrending(usages, {now: NOW})).toEqual([]);
  });

  it('departage deux tags equivalents par ordre alphabetique', () => {
    const usages: TagUsage[] = [
      {tag: 'beta', postId: 1, authorId: 1, createdAt: hoursAgo(2)},
      {tag: 'alpha', postId: 2, authorId: 2, createdAt: hoursAgo(2)},
    ];
    expect(computeTrending(usages, {now: NOW}).map(r => r.tag)).toEqual([
      'alpha',
      'beta',
    ]);
  });
});
