/**
 * Schéma relationnel de l'application.
 *
 * Choix structurants :
 * - suppression logique (`deleted_at`) sur les publications, pour conserver
 *   l'historique nécessaire à la modération ;
 * - relation d'amitié stockée sur une ligne unique via la paire canonique
 *   (low_id, high_id), ce qui évite les doublons symétriques ;
 * - réactions polymorphes (`target_type`, `target_id`) : un seul mécanisme
 *   couvre publications et commentaires.
 */

export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  display_name  TEXT,
  bio           TEXT,
  avatar_url    TEXT,
  role          TEXT    NOT NULL DEFAULT 'user'
                        CHECK (role IN ('user', 'moderator', 'admin')),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS posts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  author_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT    NOT NULL,
  visibility  TEXT    NOT NULL DEFAULT 'public'
                      CHECK (visibility IN ('public', 'friends')),
  shared_from INTEGER REFERENCES posts(id) ON DELETE SET NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  deleted_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_posts_author  ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);

CREATE TABLE IF NOT EXISTS media (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id  INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  kind     TEXT    NOT NULL CHECK (kind IN ('image', 'video')),
  url      TEXT    NOT NULL,
  filters  TEXT,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tags (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT    NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS post_tags (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag_id  INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    INTEGER NOT NULL REFERENCES posts(id)    ON DELETE CASCADE,
  author_id  INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  parent_id  INTEGER REFERENCES comments(id)          ON DELETE CASCADE,
  content    TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS reactions (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT    NOT NULL CHECK (target_type IN ('post', 'comment')),
  target_id   INTEGER NOT NULL,
  value       TEXT    NOT NULL CHECK (value IN ('like', 'dislike')),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, target_type, target_id)
);

CREATE TABLE IF NOT EXISTS friendships (
  low_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  high_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       TEXT    NOT NULL
                       CHECK (status IN ('pending', 'accepted', 'blocked')),
  requested_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (low_id, high_id),
  CHECK (low_id < high_id)
);

CREATE TABLE IF NOT EXISTS conversations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT,
  is_group   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id INTEGER NOT NULL
                          REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  last_read_at    TEXT,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL
                          REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body            TEXT    NOT NULL,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON messages(conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT    NOT NULL,
  actor_id   INTEGER REFERENCES users(id) ON DELETE CASCADE,
  target_id  INTEGER,
  payload    TEXT,
  read_at    TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON notifications(user_id, read_at, created_at DESC);

CREATE TABLE IF NOT EXISTS reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT    NOT NULL
                      CHECK (target_type IN ('post', 'comment', 'user')),
  target_id   INTEGER NOT NULL,
  reason      TEXT    NOT NULL,
  status      TEXT    NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open', 'upheld', 'dismissed')),
  handled_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
`;
