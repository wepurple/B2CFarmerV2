/**
 * offres.controller.js
 * ---------------------
 * Ce fichier contient la logique métier pour toutes les actions liées
 * aux offres agricoles.
 *
 * Architecture MVC — couche "Controller" :
 *   Le contrôleur est le chef d'orchestre. Il :
 *     1. Reçoit la requête HTTP (depuis les routes)
 *     2. Appelle le modèle pour obtenir ou modifier les données en base
 *     3. Envoie le résultat à la vue EJS pour l'affichage
 *
 * Fonctions exportées :
 *   - listOffres        : GET /offres             → liste publique des offres
 *   - showOffre         : GET /offres/:id         → détail d'une offre
 *   - listMesOffres     : GET /offres/mes-offres  → offres de l'agriculteur connecté
 *   - showCreerOffre    : GET /offres/creer       → formulaire de création
 *   - handleCreerOffre  : POST /offres/creer      → traitement du formulaire
 *   - handleContact     : POST /offres/:id/contact → envoyer un message de contact
 */

// Import du modèle (couche SQL)
const offresModel = require('../models/offres.model');
const promotionsModel = require('../models/promotions.model');


/**
 * listOffres
 * -----------
 * Affiche la liste publique de toutes les offres actives.
 * Accessible à tout le monde.
 *
 * Route : GET /offres
 */
async function listOffres(req, res) {
  try {
    // Appel du modèle → requête SQL pour récupérer les offres
    const offres = await offresModel.getAllOffres();

    res.render('offres/index', {
      title:      'Offres disponibles',
      activePage: 'offres',
      offres,
    });
  } catch (err) {
    console.error('Erreur listOffres:', err);
    // HTTP 500 = erreur interne serveur
    res.status(500).send('Erreur serveur');
  }
}


/**
 * showOffre
 * ----------
 * Affiche le détail complet d'une offre.
 *
 * Route : GET /offres/:id
 * @param {string} req.params.id - L'identifiant de l'offre dans l'URL
 */
async function showOffre(req, res) {
  try {
    // On convertit l'id de string (URL) en nombre entier
    // Ex: URL /offres/3 → req.params.id = "3" → Number("3") = 3
    const id = Number(req.params.id);

    // Sécurité : vérifier que l'id est un nombre valide
    if (!Number.isFinite(id)) {
      return res.status(400).send('ID invalide');
    }

    // Appel SQL via le modèle
    const offre = await offresModel.getOffreById(id);

    // Si aucune offre trouvée → page 404
    if (!offre) {
      return res.status(404).render('404', {
        title:      'Offre introuvable',
        message:    'Cette offre n\'existe pas ou a été supprimée.',
        activePage: '',
      });
    }

    const currentUser = req.session && req.session.user ? req.session.user : null;
    const isOwner =
      currentUser &&
      currentUser.role === 'AGRICULTEUR' &&
      Number(currentUser.id_user) === Number(offre.id_user_agri);
    const promotions = isOwner
      ? await promotionsModel.getPromotionsByOffre(id)
      : [];

    res.render('offres/show', {
      title:          offre.titre,
      activePage:     'offres',
      offre,
      promotions,
      promotionSuccess: req.query.promotionSuccess || null,
      promotionError:   req.query.promotionError || null,
      // Messages de succès/erreur pour le formulaire de contact
      // Ces valeurs viennent des query params (ex: ?contactSuccess=1)
      contactSuccess: req.query.contactSuccess === '1',
      contactError:   req.query.contactError   || null,
    });
  } catch (err) {
    console.error('Erreur showOffre:', err);
    res.status(500).send('Erreur serveur');
  }
}


/**
 * listMesOffres
 * --------------
 * Affiche les offres de l'agriculteur actuellement connecté.
 * Accessible uniquement aux agriculteurs (middleware isAgriculteur dans les routes).
 *
 * Route : GET /offres/mes-offres
 */
async function listMesOffres(req, res) {
  try {
    const userId = req.session.user.id_user;

    // On récupère les offres de cet agriculteur spécifique
    const offres = await offresModel.getOffresByAgriculteur(userId);

    res.render('offres/mes-offres', {
      title:      'Mes offres',
      activePage: 'offres',
      offres,
      // Message contextuel : '1' (création), 'edit' (modification), 'delete' (suppression)
      success:    req.query.success || false,
    });
  } catch (err) {
    console.error('Erreur listMesOffres:', err);
    res.status(500).send('Erreur serveur');
  }
}


