require("dotenv").config();

const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// 1) EJS

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "src", "views"));

// 2) Fichiers statiques (css, images, etc.)

app.use(express.static(path.join(__dirname, "src", "public")));

// 3) Parsing des formulaires

app.use(express.urlencoded({ extended: true }));

// 4) Routes

app.get("/", (req, res) => {
  res.render("home", { title: "AgriConnect" });
});

// 404 Status

app.use((req, res) => {
  res.status(404).render("404", { title: "Page non trouvée" });
});

// Démarrage du serveur

app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
