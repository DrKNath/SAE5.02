/**
 * Accès aux comptes utilisateurs.
 */

import type {Database, Statement} from 'better-sqlite3';
import type {Role} from '../../domain/visibility.js';

/** Représentation publique d'un compte, sans donnée sensible. */
export interface PublicUser {
  /** Identifiant. */
  id: number;
  /** Nom d'utilisateur unique. */
  username: string;
  /** Adresse électronique. */
  email: string;
  /** Nom affiché, `null` si non renseigné. */
  displayName: string | null;
  /** Biographie, `null` si non renseignée. */
  bio: string | null;
  /** URL de l'avatar, `null` si non renseignée. */
  avatarUrl: string | null;
  /** Rôle applicatif. */
  role: Role;
  /** Horodatage de création. */
  createdAt: string;
}

/** Données nécessaires à la création d'un compte. */
export interface CreateUserInput {
  /** Nom d'utilisateur unique. */
  username: string;
  /** Adresse électronique unique. */
  email: string;
  /** Empreinte du mot de passe, jamais le mot de passe en clair. */
  passwordHash: string;
}

/** Couple identifiant / empreinte, réservé à l'authentification. */
export interface Credentials {
  /** Identifiant du compte. */
  id: number;
  /** Empreinte stockée. */
  passwordHash: string;
}

/** Ligne brute telle que renvoyée par SQLite. */
interface UserRow {
  id: number;
  username: string;
  email: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  role: Role;
  created_at: string;
}

/** Convertit une ligne SQL en objet public. */
function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    displayName: row.display_name,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    role: row.role,
    createdAt: row.created_at,
  };
}

const PUBLIC_COLUMNS =
  'id, username, email, display_name, bio, avatar_url, role, created_at';

/** Dépôt des comptes utilisateurs. */
export class UserRepository {
  private readonly insertStmt: Statement;
  private readonly byIdStmt: Statement;
  private readonly byUsernameStmt: Statement;
  private readonly credentialsStmt: Statement;
  private readonly deleteStmt: Statement;

  /**
   * @param db Connexion SQLite ouverte.
   */
  constructor(db: Database) {
    // Les requêtes sont préparées une fois puis réutilisées : c'est ce qui
    // rend better-sqlite3 rapide, et cela protège des injections SQL.
    this.insertStmt = db.prepare(
      `INSERT INTO users (username, email, password_hash)
       VALUES (@username, @email, @passwordHash)`,
    );
    this.byIdStmt = db.prepare(
      `SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = ?`,
    );
    this.byUsernameStmt = db.prepare(
      `SELECT ${PUBLIC_COLUMNS} FROM users WHERE username = ?`,
    );
    this.credentialsStmt = db.prepare(
      'SELECT id, password_hash FROM users WHERE email = ?',
    );
    this.deleteStmt = db.prepare('DELETE FROM users WHERE id = ?');
  }

  /**
   * Crée un compte.
   *
   * @param input Données du compte.
   * @return Le compte créé, sans son empreinte de mot de passe.
   * @throws Si le nom ou l'email est déjà utilisé (contrainte UNIQUE).
   */
  create(input: CreateUserInput): PublicUser {
    const info = this.insertStmt.run(input);
    const created = this.findById(Number(info.lastInsertRowid));
    if (created === null) {
      throw new Error('Échec de la création du compte.');
    }
    return created;
  }

  /**
   * Retrouve un compte par identifiant.
   *
   * @param id Identifiant recherché.
   * @return Le compte, ou `null` s'il n'existe pas.
   */
  findById(id: number): PublicUser | null {
    const row = this.byIdStmt.get(id) as UserRow | undefined;
    return row === undefined ? null : toPublicUser(row);
  }

  /**
   * Retrouve un compte par nom d'utilisateur.
   *
   * @param username Nom recherché.
   * @return Le compte, ou `null` s'il n'existe pas.
   */
  findByUsername(username: string): PublicUser | null {
    const row = this.byUsernameStmt.get(username) as UserRow | undefined;
    return row === undefined ? null : toPublicUser(row);
  }

  /**
   * Récupère l'empreinte de mot de passe associée à un email.
   *
   * Méthode isolée volontairement : elle est la seule à exposer une donnée
   * sensible, et n'est appelée que par le service d'authentification.
   *
   * @param email Adresse recherchée.
   * @return Les identifiants, ou `null` si le compte n'existe pas.
   */
  findCredentialsByEmail(email: string): Credentials | null {
    const row = this.credentialsStmt.get(email) as
      | {id: number; password_hash: string}
      | undefined;
    return row === undefined
      ? null
      : {id: row.id, passwordHash: row.password_hash};
  }

  /**
   * Supprime définitivement un compte et, en cascade, ses contenus.
   *
   * @param id Identifiant du compte.
   * @return `true` si une ligne a été supprimée.
   */
  deleteById(id: number): boolean {
    return this.deleteStmt.run(id).changes > 0;
  }
}
