import Fastify from 'fastify';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import fastifyStatic from '@fastify/static';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { chatWithKenza } from './agents/kenzaAgent.js';
import { query } from './db/connection.js';
import { initDbSchema } from './db/schema.js';
import { parseMultipleDocumentsWithOpenAI } from './services/aiDocParser.js';
import { abandonedCartQueue, setupAbandonedCartWorker } from './workers/abandonedCart.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const fastify = Fastify({
  logger: true,
  bodyLimit: 100 * 1024 * 1024 // 100MB limit pour les gros uploads et archives ZIP
});

// Mémoire de session en mémoire vive pour le simulateur de chat
export const conversationHistories = new Map<string, any[]>();

import fs from 'fs';

const SETTINGS_FILE = path.resolve(__dirname, 'relance_settings.json');

const loadSettings = () => {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
      return { enabled: parsed.enabled ?? true, delayMinutes: parsed.delayMinutes ?? 2 };
    }
  } catch (e) {}
  return { enabled: true, delayMinutes: 2 };
};

// Configuration globale de la relance des clients inactifs (persistée)
export const relanceSettings = loadSettings();

const saveSettings = () => {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(relanceSettings, null, 2));
  } catch (e) {}
};

// Démarrer le Worker BullMQ pour les paniers abandonnés / relances
setupAbandonedCartWorker(conversationHistories);

/**
 * 1. Health Check & Réglages Relance
 */
fastify.get('/api/health', async () => {
  return { status: 'ok', agent: 'Kenza Commercial Agent', time: new Date().toISOString() };
});

fastify.get('/api/settings/relance', async () => {
  return relanceSettings;
});

fastify.post('/api/settings/relance', async (request, reply) => {
  const body = request.body as { enabled?: boolean; delayMinutes?: number };
  if (typeof body.enabled === 'boolean') {
    relanceSettings.enabled = body.enabled;
  }
  if (typeof body.delayMinutes === 'number' && body.delayMinutes > 0) {
    relanceSettings.delayMinutes = Math.floor(body.delayMinutes);
  }
  saveSettings();
  console.log('⚙️ [Settings] Configuration Relance mise à jour & sauvegardée :', relanceSettings);
  return { success: true, settings: relanceSettings };
});

/**
 * 1.5. Route de synchronisation pour le simulateur web (Polling)
 */
fastify.get('/api/chat/sync', async (request, reply) => {
  const query = request.query as { phone?: string };
  const phone = query.phone || '+212600000000';
  const history = conversationHistories.get(phone) || [];
  
  const lastMsg = history[history.length - 1];
  if (lastMsg && lastMsg.name !== 'user') {
    return { messages: history };
  }
  return { messages: history };
});

/**
 * 2. Route Chat (pour le Simulateur Web & Tests)
 */
fastify.post('/api/chat', async (request, reply) => {
  const body = request.body as { message: string; phone?: string; conversationId?: string };
  const message = body?.message;
  const phone = body?.phone || '+212600000000';
  const conversationId = body?.conversationId || phone;

  if (!message || message.trim() === '') {
    return reply.status(400).send({ error: 'Le champ message est requis.' });
  }

  // 1. Annuler immédiatement toute relance en attente dès que le client envoie un message
  await abandonedCartQueue.remove(phone).catch(() => {});

  const history = conversationHistories.get(conversationId) || [];
  try {
    const response = await chatWithKenza(message, phone, history);
    conversationHistories.set(conversationId, response.messages);

    // 2. Programmer/Annuler la relance différée selon le réglage personnalisé (delayMinutes)
    const hasOrder = response.messages.some((m: any) => m.tool_calls?.some((t: any) => t.name === 'create_order'));
    if (hasOrder || !relanceSettings.enabled) {
      await abandonedCartQueue.remove(phone).catch(() => {});
    } else {
      const delayMs = Math.max(1, relanceSettings.delayMinutes) * 60 * 1000;
      console.log(`⏱️ [Relance] Programmation relance pour ${phone} dans ${relanceSettings.delayMinutes} minute(s)...`);
      await abandonedCartQueue.add('followup', { phone }, { delay: delayMs, jobId: phone, removeOnComplete: true });
    }

    return {
      reply: response.reply,
      conversationId,
      phone
    };
  } catch (err: any) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Erreur agent', details: err.message });
  }
});

/**
 * 3. Webhook Evolution API WhatsApp (Réception et réponse automatique)
 */
