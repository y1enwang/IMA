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
const ready = { left: false, right: false };
const keys = { left: 0, right: 0 };
const paddles = { left: 160, right: 160 };
const score = { left: 0, right: 0 };
let gameOver = false;
let winner = null;
let balls = [];

function createBall(direction = Math.random() < 0.5 ? -1 : 1) {
  return {
    x: W / 2, y: H / 2,
    vx: direction * 4,
    vy: (Math.random() * 3 + 1) * (Math.random() < 0.5 ? -1 : 1)
  };
}

function resetBalls() {
  const currentCount = Math.max(1, balls.length);
  balls = Array.from({ length: currentCount }, () => createBall());
}
resetBalls();

io.on("connection", (socket) => {
  let side = "spectator";
  if (!players.left) side = "left";
  else if (!players.right) side = "right";

  if (side !== "spectator") players[side] = socket.id;
  socket.emit("role", side);

  socket.on("changeBallCount", (delta) => {
    if (players[side] !== socket.id) return; // Only active players can change count
    const newCount = balls.length + delta;
    if (newCount >= 1 && newCount <= 20) {
      if (delta > 0) {
        balls.push(createBall());
      } else {
        balls.pop();
      }
    }
  });

  socket.on("start", () => {
    if (players[side] !== socket.id || !players.left || !players.right) return;
    if (ready.left && ready.right && !gameOver) return;

    ready[side] = true;
    if (gameOver && ready.left && ready.right) {
      score.left = 0;
      score.right = 0;
      paddles.left = 160;
      paddles.right = 160;
      gameOver = false;
      winner = null;
      resetBalls();
    }
  });

  socket.on("move", (direction) => {
    if (players[side] !== socket.id) return;
    if ([-1, 0, 1].includes(direction)) keys[side] = direction;
  });

  socket.on("disconnect", () => {
    if (players[side] === socket.id) {
      players[side] = null;
      keys[side] = 0;
      ready.left = false;
      ready.right = false;
      resetBalls();
    }
  });
});

function hits(side, x, ball) {
  return ball.x + radius >= x &&
    ball.x - radius <= x + paddleW &&
    ball.y + radius >= paddles[side] &&
    ball.y - radius <= paddles[side] + paddleH;
}

setInterval(() => {
  const connected = Boolean(players.left && players.right);
  const playing = connected && ready.left && ready.right && !gameOver;

  if (playing) {
    for (const side of ["left", "right"]) {
      paddles[side] = Math.max(0, Math.min(H - paddleH, paddles[side] + keys[side] * 6));
    }

    balls.forEach((ball, index) => {
      ball.x += ball.vx;
      ball.y += ball.vy;

      // Wall bounce
      if (ball.y < radius || ball.y > H - radius) {
        ball.y = Math.max(radius, Math.min(H - radius, ball.y));
        ball.vy *= -1;
      }

      // Paddle hits
      if (ball.vx < 0 && hits("left", 20, ball)) {
        ball.x = 20 + paddleW + radius;
        ball.vx *= -1;
        ball.vy = (ball.y - paddles.left - paddleH / 2) / 12;
        io.emit("rebound");
      }
      if (ball.vx > 0 && hits("right", W - 30, ball)) {
        ball.x = W - 30 - radius;
        ball.vx *= -1;
        ball.vy = (ball.y - paddles.right - paddleH / 2) / 12;
        io.emit("rebound");
      }

      // Scoring
      if (ball.x < -radius) {
        score.right++;
        if (score.right >= 5) {
          gameOver = true;
          winner = "right";
          ready.left = false;
          ready.right = false;
        }
        balls[index] = createBall(1);
      }
      if (ball.x > W + radius) {
        score.left++;
        if (score.left >= 5) {
          gameOver = true;
          winner = "left";
          ready.left = false;
          ready.right = false;
        }
        balls[index] = createBall(-1);
      }
    });
  }

  // Send array of balls in the broadcast state
  io.emit("state", { paddles, balls, score, connected, playing: playing && !gameOver, ready, gameOver, winner });
}, 1000 / 60);

const port = process.env.PORT || 3000;
server.listen(port, "0.0.0.0", () => console.log(`pong: http://localhost:${port}`));