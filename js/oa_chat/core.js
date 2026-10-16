// =====================================================================
//  💬 ตรวจนับแชท LINE OA — อ่านตาราง oa_replies (เขียนโดยแอป BIZ Checker + ส่วนเสริม Chrome)
//  1 แถว = พนักงาน 1 คน ตอบลูกค้า 1 คน ใน 1 วันทำงาน (ตัดวันที่ 08:00)
//
//  การโหลดข้อมูล
//   • โหลดเต็ม (oa_load)     : ตอนเข้าหน้า / เลือกช่วงที่ยังไม่มีในเครื่อง → ดึงทั้งช่วงครั้งเดียว
//   • อัปเดตเบา (oa_refresh) : ทุก 1 นาที ดึงแค่ "เมื่อวาน + วันนี้" (วันเก่าไม่เปลี่ยนแล้ว)
//                              ข้อมูลเหมือนเดิม → ไม่วาดใหม่ · แท็บถูกซ่อน → ไม่ดึง
// =====================================================================
window._oa = window._oa || { rows: [], users: {}, range: 'today', dept: 'ALL', shift: 'ALL', site: 'ALL', oaline: 'ALL', open: new Set(), tab: 'list', shiftMap: {}, siteMap: {} };
window._oa._chatPage = window._oa._chatPage || {};
const oa_pad = (n) => String(n).padStart(2, '0');
const oa_iso = (d) => `${d.getFullYear()}-${oa_pad(d.getMonth() + 1)}-${oa_pad(d.getDate())}`;
function oa_workDate(off = 0) { const t = new Date(); if (t.getHours() < 8) t.setDate(t.getDate() - 1); t.setDate(t.getDate() + off); return oa_iso(t); }
const oa_esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// ใส่ข้อความใน onclick="fn('...')" — หนี JS ก่อนแล้วค่อยหนี HTML (เดิมชื่อที่มี ' ทำให้ปุ่มกดไม่ได้)
const oa_jsq = (s) => oa_esc(String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
const oa_time = (ts) => { if (!ts) return '-'; try { return new Date(ts).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return '-'; } };
const oa_can = (p) => (typeof canPerm === 'function' ? canPerm(p) : true);
const oa_isCurrent = () => !window._currentPageName || window._currentPageName === 'oa_chat';

// ─────────────────────────── ช่วงวันที่ ───────────────────────────
function oa_presetRange(r) {
    const today = oa_workDate(0);
    if (r === 'today') return [today, today];
    if (r === 'yesterday') { const y = oa_workDate(-1); return [y, y]; }
    if (r === '7d') return [oa_workDate(-6), today];
    if (r === 'month') return [today.slice(0, 8) + '01', today];
    return null;
}
// ช่วงที่เก็บไว้ในเครื่องตามปกติ: ครอบ "วันนี้ / เมื่อวาน / 7 วัน / เดือนนี้" → กดสลับแล้วขึ้นทันที
function oa_defaultWindow() {
    const today = oa_workDate(0), d7 = oa_workDate(-6), m1 = today.slice(0, 8) + '01';
    return [d7 < m1 ? d7 : m1, today];
}
// ช่วงที่ต้องโหลด: อยู่ในช่วงปกติ → โหลดช่วงปกติ / เลือกย้อนไปไกล → โหลดเฉพาะช่วงที่เลือก
// (เดิมเลือกวันย้อนไป 1 ปี จะดึงตั้งแต่ปีที่แล้วจนถึงวันนี้ทั้งหมด → หนักมาก)
function oa_loadRange(vf, vt) {
    const [wf, wt] = oa_defaultWindow();
    return (vf >= wf && vt <= wt) ? [wf, wt] : [vf, vt];
}
function oa_daysBetween(f, t) {
    const out = []; const d = new Date(f + 'T00:00:00'), end = new Date(t + 'T00:00:00');
    while (d <= end && out.length < 400) { out.push(oa_iso(d)); d.setDate(d.getDate() + 1); }
    return out;
}

window.oa_setRange = function (r, noLoad) {
    const o = window._oa;
    const f = document.getElementById('oaFrom'), t = document.getElementById('oaTo'); if (!f || !t) return;
    const pr = oa_presetRange(r);
    if (pr) { f.value = pr[0]; t.value = pr[1]; }
    else {
        if (!f.value || !t.value) return;          // ลบวันที่ทิ้ง (ช่องว่าง) → ไม่ทำอะไร
        if (f.value > t.value) t.value = f.value;
    }
    o.range = r; o._rangeDay = oa_workDate(0);
    document.querySelectorAll('#oaRangeSeg button').forEach(b => b.classList.toggle('on', b.dataset.r === r));
    const live = document.getElementById('oaRangeLive');
    if (live) { const nm = { today: 'วันนี้', yesterday: 'เมื่อวาน', '7d': '7 วันล่าสุด', month: 'เดือนนี้' }[r]; const dt = oa_fmtRange(f.value, t.value); live.textContent = nm ? nm + ' · ' + dt : dt; }
    o._viewFrom = f.value; o._viewTo = t.value;
    o.open.clear();   // เปลี่ยนช่วง → ปิดแถวที่กางไว้ (ข้อมูลข้างในเปลี่ยนแล้ว)
    const covered = (a, b) => o._loadedFrom && a >= o._loadedFrom && b <= o._loadedTo;
    if (covered(f.value, t.value)) { window.oa_render(); return; }   // ⚡ มีในเครื่องแล้ว แสดงทันที
    if (noLoad) return;
    const list = document.getElementById('oaList'); if (list) list.style.opacity = '.45';
    const bs = o._bgSpan;
    if (o._bg && bs && f.value >= bs[0] && t.value <= bs[1]) {
        // ส่วนที่เหลือของเดือนกำลังโหลดอยู่เบื้องหลัง → รอตัวนั้น ไม่ยิงซ้ำ (มันจะวาดให้เองเมื่อเสร็จ)
        const vf = f.value, vt = t.value;
        o._bg.then(() => { if (o._viewFrom === vf && o._viewTo === vt && !covered(vf, vt)) window.oa_load(); });
        return;
    }
    window.oa_load();
};

// ─────────────────────────── ดึงข้อมูล ───────────────────────────
// since = ดึงเฉพาะแถวที่ "ตอบหลังเวลานี้" (ใช้ตอนอัปเดตเบา)
// ⚡ หน้าแรกถามจำนวนทั้งหมดมาด้วย → หน้าที่เหลือยิงพร้อมกันทีละ 4 (เดิมรอทีละหน้า 1000 แถว)
const OA_COLS = 'work_date, user_id, username, oa_id, oa_name, chat_id, chat_name, first_at, last_at';
async function oa_fetchReplies(f, t, since) {
    const PAGE = 1000;
    const q = (withCount) => {
        let qy = window.appDB.from('oa_replies').select(OA_COLS, withCount ? { count: 'exact' } : undefined).gte('work_date', f).lte('work_date', t);
        if (since) qy = qy.gte('last_at', since);
        return qy.order('first_at', { ascending: true });
    };
    const first = await q(true).range(0, PAGE - 1);
    if (first.error) throw first.error;
    let all = first.data || [];
    if (all.length < PAGE) return all;
    let next = PAGE;
    const total = typeof first.count === 'number' ? first.count : 0;
    if (total > PAGE) {
        const starts = []; for (let st = PAGE; st < total; st += PAGE) starts.push(st);
        for (let i = 0; i < starts.length; i += 4) {
            const res = await Promise.all(starts.slice(i, i + 4).map(st => q(false).range(st, st + PAGE - 1)));
            res.forEach(rz => { if (rz.error) throw rz.error; all = all.concat(rz.data || []); });
        }
        next = starts.length ? starts[starts.length - 1] + PAGE : PAGE;
        if (all.length < next) return oa_dedupe(all);   // หน้าสุดท้ายไม่เต็ม = ได้ครบแล้ว
    }
    for (;;) {   // มีแถวเพิ่มระหว่างดึง (หรือไม่รู้จำนวน) → ดึงต่อทีละหน้าจนหมด
        const { data, error } = await q(false).range(next, next + PAGE - 1);
        if (error) throw error;
        all = all.concat(data || []); if (!data || data.length < PAGE) break; next += PAGE;
    }
    return oa_dedupe(all);
}
function oa_dedupe(all) {   // กันแถวซ้ำตรงรอยต่อหน้า
    const seen = new Set();
    return all.filter(r => { const k = oa_rowKey(r); if (seen.has(k)) return false; seen.add(k); return true; });
}
// กะของแต่ละคน (จาก schedules) — key: lower(name)|date → กะย่อ
async function oa_fetchShifts(f, t) {
    try {
        const sm = {}; let off = 0;
        for (;;) {
            const { data, error } = await window.appDB.from('schedules').select('work_date, staff_name, shift_name').gte('work_date', f).lte('work_date', t).range(off, off + 999);
            if (error) break;
            (data || []).forEach(r => { const s = r.shift_name || ''; const sh = /เช้า/.test(s) ? 'เช้า' : /กลาง|บ่าย/.test(s) ? 'กลาง' : /ดึก/.test(s) ? 'ดึก' : ''; if (sh) sm[(r.staff_name || '').toLowerCase().trim() + '|' + r.work_date] = sh; });
            if (!data || data.length < 1000) break; off += 1000;
        }
        return sm;
    } catch (e) { return {}; }
}
// เว็บของแต่ละคน (จากตารางจัดหน้าที่ settings: duty_roster_<แผนก>_<วันที่>_<กะ>) — key: UPPER(name)|date → Set(เว็บ)
async function oa_fetchSites(f, t) {
    const wm = {};
    const days = oa_daysBetween(f, t), chunks = [];
    for (let i = 0; i < days.length; i += 31) chunks.push(days.slice(i, i + 31));   // แบ่งก้อนละ 31 วัน (URL ไม่ยาวเกิน) ยิงพร้อมกัน
    await Promise.all(chunks.map(async ch => {
        try {
            const { data } = await window.appDB.from('settings').select('key, value').or(ch.map(d => `key.like.duty_roster_*_${d}_*`).join(','));
            (data || []).forEach(row => {
                const m = String(row.key).match(/_(\d{4}-\d{2}-\d{2})_/); const date = m && m[1];
                if (!date || date < f || date > t) return;
                let v = row.value; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { return; } }
                if (!v || typeof v !== 'object') return;
                Object.keys(v).forEach(site => { const arr = v[site]; if (!Array.isArray(arr)) return;
                    arr.forEach(p => { const nm = (p && (p.username || p.name) || '').toUpperCase().trim(); if (!nm) return; const k = nm + '|' + date; (wm[k] = wm[k] || new Set()).add(site); }); });
            });
        } catch (e) { /* ไม่มีข้อมูลเว็บ ก็ยังใช้หน้านี้ได้ */ }
    }));
    return wm;
}
async function oa_fetchUsers() {
    const o = window._oa;
    try {
        const { data } = await window.appDB.from('users').select('id, username, name, department');
        if (data) { data.forEach(u => { o.users[String(u.id)] = u; }); o._usersAt = Date.now(); return true; }
    } catch (e) {}
    return false;
}
// ดึงข้อมูลช่วง f..t ครบชุด (แชท + กะ + เว็บ + รายชื่อพนักงาน) ยิงพร้อมกันทั้งหมด
async function oa_fetchSpan(f, t) {
    const o = window._oa;
    const usersP = Object.keys(o.users).length ? Promise.resolve(false) : oa_fetchUsers();
    const [rows, sm, wm, u1] = await Promise.all([oa_fetchReplies(f, t), oa_fetchShifts(f, t), oa_fetchSites(f, t), usersP]);
    const u2 = await oa_ensureUsers(rows);
    return { rows, sm, wm, usersChanged: u1 || u2 };
}
// โหลดรายชื่อพนักงาน — ครั้งแรก หรือเจอคนใหม่ที่ยังไม่รู้จัก
async function oa_ensureUsers(rows) {
    const o = window._oa;
    const missing = !Object.keys(o.users).length || rows.some(r => r.user_id != null && !o.users[String(r.user_id)]);
    if (!missing) return false;
    if (o._usersAt && Date.now() - o._usersAt < 5 * 60000 && Object.keys(o.users).length) return false;   // ไม่ถามซ้ำถี่ ๆ
    return oa_fetchUsers();
}
function oa_setUpdated(txt, bad) {
    const up = document.getElementById('oaUpdated'); if (up) up.textContent = txt;
    const lv = document.getElementById('oaLive');
    if (lv) { lv.classList.toggle('bad', !!bad); lv.classList.remove('tick'); if (!bad) { void lv.offsetWidth; lv.classList.add('tick'); } }   // กระพริบ 2 ทีตอนอัปเดตเสร็จ
}
// "ศ. 16 ต.ค." / "10 – 16 ต.ค." / "28 ก.ย. – 3 ต.ค."
function oa_fmtRange(f, t) {
    const d = (v) => new Date(v + 'T00:00:00');
    const mon = (v) => d(v).toLocaleDateString('th-TH', { month: 'short' });
    const day = (v) => d(v).getDate();
    if (!f || !t) return '';
    if (f === t) return d(f).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' });
    const yr = (v) => v.slice(0, 4) !== oa_workDate(0).slice(0, 4) ? ' ' + (+v.slice(0, 4) + 543) : '';
    if (f.slice(0, 7) === t.slice(0, 7)) return `${day(f)} – ${day(t)} ${mon(t)}${yr(t)}`;
    return `${day(f)} ${mon(f)}${yr(f)} – ${day(t)} ${mon(t)}${yr(t)}`;
}
const oa_nowHM = () => new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

