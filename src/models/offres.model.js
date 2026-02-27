/**
 * offres.model.js
 * ----------------
 * Ce fichier gère toutes les interactions avec la base de données
 * concernant les offres et les produits.
 *
 * Architecture MVC — couche "Model" :
 *   Ce fichier ne contient QUE des requêtes SQL.
 *   Il ne sait pas comment afficher les données (rôle des vues EJS).
 *   Il ne contient pas de logique métier complexe (rôle du contrôleur).
 *
 * Tables concernées :
 *   - offre           : les offres publiées par les agriculteurs
 *   - offre_ligne     : les lignes de produit d'une offre (prix, quantité)
 *   - produit         : la liste des produits disponibles
 *   - demande_contact : les messages de contact envoyés par les particuliers
 *
 * Fonctions exportées :
 *   - getAllOffres()                  → Toutes les offres actives (liste publique)
 *   - getOffreById(id)               → Détail d'une offre avec ses produits
 *   - getOffresByAgriculteur(userId) → Offres d'un agriculteur spécifique
 *   - createOffre(userId, data)      → Créer une nouvelle offre
 *   - findOrCreateProduit(...)       → Trouver ou créer un produit en base
 *   - createOffreLigne(...)          → Ajouter un produit à une offre
 *   - createDemandeContact(...)      → Enregistrer un message de contact
 */

// Import du pool de connexions PostgreSQL via PoolAdapter (src/config/db.js)
const pool = require("../config/db");

/**
 * getAllOffres
 * ------------
 * Récupère toutes les offres ACTIVES avec le nom de l'exploitation
 * et les produits associés.
 *
 * ATTENTION : La requête retourne 1 ligne par produit.
 * Ex : si une offre a 3 produits → 3 lignes SQL pour cette offre.
 * On "regroupe" ces lignes en JavaScript pour obtenir un objet offre
 * avec un tableau de produits (voir la boucle avec Map ci-dessous).
 *
 * @returns {Array} Tableau d'objets offre (chacun avec produits:[])
 */
async function getAllOffres() {
  const [rows] = await pool.query(`
    SELECT
      o.id_offre,
      o.titre,
      o.description,
      o.created_at,
      a.nom_exploitation,
      a.ville,
      p.libelle AS produit_libelle,
      ol.prix   AS produit_prix,
      ol.quantite_disponible AS produit_qte
    FROM offre o
    JOIN agriculteur a ON a.id_user = o.id_user_agri
    LEFT JOIN offre_ligne ol ON ol.id_offre = o.id_offre
    LEFT JOIN produit p ON p.id_produit = ol.id_produit
    WHERE o.deleted_at IS NULL AND o.statut = 'ACTIVE'
    ORDER BY o.id_offre DESC
  `);

  /*
   * Transformation des lignes SQL en objets structurés.
   * On utilise un Map (dictionnaire) pour regrouper les produits par offre.
   *
   * Map : clé = id_offre, valeur = objet offre avec tableau produits
   */
  const map = new Map();

  for (const r of rows) {
    // Si on n'a pas encore cette offre dans la Map, on l'ajoute
    if (!map.has(r.id_offre)) {
      map.set(r.id_offre, {
        id_offre: r.id_offre,
        titre: r.titre,
        description: r.description,
        created_at: r.created_at,
        nom_exploitation: r.nom_exploitation,
        ville: r.ville,
        produits: [], // Tableau vide, rempli ci-dessous
      });
    }

    // Si la ligne a un produit (LEFT JOIN peut retourner null), on l'ajoute
    if (r.produit_libelle) {
      map.get(r.id_offre).produits.push({
        libelle: r.produit_libelle,
        prix: r.produit_prix,
        quantite: r.produit_qte,
      });
    }
  }

  // On retourne un tableau à partir des valeurs du Map
  return Array.from(map.values());
}

/**
 * getOffreById
 * -------------
 * Récupère le détail complet d'une offre : info de l'offre, de l'exploitation
 * et tous les produits associés. Inclut aussi l'email de l'agriculteur.
 *
 * @param {number} idOffre - L'identifiant de l'offre
 * @returns {object|null}  - L'objet offre complet, ou null si introuvable
 */
