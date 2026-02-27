/**
 * demandes.controller.js
 * -----------------------
 * Ce fichier contient la logique métier pour toutes les actions liées
 * aux demandes de produits.
 *
 * Architecture MVC — couche "Controller" :
 *   Le contrôleur est le chef d'orchestre. Il :
 *     1. Reçoit la requête HTTP (depuis les routes)
 *     2. Appelle le modèle pour obtenir ou modifier les données en base
 *     3. Envoie le résultat à la vue EJS pour l'affichage
 *
 * Fonctions exportées :
 *   - listDemandes          : GET  /demandes               → liste publique
 *   - listMesDemandes       : GET  /demandes/mes-demandes  → demandes du particulier
 *   - showCreerDemande      : GET  /demandes/creer         → formulaire de création
 *   - handleCreerDemande    : POST /demandes/creer         → traite la création
 *   - showDemande           : GET  /demandes/:id           → détail d'une demande
 *   - handleRepondreDemande : POST /demandes/:id/repondre  → réponse agriculteur
 *   - handleCloturerDemande : POST /demandes/:id/cloturer  → clôturer une demande
 *   - showEditDemande       : GET  /demandes/:id/edit      → formulaire de modification
 *   - handleEditDemande     : POST /demandes/:id/edit      → traite la modification
 *   - handleDeleteDemande   : POST /demandes/:id/delete    → supprime une demande
 */

// Import du modèle (couche SQL)
const demandesModel = require('../models/demandes.model');


/**
 * listDemandes
 * -------------
 * Affiche la liste publique de toutes les demandes OUVERTES.
 * Accessible à tout le monde (connecté ou non).
 *
 * Route : GET /demandes
 */
async function listDemandes(req, res) {
  try {
    // On récupère toutes les demandes ouvertes via le modèle
    const demandes = await demandesModel.getAllDemandes();

    // On affiche la vue en passant les données
    // success : true si on vient de créer une demande avec succès (query param ?success=1)
    res.render('demandes/index', {
      title:     'Demandes de produits',
      activePage: 'demandes',
      demandes,
      success:   req.query.success === '1',
    });
  } catch (err) {
    console.error('Erreur listDemandes:', err);
    res.status(500).send('Erreur serveur');
  }
}


/**
 * listMesDemandes
 * ----------------
 * Affiche les demandes du particulier connecté, avec les réponses reçues.
 * Accessible uniquement aux particuliers connectés.
 *
 * Route : GET /demandes/mes-demandes
 */
async function listMesDemandes(req, res) {
  try {
    const userId = req.session.user.id_user;

    // On récupère les demandes de cet utilisateur
    const demandes = await demandesModel.getDemandesByUser(userId);

    res.render('demandes/mes-demandes', {
      title:      'Mes demandes',
      activePage: 'demandes',
      demandes,
      // '1' = création, 'edit' = modification, 'delete' = suppression, true = clôture
      success:    req.query.success || false,
    });
  } catch (err) {
    console.error('Erreur listMesDemandes:', err);
    res.status(500).send('Erreur serveur');
  }
}


/**
 * showCreerDemande
 * -----------------
 * Affiche le formulaire pour créer une nouvelle demande.
 * Accessible uniquement aux particuliers connectés (middleware isParticulier).
 *
 * Route : GET /demandes/creer
 */
function showCreerDemande(req, res) {
  res.render('demandes/creer', {
    title:      'Déposer une demande',
    activePage: 'demandes',
    error:      null,     // Pas d'erreur à l'affichage initial
    formData:   {},       // Formulaire vide au départ
  });
}


/**
 * handleCreerDemande
 * -------------------
 * Traite le formulaire de création d'une demande.
 * Valide les données, puis insère en base.
 *
 * Route : POST /demandes/creer
 */
async function handleCreerDemande(req, res) {
  /*
   * req.body contient les données du formulaire HTML.
   * On les "déstructure" pour nommer les variables proprement.
   */
  const { titre, description, produit_recherche, quantite_souhaitee, unite } = req.body;
  const userId = req.session.user.id_user;

  // ── Validation des données ─────────────────────────────────
  // On vérifie que les champs obligatoires sont remplis

  if (!titre || titre.trim() === '') {
    return res.render('demandes/creer', {
      title:      'Déposer une demande',
      activePage: 'demandes',
      error:      'Le titre de la demande est obligatoire.',
      formData:   req.body,
    });
  }

  if (!produit_recherche || produit_recherche.trim() === '') {
    return res.render('demandes/creer', {
      title:      'Déposer une demande',
      activePage: 'demandes',
      error:      'Veuillez indiquer le produit recherché.',
      formData:   req.body,
    });
  }

  try {
    // ── Création en base ───────────────────────────────────────
    await demandesModel.createDemande(userId, {
      titre:              titre.trim(),
      description:        description ? description.trim() : null,
      produit_recherche:  produit_recherche.trim(),
      quantite_souhaitee: quantite_souhaitee ? parseFloat(quantite_souhaitee) : null,
      unite:              unite || null,
    });

    // ── Redirection après succès ───────────────────────────────
    // On redirige vers la liste des demandes avec un paramètre ?success=1
    // pour afficher un message de confirmation
    res.redirect('/demandes?success=1');

  } catch (err) {
    console.error('Erreur handleCreerDemande:', err);
    res.render('demandes/creer', {
      title:      'Déposer une demande',
      activePage: 'demandes',
      error:      'Une erreur est survenue. Veuillez réessayer.',
      formData:   req.body,
    });
  }
}