// โหลดเต็มช่วง
//  opts.span = [จาก, ถึง] กำหนดช่วงเอง (ไม่ใส่ = ตามช่วงที่ดูอยู่)
//  opts.bg   = โหลดเงียบเบื้องหลัง: ไม่ล้างหน้า ไม่ขึ้นกำลังโหลด และวาดใหม่เฉพาะเมื่อสิ่งที่เห็นบนจอเปลี่ยน
window.oa_load = async function (opts = {}) {
    const o = window._oa;
    const vf = document.getElementById('oaFrom').value, vt = document.getElementById('oaTo').value;
    if (!vf || !vt) return;
    o._viewFrom = vf; o._viewTo = vt;
    const [f, t] = opts.span || oa_loadRange(vf, vt);
    const myReq = (o._reqId = (o._reqId || 0) + 1);   // กันผลเก่าที่มาช้ากว่ามาทับผลใหม่
    o._loading = true;
    let finish = () => {};
    if (opts.bg) { o._bgSpan = [f, t]; o._bg = new Promise(r => { finish = r; }); }
    const myBg = o._bg;
    try {
        const { rows, sm, wm, usersChanged } = await oa_fetchSpan(f, t);
        if (myReq !== o._reqId) return;   // มีคำขอใหม่กว่าแล้ว ทิ้งผลนี้
        const old = { rows: o.rows, sm: o.shiftMap, wm: o.siteMap };
        o.rows = rows; o._loadedFrom = f; o._loadedTo = t; o.shiftMap = sm; o.siteMap = wm;
        o._fullAt = Date.now(); o._cursor = oa_maxLast(rows);
        o._viewFrom = document.getElementById('oaFrom').value; o._viewTo = document.getElementById('oaTo').value;   // ใช้ช่วงล่าสุดที่ผู้ใช้เลือก
        const lst = document.getElementById('oaList'); if (lst) lst.style.opacity = '';
        oa_setUpdated('อัปเดต ' + oa_nowHM());
        let draw = true;
        if (opts.bg && !usersChanged) {   // โหลดเบื้องหลัง: บนจอเหมือนเดิม → ไม่ต้องวาดใหม่
            const a = o._viewFrom, z = o._viewTo, inV = (r) => r.work_date >= a && r.work_date <= z;
            draw = oa_sigOf(old.rows.filter(inV), old.sm, old.wm, a, z) !== oa_sigOf(rows.filter(inV), sm, wm, a, z);
        }
        if (draw) window.oa_render();
        oa_saveCache();
    } catch (e) {
        if (myReq !== o._reqId) return;
        const lst = document.getElementById('oaList');
        if (opts.bg) { oa_setUpdated('อัปเดตไม่สำเร็จ · จะลองใหม่อัตโนมัติ', true); if (lst) lst.style.opacity = ''; return; }   // เบื้องหลังพัง → ข้อมูลบนจอยังอยู่
        oa_setUpdated('โหลดข้อมูลไม่สำเร็จ', true);
        if (lst) { lst.style.opacity = ''; lst.innerHTML = `<div class="text-center text-red-400 py-10 text-sm">โหลดข้อมูลไม่ได้ — ตรวจว่าสร้างตาราง oa_replies ใน Supabase แล้ว<br><span class="text-xs text-slate-400">${oa_esc(e.message || e)}</span></div>`; }
    } finally {
        if (myReq === o._reqId) o._loading = false;
        if (opts.bg) { if (o._bg === myBg) { o._bg = null; o._bgSpan = null; } finish(); }
    }
};