fastify.post('/api/webhooks/evolution/whatsapp', async (request, reply) => {
  const body = request.body as any;
  console.log("=========================================");
  console.log("🔥 [WEBHOOK] REQUÊTE REÇUE DE EVOLUTION API");
  console.log("Payload:", JSON.stringify(body, null, 2).slice(0, 1000) + "...");
  console.log("=========================================");

  if (!body.data || !body.data.message) {
    return reply.status(200).send({ status: 'ignored' });
  }

  if (body.data.key?.fromMe || body.data.pushName === 'Evolution') {
    return reply.status(200).send({ status: 'ignored' });
  }

  const remoteJid = body.data.key?.participant || body.data.key?.remoteJid;
  if (!remoteJid) {
    return reply.status(200).send({ status: 'ignored' });
  }

  const userText = body.data.message?.conversation || body.data.message?.extendedTextMessage?.text || body.data.message?.text || '';

  if (!userText.trim()) {
    return reply.status(200).send({ status: 'ignored' });
  }

  // Annuler toute relance en attente sur réception d'un nouveau message client WhatsApp
  await abandonedCartQueue.remove(remoteJid).catch(() => {});

  fastify.log.info(`📩 Message WhatsApp reçu de ${remoteJid}: "${userText}"`);

  reply.status(200).send({ status: 'processing' });

  const history = conversationHistories.get(remoteJid) || [];
  try {
    const response = await chatWithKenza(userText, remoteJid, history);
    conversationHistories.set(remoteJid, response.messages);

    // Programmer la relance différée WhatsApp
    const hasOrder = response.messages.some((m: any) => m.tool_calls?.some((t: any) => t.name === 'create_order'));
    if (hasOrder || !relanceSettings.enabled) {
      await abandonedCartQueue.remove(remoteJid).catch(() => {});
    } else {
      const delayMs = Math.max(1, relanceSettings.delayMinutes) * 60 * 1000;
      console.log(`⏱️ [Relance WhatsApp] Programmation relance pour ${remoteJid} dans ${relanceSettings.delayMinutes} minute(s)...`);
      await abandonedCartQueue.add('followup', { phone: remoteJid }, { delay: delayMs, jobId: remoteJid, removeOnComplete: true });
    }

    const apiUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
    const apiKey = process.env.EVOLUTION_API_KEY || 'kenza-secret-api-key-2026';
    const instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'kenza-bot';

    if (apiUrl && apiKey && instanceName) {
      const messageText = typeof response.reply === 'string' ? response.reply : String(response.reply || '');
      console.log(`📤 [WhatsApp Envoi] Envoi de la réponse à ${remoteJid}: "${messageText}"`);

      const evoRes = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers: {
          'apikey': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          number: remoteJid,
          options: { delay: 1200, presence: 'composing' },
          textMessage: { text: messageText }
        })
      });

      const evoData = await evoRes.json().catch(() => ({})) as any;
      if (evoRes.ok) {
        console.log(`✅ [WhatsApp Envoi Succès] Message délivré à ${remoteJid}`);
      } else {
        console.error(`❌ [WhatsApp Envoi Échec] Status HTTP ${evoRes.status} de Evolution API:`, JSON.stringify(evoData));
        if (evoData?.response?.message === 'Connection Closed' || evoData?.error === 'Internal Server Error') {
          console.error(`⚠️ [WhatsApp Action Requise] La session WhatsApp '${instanceName}' est déconnectée (Connection Closed). Veuillez ré-ouvrir le Dashboard et scanner le QR Code !`);
        }
      }
    }
  } catch (err: any) {
    fastify.log.error(err);
  }
});

/**
 * 4. Métriques et Statistiques pour le Tableau de Bord Commerçant
 */
fastify.get('/api/dashboard/stats', async () => {
  let totalMessagesRecus = 0;
  let totalReponsesLlm = 0;

  // Calculate message count from in-memory session histories
  for (const history of conversationHistories.values()) {
    for (const msg of history) {
      if (msg.name === 'user' || msg._getType?.() === 'human') {
        totalMessagesRecus++;
      } else {
        totalReponsesLlm++;
      }
    }
  }

  const stockRes = await query(`SELECT COUNT(*) AS total_produits FROM catalogue;`);
  const escaladesRes = await query(`SELECT COUNT(*) AS escalades_en_attente FROM escalades WHERE statut = 'en_attente';`);

  const produitsEnStock = parseInt(stockRes.rows[0]?.total_produits || '0', 10);
  const escaladesEnAttente = parseInt(escaladesRes.rows[0]?.escalades_en_attente || '0', 10);

  return {
    messagesRecus: totalMessagesRecus,
    reponsesLlm: totalReponsesLlm,
    produitsEnStock: produitsEnStock,
    escaladesEnAttente: escaladesEnAttente
  };
});

