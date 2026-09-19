import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { query, pool } from './connection.js';

async function ingestSujetData() {
  const dataDir = '/Users/mac/Desktop/kenza-/sujet-02-kenza';
  console.log('🚀 Ingestion dynamique de toutes les données du dossier sujet-02-kenza...');

  // 1. Ingest Catalogue
  const catPath = path.join(dataDir, 'catalogue.csv');
  if (fs.existsSync(catPath)) {
    const records: any[] = parse(fs.readFileSync(catPath, 'utf8'), { columns: true, skip_empty_lines: true });
    console.log(`📦 Ingestion de ${records.length} articles du catalogue...`);
    for (const r of records) {
      const extraMeta = {
        saison: r.saison,
        code_barre: r.code_barre,
        poids_g: r.poids_g ? parseInt(r.poids_g, 10) : null,
        delai_reassort_jours: r.delai_reassort_jours ? parseInt(r.delai_reassort_jours, 10) : null
      };
      await query(`
        INSERT INTO catalogue (ref, modele, famille, genre, couleur, taille, matiere, saison, prix_mad, stock, delai_reassort_jours, code_barre, poids_g, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (ref) DO UPDATE SET
          modele = EXCLUDED.modele,
          prix_mad = EXCLUDED.prix_mad,
          stock = EXCLUDED.stock,
          metadata = EXCLUDED.metadata;
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
        r.poids_g ? parseInt(r.poids_g, 10) : null,
        JSON.stringify(extraMeta)
      ]);
    }
  }

  // 2. Ingest Promotions
  const promoPath = path.join(dataDir, 'promotions.csv');
  if (fs.existsSync(promoPath)) {
    const records: any[] = parse(fs.readFileSync(promoPath, 'utf8'), { columns: true, skip_empty_lines: true });
    console.log(`🏷️ Ingestion de ${records.length} promotions...`);
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

  // 3. Ingest Clients
  const clientPath = path.join(dataDir, 'clients.csv');
  if (fs.existsSync(clientPath)) {
    const records: any[] = parse(fs.readFileSync(clientPath, 'utf8'), { columns: true, skip_empty_lines: true });
    console.log(`👤 Ingestion de ${records.length} clients...`);
    for (const r of records) {
      await query(`
        INSERT INTO clients (client_id, nom, telephone, ville, langue_preferee, premier_achat, nb_commandes, segment)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (client_id) DO UPDATE SET
          nom = EXCLUDED.nom,
          telephone = EXCLUDED.telephone,
          ville = EXCLUDED.ville;
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

  // 4. Ingest Livraison
  const livrPath = path.join(dataDir, 'livraison.csv');
  if (fs.existsSync(livrPath)) {
    const records: any[] = parse(fs.readFileSync(livrPath, 'utf8'), { columns: true, skip_empty_lines: true });
    console.log(`🚚 Ingestion de ${records.length} règles de livraison...`);
    for (const r of records) {
      await query(`
        INSERT INTO livraison (ville, frais_mad, delai_heures, paiement_a_la_livraison, retrait_boutique)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (ville) DO UPDATE SET
          frais_mad = EXCLUDED.frais_mad,
          delai_heures = EXCLUDED.delai_heures;
      `, [
        r.ville,
        parseFloat(r.frais_mad || '0'),
        parseInt(r.delai_heures || '48', 10),
        r.paiement_a_la_livraison === 'oui',
        r.retrait_boutique === 'oui'
      ]);
    }
  }

  // 5. Ingest Commandes
  const cmdPath = path.join(dataDir, 'commandes.csv');
  if (fs.existsSync(cmdPath)) {
    const records: any[] = parse(fs.readFileSync(cmdPath, 'utf8'), { columns: true, skip_empty_lines: true });
    console.log(`📜 Ingestion de ${records.length} commandes...`);
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

  // 6. Ingest Commandes Lignes
  const lignesPath = path.join(dataDir, 'commandes-lignes.csv');
  if (fs.existsSync(lignesPath)) {
    const records: any[] = parse(fs.readFileSync(lignesPath, 'utf8'), { columns: true, skip_empty_lines: true });
    console.log(`🧾 Ingestion de ${records.length} lignes de commandes...`);
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

  console.log('✅ Toutes les données de sujet-02-kenza ont été chargées avec succès en base PostgreSQL.');
  await pool.end();
}

ingestSujetData().catch(console.error);