// ⚡ เปิดหน้าครั้งแรก (ไม่มีข้อมูลในเครื่อง): โหลด "วันนี้" ก่อน → ขึ้นจอทันที แล้วค่อยโหลดส่วนที่เหลือของเดือนเงียบ ๆ
async function oa_loadFast() {
    const today = oa_workDate(0);
    await window.oa_load({ span: [today, today] });
    if (window._oa._loadedTo === today) oa_loadBackground();
}
// โหลดช่วงปกติ (7 วัน / เดือนนี้) เบื้องหลัง — มีครบแล้วไม่โหลดซ้ำ
function oa_loadBackground() {
    const o = window._oa, [wf, wt] = oa_defaultWindow();
    if (o._bg || (o._loadedFrom && o._loadedFrom <= wf && o._loadedTo >= wt)) return;
    window.oa_load({ span: [wf, wt], bg: true });
}

// ─────────────────────────── แคชในเครื่อง (IndexedDB) ───────────────────────────
// เก็บ "เมื่อวาน + วันนี้" ไว้ในเบราว์เซอร์ → เปิดหน้าครั้งต่อไป (แม้ปิดเว็บไปแล้ว) เห็นข้อมูลทันที แล้วค่อยดึงเฉพาะของใหม่
const OA_CACHE_KEY = 'oa_chat_v1';
const oa_uid = () => { const u = window.currentUser || {}; return String(u.id || u.username || ''); };
function oa_idb() {
    return new Promise((res, rej) => {
        try { const r = indexedDB.open('k36_cache', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }
        catch (e) { rej(e); }
    });
}
async function oa_cacheGet() {
    try {
        const db = await oa_idb();
        return await new Promise(res => { const q = db.transaction('kv').objectStore('kv').get(OA_CACHE_KEY); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); });
    } catch (e) { return null; }
}
// เขียนแคชไม่ถี่: ครั้งแรกหลังโหลด 2 วิ จากนั้นอย่างมาก 5 นาทีครั้ง (และตอนสลับไปแท็บอื่น)
function oa_saveCache(now) {
    const o = window._oa; o._cDirty = true;
    if (o._cT && !now) return;   // นัดเขียนไว้แล้ว
    clearTimeout(o._cT);
    const wait = now ? 0 : Math.max(2000, 5 * 60000 - (Date.now() - (o._cSavedAt || 0)));
    o._cT = setTimeout(async () => {
        o._cT = null; if (!o._cDirty) return; o._cDirty = false; o._cSavedAt = Date.now();
        try {
            const today = oa_workDate(0), uid = oa_uid();
            if (!uid || !o._loadedTo || o._loadedTo < today || o._loadedFrom > today) return;
            const from = [oa_workDate(-1), o._loadedFrom].sort()[1];
            const inR = (k) => { const d = k.slice(k.lastIndexOf('|') + 1); return d >= from && d <= today; };
            const sm = {}, wm = {};
            Object.keys(o.shiftMap).forEach(k => { if (inR(k)) sm[k] = o.shiftMap[k]; });
            Object.keys(o.siteMap).forEach(k => { if (inR(k)) wm[k] = [...o.siteMap[k]]; });
            const val = { v: 1, uid, from, to: today, savedAt: Date.now(), fullAt: o._fullAt || 0, cursor: o._cursor || null,
                rows: o.rows.filter(r => r.work_date >= from && r.work_date <= today), users: o.users, shiftMap: sm, siteMap: wm };
            const db = await oa_idb(); db.transaction('kv', 'readwrite').objectStore('kv').put(val, OA_CACHE_KEY);
        } catch (e) { /* เก็บไม่ได้ (เช่นโหมดไม่ระบุตัวตน) ก็ไม่เป็นไร */ }
    }, wait);
}
function oa_applyCache(c) {
    const o = window._oa, today = oa_workDate(0);
    if (!c || c.v !== 1 || !c.uid || c.uid !== oa_uid() || c.to !== today || !Array.isArray(c.rows)) return false;
    o.rows = c.rows; o._loadedFrom = c.from; o._loadedTo = c.to;
    o.users = Object.assign({}, c.users || {}, o.users);
    o.shiftMap = c.shiftMap || {};
    o.siteMap = {}; Object.keys(c.siteMap || {}).forEach(k => { o.siteMap[k] = new Set(c.siteMap[k]); });
    o._cursor = c.cursor; o._fullAt = c.fullAt || 0;
    return true;
}

// ลายเซ็นข้อมูลของช่วงวัน (ไว้เทียบว่าเปลี่ยนไหม)
function oa_sigOf(rows, sm, wm, f, t) {
    const inR = (k) => { const d = k.slice(k.lastIndexOf('|') + 1); return d >= f && d <= t; };
    const a = rows.map(r => `${r.work_date}|${r.user_id}|${r.oa_id}|${r.chat_id}|${r.last_at}|${r.chat_name || ''}`).sort().join('\n');
    const b = Object.keys(sm).filter(inR).sort().map(k => k + '=' + sm[k]).join(',');
    const c = Object.keys(wm).filter(inR).sort().map(k => k + '=' + [...wm[k]].sort().join('/')).join(',');
    return a.length + ':' + a + '#' + b + '#' + c;
}

const OA_FULL_EVERY = 10 * 60000;   // ทุก 10 นาที ตรวจละเอียด 1 ครั้ง (กันพลาด)
const OA_OVERLAP = 5 * 60000;       // อัปเดตเบา ดึงย้อนเผื่อ 5 นาที (กันนาฬิกาเครื่องพนักงานเพี้ยนนิดหน่อย)
const oa_rowKey = (r) => `${r.work_date}|${r.user_id}|${r.oa_id}|${r.chat_id}`;
// เวลาตอบล่าสุดที่เห็น (ไม่เกินเวลาตอนนี้ — กันเครื่องที่นาฬิกาเดินเร็วทำให้ข้ามข้อมูล)
function oa_maxLast(rows) { let m = 0; rows.forEach(r => { const t = oa_ts(r.last_at); if (t > m) m = t; }); return m ? Math.min(m, Date.now()) : null; }

