import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { StateGraph, Annotation, END, START } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { BaseMessage, SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// 2. Initialisation des modèles LLM (OpenAI + Gemini)
const primaryKey = process.env.OPENAI_API_KEY;
const backupKey = process.env.OPENAI_API_KEY_BACKUP;
const geminiKey = process.env.GEMINI_API_KEY;

// GPT-4.1 / GPT-5.5 (Rédacteur Commercial - Azure OpenAI)
const writerLLM = new ChatOpenAI({
  modelName: process.env.LLM_MODEL || 'gpt-4o-mini',
  temperature: 1, // Exigé par ce modèle spécifique sur Azure
  apiKey: primaryKey,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  }
});

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

// 4. Prompts Spécialisés pour chaque Agent
const ROUTER_PROMPT = `Tu es l'Extracteur/Routeur Commercial.
Ton rôle est d'analyser la conversation du client en Darija/Français/Arabe et d'appeler le bon outil :
1. Recherche produits / catalogue : search_catalogue (pour vérifier les prix, stocks, tailles et couleurs).
2. Vérification livraison : check_shipping (pour obtenir frais et délais selon la ville).
3. VALIDATION DE COMMANDE (CRITIQUE) : Dès que le client souhaite commander et a fourni sa ville et son adresse (ou confirme une commande), tu DOIS appeler create_order avec la ref du produit, quantité, villeLivraison, adresseLivraison, telephone et modePaiement="à la livraison".
4. Escalade au commerçant : Si une réclamation grave, une ville non desservie, ou remise hors barème se présente : escalate_to_human.
5. Questions fréquentes : get_boutique_faq.
Si aucun outil n'est nécessaire (ex: le client dit juste "salam"), réponds simplement "CONTINUE".
N'écris jamais de réponse commerciale finale au client.`;

const WRITER_PROMPT = `Tu es Kenza, la conseillère commerciale d'une boutique marocaine de mode et accessoires haut de gamme. (Modèle: Azure OpenAI).

⚠️ DIRECTIVE DE LANGUE CRITIQUE & ABSOLUE :
- Tu dois TOUJOURS répondre en Darija marocaine écrite EXCLUSIVEMENT en LETTRES LATINES (Arabizi / Franco-Arabe).
- Exemples de Darija acceptée : "Salam labas 3lik!", "3ndna caftan beige b 1580 DH f taille L", "Chnou loun li bghiti?", "Merhba bik f boutique Kenza!".
- IL EST FORMELLEMENT ET TOTALEMENT INTERDIT D'ÉCRIRE EN LETTRES OU ALPHABET ARABE (أ, ب, ت, ث, ج, ح, خ, د, ...). ZÉRO CARACTÈRE ARABE AUTORISÉ !
- Si le client parle en Darija (lettres arabes ou latines), TU RÉPONDS STRICTEMENT EN ARABIZI (LETTRES LATINES + chiffres marocains 3, 7, 9).
- Si le client parle en français, tu réponds en français.

RÈGLES COMMERCIALES & ZÉRO-HALLUCINATION :
- Base-toi TOUJOURS sur les résultats des outils pour donner les vrais prix (en DH / MAD), vrais stocks et vraies tailles.
- Si un produit est disponible, donne son prix et propose les tailles disponibles.
- Si un produit est en rupture, dis-le poliment et propose les alternatives disponibles renvoyées par l'outil.
- N'invente jamais un article qui n'existe pas dans le catalogue.
- Sois chaleureuse, naturelle, concise et vendeuse.

⚠️ RÈGLE STRICTE SUR LE PAIEMENT (NE JAMAIS POSER DE QUESTION SUR LE PAIEMENT) :
- Le SEUL et UNIQUE moyen de paiement de la boutique est le PAIEMENT À LA LIVRAISON (Khlass 3nd l'istilam / Cash on delivery).
- Il n'y a STRICTEMENT AUCUNE AUTRE possibilité (pas de carte, pas de virement, etc.).
- Tu ne dois JAMAIS poser la question au client : ne lui demande JAMAIS comment il veut payer, ni s'il veut payer à la livraison !
- Le paiement à la livraison est automatique, évident et implicite pour toutes les commandes.
- Si tu résumes ou confirmes une commande, indique simplement de manière informative que le paiement se fera en espèces à la livraison ("khlass f l'istilam"), mais ne demande jamais son choix.`;

const VALIDATOR_PROMPT = `Tu es le Validateur Strict Anti-Hallucination & Contrôleur Qualité (Google Gemini).

TES RÈGLES DE VALIDATION STRICTES :
1. ANTI-HALLUCINATION : Vérifie que le message de Kenza ne contient aucun prix ni stock inventé par rapport aux données des outils.
2. CONTRÔLE DE L'ALPHABET (CRITIQUE) : AUCUN CARACTÈRE EN ALPHABET ARABE N'EST ACCEPTÉ. La réponse doit être 100% en lettres latines (Arabizi pour la Darija, avec chiffres 3, 7, 9). Si le message contient des lettres arabes, tu DOIS le transcrire intégralement en lettres latines (Arabizi).
3. INTERDICTION DE DEMANDER LE MODE DE PAIEMENT : Kenza ne doit JAMAIS demander au client comment il veut payer ni s'il souhaite payer à la livraison. Le paiement est obligatoirement et uniquement à la livraison.
4. SORTIE ÉPURÉE : Renvoie UNIQUEMENT la réponse validée prête pour WhatsApp. Aucun préfixe, aucun commentaire.`;

