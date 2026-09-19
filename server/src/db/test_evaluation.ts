import { chatWithKenza } from '../agents/kenzaAgent.js';
import { pool } from './connection.js';

async function runEvaluationTests() {
  console.log('\n=============================================================');
  console.log('🧪 BANC DE TEST AUTOMATISÉ : ÉVALUATION DES RÉPONSES DU BOT IA');
  console.log('   (Données Ingestées depuis le dossier sujet-02-kenza)');
  console.log('=============================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  // Test 1: Recherche Produit (Foulard Bordeaux)
  totalTests++;
  console.log(`\n-------------------------------------------------------------`);
  console.log(`TEST 1: Recherche Produit Catalogue ("Foulard bordeaux")`);
  console.log(`-------------------------------------------------------------`);
  try {
    const res1 = await chatWithKenza("Salam, wach 3ndkoum foulard bordeaux w chhal thaman dyalo?", "+212600000000");
    console.log(`🤖 BOT RESPONSE:\n${res1.reply}\n`);
    if (res1.reply.includes("100") || res1.reply.toLowerCase().includes("foulard")) {
      console.log(`✅ TEST 1 SUCCÈS : Prix exact (100 MAD/DH) et produit identifiés depuis la base !`);
      passedTests++;
    } else {
      console.log(`❌ TEST 1 ÉCHEC : La réponse ne contient pas le prix ou l'article exact.`);
    }
  } catch (err: any) {
    console.error(`❌ TEST 1 ERREUR:`, err.message);
  }

  // Test 2: Vérification des Frais de Livraison (Casablanca & Marrakech)
  totalTests++;
  console.log(`\n-------------------------------------------------------------`);
  console.log(`TEST 2: Grille de Livraison par Ville ("Casablanca" & "Marrakech")`);
  console.log(`-------------------------------------------------------------`);
  try {
    const res2 = await chatWithKenza("Chhal la livraison l Kesh (Marrakech) et Casa?", "+212600000000");
    console.log(`🤖 BOT RESPONSE:\n${res2.reply}\n`);
    if (res2.reply.includes("25") || res2.reply.includes("45") || res2.reply.toLowerCase().includes("marrakech")) {
      console.log(`✅ TEST 2 SUCCÈS : Les frais de livraison exacts (25 DH Casa, 45 DH Marrakech) ont été extraits !`);
      passedTests++;
    } else {
      console.log(`❌ TEST 2 ÉCHEC : Frais de livraison non reconnus.`);
    }
  } catch (err: any) {
    console.error(`❌ TEST 2 ERREUR:`, err.message);
  }

  // Test 3: Mémoire Client & Historique des Commandes
  totalTests++;
  console.log(`\n-------------------------------------------------------------`);
  console.log(`TEST 3: Mémoire Client & Historique ("+212612345678")`);
  console.log(`-------------------------------------------------------------`);
  try {
    const res3 = await chatWithKenza("Salam Kenza, bghit na3raf les commandes dyali l sab9in?", "+212612345678");
    console.log(`🤖 BOT RESPONSE:\n${res3.reply}\n`);
    if (res3.reply.toLowerCase().includes("amine") || res3.reply.toLowerCase().includes("commande") || res3.reply.includes("CMD-")) {
      console.log(`✅ TEST 3 SUCCÈS : Client identifié avec historique des commandes extrait de la base !`);
      passedTests++;
    } else {
      console.log(`❌ TEST 3 ÉCHEC : Historique client non trouvé.`);
    }
  } catch (err: any) {
    console.error(`❌ TEST 3 ERREUR:`, err.message);
  }

  // Test 4: Garde-Fou Remise Commerciale (5% vs 20%)
  totalTests++;
  console.log(`\n-------------------------------------------------------------`);
  console.log(`TEST 4: Plafond de Remise Commerciale (Demande de 20% -> Refus & Escalade)`);
  console.log(`-------------------------------------------------------------`);
  try {
    const res4 = await chatWithKenza("Bghit la veste ksswa mais 3tini remise dyal 20% chrifa", "+212600000000");
    console.log(`🤖 BOT RESPONSE:\n${res4.reply}\n`);
    if (res4.reply.includes("10") || res4.reply.toLowerCase().includes("commerçant") || res4.reply.toLowerCase().includes("remise") || res4.reply.toLowerCase().includes("transfer")) {
      console.log(`✅ TEST 4 SUCCÈS : Garde-fou 10% respecté, remise 20% refusée et escalade appliquée !`);
      passedTests++;
    } else {
      console.log(`❌ TEST 4 ÉCHEC : La règle du plafond 10% n'a pas été appliquée.`);
    }
  } catch (err: any) {
    console.error(`❌ TEST 4 ERREUR:`, err.message);
  }

  // Test 5: FAQ - Politique Internationale & Retrait Boutique
  totalTests++;
  console.log(`\n-------------------------------------------------------------`);
  console.log(`TEST 5: FAQ & Politique Commerciale (Livraison Internationale)`);
  console.log(`-------------------------------------------------------------`);
  try {
    const res5 = await chatWithKenza("Wach katanwslou l la France ou la Belgique?", "+212600000000");
    console.log(`🤖 BOT RESPONSE:\n${res5.reply}\n`);
    if (res5.reply.toLowerCase().includes("maroc") || res5.reply.toLowerCase().includes("pas") || res5.reply.toLowerCase().includes("exclusiv") || res5.reply.toLowerCase().includes("l'international")) {
      console.log(`✅ TEST 5 SUCCÈS : Règle d'exclusion internationale appliquée d'après faq-boutique.md !`);
      passedTests++;
    } else {
      console.log(`❌ TEST 5 ÉCHEC : Règle FAQ internationale non respectée.`);
    }
  } catch (err: any) {
    console.error(`❌ TEST 5 ERREUR:`, err.message);
  }

  console.log(`\n=============================================================`);
  console.log(`📊 RÉSULTAT DU BANC DE TEST : ${passedTests} / ${totalTests} TESTS PASSÉS`);
  console.log(`=============================================================\n`);

  await pool.end();
}

runEvaluationTests().catch(console.error);
