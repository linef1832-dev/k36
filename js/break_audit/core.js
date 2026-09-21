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
    let _booked  = {};     // ชื่อพนักงาน → [รอบพักที่จองไว้วันนี้]
    let _duty    = {};     // 'แผนก|กะ|เว็บ' → Set(ชื่อ) รวมหลัก+รอง — จากหน้าจัดหน้าที่ของวันนั้น
    let _dutyMain = {};    // เฉพาะคนที่เป็น "หลัก" ของเว็บนั้น
    let _dutySec  = {};    // เฉพาะคนที่เป็น "รอง" ของเว็บนั้น
    let _dutyOf  = {};     // ชื่อ(normalized) → [{dept, shift, team}]
    let _skipDepts   = [];  // แผนกที่ไม่ต้องตรวจเลย
    let _noSlotDepts = [];  // แผนกที่ไม่ต้องเทียบรอบจองพัก

    // ── เวลา ─────────────────────────────────────────────
    const toSec = t => { const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(String(t || '')); return m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+(m[3] || 0)) : null; };
    const hms   = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 3600) + ':' + pad(Math.floor(s % 3600 / 60)) + ':' + pad(s % 60); };
    const clock = s => {
        const nx = s >= 86400;
        s = ((s % 86400) + 86400) % 86400;
        return pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s % 3600 / 60)) + (nx ? '⁺¹' : '');
    };
    const nowSec = () => { const d = new Date(); return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds(); };
    const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const addDays = (ds, n) => { const d = new Date(ds + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };
    // วันทำงานปัจจุบัน — ก่อนเวลาเริ่มวัน ยังถือเป็นของเมื่อวาน (กะดึก)
    function workDateNow(dayStart) {
        const d = new Date();
        return nowSec() < dayStart ? addDays(iso(d), -1) : iso(d);
    }
    const norm = s => String(s || '').toLowerCase().replace(/[\s\-_.()]/g, '');

    function cfg() {
        return {
            cap:     (+$('baCap').value     || 120) * 60,
            mealMax: (+$('baMealMax').value || 2),
            gap:     (+$('baGap').value || 0) * (($('baGapUnit') && $('baGapUnit').value === 'sec') ? 1 : 60),
            late:    (+($('baLate') && $('baLate').value) || 0) * 60,
            dayStart: toSec($('baDayStart') && $('baDayStart').value) || 0,
            botReset: toSec($('baBotReset') && $('baBotReset').value)
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

    // ── เกณฑ์: โหลด/บันทึก (เก็บในตาราง settings ใช้ร่วมกันทั้งทีม) ──
    const RULE_KEY = 'break_audit_rules';
    const RULE_FIELDS = ['baCap', 'baMealMax', 'baGap', 'baGapUnit', 'baLate', 'baDayStart', 'baBotReset'];

    async function loadRules() {
        let raw = null;
        try {
            if (typeof window.getSettingCached === 'function') raw = await window.getSettingCached(RULE_KEY);
            else if (typeof appDB !== 'undefined') {
                const { data } = await appDB.from('settings').select('value').eq('key', RULE_KEY).maybeSingle();
                raw = data ? data.value : null;
            }
        } catch (e) { console.warn('[break_audit] โหลดเกณฑ์ไม่ได้', e); }
        if (!raw) { try { raw = localStorage.getItem(RULE_KEY); } catch (e) {} }
        if (!raw) return;
        try {
            const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
            RULE_FIELDS.forEach(id => { if (v[id] !== undefined && $(id)) $(id).value = v[id]; });
            _skipDepts   = Array.isArray(v._skipDepts)   ? v._skipDepts   : [];
            _noSlotDepts = Array.isArray(v._noSlotDepts) ? v._noSlotDepts : [];
            if ($('baRulesNote')) $('baRulesNote').textContent = v._by ? `เกณฑ์ที่ใช้อยู่ ตั้งโดย ${v._by}` : '';
        } catch (e) { console.warn('[break_audit] เกณฑ์ที่เก็บไว้อ่านไม่ออก', e); }
    }

    window.baSaveRules = async function () {
        const v = {};
        RULE_FIELDS.forEach(id => { if ($(id)) v[id] = $(id).value; });
        _skipDepts   = [].slice.call(document.querySelectorAll('#baSkipDepts input:checked')).map(x => x.value);
        _noSlotDepts = [].slice.call(document.querySelectorAll('#baNoSlotDepts input:checked')).map(x => x.value);
        v._skipDepts = _skipDepts;
        v._noSlotDepts = _noSlotDepts;
        v._by = (window.currentUser && window.currentUser.username) || '';
        v._at = new Date().toISOString();
        const json = JSON.stringify(v);
        try { localStorage.setItem(RULE_KEY, json); } catch (e) {}
        try {
            if (typeof appDB === 'undefined') throw new Error('ไม่ได้เชื่อมฐานข้อมูล');
            const { error } = await appDB.from('settings').upsert([{ key: RULE_KEY, value: json }]);
            if (error) throw error;
            if (typeof window.clearSettingCache === 'function') window.clearSettingCache(RULE_KEY);
            if ($('baRulesNote')) $('baRulesNote').textContent = `บันทึกแล้ว ${new Date().toLocaleTimeString('th-TH', {hour:'2-digit',minute:'2-digit'})}`;
            if (typeof Swal !== 'undefined') Swal.fire({ icon: 'success', title: 'บันทึกเกณฑ์แล้ว', text: 'ทุกคนที่เปิดหน้านี้จะใช้เกณฑ์เดียวกัน', timer: 1600, showConfirmButton: false });
        } catch (e) {
            if ($('baRulesNote')) $('baRulesNote').textContent = 'บันทึกในเครื่องนี้เท่านั้น';
            if (typeof Swal !== 'undefined') Swal.fire('บันทึกขึ้นระบบไม่สำเร็จ', 'ค่าถูกเก็บไว้ในเครื่องนี้แล้ว แต่เครื่องอื่นจะยังใช้ค่าเดิม (' + e.message + ')', 'warning');
        }
        window.baCompute();
    };

    // ── พนักงานในระบบ ────────────────────────────────────
    async function loadUsers() {
        try {
            if (typeof window.getUsersCached === 'function') _users = await window.getUsersCached();
            else if (window.GLOBAL_USER_LIST && window.GLOBAL_USER_LIST.length) _users = window.GLOBAL_USER_LIST;
            else if (typeof appDB !== 'undefined') {
                const { data } = await appDB.from('users').select('id, username, department, team, role, telegram_id, allowed_shift');
                _users = data || [];
            }
        } catch (e) { console.warn('[break_audit] โหลดรายชื่อพนักงานไม่สำเร็จ', e); _users = []; }

        const fill = (el, arr, allLabel) => { if (el) el.innerHTML = `<option value="all">${allLabel}</option>` + arr.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join(''); };
        // กะ: ใช้ชุดมาตรฐานของระบบเสมอ + กะแปลกๆ ที่เจอในข้อมูลจริง
        const SHIFTS = ['กะเช้า', 'กะกลาง', 'กะดึก'];
        const extra = [...new Set(_users.map(u => u.allowed_shift).filter(Boolean))].filter(x => SHIFTS.indexOf(x) < 0);
        const sSel = $('baShift');
        if (sSel) {
            const keep = sSel.value;
            sSel.innerHTML = '<option value="all">ทุกกะ</option>' +
                SHIFTS.concat(extra).map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
            if (keep) sSel.value = keep;
        }

        const depts = [...new Set(_users.map(u => u.department).filter(Boolean))].sort();
        fill($('baDept'), depts, 'ทุกแผนก');
        renderDeptBoxes(depts);
        fill($('baTeam'), [...new Set(_users.map(u => u.team).filter(Boolean))].sort(), 'ทุกเว็บ');
    }
    function renderDeptBoxes(depts) {
        const mk = (host, picked) => {
            if (!$(host)) return;
            $(host).innerHTML = depts.map(d => {
                const on = picked.indexOf(d) > -1;
                return `<label class="ba-dept ${on ? 'on' : ''}">
                    <input type="checkbox" value="${esc(d)}" ${on ? 'checked' : ''}
                        onchange="this.parentNode.classList.toggle('on', this.checked); baApplyDepts();">
                    ${esc(d)}</label>`;
            }).join('') || '<span class="text-[11px] text-gray-500">ยังไม่มีข้อมูลแผนก</span>';
        };
        mk('baSkipDepts', _skipDepts);
        mk('baNoSlotDepts', _noSlotDepts);
        updateSettingsNote();
    }

    function updateSettingsNote() {
        const n = $('baSettingsNote');
        if (!n) return;
        const a = _skipDepts.length ? `ไม่ตรวจ ${_skipDepts.join(', ')}` : '';
        const b = _noSlotDepts.length ? `ไม่เทียบรอบจอง ${_noSlotDepts.join(', ')}` : '';
        n.textContent = [a, b].filter(Boolean).join(' · ') || 'ตรวจทุกแผนก';
    }

    // ติ๊กแล้วเห็นผลทันที (ยังไม่บันทึกจนกว่าจะกดปุ่ม)
    window.baApplyDepts = function () {
        _skipDepts   = [].slice.call(document.querySelectorAll('#baSkipDepts input:checked')).map(x => x.value);
        _noSlotDepts = [].slice.call(document.querySelectorAll('#baNoSlotDepts input:checked')).map(x => x.value);
        updateSettingsNote();
        window.baCompute();
    };

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
        const d = dateVal();
        const { data, error } = await appDB.from('break_punches')
            .select('punch_date, tg_user_id, tg_name, category, started_at, ended_at, duration_sec, limit_min, is_open, created_at')
            .in('punch_date', [d, addDays(d, 1)])      // กะดึกข้ามเที่ยงคืน ต้องดึงวันถัดไปมาด้วย
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

    // ── ตารางจองพัก (ตาราง schedules ของหน้า "ลงเวลากินข้าว") ──
    const slotRange = sl => {
        const m = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/.exec(String(sl || ''));
        if (!m) return null;
        let a = (+m[1]) * 3600 + (+m[2]) * 60, b = (+m[3]) * 3600 + (+m[4]) * 60;
        if (b <= a) b += 86400;                       // รอบคร่อมเที่ยงคืน
        return { a, b, text: `${m[1].padStart(2,'0')}:${m[2]}-${m[3].padStart(2,'0')}:${m[4]}` };
    };

    async function loadBooked() {
        _booked = {};
        if (typeof appDB === 'undefined') return;
        try {
            const { data } = await appDB.from('schedules')
                .select('staff_name, time_slot, shift_name, department, team')
                .eq('work_date', dateVal());
            (data || []).forEach(r => {
                const k = norm(r.staff_name);
                if (!k || !r.time_slot) return;
                const rg = slotRange(r.time_slot);
                if (rg) (_booked[k] = _booked[k] || []).push(rg);
            });
            Object.keys(_booked).forEach(k => _booked[k].sort((x, y) => x.a - y.a));
        } catch (e) { console.warn('[break_audit] โหลดตารางจองพักไม่ได้', e); }
    }

    // ── ตารางจัดหน้าที่ของวันนั้น (settings: duty_roster_แผนก_วันที่_กะ) ──
    //    เว็บที่แต่ละคนเฝ้า เปลี่ยนทุกวัน จึงต้องอ่านจากตรงนี้ ไม่ใช่ users.team
    async function loadDuty() {
        _duty = {}; _dutyOf = {}; _dutyMain = {}; _dutySec = {};
        if (typeof appDB === 'undefined') return;
        try {
            const { data } = await appDB.from('settings')
                .select('key, value')
                .like('key', `duty_roster_%_${dateVal()}_%`);
            (data || []).forEach(row => {
                const parts = String(row.key).split('_');       // duty_roster_{dept}_{date}_{shift}
                if (parts.length < 5) return;
                const dept = parts[2], shift = parts[parts.length - 1];
                let roster;
                try { roster = typeof row.value === 'string' ? JSON.parse(row.value) : row.value; } catch (e) { return; }
                const add = (team, name, role) => {
                    if (!team || !name || String(name).includes('ขาดคน')) return;
                    const k = dept + '|' + shift + '|' + team;
                    (_duty[k] = _duty[k] || new Set()).add(name);
                    const bucket = role === 'sec' ? _dutySec : _dutyMain;
                    (bucket[k] = bucket[k] || new Set()).add(name);
                    const nk = norm(name);
                    _dutyOf[nk] = _dutyOf[nk] || [];
                    if (!_dutyOf[nk].some(x => x.dept === dept && x.shift === shift && x.team === team)) {
                        _dutyOf[nk].push({ dept, shift, team });
                    }
                };
                Object.keys(roster || {}).forEach(team => {
                    (roster[team] || []).forEach(u => {
                        if (!u || !u.username) return;
                        add(team, u.username, 'main');                                    // เว็บหลัก
                        if (u.secondary_team) add(u.secondary_team, u.username, 'sec');    // เว็บรอง ก็ต้องเฝ้าเหมือนกัน
                    });
                });
            });
        } catch (e) { console.warn('[break_audit] โหลดตารางจัดหน้าที่ไม่ได้', e); }

    }

    // คนนี้อยู่กะที่เลือกไว้ไหม — ดูจากกะประจำของพนักงานก่อน ถ้าไม่มีค่อยดูตารางเวรวันนั้น
    function inShift(u, fallbackName) {
        const want = ($('baShift') && $('baShift').value) || 'all';
        if (want === 'all') return true;
        if (u && u.allowed_shift) return u.allowed_shift === want;
        return (_dutyOf[norm((u && u.username) || fallbackName)] || []).some(x => x.shift === want);
    }

    // ── คำนวณ ────────────────────────────────────────────
    function build(records, c) {
        const now = nowSec(), by = {};
        records.forEach(r => {
            if (!by[r.uid]) by[r.uid] = { id: r.id, name: r.name, dept: r.dept, team: r.team, sessions: [] };
            const live = r.end === null;
            const nowT = nowSec() + (nowSec() < c.dayStart ? 86400 : 0);
            let dur = live ? Math.max(0, nowT - r.start) : (r.dur != null ? r.dur : Math.max(0, r.end - r.start));
            by[r.uid].sessions.push({ cat: r.cat, kind: kindOf(r.cat), start: r.start, end: r.start + dur, dur, live,
                                      botReset: r.botReset, noBack: r.noBack,
                                      limit: r.limit, overLimit: r.limit ? dur > r.limit * 60 : false });
            if (!by[r.uid].booked) by[r.uid].booked = _booked[norm(r.name)] || [];
        });

        return Object.keys(by).map(k => {
            const p = by[k];
            p.sessions.sort((a, b) => a.start - b.start);
            p.total = 0; p.meal = 0; p.live = false;
            p.overLimit = 0; p.botReset = 0; p.noBack = 0;
            p.byKind = { meal: {n:0,sec:0}, heavy: {n:0,sec:0}, light: {n:0,sec:0}, other: {n:0,sec:0} };
            p.sessions.forEach(s => {
                p.total += s.dur;
                if (s.kind === 'meal') p.meal++;
                if (s.live) p.live = true;
                if (s.overLimit) p.overLimit++;
                if (s.botReset) p.botReset++;
                if (s.noBack) p.noBack++;
                p.byKind[s.kind].n++; p.byKind[s.kind].sec += s.dur;
            });
            p.firstOut = p.sessions.length ? p.sessions[0].start : null;
            p.lastBack = p.sessions.length ? p.sessions[p.sessions.length - 1].end : null;

            // เทียบกับรอบที่จองไว้ (เช็คเฉพาะหมวดกินข้าว)
            p.booked = p.booked || [];
            p.offSlot = 0;
            p.checkSlot = _noSlotDepts.indexOf(p.dept || '') < 0;
            p.lateSlot = 0;
            p.sessions.forEach(s => {
                if (!p.checkSlot || s.kind !== 'meal') return;
                if (!p.booked.length) { s.slotNote = 'ไม่ได้จองรอบพัก'; s.offSlot = true; p.offSlot++; return; }
                // รอบที่จองต้องเลื่อนเข้าเส้นเวลาเดียวกับรอบที่กดจริง (กะดึกข้ามเที่ยงคืน)
                const slots = p.booked.map(b => {
                    const off = b.a < c.dayStart ? 86400 : 0;
                    return { a: b.a + off, b: b.b + off, text: b.text };
                });
                let best = slots[0], bestDiff = Math.abs(s.start - best.a);
                slots.forEach(b => { const d = Math.abs(s.start - b.a); if (d < bestDiff) { best = b; bestDiff = d; } });
                const diff = s.start - best.a;                       // + = ออกช้ากว่าที่จอง
                const mins = Math.round(Math.abs(diff) / 60);
                if (Math.abs(diff) <= c.late) { s.slotNote = 'ตรงรอบ ' + best.text; s.offSlot = false; }
                else {
                    s.offSlot = true; s.lateSlot = true; p.offSlot++; p.lateSlot++;
                    s.slotNote = (diff > 0 ? 'ออกช้ากว่ารอบที่จอง ' : 'ออกก่อนรอบที่จอง ') + mins + ' นาที (จอง ' + best.text + ')';
                }
            });

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

            p.overCap  = p.total > c.cap && !p.botReset;   // ถ้ามีรอบที่ค้างเพราะบอทรีเซ็ต เวลาไม่แม่น ไม่ฟันธงว่าเกิน
            p.overMeal = p.meal > c.mealMax;
            // เหลือง = กดกลับที่นั่งแล้วกดออกต่อทันที (ไม่ว่าหมวดอะไร) อย่างเดียวเท่านั้น
            p.state = (p.overCap || p.overMeal || p.lateSlot) ? 'over'
                    : p.chains.length ? 'near' : 'ok';
            return p;
        }).sort((a, b) => {
            const rank = { over: 0, near: 1, ok: 2 };
            return rank[a.state] !== rank[b.state] ? rank[a.state] - rank[b.state] : b.total - a.total;
        });
    }

    window.baCompute = function () {
        const c = cfg(), dept = $('baDept').value, team = $('baTeam').value;
        const unknown = {}, hit = {}, use = [];

        const d0 = dateVal(), d1 = addDays(d0, 1);
        const ds = c.dayStart;
        const resetTs = c.botReset === null ? null : (c.botReset + (c.botReset < ds ? 86400 : 0));
        const isToday = d0 === workDateNow(ds);
        const nowTs = nowSec() + (nowSec() < ds ? 86400 : 0);

        _rows.forEach(r => {
            // อยู่ในวันทำงานที่เลือกไหม (ก่อนเวลาเริ่มวัน = ยังเป็นของเมื่อวาน)
            const t = toSec(r.started_at);
            if (t === null) return;
            let off = null;
            if (r.punch_date === d0 && t >= ds) off = 0;
            else if (r.punch_date === d1 && t < ds) off = 86400;
            if (off === null) return;

            const u = findUser(r.tg_user_id, r.tg_name);
            if (!u) { (unknown[r.tg_user_id] = unknown[r.tg_user_id] || { id: r.tg_user_id, name: r.tg_name, n: 0 }).n++; return; }
            if (_skipDepts.indexOf(u.department || '') > -1) return;
            if (dept !== 'all' && (u.department || '') !== dept) return;
            if (team !== 'all' && (u.team || '') !== team) return;
            if (!inShift(u, r.tg_name)) return;

            const start = t + off;
            let end = null, dur = null, botReset = false, noBack = false;

            if (!r.is_open) {
                let e = toSec(r.ended_at);
                if (e !== null) { e += off; if (e < start) e += 86400; }
                end = e; dur = r.duration_sec;
            } else if (isToday && (resetTs === null || nowTs <= resetTs)) {
                end = null;                                   // ยังไม่กลับจริงๆ เวลาเดินอยู่
            } else if (resetTs !== null && start < resetTs) {
                end = resetTs; dur = resetTs - start; botReset = true;   // บอทรีเซ็ตไปแล้ว กดกลับไม่ได้
            } else {
                end = start; dur = 0; noBack = true;          // ค้างไว้ ไม่รู้เวลาจริง
            }

            hit[u.id] = true;
            use.push({
                uid: u.id, id: String(u.telegram_id || r.tg_user_id), name: u.username || r.tg_name,
                dept: u.department || '', team: u.team || '', cat: r.category || 'อื่นๆ',
                start, end, dur, limit: r.limit_min, botReset, noBack
            });
        });

        _people = build(use, c);
        _unknown = Object.values(unknown).sort((a, b) => b.n - a.n);

        if ($('baAbsent').checked) {
            _users.forEach(u => {
                if (hit[u.id] || !u.telegram_id) return;
                if (_skipDepts.indexOf(u.department || '') > -1) return;
                if (!inShift(u)) return;
                if (dept !== 'all' && (u.department || '') !== dept) return;
                if (team !== 'all' && (u.team || '') !== team) return;
                _people.push({
                    id: String(u.telegram_id), name: u.username || '-', dept: u.department || '', team: u.team || '',
                    sessions: [], total: 0, meal: 0, live: false, chains: [], inChain: {}, chainMax: 0,
                    byKind: { meal:{n:0,sec:0}, heavy:{n:0,sec:0}, light:{n:0,sec:0}, other:{n:0,sec:0} },
                    firstOut: null, lastBack: null, overLimit: 0, offSlot: 0, lateSlot: 0, botReset: 0, noBack: 0, booked: _booked[norm(u.username)] || [],
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

    // ── หน้างานตอนนี้: ใครออกพร้อมกันกี่คน เทียบเพดานของเว็บ ──
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
            ['near', 'กดต่อเนื่อง', counts.near, 'near'],
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
            if (p.lateSlot)      chips.push(`<span class="ba-chip bad">ออกผิดเวลาที่จอง ${p.lateSlot} รอบ</span>`);
            if (p.offSlot - (p.lateSlot || 0) > 0) chips.push(`<span class="ba-chip warn">ไม่ได้จองรอบพัก ${p.offSlot - p.lateSlot} รอบ</span>`);
            if (p.checkSlot !== false && p.booked && p.booked.length) chips.push(`<span class="ba-chip">จองไว้ ${p.booked.map(b => b.text).join(', ')}</span>`);
            if (p.live)          chips.push('<span class="ba-chip live">ตอนนี้ยังไม่กลับที่นั่ง</span>');
            if (p.botReset)      chips.push(`<span class="ba-chip">ค้างเพราะบอทรีเซ็ต ${p.botReset} รอบ</span>`);
            if (p.noBack)        chips.push(`<span class="ba-chip warn">ไม่มีการกดกลับ ${p.noBack} รอบ</span>`);

            const when = p.sessions.length
                ? `ออกครั้งแรก ${clock(p.firstOut)} · ${p.live ? 'ออกล่าสุด ' + clock(p.sessions[p.sessions.length-1].start) : 'กลับล่าสุด ' + clock(p.lastBack)}`
                : '';

            // ตารางรายรอบ
            const rows = p.sessions.map((s, i) => `
                <tr class="${p.inChain[i] ? 'linked' : ''}">
                    <td class="n" style="color:#64748b">${i + 1}</td>
                    <td><span class="ba-dot" style="background:${KIND[s.kind].color}"></span>${esc(s.cat || '-')}</td>
                    <td class="n">${clock(s.start)}</td>
                    <td class="n">${s.live ? 'ยังไม่กลับ' : s.noBack ? '—' : clock(s.end)}</td>
                    <td class="n" ${s.overLimit ? 'style="color:#fca5a5;font-weight:800"' : ''}>${hms(s.dur)}</td>
                    <td class="n" style="color:#64748b">${s.limit ? s.limit + ' น.' : '—'}</td>
                    <td${s.lateSlot ? ' style="color:#fca5a5;font-weight:700"' : ''}>${[p.inChain[i] ? 'ต่อจากรอบก่อน' : '', s.overLimit ? 'เกินเวลาที่บอทให้' : '', s.botReset ? 'บอทรีเซ็ตตอนตี 1 · นับถึงตรงนั้น' : '', s.noBack ? 'ไม่มีการกดกลับ · นับเวลาไม่ได้' : '', s.slotNote || ''].filter(Boolean).join(' · ')}</td>
                </tr>`).join('');

            const spots = _dutyOf[norm(p.name)] || [];
            const dutyTeams = [...new Set(spots.map(x => x.team))];
            const meta = [p.dept, dutyTeams.length ? 'หน้างานวันนี้ ' + dutyTeams.join('+') : (p.team || ''), p.id].filter(Boolean).join(' · ');
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
    window.baReload = async function () { await load(); await loadBooked(); await loadDuty(); window.baCompute(); };
    window.baShiftDate = function (n) {
        const d = new Date(dateVal() + 'T12:00:00');
        d.setDate(d.getDate() + n);
        $('baDate').value = iso(d);
        window.baReload();
    };

    // ── ส่งออก Excel ───────────────────────────────────
    const KIND_NAME = { meal: 'กินข้าว', heavy: 'ปวดหนัก', light: 'ปวดน้อย/สูบบุหรี่', other: 'อื่นๆ' };

    function sortedForExport() {
        return _people.slice().sort((a, b) => {
            const d = String(a.dept || 'zzz').localeCompare(String(b.dept || 'zzz'), 'th');
            if (d !== 0) return d;
            const t = String(a.team || 'zzz').localeCompare(String(b.team || 'zzz'), 'th');
            if (t !== 0) return t;
            return b.total - a.total;
        });
    }
    const statusText = p => p.absent ? 'ไม่ได้กดเลย'
                       : p.state === 'over' ? 'เกินเกณฑ์'
                       : p.state === 'near' ? 'ต้องดู' : 'ปกติ';

    window.baExport = function () {
        if (!_people.length) return;
        if (typeof window.loadExcelLibrary !== 'function' || typeof ExcelJS === 'undefined' && !window.loadExcelLibrary) return baExportCsv();
        window.loadExcelLibrary(async function () {
            try {
                if (typeof Swal !== 'undefined') Swal.fire({ title: 'กำลังสร้างไฟล์ Excel...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                const c = cfg(), d = dateVal(), list = sortedForExport();
                const wb = new ExcelJS.Workbook();

                const HEAD_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
                const headStyle = row => row.eachCell(cell => {
                    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
                    cell.fill = HEAD_FILL;
                    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                    cell.border = { bottom: { style: 'thin', color: { argb: 'FF94A3B8' } } };
                });

                // ══ ชีท 1: สรุปรายคน ══
                const s1 = wb.addWorksheet('สรุปรายคน', { views: [{ state: 'frozen', ySplit: 1 }] });
                s1.columns = [
                    { header: 'วันที่',        key: 'date',  width: 12 },
                    { header: 'แผนก',          key: 'dept',  width: 9  },
                    { header: 'เว็บ',           key: 'team',  width: 10 },
                    { header: 'ชื่อ',            key: 'name',  width: 18 },
                    { header: 'รวมทั้งวัน',     key: 'total', width: 12 },
                    { header: 'เพดาน',          key: 'cap',   width: 10 },
                    { header: 'เกินไป',         key: 'over',  width: 11 },
                    { header: 'รวมกี่รอบ',      key: 'n',     width: 10 },
                    { header: 'กินข้าว\n(รอบ)',  key: 'mn',    width: 9  },
                    { header: 'เวลากินข้าว',    key: 'mt',    width: 12 },
                    { header: 'ปวดหนัก\n(รอบ)', key: 'hn',    width: 9  },
                    { header: 'เวลาปวดหนัก',   key: 'ht',    width: 12 },
                    { header: 'ปวดน้อย\n(รอบ)', key: 'ln',    width: 9  },
                    { header: 'เวลาปวดน้อย',   key: 'lt',    width: 12 },
                    { header: 'กดต่อเนื่อง\n(ชุด)', key: 'ch', width: 11 },
                    { header: 'เกินเวลาบอท\n(รอบ)', key: 'ol', width: 11 },
                    { header: 'ออกครั้งแรก',   key: 'first', width: 12 },
                    { header: 'กลับล่าสุด',     key: 'last',  width: 12 },
                    { header: 'สถานะ',          key: 'st',    width: 12 }
                ];
                headStyle(s1.getRow(1));
                s1.getRow(1).height = 30;

                list.forEach(p => {
                    const r = s1.addRow({
                        date: d, dept: p.dept || '-', team: String(p.team || '-'), name: String(p.name || '-'),
                        total: hms(p.total), cap: hms(c.cap), over: p.overCap ? hms(p.total - c.cap) : '',
                        n: p.sessions.length,
                        mn: p.byKind.meal.n,  mt: p.byKind.meal.n  ? hms(p.byKind.meal.sec)  : '',
                        hn: p.byKind.heavy.n, ht: p.byKind.heavy.n ? hms(p.byKind.heavy.sec) : '',
                        ln: p.byKind.light.n, lt: p.byKind.light.n ? hms(p.byKind.light.sec) : '',
                        ch: p.chains.length, ol: p.overLimit,
                        first: p.firstOut != null ? clock(p.firstOut) : '',
                        last:  p.live ? 'ยังไม่กลับ' : (p.lastBack != null ? clock(p.lastBack) : ''),
                        st: statusText(p)
                    });
                    r.eachCell((cell, col) => {
                        cell.alignment = { horizontal: col <= 4 ? 'left' : 'center', vertical: 'middle' };
                        cell.border = { bottom: { style: 'hair', color: { argb: 'FFCBD5E1' } } };
                    });
                    if (p.state === 'over') {
                        r.getCell('st').font = { bold: true, color: { argb: 'FFB91C1C' } };
                        r.getCell('total').font = { bold: true, color: { argb: 'FFB91C1C' } };
                        r.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; });
                    } else if (p.state === 'near') {
                        r.getCell('st').font = { bold: true, color: { argb: 'FFB45309' } };
                        r.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; });
                    } else if (p.absent) {
                        r.eachCell(cell => { cell.font = { color: { argb: 'FF94A3B8' } }; });
                    }
                });
                s1.autoFilter = { from: 'A1', to: { row: 1, column: s1.columns.length } };

                // ══ ชีท 2: รายรอบ แยกเป็นคนๆ ══
                const s2 = wb.addWorksheet('รายรอบแต่ละคน', { views: [{ state: 'frozen', ySplit: 1 }] });
                s2.columns = [
                    { header: 'แผนก',   key: 'dept',  width: 9  },
                    { header: 'เว็บ',    key: 'team',  width: 10 },
                    { header: 'ชื่อ',     key: 'name',  width: 18 },
                    { header: 'รอบที่', key: 'i',     width: 8  },
                    { header: 'หมวด',   key: 'cat',   width: 20 },
                    { header: 'ออกตอน', key: 'out',   width: 11 },
                    { header: 'กลับตอน',key: 'back',  width: 11 },
                    { header: 'ใช้ไป',   key: 'dur',   width: 11 },
                    { header: 'บอทให้\n(นาที)', key: 'lim', width: 10 },
                    { header: 'หมายเหตุ', key: 'note', width: 34 }
                ];
                headStyle(s2.getRow(1));
                s2.getRow(1).height = 30;

                list.forEach(p => {
                    if (!p.sessions.length) return;
                    // หัวชื่อคน คั่นให้อ่านง่าย
                    const h = s2.addRow({ dept: p.dept || '-', team: String(p.team || '-'), name: String(p.name || '-'),
                                          i: '', cat: `รวม ${p.sessions.length} รอบ · ${hms(p.total)}`, note: statusText(p) });
                    h.eachCell(cell => {
                        cell.font = { bold: true, color: { argb: 'FF0F172A' } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
                        cell.alignment = { horizontal: 'left', vertical: 'middle' };
                    });
                    p.sessions.forEach((ss, i) => {
                        const note = [p.inChain[i] ? 'ต่อจากรอบก่อน' : '', ss.overLimit ? 'เกินเวลาที่บอทให้' : ''].filter(Boolean).join(' · ');
                        const r = s2.addRow({
                            dept: '', team: '', name: '', i: i + 1,
                            cat: String(ss.cat || '-'),
                            out: clock(ss.start),
                            back: ss.live ? 'ยังไม่กลับ' : clock(ss.end),
                            dur: hms(ss.dur),
                            lim: ss.limit || '',
                            note: note
                        });
                        r.eachCell((cell, col) => {
                            cell.alignment = { horizontal: (col === 5 || col === 10) ? 'left' : 'center', vertical: 'middle' };
                            cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } };
                        });
                        if (ss.overLimit) r.getCell('dur').font = { bold: true, color: { argb: 'FFB91C1C' } };
                        if (p.inChain[i])  r.getCell('note').font = { color: { argb: 'FFB45309' } };
                    });
                    s2.addRow({});   // เว้นบรรทัดคั่นคน
                });

                const buf = await wb.xlsx.writeBuffer();
                const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
                const a = document.createElement('a');
                a.href = url; a.download = `ตรวจเวลาลุกจากที่นั่ง-${d}.xlsx`; document.body.appendChild(a); a.click(); a.remove();
                setTimeout(() => URL.revokeObjectURL(url), 2000);
                if (typeof Swal !== 'undefined') Swal.close();
            } catch (e) {
                console.error('[break_audit] export', e);
                if (typeof Swal !== 'undefined') Swal.fire('ผิดพลาด', 'สร้างไฟล์ไม่สำเร็จ: ' + e.message, 'error');
            }
        });
    };

    // สำรอง: ถ้าโหลด ExcelJS ไม่ได้ ใช้ CSV แทน
    function baExportCsv() {
        const c = cfg(), d = dateVal();
        const head = ['วันที่','แผนก','เว็บ','ชื่อ','รวมทั้งวัน','เพดาน','เกินไป','รวมกี่รอบ','กินข้าว(รอบ)','ปวดหนัก(รอบ)','ปวดน้อย(รอบ)','กดต่อเนื่อง(ชุด)','ออกครั้งแรก','กลับล่าสุด','สถานะ'];
        const lines = [head.join(',')].concat(sortedForExport().map(p => [
            d, p.dept || '', p.team || '', `"${p.name}"`, hms(p.total), hms(c.cap),
            p.overCap ? hms(p.total - c.cap) : '', p.sessions.length,
            p.byKind.meal.n, p.byKind.heavy.n, p.byKind.light.n, p.chains.length,
            p.firstOut != null ? clock(p.firstOut) : '',
            p.live ? 'ยังไม่กลับ' : (p.lastBack != null ? clock(p.lastBack) : ''),
            statusText(p)
        ].join(',')));
        const url = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
        const a = document.createElement('a');
        a.href = url; a.download = `break-audit-${d}.csv`; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    // ── เริ่มหน้า ────────────────────────────────────────
    window.initBreakAudit = async function () {
        if (!$('baPage')) return;
        if (!$('baDate').value) $('baDate').value = iso(new Date());

        await loadRules();
        await loadUsers();
        await load();
        await loadBooked();
        await loadDuty();
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
