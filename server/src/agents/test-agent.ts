import { chatWithKenza } from './kenzaAgent.js';
import { pool } from '../db/connection.js';

async function testAgentConversations() {
  console.log('🤖 ========================================================');
  console.log('🤖 TEST DU CŒUR AGENTIQUE KENZA (LANGGRAPH & DARIJA)');
  console.log('🤖 ========================================================\n');

  // SCÉNARIO 1 : Question en Darija sur un produit
  console.log('🇲🇦 SCÉNARIO 1 : Client s\'exprime en Darija (demande de prix)');
  console.log('👤 Client: "salam, chhal taman dyal had chemise vert olive ?"');
  const res1 = await chatWithKenza("salam, chhal taman dyal had chemise vert olive ?", "+212697691176");
  console.log('🤖 Kenza:\n' + res1.reply);
  console.log('------------------------------------------------------------\n');

  // SCÉNARIO 2 : Rupture de stock (Caftan beige S)
  console.log('📦 SCÉNARIO 2 : Rupture de stock & refus de date inventée');
  console.log('👤 Client: "Je veux commander le Caftan beige en taille S. Est-il dispo ?"');
  const res2 = await chatWithKenza("Je veux commander le Caftan beige en taille S. Est-il dispo ?", "+212612345678");
  console.log('🤖 Kenza:\n' + res2.reply);
  console.log('------------------------------------------------------------\n');

  // SCÉNARIO 3 : Négociation de remise excessive (plancher 10% dépassé)
  console.log('💰 SCÉNARIO 3 : Demande de remise excessive (25%)');
  console.log('👤 Client: "Si je prends 2 vestes, vous me faites 25% de remise ?"');
  const res3 = await chatWithKenza("Si je prends 2 vestes, vous me faites 25% de remise ?", "+212612345678");
  console.log('🤖 Kenza:\n' + res3.reply);
  console.log('------------------------------------------------------------\n');

  // SCÉNARIO 4 : Escalade obligatoire (Demande de facture au nom d\'une société)
  console.log('🚨 SCÉNARIO 4 : Escalade vers l\'humain (Facture au nom d\'une société)');
  console.log('👤 Client: "Pouvez-vous m\'émettre une facture officielle au nom de ma société SARL MAROC TECH ?"');
  const res4 = await chatWithKenza("Pouvez-vous m\'émettre une facture officielle au nom de ma société SARL MAROC TECH ?", "+212697691176");
  console.log('🤖 Kenza:\n' + res4.reply);
  console.log('------------------------------------------------------------\n');

  await pool.end();
}

testAgentConversations().catch(console.error);
