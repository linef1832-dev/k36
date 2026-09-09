// ════════════════════════════════════════════════════════════════════
// 📦 discord/breaktrack.js — ส่วนที่ 4/5 ของหน้า Discord (แยกมาจาก discord.js เดิม)
// เนื้อหา: ระบบติดตามการพัก (Breaktrack), กลุ่ม Telegram + TAG, แบ่งหน้า/เรียงตารางเช็คอิน
// ⚠️ ลำดับโหลด (กำหนดใน PAGE_SCRIPTS ของ global.js): discord/core → history → message → breaktrack → tts
// ตัวแปร/ฟังก์ชันแชร์ข้ามไฟล์กันได้ตามปกติ (top-level scope เดียวกัน)
// ════════════════════════════════════════════════════════════════════
// ============================================================
// ☕ ระบบติดตามการพัก (Breaktrack) — ดึงจาก break_sessions
// ============================================================

let _breaktrackData = []; // raw data จาก Supabase

// กำหนดเวลาสูงสุดแต่ละประเภท (นาที)
const BREAK_LIMITS = {
    'กินข้าว': 30, 'ทานข้าว': 30,
    'ปวดหนัก': 20, 'ห้องน้ำใหญ่': 20,
    'ปวดน้อย': 6,  'ห้องน้ำเล็ก': 6,
};

function getBreakLimit(reason) {
    if (!reason) return null;
    for (const [key, limit] of Object.entries(BREAK_LIMITS)) {
        if (reason.includes(key)) return limit;
    }
    return null;
}

function breakDurationMin(start, end) {
    if (!start) return null;
    const s = new Date(start);
    const e = end ? new Date(end) : new Date();
    return Math.round((e - s) / 60000);
}

function formatMin(min) {
    if (min === null || min === undefined) return '-';
    if (min < 60) return `${min} นาที`;
    return `${Math.floor(min / 60)} ชม. ${min % 60} นาที`;
}

window.initBreaktrack = function() {
    // ตั้งวันที่วันนี้
    const dateInput = document.getElementById('breaktrackDate');
    if (dateInput && !dateInput.value) {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        dateInput.value = new Date(now - offset).toISOString().slice(0, 10);
    }
    window.loadBreaktrack();
};

window.loadBreaktrack = async function() {
    const dateInput = document.getElementById('breaktrackDate');
    const date = dateInput ? dateInput.value : '';
    if (!date) return;

    document.getElementById('breaktrackLoading').classList.remove('hidden');
    document.getElementById('breaktrackTableBody').innerHTML = '';
    document.getElementById('breaktrackSummary').innerHTML = '';

    try {
        // [FIX] โหลดรายชื่อพนักงานก่อนเสมอ — คอลัมน์ "กะ" กับตัวกรองกะดึงค่าจาก
        // GLOBAL_USER_LIST ถ้าเข้าหน้านี้ตรง ๆ โดยยังไม่มีหน้าไหนโหลดไว้ ตัวแปรจะว่าง
        // ทำให้ทุกคนได้กะเป็น '-' และกรองกะแล้วตารางว่างเปล่า
        // getUsersCached มีแคชในตัว (TTL) เรียกซ้ำไม่เปลืองโหลด
        // [สำคัญ] global.js ประกาศ GLOBAL_USER_LIST ด้วย let ซึ่งตามกฎ JavaScript
        // จะ "ไม่" ผูกกับ window ส่วนไฟล์นี้อ่านผ่าน window.GLOBAL_USER_LIST
        // สองตัวนี้จึงคนละตัวกัน ทำให้ window.GLOBAL_USER_LIST เป็น undefined ตลอด
        // → ต้องรับค่าที่ getUsersCached คืนมา แล้วเซ็ตลง window เองด้วย
        if (typeof window.getUsersCached === 'function') {
            try {
                const _users = await window.getUsersCached();
                if (Array.isArray(_users) && _users.length > 0) {
                    window.GLOBAL_USER_LIST = _users;
                }
            } catch(e) {
                console.warn('[Breaktrack] โหลดรายชื่อพนักงานไม่สำเร็จ — คอลัมน์กะจะแสดงเป็น -', e);
            }
        }
        // สำรอง: ถ้ายังว่างอยู่ (getUsersCached ไม่มี/ล้มเหลว) ดึงตรงจากฐานข้อมูล
        if (!window.GLOBAL_USER_LIST || window.GLOBAL_USER_LIST.length === 0) {
            try {
                const { data: _u } = await appDB.from('users').select('*');
                if (_u && _u.length) window.GLOBAL_USER_LIST = _u;
            } catch(e) { console.warn('[Breaktrack] ดึงรายชื่อสำรองไม่สำเร็จ', e); }
        }

        const { data, error } = await appDB
            .from('break_sessions')
            .select('*')
            .eq('break_date', date)
            .order('break_start', { ascending: true });

        if (error) throw error;
        _breaktrackData = data || [];
        window.renderBreaktrackTable();
    } catch(e) {
        console.error('[Breaktrack] load error:', e);
        document.getElementById('breaktrackTableBody').innerHTML = `
            <tr><td colspan="8" class="text-center py-8 text-red-400 font-bold">โหลดข้อมูลไม่ได้ครับ</td></tr>`;
    } finally {
        document.getElementById('breaktrackLoading').classList.add('hidden');
    }
};

