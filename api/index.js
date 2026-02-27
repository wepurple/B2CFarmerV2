/**
 * api/index.js
 * ============
 * Point d'entrée Vercel pour les fonctions serverless.
 * Ce fichier exporte simplement l'application Express.
 * Vercel servira l'app via ce fichier.
 */

const app = require("../app");

module.exports = app;
