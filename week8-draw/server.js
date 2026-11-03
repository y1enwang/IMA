const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Show files from the public folder
app.use(express.static("public"));

// someone connects
io.on("connection", (socket) => {

  console.log("A user connected!");

  // Receive drawing data
  socket.on("draw", (line) => {

    // Send drawing data to everyone
    io.emit("draw", line);

  });

  // Clear everyone's canvas
  socket.on("clear", () => {
    io.emit("clear");
  });

});

server.listen(process.env.PORT || 3000, () => {
  console.log("Server is running!");
});
