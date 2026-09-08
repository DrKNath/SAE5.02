/**
 * Ouverture et initialisation de la base SQLite.
 */

import BetterSqlite3 from 'better-sqlite3';
import type {Database} from 'better-sqlite3';
import {SCHEMA_SQL} from './schema.js';

/**
 * Ouvre une base et applique le schéma si nécessaire.
 *
 * Passer `':memory:'` crée une base éphémère : c'est ce qu'utilisent les tests
 * d'intégration, ce qui permet de repartir d'un état vierge à chaque cas sans
 * fichier temporaire à nettoyer.
 *
 * @param filename Chemin du fichier, ou `':memory:'`.
 * @return La connexion prête à l'emploi.
 */
export function createDatabase(filename: string): Database {
  const db = new BetterSqlite3(filename);

  // Sans ce PRAGMA, SQLite ignore silencieusement les clés étrangères.
  db.pragma('foreign_keys = ON');
  // WAL : lectures concurrentes pendant les écritures. Inutile en mémoire.
  if (filename !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }

  db.exec(SCHEMA_SQL);
  return db;
}