// อัปเดตอัตโนมัติ (ทุก 1 นาที) มี 2 แบบ
//  • เบา (ปกติ)        : ดึงเฉพาะแชทที่ "เพิ่งตอบ" ตั้งแต่ครั้งก่อน (ย้อนเผื่อ 5 นาที) → ปกติได้แค่หลักสิบแถว
//  • ละเอียด (ทุก 10 นาที): ดึงเมื่อวาน+วันนี้ทั้งหมด + กะ + เว็บ แทนที่ของเดิม (กันตกหล่น / ข้อมูลถูกแก้)
// ข้อมูลไม่เปลี่ยน → ไม่วาดหน้าใหม่ · แท็บถูกซ่อน → ไม่ดึงเลย
window.oa_refresh = async function (mode) {   // mode: 'full' | 'light' | ไม่ใส่ = เลือกเอง
    const o = window._oa;
    if (o._loading || o._refreshing || !o._loadedFrom) return;
    const today = oa_workDate(0);
    if (o._loadedTo < today) return;   // กำลังดูช่วงในอดีต → ข้อมูลไม่เปลี่ยนแล้ว ไม่ต้องดึง
    const rf = [oa_workDate(-1), o._loadedFrom].sort()[1], rt = today;
    const full = mode === 'full' || mode === true || !o._cursor || (mode !== 'light' && (!o._fullAt || Date.now() - o._fullAt > OA_FULL_EVERY));
    const myReq = o._reqId;
    o._refreshing = true;
    try {
        let changed = false;
        if (full) {
            const [rows, sm, wm] = await Promise.all([oa_fetchReplies(rf, rt), oa_fetchShifts(rf, rt), oa_fetchSites(rf, rt)]);
            const newUsers = await oa_ensureUsers(rows);
            if (myReq !== o._reqId) return;   // ระหว่างนี้มีการโหลดเต็มใหม่ → ทิ้ง
            const oldRows = o.rows.filter(r => r.work_date >= rf && r.work_date <= rt);
            changed = oa_sigOf(oldRows, o.shiftMap, o.siteMap, rf, rt) !== oa_sigOf(rows, sm, wm, rf, rt) || newUsers;
            if (changed) {
                const inR = (k) => { const d = k.slice(k.lastIndexOf('|') + 1); return d >= rf && d <= rt; };
                Object.keys(o.shiftMap).forEach(k => { if (inR(k)) delete o.shiftMap[k]; }); Object.assign(o.shiftMap, sm);
                Object.keys(o.siteMap).forEach(k => { if (inR(k)) delete o.siteMap[k]; }); Object.assign(o.siteMap, wm);
                o.rows = o.rows.filter(r => r.work_date < rf || r.work_date > rt).concat(rows);
            }
            o._fullAt = Date.now(); o._cursor = oa_maxLast(o.rows) || o._cursor;
        } else {
            const since = new Date(o._cursor - OA_OVERLAP).toISOString();
            const rows = await oa_fetchReplies(rf, rt, since);
            const newUsers = rows.length ? await oa_ensureUsers(rows) : false;
            if (myReq !== o._reqId) return;
            if (rows.length) {
                const idx = new Map(); o.rows.forEach((r, i) => idx.set(oa_rowKey(r), i));
                rows.forEach(r => {
                    const i = idx.get(oa_rowKey(r));
                    if (i == null) { idx.set(oa_rowKey(r), o.rows.length); o.rows.push(r); changed = true; }
                    else { const old = o.rows[i]; if (old.last_at !== r.last_at || old.chat_name !== r.chat_name || old.oa_name !== r.oa_name) { o.rows[i] = r; changed = true; } }
                });
                const m = oa_maxLast(rows); if (m && m > o._cursor) o._cursor = m;
            }
            changed = changed || newUsers;
        }
        oa_setUpdated('อัปเดต ' + oa_nowHM());
        if (changed) { window.oa_render(); oa_saveCache(); }   // ⚡ ข้อมูลเหมือนเดิม → ไม่วาดใหม่
    } catch (e) {
        oa_setUpdated('อัปเดตไม่สำเร็จ · จะลองใหม่อัตโนมัติ', true);   // เน็ตสะดุด → ข้อมูลเดิมยังอยู่ ไม่ล้างหน้า
    } finally { o._refreshing = false; }
};

// ทุก 1 นาที (และตอนกลับมาที่แท็บ)
function oa_tick() {
    if (!oa_isCurrent() || document.hidden) return;
    const o = window._oa;
    // ข้ามรอบ 08:00 แล้ว (วันทำงานเปลี่ยน) และกำลังดูช่วงสำเร็จรูป → เลื่อนช่วงวันที่ให้เอง
    if (o.range !== 'custom' && o._rangeDay && o._rangeDay !== oa_workDate(0)) { window.oa_setRange(o.range); return; }
    window.oa_refresh();
}
if (!window._oaVisHook) {
    window._oaVisHook = true;
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) { if (window._oa._cDirty) oa_saveCache(true); return; }   // สลับแท็บ → เก็บแคชที่ค้างไว้เลย
        if (window._currentPageName === 'oa_chat') oa_tick();
    });
}

function oa_shiftOf(r) { return window._oa.shiftMap[(r.username || '').toLowerCase().trim() + '|' + r.work_date] || ''; }
function oa_sitesOf(r) { const s = window._oa.siteMap[(r.username || '').toUpperCase().trim() + '|' + r.work_date]; return s ? [...s] : []; }
function oa_sitesOfRows(rows) { const set = new Set(); (rows || []).forEach(r => oa_sitesOf(r).forEach(v => set.add(v))); return [...set]; }
function oa_deptOf(r) { const u = window._oa.users[String(r.user_id)]; return (u && u.department) || '-'; }
function oa_nameOf(r) { const u = window._oa.users[String(r.user_id)]; return (u && (u.username || u.name)) || r.username || String(r.user_id); }

// ─────────────────────────── ตัวกรอง ───────────────────────────
window.oa_setDept = function (d) { window._oa.dept = (window._oa.dept === d ? 'ALL' : d); window.oa_render(); };
window.oa_setShift = function (s) { window._oa.shift = (window._oa.shift === s ? 'ALL' : s); window.oa_render(); };
window.oa_setSite = function (s) { window._oa.site = (window._oa.site === s ? 'ALL' : s); window.oa_render(); };
window.oa_setOaLine = function (s) { window._oa.oaline = (window._oa.oaline === s ? 'ALL' : s); window.oa_render(); };
window.oa_clearFilters = function () { const o = window._oa; o.dept = 'ALL'; o.shift = 'ALL'; o.site = 'ALL'; o.oaline = 'ALL'; const si = document.getElementById('oaSearch'); if (si) si.value = ''; window.oa_render(); };
// พิมพ์ค้นหา: รอให้หยุดพิมพ์แป๊บนึงค่อยวาด (เดิมวาดใหม่ทุกตัวอักษร ช่วงเดือนนี้จะหน่วง)
window.oa_onSearch = function () { clearTimeout(window._oa._sT); window._oa._sT = setTimeout(() => window.oa_render(), 160); };

