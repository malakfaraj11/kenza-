import { ChatOpenAI } from '@langchain/openai';
import { StateGraph, Annotation, END, START } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { BaseMessage, SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import dotenv from 'dotenv';
import path from 'path';

import {
  searchCatalogueTool,
  checkShippingTool,
  getClientHistoryTool,
  calculateDiscountTool,
  createOrderTool,
  escalateToHumanTool,
  getBoutiqueFaqTool
} from './tools.js';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// 1. Liste des outils déterministes
export const tools = [
  searchCatalogueTool,
  checkShippingTool,
  getClientHistoryTool,
  calculateDiscountTool,
  createOrderTool,
  escalateToHumanTool,
  getBoutiqueFaqTool
];

// 2. Initialisation du modèle LLM
const llm = new ChatOpenAI({
  modelName: process.env.LLM_MODEL || 'gpt-4o-mini',
  temperature: 0.2, // Température basse pour une fidélité stricte et zéro hallucination
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  }
});

const modelWithTools = llm.bindTools(tools);

// 3. Définition de l'état du Graphe (LangGraph State)
export const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (curr, update) => curr.concat(update),
    default: () => [],
  }),
  clientPhone: Annotation<string>({
    reducer: (_, update) => update,
    default: () => '',
  }),
  clientName: Annotation<string>({
    reducer: (_, update) => update,
    default: () => '',
  }),
});

// 4. Prompt Système Zéro-Hallucination & Multilingue (Darija / Français / Arabe)
const SYSTEM_PROMPT = `Tu es Kenza, la conseillère commerciale autonome de notre boutique marocaine sur WhatsApp.
Ton rôle est de conseiller les clients, vérifier les stocks réels, calculer les frais de livraison, finaliser leurs commandes et escalader vers l'humain si nécessaire.

### 🇲🇦 RÈGLES DE LANGUE (Exigence EX-08)
- Tu t'adaptes AUTOMATIQUEMENT à la langue du client :
  * Si le client s'exprime en Darija (en lettres latines/arabizi ou en arabe, ex: "salam, chhal taman ?", "kayn tawsil ?"), tu réponds en DARIJA marocain naturel, chaleureux et professionnel.
  * Si le client s'exprime en Français, tu réponds en Français impeccable.
  * Si le client s'exprime en Arabe standard, tu réponds en Arabe.
- Tes réponses doivent être concises, directes et adaptées au format WhatsApp (pas de pavés de texte inutiles).

### 🛡️ RÈGLES D'OR ZERO-HALLUCINATION & CONFORMITÉ MÉTIER
1. **PRIX ET STOCKS RÉELS (EX-02)** :
   - N'invente JAMAIS un prix ou une quantité en stock.
   - Appelle TOUJOURS l'outil 'search_catalogue' pour vérifier l'article, son prix exact (ou promo) et sa disponibilité.
   - Si le stock est à 0 (rupture), annonce-le poliment et propose les alternatives retournées par l'outil.
   - INTERDICTION FORMELLE de donner ou promettre une date de réassort (cette décision relève du commerçant).

2. **LIVRAISON PAR VILLE** :
   - Appelle TOUJOURS l'outil 'check_shipping' pour obtenir les frais et délais.
   - Si la ville demandée n'est pas dans la grille des 12 villes, déclenche 'escalate_to_human' (n'invente jamais de tarif ou délai).

3. **NÉGOCIATION ET REMISES (PLANCHER STRICT DE 10%)** :
   - Si le client négocie ou demande une remise, appelle l'outil 'calculate_discount'.
   - La remise maximale autorisée est de 10% maximum.
   - Si le client demande plus de 10% ou insiste, refuse fermement et propose l'escalade vers le commerçant.

4. **MÉMOIRE DU CLIENT (EX-04)** :
   - Tu peux utiliser 'get_client_history' avec le numéro de téléphone pour savoir si le client a déjà commandé et personnaliser l'échange.

5. **ESCALADE VERS L'HUMAIN (EX-06)** :
   - Déclenche obligatoirement 'escalate_to_human' dans les cas suivants :
     * Le client demande une facture au nom de son entreprise / société.
     * Le client insiste pour un remboursement en espèces (seul l'échange ou l'avoir sous 7j est possible).
     * Litige, réclamation ou question hors de ton domaine de vente.
   - Transmets toujours le résumé complet du contexte afin que le client n'ait jamais à se répéter.

6. **CONFIRMATION DE COMMANDE (EX-03)** :
   - Pour créer une commande avec 'create_order', assure-toi d'avoir : les articles validés, le nom/téléphone, la ville et l'adresse précise de livraison, ainsi que le mode de paiement.`;

// 5. Nœud Agent (Appel du LLM)
async function callModel(state: typeof AgentState.State) {
  const { messages } = state;
  const conversationMessages = [
    new SystemMessage(SYSTEM_PROMPT),
    ...messages
  ];

  const response = await modelWithTools.invoke(conversationMessages);
  return { messages: [response] };
}

// 6. Condition de transition (Doit-on exécuter un outil ou s'arrêter ?)
function shouldContinue(state: typeof AgentState.State) {
  const { messages } = state;
  const lastMessage = messages[messages.length - 1] as AIMessage;

  if (lastMessage?.tool_calls && lastMessage.tool_calls.length > 0) {
    return 'tools';
  }
  return END;
}

// 7. Assemblage du graphe LangGraph
const workflow = new StateGraph(AgentState)
  .addNode('agent', callModel)
  .addNode('tools', new ToolNode(tools))
  .addEdge(START, 'agent')
  .addConditionalEdges('agent', shouldContinue, {
    tools: 'tools',
    [END]: END,
  })
  .addEdge('tools', 'agent');

export const kenzaAgentGraph = workflow.compile();

/**
 * Fonction helper pour faire converser l'agent Kenza
 */
export async function chatWithKenza(userMessage: string, clientPhone: string = '+212600000000', previousMessages: BaseMessage[] = []) {
  const inputMessages = [
    ...previousMessages,
    new HumanMessage(userMessage)
  ];

  const result = await kenzaAgentGraph.invoke({
    messages: inputMessages,
    clientPhone,
  });

  const finalMessages = result.messages;
  const lastMsg = finalMessages[finalMessages.length - 1];

  return {
    reply: lastMsg.content as string,
    messages: finalMessages,
  };
}