async function getOffreById(idOffre) {
  const [rows] = await pool.query(
    `
    SELECT
      o.id_offre,
      o.id_user_agri,
      o.titre,
      o.description,
      o.date_debut,
      o.date_fin,
      o.created_at,
      o.statut,
      a.nom_exploitation,
      a.description AS agri_description,
      a.ville,
      u.email       AS agri_email,
      p.id_produit,
      p.libelle     AS produit_libelle,
      p.unite       AS produit_unite,
      p.categorie   AS produit_categorie,
      ol.prix       AS produit_prix,
      ol.quantite_disponible AS produit_qte
    FROM offre o
    JOIN agriculteur a ON a.id_user = o.id_user_agri
    JOIN utilisateur u ON u.id_user = o.id_user_agri
    LEFT JOIN offre_ligne ol ON ol.id_offre = o.id_offre
    LEFT JOIN produit p ON p.id_produit = ol.id_produit
    WHERE o.id_offre = ? AND o.deleted_at IS NULL
  `,
    [idOffre],
  );

  // Aucun résultat = offre inexistante
  if (rows.length === 0) return null;

  // On reconstruit l'objet offre à partir de la première ligne
  const first = rows[0];
  const offre = {
    id_offre: first.id_offre,
    id_user_agri: first.id_user_agri,
    titre: first.titre,
    description: first.description,
    date_debut: first.date_debut,
    date_fin: first.date_fin,
    created_at: first.created_at,
    statut: first.statut,
    nom_exploitation: first.nom_exploitation,
    agri_description: first.agri_description,
    ville: first.ville,
    agri_email: first.agri_email,
    produits: [],
  };

  // On parcourt toutes les lignes pour récupérer les produits
  for (const r of rows) {
    if (r.produit_libelle) {
      offre.produits.push({
        id_produit: r.id_produit,
        libelle: r.produit_libelle,
        unite: r.produit_unite,
        categorie: r.produit_categorie,
        prix: r.produit_prix,
        quantite: r.produit_qte,
      });
    }
  }

  return offre;
}

/**
 * getOffresByAgriculteur
 * -----------------------
 * Récupère toutes les offres d'un agriculteur spécifique,
 * avec le nombre de produits et de demandes de contact reçues.
 *
 * Utilisée sur la page "Mes offres" (/offres/mes-offres).
 *
 * @param {number} userId - L'id_user de l'agriculteur connecté
 * @returns {Array}       - Tableau d'offres avec nb_produits et nb_contacts
 */
async function getOffresByAgriculteur(userId) {
  const [rows] = await pool.query(
    `
    SELECT
      o.id_offre,
      o.titre,
      o.description,
      o.statut,
      o.created_at,
      -- COUNT(DISTINCT ...) pour compter les éléments uniques (évite les doublons)
      COUNT(DISTINCT ol.id_produit)   AS nb_produits,
      COUNT(DISTINCT dc.id_demande)   AS nb_contacts
    FROM offre o
    LEFT JOIN offre_ligne ol     ON ol.id_offre = o.id_offre
    LEFT JOIN demande_contact dc ON dc.id_offre = o.id_offre
    WHERE o.id_user_agri = ? AND o.deleted_at IS NULL
    GROUP BY o.id_offre, o.titre, o.description, o.statut, o.created_at
    ORDER BY o.created_at DESC
  `,
    [userId],
  );
  return rows;
}

/**
 * createOffre
 * ------------
 * Insère une nouvelle offre dans la table "offre".
 * C'est la première étape de création d'une offre.
 * Ensuite, on appelle createOffreLigne() pour ajouter les produits.
 *
 * @param {number} userId  - L'id_user de l'agriculteur connecté
 * @param {object} data    - Les données du formulaire
 * @param {string} data.titre
 * @param {string} data.description  (optionnel)
 * @param {string} data.date_debut   (optionnel, format YYYY-MM-DD)
 * @param {string} data.date_fin     (optionnel, format YYYY-MM-DD)
 * @returns {number}       - L'id_offre de la nouvelle offre créée
 */
async function createOffre(
  userId,
  { titre, description, date_debut, date_fin },
) {
  const [rows] = await pool.query(
    `INSERT INTO offre (id_user_agri, titre, description, date_debut, date_fin, statut)
     VALUES (?, ?, ?, ?, ?, 'ACTIVE')
     RETURNING id_offre`,
    [
      userId,
      titre,
      description || null, // Valeur vide → null en base
      date_debut || null,
      date_fin || null,
    ],
  );
  // rows[0].id_offre contient l'id auto-généré par PostgreSQL pour la nouvelle offre
  return rows[0].id_offre;
}

/**
 * findOrCreateProduit
 * --------------------
 * Cherche un produit par son libellé (recherche insensible à la casse).
 * S'il existe déjà → retourne son id_produit existant.
 * S'il n'existe pas → le crée et retourne le nouvel id_produit.
 *
 * Cette fonction permet à l'agriculteur de taper un nom de produit
 * sans se soucier de s'il est déjà référencé en base.
 *
 * @param {string} libelle   - Nom du produit (ex: "Tomates")
 * @param {string} unite     - Unité (ex: "kg", "pièce", "litre")
 * @param {string} categorie - Catégorie (ex: "légume", "fruit")
 * @returns {number}         - L'id_produit (existant ou nouvellement créé)
 */
async function findOrCreateProduit(libelle, unite, categorie) {
  // LOWER() transforme en minuscules pour comparer sans tenir compte de la casse
  // Ex: "Tomates" et "tomates" donneront le même résultat
  const [rows] = await pool.query(
    "SELECT id_produit FROM produit WHERE LOWER(libelle) = LOWER(?)",
    [libelle],
  );

  // Le produit existe déjà → on retourne son id
  if (rows.length > 0) {
    return rows[0].id_produit;
  }

  // Le produit n'existe pas → on le crée dans la table produit
  const [inserted] = await pool.query(
    "INSERT INTO produit (libelle, unite, categorie) VALUES (?, ?, ?) RETURNING id_produit",
    [libelle, unite, categorie],
  );
  return inserted[0].id_produit;
}