// แถวในช่วงวันที่ที่ดูอยู่
function oa_inView() {
    const o = window._oa, vf = o._viewFrom, vt = o._viewTo;
    return o.rows.filter(r => !vf || (r.work_date >= vf && r.work_date <= vt));
}
// แถวที่ผ่านตัวกรองทั้งหมด (ใช้ทั้งหน้าจอและไฟล์ CSV → ตรงกันเสมอ)
function oa_filtered(inView) {
    const o = window._oa, q = ((document.getElementById('oaSearch') || {}).value || '').trim().toLowerCase();
    return (inView || oa_inView()).filter(r => (o.dept === 'ALL' || oa_deptOf(r) === o.dept)
        && (o.shift === 'ALL' || oa_shiftOf(r) === o.shift)
        && (o.site === 'ALL' || oa_sitesOf(r).includes(o.site))
        && (o.oaline === 'ALL' || (r.oa_name || '') === o.oaline)
        && (!q || oa_nameOf(r).toLowerCase().includes(q) || String(r.chat_name || '').toLowerCase().includes(q)));
}

function oa_renderChips(inView) {
    const o = window._oa, q = (document.getElementById('oaSearch') || {}).value || '';
    const chip = (cls, on, fn, val, label) => `<button class="oa-chip ${cls} ${on ? 'on' : ''}" onclick="${fn}('${oa_jsq(val)}')">${oa_esc(label)}</button>`;
    // แผนก
    const dp = document.getElementById('oaDeptChips');
    if (dp) {
        const ds = new Set(); inView.forEach(r => ds.add(oa_deptOf(r)));
        if (o.dept !== 'ALL' && !ds.has(o.dept)) o.dept = 'ALL';
        dp.innerHTML = [...ds].filter(k => k && k !== '-').sort((a, b) => a.localeCompare(b, 'th')).map(k => chip('', o.dept === k, 'oa_setDept', k, k)).join('');
    }
    // กะ
    const sh = document.getElementById('oaShiftChips');
    if (sh) sh.innerHTML = ['เช้า', 'กลาง', 'ดึก'].map(k => chip('', o.shift === k, 'oa_setShift', k, 'กะ' + k)).join('');
    // เว็บ (จากข้อมูลที่โหลด)
    const st = document.getElementById('oaSiteChips');
    if (st) { const arr = oa_sitesOfRows(inView).sort();
        if (o.site !== 'ALL' && !arr.includes(o.site)) o.site = 'ALL';
        st.innerHTML = arr.map(k => chip('oa-chip-site', o.site === k, 'oa_setSite', k, k)).join('');
        const g = st.closest('.oa-fgroup'); if (g) g.style.display = arr.length ? '' : 'none'; }
    // ไลน์ OA
    const ol = document.getElementById('oaLineChips');
    if (ol) { const lines = new Set(); inView.forEach(r => { if (r.oa_name) lines.add(r.oa_name); }); const arr = [...lines].sort();
        if (o.oaline !== 'ALL' && !lines.has(o.oaline)) o.oaline = 'ALL';
        ol.innerHTML = arr.map(k => chip('oa-chip-line', o.oaline === k, 'oa_setOaLine', k, k)).join('');
        const g = ol.closest('.oa-fgroup'); if (g) g.style.display = arr.length ? '' : 'none'; }
    // ปุ่มล้างตัวกรอง โผล่เมื่อมีการกรอง
    const cf = document.getElementById('oaClearF');
    if (cf) cf.style.display = (o.dept !== 'ALL' || o.shift !== 'ALL' || o.site !== 'ALL' || o.oaline !== 'ALL' || q) ? '' : 'none';
}

// ─────────────────────────── วาดหน้าจอ ───────────────────────────
const oa_ts = (v) => { const t = v ? Date.parse(v) : NaN; return isNaN(t) ? 0 : t; };
// "ตอบล่าสุด": ภายใน 1 ชม. บอกกี่นาทีที่แล้ว · ไม่ใช่วันนี้ ใส่วันที่นำหน้า (ดูหลายวันจะได้ไม่งง)
function oa_lastLabel(v) {
    const t = oa_ts(v); if (!t) return '-';
    const mins = Math.floor((Date.now() - t) / 60000), hm = oa_time(v);
    if (mins >= 0 && mins < 1) return hm + ' · เมื่อสักครู่';
    if (mins >= 1 && mins < 60) return hm + ` · ${mins} นาทีที่แล้ว`;
    const d = new Date(t), now = new Date();
    if (d.toDateString() === now.toDateString()) return hm;
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) + ' ' + hm;
}
const oa_rankBadge = (i) => i < 3 ? '<span style="font-size:15px">' + ['🥇', '🥈', '🥉'][i] + '</span>' : (i + 1);
const oa_barW = (n, max) => Math.max(3, Math.round(n / max * 100));

window.oa_render = function () {
    const o = window._oa;
    const inView = oa_inView();
    try { oa_renderChips(inView); } catch (e) {}
    const rows = oa_filtered(inView);
    const by = {};
    rows.forEach(r => { const k = String(r.user_id); const x = by[k] || (by[k] = { name: oa_nameOf(r), dept: oa_deptOf(r), n: 0, last: null, rows: [] }); x.n++; x.rows.push(r); if (!x.last || r.last_at > x.last) x.last = r.last_at; });
    // อันดับตามจำนวนแชท (ใช้กับแท็บจัดอันดับ + เหรียญ/เลขอันดับ)
    const list = Object.entries(by).sort((a, b) => b[1].n - a[1].n || a[1].name.localeCompare(b[1].name, 'th'));
    const total = rows.length, people = list.length, max = list.length ? list[0][1].n : 1;
    const rankOf = {}; list.forEach(([id], i) => { rankOf[id] = i; });
    // รายการแชท: เรียงคนที่ตอบล่าสุดไว้บนสุด (เท่ากัน → ตอบเยอะกว่าขึ้นก่อน)
    const recent = list.slice().sort((a, b) => oa_ts(b[1].last) - oa_ts(a[1].last) || b[1].n - a[1].n);
    o._byUser = by; o._list = list; o._max = max;
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    const fmt = (n) => Number(n).toLocaleString('en-US');
    set('oaTotal', fmt(total)); set('oaPeople', fmt(people)); set('oaAvg', people ? (total / people).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '–');

    if (o.tab === 'rank') oa_renderRank(list, max);   // ⚡ วาดเฉพาะแท็บที่เปิดอยู่

    const L = document.getElementById('oaList'); if (!L) return;
    if (!list.length) { o.open.clear(); L.innerHTML = '<div class="text-center text-slate-400 py-12 text-sm">ยังไม่มีการตอบแชทในช่วงนี้</div>'; return; }
    L.innerHTML = recent.map(([id, x]) => { const i = rankOf[id];
        const sv = oa_sitesOfRows(x.rows);
        return `<div class="oa-row ${o.open.has(id) ? 'open' : ''}" onclick="oa_toggle('${oa_jsq(id)}')">
            <span class="oa-rank">${oa_rankBadge(i)}</span>
            <div class="min-w-0"><div class="oa-name truncate">${oa_esc(x.name)}</div><div class="oa-meta">${(x.dept && x.dept !== '-') ? oa_esc(x.dept) + ' · ' : ''}ตอบล่าสุด ${oa_lastLabel(x.last)}</div>${sv.length ? `<div class="oa-usites">${sv.map(w => `<span class="oa-usite">${oa_esc(w)}</span>`).join('')}</div>` : ''}<div class="oa-bar"><i style="width:${oa_barW(x.n, max)}%"></i></div></div>
            <div class="oa-n">${x.n}<small>แชท</small></div>
            <span class="material-icons oa-chev">chevron_right</span>
        </div><div class="oa-detail"><div class="oa-paged" data-uid="${oa_esc(id)}"></div></div>`;
    }).join('');
    // วาดรายชื่อลูกค้าของคนที่กางอยู่ทันที (คนที่หายจากรายการ → ล้างสถานะกาง)
    o.open.forEach(id => { if (by[id]) oa_drawChats(id); else o.open.delete(id); });
};

