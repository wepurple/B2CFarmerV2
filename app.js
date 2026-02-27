// @ts-nocheck

/**
 * app.js
 * -------
 * Point d'entrée principal de l'application Express.
 * C'est ce fichier qui est lancé par "npm start" ou "npm run dev".
 *
 * Il configure :
 *   1. Le moteur de templates (EJS)
 *   2. Les fichiers statiques (CSS, images)
 *   3. Le parsing des formulaires
 *   4. Les sessions utilisateur
 *   5. Les routes de l'application
 *   6. Le gestionnaire d'erreur 404
 */

// dotenv charge les variables définies dans le fichier .env
// et les rend accessibles via process.env.NOM_VARIABLE
require("dotenv").config();

const express = require("express");
const path = require("path");
const session = require("express-session"); // Gestion des sessions utilisateur

const app = express();
const PORT = process.env.PORT || 3000;

// ── Import des routeurs ──────────────────────────────────────
// Chaque routeur gère un groupe de routes liées à une fonctionnalité
const offresRoutes = require("./src/routes/offres.routes");
const authRoutes = require("./src/routes/auth.routes");
const demandesRoutes = require("./src/routes/demandes.routes");
const compteRoutes = require("./src/routes/compte.routes");
const panierRoutes = require("./src/routes/panier.routes");
const commandesRoutes = require("./src/routes/commandes.routes");

// ── 1) Moteur de templates EJS ───────────────────────────────
// EJS permet d'écrire des fichiers HTML avec du JavaScript intégré.
// Les fichiers .ejs se trouvent dans src/views/
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "src", "views"));

// ── 2) Fichiers statiques ────────────────────────────────────
// Les fichiers dans src/public/ sont accessibles directement dans le navigateur.
// Ex: src/public/css/style.css → accessible sur http://localhost:3000/css/style.css
app.use(express.static(path.join(__dirname, "src", "public")));
// Les fichiers dans assets/ sont accessibles via /assets
app.use("/assets", express.static(path.join(__dirname, "assets")));

// ── 3) Parsing des formulaires ───────────────────────────────
// Permet de lire les données envoyées par les formulaires HTML (method="post")
// Les données sont accessibles dans req.body (ex: req.body.email)
app.use(express.urlencoded({ extended: true }));

// ── Trust proxy (Vercel / reverse proxy) ─────────────────────
// Vercel termine le SSL et transmet les requêtes en HTTP interne.
// Sans ce paramètre, req.secure = false et express-session ne pose
// jamais le cookie de session (cookie.secure: true ignoré côté client).
app.set("trust proxy", 1);

// ── 4) Sessions utilisateur ──────────────────────────────────
// Une session est une façon de mémoriser qu'un utilisateur est connecté
// entre plusieurs requêtes HTTP (car HTTP est "sans état" par défaut).
//
// express-session stocke un identifiant de session dans un cookie
// côté navigateur, et les données côté serveur (PostgreSQL).
//
// Pour la production, nous utilisons connect-pg-simple pour stocker
// les sessions en base PostgreSQL plutôt qu'en mémoire.
const pgSession = require("connect-pg-simple")(session);
const { Pool } = require("pg");

// Pool PostgreSQL dédié pour les sessions (partagé, mais limité)
const sessionPool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
  // Options optimisées pour Vercel
  max: process.env.NODE_ENV === "production" ? 3 : 10,
  idleTimeoutMillis: process.env.NODE_ENV === "production" ? 10000 : 30000,
  connectionTimeoutMillis: 5000,
});

// Gestion des erreurs pool
sessionPool.on("error", (err) => {
  console.error("❌ Erreur pool sessions PostgreSQL:", err.message);
});

app.use(
  session({
    // La clé secrète qui signe le cookie de session (lire depuis .env !)
    // Elle ne doit JAMAIS être exposée dans le code source public.
    secret: process.env.SESSION_SECRET || "b2cfarmer_secret_dev",

    // Store les sessions en PostgreSQL (création automatique de la table)
    store: new pgSession({
      pool: sessionPool,
      tableName: "session", // Table où sont stockées les sessions
      createTableIfMissing: true,
    }),

    // resave: false → N'enregistre pas la session si elle n'a pas changé
    resave: false,

    // saveUninitialized: false → Ne crée pas de session pour les utilisateurs
    // qui ne sont pas encore connectés (économise de la mémoire)
    saveUninitialized: false,

    cookie: {
      // maxAge: durée de vie du cookie en millisecondes
      // 7 * 24 * 60 * 60 * 1000 = 7 jours
      maxAge: 7 * 24 * 60 * 60 * 1000,

      // httpOnly: true → Le cookie n'est pas accessible via JavaScript
      // côté client (protection contre les attaques XSS)
      httpOnly: true,

      // secure: en production (HTTPS), mettre à true pour que le cookie
      // ne soit envoyé que sur des connexions chiffrées
      secure: process.env.NODE_ENV === "production",
    },
  }),
);

// ── 5) Middleware panier ───────────────────────────────────────
// Initialise le panier en session et le rend disponible dans les vues.
// Doit être placé APRÈS la configuration des sessions.
const { initPanier } = require("./src/middleware/panier.middleware");
app.use(initPanier);

// ── 6) Variable globale pour toutes les vues ─────────────────
// Ce middleware s'exécute avant chaque route.
// Il rend req.session.user accessible dans TOUS les fichiers .ejs
// sous le nom "user", sans avoir à le passer manuellement à chaque render().
//
// Utilisation dans les vues EJS : <%= user ? user.prenom : '' %>
app.use((req, res, next) => {
  // res.locals est un objet partagé avec toutes les vues EJS
  res.locals.user = req.session.user || null;
  next(); // On passe au middleware ou à la route suivante
});

// ── 6) Routes ────────────────────────────────────────────────

// Page d'accueil
app.get("/", (req, res) => {
  res.render("home", {
    title: "B2CFarmer",
    activePage: "home",
  });
});

// Routes des offres : toutes les URLs commençant par /offres
app.use("/offres", offresRoutes);

// Routes d'authentification : /auth/login, /auth/register, /auth/logout
app.use("/auth", authRoutes);

// Routes des demandes : /demandes, /demandes/creer, /demandes/:id, etc.
app.use("/demandes", demandesRoutes);

// Routes du compte utilisateur : /mon-compte (consultation et modification)
app.use("/mon-compte", compteRoutes);

// Routes du panier : /panier, /panier/ajouter, /panier/valider, etc.
app.use("/panier", panierRoutes);

// Routes des commandes : /commandes (historique), /commandes/:id (détail)
app.use("/commandes", commandesRoutes);

// ── 7) Gestionnaire 404 ──────────────────────────────────────
// Ce middleware est déclenché si aucune route ci-dessus n'a répondu.
// Il doit être placé EN DERNIER, après toutes les routes.
app.use((req, res) => {
  res.status(404).render("404", {
    title: "Page non trouvée",
    activePage: "",
  });
});

// ── Démarrage du serveur ─────────────────────────────────────
// En développement local, le serveur est lancé ici.
// En production (Vercel), ce fichier est importé par api/index.js sans lancer listen().
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
  });
}

// Export de l'app pour utilisation en module (Vercel)
module.exports = app;