// ── แบ่งหน้าตารางเช็คอิน ────────────────────────────────────────────────
let _btPage = 1;              // หน้าปัจจุบัน
let _btPageSize = 20;         // จำนวนต่อหน้า
let _btLastSig = '';          // ลายเซ็นตัวกรอง — ถ้าเปลี่ยนให้เด้งกลับหน้า 1
let _btSortKey = '';          // '' = ไม่เรียง (เรียงตามเดิม) | 'count' | 'totalMin'
let _btSortDir = 'desc';      // 'desc' = มากไปน้อย | 'asc' = น้อยไปมาก

// กดหัวคอลัมน์เพื่อเรียง — กดซ้ำสลับทิศ กดรอบที่ 3 ยกเลิกการเรียง
window.btToggleSort = function(key) {
    if (_btSortKey !== key) { _btSortKey = key; _btSortDir = 'desc'; }
    else if (_btSortDir === 'desc') { _btSortDir = 'asc'; }
    else { _btSortKey = ''; _btSortDir = 'desc'; }
    _btPage = 1;
    window.renderBreaktrackTable();
};

window.btSetPage = function(n) {
    _btPage = Math.max(1, Number(n) || 1);
    window.renderBreaktrackTable();
    // เลื่อนขึ้นเฉพาะตอนหัวตารางหลุดออกนอกจอ — กันหน้าจอกระโดดโดยไม่จำเป็น
    const el = document.getElementById('breaktrackTableBody');
    const tb = el ? el.closest('table') : null;
    if (tb) {
        const top = tb.getBoundingClientRect().top;
        if (top < 0) tb.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
};

window.btSetPageSize = function(n) {
    _btPageSize = Number(n) || 20;
    _btPage = 1;
    window.renderBreaktrackTable();
};

window.renderBreaktrackTable = function() {
    const shiftFilter = document.getElementById('breaktrackShift')?.value || 'all';
    const search = (document.getElementById('breaktrackSearch')?.value || '').toLowerCase();

    // กลุ่มข้อมูลตามชื่อพนักงาน
    const grouped = {};
    _breaktrackData.forEach(row => {
        if (!grouped[row.staff_name]) grouped[row.staff_name] = [];
        grouped[row.staff_name].push(row);
    });

    // เอา user info จาก GLOBAL_USER_LIST
    const rows = Object.entries(grouped).map(([name, sessions]) => {
        const user = (window.GLOBAL_USER_LIST || []).find(u =>
            u.username && u.username.toLowerCase() === name.toLowerCase()
        );
        const shift = user?.allowed_shift || '-';
        const dept = user?.department || '-';

        // filter กะ
        if (shiftFilter !== 'all' && shift !== shiftFilter) return null;
        // filter search
        if (search && !name.toLowerCase().includes(search)) return null;

        let totalMin = 0;
        let overCount = 0;
        let noReturnCount = 0;
        const activityCount = {};

        sessions.forEach(s => {
            const dur = breakDurationMin(s.break_start, s.break_end);
            if (dur !== null) totalMin += dur;
            if (!s.break_end) noReturnCount++;

            // นับประเภท
            const reason = s.break_reason || 'อื่นๆ';
            activityCount[reason] = (activityCount[reason] || 0) + 1;

            // เช็คเกินเวลา
            if (s.break_end) {
                const limit = getBreakLimit(s.break_reason);
                if (limit && dur > limit) overCount++;
            }
        });

        const activitySummary = Object.entries(activityCount)
            .map(([r, c]) => `${r} (${c})`)
            .join(', ');

        return { name, shift, dept, sessions, totalMin, overCount, noReturnCount, activitySummary, count: sessions.length };
    }).filter(Boolean);

    // Summary
    const totalStaff = rows.length;
    const totalBreaks = rows.reduce((a, r) => a + r.count, 0);
    const totalOver = rows.reduce((a, r) => a + r.overCount, 0);
    const totalNoReturn = rows.reduce((a, r) => a + r.noReturnCount, 0);

    document.getElementById('breaktrackSummary').innerHTML = `
        <div class="bg-slate-900 border border-slate-700 rounded-2xl p-4 text-center">
            <div class="text-2xl font-black text-white">${totalStaff}</div>
            <div class="text-xs text-gray-400 font-bold mt-1">พนักงานทั้งหมด</div>
        </div>
        <div class="bg-sky-500/10 border border-sky-500/30 rounded-2xl p-4 text-center">
            <div class="text-2xl font-black text-sky-400">${totalBreaks}</div>
            <div class="text-xs text-sky-400 font-bold mt-1">ครั้งรวม</div>
        </div>
        <div class="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-center">
            <div class="text-2xl font-black text-red-400">${totalOver}</div>
            <div class="text-xs text-red-400 font-bold mt-1">เกินเวลา</div>
        </div>
        <div class="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-center">
            <div class="text-2xl font-black text-amber-400">${totalNoReturn}</div>
            <div class="text-xs text-amber-400 font-bold mt-1">ไม่กดกลับ</div>
        </div>`;

    // ── เรียงลำดับตามคอลัมน์ที่กด ──────────────────────────────────────
    if (_btSortKey) {
        const dir = _btSortDir === 'asc' ? 1 : -1;
        rows.sort((a, b) => {
            const diff = ((a[_btSortKey] || 0) - (b[_btSortKey] || 0)) * dir;
            // ถ้าเท่ากัน เรียงตามชื่อ เพื่อให้ลำดับคงที่ไม่สลับไปมา
            return diff !== 0 ? diff : String(a.name).localeCompare(String(b.name));
        });
    }
    window._btRenderSortHeaders();

    // ── แบ่งหน้า ──────────────────────────────────────────────────────
    // ถ้าตัวกรอง (วันที่ / กะ / คำค้น) เปลี่ยน ให้เด้งกลับหน้า 1 อัตโนมัติ
    const _sig = `${document.getElementById('breaktrackDate')?.value || ''}|${shiftFilter}|${search}`;
    if (_sig !== _btLastSig) { _btLastSig = _sig; _btPage = 1; }

    const totalPages = Math.max(1, Math.ceil(rows.length / _btPageSize));
    if (_btPage > totalPages) _btPage = totalPages;
    const startIdx = (_btPage - 1) * _btPageSize;
    const pageRows = rows.slice(startIdx, startIdx + _btPageSize);

    window._btRenderPager(rows.length, totalPages, startIdx, pageRows.length);

    if (rows.length === 0) {
        document.getElementById('breaktrackTableBody').innerHTML = `
            <tr><td colspan="8" class="text-center py-10 text-gray-500 font-bold">ไม่พบข้อมูลครับ</td></tr>`;
        return;
    }

    document.getElementById('breaktrackTableBody').innerHTML = pageRows.map(r => `
        <tr class="hover:bg-slate-700/30 transition">
            <td class="px-4 py-3 font-bold text-white text-center truncate" title="${r.name}">${r.name}</td>
            <td class="px-4 py-3 text-center">
                <span class="text-xs px-2 py-1 rounded-full font-bold ${r.shift === 'กะเช้า' ? 'bg-yellow-500/20 text-yellow-400' : r.shift === 'กะดึก' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-700 text-gray-400'}">${r.shift}</span>
            </td>
            <td class="px-4 py-3 text-gray-300 text-xs text-center break-words" title="${r.activitySummary}">${r.activitySummary}</td>
            <td class="px-4 py-3 text-center font-bold text-sky-400">${r.count}</td>
            <td class="px-4 py-3 text-center font-bold text-white">${formatMin(r.totalMin)}</td>
            <td class="px-4 py-3 text-center">
                ${r.overCount > 0
                    ? `<span class="bg-red-500/20 text-red-400 font-black text-xs px-2 py-1 rounded-full">${r.overCount} ครั้ง</span>`
                    : `<span class="text-emerald-400 font-bold text-xs">✅ ปกติ</span>`}
            </td>
            <td class="px-4 py-3 text-center">
                ${r.noReturnCount > 0
                    ? `<span class="bg-amber-500/20 text-amber-400 font-black text-xs px-2 py-1 rounded-full">⚠️ ${r.noReturnCount} ครั้ง</span>`
                    : `<span class="text-emerald-400 font-bold text-xs">✅ ครบ</span>`}
            </td>
            <td class="px-4 py-3 text-center">
                <button onclick="window.openBreaktrackDetail('${r.name}')" class="bg-slate-600 hover:bg-slate-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition active:scale-95">
                    <span class="material-icons text-xs">list</span> ดู
                </button>
            </td>
        </tr>
    `).join('');
};

window.openBreaktrackDetail = function(staffName) {
    const sessions = _breaktrackData.filter(s => s.staff_name === staffName);
    const user = (window.GLOBAL_USER_LIST || []).find(u =>
        u.username && u.username.toLowerCase() === staffName.toLowerCase()
    );
    const shift = user?.allowed_shift || '-';

    document.getElementById('breaktrackModalTitle').textContent = `${staffName} (${shift}) — รายละเอียดการพัก`;

    const rows = sessions.map(s => {
        const dur = breakDurationMin(s.break_start, s.break_end);
        const limit = getBreakLimit(s.break_reason);
        const isOver = s.break_end && limit && dur > limit;
        const noReturn = !s.break_end;

        const startTime = s.break_start ? new Date(s.break_start).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-';
        const endTime = s.break_end ? new Date(s.break_end).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : null;

        return `
            <div class="bg-slate-900 border ${isOver ? 'border-red-500/50' : noReturn ? 'border-amber-500/50' : 'border-slate-700'} rounded-2xl p-4">
                <div class="flex justify-between items-start mb-2">
                    <span class="font-black text-white">${s.break_reason || 'ไม่ระบุ'}</span>
                    <div class="flex gap-2">
                        ${isOver ? `<span class="bg-red-500/20 text-red-400 text-xs font-bold px-2 py-1 rounded-full">เกินเวลา</span>` : ''}
                        ${noReturn ? `<span class="bg-amber-500/20 text-amber-400 text-xs font-bold px-2 py-1 rounded-full">ไม่กดกลับ</span>` : ''}
                        ${!isOver && !noReturn ? `<span class="bg-emerald-500/20 text-emerald-400 text-xs font-bold px-2 py-1 rounded-full">ปกติ</span>` : ''}
                    </div>
                </div>
                <div class="flex gap-4 text-sm text-gray-400">
                    <span>🕐 ออก: <b class="text-white">${startTime}</b></span>
                    <span>🕐 กลับ: <b class="${noReturn ? 'text-amber-400' : 'text-white'}">${endTime || '⚠️ ยังไม่กลับ'}</b></span>
                    <span>⏱️ ใช้เวลา: <b class="${isOver ? 'text-red-400' : 'text-white'}">${dur !== null ? formatMin(dur) : '-'}${limit ? ` / ${limit} นาที` : ''}</b></span>
                </div>
            </div>`;
    }).join('');

    document.getElementById('breaktrackModalBody').innerHTML = rows || '<p class="text-gray-500 text-center">ไม่มีข้อมูล</p>';
    document.getElementById('breaktrackModal').classList.remove('hidden');
};

// ============================================================
// ============================================================
// ⚙️ ระบบตั้งค่ากลุ่ม Telegram (ตาราง telegram_groups)
// จับคู่กลุ่มด้วย chat_id ไม่ใช่ชื่อ — ชื่อเป็นแค่ป้ายให้คนอ่าน
// ============================================================

window._tgGroupsCache = [];

window.toggleBreakGroupsPanel = function() {
    const panel = document.getElementById('breakGroupsPanel');
    if (!panel) return;
    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        window.loadCheckinGroups();
    } else {
        panel.classList.add('hidden');
    }
};