/**
 * createOffreLigne
 * -----------------
 * Ajoute une ligne de produit à une offre existante.
 * Chaque ligne lie un produit à une offre avec son prix et sa quantité.
 *
 * ON CONFLICT (id_offre, id_produit) : si la combinaison existe déjà,
 * on met à jour les valeurs au lieu d'échouer.
 *
 * @param {number} idOffre   - L'identifiant de l'offre
 * @param {number} idProduit - L'identifiant du produit
 * @param {number} prix      - Prix unitaire (en euros, ex: 3.50)
 * @param {number} quantite  - Quantité disponible (ex: 50)
 */
async function createOffreLigne(idOffre, idProduit, prix, quantite) {
  await pool.query(
    `INSERT INTO offre_ligne (id_offre, id_produit, prix, quantite_disponible)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (id_offre, id_produit) DO UPDATE SET
       prix                = EXCLUDED.prix,
       quantite_disponible = EXCLUDED.quantite_disponible`,
    [idOffre, idProduit, prix, quantite],
  );
}

/**
 * createDemandeContact
 * ---------------------
 * Enregistre un message de contact d'un particulier à propos d'une offre.
 * La table demande_contact stocke ces messages de mise en relation.
 *
 * Utilisée depuis la page de détail d'une offre (/offres/:id).
 *
 * @param {number} idUserParticulier - L'id_user du particulier connecté
 * @param {number} idOffre           - L'id de l'offre concernée
 * @param {string} message           - Le message du particulier
 */
async function createDemandeContact(idUserParticulier, idOffre, message) {
  await pool.query(
    `INSERT INTO demande_contact (id_user_particulier, id_offre, message)
     VALUES (?, ?, ?)`,
    [idUserParticulier, idOffre, message],
  );
}

/**
 * updateOffre
 * ------------
 * Met à jour les informations principales d'une offre existante.
 * Seul le propriétaire (id_user_agri) peut modifier son offre.
 *
 * La clause WHERE vérifie à la fois l'id de l'offre ET l'id de l'agriculteur
 * pour empêcher un agriculteur de modifier l'offre d'un autre.
 *
 * @param {number} idOffre  - L'identifiant de l'offre à modifier
 * @param {number} userId   - L'id de l'agriculteur (vérification propriétaire)
 * @param {object} data     - Les nouvelles données
 * @returns {number}        - Nombre de lignes affectées (0 = non autorisé ou introuvable)
 */
async function updateOffre(
  idOffre,
  userId,
  { titre, description, date_debut, date_fin, statut },
) {
  const [, result] = await pool.query(
    `UPDATE offre SET
       titre       = ?,
       description = ?,
       date_debut  = ?,
       date_fin    = ?,
       statut      = ?
     WHERE id_offre = ? AND id_user_agri = ? AND deleted_at IS NULL`,
    [
      titre,
      description || null,
      date_debut || null,
      date_fin || null,
      statut || "ACTIVE",
      idOffre,
      userId,
    ],
  );
  // rowCount = nombre de lignes modifiées
  // 0 si l'offre n'existe pas ou n'appartient pas à cet agriculteur
  return result.rowCount;
}

/**
 * deleteOffre (soft-delete)
 * --------------------------
 * Supprime une offre en positionnant "deleted_at" à la date/heure actuelle.
 * L'offre n'est pas physiquement supprimée — elle est juste masquée
 * de toutes les requêtes qui filtrent par "deleted_at IS NULL".
 *
 * Seul le propriétaire peut supprimer son offre (vérification dans le WHERE).
 *
 * @param {number} idOffre - L'identifiant de l'offre
 * @param {number} userId  - L'id de l'agriculteur propriétaire
 * @returns {number}       - Nombre de lignes affectées
 */
async function deleteOffre(idOffre, userId) {
  const [, result] = await pool.query(
    `UPDATE offre SET deleted_at = NOW()
     WHERE id_offre = ? AND id_user_agri = ? AND deleted_at IS NULL`,
    [idOffre, userId],
  );
  return result.rowCount;
}

/**
 * deleteOffreLignes
 * ------------------
 * Supprime toutes les lignes de produit associées à une offre.
 * Utilisée avant de ré-insérer les produits lors de la modification d'une offre.
 *
 * @param {number} idOffre - L'identifiant de l'offre
 */
async function deleteOffreLignes(idOffre) {
  await pool.query("DELETE FROM offre_ligne WHERE id_offre = ?", [idOffre]);
}

// On exporte toutes les fonctions pour les utiliser dans le contrôleur
module.exports = {
  getAllOffres,
  getOffreById,
  getOffresByAgriculteur,
  createOffre,
  updateOffre,
  deleteOffre,
  deleteOffreLignes,
  findOrCreateProduit,
  createOffreLigne,
  createDemandeContact,
};