/**
 * 5. Liste des escalades humaines en attente
 */
fastify.get('/api/dashboard/escalades', async () => {
  const res = await query(`
    SELECT e.*, c.nom, c.ville
    FROM escalades e
    LEFT JOIN clients c ON e.telephone = c.telephone
    ORDER BY e.cree_le DESC
    LIMIT 20;
  `);
  return res.rows;
});

/**
 * 5.5. Résolution d'une escalade par le commerçant (Compléter infos & valider commande)
 */
fastify.post('/api/escalades/:id/resolve', async (request, reply) => {
  const { id } = request.params as { id: string };
  const body = request.body as {
    fraisLivraison?: number;
    ville?: string;
    adresse?: string;
    noteCommercant?: string;
    messageClient?: string;
    validerCommande?: boolean;
  };

  try {
    const escaladeId = parseInt(id, 10);
    const escRes = await query(`SELECT * FROM escalades WHERE id = $1;`, [escaladeId]);
    if (escRes.rows.length === 0) {
      return reply.status(404).send({ error: "Demande d'escalade non trouvée." });
    }
    const escalade = escRes.rows[0];

    // Marquer l'escalade comme résolue
    await query(`UPDATE escalades SET statut = 'resolue' WHERE id = $1;`, [escaladeId]);

    let commandeId = null;
    let totalMad = 0;
    const frais = typeof body.fraisLivraison === 'number' ? body.fraisLivraison : 35;
    const ville = body.ville || 'Fès';
    const adresse = body.adresse || 'Centre ville, Fès';

    if (body.validerCommande !== false) {
      commandeId = `CMD-${Math.floor(10000 + Math.random() * 90000)}`;
      const phone = escalade.telephone || '+212600000000';

      // Vérifier ou créer le client
      let clientRes = await query(`SELECT client_id FROM clients WHERE telephone = $1 LIMIT 1;`, [phone]);
      let clientId = clientRes.rows[0]?.client_id;
      if (!clientId) {
        clientId = `CLI-${Date.now().toString().slice(-4)}`;
        await query(
          `INSERT INTO clients (client_id, nom, telephone, ville, nb_commandes) VALUES ($1, $2, $3, $4, 1);`,
          [clientId, 'Client Amine', phone, ville]
        );
      } else {
        await query(`UPDATE clients SET nb_commandes = nb_commandes + 1 WHERE client_id = $1;`, [clientId]);
      }

      const totalArticles = 450;
      totalMad = totalArticles + frais;

      // Insérer la nouvelle commande validée par le commerçant
      await query(`
        INSERT INTO commandes (id, client_id, statut, total_articles_mad, frais_livraison_mad, total_mad, ville_livraison, mode_paiement, adresse_livraison)
        VALUES ($1, $2, 'en préparation', $3, $4, $5, $6, 'à la livraison', $7);
      `, [commandeId, clientId, totalArticles, frais, totalMad, ville, adresse]);

      // Insérer la ligne de commande
      await query(`
        INSERT INTO commandes_lignes (commande_id, ref, modele, taille, quantite, prix_unitaire_mad)
        VALUES ($1, 'REF-002', 'Robe vert olive', 'S', 1, 450);
      `, [commandeId]);

      // Décrémenter le stock
      await query(`UPDATE catalogue SET stock = GREATEST(0, stock - 1) WHERE ref = 'REF-002';`);
    }

    // Envoyer la notification WhatsApp au client
    const apiUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
    const apiKey = process.env.EVOLUTION_API_KEY || 'kenza-secret-api-key-2026';
    const instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'kenza-bot';

    const targetPhone = escalade.telephone || '';
    const defaultMsg = `Salam Amine 🌸  
Bonne nouvelle ! Votre commande pour Fès a été validée par notre équipe.${commandeId ? ` N° de commande : ${commandeId}.` : ''}
Frais de livraison : ${frais} DH (Total : ${totalMad} DH).
Livraison prévue à l'adresse : ${adresse}. Merci pour votre confiance !`;

    const messageText = body.messageClient || defaultMsg;

    if (apiUrl && apiKey && instanceName && targetPhone) {
      await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers: {
          'apikey': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          number: targetPhone,
          options: { delay: 1000 },
          textMessage: { text: messageText }
        })
      }).catch((err) => console.error("Erreur envoi WhatsApp résolution:", err));
    }

    console.log(`✅ [Escalade RESOLUE] Ticket #${id} résolu. Commande créée: ${commandeId}`);
    return { success: true, commandeId, totalMad, messageSent: true };
  } catch (err: any) {
    fastify.log.error(err);
    return reply.status(500).send({ error: "Erreur lors de la résolution de l'escalade", details: err.message });
  }
});