window.toggleCheckinGroupsPanel = function() {
    const panel = document.getElementById('checkinGroupsPanel');
    if (!panel) return;
    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        window.loadCheckinGroups();
    } else {
        panel.classList.add('hidden');
    }
};

// normalize chat id ให้ตรงกับฝั่งบอท (-1001234567890 กับ 1234567890 = กลุ่มเดียวกัน)
window.normChatId = function(v) {
    let s = String(v == null ? '' : v).trim();
    if (!s) return '';
    s = s.replace(/^-+/, '');
    if (!/^\d+$/.test(s)) return '';
    if (s.startsWith('100') && s.length > 10) s = s.slice(3);
    return s;
};

window.loadCheckinGroups = async function() {
    const listCheckin = document.getElementById('checkinGroupsList_checkin');
    const listShift = document.getElementById('checkinGroupsList_shift');
    if (!listCheckin && !listShift) return;

    const _loadingHtml = '<div class="text-gray-500 text-xs text-center py-2">กำลังโหลด...</div>';
    if (listCheckin) listCheckin.innerHTML = _loadingHtml;
    if (listShift) listShift.innerHTML = _loadingHtml;

    try {
        const { data, error } = await appDB
            .from('telegram_groups')
            .select('*')
            .order('created_at', { ascending: true });
        if (error) throw error;

        window._tgGroupsCache = data || [];

        const renderGroup = (g) => {
            const cid = window.normChatId(g.chat_id);
            const idLine = cid
                ? `<span class="text-gray-500">ID: ${g.chat_id}</span>`
                : `<span class="text-amber-400">ยังไม่ได้ใส่ Chat ID — บอทจะข้ามกลุ่มนี้</span>`;
            const soundLine = (g.group_type === 'shift' && g.sound_id)
                ? `<span class="text-gray-600"> · เสียง ${g.sound_id}</span>` : '';
            const tagLine = (g.group_type === 'shift') ? window.groupTagBadge(g.tag) : '';
            return `
            <div class="flex items-center justify-between bg-slate-800 rounded-xl px-3 py-2 gap-2">
                <div class="flex items-center gap-2 flex-1 min-w-0">
                    <span class="w-2 h-2 rounded-full shrink-0 ${g.active ? 'bg-emerald-400' : 'bg-gray-500'}"></span>
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center min-w-0">
                            <span class="text-white text-xs font-bold truncate">${g.group_name || '(ไม่มีชื่อ)'}</span>${tagLine}
                        </div>
                        <div class="text-[10px] truncate font-mono">${idLine}${soundLine}</div>
                    </div>
                </div>
                <div class="flex gap-1 shrink-0">
                    <button onclick="window.editTelegramGroup('${g.id}')"
                        class="text-xs px-2 py-1 rounded-lg font-bold bg-slate-600 text-gray-200 hover:bg-slate-500 transition">แก้ไข</button>
                    <button onclick="window.toggleCheckinGroup('${g.id}', ${g.active})"
                        class="text-xs px-2 py-1 rounded-lg font-bold transition ${g.active ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'}">
                        ${g.active ? 'ปิด' : 'เปิด'}
                    </button>
                    <button onclick="window.deleteCheckinGroup('${g.id}')"
                        class="text-xs px-2 py-1 rounded-lg font-bold bg-red-500/20 text-red-400 hover:bg-red-500/30 transition">ลบ</button>
                </div>
            </div>`;
        };

        const empty = '<div class="text-gray-500 text-xs text-center py-2">ยังไม่มีกลุ่ม</div>';
        const checkinData = window._tgGroupsCache.filter(g => g.group_type === 'checkin');
        const shiftData = window._tgGroupsCache.filter(g => g.group_type === 'shift');

        if (listCheckin) listCheckin.innerHTML = checkinData.length ? checkinData.map(renderGroup).join('') : empty;
        if (listShift) listShift.innerHTML = shiftData.length ? shiftData.map(renderGroup).join('') : empty;
    } catch(e) {
        const _errHtml = '<div class="text-red-400 text-xs text-center py-2">โหลดไม่ได้ครับ</div>';
        if (listCheckin) listCheckin.innerHTML = _errHtml;
        if (listShift) listShift.innerHTML = _errHtml;
    }
};

