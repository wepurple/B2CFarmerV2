/**
 * pool.js
 * -------
 * Pool PostgreSQL partagé entre l'app et les sessions.
 * Évite d'avoir 2 pools différents qui consomment trop de connexions.
 * Surtout important sur Vercel (fonctions serverless) et Supabase (limites de connexions).
 */

const { Pool } = require("pg");

const useSsl =
  process.env.DB_SSL === "true" || process.env.NODE_ENV === "production";

// Options communes pour tous les pools
const poolConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: useSsl ? { rejectUnauthorized: false } : false,

  // Vercel = serverless : chaque invocation est un process isolé.
  // max: 1 en production évite d'épuiser le pool Supabase (limite Session mode).
  max: process.env.NODE_ENV === "production" ? 1 : 10,

  // Vercel: keep-alive important
  idleTimeoutMillis: process.env.NODE_ENV === "production" ? 10000 : 30000,
  connectionTimeoutMillis: process.env.NODE_ENV === "production" ? 5000 : 2000,
};

const pool = new Pool(poolConfig);

// Gestion des erreurs non capturées
pool.on("error", (err) => {
  console.error("❌ Erreur inattendue du pool PostgreSQL:", err);
});

pool.on("connect", () => {
  // Optionnel : débugging
  // console.log('✅ Connexion PostgreSQL établie');
});

// Test de connexion au démarrage (optionnel, mais utile pour debug)
pool
  .query("SELECT NOW()")
  .then(() => {
    console.log("✅ Pool PostgreSQL initialisé avec succès");
  })
  .catch((err) => {
    console.error("❌ Impossible de se connecter à PostgreSQL:", err.message);
  });

module.exports = pool;