/**
 * showCreerOffre
 * ---------------
 * Affiche le formulaire de création d'une nouvelle offre.
 * Accessible uniquement aux agriculteurs (middleware isAgriculteur dans les routes).
 *
 * Route : GET /offres/creer
 */
function showCreerOffre(req, res) {
  res.render('offres/creer', {
    title:      'Déposer une offre',
    activePage: 'offres',
    error:      null,   // Pas d'erreur au premier affichage
    formData:   {},     // Formulaire vide
  });
}


/**
 * handleCreerOffre
 * -----------------
 * Traite le formulaire de création d'une offre.
 * Crée l'offre en base, puis les lignes de produits associées.
 *
 * Données attendues dans req.body :
 *   - titre              : titre de l'offre (obligatoire)
 *   - description        : description (optionnel)
 *   - date_debut         : date de début (optionnel)
 *   - date_fin           : date de fin (optionnel)
 *   - produit_libelle[]  : noms des produits (tableau)
 *   - produit_unite[]    : unités (tableau)
 *   - produit_categorie[]: catégories (tableau)
 *   - produit_prix[]     : prix unitaires (tableau)
 *   - produit_qte[]      : quantités disponibles (tableau)
 *
 * Route : POST /offres/creer
 */
async function handleCreerOffre(req, res) {
  const { titre, description, date_debut, date_fin } = req.body;
  const userId = req.session.user.id_user;

  // ── Validation : titre obligatoire ────────────────────────────
  if (!titre || titre.trim() === '') {
    return res.render('offres/creer', {
      title:      'Déposer une offre',
      activePage: 'offres',
      error:      'Le titre de l\'offre est obligatoire.',
      formData:   req.body,
    });
  }

  /*
   * Récupération des lignes de produits depuis le formulaire.
   *
   * Le formulaire envoie des tableaux avec la syntaxe : produit_libelle[]
   * Si un seul produit → express reçoit une string (pas un tableau).
   * Si plusieurs produits → express reçoit un tableau de strings.
   * On normalise avec la fonction toArray() pour toujours avoir un tableau.
   */
  const libelles   = toArray(req.body.produit_libelle);
  const unites     = toArray(req.body.produit_unite);
  const categories = toArray(req.body.produit_categorie);
  const prixArr    = toArray(req.body.produit_prix);
  const quantites  = toArray(req.body.produit_qte);

  // On filtre les lignes incomplètes (libellé, prix ou quantité manquants)
  const produits = libelles
    .map((lib, i) => ({
      libelle:   lib && lib.trim(),
      unite:     unites[i]     || 'kg',
      categorie: categories[i] || 'autre',
      prix:      parseFloat(prixArr[i]),
      quantite:  parseFloat(quantites[i]),
    }))
    .filter(p => p.libelle && !isNaN(p.prix) && !isNaN(p.quantite));

  // Validation : au moins 1 produit doit être saisi et valide
  if (produits.length === 0) {
    return res.render('offres/creer', {
      title:      'Déposer une offre',
      activePage: 'offres',
      error:      'Ajoutez au moins un produit avec un nom, un prix et une quantité.',
      formData:   req.body,
    });
  }

  try {
    // ── Étape 1 : Créer l'offre principale ──────────────────────
    // createOffre() retourne l'id de la nouvelle offre
    const idOffre = await offresModel.createOffre(userId, {
      titre:       titre.trim(),
      description: description ? description.trim() : null,
      date_debut:  date_debut  || null,
      date_fin:    date_fin    || null,
    });

    // ── Étape 2 : Ajouter chaque produit à l'offre ──────────────
    // Pour chaque ligne produit :
    //   1. findOrCreateProduit → cherche ou crée le produit dans la table produit
    //   2. createOffreLigne → lie ce produit à l'offre (avec prix et quantité)
    for (const p of produits) {
      const idProduit = await offresModel.findOrCreateProduit(p.libelle, p.unite, p.categorie);
      await offresModel.createOffreLigne(idOffre, idProduit, p.prix, p.quantite);
    }

    // ── Redirection avec confirmation ───────────────────────────
    // On redirige vers "Mes offres" avec ?success=1 pour afficher un message
    res.redirect('/offres/mes-offres?success=1');

  } catch (err) {
    console.error('Erreur handleCreerOffre:', err);
    res.render('offres/creer', {
      title:      'Déposer une offre',
      activePage: 'offres',
      error:      'Une erreur est survenue lors de la création. Veuillez réessayer.',
      formData:   req.body,
    });
  }
}