window.addCheckinGroup = async function(type) {
    const nameEl = document.getElementById('newGroupName_' + type);
    const idEl = document.getElementById('newGroupChatId_' + type);
    const tagEl = document.getElementById('newGroupTag_' + type);
    const name = nameEl ? nameEl.value.trim() : '';
    const rawId = idEl ? idEl.value.trim() : '';
    const tag = tagEl ? tagEl.value.trim() : '';

    if (!name) return Swal.fire('แจ้งเตือน', 'กรุณาใส่ชื่อกลุ่มก่อนครับ', 'warning');
    if (!rawId) return Swal.fire('แจ้งเตือน', 'กรุณาใส่ Chat ID ด้วยครับ ไม่งั้นบอทจะไม่ดักกลุ่มนี้', 'warning');
    if (!window.normChatId(rawId)) return Swal.fire('Chat ID ไม่ถูกต้อง', 'ต้องเป็นตัวเลขเท่านั้น เช่น -1001234567890', 'error');

    try {
        const row = { group_name: name, active: true, group_type: type, chat_id: rawId };
        if (type === 'shift') row.tag = tag || null;
        const { error } = await appDB.from('telegram_groups').insert(row);
        if (error) throw error;
        if (nameEl) nameEl.value = '';
        if (idEl) idEl.value = '';
        if (tagEl) tagEl.value = '';
        await window.loadCheckinGroups();
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'เพิ่มกลุ่มสำเร็จ', showConfirmButton: false, timer: 1500 });
    } catch(e) {
        Swal.fire('ผิดพลาด', 'เพิ่มกลุ่มไม่ได้ครับ: ' + e.message, 'error');
    }
};

