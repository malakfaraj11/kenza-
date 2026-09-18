import fs from 'fs';
import path from 'path';
import { query, pool } from './connection.js';

export async function initDbSchema() {
  console.log('🔄 Initialisation du schéma de la base de données...');
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  await query(sql);
  console.log('✅ Schéma PostgreSQL initialisé avec succès !');
}

// Si exécuté directement via `npm run db:init`
if (import.meta.url === `file://${process.argv[1]}`) {
  initDbSchema()
    .then(() => pool.end())
    .catch((err) => {
      console.error('❌ Erreur lors de l\'initialisation du schéma :', err);
      process.exit(1);
    });
}
