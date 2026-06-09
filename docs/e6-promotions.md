# BTS SIO E6 - Gestion des promotions agriculteur

Ce document explique les modifications ajoutees au projet B2CFarmer pour la fonctionnalite de gestion des promotions cote agriculteur.

## 1. Contexte

B2CFarmer est une application Node.js / Express / EJS / PostgreSQL qui permet aux agriculteurs de publier des offres et aux particuliers de les consulter.

La demande etait d'ajouter uniquement la gestion des promotions pour les agriculteurs, sans modifier :

- le panier ;
- les commandes ;
- la structure de la base de donnees.

La table `promotion` existait deja avec les champs suivants :

```text
id_promotion, type_promotion, libelle, valeur, code_promo,
quantite_min, montant_min, date_debut, date_fin, active,
id_offre, id_produit, created_at
```

## 2. Objectif fonctionnel

Un agriculteur connecte doit pouvoir gerer les promotions de ses propres offres.

Les actions ajoutees sont :

- ajouter une promotion ;
- consulter les promotions d'une offre ;
- modifier une promotion ;
- supprimer une promotion.

Une contrainte importante est qu'un agriculteur ne doit jamais pouvoir creer, modifier ou supprimer une promotion sur une offre qui ne lui appartient pas.

## 3. Architecture MVC respectee

Le projet suit une architecture MVC :

- `models` : acces aux donnees SQL ;
- `controllers` : logique metier et orchestration ;
- `routes` : declaration des URLs et middlewares ;
- `views` : affichage EJS.

La fonctionnalite promotions a ete separee dans ses propres fichiers :

- `src/models/promotions.model.js`
- `src/controllers/promotions.controller.js`
- `src/routes/promotions.routes.js`
- `src/views/promotions/new.ejs`
- `src/views/promotions/edit.ejs`

La vue existante `src/views/offres/show.ejs` a ete modifiee pour afficher la liste des promotions de l'offre quand l'agriculteur proprietaire consulte son offre.

La vue `src/views/offres/mes-offres.ejs` a ete modifiee pour ajouter un bouton `Ajouter une promotion` sur chaque carte d'offre.

## 4. Modele promotions

Le fichier `src/models/promotions.model.js` contient uniquement des requetes SQL.

Fonctions principales :

- `createPromotion()` : cree une promotion ;
- `getPromotionsByOffre()` : recupere les promotions d'une offre ;
- `getPromotionById()` : recupere une promotion par son identifiant ;
- `updatePromotion()` : modifie une promotion ;
- `deletePromotion()` : supprime une promotion ;
- `isOffreOwnedByAgriculteur()` : verifie qu'une offre appartient a l'agriculteur connecte ;
- `isPromotionOwnedByAgriculteur()` : verifie qu'une promotion appartient a une offre de l'agriculteur connecte.

Toutes les requetes utilisent des parametres `?`, convertis ensuite en `$1`, `$2`, etc. par l'adaptateur PostgreSQL du projet.

Exemple de point a expliquer :

```js
WHERE id_offre = ? AND id_user_agri = ? AND deleted_at IS NULL
```

Cette condition verifie a la fois :

- l'identifiant de l'offre ;
- le proprietaire de l'offre ;
- le fait que l'offre ne soit pas supprimee.

## 5. Controleur promotions

Le fichier `src/controllers/promotions.controller.js` gere les actions utilisateur.

Actions ajoutees :

- `showCreatePromotion()` : affiche le formulaire d'ajout ;
- `handleCreatePromotion()` : traite la creation ;
- `showEditPromotion()` : affiche le formulaire de modification ;
- `handleEditPromotion()` : traite la modification ;
- `handleDeletePromotion()` : supprime une promotion.

Le controleur fait aussi la validation des donnees :

- le type est obligatoire ;
- le libelle est obligatoire ;
- la valeur doit etre un nombre positif ;
- la quantite minimale et le montant minimal doivent etre positifs si renseignes ;
- la date de fin doit etre posterieure a la date de debut ;
- le produit choisi doit appartenir a l'offre concernee.

## 6. Routes ajoutees

Les routes sont dans `src/routes/promotions.routes.js`.

Routes principales :

```text
GET  /offres/:id/promotions/new
POST /offres/:id/promotions
GET  /promotions/:id/edit
POST /promotions/:id/edit
POST /promotions/:id/delete
```

Toutes ces routes sont protegees avec :

```js
isAuthenticated
isAgriculteur
```

Cela signifie que l'utilisateur doit :

- etre connecte ;
- avoir le role `AGRICULTEUR`.

Le role seul ne suffit pas. Le controleur et le modele verifient aussi que l'offre ou la promotion appartient bien a l'agriculteur connecte.

## 7. Integration dans app.js

Les routes promotions sont importees dans `app.js` :

```js
const promotionsRoutes = require("./src/routes/promotions.routes");
```

Puis montees avec :

```js
app.use("/", promotionsRoutes);
```

Le montage sur `/` permet d'avoir exactement les URLs souhaitees :

- `/offres/:id/promotions/new`
- `/offres/:id/promotions`
- `/promotions/:id/edit`
- `/promotions/:id/delete`

## 8. Vues modifiees ou creees

### Mes offres

Dans `src/views/offres/mes-offres.ejs`, chaque carte d'offre contient maintenant un bouton :

```text
Ajouter une promotion
```

Ce bouton redirige vers :

```text
/offres/:id/promotions/new
```

Cela evite d'afficher un formulaire de gestion sur la page publique de l'offre.

### Page publique / detail d'une offre

Dans `src/views/offres/show.ejs`, le formulaire d'ajout n'est pas affiche.

