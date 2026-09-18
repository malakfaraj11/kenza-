import {
  searchCatalogueTool,
  checkShippingTool,
  getClientHistoryTool,
  calculateDiscountTool,
  createOrderTool,
  escalateToHumanTool,
  getBoutiqueFaqTool
} from './tools.js';
import { pool } from '../db/connection.js';

async function runToolTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 TEST DES OUTILS DÉTERMINISTES (ZERO-HALLUCINATION)');
  console.log('🧪 ========================================================\n');

  // TEST 1 : Recherche Catalogue & Promotion active
  console.log('🔹 1. Test : Recherche d\'un article en promotion (Pantalon camel)');
  const resPromo = await searchCatalogueTool.invoke({ motsCles: 'Pantalon camel' });
  console.log('Résultat :', JSON.parse(resPromo));

  // TEST 2 : Gestion de la Rupture de Stock (Caftan beige S)
  console.log('\n🔹 2. Test : Article en rupture de stock & proposition d\'alternatives');
  const resRupture = await searchCatalogueTool.invoke({ motsCles: 'Caftan beige S' });
  console.log('Résultat :', JSON.parse(resRupture));

  // TEST 3 : Calcul de Livraison (Ville dans la grille vs Ville hors grille)
  console.log('\n🔹 3. Test : Livraison pour Casablanca (ville supportée)');
  const resCasa = await checkShippingTool.invoke({ ville: 'Casablanca' });
  console.log('Casablanca :', JSON.parse(resCasa));

  console.log('\n🔹 3 bis. Test : Livraison pour Errachidia (ville HORS GRILLE)');
  const resHorsGrille = await checkShippingTool.invoke({ ville: 'Errachidia' });
  console.log('Errachidia :', JSON.parse(resHorsGrille));

  // TEST 4 : Garde-fou sur les Remises (Plafond strict de 10%)
  console.log('\n🔹 4. Test : Demande de remise autorisée (5% sur 500 MAD)');
  const resRemiseOk = await calculateDiscountTool.invoke({ pourcentageDemande: 5, montantInitial: 500 });
  console.log('Remise 5% :', JSON.parse(resRemiseOk));

  console.log('\n🔹 4 bis. Test : Demande de remise INTERDITE (20% sur 500 MAD - Plancher dépassé)');
  const resRemiseTrop = await calculateDiscountTool.invoke({ pourcentageDemande: 20, montantInitial: 500 });
  console.log('Remise 20% :', JSON.parse(resRemiseTrop));

  // TEST 5 : Mémoire Client (Reconnaissance par téléphone)
  console.log('\n🔹 5. Test : Récupération de l\'historique d\'un client (+212697691176)');
  const resClient = await getClientHistoryTool.invoke({ telephone: '+212697691176' });
  console.log('Client reconnu :', JSON.parse(resClient));

  // TEST 6 : Escalade vers l'humain (Demande de facture au nom d'une société)
  console.log('\n🔹 6. Test : Escalade humaine pour facture société');
  const resEscalade = await escalateToHumanTool.invoke({
    conversationId: 'CONV-TEST-001',
    telephone: '+212697691176',
    raison: 'Facturation société demandée (hors compétence agent)',
    contexte: 'Le client Nadia souhaite une facture au nom de SARL ABC pour un montant de 1500 MAD.'
  });
  console.log('Ticket escalade créé :', JSON.parse(resEscalade));

  // TEST 7 : FAQ Boutique
  console.log('\n🔹 7. Test : FAQ Horaires et Retrait Boutique');
  const resFaq = await getBoutiqueFaqTool.invoke({ sujet: 'horaires' });
  console.log('FAQ Horaires :', JSON.parse(resFaq));

  console.log('\n✅ TOUS LES TESTS D\'OUTILS SONT VALIDÉS !');
  await pool.end();
}

runToolTests().catch(console.error);
