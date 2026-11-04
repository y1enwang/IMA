const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { io: connect } = require('socket.io-client');
const { server, io, rooms, timer } = require('../server');
const clients = [];
let url;
const listening = new Promise(resolve => server.listen(0, '127.0.0.1', () => { url = `http://127.0.0.1:${server.address().port}`; resolve(); }));
async function player(mode, name) {
  await listening;
  const client = connect(url, { forceNew: true }); clients.push(client);
  await new Promise((resolve, reject) => { client.once('connect', resolve); client.once('connect_error', reject); });
  const result = await client.timeout(2000).emitWithAck('joinGame', { mode, name });
  assert.equal(result.ok, true);
  return client;
}
function nextState(c, predicate) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { c.off('state', handler); reject(new Error('State timeout')); }, 3000);
    function handler(s) { if (predicate(s)) { clearTimeout(timeout); c.off('state', handler); resolve(s); } }
    c.on('state', handler);
  });
}
after(async () => { clients.forEach(c => c.disconnect()); clearInterval(timer); await new Promise(resolve => io.close(resolve)); });
test('mode rooms, readiness, movement, levels, names and disconnects', async () => {
  const a = await player('solo', 'Alice'); const b = await player('solo', 'Bob');
  const initial = await nextState(a, s => s.paddles.length === 2);
  assert.deepEqual(initial.paddles.map(p => p.name), ['Alice', 'Bob']);
  const extra = await player('solo', 'New room');
  const isolated = await nextState(extra, s => s.members.length === 1);
  assert.notEqual(initial.room, isolated.room);
  a.emit('start');
  const waiting = await nextState(a, s => s.paddles[0].ready);
  assert.equal(waiting.playing, false);
  b.emit('start'); await nextState(a, s => s.playing);
  a.emit('move', -1);
  await nextState(a, s => s.paddles[0].y < 200); a.emit('move', 0);
  // Drive real scoring across both level thresholds and the winning threshold.
  const room = rooms.get(initial.room);
  room.score = { left: 3, right: 0 }; room.balls[0].x = 810;
  assert.equal((await nextState(a, s => s.level === 2)).environment, 'Lunar Drift');
  room.score = { left: 7, right: 0 }; room.balls[0].x = 810;
  assert.equal((await nextState(a, s => s.level === 3)).environment, 'Solar Storm');
  room.score = { left: 9, right: 0 }; room.balls[0].x = 810;
  const win = await nextState(a, s => s.winner); assert.equal(win.winner, 'left'); assert.equal(win.playing, false);
  a.emit('start'); b.emit('start'); const replay = await nextState(a, s => s.playing && s.level === 1); assert.equal(replay.score.left, 0);
  b.disconnect(); await nextState(a, s => !s.playing && s.paddles.length === 1);
  const d = await Promise.all(['D1', 'D2', 'D3', 'D4'].map(n => player('duo', n)));
  const teams = await nextState(d[0], s => s.paddles.length === 4);
  assert.equal(teams.paddles.filter(p => p.side === 'left').length, 2);
  assert.equal(new Set(teams.paddles.map(p => p.x)).size, 4);
  d.slice(0, 3).forEach(c => c.emit('start'));
  const notReady = await nextState(d[0], s => s.paddles.filter(p => p.ready).length === 3); assert.equal(notReady.playing, false);
  d[3].emit('start'); await nextState(d[0], s => s.playing);
  const i1 = await player('infinite', 'I1'), i2 = await player('infinite', 'I2'), ball = await player('infinite', 'Moon');
  const infinite = await nextState(i1, s => s.balls.some(b => b.name === 'Moon'));
  assert.equal(infinite.paddles.length, 2);
  ball.emit('move', 1); ball.emit('start');
  i1.emit('start'); i2.emit('start'); await nextState(i1, s => s.playing);
  const infRoom = rooms.get(infinite.room); infRoom.score.left = 99; infRoom.balls[0].x = 810;
  const endless = await nextState(i1, s => s.score.left >= 100); assert.equal(endless.winner, null);
  ball.disconnect(); await nextState(i1, s => !s.balls.some(b => b.name === 'Moon'));
  const any = await player('any', 'Explorer'); const matched = await nextState(any, s => s.members.some(m => m.name === 'Explorer'));
  assert.equal(matched.room, initial.room);
  const invalid = await any.timeout(2000).emitWithAck('joinGame', { mode: 'bad', name: 'x' }); assert.ok(invalid.error);
});
