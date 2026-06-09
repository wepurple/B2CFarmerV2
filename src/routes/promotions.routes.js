/**
 * promotions.routes.js
 * ---------------------
 * Routes de gestion des promotions côté agriculteur.
 */

const express = require("express");
const router = express.Router();

const promotionsController = require("../controllers/promotions.controller");
const { isAuthenticated, isAgriculteur } = require("../middleware/auth.middleware");

// Affiche le formulaire d'ajout d'une promotion pour une offre précise.
router.get(
  "/offres/:id/promotions/new",
  // L'utilisateur doit être connecté et avoir le rôle agriculteur.
  isAuthenticated,
  isAgriculteur,
  promotionsController.showCreatePromotion,
);

// Traite le formulaire d'ajout d'une promotion.
router.post(
  "/offres/:id/promotions",
  isAuthenticated,
  isAgriculteur,
  promotionsController.handleCreatePromotion,
);

// Affiche le formulaire de modification d'une promotion existante.
router.get(
  "/promotions/:id/edit",
  isAuthenticated,
  isAgriculteur,
  promotionsController.showEditPromotion,
);

// Traite la modification d'une promotion existante.
router.post(
  "/promotions/:id/edit",
  isAuthenticated,
  isAgriculteur,
  promotionsController.handleEditPromotion,
);

// Supprime une promotion existante.
router.post(
  "/promotions/:id/delete",
  isAuthenticated,
  isAgriculteur,
  promotionsController.handleDeletePromotion,
);

module.exports = router;
