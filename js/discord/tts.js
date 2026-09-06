// ════════════════════════════════════════════════════════════════════
// 📦 discord/tts.js — ส่วนที่ 5/5 ของหน้า Discord (แยกมาจาก discord.js เดิม)
// เนื้อหา: ศูนย์ควบคุมเสียงแจ้งเตือน TTS ทั้งหมด (กลุ่ม&กะ, ตั้งเวลา, ผูกกลุ่ม, ตั้งค่าเสียง)
// ⚠️ ลำดับโหลด (กำหนดใน PAGE_SCRIPTS ของ global.js): discord/core → history → message → breaktrack → tts
// ตัวแปร/ฟังก์ชันแชร์ข้ามไฟล์กันได้ตามปกติ (top-level scope เดียวกัน)
// ════════════════════════════════════════════════════════════════════
// ============================================================
// 🔊 ศูนย์ควบคุมเสียงแจ้งเตือน — พรีเมียม (ครบทุกฟีเจอร์)
// เก็บใน Supabase settings (key = tts_voice_config)
// อ่าน tts_status (สถานะสด), tts_logs (ประวัติ) ; เขียน tts_command (ทดสอบ)
// ============================================================
(function () {
    const ACTIVE = "whitespace-nowrap px-4 py-2 rounded-full font-bold text-sm transition-all bg-sky-500 text-white shadow-[0_0_10px_rgba(14,165,233,0.5)] flex items-center gap-1";
    const INACTIVE = "whitespace-nowrap px-4 py-2 rounded-full font-bold text-sm transition-all bg-slate-700 text-gray-300 hover:text-white flex items-center gap-1";
    const SUB_ON = "px-4 py-2 rounded-xl font-bold text-sm transition-all bg-sky-500 text-white shadow-lg flex items-center gap-1";
    const SUB_OFF = "px-4 py-2 rounded-xl font-bold text-sm transition-all bg-slate-700 text-gray-300 hover:text-white flex items-center gap-1";

    const _orig = window.switchDiscordTab;
    window.switchDiscordTab = function (tabName) {
        const myPanel = document.getElementById('dsContent_ttsvoice');
        const myBtn = document.getElementById('tabDsTtsvoice');
        if (tabName === 'ttsvoice') {
            document.querySelectorAll('[id^="dsContent_"]').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('[id^="tabDs"]').forEach(btn => { if (btn.id !== 'tabDsTtsvoice') btn.className = INACTIVE; });
            if (myPanel) myPanel.classList.remove('hidden');
            if (myBtn) myBtn.className = ACTIVE;
            initTtsControl();
            return;
        }
        if (myPanel) myPanel.classList.add('hidden');
        if (myBtn) myBtn.className = INACTIVE;
        _ttsStopStatus();
        if (typeof _orig === 'function') return _orig.apply(this, arguments);
    };

    const SHIFT_NAMES = ['กะเช้า', 'กะบ่าย', 'กะดึก'];
    const newShift = n => ({ name: n, enabled: false, keyword: '', voice_name: 'th-TH-PremwadeeNeural', repeat: 1, active_start: '', active_end: '', rooms: [] });
    const newGroup = () => ({ telegram_group: '', telegram_group_id: '', shifts: SHIFT_NAMES.map(newShift) });
    const newSched = () => ({ enabled: true, name: 'เตือนใหม่', time: '00:00', voice_name: 'th-TH-PremwadeeNeural', repeat: 1, rooms: [] });

    // 🤖 [Multi-Bot] กองบอท — หลายตัวช่วยกันพูดขนานกัน (ห้องเยอะก็จบไว)
    const BOT_COLORS = ['#38bdf8', '#a78bfa', '#34d399', '#fbbf24', '#f472b6', '#fb923c', '#60a5fa', '#4ade80'];
    const newBot = (i) => ({ id: 'bot' + Date.now() + Math.floor(Math.random() * 999), name: 'บอท ' + (i + 1), token: '', enabled: true, color: BOT_COLORS[i % BOT_COLORS.length] });

    let _cfg = { speech_rate: '-15%', volume: '+0%', pitch: '+0Hz', chime_enabled: true, dedupe_seconds: 60, groups: [newGroup(), newGroup()], schedules: [], bots: [], dispatch_mode: 'auto' };
    let _rooms = [];
    let _tgList = [];      // รายชื่อกลุ่ม Telegram [{id,title}]
    let _search = {};      // ค้นหาห้อง keyed "g-s" หรือ "sc-i"
    let _sub = 'groups';
    let _statusTimer = null;
    let _status = null;    // สถานะสดล่าสุด (cache ให้แผงกองบอทใช้)
    let _tokenVis = {};    // โชว์/ซ่อน token ต่อบอท

    const botById = id => {
        if (String(id) === 'main') return mainBotInfo();   // 🎩 บอทหลักบน Railway (ENV) — เลือกได้เหมือนบอทเสริม
        return (_cfg.bots || []).find(b => String(b.id) === String(id)) || null;
    };
    // ข้อมูลบอทหลัก (Token อยู่ใน ENV ของ Railway ไม่ได้เก็บในเว็บ) — ชื่อจริงมาจากสถานะสดที่บอทรายงานเข้ามา
    function mainBotInfo() {
        const lv = (_status && Array.isArray(_status.bots)) ? _status.bots.find(b => String(b.bot_id) === 'main') : null;
        return { id: 'main', name: (lv && lv.name) || 'บอทหลัก', color: '#E8C15A', enabled: true, token: '', _main: true };
    }
    function hasMainBot() { return !!(_status && Array.isArray(_status.bots) && _status.bots.some(b => String(b.bot_id) === 'main')); }
    const enabledBots = () => (_cfg.bots || []).filter(b => b.enabled && (b.token || '').trim());
    // สถานะรายบอทจาก tts_status (รูปใหม่ {bots:[...]}) — คืน null ถ้ายังเป็นรูปเก่า/ไม่มี
    function botLive(botId) {
        if (!_status || !Array.isArray(_status.bots)) return null;
        return _status.bots.find(b => String(b.bot_id) === String(botId)) || null;
    }
    function isFresh(updatedAt) {
        if (!updatedAt) return false;
        const t = new Date(String(updatedAt).replace(' ', 'T'));
        return !isNaN(t) && (Date.now() - t.getTime() < 40000);
    }

    const esc = s => String(s || '').replace(/"/g, '&quot;');
    const roomName = id => { const r = _rooms.find(r => String(r.id) === String(id)); return r ? (r.name || r.id) : id; };

    function _migrate(p) {
        _cfg.speech_rate = p.speech_rate || '-15%';
        _cfg.volume = p.volume || '+0%';
        _cfg.pitch = p.pitch || '+0Hz';
        _cfg.chime_enabled = p.chime_enabled !== false;
        _cfg.dedupe_seconds = (p.dedupe_seconds != null) ? p.dedupe_seconds : 60;
        _cfg.schedules = Array.isArray(p.schedules) ? p.schedules.map(s => ({
            enabled: s.enabled !== false, name: s.name || 'เตือน', time: s.time || '00:00',
            voice_name: s.voice_name || 'th-TH-PremwadeeNeural', repeat: Number(s.repeat) || 1,
            rooms: (Array.isArray(s.rooms) ? s.rooms : []).map(r => ({ id: String(r.id), text: r.text || '', bot_id: r.bot_id ? String(r.bot_id) : '' }))
        })) : [];

        // 🤖 กองบอท (ของเก่าไม่มี = เริ่มว่าง โหมด auto — บอทเดิมของระบบยังทำงานต่อได้)
        _cfg.dispatch_mode = (p.dispatch_mode === 'manual') ? 'manual' : 'auto';
        _cfg.bots = (Array.isArray(p.bots) ? p.bots : []).map((b, i) => ({
            id: b.id ? String(b.id) : ('bot_m' + i),
            name: b.name || ('บอท ' + (i + 1)),
            token: b.token || '',
            enabled: b.enabled !== false,
            color: b.color || BOT_COLORS[i % BOT_COLORS.length]
        }));

        let groups = Array.isArray(p.groups) ? p.groups : null;
        if (!groups && Array.isArray(p.shifts)) groups = [{ telegram_group: (p.telegram_groups && p.telegram_groups[0]) || '', shifts: p.shifts }];
        if (!groups) groups = [newGroup(), newGroup()];
        _cfg.groups = groups.map(g => ({
            telegram_group: g.telegram_group || '',
            telegram_group_id: g.telegram_group_id ? String(g.telegram_group_id) : '',
            shifts: SHIFT_NAMES.map((nm, i) => {
                const s = (g.shifts && g.shifts[i]) || newShift(nm);
                let rooms = Array.isArray(s.rooms) ? s.rooms : null;
                if (!rooms) { const ids = s.voice_channel_ids || (s.voice_channel_id ? [s.voice_channel_id] : []); rooms = ids.map(id => ({ id: String(id), text: s.announce_text || '' })); }
                return { name: nm, enabled: !!s.enabled, keyword: s.keyword || '', voice_name: s.voice_name || 'th-TH-PremwadeeNeural', repeat: Number(s.repeat) || 1, active_start: s.active_start || '', active_end: s.active_end || '', rooms: rooms.map(r => ({ id: String(r.id), text: r.text || '', bot_id: r.bot_id ? String(r.bot_id) : '' })) };
            })
        }));
        while (_cfg.groups.length < 2) _cfg.groups.push(newGroup());
    }

    window.initTtsControl = async function () {
        if (typeof appDB === 'undefined' || !appDB) return;
        _cfg = { speech_rate: '-15%', volume: '+0%', pitch: '+0Hz', chime_enabled: true, dedupe_seconds: 60, groups: [newGroup(), newGroup()], schedules: [] };
        try {
            const { data } = await appDB.from('settings').select('value').eq('key', 'tts_voice_config').maybeSingle();
            if (data && data.value) _migrate(JSON.parse(data.value));
        } catch (e) { console.warn('load cfg', e); }
        try {
            const { data } = await appDB.from('settings').select('value').eq('key', 'discord_channels').maybeSingle();
            if (data && data.value) _rooms = JSON.parse(data.value);
        } catch (e) { console.warn('load rooms', e); }
        try {
            const { data } = await appDB.from('settings').select('value').eq('key', 'telegram_groups_list').maybeSingle();
            if (data && data.value) _tgList = JSON.parse(data.value);
        } catch (e) { console.warn('load tg list', e); }

        ttsSubTab(_sub);
        _ttsStartStatus();
    };

    // ---------- แท็บย่อย ----------
    window.ttsSubTab = function (name) {
        _sub = name;
        ['groups', 'bots', 'telegram', 'schedule', 'history', 'settings'].forEach(t => {
            const pane = document.getElementById('ttsPane_' + t);
            const btn = document.getElementById('ttsSub_' + t);
            if (pane) pane.classList.toggle('hidden', t !== name);
            if (btn) btn.className = (t === name) ? SUB_ON : SUB_OFF;
        });
        if (name === 'groups') _renderGroups();
        else if (name === 'bots') _renderBots();
        else if (name === 'telegram') _renderTelegram();
        else if (name === 'schedule') _renderSchedules();
        else if (name === 'history') _renderHistory();
        else if (name === 'settings') _renderSettings();
    };

    // ---------- สถานะสด ----------
    function _ttsStartStatus() {
        _ttsStopStatus();
        _pollStatus();
        _statusTimer = setInterval(_pollStatus, 5000);
    }
    function _ttsStopStatus() { if (_statusTimer) { clearInterval(_statusTimer); _statusTimer = null; } }

    async function _pollStatus() {
        const box = document.getElementById('ttsLiveStatus');
        if (!box || typeof appDB === 'undefined') return;
        try {
            const { data } = await appDB.from('settings').select('value').eq('key', 'tts_status').maybeSingle();
            if (!data || !data.value) { _status = null; box.innerHTML = _dot('#64748b') + '<span class="text-gray-500">ยังไม่มีข้อมูลสถานะ</span>'; return; }
            const s = JSON.parse(data.value);
            _status = s;
            let html = '';

            if (Array.isArray(s.bots)) {
                // ── รูปใหม่: สถานะรายบอทหลายตัว ──
                const live = s.bots.map(b => ({ ...b, on: !!b.online && isFresh(b.updated_at || s.updated_at) }));
                const onCount = live.filter(b => b.on).length;
                const anySpeaking = live.filter(b => b.on && b.current_room);
                html += `<div class="flex items-center gap-2">${_dot(onCount ? '#22c55e' : '#64748b', onCount > 0)}<span class="${onCount ? 'text-green-400' : 'text-gray-500'} font-bold">บอทออนไลน์ ${onCount}/${live.length}</span></div>`;
                // จุดสีต่อบอท (โชว์สูงสุด 8)
                html += `<div class="flex items-center gap-1.5">` + live.slice(0, 8).map(b => {
                    const cb = botById(b.bot_id);
                    const col = (cb && cb.color) || '#38bdf8';
                    return `<span title="${esc(b.name || b.bot_id)}${b.current_room ? ' — กำลังพูด: ' + esc(b.current_room) : ''}" class="inline-flex rounded-full" style="width:10px;height:10px;background:${b.on ? col : '#475569'};${b.on && b.current_room ? 'box-shadow:0 0 8px ' + col : ''}"></span>`;
                }).join('') + `</div>`;
                if (anySpeaking.length) html += `<div class="flex items-center gap-1 text-sky-300"><span class="material-icons text-base">volume_up</span>${anySpeaking.length > 1 ? 'กำลังพูด ' + anySpeaking.length + ' ห้องพร้อมกัน' : esc(anySpeaking[0].current_room)}</div>`;
                const lastAll = live.map(b => b.last_spoke_at).filter(Boolean).sort().pop();
                if (lastAll) html += `<div class="text-gray-500 text-xs">พูดล่าสุด ${lastAll.slice(11, 16)}</div>`;
            } else {
                // ── รูปเก่า: บอทเดี่ยว (backward compatible) ──
                const online = s.online && isFresh(s.updated_at);
                html += `<div class="flex items-center gap-2">${_dot(online ? '#22c55e' : '#64748b', online)}<span class="${online ? 'text-green-400' : 'text-gray-500'} font-bold">${online ? 'บอทออนไลน์' : 'บอทออฟไลน์'}</span></div>`;
                if (online && s.current_room) html += `<div class="flex items-center gap-1 text-sky-300"><span class="material-icons text-base">volume_up</span>${s.current_room}</div>`;
                if (s.last_spoke_at) html += `<div class="text-gray-500 text-xs">พูดล่าสุด ${s.last_spoke_at.slice(11, 16)}</div>`;
            }
            box.innerHTML = html;
            // แผงกองบอทเปิดอยู่ → อัปเดตเฉพาะป้ายสถานะสด (ไม่ re-render ทั้งแผง กันช่องกรอกเด้ง)
            if (_sub === 'bots') _refreshBotLiveBadges();
        } catch (e) { box.innerHTML = _dot('#64748b') + '<span class="text-gray-500">—</span>'; }
    }
    function _dot(color, pulse) {
        return `<span class="relative flex h-3 w-3 mr-1">${pulse ? `<span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style="background:${color}"></span>` : ''}<span class="relative inline-flex rounded-full h-3 w-3" style="background:${color}"></span></span>`;
    }

    // ================= แผง: กลุ่ม & กะ =================
    function _renderGroups() {
        const wrap = document.getElementById('ttsPane_groups');
        if (!wrap) return;
        let html = '';
        _cfg.groups.forEach((grp, gi) => {
            html += `
            <div class="rounded-3xl border border-indigo-500/30 bg-slate-800/40 p-4 space-y-3">
                <div class="flex items-center gap-2">
                    <span class="material-icons text-indigo-400">forum</span>
                    ${_tgList.length
                        ? `<select onchange="ttsPickTgGroup(${gi},this)" class="flex-1 bg-slate-900 border border-indigo-500/30 text-white font-bold px-3 py-2 rounded-xl text-sm outline-none focus:border-indigo-400">
                            <option value="">— เลือกกลุ่ม Telegram —</option>
                            ${_tgList.map(t => `<option value="${t.id}" ${String(grp.telegram_group_id||'')===String(t.id)?'selected':''}>${(t.title||t.id)}</option>`).join('')}
                           </select>`
                        : `<input type="text" value="${esc(grp.telegram_group)}" oninput="ttsGroupName(${gi},this.value)" placeholder="ชื่อกลุ่ม Telegram (เช่น ทดลอง2)" class="flex-1 bg-slate-900 border border-indigo-500/30 text-white font-bold px-3 py-2 rounded-xl text-sm outline-none focus:border-indigo-400">`
                    }
                    ${_cfg.groups.length > 1 ? `<button onclick="ttsRemoveGroup(${gi})" class="text-gray-500 hover:text-red-400 p-1"><span class="material-icons">delete</span></button>` : ''}
                </div>
                ${grp.telegram_group_id ? `<div class="text-xs text-indigo-300/70 -mt-1 pl-8">🔗 ผูกกับ ID: ${grp.telegram_group_id}${grp.telegram_group ? ' ('+grp.telegram_group+')' : ''}</div>` : ''}
                <div class="space-y-3">${grp.shifts.map((s, si) => _shiftCard(gi, si, s)).join('')}</div>
            </div>`;
        });
        html += `<button onclick="ttsAddGroup()" class="w-full py-2.5 rounded-2xl border-2 border-dashed border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10 transition font-bold text-sm flex items-center justify-center gap-1"><span class="material-icons">add</span> เพิ่มกลุ่ม</button>`;
        wrap.innerHTML = html;
        _cfg.groups.forEach((grp, gi) => grp.shifts.forEach((s, si) => { _renderChk(gi + '-' + si, s.rooms); _renderSel('g', gi, si); }));
    }

    function _shiftCard(gi, si, s) {
        const key = gi + '-' + si;
        return `
        <div class="bg-slate-900 rounded-2xl border ${s.enabled ? 'border-sky-500' : 'border-slate-700'} p-3 space-y-3">
            <div class="flex items-center justify-between">
                <h3 class="text-white font-bold flex items-center gap-2"><span class="material-icons text-sky-400 text-lg">schedule</span> ${s.name}</h3>
                <button onclick="ttsShiftToggle(${gi},${si})" style="width:48px;height:24px;" class="relative rounded-full transition ${s.enabled ? 'bg-green-500' : 'bg-slate-600'}">
                    <span class="absolute rounded-full bg-white transition-all" style="width:20px;height:20px;top:2px; left:${s.enabled ? '26px' : '2px'};"></span>
                </button>
            </div>

            <div>
                <label class="text-xs text-gray-400 font-bold block mb-1">คำที่จับ (เจอในกลุ่มแล้วพูด)</label>
                <input type="text" value="${esc(s.keyword)}" oninput="ttsSF(${gi},${si},'keyword',this.value)" placeholder="เช่น เช็คชื่อ" class="w-full bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm outline-none focus:border-sky-500">
            </div>

            <div class="grid grid-cols-2 gap-2">
                <div>
                    <label class="text-xs text-gray-400 font-bold block mb-1">เสียง</label>
                    <select onchange="ttsSF(${gi},${si},'voice_name',this.value)" class="w-full bg-slate-800 border border-slate-700 text-white px-2 py-2 rounded-lg text-sm outline-none focus:border-sky-500">
                        <option value="th-TH-PremwadeeNeural" ${s.voice_name === 'th-TH-PremwadeeNeural' ? 'selected' : ''}>หญิง (Premwadee)</option>
                        <option value="th-TH-NiwatNeural" ${s.voice_name === 'th-TH-NiwatNeural' ? 'selected' : ''}>ชาย (Niwat)</option>
                    </select>
                </div>
                <div>
                    <label class="text-xs text-gray-400 font-bold block mb-1">พูดซ้ำ</label>
                    <select onchange="ttsSF(${gi},${si},'repeat',parseInt(this.value))" class="w-full bg-slate-800 border border-slate-700 text-white px-2 py-2 rounded-lg text-sm outline-none focus:border-sky-500">
                        ${[1, 2, 3, 4, 5].map(n => `<option value="${n}" ${Number(s.repeat || 1) === n ? 'selected' : ''}>${n} รอบ</option>`).join('')}
                    </select>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-2">
                <div>
                    <label class="text-xs text-gray-400 font-bold block mb-1">ทำงานตั้งแต่ (เว้นว่าง=ทั้งวัน)</label>
                    <input type="time" value="${esc(s.active_start)}" onchange="ttsSF(${gi},${si},'active_start',this.value)" class="w-full bg-slate-800 border border-slate-700 text-white px-2 py-2 rounded-lg text-sm outline-none focus:border-sky-500">
                </div>
                <div>
                    <label class="text-xs text-gray-400 font-bold block mb-1">ถึง</label>
                    <input type="time" value="${esc(s.active_end)}" onchange="ttsSF(${gi},${si},'active_end',this.value)" class="w-full bg-slate-800 border border-slate-700 text-white px-2 py-2 rounded-lg text-sm outline-none focus:border-sky-500">
                </div>
            </div>

            <div>
                <label class="text-xs text-gray-400 font-bold block mb-1">เพิ่มห้อง (พิมพ์เลขห้องแล้วกดเพิ่ม)</label>
                <div class="flex gap-2 mb-2">
                    <input type="text" id="num_${key}" placeholder="เลขห้อง เช่น 1" class="flex-1 bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm outline-none focus:border-sky-500">
                    <button onclick="ttsAddByNum('g',${gi},${si})" class="bg-sky-600 hover:bg-sky-500 text-white px-4 rounded-lg text-sm font-bold">เพิ่ม</button>
                </div>
                <input type="text" value="${esc(_search[key])}" oninput="ttsSearch('${key}',this.value)" placeholder="🔍 หรือค้นหาห้องแล้วติ๊ก..." class="w-full bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm outline-none focus:border-sky-500 mb-2">
                <div id="chk_${key}" class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto custom-scrollbar pr-1 mb-2"></div>
            </div>

            <div>
                <label class="text-xs text-gray-400 font-bold block mb-1">ห้องที่เลือก + ข้อความเฉพาะห้อง</label>
                <div id="sel_g_${key}" class="space-y-2"></div>
            </div>
        </div>`;
    }

    // ---------- checklist ห้อง ----------
    function _renderChk(key, selectedRooms) {
        const el = document.getElementById('chk_' + key);
        if (!el) return;
        const ids = (selectedRooms || []).map(r => String(r.id));
        const term = (_search[key] || '').toLowerCase().trim();
        const list = _rooms.filter(r => !term || (r.name || '').toLowerCase().includes(term));
        if (!list.length) { el.innerHTML = `<div class="col-span-full text-center text-gray-500 py-3 text-sm">${_rooms.length ? 'ไม่พบห้อง' : 'ยังไม่มีรายชื่อห้อง — เข้าแท็บย้ายห้องก่อน'}</div>`; return; }
        el.innerHTML = list.map(r => {
            const on = ids.includes(String(r.id));
            return `<label class="flex items-center gap-2 p-2 rounded-lg border ${on ? 'border-sky-500 bg-sky-500/10' : 'border-slate-700'} hover:border-sky-500 cursor-pointer transition text-sm">
                <input type="checkbox" ${on ? 'checked' : ''} onchange="ttsChkRoom('${key}','${r.id}',this)" class="w-4 h-4 accent-sky-500">
                <span class="material-icons text-sky-400 text-base">volume_up</span><span class="text-white">${r.name || r.id}</span></label>`;
        }).join('');
    }

    // ---------- ห้องที่เลือก (มีข้อความ + ปุ่มทดสอบ) ----------
    function _renderSel(kind, a, b) {
        // kind 'g' => group shift (a=gi,b=si) ; kind 'sc' => schedule (a=index)
        const rooms = (kind === 'g') ? _cfg.groups[a].shifts[b].rooms : _cfg.schedules[a].rooms;
        const voice = (kind === 'g') ? _cfg.groups[a].shifts[b].voice_name : _cfg.schedules[a].voice_name;
        const elId = (kind === 'g') ? ('sel_g_' + a + '-' + b) : ('sel_sc_' + a);
        const el = document.getElementById(elId);
        if (!el) return;
        if (!rooms.length) { el.innerHTML = `<div class="text-gray-500 text-sm py-2">ยังไม่ได้เลือกห้อง</div>`; return; }
        const manual = _cfg.dispatch_mode === 'manual' && ((_cfg.bots || []).length > 0 || hasMainBot());
        el.innerHTML = rooms.map((r, ri) => {
            const bb = r.bot_id ? botById(r.bot_id) : null;
            return `
            <div class="bg-slate-800 border ${bb ? '' : 'border-slate-700'} rounded-xl p-2" ${bb ? `style="border:1px solid ${bb.color}55"` : ''}>
                <div class="flex items-center justify-between mb-1 flex-wrap gap-1">
                    <span class="text-sky-300 font-bold text-sm flex items-center gap-1"><span class="material-icons text-base">volume_up</span> ${roomName(r.id)}
                        ${bb ? `<span class="text-[10px] font-black rounded-full px-2 py-0.5 ml-1" style="background:${bb.color}22;color:${bb.color};border:1px solid ${bb.color}55">${bb._main ? '🎩' : '🤖'} ${esc(bb.name)}</span>` : ''}
                    </span>
                    <div class="flex items-center gap-1">
                        ${manual ? `
                        <select onchange="ttsRoomBot('${kind}',${a},${b == null ? 'null' : b},${ri},this.value)" title="บอทประจำห้องนี้" class="text-xs bg-slate-900 border border-slate-700 text-gray-300 px-1.5 py-1 rounded-lg outline-none focus:border-violet-500 max-w-[130px]">
                            <option value="">🎲 อัตโนมัติ</option>
                            ${hasMainBot() ? `<option value="main" ${String(r.bot_id || '') === 'main' ? 'selected' : ''}>🎩 ${esc(mainBotInfo().name)} (หลัก)</option>` : ''}
                            ${(_cfg.bots || []).map(bt => `<option value="${bt.id}" ${String(r.bot_id || '') === String(bt.id) ? 'selected' : ''}>🤖 ${esc(bt.name)}</option>`).join('')}
                        </select>` : ''}
                        <button onclick="ttsTest('${kind}',${a},${b == null ? 'null' : b},${ri})" class="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1 rounded-lg flex items-center gap-1" title="ให้บอทพูดทันที"><span class="material-icons text-sm">play_arrow</span> ทดสอบ</button>
                        <button onclick="ttsDelRoom('${kind}',${a},${b == null ? 'null' : b},${ri})" class="text-gray-500 hover:text-red-400"><span class="material-icons text-lg">close</span></button>
                    </div>
                </div>
                <textarea rows="2" oninput="ttsRoomText('${kind}',${a},${b == null ? 'null' : b},${ri},this.value)" placeholder="ข้อความที่บอทจะพูดในห้องนี้..." class="w-full bg-slate-900 border border-slate-700 text-white px-2 py-1.5 rounded-lg text-sm outline-none focus:border-sky-500 resize-none">${(r.text || '')}</textarea>
            </div>`;
        }).join('');
    }

    // ================= แผง: ตั้งเวลาพูด =================
    function _renderSchedules() {
        const wrap = document.getElementById('ttsPane_schedule');
        if (!wrap) return;
        let html = `<p class="text-sm text-gray-400 mb-2">ให้บอทพูดเองตามเวลา (เวลาไทย) โดยไม่ต้องรอคำในกลุ่ม</p>`;
        if (!_cfg.schedules.length) html += `<div class="text-center text-gray-500 py-6 bg-slate-800/40 rounded-2xl border border-slate-700">ยังไม่มีรายการตั้งเวลา</div>`;
        _cfg.schedules.forEach((sc, i) => {
            const key = 'sc-' + i;
            html += `
            <div class="bg-slate-900 rounded-2xl border ${sc.enabled ? 'border-amber-500/50' : 'border-slate-700'} p-3 space-y-3">
                <div class="flex items-center gap-2">
                    <input type="time" value="${esc(sc.time)}" onchange="ttsScField(${i},'time',this.value)" class="bg-slate-800 border border-slate-700 text-white text-lg font-black px-3 py-2 rounded-lg outline-none focus:border-amber-500">
                    <input type="text" value="${esc(sc.name)}" oninput="ttsScField(${i},'name',this.value)" placeholder="ชื่อรายการ" class="flex-1 bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm outline-none focus:border-amber-500">
                    <button onclick="ttsScToggle(${i})" style="width:48px;height:24px;" class="relative rounded-full transition ${sc.enabled ? 'bg-green-500' : 'bg-slate-600'}"><span class="absolute rounded-full bg-white transition-all" style="width:20px;height:20px;top:2px; left:${sc.enabled ? '26px' : '2px'};"></span></button>
                    <button onclick="ttsDelSched(${i})" class="text-gray-500 hover:text-red-400"><span class="material-icons">delete</span></button>
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <select onchange="ttsScField(${i},'voice_name',this.value)" class="bg-slate-800 border border-slate-700 text-white px-2 py-2 rounded-lg text-sm outline-none focus:border-amber-500">
                        <option value="th-TH-PremwadeeNeural" ${sc.voice_name === 'th-TH-PremwadeeNeural' ? 'selected' : ''}>หญิง (Premwadee)</option>
                        <option value="th-TH-NiwatNeural" ${sc.voice_name === 'th-TH-NiwatNeural' ? 'selected' : ''}>ชาย (Niwat)</option>
                    </select>
                    <select onchange="ttsScField(${i},'repeat',parseInt(this.value))" class="bg-slate-800 border border-slate-700 text-white px-2 py-2 rounded-lg text-sm outline-none focus:border-amber-500">
                        ${[1, 2, 3, 4, 5].map(n => `<option value="${n}" ${Number(sc.repeat || 1) === n ? 'selected' : ''}>${n} รอบ</option>`).join('')}
                    </select>
                </div>
                <div class="flex gap-2">
                    <input type="text" id="num_${key}" placeholder="เลขห้อง เช่น 1" class="flex-1 bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm outline-none focus:border-amber-500">
                    <button onclick="ttsAddByNum('sc',${i},null)" class="bg-amber-600 hover:bg-amber-500 text-white px-4 rounded-lg text-sm font-bold">เพิ่มห้อง</button>
                </div>
                <input type="text" value="${esc(_search[key])}" oninput="ttsSearch('${key}',this.value)" placeholder="🔍 หรือค้นหาห้องแล้วติ๊ก..." class="w-full bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm outline-none focus:border-amber-500">
                <div id="chk_${key}" class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto custom-scrollbar pr-1"></div>
                <div id="sel_sc_${i}" class="space-y-2"></div>
            </div>`;
        });
        html += `<button onclick="ttsAddSched()" class="w-full py-2.5 rounded-2xl border-2 border-dashed border-amber-500/40 text-amber-300 hover:bg-amber-500/10 transition font-bold text-sm flex items-center justify-center gap-1"><span class="material-icons">add_alarm</span> เพิ่มรายการตั้งเวลา</button>`;
        wrap.innerHTML = html;
        _cfg.schedules.forEach((sc, i) => { _renderChk('sc-' + i, sc.rooms); _renderSel('sc', i, null); });
    }

    // ================= แผง: ผูกกลุ่ม Telegram =================
    async function _renderTelegram() {
        const wrap = document.getElementById('ttsPane_telegram');
        if (!wrap) return;
        // โหลดล่าสุด
        try {
            const { data } = await appDB.from('settings').select('value').eq('key', 'telegram_groups_list').maybeSingle();
            if (data && data.value) _tgList = JSON.parse(data.value);
        } catch (e) { /* ignore */ }

        const boundIds = new Set(_cfg.groups.map(g => String(g.telegram_group_id || '')).filter(Boolean));

        let html = `
        <div class="bg-slate-800/60 rounded-2xl border border-slate-700 p-4">
            <p class="text-sm text-gray-300 mb-1">กลุ่ม Telegram ที่บอทได้ยิน (บัญชีเราเป็นสมาชิก)</p>
            <p class="text-xs text-gray-500">เลือกกลุ่มจากที่นี่เพื่อผูกด้วยเลข ID ในแท็บ "กลุ่ม &amp; กะ" — แม่นกว่าพิมพ์ชื่อ (ชื่อกลุ่มซ้ำ/เปลี่ยนได้)</p>
            <div class="flex justify-end mt-2">
                <button onclick="ttsSubTab('telegram')" class="text-sky-400 hover:text-sky-300 text-sm flex items-center gap-1"><span class="material-icons text-base">refresh</span> รีเฟรชรายการ</button>
            </div>
        </div>`;

        if (!_tgList.length) {
            html += `<div class="text-center text-gray-500 py-10 bg-slate-800/40 rounded-2xl border border-slate-700 mt-3">ยังไม่มีรายชื่อกลุ่ม — รอบอทอัปเดต (ทุก 5 นาที) หรือเช็คว่าบอทออนไลน์อยู่</div>`;
        } else {
            html += `<div class="space-y-2 mt-3">` + _tgList.map(t => {
                const bound = boundIds.has(String(t.id));
                return `<div class="bg-slate-800/60 border ${bound ? 'border-green-500/40' : 'border-slate-700'} rounded-xl p-3 flex items-center justify-between gap-3">
                    <div class="min-w-0">
                        <div class="text-white font-bold truncate">${(t.title || '(ไม่มีชื่อ)').replace(/</g,'&lt;')}</div>
                        <div class="text-gray-500 text-xs font-mono">ID: ${t.id}</div>
                    </div>
                    ${bound
                        ? `<span class="text-xs font-bold text-green-300 bg-green-500/10 border border-green-500/30 rounded-full px-3 py-1 whitespace-nowrap">✓ ผูกแล้ว</span>`
                        : `<button onclick="ttsBindTg('${t.id}')" class="text-xs font-bold text-sky-300 bg-sky-500/10 border border-sky-500/30 hover:bg-sky-500/20 rounded-full px-3 py-1 whitespace-nowrap">ผูกกลุ่มนี้</button>`
                    }
                </div>`;
            }).join('') + `</div>`;
        }
        wrap.innerHTML = html;
    }

    // ผูกกลุ่มที่เลือกเข้ากับกลุ่มว่างตัวแรก (หรือสร้างใหม่)
    window.ttsBindTg = function (id) {
        const t = _tgList.find(x => String(x.id) === String(id));
        if (!t) return;
        let slot = _cfg.groups.find(g => !g.telegram_group_id && !g.telegram_group);
        if (!slot) { slot = newGroup(); _cfg.groups.push(slot); }
        slot.telegram_group_id = String(t.id);
        slot.telegram_group = t.title || '';
        if (window.Swal) Swal.fire({ icon: 'success', title: 'ผูกแล้ว', text: 'ไปตั้งคำ/ห้อง ในแท็บ "กลุ่ม & กะ" ได้เลย', timer: 2200, showConfirmButton: false });
        ttsSubTab('groups');
    };

    async function _renderHistory() {
        const wrap = document.getElementById('ttsPane_history');
        if (!wrap) return;
        wrap.innerHTML = `<div class="text-center text-gray-500 py-6"><span class="material-icons animate-spin">sync</span> กำลังโหลด...</div>`;
        try {
            const { data, error } = await appDB.from('tts_logs').select('*').order('created_at', { ascending: false }).limit(50);
            if (error) throw error;
            if (!data || !data.length) { wrap.innerHTML = `<div class="text-center text-gray-500 py-10 bg-slate-800/40 rounded-2xl border border-slate-700">ยังไม่มีประวัติการพูด</div>`; return; }
            const kindColor = { 'จับคำ': 'text-sky-300 bg-sky-500/10', 'ตั้งเวลา': 'text-amber-300 bg-amber-500/10', 'ทดสอบ': 'text-emerald-300 bg-emerald-500/10' };
            wrap.innerHTML = `
            <div class="flex justify-between items-center mb-3">
                <p class="text-sm text-gray-400">50 รายการล่าสุด</p>
                <button onclick="ttsSubTab('history')" class="text-sky-400 hover:text-sky-300 text-sm flex items-center gap-1"><span class="material-icons text-base">refresh</span> รีเฟรช</button>
            </div>
            <div class="space-y-2">` + data.map(r => {
                const t = r.created_at ? new Date(r.created_at) : null;
                const tstr = t ? t.toLocaleString('th-TH', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '';
                return `<div class="bg-slate-800/60 border border-slate-700 rounded-xl p-3 flex items-start gap-3">
                    <span class="text-xs font-bold px-2 py-1 rounded-lg ${kindColor[r.kind] || 'text-gray-300 bg-slate-700'}">${r.kind || '-'}</span>
                    <div class="flex-1 min-w-0">
                        <div class="text-white text-sm truncate">${(r.message || '').replace(/</g, '&lt;')}</div>
                        <div class="text-gray-500 text-xs mt-0.5 flex flex-wrap gap-x-3">
                            <span>🔊 ${r.room_name || '-'}</span>
                            ${r.bot_name ? `<span class="text-violet-300">🤖 ${String(r.bot_name).replace(/</g, '&lt;')}</span>` : ''}
                            ${r.keyword && r.keyword !== '-' ? `<span>คำ: ${r.keyword}</span>` : ''}
                            ${r.group_name && r.group_name !== '-' ? `<span>${r.group_name}</span>` : ''}
                        </div>
                    </div>
                    <span class="text-gray-500 text-xs whitespace-nowrap">${tstr}</span>
                </div>`;
            }).join('') + `</div>`;
        } catch (e) {
            wrap.innerHTML = `<div class="text-center text-gray-500 py-10 bg-slate-800/40 rounded-2xl border border-slate-700">โหลดประวัติไม่ได้ — ตรวจว่าได้รันไฟล์ SQL สร้างตาราง tts_logs แล้ว</div>`;
        }
    }

    // ================= แผง: ตั้งค่าเสียง =================
    function _renderSettings() {
        const wrap = document.getElementById('ttsPane_settings');
        if (!wrap) return;
        wrap.innerHTML = `
        <div class="bg-slate-800/60 rounded-2xl border border-slate-700 p-4 space-y-4 max-w-lg">
            <div class="flex items-center justify-between">
                <div><div class="text-white font-bold">ความเร็วเสียง</div><div class="text-xs text-gray-500">พูดช้า/เร็ว</div></div>
                <select id="setRate" onchange="_cfgSet('speech_rate',this.value)" class="bg-slate-900 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm outline-none focus:border-sky-500">
                    <option value="+15%">เร็ว</option><option value="0%">ปกติ</option><option value="-10%">ช้าลงเล็กน้อย</option><option value="-15%">ช้า</option><option value="-25%">ช้ามาก</option>
                </select>
            </div>
            <div class="flex items-center justify-between">
                <div><div class="text-white font-bold">ระดับเสียง (ดัง/เบา)</div><div class="text-xs text-gray-500">ความดังของเสียงพูด</div></div>
                <select id="setVol" onchange="_cfgSet('volume',this.value)" class="bg-slate-900 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm outline-none focus:border-sky-500">
                    <option value="-50%">เบามาก</option><option value="-25%">เบา</option><option value="+0%">ปกติ</option><option value="+25%">ดัง</option><option value="+50%">ดังมาก</option>
                </select>
            </div>
            <div class="flex items-center justify-between">
                <div><div class="text-white font-bold">โทนเสียง (สูง/ต่ำ)</div><div class="text-xs text-gray-500">ปรับให้เสียงต่างออกไป</div></div>
                <select id="setPitch" onchange="_cfgSet('pitch',this.value)" class="bg-slate-900 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm outline-none focus:border-sky-500">
                    <option value="-50Hz">ต่ำมาก</option><option value="-25Hz">ต่ำ</option><option value="+0Hz">ปกติ</option><option value="+25Hz">สูง</option><option value="+50Hz">สูงมาก</option>
                </select>
            </div>
            <div class="flex items-center justify-between">
                <div><div class="text-white font-bold">เสียงเตือนก่อนพูด</div><div class="text-xs text-gray-500">ติ๊งต่องก่อนบอทพูด</div></div>
                <button onclick="_cfgToggleChime()" id="setChime" style="width:48px;height:24px;" class="relative rounded-full transition ${_cfg.chime_enabled ? 'bg-green-500' : 'bg-slate-600'}"><span class="absolute rounded-full bg-white transition-all" style="width:20px;height:20px;top:2px;left:${_cfg.chime_enabled ? '26px' : '2px'};"></span></button>
            </div>
            <div class="flex items-center justify-between">
                <div><div class="text-white font-bold">กันจับซ้ำ</div><div class="text-xs text-gray-500">เจอคำเดิมซ้ำในเวลาสั้นๆ ไม่พูดซ้ำ</div></div>
                <select id="setDedupe" onchange="_cfgSet('dedupe_seconds',parseInt(this.value))" class="bg-slate-900 border border-slate-700 text-white px-3 py-2 rounded-lg text-sm outline-none focus:border-sky-500">
                    <option value="0">ปิด</option><option value="30">30 วินาที</option><option value="60">1 นาที</option><option value="180">3 นาที</option><option value="300">5 นาที</option>
                </select>
            </div>

            <div class="pt-3 border-t border-slate-700">
                <div class="text-white font-bold mb-2">ลองฟังเสียง</div>
                <div class="flex gap-2 flex-wrap">
                    <select id="setTestVoice" class="bg-slate-900 border border-slate-700 text-white px-2 py-2 rounded-lg text-sm outline-none focus:border-sky-500">
                        <option value="th-TH-PremwadeeNeural">หญิง (Premwadee)</option>
                        <option value="th-TH-NiwatNeural">ชาย (Niwat)</option>
                    </select>
                    <select id="setTestRoom" class="flex-1 min-w-[140px] bg-slate-900 border border-slate-700 text-white px-2 py-2 rounded-lg text-sm outline-none focus:border-sky-500">
                        <option value="">— เลือกห้องลองฟัง —</option>
                        ${_rooms.map(r => `<option value="${r.id}">${r.name || r.id}</option>`).join('')}
                    </select>
                    <button onclick="ttsTestVoice()" class="bg-emerald-600 hover:bg-emerald-500 text-white px-4 rounded-lg text-sm font-bold flex items-center gap-1"><span class="material-icons text-sm">play_arrow</span> ลอง</button>
                </div>
                <p class="text-xs text-gray-500 mt-1">กดบันทึกก่อน แล้วเลือกห้องเพื่อฟังเสียงตามที่ตั้ง</p>
            </div>
        </div>`;
        const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
        set('setRate', _cfg.speech_rate || '-15%');
        set('setVol', _cfg.volume || '+0%');
        set('setPitch', _cfg.pitch || '+0Hz');
        set('setDedupe', String(_cfg.dedupe_seconds != null ? _cfg.dedupe_seconds : 60));
    }
    window._cfgSet = (k, v) => { _cfg[k] = v; };
    window._cfgToggleChime = () => { _cfg.chime_enabled = !_cfg.chime_enabled; _renderSettings(); };
    window.ttsTestVoice = async function () {
        const voice = document.getElementById('setTestVoice').value;
        const rid = document.getElementById('setTestRoom').value;
        if (!rid) { if (window.Swal) Swal.fire('เลือกห้องก่อน', 'เลือกห้องที่จะให้บอทเข้าไปลองพูด', 'warning'); return; }
        try {
            await appDB.from('settings').upsert([{ key: 'tts_command', value: JSON.stringify({ id: 'c' + Date.now(), room_id: String(rid), text: 'ทดสอบเสียงแจ้งเตือน สวัสดีครับ นี่คือเสียงตัวอย่างตามที่ตั้งค่าไว้', voice_name: voice, repeat: 1 }) }]);
            if (window.Swal) Swal.fire({ icon: 'success', title: 'สั่งลองฟังแล้ว', text: 'บอทจะพูดในห้องที่เลือก (ใช้ค่าเสียงที่บันทึกไว้)', timer: 2600, showConfirmButton: false });
        } catch (e) { if (window.Swal) Swal.fire('ผิดพลาด', e.message, 'error'); }
    };

    // ================= actions ร่วม =================
    window.ttsGroupName = (gi, v) => { _cfg.groups[gi].telegram_group = v; };
    window.ttsPickTgGroup = (gi, el) => {
        const id = el.value;
        _cfg.groups[gi].telegram_group_id = id;
        const opt = el.options[el.selectedIndex];
        _cfg.groups[gi].telegram_group = (opt && id) ? opt.text : '';
        _renderGroups();
    };
    window.ttsAddGroup = () => { _cfg.groups.push(newGroup()); _renderGroups(); };
    window.ttsRemoveGroup = (gi) => { _cfg.groups.splice(gi, 1); if (!_cfg.groups.length) _cfg.groups.push(newGroup()); _renderGroups(); };
    window.ttsShiftToggle = (gi, si) => { _cfg.groups[gi].shifts[si].enabled = !_cfg.groups[gi].shifts[si].enabled; _renderGroups(); };
    window.ttsSF = (gi, si, f, v) => { _cfg.groups[gi].shifts[si][f] = v; };
    window.ttsSearch = (key, term) => { _search[key] = term; _renderChk(key, _roomsOf(key)); };

    function _roomsOf(key) {
        if (key.indexOf('sc-') === 0) { const i = +key.split('-')[1]; return _cfg.schedules[i].rooms; }
        const [gi, si] = key.split('-').map(Number); return _cfg.groups[gi].shifts[si].rooms;
    }
    function _reRoom(key) {
        if (key.indexOf('sc-') === 0) { const i = +key.split('-')[1]; _renderChk(key, _cfg.schedules[i].rooms); _renderSel('sc', i, null); }
        else { const [gi, si] = key.split('-').map(Number); _renderChk(key, _cfg.groups[gi].shifts[si].rooms); _renderSel('g', gi, si); }
    }

    window.ttsChkRoom = (key, roomId, el) => {
        const rooms = _roomsOf(key);
        const idx = rooms.findIndex(r => String(r.id) === String(roomId));
        if (el.checked && idx === -1) rooms.push({ id: String(roomId), text: '' });
        else if (!el.checked && idx !== -1) rooms.splice(idx, 1);
        _reRoom(key);
    };
    window.ttsAddByNum = (kind, a, b) => {
        const key = (kind === 'sc') ? ('sc-' + a) : (a + '-' + b);
        const inp = document.getElementById('num_' + key);
        const val = (inp && inp.value.trim()) || '';
        if (!val) return;
        let room = _rooms.find(r => String(r.id) === val) || _rooms.find(r => (r.name || '').trim() === val) || _rooms.find(r => (r.name || '').trim().startsWith(val + ' ') || (r.name || '').trim().startsWith(val));
        if (!room) { if (window.Swal) Swal.fire('ไม่พบห้อง', 'ไม่พบห้อง: ' + val, 'warning'); return; }
        const rooms = _roomsOf(key);
        if (!rooms.some(r => String(r.id) === String(room.id))) rooms.push({ id: String(room.id), text: '' });
        if (inp) inp.value = '';
        _reRoom(key);
    };
    window.ttsDelRoom = (kind, a, b, ri) => { const rooms = (kind === 'sc') ? _cfg.schedules[a].rooms : _cfg.groups[a].shifts[b].rooms; rooms.splice(ri, 1); _reRoom(kind === 'sc' ? ('sc-' + a) : (a + '-' + b)); };
    window.ttsRoomText = (kind, a, b, ri, v) => { const rooms = (kind === 'sc') ? _cfg.schedules[a].rooms : _cfg.groups[a].shifts[b].rooms; if (rooms[ri]) rooms[ri].text = v; };
    // 📌 เลือกบอทประจำห้อง (โหมดกำหนดเอง) — ค่าว่าง = ให้ระบบแบ่งอัตโนมัติ
    window.ttsRoomBot = (kind, a, b, ri, v) => { const rooms = (kind === 'sc') ? _cfg.schedules[a].rooms : _cfg.groups[a].shifts[b].rooms; if (rooms[ri]) rooms[ri].bot_id = v || ''; _reRoom(kind === 'sc' ? ('sc-' + a) : (a + '-' + b)); };

    // schedule actions
    window.ttsAddSched = () => { _cfg.schedules.push(newSched()); _renderSchedules(); };
    window.ttsDelSched = (i) => { _cfg.schedules.splice(i, 1); _renderSchedules(); };
    window.ttsScToggle = (i) => { _cfg.schedules[i].enabled = !_cfg.schedules[i].enabled; _renderSchedules(); };
    window.ttsScField = (i, f, v) => { _cfg.schedules[i][f] = v; };

    // ================= แผง: กองบอท (Multi-Bot) =================
    function _botStatusBadge(b) {
        const lv = botLive(b.id);
        const on = lv && lv.online && isFresh(lv.updated_at || (_status && _status.updated_at));
        if (!b.enabled) return `<span class="text-xs font-bold text-gray-500 bg-slate-700/60 rounded-full px-3 py-1">ปิดใช้งาน</span>`;
        if (!b._main && !(b.token || '').trim()) return `<span class="text-xs font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-full px-3 py-1">ยังไม่ใส่ Token</span>`;
        if (!on) return `<span class="text-xs font-bold text-gray-400 bg-slate-700/60 rounded-full px-3 py-1">● ออฟไลน์</span>`;
        if (lv.current_room) return `<span class="text-xs font-bold text-sky-300 bg-sky-500/10 border border-sky-500/30 rounded-full px-3 py-1 animate-pulse">🔊 ${esc(lv.current_room)}</span>`;
        return `<span class="text-xs font-bold text-green-300 bg-green-500/10 border border-green-500/30 rounded-full px-3 py-1">● ออนไลน์ พร้อมพูด</span>`;
    }
    function _refreshBotLiveBadges() {
        const all = [...(_cfg.bots || [])];
        if (hasMainBot()) all.push(mainBotInfo());
        all.forEach(b => {
            const el = document.getElementById('botLive_' + b.id);
            if (el) el.innerHTML = _botStatusBadge(b);
            const spoke = document.getElementById('botSpoke_' + b.id);
            const lv = botLive(b.id);
            if (spoke) spoke.textContent = (lv && lv.last_spoke_at) ? ('พูดล่าสุด ' + lv.last_spoke_at.slice(11, 16)) : '';
        });
    }

    function _renderBots() {
        const wrap = document.getElementById('ttsPane_bots');
        if (!wrap) return;
        const bots = _cfg.bots || [];
        const withMain = hasMainBot();
        const total = bots.length + (withMain ? 1 : 0);
        let nOn = bots.filter(b => { const lv = botLive(b.id); return b.enabled && lv && lv.online && isFresh(lv.updated_at || (_status && _status.updated_at)); }).length;
        const mLive = botLive('main');
        if (withMain && mLive && mLive.online && isFresh(mLive.updated_at || (_status && _status.updated_at))) nOn++;
        const auto = _cfg.dispatch_mode !== 'manual';

        let html = `
        <!-- สรุป + โหมดแบ่งห้อง -->
        <div class="rounded-3xl border border-violet-500/30 bg-gradient-to-br from-slate-800/60 to-violet-950/30 p-4 space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                    <div class="w-11 h-11 rounded-2xl bg-violet-500/20 border border-violet-500/40 flex items-center justify-center"><span class="material-icons text-violet-300">smart_toy</span></div>
                    <div>
                        <div class="text-white font-black">กองบอท ${total ? `(ออนไลน์ ${nOn}/${total})` : ''}</div>
                        <div class="text-xs text-gray-400">ยิ่งมีบอทหลายตัว ยิ่งพูดหลายห้องพร้อมกันได้ — 9 ห้อง + 3 บอท = จบใน 3 รอบแทนที่จะเป็น 9 รอบ</div>
                    </div>
                </div>
                <div class="flex items-center bg-slate-900 rounded-xl border border-slate-700 p-1 gap-1">
                    <button onclick="ttsDispatchMode('auto')" class="px-3 py-1.5 rounded-lg text-sm font-bold transition ${auto ? 'bg-violet-500 text-white shadow' : 'text-gray-400 hover:text-white'}">🎲 แบ่งอัตโนมัติ</button>
                    <button onclick="ttsDispatchMode('manual')" class="px-3 py-1.5 rounded-lg text-sm font-bold transition ${!auto ? 'bg-violet-500 text-white shadow' : 'text-gray-400 hover:text-white'}">📌 กำหนดเอง</button>
                </div>
            </div>
            <div class="text-xs rounded-xl px-3 py-2 ${auto ? 'bg-violet-500/10 text-violet-200 border border-violet-500/20' : 'bg-amber-500/10 text-amber-200 border border-amber-500/20'}">
                ${auto
                    ? '🎲 <b>แบ่งอัตโนมัติ:</b> เวลาต้องพูดหลายห้อง ระบบจะกระจายห้องให้บอทที่ออนไลน์ทุกตัวช่วยกันพูดพร้อมกันเอง ไม่ต้องตั้งอะไรเพิ่ม'
                    : '📌 <b>กำหนดเอง:</b> เลือกบอทประจำห้องได้ที่กล่อง "ห้องที่เลือก" ในแท็บ กลุ่ม &amp; กะ / ตั้งเวลาพูด — ห้องที่ไม่ได้เลือกบอท ระบบจะแบ่งให้อัตโนมัติเหมือนเดิม'}
            </div>
        </div>`;

        // 🎩 การ์ดบอทหลัก (Railway ENV) — โชว์เสมอถ้าบอทรายงานสถานะเข้ามา เลือกใช้/ทดสอบได้ แต่ Token แก้ที่ Railway
        if (withMain) {
            const mb = mainBotInfo();
            html += `
            <div class="bg-slate-900 rounded-2xl border p-3 space-y-2" style="border-color:#E8C15A55;background:linear-gradient(135deg,rgba(232,193,90,0.05),transparent 60%)">
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="inline-flex rounded-full flex-shrink-0" style="width:14px;height:14px;background:#E8C15A;box-shadow:0 0 8px #E8C15A66"></span>
                    <span class="text-white font-bold px-1">${esc(mb.name)}</span>
                    <span class="text-[10px] font-black rounded-full px-2 py-0.5" style="background:#E8C15A22;color:#E8C15A;border:1px solid #E8C15A55">🎩 บอทหลัก — Token อยู่บน Railway</span>
                    <span id="botLive_main">${_botStatusBadge(mb)}</span>
                    <span id="botSpoke_main" class="text-gray-500 text-xs">${(() => { const lv = botLive('main'); return (lv && lv.last_spoke_at) ? ('พูดล่าสุด ' + lv.last_spoke_at.slice(11, 16)) : ''; })()}</span>
                    <div class="ml-auto flex items-center gap-1.5">
                        <button onclick="ttsBotTest('main')" class="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1" title="ให้บอทหลักลองพูด"><span class="material-icons text-sm">play_arrow</span> ทดสอบ</button>
                    </div>
                </div>
                <p class="text-[11px] text-gray-500 pl-1">ตัวนี้มากับเซิร์ฟเวอร์ (ENV: DISCORD_TOKEN) ปิด/ลบจากหน้านี้ไม่ได้ — ผูกห้องประจำในโหมดกำหนดเองได้ตามปกติ</p>
            </div>`;
        }

        if (!bots.length && !withMain) {
            html += `<div class="text-center text-gray-500 py-8 bg-slate-800/40 rounded-2xl border border-slate-700">
                ยังไม่มีบอทในกองเลย — กด "เพิ่มบอท" แล้ววาง Token ของบอท Discord แต่ละตัว<br>
                <span class="text-xs">(สร้างบอทเพิ่มได้ที่ discord.com/developers → New Application → Bot → เชิญเข้าเซิร์ฟเวอร์ก่อน)</span>
            </div>`;
        }

        bots.forEach((b, i) => {
            const vis = !!_tokenVis[b.id];
            html += `
            <div class="bg-slate-900 rounded-2xl border ${b.enabled ? 'border-slate-600' : 'border-slate-800 opacity-70'} p-3 space-y-2.5">
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="inline-flex rounded-full flex-shrink-0" style="width:14px;height:14px;background:${b.color};box-shadow:0 0 8px ${b.color}66"></span>
                    <input type="text" value="${esc(b.name)}" oninput="ttsBotField('${b.id}','name',this.value)" placeholder="ชื่อบอท เช่น บอทตัวที่ 1" class="w-40 bg-slate-800 border border-slate-700 text-white font-bold px-3 py-1.5 rounded-lg text-sm outline-none focus:border-violet-500">
                    <span id="botLive_${b.id}">${_botStatusBadge(b)}</span>
                    <span id="botSpoke_${b.id}" class="text-gray-500 text-xs">${(() => { const lv = botLive(b.id); return (lv && lv.last_spoke_at) ? ('พูดล่าสุด ' + lv.last_spoke_at.slice(11, 16)) : ''; })()}</span>
                    <div class="ml-auto flex items-center gap-1.5">
                        <button onclick="ttsBotTest('${b.id}')" class="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1" title="ให้บอทตัวนี้ลองพูด"><span class="material-icons text-sm">play_arrow</span> ทดสอบ</button>
                        <button onclick="ttsBotToggle('${b.id}')" style="width:44px;height:22px;" class="relative rounded-full transition ${b.enabled ? 'bg-green-500' : 'bg-slate-600'}" title="เปิด/ปิดใช้บอทตัวนี้"><span class="absolute rounded-full bg-white transition-all" style="width:18px;height:18px;top:2px;left:${b.enabled ? '24px' : '2px'};"></span></button>
                        <button onclick="ttsDelBot('${b.id}')" class="text-gray-500 hover:text-red-400 p-1"><span class="material-icons text-lg">delete</span></button>
                    </div>
                </div>
                <div class="flex gap-2">
                    <div class="relative flex-1">
                        <input type="${vis ? 'text' : 'password'}" value="${esc(b.token)}" oninput="ttsBotField('${b.id}','token',this.value)" placeholder="Bot Token (จาก Discord Developer Portal)" autocomplete="off" class="w-full bg-slate-800 border border-slate-700 text-sky-200 font-mono text-xs px-3 py-2 pr-10 rounded-lg outline-none focus:border-violet-500">
                        <button onclick="ttsBotTokenVis('${b.id}')" class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"><span class="material-icons text-base">${vis ? 'visibility_off' : 'visibility'}</span></button>
                    </div>
                    <div class="flex items-center gap-1" title="สีประจำบอท (ใช้แยกตาในหน้าเว็บ)">
                        ${BOT_COLORS.map(c => `<button onclick="ttsBotField('${b.id}','color','${c}');ttsRenderBots()" class="rounded-full transition hover:scale-125" style="width:14px;height:14px;background:${c};${b.color === c ? 'outline:2px solid #fff;outline-offset:1px' : ''}"></button>`).join('')}
                    </div>
                </div>
            </div>`;
        });

        html += `<button onclick="ttsAddBot()" class="w-full py-2.5 rounded-2xl border-2 border-dashed border-violet-500/40 text-violet-300 hover:bg-violet-500/10 transition font-bold text-sm flex items-center justify-center gap-1"><span class="material-icons">add</span> เพิ่มบอท</button>
        <p class="text-xs text-gray-500 px-1">💡 บอททุกตัวต้องถูก<b>เชิญเข้าเซิร์ฟเวอร์ Discord เดียวกัน</b>ก่อน (สิทธิ์ Connect + Speak) — ใส่ Token แล้วกด "บันทึกการตั้งค่า" ด้านล่าง เซิร์ฟเวอร์บอทจะสตาร์ทตัวใหม่ให้เองภายในไม่กี่วินาที</p>`;
        wrap.innerHTML = html;
    }
    window.ttsRenderBots = _renderBots;
    window.ttsDispatchMode = (m) => { _cfg.dispatch_mode = (m === 'manual') ? 'manual' : 'auto'; _renderBots(); };
    window.ttsAddBot = () => { _cfg.bots = _cfg.bots || []; _cfg.bots.push(newBot(_cfg.bots.length)); _renderBots(); };
    window.ttsBotField = (id, f, v) => { const b = botById(id); if (b) b[f] = v; };
    window.ttsBotToggle = (id) => { const b = botById(id); if (b) { b.enabled = !b.enabled; _renderBots(); } };
    window.ttsBotTokenVis = (id) => { _tokenVis[id] = !_tokenVis[id]; _renderBots(); };
    window.ttsDelBot = (id) => {
        const b = botById(id);
        const doDel = () => {
            _cfg.bots = (_cfg.bots || []).filter(x => String(x.id) !== String(id));
            // ล้างการผูกห้อง → บอทตัวนี้ (ทั้งกะและตั้งเวลา)
            _cfg.groups.forEach(g => g.shifts.forEach(s => s.rooms.forEach(r => { if (String(r.bot_id) === String(id)) r.bot_id = ''; })));
            _cfg.schedules.forEach(sc => sc.rooms.forEach(r => { if (String(r.bot_id) === String(id)) r.bot_id = ''; }));
            _renderBots();
        };
        if (window.Swal) Swal.fire({ title: 'ลบบอทนี้?', text: (b ? b.name : '') + ' — ห้องที่ผูกกับบอทนี้จะกลับเป็นแบ่งอัตโนมัติ', icon: 'warning', showCancelButton: true, confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#dc2626' }).then(r => { if (r.isConfirmed) doDel(); });
        else doDel();
    };
    // ทดสอบรายบอท: เลือกห้องจาก popup แล้วสั่งพูดด้วยบอทตัวนั้นโดยเฉพาะ
    window.ttsBotTest = async function (id) {
        const b = botById(id);
        if (!b) return;
        if (!b._main && !(b.token || '').trim()) { if (window.Swal) Swal.fire('ยังไม่ใส่ Token', 'ใส่ Token ของบอทตัวนี้ก่อน แล้วกดบันทึก', 'warning'); return; }
        if (!_rooms.length) { if (window.Swal) Swal.fire('ยังไม่มีรายชื่อห้อง', 'เข้าแท็บย้ายห้องเพื่อดึงรายชื่อห้องก่อน', 'warning'); return; }
        const { value: rid } = await Swal.fire({
            title: 'ให้ ' + (b.name || 'บอท') + ' พูดห้องไหน?',
            input: 'select',
            inputOptions: Object.fromEntries(_rooms.map(r => [String(r.id), r.name || r.id])),
            inputPlaceholder: '— เลือกห้อง —',
            showCancelButton: true, confirmButtonText: 'พูดเลย', cancelButtonText: 'ยกเลิก',
            background: '#0f172a', color: '#fff', confirmButtonColor: '#7c3aed'
        });
        if (!rid) return;
        try {
            await appDB.from('settings').upsert([{ key: 'tts_command', value: JSON.stringify({ id: 'c' + Date.now(), bot_id: String(b.id), room_id: String(rid), text: 'ทดสอบเสียง ' + (b.name || 'บอท') + ' รายงานตัวครับ', voice_name: 'th-TH-NiwatNeural', repeat: 1 }) }]);
            if (window.Swal) Swal.fire({ icon: 'success', title: 'สั่งแล้ว', text: (b.name || 'บอท') + ' จะพูดในห้อง ' + roomName(rid) + (b._main ? '' : ' (ต้องบันทึก Token ก่อนถึงจะทำงาน)'), timer: 2800, showConfirmButton: false });
        } catch (e) { if (window.Swal) Swal.fire('ผิดพลาด', e.message, 'error'); }
    };

    // ---------- ปุ่มทดสอบ: สั่งบอทพูดทันที ----------
    window.ttsTest = async function (kind, a, b, ri) {
        const rooms = (kind === 'sc') ? _cfg.schedules[a].rooms : _cfg.groups[a].shifts[b].rooms;
        const voice = (kind === 'sc') ? _cfg.schedules[a].voice_name : _cfg.groups[a].shifts[b].voice_name;
        const r = rooms[ri];
        if (!r || !r.id) return;
        if (!(r.text || '').trim()) { if (window.Swal) Swal.fire('ยังไม่มีข้อความ', 'พิมพ์ข้อความให้บอทพูดก่อน', 'warning'); return; }
        try {
            const cmd = { id: 'c' + Date.now(), room_id: String(r.id), text: r.text, voice_name: voice, repeat: 1 };
            if (_cfg.dispatch_mode === 'manual' && r.bot_id) cmd.bot_id = String(r.bot_id);   // 📌 ห้องผูกบอท → ใช้บอทตัวนั้นทดสอบ
            await appDB.from('settings').upsert([{ key: 'tts_command', value: JSON.stringify(cmd) }]);
            const bb = cmd.bot_id ? botById(cmd.bot_id) : null;
            if (window.Swal) Swal.fire({ icon: 'success', title: 'สั่งทดสอบแล้ว', text: (bb ? (bb.name + ' จะพูดในห้อง ') : 'บอทจะพูดในห้อง ') + roomName(r.id) + ' ภายในไม่กี่วินาที', timer: 2500, showConfirmButton: false });
        } catch (e) { if (window.Swal) Swal.fire('ผิดพลาด', e.message, 'error'); }
    };

    // ---------- บันทึก ----------
    window.ttsSaveConfig = async function () {
        _cfg.updated_at = new Date().toISOString();
        try {
            await appDB.from('settings').upsert([{ key: 'tts_voice_config', value: JSON.stringify(_cfg) }]);
            if (window.Swal) Swal.fire({ icon: 'success', title: 'บันทึกแล้ว', text: 'บอทจะอัปเดตภายในไม่กี่วินาที', timer: 2000, showConfirmButton: false });
        } catch (e) { if (window.Swal) Swal.fire('ผิดพลาด', 'บันทึกไม่สำเร็จ: ' + e.message, 'error'); }
    };
})();
// ============================================================
// 🩹 แพตช์ Spy Monitor — แบ่งหน้า (Pagination) 20 ชื่อ/หน้า + ปุ่ม 1-2-3
//   วางต่อท้าย discord.js (บรรทัดล่างสุด) แล้วเซฟ
// * ต้องอยู่ใน discord.js (ไม่ใช่ไฟล์แยก) เพราะใช้ตัวแปร globalSpyData / dsRoomList /
//   spySelectedUsers ที่เป็น scope ของไฟล์นี้
// ============================================================
(function () {
    window.spyRowsPerPage = 20;   // จำนวนชื่อต่อหน้า (ปรับได้ด้วย dropdown)
    window.spyCurrentPage = 1;
    let _spyLastSig = '';

    window.spySetPage = function (n) {
        window.spyCurrentPage = Math.max(1, Number(n) || 1);
        window.ds_renderSpyTable();
    };
    window.spySetPageSize = function (n) {
        window.spyRowsPerPage = Number(n) || 20;
        window.spyCurrentPage = 1;
        window.ds_renderSpyTable();
    };

    // override ตัวเดิม — เพิ่มการตัดหน้า แต่แถวยังหน้าตาเหมือนเดิมเป๊ะ
    window.ds_renderSpyTable = function () {
        const term = document.getElementById('spySearchInput').value.toLowerCase();
        const tbody = document.getElementById('ds_spyBody');
        if (!tbody) return;
        const now = Date.now();

        let roomOptionsHtml = '<option value="">⚡ ย้ายไป..</option>';
        dsRoomList.forEach(c => { roomOptionsHtml += `<option value="${c.id}">${dsEsc(c.name)}</option>`; });

        const filtered = globalSpyData.filter(u => term === '' || u.name.toLowerCase().includes(term));

        // พิมพ์ค้นหาใหม่ → เด้งกลับหน้า 1
        if (term !== _spyLastSig) { _spyLastSig = term; window.spyCurrentPage = 1; }

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center py-6 text-gray-500">ไม่พบรายชื่อพนักงาน</td></tr>';
            window.ds_renderSpyPagination(0);
            return;
        }

        const totalPages = Math.max(1, Math.ceil(filtered.length / window.spyRowsPerPage));
        if (window.spyCurrentPage > totalPages) window.spyCurrentPage = totalPages;
        const start = (window.spyCurrentPage - 1) * window.spyRowsPerPage;
        const pageRows = filtered.slice(start, start + window.spyRowsPerPage);

        tbody.innerHTML = pageRows.map(u => {
            let mute = u.totalMute + (u.startMute ? (now - u.startMute) : 0);
            let deaf = u.totalDeaf + (u.startDeaf ? (now - u.startDeaf) : 0);

            let mStr = '-';
            if (mute > 0) { let mMins = Math.floor(mute / 60000); mStr = mMins > 0 ? `${mMins} นาที` : `< 1 นาที`; }
            let dStr = '-';
            if (deaf > 0) { let dMins = Math.floor(deaf / 60000); dStr = dMins > 0 ? `${dMins} นาที` : `< 1 นาที`; }

            let statusBadges = '';
            if (u.startMute) statusBadges += '<span class="bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded text-[10px] font-bold border border-amber-500/50 mr-1">ปิดไมค์</span>';
            if (u.startDeaf) statusBadges += '<span class="bg-red-500/20 text-red-500 px-2 py-0.5 rounded text-[10px] font-bold border border-red-500/50 mr-1">ปิดหูฟัง</span>';
            if (!statusBadges && u.currentRoom) statusBadges = '<span class="text-gray-500 text-xs">ปกติ</span>';

            let devicesHTML = '';
            let isDouble = false;
            if (u.devices) {
                if (u.devices.includes('desktop')) devicesHTML += '<span title="PC" class="text-lg">💻</span>';
                if (u.devices.includes('web')) devicesHTML += '<span title="Web" class="text-lg">🌐</span>';
                if (u.devices.includes('mobile')) devicesHTML += '<span title="Mobile" class="text-lg">📱</span>';
                if (u.devices.includes('desktop') && u.devices.includes('web')) isDouble = true;
            }
            if (isDouble) devicesHTML += '<span class="bg-red-600 text-white px-2 py-0.5 rounded text-[10px] font-bold ml-2 animate-pulse">ซ้อน 2 จอ!</span>';

            const roomBadge = u.currentRoom ? `<span class="bg-indigo-900/50 text-indigo-300 px-2 py-1 rounded border border-indigo-700/50 text-xs font-bold">${dsEsc(u.currentRoom)}</span>` : '<span class="text-gray-600 text-xs">ออฟไลน์</span>';
            const nameColor = u.currentRoom ? 'text-white' : 'text-gray-500';
            const isChecked = spySelectedUsers.has(u.id) ? 'checked' : '';

            return window.renderTemplate('tpl-ds-spy-row', {
                id: u.id,
                nameColor: nameColor,
                name: dsEsc(u.name),
                roomBadge: roomBadge,
                devicesHTML: devicesHTML,
                statusBadges: statusBadges,
                mStr: mStr,
                dStr: dStr,
                roomOptionsHtml: roomOptionsHtml,
                isChecked: isChecked
            });
        }).join('');

        window.ds_renderSpyPagination(filtered.length);
    };

    // แถบเปลี่ยนหน้า — สร้างต่อท้ายตาราง Spy เอง (ไม่ต้องแก้ discord.html)
    window.ds_renderSpyPagination = function (totalItems) {
        const tbody = document.getElementById('ds_spyBody');
        if (!tbody) return;
        const table = tbody.closest('table');
        const wrapper = table ? (table.closest('.overflow-x-auto') || table.parentElement) : null;
        if (!wrapper) return;

        let bar = document.getElementById('spyPaginationContainer');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'spyPaginationContainer';
            wrapper.insertAdjacentElement('afterend', bar);
        }

        if (totalItems === 0) { bar.innerHTML = ''; return; }

        const totalPages = Math.max(1, Math.ceil(totalItems / window.spyRowsPerPage));
        const cur = window.spyCurrentPage;
        const from = (cur - 1) * window.spyRowsPerPage + 1;
        const to = Math.min(cur * window.spyRowsPerPage, totalItems);

        const nums = [];
        const push = (n) => {
            const active = n === cur;
            nums.push(`<button onclick="window.spySetPage(${n})" class="min-w-[32px] h-[32px] px-2 rounded-lg text-xs font-bold transition active:scale-95 ${active ? 'bg-red-500 text-white border border-red-400' : 'bg-slate-800 text-gray-300 border border-slate-600 hover:bg-slate-700'}">${n}</button>`);
        };
        const dots = () => nums.push('<span class="text-gray-600 px-1 select-none">…</span>');
        if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) push(i); }
        else {
            push(1);
            if (cur > 3) dots();
            for (let i = Math.max(2, cur - 1); i <= Math.min(totalPages - 1, cur + 1); i++) push(i);
            if (cur < totalPages - 2) dots();
            push(totalPages);
        }

        const navBtn = (label, target, disabled) =>
            `<button onclick="window.spySetPage(${target})" ${disabled ? 'disabled' : ''} class="h-[32px] px-3 rounded-lg text-xs font-bold transition active:scale-95 ${disabled ? 'bg-slate-800/40 text-gray-600 border border-slate-700 cursor-not-allowed' : 'bg-slate-800 text-gray-300 border border-slate-600 hover:bg-slate-700'}">${label}</button>`;

        const sizeOpt = (n) => `<option value="${n}"${window.spyRowsPerPage === n ? ' selected' : ''}>${n}</option>`;

        bar.innerHTML = `
          <div class="flex flex-wrap items-center justify-between gap-3 mt-4 p-3 bg-[#151f32] rounded-xl border border-slate-700/80 shadow-md">
            <div class="flex items-center gap-2 text-xs text-gray-400 font-bold">
              <span>แสดง</span>
              <select onchange="window.spySetPageSize(this.value)" class="bg-slate-900 border border-slate-600 text-white rounded-lg px-2 py-1.5 text-xs outline-none focus:border-red-500">
                ${[20, 50, 100].map(sizeOpt).join('')}
              </select>
              <span>ชื่อ/หน้า</span>
              <span class="text-gray-600 mx-1">·</span>
              <span><b class="text-red-400">${from}-${to}</b> จาก <b class="text-white">${totalItems}</b> คน</span>
            </div>
            <div class="flex items-center gap-1.5 flex-wrap">
              ${navBtn('‹ ก่อนหน้า', cur - 1, cur <= 1)}
              ${nums.join('')}
              ${navBtn('ถัดไป ›', cur + 1, cur >= totalPages)}
            </div>
          </div>`;
    };
})();
