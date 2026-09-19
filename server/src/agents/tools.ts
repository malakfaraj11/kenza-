import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { query } from '../db/connection.js';

/**
 * 1. Outil de recherche Catalogue & Stock (Zero-Hallucination)
 * Interroge directement PostgreSQL :
 * - Applique les promotions en cours si valides
 * - Détecte les ruptures (stock = 0)
 * - Propose des alternatives disponibles si rupture
 * - Interdit de promettre une date de réassort
 */
export const searchCatalogueTool = new DynamicStructuredTool({
  name: 'search_catalogue',
  description: 'Recherche des articles dans le catalogue par nom/modèle, catégorie, couleur, taille ou attributs metadata. Retourne le prix exact (avec promotion active si applicable), le stock disponible et les variantes.',
  schema: z.object({
    motsCles: z.string().describe('Mots clés de recherche (ex: chemise, caftan, veste beige, pantalon camel, M, L, foulard, bordeaux)'),
  }),
  func: async ({ motsCles }) => {
    try {
      // Normalisation des synonymes Darija et pluriels courants vers les catégories du catalogue
      const normalized = motsCles
        .replace(/\brobes?\b/gi, 'robe')
        .replace(/\bvestes?\b/gi, 'veste')
        .replace(/\bchemises?\b/gi, 'chemise')
        .replace(/\bpantalons?\b/gi, 'pantalon')
        .replace(/\b9mis(at|a)?\b/gi, 'chemise')
        .replace(/\b9miss(at|a)?\b/gi, 'chemise')
        .replace(/\bserwal\b/gi, 'pantalon')
        .replace(/\bksswa\b/gi, 'robe')
        .replace(/\bsebbat\b/gi, 'chaussures')
        .replace(/\bzif\b/gi, 'foulard')
        .replace(/\bjaka\b/gi, 'veste')
        .replace(/\bsmta\b/gi, 'ceinture')
        .replace(/\bsak\b/gi, 'sac');

      const stopWords = new Set(['ou', 'wla', 'w', 'chi', 'dyal', 'l', 'la', 'le', 'les', 'des', 'de', 'un', 'une', 'pour', 'taman', 'prix', 'chhal', 'fin', 'wach', '3ndkom', '3ndkoum', 'bghit']);
      let terms = normalized.trim().toLowerCase().split(/[\s,+/]+/)
        .filter(t => t.length > 1 && !stopWords.has(t))
        .map(t => (t.endsWith('s') && t.length > 3 && !['gris'].includes(t)) ? t.slice(0, -1) : t);
      
      if (terms.length === 0) {
        terms = motsCles.trim().toLowerCase().split(/\s+/).filter(Boolean);
      }

      const buildQuery = (operator: 'AND' | 'OR') => {
        let whereClauses: string[] = [];
        let params: any[] = [];
        let paramIdx = 1;

        for (const term of terms) {
          whereClauses.push(`(
            LOWER(c.modele) LIKE $${paramIdx} OR 
            LOWER(c.famille) LIKE $${paramIdx} OR 
            LOWER(c.couleur) LIKE $${paramIdx} OR 
            LOWER(c.taille) LIKE $${paramIdx} OR 
            LOWER(c.matiere) LIKE $${paramIdx} OR
            LOWER(c.metadata::text) LIKE $${paramIdx}
          )`);
          params.push(`%${term}%`);
          paramIdx++;
        }

        const sql = `
          SELECT c.*, 
                 p.prix_promo_mad, p.debut AS promo_debut, p.fin AS promo_fin
          FROM catalogue c
          LEFT JOIN promotions p ON c.ref = p.ref AND CURRENT_DATE BETWEEN p.debut AND p.fin
          WHERE ${whereClauses.length > 0 ? whereClauses.join(` ${operator} `) : 'TRUE'}
          LIMIT 10;
        `;
        return { sql, params };
      };

      // Essai 1: Recherche stricte (AND)
      let { sql, params } = buildQuery('AND');
      let res = await query(sql, params);

      // Essai 2: Si aucun résultat, recherche souple (OR)
      if (res.rows.length === 0 && terms.length > 1) {
        const flexible = buildQuery('OR');
        res = await query(flexible.sql, flexible.params);
      }

      if (res.rows.length === 0) {
        return JSON.stringify({
          trouve: false,
          message: `Aucun produit correspondant à "${motsCles}" trouvé dans le catalogue.`
        });
      }

      const articles = [];
      for (const r of res.rows) {
        const enPromo = r.prix_promo_mad != null;
        const prixFinal = enPromo ? parseFloat(r.prix_promo_mad) : parseFloat(r.prix_mad);
        const estEnRupture = r.stock <= 0;

        let alternativesDisponibles: any[] = [];
        if (estEnRupture) {
          const altRes = await query(`
            SELECT ref, modele, couleur, taille, prix_mad, stock
            FROM catalogue
            WHERE famille = $1 AND stock > 0
            LIMIT 2;
          `, [r.famille]);
          alternativesDisponibles = altRes.rows.map(a => ({
            ref: a.ref,
            modele: a.modele,
            couleur: a.couleur,
            taille: a.taille,
            prix_mad: parseFloat(a.prix_mad),
            stock: a.stock
          }));
        }

        articles.push({
          ref: r.ref,
          modele: r.modele,
          famille: r.famille,
          couleur: r.couleur,
          taille: r.taille,
          matiere: r.matiere,
          prix_catalogue_mad: parseFloat(r.prix_mad),
          prix_actuel_mad: prixFinal,
          en_promotion: enPromo,
          stock: r.stock,
          en_rupture: estEnRupture,
          message_stock: estEnRupture 
            ? "Produit épuisé. Date de réassort non garantie."
            : `En stock (${r.stock} unité(s) disponible(s))`,
          alternatives_proposees: alternativesDisponibles
        });
      }

      return JSON.stringify({ trouve: true, total: articles.length, articles });
    } catch (err: any) {
      return JSON.stringify({ erreur: true, message: err.message });
    }
  }
});

