-- 1. Table Catalogue : Articles, prix fermes et stocks réels
CREATE TABLE IF NOT EXISTS catalogue (
  ref VARCHAR(50) PRIMARY KEY,
  modele VARCHAR(255) NOT NULL,
  famille VARCHAR(100),
  genre VARCHAR(50),
  couleur VARCHAR(50),
  taille VARCHAR(50),
  matiere VARCHAR(100),
  saison VARCHAR(100),
  prix_mad NUMERIC NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  delai_reassort_jours INT,
  code_barre VARCHAR(100),
  poids_g INT,
  metadata JSONB DEFAULT '{}'
);

-- 2. Table Promotions : Remises actives temporaires
CREATE TABLE IF NOT EXISTS promotions (
  id SERIAL PRIMARY KEY,
  ref VARCHAR(50) REFERENCES catalogue(ref) ON DELETE CASCADE,
  modele VARCHAR(255),
  prix_normal_mad NUMERIC NOT NULL,
  prix_promo_mad NUMERIC NOT NULL,
  debut DATE NOT NULL,
  fin DATE NOT NULL,
  condition VARCHAR(255)
);

-- 3. Table Clients : Répertoire des acheteurs
CREATE TABLE IF NOT EXISTS clients (
  client_id VARCHAR(50) PRIMARY KEY,
  nom VARCHAR(255) NOT NULL,
  telephone VARCHAR(50) NOT NULL UNIQUE,
  ville VARCHAR(100),
  langue_preferee VARCHAR(20) DEFAULT 'fr',
  premier_achat DATE,
  nb_commandes INT DEFAULT 0,
  segment VARCHAR(50) DEFAULT 'nouveau'
);

-- 4. Table Livraison : Grille officielle par ville au Maroc
CREATE TABLE IF NOT EXISTS livraison (
  ville VARCHAR(100) PRIMARY KEY,
  frais_mad NUMERIC NOT NULL,
  delai_heures INT NOT NULL,
  paiement_a_la_livraison BOOLEAN NOT NULL DEFAULT TRUE,
  retrait_boutique BOOLEAN NOT NULL DEFAULT FALSE
);

-- 5. Table Commandes : Enregistrement des commandes
CREATE TABLE IF NOT EXISTS commandes (
  id VARCHAR(50) PRIMARY KEY,
  client_id VARCHAR(50) REFERENCES clients(client_id),
  date_commande TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  canal VARCHAR(50) DEFAULT 'whatsapp',
  statut VARCHAR(50) DEFAULT 'en_attente',
  total_articles_mad NUMERIC NOT NULL,
  frais_livraison_mad NUMERIC DEFAULT 0,
  total_mad NUMERIC NOT NULL,
  ville_livraison VARCHAR(100),
  mode_paiement VARCHAR(50),
  adresse_livraison TEXT
);

-- 6. Table Lignes de Commande : Détail de chaque commande
CREATE TABLE IF NOT EXISTS commandes_lignes (
  id SERIAL PRIMARY KEY,
  commande_id VARCHAR(50) REFERENCES commandes(id) ON DELETE CASCADE,
  ref VARCHAR(50) REFERENCES catalogue(ref),
  modele VARCHAR(255),
  taille VARCHAR(50),
  quantite INT NOT NULL DEFAULT 1,
  prix_unitaire_mad NUMERIC NOT NULL
);

-- 7. Table Escalades : File d'attente pour le commerçant humain
CREATE TABLE IF NOT EXISTS escalades (
  id SERIAL PRIMARY KEY,
  conversation_id VARCHAR(100),
  client_id VARCHAR(50),
  telephone VARCHAR(50) NOT NULL,
  raison TEXT NOT NULL,
  contexte TEXT NOT NULL,
  statut VARCHAR(50) DEFAULT 'en_attente',
  cree_le TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Table Relances Log : Historique des relances automatiques envoyées aux clients inactifs
CREATE TABLE IF NOT EXISTS relances_log (
  id SERIAL PRIMARY KEY,
  telephone VARCHAR(100) NOT NULL,
  message_relance TEXT NOT NULL,
  canal VARCHAR(50) DEFAULT 'whatsapp',
  statut VARCHAR(50) DEFAULT 'envoyée',
  cree_le TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
