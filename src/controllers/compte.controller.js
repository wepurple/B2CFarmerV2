/**
 * compte.controller.js
 * ---------------------
 * Ce fichier contient la logique métier pour la page "Mon Compte".
 *
 * Architecture MVC — couche "Controller" :
 *   Permet à un utilisateur connecté de consulter et modifier ses
 *   informations personnelles (nom, prénom, email, téléphone).
 *   Les agriculteurs peuvent aussi modifier leur profil d'exploitation.
 *   Le changement de mot de passe est optionnel et sécurisé.
 *
 * Fonctions exportées :
 *   - showCompte    : GET /mon-compte    → affiche le profil
 *   - handleCompte  : POST /mon-compte   → traite les modifications
 */

// Import du modèle auth (qui gère les données utilisateur en base)
const authModel = require('../models/auth.model');

// bcrypt pour le hachage sécurisé des mots de passe
const bcrypt = require('bcrypt');

// Nombre de tours de hachage (doit être le même que dans auth.controller.js)
const SALT_ROUNDS = 12;


/**
 * showCompte
 * -----------
 * Affiche la page "Mon compte" avec les informations de l'utilisateur connecté.
 * Si l'utilisateur est un agriculteur, affiche aussi les infos de l'exploitation.
 *
 * Route : GET /mon-compte
 */
async function showCompte(req, res) {
  try {
    const userId = req.session.user.id_user;

    // Récupération complète de l'utilisateur (avec profil agriculteur si applicable)
    const userData = await authModel.getUserById(userId);

    if (!userData) {
      // Cas improbable mais sécurité : la session existe mais l'utilisateur non
      console.error(`[Compte] Utilisateur ${userId} introuvable en base`);
      return res.redirect('/auth/logout');
    }

    res.render('compte/index', {
      title:      'Mon compte',
      activePage: 'compte',
      userData,
      error:      null,
      success:    req.query.success === '1',
    });
  } catch (err) {
    console.error('Erreur showCompte:', err);
    res.status(500).send('Erreur serveur');
  }
}


/**
 * handleCompte
 * -------------
 * Traite le formulaire de modification du profil.
 *
 * Données attendues dans req.body :
 *   - nom, prenom, email, telephone (commun à tous les utilisateurs)
 *   - nom_exploitation, agri_description, siret, adresse, code_postal, ville
 *     (uniquement pour les agriculteurs)
 *   - current_password, new_password, confirm_new_password
 *     (optionnels : uniquement si l'utilisateur veut changer son mot de passe)
 *
 * Route : POST /mon-compte
 */
