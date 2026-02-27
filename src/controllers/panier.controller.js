/**
 * panier.controller.js
 * ---------------------
 * Logique métier pour le panier d'achat et le processus de checkout.
 *
 * Le panier est stocké en session (req.session.panier).
 * Chaque élément du panier contient :
 *   { id_offre, id_produit, libelle, prix, quantite, unite, nom_exploitation, offre_titre }
 *
 * Fonctions exportées :
 *   - showPanier       : GET  /panier           → affiche le contenu du panier
 *   - addToPanier      : POST /panier/ajouter   → ajoute un produit au panier
 *   - removeFromPanier : POST /panier/supprimer  → retire un produit du panier
 *   - updateQuantite   : POST /panier/quantite   → modifie la quantité d'un article
 *   - showCheckout     : GET  /panier/valider    → page de récapitulatif avant validation
 *   - handleCheckout   : POST /panier/valider    → finalise la commande en BDD
 */

const panierModel = require("../models/panier.model");


/**
 * showPanier
 * ----------
 * Affiche la page du panier avec la liste des articles,
 * les sous-totaux par ligne et le total général.
 */
async function showPanier(req, res) {
  try {
    const panier = req.session.panier || [];

    // Calcul du total général
    const total = panier.reduce(
      (sum, item) => sum + (Number(item.prix) * Number(item.quantite)),
      0
    );

    res.render("panier/index", {
      title: "Mon panier",
      activePage: "panier",
      panier,
      total,
      success: req.query.success || null,
    });
  } catch (err) {
    console.error("Erreur showPanier:", err);
    res.status(500).send("Erreur serveur");
  }
}


/**
 * addToPanier
 * -----------
 * Ajoute un produit au panier. Valide que le produit existe
 * dans une offre active avant de l'ajouter.
 * Si le produit est déjà dans le panier (même offre + même produit),
 * on incrémente la quantité au lieu de créer un doublon.
 *
 * Données attendues dans req.body :
 *   - id_offre   : identifiant de l'offre
 *   - id_produit : identifiant du produit
 *   - quantite   : quantité souhaitée (par défaut 1)
 */
async function addToPanier(req, res) {
  try {
    const idOffre   = Number(req.body.id_offre);
    const idProduit = Number(req.body.id_produit);
    const quantite  = Number(req.body.quantite) || 1;

    // Validation des paramètres
    if (!Number.isFinite(idOffre) || !Number.isFinite(idProduit) || quantite < 1) {
      return res.redirect("/offres");
    }

    // Vérification que le produit existe dans une offre active
    const detail = await panierModel.getOffreLigneDetail(idOffre, idProduit);
    if (!detail) {
      return res.redirect("/offres");
    }

    // Initialisation du panier si nécessaire
    if (!req.session.panier) {
      req.session.panier = [];
    }

    // Recherche si cet article est déjà dans le panier
    const existant = req.session.panier.find(
      (item) => item.id_offre === idOffre && item.id_produit === idProduit
    );

    if (existant) {
      // L'article existe déjà → on incrémente la quantité
      existant.quantite = Number(existant.quantite) + quantite;
    } else {
      // Nouvel article → on l'ajoute au panier
      req.session.panier.push({
        id_offre:         idOffre,
        id_produit:       idProduit,
        libelle:          detail.libelle,
        prix:             Number(detail.prix),
        quantite:         quantite,
        unite:            detail.unite,
        nom_exploitation: detail.nom_exploitation,
        offre_titre:      detail.offre_titre,
      });
    }

    // Redirection vers le panier avec message de succès
    res.redirect("/panier?success=ajoute");

  } catch (err) {
    console.error("Erreur addToPanier:", err);
    res.status(500).send("Erreur serveur");
  }
}


/**
 * removeFromPanier
 * ----------------
 * Supprime un article du panier en se basant sur
 * la combinaison id_offre + id_produit.
 *
 * Données attendues dans req.body :
 *   - id_offre   : identifiant de l'offre
 *   - id_produit : identifiant du produit
 */
async function removeFromPanier(req, res) {
  try {
    const idOffre   = Number(req.body.id_offre);
    const idProduit = Number(req.body.id_produit);

    if (req.session.panier) {
      // On filtre pour ne garder que les articles différents
      req.session.panier = req.session.panier.filter(
        (item) => !(item.id_offre === idOffre && item.id_produit === idProduit)
      );
    }

    res.redirect("/panier");

  } catch (err) {
    console.error("Erreur removeFromPanier:", err);
    res.status(500).send("Erreur serveur");
  }
}


/**
 * updateQuantite
 * ---------------
 * Modifie la quantité d'un article dans le panier.
 * Si la quantité est inférieure ou égale à 0, l'article est supprimé.
 *
 * Données attendues dans req.body :
 *   - id_offre   : identifiant de l'offre
 *   - id_produit : identifiant du produit
 *   - quantite   : nouvelle quantité
 */
async function updateQuantite(req, res) {
  try {
    const idOffre    = Number(req.body.id_offre);
    const idProduit  = Number(req.body.id_produit);
    const quantite   = Number(req.body.quantite);

    if (req.session.panier) {
      if (quantite <= 0) {
        // Quantité nulle ou négative → on supprime l'article
        req.session.panier = req.session.panier.filter(
          (item) => !(item.id_offre === idOffre && item.id_produit === idProduit)
        );
      } else {
        // On met à jour la quantité de l'article correspondant
        const item = req.session.panier.find(
          (item) => item.id_offre === idOffre && item.id_produit === idProduit
        );
        if (item) {
          item.quantite = quantite;
        }
      }
    }

    res.redirect("/panier");

  } catch (err) {
    console.error("Erreur updateQuantite:", err);
    res.status(500).send("Erreur serveur");
  }
}


/**
 * showCheckout
 * -------------
 * Affiche la page de récapitulatif avant validation de la commande.
 * Redirige vers le panier si celui-ci est vide.
 */
async function showCheckout(req, res) {
  try {
    const panier = req.session.panier || [];

    // Panier vide → retour au panier
    if (panier.length === 0) {
      return res.redirect("/panier");
    }

    // Calcul du total général
    const total = panier.reduce(
      (sum, item) => sum + (Number(item.prix) * Number(item.quantite)),
      0
    );

    res.render("panier/checkout", {
      title: "Valider ma commande",
      activePage: "panier",
      panier,
      total,
    });

  } catch (err) {
    console.error("Erreur showCheckout:", err);
    res.status(500).send("Erreur serveur");
  }
}


/**
 * handleCheckout
 * ---------------
 * Finalise la commande :
 *   1. Vérifie que le panier n'est pas vide
 *   2. Crée la commande en base de données (avec transaction)
 *   3. Vide le panier en session
 *   4. Redirige vers la page de détail de la commande créée
 */
async function handleCheckout(req, res) {
  try {
    const panier = req.session.panier || [];
    const userId = req.session.user.id_user;

    // Panier vide → retour au panier
    if (panier.length === 0) {
      return res.redirect("/panier");
    }

    // Création de la commande en base de données
    const idCommande = await panierModel.createCommande(userId, panier);

    // Vidage du panier après la commande
    req.session.panier = [];

    // Redirection vers la page de détail de la commande créée
    res.redirect(`/commandes/${idCommande}?success=1`);

  } catch (err) {
    console.error("Erreur handleCheckout:", err);
    res.status(500).send("Erreur serveur");
  }
}


module.exports = {
  showPanier,
  addToPanier,
  removeFromPanier,
  updateQuantite,
  showCheckout,
  handleCheckout,
};
