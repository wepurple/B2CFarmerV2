/**
 * promotions.controller.js
 * ------------------------
 * Gestion des promotions côté agriculteur.
 */

const promotionsModel = require("../models/promotions.model");
const offresModel = require("../models/offres.model");

// Types réellement gérés par l'interface.
// La base accepte d'autres valeurs historiques, mais elles ne sont plus proposées.
const PROMOTION_TYPES = [
  "POURCENTAGE",
  "MONTANT_FIXE",
  "QUANTITE",
];

/**
 * Affiche le formulaire d'ajout d'une promotion pour une offre.
 * Route : GET /offres/:id/promotions/new
 */
async function showCreatePromotion(req, res) {
  // L'id vient de l'URL, donc on le convertit et on le valide.
  const idOffre = Number(req.params.id);
  const userId = req.session.user.id_user;

  if (!Number.isFinite(idOffre)) {
    return res.status(400).send("ID invalide");
  }

  try {
    // Sécurité : l'agriculteur ne peut accéder au formulaire que pour ses offres.
    const isOwner = await promotionsModel.isOffreOwnedByAgriculteur(idOffre, userId);
    if (!isOwner) {
      return renderForbidden(res, "Vous ne pouvez gérer que les promotions de vos propres offres.");
    }

    // On charge l'offre pour afficher son titre et la liste de ses produits.
    const offre = await offresModel.getOffreById(idOffre);

    res.render("promotions/new", {
      title: "Ajouter une promotion",
      activePage: "offres",
      offre,
      // Valeurs par défaut du formulaire au premier affichage.
      formData: {
        type_promotion: "POURCENTAGE",
        active: "on",
      },
      error: null,
    });
  } catch (err) {
    console.error("Erreur showCreatePromotion:", err);
    res.status(500).send("Erreur serveur");
  }
}

/**
 * Traite la création d'une promotion.
 * Route : POST /offres/:id/promotions
 */
async function handleCreatePromotion(req, res) {
  const idOffre = Number(req.params.id);
  const userId = req.session.user.id_user;

  if (!Number.isFinite(idOffre)) {
    return res.status(400).send("ID invalide");
  }

  try {
    // Même si le bouton est caché ailleurs, on revérifie toujours côté serveur.
    const isOwner = await promotionsModel.isOffreOwnedByAgriculteur(idOffre, userId);
    if (!isOwner) {
      return renderForbidden(res, "Vous ne pouvez gérer que les promotions de vos propres offres.");
    }

    const offre = await offresModel.getOffreById(idOffre);
    // Normalisation : conversion des nombres, dates vides en null, type harmonisé.
    const data = normalizePromotionData(req.body);
    // Validation métier avant insertion SQL.
    const error = validatePromotionData(data, offre);

    if (error) {
      // En cas d'erreur, on réaffiche le formulaire avec les données saisies.
      return res.render("promotions/new", {
        title: "Ajouter une promotion",
        activePage: "offres",
        offre,
        formData: req.body,
        error,
      });
    }

    // L'id de l'offre vient de l'URL contrôlée, pas du formulaire.
    await promotionsModel.createPromotion({
      ...data,
      id_offre: idOffre,
    });

    res.redirect(`/offres/${idOffre}?promotionSuccess=create`);
  } catch (err) {
    console.error("Erreur handleCreatePromotion:", err);
    res.redirect(`/offres/${idOffre}/promotions/new`);
  }
}

/**
 * Affiche le formulaire de modification d'une promotion.
 * Route : GET /promotions/:id/edit
 */
async function showEditPromotion(req, res) {
  const idPromotion = Number(req.params.id);
  const userId = req.session.user.id_user;

  if (!Number.isFinite(idPromotion)) {
    return res.status(400).send("ID invalide");
  }

  try {
    // Récupère la promotion, son offre, et vérifie l'ownership.
    const { promotion, offre } = await getOwnedPromotionContext(idPromotion, userId, res);
    if (!promotion) return;

    res.render("promotions/edit", {
      title: "Modifier la promotion",
      activePage: "offres",
      promotion,
      offre,
      formData: buildPromotionFormData(promotion),
      error: null,
    });
  } catch (err) {
    console.error("Erreur showEditPromotion:", err);
    res.status(500).send("Erreur serveur");
  }
}

