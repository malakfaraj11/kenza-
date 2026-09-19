# 🛍️ Kenza — L'Agent Commercial WhatsApp Autonome

> **Kenza** est un agent commercial IA conversationnel conçu pour les e-commerçants marocains. Elle repose sur une architecture **LangGraph multi-agents** avec une base de données PostgreSQL, capable de vendre, conseiller et relancer sur WhatsApp en **Darija**, sans jamais halluciner ses prix ou ses stocks.

---

## 📋 Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Architecture](#architecture)
- [Stack technologique](#stack-technologique)
- [Structure du projet](#structure-du-projet)
- [Règles métier](#règles-métier)
- [Installation et démarrage](#installation-et-démarrage)
- [Variables d'environnement](#variables-denvironnement)
- [Tests E2E](#tests-e2e)
- [Principes clés](#principes-clés)

---

## Vue d'ensemble

Kenza est une assistante commerciale autonome qui permet à un e-commerçant de gérer automatiquement le flux massif de messages clients sur WhatsApp. Elle permet de :
- **Qualifier le besoin** et conseiller des produits du catalogue en Darija, Français et Arabe.
- **Vérifier les stocks** en temps réel et proposer des alternatives en cas de rupture.
- **Calculer les frais de livraison** en fonction de la ville.
- **Négocier des remises** dans la limite d'un plancher strict autorisé.
- **Créer des commandes** directement en base de données sans ressaisie humaine.
- **Relancer automatiquement** les paniers abandonnés.
- **Escalader à l'humain** en cas de litige ou de demande complexe (facture entreprise, remboursement).

### Principe fondamental : Zéro-Hallucination

> **Le LLM n'invente JAMAIS un prix ou une quantité.** Les prix, les stocks et les frais de port sont extraits par des appels d'outils stricts reliés à la base de données PostgreSQL. L'agent ne promet jamais de délais de réassort inventés.

---

## Architecture

L'application est construite autour d'un **graphe d'agents LangGraph** où chaque agent a une responsabilité stricte :

```text
                      ┌─────────────┐
  Message WhatsApp ──▶│   Routing   │ Routage initial (Langue & Contexte)
                      └──────┬──────┘
                             │
                      ┌──────▼──────┐
                      │Conversation │ Mémoire stateful & multilingue (Darija)
                      └──────┬──────┘
                             │
              ┌──────────────┼──────────────┬──────────────┐
              │              │              │              │
       ┌──────▼──────┐ ┌─────▼─────┐ ┌──────▼──────┐ ┌─────▼─────┐
       │ Extractor / │ │ Calculator│ │ Validator / │ │ Escalade  │
       │  Catalogue  │ │ (Livraison│ │ Garde-Fou   │ │ (Humain)  │
       │   & Stock   │ │  & Remise)│ │             │ │           │
       └──────┬──────┘ └─────┬─────┘ └──────┬──────┘ └─────┬─────┘
              │              │              │              │
              └──────────────┼──────────────┘              │
                             │                             │
                      ┌──────▼──────┐               ┌──────▼──────┐
                      │ Commande DB │               │  Dashboard  │
                      └──────┬──────┘               │ Commerçant  │
                             │                      └─────────────┘
                      ┌──────▼──────┐
                      │   Relance   │ (Asynchrone via BullMQ / Redis)
                      └─────────────┘
```

### Détail des nœuds et outils

| Agent / Outil | Rôle | Technologie |
|---------------|------|-------------|
| **Agent de Conversation** | Maintien du contexte, traduction à la volée (Darija, AR, FR), ton chaleureux. | LLM OpenAI / Graphe State |
| **Agent Catalogue** | `searchCatalogueTool` : Vérification déterministe des produits et stocks. | SQL (PostgreSQL) + LangChain Tools |
| **Agent Calculator** | `checkShippingTool` & `calculateDiscountTool` : Application des frais de port et remises. | TypeScript pur |
| **Agent Garde-Fou** | `createOrderTool` : Vérifie l'intégrité de la commande avant l'insertion en DB. | TypeScript + Validation |
| **Agent d'Escalade** | `escalateToHumanTool` : Détection du hors-domaine et transfert de contexte. | LLM (Classification) + Base |
| **Agent de Relance** | Planifie et exécute un message de réengagement de manière autonome. | BullMQ + Redis + Agent IA |

---

## Stack technologique

### Frontend (Tableau de bord & Simulateur)
| Outil | Rôle |
|-------|------|
| **React 18** | Interface utilisateur (SPA) |
| **TypeScript / Vite** | Typage statique et build rapide |
| **Lucide React** | Icônes du dashboard |

### Backend / Agents IA
### Backend / Agents IA & Evolution API (WhatsApp)
| Outil | Rôle |
|-------|------|
| **Node.js 20 / Fastify** | Serveur API très haute performance avec ingestion ZIP / Multi-fichiers |
| **LangGraph / LangChain** | Orchestration du graphe d'agents et outils stricts |
| **OpenAI API** | Moteur LLM (avec fallback / backup automatique) et parser dynamique |
| **Evolution API (Baileys)**| Connecteur WhatsApp autonome via QR Code (Mode Baileys / Node.js) |

### Base de données & Asynchrone
| Outil | Rôle |
|-------|------|
| **PostgreSQL 16** | Base de vérité (Catalogue, Commandes) et `checkpointer` LangGraph |
| **Redis 7 + BullMQ** | File d'attente pour la gestion des relances asynchrones (Paniers abandonnés) |

---

## Structure du projet

```text
kenza_app/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── MerchantDashboard.tsx       # Dashboard commerçant avec Modale de Résolution
│   │   │   ├── WhatsAppConnectionView.tsx  # Connexion WhatsApp autonome via QR Code
│   │   │   └── WhatsAppChat.tsx            # Simulateur web WhatsApp
│   │   └── App.tsx
│   └── package.json
├── server/
│   ├── src/
│   │   ├── agents/
│   │   │   ├── kenzaAgent.ts               # Graphe LangGraph et Prompt système
│   │   │   └── tools.ts                    # Outils DB (search, create, calculate, history)
│   │   ├── db/
│   │   │   ├── connection.ts               # Connexion PostgreSQL
│   │   │   ├── schema.ts                   # Schémas de DB
│   │   │   ├── ingest_sujet.ts             # Script d'ingestion dynamique (sujet-02-kenza)
│   │   │   └── test_evaluation.ts          # Suite de tests d'évaluation 5/5
│   │   ├── services/
│   │   │   └── aiDocParser.ts              # Parser dynamique OpenAI & Extracteur ZIP
│   │   ├── workers/
│   │   │   └── abandonedCart.ts            # Worker BullMQ pour les relances avec support JIDs WhatsApp
│   │   └── index.ts                        # Serveur Fastify, Webhooks Evolution API & API Dashboard
│   └── package.json
├── e2e/
│   └── *.spec.ts                           # Suite de tests Playwright
├── docker-compose.yml                      # PostgreSQL + Redis + Evolution API
└── start.sh                                # Script unifié de démarrage
```

---

## Règles métier

### Conditions de Vente & Négociation

| Cas Client | Règle Métier | Comportement de l'Agent |
|------------|--------------|-------------------------|
| **Rupture de stock** | Ne jamais promettre un réassort | Annonce poliment la rupture et propose des variantes disponibles extraites de la base. |
| **Demande de remise** | Plafond strict de **10% maximum** | Négocie jusqu'à 10%. Refuse fermement et transfère à l'humain si le client insiste pour plus. |
| **Changement d'avis** | Panier modifiable à la volée | Met à jour le panier en mémoire sans obliger le client à tout répéter. |
| **Hors domaine** | Pas d'improvisation (B2B, litige) | Exécute l'escalade vers l'humain, la discussion remonte sur le Dashboard. |
| **Panier abandonné** | Inactivité détectée (> 1 minute) | Le Worker BullMQ génère un message de relance subtil et non-intrusif en Darija. |

---

## Installation et démarrage

### Prérequis
- Docker Desktop (pour PostgreSQL et Redis)
- Node.js ≥ 20
- Clé API OpenAI
- *(Optionnel)* Compte Twilio pour l'intégration WhatsApp

### 1. Démarrer l'infrastructure

```bash
docker compose up -d
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Variables d'environnement

Créer un fichier `.env` à la racine (basé sur `.env.example`) :

```env
DATABASE_URL=postgresql://kenza:kenzapassword@localhost:5432/kenzadb
PORT=3005
OPENAI_API_KEY=sk-...
# Configuration Twilio optionnelle pour le branchement WhatsApp réel
```

### 4. Peupler la base de données

```bash
npm run seed
```

### 5. Démarrer l'application (Serveur + Simulateur)

```bash
npm run dev
# Le simulateur et le Dashboard seront sur http://localhost:5173
```

---

## Tests E2E (Playwright)

L'application inclut une suite de tests automatisés pour prouver la robustesse des garde-fous.

```bash
npx playwright test
```

| Scénario Testé | Résultat attendu par le Cahier des Charges |
|----------------|--------------------------------------------|
| **Guardrails B2B** | L'agent escalade vers l'humain lors d'une demande de facture entreprise. |
| **Catalogue DB** | L'agent affiche bien les produits réels issus de PostgreSQL. |
| **Dashboard Metrics** | Les statistiques (CA, conversion) se calculent dynamiquement. |
| **Stateful Memory** | La conversation garde le contexte (nom, produits) sur 7 messages continus. |
| **Multilinguisme** | L'agent répond correctement et intelligiblement en Darija. |

---

## Principes clés

### Multilinguisme Natif (Darija / Arabe / Français)
Kenza détecte automatiquement la langue du client. L'exigence de répondre en **Darija marocain** (et non en arabe littéraire classique) est intégrée directement dans les instructions système du graphe, garantissant des échanges naturels.

### Zéro-Hallucination & Transparence
Le LLM n'a **aucun accès aux chiffres bruts de l'inventaire complet** pour éviter qu'il ne réponde "Il reste 22 unités". Il traduit les données des outils SQL en langage commercial ("Oui, il est disponible en M").

### Omnicanal (Web & WhatsApp)
Le projet peut être utilisé via le simulateur React intégré, ou branché sur les webhooks Twilio pour une intégration 100% réelle sur smartphone en quelques secondes via **ngrok**.

---

*Projet réalisé pour le Hackathon Numeos 2026 — Kenza, l'agent commercial qui vend vraiment.*