// Orchestra Rush — Socket.io game server
// Real-time multiplayer "Family Style"-style music teaching game.
// Deploy this on Render.com / Railway.app / Fly.io (needs a long-running Node process).

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' } // allow the client (hosted anywhere) to connect
});

// Serve the game client (client/index.html copied into server/public/)
app.use(express.static('public'));

// ---------- Game data ----------

const CATEGORY_LIST = [
  { id: 'strings', label: 'STRINGS', labelTh: 'เครื่องสาย' },
  { id: 'woodwind', label: 'WOODWIND', labelTh: 'เครื่องลมไม้' },
  { id: 'brass', label: 'BRASS', labelTh: 'เครื่องทองเหลือง' },
  { id: 'percussion', label: 'PERCUSSION', labelTh: 'เครื่องกระทบ' },
  { id: 'keys', label: 'KEYS', labelTh: 'คีย์บอร์ด/แป้นนิ้ว' }
];

const INSTRUMENTS = {
  strings: ['Violin', 'Viola', 'Cello', 'Double Bass', 'Guitar', 'Harp'],
  woodwind: ['Flute', 'Clarinet', 'Oboe', 'Bassoon', 'Piccolo', 'Saxophone'],
  brass: ['Trumpet', 'Trombone', 'French Horn', 'Tuba', 'Cornet', 'Euphonium'],
  percussion: ['Snare Drum', 'Bass Drum', 'Xylophone', 'Cymbal', 'Triangle', 'Timpani'],
  keys: ['Piano', 'Keyboard', 'Accordion', 'Organ', 'Celesta', 'Harpsichord']
};

