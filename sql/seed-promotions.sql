-- Jeu de donnees promotions B2CFarmer
-- Ajoute 1 agriculteur de demo, 2 offres dont 1 non active, 5 produits
-- et 3 promotions avec les types geres par l'interface.

BEGIN;

WITH demo_user AS (
  INSERT INTO utilisateur (nom, prenom, email, password_hash, role, actif)
  VALUES (
    'Demo',
    'Promotions',
    'demo-promotions@b2cfarmer.local',
    '$2b$10$WW.dSWyizNc.VlKquARYpOUcX3jRS6/s8Fko9uI19UidRetyJUgIy',
    'AGRICULTEUR',
    true
  )
  ON CONFLICT (email) DO UPDATE SET
    nom = EXCLUDED.nom,
    prenom = EXCLUDED.prenom,
    role = EXCLUDED.role,
    actif = EXCLUDED.actif
  RETURNING id_user
),
demo_agri AS (
  INSERT INTO agriculteur (
    id_user,
    nom_exploitation,
    siret,
    adresse,
    code_postal,
    ville,
    description
  )
  SELECT
    id_user,
    'Ferme Demo Promotions',
    '12345678900011',
    '1 chemin des tests',
    '44000',
    'Nantes',
    'Exploitation de demonstration pour tester les promotions.'
  FROM demo_user
  ON CONFLICT (id_user) DO UPDATE SET
    nom_exploitation = EXCLUDED.nom_exploitation,
    siret = EXCLUDED.siret,
    adresse = EXCLUDED.adresse,
    code_postal = EXCLUDED.code_postal,
    ville = EXCLUDED.ville,
    description = EXCLUDED.description
  RETURNING id_user
),
active_offer AS (
  INSERT INTO offre (
    id_user_agri,
    titre,
    description,
    date_debut,
    date_fin,
    statut
  )
  SELECT
    id_user,
    'Panier demo promotions',
    'Offre active utilisee pour tester cinq promotions de types differents.',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days',
    'ACTIVE'
  FROM demo_agri
  RETURNING id_offre
),
inactive_offer AS (
  INSERT INTO offre (
    id_user_agri,
    titre,
    description,
    date_debut,
    date_fin,
    statut
  )
  SELECT
    id_user,
    'Offre demo non active',
    'Offre volontairement en pause pour tester les cas non actifs.',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '15 days',
    'PAUSE'
  FROM demo_agri
  RETURNING id_offre
),
products AS (
  INSERT INTO produit (libelle, unite, categorie)
  VALUES
    ('Carottes demo promo', 'kg', 'légume'),
    ('Pommes demo promo', 'kg', 'fruit'),
    ('Oeufs demo promo', 'douzaine', 'œufs'),
    ('Miel demo promo', 'pièce', 'autre'),
    ('Lait demo promo', 'litre', 'produit laitier')
  RETURNING id_produit, libelle
),
active_offer_lines AS (
  INSERT INTO offre_ligne (id_offre, id_produit, prix, quantite_disponible)
  SELECT
    active_offer.id_offre,
    products.id_produit,
    CASE products.libelle
      WHEN 'Carottes demo promo' THEN 2.50
      WHEN 'Pommes demo promo' THEN 3.20
      WHEN 'Oeufs demo promo' THEN 4.80
      WHEN 'Miel demo promo' THEN 8.90
      ELSE 1.40
    END,
    CASE products.libelle
      WHEN 'Miel demo promo' THEN 25
      ELSE 80
    END
  FROM active_offer
  CROSS JOIN products
  RETURNING id_offre, id_produit
),
inactive_offer_lines AS (
  INSERT INTO offre_ligne (id_offre, id_produit, prix, quantite_disponible)
  SELECT inactive_offer.id_offre, products.id_produit, 2.90, 40
  FROM inactive_offer
  CROSS JOIN products
  RETURNING id_offre, id_produit
)
INSERT INTO promotion (
  type_promotion,
  libelle,
  valeur,
  quantite_min,
  montant_min,
  date_debut,
  date_fin,
  active,
  id_offre,
  id_produit
)
SELECT
  promo.type_promotion,
  promo.libelle,
  promo.valeur,
  promo.quantite_min,
  promo.montant_min,
  promo.date_debut,
  promo.date_fin,
  promo.active,
  CASE
    WHEN promo.offre_cible = 'INACTIVE' THEN inactive_offer.id_offre
    ELSE active_offer.id_offre
  END,
  products.id_produit
FROM active_offer
CROSS JOIN inactive_offer
JOIN (
  VALUES
    ('POURCENTAGE', '10% sur les carottes', 10.00, 2, NULL, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', true, 'Carottes demo promo', 'ACTIVE'),
    ('MONTANT_FIXE', '2 euros sur les pommes', 2.00, NULL, 15.00, CURRENT_DATE, CURRENT_DATE + INTERVAL '20 days', true, 'Pommes demo promo', 'ACTIVE'),
    ('QUANTITE', 'Remise a partir de 3 pots sur offre en pause', 3.00, 3, NULL, CURRENT_DATE, CURRENT_DATE + INTERVAL '25 days', true, 'Miel demo promo', 'INACTIVE')
) AS promo (
  type_promotion,
  libelle,
  valeur,
  quantite_min,
  montant_min,
  date_debut,
  date_fin,
  active,
  produit_libelle,
  offre_cible
) ON true
JOIN products ON products.libelle = promo.produit_libelle;

COMMIT;
