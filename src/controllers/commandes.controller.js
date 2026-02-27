/**
 * commandes.controller.js
 * ------------------------
 * Logique métier pour l'historique et le détail des commandes.
 *
 * Fonctions exportées :
 *   - listMesCommandes : GET /commandes      → liste des commandes du particulier
 *   - showCommande     : GET /commandes/:id  → détail d'une commande
 */

const commandesModel = require("../models/commandes.model");


/**
 * listMesCommandes
 * ----------------
 * Affiche la liste de toutes les commandes du particulier connecté.
 * Chaque commande inclut : date, statut, total, nombre d'articles.
 */
async function listMesCommandes(req, res) {
  try {
    const userId = req.session.user.id_user;
    const commandes = await commandesModel.getCommandesByUser(userId);

    res.render("commandes/index", {
      title: "Mes commandes",
      activePage: "commandes",
      commandes,
    });
  } catch (err) {
    console.error("Erreur listMesCommandes:", err);
    res.status(500).send("Erreur serveur");
  }
}


/**
 * showCommande
 * ------------
 * Affiche le détail d'une commande spécifique :
 * informations générales, lignes de produit, total.
 * Vérifie que la commande appartient bien à l'utilisateur connecté.
 */
async function showCommande(req, res) {
  try {
    const id     = Number(req.params.id);
    const userId = req.session.user.id_user;

    // Validation de l'identifiant
    if (!Number.isFinite(id)) {
      return res.status(400).send("ID invalide");
    }

    // Récupération de la commande (avec vérification propriétaire)
    const commande = await commandesModel.getCommandeById(id, userId);

    if (!commande) {
      return res.status(404).render("404", {
        title: "Commande introuvable",
        message: "Cette commande n'existe pas.",
        activePage: "",
      });
    }

    res.render("commandes/show", {
      title: `Commande #${commande.id_commande}`,
      activePage: "commandes",
      commande,
      success: req.query.success === "1",
    });
  } catch (err) {
    console.error("Erreur showCommande:", err);
    res.status(500).send("Erreur serveur");
  }
}


/**
 * listCommandesAgriculteur
 * -------------------------
 * Affiche la liste des commandes reçues par l'agriculteur connecté.
 * Chaque commande contient : date, statut, total, prénom/nom du client.
 */
async function listCommandesAgriculteur(req, res) {
  try {
    const agriUserId = req.session.user.id_user;
    const commandes  = await commandesModel.getCommandesByAgriculteur(agriUserId);

    res.render("commandes/agriculteur-index", {
      title:      "Commandes reçues",
      activePage: "commandes-agri",
      commandes,
      success: req.query.success || null,
    });
  } catch (err) {
    console.error("Erreur listCommandesAgriculteur:", err);
    res.status(500).send("Erreur serveur");
  }
}


/**
 * showCommandeAgriculteur
 * ------------------------
 * Affiche le détail d'une commande reçue par l'agriculteur.
 * Affiche uniquement les lignes appartenant à ses offres.
 */
async function showCommandeAgriculteur(req, res) {
  try {
    const id         = Number(req.params.id);
    const agriUserId = req.session.user.id_user;

    if (!Number.isFinite(id)) {
      return res.status(400).send("ID invalide");
    }

    const commande = await commandesModel.getCommandeByIdForAgri(id, agriUserId);

    if (!commande) {
      return res.status(404).render("404", {
        title:   "Commande introuvable",
        message: "Cette commande n'existe pas ou ne vous concerne pas.",
        activePage: "",
      });
    }

    res.render("commandes/agriculteur-show", {
      title:      `Commande #${commande.id_commande}`,
      activePage: "commandes-agri",
      commande,
      success: req.query.success || null,
    });
  } catch (err) {
    console.error("Erreur showCommandeAgriculteur:", err);
    res.status(500).send("Erreur serveur");
  }
}


/**
 * confirmerCommande
 * -----------------
 * Confirme une commande EN_ATTENTE :
 * soustrait les quantités des offre_lignes et passe le statut à CONFIRMEE.
 */
async function confirmerCommande(req, res) {
  try {
    const id         = Number(req.params.id);
    const agriUserId = req.session.user.id_user;

    if (!Number.isFinite(id)) {
      return res.status(400).send("ID invalide");
    }

    const ok = await commandesModel.confirmerCommandeAgri(id, agriUserId);

    if (!ok) {
      return res.status(403).send("Action non autorisée ou commande déjà traitée.");
    }

    res.redirect(`/commandes/agriculteur/${id}?success=confirmee`);
  } catch (err) {
    console.error("Erreur confirmerCommande:", err);
    res.status(500).send("Erreur serveur");
  }
}


/**
 * annulerCommande
 * ----------------
 * Annule une commande EN_ATTENTE depuis l'espace agriculteur.
 */
async function annulerCommande(req, res) {
  try {
    const id         = Number(req.params.id);
    const agriUserId = req.session.user.id_user;

    if (!Number.isFinite(id)) {
      return res.status(400).send("ID invalide");
    }

    const ok = await commandesModel.annulerCommandeAgri(id, agriUserId);

    if (!ok) {
      return res.status(403).send("Action non autorisée ou commande déjà traitée.");
    }

    res.redirect(`/commandes/agriculteur?success=annulee`);
  } catch (err) {
    console.error("Erreur annulerCommande:", err);
    res.status(500).send("Erreur serveur");
  }
}


module.exports = {
  listMesCommandes,
  showCommande,
  listCommandesAgriculteur,
  showCommandeAgriculteur,
  confirmerCommande,
  annulerCommande,
};
