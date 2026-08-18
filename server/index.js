const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// ==================== IN-MEMORY STATE (Redis substitute) ====================
const rooms = {}; // roomId -> room object
const socketToRoom = {}; // socketId -> { roomId, teamId }

// ==================== INSTRUMENT DATA ====================
const INSTRUMENTS = [
  { id: "violin", name: "Violin", family: "Strings", emoji: "🎻" },
  { id: "cello", name: "Cello", family: "Strings", emoji: "🎻" },
  { id: "guitar", name: "Guitar", family: "Strings", emoji: "🎸" },
  { id: "bass", name: "Bass Guitar", family: "Strings", emoji: "🎸" },
  { id: "harp", name: "Harp", family: "Strings", emoji: "🪕" },
  { id: "trumpet", name: "Trumpet", family: "Brass", emoji: "🎺" },
  { id: "trombone", name: "Trombone", family: "Brass", emoji: "🎺" },
  { id: "tuba", name: "Tuba", family: "Brass", emoji: "🎺" },
  { id: "french_horn", name: "French Horn", family: "Brass", emoji: "📯" },
  { id: "flute", name: "Flute", family: "Woodwind", emoji: "🪈" },
  { id: "clarinet", name: "Clarinet", family: "Woodwind", emoji: "🎷" },
  { id: "saxophone", name: "Saxophone", family: "Woodwind", emoji: "🎷" },
  { id: "oboe", name: "Oboe", family: "Woodwind", emoji: "🪈" },
  { id: "bassoon", name: "Bassoon", family: "Woodwind", emoji: "🪈" },
  { id: "drums", name: "Drums", family: "Percussion", emoji: "🥁" },
  { id: "xylophone", name: "Xylophone", family: "Percussion", emoji: "🎵" },
  { id: "timpani", name: "Timpani", family: "Percussion", emoji: "🥁" },
  { id: "piano", name: "Piano", family: "Keyboard", emoji: "🎹" },
  { id: "organ", name: "Organ", family: "Keyboard", emoji: "🎹" },
  { id: "accordion", name: "Accordion", family: "Keyboard", emoji: "🪗" },
];

const FAMILIES = ["Strings", "Brass", "Woodwind", "Percussion", "Keyboard"];
const TRASH_CARDS = [
  { id: "shoe", name: "Shoe", family: null, emoji: "👟", isTrash: true },
  { id: "broom", name: "Broom", family: null, emoji: "🧹", isTrash: true },
  { id: "rubber_duck", name: "Duck", family: null, emoji: "🦆", isTrash: true },
  { id: "banana", name: "Banana", family: null, emoji: "🍌", isTrash: true },
  { id: "sock", name: "Sock", family: null, emoji: "🧦", isTrash: true },
];

const ITEMS = {
  coda: { name: "Coda 💣", price: 20, type: "sabotage", desc: "ส่งการ์ดขยะ 5 ใบใส่เป้าหมาย" },
  glissando: { name: "Glissando 🌀", price: 40, type: "sabotage", desc: "สลับการ์ดบนจอเป้าหมาย" },
  fermata: { name: "Fermata ❄️", price: 80, type: "sabotage", desc: "แช่แข็งจอเป้าหมาย 5 วินาที" },
  forte: { name: "Forte 💡", price: 30, type: "buff", desc: "หงายการ์ดทีมตัวเอง 3 วินาที" },
};

// ==================== HELPER FUNCTIONS ====================
function generatePin() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function generateCards(count = 12) {
  const cards = [];
  const shuffled = [...INSTRUMENTS].sort(() => Math.random() - 0.5);
  for (let i = 0; i < Math.min(count, shuffled.length); i++) {
    cards.push({
      cardId: `c_${uuidv4().slice(0, 8)}`,
      instrument: shuffled[i].id,
      name: shuffled[i].name,
      family: shuffled[i].family,
      emoji: shuffled[i].emoji,
      isFaceUp: false,
      owner: null,
      x: Math.random() * 60 + 20,
      y: Math.random() * 40 + 30,
    });
  }
  return cards;
}