window.oa_renderRank = function (list, max) {
    const P = document.getElementById('oaPodium');
    if (P) {
        const medal = ['🥇', '🥈', '🥉'], cls = ['p1', 'p2', 'p3'];
        P.innerHTML = [0, 1, 2].map(i => {
            const it = list[i];
            if (!it) return `<div class="oa-pod ${cls[i]} empty"><div class="medal">${medal[i]}</div><div class="nm">—</div><div class="cnt">0</div><div class="unit">แชท</div></div>`;
            const x = it[1];
            return `<div class="oa-pod ${cls[i]}"><div class="medal">${medal[i]}</div><div class="nm">${oa_esc(x.name)}</div><div class="dp">${(x.dept && x.dept !== '-') ? oa_esc(x.dept) : '&nbsp;'}</div><div class="cnt">${x.n}</div><div class="unit">แชท</div></div>`;
        }).join('');
    }
    const R = document.getElementById('oaRankList'); if (!R) return;
    if (!list.length) { R.innerHTML = '<div class="text-center text-slate-400 py-10 text-sm">ยังไม่มีข้อมูล</div>'; return; }
    R.innerHTML = list.map(([id, x], i) => `<div class="oa-row oa-row-static">
            <span class="oa-rank">${oa_rankBadge(i)}</span>
            <div class="min-w-0"><div class="oa-name truncate">${oa_esc(x.name)}</div><div class="oa-meta">${(x.dept && x.dept !== '-') ? oa_esc(x.dept) : ''}</div><div class="oa-bar"><i style="width:${oa_barW(x.n, max)}%"></i></div></div>
            <div class="oa-n">${x.n}<small>แชท</small></div>
        </div>`).join('');
};

