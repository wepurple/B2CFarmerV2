-- =========================================================
-- SCHEMA : agri_connect (MariaDB)
-- =========================================================

-- (Optionnel) si tu exécutes depuis un client SQL
USE agri_connect;

-- =========================================================
-- TABLE : utilisateur
-- =========================================================
CREATE TABLE IF NOT EXISTS utilisateur (
  id_user INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  telephone VARCHAR(30) NULL,
  role ENUM('PARTICULIER','AGRICULTEUR','ADMIN') NOT NULL,
  actif TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT uq_utilisateur_email UNIQUE (email)
) ENGINE=InnoDB;

-- =========================================================
-- TABLE : agriculteur (profil)
-- 1 utilisateur (AGRICULTEUR) -> 1 profil agriculteur
-- =========================================================
CREATE TABLE IF NOT EXISTS agriculteur (
  id_user INT UNSIGNED PRIMARY KEY,
  nom_exploitation VARCHAR(150) NOT NULL,
  description TEXT NULL,
  siret VARCHAR(20) NULL,
  adresse VARCHAR(255) NULL,
  code_postal VARCHAR(10) NULL,
  ville VARCHAR(120) NULL,
  latitude DECIMAL(9,6) NULL,
  longitude DECIMAL(9,6) NULL,
  photo_profil VARCHAR(255) NULL,

  CONSTRAINT fk_agriculteur_user
    FOREIGN KEY (id_user) REFERENCES utilisateur(id_user)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB;

-- =========================================================
-- TABLE : produit
-- =========================================================
CREATE TABLE IF NOT EXISTS produit (
  id_produit INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  libelle VARCHAR(120) NOT NULL,
  unite VARCHAR(30) NOT NULL,         -- ex: kg, pièce, botte
  categorie VARCHAR(60) NOT NULL      -- ex: légume, fruit, viande
) ENGINE=InnoDB;

-- =========================================================
-- TABLE : offre
-- =========================================================
CREATE TABLE IF NOT EXISTS offre (
  id_offre INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_user_agri INT UNSIGNED NOT NULL,
  titre VARCHAR(160) NOT NULL,
  description TEXT NULL,
  date_debut DATE NULL,
  date_fin DATE NULL,
  statut ENUM('ACTIVE','PAUSE','TERMINEE') NOT NULL DEFAULT 'ACTIVE',
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_offre_agriculteur
    FOREIGN KEY (id_user_agri) REFERENCES agriculteur(id_user)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  INDEX idx_offre_agri (id_user_agri),
  INDEX idx_offre_statut (statut)
) ENGINE=InnoDB;

-- =========================================================
-- TABLE : offre_ligne (association offre <-> produit)
-- PK composée (id_offre, id_produit)
-- =========================================================
CREATE TABLE IF NOT EXISTS offre_ligne (
  id_offre INT UNSIGNED NOT NULL,
  id_produit INT UNSIGNED NOT NULL,
  prix DECIMAL(10,2) NOT NULL,
  quantite_disponible DECIMAL(10,2) NOT NULL,

  PRIMARY KEY (id_offre, id_produit),

  CONSTRAINT fk_offre_ligne_offre
    FOREIGN KEY (id_offre) REFERENCES offre(id_offre)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT fk_offre_ligne_produit
    FOREIGN KEY (id_produit) REFERENCES produit(id_produit)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  INDEX idx_offre_ligne_produit (id_produit)
) ENGINE=InnoDB;

-- =========================================================
-- TABLE : demande_contact (mise en relation)
-- =========================================================
CREATE TABLE IF NOT EXISTS demande_contact (
  id_demande INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_user_particulier INT UNSIGNED NOT NULL,
  id_offre INT UNSIGNED NOT NULL,
  message TEXT NOT NULL,
  statut ENUM('ENVOYEE','REPONDUE','CLOTUREE') NOT NULL DEFAULT 'ENVOYEE',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_demande_user
    FOREIGN KEY (id_user_particulier) REFERENCES utilisateur(id_user)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  CONSTRAINT fk_demande_offre
    FOREIGN KEY (id_offre) REFERENCES offre(id_offre)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  INDEX idx_demande_offre (id_offre),
  INDEX idx_demande_user (id_user_particulier),
  INDEX idx_demande_statut (statut)
) ENGINE=InnoDB;