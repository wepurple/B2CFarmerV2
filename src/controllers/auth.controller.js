/**
 * auth.controller.js
 * -------------------
 * Ce fichier contient toute la logique métier de l'authentification.
 *
 * Un "contrôleur" (Controller) dans l'architecture MVC fait le lien entre :
 *   - Le modèle (les données en base) → auth.model.js
 *   - La vue (ce qu'on affiche à l'utilisateur) → views/auth/
 *
 * Il reçoit les données du formulaire, les valide, appelle le modèle,
 * puis décide quoi afficher ou vers où rediriger.
 */

// bcrypt est la bibliothèque qui permet de hasher les mots de passe
// et de les comparer de façon sécurisée. On ne stocke JAMAIS un mot de
// passe en clair en base de données.
const bcrypt = require('bcrypt');

// On importe les fonctions du modèle pour interagir avec la base de données
const authModel = require('../models/auth.model');

// Nombre de "tours" de hachage pour bcrypt.
// Plus c'est élevé, plus c'est sécurisé, mais plus c'est lent.
// 12 est un bon compromis sécurité/performance pour 2024.
const SALT_ROUNDS = 12;

// ============================================================
// PAGES D'AFFICHAGE (méthodes GET)
// ============================================================

/**
 * showLogin
 * ---------
 * Affiche la page de connexion (formulaire vide).
 * Route : GET /auth/login
 */
function showLogin(req, res) {
  // On passe "error: null" et "email: ''" pour que la vue puisse
  // afficher des messages d'erreur si nécessaire (lors d'un rechargement).
  res.render('auth/login', {
    title: 'Connexion',
    activePage: 'login',
    error: null,      // Pas d'erreur au premier chargement
    email: '',        // Champ e-mail vide au premier chargement
  });
}

/**
 * showRegister
 * ------------
 * Affiche la page d'inscription (formulaire vide).
 * Route : GET /auth/register
 */
function showRegister(req, res) {
  res.render('auth/register', {
    title: 'Créer un compte',
    activePage: 'register',
    error: null,
    // On repasse les données saisies pour les ré-afficher en cas d'erreur
    // (évite à l'utilisateur de tout re-saisir)
    formData: {},
  });
}

// ============================================================
// TRAITEMENT DES FORMULAIRES (méthodes POST)
// ============================================================

/**
 * handleLogin
 * -----------
 * Traite la soumission du formulaire de connexion.
 * Route : POST /auth/login
 *
 * Étapes :
 *   1. Récupérer et nettoyer les données du formulaire
 *   2. Vérifier que les champs sont remplis
 *   3. Chercher l'utilisateur en base de données
 *   4. Comparer le mot de passe avec le hash stocké
 *   5. Créer la session et rediriger
 */
async function handleLogin(req, res) {
  // req.body contient les données envoyées par le formulaire HTML
  // .trim() supprime les espaces inutiles au début et à la fin
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';

  // ── Étape 1 : Validation de base ──────────────────────────
  if (!email || !password) {
    return res.render('auth/login', {
      title: 'Connexion',
      activePage: 'login',
      error: 'Veuillez remplir tous les champs.',
      email,
    });
  }

  try {
    // ── Étape 2 : Chercher l'utilisateur en base ───────────
    const user = await authModel.findUserByEmail(email);

    // Si aucun utilisateur trouvé → message d'erreur générique
    // (On ne dit pas "e-mail inconnu" pour ne pas aider quelqu'un
    // qui essaierait de deviner les comptes existants)
    if (!user) {
      return res.render('auth/login', {
        title: 'Connexion',
        activePage: 'login',
        error: 'E-mail ou mot de passe incorrect.',
        email,
      });
    }

    // ── Étape 3 : Vérifier que le compte est actif ─────────
    if (!user.actif) {
      return res.render('auth/login', {
        title: 'Connexion',
        activePage: 'login',
        error: 'Ce compte a été désactivé. Contactez l\'administrateur.',
        email,
      });
    }

    // ── Étape 4 : Comparer les mots de passe ───────────────
    // bcrypt.compare() compare le mot de passe saisi (en clair)
    // avec le hash stocké en base. Elle retourne true ou false.
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.render('auth/login', {
        title: 'Connexion',
        activePage: 'login',
        error: 'E-mail ou mot de passe incorrect.',
        email,
      });
    }

    // ── Étape 5 : Créer la session ─────────────────────────
    // On stocke dans la session uniquement les infos nécessaires.
    // JAMAIS le mot de passe, même hashé !
    req.session.user = {
      id_user: user.id_user,
      nom: user.nom,
      prenom: user.prenom,
      email: user.email,
      role: user.role,
      nom_exploitation: user.nom_exploitation || null, // Null si ce n'est pas un agriculteur
    };

    // Si l'utilisateur voulait accéder à une page protégée avant de se connecter,
    // on le redirige vers cette page. Sinon, vers l'accueil.
    const redirectTo = req.session.redirectAfterLogin || '/';
    delete req.session.redirectAfterLogin; // On efface l'URL sauvegardée

    res.redirect(redirectTo);

  } catch (err) {
    // En cas d'erreur inattendue (ex: base de données inaccessible)
    console.error('[Auth] Erreur lors de la connexion :', err);
    res.render('auth/login', {
      title: 'Connexion',
      activePage: 'login',
      error: 'Une erreur est survenue. Veuillez réessayer.',
      email,
    });
  }
}

