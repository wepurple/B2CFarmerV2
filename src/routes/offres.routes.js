/**
 * offres.routes.js
 * -----------------
 * Ce fichier définit toutes les routes liées aux offres agricoles.
 *
 * Architecture MVC — couche "Routes" :
 *   Les routes font le lien entre une URL HTTP et une fonction du contrôleur.
 *   Elles appliquent aussi des middlewares de sécurité (authentification, rôle).
 *
 * Ce routeur est monté sur le préfixe "/offres" dans app.js.
 * Donc une route définie ici comme "/" correspond à l'URL "/offres".
 *
 * Routes disponibles :
 *   GET  /offres              → liste publique des offres (tout le monde)
 *   GET  /offres/creer        → formulaire de création (agriculteurs uniquement)
 *   POST /offres/creer        → traitement du formulaire (agriculteurs uniquement)
 *   GET  /offres/mes-offres   → mes offres (agriculteur connecté uniquement)
 *   GET  /offres/:id          → détail d'une offre (tout le monde)
 *   GET  /offres/:id/edit     → formulaire de modification (propriétaire uniquement)
 *   POST /offres/:id/edit     → traitement de la modification (propriétaire uniquement)
 *   POST /offres/:id/delete   → suppression de l'offre (propriétaire uniquement)
 *   POST /offres/:id/contact  → message de contact (utilisateurs connectés)
 *
 * ⚠️  ORDRE IMPORTANT :
 *   Les routes statiques ("/creer", "/mes-offres") doivent être définies
 *   AVANT les routes dynamiques ("/:id").
 *   Sinon Express interpréterait "creer" comme un id, ce qui échouerait.
 */

// On importe Express pour créer un mini-routeur
const express = require('express');
const router  = express.Router();

// Import du contrôleur (logique métier)
const offresController = require('../controllers/offres.controller');

// Import des middlewares d'authentification
const { isAuthenticated, isAgriculteur } = require('../middleware/auth.middleware');


// ── Routes publiques (accessibles sans connexion) ──────────────

// Liste de toutes les offres actives
// URL : GET /offres
router.get('/', offresController.listOffres);


// ── Routes protégées : agriculteurs uniquement ─────────────────
// ⚠️  Ces routes DOIVENT être avant /:id pour ne pas être confondues

// Formulaire de création d'une offre
// URL : GET /offres/creer
router.get('/creer',
  isAuthenticated,   // 1. L'utilisateur doit être connecté
  isAgriculteur,     // 2. L'utilisateur doit avoir le rôle AGRICULTEUR
  offresController.showCreerOffre
);

// Traitement du formulaire de création
// URL : POST /offres/creer
router.post('/creer',
  isAuthenticated,
  isAgriculteur,
  offresController.handleCreerOffre
);

// Mes offres (liste des offres de l'agriculteur connecté)
// URL : GET /offres/mes-offres
router.get('/mes-offres',
  isAuthenticated,
  isAgriculteur,
  offresController.listMesOffres
);


// ── Routes dynamiques (avec :id) — APRÈS les routes statiques ──

// Détail d'une offre (visible par tous)
// URL : GET /offres/3 (où 3 = l'identifiant de l'offre)
router.get('/:id', offresController.showOffre);

// Formulaire de modification d'une offre (propriétaire uniquement)
// L'ownership check est fait dans le contrôleur (showEditOffre)
// URL : GET /offres/3/edit
router.get('/:id/edit',
  isAuthenticated,
  isAgriculteur,
  offresController.showEditOffre
);

// Traitement du formulaire de modification
// URL : POST /offres/3/edit
router.post('/:id/edit',
  isAuthenticated,
  isAgriculteur,
  offresController.handleEditOffre
);

// Suppression d'une offre (soft-delete, propriétaire uniquement)
// URL : POST /offres/3/delete
router.post('/:id/delete',
  isAuthenticated,
  isAgriculteur,
  offresController.handleDeleteOffre
);

// Envoyer un message de contact à l'agriculteur d'une offre
// Réservé aux utilisateurs connectés (particuliers principalement)
// URL : POST /offres/3/contact
router.post('/:id/contact',
  isAuthenticated,
  offresController.handleContact
);


// On exporte le routeur pour le monter dans app.js
module.exports = router;