/**
 * Traite la modification d'une promotion.
 * Route : POST /promotions/:id/edit
 */
async function handleEditPromotion(req, res) {
  const idPromotion = Number(req.params.id);
  const userId = req.session.user.id_user;

  if (!Number.isFinite(idPromotion)) {
    return res.status(400).send("ID invalide");
  }

  try {
    // Bloque la modification si la promotion ne dépend pas d'une offre de l'utilisateur.
    const { promotion, offre } = await getOwnedPromotionContext(idPromotion, userId, res);
    if (!promotion) return;

    // On applique la même normalisation et validation qu'à la création.
    const data = normalizePromotionData(req.body);
    const error = validatePromotionData(data, offre);

    if (error) {
      return res.render("promotions/edit", {
        title: "Modifier la promotion",
        activePage: "offres",
        promotion,
        offre,
        formData: req.body,
        error,
      });
    }

    await promotionsModel.updatePromotion(idPromotion, data);

    res.redirect(`/offres/${promotion.id_offre}?promotionSuccess=edit`);
  } catch (err) {
    console.error("Erreur handleEditPromotion:", err);
    res.status(500).send("Erreur serveur");
  }
}

/**
 * Supprime une promotion.
 * Route : POST /promotions/:id/delete
 */
async function handleDeletePromotion(req, res) {
  const idPromotion = Number(req.params.id);
  const userId = req.session.user.id_user;

  if (!Number.isFinite(idPromotion)) {
    return res.status(400).send("ID invalide");
  }

  try {
    // On récupère d'abord la promotion pour connaître son offre de redirection.
    const promotion = await promotionsModel.getPromotionById(idPromotion);
    if (!promotion) {
      return res.status(404).render("404", {
        title: "Promotion introuvable",
        message: "Cette promotion n'existe pas.",
        activePage: "",
      });
    }

    // Sécurité : vérifie que la promotion appartient bien à une offre de l'agriculteur.
    const isOwner = await promotionsModel.isPromotionOwnedByAgriculteur(idPromotion, userId);
    if (!isOwner) {
      return renderForbidden(res, "Vous ne pouvez supprimer que les promotions de vos propres offres.");
    }

    await promotionsModel.deletePromotion(idPromotion);

    res.redirect(`/offres/${promotion.id_offre}?promotionSuccess=delete`);
  } catch (err) {
    console.error("Erreur handleDeletePromotion:", err);
    res.redirect("/offres/mes-offres");
  }
}

/**
 * Fonction utilitaire commune aux actions d'édition.
 * Elle évite de répéter la récupération de la promotion, de l'offre et le contrôle
 * de propriété dans showEditPromotion() et handleEditPromotion().
 */
async function getOwnedPromotionContext(idPromotion, userId, res) {
  const promotion = await promotionsModel.getPromotionById(idPromotion);
  if (!promotion) {
    res.status(404).render("404", {
      title: "Promotion introuvable",
      message: "Cette promotion n'existe pas.",
      activePage: "",
    });
    return {};
  }

  // Cette vérification protège les URLs appelées manuellement.
  const isOwner = await promotionsModel.isPromotionOwnedByAgriculteur(idPromotion, userId);
  if (!isOwner) {
    renderForbidden(res, "Vous ne pouvez gérer que les promotions de vos propres offres.");
    return {};
  }

  const offre = await offresModel.getOffreById(promotion.id_offre);
  return { promotion, offre };
}

/**
 * Transforme les données brutes du formulaire en valeurs prêtes pour le modèle.
 */
function normalizePromotionData(body) {
  return {
    type_promotion: normalizePromotionType(body.type_promotion),
    libelle: body.libelle ? body.libelle.trim() : "",
    valeur: parseRequiredNumber(body.valeur),
    // Le code promo a été retiré de l'interface, on force donc null.
    code_promo: null,
    quantite_min: parseOptionalNumber(body.quantite_min),
    montant_min: parseOptionalNumber(body.montant_min),
    date_debut: body.date_debut || null,
    date_fin: body.date_fin || null,
    active: body.active === "on" || body.active === "true" || body.active === "1",
    id_produit: body.id_produit ? Number(body.id_produit) : null,
  };
}

