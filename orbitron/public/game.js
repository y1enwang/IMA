const $ = id => document.getElementById(id);
const socket = io();
const ctx = $('game').getContext('2d');
const modes = { solo: '1 ON 1', duo: '2 ON 2', infinite: 'INFINITE' };
const palettes = [null, ['#00d9ff', '#000814'], ['#a897ff', '#09061b'], ['#ff9c38', '#180c06']];
let selectedMode = null, state = null, myId = null, direction = 0, frameTime = performance.now();
let visualPaddles = new Map(), visualBalls = new Map(), soundOn = false, joining = false;
const held = new Set();
const bgm = new Audio('/assets/bgm.mp3'); bgm.loop = true; bgm.volume = .12;
const rebound = new Audio('/assets/rebound.mp3'); rebound.volume = .25;
function showMessage(text) { $('message').textContent = text; }
function resetView(message) {
  state = null; myId = null; direction = 0; joining = false; held.clear(); visualPaddles.clear(); visualBalls.clear();
  $('arena').hidden = true; $('lobby').hidden = false; $('join').disabled = !socket.connected;
  bgm.pause(); $('teams').hidden = true; $('arena').classList.remove('animal-mode'); showMessage(message);
}
socket.on('connect', () => { $('join').disabled = false; showMessage('Connected. Choose a mode to begin.'); });
socket.on('disconnect', () => resetView('Connection lost. Reconnect, then join again.'));
socket.on('connect_error', () => showMessage('Cannot reach the server. Trying again…'));
for (const button of document.querySelectorAll('.mode')) button.addEventListener('click', () => {
  selectedMode = button.dataset.mode;
  for (const b of document.querySelectorAll('.mode')) b.setAttribute('aria-pressed', String(b === button));
  $('joinForm').hidden = false; $('name').focus();
});
$('joinForm').addEventListener('submit', e => {
  e.preventDefault();
  if (joining || !socket.connected) return;
  joining = true; $('join').disabled = true;
  socket.timeout(7000).emit('joinGame', { mode: selectedMode, name: $('name').value }, (error, result) => {
    joining = false; $('join').disabled = !socket.connected;
    if (error) { showMessage('Joining timed out. Reconnecting…'); socket.disconnect().connect(); return; }
    if (result.error) { showMessage(result.error); return; }
    myId = result.id; $('lobby').hidden = true; $('arena').hidden = false;
    if (soundOn) bgm.play().catch(() => {});
  });
});
$('leave').addEventListener('click', () => { socket.emit('leaveGame'); resetView('Choose your next connection.'); });
$('start').addEventListener('click', () => socket.emit('start'));
$('sound').addEventListener('click', () => {
  soundOn = !soundOn; $('sound').textContent = soundOn ? 'SOUND ON' : 'SOUND OFF'; $('sound').setAttribute('aria-pressed', String(soundOn));
  if (soundOn) bgm.play().catch(() => {}); else bgm.pause();
});
socket.on('rebound', () => { if (soundOn) { rebound.currentTime = 0; rebound.play().catch(() => {}); } });
socket.on('state', next => {
  if (!myId) return;
  const oldPlaying = state?.playing;
  state = next;
  const me = state.paddles.find(p => p.id === myId);
  const [accent, bg] = palettes[state.level];
  const animalMode = state.mode === 'infinite';
  $('arena').classList.toggle('animal-mode', animalMode);
  $('teams').hidden = !animalMode;
  $('dogScore').textContent = state.score.left;
  $('catScore').textContent = state.score.right;
  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty('--bg', bg);
  $('roomLabel').textContent = `${state.room} / ${modes[state.mode]}${animalMode ? ' / DOGS VS CATS' : ''}`;
  $('level').textContent = `LEVEL ${state.level} / ${state.environment.toUpperCase()}`;
  $('role').textContent = me ? `${me.name} / ${animalMode ? (me.side === 'left' ? 'DOG TEAM' : 'CAT TEAM') : me.side.toUpperCase() + ' PADDLE'}` : 'YOUR NAME IS AN AUTOMATIC BALL';
  $('count').textContent = `${state.members.length} CONNECTED · ${state.balls.length} ${state.balls.length === 1 ? 'BALL' : 'BALLS'}`;
  const full = state.paddles.length === state.required;
  $('status').textContent = state.playing ? (me ? (animalMode ? 'Dogs vs Cats! Defend your side. Every ball can score.' : 'Orbit active. Keep the connection alive.') : (animalMode ? 'Your ball is in the Dogs vs Cats arena. No steering — watch the chaos!' : 'Your ball is in orbit. Watch it change the match.')) :
    !full ? `Waiting for paddle players (${state.paddles.length}/${state.required})…` :
    state.winner ? `${state.winner.toUpperCase()} TEAM WINS! ${me?.ready ? 'Waiting for everyone…' : 'Ready for another orbit?'}` :
    me?.ready ? 'Ready. Waiting for the other players…' : 'Every paddle player must click I’M READY.';
  $('start').disabled = !me || !full || state.playing || me.ready;
  $('start').textContent = state.playing ? 'ORBIT ACTIVE' : me?.ready ? 'READY ✓' : state.winner ? 'PLAY AGAIN' : 'I’M READY';
  $('up').disabled = $('down').disabled = !me;
  for (const p of state.paddles) {
    const visual = visualPaddles.get(p.id);
    if (!visual || !state.playing || !oldPlaying) visualPaddles.set(p.id, { y: p.y });
    // Correct large drift; small corrections blend with immediate local movement.
    else if (p.id === myId && Math.abs(visual.y - p.y) > 75) visual.y = p.y;
  }
});
function move(value) { if (direction !== value) { direction = value; if (myId) socket.emit('move', value); } }
function updateKeys() { move(Number(held.has('s') || held.has('ArrowDown')) - Number(held.has('w') || held.has('ArrowUp'))); }
for (const event of ['keydown', 'keyup']) document.addEventListener(event, e => {
  if (!myId || e.target.tagName === 'INPUT') return;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (!['w', 's', 'ArrowUp', 'ArrowDown'].includes(key)) return;
  e.preventDefault(); if (event === 'keydown') held.add(key); else held.delete(key); updateKeys();
});
function stopMove() { held.clear(); move(0); }
window.addEventListener('blur', stopMove);
document.addEventListener('visibilitychange', () => { if (document.hidden) stopMove(); });
for (const [id, value] of [['up', -1], ['down', 1]]) {
  $(id).addEventListener('pointerdown', e => { e.preventDefault(); $(id).setPointerCapture(e.pointerId); move(value); });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) $(id).addEventListener(event, stopMove);
}
function label(text, x, y, color, align = 'left') {
  ctx.fillStyle = color; ctx.textAlign = align; ctx.font = '12px system-ui';
  ctx.fillText(text, x, Math.max(16, Math.min(488, y)));
}
// Simple neon animal faces: these are decoration, not collision objects.
function drawMascot(kind, x, y, scale, color) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineJoin = 'round';
  ctx.shadowColor = color; ctx.shadowBlur = 8;
  ctx.beginPath();
  if (kind === 'dog') {
    ctx.moveTo(-30, -28); ctx.lineTo(-48, -18); ctx.lineTo(-48, 20); ctx.lineTo(-30, 8);
    ctx.moveTo(30, -28); ctx.lineTo(48, -18); ctx.lineTo(48, 20); ctx.lineTo(30, 8);
    ctx.moveTo(-30, -28); ctx.lineTo(30, -28); ctx.lineTo(30, 22); ctx.quadraticCurveTo(0, 48, -30, 22); ctx.closePath();
  } else {
    ctx.moveTo(-32, 22); ctx.lineTo(-32, -40); ctx.lineTo(-12, -22); ctx.lineTo(12, -22); ctx.lineTo(32, -40); ctx.lineTo(32, 22); ctx.quadraticCurveTo(0, 45, -32, 22);
    for (const sign of [-1, 1]) { ctx.moveTo(sign * 20, 10); ctx.lineTo(sign * 48, 4); ctx.moveTo(sign * 20, 18); ctx.lineTo(sign * 48, 24); }
  }
  ctx.stroke(); ctx.fillStyle = color;
  for (const ex of [-13, 13]) { ctx.beginPath(); ctx.arc(ex, -4, 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.beginPath(); ctx.moveTo(-5, 10); ctx.lineTo(5, 10); ctx.lineTo(0, 16); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, 16); ctx.lineTo(0, 24); ctx.stroke(); ctx.restore();
}
function draw(now) {
  const dt = Math.min((now - frameTime) / 1000, .05); frameTime = now;
  if (state && myId) {
    const [accent, bg] = palettes[state.level];
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 800, 500);
    const animalMode = state.mode === 'infinite';
    if (animalMode) {
      const leftGlow = ctx.createLinearGradient(0, 0, 800, 0);
      leftGlow.addColorStop(0, '#00d9ff12'); leftGlow.addColorStop(.5, '#00000000'); leftGlow.addColorStop(1, '#ff9c3812');
      ctx.fillStyle = leftGlow; ctx.fillRect(0, 0, 800, 500);
      ctx.save(); ctx.globalAlpha = .16;
      drawMascot('dog', 170, 260, 1.8, '#00d9ff'); drawMascot('cat', 630, 260, 1.8, '#ff9c38'); ctx.restore();
    }
    ctx.strokeStyle = accent + '18'; ctx.lineWidth = 1;
    for (let x = 0; x <= 800; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 500); ctx.stroke(); }
    for (let y = 0; y <= 500; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(800, y); ctx.stroke(); }
    if (state.level >= 2) {
      ctx.strokeStyle = accent + '30'; ctx.beginPath(); ctx.ellipse(400, 250, 160, 180, state.level === 3 ? .6 : 0, 0, Math.PI * 2); ctx.stroke();
      label(state.level === 2 ? 'LUNAR GRAVITY ↓' : 'SOLAR WIND ↕', 400, 475, accent, 'center');
    }
    ctx.setLineDash([5, 12]); ctx.strokeStyle = accent + '70'; ctx.beginPath(); ctx.moveTo(400, 0); ctx.lineTo(400, 500); ctx.stroke(); ctx.setLineDash([]);
    ctx.textAlign = 'center'; ctx.font = '700 32px Orbitron, sans-serif'; ctx.fillStyle = accent;
    if (animalMode) {
      drawMascot('dog', 270, 38, .4, '#00d9ff'); drawMascot('cat', 530, 38, .4, '#ff9c38');
      ctx.fillStyle = '#00d9ff';
    }
    ctx.fillText(state.score.left, 330, 55); ctx.fillStyle = animalMode ? '#ff9c38' : '#ff0037'; ctx.fillText(state.score.right, 470, 55);
    const blend = 1 - Math.exp(-18 * dt);
    const paddleIds = new Set(state.paddles.map(p => p.id));
    for (const id of visualPaddles.keys()) if (!paddleIds.has(id)) visualPaddles.delete(id);
    for (const p of state.paddles) {
      const v = visualPaddles.get(p.id) || { y: p.y };
      if (p.id === myId && state.playing) {
        v.y = Math.max(0, Math.min(420, v.y + direction * 360 * dt));
        if (direction === 0) v.y += (p.y - v.y) * blend;
      } else v.y += (p.y - v.y) * blend;
      visualPaddles.set(p.id, v);
      const color = animalMode ? (p.side === 'left' ? '#00d9ff' : '#ff9c38') : (p.side === 'left' ? accent : '#ff0037'); ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 14; ctx.fillRect(p.x, v.y, 10, 80); ctx.shadowBlur = 0;
      label(p.name, p.side === 'left' ? p.x + 16 : p.x - 6, v.y + 40, color, p.side === 'left' ? 'left' : 'right');
    }
    const ballIds = new Set(state.balls.map(b => b.id));
    for (const id of visualBalls.keys()) if (!ballIds.has(id)) visualBalls.delete(id);
    for (const b of state.balls) {
      const v = visualBalls.get(b.id) || { x: b.x, y: b.y };
      if (Math.abs(v.x - b.x) > 140) { v.x = b.x; v.y = b.y; }
      else { v.x += (b.x - v.x) * blend; v.y += (b.y - v.y) * blend; }
      visualBalls.set(b.id, v);
      ctx.fillStyle = b.owner === myId ? '#ffe38b' : '#ffffff'; ctx.shadowColor = accent; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(v.x, v.y, 7, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.stroke(); ctx.shadowBlur = 0;
      if (b.name) label(b.name, Math.max(70, Math.min(730, v.x)), v.y - 15, b.owner === myId ? '#ffe38b' : accent, 'center');
    }
  }
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