// Instrument pairs that sound/look similar — introduced at higher difficulty
const CONFUSABLES = [
  ['Violin', 'Viola'],
  ['Trumpet', 'Trombone', 'Cornet'],
  ['Oboe', 'Clarinet'],
  ['Piano', 'Keyboard'],
  ['Snare Drum', 'Bass Drum']
];

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomInstrument(categoryId, round) {
  const pool = INSTRUMENTS[categoryId];
  // higher rounds favor confusable pairs relevant to this category
  if (round >= 3 && Math.random() < 0.35) {
    const candidates = CONFUSABLES.filter(pair =>
      pair.some(name => pool.includes(name))
    );
    if (candidates.length) {
      const pair = candidates[Math.floor(Math.random() * candidates.length)];
      const inCat = pair.filter(name => pool.includes(name));
      if (inCat.length) return inCat[Math.floor(Math.random() * inCat.length)];
    }
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

function makeCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

let idCounter = 1;
function nextId() {
  return 'i' + (idCounter++);
}

// ---------- Room state ----------
// rooms[code] = {
//   code, hostId, maxPlayers,
//   players: [{ id(socketId), name, categoryId, seat, score, tray: [{id, categoryId, name}] , box: null | item }],
//   started: bool, round: number, timer: {endsAt, duration}, targetPerRound, roundResults
// }
const rooms = {};

function publicState(room) {
  return {
    code: room.code,
    started: room.started,
    round: room.round,
    maxPlayers: room.maxPlayers,
    targetPerRound: room.targetPerRound,
    timerEndsAt: room.timerEndsAt || null,
    timerDuration: room.timerDuration || null,
    players: room.players.map((p, idx) => ({
      id: p.id,
      name: p.name,
      categoryId: p.categoryId,
      category: CATEGORY_LIST.find(c => c.id === p.categoryId),
      seat: p.seat,
      score: p.score,
      tray: p.tray,
      box: p.box,
      leftNeighbor: neighborName(room, idx, -1),
      rightNeighbor: neighborName(room, idx, 1)
    })),
    lastRoundSummary: room.lastRoundSummary || null
  };
}

function neighborName(room, idx, dir) {
  const n = room.players.length;
  if (n < 2) return null;
  const p = room.players[(idx + dir + n) % n];
  return p ? p.name : null;
}

function broadcastState(code) {
  const room = rooms[code];
  if (!room) return;
  io.to(code).emit('state', publicState(room));
}

function spawnRound(room) {
  room.round += 1;
  room.roundResults = null;
  room.lastRoundSummary = null;

  const n = room.players.length;
  const baseDuration = Math.max(30, 60 - (room.round - 1) * 5); // shrinks each round, floor 30s
  const itemsPerPlayer = Math.min(6, 3 + Math.floor((room.round - 1) / 2));

  room.players.forEach(p => {
    p.tray = [];
    p.box = null;
    p.collectedThisRound = 0;
    for (let i = 0; i < itemsPerPlayer; i++) {
      // ~45% chance the spawned item matches the player's own category
      const useOwn = Math.random() < 0.45;
      const catId = useOwn
        ? p.categoryId
        : room.players[Math.floor(Math.random() * n)].categoryId;
      const name = randomInstrument(catId, room.round);
      p.tray.push({ id: nextId(), categoryId: catId, name });
    }
  });

  room.targetPerRound = Math.ceil(itemsPerPlayer * 0.6);
  room.timerDuration = baseDuration;
  room.timerEndsAt = Date.now() + baseDuration * 1000;

  clearTimeout(room._roundTimeout);
  room._roundTimeout = setTimeout(() => endRound(room), baseDuration * 1000);
}

function endRound(room) {
  clearTimeout(room._roundTimeout);
  room.timerEndsAt = null;
  room.players.forEach(p => {
    // whatever's still sitting in the box when the round ends counts as missed too
    if (p.box) { p.tray.push(p.box); p.box = null; }
  });
  const summary = room.players.map(p => ({
    name: p.name,
    categoryId: p.categoryId,
    category: CATEGORY_LIST.find(c => c.id === p.categoryId),
    collected: p.collectedThisRound || 0,
    target: room.targetPerRound,
    missed: p.tray.map(t => t.name) // whatever's left in tray = missed
  }));
  room.lastRoundSummary = summary;
  broadcastState(room.code);
}

// ---------- Socket handlers ----------

io.on('connection', socket => {
  socket.on('createRoom', ({ name, maxPlayers }, cb) => {
    let code;
    do { code = makeCode(); } while (rooms[code]);

    const room = {
      code,
      hostId: socket.id,
      maxPlayers: Math.max(2, Math.min(5, maxPlayers || 4)),
      players: [],
      started: false,
      round: 0
    };
    rooms[code] = room;

    room.players.push({ id: socket.id, name: name || 'Player 1', categoryId: null, seat: 0, score: 0, tray: [], box: null });
    socket.join(code);
    socket.data.roomCode = code;

    cb && cb({ ok: true, code });
    broadcastState(code);
  });

  socket.on('joinRoom', ({ name, code }, cb) => {
    const room = rooms[code];
    if (!room) return cb && cb({ ok: false, error: 'ไม่พบห้องนี้' });
    if (room.started) return cb && cb({ ok: false, error: 'เกมเริ่มไปแล้ว' });
    if (room.players.length >= room.maxPlayers) return cb && cb({ ok: false, error: 'ห้องเต็มแล้ว' });

    room.players.push({ id: socket.id, name: name || `Player ${room.players.length + 1}`, categoryId: null, seat: room.players.length, score: 0, tray: [], box: null });
    socket.join(code);
    socket.data.roomCode = code;

    cb && cb({ ok: true, code });
    broadcastState(code);
  });

  socket.on('startGame', () => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room || room.hostId !== socket.id || room.started) return;
    if (room.players.length < 2) return;

    // shuffle seating order
    room.players = shuffle(room.players).map((p, idx) => ({ ...p, seat: idx }));
    // assign unique categories
    const cats = shuffle(CATEGORY_LIST).slice(0, room.players.length).map(c => c.id);
    room.players.forEach((p, idx) => { p.categoryId = cats[idx]; p.score = 0; });

    room.started = true;
    spawnRound(room);
    broadcastState(code);
  });

  // Player drags a matching item into their box (box holds one item at a time)
  socket.on('loadBox', ({ itemId }) => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room || !room.started) return;
    const p = room.players.find(pl => pl.id === socket.id);
    if (!p || p.box) return; // box already occupied

    const idx = p.tray.findIndex(t => t.id === itemId);
    if (idx === -1) return;
    const item = p.tray[idx];
    if (item.categoryId !== p.categoryId) return; // must match own category

    p.tray.splice(idx, 1);
    p.box = item;
    broadcastState(code);
  });

  // Player pushes their loaded box up top — scores it
  socket.on('sendBox', () => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room || !room.started) return;
    const p = room.players.find(pl => pl.id === socket.id);
    if (!p || !p.box) return;

    p.box = null;
    p.score += 1;
    p.collectedThisRound = (p.collectedThisRound || 0) + 1;

    checkRoundComplete(room);
    broadcastState(code);
  });

  // Player passes a non-matching item to left/right neighbor
  socket.on('pass', ({ itemId, direction, speed }) => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room || !room.started) return;
    const idx = room.players.findIndex(pl => pl.id === socket.id);
    if (idx === -1) return;
    const p = room.players[idx];

    const itemIdx = p.tray.findIndex(t => t.id === itemId);
    if (itemIdx === -1) return;
    const [item] = p.tray.splice(itemIdx, 1);

    const n = room.players.length;
    const dir = direction === 'left' ? -1 : 1;
    const target = room.players[(idx + dir + n) % n];
    // tag which screen edge it should fly in from on the receiver's side, and how
    // fast — the sender is on the receiver's *opposite* side from the pass direction
    target.tray.push({
      ...item,
      enteredFrom: direction === 'left' ? 'right' : 'left',
      entrySpeed: typeof speed === 'number' ? speed : undefined
    });

    broadcastState(code);
  });

  socket.on('nextRound', () => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room || room.hostId !== socket.id || !room.started) return;
    spawnRound(room);
    broadcastState(code);
  });

  socket.on('disconnect', () => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room) return;
    room.players = room.players.filter(p => p.id !== socket.id);
    if (room.players.length === 0) {
      clearTimeout(room._roundTimeout);
      delete rooms[code];
      return;
    }
    if (room.hostId === socket.id) room.hostId = room.players[0].id;
    broadcastState(code);
  });
});

function checkRoundComplete(room) {
  const allDone = room.players.every(p => (p.collectedThisRound || 0) >= room.targetPerRound);
  if (allDone) endRound(room);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Orchestra Rush server listening on port ' + PORT));