/**
 * showRepondreDemande
 * --------------------
 * Affiche la page de détail d'une demande + le formulaire de réponse
 * si l'utilisateur est un agriculteur.
 *
 * Route : GET /demandes/:id
 */
async function showDemande(req, res) {
  try {
    const id = Number(req.params.id);

    // Vérification basique que l'id est un nombre valide
    if (!Number.isFinite(id)) {
      return res.status(400).send('ID invalide');
    }

    // Récupération de la demande complète (avec ses réponses)
    const demande = await demandesModel.getDemandeById(id);

    if (!demande) {
      return res.status(404).render('404', {
        title: 'Demande introuvable',
        message: 'Cette demande n\'existe pas ou a été supprimée.',
        activePage: '',
      });
    }

    res.render('demandes/show', {
      title:      demande.titre,
      activePage: 'demandes',
      demande,
      error:      req.query.error || null,
      success:    req.query.success === '1',
    });
  } catch (err) {
    console.error('Erreur showDemande:', err);
    res.status(500).send('Erreur serveur');
  }
}


/**
 * handleRepondreDemande
 * ----------------------
 * Traite la soumission d'une réponse d'un agriculteur à une demande.
 *
 * Route : POST /demandes/:id/repondre
 */
async function handleRepondreDemande(req, res) {
  const id      = Number(req.params.id);
  const message = req.body.message;
  const userId  = req.session.user.id_user;

  // Validation : le message ne peut pas être vide
  if (!message || message.trim() === '') {
    return res.redirect(`/demandes/${id}?error=Le message ne peut pas être vide.`);
  }

  try {
    // On enregistre la réponse en base
    await demandesModel.createReponseDemande(id, userId, message.trim());

    // Redirection vers la demande avec confirmation
    res.redirect(`/demandes/${id}?success=1`);

  } catch (err) {
    console.error('Erreur handleRepondreDemande:', err);
    res.redirect(`/demandes/${id}?error=Une erreur est survenue.`);
  }
}


/**
 * handleCloturerDemande
 * ----------------------
 * Permet à un particulier de clôturer sa propre demande.
 * Seul le propriétaire de la demande peut la clôturer.
 *
 * Route : POST /demandes/:id/cloturer
 */
async function handleCloturerDemande(req, res) {
  const id     = Number(req.params.id);
  const userId = req.session.user.id_user;

  try {
    await demandesModel.cloturerDemande(id, userId);
    res.redirect('/demandes/mes-demandes?success=1');
  } catch (err) {
    console.error('Erreur handleCloturerDemande:', err);
    res.redirect('/demandes/mes-demandes');
  }
}


/**
 * showEditDemande
 * ---------------
 * Affiche le formulaire de modification d'une demande existante.
 * Vérifie que l'utilisateur connecté est bien le propriétaire de la demande.
 * Seules les demandes au statut OUVERTE peuvent être modifiées.
 *
 * Route : GET /demandes/:id/edit
 */
async function showEditDemande(req, res) {
  try {
    const id     = Number(req.params.id);
    const userId = req.session.user.id_user;

    // Validation de l'identifiant
    if (!Number.isFinite(id)) {
      return res.status(400).send('ID invalide');
    }

    // Récupération de la demande complète
    const demande = await demandesModel.getDemandeById(id);

    // Demande introuvable → 404
    if (!demande) {
      return res.status(404).render('404', {
        title:      'Demande introuvable',
        message:    'Cette demande n\'existe pas ou a été supprimée.',
        activePage: '',
      });
    }

    // Vérification que l'utilisateur est bien le propriétaire
    if (demande.id_user_particulier !== userId) {
      console.warn(`[Demandes] Tentative de modification non autorisée : user ${userId} sur demande ${id}`);
      return res.status(403).render('404', {
        title:      'Accès interdit',
        message:    'Vous ne pouvez modifier que vos propres demandes.',
        activePage: '',
      });
    }

    // Une demande clôturée ne peut plus être modifiée
    if (demande.statut === 'CLOTUREE') {
      return res.status(403).render('404', {
        title:      'Modification impossible',
        message:    'Cette demande est clôturée et ne peut plus être modifiée.',
        activePage: '',
      });
    }

    res.render('demandes/edit', {
      title:      'Modifier la demande',
      activePage: 'demandes',
      demande,
      error:      null,
    });
  } catch (err) {
    console.error('Erreur showEditDemande:', err);
    res.status(500).send('Erreur serveur');
  }
}


