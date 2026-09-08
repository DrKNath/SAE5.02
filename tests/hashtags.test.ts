import {describe, it, expect} from 'vitest';
import {extractHashtags, normalizeTag} from '../src/domain/hashtags.js';

describe('normalizeTag', () => {
  it('passe en minuscules', () => {
    expect(normalizeTag('#PhotoDuJour')).toBe('photodujour');
  });

  it('retire le croisillon de tete', () => {
    expect(normalizeTag('#alsace')).toBe('alsace');
    expect(normalizeTag('alsace')).toBe('alsace');
  });

  it('retire les accents pour eviter les doublons', () => {
    expect(normalizeTag('#Été')).toBe('ete');
    expect(normalizeTag('#créativité')).toBe('creativite');
  });
});

describe('extractHashtags', () => {
  it('extrait un hashtag simple', () => {
    expect(extractHashtags('Belle journee #soleil')).toEqual(['soleil']);
  });

  it('extrait plusieurs hashtags', () => {
    expect(extractHashtags('#colmar et #alsace')).toEqual(['colmar', 'alsace']);
  });

  it('deduplique en ignorant la casse', () => {
    expect(extractHashtags('#Soleil #soleil #SOLEIL')).toEqual(['soleil']);
  });

  it('accepte les chiffres et le tiret bas', () => {
    expect(extractHashtags('#projet_2026')).toEqual(['projet_2026']);
  });

  it('ignore un croisillon isole', () => {
    expect(extractHashtags('un # tout seul')).toEqual([]);
  });

  it('ignore un hashtag purement numerique', () => {
    expect(extractHashtags('#2026 #vraitag')).toEqual(['vraitag']);
  });

  it('ne capture pas un croisillon colle a un mot', () => {
    expect(extractHashtags('C#est pas un tag')).toEqual([]);
  });

  it('gere les accents dans le texte source', () => {
    expect(extractHashtags('#Événement #café')).toEqual(['evenement', 'cafe']);
  });

  it('renvoie un tableau vide sur un texte sans tag', () => {
    expect(extractHashtags('aucun tag ici')).toEqual([]);
  });

  it('limite le nombre de tags retenus par publication', () => {
    const text = Array.from({length: 40}, (_, i) => `#tag${i}`).join(' ');
    expect(extractHashtags(text)).toHaveLength(30);
  });

  it('tronque un tag anormalement long', () => {
    const long = `#${'a'.repeat(120)}`;
    expect(extractHashtags(long)[0]).toHaveLength(50);
  });
});