/**
 * handleContact
 * --------------
 * Traite le formulaire de contact d'un particulier vers l'agriculteur
 * d'une offre spécifique. Enregistre le message dans demande_contact.
 *
 * Route : POST /offres/:id/contact
 */
async function handleContact(req, res) {
  const id      = Number(req.params.id);
  const message = req.body.message;
  const userId  = req.session.user.id_user;

  // Validation : le message ne peut pas être vide
  if (!message || message.trim() === '') {
    return res.redirect(`/offres/${id}?contactError=Le message ne peut pas être vide.`);
  }

  try {
    // Enregistrement du message de contact en base
    await offresModel.createDemandeContact(userId, id, message.trim());

    // Redirection vers l'offre avec une confirmation de succès
    res.redirect(`/offres/${id}?contactSuccess=1`);

  } catch (err) {
    console.error('Erreur handleContact:', err);
    res.redirect(`/offres/${id}?contactError=Une erreur est survenue.`);
  }
}


/**
 * showEditOffre
 * --------------
 * Affiche le formulaire de modification d'une offre existante.
 * Vérifie que l'utilisateur connecté est bien le propriétaire de l'offre.
 *
 * Route : GET /offres/:id/edit
 */
async function showEditOffre(req, res) {
  try {
    const id     = Number(req.params.id);
    const userId = req.session.user.id_user;

    // Sécurité : vérifier que l'id est un nombre valide
    if (!Number.isFinite(id)) {
      return res.status(400).send('ID invalide');
    }

    // Récupération de l'offre (avec produits, dates, etc.)
    const offre = await offresModel.getOffreById(id);

    // Offre inexistante → 404
    if (!offre) {
      return res.status(404).render('404', {
        title:      'Offre introuvable',
        message:    'Cette offre n\'existe pas ou a été supprimée.',
        activePage: '',
      });
    }

    // Ownership check : l'offre doit appartenir à l'utilisateur connecté
    if (offre.id_user_agri !== userId) {
      console.warn(`[Offres] Tentative de modification non autorisée : user ${userId} sur offre ${id}`);
      return res.status(403).render('404', {
        title:      'Accès interdit',
        message:    'Vous ne pouvez modifier que vos propres offres.',
        activePage: '',
      });
    }

    // Formater les dates pour les champs <input type="date"> (YYYY-MM-DD)
    const formData = {
      titre:       offre.titre,
      description: offre.description || '',
      date_debut:  offre.date_debut ? new Date(offre.date_debut).toISOString().split('T')[0] : '',
      date_fin:    offre.date_fin   ? new Date(offre.date_fin).toISOString().split('T')[0]   : '',
      statut:      offre.statut,
    };

    res.render('offres/edit', {
      title:      'Modifier l\'offre',
      activePage: 'offres',
      offre,
      formData,
      error:      null,
    });
  } catch (err) {
    console.error('Erreur showEditOffre:', err);
    res.status(500).send('Erreur serveur');
  }
}


/**
 * handleEditOffre
 * ----------------
 * Traite le formulaire de modification d'une offre.
 * Met à jour les informations de base + supprime et recrée les lignes de produits.
 *
 * Route : POST /offres/:id/edit
 */
