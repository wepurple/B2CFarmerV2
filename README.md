# B2CFarmer — Documentation technique

> Plateforme de mise en relation directe entre agriculteurs locaux et particuliers.
> Circuit court · Sans intermédiaire · Sans commission.

---

## Table des matières

1. [Présentation du projet](#1-présentation-du-projet)
2. [Architecture et structure des dossiers](#2-architecture-et-structure-des-dossiers)
3. [Fonctionnement global](#3-fonctionnement-global)
4. [Modules et composants clés](#4-modules-et-composants-clés)
5. [Routes de l'application](#5-routes-de-lapplication)
6. [Base de données](#6-base-de-données)
7. [Installation et lancement](#7-installation-et-lancement)
8. [Variables d'environnement](#8-variables-denvironnement)
9. [Bonnes pratiques et notes techniques](#9-bonnes-pratiques-et-notes-techniques)

---

## 1. Présentation du projet

### Objectif

**B2CFarmer** est une application web qui connecte **particuliers** et **agriculteurs locaux** pour faciliter la vente et l'achat de produits agricoles en circuit court.

- Les **agriculteurs** publient des offres de produits avec prix et quantités disponibles, et répondent aux demandes des particuliers.
- Les **particuliers** consultent les offres, publient des demandes, ajoutent des produits au panier et passent commande directement auprès du producteur — **sans aucune commission prélevée**.

### Type d'application

Application web **full-stack rendu côté serveur** (SSR — Server-Side Rendering).
Le serveur Node.js génère les pages HTML complètes à chaque requête via le moteur de templates EJS.
Il n'y a pas d'API REST séparée ni de framework frontend (React, Vue…).

### Stack technique

| Couche | Technologie | Version |
|---|---|---|
| Runtime | Node.js | ≥ 18 |
| Framework web | Express | 5.x |
| Moteur de templates | EJS | 4.x |
| Base de données | PostgreSQL | 14+ |
| Driver SQL | pg (node-postgres) | 8.x |
| Hachage mots de passe | bcrypt | 6.x |
| Sessions | express-session | 1.x |
| Variables d'environnement | dotenv | — |
| Rechargement dev | nodemon | 3.x |

---

## 2. Architecture et structure des dossiers

L'application suit le **patron MVC** (Modèle – Vue – Contrôleur).
Chaque couche a une responsabilité unique et bien délimitée.

```
B2CFarmer/
│
├── app.js                          ← Point d'entrée : configure Express et monte les routes
├── package.json                    ← Dépendances npm et scripts
├── .env                            ← Variables d'environnement (non commité, voir .env.example)
├── .env.example                    ← Modèle de configuration à copier
│
├── assets/                         ← Ressources statiques publiques (images, logos…)
│
├── sql/
│   ├── schema.sql                  ← Création des tables (CREATE TABLE, contraintes, index)
│   └── seed.sql                    ← Données de test initiales
│
└── src/
    │
    ├── config/
    │   └── db.js                   ← Pool PostgreSQL via PoolAdapter (pg)
    │
    ├── middleware/
    │   ├── auth.middleware.js       ← Gardes d'accès (authentification, rôle utilisateur)
    │   └── panier.middleware.js     ← Initialisation du panier en session
    │
    ├── models/                     ← Requêtes SQL (une seule responsabilité : la DB)
    │   ├── auth.model.js           ← Utilisateurs (recherche, création)
    │   ├── offres.model.js         ← Offres agricoles + produits + messages de contact
    │   ├── demandes.model.js       ← Demandes de produits + réponses agriculteurs
    │   ├── panier.model.js         ← Lignes de panier, gestion des quantités
    │   └── commandes.model.js      ← Commandes : historique particulier + gestion agriculteur
    │
    ├── controllers/                ← Logique métier (reçoit requête → appelle modèle → rend vue)
    │   ├── auth.controller.js      ← Connexion, inscription, déconnexion
    │   ├── offres.controller.js    ← CRUD offres + contact
    │   ├── demandes.controller.js  ← CRUD demandes + réponses + clôture
    │   ├── compte.controller.js    ← Profil utilisateur (consultation, modification)
    │   ├── panier.controller.js    ← Ajout, modification, suppression, checkout
    │   └── commandes.controller.js ← Historique/détail (particulier) + gestion commandes reçues (agriculteur)
    │
    ├── routes/                     ← Association URL ↔ contrôleur (+ middlewares de sécurité)
    │   ├── auth.routes.js          ← /auth/*
    │   ├── offres.routes.js        ← /offres/*
    │   ├── demandes.routes.js      ← /demandes/*
    │   ├── compte.routes.js        ← /mon-compte
    │   ├── panier.routes.js        ← /panier/*
    │   └── commandes.routes.js     ← /commandes/*
    │
    ├── views/                      ← Templates EJS (génèrent le HTML)
    │   ├── navbar.ejs              ← Barre de navigation (incluse dans toutes les pages)
    │   ├── home.ejs                ← Page d'accueil
    │   ├── 404.ejs                 ← Page d'erreur (404 et 403)
    │   ├── auth/
    │   │   ├── login.ejs
    │   │   └── register.ejs
    │   ├── offres/
    │   │   ├── index.ejs           ← Liste des offres
    │   │   ├── show.ejs            ← Détail d'une offre
    │   │   ├── creer.ejs           ← Formulaire de création
    │   │   ├── edit.ejs            ← Formulaire de modification
    │   │   └── mes-offres.ejs      ← Mes offres (agriculteur connecté)
    │   ├── demandes/
    │   │   ├── index.ejs
    │   │   ├── show.ejs
    │   │   ├── creer.ejs
    │   │   ├── edit.ejs
    │   │   └── mes-demandes.ejs
    │   ├── panier/
    │   │   ├── index.ejs           ← Contenu du panier
    │   │   └── checkout.ejs        ← Récapitulatif avant validation
    │   ├── commandes/
    │   │   ├── index.ejs               ← Historique des commandes (particulier)
    │   │   ├── show.ejs                ← Détail d'une commande (particulier)
    │   │   ├── agriculteur-index.ejs   ← Commandes reçues (agriculteur)
    │   │   └── agriculteur-show.ejs    ← Détail + actions confirmer/annuler (agriculteur)
    │   └── compte/
    │       └── index.ejs           ← Profil utilisateur
    │
    └── public/
        └── css/
            └── style.css           ← Feuille de style unique (~800 lignes, variables CSS)
```

### Rôles résumés par couche

| Couche | Dossier | Responsabilité |
|---|---|---|
| **Configuration** | `src/config/` | Pool de connexion SQL, paramètres globaux |
| **Middlewares** | `src/middleware/` | Vérifications intermédiaires (auth, rôle, panier) avant les contrôleurs |
| **Modèles** | `src/models/` | Requêtes SQL encapsulées. Seuls fichiers à communiquer avec la DB |
| **Contrôleurs** | `src/controllers/` | Logique métier : lisent la requête, appellent le modèle, rendent la vue |
| **Routes** | `src/routes/` | Déclaration des URLs et méthodes HTTP. Application des middlewares de sécurité |
| **Vues** | `src/views/` | Templates EJS compilés en HTML par le serveur avant envoi au navigateur |

---

## 3. Fonctionnement global

### Démarrage du serveur

```bash
npm run dev   # développement (nodemon — rechargement automatique)
npm start     # production (node)
```

Lors du démarrage, `app.js` :
1. Charge les variables d'environnement (`.env` via dotenv)
2. Configure le moteur de templates EJS
3. Sert les fichiers statiques (`/css`, `/assets`)
4. Active le parsing des formulaires HTML (`urlencoded`)
5. Configure les sessions (`express-session`)
6. Applique les middlewares globaux (panier, injection de `user` dans les vues)
7. Monte tous les routeurs
8. Enregistre le gestionnaire d'erreur 404 (en dernier)
9. Lance le serveur sur le port configuré (défaut : `3000`)

---

### Flux d'une requête HTTP

```
Navigateur
    │
    │  GET /offres
    ▼
Express — app.js
    │
    ├─► Middlewares globaux (exécutés à chaque requête)
    │     • express-session  → restaure/crée la session
    │     • initPanier       → initialise req.session.panier si absent
    │     • res.locals.user  → injecte l'utilisateur dans toutes les vues
    │
    ├─► Router /offres → offres.routes.js
    │     │
    │     ├─ Middleware de sécurité (si nécessaire)
    │     │    ex : isAuthenticated, isAgriculteur
    │     │
    │     └─ Contrôleur : offresController.listOffres()
    │           │
    │           ├─ offresModel.getAllOffres()
    │           │       │
    │           │       └─► Pool PostgreSQL → Requête SQL → Base de données
    │           │                         Retourne les lignes
    │           │
    │           └─ res.render("offres/index", { offres, user, title })
    │                   │
    │                   └─► EJS compile le template → HTML
    │
    ▼
Navigateur reçoit la page HTML complète
```

---

### Gestion des sessions et de l'authentification

L'authentification est basée sur `express-session` (stockage en mémoire RAM) :

- **Connexion** : le contrôleur vérifie les identifiants, compare le hash bcrypt, puis stocke `req.session.user = { id_user, prenom, nom, email, role, nom_exploitation }`.
- **Persistance** : un middleware global dans `app.js` copie `req.session.user` dans `res.locals.user` avant chaque rendu EJS. La variable `user` est donc disponible dans **tous** les templates sans passer manuellement.
- **Déconnexion** : la session est détruite via `req.session.destroy()`.
- **Protection des routes** : les middlewares `isAuthenticated`, `isAgriculteur`, `isParticulier` bloquent ou redirigent l'accès selon le contexte.

---

### Gestion du panier

Le panier est géré **entièrement en session** (`req.session.panier`) :

- Il est initialisé par `panier.middleware.js` à chaque requête.
- Le nombre d'articles est exposé dans `res.locals.panierCount` (affiché dans la navbar).
- Lors du **checkout**, les articles sont enregistrés en base de données sous forme de commande, et le panier est vidé.

---

## 4. Modules et composants clés

### `app.js` — Chef d'orchestre

Configure Express dans un ordre **strict et non modifiable** :

```
dotenv → EJS → static → urlencoded → session → panier → user → routes → 404
```

> Modifier cet ordre peut casser les sessions, le panier ou l'injection du contexte utilisateur.

---

### `src/config/db.js` — Pool de connexions SQL

```js
const pool = new PoolAdapter(new Pool({ host, user, password, database }));
```

Utilise un **pool** plutôt qu'une connexion unique : les connexions sont réutilisées entre les requêtes, ce qui améliore les performances et évite de saturer PostgreSQL.

---

### `src/middleware/auth.middleware.js` — Gardes d'accès

Quatre fonctions exportées, utilisées directement dans les définitions de routes :

| Middleware | Comportement si la condition n'est pas remplie |
|---|---|
| `isAuthenticated` | Redirige vers `/auth/login` |
| `isNotAuthenticated` | Redirige vers `/` (évite de revoir le formulaire de connexion) |
| `isAgriculteur` | Retourne HTTP 403 et affiche la page d'erreur |
| `isParticulier` | Retourne HTTP 403 et affiche la page d'erreur |

---

### `src/middleware/panier.middleware.js` — Panier session

Initialise `req.session.panier = []` si absent, et expose `res.locals.panierCount`.
Doit être déclaré **après** la configuration de la session dans `app.js`.

---

### Rôles utilisateur

| Rôle | Capacités |
|---|---|
| `PARTICULIER` | Consulter offres et demandes, envoyer des messages de contact, créer des demandes, gérer un panier, passer commande |
| `AGRICULTEUR` | Tout ce que peut un particulier + publier/modifier/supprimer ses offres, répondre aux demandes, **consulter les commandes reçues, les confirmer ou les annuler** |

Le rôle est défini à l'inscription et stocké dans la colonne `role` de la table `utilisateur`.

---

### Sécurité des mots de passe

Tous les mots de passe sont hachés avec **bcrypt** avant stockage.
Aucun mot de passe en clair n'est jamais conservé en base de données.
La comparaison lors de la connexion se fait avec `bcrypt.compare()`.

---

## 5. Routes de l'application

### Authentification — `/auth`

| Méthode | URL | Accès requis | Description |
|---|---|---|---|
| GET | `/auth/login` | Non connecté | Formulaire de connexion |
| POST | `/auth/login` | Non connecté | Traitement de la connexion |
| GET | `/auth/register` | Non connecté | Formulaire d'inscription |
| POST | `/auth/register` | Non connecté | Création du compte |
| POST | `/auth/logout` | Connecté | Destruction de la session |

### Offres — `/offres`

| Méthode | URL | Accès requis | Description |
|---|---|---|---|
| GET | `/offres` | Tous | Liste des offres actives |
| GET | `/offres/creer` | Agriculteur | Formulaire de création d'offre |
| POST | `/offres/creer` | Agriculteur | Enregistrement de l'offre |
| GET | `/offres/mes-offres` | Agriculteur | Ses propres offres |
| GET | `/offres/:id` | Tous | Détail d'une offre |
| GET | `/offres/:id/edit` | Agriculteur (propriétaire) | Formulaire de modification |
| POST | `/offres/:id/edit` | Agriculteur (propriétaire) | Enregistrement des modifications |
| POST | `/offres/:id/delete` | Agriculteur (propriétaire) | Suppression de l'offre |
| POST | `/offres/:id/contact` | Connecté | Message de contact à l'agriculteur |

### Demandes — `/demandes`

| Méthode | URL | Accès requis | Description |
|---|---|---|---|
| GET | `/demandes` | Tous | Liste des demandes ouvertes |
| GET | `/demandes/creer` | Particulier | Formulaire de création |
| POST | `/demandes/creer` | Particulier | Enregistrement de la demande |
| GET | `/demandes/mes-demandes` | Particulier | Ses propres demandes |
| GET | `/demandes/:id` | Tous | Détail d'une demande |
| GET | `/demandes/:id/edit` | Particulier (propriétaire) | Formulaire de modification |
| POST | `/demandes/:id/edit` | Particulier (propriétaire) | Enregistrement |
| POST | `/demandes/:id/delete` | Particulier (propriétaire) | Suppression |
| POST | `/demandes/:id/repondre` | Agriculteur | Répondre à la demande |
| POST | `/demandes/:id/cloturer` | Particulier (propriétaire) | Clôturer la demande |

### Commandes — `/commandes`

#### Espace particulier

| Méthode | URL | Accès requis | Description |
|---|---|---|---|
| GET | `/commandes` | Particulier | Historique de ses commandes passées |
| GET | `/commandes/:id` | Particulier (propriétaire) | Détail d'une commande |

#### Espace agriculteur

| Méthode | URL | Accès requis | Description |
|---|---|---|---|
| GET | `/commandes/agriculteur` | Agriculteur | Liste des commandes reçues sur ses offres |
| GET | `/commandes/agriculteur/:id` | Agriculteur | Détail d'une commande reçue (lignes de son exploitation uniquement) |
| POST | `/commandes/agriculteur/:id/confirmer` | Agriculteur | Confirme la commande : soustrait les stocks, peut clôturer l'offre si épuisée |
| POST | `/commandes/agriculteur/:id/annuler` | Agriculteur | Annule une commande `EN_ATTENTE` |

> La confirmation d'une commande déclenche automatiquement via une **transaction SQL** :
> 1. La soustraction des quantités commandées dans `offre_ligne`
> 2. La suppression des lignes de stock tombées à zéro ou en négatif
> 3. Le passage de l'offre au statut `TERMINEE` si elle ne contient plus aucun produit
> 4. La mise à jour du statut de la commande vers `CONFIRMEE`

### Autres modules

| Préfixe | Accès requis | Description |
|---|---|---|
| `/mon-compte` | Connecté | Consultation et modification du profil |
| `/panier` | Particulier | Gestion du panier et checkout |

### Pages accessibles sans connexion

| URL | Description |
|---|---|
| `/` | Page d'accueil |
| `/offres` | Liste publique des offres |
| `/offres/:id` | Détail d'une offre |
| `/demandes` | Liste publique des demandes |
| `/demandes/:id` | Détail d'une demande |

---

## 6. Base de données

**Nom de la base** : `agri_connect`

### Tables

| Table | Description |
|---|---|
| `utilisateur` | Tous les comptes utilisateurs (nom, email, mot de passe haché, rôle) |
| `agriculteur` | Informations d'exploitation liées à un compte AGRICULTEUR |
| `produit` | Référentiel de produits agricoles (libellé, unité, catégorie) |
| `offre` | Offres publiées par les agriculteurs (titre, description, dates, statut) |
| `offre_ligne` | Lignes d'une offre : association offre ↔ produit avec prix et quantité |
| `demande_contact` | Messages de contact d'un particulier sur une offre spécifique |

### Schéma des relations simplifiées

```
utilisateur ──(1:1)── agriculteur
     │                    │
     │               publie (1:N)
     │                    ▼
     │                  offre ──(1:N)── offre_ligne ──(N:1)── produit
     │                    │
     │            reçoit (1:N)
     │                    ▼
     │            demande_contact (message de particulier)
     │
 publie (1:N)
     ▼
 demande ──(1:N)── réponses d'agriculteurs
```

### Fichiers SQL

| Fichier | Contenu |
|---|---|
| `sql/schema.sql` | Structure complète : `CREATE TABLE`, clés primaires, clés étrangères, index |
| `sql/seed.sql` | Données de test : comptes, offres, produits exemples |

> **Attention** : les comptes insérés par `seed.sql` ont des hashes de mots de passe **factices**.
> Ils ne sont **pas utilisables** pour se connecter.
> Créez vos comptes de test directement via `/auth/register`.

---

## 7. Installation et lancement

### Prérequis

- [Node.js](https://nodejs.org/) ≥ 18
- PostgreSQL ≥ 14 installé et démarré en local
- npm (inclus avec Node.js)

### Étapes complètes

```bash
# 1. Cloner le dépôt
git clone https://github.com/wepurple/B2CFarmer.git
cd B2CFarmer

# 2. Installer les dépendances Node.js
npm install

# 3. Créer et remplir le fichier de configuration
cp .env.example .env
# → Éditer .env avec vos identifiants PostgreSQL et une SESSION_SECRET (voir section 8)

# 4. Créer la base de données et les tables
psql -U postgres < sql/schema.sql

# 5. (Optionnel) Charger des données de test
psql -U postgres -d agri_connect < sql/seed.sql

# 6. Lancer le serveur
npm run dev     # Mode développement (rechargement automatique avec nodemon)
# OU
npm start       # Mode production (node direct)
```

Le serveur démarre sur **[http://localhost:3000](http://localhost:3000)**.

### Comptes de test

| Profil | E-mail | Mot de passe |
|---|---|---|
| Particulier | `testparticulier@mail.fr` | `SioSlam2026@` |
| Agriculteur | `testagriculteur@mail.fr` | `SioSlam2026@` |

### Scripts disponibles

| Commande | Description |
|---|---|
| `npm run dev` | Démarre avec nodemon (rechargement automatique à chaque modification) |
| `npm start` | Démarre avec node (production) |

---

## 8. Variables d'environnement

Copier `.env.example` en `.env` et renseigner les valeurs :

```env
# Port d'écoute du serveur (défaut : 3000)
PORT=3000

# Connexion à la base de données PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_USER=votre_utilisateur_postgresql
DB_PASSWORD=votre_mot_de_passe
DB_NAME=agri_connect
DB_SSL=false

# Pour Supabase distant, utiliser l'hôte et l'utilisateur fournis par Supabase,
# puis activer SSL :
# DB_SSL=true

# Clé secrète pour signer les cookies de session
# Générer une clé aléatoire avec la commande suivante :
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=remplacez_par_une_cle_aleatoire_longue

# Environnement d'exécution
# En production : les cookies de session passent uniquement en HTTPS
NODE_ENV=development
```

> **Sécurité** : le fichier `.env` ne doit **jamais** être commité dans Git.
> Il est normalement listé dans `.gitignore`.

---

## 9. Bonnes pratiques et notes techniques

### Ordre des routes (règle critique Express)

Dans Express, les routes sont évaluées **dans l'ordre de déclaration**.
Les routes avec des segments **statiques** doivent toujours être déclarées **avant** celles avec des **paramètres dynamiques** (`/:id`).

```js
// ✅ Correct — "creer" est reconnu comme une route statique
router.get('/creer', isAuthenticated, isAgriculteur, controller.showCreer);
router.get('/:id',   controller.showOffre);

// ❌ Incorrect — "creer" serait traité comme la valeur du paramètre :id
router.get('/:id',   controller.showOffre);
router.get('/creer', controller.showCreer); // jamais atteint
```

---

### Sessions en mémoire — limitation importante

Par défaut, `express-session` stocke les sessions **en mémoire RAM du processus Node.js**.
Cela signifie que :
- Les sessions sont **perdues** à chaque redémarrage du serveur.
- Le stockage en mémoire n'est **pas adapté** à la production ou à plusieurs instances de serveur.

**Pour un déploiement en production**, utiliser un store persistant :
- `connect-pg-simple` (PostgreSQL — déjà configuré dans ce projet)
- `connect-redis` (Redis)

---

### Cookies de session — configuration sécurisée

Le cookie de session est configuré dans `app.js` avec :

| Option | Valeur | Effet |
|---|---|---|
| `httpOnly` | `true` | Inaccessible depuis JavaScript côté client (protection XSS) |
| `secure` | `true` en prod | Transmis uniquement via HTTPS (protection interception) |
| `maxAge` | 7 jours | Durée de vie de la session |
| `resave` | `false` | Ne réécrit pas la session si elle n'a pas changé |
| `saveUninitialized` | `false` | Ne crée pas de session pour les visiteurs non connectés |

---

### Pourquoi POST pour la déconnexion ?

La déconnexion est gérée par une requête `POST` (formulaire HTML), et non un lien `GET`.
Un lien GET pourrait être déclenché involontairement (prefetch de navigateur, crawlers, anti-virus)
et déconnecter l'utilisateur à son insu. Le `POST` exige une action utilisateur explicite.

---

*Projet réalisé dans le cadre d'un BTS — B2CFarmer, 2025.*
*Plateforme de circuit court : relier les producteurs aux consommateurs locaux.*
