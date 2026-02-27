/**
 * commandes.routes.js
 * --------------------
 * Définition des routes pour l'historique et le détail des commandes.
 *
 * Toutes les routes sont protégées par :
 *   - isAuthenticated : l'utilisateur doit être connecté
 *   - isParticulier   : seuls les particuliers ont des commandes
 *
 * Routes :
 *   GET /commandes      → liste des commandes du particulier
 *   GET /commandes/:id  → détail d'une commande spécifique
 */

const express = require("express");
const router  = express.Router();

const commandesController = require("../controllers/commandes.controller");
const { isAuthenticated, isParticulier, isAgriculteur } = require("../middleware/auth.middleware");

// ── Espace particulier ─────────────────────────────────────────────────────

// Liste des commandes du particulier connecté
router.get("/", isAuthenticated, isParticulier, commandesController.listMesCommandes);

// ── Espace agriculteur ─────────────────────────────────────────────────────
// IMPORTANT : ces routes doivent être déclarées AVANT "/:id"
// pour éviter que "agriculteur" soit interprété comme un ID numérique.

// Liste des commandes reçues par l'agriculteur
router.get("/agriculteur", isAuthenticated, isAgriculteur, commandesController.listCommandesAgriculteur);

// Détail d'une commande reçue
router.get("/agriculteur/:id", isAuthenticated, isAgriculteur, commandesController.showCommandeAgriculteur);

// Confirmer une commande (soustrait les stocks)
router.post("/agriculteur/:id/confirmer", isAuthenticated, isAgriculteur, commandesController.confirmerCommande);

// Annuler une commande en attente
router.post("/agriculteur/:id/annuler", isAuthenticated, isAgriculteur, commandesController.annulerCommande);

// ── Détail particulier ─────────────────────────────────────────────────────

// Détail d'une commande spécifique (particulier uniquement)
router.get("/:id", isAuthenticated, isParticulier, commandesController.showCommande);

module.exports = router;