async function handleEditOffre(req, res) {
  const id     = Number(req.params.id);
  const userId = req.session.user.id_user;

  const { titre, description, date_debut, date_fin, statut } = req.body;

  // ── Validation de base ───────────────────────────────────────
  if (!titre || titre.trim() === '') {
    // Il faut recharger l'offre pour le formulaire
    const offre = await offresModel.getOffreById(id);
    return res.render('offres/edit', {
      title:      'Modifier l\'offre',
      activePage: 'offres',
      offre,
      formData:   req.body,
      error:      'Le titre de l\'offre est obligatoire.',
    });
  }

  // Validation du statut (seuls ces 3 statuts sont autorisés dans l'ENUM)
  const statutsValides = ['ACTIVE', 'PAUSE', 'TERMINEE'];
  const statutFinal = statutsValides.includes(statut) ? statut : 'ACTIVE';

  // Récupération et normalisation des produits
  const libelles   = toArray(req.body.produit_libelle);
  const unites     = toArray(req.body.produit_unite);
  const categories = toArray(req.body.produit_categorie);
  const prixArr    = toArray(req.body.produit_prix);
  const quantites  = toArray(req.body.produit_qte);

  const produits = libelles
    .map((lib, i) => ({
      libelle:   lib && lib.trim(),
      unite:     unites[i]     || 'kg',
      categorie: categories[i] || 'autre',
      prix:      parseFloat(prixArr[i]),
      quantite:  parseFloat(quantites[i]),
    }))
    .filter(p => p.libelle && !isNaN(p.prix) && !isNaN(p.quantite));

  if (produits.length === 0) {
    const offre = await offresModel.getOffreById(id);
    return res.render('offres/edit', {
      title:      'Modifier l\'offre',
      activePage: 'offres',
      offre,
      formData:   req.body,
      error:      'Ajoutez au moins un produit avec un nom, un prix et une quantité.',
    });
  }

  try {
    // ── Étape 1 : Mettre à jour l'offre principale ───────────────
    // updateOffre vérifie l'ownership dans le WHERE (id_user_agri = userId)
    const affected = await offresModel.updateOffre(id, userId, {
      titre:       titre.trim(),
      description: description ? description.trim() : null,
      date_debut:  date_debut || null,
      date_fin:    date_fin   || null,
      statut:      statutFinal,
    });

    // Si 0 lignes affectées → l'offre n'existe pas ou n'appartient pas à cet user
    if (affected === 0) {
      console.warn(`[Offres] Échec modification : user ${userId} sur offre ${id}`);
      return res.status(403).render('404', {
        title:      'Accès interdit',
        message:    'Vous ne pouvez modifier que vos propres offres.',
        activePage: '',
      });
    }

    // ── Étape 2 : Supprimer les anciennes lignes de produit ──────
    await offresModel.deleteOffreLignes(id);

    // ── Étape 3 : Recréer les lignes avec les nouvelles données ──
    for (const p of produits) {
      const idProduit = await offresModel.findOrCreateProduit(p.libelle, p.unite, p.categorie);
      await offresModel.createOffreLigne(id, idProduit, p.prix, p.quantite);
    }

    // Redirection vers "Mes offres" avec confirmation
    console.log(`[Offres] Offre ${id} modifiée par user ${userId}`);
    res.redirect('/offres/mes-offres?success=edit');

  } catch (err) {
    console.error('Erreur handleEditOffre:', err);
    const offre = await offresModel.getOffreById(id);
    res.render('offres/edit', {
      title:      'Modifier l\'offre',
      activePage: 'offres',
      offre,
      formData:   req.body,
      error:      'Une erreur est survenue lors de la modification. Veuillez réessayer.',
    });
  }
}


/**
 * handleDeleteOffre
 * ------------------
 * Supprime une offre (soft-delete : positionne deleted_at à NOW()).
 * L'offre n'est pas physiquement supprimée de la base — elle est juste masquée.
 *
 * Vérifie que l'utilisateur connecté est bien le propriétaire de l'offre.
 *
 * Route : POST /offres/:id/delete
 */
async function handleDeleteOffre(req, res) {
  const id     = Number(req.params.id);
  const userId = req.session.user.id_user;

  try {
    // deleteOffre vérifie l'ownership dans le WHERE
    const affected = await offresModel.deleteOffre(id, userId);

    if (affected === 0) {
      console.warn(`[Offres] Tentative de suppression non autorisée : user ${userId} sur offre ${id}`);
      return res.status(403).render('404', {
        title:      'Accès interdit',
        message:    'Vous ne pouvez supprimer que vos propres offres.',
        activePage: '',
      });
    }

    console.log(`[Offres] Offre ${id} supprimée (soft-delete) par user ${userId}`);
    res.redirect('/offres/mes-offres?success=delete');

  } catch (err) {
    console.error('Erreur handleDeleteOffre:', err);
    res.redirect('/offres/mes-offres');
  }
}


/**
 * toArray
 * --------
 * Fonction utilitaire : normalise une valeur en tableau.
 *
 * Pourquoi ? Express retourne :
 *   - un tableau si le formulaire a plusieurs inputs portant le même nom
 *   - une string si le formulaire en a un seul
 *   - undefined si aucun input de ce nom
 *
 * @param {*} val - La valeur à normaliser
 * @returns {Array}
 */
function toArray(val) {
  if (Array.isArray(val)) return val;
  if (val === undefined || val === null) return [];
  return [val];
}


// On exporte toutes les fonctions pour les utiliser dans les routes
module.exports = {
  listOffres,
  showOffre,
  listMesOffres,
  showCreerOffre,
  handleCreerOffre,
  handleContact,
  showEditOffre,
  handleEditOffre,
  handleDeleteOffre,
};
