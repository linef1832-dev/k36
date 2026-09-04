// ════════════════════════════════════════════════════════════════════
// 📦 leave/core.js — ส่วนที่ 1/3 ของระบบลา/พัก (แยกจาก leave.js เดิม 1,676 บรรทัด)
// เนื้อหา: โหลดข้อมูล, กติกาพัก/โควตา, ส่งคำขอลา
// ⚠️ ลำดับโหลด: leave/core → leave/table → leave/controls (ห้ามสลับ — ตัวแปร top-level แชร์ scope เดียวกัน)
// ════════════════════════════════════════════════════════════════════
let currentCalendarDate = new Date();
let currentViewDept = 'AM'; 
window.activeLeaveType = 'X'; 
let deptSettings = {
    AM: { limit: 4, startM: '', endM: '', startA: '', endA: '', startN: '', endN: '', isOpen: false, quotaM: 0, quotaA: 0, quotaN: 0, viewMonth: '', startDay: '', endDay: '' },
    OD: { limit: 4, startM: '', endM: '', startA: '', endA: '', startN: '', endN: '', isOpen: false, quotaM: 0, quotaA: 0, quotaN: 0, viewMonth: '', startDay: '', endDay: '' },
    TRAINER: { limit: 4, startM: '', endM: '', startA: '', endA: '', startN: '', endN: '', isOpen: false, quotaM: 0, quotaA: 0, quotaN: 0, viewMonth: '', startDay: '', endDay: '' },
    AMQL: { limit: 4, startM: '', endM: '', startA: '', endA: '', startN: '', endN: '', isOpen: false, quotaM: 0, quotaA: 0, quotaN: 0, viewMonth: '', startDay: '', endDay: '' },
    ODQL: { limit: 4, startM: '', endM: '', startA: '', endA: '', startN: '', endN: '', isOpen: false, quotaM: 0, quotaA: 0, quotaN: 0, viewMonth: '', startDay: '', endDay: '' },
    SPECIAL: { limit: 4, startM: '', endM: '', startA: '', endA: '', startN: '', endN: '', isOpen: false, quotaM: 0, quotaA: 0, quotaN: 0, viewMonth: '', startDay: '', endDay: '' }
};
let allLeaveData = [];  
let allSwapData = []; // 🌟 เพิ่มบรรทัดนี้
let leaveSubscription = null; 
let settingsSubscription = null;
let scheduledTasksSubscription = null; // 🌟 NEW: เพิ่มตัวแปรนี้
let isEditingLeave = false;
let editLeaveTimer;

window.setLeaveType = function(type) {
    window.activeLeaveType = type;
    document.querySelectorAll('.leave-type-btn').forEach(btn => {
        btn.classList.remove('ring-2', 'ring-offset-1', 'scale-105', 'opacity-100', 'ring-red-500', 'ring-yellow-400', 'ring-pink-500', 'ring-green-500', 'ring-blue-500', 'ring-amber-800', 'ring-yellow-700');
        btn.classList.add('opacity-50');
    });
    const activeBtn = document.getElementById('ltBtn_' + type);
    if(activeBtn) {
        activeBtn.classList.remove('opacity-50');
        activeBtn.classList.add('ring-2', 'ring-offset-1', 'scale-105', 'opacity-100');
        if(type === 'X') activeBtn.classList.add('ring-red-500');
        if(type === 'XX') activeBtn.classList.add('ring-yellow-400');
        if(type === 'X4') activeBtn.classList.add('ring-pink-500');
        if(type === 'KL') activeBtn.classList.add('ring-green-500');
        if(type === 'TX') activeBtn.classList.add('ring-blue-500');
        if(type === 'PN') activeBtn.classList.add('ring-amber-800');
        if(type === 'KP') activeBtn.classList.add('ring-yellow-700');
    }
};

