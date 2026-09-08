import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import type {Database} from 'better-sqlite3';
import {createDatabase} from '../src/db/connection.js';
import {UserRepository} from '../src/db/repositories/user.repository.js';
import {PostRepository} from '../src/db/repositories/post.repository.js';
import {FriendshipRepository} from '../src/db/repositories/friendship.repository.js';

let db: Database;
let users: UserRepository;
let posts: PostRepository;
let friendships: FriendshipRepository;

// Chaque test repart d'une base en mémoire vierge : isolation totale,
// aucun fichier à nettoyer, exécution en quelques millisecondes.
beforeEach(() => {
  db = createDatabase(':memory:');
  users = new UserRepository(db);
  posts = new PostRepository(db);
  friendships = new FriendshipRepository(db);
});

afterEach(() => {
  db.close();
});

describe('UserRepository', () => {
  it('crée un utilisateur et lui attribue un identifiant', () => {
    const user = users.create({
      username: 'zol',
      email: 'zol@example.test',
      passwordHash: 'hash',
    });
    expect(user.id).toBeGreaterThan(0);
    expect(user.username).toBe('zol');
    expect(user.role).toBe('user');
  });

  it('ne renvoie jamais le hash du mot de passe dans l objet public', () => {
    const user = users.create({
      username: 'zol',
      email: 'zol@example.test',
      passwordHash: 'hash',
    });
    expect(user).not.toHaveProperty('passwordHash');
  });

  it('retrouve un utilisateur par son nom', () => {
    users.create({username: 'zol', email: 'a@b.test', passwordHash: 'h'});
    expect(users.findByUsername('zol')?.username).toBe('zol');
  });

  it('renvoie null pour un utilisateur inconnu', () => {
    expect(users.findByUsername('fantome')).toBeNull();
  });

  it('refuse deux utilisateurs avec le même nom', () => {
    users.create({username: 'zol', email: 'a@b.test', passwordHash: 'h'});
    expect(() =>
      users.create({username: 'zol', email: 'c@d.test', passwordHash: 'h'}),
    ).toThrow();
  });

  it('refuse deux utilisateurs avec le même email', () => {
    users.create({username: 'a', email: 'dup@b.test', passwordHash: 'h'});
    expect(() =>
      users.create({username: 'b', email: 'dup@b.test', passwordHash: 'h'}),
    ).toThrow();
  });

  it('expose le hash uniquement via la méthode dédiée à l authentification', () => {
    users.create({username: 'zol', email: 'a@b.test', passwordHash: 'secret'});
    expect(users.findCredentialsByEmail('a@b.test')?.passwordHash).toBe('secret');
  });
});

describe('PostRepository', () => {
  it('crée une publication et enregistre ses hashtags', () => {
    const author = users.create({
      username: 'zol',
      email: 'a@b.test',
      passwordHash: 'h',
    });
    const post = posts.create({
      authorId: author.id,
      content: 'Vue sur #colmar en #Alsace',
      visibility: 'public',
    });

    expect(post.id).toBeGreaterThan(0);
    expect(posts.findTags(post.id)).toEqual(['colmar', 'alsace']);
  });

  it('supprime en logique sans effacer la ligne', () => {
    const author = users.create({
      username: 'zol',
      email: 'a@b.test',
      passwordHash: 'h',
    });
    const post = posts.create({
      authorId: author.id,
      content: 'test',
      visibility: 'public',
    });

    posts.softDelete(post.id);
    expect(posts.findById(post.id)?.deletedAt).not.toBeNull();
  });

  it('supprime les publications en cascade avec leur auteur', () => {
    const author = users.create({
      username: 'zol',
      email: 'a@b.test',
      passwordHash: 'h',
    });
    const post = posts.create({
      authorId: author.id,
      content: 'test',
      visibility: 'public',
    });

    users.deleteById(author.id);
    expect(posts.findById(post.id)).toBeNull();
  });

  it('refuse une publication rattachée à un auteur inexistant', () => {
    expect(() =>
      posts.create({authorId: 999, content: 'x', visibility: 'public'}),
    ).toThrow();
  });
});

describe('FriendshipRepository', () => {
  let alice: number;
  let bob: number;

  beforeEach(() => {
    alice = users.create({username: 'alice', email: 'a@t.test', passwordHash: 'h'})
      .id;
    bob = users.create({username: 'bob', email: 'b@t.test', passwordHash: 'h'}).id;
  });

  it('renvoie un état vierge pour deux inconnus', () => {
    expect(friendships.getState(alice, bob)).toEqual({
      status: 'none',
      requestedBy: null,
    });
  });

  it('persiste une demande puis son acceptation', () => {
    friendships.apply(alice, bob, {type: 'request', actorId: alice});
    expect(friendships.getState(alice, bob).status).toBe('pending');

    friendships.apply(alice, bob, {type: 'accept', actorId: bob});
    expect(friendships.getState(alice, bob).status).toBe('accepted');
  });

  it('donne le même état quel que soit l ordre des arguments', () => {
    friendships.apply(alice, bob, {type: 'request', actorId: alice});
    expect(friendships.getState(bob, alice)).toEqual(
      friendships.getState(alice, bob),
    );
  });

  it('liste les amis acceptés uniquement', () => {
    const carol = users.create({
      username: 'carol',
      email: 'c@t.test',
      passwordHash: 'h',
    }).id;

    friendships.apply(alice, bob, {type: 'request', actorId: alice});
    friendships.apply(alice, bob, {type: 'accept', actorId: bob});
    friendships.apply(alice, carol, {type: 'request', actorId: alice});

    expect(friendships.listFriendIds(alice)).toEqual([bob]);
  });

  it('liste les utilisateurs ayant bloqué un compte donné', () => {
    friendships.apply(alice, bob, {type: 'block', actorId: bob});
    expect(friendships.listBlockedByIds(alice)).toEqual([bob]);
    expect(friendships.listBlockedByIds(bob)).toEqual([]);
  });
});
