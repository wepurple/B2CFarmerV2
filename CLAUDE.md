# B2CFarmer — CLAUDE.md

## Stack
Node.js + Express 5 (CommonJS) · PostgreSQL (pg + PoolAdapter) · EJS SSR · express-session · bcrypt
No TypeScript. No tests. No git locally (remote: github.com/wepurple/B2CFarmer).

## Commandes
- `npm run dev` — démarrer avec nodemon
- `npm start` — démarrer sans hot reload

## Architecture MVC
- `src/models/` → SQL pur (pg via PoolAdapter), pas d'ORM
- `src/controllers/` → logique métier, res.render / res.redirect
- `src/routes/` → mapping URL → controller
- `src/views/` → templates EJS, include('../navbar')
- `src/middleware/auth.middleware.js` → isAuthenticated, isAgriculteur, isParticulier
- `src/config/db.js` → pool PostgreSQL via PoolAdapter (process.env)

## Patterns à respecter
- Routes statiques AVANT routes dynamiques (ex: `/agriculteur` avant `/:id`)
- Transactions PostgreSQL pour opérations atomiques : `pool.getConnection()` + beginTransaction/commit/rollback
- `res.locals.user` injecté globalement dans app.js → disponible dans tous les EJS
- Rôles : `AGRICULTEUR` | `PARTICULIER` (stocké dans `req.session.user.role`)
- Soft-delete offres : toujours filtrer avec `deleted_at IS NULL`

## Design System — "Marché Doux" v5.0
- Fichier : `src/public/css/style.css` (2400+ lignes)
- Fonts : Lora (titres, serif) + Nunito (corps) + DM Mono (prix) — Google Fonts
- Palette : crème `#FDFAF3` (`--warm-white`) · vert sage `#4A7F52` (`--brand`) · terracotta `#C47850` (`--accent`)
- Radius : `--radius-xs 8px` · `--radius-sm 12px` · `--radius-md 18px` · `--radius-lg 28px` · `--radius-xl 44px`
- Avant toute modification CSS : **lire le fichier d'abord** (le tool `Write` exige un `Read` préalable)
- Éditions ciblées uniquement via `Edit` — ne jamais réécrire le fichier entier

## Gotchas
- `Write` tool → erreur "File has not been read yet" si aucun `Read` préalable sur le fichier
- Pas de git local → pas de revert possible, prudence avant toute réécriture complète
- Express 5 : gestion d'erreurs async automatique (pas besoin de try/catch sur chaque route)
- Toutes les vues EJS partagent le même `navbar.ejs` via `include()`