// 5. Les Nœuds du Graphe Multi-Agent

let geminiQuotaExhausted = false;

async function routerNode(state: typeof AgentState.State) {
  console.log("➡️ [Agent] Entrée dans routerNode...");
  const { messages } = state;
  const conversationMessages = [new SystemMessage(ROUTER_PROMPT), ...messages];

  if (!geminiQuotaExhausted && geminiKey && geminiKey.trim() !== '') {
    try {
      const routerLLM = new ChatGoogleGenerativeAI({
        model: 'gemini-3.6-flash',
        temperature: 0,
        apiKey: geminiKey,
      }).bindTools(tools);
      const response = await routerLLM.invoke(conversationMessages);
      return { messages: [response] };
    } catch (err: any) {
      console.warn("⚠️ [Gemini Quota Exceeded] Passage automatique sur OpenAI pour la suite de la session.");
      geminiQuotaExhausted = true;
    }
  }

  const fallbackRouter = writerLLM.bindTools(tools);
  const response = await fallbackRouter.invoke(conversationMessages);
  return { messages: [response] };
}

async function writerNode(state: typeof AgentState.State) {
  console.log("➡️ [Agent] Entrée dans writerNode (OpenAI)...");
  const { messages } = state;
  const conversationMessages = [new SystemMessage(WRITER_PROMPT), ...messages];
  const responseText = await writerLLM.invoke(conversationMessages);
  return { messages: [responseText] };
}

async function validatorNode(state: typeof AgentState.State) {
  console.log("➡️ [Agent] Entrée dans validatorNode...");
  const { messages } = state;
  const conversationMessages = [
    new SystemMessage(VALIDATOR_PROMPT),
    ...messages,
    new HumanMessage("Valide ce message. Rappel strict: EXCLUSIVEMENT en lettres latines (Arabizi avec 3, 7, 9 pour la Darija), ZÉRO caractère en alphabet arabe.")
  ];

  if (geminiKey && geminiKey.trim() !== '') {
    try {
      const validatorLLM = new ChatGoogleGenerativeAI({
        model: 'gemini-3.6-flash',
        temperature: 0,
        apiKey: geminiKey,
      });
      const responseText = await validatorLLM.invoke(conversationMessages);
      return { messages: [responseText] };
    } catch (e: any) {
      console.warn("⚠️ [Gemini API RateLimit] Validation pass-through.");
      return {};
    }
  }
  return {};
}

// 6. Logique de Routage Conditionnel
function shouldContinueFromRouter(state: typeof AgentState.State) {
  console.log("➡️ [Agent] Évaluation de shouldContinueFromRouter...");
  const { messages } = state;
  const lastMessage = messages[messages.length - 1] as AIMessage;

  if (lastMessage?.tool_calls && lastMessage.tool_calls.length > 0) {
    console.log("🔀 [Route] -> tools");
    return 'tools'; // Si Gemini Flash a détecté le besoin d'un outil
  }
  console.log("🔀 [Route] -> writer");
  return 'writer'; // Sinon, on passe directement à la rédaction
}

// 7. Assemblage final de l'Architecture Multi-LLM
const workflow = new StateGraph(AgentState)
  .addNode('router', routerNode)
  .addNode('tools', new ToolNode(tools))
  .addNode('writer', writerNode)
  .addNode('validator', validatorNode)
  
  // Le flux: START -> Routeur (Gemini Flash) -> Outils (Optionnel) -> Rédacteur (GPT-4) -> Validateur (Gemini Pro) -> END
  .addEdge(START, 'router')
  .addConditionalEdges('router', shouldContinueFromRouter, {
    tools: 'tools',
    writer: 'writer',
  })
  .addEdge('tools', 'writer')
  .addEdge('writer', 'validator')
  .addEdge('validator', END);

export const kenzaAgentGraph = workflow.compile();

export function stringifyMessageContent(content: any): string {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          if ('text' in item && typeof item.text === 'string') return item.text;
          if ('content' in item && typeof item.content === 'string') return item.content;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n')
      .trim();
  }
  if (content && typeof content === 'object') {
    if ('text' in content && typeof content.text === 'string') return content.text;
    if ('content' in content && typeof content.content === 'string') return content.content;
  }
  return String(content || '');
}

/**
 * Fonction d'entrée pour discuter avec l'écosystème Kenza
 */
export async function chatWithKenza(userMessage: string, clientPhone: string = '+212600000000', previousMessages: BaseMessage[] = []) {
  console.log(`\n💬 [Chat] Nouveau message de ${clientPhone} : "${userMessage}"`);
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
    reply: stringifyMessageContent(lastMsg?.content),
    messages: finalMessages,
  };
}
