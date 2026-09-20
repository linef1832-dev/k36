// ════════════════════════════════════════════════════════════════════
// 📡 index.js — ตัวดักฟังกลุ่มเช็คอินใน Telegram
//   ใช้ "บัญชีของคุณเอง" อ่านข้อความ (คุณอยู่ในกลุ่มอยู่แล้ว ไม่ต้องเอาบอทเข้ากลุ่ม)
//   ทุกครั้งที่บอทเช็คอินพิมพ์ → แกะ → เขียนลงตาราง break_punches ของ Supabase
//   หน้าเว็บ break_audit จะเห็นข้อมูลสดทันทีผ่าน realtime
//
//   รันครั้งแรก: node login.js  → ได้ TG_SESSION แล้วเอาไปใส่ env
//   หา chat id:  node list-chats.js
// ════════════════════════════════════════════════════════════════════
'use strict';

require('dotenv').config();
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { NewMessage } = require('telegram/events');
const { createClient } = require('@supabase/supabase-js');
const { parseMessage, secToTime } = require('./parse');

const API_ID       = parseInt(process.env.TG_API_ID, 10);
const API_HASH     = process.env.TG_API_HASH;
const SESSION      = process.env.TG_SESSION || '';
const CHATS        = String(process.env.TG_CHATS || '').split(',').map(s => s.trim()).filter(Boolean);
const SB_URL       = process.env.SUPABASE_URL;
const SB_KEY       = process.env.SUPABASE_SERVICE_KEY;
const BACKFILL     = parseInt(process.env.BACKFILL_MESSAGES || '0', 10);   // ย้อนหลังกี่ข้อความตอนเริ่ม

for (const [k, v] of Object.entries({ TG_API_ID: API_ID, TG_API_HASH: API_HASH, TG_SESSION: SESSION, SUPABASE_URL: SB_URL, SUPABASE_SERVICE_KEY: SB_KEY })) {
    if (!v) { console.error(`❌ ยังไม่ได้ตั้งค่า ${k}`); process.exit(1); }
}

const db = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const client = new TelegramClient(new StringSession(SESSION), API_ID, API_HASH, { connectionRetries: 10 });

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ── บันทึกหนึ่งข้อความลงฐานข้อมูล ─────────────────────────────────
async function save(chatId, msgId, text, when) {
    const p = parseMessage(text, when);
    if (!p) return false;

    if (p.isBack) {
        // 🪑 กลับที่นั่ง → ปิดรอบ
        const dur = p.durationSec;
        let startSec = dur !== null ? p.atSec - dur : null;
        let category = p.category;
        let openLimit = null;

        // ไม่มีบรรทัด "เวลากิจกรรมนี้" → ไปหารอบที่ยังค้างอยู่ของคนนี้
        if (startSec === null) {
            const { data } = await db.from('break_punches')
                .select('id, started_at, category, limit_min')
                .eq('tg_user_id', p.tgUserId).eq('punch_date', p.punchDate).eq('is_open', true)
                .order('started_at', { ascending: false }).limit(1);
            if (data && data[0]) {
                openLimit = data[0].limit_min;
                const [h, m, s] = data[0].started_at.split(':').map(Number);
                startSec = h * 3600 + m * 60 + s;
                if (!category) category = data[0].category;
            }
        }
        if (startSec === null) { log('⏭️  ข้าม: กลับที่นั่งแต่หาเวลาเริ่มไม่ได้', p.tgName); return false; }
        if (startSec < 0) startSec += 86400;

        // ดึงเวลาที่บอทอนุญาตของรอบที่ค้างไว้ (ข้อความกดกลับไม่ได้บอกซ้ำ)
        if (openLimit === null) {
            const { data: op } = await db.from('break_punches')
                .select('limit_min')
                .eq('tg_user_id', p.tgUserId).eq('punch_date', p.punchDate).eq('is_open', true)
                .order('started_at', { ascending: false }).limit(1);
            if (op && op[0]) openLimit = op[0].limit_min;
        }

        // ลบรอบค้างของคนนี้ทิ้ง (ถูกแทนที่ด้วยรอบที่ปิดแล้ว)
        await db.from('break_punches').delete()
            .eq('tg_user_id', p.tgUserId).eq('punch_date', p.punchDate).eq('is_open', true);

        const row = {
            chat_id: String(chatId), msg_id: Number(msgId),
            tg_user_id: p.tgUserId, tg_name: p.tgName, punch_date: p.punchDate,
            category: category || 'อื่นๆ',
            started_at: secToTime(startSec),
            ended_at: p.at,
            duration_sec: dur !== null ? dur : (p.atSec - startSec + 86400) % 86400,
            limit_min: p.limitMin !== null ? p.limitMin : openLimit,
            is_open: false
        };
        const { error } = await db.from('break_punches').upsert(row, { onConflict: 'chat_id,msg_id' });
        if (error) { console.error('❌ เขียนไม่สำเร็จ', error.message); return false; }
        log(`✅ ${p.tgName} · ${row.category} · ${row.started_at}–${row.ended_at} (${row.duration_sec}s)`);
        return true;
    }

    if (!p.category) return false;

    // 🚪 กดออก → เปิดรอบค้างไว้ (คนนี้กำลังไม่อยู่ที่นั่ง)
    await db.from('break_punches').delete()
        .eq('tg_user_id', p.tgUserId).eq('punch_date', p.punchDate).eq('is_open', true);

    const row = {
        chat_id: String(chatId), msg_id: Number(msgId),
        tg_user_id: p.tgUserId, tg_name: p.tgName, punch_date: p.punchDate,
        category: p.category, started_at: p.at, ended_at: null, duration_sec: null,
        limit_min: p.limitMin, is_open: true
    };
    const { error } = await db.from('break_punches').upsert(row, { onConflict: 'chat_id,msg_id' });
    if (error) { console.error('❌ เขียนไม่สำเร็จ', error.message); return false; }
    log(`🚪 ${p.tgName} · ออกไป ${p.category} ตอน ${p.at}${p.limitMin ? ` (บอทให้ ${p.limitMin} นาที)` : ''}`);
    return true;
}