/**
 * 2. Outil de vérification de Livraison par Ville
 */
export const checkShippingTool = new DynamicStructuredTool({
  name: 'check_shipping',
  description: 'Consulte les frais de livraison (MAD), le délai (heures) et les modes de paiement (paiement à la livraison, retrait boutique) pour une ville au Maroc.',
  schema: z.object({
    ville: z.string().describe('Nom de la ville marocaine (ex: Casablanca, Rabat, Fès, Tanger, Marrakech, Agadir)'),
  }),
  func: async ({ ville }) => {
    try {
      let v = ville.trim().toLowerCase()
        .replace(/\bcasa\b/g, 'casablanca')
        .replace(/\bkesh\b|\bkech\b/g, 'marrakech')
        .replace(/\bfez\b/g, 'fès')
        .replace(/\btangier\b/g, 'tanger');

      let res = await query(
        `SELECT * FROM livraison WHERE LOWER(ville) = LOWER($1) OR LOWER(ville) LIKE LOWER($2);`,
        [v, `%${v}%`]
      );

      // Si pas trouvé dans la table livraison, chercher dans catalogue (si importé dynamiquement)
      if (res.rows.length === 0) {
        const catLivr = await query(
          `SELECT * FROM catalogue WHERE LOWER(modele) LIKE $1 OR LOWER(metadata->>'ville') = LOWER($2);`,
          [`%livraison ${v}%`, v]
        );

        if (catLivr.rows.length > 0) {
          const item = catLivr.rows[0];
          const meta = item.metadata || {};
          return JSON.stringify({
            desservie: true,
            ville: meta.ville || item.modele.replace(/^livraison /i, ''),
            frais_mad: item.prix_mad,
            delai_heures: meta.delai_heures || 48,
            delai_texte: `${meta.delai_heures || 48} heures`,
            paiement_a_la_livraison_disponible: meta.paiement_a_la_livraison === 'oui' || meta.paiement_a_la_livraison === true,
            retrait_boutique_disponible: meta.retrait_boutique === 'oui' || meta.retrait_boutique === true
          });
        }

        return JSON.stringify({
          desservie: false,
          escalade_requise: true,
          message: `La ville "${ville}" n'est pas répertoriée dans la grille de livraison standard. Une escalade au commerçant est nécessaire.`
        });
      }

      const r = res.rows[0];
      return JSON.stringify({
        desservie: true,
        ville: r.ville,
        frais_mad: parseFloat(r.frais_mad),
        delai_heures: r.delai_heures,
        delai_texte: `${r.delai_heures} heures`,
        paiement_a_la_livraison_disponible: r.paiement_a_la_livraison,
        retrait_boutique_disponible: r.retrait_boutique
      });
    } catch (err: any) {
      return JSON.stringify({ erreur: true, message: err.message });
    }
  }
});

