// ════════════════════════════════════════════════════════════════════
// 📦 discord/chatcount.js — แท็บ "นับแชท" ของหน้า Discord
// ตั้งรอบเวลา + ติ๊กห้อง Discord → botlink ส่งคำถามเข้าห้อง → พนักงานรีพลาย "MK8 15"
// → ครบทุกเว็บ → botlink ส่งสรุปตามแพทเทิร์นเข้ากลุ่ม Telegram (ผ่านบัญชี Telethon)
// ตาราง: chatcount_settings (เว็บ + รายชื่อห้องที่บอทส่งมา), chatcount_schedules, chatcount_rounds, chatcount_answers
// ⚠️ ลำดับโหลด (PAGE_SCRIPTS ใน global.js): ต้องมาหลัง discord/tts เพราะครอบ switchDiscordTab ต่อจากตัวนั้น
// สิทธิ์: ds_chatcount (ตั้งในหน้าสิทธิ์เมนู → เครื่องมือ DISCORD)
// ════════════════════════════════════════════════════════════════════
(function () {
    const ACTIVE = 'ds-tab ds-tab-active';
    const INACTIVE = 'ds-tab';
    const PERM = 'ds_chatcount';
    const $ = id => document.getElementById(id);
    const esc = v => window.dsEsc(v);
    const can = () => typeof window.canPerm === 'function' && window.canPerm(PERM);

    // แพทเทิร์นเริ่มต้น — ต้องตรงกับ DEFAULT_* ใน botlink/bot/chat_count.py
    const DEF = {
        ask: '📊 **นับแชท {รอบ}** · {วันที่}\nรีพลายข้อความนี้ บอกชื่อเว็บ + จำนวนแชท\nตัวอย่าง: `MK8 15`  `JL69 3`',
        report: '📊 นับแชท {วันที่} {รอบ}\n\n{รายการ}\n\nรวม {รวม} แชท',
        line: '{เว็บ} = {จำนวน}',
        missing: '{เว็บ} = ยังไม่ตอบ',
    };

    let _settings = { webs: [], channels: [], channels_updated_at: null };
    let _schedules = [];
    let _rounds = [];
    let _answers = {};      // round_id → [answers]
    let _tgGroups = [];
    let _sub = 'live';
    let _built = false;
    let _timer = null;

    // ── สไตล์กลาง (inline ไม่ต้องคอมไพล์ Tailwind ใหม่) ──────────────────
    const LB = 'display:block;font-size:11px;font-weight:800;letter-spacing:.4px;color:#94a3b8;margin-bottom:6px;';
    const FD = 'width:100%;box-sizing:border-box;padding:9px 12px;border-radius:10px;border:1.5px solid var(--k-line2);'
        + 'background:var(--k-field);color:var(--k-tx);font-size:13px;font-weight:600;outline:none;';
    const CARD = 'background:var(--k-panel2);border:1px solid var(--k-line);border-radius:14px;padding:14px;';
    const BTN = 'display:inline-flex;align-items:center;gap:4px;padding:6px 10px;border-radius:9px;font-size:12px;font-weight:800;cursor:pointer;border:1px solid var(--k-line2);background:var(--k-btn);color:var(--k-tx);';
    const BTN_MAIN = 'display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:10px;font-size:13px;font-weight:800;cursor:pointer;border:none;background:#0ea5e9;color:#fff;';
    const MI = s => `<span class="material-icons" style="font-size:16px">${s}</span>`;
    const CHIP = (bg, fg) => `display:inline-flex;align-items:center;gap:4px;padding:4px 9px;border-radius:99px;font-size:12px;font-weight:800;background:${bg};color:${fg};`;
    const SWAL = { background: '#1e293b', color: '#fff', confirmButtonColor: '#0ea5e9', cancelButtonColor: '#475569' };

    // ── ตัวช่วย ────────────────────────────────────────────────────────
    const thaiNow = () => new Date(Date.now() + 7 * 3600 * 1000);
    const thaiToday = () => thaiNow().toISOString().slice(0, 10);
    const thaiHHMM = () => thaiNow().toISOString().slice(11, 16);
    const thaiDate = d => { const [y, m, dd] = String(d).slice(0, 10).split('-'); return `${dd}/${m}/${Number(y) + 543}`; };
    const fmtTime = iso => iso ? new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }) : '';
    const render = (t, vals) => Object.keys(vals).reduce((s, k) => s.split('{' + k + '}').join(String(vals[k])), t || '');
    const webNames = () => (_settings.webs || []).map(w => typeof w === 'string' ? w : w.name).filter(Boolean);
    const chanName = id => { const c = (_settings.channels || []).find(x => String(x.id) === String(id)); return c ? c.name : id; };
    const normId = v => (window.normChatId ? window.normChatId(v) : String(v || '').replace(/^-/, ''));
    // รายชื่อกลุ่ม Telegram: ใช้ที่บอทส่งมา (ทุกกลุ่มที่บัญชีอยู่) ถ้ายังไม่มี ค่อยใช้กลุ่มจากแท็บเช็คอิน
    const tgList = () => (_settings.tg_groups && _settings.tg_groups.length)
        ? _settings.tg_groups.map(g => ({ id: String(g.id), name: g.name }))
        : _tgGroups.map(g => ({ id: String(g.chat_id), name: g.group_name }));
    const tgFind = id => { const n = normId(id); return n ? tgList().find(g => normId(g.id) === n) : null; };
    const tgName = id => { const g = tgFind(id); return g ? g.name : (id || '-'); };
    const chanKnown = id => (_settings.channels || []).some(x => String(x.id) === String(id));

    // คำนวณสถานะรอบ — ตรรกะเดียวกับ evaluate_round() ฝั่งบอท
    function evaluate(rnd, answers) {
        const latest = {};
        [...answers].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || a.id - b.id)
            .forEach(a => { latest[a.web + '|' + a.channel_id] = a; });
        const perWeb = {};
        Object.values(latest).forEach(a => { (perWeb[a.web] = perWeb[a.web] || []).push(a); });
        const resolved = rnd.resolved || {};
        const values = {}, conflicts = {};
        Object.entries(perWeb).forEach(([web, lst]) => {
            if (lst.length === 1) { values[web] = lst[0]; return; }
            const pick = lst.find(a => String(a.channel_id) === String(resolved[web]));
            if (pick) values[web] = pick; else conflicts[web] = lst;
        });
        const expected = rnd.expected_webs || [];
        const missing = expected.filter(w => !values[w] && !conflicts[w]);
        const total = expected.reduce((s, w) => s + (values[w] ? Number(values[w].count) || 0 : 0), 0);
        return { values, conflicts, missing, total, done: expected.filter(w => values[w]).length };
    }

    // ── สลับแท็บ (ครอบต่อจากตัวเดิม เหมือน tts.js) ─────────────────────
    const _origSwitch = window.switchDiscordTab;
    window.switchDiscordTab = function (tabName) {
        const panel = $('dsContent_chatcount');
        const btn = $('tabDsChatcount');
        if (tabName === 'chatcount') {
            if (!can()) { Swal.fire('ไม่มีสิทธิ์', 'คุณไม่มีสิทธิ์ใช้งานส่วนนี้ครับ', 'error'); return; }
            document.querySelectorAll('[id^="dsContent_"]').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('[id^="tabDs"]').forEach(b => { if (b.id !== 'tabDsChatcount') b.className = INACTIVE; });
            try { if (typeof spyInterval !== 'undefined' && spyInterval) clearInterval(spyInterval); } catch (e) {}
            try { if (typeof logInterval !== 'undefined' && logInterval) clearInterval(logInterval); } catch (e) {}
            if (panel) panel.classList.remove('hidden');
            if (btn) btn.className = ACTIVE;
            init();
            return;
        }
        stopTimer();
        if (panel) panel.classList.add('hidden');
        if (btn) btn.className = INACTIVE;
        if (typeof _origSwitch === 'function') return _origSwitch.apply(this, arguments);
    };

    function applyPerm() {
        const btn = $('tabDsChatcount');
        if (btn) btn.style.display = can() ? '' : 'none';
        if (!can()) { $('dsContent_chatcount')?.classList.add('hidden'); return; }
        const noAccess = $('discordNoAccessMessage');   // มีสิทธิ์แค่แท็บนี้ → เปิดแท็บนี้แทนข้อความ "ไม่มีสิทธิ์"
        if (noAccess) { noAccess.remove(); window.switchDiscordTab('chatcount'); }
    }
    const _origPerm = window.applyDiscordPermissions;
    window.applyDiscordPermissions = function () {
        const r = typeof _origPerm === 'function' ? _origPerm.apply(this, arguments) : undefined;
        applyPerm();
        return r;
    };
    applyPerm();

    function stopTimer() { if (_timer) { clearInterval(_timer); _timer = null; } }
    function startTimer() {
        stopTimer();
        _timer = setInterval(() => {
            const panel = $('dsContent_chatcount');
            if (!panel || panel.classList.contains('hidden') || _sub !== 'live') { stopTimer(); return; }
            if (!document.querySelector('.swal2-container')) window.ccLoadLive(true);   // ไม่รีเฟรชทับตอนเปิดหน้าต่างอยู่
        }, 10000);
        if (typeof window.registerPageInterval === 'function') window.registerPageInterval(_timer);
    }

    // ── โครงหน้า ─────────────────────────────────────────────────────
    function buildShell() {
        const panel = $('dsContent_chatcount');
        if (!panel || _built) return;
        _built = true;
        const subBtn = (id, icon, label) => `<button id="ccSub_${id}" onclick="window.ccSetSub('${id}')" style="${BTN}">${MI(icon)} ${label}</button>`;
        panel.innerHTML = `
            <div class="bg-slate-800 p-5 rounded-3xl border border-slate-700 shadow-lg">
                <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;margin-bottom:14px">
                    <h2 class="text-sky-400 font-black flex items-center gap-2 text-xl"><span class="material-icons">forum</span> นับแชท</h2>
                    <div style="display:flex;gap:6px;flex-wrap:wrap">
                        ${subBtn('live', 'monitoring', 'รอบวันนี้')}
                        ${subBtn('schedules', 'schedule', 'ตั้งเวลา & แพทเทิร์น')}
                        ${subBtn('webs', 'language', 'รายชื่อเว็บ')}
                    </div>
                </div>
                <div id="ccView_live"></div>
                <div id="ccView_schedules" style="display:none"></div>
                <div id="ccView_webs" style="display:none"></div>
            </div>`;

        $('ccView_live').innerHTML = `
            <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px">
                <input type="date" id="ccLiveDate" onchange="window.ccLoadLive()" style="${FD}width:auto">
                <button onclick="window.ccLoadLive()" style="${BTN}">${MI('refresh')} รีเฟรช</button>
                <span style="font-size:12px;color:var(--k-mute)">อัปเดตเองทุก 10 วินาที</span>
            </div>
            <div id="ccLiveList" style="display:flex;flex-direction:column;gap:12px"></div>`;
        $('ccLiveDate').value = thaiToday();

        $('ccView_schedules').innerHTML = `
            <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px">
                <div id="ccChanInfo" style="font-size:12px;color:var(--k-mute)"></div>
                <div style="display:flex;gap:6px">
                    <button onclick="window.ccLoadSchedules()" style="${BTN}">${MI('refresh')} รีเฟรช</button>
                    <button onclick="window.ccEditSchedule()" style="${BTN_MAIN}">${MI('add')} เพิ่มรอบเวลา</button>
                </div>
            </div>
            <div id="ccScheduleList" style="display:flex;flex-direction:column;gap:10px"></div>`;
    }

    async function init() {
        buildShell();
        await loadBase();
        window.ccSetSub(_sub);
    }

    window.ccSetSub = function (sub) {
        _sub = sub;
        ['live', 'schedules', 'webs'].forEach(s => {
            $('ccView_' + s).style.display = s === sub ? '' : 'none';
            const b = $('ccSub_' + s);
            b.style.background = s === sub ? '#0ea5e9' : 'var(--k-btn)';
            b.style.color = s === sub ? '#fff' : 'var(--k-tx)';
        });
        stopTimer();
        if (sub === 'live') { window.ccLoadLive(); startTimer(); }
        else if (sub === 'schedules') window.ccLoadSchedules();
        else renderWebs();
    };

    async function loadBase() {
        try {
            const [s, g] = await Promise.all([
                appDB.from('chatcount_settings').select('*').eq('id', 1).maybeSingle(),
                appDB.from('telegram_groups').select('group_name, chat_id, active').order('group_name'),
            ]);
            if (s.error) throw s.error;
            _settings = s.data || { webs: [], channels: [] };
            _tgGroups = (g.data || []).filter(x => x.chat_id);
        } catch (e) {
            console.error('[ChatCount] load base:', e);
            Swal.fire({ ...SWAL, icon: 'error', title: 'โหลดตั้งค่าไม่ได้', html: `${esc(e.message)}<br><small>ถ้ายังไม่ได้สร้างตาราง ให้รัน chatcount.sql ใน Supabase ก่อน</small>` });
        }
    }

    // ════════════════════════════════════════════════════════════════
    // 1) รอบวันนี้ (สถานะสด)
    // ════════════════════════════════════════════════════════════════
    window.ccLoadLive = async function (silent) {
        const list = $('ccLiveList');
        if (!list) return;
        if (!silent) list.innerHTML = `<div style="text-align:center;padding:30px;color:var(--k-mute)">กำลังโหลด...</div>`;
        try {
            const date = $('ccLiveDate').value || thaiToday();
            const { data, error } = await appDB.from('chatcount_rounds').select('*').eq('round_date', date).order('created_at', { ascending: false });
            if (error) throw error;
            _rounds = data || [];
            _answers = {};
            const ids = _rounds.map(r => r.id);
            if (ids.length) {
                const a = await appDB.from('chatcount_answers').select('*').in('round_id', ids).order('created_at', { ascending: true });
                if (a.error) throw a.error;
                (a.data || []).forEach(x => { (_answers[x.round_id] = _answers[x.round_id] || []).push(x); });
            }
            renderLive();
        } catch (e) {
            console.error('[ChatCount] load live:', e);
            if (!silent) list.innerHTML = `<div style="text-align:center;padding:30px;color:#f87171;font-weight:700">โหลดไม่ได้: ${esc(e.message)}</div>`;
        }
    };

    function renderLive() {
        const list = $('ccLiveList');
        if (!_rounds.length) {
            list.innerHTML = `<div style="text-align:center;padding:36px;color:var(--k-mute)"><span class="material-icons" style="font-size:42px;opacity:.4">forum</span><div style="margin-top:6px;font-weight:700">ยังไม่มีรอบในวันนี้</div><div style="font-size:12px">ตั้งรอบเวลาได้ที่ "ตั้งเวลา & แพทเทิร์น" หรือกด "ส่งเลยตอนนี้"</div></div>`;
            return;
        }
        list.innerHTML = _rounds.map(r => {
            const ev = evaluate(r, _answers[r.id] || []);
            const exp = r.expected_webs || [];
            let status;
            if (r.status === 'sent') status = `<span style="${CHIP('rgba(16,185,129,.15)', '#34d399')}">✅ ส่ง Telegram แล้ว ${fmtTime(r.sent_at)}</span>`;
            else if (r.status === 'cancelled') status = `<span style="${CHIP('rgba(148,163,184,.15)', '#94a3b8')}">ยกเลิกแล้ว</span>`;
            else if (!r.posted) status = `<span style="${CHIP('rgba(251,191,36,.15)', '#fbbf24')}">⏳ รอบอทส่งคำถาม</span>`;
            else if (r.force_send) status = `<span style="${CHIP('rgba(251,191,36,.15)', '#fbbf24')}">⏳ กำลังส่งเท่าที่มี</span>`;
            else status = `<span style="${CHIP('rgba(14,165,233,.15)', '#38bdf8')}">รอคำตอบ ${ev.done}/${exp.length}</span>`;

            const chips = exp.map(w => {
                const v = ev.values[w];
                if (v) return `<span title="${esc((v.channel_name || '') + ' · ' + (v.staff_name || v.discord_name || '') + ' · ' + fmtTime(v.created_at))}" style="${CHIP('rgba(16,185,129,.15)', '#34d399')}">${esc(w)} <b>${Number(v.count)}</b></span>`;
                if (ev.conflicts[w]) return `<span onclick="window.ccResolve(${Number(r.id)}, '${esc(w)}')" title="ตอบมาจากหลายห้อง — กดเพื่อเลือกค่าที่ถูก" style="${CHIP('rgba(251,191,36,.18)', '#fbbf24')}cursor:pointer">⚠️ ${esc(w)} ตอบซ้อน</span>`;
                return `<span style="${CHIP('rgba(148,163,184,.12)', '#94a3b8')}">${esc(w)} —</span>`;
            }).join(' ');

            const rooms = (r.messages || []).map(m => '#' + esc(m.channel_name || chanName(m.channel_id))).join(', ') || (r.posted ? '-' : 'ยังไม่ส่ง');
            const errs = [...(r.post_errors || []), ...(r.send_error && r.status === 'open' ? [r.send_error] : [])];
            const open = r.status === 'open';
            const btns = [
                open && r.posted ? `<button onclick="window.ccForceSend(${Number(r.id)})" style="${BTN}color:#fbbf24">${MI('send')} ส่งเท่าที่มี</button>` : '',
                r.report_text ? `<button onclick="window.ccShowReport(${Number(r.id)})" style="${BTN}">${MI('article')} ข้อความสรุป</button>` : '',
                (_answers[r.id] || []).length ? `<button onclick="window.ccShowAnswers(${Number(r.id)})" style="${BTN}">${MI('list')} คำตอบทั้งหมด</button>` : '',
                open ? `<button onclick="window.ccCancelRound(${Number(r.id)})" style="${BTN}color:#f87171">${MI('close')} ยกเลิก</button>` : '',
            ].join('');

            return `<div style="${CARD}">
                <div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;align-items:center">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                        <span style="font-weight:900;color:var(--k-tx-strong);font-size:15px">${esc(r.label || r.round_time || 'รอบ')}</span>
                        <span style="font-size:12px;color:var(--k-mute)">${esc(r.round_time || '')} · ${r.trigger === 'manual' ? 'ส่งเอง' : 'อัตโนมัติ'}</span>
                        ${status}
                    </div>
                    <div style="font-weight:900;color:#38bdf8">รวม ${ev.total} แชท</div>
                </div>
                <div style="font-size:12px;color:var(--k-mute);margin-top:4px">ห้อง: ${rooms} · Telegram: ${esc(tgName(r.telegram_chat_id))}</div>
                <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px">${chips || '<span style="color:var(--k-mute);font-size:12px">ไม่ได้เลือกเว็บ</span>'}</div>
                ${errs.length ? `<div style="font-size:12px;color:#f87171;margin-top:8px;font-weight:700">${errs.map(esc).join('<br>')}</div>` : ''}
                ${btns ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px">${btns}</div>` : ''}
            </div>`;
        }).join('');
    }

    window.ccResolve = async function (rid, web) {
        const r = _rounds.find(x => Number(x.id) === Number(rid));
        if (!r) return;
        const ev = evaluate(r, _answers[r.id] || []);
        const lst = ev.conflicts[web] || [];
        if (!lst.length) return;
        const opts = {};
        lst.forEach(a => { opts[a.channel_id] = `#${a.channel_name || a.channel_id}: ${a.count} แชท (${a.staff_name || a.discord_name || '-'} ${fmtTime(a.created_at)})`; });
        const res = await Swal.fire({
            ...SWAL, title: `${web} ตอบมาจากหลายห้อง`, text: 'เลือกห้องที่ถูกต้อง (เว็บหนึ่งอยู่ได้ห้องเดียว)',
            input: 'radio', inputOptions: opts, inputValidator: v => !v && 'เลือก 1 ค่า',
            showCancelButton: true, confirmButtonText: 'ใช้ค่านี้', cancelButtonText: 'ยกเลิก',
        });
        if (!res.isConfirmed) return;
        const fresh = await appDB.from('chatcount_rounds').select('resolved').eq('id', rid).maybeSingle();
        const resolved = { ...((fresh.data && fresh.data.resolved) || {}), [web]: res.value };
        const { error } = await appDB.from('chatcount_rounds').update({ resolved }).eq('id', rid);
        if (error) return Swal.fire({ ...SWAL, icon: 'error', title: 'บันทึกไม่ได้', text: error.message });
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'เลือกแล้ว · ถ้าครบ บอทจะส่ง Telegram ภายใน ~15 วินาที', showConfirmButton: false, timer: 2500 });
        window.ccLoadLive(true);
    };

    window.ccForceSend = async function (rid) {
        const r = _rounds.find(x => Number(x.id) === Number(rid));
        if (!r) return;
        const ev = evaluate(r, _answers[r.id] || []);
        const pending = [...ev.missing, ...Object.keys(ev.conflicts).filter(w => (r.expected_webs || []).includes(w))];
        const ok = await Swal.fire({
            ...SWAL, icon: 'warning', title: 'ส่งเท่าที่มีเลย?',
            html: pending.length ? `ยังไม่ครบ: <b>${pending.map(esc).join(', ')}</b><br><small>เว็บที่ยังไม่ตอบจะขึ้นตามแพทเทิร์น "ยังไม่ตอบ" · ตอบซ้อนจะใช้ค่าล่าสุด</small>` : 'ส่งสรุปเข้า Telegram ตอนนี้',
            showCancelButton: true, confirmButtonText: 'ส่งเลย', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#f59e0b',
        });
        if (!ok.isConfirmed) return;
        const { error } = await appDB.from('chatcount_rounds').update({ force_send: true }).eq('id', rid);
        if (error) return Swal.fire({ ...SWAL, icon: 'error', title: 'ผิดพลาด', text: error.message });
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'สั่งแล้ว · บอทจะส่งภายใน ~15 วินาที', showConfirmButton: false, timer: 2500 });
        window.ccLoadLive(true);
    };

    window.ccCancelRound = async function (rid) {
        const ok = await Swal.fire({ ...SWAL, icon: 'warning', title: 'ยกเลิกรอบนี้?', text: 'จะไม่ส่งสรุปเข้า Telegram และไม่รับรีพลายเพิ่ม', showCancelButton: true, confirmButtonText: 'ยกเลิกรอบ', cancelButtonText: 'ไม่', confirmButtonColor: '#ef4444' });
        if (!ok.isConfirmed) return;
        const { error } = await appDB.from('chatcount_rounds').update({ status: 'cancelled' }).eq('id', rid);
        if (error) return Swal.fire({ ...SWAL, icon: 'error', title: 'ผิดพลาด', text: error.message });
        window.ccLoadLive(true);
    };

    window.ccShowReport = function (rid) {
        const r = _rounds.find(x => Number(x.id) === Number(rid));
        if (!r) return;
        Swal.fire({ ...SWAL, title: r.status === 'sent' ? 'ข้อความที่ส่งเข้า Telegram' : 'ข้อความสรุป (ยังส่งไม่สำเร็จ)', width: 520, confirmButtonText: 'ปิด',
            html: `<pre style="text-align:left;white-space:pre-wrap;font-family:inherit;font-size:13px;background:var(--k-field);padding:12px;border-radius:10px">${esc(r.report_text)}</pre>` });
    };

    window.ccShowAnswers = function (rid) {
        const rows = (_answers[rid] || []).slice().reverse();
        Swal.fire({ ...SWAL, title: 'คำตอบทั้งหมดของรอบนี้', width: 640, confirmButtonText: 'ปิด',
            html: `<div style="max-height:60vh;overflow-y:auto;text-align:left">${rows.map(a => `
                <div style="border-bottom:1px solid var(--k-line);padding:8px 2px;font-size:13px">
                    <b>${esc(a.web)} = ${Number(a.count)}</b> <span style="color:var(--k-mute)">· #${esc(a.channel_name || a.channel_id)} · ${esc(a.staff_name || a.discord_name || '-')} · ${fmtTime(a.created_at)}</span>
                    <div style="color:var(--k-mute);font-size:12px;margin-top:2px">“${esc(a.raw_text || '')}”</div>
                </div>`).join('')}</div>` });
    };

    // ════════════════════════════════════════════════════════════════
    // 2) ตั้งเวลา & แพทเทิร์น
    // ════════════════════════════════════════════════════════════════
    window.ccLoadSchedules = async function () {
        const list = $('ccScheduleList');
        list.innerHTML = `<div style="text-align:center;padding:30px;color:var(--k-mute)">กำลังโหลด...</div>`;
        await loadBase();
        const info = $('ccChanInfo');
        const nCh = (_settings.channels || []).length;
        const nTg = (_settings.tg_groups || []).length;
        info.innerHTML = (nCh
            ? `ห้อง Discord ${nCh} ห้อง (อัปเดต ${fmtTime(_settings.channels_updated_at)})`
            : `<span style="color:#fbbf24">⚠️ ยังไม่มีรายชื่อห้องจากบอท — ตรวจว่า botlink รันอยู่</span>`)
            + ' · ' + (nTg
            ? `กลุ่ม Telegram ${nTg} กลุ่ม (อัปเดต ${fmtTime(_settings.tg_groups_updated_at)})`
            : `<span style="color:#fbbf24">⚠️ ยังไม่มีรายชื่อกลุ่ม Telegram จากบอท</span>`);
        try {
            const { data, error } = await appDB.from('chatcount_schedules').select('*').order('time', { ascending: true });
            if (error) throw error;
            _schedules = data || [];
            renderSchedules();
        } catch (e) {
            list.innerHTML = `<div style="text-align:center;padding:30px;color:#f87171;font-weight:700">โหลดไม่ได้: ${esc(e.message)}</div>`;
        }
    };

    function renderSchedules() {
        const list = $('ccScheduleList');
        if (!_schedules.length) {
            list.innerHTML = `<div style="text-align:center;padding:36px;color:var(--k-mute)"><span class="material-icons" style="font-size:42px;opacity:.4">schedule</span><div style="margin-top:6px;font-weight:700">ยังไม่มีรอบเวลา กด "เพิ่มรอบเวลา"</div></div>`;
            return;
        }
        list.innerHTML = _schedules.map(s => {
            const hasCh = (_settings.channels || []).length > 0;
            const rooms = (s.channel_ids || []).map(id => (!hasCh || chanKnown(id))
                ? '#' + esc(chanName(id))
                : `<span style="color:#f87171" title="ไม่พบห้องนี้ใน Discord แล้ว (อาจถูกลบ)">⚠️ ${esc(id)}</span>`).join(', ') || '<span style="color:#f87171">ยังไม่เลือกห้อง</span>';
            const tgOk = !(_settings.tg_groups || []).length || tgFind(s.telegram_chat_id);
            const tgText = tgOk ? `<b style="color:var(--k-tx2)">${esc(tgName(s.telegram_chat_id))}</b>`
                : `<b style="color:#f87171" title="บัญชี Telegram ไม่ได้อยู่ในกลุ่มนี้แล้ว">⚠️ ${esc(s.telegram_chat_id || '-')}</b>`;
            const badge = s.active
                ? `<span style="${CHIP('rgba(16,185,129,.15)', '#34d399')}">เปิดอยู่</span>`
                : `<span style="${CHIP('rgba(148,163,184,.15)', '#94a3b8')}">ปิดอยู่</span>`;
            return `<div style="${CARD}">
                <div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px">
                    <div style="min-width:0;flex:1">
                        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                            <span style="font-weight:900;font-size:20px;color:#38bdf8;font-family:monospace">${esc(s.time)}</span>
                            <span style="font-weight:900;color:var(--k-tx-strong)">${esc(s.name)}</span>${badge}
                        </div>
                        <div style="font-size:12px;color:var(--k-mute);margin-top:4px">ทุกวัน · ทุกเว็บ · ห้อง: ${rooms}</div>
                        <div style="font-size:12px;color:var(--k-mute);margin-top:2px">Telegram: ${tgText}</div>
                    </div>
                    <div style="display:flex;gap:6px;align-items:flex-start;flex-wrap:wrap">
                        <button onclick="window.ccSendNow(${Number(s.id)})" style="${BTN}color:#38bdf8">${MI('send')} ส่งเลยตอนนี้</button>
                        <button onclick="window.ccEditSchedule(${Number(s.id)})" style="${BTN}">${MI('edit')} แก้ไข</button>
                        <button onclick="window.ccEditSchedule(${Number(s.id)}, true)" style="${BTN}" title="คัดลอกเป็นรอบใหม่">${MI('content_copy')}</button>
                        <button onclick="window.ccToggleSchedule(${Number(s.id)})" style="${BTN}">${MI(s.active ? 'pause' : 'play_arrow')}</button>
                        <button onclick="window.ccDeleteSchedule(${Number(s.id)})" style="${BTN}color:#f87171">${MI('delete')}</button>
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    // ── หน้าต่างแก้รอบเวลา ───────────────────────────────────────────
    window.ccEditSchedule = async function (id, copy) {
        if (!can()) return;
        await loadBase();   // ดึงรายชื่อห้อง/กลุ่มล่าสุดทุกครั้งที่เปิดหน้าต่าง
        if (!webNames().length) {
            await Swal.fire({ ...SWAL, icon: 'info', title: 'ตั้งรายชื่อเว็บก่อน', text: 'ไปที่แท็บย่อย "รายชื่อเว็บ" แล้วกดบันทึกก่อนครับ' });
            return window.ccSetSub('webs');
        }
        const src = id ? _schedules.find(x => Number(x.id) === Number(id)) : null;
        const s = src ? { ...src } : {
            name: '', time: '', channel_ids: [], telegram_chat_id: '',
            ask_template: DEF.ask, report_template: DEF.report, line_template: DEF.line, missing_template: DEF.missing, active: true,
        };
        if (copy) { s.name = (s.name || '') + ' (สำเนา)'; s.time = ''; }
        const isEdit = src && !copy;
        const selCh = new Set((s.channel_ids || []).map(String));

        const field = (label, inner) => `<div style="text-align:left;margin-top:14px"><label style="${LB}">${label}</label>${inner}</div>`;
        const chk = (cls, val, on, label) => `<label style="display:inline-flex;align-items:center;gap:5px;padding:5px 9px;border:1px solid var(--k-line2);border-radius:9px;font-size:12px;font-weight:700;cursor:pointer;color:var(--k-tx)"><input type="checkbox" class="${cls}" value="${esc(val)}" ${on ? 'checked' : ''}> ${label}</label>`;

        // ห้องจัดกลุ่มตามหมวดใน Discord
        const groups = {};
        (_settings.channels || []).forEach(c => { (groups[c.category || 'ไม่มีหมวด'] = groups[c.category || 'ไม่มีหมวด'] || []).push(c); });
        const knownIds = new Set((_settings.channels || []).map(c => String(c.id)));
        const unknown = [...selCh].filter(x => !knownIds.has(x));
        const chHtml = Object.keys(groups).length ? Object.entries(groups).map(([cat, chs]) => `
            <div class="cc-chgroup" style="margin-bottom:8px">
                <div style="font-size:11px;font-weight:800;color:var(--k-mute);margin:4px 0">${esc(cat)}</div>
                <div style="display:flex;flex-wrap:wrap;gap:6px">${chs.map(c => `<span class="cc-chitem" data-name="${esc(String(c.name).toLowerCase())}">${chk('cc-ch', c.id, selCh.has(String(c.id)), (c.type === 'voice' ? '🔊 ' : '# ') + esc(c.name))}</span>`).join('')}</div>
            </div>`).join('') : `<div style="font-size:12px;color:#fbbf24">ยังไม่มีรายชื่อห้องจากบอท (รอบอทรันแล้วกดรีเฟรช) — ใส่ Channel ID เองด้านล่างได้</div>`;

        const curTg = tgFind(s.telegram_chat_id);
        const tgKnown = !!curTg;

        const res = await Swal.fire({
            ...SWAL, width: 820, showCancelButton: true, focusConfirm: false,
            title: isEdit ? 'แก้ไขรอบเวลา' : 'เพิ่มรอบเวลา', confirmButtonText: 'บันทึก', cancelButtonText: 'ยกเลิก',
            html: `<div style="max-height:68vh;overflow-y:auto;padding:2px 4px">
                <div style="display:flex;gap:10px;flex-wrap:wrap">
                    <div style="flex:2;min-width:200px">${field('ชื่อรอบ', `<input id="ccName" style="${FD}" value="${esc(s.name)}" placeholder="เช่น รอบ 14:00">`)}</div>
                    <div style="flex:1;min-width:120px">${field('เวลา (ไทย)', `<input id="ccTime" type="time" style="${FD}" value="${esc(s.time)}">`)}</div>
                </div>
                ${field(`ห้อง Discord ที่จะส่งคำถาม <span style="font-weight:500;color:var(--k-mute)">(ติ๊กได้หลายห้อง)</span>`,
                    `<input id="ccChSearch" oninput="window.ccFilterCh(this.value)" placeholder="🔍 ค้นหาห้อง" style="${FD}margin-bottom:8px">
                     <div style="max-height:220px;overflow-y:auto;border:1px solid var(--k-line);border-radius:10px;padding:8px">${chHtml}</div>
                     <input id="ccChExtra" style="${FD}margin-top:8px" value="${esc(unknown.join(', '))}" placeholder="Channel ID เพิ่มเติม (ถ้าห้องไม่อยู่ในรายการ) คั่นด้วย ,">`)}
                ${field(`ส่งสรุปเข้ากลุ่ม Telegram <span style="font-weight:500;color:var(--k-mute)">(${tgList().length} กลุ่มที่บัญชีอยู่)</span>`,
                    `<input id="ccTgSearch" oninput="window.ccFilterTg(this.value)" placeholder="🔍 ค้นหาชื่อกลุ่ม" style="${FD}margin-bottom:8px">
                     <select id="ccTgSel" size="6" style="${FD}height:auto;padding:4px">${tgOptions('', curTg ? curTg.id : '')}</select>
                     <input id="ccTgManual" style="${FD}margin-top:8px" value="${tgKnown ? '' : esc(s.telegram_chat_id || '')}" placeholder="หรือใส่ Chat ID เอง (กรณีกลุ่มไม่อยู่ในรายการ)">`)}

                <div style="text-align:left;margin-top:18px;padding-top:12px;border-top:1px solid var(--k-line);font-weight:900;color:var(--k-tx-strong)">📝 แพทเทิร์นข้อความ</div>
                ${field('ข้อความคำถามที่ส่งเข้าห้อง Discord <span style="font-weight:500;color:var(--k-mute)">ใช้ได้: {รอบ} {วันที่} {เวลา} {เว็บทั้งหมด}</span>',
                    `<textarea id="ccAsk" rows="4" oninput="window.ccPreview()" style="${FD}resize:vertical;font-family:monospace">${esc(s.ask_template || DEF.ask)}</textarea>`)}
                ${field('ข้อความสรุปที่ส่งเข้า Telegram <span style="font-weight:500;color:var(--k-mute)">ใช้ได้: {วันที่} {รอบ} {เวลา} {รายการ} {รวม} {ตอบแล้ว} {ทั้งหมด} {ยังไม่ตอบ}</span>',
                    `<textarea id="ccReport" rows="5" oninput="window.ccPreview()" style="${FD}resize:vertical;font-family:monospace">${esc(s.report_template || DEF.report)}</textarea>`)}
                <div style="display:flex;gap:10px;flex-wrap:wrap">
                    <div style="flex:1;min-width:220px">${field('1 บรรทัดใน {รายการ} ต่อ 1 เว็บ <span style="font-weight:500;color:var(--k-mute)">{เว็บ} {จำนวน} {ห้อง} {ผู้ตอบ}</span>',
                        `<input id="ccLine" oninput="window.ccPreview()" style="${FD}font-family:monospace" value="${esc(s.line_template || DEF.line)}">`)}</div>
                    <div style="flex:1;min-width:220px">${field('บรรทัดเว็บที่ยังไม่ตอบ (ตอนกดส่งเท่าที่มี) <span style="font-weight:500;color:var(--k-mute)">{เว็บ} · เว้นว่าง = ไม่แสดง</span>',
                        `<input id="ccMissing" oninput="window.ccPreview()" style="${FD}font-family:monospace" value="${esc(s.missing_template == null ? DEF.missing : s.missing_template)}">`)}</div>
                </div>
                <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">
                    <div style="flex:1;min-width:240px;text-align:left"><label style="${LB}">ตัวอย่างในห้อง Discord</label><pre id="ccPrevAsk" style="white-space:pre-wrap;font-family:inherit;font-size:12.5px;background:var(--k-field);padding:10px;border-radius:10px;margin:0;color:var(--k-tx)"></pre></div>
                    <div style="flex:1;min-width:240px;text-align:left"><label style="${LB}">ตัวอย่างใน Telegram</label><pre id="ccPrevReport" style="white-space:pre-wrap;font-family:inherit;font-size:12.5px;background:var(--k-field);padding:10px;border-radius:10px;margin:0;color:var(--k-tx)"></pre></div>
                </div>
                <label style="display:flex;align-items:center;gap:6px;margin-top:14px;font-size:13px;font-weight:700;color:var(--k-tx)"><input type="checkbox" id="ccActive" ${s.active !== false ? 'checked' : ''}> เปิดใช้งานรอบนี้</label>
            </div>`,
            didOpen: () => window.ccPreview(),
            preConfirm: () => {
                const name = $('ccName').value.trim();
                const time = $('ccTime').value.trim();
                if (!name) return Swal.showValidationMessage('ใส่ชื่อรอบ');
                if (!/^\d{2}:\d{2}$/.test(time)) return Swal.showValidationMessage('ใส่เวลา');
                const extra = $('ccChExtra').value.split(/[\s,]+/).map(x => x.trim()).filter(Boolean);
                if (extra.some(x => !/^\d{15,22}$/.test(x))) return Swal.showValidationMessage('Channel ID เพิ่มเติมต้องเป็นตัวเลข 15-22 หลัก');
                const channel_ids = [...new Set([...document.querySelectorAll('.cc-ch:checked')].map(x => x.value).concat(extra))];
                if (!channel_ids.length) return Swal.showValidationMessage('เลือกห้อง Discord อย่างน้อย 1 ห้อง');
                const tg = $('ccTgManual').value.trim() || $('ccTgSel').value;
                if (!tg) return Swal.showValidationMessage('เลือกกลุ่ม Telegram ปลายทาง');
                if (window.normChatId && !window.normChatId(tg)) return Swal.showValidationMessage('Chat ID Telegram ต้องเป็นตัวเลข');
                return {
                    name, time, days: [0, 1, 2, 3, 4, 5, 6], channel_ids, webs: [], telegram_chat_id: tg,   // ส่งทุกวัน ถามทุกเว็บ
                    ask_template: $('ccAsk').value, report_template: $('ccReport').value,
                    line_template: $('ccLine').value, missing_template: $('ccMissing').value,
                    active: $('ccActive').checked, updated_at: new Date().toISOString(),
                };
            },
        });
        if (!res.isConfirmed || !res.value) return;
        const q = isEdit
            ? appDB.from('chatcount_schedules').update(res.value).eq('id', src.id)
            : appDB.from('chatcount_schedules').insert([res.value]);
        const { error } = await q;
        if (error) return Swal.fire({ ...SWAL, icon: 'error', title: 'บันทึกไม่ได้', text: error.message });
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'บันทึกแล้ว', showConfirmButton: false, timer: 1500 });
        window.ccLoadSchedules();
    };

    function tgOptions(q, selected) {
        q = String(q || '').trim().toLowerCase();
        const list = tgList().filter(g => !q || String(g.name).toLowerCase().includes(q) || String(g.id).includes(q));
        if (!list.length) return `<option value="" disabled>ไม่พบกลุ่ม</option>`;
        return list.map(g => `<option value="${esc(g.id)}" ${normId(g.id) === normId(selected) ? 'selected' : ''}>${esc(g.name)}  (${esc(g.id)})</option>`).join('');
    }
    window.ccFilterTg = function (q) {
        const sel = $('ccTgSel');
        if (sel) sel.innerHTML = tgOptions(q, sel.value);
    };

    window.ccFilterCh = function (q) {
        q = String(q || '').trim().toLowerCase();
        document.querySelectorAll('.cc-chitem').forEach(el => { el.style.display = !q || el.dataset.name.includes(q) ? '' : 'none'; });
        document.querySelectorAll('.cc-chgroup').forEach(g => {
            const any = [...g.querySelectorAll('.cc-chitem')].some(el => el.style.display !== 'none');
            g.style.display = any ? '' : 'none';
        });
    };

    window.ccPreview = function () {
        const a = $('ccAsk'); if (!a) return;
        const sample = webNames();
        const name = $('ccName').value.trim() || 'รอบ 14:00';
        const time = $('ccTime').value || '14:00';
        const date = thaiDate(thaiToday());
        $('ccPrevAsk').textContent = render(a.value, { 'รอบ': name, 'วันที่': date, 'เวลา': time, 'เว็บทั้งหมด': sample.join(', ') });
        // ตัวอย่าง: ตอบแล้วทุกเว็บ ยกเว้นเว็บสุดท้าย (ให้เห็นบรรทัด "ยังไม่ตอบ" ด้วย)
        let total = 0;
        const lines = sample.map((w, i) => {
            if (i === sample.length - 1 && sample.length > 1) return $('ccMissing').value.trim() ? render($('ccMissing').value, { 'เว็บ': w }) : null;
            const n = 5 + ((i * 7) % 13); total += n;
            return render($('ccLine').value, { 'เว็บ': w, 'จำนวน': n, 'ห้อง': 'ห้อง ' + (i + 1), 'ผู้ตอบ': 'BOB' });
        }).filter(x => x != null);
        $('ccPrevReport').textContent = render($('ccReport').value, {
            'วันที่': date, 'รอบ': name, 'เวลา': time, 'รายการ': lines.join('\n'), 'รวม': total,
            'ตอบแล้ว': Math.max(sample.length - 1, 1), 'ทั้งหมด': sample.length, 'ยังไม่ตอบ': sample.length > 1 ? sample[sample.length - 1] : '-',
        }).trim();
    };

    window.ccToggleSchedule = async function (id) {
        const s = _schedules.find(x => Number(x.id) === Number(id));
        if (!s) return;
        const { error } = await appDB.from('chatcount_schedules').update({ active: !s.active, updated_at: new Date().toISOString() }).eq('id', id);
        if (error) return Swal.fire({ ...SWAL, icon: 'error', title: 'ผิดพลาด', text: error.message });
        window.ccLoadSchedules();
    };

    window.ccDeleteSchedule = async function (id) {
        const s = _schedules.find(x => Number(x.id) === Number(id));
        if (!s) return;
        const ok = await Swal.fire({ ...SWAL, icon: 'warning', title: `ลบรอบ ${esc(s.time)} "${esc(s.name)}"?`, text: 'ประวัติรอบที่ถามไปแล้วยังอยู่', showCancelButton: true, confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#ef4444' });
        if (!ok.isConfirmed) return;
        const { error } = await appDB.from('chatcount_schedules').delete().eq('id', id);
        if (error) return Swal.fire({ ...SWAL, icon: 'error', title: 'ผิดพลาด', text: error.message });
        window.ccLoadSchedules();
    };

    window.ccSendNow = async function (id) {
        const s = _schedules.find(x => Number(x.id) === Number(id));
        if (!s) return;
        const ok = await Swal.fire({ ...SWAL, icon: 'question', title: `ส่งคำถาม "${esc(s.name)}" ตอนนี้?`, text: `ส่งเข้า ${(s.channel_ids || []).length} ห้อง (ไม่กระทบรอบอัตโนมัติตามเวลา)`, showCancelButton: true, confirmButtonText: 'ส่งเลย', cancelButtonText: 'ยกเลิก' });
        if (!ok.isConfirmed) return;
        const row = {
            schedule_id: s.id, trigger: 'manual', label: s.name, round_date: thaiToday(), round_time: thaiHHMM(),
            channel_ids: s.channel_ids || [], expected_webs: webNames(),
            telegram_chat_id: s.telegram_chat_id, ask_template: s.ask_template, report_template: s.report_template,
            line_template: s.line_template, missing_template: s.missing_template,
        };
        const { error } = await appDB.from('chatcount_rounds').insert([row]);
        if (error) return Swal.fire({ ...SWAL, icon: 'error', title: 'ส่งไม่ได้', text: error.message });
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'สั่งแล้ว · บอทจะส่งเข้าห้องภายใน ~15 วินาที', showConfirmButton: false, timer: 2500 });
        $('ccLiveDate').value = thaiToday();
        window.ccSetSub('live');
    };

    // ════════════════════════════════════════════════════════════════
    // 3) รายชื่อเว็บ (พนักงานต้องพิมพ์ชื่อตรงทุกตัวอักษร)
    // ════════════════════════════════════════════════════════════════
    let _webDraft = null;
    function renderWebs() {
        const box = $('ccView_webs');
        if (!_webDraft) {
            const cur = (_settings.webs || []).map(w => ({ name: typeof w === 'string' ? w : w.name }));
            const seed = (typeof TEAM_LIST !== 'undefined' && Array.isArray(TEAM_LIST)) ? TEAM_LIST : [];
            _webDraft = cur.length ? cur : seed.map(n => ({ name: n }));
        }
        box.innerHTML = `
            <div style="font-size:12px;color:var(--k-mute);margin-bottom:10px">
                พนักงานต้องพิมพ์ชื่อเว็บ<b style="color:#fbbf24">ตรงทุกตัวอักษร (รวมตัวพิมพ์ใหญ่/เล็ก)</b> ตามที่ตั้งไว้ในนี้ ถ้าพิมพ์ผิด บอทจะไม่รับและแจ้งให้รีพลายใหม่
                · ชื่อต้องขึ้นต้นด้วยตัวอักษรอังกฤษ · ลำดับในนี้ = ลำดับบรรทัดในข้อความสรุป
            </div>
            <div style="display:flex;flex-direction:column;gap:6px">
                ${_webDraft.map((w, i) => `
                <div style="display:flex;gap:6px;align-items:center">
                    <span style="width:22px;text-align:right;color:var(--k-mute);font-weight:800">${i + 1}</span>
                    <input oninput="window.ccWebSet(${i},'name',this.value)" value="${esc(w.name)}" placeholder="ชื่อเว็บ เช่น MK8" style="${FD}flex:1;max-width:320px;font-family:monospace">
                    <button onclick="window.ccWebMove(${i},-1)" style="${BTN}" title="เลื่อนขึ้น">${MI('arrow_upward')}</button>
                    <button onclick="window.ccWebMove(${i},1)" style="${BTN}" title="เลื่อนลง">${MI('arrow_downward')}</button>
                    <button onclick="window.ccWebDel(${i})" style="${BTN}color:#f87171">${MI('delete')}</button>
                </div>`).join('')}
            </div>
            <div style="display:flex;gap:6px;margin-top:12px">
                <button onclick="window.ccWebAdd()" style="${BTN}">${MI('add')} เพิ่มเว็บ</button>
                <button onclick="window.ccWebSave()" style="${BTN_MAIN}">${MI('save')} บันทึก</button>
            </div>`;
    }
    window.ccWebSet = (i, k, v) => { _webDraft[i][k] = v; };
    window.ccWebMove = (i, d) => { const j = i + d; if (j < 0 || j >= _webDraft.length) return; [_webDraft[i], _webDraft[j]] = [_webDraft[j], _webDraft[i]]; renderWebs(); };
    window.ccWebDel = i => { _webDraft.splice(i, 1); renderWebs(); };
    window.ccWebAdd = () => { _webDraft.push({ name: '' }); renderWebs(); };
    window.ccWebSave = async function () {
        const webs = _webDraft.map(w => ({ name: String(w.name || '').trim() })).filter(w => w.name);
        const names = webs.map(w => w.name.toLowerCase());
        if (new Set(names).size !== names.length) return Swal.fire({ ...SWAL, icon: 'warning', title: 'ชื่อเว็บซ้ำกัน' });
        // ต้องตรงกับรูปแบบที่บอทอ่านได้ (ขึ้นต้นด้วยตัวอักษรอังกฤษ ตามด้วยอักษร/ตัวเลข ไม่มีเว้นวรรค)
        const bad = webs.find(w => !/^[A-Za-z][A-Za-z0-9]*$/.test(w.name));
        if (bad) return Swal.fire({ ...SWAL, icon: 'warning', title: `ชื่อ "${esc(bad.name)}" ใช้ไม่ได้`, text: 'ต้องขึ้นต้นด้วยตัวอักษรอังกฤษ และมีแค่ตัวอักษร/ตัวเลข ไม่มีเว้นวรรคหรือสัญลักษณ์' });
        const { error } = await appDB.from('chatcount_settings').update({ webs }).eq('id', 1);
        if (error) return Swal.fire({ ...SWAL, icon: 'error', title: 'บันทึกไม่ได้', text: error.message });
        _settings.webs = webs;
        _webDraft = null;
        renderWebs();
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'บันทึกรายชื่อเว็บแล้ว', showConfirmButton: false, timer: 1500 });
    };
})();