// ── ย้อนหลังตอนเริ่ม ──────────────────────────────────────────────
async function backfill(entity, label) {
    if (!BACKFILL) return;
    log(`⏪ ย้อนอ่าน ${BACKFILL} ข้อความล่าสุดของ ${label}`);
    let n = 0;
    for await (const msg of client.iterMessages(entity, { limit: BACKFILL })) {
        if (!msg.message) continue;
        try { if (await save(msg.chatId, msg.id, msg.message, msg.date ? new Date(msg.date * 1000) : new Date())) n++; }
        catch (e) { console.error('backfill error', e.message); }
    }
    log(`⏪ บันทึกย้อนหลังได้ ${n} รอบ`);
}

(async () => {
    await client.connect();
    const me = await client.getMe();
    log(`🔑 เข้าสู่ระบบเป็น ${me.username ? '@' + me.username : me.firstName}`);

    const targets = [];      // entity เอาไว้อ่านย้อนหลัง
    const targetIds = [];    // id ล้วนๆ เอาไว้กรองข้อความสด (GramJS ต้องการแบบนี้)
    for (const c of CHATS) {
        try {
            const ent = await client.getEntity(/^-?\d+$/.test(c) ? Number(c) : c);
            targets.push(ent);
            targetIds.push(Number(c));
            log(`👂 ฟังกลุ่ม: ${ent.title || ent.username || c}`);
        } catch (e) { console.error(`❌ เข้ากลุ่ม ${c} ไม่ได้: ${e.message}`); }
    }
    if (!targets.length) { console.error('❌ ไม่มีกลุ่มให้ฟัง — ตั้ง TG_CHATS ก่อน (หา id ด้วย node list-chats.js)'); process.exit(1); }

    for (const t of targets) await backfill(t, t.title || t.id);

    const wanted = new Set(targetIds.map(id => String(id).replace(/^-100/, '').replace(/^-/, '')));
    client.addEventHandler(async (event) => {
        const msg = event.message;
        if (!msg || !msg.message) return;
        // กรองเอง: เทียบเฉพาะตัวเลขล้วน เพราะ id มาได้หลายรูป (-100xxx / -xxx / xxx)
        const from = String(msg.chatId || '').replace(/^-100/, '').replace(/^-/, '');
        if (!wanted.has(from)) return;
        try { await save(msg.chatId, msg.id, msg.message, msg.date ? new Date(msg.date * 1000) : new Date()); }
        catch (e) { console.error('handler error', e.message); }
    }, new NewMessage({}));   // รับทุกข้อความ แล้วค่อยกรองเองด้านบน (กัน GramJS งงกับรูปแบบ id)

    log('📡 พร้อมแล้ว — รอข้อความจากบอทเช็คอิน');

    // กัน Railway คิดว่าโปรเซสตาย
    setInterval(() => {}, 1 << 30);
})();

process.on('unhandledRejection', e => console.error('unhandledRejection', e));
