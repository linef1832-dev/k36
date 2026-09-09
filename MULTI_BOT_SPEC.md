# สเปกฝั่งเซิร์ฟเวอร์บอท (Railway) — รองรับกองบอทหลายตัวพูดขนานกัน

หน้าเว็บ (js/discord/tts.js) ถูกแก้เสร็จแล้ว ฝั่งบอทบน Railway ต้องแก้ตามนี้ถึงจะพูดขนานกันได้จริง

## 1. โครง config ใหม่ใน settings key `tts_voice_config`

เพิ่ม 2 ฟิลด์ (ของเดิมทั้งหมดอยู่ครบ ไม่มีอะไรหาย):

```json
{
  "dispatch_mode": "auto",            // "auto" | "manual"
  "bots": [
    { "id": "bot1712...", "name": "บอท 1", "token": "MTA5...", "enabled": true, "color": "#38bdf8" }
  ],
  "groups": [ { "shifts": [ { "rooms": [ { "id": "123", "text": "...", "bot_id": "" } ] } ] } ],
  "schedules": [ { "rooms": [ { "id": "123", "text": "...", "bot_id": "bot1712..." } ] } ]
}
```

- `rooms[].bot_id` — บอทประจำห้อง (มีผลเฉพาะโหมด manual, ค่าว่าง = ให้แบ่งอัตโนมัติ)
- ถ้า `bots` ว่าง → ทำงานแบบเดิมด้วยบอทตัวหลัก (token เดิมใน env) 100%

## 2. สตาร์ท Discord client หลายตัว

```js
// pseudo-code (discord.js v14)
const clients = new Map();   // bot_id -> Client

async function syncBots(cfg) {
  const want = (cfg.bots || []).filter(b => b.enabled && b.token);
  // ปิดตัวที่ถูกลบ/ปิดใช้
  for (const [id, c] of clients) if (!want.find(b => b.id === id)) { c.destroy(); clients.delete(id); }
  // เปิดตัวใหม่
  for (const b of want) if (!clients.has(b.id)) {
    const c = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
    await c.login(b.token).catch(e => console.error('login fail', b.name, e.message));
    clients.set(b.id, c);
  }
}
```
เรียก `syncBots` ทุกครั้งที่โหลด config ใหม่ (ที่เดิมที่ poll `tts_voice_config` อยู่แล้ว)

## 3. ตัวแบ่งงาน (dispatcher) — หัวใจของความเร็ว

เดิม: วนพูดทีละห้อง (for-loop await) → ใหม่: แบ่งห้องเป็นคิวต่อบอท แล้วรันขนาน

```js
async function speakRooms(roomJobs, cfg) {
  // roomJobs = [{ room_id, text, voice_name, repeat, bot_id }]
  const online = [...clients.entries()].filter(([, c]) => c.isReady());
  if (!online.length) return speakSequentialFallback(roomJobs);  // ของเดิม

  // 1) ห้องที่ปักบอทไว้ (โหมด manual) → เข้าคิวบอทตัวนั้น
  // 2) ที่เหลือ → round-robin ให้บอทออนไลน์
  const queues = new Map(online.map(([id]) => [id, []]));
  let rr = 0;
  for (const job of roomJobs) {
    const pin = (cfg.dispatch_mode === 'manual' && job.bot_id && queues.has(job.bot_id)) ? job.bot_id : null;
    const target = pin || online[rr++ % online.length][0];
    queues.get(target).push(job);
  }
  // ทุกบอทไล่คิวของตัวเอง "พร้อมกัน"
  await Promise.allSettled([...queues.entries()].map(([botId, jobs]) =>
    (async () => { for (const j of jobs) await speakOne(clients.get(botId), j); })()
  ));
}
```

`speakOne(client, job)` = โค้ดเข้าห้อง→เล่นเสียง→ออก ของเดิม แค่รับ client เป็นพารามิเตอร์แทน client ตัวเดียว
ข้อควรระวัง: บอท "ตัวเดียว" อยู่ 2 ห้องพร้อมกันไม่ได้ (ข้อจำกัด Discord ต่อ token) — นี่คือเหตุผลที่ต้องหลาย token

## 4. คำสั่งทดสอบ `tts_command`

เพิ่มฟิลด์ `bot_id` (optional):
```json
{ "id": "c17...", "room_id": "123", "text": "...", "voice_name": "...", "repeat": 1, "bot_id": "bot1712..." }
```
- มี `bot_id` → ใช้บอทตัวนั้น (ถ้าออฟไลน์ → fallback ตัวที่ว่าง)
- ไม่มี → เลือกบอทออนไลน์ที่ว่างตัวแรก (พฤติกรรมเดิม)

## 5. สถานะสด `tts_status` — รูปใหม่ (หน้าเว็บรองรับทั้งเก่า/ใหม่แล้ว)

เขียนทุก ~15 วินาที:
```json
{
  "updated_at": "2026-09-06 10:49:00",
  "bots": [
    { "bot_id": "bot1712...", "name": "บอท 1", "online": true,
      "current_room": "ห้อง 3", "last_spoke_at": "2026-09-06 10:48:12",
      "updated_at": "2026-09-06 10:49:00" }
  ]
}
```
(รูปเก่า `{online, current_room, last_spoke_at}` หน้าเว็บยังอ่านได้ — ทยอย deploy ได้ไม่พัง)

## 6. ประวัติ `tts_logs`

เพิ่มคอลัมน์ (optional — หน้าเว็บโชว์ให้อัตโนมัติถ้ามี):
```sql
ALTER TABLE tts_logs ADD COLUMN IF NOT EXISTS bot_name text;
```
แล้วตอน insert log ให้ใส่ชื่อบอทที่พูด

## 7. ลำดับ deploy ที่ปลอดภัย

1. Deploy หน้าเว็บ (เปลี่ยน `_APP_VERSION` ใน index.html) — ยังใช้บอทเดิมได้ปกติ เพราะ `bots` ว่าง = โหมดเดิม
2. แก้บอท Railway ตามข้อ 2–6 → deploy
3. เข้าเว็บ → แท็บ กองบอท → เพิ่มบอท + วาง token → บันทึก → เห็นสถานะออนไลน์รายตัว → กดทดสอบรายบอท
4. ลองยิงคำในกลุ่ม Telegram ที่ผูกไว้ ห้องหลายห้องควรมีเสียงพร้อมกัน

## หมายเหตุความปลอดภัย

Token บอทถูกเก็บใน `settings` (อ่านด้วย anon key ได้ตามแพตเทิร์นเดิมของโปรเจกต์ เช่นเดียวกับ `telegram_bot_config`) — ถ้าต้องการเข้มขึ้น แนะนำทำ RLS ให้ key `tts_voice_config` อ่าน/เขียนได้เฉพาะ role manager/admin หรือย้าย token ไปเก็บใน env ของ Railway แล้วให้เว็บอ้างแค่ `bot_id`/`name`
