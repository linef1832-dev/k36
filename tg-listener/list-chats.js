// ════════════════════════════════════════════════════════════════════
// 🔎 list-chats.js — ดูรายชื่อกลุ่มทั้งหมดของบัญชีคุณ พร้อม id
//   รัน: node list-chats.js   แล้วเอา id ของกลุ่มเช็คอินไปใส่ TG_CHATS
// ════════════════════════════════════════════════════════════════════
'use strict';
require('dotenv').config();
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');

(async () => {
    const client = new TelegramClient(new StringSession(process.env.TG_SESSION || ''), parseInt(process.env.TG_API_ID, 10), process.env.TG_API_HASH, { connectionRetries: 5 });
    await client.connect();
    console.log('\nid'.padEnd(22) + 'ชนิด'.padEnd(10) + 'ชื่อกลุ่ม');
    console.log('-'.repeat(70));
    for await (const d of client.iterDialogs({ limit: 300 })) {
        if (!d.isGroup && !d.isChannel) continue;
        console.log(String(d.id).padEnd(22) + (d.isChannel ? 'channel' : 'group').padEnd(10) + (d.title || ''));
    }
    console.log('\n💡 ใส่หลายกลุ่มได้ คั่นด้วยจุลภาค เช่น TG_CHATS=-1001234567890,-1009876543210\n');
    await client.disconnect();
    process.exit(0);
})();