window.editTelegramGroup = async function(id) {
    const g = (window._tgGroupsCache || []).find(x => String(x.id) === String(id));
    if (!g) return;

    const isShift = g.group_type === 'shift';
    const esc = (v) => String(v == null ? '' : v).replace(/"/g, '&quot;');

    // ── สไตล์กลางของทุกช่องในหน้าต่างนี้ ────────────────────────────────
    // เดิมช่องข้อความใช้คลาส swal2-input ส่วนดรอปดาวน์จัดสไตล์เอง
    // สองแบบเลยสูงไม่เท่ากัน สีขอบคนละเฉด ดูไม่เป็นชุด → ใช้สไตล์เดียวกันหมด
    const LB = 'display:block;font-size:11px;font-weight:800;letter-spacing:.4px;color:#94a3b8;margin-bottom:6px;';
    const FD = 'width:100%;box-sizing:border-box;padding:11px 14px;border-radius:10px;'
        + 'border:1.5px solid #334155;background:#0f172a;color:#f1f5f9;font-size:13px;'
        + 'font-weight:600;outline:none;transition:border-color .15s;';
    const ROW = 'text-align:left;margin-top:14px;';
    const field = (label, inner) => `<div style="${ROW}"><label style="${LB}">${label}</label>${inner}</div>`;
    const input = (id, val, ph) =>
        `<input id="${id}" style="${FD}" value="${esc(val)}" placeholder="${esc(ph)}"
            onfocus="this.style.borderColor='#10b981'" onblur="this.style.borderColor='#334155'">`;

    // ดรอปดาวน์ต้องวาดลูกศรเอง เพราะซ่อนลูกศรมาตรฐานของเบราว์เซอร์ไปแล้ว
    const selectHtml = `
        <div style="position:relative">
            <select id="tgEditTag" style="${FD}appearance:none;-webkit-appearance:none;cursor:pointer;padding-right:36px;"
                onfocus="this.style.borderColor='#10b981'" onblur="this.style.borderColor='#334155'">
                ${groupTagOptionsHtml(g.tag)}
            </select>
            <span style="position:absolute;right:14px;top:50%;transform:translateY(-50%);pointer-events:none;color:#64748b;font-size:10px;line-height:1;">&#9660;</span>
        </div>`;

    const result = await Swal.fire({
        title: 'แก้ไขกลุ่ม',
        width: 460,
        html: `
            <div style="padding:2px">
                ${field('ชื่อกลุ่ม <span style="font-weight:500;color:#64748b">(แค่ป้ายชื่อ ระบบใช้ Chat ID จับ)</span>', input('tgEditName', g.group_name, ''))}
                ${field('Chat ID', input('tgEditChatId', g.chat_id, '-1001234567890'))}
                ${!isShift ? '' : field('TAG ที่ต้องถ่ายรูปในกลุ่มนี้', selectHtml)}
                ${!isShift ? '' : `<div style="display:flex;gap:10px">
                    <div style="flex:1">${field('Sound ID', input('tgEditSound', g.sound_id, '1518570639886389378'))}</div>
                    <div style="width:118px">${field('ความยาว (วิ)', input('tgEditDuration', g.sound_duration, '3.5'))}</div>
                </div>`}
            </div>`,
        background: '#1e293b',
        color: '#fff',
        showCancelButton: true,
        confirmButtonText: 'บันทึก',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#475569',
        focusConfirm: false,
        preConfirm: () => {
            const name = document.getElementById('tgEditName').value.trim();
            const chatId = document.getElementById('tgEditChatId').value.trim();
            if (!name) { Swal.showValidationMessage('กรุณาใส่ชื่อกลุ่ม'); return false; }
            if (chatId && !window.normChatId(chatId)) { Swal.showValidationMessage('Chat ID ต้องเป็นตัวเลข'); return false; }
            const out = { group_name: name, chat_id: chatId || null };
            if (isShift) {
                out.tag = document.getElementById('tgEditTag').value.trim() || null;
                const sid = document.getElementById('tgEditSound').value.trim();
                const dur = document.getElementById('tgEditDuration').value.trim();
                if (dur && isNaN(Number(dur))) { Swal.showValidationMessage('ความยาวเสียงต้องเป็นตัวเลข'); return false; }
                out.sound_id = sid || null;
                out.sound_duration = dur ? Number(dur) : null;
            }
            return out;
        }
    });

    if (!result.isConfirmed || !result.value) return;

    try {
        const { error } = await appDB.from('telegram_groups').update(result.value).eq('id', id);
        if (error) throw error;
        await window.loadCheckinGroups();
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'บันทึกแล้ว', showConfirmButton: false, timer: 1500 });
    } catch(e) {
        Swal.fire('ผิดพลาด', 'บันทึกไม่ได้ครับ: ' + e.message, 'error');
    }
};

