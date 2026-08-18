# 🎵 Band Rush! (ตั้งวงด่วน!)

เกมจัดหมวดหมู่เครื่องดนตรีแบบ Real-time Multiplayer สำหรับห้องเรียน

## 🗂 โครงสร้าง

```
band-rush/
├── server/          ← Node.js + Socket.io (Backend)
│   ├── index.js
│   └── package.json
├── client/          ← React (Frontend)
│   ├── src/
│   │   ├── App.js
│   │   ├── hooks/useSocket.js
│   │   └── components/
│   │       ├── LobbyScreen.js
│   │       ├── GameScreen.js
│   │       ├── TeacherDashboard.js
│   │       └── GameOverScreen.js
│   └── package.json
├── render.yaml      ← Render deployment config
└── README.md
```

---

## 🚀 Deploy บน Render (ฟรี!)

### ขั้นตอนที่ 1: Push ขึ้น GitHub

```bash
git init
git add .
git commit -m "🎵 Band Rush initial commit"
git remote add origin https://github.com/YOUR_USERNAME/band-rush.git
git push -u origin main
```

### ขั้นตอนที่ 2: Deploy Server ก่อน

1. ไปที่ [render.com](https://render.com) → New → Web Service
2. เชื่อม GitHub repo → เลือก repo `band-rush`
3. ตั้งค่า:
   - **Root Directory:** `server`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node index.js`
   - **Instance Type:** Free
4. กด **Create Web Service**
5. รอ deploy → จด URL ที่ได้ เช่น `https://band-rush-server.onrender.com`

### ขั้นตอนที่ 3: Deploy Client

1. Render → New → Web Service (อีกครั้ง)
2. เชื่อม GitHub repo เดิม
3. ตั้งค่า:
   - **Root Directory:** `client`
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npx serve -s build -l 3000`
4. เพิ่ม **Environment Variable:**
   - Key: `REACT_APP_SERVER_URL`
   - Value: URL ของ server ที่ได้จากขั้นที่ 2 (ไม่มี / ท้าย)
5. กด **Create Web Service**

### ขั้นตอนที่ 4: ทดสอบ

เปิด URL ของ client → ควรเห็นหน้า Lobby ของ Band Rush!

---

## 🧪 ทดสอบในเครื่อง (Local)

```bash
# Terminal 1 - Server
cd server
npm install
npm start
# Server จะรันที่ http://localhost:3001

# Terminal 2 - Client
cd client
npm install
REACT_APP_SERVER_URL=http://localhost:3001 npm start
# Client จะรันที่ http://localhost:3000
```

เปิดหน้าต่างเบราว์เซอร์หลายๆ อันเพื่อจำลองผู้เล่นหลายคน

---

## 🎮 วิธีเล่น

### ผู้เล่น (Mobile Landscape)
1. เปิดเว็บบน Chrome มือถือ → **เข้าร่วมห้อง** พิมพ์ PIN
2. **กดการ์ด** เพื่อหงาย → ดูเครื่องดนตรีและหมวด
3. **ลากการ์ด** ไปใส่ Drop Zone หมวดที่ถูกต้อง (ด้านบน)
4. **ปัดการ์ดออกขอบ** ซ้าย/ขวา → ส่งการ์ดไปให้เพื่อนในทีม
5. **กด 🛒 Shop** → ซื้อไอเทมด้วยเหรียญที่สะสม

### ครู (Desktop/Projector)
1. สร้างห้อง → แชร์ PIN ให้นักเรียน
2. เปิดหน้าจอครู → ดู Dashboard คะแนนแบบ Real-time
3. กด **เริ่มเกม** เมื่อนักเรียนเข้าครบ

---

## 📡 Socket Events

| Event | ทิศทาง | หน้าที่ |
|-------|---------|---------|
| `create_room` | C→S | สร้างห้องใหม่ |
| `join_room` | C→S | เข้าร่วมห้อง |
| `start_game` | C→S | เริ่มเกม (โฮสต์เท่านั้น) |
| `flip_card` | C→S | หงาย/คว่ำการ์ด |
| `swipe_card` | C→S | ปัดการ์ดไปเพื่อน |
| `submit_match` | C→S | จับคู่การ์ดกับหมวด |
| `buy_and_use_item` | C→S | ซื้อและใช้ไอเทม |
| `sync_state` | S→C | อัปเดต state ทุก client |
| `receive_card` | S→C | การ์ดบินเข้าจอ |
| `match_result` | S→C | ผลการจับคู่ |
| `coin_updated` | S→C | อัปเดตเหรียญ |
| `sabotage_hit` | S→C | โดนไอเทมโจมตี |
| `timer_tick` | S→C | นับถอยหลัง |
| `game_over` | S→C | เกมจบ + leaderboard |

---

## 🛠 Phases ที่ทำแล้ว (Phase 1-4)

- ✅ Phase 1: Join Room / Lobby System
- ✅ Phase 2: Card flip + drag UI
- ✅ Phase 3: Cross-screen swipe magic
- ✅ Phase 4: Match logic + coin economy
- ✅ Phase 5: Shop + Sabotage items (Coda/Glissando/Fermata/Forte)
- ✅ Teacher Dashboard
- 🔲 Phase 6: Real graphic assets + sound effects