window.oa_setTab = function (tb) {
    const o = window._oa; o.tab = tb;
    document.querySelectorAll('.oa-tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === tb));
    const vl = document.getElementById('oaViewList'), vr = document.getElementById('oaViewRank');
    if (vl) vl.style.display = tb === 'list' ? '' : 'none';
    if (vr) vr.style.display = tb === 'rank' ? '' : 'none';
    if (tb === 'rank' && o._list) oa_renderRank(o._list, o._max || 1);
};

// กาง/หุบ แถวพนักงาน — สลับแค่แถวนั้น ไม่วาดทั้งรายการใหม่
window.oa_toggle = function (id) {
    const o = window._oa, st = o.open;
    const box = document.querySelector(`.oa-paged[data-uid="${CSS.escape(id)}"]`);
    const row = box && box.parentElement && box.parentElement.previousElementSibling;
    if (st.has(id)) {
        st.delete(id);
        if (row) row.classList.remove('open');
        if (box) box.innerHTML = '';
    } else {
        st.add(id); o._chatPage[id] = 0;
        oa_drawChats(id);
        if (row) row.classList.add('open');
    }
    if (!row) window.oa_render();
};

window.oa_drawChats = function (id) {
    const box = document.querySelector(`.oa-paged[data-uid="${CSS.escape(id)}"]`); if (!box) return;
    const x = (window._oa._byUser || {})[id]; if (!x) return;
    const PER = 10;
    const all = x.rows.slice().sort((a, b) => String(b.last_at || b.first_at).localeCompare(String(a.last_at || a.first_at)));
    const pages = Math.max(1, Math.ceil(all.length / PER));
    let p = window._oa._chatPage[id] || 0; if (p >= pages) p = pages - 1; window._oa._chatPage[id] = p;
    const slice = all.slice(p * PER, p * PER + PER);
    let html = slice.map(r => {
        const nm = r.chat_name || 'ลูกค้า ' + String(r.chat_id).slice(-6);
        const ln = r.oa_name ? `<span class="oa-chatline">${oa_esc(r.oa_name)}</span>` : '';
        return `<div class="oa-chat"><span class="oa-cust"><span class="oa-cname">${oa_esc(nm)}</span>${ln}<button class="oa-copy" onclick="oa_copyName(event,'${oa_jsq(nm)}')" title="คัดลอกชื่อ"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button></span><span>${oa_time(r.last_at || r.first_at)}</span></div>`;
    }).join('');
    if (pages > 1) {
        let nums = ''; for (let i = 0; i < pages; i++) nums += `<button class="oa-pg ${i === p ? 'on' : ''}" data-p="${i}">${i + 1}</button>`;
        html += `<div class="oa-pager"><button class="oa-pg nav" data-p="${p - 1}" ${p === 0 ? 'disabled' : ''}>‹</button>${nums}<button class="oa-pg nav" data-p="${p + 1}" ${p === pages - 1 ? 'disabled' : ''}>›</button></div>`;
    }
    box.innerHTML = html;
    box.onclick = (e) => {   // คลิกในกล่องรายละเอียด ไม่ให้ไปหุบแถว + ปุ่มเปลี่ยนหน้า (ผูกครั้งเดียวต่อกล่อง)
        e.stopPropagation();
        const b = e.target.closest('.oa-pg'); if (!b || b.disabled) return;
        const np = +b.dataset.p; if (np >= 0 && np < pages) { window._oa._chatPage[id] = np; oa_drawChats(id); }
    };
};

// ─────────────────────────── ดาวน์โหลด Excel ───────────────────────────
// ไฟล์ .xlsx แยกตามกะ → ในแต่ละกะแยกตามเว็บ (แต่ละเว็บมีเฉพาะคนของเว็บนั้น) + หัวไฟล์บอกวันที่
// นับตามที่เห็นบนจอ (ช่วงวันที่ + ตัวกรอง + ค้นหา) · เว็บมาจากตารางจัดหน้าที่ของวันนั้น ๆ
const OA_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const OA_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
// "วันศุกร์ที่ 16 ตุลาคม 2569" / "1 – 16 ตุลาคม 2569" / "28 กันยายน – 3 ตุลาคม 2569"
function oa_fmtLong(f, t) {
    const p = (v) => { const [y, m, d] = v.split('-').map(Number); return { y: y + 543, m: OA_MONTHS[m - 1], d, wd: OA_DAYS[new Date(v + 'T00:00:00').getDay()] }; };
    const a = p(f), b = p(t);
    if (f === t) return `วัน${a.wd}ที่ ${a.d} ${a.m} ${a.y}`;
    if (a.y === b.y && a.m === b.m) return `${a.d} – ${b.d} ${b.m} ${b.y}`;
    if (a.y === b.y) return `${a.d} ${a.m} – ${b.d} ${b.m} ${b.y}`;
    return `${a.d} ${a.m} ${a.y} – ${b.d} ${b.m} ${b.y}`;
}
// สรุปเป็นกลุ่มเว็บ: [{ site, people:[{name,n}], total }] เรียงเว็บที่แชทเยอะก่อน
// วันไหนคนเดียวอยู่ 2 เว็บ → กลุ่ม "เว็บA + เว็บB" (ไม่นับซ้ำ) · ไม่มีในตารางจัดหน้าที่ → "ไม่ระบุเว็บ" (อยู่ท้ายสุด)
function oa_summaryBySite(rows) {
    const NONE = 'ไม่ระบุเว็บ', g = {};
    rows.forEach(r => {
        const sv = oa_sitesOf(r).sort(); const site = sv.length ? sv.join(' + ') : NONE;
        const s = g[site] || (g[site] = { site, people: {}, total: 0 });
        const k = String(r.user_id); (s.people[k] = s.people[k] || { name: oa_nameOf(r), n: 0 }).n++; s.total++;
    });
    return Object.values(g)
        .map(s => ({ site: s.site, total: s.total, people: Object.values(s.people).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, 'th')) }))
        .sort((a, b) => (a.site === NONE) - (b.site === NONE) || b.total - a.total || a.site.localeCompare(b.site, 'th'));
}
// แยกกะก่อน (เช้า → กลาง → ดึก → ไม่ระบุกะ) แล้วในแต่ละกะแยกเว็บ — เทียบผลงานคนที่ทำช่วงเวลาเดียวกันได้ตรง ๆ
// คนที่ทำหลายกะในช่วงที่เลือก → แชทของวันไหนไปนับที่กะของวันนั้น
function oa_summaryByShift(rows) {
    const ORDER = ['เช้า', 'กลาง', 'ดึก', ''], g = {};
    rows.forEach(r => { const s = oa_shiftOf(r); (g[s] = g[s] || []).push(r); });
    return ORDER.filter(s => g[s]).map(s => ({
        label: s ? 'กะ' + s : 'ไม่ระบุกะ (ไม่มีในตารางกะ)', short: s ? 'กะ' + s : 'ไม่ระบุกะ',
        total: g[s].length,
        people: new Set(g[s].map(r => String(r.user_id))).size,
        sites: oa_summaryBySite(g[s]),
    }));
}
function oa_filterNote() {
    const o = window._oa, q = ((document.getElementById('oaSearch') || {}).value || '').trim(), parts = [];
    if (o.dept !== 'ALL') parts.push('แผนก ' + o.dept);
    if (o.shift !== 'ALL') parts.push('กะ' + o.shift);
    if (o.site !== 'ALL') parts.push('เว็บ ' + o.site);
    if (o.oaline !== 'ALL') parts.push('ไลน์ ' + o.oaline);
    if (q) parts.push('ค้นหา "' + q + '"');
    return parts.join(' · ');
}
let oa_xlP = null;
function oa_loadExcelJS() {
    if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
    if (oa_xlP) return oa_xlP;
    const add = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; setTimeout(() => rej(new Error('timeout')), 15000); document.head.appendChild(s); });
    oa_xlP = (window.JSZip ? Promise.resolve() : add('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'))
        .then(() => add('https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js'))
        .then(() => window.ExcelJS)
        .catch(e => { oa_xlP = null; throw e; });
    return oa_xlP;
}
function oa_fileName(ext) {
    const o = window._oa;
    return (o._viewFrom === o._viewTo ? `สรุปแชท-OA_${o._viewFrom}` : `สรุปแชท-OA_${o._viewFrom}_ถึง_${o._viewTo}`) + '.' + ext;
}
function oa_download(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

window.oa_exportCSV = async function () {
    if (!oa_can('oa_chat_export')) { alert('ไม่มีสิทธิ์ดาวน์โหลด'); return; }
    const rows = oa_filtered();
    if (!rows.length) { alert('ไม่มีข้อมูลในช่วง/ตัวกรองที่เลือก'); return; }
    const o = window._oa, groups = oa_summaryByShift(rows);
    const dateTxt = oa_fmtLong(o._viewFrom, o._viewTo), note = oa_filterNote();
    const btn = document.getElementById('oaBtnCsv'), lbl = btn && btn.querySelector('span:not(.material-icons)');
    const old = lbl ? lbl.textContent : '';
    if (btn) { btn.disabled = true; if (lbl) lbl.textContent = 'กำลังสร้าง…'; }
    try {
        const ExcelJS = await oa_loadExcelJS();
        oa_download(new Blob([await oa_buildXlsx(ExcelJS, groups, rows, dateTxt, note)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), oa_fileName('xlsx'));
    } catch (e) {
        // โหลดเครื่องมือ Excel ไม่ได้ (เน็ต/บล็อก) → ส่งเป็น CSV หน้าตาเดียวกันแทน ยังเปิดใน Excel ได้
        oa_download(new Blob(['\ufeff' + oa_buildCsv(groups, rows, dateTxt, note)], { type: 'text/csv;charset=utf-8' }), oa_fileName('csv'));
    } finally {
        if (btn) { btn.disabled = false; if (lbl) lbl.textContent = old; }
    }
};

async function oa_buildXlsx(ExcelJS, groups, rows, dateTxt, note) {
    const wb = new ExcelJS.Workbook(); wb.creator = 'K36';
    const FONT = 'Tahoma';
    const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
    const thin = (argb) => ({ style: 'thin', color: { argb } });
    const num = (n) => Number(n).toLocaleString('en-US');
    const avg = (t, p) => p ? (t / p).toLocaleString('en-US', { maximumFractionDigits: 1 }) : '0';
    const setRow = (ws, r, vals) => { const row = ws.getRow(r); vals.forEach((v, i) => { row.getCell(i + 1).value = v; }); return row; };
    const band = (ws, r, last, text, font, bg, h) => {
        ws.mergeCells(`A${r}:${last}${r}`); const c = ws.getCell(`A${r}`);
        c.value = text; c.font = Object.assign({ name: FONT }, font); if (bg) c.fill = fill(bg);
        c.alignment = { vertical: 'middle', indent: 1 }; if (h) ws.getRow(r).height = h; return c;
    };
    const head = (ws, title, widths) => {
        ws.columns = widths.map(w => ({ width: w }));
        const last = String.fromCharCode(64 + widths.length);
        ws.mergeCells(`A1:${last}1`); Object.assign(ws.getCell('A1'), { value: title, font: { name: FONT, size: 15, bold: true, color: { argb: 'FF0F172A' } } });
        ws.mergeCells(`A2:${last}2`); Object.assign(ws.getCell('A2'), { value: dateTxt, font: { name: FONT, size: 12, bold: true, color: { argb: 'FF047857' } } });
        ws.mergeCells(`A3:${last}3`);
        ws.getCell('A3').value = 'นับตามวันทำงาน (ตัดรอบ 08:00) · กะจากตารางกะ · เว็บจากตารางจัดหน้าที่' + (note ? ' · ตัวกรอง: ' + note : '') + ' · ดึงข้อมูล ' + new Date().toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        ws.getCell('A3').font = { name: FONT, size: 9, color: { argb: 'FF64748B' } };
        ws.getCell('A3').alignment = { wrapText: true, vertical: 'top' };
        ws.getRow(1).height = 24; ws.getRow(2).height = 19; ws.getRow(3).height = 26;
        return 5;
    };
    const colHead = (ws, r, labels) => {
        const row = setRow(ws, r, labels);
        row.eachCell(c => { c.font = { name: FONT, bold: true, size: 10, color: { argb: 'FF475569' } }; c.fill = fill('FFF1F5F9'); c.border = { bottom: thin('FFCBD5E1') }; });
        row.getCell(1).alignment = { horizontal: 'center' }; row.getCell(labels.length).alignment = { horizontal: 'right' };
    };
    const person = (ws, r, vals) => {
        const row = setRow(ws, r, vals);
        row.getCell(1).alignment = { horizontal: 'center' }; row.getCell(vals.length).numFmt = '#,##0';
        row.eachCell(c => { c.font = { name: FONT, size: 11 }; c.border = { bottom: thin('FFEEF2F6') }; });
    };
    const total = (ws, r, ncol, label, n, style) => {   // style: 'site' | 'shift' | 'grand'
        const vals = new Array(ncol).fill(null); vals[1] = label; vals[ncol - 1] = n;
        const row = setRow(ws, r, vals); row.getCell(ncol).numFmt = '#,##0';
        const white = style !== 'site', bg = style === 'shift' ? 'FF334155' : style === 'grand' ? 'FF047857' : null;
        for (let i = 1; i <= ncol; i++) { const c = row.getCell(i); c.font = { name: FONT, size: 11, bold: true, color: { argb: white ? 'FFFFFFFF' : 'FF0F172A' } }; c.border = { top: thin('FF94A3B8') }; if (bg) c.fill = fill(bg); }
        if (style !== 'site') row.height = 20;
    };

    // ชีต 1: แยกตามกะ → ในกะแยกตามเว็บ
    const ws = wb.addWorksheet('แยกตามกะและเว็บ', { views: [{ showGridLines: false }] });
    let r = head(ws, 'สรุปจำนวนแชท LINE OA · แยกตามกะและเว็บ', [8, 36, 22]);
    groups.forEach(sh => {
        band(ws, r++, 'C', `${sh.label}  ·  ${sh.people} คน  ·  ${num(sh.total)} แชท  ·  เฉลี่ย ${avg(sh.total, sh.people)} แชท/คน`,
            { size: 13, bold: true, color: { argb: 'FFFFFFFF' } }, 'FF1E293B', 26);
        r++;
        sh.sites.forEach(g => {
            const c = band(ws, r++, 'C', `${g.site === 'ไม่ระบุเว็บ' ? 'ไม่ระบุเว็บ (ไม่มีในตารางจัดหน้าที่)' : 'เว็บ ' + g.site}  ·  ${g.people.length} คน  ·  ${num(g.total)} แชท  ·  เฉลี่ย ${avg(g.total, g.people.length)}/คน`,
                { size: 11, bold: true, color: { argb: 'FF065F46' } }, 'FFD1FAE5', 21);
            c.border = { left: { style: 'medium', color: { argb: 'FF10B981' } } };
            colHead(ws, r++, ['อันดับ', 'พนักงาน', 'จำนวนแชทที่ตอบ']);
            g.people.forEach((p, i) => person(ws, r++, [i + 1, p.name, p.n]));
            total(ws, r++, 3, g.site === 'ไม่ระบุเว็บ' ? 'รวมไม่ระบุเว็บ' : 'รวมเว็บ ' + g.site, g.total, 'site');
            r++;
        });
        total(ws, r++, 3, 'รวม' + sh.short, sh.total, 'shift');
        r += 2;   // เว้น 2 แถวคั่นกะ
    });
    total(ws, r, 3, 'รวมทุกกะ', rows.length, 'grand');

    // ชีต 2: รวมทุกคน (มีคอลัมน์กะ)
    const by = {};
    rows.forEach(x => { const k = String(x.user_id); const p = by[k] || (by[k] = { name: oa_nameOf(x), n: 0, shifts: new Set() }); p.n++; p.shifts.add(oa_shiftOf(x) || '-'); });
    const order = ['เช้า', 'กลาง', 'ดึก', '-'];
    const all = Object.values(by).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, 'th'));
    const ws2 = wb.addWorksheet('รวมทุกคน', { views: [{ showGridLines: false }] });
    let r2 = head(ws2, 'สรุปจำนวนแชท LINE OA · รวมทุกคน', [8, 36, 14, 22]);
    colHead(ws2, r2++, ['อันดับ', 'พนักงาน', 'กะ', 'จำนวนแชทที่ตอบ']);
    all.forEach((p, i) => person(ws2, r2++, [i + 1, p.name, [...p.shifts].sort((a, b) => order.indexOf(a) - order.indexOf(b)).join(', '), p.n]));
    total(ws2, r2, 4, 'รวม', rows.length, 'grand');

    [ws, ws2].forEach(s => { s.pageSetup = { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: .5, right: .5, top: .6, bottom: .6, header: .3, footer: .3 } }; });
    return wb.xlsx.writeBuffer();
}

