# 🎸 Band Rush (ตั้งวงด่วน!)

โปรเจกต์นี้เป็น MVP ที่รันได้จริงของ Game Design Document ที่ให้มา ครอบคลุม Phase 1–5
(Lobby, การ์ด+ปัดข้ามจอ, คะแนน/เหรียญ, ร้านค้า+ไอเทมแกล้งเพื่อน) และมี Teacher Dashboard
พื้นฐานของ Phase 6 ไว้ให้แล้ว

โครงสร้างไฟล์:

```
band-rush/
├── server/            # Node.js + Express + Socket.io (มี package.json ที่นี่)
│   ├── server.js      # จุดเริ่มต้น รวม event ทั้งหมดตามข้อ 7 ของ GDD
│   ├── gameEngine.js  # ตรรกะเกม (matching, swipe, economy, item effects) — ข้อ 5
│   ├── gameData.js    # รายการเครื่องดนตรี/หมวดหมู่/ไอเทมร้านค้า
│   └── store.js       # In-memory store ที่มี shape เดียวกับ Redis JSON ในข้อ 6
├── public/
│   └── index.html     # Frontend ทั้งหมดในไฟล์เดียว (React ผ่าน CDN, ไม่ต้อง build)
└── test/
    └── smoke-test.js  # สคริปต์ทดสอบอัตโนมัติแบบ end-to-end
```

## วิธีรัน

ต้องมีการเชื่อมต่ออินเทอร์เน็ต (เพื่อโหลด React/Tailwind จาก CDN ในเบราว์เซอร์ และเพื่อ
`npm install` ครั้งแรก) — ตัวเซิร์ฟเวอร์เองไม่ต้องพึ่ง Redis หรือ MongoDB ภายนอก
(ใช้ in-memory store แทน จึงรันได้ทันทีโดยไม่ต้องตั้งค่า database)

```bash
cd server
npm install
npm start
```

จะเห็นข้อความ `🎸 Band Rush server listening on http://localhost:3000`

จากนั้นเปิดเบราว์เซอร์:

- **จอครู**: เปิด `http://localhost:3000` บนคอมพิวเตอร์/โปรเจคเตอร์ → กด "ครู" → เลือกโหมด →
  "สร้างห้อง" จะได้รหัส PIN 6 หลัก
- **จอนักเรียน**: เปิด `http://localhost:3000` บนมือถือ (หรือแท็บใหม่จำลอง) → กด "นักเรียน" →
  ใส่ PIN + ชื่อ + เลือกวง → เข้าร่วม
- ให้นักเรียนอย่างน้อย 2 คน join วงเดียวกัน (team) แล้วครูกด "เริ่มเกม"

> ถ้าเทสบนเครื่องเดียว ให้เปิดหลายแท็บ/หน้าต่าง incognito แทนอุปกรณ์หลายเครื่อง —
> ทำงานเหมือนกันเพราะทุกอย่างซิงก์ผ่าน Socket.io

### เปลี่ยนพอร์ต

```bash
PORT=8080 npm start
```

## Deploy ขึ้น Render

