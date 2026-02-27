/**
 * demandes.model.js
 * ------------------
 * Ce fichier gère toutes les interactions avec la base de données
 * concernant les demandes de produits (table "demande" et "reponse_demande").
 *
 * Architecture MVC — couche "Model" :
 *   Ce fichier ne contient QUE des requêtes SQL.
 *   Il ne sait pas comment afficher les données (rôle des vues EJS).
 *   Il ne contient pas de logique métier complexe (rôle du contrôleur).
 *
 * Fonctions exportées :
 *   - getAllDemandes()            → Toutes les demandes ouvertes (liste publique)
 *   - getDemandeById(id)         → Détail d'une demande avec ses réponses
 *   - getDemandesByUser(userId)  → Demandes d'un utilisateur + ses réponses
 *   - createDemande(userId,data) → Créer une nouvelle demande
 *   - createReponseDemande(...)  → Enregistrer la réponse d'un agriculteur
 */

// Import du pool de connexions MySQL (créé dans src/config/db.js)
const pool = require("../config/db");

/**
 * getAllDemandes
 * -------------
 * Récupère toutes les demandes OUVERTES, avec les informations du particulier
 * qui les a postées (prénom, nom, ville si renseignée).
 *
 * Utilisée sur la page publique /demandes pour que tout le monde puisse
 * voir ce que les particuliers recherchent.
 *
 * @returns {Array} Tableau d'objets demande
 */
async function getAllDemandes() {
  const [rows] = await pool.query(`
    SELECT
      d.id_demande,
      d.titre,
      d.description,
      d.produit_recherche,
      d.quantite_souhaitee,
      d.unite,
      d.statut,
      d.created_at,
      u.prenom      AS prenom_particulier,
      u.nom         AS nom_particulier,
      -- On compte le nombre de réponses reçues pour chaque demande
      COUNT(r.id_reponse) AS nb_reponses
    FROM demande d
    JOIN utilisateur u ON u.id_user = d.id_user_particulier
    LEFT JOIN reponse_demande r ON r.id_demande = d.id_demande
    WHERE d.statut = 'OUVERTE'
    GROUP BY d.id_demande, d.titre, d.description, d.produit_recherche, 
             d.quantite_souhaitee, d.unite, d.statut, d.created_at,
             u.prenom, u.nom
    ORDER BY d.created_at DESC
  `);
  return rows;
}

/**
 * getDemandeById
 * ---------------
 * Récupère le détail complet d'une demande :
 *   - Les informations de base (titre, description, produit...)
 *   - Les informations du particulier qui l'a postée
 *   - Toutes les réponses des agriculteurs avec leur exploitation
 *
 * Utilisée sur la page de détail d'une demande (/demandes/:id).
 *
 * @param {number} id - L'identifiant de la demande
 * @returns {object|null} L'objet demande complet, ou null si introuvable
 */
async function getDemandeById(id) {
  // Requête 1 : infos de base de la demande + particulier
  const [rows] = await pool.query(
    `
    SELECT
      d.id_demande,
      d.id_user_particulier,
      d.titre,
      d.description,
      d.produit_recherche,
      d.quantite_souhaitee,
      d.unite,
      d.statut,
      d.created_at,
      u.prenom AS prenom_particulier,
      u.nom    AS nom_particulier,
      u.email  AS email_particulier
    FROM demande d
    JOIN utilisateur u ON u.id_user = d.id_user_particulier
    WHERE d.id_demande = ?
  `,
    [id],
  );

  // Si aucune demande trouvée avec cet id → null
  if (rows.length === 0) return null;

  const demande = rows[0];

  // Requête 2 : les réponses des agriculteurs pour cette demande
  // On joint avec la table agriculteur pour afficher le nom de l'exploitation
  const [reponses] = await pool.query(
    `
    SELECT
      r.id_reponse,
      r.message,
      r.created_at,
      u.prenom          AS prenom_agri,
      u.nom             AS nom_agri,
      a.nom_exploitation,
      a.ville
    FROM reponse_demande r
    JOIN agriculteur a ON a.id_user = r.id_user_agri
    JOIN utilisateur u ON u.id_user = a.id_user
    WHERE r.id_demande = ?
    ORDER BY r.created_at ASC
  `,
    [id],
  );

  // On ajoute les réponses à l'objet demande
  demande.reponses = reponses;

  return demande;
}

/**
 * getDemandesByUser
 * ------------------
 * Récupère toutes les demandes postées par un utilisateur spécifique,
 * avec le nombre de réponses reçues pour chacune.
 *
 * Utilisée sur la page "Mes demandes" (/demandes/mes-demandes).
 *
 * @param {number} userId - L'id_user du particulier connecté
 * @returns {Array} Tableau de demandes avec nb_reponses
 */
async function getDemandesByUser(userId) {
  const [rows] = await pool.query(
    `
    SELECT
      d.id_demande,
      d.titre,
      d.produit_recherche,
      d.quantite_souhaitee,
      d.unite,
      d.statut,
      d.created_at,
      COUNT(r.id_reponse) AS nb_reponses
    FROM demande d
    LEFT JOIN reponse_demande r ON r.id_demande = d.id_demande
    WHERE d.id_user_particulier = ?
    GROUP BY d.id_demande, d.titre, d.produit_recherche, d.quantite_souhaitee,
             d.unite, d.statut, d.created_at
    ORDER BY d.created_at DESC
  `,
    [userId],
  );
  return rows;
}

