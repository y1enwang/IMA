const express = require("express");
const path = require("path");

const app = express();

// 10 museum objects
const artworks = [
  { id: 1, title: "Ocean Shell", category: "nature" },
  { id: 2, title: "Bronze Mirror", category: "metal" },
  { id: 3, title: "Clay Bowl", category: "ceramic" },
  { id: 4, title: "Wooden Mask", category: "nature" },
  { id: 5, title: "Silk Ribbon", category: "textile" },
  { id: 6, title: "Copper Bell", category: "metal" },
  { id: 7, title: "Stone Figure", category: "nature" },
  { id: 8, title: "Porcelain Cup", category: "ceramic" },
  { id: 9, title: "Woven Basket", category: "textile" },
  { id: 10, title: "Silver Ring", category: "metal" }
];

// ROUTE 1: Show homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ROUTE 2: Show all data
app.get("/data", (req, res) => {
  res.json(artworks);
});

// ROUTE 3: Filter by category
app.get("/data/:category", (req, res) => {
  const category = req.params.category;

  const results = artworks.filter((item) => {
    return item.category === category;
  });

  res.json(results);
});

// Start server
app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