function assignRoles(players) {
  const familiesCopy = [...FAMILIES];
  const playerIds = Object.keys(players);
  playerIds.forEach((pid, idx) => {
    // Each player gets assigned families round-robin
    players[pid].assigned_roles = [];
    const start = idx % familiesCopy.length;
    players[pid].assigned_roles.push(familiesCopy[start]);
    if (playerIds.length <= 2) {
      // With fewer players, give more families
      players[pid].assigned_roles.push(familiesCopy[(start + 2) % familiesCopy.length]);
    }
  });
  return players;
}

function getTeamPlayerOrder(team) {
  return Object.keys(team.players);
}

function getRoomSafeState(room) {
  // Return state safe to send to clients
  return {
    roomId: room.roomId,
    pin: room.pin,
    type: room.type,
    status: room.status,
    timer_seconds: room.timer_seconds,
    teams: room.teams,
  };
}

// ==================== GAME TIMER ====================
function startGameTimer(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  room.status = "PLAYING";

  const tick = setInterval(() => {
    const r = rooms[roomId];
    if (!r || r.status !== "PLAYING") {
      clearInterval(tick);
      return;
    }
    r.timer_seconds--;
    io.to(roomId).emit("timer_tick", { seconds: r.timer_seconds });

    if (r.timer_seconds <= 0) {
      clearInterval(tick);
      r.status = "ENDED";
      // Build leaderboard
      const leaderboard = Object.entries(r.teams).map(([tid, team]) => ({
        teamId: tid,
        teamName: team.name,
        score: team.score,
        coins: team.coins,
      })).sort((a, b) => b.score - a.score);
      io.to(roomId).emit("game_over", { leaderboard });
    }
  }, 1000);

  room.timerInterval = tick;
}