async function handleCompte(req, res) {
  const userId = req.session.user.id_user;
  const role   = req.session.user.role;

  // Récupérer les données actuelles (pour les ré-afficher en cas d'erreur)
  let userData;
  try {
    userData = await authModel.getUserById(userId);
  } catch (err) {
    console.error('Erreur handleCompte (fetch user):', err);
    return res.status(500).send('Erreur serveur');
  }

  // Fonction utilitaire pour ré-afficher le formulaire avec une erreur
  const renderError = (errorMsg) => {
    // On fusionne les données actuelles avec celles soumises pour pré-remplir
    const merged = { ...userData, ...req.body };
    return res.render('compte/index', {
      title:      'Mon compte',
      activePage: 'compte',
      userData:   merged,
      error:      errorMsg,
      success:    false,
    });
  };

  // ── Récupérer et nettoyer les champs communs ─────────────────
  const nom       = (req.body.nom       || '').trim();
  const prenom    = (req.body.prenom    || '').trim();
  const email     = (req.body.email     || '').trim().toLowerCase();
  const telephone = (req.body.telephone || '').trim();

  // ── Validation des champs communs ────────────────────────────
  if (!nom || !prenom || !email) {
    return renderError('Le nom, le prénom et l\'email sont obligatoires.');
  }

  // Validation du format e-mail
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return renderError('L\'adresse e-mail n\'est pas valide.');
  }

  // Vérifier que l'email n'est pas déjà utilisé par un autre utilisateur
  try {
    const emailTaken = await authModel.emailExistsForOther(email, userId);
    if (emailTaken) {
      return renderError('Cette adresse e-mail est déjà utilisée par un autre compte.');
    }
  } catch (err) {
    console.error('Erreur vérification email:', err);
    return renderError('Une erreur est survenue. Veuillez réessayer.');
  }

  // ── Validation des champs agriculteur (si applicable) ────────
  const nom_exploitation = (req.body.nom_exploitation || '').trim();
  const agri_description = (req.body.agri_description || '').trim();
  const siret            = (req.body.siret            || '').trim();
  const adresse          = (req.body.adresse          || '').trim();
  const code_postal      = (req.body.code_postal      || '').trim();
  const ville            = (req.body.ville            || '').trim();

  if (role === 'AGRICULTEUR') {
    if (!nom_exploitation || !adresse || !code_postal || !ville) {
      return renderError('Les informations de l\'exploitation sont obligatoires.');
    }
    if (siret && !/^\d{14}$/.test(siret)) {
      return renderError('Le numéro SIRET doit contenir exactement 14 chiffres.');
    }
  }

  // ── Gestion du changement de mot de passe (optionnel) ────────
  const currentPassword    = req.body.current_password     || '';
  const newPassword        = req.body.new_password         || '';
  const confirmNewPassword = req.body.confirm_new_password || '';

  // L'utilisateur veut changer son mot de passe
  if (newPassword) {
    // Le mot de passe actuel est requis pour confirmer l'identité
    if (!currentPassword) {
      return renderError('Veuillez saisir votre mot de passe actuel pour en définir un nouveau.');
    }

    if (newPassword.length < 8) {
      return renderError('Le nouveau mot de passe doit contenir au moins 8 caractères.');
    }

    if (newPassword !== confirmNewPassword) {
      return renderError('Les nouveaux mots de passe ne correspondent pas.');
    }

    // Vérifier le mot de passe actuel
    try {
      const currentHash = await authModel.getPasswordHash(userId);
      const match = await bcrypt.compare(currentPassword, currentHash);
      if (!match) {
        return renderError('Le mot de passe actuel est incorrect.');
      }
    } catch (err) {
      console.error('Erreur vérification mot de passe:', err);
      return renderError('Une erreur est survenue. Veuillez réessayer.');
    }
  }

  // ── Mise à jour en base ──────────────────────────────────────
  try {
    // 1. Mettre à jour les infos personnelles
    await authModel.updateUser(userId, { nom, prenom, email, telephone });

    // 2. Si agriculteur, mettre à jour le profil d'exploitation
    if (role === 'AGRICULTEUR') {
      await authModel.updateAgriculteurProfileData(userId, {
        nom_exploitation,
        description: agri_description,
        siret,
        adresse,
        code_postal,
        ville,
      });
    }

    // 3. Si nouveau mot de passe, le hasher et le sauvegarder
    if (newPassword) {
      const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
      await authModel.updatePassword(userId, newHash);
      console.log(`[Compte] Mot de passe modifié pour user ${userId}`);
    }

    // 4. Mettre à jour la session avec les nouvelles valeurs
    //    (pour que la navbar affiche les bonnes infos immédiatement)
    req.session.user.nom    = nom;
    req.session.user.prenom = prenom;
    req.session.user.email  = email;
    if (role === 'AGRICULTEUR') {
      req.session.user.nom_exploitation = nom_exploitation;
    }

    console.log(`[Compte] Profil mis à jour pour user ${userId}`);
    res.redirect('/mon-compte?success=1');

  } catch (err) {
    console.error('Erreur handleCompte (update):', err);
    return renderError('Une erreur est survenue lors de la mise à jour. Veuillez réessayer.');
  }
}


// On exporte les fonctions pour les utiliser dans les routes
module.exports = {
  showCompte,
  handleCompte,
};
