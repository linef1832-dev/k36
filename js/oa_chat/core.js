// =====================================================================
//  💬 ตรวจนับแชท LINE OA — อ่านตาราง oa_replies (เขียนโดยแอป BIZ Checker + ส่วนเสริม Chrome)
//  1 แถว = พนักงาน 1 คน ตอบลูกค้า 1 คน ใน 1 วันทำงาน (ตัดวันที่ 08:00)
// =====================================================================
window._oa = window._oa || { rows: [], users: {}, range: 'today', dept: 'ALL', shift: 'ALL', site: 'ALL', open: new Set(), tab: 'list', shiftMap: {}, siteMap: {} };
const oa_pad = (n) => String(n).padStart(2, '0');
const oa_iso = (d) => `${d.getFullYear()}-${oa_pad(d.getMonth() + 1)}-${oa_pad(d.getDate())}`;
function oa_workDate(off = 0) { const t = new Date(); if (t.getHours() < 8) t.setDate(t.getDate() - 1); t.setDate(t.getDate() + off); return oa_iso(t); }
const oa_esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const oa_time = (ts) => { try { return new Date(ts).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return '-'; } };
const oa_can = (p) => (typeof canPerm === 'function' ? canPerm(p) : true);

window.oa_setRange = function (r) {
    const o = window._oa; o.range = r;
    const f = document.getElementById('oaFrom'), t = document.getElementById('oaTo');
    if (r === 'today') { f.value = t.value = oa_workDate(0); }
    else if (r === 'yesterday') { f.value = t.value = oa_workDate(-1); }
    else if (r === '7d') { f.value = oa_workDate(-6); t.value = oa_workDate(0); }
    else if (r === 'month') { const d = oa_workDate(0); f.value = d.slice(0, 8) + '01'; t.value = d; }
    else { if (f.value > t.value) t.value = f.value; }
    document.querySelectorAll('#oaRangeSeg button').forEach(b => b.classList.toggle('on', b.dataset.r === r));
    const live = document.getElementById('oaRangeLive'); if (live) { const lbl = { today: 'วันนี้', yesterday: 'เมื่อวาน', '7d': '7 วันล่าสุด', month: 'เดือนนี้', custom: f.value + ' — ' + t.value }[r] || ''; live.textContent = lbl; }
    // ถ้าช่วงใหม่อยู่ในข้อมูลที่โหลดไว้ครอบคลุมแล้ว → กรองในเครื่องทันที (ไม่หน่วง) แล้วซิงก์เบื้องหลัง
    if (o._loadedFrom && o._loadedTo && f.value >= o._loadedFrom && t.value <= o._loadedTo && o.rows.length >= 0) {
        o._viewFrom = f.value; o._viewTo = t.value; window.oa_render();
        clearTimeout(o._syncT); o._syncT = setTimeout(() => window.oa_load(), 400);
    } else {
        window.oa_load();
    }
};

window.oa_load = async function () {
    const o = window._oa, f = document.getElementById('oaFrom').value, t = document.getElementById('oaTo').value;
    o._viewFrom = f; o._viewTo = t;
    try {
        if (!Object.keys(o.users).length) {
            const { data: us } = await window.appDB.from('users').select('id, username, name, department');
            (us || []).forEach(u => { o.users[String(u.id)] = u; });
        }
        let all = [], from = 0;
        for (;;) {   // ดึงทีละ 1000 แถว
            const { data, error } = await window.appDB.from('oa_replies').select('work_date, user_id, username, oa_id, chat_id, chat_name, first_at, last_at').gte('work_date', f).lte('work_date', t).order('first_at', { ascending: true }).range(from, from + 999);
            if (error) throw error;
            all = all.concat(data || []); if (!data || data.length < 1000) break; from += 1000;
        }
        o.rows = all; o._loadedFrom = f; o._loadedTo = t;
        // กะของแต่ละคน (จาก schedules) — key: lower(name)|date → กะย่อ
        try {
            const sm = {}; let off = 0;
            for (;;) { const { data } = await window.appDB.from('schedules').select('work_date, staff_name, shift_name').gte('work_date', f).lte('work_date', t).range(off, off + 999);
                (data || []).forEach(r => { const sh = /เช้า/.test(r.shift_name || '') ? 'เช้า' : /กลาง|บ่าย/.test(r.shift_name || '') ? 'กลาง' : /ดึก/.test(r.shift_name || '') ? 'ดึก' : ''; if (sh) sm[(r.staff_name || '').toLowerCase().trim() + '|' + r.work_date] = sh; });
                if (!data || data.length < 1000) break; off += 1000; }
            o.shiftMap = sm;
        } catch (e) { o.shiftMap = {}; }
        // เว็บของแต่ละคน (จาก transaction_daily_summary) — key: upper(name)|date → Set(เว็บ)
        try {
            const wm = {}; let off = 0;
            for (;;) { const { data } = await window.appDB.from('transaction_daily_summary').select('date, employee_name, website').gte('date', f).lte('date', t).range(off, off + 999);
                (data || []).forEach(r => { if (!r.website) return; const k = (r.employee_name || '').toUpperCase().trim() + '|' + r.date; (wm[k] = wm[k] || new Set()).add(r.website); });
                if (!data || data.length < 1000) break; off += 1000; }
            o.siteMap = wm;
        } catch (e) { o.siteMap = {}; }
        const up = document.getElementById('oaUpdated'); if (up) up.textContent = 'อัปเดต ' + new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
        oa_renderDept(); oa_renderChips(); window.oa_render();
    } catch (e) {
        document.getElementById('oaList').innerHTML = `<div class="text-center text-red-400 py-10 text-sm">โหลดข้อมูลไม่ได้ — ตรวจว่าสร้างตาราง oa_replies ใน Supabase แล้ว<br><span class="text-xs text-slate-400">${oa_esc(e.message || e)}</span></div>`;
    }
};

