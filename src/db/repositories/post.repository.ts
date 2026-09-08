/**
 * Accès aux publications et à leur indexation par hashtag.
 */

import type {Database, Statement} from 'better-sqlite3';
import {extractHashtags} from '../../domain/hashtags.js';
import type {Visibility} from '../../domain/visibility.js';

/** Publication telle que restituée par le dépôt. */
export interface Post {
  /** Identifiant. */
  id: number;
  /** Auteur. */
  authorId: number;
  /** Contenu textuel. */
  content: string;
  /** Portée de diffusion. */
  visibility: Visibility;
  /** Publication d'origine en cas de repartage, sinon `null`. */
  sharedFrom: number | null;
  /** Horodatage de création. */
  createdAt: string;
  /** Horodatage de suppression logique, `null` si active. */
  deletedAt: string | null;
}

/** Données nécessaires à la création d'une publication. */
export interface CreatePostInput {
  /** Auteur. */
  authorId: number;
  /** Contenu textuel, dont les hashtags seront extraits. */
  content: string;
  /** Portée de diffusion. */
  visibility: Visibility;
  /** Publication repartagée, le cas échéant. */
  sharedFrom?: number;
}

/** Ligne brute renvoyée par SQLite. */
interface PostRow {
  id: number;
  author_id: number;
  content: string;
  visibility: Visibility;
  shared_from: number | null;
  created_at: string;
  deleted_at: string | null;
}

/** Convertit une ligne SQL en objet métier. */
function toPost(row: PostRow): Post {
  return {
    id: row.id,
    authorId: row.author_id,
    content: row.content,
    visibility: row.visibility,
    sharedFrom: row.shared_from,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  };
}

/** Dépôt des publications. */
export class PostRepository {
  private readonly insertStmt: Statement;
  private readonly byIdStmt: Statement;
  private readonly softDeleteStmt: Statement;
  private readonly upsertTagStmt: Statement;
  private readonly tagIdStmt: Statement;
  private readonly linkTagStmt: Statement;
  private readonly tagsOfPostStmt: Statement;

  /**
   * @param db Connexion SQLite ouverte.
   */
  constructor(private readonly db: Database) {
    this.insertStmt = db.prepare(
      `INSERT INTO posts (author_id, content, visibility, shared_from)
       VALUES (@authorId, @content, @visibility, @sharedFrom)`,
    );
    this.byIdStmt = db.prepare('SELECT * FROM posts WHERE id = ?');
    this.softDeleteStmt = db.prepare(
      `UPDATE posts SET deleted_at = datetime('now')
       WHERE id = ? AND deleted_at IS NULL`,
    );
    this.upsertTagStmt = db.prepare(
      'INSERT OR IGNORE INTO tags (label) VALUES (?)',
    );
    this.tagIdStmt = db.prepare('SELECT id FROM tags WHERE label = ?');
    this.linkTagStmt = db.prepare(
      'INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)',
    );
    this.tagsOfPostStmt = db.prepare(
      `SELECT t.label FROM tags t
       JOIN post_tags pt ON pt.tag_id = t.id
       WHERE pt.post_id = ?
       ORDER BY pt.rowid`,
    );
  }

  /**
   * Crée une publication et indexe ses hashtags.
   *
   * L'insertion de la publication et celle de ses tags sont regroupées dans
   * une transaction : une publication ne doit jamais exister à moitié indexée.
   *
   * @param input Données de la publication.
   * @return La publication créée.
   * @throws Si l'auteur n'existe pas (contrainte de clé étrangère).
   */
  create(input: CreatePostInput): Post {
    const run = this.db.transaction((data: CreatePostInput): number => {
      const info = this.insertStmt.run({
        authorId: data.authorId,
        content: data.content,
        visibility: data.visibility,
        sharedFrom: data.sharedFrom ?? null,
      });
      const postId = Number(info.lastInsertRowid);

      for (const label of extractHashtags(data.content)) {
        this.upsertTagStmt.run(label);
        const tag = this.tagIdStmt.get(label) as {id: number};
        this.linkTagStmt.run(postId, tag.id);
      }
      return postId;
    });

    const created = this.findById(run(input));
    if (created === null) {
      throw new Error('Échec de la création de la publication.');
    }
    return created;
  }

  /**
   * Retrouve une publication par identifiant.
   *
   * @param id Identifiant recherché.
   * @return La publication, ou `null` si elle n'existe pas.
   */
  findById(id: number): Post | null {
    const row = this.byIdStmt.get(id) as PostRow | undefined;
    return row === undefined ? null : toPost(row);
  }

  /**
   * Liste les hashtags associés à une publication.
   *
   * @param postId Identifiant de la publication.
   * @return Les tags normalisés, dans leur ordre d'insertion.
   */
  findTags(postId: number): string[] {
    const rows = this.tagsOfPostStmt.all(postId) as Array<{label: string}>;
    return rows.map(row => row.label);
  }

  /**
   * Marque une publication comme supprimée sans effacer la ligne.
   *
   * La suppression est logique afin de conserver la trace nécessaire au
   * traitement des signalements.
   *
   * @param id Identifiant de la publication.
   * @return `true` si la publication a été marquée.
   */
  softDelete(id: number): boolean {
    return this.softDeleteStmt.run(id).changes > 0;
  }
}