/**
 * createDemande
 * --------------
 * Insère une nouvelle demande dans la table "demande".
 *
 * @param {number} userId   - L'id_user du particulier connecté
 * @param {object} data     - Les données du formulaire
 * @param {string} data.titre
 * @param {string} data.description
 * @param {string} data.produit_recherche
 * @param {number} data.quantite_souhaitee  (peut être vide/null)
 * @param {string} data.unite               (peut être vide/null)
 * @returns {number} L'id_demande de la nouvelle demande créée
 */
async function createDemande(
  userId,
  { titre, description, produit_recherche, quantite_souhaitee, unite },
) {
  const [rows] = await pool.query(
    `INSERT INTO demande
       (id_user_particulier, titre, description, produit_recherche, quantite_souhaitee, unite)
     VALUES (?, ?, ?, ?, ?, ?)
     RETURNING id_demande`,
    [
      userId,
      titre,
      description || null, // Si vide → null en base
      produit_recherche,
      quantite_souhaitee || null, // Si vide → null en base
      unite || null, // Si vide → null en base
    ],
  );

  // rows[0].id_demande contient l'id auto-généré par PostgreSQL pour la nouvelle ligne
  return rows[0].id_demande;
}

/**
 * createReponseDemande
 * ---------------------
 * Enregistre la réponse d'un agriculteur à une demande de particulier.
 *
 * @param {number} idDemande  - L'identifiant de la demande concernée
 * @param {number} idUserAgri - L'id_user de l'agriculteur qui répond
 * @param {string} message    - Le contenu du message de réponse
 * @returns {number} L'id_reponse de la nouvelle réponse créée
 */
async function createReponseDemande(idDemande, idUserAgri, message) {
  const [rows] = await pool.query(
    `INSERT INTO reponse_demande (id_demande, id_user_agri, message)
     VALUES (?, ?, ?)
     RETURNING id_reponse`,
    [idDemande, idUserAgri, message],
  );
  return rows[0].id_reponse;
}

/**
 * cloturerDemande
 * ----------------
 * Change le statut d'une demande de 'OUVERTE' à 'CLOTUREE'.
 * Seul le propriétaire de la demande peut clôturer.
 *
 * @param {number} idDemande         - L'id de la demande à clôturer
 * @param {number} idUserParticulier - L'id du particulier (vérification propriétaire)
 */
async function cloturerDemande(idDemande, idUserParticulier) {
  await pool.query(
    `UPDATE demande SET statut = 'CLOTUREE'
     WHERE id_demande = ? AND id_user_particulier = ?`,
    [idDemande, idUserParticulier],
  );
}

/**
 * updateDemande
 * -------------
 * Met à jour le contenu d'une demande existante.
 * La clause WHERE vérifie que la demande appartient bien au particulier connecté,
 * ce qui empêche un utilisateur de modifier la demande d'un autre.
 *
 * @param {number} idDemande         - L'id de la demande à modifier
 * @param {number} idUserParticulier - L'id du particulier (vérification propriétaire)
 * @param {object} data              - Les nouvelles données
 * @param {string} data.titre
 * @param {string} data.description  (optionnel)
 * @param {string} data.produit_recherche
 * @param {number} data.quantite_souhaitee (optionnel)
 * @param {string} data.unite              (optionnel)
 * @returns {number} Nombre de lignes affectées (0 = non autorisé ou introuvable)
 */
async function updateDemande(
  idDemande,
  idUserParticulier,
  { titre, description, produit_recherche, quantite_souhaitee, unite },
) {
  const [, result] = await pool.query(
    `UPDATE demande SET
       titre              = ?,
       description        = ?,
       produit_recherche  = ?,
       quantite_souhaitee = ?,
       unite              = ?
     WHERE id_demande = ? AND id_user_particulier = ?`,
    [
      titre,
      description || null,
      produit_recherche,
      quantite_souhaitee || null,
      unite || null,
      idDemande,
      idUserParticulier,
    ],
  );
  // rowCount = 0 si la demande n'existe pas ou n'appartient pas à cet utilisateur
  return result.rowCount;
}

/**
 * deleteDemandeById
 * -----------------
 * Supprime définitivement une demande et toutes ses réponses associées
 * (la contrainte ON DELETE CASCADE dans la table reponse_demande s'en charge).
 * Seul le propriétaire peut supprimer sa demande (vérification dans le WHERE).
 *
 * Note : contrairement aux offres, on fait une vraie suppression (hard-delete)
 * car les demandes ne sont pas liées à des commandes ou paiements.
 *
 * @param {number} idDemande         - L'id de la demande à supprimer
 * @param {number} idUserParticulier - L'id du particulier (vérification propriétaire)
 * @returns {number} Nombre de lignes supprimées (0 = non autorisé ou introuvable)
 */
async function deleteDemandeById(idDemande, idUserParticulier) {
  const [, result] = await pool.query(
    "DELETE FROM demande WHERE id_demande = ? AND id_user_particulier = ?",
    [idDemande, idUserParticulier],
  );
  return result.rowCount;
}

// On exporte toutes les fonctions pour les utiliser dans le contrôleur
module.exports = {
  getAllDemandes,
  getDemandeById,
  getDemandesByUser,
  createDemande,
  createReponseDemande,
  cloturerDemande,
  updateDemande,
  deleteDemandeById,
};
