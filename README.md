# 🛍️ Kenza — L'Agent Commercial WhatsApp Autonome & Plateforme SaaS Vendeurs

> **Kenza** est une plateforme SaaS e-commerce pour le marché marocain propulsée par un agent commercial IA conversationnel autonome sur **WhatsApp**. Reposant sur une architecture **LangGraph multi-agents**, une base **PostgreSQL** stricte, et le connecteur WhatsApp **Evolution API (Baileys)**, Kenza vend, conseille et relance en **Darija**, français et arabe, sans jamais halluciner ses prix, ses stocks ou ses conditions de vente.

---

## 📋 Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Architecture](#architecture)
- [Modules de la plateforme SaaS](#modules-de-la-plateforme-saas)
- [Stack technologique](#stack-technologique)
- [Structure du projet](#structure-du-projet)
- [Règles métier & Garde-fous](#règles-métier--garde-fous)
- [Installation et démarrage](#installation-et-démarrage)
  - [Option A : Lancement rapide via `start.sh` (Recommandé)](#option-a--lancement-rapide-via-startsh-recommandé)
  - [Option B : Démarrage manuel étape par étape](#option-b--démarrage-manuel-étape-par-étape)
- [Variables d'environnement](#variables-denvironnement)
- [Tests et Évaluation](#tests-et-évaluation)
- [Principes clés](#principes-clés)

---

## Vue d'ensemble

Kenza résout le principal goulot d'étranglement des commerçants marocains : la saturation du canal WhatsApp et la perte de ventes hors des horaires d'ouverture. Elle permet de :
- **Conseiller et vendre en Darija marocaine**, Français et Arabe avec détection automatique de la langue.
- **Vérifier les stocks en temps réel** et proposer des variantes alternatives disponibles en cas de rupture.
- **Calculer les frais de livraison officiels** selon la ville marocaine du client.
- **Respecter les conditions de paiement** (Paiement à la livraison - Cash on Delivery exclusif).
- **Négocier des remises** dans la limite stricte de 10% maximum autorisée.
- **Créer des commandes fermes** enregistrées directement dans PostgreSQL.
- **Relancer les paniers abandonnés** de manière asynchrone via Redis & BullMQ.
- **Escalader à l'humain** en cas de demande complexe (B2B, litige, annulation) avec interface de résolution commerçant permettant de répondre directement au client.
- **Ingérer n'importe quel catalogue** (CSV, JSON, archives ZIP) grâce à un parseur dynamique autonome guidé par LLM.

### Principe fondamental : Zéro-Hallucination

> **Le LLM n'invente JAMAIS un prix, une quantité ou une date.** Tous les prix, stocks et frais de port sont extraits par des outils stricts reliés à PostgreSQL. L'agent ne promet jamais de délais de réassort non enregistrés et ne valide aucune commande sans toutes les informations requises (modèle, taille, ville, adresse).

---

## Architecture

L'application est architecturée autour d'un **graphe d'agents LangGraph** orchestré par Fastify :

```text
                       ┌──────────────────────┐
   Message WhatsApp ──▶│  Fastify / Webhook   │ (Evolution API / Baileys)
                       └──────────┬───────────┘
                                  │
                       ┌──────────▼───────────┐
                       │  Agent Conversation  │ Mémoire d'échange & Darija
                       └──────────┬───────────┘
                                  │
         ┌────────────────────────┼────────────────────────┬─────────────────────┐
         │                        │                        │                     │
  ┌──────▼──────┐          ┌──────▼──────┐          ┌──────▼──────┐       ┌──────▼──────┐
  │  Catalogue  │          │ Calculateur │          │ Garde-Fou   │       │  Escalade   │
  │   & Stock   │          │ (Livraison  │          │ (Création   │       │   Humaine   │
  │ (SQL Strict)│          │  & Remise)  │          │  Commande)  │       │ (Dashboard) │
  └──────┬──────┘          └──────┬──────┘          └──────┬──────┘       └──────┬──────┘
         │                        │                        │                     │
         └────────────────────────┼────────────────────────┘                     │
                                  │                                              │
                       ┌──────────▼───────────┐                        ┌─────────▼─────────┐
                       │   PostgreSQL 16 DB   │◀───────────────────────│  Modale Résolution│
                       └──────────┬───────────┘                        │    Commerçant     │
                                  │                                    └───────────────────┘
                       ┌──────────▼───────────┐
                       │ Redis 7 + BullMQ     │
                       │ Surveillance Relance │
                       └──────────────────────┘
```

### Détail des nœuds et outils

| Agent / Outil | Rôle | Technologie |
|---|---|---|
| **Agent de Conversation** | Maintien du contexte client, ton chaleureux et naturel en Darija marocaine. | LLM (OpenAI gpt-4o-mini / Fallback / Gemini) |
| **Agent Catalogue** | `searchCatalogueTool` : Consultation stricte des références, tailles et stocks disponibles. | PostgreSQL + SQL Paramétré |
| **Agent Calculateur** | `checkShippingTool` & `calculateDiscountTool` : Application des frais de port et négociation plafonnée à 10%. | TypeScript pur |
| **Agent Garde-Fou** | `createOrderTool` : Contrôle d'intégrité avant insertion de commande en base de données. | TypeScript + PostgreSQL |
| **Agent Escalade** | `escalateToHumanTool` : Détection des demandes hors-scope et transmission du contexte au commerçant. | PostgreSQL (Table `escalades`) |
| **Worker Relance** | `abandonedCart.ts` : File d'attente asynchrone surveillant l'inactivité client avec relance personnalisée. | BullMQ + Redis + Table `relances_log` |

---

## Modules de la plateforme SaaS

L'interface web propose un espace vendeur complet :

1. **Tableau de bord Vendeur (`MerchantDashboard.tsx`)**
   - **KPIs temps réel :** Chiffre d'affaires total (MAD), volume de commandes, messages traités, produits en stock et escalades actives.
   - **Gestion des commandes en direct :** Suivi détaillé des commandes issues de PostgreSQL, modification des statuts (*En préparation*, *Livrée*, *Annulée*) et filtre entre commandes du jour en direct et tout l'historique.
   - **Centre de résolution des escalades :** Prise en main par le vendeur, saisie d'un message direct envoyé au client sur WhatsApp via l'API et clôture de l'incident.

2. **Mon Stock & Ingestion Fichiers (`CatalogueView.tsx`)**
   - Consultation et recherche d'articles avec vue des variantes (tailles, couleurs, quantités).
   - **Ingestion universelle IA (`aiDocParser.ts`) :** Téléversement de fichiers de stock (CSV, Excel, JSON) ou d'archives ZIP. Le modèle extrait, structure et insère automatiquement les articles en base de données avec leurs attributs enrichis (`metadata JSONB`).

3. **WhatsApp IA & Suivi des Relances (`WhatsAppConnectionView.tsx`)**
   - **Connexion WhatsApp par QR Code :** Appairage instantané de la session WhatsApp de la boutique.
   - **Configuration de l'agent :** Activation de la Darija, suggestion d'alternatives en cas de rupture.
   - **Surveillance des paniers abandonnés en direct :** Paramétrage du délai de relance, visualisation des comptes à rebours par client inactif, bouton de déclenchement test immédiat et journal des messages de relance envoyés.

---

## Stack technologique

### Frontend (SaaS Commerçant)
| Outil | Rôle |
|---|---|
| **React 18** | Interface utilisateur SPA réactive |
| **TypeScript / Vite** | Typage statique et compilation ultra-rapide |
| **TailwindCSS** | Design moderne, épuré et responsive |
| **Lucide React** | Pack d'icônes pour l'interface |

### Backend / Agents IA & Connecteurs
| Outil | Rôle |
|---|---|
| **Node.js 20 / Fastify** | Serveur API REST haute performance |
| **LangGraph / LangChain** | Orchestration du graphe d'agents et exécution des outils déterministes |
| **OpenAI API & Fallback** | Moteur LLM principal (gpt-4o-mini) avec bascule automatique de secours |
| **Google Gemini API** | Support multi-fournisseurs de modèles de secours |
| **Evolution API (Baileys)** | Connecteur WhatsApp autonome sans dépendance payante externe |

### Base de données & Asynchrone
| Outil | Rôle |
|---|---|
| **PostgreSQL 16** | Base de vérité relationnelle (Catalogue, Promotions, Commandes, Escalades, Logs) |
| **Redis 7 + BullMQ** | File d'attente asynchrone pour la planification et l'envoi des relances de paniers |

---

## Structure du projet

```text
kenza_app/
├── client/                                 # Frontend React (SaaS Vendeur)
│   ├── src/
│   │   ├── components/
│   │   │   ├── MerchantDashboard.tsx       # Dashboard KPIs, Commandes DB et Résolution Escalades
│   │   │   ├── CatalogueView.tsx           # Consultation du stock et Ingestion IA (CSV/ZIP)
│   │   │   ├── WhatsAppConnectionView.tsx  # Connexion WhatsApp QR Code & Tracking Relances
│   │   │   └── WhatsAppChat.tsx            # Simulateur de chat WhatsApp
│   │   └── App.tsx                         # Authentification Vendeur et Navigation SaaS
│   └── package.json
├── server/                                 # Backend API Fastify & Agents
│   ├── src/
│   │   ├── agents/
│   │   │   ├── kenzaAgent.ts               # Graphe LangGraph, logique multi-agents et prompt système
│   │   │   └── tools.ts                    # Outils déterministes PostgreSQL (search, order, shipping)
│   │   ├── db/
│   │   │   ├── connection.ts               # Pool de connexion PostgreSQL
│   │   │   ├── schema.sql                  # Définitions SQL de l'ensemble des tables
│   │   │   ├── schema.ts                   # Script d'initialisation du schéma DB
│   │   │   ├── ingest_sujet.ts             # Script d'ingestion des données officielles du sujet
│   │   │   └── test_evaluation.ts          # Suite de tests d'évaluation automatisée
│   │   ├── services/
│   │   │   └── aiDocParser.ts              # Parseur IA universel pour fichiers et archives ZIP
│   │   ├── workers/
│   │   │   └── abandonedCart.ts            # Worker BullMQ pour les relances WhatsApp
│   │   └── index.ts                        # Endpoints API, Webhooks Evolution API & routage
│   └── package.json
├── sujet-02-kenza/                         # Données sources du hackathon (catalogue, livraison, clients)
├── e2e/                                    # Tests de bout en bout (Playwright)
├── docker-compose.yml                      # Conteneurs PostgreSQL et Redis
├── start.sh                                # Script unifié de démarrage (Docker + ngrok + dev)
├── package.json                            # Scripts racine et workspaces npm
└── README.md
```

---

## Règles métier & Garde-fous

| Cas Client | Règle Métier | Comportement de Kenza |
|---|---|---|
| **Rupture de stock** | Zéro promesse de réassort inventée | Annonce la rupture avec bienveillance et propose des variantes disponibles extraites de la base. |
| **Demande de remise** | Plafond strict de **10% maximum** | Négocie jusqu'à 10%. Refuse fermement et escalade à l'humain si le client exige davantage. |
| **Mode de paiement** | Paiement à la livraison exclusif (COD) | Ne propose aucun moyen de paiement électronique et ne demande jamais de choix de paiement. |
| **Identité client** | Respect des données réelles | N'invente jamais de prénom, nom ou préfixe non renseigné par le client. |
| **Hors domaine & B2B** | Pas d'improvisation (factures, litiges) | Exécute l'escalade vers l'humain ; la conversation remonte immédiatement sur le Dashboard avec le contexte. |
| **Panier abandonné** | Inactivité détectée | Le worker planifie une relance subtile et personnalisée en Darija. |

---

## Installation et démarrage

### Prérequis
- **Docker Desktop** (pour PostgreSQL et Redis)
- **Node.js ≥ 20** et **npm**
- Clé API OpenAI (ou compatible)

---

### Option A : Lancement rapide via `start.sh` (Recommandé)

Le projet dispose d'un script unifié qui configure et lance toute l'application :

```bash
chmod +x start.sh
./start.sh
```

Ce script effectue automatiquement :
1. Le démarrage des conteneurs Docker (`PostgreSQL`, `Redis` et `Evolution API`).
2. Le patch automatique de compatibilité WhatsApp / Baileys multi-devices.
3. Le lancement du tunnel **ngrok** pour la réception des webhooks WhatsApp.
4. Le démarrage synchronisé du Backend et du Frontend.

---

### Option B : Démarrage manuel étape par étape

#### 1. Démarrer l'infrastructure Docker

```bash
docker compose up -d
```

#### 2. Installer les dépendances du projet

```bash
npm install
```

#### 3. Configurer les variables d'environnement

Copiez le fichier d'exemple et renseignez vos clés :

```bash
cp .env.example .env
```

#### 4. Initialiser la base de données et importer les données du sujet

```bash
# 1. Création des tables PostgreSQL
npm run db:init --workspace=server

# 2. Ingestion des données officielles (catalogue, clients, livraison, promotions)
npx tsx server/src/db/ingest_sujet.ts
```

#### 5. Démarrer le serveur et le dashboard

```bash
npm run dev
```

L'application sera accessible aux adresses suivantes :
- **Dashboard SaaS Commerçant :** [http://localhost:5173](http://localhost:5173)
- **API Backend Fastify :** [http://localhost:3005](http://localhost:3005)

---

## Variables d'environnement

Exemple de configuration dans le fichier `.env` :

```env
# Base de données PostgreSQL
DATABASE_URL=postgresql://kenza:kenzapassword@localhost:5432/kenzadb
POSTGRES_USER=kenza
POSTGRES_PASSWORD=kenzapassword
POSTGRES_DB=kenzadb

# Port du serveur API
PORT=3005

# Configuration LLM Principale
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini

# Configuration LLM Fallback (Secours Haute Disponibilité)
OPENAI_API_KEY_BACKUP=sk-...
OPENAI_BASE_URL_BACKUP=https://api.openai.com/v1
LLM_MODEL_BACKUP=gpt-4o-mini

# Configuration Alternative Google Gemini (Optionnel)
GEMINI_API_KEY=AIzaSy...

# Connecteur WhatsApp (Evolution API / Baileys)
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=votre_cle_evolution_api
EVOLUTION_INSTANCE_NAME=kenza-session
```

---

## Tests et Évaluation

### 1. Tests d'évaluation unitaire du cahier des charges

Pour tester directement l'intelligence de l'agent, ses outils et ses garde-fous sur le jeu de données officiel :

```bash
npx tsx server/src/db/test_evaluation.ts
```

Scénarios validés par la suite de tests :
- ✅ **Test 1 :** Recherche exacte de produit en base (*Foulard bordeaux* à 100 DH).
- ✅ **Test 2 :** Grille des frais de livraison par ville (*Casablanca 25 DH*, *Marrakech 45 DH*).
- ✅ **Test 3 :** Mémoire client et extraction de l'historique des commandes passées.
- ✅ **Test 4 :** Négociation et respect du plafond de remise de 10%.
- ✅ **Test 5 :** Déclenchement automatique de l'escalade vers l'humain pour demande B2B.

### 2. Tests End-to-End (Playwright)

```bash
npx playwright test
```

---

## Principes clés

### Multilinguisme & Maîtrise de la Darija
Kenza adapte son langage en temps réel. Elle s'exprime par défaut en **Darija marocaine fluide et naturelle** pour les échanges locaux, tout en étant capable de basculer instantanément en français ou en arabe selon le client.

### Zéro-Hallucination & Transparence Totale
Le modèle n'a pas accès à un dump textuel complet de la base dans son invite système. Il utilise impérativement les fonctions d'outils PostgreSQL pour interroger les stocks et les prix, garantissant une exactitude à 100%.

### Connectivité WhatsApp Réelle & Sans Dépendance Propriétaire
Grâce à **Evolution API** et la librairie **Baileys**, l'e-commerçant connecte sa boutique à WhatsApp en scannant simplement un QR Code depuis son smartphone, sans abonnement tiers ni contraintes de validation de modèle de messages.

---

*Projet réalisé pour le Hackathon Numeos 2026 — Kenza, l'agent commercial autonome qui vend vraiment.*