La page peut afficher les promotions existantes uniquement si :

- l'utilisateur est connecte ;
- son role est `AGRICULTEUR` ;
- il est le proprietaire de l'offre.

### Formulaire d'ajout

Le fichier `src/views/promotions/new.ejs` contient le formulaire dedie a la creation d'une promotion.

Champs principaux :

- type de promotion ;
- libelle ;
- valeur ;
- produit concerne ou toute l'offre ;
- quantite minimale ;
- montant minimal ;
- dates de debut et de fin ;
- statut actif.

### Formulaire de modification

Le fichier `src/views/promotions/edit.ejs` permet de modifier une promotion existante.

Il reprend la meme logique que le formulaire d'ajout, avec les donnees pre-remplies.

## 9. Securite

La securite repose sur plusieurs niveaux.

Premier niveau : les routes sont protegees par les middlewares :

```js
isAuthenticated
isAgriculteur
```

Deuxieme niveau : les controles de propriete sont faits en base via le modele.

Exemples :

- verifier que l'offre appartient a l'agriculteur avant creation ;
- verifier que la promotion appartient a une offre de l'agriculteur avant modification ;
- verifier que la promotion appartient a une offre de l'agriculteur avant suppression.

Troisieme niveau : les requetes SQL sont parametrees.

Cela reduit les risques d'injection SQL car les valeurs utilisateur ne sont pas concatenees directement dans les requetes.

## 10. Donnees de test

Un fichier de seed a ete cree :

```text
sql/seed-promotions.sql
```

Il ajoute :

- un agriculteur de demonstration ;
- une offre active ;
- une offre non active avec statut `PAUSE` ;
- cinq produits ;
- trois promotions avec les types geres par l'interface.

Types de promotions crees :

- `POURCENTAGE`
- `MONTANT_FIXE`
- `QUANTITE`

Une promotion est rattachee a l'offre non active pour tester ce cas.

## 11. Ce qui n'a pas ete modifie

La demande precisait de ne pas toucher au panier, aux commandes ni a la base de donnees.

Ces elements n'ont pas ete modifies :

- pas de calcul de promotion dans le panier ;
- pas de reduction appliquee aux commandes ;
- pas de migration SQL ;
- pas de modification de schema.

La fonctionnalite permet uniquement la gestion CRUD des promotions par l'agriculteur.

## 12. Tests et verifications realisees

Les verifications suivantes ont ete faites :

- verification de syntaxe JavaScript avec `node -c` ;
- compilation des vues EJS avec `ejs.compile` ;
- verification des routes et des imports ;
- verification que le formulaire d'ajout n'est plus affiche sur la page publique.

Il n'y a pas eu de test automatise complet car le projet contient actuellement un script `npm test` factice.

## 13. Demonstration possible a l'oral

Scenario de demonstration :

1. Se connecter en tant qu'agriculteur.
2. Aller sur `Mes offres`.
3. Cliquer sur `Ajouter une promotion` sur une carte d'offre.
4. Remplir le formulaire d'ajout.
5. Valider.
6. Constater que la promotion est creee.
7. Modifier la promotion.
8. Supprimer la promotion.

Points importants a verbaliser :

- le bouton est place sur la carte de l'offre pour rester dans l'espace de gestion agriculteur ;
- la page publique ne montre pas le formulaire d'ajout ;
- les routes sont protegees ;
- les requetes SQL sont parametrees ;
- l'ownership est verifie cote serveur, pas seulement cote interface.

## 14. Questions possibles du jury

### Pourquoi avoir cree un modele separe ?

Pour respecter l'architecture MVC et isoler les requetes SQL liees aux promotions.

### Pourquoi ne pas avoir mis le formulaire sur la page publique ?

La page publique est destinee a la consultation de l'offre. Le formulaire d'ajout est une action de gestion reservee a l'agriculteur. Il est donc plus coherent de l'ouvrir depuis la carte de l'offre dans `Mes offres`.

### Pourquoi verifier la propriete dans le modele ?

Parce que masquer un bouton dans l'interface ne suffit pas. Un utilisateur pourrait appeler une URL manuellement. Le serveur doit donc verifier que l'offre ou la promotion appartient bien a l'utilisateur connecte.

### Pourquoi utiliser des requetes parametrees ?

Pour eviter les injections SQL et separer le code SQL des valeurs saisies par l'utilisateur.

### Pourquoi ne pas appliquer les promotions au panier ?

Parce que le besoin demande uniquement la gestion des promotions cote agriculteur. Le calcul commercial dans le panier ou les commandes serait une autre fonctionnalite.

## 15. Competences E6 mobilisees

Cette evolution permet d'illustrer plusieurs competences :

- analyser un besoin utilisateur ;
- faire evoluer une application existante ;
- respecter une architecture logicielle ;
- securiser les acces ;
- utiliser une base de donnees relationnelle ;
- mettre en place des requetes SQL parametrees ;
- tester et verifier une modification ;
- documenter une fonctionnalite.

## 16. Resume court pour l'oral

J'ai ajoute une fonctionnalite permettant a un agriculteur connecte de gerer les promotions de ses offres. J'ai respecte l'architecture MVC du projet en creant un modele, un controleur, des routes et des vues dediees. Les routes sont protegees par les middlewares d'authentification et de role, et les controles de propriete sont faits cote serveur pour empecher un agriculteur de modifier les promotions d'une offre qui ne lui appartient pas. Les requetes SQL sont parametrees. Je n'ai pas modifie le panier, les commandes ni la structure de la base, car le besoin portait uniquement sur la gestion des promotions.