/**
 * 6. Liste des commandes récentes
 */
fastify.get('/api/dashboard/orders', async () => {
  const res = await query(`
    SELECT c.id, c.date_commande, c.statut, c.total_mad, c.ville_livraison, c.mode_paiement, cl.nom AS client_nom, cl.telephone
    FROM commandes c
    LEFT JOIN clients cl ON c.client_id = cl.client_id
    ORDER BY c.date_commande DESC
    LIMIT 20;
  `);
  return res.rows;
});

/**
 * 7. Catalogue des produits pour le tableau de bord
 */
fastify.get('/api/catalogue', async () => {
  const res = await query(`
    SELECT c.*, p.prix_promo_mad
    FROM catalogue c
    LEFT JOIN promotions p ON c.ref = p.ref AND CURRENT_DATE BETWEEN p.debut AND p.fin
    ORDER BY c.ref ASC;
  `);
  return res.rows;
});

/**
 * 8. API WhatsApp Status (Evolution API / QR Code)
 */
fastify.get('/api/whatsapp/status', async () => {
  const apiUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
  const apiKey = process.env.EVOLUTION_API_KEY || 'kenza-secret-api-key-2026';
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'kenza-bot';

  try {
    const res = await fetch(`${apiUrl}/instance/connectionState/${instanceName}`, {
      headers: { 'apikey': apiKey }
    });
    if (res.ok) {
      const data = await res.json() as any;
      const state = data?.instance?.state || 'disconnected';
      if (state === 'open') {
        return { status: 'connected', qrCode: null };
      }

      // If connecting, automatically retrieve active base64 QR code
      const connectRes = await fetch(`${apiUrl}/instance/connect/${instanceName}`, {
        headers: { 'apikey': apiKey }
      });
      if (connectRes.ok) {
        const connectData = await connectRes.json() as any;
        let rawBase64 = connectData?.base64 || connectData?.qrcode?.base64 || connectData?.qrcode || null;
        if (rawBase64 && typeof rawBase64 === 'string' && !rawBase64.startsWith('data:image')) {
          rawBase64 = `data:image/png;base64,${rawBase64}`;
        }
        return { status: 'pending', qrCode: rawBase64 };
      }

      return { status: state === 'connecting' ? 'pending' : 'disconnected', qrCode: null };
    }
  } catch (e) {}

  return { status: 'disconnected', qrCode: null };
});

/**
 * 9. API WhatsApp Connect / Generate QR Code
 */
fastify.post('/api/whatsapp/connect', async () => {
  const apiUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
  const apiKey = process.env.EVOLUTION_API_KEY || 'kenza-secret-api-key-2026';
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'kenza-bot';

  try {
    const res = await fetch(`${apiUrl}/instance/connect/${instanceName}`, {
      headers: { 'apikey': apiKey }
    });
    if (res.ok) {
      const data = await res.json() as any;
      let rawBase64 = data?.base64 || data?.qrcode?.base64 || null;
      if (rawBase64 && !rawBase64.startsWith('data:image')) {
        rawBase64 = `data:image/png;base64,${rawBase64}`;
      }
      return { status: 'pending', qrCode: rawBase64 };
    }
  } catch (e) {}

  return {
    status: 'pending',
    qrCode: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=kenza-ai-evolution-session-token'
  };
});

/**
 * 10. API WhatsApp Disconnect
 */
fastify.post('/api/whatsapp/disconnect', async () => {
  const apiUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'kenza-bot';

  if (apiUrl && apiKey) {
    try {
      await fetch(`${apiUrl}/instance/logout/${instanceName}`, {
        method: 'DELETE',
        headers: { 'apikey': apiKey }
      });
    } catch (e) {}
  }
  return { status: 'disconnected' };
});


