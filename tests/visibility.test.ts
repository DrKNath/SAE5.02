import {describe, it, expect} from 'vitest';
import {canViewPost} from '../src/domain/visibility.js';
import type {PostVisibilityView, ViewerContext} from '../src/domain/visibility.js';

/** Construit une publication de test avec des valeurs par défaut surchargeables. */
function makePost(over: Partial<PostVisibilityView> = {}): PostVisibilityView {
  return {authorId: 1, visibility: 'public', deletedAt: null, ...over};
}

/** Construit un contexte de lecteur avec des valeurs par défaut surchargeables. */
function makeViewer(over: Partial<ViewerContext> = {}): ViewerContext {
  return {userId: 2, friendIds: [], blockedByIds: [], role: 'user', ...over};
}

describe('canViewPost', () => {
  describe('publication publique', () => {
    it('est visible par un visiteur anonyme', () => {
      expect(canViewPost(makePost(), null)).toBe(true);
    });

    it('est visible par un utilisateur non ami', () => {
      expect(canViewPost(makePost(), makeViewer())).toBe(true);
    });
  });

  describe('publication réservée aux amis', () => {
    const post = makePost({visibility: 'friends'});

    it('est masquée à un visiteur anonyme', () => {
      expect(canViewPost(post, null)).toBe(false);
    });

    it('est masquée à un utilisateur non ami', () => {
      expect(canViewPost(post, makeViewer({userId: 3, friendIds: []}))).toBe(
        false,
      );
    });

    it('est visible par un ami de l auteur', () => {
      expect(canViewPost(post, makeViewer({userId: 2, friendIds: [1]}))).toBe(
        true,
      );
    });

    it('est toujours visible par son auteur', () => {
      expect(canViewPost(post, makeViewer({userId: 1, friendIds: []}))).toBe(
        true,
      );
    });
  });

  describe('blocage', () => {
    it('masque une publication publique si l auteur a bloqué le lecteur', () => {
      const viewer = makeViewer({userId: 3, blockedByIds: [1]});
      expect(canViewPost(makePost({authorId: 1}), viewer)).toBe(false);
    });

    it('le blocage prime sur le lien d amitié', () => {
      const viewer = makeViewer({userId: 3, friendIds: [1], blockedByIds: [1]});
      expect(canViewPost(makePost({visibility: 'friends'}), viewer)).toBe(false);
    });
  });

  describe('suppression et modération', () => {
    const removed = makePost({deletedAt: '2026-01-01T00:00:00.000Z'});

    it('masque une publication supprimée même publique', () => {
      expect(canViewPost(removed, makeViewer())).toBe(false);
    });

    it('reste visible pour un administrateur', () => {
      expect(canViewPost(removed, makeViewer({role: 'admin'}))).toBe(true);
    });

    it('un administrateur voit aussi les publications réservées aux amis', () => {
      const post = makePost({visibility: 'friends', authorId: 9});
      expect(canViewPost(post, makeViewer({userId: 5, role: 'admin'}))).toBe(
        true,
      );
    });

    it('un auteur voit sa propre publication supprimée', () => {
      expect(canViewPost(removed, makeViewer({userId: 1}))).toBe(true);
    });
  });
});