window.switchDept = function(dept) {
    currentViewDept = dept;
    ['AM', 'OD', 'TRAINER', 'SPECIAL', 'AMQL', 'ODQL'].forEach(d => {
        const btn = document.getElementById(`btn${d}`);
        if(!btn) return;
        if(d === dept) {
            btn.classList.add('active');
            btn.classList.remove('text-rose-600', 'text-fuchsia-600', 'text-cyan-500', 'text-indigo-500', 'text-amber-500');
            if(d === 'AM') btn.classList.add('text-rose-600');
            if(d === 'OD') btn.classList.add('text-fuchsia-600');
            if(d === 'TRAINER' || d === 'AMQL' || d === 'ODQL') btn.classList.add('text-indigo-500');
            if(d === 'SPECIAL') btn.classList.add('text-amber-500');
        } else {
            btn.classList.remove('active', 'text-rose-600', 'text-fuchsia-600', 'text-cyan-500', 'text-indigo-500', 'text-amber-500');
        }
    });

    const label = document.getElementById('currentDeptLabel');
    const targetLabel = document.getElementById('settingTargetLabel');
    const saveLabel = document.getElementById('saveBtnLabel');
    
    let displayDeptName = dept;
    if (dept === 'TRAINER') displayDeptName = 'ผู้สอน';
    if (dept === 'SPECIAL') displayDeptName = 'จัดกลุ่มเอง';
    if (dept === 'AMQL') displayDeptName = 'ผู้สอน AM';
    if (dept === 'ODQL') displayDeptName = 'ผู้สอน OD';

    if(label) label.innerText = displayDeptName;
    if(targetLabel) targetLabel.innerText = displayDeptName;
    if(saveLabel) saveLabel.innerText = displayDeptName;

    let colorClass = 'bg-rose-600'; 
    if(dept === 'OD') colorClass = 'bg-fuchsia-600';
    if(dept === 'TRAINER' || dept === 'AMQL' || dept === 'ODQL') colorClass = 'bg-indigo-600';
    if(dept === 'SPECIAL') colorClass = 'bg-amber-500';
    if(label) label.className = `text-[10px] ${colorClass} px-2 rounded shadow transition-colors duration-300`;

    const btnManage = document.getElementById('btnManageNewStaff');
    if(btnManage) {
        btnManage.classList.remove('hidden'); 
    }

    const isGlobalAdmin = (currentUser.role === 'manager' || currentUser.role === 'admin');
    let canManageThisDept = isGlobalAdmin;

    if (dept === 'AM') canManageThisDept = canManageThisDept || window.hasUserPerm('leave_manage_am');
    if (dept === 'OD') canManageThisDept = canManageThisDept || window.hasUserPerm('leave_manage_od');
    if (dept === 'TRAINER' || dept === 'AMQL' || dept === 'ODQL') canManageThisDept = canManageThisDept || window.hasUserPerm('leave_manage_trainer');
    if (dept === 'SPECIAL') canManageThisDept = isGlobalAdmin || window.hasUserPerm('leave_manage_am');

    // [FIX] ผู้สอน (role trainer) ที่ไม่ใช่ admin → ไม่ให้เห็นแถบตั้งค่า/toggle เปิด-ปิด
    // ในหน้า AMQL/ODQL/TRAINER (เปิด-ปิดต้องทำจากหน้า AM/OD โดยแอดมินเท่านั้น)
    const _isTrainerOnlyUser = (currentUser.role === 'trainer') && !isGlobalAdmin;
    if (_isTrainerOnlyUser && (dept === 'AMQL' || dept === 'ODQL' || dept === 'TRAINER')) {
        canManageThisDept = false;
    }

    const controls = document.getElementById('leaveManagerControls');
    if(controls) {
        if(canManageThisDept) controls.classList.remove('hidden');
        else controls.classList.add('hidden');
    }

    updateAdminInputs();
    if(typeof updateMonthPicker === 'function') updateMonthPicker();
    
    const tbody = document.getElementById('tableBody');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="33" class="text-center py-20 text-gray-400"><span class="material-icons animate-spin text-5xl ${colorClass.replace('bg-', 'text-')} mb-2">sync</span><br><span class="font-bold">กำลังโหลดตารางเดือนนี้...</span></td></tr>`;
    }
    
    setTimeout(() => { renderLeaveTable(); checkBookingWindow(); }, 50);
};

function updateAdminInputs() {
    const s = deptSettings[currentViewDept];
    if(!s) return; 
    
    if(document.getElementById('setPersonLimit')) document.getElementById('setPersonLimit').value = s.limit || 4;
    if(document.getElementById('setStartM')) document.getElementById('setStartM').value = s.startM || '';
    if(document.getElementById('setEndM')) document.getElementById('setEndM').value = s.endM || '';
    if(document.getElementById('setStartA')) document.getElementById('setStartA').value = s.startA || '';
    if(document.getElementById('setEndA')) document.getElementById('setEndA').value = s.endA || '';
    if(document.getElementById('setStartN')) document.getElementById('setStartN').value = s.startN || '';
    if(document.getElementById('setEndN')) document.getElementById('setEndN').value = s.endN || '';

    if(document.getElementById('setForceOpen')) document.getElementById('setForceOpen').checked = s.isOpen || false;
    
    if(document.getElementById('setQuotaM')) document.getElementById('setQuotaM').value = s.quotaM || 0;
    if(document.getElementById('setQuotaA')) document.getElementById('setQuotaA').value = s.quotaA || 0;
    if(document.getElementById('setQuotaN')) document.getElementById('setQuotaN').value = s.quotaN || 0;

    if(document.getElementById('setAllowedMonth')) document.getElementById('setAllowedMonth').value = s.viewMonth || '';
    if(document.getElementById('setStartDay')) document.getElementById('setStartDay').value = s.startDay || '';
    if(document.getElementById('setEndDay')) document.getElementById('setEndDay').value = s.endDay || '';
    
    const timeGroup = document.getElementById('timeSettingsGroup');
    if(timeGroup) {
        timeGroup.classList.remove('opacity-30', 'pointer-events-none');
    }
}

const forceOpenCb = document.getElementById('setForceOpen');
if(forceOpenCb) forceOpenCb.addEventListener('change', (e) => { toggleTimeInputs(e.target.checked); });

window.initLeaveTable = async function() {
    if(typeof updateMonthPicker === 'function') updateMonthPicker();

    const isGlobalAdmin = (currentUser.role === 'manager' || currentUser.role === 'admin');
    const canManage = isGlobalAdmin || window.hasUserPerm('leave_manage');
    const canExport = isGlobalAdmin || window.hasUserPerm('leave_export');
    const canViewHistory = isGlobalAdmin || window.hasUserPerm('leave_history');
    
    // --- เช็คสิทธิ์หน้าแผนก ---
    const canViewAM = isGlobalAdmin || window.hasUserPerm('leave_am');
    const canViewOD = isGlobalAdmin || window.hasUserPerm('leave_od');
    const canViewTRAINER = isGlobalAdmin || window.hasUserPerm('leave_trainer');

    // ซ่อน/โชว์ แท็บแผนกตามสิทธิ์
    const btnAM = document.getElementById('btnAM');
    if (btnAM) { if(canViewAM) btnAM.classList.remove('hidden'); else btnAM.classList.add('hidden'); }
    
    const btnOD = document.getElementById('btnOD');
    if (btnOD) { if(canViewOD) btnOD.classList.remove('hidden'); else btnOD.classList.add('hidden'); }
    
    const btnNEW = document.getElementById('btnNEW');
    if (btnNEW) btnNEW.classList.add('hidden'); // ซ่อนแท็บ NEW ถาวร
    
    const btnTRAINER = document.getElementById('btnTRAINER');
    if (btnTRAINER) { if(canViewTRAINER) btnTRAINER.classList.remove('hidden'); else btnTRAINER.classList.add('hidden'); }

    // 🌟 ควบคุมแท็บ จัดกลุ่มเอง — ⚠️ ต้องเลื่อนไปทำหลัง loadLeaveSettings เพราะ
    // ตอนนี้ window.specialGroupUserIds ยังว่างอยู่ (ยังไม่โหลดจาก DB)
    // โค้ดเช็คย้ายลงไปหลัง await Promise.all แล้ว

    // 1. แถบจัดการของแอดมิน (ตั้งค่าต่างๆ)
    const controls = document.getElementById('leaveManagerControls');
    if(controls) { 
        if(canManage) controls.classList.remove('hidden'); 
        else controls.classList.add('hidden'); 
    }
    
    // 2. แถบเครื่องมือเลือกประเภทการลา — เช็คสิทธิ์จัดการแต่ละแผนก
    const _dept = currentViewDept || 'AM';
    const canManageThisDept = isGlobalAdmin
        || (_dept === 'AM'      && window.hasUserPerm('leave_manage_am'))
        || (_dept === 'OD'      && window.hasUserPerm('leave_manage_od'))
        || (['TRAINER','AMQL','ODQL'].includes(_dept) && window.hasUserPerm('leave_manage_trainer'))
        || (_dept === 'SPECIAL' && window.hasUserPerm('leave_manage_am'));

    const typeToolbar = document.getElementById('leaveTypeToolbar');
    if(typeToolbar) { 
        if(canManageThisDept) typeToolbar.classList.remove('hidden'); 
        else typeToolbar.classList.add('hidden'); 
    }

    // 3. ปุ่มดาวน์โหลด Excel
    const btnExport = document.getElementById('btnExportExcel');
    if(btnExport) { 
        if(canExport) btnExport.classList.remove('hidden'); 
        else btnExport.classList.add('hidden'); 
    }

    // 4. ปุ่มดูประวัติการกด
    const btnHistory = document.querySelector('button[onclick="openHistoryModal()"]');
    if(btnHistory) { 
        if(canViewHistory) btnHistory.classList.remove('hidden'); 
        else btnHistory.classList.add('hidden'); 
    }

    // 🚀 ดึง 3 ชุดข้อมูล (settings + users + leave/swap) แบบขนาน แล้ว render ครั้งเดียว
    const fetchTasks = [loadLeaveSettings(true), fetchLeaveData(true)];
    if (GLOBAL_USER_LIST.length === 0 && typeof fetchUsers === 'function') {
        fetchTasks.push(fetchUsers());
    }
    await Promise.all(fetchTasks);

    // 🌟 ควบคุมแท็บ จัดกลุ่มเอง — ทำหลังโหลด setting เสร็จ (specialGroupUserIds พร้อมแล้ว)
    const btnSPECIAL = document.getElementById('btnSPECIAL');
    if (btnSPECIAL) {
        window.specialGroupUserIds = window.specialGroupUserIds || [];
        const isInSpecialGroup = window.specialGroupUserIds.includes(String(currentUser.id));
        const isTrainerUser = (currentUser.role && currentUser.role.toLowerCase() === 'trainer') || currentUser.department === 'TRAINER';

        // แอดมิน / ผู้สอน / คนที่ถูกดึงชื่อเข้ากลุ่ม = เห็นแท็บนี้
        if (isGlobalAdmin || isInSpecialGroup || isTrainerUser) {
            btnSPECIAL.classList.remove('hidden');
        } else {
            btnSPECIAL.classList.add('hidden');
        }
    }

    if (typeof updateAdminInputs === 'function') updateAdminInputs();
    renderLeaveTable();
    if (typeof checkBookingWindow === 'function') checkBookingWindow();
    if (typeof setupLeaveHoverDelegation === 'function') setupLeaveHoverDelegation();

    subscribeLeaveChanges();
    subscribeSettingsChanges();
    subscribeScheduledTasksChanges(); // 🌟 NEW: สั่งให้ฟังการเปลี่ยนกะแบบเรียลไทม์
    
    // ==========================================
    // 🟢 กำหนดหน้าเริ่มต้น และเช็คสิทธิ์การมองเห็น
    // ==========================================
    const allowedDepts = ['AM', 'OD', 'TRAINER'];
    let myDept = currentUser.department || 'AM';
    if (!allowedDepts.includes(myDept)) myDept = 'AM';

    // ถ้าไม่มีสิทธิ์ดูหน้าแผนกตัวเอง ให้หาแผนกแรกที่มีสิทธิ์ดูเพื่อแสดงผลแทน
    if (myDept === 'AM' && !canViewAM) myDept = canViewOD ? 'OD' : (canViewTRAINER ? 'TRAINER' : 'AM');
    else if (myDept === 'OD' && !canViewOD) myDept = canViewAM ? 'AM' : (canViewTRAINER ? 'TRAINER' : 'AM');
    else if (myDept === 'TRAINER' && !canViewTRAINER) myDept = canViewAM ? 'AM' : (canViewOD ? 'OD' : 'AM');

    switchDept(myDept); 
    // ==========================================
    
    if (window.leaveCheckInterval) {
        clearInterval(window.leaveCheckInterval);
    }

    window.leaveCheckInterval = setInterval(() => {
        const leaveAppEl = document.getElementById('leaveApp');
        if(!leaveAppEl || leaveAppEl.classList.contains('hidden')) return;
        checkBookingWindow();
    }, 5000);  // 🟢 ลดความถี่จาก 1 วิ → 5 วิ (สถานะเปิด/ปิดจองไม่ได้เปลี่ยนถี่ขนาดนั้น)
    if (typeof window.registerPageInterval === 'function') window.registerPageInterval(window.leaveCheckInterval);
}

async function loadLeaveSettings(skipRender = false) {
    const { data, error } = await appDB.from('settings')
        .select('key, value')
        .not('key', 'like', 'duty_roster_%')
        .not('key', 'like', 'report_TRAINER_%')
        .neq('key', 'app_files_data')
        .neq('key', 'menu_access_rules')
        .neq('key', 'duty_access_matrix')
        .neq('key', 'duty_custom_roles')
        .neq('key', 'discord_channels')
        .neq('key', 'discord_custom_names');

    if (data) {
        // 🌟 ต้องมี SPECIAL, AMQL, ODQL ตรงนี้ด้วย ข้อมูลการเปิด/ปิด ถึงจะเรียลไทม์
        ['AM', 'OD', 'TRAINER', 'SPECIAL', 'AMQL', 'ODQL'].forEach(dept => {
            const getDbValue = (keySuffix, defaultVal) => {
                const row = data.find(d => d.key === `${dept}_${keySuffix}`);
                return row ? row.value : defaultVal;
            };
            if (!deptSettings[dept]) return; // กันสคริปต์พัง
            deptSettings[dept].limit = parseInt(getDbValue('limit', '4')) || 4;
            deptSettings[dept].startM = getDbValue('startM', '');
            deptSettings[dept].endM = getDbValue('endM', '');
            deptSettings[dept].startA = getDbValue('startA', '');
            deptSettings[dept].endA = getDbValue('endA', '');
            deptSettings[dept].startN = getDbValue('startN', '');
            deptSettings[dept].endN = getDbValue('endN', '');
            deptSettings[dept].isOpen = (getDbValue('is_open', 'false') === 'true');
            deptSettings[dept].quotaM = parseInt(getDbValue('quota_m', '0')) || 0;
            deptSettings[dept].quotaA = parseInt(getDbValue('quota_a', '0')) || 0;
            deptSettings[dept].quotaN = parseInt(getDbValue('quota_n', '0')) || 0;
            deptSettings[dept].viewMonth = getDbValue('view_month', '');
            deptSettings[dept].startDay = parseInt(getDbValue('lock_start', '')) || '';
            deptSettings[dept].endDay = parseInt(getDbValue('lock_end', '')) || '';
        });

    // 🌟 โค้ดที่เพิ่มใหม่: โหลดรายชื่อพนักงานกลุ่มพิเศษมาเก็บไว้
        const specialGrpRow = data.find(d => d.key === 'leave_special_users');
        window.specialGroupUserIds = specialGrpRow && specialGrpRow.value ? JSON.parse(specialGrpRow.value) : [];
    }
    if (!skipRender) {
        updateAdminInputs();
        renderLeaveTable();
        checkBookingWindow();
    }
}

window.checkBookingWindow = function(targetShift) {
    const now = new Date();
    // [FIX] AMQL ใช้ค่าเปิด/ปิด + เวลา ของ AM, ODQL ใช้ของ OD
    let _settingDept = currentViewDept;
    if (currentViewDept === 'AMQL') _settingDept = 'AM';
    else if (currentViewDept === 'ODQL') _settingDept = 'OD';
    const s = deptSettings[_settingDept] || {};

    const getStatus = (name, startStr, endStr) => {
        let msg = "", isOpen = true;
        if (s.isOpen) {
            msg = `✅ ${name} เปิดจอง (ตลอด)`; isOpen = true;
        } else {
            const start = startStr ? new Date(startStr) : null;
            const end = endStr ? new Date(endStr) : null;
            if (!start || !end) {
                msg = `⚠️ ${name} ปิด (ไม่ตั้งเวลา)`; isOpen = false;
            } else if (now < start) {
                msg = `⏳ ${name} เปิด: ${start.toLocaleString('th-TH', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'})}`; isOpen = false;
            } else if (now > end) {
                msg = `⛔ ${name} ปิดจองแล้ว`; isOpen = false;
            } else {
                msg = `✅ ${name} ถึง: ${end.toLocaleString('th-TH', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'})}`; isOpen = true;
            }
        }
        return { msg, isOpen };
    };

    if (targetShift) {
        // [FIX] ถ้า isOpen = true (เปิดตลอด) ให้คืน true เลย ไม่ต้องเช็คเวลา
        if (s.isOpen) return true;
        let startStr = '', endStr = '';
        if (targetShift.includes('เช้า')) { startStr = s.startM; endStr = s.endM; }
        else if (targetShift.includes('กลาง')) { startStr = s.startA; endStr = s.endA; }
        else if (targetShift.includes('ดึก')) { startStr = s.startN; endStr = s.endN; }
        return getStatus(targetShift, startStr, endStr).isOpen;
    }

    const stM = getStatus('เช้า', s.startM, s.endM);
    const stA = getStatus('กลาง', s.startA, s.endA);
    const stN = getStatus('ดึก', s.startN, s.endN);

    const statusText = document.getElementById('bookingStatusText');
    const rtDot = document.getElementById('rtStatus');

    if(statusText) {
        const makeBadge = (st) => {
            if (st.isOpen) return `<span class="text-[10px] text-green-400 font-bold bg-green-900/30 border border-green-800/50 px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">${st.msg}</span>`;
            return `<span class="text-[10px] text-red-400 font-bold bg-red-900/30 border border-red-800/50 px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">${st.msg}</span>`;
        };
        
        const newStatusHtml = `<span class="flex flex-wrap items-center gap-1.5">${makeBadge(stM)}${makeBadge(stA)}${makeBadge(stN)}</span>`;
        // เขียนทับเสมอ (ไม่ต่อท้าย) กันป้ายซ้อนกันตอนกลับเข้าหน้าซ้ำ
        if (statusText.innerHTML !== newStatusHtml) statusText.innerHTML = newStatusHtml;
    }
    if(rtDot) rtDot.classList.add('realtime-active');
    return true;
}