function oa_shiftOf(r) { return window._oa.shiftMap[(r.username || '').toLowerCase().trim() + '|' + r.work_date] || ''; }
function oa_sitesOf(r) { const s = window._oa.siteMap[(r.username || '').toUpperCase().trim() + '|' + r.work_date]; return s ? [...s] : []; }
function oa_deptOf(r) { const u = window._oa.users[String(r.user_id)]; return (u && u.department) || '-'; }
function oa_nameOf(r) { const u = window._oa.users[String(r.user_id)]; return (u && (u.username || u.name)) || r.username || r.user_id; }

function oa_renderDept() {
    const el = document.getElementById('oaDeptChips'); if (!el) return;
    const ds = {}; window._oa.rows.forEach(r => { const d = oa_deptOf(r); ds[d] = (ds[d] || 0) + 1; });
    const keys = Object.keys(ds).sort((a, b) => a.localeCompare(b, 'th'));
    if (window._oa.dept !== 'ALL' && !ds[window._oa.dept]) window._oa.dept = 'ALL';
    el.innerHTML = keys.filter(k => k && k !== '-').map(k => `<button class="oa-chip ${window._oa.dept === k ? 'on' : ''}" onclick="oa_setDept('${oa_esc(k).replace(/'/g, "\\'")}')">${oa_esc(k)}</button>`).join('');
}
window.oa_setDept = function (d) { window._oa.dept = (window._oa.dept === d ? 'ALL' : d); oa_renderChips(); window.oa_render(); };
window.oa_setShift = function (s) { window._oa.shift = (window._oa.shift === s ? 'ALL' : s); oa_renderChips(); window.oa_render(); };
window.oa_setSite = function (s) { window._oa.site = (window._oa.site === s ? 'ALL' : s); oa_renderChips(); window.oa_render(); };
function oa_renderChips() {
    const o = window._oa;
    // กะ
    const sh = document.getElementById('oaShiftChips');
    if (sh) sh.innerHTML = ['เช้า', 'กลาง', 'ดึก'].map(k => `<button class="oa-chip ${o.shift === k ? 'on' : ''}" onclick="oa_setShift('${k}')">กะ${k}</button>`).join('');
    // เว็บ (จากข้อมูลที่โหลด)
    const st = document.getElementById('oaSiteChips');
    if (st) { const sites = new Set(); Object.values(o.siteMap).forEach(set => set.forEach(v => sites.add(v))); const arr = [...sites].sort();
        st.innerHTML = arr.map(k => `<button class="oa-chip oa-chip-site ${o.site === k ? 'on' : ''}" onclick="oa_setSite('${oa_esc(k).replace(/'/g,"\\'")}')">${oa_esc(k)}</button>`).join(''); }
}

