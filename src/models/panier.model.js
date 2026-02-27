/**
 * panier.model.js
 * ----------------
 * Fonctions utilitaires pour le système de panier et de commandes.
 *
 * Le panier lui-même est stocké en session (pas en base de données).
 * Ce fichier gère :
 *   - La validation des produits d'une offre (pour vérifier avant ajout au panier)
 *   - La création d'une commande en base de données lors du checkout
 *
 * Tables concernées :
 *   - offre_ligne  : pour valider qu'un produit est bien disponible dans une offre
 *   - commande     : pour créer la commande
 *   - commande_ligne : pour créer les lignes de commande
 *
 * Fonctions exportées :
 *   - getOffreLigneDetail(idOffre, idProduit) → détail d'un produit dans une offre
 *   - createCommande(userId, panierItems)      → crée une commande complète (transaction)
 */

const pool = require("../config/db");


/**
 * getOffreLigneDetail
 * -------------------
 * Récupère le détail complet d'un produit dans une offre active.
 * Utilisé pour valider l'ajout au panier (vérifier que le produit
 * existe bien, que l'offre est active et non supprimée).
 *
 * @param {number} idOffre   - L'identifiant de l'offre
 * @param {number} idProduit - L'identifiant du produit
 * @returns {object|null}    - Le détail du produit ou null si introuvable
 */
async function getOffreLigneDetail(idOffre, idProduit) {
  const [rows] = await pool.query(`
    SELECT
      ol.id_offre,
      ol.id_produit,
      ol.prix,
      ol.quantite_disponible,
      p.libelle,
      p.unite,
      a.nom_exploitation,
      o.titre AS offre_titre
    FROM offre_ligne ol
    JOIN produit p ON p.id_produit = ol.id_produit
    JOIN offre o ON o.id_offre = ol.id_offre
    JOIN agriculteur a ON a.id_user = o.id_user_agri
    WHERE ol.id_offre = ? AND ol.id_produit = ?
      AND o.statut = 'ACTIVE' AND o.deleted_at IS NULL
  `, [idOffre, idProduit]);

  return rows.length > 0 ? rows[0] : null;
}


/**
 * createCommande
 * ---------------
 * Crée une commande complète en base de données à partir du panier.
 * Utilise une transaction PostgreSQL pour garantir la cohérence :
 * soit tout est inséré, soit rien ne l'est.
 *
 * Étapes :
 *   1. Calcul du total à partir des articles du panier
 *   2. Insertion de la commande (table commande)
 *   3. Insertion de chaque ligne de commande (table commande_ligne)
 *   4. Commit si tout est OK, rollback en cas d'erreur
 *
 * @param {number} userId       - L'id_user du particulier qui commande
 * @param {Array}  panierItems  - Les articles du panier
 * @returns {number}            - L'id_commande de la commande créée
 */
async function createCommande(userId, panierItems) {
  // On récupère une connexion dédiée pour la transaction
  const conn = await pool.getConnection();

  try {
    // Début de la transaction
    await conn.beginTransaction();

    // Calcul du total de la commande
    const total = panierItems.reduce(
      (sum, item) => sum + (Number(item.prix) * Number(item.quantite)),
      0
    );

    // Insertion de la commande principale
    const [rows] = await conn.query(
      `INSERT INTO commande (id_user, total) VALUES (?, ?) RETURNING id_commande`,
      [userId, total]
    );
    const idCommande = rows[0].id_commande;

    // Insertion de chaque ligne de commande
    for (const item of panierItems) {
      await conn.query(
        `INSERT INTO commande_ligne (id_commande, id_offre, id_produit, quantite, prix_unitaire)
         VALUES (?, ?, ?, ?, ?)`,
        [idCommande, item.id_offre, item.id_produit, item.quantite, item.prix]
      );
    }

    // Tout s'est bien passé → on valide la transaction
    await conn.commit();
    return idCommande;

  } catch (err) {
    // En cas d'erreur → on annule tout
    await conn.rollback();
    throw err;
  } finally {
    // On libère la connexion dans le pool (indispensable !)
    conn.release();
  }
}


module.exports = {
  getOffreLigneDetail,
  createCommande,
};
