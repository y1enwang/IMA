import express from "express";
import { JSONFilePreset } from "lowdb/node";

const app = express();

// Allow server to read JSON
app.use(express.json());

// Create our database
const db = await JSONFilePreset("db.json", {
  notes: []
});

// ROUTE 1: Show the homepage
app.get("/", (req, res) => {
  res.sendFile("index.html", { root: "public" });
});

// ROUTE 2: Save a new note
app.post("/new-data", async (req, res) => {
  const note = String(req.body.note || "").trim();

  if (!note) {
    return res.status(400).json({
      message: "Please write a note."
    });
  }

  db.data.notes.push(note);
  await db.write();

  res.json({ message: "Saved successfully!" });
});

// ROUTE 3: Get saved notes
app.get("/data", (req, res) => {
  res.json(db.data.notes);
});

// Start server
app.listen(process.env.PORT || 3000, () => {
  console.log("Server is running!");
});
