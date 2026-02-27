/**
 * commandes.model.js
 * -------------------
 * Requêtes SQL pour l'historique et le détail des commandes.
 *
 * Architecture MVC — couche "Model" :
 *   Ce fichier ne contient QUE des requêtes SQL.
 *
 * Tables concernées :
 *   - commande        : les commandes passées par les particuliers
 *   - commande_ligne  : les lignes de produit d'une commande
 *   - produit         : le libellé et l'unité des produits
 *   - offre           : le titre de l'offre d'origine
 *   - agriculteur     : le nom de l'exploitation
 *
 * Fonctions exportées :
 *   - getCommandesByUser(userId) → historique des commandes d'un particulier
 *   - getCommandeById(id, userId) → détail d'une commande avec ses lignes
 */

const pool = require("../config/db");

/**
 * getCommandesByUser
 * -------------------
 * Récupère toutes les commandes d'un utilisateur, triées par date décroissante.
 * Inclut le nombre d'articles par commande (COUNT des lignes).
 *
 * @param {number} userId - L'id_user du particulier connecté
 * @returns {Array}       - Tableau de commandes avec nb_articles
 */
async function getCommandesByUser(userId) {
  const [rows] = await pool.query(
    `
    SELECT
      c.id_commande,
      c.statut,
      c.total,
      c.created_at,
      c.updated_at,
      COUNT(cl.id_commande_ligne) AS nb_articles
    FROM commande c
    LEFT JOIN commande_ligne cl ON cl.id_commande = c.id_commande
    WHERE c.id_user = ?
    GROUP BY c.id_commande, c.statut, c.total, c.created_at, c.updated_at
    ORDER BY c.created_at DESC
  `,
    [userId],
  );

  return rows;
}

/**
 * getCommandeById
 * ----------------
 * Récupère le détail complet d'une commande : informations générales
 * et toutes les lignes de produit avec le nom du produit, l'offre
 * et l'exploitation d'origine.
 *
 * Utilise 2 requêtes séparées (même pattern que demandes.model.js) :
 *   1. La commande principale (avec vérification du propriétaire)
 *   2. Les lignes de commande avec les jointures
 *
 * @param {number} idCommande - L'identifiant de la commande
 * @param {number} userId     - L'id_user du particulier (vérification propriétaire)
 * @returns {object|null}     - L'objet commande complet ou null si introuvable
 */
async function getCommandeById(idCommande, userId) {
  // Requête 1 : la commande principale (avec vérification du propriétaire)
  const [rows] = await pool.query(
    `
    SELECT c.*
    FROM commande c
    WHERE c.id_commande = ? AND c.id_user = ?
  `,
    [idCommande, userId],
  );

  // Commande introuvable ou n'appartient pas à cet utilisateur
  if (rows.length === 0) return null;

  const commande = rows[0];

  // Requête 2 : les lignes de commande avec les détails produit/offre/exploitation
  const [lignes] = await pool.query(
    `
    SELECT
      cl.quantite,
      cl.prix_unitaire,
      p.libelle,
      p.unite,
      o.titre AS offre_titre,
      a.nom_exploitation
    FROM commande_ligne cl
    JOIN produit p ON p.id_produit = cl.id_produit
    JOIN offre o ON o.id_offre = cl.id_offre
    JOIN agriculteur a ON a.id_user = o.id_user_agri
    WHERE cl.id_commande = ?
  `,
    [idCommande],
  );

  // On attache les lignes à l'objet commande
  commande.lignes = lignes;

  return commande;
}

/**
 * getCommandesByAgriculteur
 * --------------------------
 * Récupère toutes les commandes contenant au moins un produit
 * d'une offre appartenant à cet agriculteur.
 * Inclut le prénom/nom du particulier et le nombre d'articles.
 *
 * @param {number} agriUserId - L'id_user de l'agriculteur connecté
 * @returns {Array}
 */
async function getCommandesByAgriculteur(agriUserId) {
  const [rows] = await pool.query(
    `
    SELECT
      c.id_commande,
      c.statut,
      c.total,
      c.created_at,
      c.updated_at,
      u.prenom AS client_prenom,
      u.nom    AS client_nom,
      COUNT(DISTINCT cl.id_commande_ligne) AS nb_articles
    FROM commande c
    JOIN commande_ligne cl ON cl.id_commande = c.id_commande
    JOIN offre o           ON o.id_offre = cl.id_offre
    JOIN utilisateur u     ON u.id_user  = c.id_user
    WHERE o.id_user_agri = ?
    GROUP BY c.id_commande, c.statut, c.total, c.created_at, c.updated_at,
             u.prenom, u.nom
    ORDER BY c.created_at DESC
  `,
    [agriUserId],
  );

  return rows;
}

/**
 * getCommandeByIdForAgri
 * -----------------------
 * Récupère le détail d'une commande pour un agriculteur.
 * Retourne uniquement les lignes qui correspondent à ses offres.
 * Vérifie que la commande concerne bien cet agriculteur.
 *
 * @param {number} idCommande  - L'identifiant de la commande
 * @param {number} agriUserId  - L'id_user de l'agriculteur
 * @returns {object|null}
 */
