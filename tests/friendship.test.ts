import {describe, it, expect} from 'vitest';
import {
  applyFriendshipAction,
  canonicalPair,
  FriendshipError,
} from '../src/domain/friendship.js';
import type {FriendshipState} from '../src/domain/friendship.js';

describe('canonicalPair', () => {
  it('ordonne toujours la paire du plus petit au plus grand identifiant', () => {
    expect(canonicalPair(7, 3)).toEqual({lowId: 3, highId: 7});
    expect(canonicalPair(3, 7)).toEqual({lowId: 3, highId: 7});
  });

  it('refuse une relation d un utilisateur avec lui-meme', () => {
    expect(() => canonicalPair(4, 4)).toThrow(FriendshipError);
  });
});

describe('applyFriendshipAction', () => {
  const none: FriendshipState = {status: 'none', requestedBy: null};

  describe('demande d amitie', () => {
    it('cree une demande en attente depuis un etat vierge', () => {
      const next = applyFriendshipAction(none, {type: 'request', actorId: 1});
      expect(next).toEqual({status: 'pending', requestedBy: 1});
    });

    it('refuse une seconde demande alors qu une est deja en attente', () => {
      const pending: FriendshipState = {status: 'pending', requestedBy: 1};
      expect(() =>
        applyFriendshipAction(pending, {type: 'request', actorId: 1}),
      ).toThrow(FriendshipError);
    });

    it('accepte directement si la cible avait deja demande (demande croisee)', () => {
      const pending: FriendshipState = {status: 'pending', requestedBy: 2};
      const next = applyFriendshipAction(pending, {type: 'request', actorId: 1});
      expect(next).toEqual({status: 'accepted', requestedBy: 2});
    });

    it('refuse une demande vers un utilisateur qui a bloque', () => {
      const blocked: FriendshipState = {status: 'blocked', requestedBy: 2};
      expect(() =>
        applyFriendshipAction(blocked, {type: 'request', actorId: 1}),
      ).toThrow(FriendshipError);
    });
  });

  describe('acceptation', () => {
    it('accepte une demande recue', () => {
      const pending: FriendshipState = {status: 'pending', requestedBy: 1};
      const next = applyFriendshipAction(pending, {type: 'accept', actorId: 2});
      expect(next.status).toBe('accepted');
    });

    it('interdit d accepter sa propre demande', () => {
      const pending: FriendshipState = {status: 'pending', requestedBy: 1};
      expect(() =>
        applyFriendshipAction(pending, {type: 'accept', actorId: 1}),
      ).toThrow(FriendshipError);
    });

    it('interdit d accepter une relation inexistante', () => {
      expect(() =>
        applyFriendshipAction(none, {type: 'accept', actorId: 2}),
      ).toThrow(FriendshipError);
    });
  });

  describe('refus et suppression', () => {
    it('un refus ramene a l etat vierge', () => {
      const pending: FriendshipState = {status: 'pending', requestedBy: 1};
      const next = applyFriendshipAction(pending, {type: 'reject', actorId: 2});
      expect(next).toEqual(none);
    });

    it('retirer un ami ramene a l etat vierge', () => {
      const accepted: FriendshipState = {status: 'accepted', requestedBy: 1};
      const next = applyFriendshipAction(accepted, {type: 'remove', actorId: 2});
      expect(next).toEqual(none);
    });
  });

  describe('blocage', () => {
    it('peut bloquer depuis un etat vierge', () => {
      const next = applyFriendshipAction(none, {type: 'block', actorId: 1});
      expect(next).toEqual({status: 'blocked', requestedBy: 1});
    });

    it('peut bloquer un ami existant', () => {
      const accepted: FriendshipState = {status: 'accepted', requestedBy: 2};
      const next = applyFriendshipAction(accepted, {type: 'block', actorId: 1});
      expect(next).toEqual({status: 'blocked', requestedBy: 1});
    });

    it('seul l auteur du blocage peut le lever', () => {
      const blocked: FriendshipState = {status: 'blocked', requestedBy: 1};
      expect(applyFriendshipAction(blocked, {type: 'unblock', actorId: 1})).toEqual(
        none,
      );
      expect(() =>
        applyFriendshipAction(blocked, {type: 'unblock', actorId: 2}),
      ).toThrow(FriendshipError);
    });
  });
});
