import { query, pool } from './connection.js';

async function testQueries() {
  console.log('🧪 --- TEST DES REQUÊTES EN BASE DE DONNÉES ---\n');

  // 1. Tester un produit avec promotion active
  const promoRes = await query(`
    SELECT c.ref, c.modele, c.prix_mad AS prix_catalogue, 
           p.prix_promo_mad, p.debut, p.fin
    FROM catalogue c
    JOIN promotions p ON c.ref = p.ref
    LIMIT 3;
  `);
  console.log('1️⃣ Produits avec promotion active :');
  console.table(promoRes.rows);

  // 2. Vérifier les produits en rupture de stock
  const ruptureRes = await query(`
    SELECT ref, modele, couleur, taille, stock
    FROM catalogue
    WHERE stock = 0
    LIMIT 3;
  `);
  console.log('\n2️⃣ Exemples d\'articles en rupture (stock = 0) :');
  console.table(ruptureRes.rows);

  // 3. Tester la grille de livraison pour Casablanca et Fès
  const livrRes = await query(`
    SELECT ville, frais_mad, delai_heures, paiement_a_la_livraison, retrait_boutique
    FROM livraison
    WHERE ville IN ('Casablanca', 'Fès');
  `);
  console.log('\n3️⃣ Règles de livraison (Casablanca & Fès) :');
  console.table(livrRes.rows);

  // 4. Tester la recherche d'un client par son téléphone
  const clientRes = await query(`
    SELECT client_id, nom, telephone, ville, langue_preferee, nb_commandes
    FROM clients
    WHERE telephone = '+212697691176';
  `);
  console.log('\n4️⃣ Recherche client par téléphone (+212697691176) :');
  console.table(clientRes.rows);

  await pool.end();
}

testQueries().catch(console.error);