async function getCommandeByIdForAgri(idCommande, agriUserId) {
  // Requête 1 : commande principale + infos client
  const [rows] = await pool.query(
    `
    SELECT
      c.id_commande,
      c.statut,
      c.total,
      c.created_at,
      c.updated_at,
      u.prenom AS client_prenom,
      u.nom    AS client_nom,
      u.email  AS client_email,
      u.telephone AS client_telephone
    FROM commande c
    JOIN utilisateur u ON u.id_user = c.id_user
    WHERE c.id_commande = ?
      AND EXISTS (
        SELECT 1 FROM commande_ligne cl
        JOIN offre o ON o.id_offre = cl.id_offre
        WHERE cl.id_commande = c.id_commande AND o.id_user_agri = ?
      )
  `,
    [idCommande, agriUserId],
  );

  if (rows.length === 0) return null;

  const commande = rows[0];

  // Requête 2 : uniquement les lignes de cet agriculteur
  const [lignes] = await pool.query(
    `
    SELECT
      cl.id_commande_ligne,
      cl.quantite,
      cl.prix_unitaire,
      p.libelle,
      p.unite,
      o.id_offre,
      o.titre AS offre_titre,
      ol.quantite_disponible AS stock_actuel
    FROM commande_ligne cl
    JOIN produit p     ON p.id_produit = cl.id_produit
    JOIN offre o       ON o.id_offre   = cl.id_offre
    LEFT JOIN offre_ligne ol ON ol.id_offre = cl.id_offre AND ol.id_produit = cl.id_produit
    WHERE cl.id_commande = ? AND o.id_user_agri = ?
  `,
    [idCommande, agriUserId],
  );

  commande.lignes = lignes;

  return commande;
}

/**
 * confirmerCommandeAgri
 * ----------------------
 * Confirme une commande en attente :
 *   1. Met à jour le statut → CONFIRMEE
 *   2. Soustrait les quantités commandées des stocks offre_ligne
 *   3. Supprime les lignes de stock à 0 (ou négatif)
 *   4. Si une offre n'a plus aucune ligne de stock, la passe en TERMINEE
 *
 * Utilise une transaction pour garantir la cohérence.
 *
 * @param {number} idCommande  - L'identifiant de la commande à confirmer
 * @param {number} agriUserId  - L'id_user de l'agriculteur (vérification)
 * @returns {boolean}          - true si confirmé, false si non autorisé
 */
async function confirmerCommandeAgri(idCommande, agriUserId) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // Vérifier que la commande est EN_ATTENTE et concerne cet agriculteur
    const [check] = await conn.query(
      `
      SELECT c.id_commande FROM commande c
      WHERE c.id_commande = ? AND c.statut = 'EN_ATTENTE'
        AND EXISTS (
          SELECT 1 FROM commande_ligne cl
          JOIN offre o ON o.id_offre = cl.id_offre
          WHERE cl.id_commande = c.id_commande AND o.id_user_agri = ?
        )
    `,
      [idCommande, agriUserId],
    );

    if (check.length === 0) {
      await conn.rollback();
      return false;
    }

    // Récupérer les lignes de cet agriculteur dans cette commande
    const [lignes] = await conn.query(
      `
      SELECT cl.id_offre, cl.id_produit, cl.quantite
      FROM commande_ligne cl
      JOIN offre o ON o.id_offre = cl.id_offre
      WHERE cl.id_commande = ? AND o.id_user_agri = ?
    `,
      [idCommande, agriUserId],
    );

    // Collecter les offres affectées pour vérification finale
    const offresAffectees = new Set();

    for (const ligne of lignes) {
      offresAffectees.add(ligne.id_offre);

      // Soustraire la quantité commandée du stock disponible
      await conn.query(
        `
        UPDATE offre_ligne
        SET quantite_disponible = quantite_disponible - ?
        WHERE id_offre = ? AND id_produit = ?
      `,
        [ligne.quantite, ligne.id_offre, ligne.id_produit],
      );

      // Supprimer les lignes dont le stock est devenu nul ou négatif
      await conn.query(
        `
        DELETE FROM offre_ligne
        WHERE id_offre = ? AND id_produit = ? AND quantite_disponible <= 0
      `,
        [ligne.id_offre, ligne.id_produit],
      );
    }

    // Si une offre n'a plus aucun produit en stock → TERMINEE
    for (const idOffre of offresAffectees) {
      const [remaining] = await conn.query(
        "SELECT COUNT(*) AS nb FROM offre_ligne WHERE id_offre = ?",
        [idOffre],
      );
      if (Number(remaining[0].nb) === 0) {
        await conn.query(
          `UPDATE offre SET statut = 'TERMINEE', updated_at = NOW()
           WHERE id_offre = ? AND id_user_agri = ?`,
          [idOffre, agriUserId],
        );
      }
    }

    // Mettre à jour le statut de la commande
    await conn.query(
      `UPDATE commande SET statut = 'CONFIRMEE', updated_at = NOW()
       WHERE id_commande = ?`,
      [idCommande],
    );

    await conn.commit();
    return true;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * annulerCommandeAgri
 * --------------------
 * Annule une commande EN_ATTENTE depuis l'espace agriculteur.
 * Ne modifie pas les stocks (la commande n'avait pas encore été confirmée).
 *
 * @param {number} idCommande  - L'identifiant de la commande
 * @param {number} agriUserId  - L'id_user de l'agriculteur
 * @returns {boolean}          - true si annulé, false si non autorisé
 */
async function annulerCommandeAgri(idCommande, agriUserId) {
  const [, result] = await pool.query(
    `
    UPDATE commande SET statut = 'ANNULEE', updated_at = NOW()
    WHERE id_commande = ? AND statut = 'EN_ATTENTE'
      AND EXISTS (
        SELECT 1 FROM commande_ligne cl
        JOIN offre o ON o.id_offre = cl.id_offre
        WHERE cl.id_commande = commande.id_commande AND o.id_user_agri = ?
      )
  `,
    [idCommande, agriUserId],
  );

  return result.rowCount > 0;
}

module.exports = {
  getCommandesByUser,
  getCommandeById,
  getCommandesByAgriculteur,
  getCommandeByIdForAgri,
  confirmerCommandeAgri,
  annulerCommandeAgri,
};