window.oa_render = function () {
    const o = window._oa, q = (document.getElementById('oaSearch') || {}).value || '';
    const vf = o._viewFrom, vt = o._viewTo;
    const rows = o.rows.filter(r => (!vf || (r.work_date >= vf && r.work_date <= vt))
        && (o.dept === 'ALL' || oa_deptOf(r) === o.dept)
        && (o.shift === 'ALL' || oa_shiftOf(r) === o.shift)
        && (o.site === 'ALL' || oa_sitesOf(r).includes(o.site))
        && (!q || oa_nameOf(r).toLowerCase().includes(q.toLowerCase())));
    const by = {};
    rows.forEach(r => { const k = String(r.user_id); const x = by[k] || (by[k] = { name: oa_nameOf(r), dept: oa_deptOf(r), n: 0, last: null, rows: [] }); x.n++; x.rows.push(r); if (!x.last || r.last_at > x.last) x.last = r.last_at; });
    const list = Object.entries(by).sort((a, b) => b[1].n - a[1].n || a[1].name.localeCompare(b[1].name, 'th'));
    window._oa._byUser = by;
    const total = rows.length, people = list.length, max = list.length ? list[0][1].n : 1;
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set('oaTotal', total); set('oaPeople', people); set('oaAvg', people ? (total / people).toFixed(1) : '–');

    oa_renderRank(list, max);

    const L = document.getElementById('oaList'); if (!L) return;
    if (!list.length) { L.innerHTML = '<div class="text-center text-slate-400 py-12 text-sm">ยังไม่มีการตอบแชทในช่วงนี้</div>'; return; }
    // อันดับ 4 เป็นต้นไปในรายการ (1-3 อยู่บนแท่นแล้ว แต่ยังกดดูรายละเอียดได้ทุกคน)
    L.innerHTML = list.map(([id, x], i) => {
        const days = {}; x.rows.forEach(r => { (days[r.work_date] = days[r.work_date] || []).push(r); });
        const detail = Object.keys(days).sort().reverse().map(d => `<div class="oa-day">${new Date(d + 'T00:00:00').toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })} · ${days[d].length} แชท</div>` +
            days[d].slice().sort((a, b) => String(b.last_at || b.first_at).localeCompare(String(a.last_at || a.first_at))).map(r => { const nm = r.chat_name || 'ลูกค้า ' + String(r.chat_id).slice(-6); return `<div class="oa-chat"><span class="oa-cust"><span class="oa-cname">${oa_esc(nm)}</span><button class="oa-copy" onclick="oa_copyName(event,'${oa_esc(nm).replace(/'/g,"\\'")}')" title="คัดลอกชื่อ"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button></span><span>${oa_time(r.last_at || r.first_at)}</span></div>`; }).join('')).join('');
        const rk = i < 3 ? '<span style="font-size:15px">' + ['🥇','🥈','🥉'][i] + '</span>' : (i + 1);
        return `<div class="oa-row ${o.open.has(id) ? 'open' : ''}" onclick="oa_toggle('${id}')">
            <span class="oa-rank">${rk}</span>
            <div class="min-w-0"><div class="oa-name truncate" onclick="event.stopPropagation();oa_openStat('${id}')">${oa_esc(x.name)}</div><div class="oa-meta">${(x.dept && x.dept !== '-') ? oa_esc(x.dept) + ' · ' : ''}ตอบล่าสุด ${x.last ? oa_time(x.last) : '-'}</div><div class="oa-bar"><i style="width:${Math.max(3, Math.round(x.n / max * 100))}%"></i></div></div>
            <div class="oa-n">${x.n}<small>แชท</small></div>
            <span class="material-icons oa-chev">chevron_right</span>
        </div><div class="oa-detail">${detail}</div>`;
    }).join('');
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
    R.innerHTML = list.map(([id, x], i) => {
        const rk = i < 3 ? '<span style="font-size:15px">' + ['🥇','🥈','🥉'][i] + '</span>' : (i + 1);
        return `<div class="oa-row" style="grid-template-columns:40px 1fr auto;cursor:default">
            <span class="oa-rank">${rk}</span>
            <div class="min-w-0"><div class="oa-name truncate" onclick="event.stopPropagation();oa_openStat('${id}')">${oa_esc(x.name)}</div><div class="oa-meta">${(x.dept && x.dept !== '-') ? oa_esc(x.dept) : ''}</div><div class="oa-bar"><i style="width:${Math.max(3, Math.round(x.n / max * 100))}%"></i></div></div>
            <div class="oa-n">${x.n}<small>แชท</small></div>
        </div>`;
    }).join('');
};
window.oa_setTab = function (tb) {
    window._oa.tab = tb;
    document.querySelectorAll('.oa-tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === tb));
    const vl = document.getElementById('oaViewList'), vr = document.getElementById('oaViewRank');
    if (vl) vl.style.display = tb === 'list' ? '' : 'none';
    if (vr) vr.style.display = tb === 'rank' ? '' : 'none';
};
window.oa_toggle = function (id) { const s = window._oa.open; if (s.has(id)) s.delete(id); else s.add(id); window.oa_render(); };

window.oa_exportCSV = function () {
    if (!oa_can('oa_chat_export')) { alert('ไม่มีสิทธิ์ดาวน์โหลด'); return; }
    const o = window._oa, rows = o.rows.filter(r => o.dept === 'ALL' || oa_deptOf(r) === o.dept);
    const head = ['วันทำงาน', 'พนักงาน', 'แผนก', 'บัญชี OA', 'รหัสแชท', 'ชื่อลูกค้า', 'ตอบครั้งแรก', 'ตอบล่าสุด'];
    const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const lines = [head.map(esc).join(',')].concat(rows.map(r => [r.work_date, oa_nameOf(r), oa_deptOf(r), r.oa_id, r.chat_id, r.chat_name, new Date(r.first_at).toLocaleString('th-TH'), new Date(r.last_at).toLocaleString('th-TH')].map(esc).join(',')));
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `oa-chat_${document.getElementById('oaFrom').value}_${document.getElementById('oaTo').value}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};

window.initOaChat = async function () {
    window._oa.open = new Set(); window._oa.shift = 'ALL'; window._oa.site = 'ALL';
    const b = document.getElementById('oaBtnCsv'); if (b) b.style.display = oa_can('oa_chat_export') ? '' : 'none';
    oa_setTab('list');
    window.oa_setRange('today');
    if (typeof window.registerPageInterval === 'function') window.registerPageInterval(setInterval(() => { if (window._currentPageName === 'oa_chat') window.oa_load(); }, 60000));
};


// คัดลอกชื่อลูกค้า
window.oa_copyName = function (ev, name) {
    ev.stopPropagation();
    const done = () => oa_copyToast(name);
    try { navigator.clipboard.writeText(name).then(done, () => fb()); } catch (e) { fb(); }
    function fb() { try { const t = document.createElement('textarea'); t.value = name; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); } catch (e) {} done(); }
};
function oa_copyToast(name) {
    let tp = document.getElementById('oaCopyToast');
    if (!tp) { tp = document.createElement('div'); tp.id = 'oaCopyToast'; document.body.appendChild(tp); tp.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%) translateY(16px);z-index:99999;background:#111827;color:#fff;padding:11px 18px;border-radius:12px;font:700 13px \'Segoe UI\',Tahoma;box-shadow:0 10px 30px rgba(0,0,0,.4);border:1px solid rgba(16,185,129,.5);opacity:0;transition:.18s;white-space:nowrap;max-width:80vw;overflow:hidden;text-overflow:ellipsis;'; }
    tp.innerHTML = '<span style="color:#34d399;font-weight:900;margin-right:7px">✓</span>คัดลอกชื่อแล้ว · ' + oa_esc(name);
    requestAnimationFrame(() => { tp.style.opacity = '1'; tp.style.transform = 'translateX(-50%) translateY(0)'; });
    clearTimeout(tp._t); tp._t = setTimeout(() => { tp.style.opacity = '0'; tp.style.transform = 'translateX(-50%) translateY(16px)'; }, 1600);
}


// สถิติส่วนตัว (คลิกชื่อ)
window.oa_openStat = function (userId) {
    const by = window._oa._byUser || {}; const x = by[userId]; if (!x) return;
    const days = {}; x.rows.forEach(r => { days[r.work_date] = (days[r.work_date] || 0) + 1; });
    const keys = Object.keys(days).sort(); const total = x.n, nd = keys.length, avg = nd ? (total / nd).toFixed(1) : '0';
    let bestK = '', bestV = 0; keys.forEach(k => { if (days[k] > bestV) { bestV = days[k]; bestK = k; } });
    const S = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    S('osName', x.name); S('osDep', (x.dept && x.dept !== '-') ? x.dept : ''); S('osTotal', total); S('osDays', nd); S('osAvg', avg);
    S('osBest', bestV || '–'); S('osBestD', bestK ? 'มากสุด · ' + new Date(bestK + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : 'มากสุด/วัน');
    const max = Math.max(1, ...keys.map(k => days[k]));
    document.getElementById('osDaily').innerHTML = keys.slice().reverse().map(k => `<div class="oa-sd-row"><span class="oa-sd-d">${new Date(k + 'T00:00:00').toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })}</span><div class="oa-sd-bar"><i style="width:${Math.round(days[k] / max * 100)}%"></i></div><span class="oa-sd-n">${days[k]}</span></div>`).join('');
    document.getElementById('oaStatModal').classList.add('show');
};
window.oa_closeStat = function () { document.getElementById('oaStatModal').classList.remove('show'); };
