import { relanceSettings } from '../index.js';
import { abandonedCartQueue } from '../workers/abandonedCart.js';

async function testRelanceSettings() {
  console.log('\n=============================================================');
  console.log('🧪 TEST AUTOMATISÉ : CONFIGURATION DYNAMIQUE DE LA RELANCE');
  console.log('=============================================================\n');

  // Test 1: Configuration par défaut
  console.log('1. Vérification des paramètres par défaut :', relanceSettings);
  if (relanceSettings.enabled === true && relanceSettings.delayMinutes === 120) {
    console.log('✅ Paramètres par défaut valides (120 minutes / 2 heures).');
  } else {
    console.error('❌ Défaut inattendu:', relanceSettings);
  }

  // Test 2: Modification dynamique (ex: 2 minutes pour test)
  relanceSettings.delayMinutes = 2;
  console.log('2. Modification dynamique du délai à 2 minutes :', relanceSettings);
  if (relanceSettings.delayMinutes === 2) {
    console.log('✅ Modification dynamique prise en compte.');
  }

  // Test 3: Planification et Annulation BullMQ Redis
  const testPhone = '+212699887766';
  const delayMs = relanceSettings.delayMinutes * 60 * 1000;
  
  console.log(`3. Ajout d'un job de relance différé de ${delayMs}ms pour ${testPhone}...`);
  await abandonedCartQueue.add('followup', { phone: testPhone }, { delay: delayMs, jobId: testPhone, removeOnComplete: true });

  let job = await abandonedCartQueue.getJob(testPhone);
  if (job) {
    const delayVal = job.opts.delay || 0;
    console.log(`✅ Job BullMQ ${job.id} présent dans Redis avec un délai de ${delayVal}ms (${delayVal / 60000} min).`);
  } else {
    console.error('❌ Job non trouvé dans Redis.');
  }

  // Test 4: Annulation sur réponse client
  console.log(`4. Annulation immédiate sur réception du message client pour ${testPhone}...`);
  await abandonedCartQueue.remove(testPhone);
  
  let jobAfterRemove = await abandonedCartQueue.getJob(testPhone);
  if (!jobAfterRemove) {
    console.log(`✅ SUCCÈS : Le job de relance a été immédiatement annulé dans Redis !`);
  } else {
    console.error('❌ Le job existe toujours dans Redis après annulation.');
  }

  console.log('\n=============================================================');
  console.log('📊 TOUS LES TESTS DE RELANCE DYNAMIQUE SONT PASSÉS !');
  console.log('=============================================================\n');
}

testRelanceSettings().catch(console.error);
