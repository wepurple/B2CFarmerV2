/**
 * demandes.routes.js
 * -------------------
 * Ce fichier définit toutes les routes liées aux demandes de produits.
 *
 * Architecture MVC — couche "Routes" :
 *   Les routes font le lien entre une URL HTTP et une fonction du contrôleur.
 *   Elles peuvent aussi appliquer des middlewares d'authentification.
 *
 * Ce routeur est monté sur le préfixe "/demandes" dans app.js.
 * Donc une route définie ici comme "/" correspond à l'URL "/demandes".
 *
 * ⚠️  ORDRE IMPORTANT :
 *   Les routes statiques ("/creer", "/mes-demandes") doivent être définies
 *   AVANT les routes dynamiques ("/:id").
 *   Sinon Express interpréterait "creer" comme un :id, ce qui échouerait.
 *
 * Routes disponibles :
 *   GET  /demandes                  → liste publique (tout le monde)
 *   GET  /demandes/creer            → formulaire de création (particuliers)
 *   POST /demandes/creer            → traitement création (particuliers)
 *   GET  /demandes/mes-demandes     → mes demandes (particuliers)
 *   GET  /demandes/:id              → détail d'une demande (tout le monde)
 *   GET  /demandes/:id/edit         → formulaire de modification (particulier propriétaire)
 *   POST /demandes/:id/edit         → traitement modification (particulier propriétaire)
 *   POST /demandes/:id/delete       → suppression (particulier propriétaire)
 *   POST /demandes/:id/repondre     → répondre (agriculteurs connectés)
 *   POST /demandes/:id/cloturer     → clôturer (particulier propriétaire)
 */

// On importe Express pour créer un mini-routeur
const express = require("express");

// router = un mini-Express qui gère uniquement les routes ci-dessous
const router = express.Router();

// Import du contrôleur (logique métier)
const demandesController = require("../controllers/demandes.controller");

// Import des middlewares d'authentification
const {
  isAuthenticated, // Vérifie que l'utilisateur est connecté
  isAgriculteur, // Vérifie que l'utilisateur est un agriculteur
  isParticulier, // Vérifie que l'utilisateur est un particulier
} = require("../middleware/auth.middleware");

// ── Routes publiques (accessibles sans connexion) ──────────────

// Liste publique des demandes ouvertes
// URL : GET /demandes
router.get("/", demandesController.listDemandes);

// ── Routes protégées : particuliers uniquement ─────────────────

// Formulaire de création d'une demande
// isAuthenticated → doit être connecté
// isParticulier   → doit avoir le rôle PARTICULIER
// URL : GET /demandes/creer
router.get(
  "/creer",
  isAuthenticated,
  isParticulier,
  demandesController.showCreerDemande,
);

// Traitement du formulaire de création
// URL : POST /demandes/creer
router.post(
  "/creer",
  isAuthenticated,
  isParticulier,
  demandesController.handleCreerDemande,
);

// Mes demandes (liste des demandes du particulier connecté)
// URL : GET /demandes/mes-demandes
router.get(
  "/mes-demandes",
  isAuthenticated,
  isParticulier,
  demandesController.listMesDemandes,
);

// Détail d'une demande (visible par tous, réponse réservée aux agriculteurs)
// IMPORTANT : cette route doit être APRÈS /creer et /mes-demandes
// sinon "creer" et "mes-demandes" seraient interprétés comme des :id
// URL : GET /demandes/:id
router.get("/:id", demandesController.showDemande);

// Formulaire de modification d'une demande (propriétaire uniquement)
// L'ownership check est aussi fait dans le contrôleur (showEditDemande)
// URL : GET /demandes/:id/edit
router.get(
  "/:id/edit",
  isAuthenticated,
  isParticulier,
  demandesController.showEditDemande,
);

// Traitement du formulaire de modification
// URL : POST /demandes/:id/edit
router.post(
  "/:id/edit",
  isAuthenticated,
  isParticulier,
  demandesController.handleEditDemande,
);

// Suppression d'une demande (propriétaire uniquement)
// URL : POST /demandes/:id/delete
router.post(
  "/:id/delete",
  isAuthenticated,
  isParticulier,
  demandesController.handleDeleteDemande,
);

// Clôturer une demande (seul le propriétaire peut le faire)
// URL : POST /demandes/:id/cloturer
router.post(
  "/:id/cloturer",
  isAuthenticated,
  isParticulier,
  demandesController.handleCloturerDemande,
);

// ── Routes protégées : agriculteurs uniquement ─────────────────

// Répondre à une demande
// URL : POST /demandes/:id/repondre
router.post(
  "/:id/repondre",
  isAuthenticated,
  isAgriculteur,
  demandesController.handleRepondreDemande,
);

// On exporte le routeur pour le monter dans app.js
module.exports = router;