โปรเจกต์นี้พร้อม deploy บน [Render](https://render.com) แบบ Web Service ได้เลย เพราะ:
- ใช้ in-memory store ไม่ต้องพึ่ง Redis/MongoDB
- อ่านพอร์ตจาก `process.env.PORT` อยู่แล้ว (Render กำหนดพอร์ตให้อัตโนมัติ)
- frontend (`public/index.html`) กับ backend อยู่ในเซิร์ฟเวอร์เดียวกัน (เชื่อม Socket.io
  แบบ same-origin `io()` โดยไม่ hardcode URL) จึงไม่ต้องตั้งค่า CORS ข้ามโดเมนเพิ่ม

### วิธีที่ 1: ใช้ไฟล์ `render.yaml` (Blueprint) — ง่ายที่สุด

โปรเจกต์มีไฟล์ `render.yaml` ที่ root อยู่แล้ว (ตั้งค่า rootDir เป็น `server` ให้)

1. Push โค้ดทั้งโฟลเดอร์ `band-rush/` ขึ้น GitHub/GitLab
2. เข้า Render Dashboard → **New** → **Blueprint**
3. เลือก repo นี้ → Render จะอ่าน `render.yaml` แล้วตั้งค่าทุกอย่างให้อัตโนมัติ
4. กด **Apply** รอ build เสร็จ จะได้ URL แบบ `https://band-rush.onrender.com`

### วิธีที่ 2: ตั้งค่าเองผ่านหน้าเว็บ (ไม่ใช้ render.yaml)

1. เข้า Render Dashboard → **New** → **Web Service** → เชื่อม repo
2. ตั้งค่าดังนี้:
   - **Root Directory**: `server` (สำคัญมาก เพราะ `package.json` อยู่ใน `server/`)
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free ก็รันได้ (แต่ free tier จะ sleep เมื่อไม่มีคนใช้ ~15 นาที
     แล้วตื่นช้าไปหน่อยตอนมีคนเข้าครั้งแรก)
3. ไม่ต้องตั้งค่า env var `PORT` เอง — Render จะ inject ให้อัตโนมัติ และเซิร์ฟเวอร์อ่านค่านี้
   อยู่แล้ว (`process.env.PORT || 3000`)
4. กด **Create Web Service** รอ build → ได้ URL มาใช้ได้ทั้งจอครูและมือถือนักเรียนทันที
   (เข้า URL เดียวกันได้เลย ไม่ต้องเปิด `localhost` อีกต่อไป)

### ข้อควรรู้เรื่อง scaling

ถ้าในอนาคตปรับ Instance Count ให้มากกว่า 1 (multi-instance) เกมจะ **พังทันที** เพราะห้อง/สถานะ
เกมเก็บเป็น in-memory อยู่ใน process เดียว (`server/store.js`) — ผู้เล่นที่หลุดไปคนละ instance
จะมองไม่เห็นห้องเดียวกัน ให้คง Instance Count = 1 เสมอ (เพียงพอสำหรับใช้ในห้องเรียน) หรือถ้า
ต้อง scale จริง ๆ ค่อยเปลี่ยน `store.js` ไปต่อ Redis จริงตามที่ระบุไว้ในหมายเหตุด้านล่าง

## วิธีทดสอบ (อัตโนมัติ)

มีสคริปต์ smoke test ที่เปิดเซิร์ฟเวอร์จริงเป็น child process แล้วจำลองครู 1 คน +
นักเรียน 2 คน เพื่อตรวจสอบ join, เริ่มเกม, จับคู่การ์ดถูก/เหรียญ, และ atomic purchase
(กันเงินติดลบ) ตามข้อ 5.2 ของ GDD:

```bash
cd server
npm install          # ต้องมี devDependency: socket.io-client
npm test
```

ผลลัพธ์ที่ควรเห็น: รายการเช็ค ✅ ทุกบรรทัด และท้ายสุด `🎉 ALL CHECKS PASSED`

## วิธีทดสอบด้วยมือ (Manual QA checklist)

1. **Lobby**: ครูสร้างห้อง โหมด Competitive → เห็น PIN ตัวใหญ่บนจอ
2. **Join**: 2 นักเรียนใส่ PIN เดียวกัน คนละชื่อ เลือก "วง 1" ทั้งคู่ → เห็นหมวดที่ได้รับ
   มอบหมายไม่ซ้ำกัน (เช่นคนแรกได้ Strings+Woodwind, คนสองได้ Brass+Percussion+Keyboard)
3. **เริ่มเกม**: ครูกด "เริ่มเกม" → นาฬิกานับถอยหลังเริ่มวิ่งทั้งจอครูและมือถือ, มีการ์ดคว่ำ
   ตกลงมาบนโต๊ะ
4. **พลิกการ์ด**: แตะการ์ดของตัวเอง (มีจุดเขียวกะพริบมุมขวาบน) → พลิกหงาย
   ลองแตะพลิกใบที่สองพร้อมกัน → ใบแรกต้องคว่ำกลับอัตโนมัติ (จำกัดหงายได้ทีละ 1 ใบ)
5. **จับคู่ถูก**: กดปุ่มหมวดที่ตรงกับการ์ด → คะแนน/เหรียญเพิ่ม มีเสียงและข้อความ "+10 คะแนน"
6. **จับคู่ผิด**: กดปุ่มหมวดที่ไม่ตรง → มีเสียงผิด ข้อความสีแดง คอมโบรีเซ็ตเป็น 0
7. **ปัดข้ามจอ**: ลากการ์ดของตัวเองออกนอกขอบจอซ้าย/ขวา → การ์ดหายจากจอเรา และ
   โผล่ที่จอเพื่อนร่วมทีมพร้อมเสียง "ฟึ่บ"
8. **ร้านค้า**: กดปุ่มรถเข็น 🛒 → เห็นไอเทม 4 ชิ้น ปุ่มจะจางถ้าเงินไม่พอ → ซื้อ Coda/Glissando/
   Fermata แล้วเลือกทีมเป้าหมาย → ฝั่งเป้าหมายเห็น overlay/การ์ดขยะ/แช่แข็งทันที
9. **Atomic purchase**: ให้เงินไม่พอซื้อไอเทมราคาแพง → ต้องขึ้นข้อความปฏิเสธ ไม่หักเงินติดลบ
10. **จบเกม**: รอเวลาหมด → ทุกจอขึ้นหน้าจบเกมพร้อมคะแนนสุดท้าย, จอครูหยุดอัปเดต

## หมายเหตุการออกแบบ (ต่างจาก Blueprint เดิมเล็กน้อย เพื่อให้รันได้จริงแบบไม่ต้อง build step)

- ใช้ **in-memory store** (`server/store.js`) แทน Redis จริง เพื่อให้รันได้ทันทีโดยไม่ต้อง
  ติดตั้ง Redis server — โครงสร้างข้อมูลเลียนแบบ Redis JSON ในข้อ 6 ของ GDD ทุกประการ
  ถ้าต้องการ Redis จริงสำหรับ production (หลายเครื่อง/หลาย process) แค่เปลี่ยน
  implementation ใน `store.js` ให้เรียก `ioredis` แทน โดย signature ฟังก์ชันเดิมทั้งหมด
- Frontend ใช้ **React ผ่าน CDN + Babel standalone** (ไม่มีขั้นตอน build/webpack) เพื่อให้
  เปิดได้ทันทีจาก Express static server ไฟล์เดียวจบ ส่วน drag/swipe ใช้ Pointer Events
  ธรรมดาแทน Framer Motion + @use-gesture (เพื่อไม่ต้องพึ่ง CDN ของสองไลบรารีนี้ซึ่งไม่มี
  UMD build อย่างเป็นทางการ) — ผลลัพธ์ทางฟังก์ชันเหมือนเดิม ถ้าต้องการฟิสิกส์ที่ลื่นขึ้น
  ค่อย migrate ไป Next.js + Framer Motion ตาม tech stack เดิมได้ในภายหลัง
- เสียงประกอบใช้ Web Audio API สร้างเสียง beep สั้น ๆ แทนไฟล์เสียงจริง (ยังไม่มี asset
  เสียง/กราฟิกตามข้อ 8 ของ GDD) จะสลับไปใช้ Howler.js + ไฟล์เสียงจริงภายหลังได้ง่าย
  เพราะ event ที่เรียก sfx.* ถูกแยกจุดไว้ชัดเจนแล้ว
- โหมด COOP ใช้ shop item set เดียวกับ COMPETITIVE แต่ปรับ effect ให้เป็น "บัฟตัวเอง"
  ตามที่ระบุไว้ในข้อ 2.1 (Coda→เคลียร์ขยะ, Glissando→ต่อเวลา, Fermata/Forte เหมือนเดิม)
  เพราะ GDD ให้ price/tier เดียวกันแต่บรรยาย use-case ต่างกันระหว่างสองโหมด

## Roadmap ที่ยังไม่ได้ทำ (ตามข้อ 9)

- MongoDB สำหรับเก็บชุดคำถาม/ประวัติการแข่งขันแบบถาวร (ตอนนี้ข้อมูลหายเมื่อรีสตาร์ท
  เซิร์ฟเวอร์ เพราะเป็น in-memory)
- กราฟิก/เสียงจริงตามข้อ 8 (ตอนนี้ใช้ emoji + Web Audio แทน placeholder)
- Framer Motion physics แบบเต็มรูปแบบสำหรับการ์ด (ตอนนี้ใช้ Pointer Events + CSS transition)
