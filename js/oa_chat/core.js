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

window.oa_setRange = function (r) {
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
    if (o._loadedFrom && f.value >= o._loadedFrom && t.value <= o._loadedTo) {
        window.oa_render();   // ⚡ มีในเครื่องแล้ว แสดงทันที
    } else {
        const list = document.getElementById('oaList'); if (list) list.style.opacity = '.45';
        window.oa_load();
    }
};

// ─────────────────────────── ดึงข้อมูล ───────────────────────────
async function oa_fetchReplies(f, t) {
    let all = [], from = 0;
    for (;;) {   // ดึงทีละ 1000 แถว
        const { data, error } = await window.appDB.from('oa_replies')
            .select('work_date, user_id, username, oa_id, oa_name, chat_id, chat_name, first_at, last_at')
            .gte('work_date', f).lte('work_date', t).order('first_at', { ascending: true }).range(from, from + 999);
        if (error) throw error;
        all = all.concat(data || []); if (!data || data.length < 1000) break; from += 1000;
    }
    return all;
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
// โหลดรายชื่อพนักงาน — ครั้งแรก หรือเจอคนใหม่ที่ยังไม่รู้จัก
async function oa_ensureUsers(rows) {
    const o = window._oa;
    const missing = !Object.keys(o.users).length || rows.some(r => r.user_id != null && !o.users[String(r.user_id)]);
    if (!missing) return false;
    if (o._usersAt && Date.now() - o._usersAt < 5 * 60000 && Object.keys(o.users).length) return false;   // ไม่ถามซ้ำถี่ ๆ
    try {
        const { data } = await window.appDB.from('users').select('id, username, name, department');
        if (data) { data.forEach(u => { o.users[String(u.id)] = u; }); o._usersAt = Date.now(); return true; }
    } catch (e) {}
    return false;
}
function oa_setUpdated(txt, bad) {
    const up = document.getElementById('oaUpdated'); if (up) up.textContent = txt;
    const lv = document.getElementById('oaLive'); if (lv) lv.classList.toggle('bad', !!bad);
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
window.oa_load = async function () {
    const o = window._oa;
    const vf = document.getElementById('oaFrom').value, vt = document.getElementById('oaTo').value;
    if (!vf || !vt) return;
    o._viewFrom = vf; o._viewTo = vt;
    const [f, t] = oa_loadRange(vf, vt);
    const myReq = (o._reqId = (o._reqId || 0) + 1);   // กันผลเก่าที่มาช้ากว่ามาทับผลใหม่
    o._loading = true;
    try {
        const [rows, sm, wm] = await Promise.all([oa_fetchReplies(f, t), oa_fetchShifts(f, t), oa_fetchSites(f, t)]);   // ⚡ ยิงพร้อมกัน
        await oa_ensureUsers(rows);
        if (myReq !== o._reqId) return;   // มีคำขอใหม่กว่าแล้ว ทิ้งผลนี้
        o.rows = rows; o._loadedFrom = f; o._loadedTo = t; o.shiftMap = sm; o.siteMap = wm;
        o._viewFrom = document.getElementById('oaFrom').value; o._viewTo = document.getElementById('oaTo').value;   // ใช้ช่วงล่าสุดที่ผู้ใช้เลือก
        o._sig = null;
        const lst = document.getElementById('oaList'); if (lst) lst.style.opacity = '';
        oa_setUpdated('อัปเดต ' + oa_nowHM());
        window.oa_render();
    } catch (e) {
        if (myReq !== o._reqId) return;
        const lst = document.getElementById('oaList');
        oa_setUpdated('โหลดข้อมูลไม่สำเร็จ', true);
        if (lst) { lst.style.opacity = ''; lst.innerHTML = `<div class="text-center text-red-400 py-10 text-sm">โหลดข้อมูลไม่ได้ — ตรวจว่าสร้างตาราง oa_replies ใน Supabase แล้ว<br><span class="text-xs text-slate-400">${oa_esc(e.message || e)}</span></div>`; }
    } finally { if (myReq === o._reqId) o._loading = false; }
};

// ลายเซ็นข้อมูลของช่วงวัน (ไว้เทียบว่าเปลี่ยนไหม)
function oa_sigOf(rows, sm, wm, f, t) {
    const inR = (k) => { const d = k.slice(k.lastIndexOf('|') + 1); return d >= f && d <= t; };
    const a = rows.map(r => `${r.work_date}|${r.user_id}|${r.oa_id}|${r.chat_id}|${r.last_at}|${r.chat_name || ''}`).sort().join('\n');
    const b = Object.keys(sm).filter(inR).sort().map(k => k + '=' + sm[k]).join(',');
    const c = Object.keys(wm).filter(inR).sort().map(k => k + '=' + [...wm[k]].sort().join('/')).join(',');
    return a.length + ':' + a + '#' + b + '#' + c;
}

// อัปเดตเบา: ดึงแค่ "เมื่อวาน + วันนี้" แล้วแทนที่เฉพาะ 2 วันนั้นในเครื่อง
window.oa_refresh = async function () {
    const o = window._oa;
    if (o._loading || o._refreshing || !o._loadedFrom) return;
    const today = oa_workDate(0);
    if (o._loadedTo < today) return;   // กำลังดูช่วงในอดีต → ข้อมูลไม่เปลี่ยนแล้ว ไม่ต้องดึง
    const rf = [oa_workDate(-1), o._loadedFrom].sort()[1], rt = today;
    const myReq = o._reqId;
    o._refreshing = true;
    try {
        const [rows, sm, wm] = await Promise.all([oa_fetchReplies(rf, rt), oa_fetchShifts(rf, rt), oa_fetchSites(rf, rt)]);
        const newUsers = await oa_ensureUsers(rows);
        if (myReq !== o._reqId) return;   // ระหว่างนี้มีการโหลดเต็มใหม่ → ทิ้ง
        const oldRows = o.rows.filter(r => r.work_date >= rf && r.work_date <= rt);
        const changed = oa_sigOf(oldRows, o.shiftMap, o.siteMap, rf, rt) !== oa_sigOf(rows, sm, wm, rf, rt) || newUsers;
        oa_setUpdated('อัปเดต ' + oa_nowHM());
        if (!changed) return;   // ⚡ ข้อมูลเหมือนเดิม → ไม่วาดใหม่ (ไม่กระตุก ไม่เสียแรงเครื่อง)
        const inR = (k) => { const d = k.slice(k.lastIndexOf('|') + 1); return d >= rf && d <= rt; };
        Object.keys(o.shiftMap).forEach(k => { if (inR(k)) delete o.shiftMap[k]; }); Object.assign(o.shiftMap, sm);
        Object.keys(o.siteMap).forEach(k => { if (inR(k)) delete o.siteMap[k]; }); Object.assign(o.siteMap, wm);
        o.rows = o.rows.filter(r => r.work_date < rf || r.work_date > rt).concat(rows);
        window.oa_render();
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
    document.addEventListener('visibilitychange', () => { if (!document.hidden && window._currentPageName === 'oa_chat') oa_tick(); });
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

// ─────────────────────────── ดาวน์โหลด CSV ───────────────────────────
// ใช้ข้อมูลชุดเดียวกับที่เห็นบนจอ (ช่วงวันที่ + ตัวกรอง + ค้นหา)
// เดิมดาวน์โหลดทั้งช่วงที่โหลดไว้ในเครื่อง (เช่นกด "วันนี้" แต่ได้ไฟล์ทั้งเดือน) และไม่สนตัวกรองกะ/เว็บ/ไลน์/ค้นหา
window.oa_exportCSV = function () {
    if (!oa_can('oa_chat_export')) { alert('ไม่มีสิทธิ์ดาวน์โหลด'); return; }
    const rows = oa_filtered().slice().sort((a, b) => String(a.work_date + a.first_at).localeCompare(String(b.work_date + b.first_at)));
    if (!rows.length) { alert('ไม่มีข้อมูลในช่วง/ตัวกรองที่เลือก'); return; }
    const dt = (v) => v ? new Date(v).toLocaleString('th-TH') : '';
    const head = ['วันทำงาน', 'พนักงาน', 'แผนก', 'กะ', 'เว็บ', 'ไลน์ OA', 'รหัสแชท', 'ชื่อลูกค้า', 'ตอบครั้งแรก', 'ตอบล่าสุด'];
    const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const lines = [head.map(esc).join(',')].concat(rows.map(r => [r.work_date, oa_nameOf(r), oa_deptOf(r), oa_shiftOf(r), oa_sitesOf(r).join(' / '), r.oa_name || r.oa_id, r.chat_id, r.chat_name, dt(r.first_at), dt(r.last_at)].map(esc).join(',')));
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const o = window._oa, a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `oa-chat_${o._viewFrom}_${o._viewTo}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};

// ─────────────────────────── เริ่มหน้า ───────────────────────────
window.initOaChat = async function () {
    const o = window._oa;
    o.open = new Set(); o.dept = 'ALL'; o.shift = 'ALL'; o.site = 'ALL'; o.oaline = 'ALL';
    const si = document.getElementById('oaSearch'); if (si) si.value = '';
    const b = document.getElementById('oaBtnCsv'); if (b) b.style.display = oa_can('oa_chat_export') ? '' : 'none';
    oa_setTab('list');
    const hadCache = !!o._loadedFrom;
    window.oa_setRange('today');            // มีข้อมูลเก่าในเครื่อง → โชว์ทันที
    if (hadCache && !o._loading) window.oa_refresh();   // แล้วดึงของใหม่ตามมาเลย (เดิมต้องรอ 1 นาทีถึงจะอัปเดต)
    if (typeof window.registerPageInterval === 'function') window.registerPageInterval(setInterval(oa_tick, 60000));
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
