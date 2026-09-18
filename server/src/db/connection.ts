import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import path from 'path';

// Chargement des variables d'environnement depuis le fichier .env à la racine
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const connectionString = process.env.DATABASE_URL || 'postgresql://kenza:kenzapassword@localhost:5432/kenzadb';

export const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

/**
 * Fonction utilitaire pour exécuter une requête SQL avec journalisation simple
 */
export async function query(text: string, params?: any[]) {
  const res = await pool.query(text, params);
  return res;
}
