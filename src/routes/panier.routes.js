/**
 * panier.routes.js
 * -----------------
 * Définition des routes pour le panier d'achat et le checkout.
 *
 * Toutes les routes sont protégées par :
 *   - isAuthenticated : l'utilisateur doit être connecté
 *   - isParticulier   : seuls les particuliers peuvent commander
 *
 * Routes :
 *   GET  /panier            → afficher le panier
 *   POST /panier/ajouter    → ajouter un produit au panier
 *   POST /panier/supprimer  → retirer un produit du panier
 *   POST /panier/quantite   → modifier la quantité d'un article
 *   GET  /panier/valider    → page de récapitulatif (checkout)
 *   POST /panier/valider    → finaliser la commande
 */

const express = require("express");
const router  = express.Router();

const panierController = require("../controllers/panier.controller");
const { isAuthenticated, isParticulier } = require("../middleware/auth.middleware");

// Afficher le panier
router.get("/", isAuthenticated, isParticulier, panierController.showPanier);

// Ajouter un produit au panier
router.post("/ajouter", isAuthenticated, isParticulier, panierController.addToPanier);

// Supprimer un produit du panier
router.post("/supprimer", isAuthenticated, isParticulier, panierController.removeFromPanier);

// Modifier la quantité d'un article
router.post("/quantite", isAuthenticated, isParticulier, panierController.updateQuantite);

// Page de récapitulatif avant validation
router.get("/valider", isAuthenticated, isParticulier, panierController.showCheckout);

// Finaliser la commande
router.post("/valider", isAuthenticated, isParticulier, panierController.handleCheckout);

module.exports = router;
