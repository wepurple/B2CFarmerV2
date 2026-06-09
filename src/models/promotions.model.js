/**
 * promotions.model.js
 * --------------------
 * Requêtes SQL liées aux promotions des offres agricoles.
 */

const pool = require("../config/db");

/**
 * Crée une promotion en base.
 * Cette fonction ne vérifie pas le propriétaire : cette vérification est faite
 * avant l'appel, dans le contrôleur, via isOffreOwnedByAgriculteur().
 */
async function createPromotion({
  type_promotion,
  libelle,
  valeur,
  code_promo,
  quantite_min,
  montant_min,
  date_debut,
  date_fin,
  active,
  id_offre,
  id_produit,
}) {
  // INSERT paramétré : les valeurs utilisateur sont passées dans le tableau
  // pour éviter toute concaténation SQL directe.
  const [rows] = await pool.query(
    `INSERT INTO promotion (
       type_promotion,
       libelle,
       valeur,
       code_promo,
       quantite_min,
       montant_min,
       date_debut,
       date_fin,
       active,
       id_offre,
       id_produit
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING id_promotion`,
    [
      type_promotion,
      libelle,
      valeur,
      code_promo || null,
      quantite_min,
      montant_min,
      date_debut || null,
      date_fin || null,
      active,
      id_offre,
      id_produit || null,
    ],
  );

  // PostgreSQL retourne l'id généré grâce à RETURNING id_promotion.
  return rows[0].id_promotion;
}

/**
 * Récupère toutes les promotions liées à une offre.
 * Le LEFT JOIN permet d'afficher le libellé du produit si la promotion cible
 * un produit précis, tout en gardant les promotions qui concernent toute l'offre.
 */
async function getPromotionsByOffre(idOffre) {
  const [rows] = await pool.query(
    `
    SELECT
      pr.id_promotion,
      pr.type_promotion,
      pr.libelle,
      pr.valeur,
      pr.code_promo,
      pr.quantite_min,
      pr.montant_min,
      pr.date_debut,
      pr.date_fin,
      pr.active,
      pr.id_offre,
      pr.id_produit,
      pr.created_at,
      p.libelle AS produit_libelle
    FROM promotion pr
    LEFT JOIN produit p ON p.id_produit = pr.id_produit
    WHERE pr.id_offre = ?
    ORDER BY pr.created_at DESC, pr.id_promotion DESC
  `,
    [idOffre],
  );

  return rows;
}

/**
 * Récupère une promotion par son identifiant.
 * Utilisé pour pré-remplir le formulaire de modification et retrouver l'offre
 * concernée après une suppression.
 */
async function getPromotionById(idPromotion) {
  const [rows] = await pool.query(
    `
    SELECT
      pr.id_promotion,
      pr.type_promotion,
      pr.libelle,
      pr.valeur,
      pr.code_promo,
      pr.quantite_min,
      pr.montant_min,
      pr.date_debut,
      pr.date_fin,
      pr.active,
      pr.id_offre,
      pr.id_produit,
      pr.created_at,
      p.libelle AS produit_libelle
    FROM promotion pr
    LEFT JOIN produit p ON p.id_produit = pr.id_produit
    WHERE pr.id_promotion = ?
  `,
    [idPromotion],
  );

  // Si aucune promotion n'existe avec cet id, on retourne null.
  return rows[0] || null;
}

/**
 * Modifie les champs principaux d'une promotion existante.
 * L'ownership est vérifié dans le contrôleur avant l'appel à cette fonction.
 */
async function updatePromotion(
  idPromotion,
  {
    type_promotion,
    libelle,
    valeur,
    code_promo,
    quantite_min,
    montant_min,
    date_debut,
    date_fin,
    active,
    id_produit,
  },
) {
  // rowCount permettra de savoir si une ligne a réellement été modifiée.
  const [, result] = await pool.query(
    `UPDATE promotion SET
       type_promotion = ?,
       libelle        = ?,
       valeur         = ?,
       code_promo     = ?,
       quantite_min   = ?,
       montant_min    = ?,
       date_debut     = ?,
       date_fin       = ?,
       active         = ?,
       id_produit     = ?
     WHERE id_promotion = ?`,
    [
      type_promotion,
      libelle,
      valeur,
      code_promo || null,
      quantite_min,
      montant_min,
      date_debut || null,
      date_fin || null,
      active,
      id_produit || null,
      idPromotion,
    ],
  );

  return result.rowCount;
}

/**
 * Supprime définitivement une promotion.
 * Contrairement aux offres, il n'y a pas de soft-delete demandé pour les promotions.
 */
async function deletePromotion(idPromotion) {
  const [, result] = await pool.query(
    "DELETE FROM promotion WHERE id_promotion = ?",
    [idPromotion],
  );

  return result.rowCount;
}

/**
 * Vérifie qu'une offre appartient bien à l'agriculteur connecté.
 * C'est la sécurité serveur qui empêche un agriculteur de créer une promotion
 * sur l'offre d'un autre agriculteur.
 */
async function isOffreOwnedByAgriculteur(idOffre, userId) {
  const [rows] = await pool.query(
    `SELECT 1
     FROM offre
     WHERE id_offre = ? AND id_user_agri = ? AND deleted_at IS NULL
     LIMIT 1`,
    [idOffre, userId],
  );

  return rows.length > 0;
}

/**
 * Vérifie qu'une promotion appartient à une offre de l'agriculteur connecté.
 * On passe par la table offre, car la table promotion ne contient pas directement
 * l'id de l'agriculteur.
 */
async function isPromotionOwnedByAgriculteur(idPromotion, userId) {
  const [rows] = await pool.query(
    `
    SELECT 1
    FROM promotion pr
    JOIN offre o ON o.id_offre = pr.id_offre
    WHERE pr.id_promotion = ?
      AND o.id_user_agri = ?
      AND o.deleted_at IS NULL
    LIMIT 1
  `,
    [idPromotion, userId],
  );

  return rows.length > 0;
}

// Export des fonctions utilisées par le contrôleur promotions.
module.exports = {
  createPromotion,
  getPromotionsByOffre,
  getPromotionById,
  updatePromotion,
  deletePromotion,
  isOffreOwnedByAgriculteur,
  isPromotionOwnedByAgriculteur,
};