window.toggleCheckinGroup = async function(id, currentActive) {
    try {
        const { error } = await appDB.from('telegram_groups').update({ active: !currentActive }).eq('id', id);
        if (error) throw error;
        await window.loadCheckinGroups();
    } catch(e) {
        Swal.fire('ผิดพลาด', 'แก้ไขไม่ได้ครับ', 'error');
    }
};

window.deleteCheckinGroup = async function(id) {
    const g = (window._tgGroupsCache || []).find(x => String(x.id) === String(id));
    const confirm = await Swal.fire({
        title: 'ลบกลุ่มนี้?',
        text: g ? g.group_name : '',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'ลบ',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#ef4444'
    });
    if (!confirm.isConfirmed) return;
    try {
        const { error } = await appDB.from('telegram_groups').delete().eq('id', id);
        if (error) throw error;
        await window.loadCheckinGroups();
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'ลบกลุ่มสำเร็จ', showConfirmButton: false, timer: 1500 });
    } catch(e) {
        Swal.fire('ผิดพลาด', 'ลบไม่ได้ครับ', 'error');
    }
};

// ============================================================
// 📄 แถบแบ่งหน้าของตารางเช็คอิน
// สร้างตัวเองด้วย JS ต่อท้ายกล่องตาราง จึงไม่ต้องแก้ pages/discord.html
// ============================================================
window._btRenderPager = function(totalRows, totalPages, startIdx, shownCount) {
    const tbody = document.getElementById('breaktrackTableBody');
    if (!tbody) return;
    const table = tbody.closest('table');
    if (!table) return;
    const wrapper = table.parentElement;   // กล่องที่ครอบตาราง (overflow-x-auto)

    let pager = document.getElementById('breaktrackPager');
    if (!pager) {
        pager = document.createElement('div');
        pager.id = 'breaktrackPager';
        wrapper.insertAdjacentElement('afterend', pager);
    }

    if (totalRows === 0) { pager.innerHTML = ''; return; }

    const from = startIdx + 1;
    const to = startIdx + shownCount;

    // ปุ่มเลขหน้า — ถ้าหน้าเยอะจะย่อด้วย ... เหลือเฉพาะหน้าใกล้ ๆ กับหน้าแรก/สุดท้าย
    const nums = [];
    const push = (n) => {
        const active = n === _btPage;
        nums.push(`<button onclick="window.btSetPage(${n})"
            class="min-w-[34px] h-[34px] px-2 rounded-lg text-xs font-bold transition active:scale-95 ${
                active ? 'bg-emerald-600 text-white border border-emerald-400'
                       : 'bg-slate-800 text-gray-300 border border-slate-600 hover:bg-slate-700'}">${n}</button>`);
    };
    const dots = () => nums.push(`<span class="text-gray-600 px-1 select-none">…</span>`);

    if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) push(i);
    } else {
        push(1);
        if (_btPage > 3) dots();
        for (let i = Math.max(2, _btPage - 1); i <= Math.min(totalPages - 1, _btPage + 1); i++) push(i);
        if (_btPage < totalPages - 2) dots();
        push(totalPages);
    }

    const navBtn = (label, target, disabled) => `
        <button onclick="window.btSetPage(${target})" ${disabled ? 'disabled' : ''}
            class="h-[34px] px-3 rounded-lg text-xs font-bold transition active:scale-95 ${
                disabled ? 'bg-slate-800/40 text-gray-600 border border-slate-700 cursor-not-allowed'
                         : 'bg-slate-800 text-gray-300 border border-slate-600 hover:bg-slate-700'}">${label}</button>`;

    const sizeOpt = (n) => `<option value="${n}"${_btPageSize === n ? ' selected' : ''}>${n}</option>`;

    pager.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-3 mt-4">
        <div class="flex items-center gap-2 text-xs text-gray-400">
          <span>แสดง</span>
          <select onchange="window.btSetPageSize(this.value)"
            class="bg-slate-900 border border-slate-600 text-white rounded-lg px-2 py-1.5 text-xs outline-none focus:border-emerald-500">
            ${[10, 20, 50, 100].map(sizeOpt).join('')}
          </select>
          <span>คนต่อหน้า</span>
          <span class="text-gray-600 mx-1">·</span>
          <span><b class="text-white">${from}-${to}</b> จาก <b class="text-white">${totalRows}</b> คน</span>
        </div>
        <div class="flex items-center gap-1.5 flex-wrap">
          ${navBtn('‹ ก่อนหน้า', _btPage - 1, _btPage <= 1)}
          ${nums.join('')}
          ${navBtn('ถัดไป ›', _btPage + 1, _btPage >= totalPages)}
        </div>
      </div>`;
};

// ============================================================
// ↕️ ทำหัวคอลัมน์ "จำนวนครั้ง" กับ "เวลารวม" ให้กดเรียงได้
// ใส่ลูกศรและ onclick ให้ <th> เดิมด้วย JS จึงไม่ต้องแก้ pages/discord.html
// ============================================================
window._btRenderSortHeaders = function() {
    const tbody = document.getElementById('breaktrackTableBody');
    const table = tbody ? tbody.closest('table') : null;
    if (!table) return;
    const ths = table.querySelectorAll('thead th');
    if (!ths.length) return;

    // ── ล็อกความกว้างคอลัมน์ ──────────────────────────────────────────
    // ปกติเบราว์เซอร์คำนวณความกว้างจากข้อความข้างใน พอเปลี่ยนหน้า/เรียงใหม่
    // ข้อความยาวไม่เท่าเดิม คอลัมน์เลยขยับไปมา
    // table-layout: fixed ทำให้ยึดตามค่าที่กำหนดอย่างเดียว ไม่สนใจข้างใน
    if (!table.dataset.btFixed) {
        table.style.tableLayout = 'fixed';
        table.style.minWidth = '980px';   // แคบกว่านี้ให้เลื่อนแนวนอนแทนการบีบ
        const widths = ['14%', '9%', '24%', '11%', '12%', '10%', '10%', '10%'];
        widths.forEach((w, i) => { if (ths[i]) ths[i].style.width = w; });
        // จัดหัวตารางให้อยู่กึ่งกลางทุกคอลัมน์ ให้ตรงกับเนื้อหาข้างล่าง
        ths.forEach(th => { th.classList.remove('text-left'); th.classList.add('text-center'); });
        table.dataset.btFixed = '1';
    }

    // คอลัมน์ที่ 4 = จำนวนครั้ง, คอลัมน์ที่ 5 = เวลารวม (นับจาก 0)
    const cols = [
        { idx: 3, key: 'count',    label: 'จำนวนครั้ง' },
        { idx: 4, key: 'totalMin', label: 'เวลารวม'    },
    ];

    cols.forEach(({ idx, key, label }) => {
        const th = ths[idx];
        if (!th) return;
        const active = _btSortKey === key;
        // ลูกศร: จางทั้งคู่เมื่อยังไม่ได้เรียง · เน้นข้างที่ใช้อยู่
        const upCls   = active && _btSortDir === 'asc'  ? 'text-emerald-400' : 'text-slate-600';
        const downCls = active && _btSortDir === 'desc' ? 'text-emerald-400' : 'text-slate-600';
        th.className = 'px-4 py-3 text-center cursor-pointer select-none hover:bg-slate-800 transition whitespace-nowrap';
        th.setAttribute('onclick', `window.btToggleSort('${key}')`);
        th.setAttribute('title', 'กดเพื่อเรียง · กดซ้ำสลับมาก-น้อย · กดอีกครั้งยกเลิก');
        th.innerHTML = `
            <span class="inline-flex items-center justify-center gap-1 ${active ? 'text-emerald-400' : ''}">
                ${label}
                <span class="inline-flex flex-col leading-none" style="font-size:8px">
                    <span class="${upCls}">▲</span>
                    <span class="${downCls}">▼</span>
                </span>
            </span>`;
    });
};

// ============================================================
// 🏷️ TAG ของกลุ่มถ่ายรูป
// เก็บในคอลัมน์ tag ของตาราง telegram_groups (1 กลุ่ม = 1 TAG)
// พนักงานที่ติด TAG ไหน ต้องถ่ายรูปในกลุ่มที่ตั้ง TAG นั้นไว้
// ============================================================
const GROUP_TAG_OPTIONS = ['ONLINE', 'TEMP', 'ONSITE'];

function groupTagOptionsHtml(selected) {
    const st = 'background:#0f172a;color:#f1f5f9;';
    return [`<option value="" style="${st}">— ไม่ระบุ —</option>`]
        .concat(GROUP_TAG_OPTIONS.map(t =>
            `<option value="${t}" style="${st}"${String(selected || '') === t ? ' selected' : ''}>${t}</option>`))
        .join('');
}

// ป้าย TAG เล็ก ๆ แสดงข้างชื่อกลุ่มในรายการ
window.groupTagBadge = function(tag) {
    const pill = (txt, color, solid) => `<span style="display:inline-flex;align-items:center;height:15px;`
        + `padding:0 7px;margin-left:8px;border-radius:999px;font-size:8.5px;font-weight:800;`
        + `letter-spacing:.7px;white-space:nowrap;vertical-align:middle;flex-shrink:0;`
        + `background:${solid ? color : color + '1a'};color:${solid ? '#0f172a' : color};`
        + `border:1px solid ${solid ? color : color + '66'};">`
        + `<span style="position:relative;top:.5px;display:block;">${txt}</span></span>`;

    if (!tag) return pill('ยังไม่ตั้ง TAG', '#f59e0b', false);
    const c = { ONLINE:'#4ade80', TEMP:'#fbbf24', ONSITE:'#94a3b8' }[tag] || '#94a3b8';
    return pill(tag, c, true);
};