function oa_buildCsv(groups, rows, dateTxt, note) {
    const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const L = [[esc('สรุปจำนวนแชท LINE OA · แยกตามกะและเว็บ')], [esc(dateTxt)]];
    if (note) L.push([esc('ตัวกรอง: ' + note)]);
    L.push([]);
    groups.forEach(sh => {
        L.push([esc(`${sh.label} (${sh.people} คน · ${sh.total} แชท)`)]);
        sh.sites.forEach(g => {
            L.push([esc(`${g.site === 'ไม่ระบุเว็บ' ? 'ไม่ระบุเว็บ' : 'เว็บ ' + g.site} (${g.people.length} คน)`)]);
            L.push(['อันดับ', 'พนักงาน', 'จำนวนแชทที่ตอบ'].map(esc));
            g.people.forEach((p, i) => L.push([i + 1, p.name, p.n].map(esc)));
            L.push(['', g.site === 'ไม่ระบุเว็บ' ? 'รวมไม่ระบุเว็บ' : 'รวมเว็บ ' + g.site, g.total].map(esc));
            L.push([]);
        });
        L.push(['', 'รวม' + sh.short, sh.total].map(esc));
        L.push([]); L.push([]);
    });
    L.push(['', 'รวมทุกกะ', rows.length].map(esc));
    return L.map(x => x.join(',')).join('\r\n');
}

// ─────────────────────────── เริ่มหน้า ───────────────────────────
window.initOaChat = async function () {
    const o = window._oa;
    o.open = new Set(); o.dept = 'ALL'; o.shift = 'ALL'; o.site = 'ALL'; o.oaline = 'ALL';
    const si = document.getElementById('oaSearch'); if (si) si.value = '';
    const b = document.getElementById('oaBtnCsv'); if (b) b.style.display = oa_can('oa_chat_export') ? '' : 'none';
    oa_setTab('list');
    if (typeof window.registerPageInterval === 'function') window.registerPageInterval(setInterval(oa_tick, 60000));
    const today = oa_workDate(0);
    const hasToday = () => !!o._loadedFrom && o._loadedFrom <= today && o._loadedTo >= today;
    // 1) ข้อมูลในหน่วยความจำ (เพิ่งออกจากหน้านี้ไป) หรือ 2) แคชในเครื่อง (เปิดเว็บใหม่) → โชว์ทันที
    if (!hasToday() && oa_applyCache(await oa_cacheGet())) oa_setUpdated('กำลังอัปเดต…');
    window.oa_setRange('today', true);
    if (hasToday()) {
        await window.oa_refresh('light');   // ดึงเฉพาะแชทที่ตอบหลังข้อมูลที่มี (ปกติไม่กี่แถว)
        oa_loadBackground();                // แล้วเติมส่วนที่เหลือของเดือนเงียบ ๆ
    } else {
        oa_loadFast();                      // 3) ไม่มีอะไรเลย → โหลดวันนี้ก่อน
    }
};

// ─────────────────────────── คัดลอกชื่อลูกค้า ───────────────────────────
window.oa_copyName = function (ev, name) {
    ev.stopPropagation();
    const done = () => oa_copyToast(name);
    const fb = () => { try { const t = document.createElement('textarea'); t.value = name; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); } catch (e) {} done(); };
    try { navigator.clipboard.writeText(name).then(done, fb); } catch (e) { fb(); }
};
function oa_copyToast(name) {
    let tp = document.getElementById('oaCopyToast');
    if (!tp) { tp = document.createElement('div'); tp.id = 'oaCopyToast'; document.body.appendChild(tp); tp.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%) translateY(16px);z-index:99999;background:#111827;color:#fff;padding:11px 18px;border-radius:12px;font:700 13px \'Segoe UI\',Tahoma;box-shadow:0 10px 30px rgba(0,0,0,.4);border:1px solid rgba(16,185,129,.5);opacity:0;transition:.18s;white-space:nowrap;max-width:80vw;overflow:hidden;text-overflow:ellipsis;pointer-events:none;'; }
    tp.innerHTML = '<span style="color:#34d399;font-weight:900;margin-right:7px">✓</span>คัดลอกชื่อแล้ว · ' + oa_esc(name);
    requestAnimationFrame(() => { tp.style.opacity = '1'; tp.style.transform = 'translateX(-50%) translateY(0)'; });
    clearTimeout(tp._t); tp._t = setTimeout(() => { tp.style.opacity = '0'; tp.style.transform = 'translateX(-50%) translateY(16px)'; }, 1600);
}
