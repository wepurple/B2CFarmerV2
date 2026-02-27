/**
 * compte.routes.js
 * -----------------
 * Ce fichier définit les routes liées à la page "Mon compte".
 *
 * Ces routes sont montées sur le préfixe "/mon-compte" dans app.js.
 *
 * Routes disponibles :
 *   GET  /mon-compte  → affichage du profil (utilisateur connecté)
 *   POST /mon-compte  → mise à jour du profil (utilisateur connecté)
 */

const express = require('express');
const router  = express.Router();

// Import du contrôleur
const compteController = require('../controllers/compte.controller');

// Import du middleware d'authentification
const { isAuthenticated } = require('../middleware/auth.middleware');


// ── Affichage du profil ────────────────────────────────────────
// L'utilisateur doit être connecté (toutes les routes sont protégées)
router.get('/', isAuthenticated, compteController.showCompte);

// ── Traitement du formulaire de modification ───────────────────
router.post('/', isAuthenticated, compteController.handleCompte);


module.exports = router;
