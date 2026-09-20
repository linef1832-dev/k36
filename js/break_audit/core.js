// ════════════════════════════════════════════════════════════════════
// ⏱️ break_audit/core.js — ตรวจเวลาลุกจากที่นั่ง (ข้อมูลสด)
//   อ่านตาราง break_punches ที่ tg-listener เขียนไว้ (ดูโฟลเดอร์ tg-listener/)
//   จับคู่กับพนักงานด้วย users.telegram_id → ไม่ใช่คนของเรา ตัดทิ้ง
//   realtime: บอทในกลุ่มพิมพ์เมื่อไหร่ ตารางนี้ขยับทันที ไม่ต้องกดรีเฟรช
//   ⚠️ อ่านอย่างเดียว ไม่เขียนอะไรลงฐานข้อมูล
// ════════════════════════════════════════════════════════════════════
(function () {
    const $ = id => document.getElementById(id);
    const esc = v => (window.escapeHtml ? window.escapeHtml(v) : String(v == null ? '' : v));
    const pad = n => (n < 10 ? '0' + n : '' + n);

    let _rows    = [];     // แถวดิบของวันที่เลือก
    let _people  = [];     // ผลคำนวณ
    let _unknown = [];     // คนที่กดแต่ไม่มีในระบบ
    let _users   = [];
    let _filter  = 'all';
    let _sub     = null;
    let _lastRowAt = null; // created_at ล่าสุด — ใช้ดูว่าตัวดักฟังยังทำงานอยู่ไหม

    // ── เวลา ─────────────────────────────────────────────
    const toSec = t => { const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(String(t || '')); return m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+(m[3] || 0)) : null; };
    const hms   = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 3600) + ':' + pad(Math.floor(s % 3600 / 60)) + ':' + pad(s % 60); };
    const clock = s => pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s % 3600 / 60));
    const nowSec = () => { const d = new Date(); return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds(); };
    const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const norm = s => String(s || '').toLowerCase().replace(/[\s\-_.()]/g, '');

    function cfg() {
        return {
            cap:     (+$('baCap').value     || 120) * 60,
            mealMax: (+$('baMealMax').value || 2),
            gap:     (+$('baGap').value     || 0) * 60,
            a: toSec($('baShiftA').value) || 0,
            b: toSec($('baShiftB').value) || 86400
        };
    }
    function kindOf(name) {
        const t = String(name || '');
        if (/กินข้าว|ทานข้าว|吃饭|用餐/.test(t)) return 'meal';
        if (/ปวดหนัก|大便|厕所大/.test(t))       return 'heavy';
        if (/ปวดน้อย|สูบ|บุหรี่|小便|抽烟/.test(t)) return 'light';
        return 'other';
    }
    const dateVal = () => ($('baDate') && $('baDate').value) || iso(new Date());

    // ── พนักงานในระบบ ────────────────────────────────────
    async function loadUsers() {
        try {
            if (typeof window.getUsersCached === 'function') _users = await window.getUsersCached();
            else if (window.GLOBAL_USER_LIST && window.GLOBAL_USER_LIST.length) _users = window.GLOBAL_USER_LIST;
            else if (typeof appDB !== 'undefined') {
                const { data } = await appDB.from('users').select('id, username, department, team, role, telegram_id');
                _users = data || [];
            }
        } catch (e) { console.warn('[break_audit] โหลดรายชื่อพนักงานไม่สำเร็จ', e); _users = []; }

        const fill = (el, arr, allLabel) => { if (el) el.innerHTML = `<option value="all">${allLabel}</option>` + arr.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join(''); };
        fill($('baDept'), [...new Set(_users.map(u => u.department).filter(Boolean))].sort(), 'ทุกแผนก');
        fill($('baTeam'), [...new Set(_users.map(u => u.team).filter(Boolean))].sort(), 'ทุกเว็บ');
    }
    function findUser(tgId, tgName) {
        const id = String(tgId || '').trim();
        let u = _users.find(x => x.telegram_id && String(x.telegram_id).trim() === id);
        if (u) return u;
        const n = norm(tgName);
        if (!n) return null;
        return _users.find(x => x.username && norm(x.username).length >= 2 && n.indexOf(norm(x.username)) > -1) || null;
    }

    // ── ดึงข้อมูลของวันที่เลือก ───────────────────────────
    async function load() {
        if (typeof appDB === 'undefined') { _rows = []; return; }
        const { data, error } = await appDB.from('break_punches')
            .select('tg_user_id, tg_name, category, started_at, ended_at, duration_sec, limit_min, is_open, created_at')
            .eq('punch_date', dateVal())
            .order('started_at', { ascending: true });
        if (error) {
            console.error('[break_audit]', error);
            _rows = [];
            $('baList').innerHTML = `<div class="text-center text-red-400 py-10 text-sm px-4">
                อ่านตาราง break_punches ไม่ได้<br>
                <span class="text-gray-500 text-[12px]">${esc(error.message)} — ถ้ายังไม่ได้สร้างตาราง ให้รันไฟล์ sql/break_punches.sql ใน Supabase ก่อน</span></div>`;
            return;
        }
        _rows = data || [];
        _lastRowAt = _rows.reduce((mx, r) => (!mx || r.created_at > mx ? r.created_at : mx), null);
    }

    // ── คำนวณ ────────────────────────────────────────────
    function build(records, c) {
        const now = nowSec(), by = {};
        records.forEach(r => {
            if (!by[r.uid]) by[r.uid] = { id: r.id, name: r.name, dept: r.dept, team: r.team, sessions: [] };
            const live = r.end === null;
            let dur = live ? Math.max(0, now - r.start) : (r.dur != null ? r.dur : (r.end - r.start + 86400) % 86400);
            by[r.uid].sessions.push({ cat: r.cat, kind: kindOf(r.cat), start: r.start, end: r.start + dur, dur, live,
                                      limit: r.limit, overLimit: r.limit ? dur > r.limit * 60 : false });
        });

        return Object.keys(by).map(k => {
            const p = by[k];
            p.sessions.sort((a, b) => a.start - b.start);
            p.total = 0; p.meal = 0; p.live = false;
            p.overLimit = 0;
            p.byKind = { meal: {n:0,sec:0}, heavy: {n:0,sec:0}, light: {n:0,sec:0}, other: {n:0,sec:0} };
            p.sessions.forEach(s => {
                p.total += s.dur;
                if (s.kind === 'meal') p.meal++;
                if (s.live) p.live = true;
                if (s.overLimit) p.overLimit++;
                p.byKind[s.kind].n++; p.byKind[s.kind].sec += s.dur;
            });
            p.firstOut = p.sessions.length ? p.sessions[0].start : null;
            p.lastBack = p.sessions.length ? p.sessions[p.sessions.length - 1].end : null;

            p.chains = []; p.inChain = {}; p.chainMax = 0;
            let g = [0];
            for (let i = 1; i < p.sessions.length; i++) {
                if (p.sessions[i].start - p.sessions[i - 1].end <= c.gap) g.push(i);
                else { if (g.length > 1) p.chains.push(g); g = [i]; }
            }
            if (g.length > 1) p.chains.push(g);
            p.chains.forEach(ix => {
                const span = p.sessions[ix[ix.length - 1]].end - p.sessions[ix[0]].start;
                if (span > p.chainMax) p.chainMax = span;
                ix.forEach((i, j) => { if (j > 0) p.inChain[i] = true; });   // รอบแรกของชุดไม่ใช่ "ต่อจากรอบก่อน"
            });

            p.overCap  = p.total > c.cap;
            p.overMeal = p.meal > c.mealMax;
            p.state = (p.overCap || p.overMeal) ? 'over'
                    : (p.total >= c.cap * 0.8 || p.chains.length || p.overLimit) ? 'near' : 'ok';
            return p;
        }).sort((a, b) => {
            const rank = { over: 0, near: 1, ok: 2 };
            return rank[a.state] !== rank[b.state] ? rank[a.state] - rank[b.state] : b.total - a.total;
        });
    }

    window.baCompute = function () {
        const c = cfg(), dept = $('baDept').value, team = $('baTeam').value;
        const unknown = {}, hit = {}, use = [];

        _rows.forEach(r => {
            const u = findUser(r.tg_user_id, r.tg_name);
            if (!u) { (unknown[r.tg_user_id] = unknown[r.tg_user_id] || { id: r.tg_user_id, name: r.tg_name, n: 0 }).n++; return; }
            if (dept !== 'all' && (u.department || '') !== dept) return;
            if (team !== 'all' && (u.team || '') !== team) return;
            const start = toSec(r.started_at);
            if (start === null) return;
            hit[u.id] = true;
            use.push({
                uid: u.id, id: String(u.telegram_id || r.tg_user_id), name: u.username || r.tg_name,
                dept: u.department || '', team: u.team || '', cat: r.category || 'อื่นๆ',
                start, end: r.is_open ? null : toSec(r.ended_at), dur: r.is_open ? null : r.duration_sec,
                limit: r.limit_min
            });
        });

        _people = build(use, c);
        _unknown = Object.values(unknown).sort((a, b) => b.n - a.n);

        if ($('baAbsent').checked) {
            _users.forEach(u => {
                if (hit[u.id] || !u.telegram_id) return;
                if (dept !== 'all' && (u.department || '') !== dept) return;
                if (team !== 'all' && (u.team || '') !== team) return;
                _people.push({
                    id: String(u.telegram_id), name: u.username || '-', dept: u.department || '', team: u.team || '',
                    sessions: [], total: 0, meal: 0, live: false, chains: [], inChain: {}, chainMax: 0,
                    byKind: { meal:{n:0,sec:0}, heavy:{n:0,sec:0}, light:{n:0,sec:0}, other:{n:0,sec:0} },
                    firstOut: null, lastBack: null, overLimit: 0,
                    overCap: false, overMeal: false, absent: true, state: 'ok'
                });
            });
        }

        const ubox = $('baUnknownBox');
        if (_unknown.length) {
            ubox.style.display = '';
            $('baUnknown').innerHTML = _unknown.slice(0, 40).map(u =>
                `<span class="ba-chip" style="border-color:rgba(245,158,11,.4);color:#fcd34d">${esc(u.name)} · ${esc(u.id)} · ${u.n} รอบ</span>`).join('');
        } else ubox.style.display = 'none';

        const canExport = (typeof window.hasUserPerm !== 'function') || window.hasUserPerm('break_audit_export');
        $('baExportBtn').style.display = (_people.length && canExport) ? 'flex' : 'none';

        render();
        updateStatus();
    };

    // ── ไฟสถานะตัวดักฟัง ─────────────────────────────────
    function updateStatus() {
        const box = $('baLive'), txt = $('baLiveText');
        if (!box) return;
        const isToday = dateVal() === iso(new Date());
        if (!isToday) { box.className = 'ba-live'; txt.textContent = 'ดูข้อมูลย้อนหลัง'; }
        else if (!_lastRowAt) { box.className = 'ba-live off'; txt.textContent = 'ยังไม่มีข้อมูลวันนี้'; }
        else {
            const mins = Math.floor((Date.now() - new Date(_lastRowAt).getTime()) / 60000);
            if (mins <= 90) { box.className = 'ba-live on'; txt.textContent = `รับสด · ล่าสุด ${mins} นาทีที่แล้ว`; }
            else { box.className = 'ba-live off'; txt.textContent = `เงียบไป ${Math.floor(mins / 60)} ชม. — เช็คตัวดักฟัง`; }
        }
        const u = $('baUpdatedAt');
        if (u) { const n = new Date(); u.textContent = `อัปเดต ${pad(n.getHours())}:${pad(n.getMinutes())} · ${_rows.length} รอบในวันนี้`; }
    }

    // ── วาดหน้าจอ ────────────────────────────────────────
    function render() {
        const c = cfg();
        const q = (($('baSearch') && $('baSearch').value) || '').trim().toLowerCase();
        const kindPick = ($('baKind') && $('baKind').value) || 'all';
        const counts = { all: _people.length, over: 0, near: 0, live: 0 };
        _people.forEach(p => { if (p.state === 'over') counts.over++; else if (p.state === 'near') counts.near++; if (p.live) counts.live++; });

        $('baTally').innerHTML = [
            ['all', 'ทั้งหมด', counts.all, ''],
            ['over', 'เกินเกณฑ์', counts.over, 'over'],
            ['near', 'ต้องดู', counts.near, 'near'],
            ['live', 'ยังไม่กดกลับ', counts.live, 'live']
        ].map(t => `<button class="ba-t ${t[3]} ${_filter === t[0] ? 'on' : ''}" onclick="baFilter('${t[0]}')">
                        <span class="n">${t[2]}</span><span class="l">${t[1]}</span></button>`).join('');

        const shown = _people.filter(p => {
            if (_filter === 'over' && p.state !== 'over') return false;
            if (_filter === 'near' && p.state !== 'near') return false;
            if (_filter === 'live' && !p.live) return false;
            if (kindPick !== 'all' && (!p.byKind[kindPick] || !p.byKind[kindPick].n)) return false;
            if (q && !String(p.name).toLowerCase().includes(q)) return false;
            return true;
        });
        const box = $('baList');

        if (!_people.length) {
            box.innerHTML = `<div class="text-center text-gray-500 py-12 text-sm px-4">
                <span class="material-icons text-4xl text-slate-600">inbox</span><br>
                ไม่มีข้อมูลของวันนี้<br>
                <span class="text-[12px] text-gray-600">ถ้าบอทในกลุ่มยังพิมพ์อยู่ แปลว่าตัวดักฟัง (tg-listener) อาจหยุดทำงาน ลองเช็คที่ Railway</span></div>`;
            return;
        }
        if (!shown.length) { box.innerHTML = '<div class="text-center text-gray-500 py-10 text-sm">ไม่มีคนที่ตรงกับตัวกรองนี้</div>'; return; }

        box.innerHTML = shown.map(p => {
            const KIND = {
                meal:  { name: 'กินข้าว',            color: '#22c55e' },
                heavy: { name: 'ปวดหนัก',           color: '#f97316' },
                light: { name: 'ปวดน้อย/สูบบุหรี่', color: '#38bdf8' },
                other: { name: 'อื่นๆ',              color: '#a78bfa' }
            };

            // แถวนับรอบแยกหมวด — โชว์ทุกหมวดเสมอ หมวดที่ไม่ได้กดเป็นสีจาง
            const kindCells = ['meal','heavy','light','other'].map(k => {
                const d = p.byKind[k], on = d.n > 0;
                if (k === 'other' && !on) return '';
                return `<div class="ba-k ${on ? '' : 'off'}">
                    <span class="ba-kdot" style="background:${on ? KIND[k].color : '#334155'}"></span>
                    <span class="ba-kname">${KIND[k].name}</span>
                    <b class="ba-kn">${d.n}</b><span class="ba-kunit">รอบ</span>
                    <span class="ba-ktime">${on ? hms(d.sec) : '—'}</span>
                </div>`;
            }).join('');

            const chips = [];
            if (p.absent)        chips.push('<span class="ba-chip">ไม่มีการกดเลยในวันนี้</span>');
            if (p.overCap)       chips.push(`<span class="ba-chip bad">เกินเพดาน ${hms(p.total - c.cap)}</span>`);
            if (p.overMeal)      chips.push(`<span class="ba-chip bad">กินข้าวเกิน ${p.meal}/${c.mealMax} รอบ</span>`);
            if (p.chains.length) chips.push(`<span class="ba-chip ${p.overCap ? 'bad' : 'warn'}">กดต่อเนื่อง ${p.chains.length} ชุด รวดเดียว ${hms(p.chainMax)}</span>`);
            if (p.overLimit)     chips.push(`<span class="ba-chip warn">ใช้เกินเวลาที่บอทให้ ${p.overLimit} รอบ</span>`);
            if (p.live)          chips.push('<span class="ba-chip live">ตอนนี้ยังไม่กลับที่นั่ง</span>');

            const when = p.sessions.length
                ? `ออกครั้งแรก ${clock(p.firstOut)} · ${p.live ? 'ออกล่าสุด ' + clock(p.sessions[p.sessions.length-1].start) : 'กลับล่าสุด ' + clock(p.lastBack)}`
                : '';

            // ตารางรายรอบ
            const rows = p.sessions.map((s, i) => `
                <tr class="${p.inChain[i] ? 'linked' : ''}">
                    <td class="n" style="color:#64748b">${i + 1}</td>
                    <td><span class="ba-dot" style="background:${KIND[s.kind].color}"></span>${esc(s.cat || '-')}</td>
                    <td class="n">${clock(s.start)}</td>
                    <td class="n">${s.live ? 'ยังไม่กลับ' : clock(s.end)}</td>
                    <td class="n" ${s.overLimit ? 'style="color:#fca5a5;font-weight:800"' : ''}>${hms(s.dur)}</td>
                    <td class="n" style="color:#64748b">${s.limit ? s.limit + ' น.' : '—'}</td>
                    <td>${[p.inChain[i] ? 'ต่อจากรอบก่อน' : '', s.overLimit ? 'เกินเวลาที่บอทให้' : ''].filter(Boolean).join(' · ')}</td>
                </tr>`).join('');

            const meta = [p.dept, p.team, p.id].filter(Boolean).join(' · ');
            const pctUsed = Math.min(100, Math.round(p.total / c.cap * 100));

            return `<details class="ba-row" data-state="${p.state}">
                <summary>
                    <i class="ba-bar"></i>
                    <div style="min-width:0">
                        <div class="ba-nm">${esc(p.name)} <span class="ba-cnt">${p.sessions.length} รอบวันนี้</span></div>
                        <div class="ba-meta">${esc(meta)}${when ? ' · ' + when : ''}</div>
                    </div>
                    <div class="ba-tot">${hms(p.total)}<small>ใช้ไป ${pctUsed}% ของ ${hms(c.cap)}</small></div>
                    <div class="ba-kinds">${kindCells}</div>
                    ${chips.length ? `<div class="ba-chips">${chips.join('')}</div>` : ''}
                    <div class="ba-open"><span class="material-icons">chevron_right</span>${p.sessions.length ? `กดเพื่อดูรายละเอียดทั้ง ${p.sessions.length} รอบ (ออกตอนไหน กลับตอนไหน)` : 'ไม่มีรอบให้ดู'}</div>
                </summary>
                <div class="ba-det">
                    ${p.sessions.length ? `<table><thead><tr><th style="text-align:right">#</th><th>หมวด</th><th style="text-align:right">ออกตอน</th><th style="text-align:right">กลับตอน</th><th style="text-align:right">ใช้ไป</th><th style="text-align:right">บอทให้</th><th>หมายเหตุ</th></tr></thead><tbody>${rows}</tbody></table>`
                                        : '<div class="text-[12px] text-gray-500 py-2">ไม่มีรายการในวันนี้</div>'}
                </div>
            </details>`;
        }).join('');
    }

    // ── ปุ่มต่างๆ ────────────────────────────────────────
    window.baRender = render;
    window.baFilter = function (f) { _filter = f; render(); };
    window.baReload = async function () { await load(); window.baCompute(); };
    window.baShiftDate = function (n) {
        const d = new Date(dateVal() + 'T12:00:00');
        d.setDate(d.getDate() + n);
        $('baDate').value = iso(d);
        window.baReload();
    };

    window.baExport = function () {
        if (!_people.length) return;
        const c = cfg(), d = dateVal();
        const head = ['วันที่', 'ชื่อ', 'แผนก', 'เว็บ', 'Telegram ID', 'รวมทั้งวัน', 'เพดาน', 'เกิน', 'รอบกินข้าว', 'จำนวนครั้ง', 'ชุดกดต่อเนื่อง', 'สถานะ'];
        const lines = [head.join(',')].concat(_people.map(p => [
            d, `"${p.name}"`, p.dept || '', p.team || '', p.id || '',
            hms(p.total), hms(c.cap), p.overCap ? hms(p.total - c.cap) : '',
            p.meal, p.sessions.length, p.chains.length,
            p.state === 'over' ? 'เกินเกณฑ์' : p.state === 'near' ? 'ต้องดู' : 'ปกติ'
        ].join(',')));
        const url = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
        const a = document.createElement('a');
        a.href = url; a.download = `break-audit-${d}.csv`; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    // ── เริ่มหน้า ────────────────────────────────────────
    window.initBreakAudit = async function () {
        if (!$('baPage')) return;
        if (!$('baDate').value) $('baDate').value = iso(new Date());

        await loadUsers();
        await load();
        window.baCompute();

        // 📡 realtime — บอทในกลุ่มพิมพ์ → tg-listener เขียนลงตาราง → หน้านี้ขยับเอง
        if (_sub) { try { appDB.removeChannel(_sub); } catch (e) {} _sub = null; }
        if (typeof appDB !== 'undefined') {
            let t = null;
            _sub = appDB.channel('break-audit-live')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'break_punches' }, () => {
                    clearTimeout(t);
                    t = setTimeout(() => { if ($('baPage')) window.baReload(); }, 400);
                }).subscribe();
            if (typeof window.registerPageSubscription === 'function') window.registerPageSubscription(_sub);
        }

        // เดินเวลาให้คนที่ยังไม่กดกลับที่นั่ง + ขยับเส้นเวลาปัจจุบัน
        const tick = setInterval(() => {
            if (!$('baPage')) { clearInterval(tick); return; }
            if (_people.some(p => p.live) || dateVal() === iso(new Date())) window.baCompute();
        }, 30000);
        if (typeof window.registerPageInterval === 'function') window.registerPageInterval(tick);
    };
})();