async function fetchLeaveData(skipRender = false) {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth() + 1;
    const daysInMonth = new Date(year, month, 0).getDate();
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-${daysInMonth}`;

    const fetchStart = new Date(year, month - 2, 1).toISOString();
    const fetchEnd = new Date(year, month + 1, 0).toISOString() + "T23:59:59";

    // [FIX] เดิมถูกตัดที่ 1000 แถวโดยไม่แจ้ง error (ตอนนี้เดือนละ ~730 แถว ใกล้ชนเพดานแล้ว)
    // ห่อด้วย selectAllRows ให้ดึงครบทุกหน้า และใส่ order เพื่อให้การแบ่งหน้าเสถียร
    const [leaveRes, swapRes] = await Promise.all([
        window.selectAllRows(() => appDB.from('leave_requests').select('*').gte('leave_date', startDate).lte('leave_date', endDate).order('id', { ascending: true })),
        window.selectAllRows(() => appDB.from('scheduled_tasks').select('*').eq('task_type', 'individual_shift_update').gte('scheduled_for', fetchStart).lte('scheduled_for', fetchEnd).order('id', { ascending: true }))
    ]);

    if (leaveRes && leaveRes.data) allLeaveData = leaveRes.data;
    allSwapData = (swapRes && swapRes.data) ? swapRes.data : [];

    if (!skipRender) renderLeaveTable();
}

function subscribeLeaveChanges() {
    if(leaveSubscription) appDB.removeChannel(leaveSubscription);
    leaveSubscription = appDB.channel('leave-updates')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, (payload) => {
        if (window.isEditingLeave) return;
        
        const leaveAppEl = document.getElementById('leaveApp');
        if (leaveAppEl && !leaveAppEl.classList.contains('hidden')) {
            
            let changedUserId = null;

            if (payload.eventType === 'INSERT') {
                allLeaveData.push(payload.new);
                changedUserId = payload.new.user_id;
            } else if (payload.eventType === 'DELETE') {
                const deletedItem = allLeaveData.find(l => String(l.id) === String(payload.old.id));
                if (deletedItem) changedUserId = deletedItem.user_id;
                allLeaveData = allLeaveData.filter(l => String(l.id) !== String(payload.old.id));
            }

            if (!changedUserId) return;

            const tUser = GLOBAL_USER_LIST.find(u => String(u.id) === String(changedUserId));
            const tDept = tUser ? (tUser.department || 'AM') : 'AM';
            const tRole = tUser ? (tUser.role || 'staff').toLowerCase() : 'staff';

            let shouldRenderTable = false;
                
                // 🌟 เช็คเงื่อนไขเรียลไทม์ให้ครอบคลุมทุกแท็บ รวมถึงผู้สอน AM/OD
                if (currentViewDept === 'SPECIAL' && window.specialGroupUserIds && window.specialGroupUserIds.includes(String(changedUserId))) {
                    shouldRenderTable = true;
                } 
                else if (currentViewDept === 'TRAINER' && (tDept.startsWith('TRAINER') || tRole === 'trainer')) {
                    shouldRenderTable = true;
                } 
                else if (currentViewDept === 'AMQL' || currentViewDept === 'TRAINER_AM') {
                    if (tDept === 'AMQL' || tDept === 'TRAINER_AM' || (tDept === 'AM' && tRole === 'trainer')) shouldRenderTable = true;
                } 
                else if (currentViewDept === 'ODQL' || currentViewDept === 'TRAINER_OD') {
                    if (tDept === 'ODQL' || tDept === 'TRAINER_OD' || (tDept === 'OD' && tRole === 'trainer')) shouldRenderTable = true;
                } 
                else if (tRole === 'staff' && tDept === currentViewDept) {
                shouldRenderTable = true;
            }

            if (shouldRenderTable) {
                window.renderLeaveTable(); 
                flashRealtimeDot();
            }
            }
    }).subscribe();
    if (typeof window.registerPageSubscription === 'function') window.registerPageSubscription(leaveSubscription);
}

function subscribeSettingsChanges() {
    if(settingsSubscription) appDB.removeChannel(settingsSubscription);
    settingsSubscription = appDB.channel('settings-updates')
    // 🌟 ส่วนที่ 1: ฟังคำสั่ง Broadcast (สำหรับสั่งให้โหลดใหม่แบบเจาะจง)
    .on('broadcast', { event: 'force_leave_reload' }, async () => {
        const leaveAppEl = document.getElementById('leaveApp');
        if (leaveAppEl && !leaveAppEl.classList.contains('hidden')) {
            await loadLeaveSettings();
            flashRealtimeDot();
        }
    })
    // 🌟 ส่วนที่ 2: เพิ่มใหม่! ดักฟังการเปลี่ยนแปลงข้อมูลในตาราง settings โดยตรง
    .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, async (payload) => {
        // เช็คว่าถ้าเป็นคีย์ที่เกี่ยวกับการตั้งค่าหน้าลางาน (มี _is_open, _quota, _limit, _start, _end)
        if (payload.new && payload.new.key && (
            payload.new.key.includes('_is_open') || 
            payload.new.key.includes('_quota') || 
            payload.new.key.includes('_limit') ||
            payload.new.key.includes('time_') ||
            payload.new.key.includes('lock_') ||
            payload.new.key.includes('_start') ||
            payload.new.key.includes('_end')
        )) {
            const leaveAppEl = document.getElementById('leaveApp');
            // เช็คว่าผู้ใช้อยู่หน้าลางานพอดีไหม ถ้าอยู่ก็ให้โหลดการตั้งค่าใหม่มาอัปเดตหน้าจอทันที
            if (leaveAppEl && !leaveAppEl.classList.contains('hidden')) {
                await loadLeaveSettings();
                flashRealtimeDot();
            }
        }
    })
    .subscribe();
    if (typeof window.registerPageSubscription === 'function') window.registerPageSubscription(settingsSubscription);
}

function flashRealtimeDot() {
    const rtDot = document.getElementById('rtStatus');
    if(rtDot) { rtDot.style.backgroundColor = '#facc15'; setTimeout(() => rtDot.style.backgroundColor = '#4ade80', 300); }
}

if (!document.getElementById('crosshair-dynamic-style')) {
    const style = document.createElement('style');
    style.id = 'crosshair-dynamic-style';
    document.head.appendChild(style);
}

window.highlightCell = function(cell, colIndex, isEnter) {
    const row = cell.parentElement;
    const styleTag = document.getElementById('crosshair-dynamic-style');

    if (isEnter) {
        row.classList.add('hover-row-active');
        cell.classList.add('hover-cell-active');
        const cssIndex = colIndex + 3;
        const isDark = document.documentElement.classList.contains('dark');
        const bgColor = isDark ? '#374151' : '#fff7ed';
        styleTag.innerHTML = `
            #leaveTableMain tbody tr td:nth-child(${cssIndex}):not(.is-booked),
            #leaveTableMain thead tr th:nth-child(${cssIndex}) {
                background-color: ${bgColor} !important;
            }
        `;
    } else {
        row.classList.remove('hover-row-active');
        cell.classList.remove('hover-cell-active');
        styleTag.innerHTML = '';
    }
};

// 🚀 ตั้ง event delegation สำหรับ hover crosshair ครั้งเดียว (ไม่ใส่ inline ทุก cell)
window.setupLeaveHoverDelegation = function() {
    const tbody = document.getElementById('tableBody');
    if (!tbody || tbody._hoverSetup) return;
    tbody._hoverSetup = true;

    // หา scroll container (parent ที่ overflow-auto)
    let scrollContainer = tbody.closest('.overflow-auto') || tbody.parentElement;

    let lastCell = null;
    let rafId = null;
    let isScrolling = false;
    let scrollTimer = null;

    const clearHover = () => {
        const styleTag = document.getElementById('crosshair-dynamic-style');
        if (styleTag && styleTag.innerHTML) styleTag.innerHTML = '';
        if (lastCell) {
            lastCell.classList.remove('hover-cell-active');
            if (lastCell.parentElement) lastCell.parentElement.classList.remove('hover-row-active');
            lastCell = null;
        }
    };

    // 🟢 ตอน scroll ปิด hover ชั่วคราว เพื่อกัน mouseover spam ตอนเลื่อนเมาส์/ล้อ
    if (scrollContainer) {
        scrollContainer.addEventListener('scroll', () => {
            if (!isScrolling) {
                isScrolling = true;
                clearHover();
            }
            if (scrollTimer) clearTimeout(scrollTimer);
            scrollTimer = setTimeout(() => { isScrolling = false; }, 120);
        }, { passive: true });
    }

    tbody.addEventListener('mouseover', (e) => {
        if (isScrolling) return;
        const cell = e.target.closest('td[data-col]');
        if (!cell || cell === lastCell) return;

        if (lastCell) {
            lastCell.classList.remove('hover-cell-active');
            if (lastCell.parentElement) lastCell.parentElement.classList.remove('hover-row-active');
        }

        cell.classList.add('hover-cell-active');
        if (cell.parentElement) cell.parentElement.classList.add('hover-row-active');
        lastCell = cell;

        const colIndex = parseInt(cell.dataset.col, 10);
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
            const cssIndex = colIndex + 3;
            const isDark = document.documentElement.classList.contains('dark');
            const bgColor = isDark ? '#374151' : '#fff7ed';
            const styleTag = document.getElementById('crosshair-dynamic-style');
            if (styleTag) {
                styleTag.innerHTML = `
                    #leaveTableMain tbody tr td:nth-child(${cssIndex}):not(.is-booked),
                    #leaveTableMain thead tr th:nth-child(${cssIndex}) {
                        background-color: ${bgColor} !important;
                    }
                `;
            }
        });
    });

    tbody.addEventListener('mouseleave', clearHover);
};
