const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static(path.join(__dirname, 'public')));

// Every room owns its players, paddles, balls and score.
const W = 800, H = 500, paddleH = 80, paddleW = 10, radius = 7;
const rooms = new Map();
const environments = ['Neon Grid', 'Lunar Drift', 'Solar Storm'];
let roomNumber = 0, ballNumber = 0;
function createBall(owner = null, direction = Math.random() < .5 ? -1 : 1) {
  return { id: ++ballNumber, owner: owner?.id || null, name: owner?.name || '',
    x: W / 2, y: H / 2, vx: direction * 250, vy: (Math.random() - .5) * 220 };
}
function createRoom(mode) {
  const room = { id: `ORBIT-${++roomNumber}`, mode, members: [], paddles: [], balls: [createBall()],
    score: { left: 0, right: 0 }, level: 1, playing: false, winner: null, time: 0 };
  rooms.set(room.id, room);
  return room;
}
function slots(mode) {
  return mode === 'duo' ? ['left', 'right', 'left', 'right'] : ['left', 'right'];
}
function available(room) {
  return room.mode === 'infinite' ? room.members.length < 22 : room.paddles.length < slots(room.mode).length;
}
function snapshot(room) {
  return { room: room.id, mode: room.mode, width: W, height: H, paddleH, paddleW, radius,
    members: room.members, paddles: room.paddles.map(({ key, ...p }) => p), balls: room.balls,
    score: room.score, level: room.level, environment: environments[room.level - 1],
    playing: room.playing, winner: room.winner, required: slots(room.mode).length };
}
function broadcast(room) { io.to(room.id).emit('state', snapshot(room)); }
function leave(socket) {
  const room = rooms.get(socket.data.room);
  if (!room) return;
  room.members = room.members.filter(p => p.id !== socket.id);
  const wasPaddle = room.paddles.some(p => p.id === socket.id);
  room.paddles = room.paddles.filter(p => p.id !== socket.id);
  room.balls = room.balls.filter(b => b.owner !== socket.id);
  if (wasPaddle) { room.playing = false; room.paddles.forEach(p => { p.ready = false; p.key = 0; }); }
  if (!room.balls.length) room.balls.push(createBall());
  socket.leave(room.id);
  delete socket.data.room;
  if (!room.members.length) rooms.delete(room.id); else broadcast(room);
}
io.on('connection', socket => {
  socket.on('joinGame', (data, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    if (socket.data.room) return reply({ error: 'Leave your current room first.' });
    if (!data || !['solo', 'duo', 'infinite', 'any'].includes(data.mode)) return reply({ error: 'Choose a mode.' });
    const name = typeof data.name === 'string' ? data.name.trim().replace(/[\x00-\x1f\x7f]/g, '').slice(0, 16) : '';
    if (!name) return reply({ error: 'Please enter your name.' });
    let mode = data.mode;
    if (mode === 'any') {
      const waiting = [...rooms.values()].find(r => !r.playing && available(r));
      mode = waiting?.mode || 'solo';
    }
    const room = [...rooms.values()].find(r => r.mode === mode && available(r)) || createRoom(mode);
    const member = { id: socket.id, name };
    const sides = slots(mode);
    const side = sides.find(s => room.paddles.filter(p => p.side === s).length < sides.filter(t => t === s).length);
    room.members.push(member);
    if (side) {
      const index = room.paddles.filter(p => p.side === side).length;
      const x = side === 'left' ? 24 + index * 40 : W - 34 - index * 40;
      room.paddles.push({ ...member, side, x, y: (H - paddleH) / 2 + (index ? 100 : 0), key: 0, ready: false });
    } else {
      room.balls.push(createBall(member));
    }
    socket.data.room = room.id;
    socket.join(room.id);
    reply({ ok: true, id: socket.id });
    broadcast(room);
  });
  socket.on('move', direction => {
    if (![-1, 0, 1].includes(direction)) return;
    const paddle = rooms.get(socket.data.room)?.paddles.find(p => p.id === socket.id);
    if (paddle) paddle.key = direction;
  });
  socket.on('start', () => {
    const room = rooms.get(socket.data.room);
    const paddle = room?.paddles.find(p => p.id === socket.id);
    if (!paddle || room.playing || room.paddles.length !== slots(room.mode).length) return;
    paddle.ready = true;
    if (room.paddles.every(p => p.ready)) {
      room.score = { left: 0, right: 0 }; room.level = 1; room.winner = null; room.time = 0;
      room.paddles.forEach(p => { p.y = (H - paddleH) / 2; p.key = 0; });
      room.balls = room.balls.map(b => createBall(b.owner ? { id: b.owner, name: b.name } : null));
      room.playing = true;
    }
    broadcast(room);
  });
  socket.on('leaveGame', () => leave(socket));
  socket.on('disconnect', () => leave(socket));
});

// Physics runs at 60 Hz. Network snapshots run at 30 Hz; browsers draw every frame.
let previous = performance.now(), tick = 0;
const timer = setInterval(() => {
  const now = performance.now(), dt = Math.min((now - previous) / 1000, .05); previous = now;
  for (const room of rooms.values()) {
    if (room.playing) {
      room.time += dt;
      for (const p of room.paddles) p.y = Math.max(0, Math.min(H - paddleH, p.y + p.key * 360 * dt));
      for (const b of room.balls) {
        const speed = 1 + (room.level - 1) * .12;
        // Lunar drift bends the trajectory gently; solar storm alternates its wind.
        if (room.level >= 2) b.vy = Math.max(-320, Math.min(320, b.vy + (room.level === 2 ? 35 : Math.sin(room.time * 2) * 100) * dt));
        const oldX = b.x; b.x += b.vx * speed * dt; b.y += b.vy * dt;
        if (b.y < radius || b.y > H - radius) { b.y = Math.max(radius, Math.min(H - radius, b.y)); b.vy *= -1; }
        for (const p of room.paddles) {
          const crossed = b.vx < 0 ? oldX - radius >= p.x + paddleW && b.x - radius <= p.x + paddleW : oldX + radius <= p.x && b.x + radius >= p.x;
          if (crossed && b.y + radius >= p.y && b.y - radius <= p.y + paddleH) {
            b.x = b.vx < 0 ? p.x + paddleW + radius : p.x - radius;
            b.vx *= -1; b.vy = (b.y - p.y - paddleH / 2) * 5;
            io.to(room.id).emit('rebound'); break;
          }
        }
        if (b.x < -radius || b.x > W + radius) {
          const side = b.x < 0 ? 'right' : 'left'; room.score[side]++;
          Object.assign(b, createBall(b.owner ? { id: b.owner, name: b.name } : null, side === 'right' ? 1 : -1));
          room.level = Math.min(3, 1 + Math.floor((room.score.left + room.score.right) / 4));
          if (room.mode !== 'infinite' && room.score[side] >= 10) {
            room.winner = side; room.playing = false; room.paddles.forEach(p => { p.ready = false; p.key = 0; }); break;
          }
        }
      }
    }
    if (tick % 2 === 0) broadcast(room);
  }
  tick++;
}, 1000 / 60);
if (require.main === module) {
  const port = process.env.PORT || 3000;
  server.listen(port, '0.0.0.0', () => console.log(`ORBITRON: http://localhost:${port}`));
}
module.exports = { server, io, rooms, timer };