// ==================== SOCKET EVENTS ====================
io.on("connection", (socket) => {
  console.log(`✅ Connected: ${socket.id}`);

  // ---- CREATE ROOM ----
  socket.on("create_room", ({ type, playerName, teamName }, cb) => {
    const pin = generatePin();
    const roomId = `room_${pin}`;
    const teamId = "team_1";

    rooms[roomId] = {
      roomId,
      pin,
      type: type || "COMPETITIVE",
      status: "LOBBY",
      timer_seconds: 120,
      timerInterval: null,
      teams: {
        [teamId]: {
          name: teamName || "Team 1",
          score: 0,
          coins: 0,
          combo_count: 0,
          active_debuffs: [],
          players: {
            [socket.id]: {
              name: playerName || "Player 1",
              assigned_roles: [],
              isHost: true,
            },
          },
          cards_on_desk: generateCards(12),
        },
      },
    };

    socketToRoom[socket.id] = { roomId, teamId };
    socket.join(roomId);

    console.log(`🏠 Room created: ${pin} by ${playerName}`);
    if (cb) cb({ success: true, pin, roomId, teamId });
    io.to(roomId).emit("sync_state", getRoomSafeState(rooms[roomId]));
  });

  // ---- JOIN ROOM ----
  socket.on("join_room", ({ pin, playerName, teamId }, cb) => {
    const roomId = `room_${pin}`;
    const room = rooms[roomId];

    if (!room) {
      if (cb) cb({ success: false, error: "ไม่พบห้อง PIN นี้" });
      return;
    }
    if (room.status === "ENDED") {
      if (cb) cb({ success: false, error: "เกมจบแล้ว" });
      return;
    }

    // Create team if doesn't exist
    let assignedTeamId = teamId;
    if (!room.teams[assignedTeamId]) {
      assignedTeamId = `team_${Object.keys(room.teams).length + 1}`;
      room.teams[assignedTeamId] = {
        name: `Team ${Object.keys(room.teams).length + 1}`,
        score: 0,
        coins: 0,
        combo_count: 0,
        active_debuffs: [],
        players: {},
        cards_on_desk: generateCards(12),
      };
    }

    room.teams[assignedTeamId].players[socket.id] = {
      name: playerName || "Player",
      assigned_roles: [],
      isHost: false,
    };

    socketToRoom[socket.id] = { roomId, teamId: assignedTeamId };
    socket.join(roomId);

    console.log(`👤 ${playerName} joined room ${pin} as ${assignedTeamId}`);
    if (cb) cb({ success: true, roomId, teamId: assignedTeamId });
    io.to(roomId).emit("sync_state", getRoomSafeState(room));
    io.to(roomId).emit("player_joined", { name: playerName, teamId: assignedTeamId });
  });

  // ---- START GAME ----
  socket.on("start_game", (_, cb) => {
    const info = socketToRoom[socket.id];
    if (!info) return;
    const room = rooms[info.roomId];
    if (!room) return;

    // Assign roles to all players
    Object.values(room.teams).forEach((team) => {
      team.players = assignRoles(team.players);
    });

    startGameTimer(info.roomId);
    io.to(info.roomId).emit("game_started", { timer: room.timer_seconds });
    io.to(info.roomId).emit("sync_state", getRoomSafeState(room));
    if (cb) cb({ success: true });
  });

  // ---- FLIP CARD ----
  socket.on("flip_card", ({ cardId, isFaceUp }) => {
    const info = socketToRoom[socket.id];
    if (!info) return;
    const room = rooms[info.roomId];
    if (!room) return;
    const team = room.teams[info.teamId];
    if (!team) return;

    // Only one card face up at a time per team
    team.cards_on_desk.forEach((c) => {
      if (c.isFaceUp && c.cardId !== cardId) {
        c.isFaceUp = false;
      }
    });

    const card = team.cards_on_desk.find((c) => c.cardId === cardId);
    if (card) {
      card.isFaceUp = isFaceUp;
      card.owner = socket.id;
    }

    // Broadcast to team members only
    io.to(info.roomId).emit("card_flipped", {
      teamId: info.teamId,
      cardId,
      isFaceUp,
      cards: team.cards_on_desk,
    });
  });

  // ---- SWIPE CARD (Cross-Screen Magic!) ----
  socket.on("swipe_card", ({ cardId, direction }) => {
    const info = socketToRoom[socket.id];
    if (!info) return;
    const room = rooms[info.roomId];
    if (!room) return;
    const team = room.teams[info.teamId];
    if (!team) return;

    const cardIdx = team.cards_on_desk.findIndex((c) => c.cardId === cardId);
    if (cardIdx === -1) return;

    const card = { ...team.cards_on_desk[cardIdx] };

    // Find next player in team
    const playerOrder = getTeamPlayerOrder(team);
    const currentIdx = playerOrder.indexOf(socket.id);
    const nextIdx = (currentIdx + 1) % playerOrder.length;
    const nextSocketId = playerOrder[nextIdx];

    if (nextSocketId === socket.id) {
      // Only one player, card bounces back
      return;
    }

    // Remove from current player's desk
    team.cards_on_desk.splice(cardIdx, 1);

    // Update card position for receiving player
    card.owner = nextSocketId;
    card.isFaceUp = false;
    card.x = direction === "right" ? 5 : 85;
    card.y = Math.random() * 40 + 30;

    // Add to team shared desk (receiver will pick it up)
    team.cards_on_desk.push(card);

    // Notify sender: card removed
    socket.emit("card_swiped_out", { cardId });

    // Notify receiver: card incoming
    io.to(nextSocketId).emit("receive_card", {
      cardData: card,
      fromDirection: direction === "right" ? "left" : "right",
    });

    // Update all team members
    io.to(info.roomId).emit("sync_state", getRoomSafeState(room));
    console.log(`🃏 Card ${cardId} swiped from ${socket.id} to ${nextSocketId}`);
  });

  // ---- SUBMIT MATCH ----
  socket.on("submit_match", ({ cardId, targetRole }) => {
    const info = socketToRoom[socket.id];
    if (!info) return;
    const room = rooms[info.roomId];
    if (!room || room.status !== "PLAYING") return;
    const team = room.teams[info.teamId];
    if (!team) return;

    const cardIdx = team.cards_on_desk.findIndex((c) => c.cardId === cardId);
    if (cardIdx === -1) return;

    const card = team.cards_on_desk[cardIdx];
    const isCorrect = card.family === targetRole;

    if (isCorrect) {
      // Remove matched card
      team.cards_on_desk.splice(cardIdx, 1);

      // Add points and coins
      const pointsAdded = 10;
      team.combo_count++;
      let coinsAdded = 10;
      if (team.combo_count >= 3) {
        coinsAdded += 15; // Combo bonus
      }

      team.score += pointsAdded;
      team.coins += coinsAdded;

      // Add new card to keep game going
      const newCards = generateCards(1);
      if (newCards.length > 0) {
        team.cards_on_desk.push(newCards[0]);
      }

      // Time bonus in co-op mode
      if (room.type === "COOP") {
        room.timer_seconds += 5;
      }

      socket.emit("match_result", {
        isCorrect: true,
        pointsAdded,
        coinsAdded,
        combo: team.combo_count,
      });
      io.to(info.roomId).emit("coin_updated", {
        teamId: info.teamId,
        newBalance: team.coins,
        score: team.score,
      });
      io.to(info.roomId).emit("dashboard_update", {
        teams: Object.entries(room.teams).map(([tid, t]) => ({
          teamId: tid,
          name: t.name,
          score: t.score,
          coins: t.coins,
        })),
      });
    } else {
      team.combo_count = 0;
      socket.emit("match_result", { isCorrect: false, pointsAdded: 0, coinsAdded: 0, combo: 0 });
    }

    io.to(info.roomId).emit("sync_state", getRoomSafeState(room));
  });

  // ---- BUY & USE ITEM (Atomic) ----
  socket.on("buy_and_use_item", ({ itemType, targetTeamId }, cb) => {
    const info = socketToRoom[socket.id];
    if (!info) return;
    const room = rooms[info.roomId];
    if (!room || room.status !== "PLAYING") {
      if (cb) cb({ success: false, error: "เกมยังไม่เริ่ม" });
      return;
    }
    const team = room.teams[info.teamId];
    if (!team) return;

    const item = ITEMS[itemType];
    if (!item) {
      if (cb) cb({ success: false, error: "ไม่พบไอเทม" });
      return;
    }

    // Atomic check
    if (team.coins < item.price) {
      if (cb) cb({ success: false, error: "เหรียญไม่พอ!" });
      return;
    }

    // Deduct coins
    team.coins -= item.price;

    // Broadcast coin update to team
    io.to(info.roomId).emit("coin_updated", {
      teamId: info.teamId,
      newBalance: team.coins,
      score: team.score,
    });

    // Apply item effect
    if (item.type === "sabotage" && targetTeamId && room.teams[targetTeamId]) {
      const targetTeam = room.teams[targetTeamId];

      switch (itemType) {
        case "coda":
          // Add 5 trash cards to target
          const trashCards = [];
          for (let i = 0; i < 5; i++) {
            const trash = TRASH_CARDS[i % TRASH_CARDS.length];
            trashCards.push({
              cardId: `trash_${uuidv4().slice(0, 6)}`,
              instrument: trash.id,
              name: trash.name,
              family: null,
              emoji: trash.emoji,
              isFaceUp: false,
              isTrash: true,
              owner: null,
              x: Math.random() * 70 + 15,
              y: Math.random() * 50 + 25,
            });
          }
          targetTeam.cards_on_desk.push(...trashCards);
          break;

        case "glissando":
          // Shuffle positions of face-down cards
          const faceDownCards = targetTeam.cards_on_desk.filter((c) => !c.isFaceUp);
          const positions = faceDownCards.map((c) => ({ x: c.x, y: c.y }));
          positions.sort(() => Math.random() - 0.5);
          faceDownCards.forEach((c, i) => {
            c.x = positions[i].x;
            c.y = positions[i].y;
          });
          break;

        case "fermata":
          // Freeze target team for 5 seconds
          targetTeam.active_debuffs.push("frozen");
          setTimeout(() => {
            if (rooms[info.roomId] && room.teams[targetTeamId]) {
              room.teams[targetTeamId].active_debuffs = room.teams[targetTeamId].active_debuffs.filter(
                (d) => d !== "frozen"
              );
              io.to(info.roomId).emit("debuff_cleared", { teamId: targetTeamId, debuff: "frozen" });
              io.to(info.roomId).emit("sync_state", getRoomSafeState(rooms[info.roomId]));
            }
          }, 5000);
          break;
      }

      io.to(info.roomId).emit("sabotage_hit", {
        targetTeamId,
        itemType,
        attackerTeamId: info.teamId,
      });
    } else if (item.type === "buff") {
      // Forte: reveal all cards for 3 seconds
      switch (itemType) {
        case "forte":
          const prevFaceUp = team.cards_on_desk.map((c) => ({
            cardId: c.cardId,
            was: c.isFaceUp,
          }));
          team.cards_on_desk.forEach((c) => (c.isFaceUp = true));
          io.to(info.roomId).emit("sync_state", getRoomSafeState(room));
          setTimeout(() => {
            if (rooms[info.roomId] && room.teams[info.teamId]) {
              prevFaceUp.forEach(({ cardId, was }) => {
                const c = room.teams[info.teamId].cards_on_desk.find((x) => x.cardId === cardId);
                if (c) c.isFaceUp = was;
              });
              io.to(info.roomId).emit("sync_state", getRoomSafeState(rooms[info.roomId]));
            }
          }, 3000);
          break;
      }
    }

    io.to(info.roomId).emit("sync_state", getRoomSafeState(room));
    if (cb) cb({ success: true, newBalance: team.coins });
  });

  // ---- DISCARD TRASH CARD ----
  socket.on("discard_trash", ({ cardId }) => {
    const info = socketToRoom[socket.id];
    if (!info) return;
    const team = rooms[info.roomId]?.teams[info.teamId];
    if (!team) return;
    const idx = team.cards_on_desk.findIndex((c) => c.cardId === cardId && c.isTrash);
    if (idx !== -1) {
      team.cards_on_desk.splice(idx, 1);
      io.to(info.roomId).emit("sync_state", getRoomSafeState(rooms[info.roomId]));
    }
  });

  // ---- DISCONNECT ----
  socket.on("disconnect", () => {
    const info = socketToRoom[socket.id];
    if (info) {
      const room = rooms[info.roomId];
      if (room && room.teams[info.teamId]) {
        delete room.teams[info.teamId].players[socket.id];
        // If no players left, clean up room after delay
        const totalPlayers = Object.values(room.teams).reduce(
          (sum, t) => sum + Object.keys(t.players).length,
          0
        );
        if (totalPlayers === 0) {
          setTimeout(() => {
            if (rooms[info.roomId]) {
              if (rooms[info.roomId].timerInterval) {
                clearInterval(rooms[info.roomId].timerInterval);
              }
              delete rooms[info.roomId];
              console.log(`🗑️ Room ${info.roomId} cleaned up`);
            }
          }, 30000);
        } else {
          io.to(info.roomId).emit("sync_state", getRoomSafeState(room));
          io.to(info.roomId).emit("player_left", { socketId: socket.id });
        }
      }
      delete socketToRoom[socket.id];
    }
    console.log(`❌ Disconnected: ${socket.id}`);
  });
});

// Health check
app.get("/", (req, res) => res.json({ status: "Band Rush Server Running! 🎵", rooms: Object.keys(rooms).length }));
app.get("/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`🎵 Band Rush Server on port ${PORT}`));