/**
 * handleEditDemande
 * ------------------
 * Traite le formulaire de modification d'une demande.
 * Valide les données, vérifie l'ownership, puis met à jour en base.
 *
 * Route : POST /demandes/:id/edit
 */
async function handleEditDemande(req, res) {
  const id     = Number(req.params.id);
  const userId = req.session.user.id_user;

  const { titre, description, produit_recherche, quantite_souhaitee, unite } = req.body;

  // ── Validation des champs obligatoires ────────────────────────
  if (!titre || titre.trim() === '') {
    // Il faut recharger la demande pour afficher le formulaire
    const demande = await demandesModel.getDemandeById(id);
    return res.render('demandes/edit', {
      title:      'Modifier la demande',
      activePage: 'demandes',
      demande:    { ...demande, ...req.body }, // Fusionner pour garder les saisies
      error:      'Le titre de la demande est obligatoire.',
    });
  }

  if (!produit_recherche || produit_recherche.trim() === '') {
    const demande = await demandesModel.getDemandeById(id);
    return res.render('demandes/edit', {
      title:      'Modifier la demande',
      activePage: 'demandes',
      demande:    { ...demande, ...req.body },
      error:      'Veuillez indiquer le produit recherché.',
    });
  }

  try {
    // ── Mise à jour en base ────────────────────────────────────────
    // updateDemande vérifie l'ownership dans le WHERE (id_user_particulier = userId)
    const affected = await demandesModel.updateDemande(id, userId, {
      titre:              titre.trim(),
      description:        description ? description.trim() : null,
      produit_recherche:  produit_recherche.trim(),
      quantite_souhaitee: quantite_souhaitee ? parseFloat(quantite_souhaitee) : null,
      unite:              unite || null,
    });

    // Si 0 lignes affectées → la demande n'existe pas ou n'appartient pas à cet user
    if (affected === 0) {
      console.warn(`[Demandes] Échec modification : user ${userId} sur demande ${id}`);
      return res.status(403).render('404', {
        title:      'Accès interdit',
        message:    'Vous ne pouvez modifier que vos propres demandes.',
        activePage: '',
      });
    }

    console.log(`[Demandes] Demande ${id} modifiée par user ${userId}`);
    // Redirection vers "Mes demandes" avec confirmation
    res.redirect('/demandes/mes-demandes?success=edit');

  } catch (err) {
    console.error('Erreur handleEditDemande:', err);
    const demande = await demandesModel.getDemandeById(id);
    res.render('demandes/edit', {
      title:      'Modifier la demande',
      activePage: 'demandes',
      demande:    { ...demande, ...req.body },
      error:      'Une erreur est survenue. Veuillez réessayer.',
    });
  }
}


/**
 * handleDeleteDemande
 * --------------------
 * Supprime définitivement une demande et toutes ses réponses associées.
 * Seul le propriétaire de la demande peut la supprimer.
 *
 * Route : POST /demandes/:id/delete
 */
async function handleDeleteDemande(req, res) {
  const id     = Number(req.params.id);
  const userId = req.session.user.id_user;

  try {
    // deleteDemandeById vérifie l'ownership dans le WHERE
    const affected = await demandesModel.deleteDemandeById(id, userId);

    if (affected === 0) {
      console.warn(`[Demandes] Tentative de suppression non autorisée : user ${userId} sur demande ${id}`);
      return res.status(403).render('404', {
        title:      'Accès interdit',
        message:    'Vous ne pouvez supprimer que vos propres demandes.',
        activePage: '',
      });
    }

    console.log(`[Demandes] Demande ${id} supprimée par user ${userId}`);
    // Redirection vers "Mes demandes" avec confirmation de suppression
    res.redirect('/demandes/mes-demandes?success=delete');

  } catch (err) {
    console.error('Erreur handleDeleteDemande:', err);
    res.redirect('/demandes/mes-demandes');
  }
}


// On exporte toutes les fonctions pour les utiliser dans les routes
module.exports = {
  listDemandes,
  listMesDemandes,
  showCreerDemande,
  handleCreerDemande,
  showDemande,
  handleRepondreDemande,
  handleCloturerDemande,
  showEditDemande,
  handleEditDemande,
  handleDeleteDemande,
};