/**
 * 3. Outil de Mémoire Client (Historique des commandes)
 */
export const getClientHistoryTool = new DynamicStructuredTool({
  name: 'get_client_history',
  description: 'Retrouve les informations d\'un client et l\'historique de ses commandes grâce à son numéro de téléphone WhatsApp.',
  schema: z.object({
    telephone: z.string().describe('Numéro de téléphone (+212...)'),
  }),
  func: async ({ telephone }) => {
    try {
      let rawPhone = telephone.trim().replace(/\s+/g, '');
      if (rawPhone.startsWith('06')) rawPhone = '+2126' + rawPhone.slice(2);
      if (rawPhone.startsWith('07')) rawPhone = '+2127' + rawPhone.slice(2);

      const clientRes = await query(
        `SELECT * FROM clients WHERE telephone = $1 OR telephone = $2 LIMIT 1;`,
        [rawPhone, telephone.trim()]
      );

      if (clientRes.rows.length === 0) {
        return JSON.stringify({
          client_connu: false,
          message: "Nouveau client sans historique précédent."
        });
      }

      const client = clientRes.rows[0];

      const cmdRes = await query(`
        SELECT c.id, c.date_commande, c.statut, c.total_mad, c.ville_livraison,
               json_agg(json_build_object('modele', cl.modele, 'taille', cl.taille, 'quantite', cl.quantite, 'prix', cl.prix_unitaire_mad)) AS articles
        FROM commandes c
        LEFT JOIN commandes_lignes cl ON c.id = cl.commande_id
        WHERE c.client_id = $1
        GROUP BY c.id
        ORDER BY c.date_commande DESC
        LIMIT 3;
      `, [client.client_id]);

      return JSON.stringify({
        client_connu: true,
        client_id: client.client_id,
        nom: client.nom,
        ville: client.ville,
        langue_preferee: client.langue_preferee,
        segment: client.segment,
        nb_commandes_total: client.nb_commandes,
        dernieres_commandes: cmdRes.rows
      });
    } catch (err: any) {
      return JSON.stringify({ erreur: true, message: err.message });
    }
  }
});

/**
 * 4. Outil de Contrôle de Remise & Garde-fou (Max 10%)
 */
export const calculateDiscountTool = new DynamicStructuredTool({
  name: 'calculate_discount',
  description: 'Vérifie si une demande de remise formulée par un client est autorisée (plafond strict de 10% maximum selon la politique commerciale).',
  schema: z.object({
    pourcentageDemande: z.number().describe('Pourcentage de remise demandé (ex: 5 pour 5%, 15 pour 15%)'),
    montantInitial: z.number().describe('Montant total avant remise en MAD')
  }),
  func: async ({ pourcentageDemande, montantInitial }) => {
    const PLAFOND_REMISE = 10;

    if (pourcentageDemande <= 0) {
      return JSON.stringify({
        remise_autorisee: false,
        message: "Pourcentage de remise invalide."
      });
    }

    if (pourcentageDemande > PLAFOND_REMISE) {
      return JSON.stringify({
        remise_autorisee: false,
        escalade_requise: true,
        plancher_depasse: true,
        remise_maximale_possible: PLAFOND_REMISE,
        message: `La remise de ${pourcentageDemande}% dépasse le plafond commercial autorisé de ${PLAFOND_REMISE}%. Escalade obligatoire au commerçant.`
      });
    }

    const montantRemise = (montantInitial * pourcentageDemande) / 100;
    const nouveauTotal = montantInitial - montantRemise;

    return JSON.stringify({
      remise_autorisee: true,
      pourcentage_applique: pourcentageDemande,
      economie_mad: montantRemise,
      nouveau_total_mad: nouveauTotal,
      message: `Remise de ${pourcentageDemande}% appliquée. Nouveau total: ${nouveauTotal} MAD.`
    });
  }
});

