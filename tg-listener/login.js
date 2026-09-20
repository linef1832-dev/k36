// ════════════════════════════════════════════════════════════════════
// 🔑 login.js — เข้าสู่ระบบ Telegram ครั้งแรก เพื่อเอา TG_SESSION
//   รันในเครื่องตัวเอง: node login.js
//   จะถามเบอร์ → รหัสที่ส่งมาในแอป Telegram → (ถ้ามี) รหัส 2 ชั้น
//   ได้ข้อความยาวๆ ออกมา เอาไปใส่เป็น env TG_SESSION บน Railway
//   ⚠️ ข้อความนั้นเท่ากับรหัสผ่านบัญชีคุณ ห้ามส่งให้ใคร ห้าม commit ขึ้น git
// ════════════════════════════════════════════════════════════════════
'use strict';
require('dotenv').config();
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const input = require('input');

(async () => {
    const apiId = parseInt(process.env.TG_API_ID, 10);
    const apiHash = process.env.TG_API_HASH;
    if (!apiId || !apiHash) { console.error('❌ ใส่ TG_API_ID และ TG_API_HASH ในไฟล์ .env ก่อน (ขอได้ที่ https://my.telegram.org → API development tools)'); process.exit(1); }

    const client = new TelegramClient(new StringSession(''), apiId, apiHash, { connectionRetries: 5 });
    await client.start({
        phoneNumber: async () => await input.text('เบอร์โทร (เช่น +66812345678): '),
        password:    async () => await input.text('รหัสผ่าน 2 ชั้น (ถ้าไม่มีกด Enter): '),
        phoneCode:   async () => await input.text('รหัสที่ส่งมาในแอป Telegram: '),
        onError:     e => console.error(e)
    });

    console.log('\n✅ สำเร็จ — คัดลอกบรรทัดล่างนี้ไปใส่เป็น env ชื่อ TG_SESSION\n');
    console.log(client.session.save());
    console.log('\n⚠️ เก็บเป็นความลับ ใครได้ไปคือเข้าบัญชี Telegram คุณได้เลย\n');
    await client.disconnect();
    process.exit(0);
})();
