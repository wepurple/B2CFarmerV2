USE agri_connect;

-- =========================================================
-- UTILISATEURS
-- =========================================================

INSERT INTO utilisateur (nom, prenom, email, password_hash, role)
VALUES
('Martin', 'Paul', 'paul.martin@test.fr', '$2b$10$dummyhash', 'AGRICULTEUR'),
('Dubois', 'Claire', 'claire.dubois@test.fr', '$2b$10$dummyhash', 'AGRICULTEUR'),
('Petit', 'Lucas', 'lucas.petit@test.fr', '$2b$10$dummyhash', 'PARTICULIER'),
('Moreau', 'Emma', 'emma.moreau@test.fr', '$2b$10$dummyhash', 'PARTICULIER');

-- =========================================================
-- PROFILS AGRICULTEURS
-- =========================================================

INSERT INTO agriculteur (id_user, nom_exploitation, description, ville)
VALUES
(1, 'Ferme des Trois Chênes', 'Production locale et bio', 'Orléans'),
(2, 'Les Jardins de Beauce', 'Légumes de saison', 'Chartres');

-- =========================================================
-- PRODUITS
-- =========================================================

INSERT INTO produit (libelle, unite, categorie)
VALUES
('Pommes', 'kg', 'Fruit'),
('Tomates', 'kg', 'Légume'),
('Œufs', 'pièce', 'Animal'),
('Pommes de terre', 'kg', 'Légume');

-- =========================================================
-- OFFRES
-- =========================================================

INSERT INTO offre (id_user_agri, titre, description, statut)
VALUES
(1, 'Panier Fruits & Légumes', 'Panier hebdomadaire', 'ACTIVE'),
(2, 'Légumes Bio', 'Récolte du jour', 'ACTIVE');

-- =========================================================
-- LIGNES D’OFFRE
-- =========================================================

INSERT INTO offre_ligne (id_offre, id_produit, prix, quantite_disponible)
VALUES
(1, 1, 3.50, 50),  -- Pommes
(1, 2, 4.20, 30),  -- Tomates
(2, 2, 3.90, 40),  -- Tomates
(2, 4, 2.80, 100); -- Pommes de terre

-- =========================================================
-- DEMANDES DE CONTACT
-- =========================================================

INSERT INTO demande_contact (id_user_particulier, id_offre, message)
VALUES
(3, 1, 'Bonjour, votre panier m’intéresse'),
(4, 2, 'Avez-vous encore des pommes de terre ?');