/**
 * 5. Outil de Création de Commande en Base de Données
 */
export const createOrderTool = new DynamicStructuredTool({
  name: 'create_order',
  description: 'Valide et enregistre définitivement une commande en base de données avec décrémentation des stocks.',
  schema: z.object({
    telephone: z.string().describe('Téléphone WhatsApp du client (+212...)'),
    villeLivraison: z.string().describe('Ville de livraison'),
    adresseLivraison: z.string().describe('Adresse postale complète'),
    modePaiement: z.string().describe('Mode de paiement choisi (ex: à la livraison, virement, retrait boutique)'),
    articles: z.array(z.object({
      ref: z.string().describe('Référence produit (ex: REF-0001)'),
      quantite: z.number().int().describe('Quantité souhaitée')
    })).describe('Articles commandés')
  }),
  func: async ({ telephone, villeLivraison, adresseLivraison, modePaiement, articles }) => {
    try {
      let clientRes = await query(`SELECT client_id, nom FROM clients WHERE telephone = $1 LIMIT 1;`, [telephone]);
      let clientId = clientRes.rows[0]?.client_id;
      if (!clientId) {
        clientId = `CLI-${Date.now().toString().slice(-4)}`;
        await query(
          `INSERT INTO clients (client_id, nom, telephone, ville, nb_commandes) VALUES ($1, $2, $3, $4, 1);`,
          [clientId, 'Client WhatsApp', telephone, villeLivraison]
        );
      } else {
        await query(`UPDATE clients SET nb_commandes = nb_commandes + 1 WHERE client_id = $1;`, [clientId]);
      }

      const shipRes = await query(`SELECT frais_mad FROM livraison WHERE LOWER(ville) = LOWER($1);`, [villeLivraison]);
      const fraisLivraison = shipRes.rows.length > 0 ? parseFloat(shipRes.rows[0].frais_mad) : 35;

      let totalArticles = 0;
      const lignesValidees = [];

      for (const item of articles) {
        const prodRes = await query(`
          SELECT c.ref, c.modele, c.taille, c.prix_mad, c.stock, p.prix_promo_mad
          FROM catalogue c
          LEFT JOIN promotions p ON c.ref = p.ref AND CURRENT_DATE BETWEEN p.debut AND p.fin
          WHERE c.ref = $1;
        `, [item.ref]);

        if (prodRes.rows.length === 0) {
          return JSON.stringify({ succes: false, message: `L'article ${item.ref} n'existe pas dans le catalogue.` });
        }

        const p = prodRes.rows[0];
        if (p.stock < item.quantite) {
          return JSON.stringify({ succes: false, message: `Stock insuffisant pour ${p.modele} (${item.ref}). Reste: ${p.stock}` });
        }

        const prixUnitaire = p.prix_promo_mad ? parseFloat(p.prix_promo_mad) : parseFloat(p.prix_mad);
        totalArticles += prixUnitaire * item.quantite;

        lignesValidees.push({
          ref: p.ref,
          modele: p.modele,
          taille: p.taille,
          quantite: item.quantite,
          prixUnitaire
        });
      }

      const totalMad = totalArticles + fraisLivraison;
      const commandeId = `CMD-${Math.floor(10000 + Math.random() * 90000)}`;

      await query(`
        INSERT INTO commandes (id, client_id, statut, total_articles_mad, frais_livraison_mad, total_mad, ville_livraison, mode_paiement, adresse_livraison)
        VALUES ($1, $2, 'en préparation', $3, $4, $5, $6, $7, $8);
      `, [commandeId, clientId, totalArticles, fraisLivraison, totalMad, villeLivraison, modePaiement, adresseLivraison]);

      for (const line of lignesValidees) {
        await query(`
          INSERT INTO commandes_lignes (commande_id, ref, modele, taille, quantite, prix_unitaire_mad)
          VALUES ($1, $2, $3, $4, $5, $6);
        `, [commandeId, line.ref, line.modele, line.taille, line.quantite, line.prixUnitaire]);

        await query(`UPDATE catalogue SET stock = stock - $1 WHERE ref = $2;`, [line.quantite, line.ref]);
      }

      return JSON.stringify({
        succes: true,
        commande_id: commandeId,
        total_articles_mad: totalArticles,
        frais_livraison_mad: fraisLivraison,
        total_mad: totalMad,
        message: `Commande ${commandeId} enregistrée avec succès ! Total à payer : ${totalMad} MAD.`
      });
    } catch (err: any) {
      return JSON.stringify({ succes: false, erreur: err.message });
    }
  }
});

