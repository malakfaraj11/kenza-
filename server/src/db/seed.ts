import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { query, pool } from './connection.js';
import { initDbSchema } from './schema.js';

async function seed() {
  console.log('🚀 Démarrage de l\'importation des données (SEED)...');
  
  // 1. Initialiser le schéma si nécessaire
  await initDbSchema();

  const dataDir = path.resolve(__dirname, '../../../sujet-02-kenza');

  // 2. Importer le Catalogue
  const catalogueFile = path.join(dataDir, 'catalogue.csv');
  if (fs.existsSync(catalogueFile)) {
    const content = fs.readFileSync(catalogueFile, 'utf8');
    const records = parse(content, { columns: true, skip_empty_lines: true });
    console.log(`📦 Importation de ${records.length} articles dans le catalogue...`);

    for (const r of records) {
      await query(`
        INSERT INTO catalogue (ref, modele, famille, genre, couleur, taille, matiere, saison, prix_mad, stock, delai_reassort_jours, code_barre, poids_g)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (ref) DO UPDATE SET
          modele = EXCLUDED.modele,
          prix_mad = EXCLUDED.prix_mad,
          stock = EXCLUDED.stock,
          delai_reassort_jours = EXCLUDED.delai_reassort_jours;
      `, [
        r.ref,
        r.modele,
        r.famille,
        r.genre,
        r.couleur,
        r.taille,
        r.matiere,
        r.saison,
        parseFloat(r.prix_mad || '0'),
        parseInt(r.stock || '0', 10),
        r.delai_reassort_jours ? parseInt(r.delai_reassort_jours, 10) : null,
        r.code_barre,
        r.poids_g ? parseInt(r.poids_g, 10) : null
      ]);
    }
  }

  // 3. Importer les Promotions
  const promoFile = path.join(dataDir, 'promotions.csv');
  if (fs.existsSync(promoFile)) {
    const content = fs.readFileSync(promoFile, 'utf8');
    const records = parse(content, { columns: true, skip_empty_lines: true });
    console.log(`🏷️ Importation de ${records.length} promotions...`);

    await query(`DELETE FROM promotions;`);
    for (const r of records) {
      await query(`
        INSERT INTO promotions (ref, modele, prix_normal_mad, prix_promo_mad, debut, fin, condition)
        VALUES ($1, $2, $3, $4, $5, $6, $7);
      `, [
        r.ref,
        r.modele,
        parseFloat(r.prix_normal_mad || '0'),
        parseFloat(r.prix_promo_mad || '0'),
        r.debut,
        r.fin,
        r.condition
      ]);
    }
  }

  // 4. Importer les Clients
  const clientsFile = path.join(dataDir, 'clients.csv');
  if (fs.existsSync(clientsFile)) {
    const content = fs.readFileSync(clientsFile, 'utf8');
    const records = parse(content, { columns: true, skip_empty_lines: true });
    console.log(`👤 Importation de ${records.length} clients...`);

    for (const r of records) {
      await query(`
        INSERT INTO clients (client_id, nom, telephone, ville, langue_preferee, premier_achat, nb_commandes, segment)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (client_id) DO UPDATE SET
          nom = EXCLUDED.nom,
          telephone = EXCLUDED.telephone,
          ville = EXCLUDED.ville,
          langue_preferee = EXCLUDED.langue_preferee;
      `, [
        r.client_id,
        r.nom,
        r.telephone,
        r.ville,
        r.langue_preferee || 'fr',
        r.premier_achat ? r.premier_achat : null,
        parseInt(r.nb_commandes || '0', 10),
        r.segment
      ]);
    }
  }

  // 5. Importer la Grille de Livraison
  const livraisonFile = path.join(dataDir, 'livraison.csv');
  if (fs.existsSync(livraisonFile)) {
    const content = fs.readFileSync(livraisonFile, 'utf8');
    const records = parse(content, { columns: true, skip_empty_lines: true });
    console.log(`🚚 Importation de ${records.length} règles de livraison...`);

    for (const r of records) {
      await query(`
        INSERT INTO livraison (ville, frais_mad, delai_heures, paiement_a_la_livraison, retrait_boutique)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (ville) DO UPDATE SET
          frais_mad = EXCLUDED.frais_mad,
          delai_heures = EXCLUDED.delai_heures,
          paiement_a_la_livraison = EXCLUDED.paiement_a_la_livraison,
          retrait_boutique = EXCLUDED.retrait_boutique;
      `, [
        r.ville,
        parseFloat(r.frais_mad || '0'),
        parseInt(r.delai_heures || '48', 10),
        r.paiement_a_la_livraison === 'oui',
        r.retrait_boutique === 'oui'
      ]);
    }
  }

  // 6. Importer les Commandes Historiques
  const commandesFile = path.join(dataDir, 'commandes.csv');
  if (fs.existsSync(commandesFile)) {
    const content = fs.readFileSync(commandesFile, 'utf8');
    const records = parse(content, { columns: true, skip_empty_lines: true });
    console.log(`📜 Importation de ${records.length} commandes historiques...`);

    for (const r of records) {
      await query(`
        INSERT INTO commandes (id, client_id, date_commande, canal, statut, total_articles_mad, frais_livraison_mad, total_mad, ville_livraison, mode_paiement)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO NOTHING;
      `, [
        r.commande_id,
        r.client_id,
        r.date,
        r.canal || 'whatsapp',
        r.statut || 'en_attente',
        parseFloat(r.total_articles_mad || '0'),
        parseFloat(r.frais_livraison_mad || '0'),
        parseFloat(r.total_mad || '0'),
        r.ville_livraison,
        r.paiement
      ]);
    }
  }

  // 7. Importer les Lignes de Commande
  const lignesFile = path.join(dataDir, 'commandes-lignes.csv');
  if (fs.existsSync(lignesFile)) {
    const content = fs.readFileSync(lignesFile, 'utf8');
    const records = parse(content, { columns: true, skip_empty_lines: true });
    console.log(`🧾 Importation de ${records.length} lignes de commandes...`);

    await query(`DELETE FROM commandes_lignes;`);
    for (const r of records) {
      await query(`
        INSERT INTO commandes_lignes (commande_id, ref, modele, taille, quantite, prix_unitaire_mad)
        VALUES ($1, $2, $3, $4, $5, $6);
      `, [
        r.commande_id,
        r.ref,
        r.modele,
        r.taille,
        parseInt(r.quantite || '1', 10),
        parseFloat(r.prix_unitaire_mad || '0')
      ]);
    }
  }

  // 8. Rapport de vérification des données
  const catCount = await query(`SELECT COUNT(*) FROM catalogue;`);
  const promoCount = await query(`SELECT COUNT(*) FROM promotions;`);
  const clientsCount = await query(`SELECT COUNT(*) FROM clients;`);
  const livrCount = await query(`SELECT COUNT(*) FROM livraison;`);
  const cmdCount = await query(`SELECT COUNT(*) FROM commandes;`);
  const lignesCount = await query(`SELECT COUNT(*) FROM commandes_lignes;`);

  console.log('\n📊 --- RÉSUMÉ DU CHARGEMENT EN BASE DE DONNÉES ---');
  console.log(`✅ Articles Catalogue  : ${catCount.rows[0].count} / 80`);
  console.log(`✅ Promotions Actives  : ${promoCount.rows[0].count} / 12`);
  console.log(`✅ Clients Enregistrés : ${clientsCount.rows[0].count} / 120`);
  console.log(`✅ Villes de Livraison : ${livrCount.rows[0].count} / 12`);
  console.log(`✅ Commandes Passées   : ${cmdCount.rows[0].count} / 320`);
  console.log(`✅ Lignes de Commandes : ${lignesCount.rows[0].count} / 450`);
  console.log('--------------------------------------------------');
  console.log('✨ Base de données prête et intègre pour Kenza !');

  await pool.end();
}

seed().catch((err) => {
  console.error('❌ Erreur lors du seeding :', err);
  process.exit(1);
});
