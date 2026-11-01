const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static("public"));

const W = 600, H = 400;
const paddleH = 80, paddleW = 10, radius = 7;
const players = { left: null, right: null };
const keys = { left: 0, right: 0 };
const paddles = { left: 160, right: 160 };
const score = { left: 0, right: 0 };
let ball;

function resetBall(direction = Math.random() < 0.5 ? -1 : 1) {
  ball = {
    x: W / 2, y: H / 2,
    vx: direction * 4,
    vy: (Math.random() * 3 + 1) * (Math.random() < 0.5 ? -1 : 1)
  };
}
resetBall();

io.on("connection", (socket) => {
  let side = "spectator";
  if (!players.left) side = "left";
  else if (!players.right) side = "right";

  if (side !== "spectator") players[side] = socket.id;
  socket.emit("role", side); // Server-side emit

  socket.on("move", (direction) => {
    if (players[side] !== socket.id) return;
    if ([-1, 0, 1].includes(direction)) keys[side] = direction;
  });

  socket.on("disconnect", () => {
    if (players[side] === socket.id) {
      players[side] = null;
      keys[side] = 0;
      resetBall();
    }
  });
});

function hits(side, x) {
  return ball.x + radius >= x &&
    ball.x - radius <= x + paddleW &&
    ball.y + radius >= paddles[side] &&
    ball.y - radius <= paddles[side] + paddleH;
}

setInterval(() => {
  const playing = Boolean(players.left && players.right);

  if (playing) {
    for (const side of ["left", "right"]) {
      paddles[side] = Math.max(0, Math.min(H - paddleH, paddles[side] + keys[side] * 6));
    }

    ball.x += ball.vx;
    ball.y += ball.vy;

    if (ball.y < radius || ball.y > H - radius) {
      ball.y = Math.max(radius, Math.min(H - radius, ball.y));
      ball.vy *= -1;
    }

    if (ball.vx < 0 && hits("left", 20)) {
      ball.x = 20 + paddleW + radius;
      ball.vx *= -1;
      ball.vy = (ball.y - paddles.left - paddleH / 2) / 12;
    }
    if (ball.vx > 0 && hits("right", W - 30)) {
      ball.x = W - 30 - radius;
      ball.vx *= -1;
      ball.vy = (ball.y - paddles.right - paddleH / 2) / 12;
    }

    if (ball.x < -radius) { score.right++; resetBall(1); }
    if (ball.x > W + radius) { score.left++; resetBall(-1); }
  }

  // Everyone receives the same game state, 60 times per second.
  io.emit("state", { paddles, ball, score, playing }); // Server-side broadcast
}, 1000 / 60);

const port = process.env.PORT || 3000;
server.listen(port, "0.0.0.0", () => console.log(`pong: http://localhost:${port}`));
