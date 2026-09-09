// ════════════════════════════════════════════════════════════════════
// 📦 duty/tools.js — ส่วนที่ 4/6 ของหน้าจัดหน้าที่/เวร (แยกจาก duty.js เดิม 5,478 บรรทัด)
// เนื้อหา: กู้คืนตารางที่ล้างไป, รวมห้อง Discord (AMQL), คำนวณเวลาช่วยเว็บ (AM)
// ⚠️ ลำดับโหลด (PAGE_SCRIPTS ใน global.js): duty/core → duty/dragdrop → duty/roles → duty/tools → duty/support → duty/rotation
// ตัวแปร top-level (currentDutyDept, sortedTeams ฯลฯ) แชร์ข้ามไฟล์กันอัตโนมัติ — scope เดียวกัน
// ════════════════════════════════════════════════════════════════════
// 🌟 ฟังก์ชันกู้คืนตารางงาน (จากที่กดล้างไป)
// ==========================================
window.restoreDutyRoster = async function() {
    const targetDate = document.getElementById('dutyDate').value;
    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    if(!targetDate) return Swal.fire('!', 'กรุณาเลือกวันที่ก่อน', 'warning');

    const saveKey = getDutySaveKey(targetDate, shiftFilter);

    // 💾 [FIX] ดึง backup จาก DB ก่อน ถ้าไม่มีค่อยใช้ของเครื่องนี้
    let backupData = null;
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', `backup_${saveKey}`);
        if (data && data.length > 0 && data[0].value) backupData = data[0].value;
    } catch (e) {}
    if (!backupData) backupData = window.safeGetItem(`backup_${saveKey}`, null);

    if (!backupData) {
        return Swal.fire('ไม่พบข้อมูล', 'ไม่มีข้อมูลสำรองสำหรับกะและวันที่นี้ครับ', 'error');
    }

    Swal.fire({
        title: 'ยืนยันการกู้คืน?',
        text: `ต้องการกู้คืนตารางงานของวันที่ ${targetDate} (${shiftFilter}) ใช่หรือไม่?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'กู้คืนเลย',
        cancelButtonText: 'ยกเลิก',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl' }
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({title: 'กำลังกู้คืนข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
            try {
                window.clearSettingCache(); await appDB.from('settings').upsert([{ key: saveKey, value: backupData }]);
                await appDB.from('system_logs').insert([{ action_type: 'กู้คืนตารางงาน', performed_by: currentUser.username, target_details: `กู้คืนตาราง ${currentDutyDept} (${shiftFilter}, ${targetDate})` }]);
                
                if(appDB.channel) window.debouncedBroadcast('duty-updates', 'force_reload');
                
                Swal.fire({ icon: 'success', title: 'กู้คืนตารางเรียบร้อย', showConfirmButton: false, timer: 1500 });
                if(typeof window.refreshDutyData === 'function') window.refreshDutyData(); 
            } catch (e) {
                Swal.fire('Error', e.message, 'error');
            }
        }
    });
};

// (ลบโค้ดที่ไม่ได้ใช้ออก 298 บรรทัด — แท็บ 'ตั้งค่างานรอง' ถูกลบแล้ว)

// (ลบฟีเจอร์ "แจกโปร/เคส TG" ออกทั้งชุดแล้ว — เลิกใช้งาน)
// ============================================================
// 🏠 ระบบรวมห้อง Discord (AMQL เท่านั้น)
// ============================================================

// เก็บสถานะห้องปัจจุบัน
window.currentMergeRooms = []; // [{id, teams:[]}]
let mergeRoomDragSource = null; // {roomId, team}

// (ลบโค้ดที่ไม่ได้ใช้ออก 7 บรรทัด — modal รวมห้องแบบเก่า ไม่มีปุ่มเรียกแล้ว ใช้แผงซ้ายแทน)

// (ลบโค้ดที่ไม่ได้ใช้ออก 5 บรรทัด — modal รวมห้องแบบเก่า)

// สุ่มจัดกลุ่มเว็บเข้าห้อง
window.shuffleMergeRooms = async function() {
    const targetDate = document.getElementById('dutyDate').value;
    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    const amqlSaveKey = `duty_roster_AMQL_${targetDate}_${shiftFilter}`;

    let amqlRoster = {};
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', amqlSaveKey);
        if (data && data.length > 0 && data[0].value) amqlRoster = JSON.parse(data[0].value);
    } catch(e) {}

    const shuffle = arr => {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    };

    // แยกเว็บที่มี AMQL vs ไม่มี
    const teamsWithAMQL = [];
    const teamsWithoutAMQL = [];
    sortedTeams.forEach(team => {
        const assignees = (amqlRoster[team] || []).filter(u => !u.username?.includes('ขาดคน'));
        if (assignees.length > 0) teamsWithAMQL.push(team);
        else teamsWithoutAMQL.push(team);
    });

    shuffle(teamsWithAMQL);
    shuffle(teamsWithoutAMQL);

    const totalTeams = sortedTeams.length;
    const numRooms = Math.floor(totalTeams / 2); // ห้องละ 2 เว็บเป็นหลัก
    const extraSlots = totalTeams % 2; // เศษ = จำนวนห้องที่ต้องรับเว็บที่ 3

    // สร้างห้องเปล่าก่อน
    const rooms = Array.from({ length: numRooms }, (_, i) => ({ id: i + 1, teams: [] }));

    // ใส่เว็บที่มี AMQL ก่อน — กระจายทีละห้อง
    const amqlQueue = [...teamsWithAMQL];
    const noAmqlQueue = [...teamsWithoutAMQL];

    // รอบที่ 1: ใส่เว็บแรกของแต่ละห้อง (ให้มี AMQL ก่อนถ้ามีพอ)
    rooms.forEach(room => {
        if (amqlQueue.length > 0) room.teams.push(amqlQueue.shift());
        else if (noAmqlQueue.length > 0) room.teams.push(noAmqlQueue.shift());
    });

    // รอบที่ 2: ใส่เว็บที่ 2 ของแต่ละห้อง — ถ้าห้องนั้นมี AMQL แล้ว ใส่อะไรก็ได้
    // ถ้าห้องนั้นยังไม่มี AMQL ต้องใส่เว็บที่มี AMQL เท่านั้น
    rooms.forEach(room => {
        const hasAMQL = room.teams.some(t => teamsWithAMQL.includes(t));
        if (hasAMQL) {
            // ใส่เว็บที่เหลือ ไม่ว่าจะมีหรือไม่มี AMQL
            if (amqlQueue.length > 0) room.teams.push(amqlQueue.shift());
            else if (noAmqlQueue.length > 0) room.teams.push(noAmqlQueue.shift());
        } else {
            // ห้องนี้ยังไม่มี AMQL เลย ต้องใส่เว็บที่มี AMQL เท่านั้น
            if (amqlQueue.length > 0) room.teams.push(amqlQueue.shift());
        }
    });

    // เศษที่เหลือ → ยัดเข้าห้องที่มี AMQL อย่างน้อย 2 เว็บก่อน ถ้าไม่มีค่อยใช้ห้องที่มี AMQL 1 เว็บ
    const remaining = [...amqlQueue, ...noAmqlQueue];
    remaining.forEach(team => {
        // หาห้องที่มี AMQL 2+ ก่อน
        let eligibleRooms = rooms.filter(r => {
            const amqlCount = r.teams.filter(t => teamsWithAMQL.includes(t)).length;
            return amqlCount >= 2;
        });
        // ถ้าไม่มีห้องที่มี AMQL 2+ ใช้ห้องที่มี AMQL 1+ แทน
        if (eligibleRooms.length === 0) {
            eligibleRooms = rooms.filter(r => r.teams.some(t => teamsWithAMQL.includes(t)));
        }
        // ถ้ายังไม่มีเลย ยัดห้องแรกที่เจอ
        if (eligibleRooms.length === 0) eligibleRooms = rooms;

        // เลือกห้องที่มีเว็บน้อยที่สุด
        eligibleRooms.sort((a, b) => a.teams.length - b.teams.length);
        eligibleRooms[0].teams.push(team);
    });

    window.currentMergeRooms = rooms;
    window.renderMergeRoomPanel();
};

// (ลบโค้ดที่ไม่ได้ใช้ออก 47 บรรทัด — modal รวมห้องแบบเก่า)

// Drag & Drop handlers
window.mergeRoomDragStart = function(e, roomId, team) {
    mergeRoomDragSource = { roomId, team };
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.style.opacity = '0.5';
};

window.mergeRoomDragEnd = function(e) {
    e.currentTarget.style.opacity = '1';
    document.querySelectorAll('.merge-room-card').forEach(el => el.classList.remove('border-violet-400', 'bg-violet-900/20'));
};

window.mergeRoomDragOver = function(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const card = e.currentTarget;
    card.classList.add('border-violet-400', 'bg-violet-900/20');
};

// (ลบโค้ดที่ไม่ได้ใช้ออก 19 บรรทัด — modal รวมห้องแบบเก่า)

// สุ่มรวมห้องแบบ inline (ไม่ใช้ modal)
window.shuffleMergeRoomsInline = async function() {
    await window.shuffleMergeRooms();
    window.renderImportantTasksPanel();
};

// บันทึกผลรวมห้อง
window.saveMergeRooms = async function() {
    if (!window.isDutyAdmin()) return;
    const targetDate = document.getElementById('dutyDate').value;
    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    const key = `duty_merge_rooms_${targetDate}_${shiftFilter}`;
    Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        // [FIX] บันทึกลง DB ให้ทุกเครื่อง/ทุกแอดมินเห็นตรงกัน (เดิม localStorage)
        window.clearSettingCache();
        const { error } = await appDB.from('settings').upsert([{ key, value: JSON.stringify(window.currentMergeRooms) }]);
        if (error) throw error;
        window.savedMergeRooms = [...window.currentMergeRooms];
        try {
            await appDB.from('system_logs').insert([{
                action_type: 'รวมห้อง Discord', performed_by: currentUser.username,
                target_details: `บันทึกการรวมห้อง (${shiftFilter}, ${targetDate}) — ` + window.currentMergeRooms.map(r => `ห้อง ${r.id}: ${r.teams.join('+')}`).join(' | ')
            }]);
        } catch (e) {}
        window.debouncedBroadcast('duty-updates', 'force_reload');
        window.renderImportantTasksPanel();
        Swal.fire({ icon: 'success', title: 'บันทึกการรวมห้องแล้ว!', timer: 1500, showConfirmButton: false });
    } catch (e) { Swal.fire('Error', e.message, 'error'); }
};

// ลบผลรวมห้องที่บันทึกไว้
window.deleteMergeRooms = function() {
    Swal.fire({
        title: 'ลบการรวมห้อง?',
        text: 'จะสามารถสุ่มรวมห้องใหม่ได้หลังจากลบ',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'ลบเลย',
        cancelButtonText: 'ยกเลิก'
    }).then(async result => {
        if (result.isConfirmed) {
            const targetDate = document.getElementById('dutyDate').value;
            const shiftFilter = document.getElementById('dutyShiftSelect').value;
            const key = `duty_merge_rooms_${targetDate}_${shiftFilter}`;
            try {
                window.clearSettingCache();
                await appDB.from('settings').delete().eq('key', key);
                try { localStorage.removeItem(key); } catch (e) {}
                try {
                    await appDB.from('system_logs').insert([{ action_type: 'รวมห้อง Discord', performed_by: currentUser.username, target_details: `ลบการรวมห้อง (${shiftFilter}, ${targetDate})` }]);
                } catch (e) {}
                window.debouncedBroadcast('duty-updates', 'force_reload');
            } catch (e) { return Swal.fire('Error', e.message, 'error'); }
            window.savedMergeRooms = [];
            window.currentMergeRooms = [];
            window.renderImportantTasksPanel();
        }
    });
};

// drag & drop inline ใน panel ซ้าย
window.mergeRoomDropInline = function(e, targetRoomId) {
    e.preventDefault();
    document.querySelectorAll('.merge-room-drop').forEach(el => el.classList.remove('bg-violet-900/20'));
    if (!mergeRoomDragSource) return;
    const { roomId: srcRoomId, team } = mergeRoomDragSource;
    if (srcRoomId === targetRoomId) return;

    const rooms = window.currentMergeRooms;
    const srcRoom = rooms.find(r => r.id === srcRoomId);
    const tgtRoom = rooms.find(r => r.id === targetRoomId);
    if (!srcRoom || !tgtRoom) return;

    srcRoom.teams = srcRoom.teams.filter(t => t !== team);
    tgtRoom.teams.push(team);
    mergeRoomDragSource = null;
    window.renderImportantTasksPanel();
};

// ============================================================
// ⏱️ ระบบคำนวณเวลาช่วยเว็บ (AM เท่านั้น)
// ============================================================

// เวลาเริ่ม-สิ้นสุดของแต่ละกะ (นาที นับจาก 00:00)
const SHIFT_CONFIG = {
    'กะเช้า': { start: 8 * 60, end: 20 * 60 },   // 08:00-20:00
    'กะดึก':  { start: 20 * 60, end: 32 * 60 },   // 20:00-08:00 (วันถัดไป = +24h)
};

// แปลงเวลา "HH:MM" → นาทีนับจาก 00:00
function timeToMin(t) {
    if (!t) return null;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
}

// แปลงนาที → "HH:MM"
function minToTime(m) {
    // รองรับข้ามเที่ยงคืน
    const total = ((m % (24 * 60)) + 24 * 60) % (24 * 60);
    const hh = String(Math.floor(total / 60)).padStart(2, '0');
    const mm = String(total % 60).padStart(2, '0');
    return `${hh}:${mm}`;
}

// (ลบโค้ดที่ไม่ได้ใช้ออก 25 บรรทัด — ไม่ถูกเรียก)

// (ลบโค้ดที่ไม่ได้ใช้ออก 4 บรรทัด — ไม่ถูกเรียก)

// render ส่วนคำนวณช่วยเว็บใน panel AM
window.renderHelpCalcPanel = function() {
    const panel = document.getElementById('importantTasksPanel');
    // เฉพาะแผนก AM เท่านั้น — OD ไม่ใช้ระบบซัพพอร์ต/แบ่งเวลานี้
    if (!panel || currentDutyDept !== 'AM') return;

    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    const cfg = SHIFT_CONFIG[shiftFilter];
    if (!cfg) return; // กะที่ไม่รองรับ

    const roster = currentRosterData || {};
    const schedules = window.currentDutySchedules || [];

    const allTeams = sortedTeams || TEAM_LIST;
    const isAdmin = window.isDutyAdmin();

    // 🤝 แผงจัดคนไปซัพพอร์ตเว็บอื่น — เลือกต้นทาง → เป้าหมาย → กดปุ่มเดียวจบ
    // เว็บที่ยังไม่มีคนในตารางวันนี้จะขึ้นวงเล็บบอก จะได้ไม่เลือกไปแล้วเจอ error
    const roster0 = currentRosterData || {};
    const headCount = t => (roster0[t] || []).filter(u => u && u.id && !String(u.username||'').includes('ขาดคน')).length;

    // เว็บที่มีคนจริงเท่านั้นที่ส่งไปช่วยคนอื่นได้ — เอามาเป็นค่าตั้งต้นของช่องต้นทาง
    // ไม่งั้นค่าเริ่มต้นอาจไปตกที่เว็บว่าง แล้วกดปุ่มทีก็เจอ error ทุกที
    const staffedTeams = allTeams.filter(t => headCount(t) > 0);
    const defSource = staffedTeams[0] || allTeams[0];
    const defTarget = allTeams.find(t => t !== defSource) || allTeams[0];

    // ช่วงเวลาที่จะซัพพอร์ต — เริ่มต้นเป็นเต็มกะ แต่ถ้าแอดมินเคยตั้งไว้ในกะนี้ก็ใช้ค่านั้น
    const prefOk = window.supportWindowPref && window.supportWindowPref.shift === shiftFilter;
    const fullStart = minToTime(cfg.start);
    const fullEnd   = minToTime(cfg.end);
    const winStart  = prefOk ? window.supportWindowPref.start : fullStart;
    const winEnd    = prefOk ? window.supportWindowPref.end   : fullEnd;
    const isCustomWin = (winStart !== fullStart || winEnd !== fullEnd);

    const optsFor = (sel, srcMode) => allTeams.map(t => {
        const n = headCount(t);
        // ช่องต้นทาง: เว็บที่ไม่มีคนเลือกไม่ได้ (ไม่มีใครให้ส่งไปช่วย)
        const dis = (srcMode && n === 0) ? 'disabled' : '';
        return `<option value="${t}" ${t === sel ? 'selected' : ''} ${dis}>${t}${n ? ` (${n} คน)` : ' — ว่าง'}</option>`;
    }).join('');

    const assigned = Object.entries(window.currentSupportData || {});
    const assignedHtml = assigned.length === 0
        ? `<div class="text-center text-[10.5px] text-slate-500 py-1.5">ยังไม่มีเว็บไหนได้รับซัพพอร์ต</div>`
        : assigned.map(([entryKey, info]) => {
            const target = info.target || entryKey;
            const c = TEAM_COLORS[target] || TEAM_COLORS['DEFAULT'];
            const rows = (info.slots || []).map((s, i) => `
                <div class="flex items-center gap-2 py-1 border-b border-slate-700/30 last:border-0">
                    <span class="w-4 h-4 rounded-full bg-cyan-700 text-white text-[9px] font-black flex items-center justify-center shrink-0">${i+1}</span>
                    <span class="flex-1 min-w-0 text-[11px] font-black text-white truncate">${s.name}</span>
                    <span class="text-[10px] text-cyan-300 font-bold shrink-0">${minToTime(s.start)}–${minToTime(s.end)}</span>
                    <span class="text-[9px] shrink-0 ${s.breakMin > 0 ? 'text-amber-400' : 'text-emerald-400'}">${s.breakMin > 0 ? `พัก ${s.breakMin}น.` : 'ว่าง'}</span>
                </div>`).join('');
            return `
                <div class="mb-2 last:mb-0">
                    <div class="flex items-center gap-1 mb-1 flex-wrap">
                        <span class="text-[10px] font-black px-2 py-0.5 rounded border ${c.border} ${c.lightBg} ${c.lightText}">🤝 ${info.source} → ${target}</span>
                        ${info.win ? `<span class="text-[9px] font-bold text-cyan-300 bg-cyan-900/40 border border-cyan-700/50 px-1.5 py-0.5 rounded">${minToTime(info.win.start)}–${minToTime(info.win.end)}</span>` : ''}
                        ${isAdmin ? `<button onclick="window.clearSupportForTarget('${entryKey}')" title="ลบตารางนี้" class="ml-auto text-red-400 hover:text-red-300 flex items-center"><span class="material-icons text-[13px]">delete</span></button>` : ''}
                    </div>
                    <div class="bg-slate-800/50 rounded-lg px-2 py-1">${rows}</div>
                </div>`;
        }).join('');

    const supportPanelHtml = `
        <div class="bg-[#151f32] border border-cyan-700/60 rounded-2xl shadow-lg overflow-hidden mt-3">
            <div class="bg-gradient-to-r from-cyan-700 to-teal-600 text-white px-3 py-2 flex items-center gap-2">
                <span class="material-icons text-[16px]">groups</span>
                <h4 class="font-black text-xs tracking-wide">จัดคนซัพพอร์ตข้ามเว็บ</h4>
            </div>
            ${isAdmin ? `
            <div class="p-2.5 border-b border-slate-700/50 flex flex-col gap-1.5">
                <div class="flex items-center gap-1.5">
                    <select id="supportSourceSel" class="flex-1 min-w-0 bg-slate-900 border border-slate-600 text-white text-[10.5px] font-bold rounded-lg px-1.5 py-1.5 outline-none focus:border-cyan-500">${optsFor(defSource, true)}</select>
                    <span class="material-icons text-cyan-400 text-[15px] shrink-0">east</span>
                    <select id="supportTargetSel" class="flex-1 min-w-0 bg-slate-900 border border-slate-600 text-white text-[10.5px] font-bold rounded-lg px-1.5 py-1.5 outline-none focus:border-cyan-500">${optsFor(defTarget, false)}</select>
                </div>
                <div class="flex items-center gap-1.5">
                    <span class="material-icons text-slate-500 text-[13px] shrink-0" title="ช่วงเวลาที่ต้องการซัพพอร์ต">schedule</span>
                    <input id="supportStartTime" type="time" value="${winStart}" onchange="window.rememberSupportWindow()"
                        class="flex-1 min-w-0 bg-slate-900 border border-slate-600 text-white text-[10.5px] font-bold rounded-lg px-1.5 py-1 outline-none focus:border-cyan-500">
                    <span class="text-slate-500 text-[10px] shrink-0">ถึง</span>
                    <input id="supportEndTime" type="time" value="${winEnd}" onchange="window.rememberSupportWindow()"
                        class="flex-1 min-w-0 bg-slate-900 border border-slate-600 text-white text-[10.5px] font-bold rounded-lg px-1.5 py-1 outline-none focus:border-cyan-500">
                    ${isCustomWin ? `<button onclick="window.resetSupportWindow()" title="กลับไปเต็มกะ" class="text-slate-400 hover:text-cyan-300 shrink-0 flex items-center"><span class="material-icons text-[14px]">restart_alt</span></button>` : ''}
                </div>
                <button onclick="window.assignSupportTeam()" class="w-full bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-black py-1.5 rounded-lg transition flex items-center justify-center gap-1 active:scale-95 shadow">
                    <span class="material-icons text-[14px]">bolt</span> จัดคนซัพพอร์ต
                </button>
                <div class="text-[9.5px] text-slate-500 leading-relaxed">คนของเว็บต้นทางจะผลัดกันไปประจำเว็บเป้าหมาย แบ่งช่วงเวลาที่กำหนดให้เท่าๆ กัน และเลี่ยงเวลาพักให้อัตโนมัติ${isCustomWin ? '' : ' — ตอนนี้ตั้งเป็นเต็มกะ'}</div>
            </div>` : ''}
            <div class="p-2.5">${assignedHtml}</div>
        </div>`;

    // ถ้ายังไม่ได้คำนวณ แสดงแค่ UI เลือกเว็บ
    let resultHtml = `<div class="text-center text-[11px] text-slate-500 py-2">กดคำนวณเพื่อแบ่งเวลาให้ทุกเว็บ</div>`;

    if (window.helpCalcResult && window.helpCalcResult.length > 0) {
        const grouped = {};
        window.helpCalcResult.forEach(item => {
            if (!grouped[item.team]) grouped[item.team] = [];
            grouped[item.team].push(item);
        });

        resultHtml = Object.keys(grouped).map(team => {
            const colorClass = TEAM_COLORS[team] || TEAM_COLORS['DEFAULT'];
            const membersHtml = grouped[team].map((item, i) => {
                const netMin = item.slotMin - item.breakMin;
                const breakNote = item.breakMin > 0
                    ? `<span class="text-[9px] text-amber-400 ml-1">(พักใน ${item.breakMin}น.)</span>`
                    : `<span class="text-[9px] text-emerald-400 ml-1">(ไม่มีพัก)</span>`;
                return `
                <div class="flex items-center gap-2 py-1 border-b border-slate-700/30 last:border-0">
                    <span class="w-4 h-4 rounded-full bg-sky-700 text-white text-[9px] font-black flex items-center justify-center shrink-0">${i+1}</span>
                    <div class="flex-1 min-w-0">
                        <span class="text-[11px] font-black text-white">${item.name}</span>
                        <span class="text-[10px] text-sky-400 font-bold ml-1.5">${minToTime(item.helpStart)}–${minToTime(item.helpEnd)}</span>
                        ${breakNote}
                    </div>
                </div>`;
            }).join('');

            return `
                <div class="mb-2 last:mb-0">
                    <div class="text-[10px] font-black px-2 py-0.5 rounded mb-1 inline-block border ${colorClass.border} ${colorClass.lightBg} ${colorClass.lightText}">${team} · ${grouped[team].length} คน · คนละ ${Math.floor(720/grouped[team].length)} นาที</div>
                    <div class="bg-slate-800/50 rounded-lg px-2 py-1">${membersHtml}</div>
                </div>`;
        }).join('');
    }

    const calcHtml = `
        <div class="bg-[#151f32] border border-sky-700/60 rounded-2xl shadow-lg overflow-hidden mt-3">
            <div class="bg-gradient-to-r from-sky-700 to-cyan-600 text-white px-3 py-2 flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="material-icons text-[16px]">support_agent</span>
                    <h4 class="font-black text-xs tracking-wide">ตารางซัพพอร์ต</h4>
                </div>
                <div class="flex gap-1">
                    ${(window.helpCalcResult && window.helpCalcResult.length > 0) ? `
                    <button onclick="window.clearHelpCalc()" class="bg-red-600/80 hover:bg-red-600 px-2 py-1 rounded text-[10px] font-bold transition flex items-center gap-1 border border-red-400/50 active:scale-95">
                        <span class="material-icons text-[11px]">delete</span> ลบ
                    </button>` : ''}
                    <button onclick="window.calcHelpTime()" class="bg-black/20 hover:bg-black/30 text-white text-[11px] px-3 py-1 rounded-lg font-bold transition flex items-center gap-1 active:scale-95 border border-white/20">
                        <span class="material-icons text-[13px]">play_arrow</span> คำนวณ
                    </button>
                </div>
            </div>
            <div class="flex flex-col p-2.5 gap-1">${resultHtml}</div>
        </div>`;

    // append ต่อท้าย panel (หลัง mergeHtml)
    const existing = panel.querySelector('#helpCalcSection');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.id = 'helpCalcSection';
    div.innerHTML = supportPanelHtml + calcHtml;   // 🤝 แผงซัพพอร์ตข้ามเว็บมาก่อน ตารางแบ่งเวลารวมตามหลัง
    panel.appendChild(div);
};

// ลบผลตารางซัพพอร์ต
window.clearHelpCalc = function() {
    window.helpCalcResult = null;
    window.renderHelpCalcPanel();
};

// คำนวณตารางซัพพอร์ต
// ============================================================