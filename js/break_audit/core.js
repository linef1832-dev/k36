// ════════════════════════════════════════════════════════════════════
// ⏱️ break_audit/core.js — ตรวจเวลาลุกจากที่นั่ง (จากข้อความบอทเช็คอินใน Telegram)
//   - อ่าน export ของกลุ่ม Telegram (result.json / messages.html / ก๊อปวาง)
//   - แกะ: รหัสผู้ใช้ · ชื่อ · วันเวลา · หมวด (กินข้าว/ปวดหนัก/ปวดน้อย) · เวลากิจกรรมนี้
//   - จับคู่กับพนักงานในระบบด้วย users.telegram_id (ไม่ใช่คนของเรา = ตัดทิ้ง)
//   - รวมเวลาทุกหมวดต่อคนต่อวัน เทียบเพดาน + นับรอบกินข้าว + จับ "กดต่อเนื่อง"
//   ⚠️ ไม่แตะฐานข้อมูล อ่านตาราง users อย่างเดียว
// ════════════════════════════════════════════════════════════════════
(function () {
    const $ = id => document.getElementById(id);
    const esc = v => (window.escapeHtml ? window.escapeHtml(v) : String(v == null ? '' : v));

    let _records = [];     // ทุกรอบที่อ่านได้ (ทุกวัน)
    let _people  = [];     // ผลคำนวณของวันที่เลือก
    let _unknown = [];     // คนที่กดแต่ไม่มีในระบบ
    let _filter  = 'all';
    let _date    = '';
    let _users   = [];

    // ── เวลา ─────────────────────────────────────────────
    const pad = n => (n < 10 ? '0' + n : '' + n);
    function toSec(v) {
        if (v === null || v === undefined || v === '') return null;
        if (typeof v === 'number') return v;
        const s = String(v).trim();
        const m = s.match(/[T ](\d{1,2}):(\d{2})(?::(\d{2}))?/) || s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
        return m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+(m[3] || 0)) : null;
    }
    const hms   = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 3600) + ':' + pad(Math.floor(s % 3600 / 60)) + ':' + pad(s % 60); };
    const clock = s => pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s % 3600 / 60));
    const nowSec = () => { const d = new Date(); return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds(); };

    // ── เกณฑ์ ────────────────────────────────────────────
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

    // ── อ่านข้อความบอท ───────────────────────────────────
    const RX = {
        user:  /(?:^|\n)[ \t>*•·]*(?:👤[ \t]*)?(?:ผู้ใช้|用户)[ \t]*[:：][ \t]*([^\n]+)/,
        id:    /(?:รหัสผู้ใช้|用户ID|用户 ID)[ \t]*[:：]?[ \t]*(\d{4,})/,
        stamp: /(\d{1,2})\s*\/\s*(\d{1,2})[ \t]+(\d{1,2}):(\d{2}):(\d{2})/,
        done:  /(?:ลงทะเบียนสำหรับ|登记)[ \t]*([^\n]*?)[ \t]*(?:สำเร็จ|成功)[ \t]*[:：]?[ \t]*([^\n]*)/,
        dur:   /(?:เวลากิจกรรมนี้|本次活动时间)[^\d\n]*(\d{1,3}):(\d{2}):(\d{2})/,
        back:  /กลับที่นั่ง|回座|回到座位/i
    };
    const cleanName = s => String(s || '').replace(/\s*[（(][^）)]*[）)]\s*$/, '').replace(/\s+/g, ' ').trim();
    const norm      = s => String(s || '').toLowerCase().replace(/[\s\-_.()]/g, '');

    function flattenTelegram(j) {
        return (j.messages || []).map(m => {
            let t = m.text;
            if (Array.isArray(t)) t = t.map(x => (typeof x === 'string' ? x : (x.text || ''))).join('');
            if (!t && Array.isArray(m.text_entities)) t = m.text_entities.map(x => x.text || '').join('');
            return String(t || '');
        }).filter(Boolean).join('\n\n\n');
    }
    function htmlToText(html) {
        return html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
                   .replace(/<br\s*\/?>/gi, '\n')
                   .replace(/<\/(div|p|li|tr|h\d)>/gi, '\n')
                   .replace(/<[^>]+>/g, '')
                   .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                   .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
                   .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d));
    }
    function readBlock(b) {
        const id = RX.id.exec(b), st = RX.stamp.exec(b);
        if (!id || !st) return null;
        const u = RX.user.exec(b), d = RX.done.exec(b), du = RX.dur.exec(b);
        return {
            id: id[1],
            name: cleanName(u ? u[1] : id[1]) || id[1],
            date: pad(+st[1]) + '/' + pad(+st[2]),
            at: (+st[3]) * 3600 + (+st[4]) * 60 + (+st[5]),
            action: d ? d[1].trim() : '',
            cat: d ? d[2].trim() : '',
            dur: du ? (+du[1]) * 3600 + (+du[2]) * 60 + (+du[3]) : null
        };
    }
    function pairUp(msgs) {
        const by = {}, out = [];
        msgs.forEach(m => { const k = m.id + '|' + m.date; (by[k] = by[k] || []).push(m); });
        Object.keys(by).forEach(k => {
            const arr = by[k].sort((a, b) => a.at - b.at);
            let pending = null;
            arr.forEach(m => {
                const isBack = m.dur !== null || RX.back.test(m.action) || RX.back.test(m.cat);
                if (isBack) {
                    let cat = m.cat || (pending ? pending.action : '');
                    if (RX.back.test(cat)) cat = pending ? pending.action : '';
                    const dur = m.dur !== null ? m.dur : (pending ? m.at - pending.at : null);
                    if (dur === null || dur < 0) { pending = null; return; }
                    out.push({ id: m.id, name: m.name, date: m.date, cat: cat || 'อื่นๆ', start: Math.max(0, m.at - dur), end: m.at });
                    pending = null;
                } else if (m.action) {
                    if (pending) out.push({ id: pending.id, name: pending.name, date: pending.date, cat: pending.action, start: pending.at, end: m.at });
                    pending = m;
                }
            });
            if (pending) out.push({ id: pending.id, name: pending.name, date: pending.date, cat: pending.action, start: pending.at, end: null });
        });
        return out;
    }
    function parseBotLog(text) {
        let blocks = text.split(/(?=(?:^|\n)[ \t>*•·]*(?:👤[ \t]*)?(?:ผู้ใช้|用户)[ \t]*[:：])/);
        if (!blocks.some(b => RX.id.test(b))) blocks = text.split(/(?=✅|❌)/);
        const msgs = [];
        blocks.forEach(b => { const m = readBlock(b); if (m) msgs.push(m); });
        return pairUp(msgs);
    }
    function parse(text) {
        text = (text || '').trim();
        if (!text) return [];
        if (text[0] === '{' || text[0] === '[') {
            try {
                const j = JSON.parse(text);
                if (j && j.messages) return parseBotLog(flattenTelegram(j));
                return parseBotLog(JSON.stringify(j));
            } catch (e) { /* ไม่ใช่ JSON จริง → อ่านเป็นข้อความ */ }
        }
        if (/<\/?(html|div|table|body)\b/i.test(text)) return parseBotLog(htmlToText(text));
        return parseBotLog(text);
    }

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

        const depts = [...new Set(_users.map(u => u.department).filter(Boolean))].sort();
        const teams = [...new Set(_users.map(u => u.team).filter(Boolean))].sort();
        const fill = (el, arr, allLabel) => {
            if (!el) return;
            el.innerHTML = `<option value="all">${allLabel}</option>` + arr.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
        };
        fill($('baDept'), depts, 'ทุกแผนก');
        fill($('baTeam'), teams, 'ทุกเว็บ');
    }
    function findUser(rec) {
        const tid = String(rec.id || '');
        let u = _users.find(x => x.telegram_id && String(x.telegram_id).trim() === tid);
        if (u) return u;
        const n = norm(rec.name);
        if (!n) return null;
        return _users.find(x => x.username && norm(x.username).length >= 2 && n.indexOf(norm(x.username)) > -1) || null;
    }

    // ── คำนวณ ────────────────────────────────────────────
    function build(records, c) {
        const now = nowSec(), by = {};
        records.forEach(r => {
            const k = r.uid;
            if (!by[k]) by[k] = { id: r.id, name: r.name, dept: r.dept, team: r.team, sessions: [] };
            let end = (r.end === null || r.end === undefined) ? null : r.end;
            if (end !== null && end < r.start) end += 86400;
            const live = end === null;
            const dur = live ? Math.max(0, now - r.start) : end - r.start;
            by[k].sessions.push({ cat: r.cat, kind: kindOf(r.cat), start: r.start, end: live ? r.start + dur : end, dur, live });
        });

        return Object.keys(by).map(k => {
            const p = by[k];
            p.sessions.sort((a, b) => a.start - b.start);
            p.total = 0; p.meal = 0; p.live = false;
            p.sessions.forEach(s => { p.total += s.dur; if (s.kind === 'meal') p.meal++; if (s.live) p.live = true; });

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
                ix.forEach(i => { p.inChain[i] = true; });
            });

            p.overCap  = p.total > c.cap;
            p.overMeal = p.meal > c.mealMax;
            p.state = (p.overCap || p.overMeal) ? 'over'
                    : (p.total >= c.cap * 0.8 || p.chains.length) ? 'near' : 'ok';
            return p;
        }).sort((a, b) => {
            const rank = { over: 0, near: 1, ok: 2 };
            return rank[a.state] !== rank[b.state] ? rank[a.state] - rank[b.state] : b.total - a.total;
        });
    }

    // ── วาดหน้าจอ ────────────────────────────────────────
    function render() {
        const c = cfg();
        const q = ($('baSearch') && $('baSearch').value || '').trim().toLowerCase();
        const counts = { all: _people.length, over: 0, near: 0, ok: 0 };
        _people.forEach(p => counts[p.state]++);

        $('baTally').innerHTML = [
            ['all', 'ทั้งหมด', counts.all, ''],
            ['over', 'เกินเกณฑ์', counts.over, 'over'],
            ['near', 'ต้องดู', counts.near, 'near'],
            ['ok', 'ปกติ', counts.ok, '']
        ].map(t => `<button class="ba-t ${t[3]} ${_filter === t[0] ? 'on' : ''}" onclick="baFilter('${t[0]}')">
                        <span class="n">${t[2]}</span><span class="l">${t[1]}</span></button>`).join('');

        const shown = _people.filter(p =>
            (_filter === 'all' || p.state === _filter) &&
            (!q || String(p.name).toLowerCase().includes(q)));
        const box = $('baList');

        if (!_people.length) {
            box.innerHTML = `<div class="text-center text-gray-500 py-12 text-sm px-4">
                <span class="material-icons text-4xl text-slate-600">upload_file</span><br>
                ยังไม่มีข้อมูล — วางไฟล์ export ของกลุ่ม Telegram ไว้ด้านล่าง</div>`;
            return;
        }
        if (!shown.length) { box.innerHTML = '<div class="text-center text-gray-500 py-10 text-sm">ไม่มีคนในกลุ่มนี้</div>'; return; }

        const span = Math.max(60, c.b - c.a);
        const pct = s => ((s - c.a) / span) * 100;

        box.innerHTML = shown.map(p => {
            let marks = '';
            for (let t = Math.ceil(c.a / 3600) * 3600; t < c.b; t += 3600) marks += `<i class="ba-hour" style="left:${pct(t).toFixed(2)}%"></i>`;

            const blocks = p.sessions.map(s => {
                const l = Math.max(0, Math.min(100, pct(s.start)));
                const w = Math.max(0.6, Math.min(100 - l, (s.dur / span) * 100));
                return `<i class="ba-blk ${s.kind}${s.live ? ' live' : ''}" style="left:${l.toFixed(2)}%;width:${w.toFixed(2)}%" title="${esc(s.cat)} ${clock(s.start)} · ${hms(s.dur)}"></i>`;
            }).join('');

            const chainMarks = p.chains.map(ix => {
                const s0 = p.sessions[ix[0]].start, s1 = p.sessions[ix[ix.length - 1]].end;
                const l = Math.max(0, Math.min(100, pct(s0)));
                const w = Math.max(1, Math.min(100 - l, ((s1 - s0) / span) * 100));
                return `<i class="ba-chain" style="left:${l.toFixed(2)}%;width:${w.toFixed(2)}%"></i>`;
            }).join('');

            let ticks = '';
            for (let h = Math.ceil(c.a / 3600) * 3600; h <= c.b; h += 7200) ticks += `<span style="left:${pct(h).toFixed(2)}%">${clock(h)}</span>`;

            const chips = [];
            if (p.absent)     chips.push('<span class="ba-chip">ไม่มีการกดเลยในวันนี้</span>');
            if (p.overCap)    chips.push(`<span class="ba-chip bad">เกินเพดาน ${hms(p.total - c.cap)}</span>`);
            if (p.overMeal)   chips.push(`<span class="ba-chip bad">กินข้าว ${p.meal} รอบ</span>`);
            if (p.chains.length) chips.push(`<span class="ba-chip ${p.overCap ? 'bad' : 'warn'}">กดต่อเนื่อง ${p.chains.length} ชุด ยาวสุด ${hms(p.chainMax)}</span>`);
            if (!p.overMeal && p.meal) chips.push(`<span class="ba-chip">กินข้าว ${p.meal}/${cfg().mealMax} รอบ</span>`);
            if (p.live)       chips.push('<span class="ba-chip live">ยังไม่กลับที่นั่ง</span>');

            const rows = p.sessions.map((s, i) => `
                <tr class="${p.inChain[i] ? 'linked' : ''}">
                    <td><span class="ba-dot" style="background:${{meal:'#22c55e',heavy:'#f97316',light:'#38bdf8',other:'#a78bfa'}[s.kind]}"></span>${esc(s.cat || '-')}</td>
                    <td class="n">${clock(s.start)}</td>
                    <td class="n">${s.live ? '—' : clock(s.end)}</td>
                    <td class="n">${hms(s.dur)}</td>
                    <td>${p.inChain[i] ? 'ต่อจากครั้งก่อน' : ''}</td>
                </tr>`).join('');

            const meta = [p.dept, p.team, p.id].filter(Boolean).join(' · ');

            return `<details class="ba-row" data-state="${p.state}">
                <summary>
                    <i class="ba-bar"></i>
                    <div style="min-width:0">
                        <div class="ba-nm">${esc(p.name)}</div>
                        <div class="ba-meta">${esc(meta)}</div>
                    </div>
                    <div class="ba-tot">${hms(p.total)}<small>จาก ${hms(c.cap)}</small></div>
                    <div class="ba-track">${marks}${blocks}${chainMarks}</div>
                    <div class="ba-ticks">${ticks}</div>
                    ${chips.length ? `<div class="ba-chips">${chips.join('')}</div>` : ''}
                </summary>
                <div class="ba-det">
                    ${p.sessions.length ? `<table><thead><tr><th>หมวด</th><th>ออก</th><th>กลับ</th><th style="text-align:right">ใช้ไป</th><th>หมายเหตุ</th></tr></thead><tbody>${rows}</tbody></table>`
                                        : '<div class="text-[12px] text-gray-500 py-2">ไม่มีรายการในวันนี้</div>'}
                </div>
            </details>`;
        }).join('');
    }

    // ── ประมวลผลรอบใหม่ ──────────────────────────────────
    function fillDates() {
        const seen = {};
        _records.forEach(r => { if (r.date) seen[r.date] = (seen[r.date] || 0) + 1; });
        const dates = Object.keys(seen).sort();
        const sel = $('baDate');
        if (!dates.length) { sel.innerHTML = '<option value="">— ยังไม่มีข้อมูล —</option>'; _date = ''; return; }
        if (dates.indexOf(_date) < 0) _date = dates[dates.length - 1];
        sel.innerHTML = dates.map(d => `<option value="${d}" ${d === _date ? 'selected' : ''}>${d} (${seen[d]} รอบ)</option>`).join('');
    }

    window.baRun = function () {
        const msg = $('baMsg');
        try {
            _records = parse($('baRaw').value);
            fillDates();

            const dept = $('baDept').value, team = $('baTeam').value, c = cfg();
            const unknown = {}, hit = {};
            const use = [];

            _records.forEach(r => {
                if (_date && r.date !== _date) return;
                const u = findUser(r);
                if (!u) { const k = r.id; (unknown[k] = unknown[k] || { id: r.id, name: r.name, n: 0 }).n++; return; }
                if (dept !== 'all' && (u.department || '') !== dept) return;
                if (team !== 'all' && (u.team || '') !== team) return;
                hit[u.id] = true;
                use.push({ ...r, uid: u.id, name: u.username || r.name, dept: u.department || '', team: u.team || '' });
            });

            _people = build(use, c);
            _unknown = Object.values(unknown).sort((a, b) => b.n - a.n);

            if ($('baAbsent').checked) {
                _users.forEach(u => {
                    if (hit[u.id]) return;
                    if (dept !== 'all' && (u.department || '') !== dept) return;
                    if (team !== 'all' && (u.team || '') !== team) return;
                    if (!u.telegram_id) return;                    // ไม่ได้ผูก Telegram ไว้ ไม่นับว่าขาด
                    _people.push({
                        id: String(u.telegram_id || ''), name: u.username || '-', dept: u.department || '', team: u.team || '',
                        sessions: [], total: 0, meal: 0, live: false, chains: [], inChain: {}, chainMax: 0,
                        overCap: false, overMeal: false, absent: true, state: 'ok'
                    });
                });
            }

            // กล่องคนที่จับคู่ไม่ได้
            const ubox = $('baUnknownBox');
            if (_unknown.length) {
                ubox.style.display = '';
                $('baUnknown').innerHTML = _unknown.slice(0, 40).map(u =>
                    `<span class="ba-chip" style="border-color:rgba(245,158,11,.4);color:#fcd34d">${esc(u.name)} · ${esc(u.id)} · ${u.n} รอบ</span>`).join('');
            } else ubox.style.display = 'none';

            const canExport = (typeof window.hasUserPerm !== 'function') || window.hasUserPerm('break_audit_export');
            $('baExportBtn').style.display = (_people.length && canExport) ? 'flex' : 'none';

            msg.textContent = _records.length
                ? `อ่านได้ ${_records.length} รอบ · วันที่เลือก ${use.length} รอบ จาก ${_people.length} คน` +
                  (_unknown.length ? ` · ไม่รู้จัก ${_unknown.length} คน` : '')
                : 'ยังจับรูปแบบข้อความไม่ได้ — ต้องมีบรรทัดรหัสผู้ใช้และเวลาในข้อความ';
            msg.className = 'text-[12px] text-gray-400 self-center ml-1';

            try { if (($('baRaw').value || '').length < 1500000) window.safeSetItem && window.safeSetItem('ba_last_log', $('baRaw').value); } catch (e) {}
            render();
        } catch (e) {
            console.error(e);
            msg.textContent = 'อ่านข้อมูลไม่ได้: ' + e.message;
            msg.className = 'text-[12px] text-red-400 self-center ml-1';
        }
    };

    window.baFilter = function (f) { _filter = f; render(); };
    window.baRender = render;

    window.baClear = function () {
        $('baRaw').value = ''; _records = []; _people = []; _unknown = []; _date = '';
        $('baDate').innerHTML = '<option value="">— ยังไม่มีข้อมูล —</option>';
        $('baUnknownBox').style.display = 'none';
        $('baExportBtn').style.display = 'none';
        $('baMsg').textContent = '';
        try { window.safeSetItem && window.safeSetItem('ba_last_log', ''); } catch (e) {}
        render();
    };

    window.baExport = function () {
        if (!_people.length) return;
        const c = cfg();
        const head = ['วันที่', 'ชื่อ', 'แผนก', 'เว็บ', 'Telegram ID', 'รวมทั้งวัน', 'เพดาน', 'เกิน', 'รอบกินข้าว', 'จำนวนครั้ง', 'ชุดกดต่อเนื่อง', 'สถานะ'];
        const lines = [head.join(',')].concat(_people.map(p => [
            _date, `"${p.name}"`, p.dept || '', p.team || '', p.id || '',
            hms(p.total), hms(c.cap), p.overCap ? hms(p.total - c.cap) : '',
            p.meal, p.sessions.length, p.chains.length,
            p.state === 'over' ? 'เกินเกณฑ์' : p.state === 'near' ? 'ต้องดู' : 'ปกติ'
        ].join(',')));
        const url = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
        const a = document.createElement('a');
        a.href = url; a.download = `break-audit-${(_date || '').replace('/', '-')}.csv`; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    // ── ไฟล์ ─────────────────────────────────────────────
    function loadFiles(files) {
        const list = Array.prototype.slice.call(files || []);
        if (!list.length) return;
        $('baMsg').textContent = `กำลังอ่าน ${list.length} ไฟล์…`;
        const parts = []; let left = list.length;
        list.forEach((f, i) => {
            const fr = new FileReader();
            const done = () => { if (--left === 0) { $('baRaw').value = parts.join('\n\n\n'); window.baRun(); } };
            fr.onload = () => {
                let t = String(fr.result || '');
                if (/\.html?$/i.test(f.name) || /^\s*</.test(t)) t = htmlToText(t);
                else if (/\.json$/i.test(f.name)) { try { const j = JSON.parse(t); if (j && j.messages) t = flattenTelegram(j); } catch (e) {} }
                parts[i] = t; done();
            };
            fr.onerror = () => { parts[i] = ''; done(); };
            fr.readAsText(f, 'utf-8');
        });
    }

    // ── ข้อมูลตัวอย่าง ───────────────────────────────────
    window.baDemo = function () {
        const d = new Date(), md = pad(d.getMonth() + 1) + '/' + pad(d.getDate());
        const back = (name, id, at, cat, dur) =>
            [`ผู้ใช้ : ${name} (08.00 - 20.00)`, `รหัสผู้ใช้ : ${id}`, '-------------------------',
             `✅ ${md} ${at} ลงทะเบียนสำหรับ กลับที่นั่ง สำเร็จ : ${cat}`, '-------------------------',
             `เวลากิจกรรมนี้ : ${dur}`, '-------------------------'].join('\n');
        const ids = _users.filter(u => u.telegram_id).slice(0, 3);
        const A = ids[0] ? { n: ids[0].username, i: ids[0].telegram_id } : { n: 'OD- BIRD-TT-Jun88', i: '8319332907' };
        const B = ids[1] ? { n: ids[1].username, i: ids[1].telegram_id } : { n: 'OD- NAM-TT-Jun88',  i: '8412009155' };
        const C = ids[2] ? { n: ids[2].username, i: ids[2].telegram_id } : { n: 'OD- BEER-TT-Jun88', i: '8377451220' };
        $('baRaw').value = [
            back(A.n, A.i, '12:01:40', 'กินข้าว', '00:31:40'),
            back(A.n, A.i, '12:23:10', 'ปวดหนัก', '00:19:44'),
            back(A.n, A.i, '12:31:00', 'ปวดน้อย.สูบบุหรี่', '00:05:58'),
            back(A.n, A.i, '13:04:44', 'กินข้าว', '00:31:29'),
            back(A.n, A.i, '16:47:20', 'ปวดน้อย.สูบบุหรี่', '00:07:20'),
            back(B.n, B.i, '09:50:00', 'ปวดน้อย.สูบบุหรี่', '00:12:00'),
            back(B.n, B.i, '11:41:12', 'กินข้าว', '00:36:12'),
            back(B.n, B.i, '15:30:00', 'ปวดหนัก', '00:25:00'),
            back(B.n, B.i, '18:04:00', 'กินข้าว', '00:34:00'),
            back(B.n, B.i, '19:26:00', 'กินข้าว', '00:16:00'),
            back(C.n, C.i, '12:44:00', 'กินข้าว', '00:34:00'),
            back(C.n, C.i, '15:14:30', 'ปวดหนัก', '00:12:30')
        ].join('\n\n\n');
        window.baRun();
    };

    // ── เริ่มหน้า ────────────────────────────────────────
    window.initBreakAudit = async function () {
        if (!$('baPage')) return;
        await loadUsers();

        const drop = $('baDrop'), file = $('baFile');
        if (drop && !drop._bound) {
            drop._bound = true;
            drop.addEventListener('click', () => file.click());
            drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
            ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('hot'); }));
            ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('hot'); }));
            drop.addEventListener('drop', e => loadFiles(e.dataTransfer.files));
            file.addEventListener('change', function () { loadFiles(this.files); this.value = ''; });
        }
        const sel = $('baDate');
        if (sel && !sel._bound) { sel._bound = true; sel.addEventListener('change', function () { _date = this.value; window.baRun(); }); }

        // คืนข้อมูลชุดล่าสุดที่เคยวางไว้ (เก็บในเครื่อง ไม่ขึ้นเซิร์ฟเวอร์)
        if (!$('baRaw').value) {
            try { const last = localStorage.getItem('ba_last_log'); if (last) $('baRaw').value = last; } catch (e) {}
        }
        if ($('baRaw').value) window.baRun(); else render();

        // นับเวลาคนที่ยังไม่กดกลับที่นั่งให้เดินต่อ
        const t = setInterval(() => { if ($('baPage') && _people.some(p => p.live)) window.baRun(); }, 60000);
        if (typeof window.registerPageInterval === 'function') window.registerPageInterval(t);
    };
})();