/**
 * handleRegister
 * --------------
 * Traite la soumission du formulaire d'inscription.
 * Route : POST /auth/register
 *
 * Étapes :
 *   1. Récupérer et nettoyer les données
 *   2. Valider les champs obligatoires
 *   3. Vérifier que les mots de passe correspondent
 *   4. Vérifier que l'e-mail n'est pas déjà utilisé
 *   5. Hasher le mot de passe
 *   6. Créer l'utilisateur en base
 *   7. Si agriculteur, créer le profil agriculteur
 *   8. Créer la session et rediriger
 */
async function handleRegister(req, res) {
  // On récupère toutes les données du formulaire
  const nom             = (req.body.nom || '').trim();
  const prenom          = (req.body.prenom || '').trim();
  const email           = (req.body.email || '').trim().toLowerCase();
  const password        = req.body.password || '';
  const confirmPassword = req.body.confirm_password || '';
  const role            = req.body.role || ''; // 'PARTICULIER' ou 'AGRICULTEUR'

  // Données spécifiques aux agriculteurs (vides si rôle = PARTICULIER)
  const nom_exploitation = (req.body.nom_exploitation || '').trim();
  const siret            = (req.body.siret || '').trim();
  const adresse          = (req.body.adresse || '').trim();
  const code_postal      = (req.body.code_postal || '').trim();
  const ville            = (req.body.ville || '').trim();

  // Objet pour repasser les données en cas d'erreur (évite à l'utilisateur de tout re-saisir)
  const formData = { nom, prenom, email, role, nom_exploitation, siret, adresse, code_postal, ville };

  // Fonction utilitaire pour afficher la page d'inscription avec une erreur
  const renderError = (errorMsg) => {
    return res.render('auth/register', {
      title: 'Créer un compte',
      activePage: 'register',
      error: errorMsg,
      formData,
    });
  };

  // ── Étape 1 : Vérification des champs communs ──────────
  if (!nom || !prenom || !email || !password || !role) {
    return renderError('Veuillez remplir tous les champs obligatoires.');
  }

  // Validation du format e-mail avec une expression régulière simple
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return renderError('L\'adresse e-mail n\'est pas valide.');
  }

  // ── Étape 2 : Vérification du mot de passe ─────────────
  if (password.length < 8) {
    return renderError('Le mot de passe doit contenir au moins 8 caractères.');
  }

  if (password !== confirmPassword) {
    return renderError('Les mots de passe ne correspondent pas.');
  }

  // ── Étape 3 : Vérification du rôle ────────────────────
  if (!['PARTICULIER', 'AGRICULTEUR'].includes(role)) {
    return renderError('Rôle invalide.');
  }

  // ── Étape 4 : Champs supplémentaires pour les agriculteurs ─
  if (role === 'AGRICULTEUR') {
    if (!nom_exploitation || !adresse || !code_postal || !ville) {
      return renderError('Veuillez remplir tous les champs de votre exploitation.');
    }
    // Validation du numéro SIRET : 14 chiffres exactement
    if (siret && !/^\d{14}$/.test(siret)) {
      return renderError('Le numéro SIRET doit contenir exactement 14 chiffres.');
    }
  }

  try {
    // ── Étape 5 : Vérifier si l'e-mail existe déjà ────────
    const exists = await authModel.emailExists(email);
    if (exists) {
      return renderError('Cette adresse e-mail est déjà utilisée.');
    }

    // ── Étape 6 : Hasher le mot de passe ──────────────────
    // bcrypt.hash() prend le mot de passe en clair et le transforme
    // en une chaîne de caractères illisible et non-réversible.
    // On ne peut jamais retrouver le mot de passe original depuis le hash.
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // ── Étape 7 : Créer l'utilisateur en base ─────────────
    const userId = await authModel.createUser({
      nom,
      prenom,
      email,
      passwordHash,
      role,
    });

    // ── Étape 8 : Si agriculteur, créer le profil ─────────
    if (role === 'AGRICULTEUR') {
      await authModel.createAgriculteurProfile(userId, {
        nom_exploitation,
        siret: siret || null, // null si le SIRET n'est pas fourni
        adresse,
        code_postal,
        ville,
      });
    }

    // ── Étape 9 : Créer la session ────────────────────────
    req.session.user = {
      id_user: userId,
      nom,
      prenom,
      email,
      role,
      nom_exploitation: role === 'AGRICULTEUR' ? nom_exploitation : null,
    };

    // Redirection après inscription :
    // - Les particuliers arrivent sur la page des offres
    // - Les agriculteurs arrivent sur la page d'accueil
    const redirectTo = role === 'AGRICULTEUR' ? '/' : '/offres';
    res.redirect(redirectTo);

  } catch (err) {
    console.error('[Auth] Erreur lors de l\'inscription :', err);
    return renderError('Une erreur est survenue. Veuillez réessayer.');
  }
}

/**
 * handleLogout
 * ------------
 * Déconnecte l'utilisateur en détruisant sa session.
 * Route : POST /auth/logout
 */
function handleLogout(req, res) {
  // req.session.destroy() supprime la session côté serveur
  req.session.destroy((err) => {
    if (err) {
      console.error('[Auth] Erreur lors de la déconnexion :', err);
    }
    // On redirige vers l'accueil après déconnexion
    res.redirect('/');
  });
}

// On exporte toutes les fonctions du contrôleur
module.exports = {
  showLogin,
  showRegister,
  handleLogin,
  handleRegister,
  handleLogout,
};
