import { Queue, Worker } from 'bullmq';
import { chatWithKenza } from '../agents/kenzaAgent.js';
import { relanceSettings } from '../index.js';

// Connexion Redis
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

// 1. File d'attente BullMQ
export const abandonedCartQueue = new Queue('abandoned_cart', { connection });

/**
 * 2. Worker BullMQ pour les relances dynamiques
 */
export function setupAbandonedCartWorker(conversationHistories: Map<string, any[]>) {
  console.log('👷 BullMQ Worker prêt : Écoute des relances clients inactifs...');

  const worker = new Worker('abandoned_cart', async (job) => {
    const { phone } = job.data;

    if (relanceSettings && !relanceSettings.enabled) {
      console.log(`⏹️ [BullMQ] Relance ignorée pour ${phone} (fonctionnalité désactivée).`);
      return;
    }

    console.log(`⏳ [BullMQ] Exécution de la relance pour le client : ${phone}`);
    const history = conversationHistories.get(phone) || [];

    // Vérifier si le dernier message est déjà une réponse du client
    const lastMsg = history[history.length - 1];
    if (lastMsg && (lastMsg.name === 'user' || lastMsg._getType?.() === 'human')) {
      console.log(`⏹️ [BullMQ] Relance annulée pour ${phone} car le client a déjà répondu !`);
      return;
    }

    const systemPrompt = `[SYSTEM] Le client n'a pas répondu depuis un moment. Génère un message très court, chaleureux et bienveillant en Darija (lettres latines / Arabizi) pour savoir s'il est toujours intéressé par les articles discutés précédemment ou s'il a besoin d'aide. Ne sois pas intrusif.`;

    try {
      const response = await chatWithKenza(systemPrompt, phone, history);
      conversationHistories.set(phone, response.messages);

      const apiUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
      const apiKey = process.env.EVOLUTION_API_KEY || 'kenza-secret-api-key-2026';
      const instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'kenza-bot';

      if (apiUrl && apiKey && instanceName) {
        try {
          const targetNumber = phone;
          const messageText = typeof response.reply === 'string' ? response.reply : String(response.reply || '');
          
          const evoRes = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
            method: 'POST',
            headers: {
              'apikey': apiKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              number: targetNumber,
              options: { delay: 1200, presence: 'composing' },
              textMessage: { text: messageText }
            })
          });

          const evoData = await evoRes.json().catch(() => ({})) as any;
          if (evoRes.ok) {
            console.log(`✅ [BullMQ] Relance WhatsApp envoyée avec succès à ${cleanTargetPhone}`);
          } else {
            console.error(`❌ [BullMQ Erreur WhatsApp] Code HTTP ${evoRes.status} de Evolution API:`, JSON.stringify(evoData));
          }
        } catch (evoErr) {
          console.error(`⚠️ [BullMQ] Erreur envoi WhatsApp:`, evoErr);
        }
      } else {
        console.log(`✅ [BullMQ] Relance Web générée pour ${phone} : "${response.reply}"`);
      }
    } catch (err) {
      console.error(`❌ [BullMQ] Erreur lors de la génération de la relance:`, err);
    }
  }, { connection });

  worker.on('failed', (job, err) => {
    console.error(`❌ [BullMQ] Job ${job?.id} en échec: ${err.message}`);
  });

  return worker;
}