/**
 * Compatibilité : si une ancienne page ou ancienne donnée envoie "MONTANT",
 * on le convertit vers la valeur acceptée par la base : "MONTANT_FIXE".
 */
function normalizePromotionType(value) {
  const type = value ? value.trim() : "";
  const aliases = {
    MONTANT: "MONTANT_FIXE",
  };

  return aliases[type] || type;
}

/**
 * Valide les règles métier avant d'appeler le modèle.
 */
function validatePromotionData(data, offre) {
  if (!data.type_promotion) {
    return "Le type de promotion est obligatoire.";
  }

  // Empêche l'envoi d'un type non proposé par l'interface.
  if (!PROMOTION_TYPES.includes(data.type_promotion)) {
    return "Le type de promotion sélectionné n'est pas valide.";
  }

  if (!data.libelle) {
    return "Le libellé de la promotion est obligatoire.";
  }

  if (!Number.isFinite(data.valeur) || data.valeur < 0) {
    return "La valeur de la promotion doit être un nombre positif.";
  }

  if (data.quantite_min !== null && (!Number.isFinite(data.quantite_min) || data.quantite_min < 0)) {
    return "La quantité minimale doit être un nombre positif.";
  }

  if (data.montant_min !== null && (!Number.isFinite(data.montant_min) || data.montant_min < 0)) {
    return "Le montant minimal doit être un nombre positif.";
  }

  // Si un produit est sélectionné, il doit appartenir à l'offre courante.
  if (data.id_produit && !getPromotionProduct(data, offre)) {
    return "Le produit sélectionné n'appartient pas à cette offre.";
  }

  if (data.date_debut && data.date_fin && data.date_fin < data.date_debut) {
    return "La date de fin doit être postérieure à la date de début.";
  }

  if (data.type_promotion === "QUANTITE") {
    const availableQuantity = getAvailablePromotionQuantity(data, offre);
    const promotionQuantities = [data.valeur, data.quantite_min].filter((quantity) => quantity !== null);

    if (promotionQuantities.some((quantity) => quantity > availableQuantity)) {
      return "La quantité de la promotion ne peut pas dépasser la quantité disponible.";
    }
  }

  return null;
}

function getPromotionProduct(data, offre) {
  return offre.produits.find((p) => Number(p.id_produit) === data.id_produit);
}

function getAvailablePromotionQuantity(data, offre) {
  const product = data.id_produit ? getPromotionProduct(data, offre) : null;

  if (product) {
    return Number(product.quantite) || 0;
  }

  return offre.produits.reduce((total, productItem) => {
    return total + (Number(productItem.quantite) || 0);
  }, 0);
}

// Conversion obligatoire : valeur doit être renseignée.
function parseRequiredNumber(value) {
  if (value === undefined || value === null || value === "") return NaN;
  return Number(value);
}

// Conversion optionnelle : une chaîne vide devient null en base.
function parseOptionalNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  return Number(value);
}

/**
 * Prépare les données d'une promotion existante pour pré-remplir le formulaire.
 */
function buildPromotionFormData(promotion) {
  return {
    type_promotion: promotion.type_promotion || "",
    libelle: promotion.libelle || "",
    valeur: promotion.valeur ?? "",
    quantite_min: promotion.quantite_min ?? "",
    montant_min: promotion.montant_min ?? "",
    date_debut: formatDateInput(promotion.date_debut),
    date_fin: formatDateInput(promotion.date_fin),
    active: promotion.active ? "on" : "",
    id_produit: promotion.id_produit || "",
  };
}

// Les inputs HTML type="date" attendent le format YYYY-MM-DD.
function formatDateInput(value) {
  if (!value) return "";
  return new Date(value).toISOString().split("T")[0];
}

// Affiche une page 403 avec le template 404 existant du projet.
function renderForbidden(res, message) {
  return res.status(403).render("404", {
    title: "Accès interdit",
    message,
    activePage: "",
  });
}

// Export des actions utilisées par promotions.routes.js.
module.exports = {
  showCreatePromotion,
  handleCreatePromotion,
  showEditPromotion,
  handleEditPromotion,
  handleDeletePromotion,
};
