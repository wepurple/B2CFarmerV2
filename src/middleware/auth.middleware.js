/**
 * auth.middleware.js
 * ------------------
 * Ce fichier contient des "middlewares" d'authentification.
 *
 * Un middleware est une fonction qui s'exécute ENTRE la réception
 * d'une requête HTTP et l'envoi de la réponse. On peut le voir comme
 * un "garde" qui vérifie quelque chose avant de laisser passer.
 *
 * Express appelle les middlewares dans l'ordre. Chaque middleware reçoit :
 *   - req  : l'objet requête (données envoyées par le navigateur)
 *   - res  : l'objet réponse (pour envoyer une réponse au navigateur)
 *   - next : une fonction à appeler pour passer au middleware suivant
 */

/**
 * isAuthenticated
 * ---------------
 * Vérifie que l'utilisateur est bien connecté avant d'accéder à une page.
 * Si l'utilisateur n'est pas connecté, il est redirigé vers la page de connexion.
 *
 * Utilisation dans les routes :
 *   router.get('/mon-compte', isAuthenticated, monCompteController.show);
 *
 * @example
 * // Sans ce middleware, n'importe qui peut accéder à la page
 * // Avec ce middleware, seuls les utilisateurs connectés y ont accès
 */
function isAuthenticated(req, res, next) {
  // req.session.user est défini lors de la connexion (dans auth.controller.js)
  // S'il existe, l'utilisateur est connecté → on le laisse passer
  if (req.session && req.session.user) {
    return next(); // "next()" signifie : continue vers la route demandée
  }

  // L'utilisateur n'est pas connecté → on le redirige vers la connexion
  // On sauvegarde l'URL qu'il voulait atteindre pour le rediriger après connexion
  req.session.redirectAfterLogin = req.originalUrl;
  res.redirect('/auth/login');
}

/**
 * isNotAuthenticated
 * -------------------
 * Empêche un utilisateur DÉJÀ connecté d'accéder aux pages de connexion/inscription.
 * Si l'utilisateur est déjà connecté, il est redirigé vers la page d'accueil.
 *
 * Cela évite qu'un utilisateur connecté voie à nouveau le formulaire de connexion.
 *
 * Utilisation dans les routes :
 *   router.get('/auth/login', isNotAuthenticated, authController.showLogin);
 */
function isNotAuthenticated(req, res, next) {
  // Si l'utilisateur EST connecté, on le redirige vers l'accueil
  if (req.session && req.session.user) {
    return res.redirect('/');
  }

  // L'utilisateur n'est pas connecté → il peut accéder à la page de connexion
  next();
}

/**
 * isAgriculteur
 * -------------
 * Vérifie que l'utilisateur connecté est bien un agriculteur.
 * Utile pour protéger les pages de gestion des offres.
 *
 * Utilisation dans les routes :
 *   router.get('/offres/creer', isAuthenticated, isAgriculteur, controller.show);
 */
function isAgriculteur(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'AGRICULTEUR') {
    return next();
  }

  // L'utilisateur n'a pas le bon rôle → page d'erreur 403 (Accès interdit)
  res.status(403).render('404', {
    title: 'Accès interdit',
    message: 'Cette page est réservée aux agriculteurs.',
    activePage: '',
  });
}

/**
 * isParticulier
 * -------------
 * Vérifie que l'utilisateur connecté est bien un particulier.
 * Utile pour protéger les pages de dépôt de demande.
 *
 * Utilisation dans les routes :
 *   router.get('/demandes/creer', isAuthenticated, isParticulier, controller.show);
 */
function isParticulier(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'PARTICULIER') {
    return next();
  }

  // L'utilisateur n'a pas le bon rôle → page d'erreur 403 (Accès interdit)
  res.status(403).render('404', {
    title: 'Accès interdit',
    message: 'Cette page est réservée aux particuliers.',
    activePage: '',
  });
}

// On exporte les middlewares pour pouvoir les utiliser dans les routes
module.exports = {
  isAuthenticated,
  isNotAuthenticated,
  isAgriculteur,
  isParticulier,
};
