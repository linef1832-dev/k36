// ════════════════════════════════════════════════════════════════════
// 🧩 parse.js — แกะข้อความของบอทเช็คอิน (ไทย/จีน) ให้เป็นข้อมูลที่บันทึกได้
//   บอทมีสองรูปแบบ จับด้วยคำหลัก "ลงทะเบียน...สำเร็จ" ชุดเดียว
//
//   กดออก:   ✅ ลงทะเบียนสำเร็จ : กินข้าว - 09/20 14:35:20
//            เวลาจำกัดสำหรับกิจกรรมครั้งนี้ : 30 นาที
//
//   กดกลับ:  ✅ 09/20 14:49:52 ลงทะเบียนสำหรับ กลับที่นั่ง สำเร็จ : ปวดน้อย.สูบบุหรี่
//            เวลากิจกรรมนี้ : 00:02:29
// ════════════════════════════════════════════════════════════════════
'use strict';

const RX = {
    user:  /(?:^|\n)[ \t>*•·]*(?:👤[ \t]*)?(?:ผู้ใช้|用户)[ \t]*[:：][ \t]*([^\n]+)/,
    id:    /(?:รหัสผู้ใช้|用户ID|用户 ID)[ \t]*[:：]?[ \t]*(\d{4,})/,
    stamp: /(\d{1,2})\s*\/\s*(\d{1,2})[ \t]+(\d{1,2}):(\d{2}):(\d{2})/,
    // ครอบทั้งสองรูป: กลุ่ม 1 = คำที่คั่นกลาง ("สำหรับ กลับที่นั่ง" หรือว่าง) · กลุ่ม 2 = ท้ายบรรทัดหลังโคลอน
    done:  /(?:ลงทะเบียน|登记)([^\n:：]{0,40}?)(?:สำเร็จ|成功)[ \t]*[:：][ \t]*([^\n]*)/,
    // หมวดตกไปอยู่บรรทัดถัดไป
    catNext: /(?:สำเร็จ|成功)[ \t]*[:：][ \t\r\n]+([^\n]+)/,
    dur:   /(?:เวลากิจกรรมนี้|本次活动时间)[^\d\n]*(\d{1,3}):(\d{2}):(\d{2})/,
    limit: /(?:เวลาจำกัดสำหรับกิจกรรมครั้งนี้|เวลาจำกัด|本次活动限时|限时)[^\d\n]*(\d{1,3})[ \t]*(?:นาที|分钟|min)/,
    back:  /กลับที่นั่ง|回座|回到座位/i
};

// บรรทัดที่ "ไม่ใช่ชื่อหมวด" — กันหยิบบรรทัดคำแนะนำมาเป็นหมวดโดยพลาด
const NOT_CAT = /[:：]|-{3,}|—{3,}|คำแนะนำ|ความสนใจ|เวลากิจกรรม|เวลาจำกัด|จำนวน|กิจกรรมในวันนี้|กรุณา|ทิพ|建议|活动|累计|请/;

const pad = n => String(n).padStart(2, '0');

const cleanName = s => String(s || '')
    .replace(/[（(][^）)]*[）)]/g, ' ')                                   // ตัด (08.00 - 20.00)
    .replace(/[\u2190-\u2BFF\uFE0F\u200D]/g, '')                        // ตัดสัญลักษณ์/อิโมจิพื้นฐาน
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')                     // ตัดอิโมจิตัวยาว (☀️ 🌙 ฯลฯ)
    .replace(/\s+/g, ' ').trim();

// "กินข้าว - 09/20 14:35:20" → "กินข้าว"
const cleanCat = s => String(s || '')
    .replace(/[-–—][ \t]*\d{1,2}\s*\/\s*\d{1,2}[\s\S]*$/, '')
    .replace(/\d{1,2}\s*\/\s*\d{1,2}[ \t]+\d{1,2}:\d{2}:\d{2}/g, '')
    .replace(/[✅❌]/g, '')
    .replace(/[\s\-–—:：]+$/, '')
    .replace(/^[\s\-–—:：]+/, '')
    .replace(/\s+/g, ' ').trim();

const secToTime = s => {
    s = ((Math.round(s) % 86400) + 86400) % 86400;
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s % 3600 / 60))}:${pad(s % 60)}`;
};

/**
 * อ่านข้อความบอทหนึ่งข้อความ
 * @param {string} text  เนื้อข้อความ
 * @param {Date}   when  เวลาที่ข้อความถูกส่ง (เอาไว้เดาปี ค.ศ.)
 * @returns {object|null} { tgUserId, tgName, punchDate, at, atSec, category, durationSec, limitMin, isBack }
 */
function parseMessage(text, when) {
    if (!text) return null;
    const id = RX.id.exec(text);
    const st = RX.stamp.exec(text);
    const d  = RX.done.exec(text);
    if (!id || !st || !d) return null;          // ไม่ใช่ข้อความเช็คอิน → ข้าม

    const u  = RX.user.exec(text);
    const du = RX.dur.exec(text);
    const lm = RX.limit.exec(text);

    const mon = +st[1], day = +st[2];
    const atSec = (+st[3]) * 3600 + (+st[4]) * 60 + (+st[5]);

    // ปีจากเวลาที่ข้อความมาจริง — เผื่อคร่อมปีใหม่
    const ref = when instanceof Date ? when : new Date();
    let year = ref.getFullYear();
    const refMon = ref.getMonth() + 1;
    if (mon === 12 && refMon === 1) year -= 1;
    if (mon === 1 && refMon === 12) year += 1;

    const middle = (d[1] || '').trim();          // "สำหรับ กลับที่นั่ง" | "" | "สำหรับ กินข้าว"
    const isBack = !!du || RX.back.test(middle);

    let category = cleanCat(d[2]);
    if (RX.back.test(category)) category = '';
    if (!category && !RX.back.test(middle)) category = cleanCat(middle.replace(/^สำหรับ/, ''));
    if (!category) {                             // หมวดตกไปอยู่บรรทัดถัดไป
        const nx = RX.catNext.exec(text);
        if (nx) { const c = cleanCat(nx[1]); if (c && !NOT_CAT.test(c) && c.length <= 40) category = c; }
    }

    return {
        tgUserId: id[1],
        tgName: cleanName(u ? u[1] : id[1]) || id[1],
        punchDate: `${year}-${pad(mon)}-${pad(day)}`,
        at: secToTime(atSec),
        atSec,
        category,
        durationSec: du ? (+du[1]) * 3600 + (+du[2]) * 60 + (+du[3]) : null,
        limitMin: lm ? +lm[1] : null,
        isBack
    };
}

module.exports = { parseMessage, secToTime, cleanCat, cleanName, RX };
