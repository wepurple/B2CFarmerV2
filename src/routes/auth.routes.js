/**
 * auth.routes.js
 * --------------
 * Ce fichier définit toutes les routes liées à l'authentification.
 *
 * Une "route" associe une URL et une méthode HTTP (GET, POST...)
 * à une fonction du contrôleur qui traite la demande.
 *
 * Convention des URLs utilisées :
 *   GET  /auth/login     → Afficher le formulaire de connexion
 *   POST /auth/login     → Traiter la soumission du formulaire de connexion
 *   GET  /auth/register  → Afficher le formulaire d'inscription
 *   POST /auth/register  → Traiter la soumission du formulaire d'inscription
 *   POST /auth/logout    → Déconnecter l'utilisateur
 */

// Express.Router() crée un "mini-routeur" qu'on monte ensuite dans app.js
const { Router } = require('express');
const router = Router();

// Import du contrôleur qui contient la logique
const authController = require('../controllers/auth.controller');

// Import des middlewares qui protègent certaines routes
const { isNotAuthenticated } = require('../middleware/auth.middleware');

// ── Routes GET (affichage des pages) ─────────────────────────
// "isNotAuthenticated" empêche un utilisateur déjà connecté
// de voir les pages de connexion/inscription

router.get('/login',    isNotAuthenticated, authController.showLogin);
router.get('/register', isNotAuthenticated, authController.showRegister);

// ── Routes POST (traitement des formulaires) ──────────────────
// Ces routes reçoivent les données envoyées par les formulaires HTML

router.post('/login',    isNotAuthenticated, authController.handleLogin);
router.post('/register', isNotAuthenticated, authController.handleRegister);

// ── Route de déconnexion ──────────────────────────────────────
// On utilise POST pour la déconnexion (bonne pratique de sécurité)
// Un lien simple (GET) pourrait être déclenché par accident (ex: prefetch)
router.post('/logout', authController.handleLogout);

module.exports = router;