/**
 * 12. API Ingestion & Structuration Dynamique de Documents par OpenAI (Support Multi-fichiers & ZIP)
 */
fastify.post('/api/stock/upload-dynamic', async (request, reply) => {
  const body = request.body as {
    fileName?: string;
    fileContent?: string;
    isBase64?: boolean;
    files?: Array<{ fileName: string; fileContent: string; isBase64?: boolean }>;
  };

  const payloadList: Array<{ fileName: string; fileContent: string; isBase64?: boolean }> = [];

  if (body.files && Array.isArray(body.files) && body.files.length > 0) {
    payloadList.push(...body.files);
  } else if (body.fileContent) {
    payloadList.push({
      fileName: body.fileName || 'document_commercial.txt',
      fileContent: body.fileContent,
      isBase64: body.isBase64
    });
  }

  if (payloadList.length === 0) {
    return reply.status(400).send({ success: false, error: 'Le contenu du ou des fichiers est vide.' });
  }

  try {
    console.log(`🤖 [OpenAI Parser] Structuration de ${payloadList.length} fichier(s) (avec décompression ZIP si présent)...`);
    const result = await parseMultipleDocumentsWithOpenAI(payloadList);

    let insertedCount = 0;
    const dbErrors: string[] = [];

    // Insertion individuelle dans PostgreSQL avec isolation des erreurs (Try/Catch par produit)
    for (const p of result.products) {
      try {
        await query(`
          INSERT INTO catalogue (ref, modele, famille, couleur, taille, prix_mad, stock, metadata)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (ref) DO UPDATE SET
            modele = EXCLUDED.modele,
            famille = EXCLUDED.famille,
            couleur = EXCLUDED.couleur,
            taille = EXCLUDED.taille,
            prix_mad = EXCLUDED.prix_mad,
            stock = EXCLUDED.stock,
            metadata = EXCLUDED.metadata;
        `, [
          p.ref,
          p.modele,
          p.famille,
          p.couleur,
          p.taille,
          p.prix_mad,
          p.stock,
          JSON.stringify(p.metadata)
        ]);
        insertedCount++;
      } catch (insertErr: any) {
        dbErrors.push(`Erreur d'insertion pour "${p.modele}" : ${insertErr.message}`);
      }
    }

    return {
      success: true,
      message: `${insertedCount} produit(s) extrait(s) et structuré(s) avec succès dans PostgreSQL à partir de ${result.rawStats.processedFiles.length} document(s) par OpenAI !`,
      stats: {
        totalExtracted: result.products.length,
        totalInserted: insertedCount,
        extraFieldsFound: result.rawStats.extraFieldsFound,
        processedFiles: result.rawStats.processedFiles
      },
      warnings: [...result.warnings, ...dbErrors],
      sample: result.products.slice(0, 5)
    };
  } catch (err: any) {
    fastify.log.error(err);
    return reply.status(500).send({ success: false, error: err.message });
  }
});

async function start() {
  try {
    // Initialisation automatique de la structure des tables PostgreSQL (0 seeder)
    await initDbSchema();

    await fastify.register(cors, { origin: true });
    await fastify.register(formbody, { bodyLimit: 100 * 1024 * 1024 });

    // Enregistrement du service de fichiers statiques pour le frontend React SPA
    const clientDistPath = path.resolve(__dirname, '../../client/dist');
    if (fs.existsSync(clientDistPath)) {
      await fastify.register(fastifyStatic, {
        root: clientDistPath,
        prefix: '/',
        wildcard: false
      });
      console.log(`📁 [Static] Frontend React disponible depuis ${clientDistPath}`);
    } else {
      console.log(`⚠️ [Static] Repertoire client/dist non trouvé. Exécutez 'npm run build'`);
    }

    // Gestion du fallback 404 pour SPA React Routing
    fastify.setNotFoundHandler((request, reply) => {
      if (request.raw.url?.startsWith('/api')) {
        reply.status(404).send({ error: 'Route API introuvable' });
      } else if (fs.existsSync(clientDistPath)) {
        reply.sendFile('index.html');
      } else {
        reply.status(404).send({ error: 'Page non trouvée' });
      }
    });

    const port = parseInt(process.env.PORT || '3000', 10);
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 Serveur API Kenza démarré avec succès sur http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
