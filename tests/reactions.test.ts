import {describe, it, expect} from 'vitest';
import {applyReaction, tally} from '../src/domain/reactions.js';
import type {ReactionRow} from '../src/domain/reactions.js';

describe('applyReaction', () => {
  it('ajoute un like quand aucune reaction n existe', () => {
    expect(applyReaction(null, 'like')).toEqual({action: 'insert', value: 'like'});
  });

  it('retire le like si on reclique sur like', () => {
    expect(applyReaction('like', 'like')).toEqual({action: 'delete', value: null});
  });

  it('bascule de like vers dislike', () => {
    expect(applyReaction('like', 'dislike')).toEqual({
      action: 'update',
      value: 'dislike',
    });
  });

  it('bascule de dislike vers like', () => {
    expect(applyReaction('dislike', 'like')).toEqual({
      action: 'update',
      value: 'like',
    });
  });

  it('retire le dislike si on reclique sur dislike', () => {
    expect(applyReaction('dislike', 'dislike')).toEqual({
      action: 'delete',
      value: null,
    });
  });
});

describe('tally', () => {
  const rows: ReactionRow[] = [
    {userId: 1, value: 'like'},
    {userId: 2, value: 'like'},
    {userId: 3, value: 'dislike'},
  ];

  it('compte separement les likes et les dislikes', () => {
    const result = tally(rows, null);
    expect(result.likes).toBe(2);
    expect(result.dislikes).toBe(1);
  });

  it('renvoie la reaction du lecteur courant', () => {
    expect(tally(rows, 1).viewerReaction).toBe('like');
    expect(tally(rows, 3).viewerReaction).toBe('dislike');
  });

  it('renvoie null si le lecteur n a pas reagi', () => {
    expect(tally(rows, 99).viewerReaction).toBeNull();
  });

  it('gere une liste vide', () => {
    expect(tally([], 1)).toEqual({likes: 0, dislikes: 0, viewerReaction: null});
  });
});
