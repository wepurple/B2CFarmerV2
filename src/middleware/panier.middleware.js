/**
 * panier.middleware.js
 * --------------------
 * Middleware qui initialise le panier dans la session
 * et le rend disponible dans toutes les vues EJS.
 *
 * Le panier est stocké dans req.session.panier sous forme de tableau.
 * Chaque élément du panier contient :
 *   { id_offre, id_produit, libelle, prix, quantite, unite, nom_exploitation, offre_titre }
 *
 * Ce middleware expose aussi :
 *   - res.locals.panier      → le tableau du panier (accessible dans toutes les vues)
 *   - res.locals.panierCount  → le nombre total d'articles (somme des quantités)
 */

/**
 * initPanier
 * ----------
 * Initialise le panier s'il n'existe pas encore dans la session,
 * puis le rend disponible dans toutes les vues EJS via res.locals.
 */
function initPanier(req, res, next) {
  // Initialise le panier s'il n'existe pas encore
  if (!req.session.panier) {
    req.session.panier = [];
  }

  // Rend le panier et son nombre d'articles accessible dans toutes les vues EJS
  res.locals.panier = req.session.panier;
  res.locals.panierCount = req.session.panier.reduce(
    (sum, item) => sum + Number(item.quantite),
    0
  );

  next();
}

module.exports = { initPanier };
