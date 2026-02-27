/**
 * auth.model.js
 * -------------
 * Ce fichier gère toutes les interactions avec la base de données
 * concernant les utilisateurs (connexion, inscription).
 *
 * Un "modèle" (Model) dans l'architecture MVC s'occupe uniquement
 * des données : il fait les requêtes SQL et retourne les résultats.
 * Il ne sait pas comment afficher ces données (c'est le rôle des vues).
 */

// On importe le pool de connexions à la base de données
const pool = require('../config/db');

/**
 * Cherche un utilisateur dans la base de données par son adresse e-mail.
 *
 * @param {string} email - L'e-mail saisi par l'utilisateur lors de la connexion
 * @returns {object|null} - L'objet utilisateur si trouvé, sinon null
 */
async function findUserByEmail(email) {
  // On fait une jointure LEFT JOIN avec la table "agriculteur" pour récupérer
  // les infos du profil agriculteur si l'utilisateur a ce rôle.
  // LEFT JOIN signifie : on prend tous les utilisateurs, et s'il y a un profil
  // agriculteur associé, on l'ajoute. Sinon, les colonnes agriculteur seront null.
  const [rows] = await pool.query(
    `SELECT
      u.id_user,
      u.nom,
      u.prenom,
      u.email,
      u.password_hash,
      u.role,
      u.actif,
      a.nom_exploitation,
      a.ville
    FROM utilisateur u
    LEFT JOIN agriculteur a ON u.id_user = a.id_user
    WHERE u.email = ?`,
    [email] // Le "?" est remplacé par la valeur de "email" pour éviter les injections SQL
  );

  // rows est un tableau. Si l'e-mail existe, rows[0] contient l'utilisateur.
  // Sinon, rows est vide et on retourne null.
  return rows[0] || null;
}

/**
 * Crée un nouvel utilisateur dans la table "utilisateur".
 * Utilisé lors de l'inscription.
 *
 * @param {object} userData - Les données de l'utilisateur à insérer
 * @param {string} userData.nom
 * @param {string} userData.prenom
 * @param {string} userData.email
 * @param {string} userData.passwordHash - Le mot de passe déjà hashé (jamais en clair !)
 * @param {string} userData.role - 'PARTICULIER' ou 'AGRICULTEUR'
 * @returns {number} - L'identifiant (id_user) du nouvel utilisateur créé
 */
async function createUser({ nom, prenom, email, passwordHash, role }) {
  const [rows] = await pool.query(
    `INSERT INTO utilisateur (nom, prenom, email, password_hash, role, actif)
     VALUES (?, ?, ?, ?, ?, 1)
     RETURNING id_user`,
    // "actif = 1" signifie que le compte est actif dès la création
    [nom, prenom, email, passwordHash, role]
  );

  // rows[0].id_user contient l'id auto-généré par PostgreSQL pour la nouvelle ligne
  return rows[0].id_user;
}

/**
 * Crée le profil agriculteur lié à un utilisateur.
 * Cette fonction est appelée APRÈS createUser() si le rôle est 'AGRICULTEUR'.
 *
 * @param {number} userId - L'id_user de l'agriculteur (retourné par createUser)
 * @param {object} profileData - Les infos spécifiques à l'agriculteur
 * @param {string} profileData.nom_exploitation
 * @param {string} profileData.siret
 * @param {string} profileData.adresse
 * @param {string} profileData.code_postal
 * @param {string} profileData.ville
 */
