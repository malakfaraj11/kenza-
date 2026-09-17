# JEU DE DONNÉES · SUJET 02 : KENZA

Ce document récapitule l'ensemble des données fournies pour le hackathon (#NumeosHack26).  
Les fichiers se trouvent dans le dossier [`sujet-02-kenza/`](file:///Users/mac/Desktop/kenza-/sujet-02-kenza/).

---

## 📁 Inventaire des fichiers

| Fichier | Format | Description / Utilité |
| :--- | :--- | :--- |
| [`catalogue.csv`](file:///Users/mac/Desktop/kenza-/sujet-02-kenza/catalogue.csv) | CSV | 80 références d'articles (prix, stock, variantes, etc.). |
| [`clients.csv`](file:///Users/mac/Desktop/kenza-/sujet-02-kenza/clients.csv) | CSV | 120 clients (ville, langue préférée, segment, etc.). |
| [`commandes.csv`](file:///Users/mac/Desktop/kenza-/sujet-02-kenza/commandes.csv) | CSV | 320 commandes historiques. |
| [`commandes-lignes.csv`](file:///Users/mac/Desktop/kenza-/sujet-02-kenza/commandes-lignes.csv) | CSV | Détail des lignes d'articles des 320 commandes. |
| [`livraison.csv`](file:///Users/mac/Desktop/kenza-/sujet-02-kenza/livraison.csv) | CSV | Grille de livraison par ville (frais, délais, COD, retrait). |
| [`promotions.csv`](file:///Users/mac/Desktop/kenza-/sujet-02-kenza/promotions.csv) | CSV | 12 promotions datées (prix promo vs prix normal). |
| [`politique-commerciale.md`](file:///Users/mac/Desktop/kenza-/sujet-02-kenza/politique-commerciale.md) | Markdown | Règles métier strictes (garde-fous, remises, escalades). |
| [`faq-boutique.md`](file:///Users/mac/Desktop/kenza-/sujet-02-kenza/faq-boutique.md) | Markdown | FAQ (horaires, moyens de paiement, retraits, garanties). |
| [`conversations.jsonl`](file:///Users/mac/Desktop/kenza-/sujet-02-kenza/conversations.jsonl) | JSONL | 40 exemples de conversations (FR, AR, Darija, audio, images). |

---

## 1. 📦 Catalogue des Produits (`catalogue.csv`)
* **Nombre de références** : 80 articles.
* **Colonnes** : `ref`, `modele`, `famille`, `genre`, `couleur`, `taille`, `matiere`, `saison`, `prix_mad`, `stock`, `delai_reassort_jours`, `code_barre`, `poids_g`.
* **Règles clés** :
  - Prix fermes.
  - Si `stock == 0` : L'article est en **rupture**.
  - Interdiction de promettre une date sur `delai_reassort_jours`.

---

## 2. 👤 Clients (`clients.csv`)
* **Nombre de clients** : 120 clients enregistrés.
* **Colonnes** : `client_id`, `nom`, `telephone`, `ville`, `langue_preferee`, `premier_achat`, `nb_commandes`, `segment`.
* **Langues gérées** : `fr`, `ar`, `darija`.
* **Segments** : `nouveau`, `régulier`, `fidèle`.

---

## 3. 🚚 Grille de Livraison (`livraison.csv`)
* **Contenu intégral** :

| Ville | Frais (MAD) | Délai (Heures) | Paiement Livraison (COD) | Retrait en boutique |
| :--- | :---: | :---: | :---: | :---: |
| **Casablanca** | 25 | 72h | Oui | Oui |
| **Rabat** | 25 | 48h | Oui | Non |
| **Fès** | 35 | 24h | Non | Oui |
| **Marrakech** | 45 | 48h | Oui | Non |
| **Tanger** | 25 | 24h | Non | Non |
| **Agadir** | 35 | 24h | Oui | Non |
| **Meknès** | 45 | 24h | Oui | Non |
| **Oujda** | 45 | 48h | Oui | Non |
| **Kénitra** | 45 | 72h | Oui | Non |
| **Tétouan** | 30 | 72h | Oui | Non |
| **Salé** | 45 | 48h | Oui | Non |
| **Mohammedia** | 35 | 24h | Oui | Non |

* **Attention** : Toute ville absente de cette grille nécessite une **escalade** vers l'humain.

---

## 4. 🏷️ Promotions (`promotions.csv`)
* **12 promotions actives** du 2026-09-01 au 2026-09-30 (ex: Pantalon camel 300 MAD ➔ 240 MAD, Caftan bordeaux 1580 MAD ➔ 1260 MAD).
* **Règle** : Les prix en promotion sont prioritaires durant la période de validité.

---

## 5. 📜 Politique Commerciale (`politique-commerciale.md`)
* **Remises** : Remise max autorisée par l'agent sans validation = **10%**. En-dessous, **escalade obligatoire** (ne pas céder même si le client insiste).
* **Stock épuisé** : Proposer un produit similaire en stock, ne jamais donner de date de réassort.
* **Retours & Échanges** : Sous **7 jours**, article non porté avec étiquette. Pas de remboursement espèces direct par l'agent (escalade).
* **Escalades obligatoires** : Facture au nom de société, litige, demande hors catalogue, ville non livrée, remise > 10%.

---

## 6. ❓ FAQ Boutique (`faq-boutique.md`)
* **Horaires** : Lundi au samedi, 10h à 20h.
* **Moyens de paiement** : Paiement à la livraison (selon ville), virement bancaire, lien de paiement par carte.
* **Retrait boutique** : Fès et Casablanca uniquement (sous 24h).
* **Garantie** : 30 jours pour défauts de fabrication avec ticket.
* **Livraison internationale** : Non, Maroc uniquement.

---

## 7. 💬 Conversations d'Exemples (`conversations.jsonl`)
* **40 conversations annotées** couvrant 17 intentions (ex: `prix_et_disponibilite`, `rupture_de_stock`, `darija_prix`, `negociation_remise`, etc.).
* Utile pour la mémoire long terme, les tests et le fine-tuning / prompt engineering en Darija.