/**
 * 6. Outil d'Escalade vers l'Humain
 */
export const escalateToHumanTool = new DynamicStructuredTool({
  name: 'escalate_to_human',
  description: 'Transfère la conversation au commerçant humain avec la raison et le résumé complet du contexte.',
  schema: z.object({
    conversationId: z.string().describe('ID de la conversation (ex: CONV-1234)'),
    telephone: z.string().describe('Téléphone du client'),
    raison: z.string().describe('Motif de l\'escalade (ex: ville hors grille, remise > 10%, réclamation)'),
    contexte: z.string().describe('Résumé complet des échanges précédents')
  }),
  func: async ({ conversationId, telephone, raison, contexte }) => {
    try {
      const res = await query(`
        INSERT INTO escalades (conversation_id, telephone, raison, contexte)
        VALUES ($1, $2, $3, $4)
        RETURNING id;
      `, [conversationId, telephone, raison, contexte]);

      return JSON.stringify({
        escalade_enregistree: true,
        ticket_id: res.rows[0].id,
        message: "Demande transférée avec succès au commerçant humain."
      });
    } catch (err: any) {
      return JSON.stringify({ erreur: true, message: err.message });
    }
  }
});

/**
 * 7. Outil FAQ Boutique
 */
export const getBoutiqueFaqTool = new DynamicStructuredTool({
  name: 'get_boutique_faq',
  description: 'Fournit les réponses officielles aux questions fréquentes (horaires, moyens de paiement, retrait en boutique, garanties, livraison internationale).',
  schema: z.object({
    sujet: z.enum(['horaires', 'paiement', 'retrait_boutique', 'garantie', 'international']).describe('Thème de la question')
  }),
  func: async ({ sujet }) => {
    const faq = {
      horaires: "La boutique est ouverte du lundi au samedi, de 10h à 20h. Les messages reçus la nuit sont traités dès le lendemain matin.",
      paiement: "Le seul et unique moyen de paiement accepté est le paiement à la livraison (en espèces lors de la réception du colis). Aucun paiement en ligne ni virement n'est proposé.",
      retrait_boutique: "Le retrait en boutique sous 24h est possible uniquement dans nos boutiques de Casablanca et de Fès.",
      garantie: "Les défauts de fabrication sont garantis et pris en charge sous 30 jours sur présentation du ticket ou confirmation de commande.",
      international: "Nous ne livrons pas à l'international. Les livraisons se font exclusivement au Maroc dans les villes desservies."
    };

    return JSON.stringify({
      sujet,
      reponse: faq[sujet]
    });
  }
});