async function createAgriculteurProfile(userId, { nom_exploitation, siret, adresse, code_postal, ville }) {
  await pool.query(
    `INSERT INTO agriculteur (id_user, nom_exploitation, siret, adresse, code_postal, ville)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, nom_exploitation, siret, adresse, code_postal, ville]
  );
}

/**
 * Vérifie si un e-mail est déjà utilisé dans la base de données.
 * Utile pour éviter les doublons lors de l'inscription.
 *
 * @param {string} email
 * @returns {boolean} - true si l'e-mail existe déjà, false sinon
 */
async function emailExists(email) {
  const [rows] = await pool.query(
    'SELECT id_user FROM utilisateur WHERE email = ?',
    [email]
  );
  return rows.length > 0;
}

/**
 * getUserById
 * ------------
 * Récupère un utilisateur complet par son id_user, avec son profil
 * agriculteur si applicable. Utilisée pour la page Mon Compte.
 *
 * @param {number} id - L'id_user de l'utilisateur
 * @returns {object|null} L'objet utilisateur ou null si introuvable
 */
async function getUserById(id) {
  const [rows] = await pool.query(
    `SELECT
      u.id_user,
      u.nom,
      u.prenom,
      u.email,
      u.telephone,
      u.role,
      u.actif,
      u.created_at,
      a.nom_exploitation,
      a.description AS agri_description,
      a.siret,
      a.adresse,
      a.code_postal,
      a.ville
    FROM utilisateur u
    LEFT JOIN agriculteur a ON u.id_user = a.id_user
    WHERE u.id_user = ?`,
    [id]
  );
  return rows[0] || null;
}


/**
 * updateUser
 * -----------
 * Met à jour les informations personnelles d'un utilisateur.
 * Le mot de passe n'est PAS mis à jour ici (voir updatePassword).
 *
 * @param {number} id   - L'id_user de l'utilisateur
 * @param {object} data - Les nouvelles données
 */
async function updateUser(id, { nom, prenom, email, telephone }) {
  await pool.query(
    `UPDATE utilisateur SET nom = ?, prenom = ?, email = ?, telephone = ?
     WHERE id_user = ?`,
    [nom, prenom, email, telephone || null, id]
  );
}


/**
 * updatePassword
 * ---------------
 * Met à jour le mot de passe hashé d'un utilisateur.
 * Appelée uniquement si l'utilisateur a rempli le champ "nouveau mot de passe".
 *
 * @param {number} id           - L'id_user
 * @param {string} passwordHash - Le nouveau hash bcrypt
 */
async function updatePassword(id, passwordHash) {
  await pool.query(
    'UPDATE utilisateur SET password_hash = ? WHERE id_user = ?',
    [passwordHash, id]
  );
}


/**
 * getPasswordHash
 * ----------------
 * Récupère le hash du mot de passe actuel pour le comparer avec le mot
 * de passe saisi par l'utilisateur (vérification avant modification).
 *
 * @param {number} id - L'id_user
 * @returns {string|null} Le hash du mot de passe
 */
async function getPasswordHash(id) {
  const [rows] = await pool.query(
    'SELECT password_hash FROM utilisateur WHERE id_user = ?',
    [id]
  );
  return rows[0] ? rows[0].password_hash : null;
}


/**
 * updateAgriculteurProfile
 * -------------------------
 * Met à jour le profil spécifique d'un agriculteur.
 *
 * @param {number} userId  - L'id_user de l'agriculteur
 * @param {object} data    - Les nouvelles données
 */
async function updateAgriculteurProfileData(userId, { nom_exploitation, description, siret, adresse, code_postal, ville }) {
  await pool.query(
    `UPDATE agriculteur SET
       nom_exploitation = ?,
       description      = ?,
       siret            = ?,
       adresse          = ?,
       code_postal      = ?,
       ville            = ?
     WHERE id_user = ?`,
    [nom_exploitation, description || null, siret || null, adresse, code_postal, ville, userId]
  );
}


/**
 * emailExistsForOther
 * --------------------
 * Vérifie si un e-mail est déjà utilisé par un AUTRE utilisateur.
 * Utile lors de la modification du profil pour éviter les doublons.
 *
 * @param {string} email   - L'e-mail à vérifier
 * @param {number} userId  - L'id_user de l'utilisateur actuel (à exclure)
 * @returns {boolean}
 */
async function emailExistsForOther(email, userId) {
  const [rows] = await pool.query(
    'SELECT id_user FROM utilisateur WHERE email = ? AND id_user != ?',
    [email, userId]
  );
  return rows.length > 0;
}


// On exporte les fonctions pour pouvoir les utiliser dans le contrôleur
module.exports = {
  findUserByEmail,
  createUser,
  createAgriculteurProfile,
  emailExists,
  getUserById,
  updateUser,
  updatePassword,
  getPasswordHash,
  updateAgriculteurProfileData,
  emailExistsForOther,
};
