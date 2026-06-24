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
        
        const newStatusHtml = `<div class="flex flex-wrap items-center gap-1.5 mt-1">${makeBadge(stM)}${makeBadge(stA)}${makeBadge(stN)}</div>`;
        if (statusText.innerHTML !== newStatusHtml) {
            statusText.innerHTML = newStatusHtml;
        }
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

    const [leaveRes, swapRes] = await Promise.all([
        appDB.from('leave_requests').select('*').gte('leave_date', startDate).lte('leave_date', endDate),
        appDB.from('scheduled_tasks').select('*').eq('task_type', 'individual_shift_update').gte('scheduled_for', fetchStart).lte('scheduled_for', fetchEnd)
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

window.renderLeaveTable = function() {
    const thead = document.getElementById('tableHeaderRow');
    const tbody = document.getElementById('tableBody');
    const searchInput = document.getElementById('leaveSearchInput');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : ''; 
    const shiftFilterSelect = document.getElementById('leaveShiftFilter');
    const shiftFilter = shiftFilterSelect ? shiftFilterSelect.value : 'all'; 
    
    if(!thead || !tbody) return;
    thead.innerHTML = ''; tbody.innerHTML = '';

    // 🌟 แก้บั๊กเส้นตารางหาย: ลบคลาสที่ทำให้เส้นขอบชนกันออก
    tbody.classList.remove('divide-y', 'divide-gray-100', 'dark:divide-slate-700');

    const s = deptSettings[currentViewDept] || { limit: 4, quotaM: 0, quotaA: 0, quotaN: 0 };
    const isGlobalAdmin = (currentUser.role === 'manager' || currentUser.role === 'admin');
    // isAdmin = global admin หรือ มีสิทธิ์จัดการแผนกที่กำลังดูอยู่
    const _d = currentViewDept || 'AM';
    // [FIX] ผู้สอนที่อยู่ในหน้า AMQL หรือ ODQL หรือ TRAINER — ลงได้แค่ของตัวเอง ไม่ใช่ admin
    const isTrainerRole = (currentUser.role === 'trainer');
    // dept AMQL หรือ role trainer + dept AM = ผู้สอน AM
    const isTrainerAM = currentUser.department === 'AMQL'
        || (isTrainerRole && currentUser.department === 'AM');
    // dept ODQL หรือ role trainer + dept OD = ผู้สอน OD
    const isTrainerOD = currentUser.department === 'ODQL'
        || (isTrainerRole && currentUser.department === 'OD');

    const isTrainerInThisPage =
        (_d === 'AMQL' && isTrainerAM)
        || (_d === 'ODQL' && isTrainerOD)
        || (_d === 'TRAINER' && isTrainerRole);
    // [FIX] หน้า AMQL/ODQL — leave_manage_trainer ไม่ให้เป็น isAdmin
    // เพราะผู้สอนต้องลงได้แค่ของตัวเองเท่านั้น
    const isAdmin = isGlobalAdmin
        || window.hasUserPerm('leave_manage')
        || (_d === 'AM'      && window.hasUserPerm('leave_manage_am'))
        || (_d === 'OD'      && window.hasUserPerm('leave_manage_od'))
        || (_d === 'SPECIAL' && window.hasUserPerm('leave_manage_am'));
    const canViewAnyMonth = isAdmin || window.hasUserPerm('leave_view_any_month');
    // ผู้สอนในหน้าของตัวเอง ลงได้แค่ isMe เท่านั้น (canRequest = true แต่ isAdmin = false)
    const canRequest = isGlobalAdmin || window.hasUserPerm('leave_request') || currentViewDept === 'SPECIAL' || isTrainerInThisPage;
    const picker = document.getElementById('viewMonthPicker');
    const btnPrev = document.getElementById('btnPrevMonth');
    const btnNext = document.getElementById('btnNextMonth');

    if (!canViewAnyMonth && s.viewMonth) {
        if(picker) { picker.disabled = true; picker.classList.add('opacity-50', 'cursor-not-allowed'); }
        if(btnPrev) btnPrev.classList.add('hidden');
        if(btnNext) btnNext.classList.add('hidden');
        const currentY = currentCalendarDate.getFullYear();
        const currentM = String(currentCalendarDate.getMonth() + 1).padStart(2, '0');
        if (`${currentY}-${currentM}` !== s.viewMonth) {
            const [y, m] = s.viewMonth.split('-');
            currentCalendarDate = new Date(parseInt(y), parseInt(m)-1, 1);
            if(typeof updateMonthPicker === 'function') updateMonthPicker();
            
            // 🌟 แก้บัค: ถ้าโดนบังคับเปลี่ยนเดือน ให้ไปดึงข้อมูลของเดือนนั้นมาใหม่ก่อน แล้วค่อยวาดตาราง
            fetchLeaveData();
            return;
        }
    } else {
        if(picker) { picker.disabled = false; picker.classList.remove('opacity-50', 'cursor-not-allowed'); }
        if(btnPrev) btnPrev.classList.remove('hidden');
        if(btnNext) btnNext.classList.remove('hidden');
    }

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    if(typeof checkBookingWindow === 'function') checkBookingWindow();

    // ... หาจุดที่มีการ filter allDeptUsers
    const allDeptUsers = GLOBAL_USER_LIST.filter(u => {
        const uDept = u.department || 'AM';
        const uRole = u.role ? u.role.toLowerCase() : 'staff'; 
        
        // เช็คว่าพนักงานคนนี้ถูกดึงเข้ากลุ่มพิเศษไปแล้วหรือยัง
        const isInSpecial = window.specialGroupUserIds && window.specialGroupUserIds.includes(String(u.id));

        if (currentViewDept === 'SPECIAL') {
            return isInSpecial; // แท็บพิเศษโชว์เฉพาะคนที่ถูกดึงเข้ามา
        } else if (currentViewDept === 'TRAINER') {
            // แท็บผู้สอนรวม
            return (uDept.startsWith('TRAINER') || uRole === 'trainer') && !isInSpecial; 
        } else if (currentViewDept === 'AMQL' || currentViewDept === 'TRAINER_AM') {
            // 🌟 แท็บผู้สอน AM: ดึงคนที่ (แผนก AM + สิทธิ์ trainer) หรือคนที่แผนกเป็น AMQL
            return ((uDept === 'AM' && uRole === 'trainer') || uDept === 'AMQL' || uDept === 'TRAINER_AM') && !isInSpecial;
        } else if (currentViewDept === 'ODQL' || currentViewDept === 'TRAINER_OD') {
            // 🌟 แท็บผู้สอน OD: ดึงคนที่ (แผนก OD + สิทธิ์ trainer) หรือคนที่แผนกเป็น ODQL
            return ((uDept === 'OD' && uRole === 'trainer') || uDept === 'ODQL' || uDept === 'TRAINER_OD') && !isInSpecial;
        } else {
            // แท็บ AM, OD พนักงานปกติ: โชว์เฉพาะคนที่เป็น staff
            return uRole === 'staff' && uDept === currentViewDept && !isInSpecial; 
        }
    });
    
    const allDeptUserIds = new Set(allDeptUsers.map(u => String(u.id)));
    const userShiftMapAll = {};
    allDeptUsers.forEach(u => userShiftMapAll[String(u.id)] = u.allowed_shift || 'all');

    const staffListToRender = allDeptUsers.filter(u => 
        u.username.toLowerCase().includes(searchTerm) &&
        (shiftFilter === 'all' || u.allowed_shift === shiftFilter)
    ).sort((a,b) => a.username.localeCompare(b.username));

    const bookedMap = new Map(); 
    const personalCounts = {};    
    const shiftDailyCounts = {}; 

   allLeaveData.forEach(l => {
        const strUid = String(l.user_id);
        if (!allDeptUserIds.has(strUid)) return;
        
        // 🌟 แก้บัค: ตัดเวลาออก เพื่อให้ตรงกับวันที่บนตารางเสมอ ป้องกันข้อมูลเก่าใน DB ที่มีเวลาติดมา
        const cleanDate = String(l.leave_date || '').split('T')[0].split(' ')[0];
        
        const rsn = (l.reason === 'Table-Booking' || !l.reason) ? 'X' : l.reason;
        bookedMap.set(`${strUid}_${cleanDate}`, rsn);
        
        const uShift = userShiftMapAll[strUid];
        const shiftKey = `${cleanDate}_${uShift}`;
        if(!shiftDailyCounts[shiftKey]) shiftDailyCounts[shiftKey] = 0;
        shiftDailyCounts[shiftKey]++;

        // 🌟 แก้บัค: ใช้ split เทียบเดือนและปี ป้องกันปัญหา Timezone เลื่อนวัน
        const parts = cleanDate.split('-');
        if (parts.length >= 3 && parseInt(parts[1], 10) === (month + 1) && parseInt(parts[0], 10) === year) {
            // 🌟 แก้ไข: เปลี่ยนการเก็บข้อมูลให้มีทั้งยอดรวม และแยกประเภทย่อย
            if(!personalCounts[strUid]) {
                personalCounts[strUid] = { total: 0, details: {} };
            }
            personalCounts[strUid].total++;
            
            if(!personalCounts[strUid].details[rsn]) {
                personalCounts[strUid].details[rsn] = 0;
            }
            personalCounts[strUid].details[rsn]++;
        }
    });

    let displayDeptText = currentViewDept;
    if(currentViewDept === 'TRAINER') displayDeptText = 'ผู้สอน';
    if(currentViewDept === 'SPECIAL') displayDeptText = 'พนักงานใหม่';

    // 🟢 นับจำนวนพนักงานทั้งหมดในแผนกนี้ แยกตามกะ (ใช้คำนวณ "มาทำงาน")
    const totalByShift = { 'กะเช้า': 0, 'กะกลาง': 0, 'กะดึก': 0 };
    allDeptUsers.forEach(u => {
        if (totalByShift[u.allowed_shift] !== undefined) totalByShift[u.allowed_shift]++;
    });

    let workingRowHtml = `<tr id="tableWorkingRow">
        <th colspan="2" class="p-1.5 sticky left-0 z-30 bg-emerald-50 dark:bg-emerald-950/40 border-b border-r dark:border-slate-700 text-left pl-4 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400">
            <span class="material-icons text-[12px] align-middle">groups</span> มาทำงาน (เหลือ/ทั้งหมด)
        </th>
    `;

    let headerHtml = `
        <th class="p-2 sticky left-0 z-30 bg-slate-50 dark:bg-slate-800 border-b border-r dark:border-slate-700 w-[40px] min-w-[40px] max-w-[40px] text-center">No.</th>
        <th class="p-2 sticky left-[39px] z-30 bg-slate-50 dark:bg-slate-800 border-b border-r dark:border-slate-700 w-[140px] min-w-[140px] max-w-[140px] text-left pl-4">
            รายชื่อ (${displayDeptText})
        </th>
    `;

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

        const countM = shiftDailyCounts[`${dateStr}_กะเช้า`] || 0;
        const countA = shiftDailyCounts[`${dateStr}_กะกลาง`] || 0;
        const countN = shiftDailyCounts[`${dateStr}_กะดึก`] || 0;

        const workM = Math.max(0, totalByShift['กะเช้า'] - countM);
        const workA = Math.max(0, totalByShift['กะกลาง'] - countA);
        const workN = Math.max(0, totalByShift['กะดึก'] - countN);

        workingRowHtml += `<th class="p-1 border-b border-r dark:border-slate-700 align-middle bg-emerald-50/70 dark:bg-emerald-950/30 min-w-[75px]">
            <div class="flex flex-col gap-0.5">
                <div class="flex justify-between items-center">
                    <span class="text-[9px] font-bold text-orange-500">เช้า</span>
                    <span class="text-[10px] font-mono font-extrabold text-emerald-700 dark:text-emerald-300">${workM}/${totalByShift['กะเช้า']}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-[9px] font-bold text-blue-500">กลาง</span>
                    <span class="text-[10px] font-mono font-extrabold text-emerald-700 dark:text-emerald-300">${workA}/${totalByShift['กะกลาง']}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-[9px] font-bold text-purple-400">ดึก</span>
                    <span class="text-[10px] font-mono font-extrabold text-emerald-700 dark:text-emerald-300">${workN}/${totalByShift['กะดึก']}</span>
                </div>
            </div>
        </th>`;

        const isFullM = countM >= (s.quotaM || 0);
        const isFullA = countA >= (s.quotaA || 0);
        const isFullN = countN >= (s.quotaN || 0);
        
        const textM = isFullM ? 'text-red-500 dark:text-red-400' : 'text-slate-700 dark:text-gray-200';
        const textA = isFullA ? 'text-red-500 dark:text-red-400' : 'text-slate-700 dark:text-gray-200';
        const textN = isFullN ? 'text-red-500 dark:text-red-400' : 'text-slate-700 dark:text-gray-200';
        
        let bgClass = "bg-slate-50 dark:bg-slate-800";
        let isLocked = false;
        if (s.startDay && d < s.startDay) isLocked = true;
        if (s.endDay && d > s.endDay) isLocked = true;
        if (isLocked) bgClass = "bg-gray-200 dark:bg-slate-950 opacity-60";

        headerHtml += `<th class="p-1.5 border-b border-r dark:border-slate-700 min-w-[75px] align-top ${bgClass}">
            <div class="text-[14px] text-slate-800 dark:text-white font-extrabold text-center mb-1 pb-0.5 border-b border-gray-200 dark:border-slate-600">${d}</div>
            <div class="flex flex-col gap-1">
                <div class="flex justify-between items-center">
                    <span class="text-[10px] font-bold text-orange-500">เช้า</span>
                    <span class="text-[11px] font-mono font-bold ${textM}">${countM}/${s.quotaM || 0}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-[10px] font-bold text-blue-500">กลาง</span>
                    <span class="text-[11px] font-mono font-bold ${textA}">${countA}/${s.quotaA || 0}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-[10px] font-bold text-purple-400">ดึก</span>
                    <span class="text-[11px] font-mono font-bold ${textN}">${countN}/${s.quotaN || 0}</span>
                </div>
            </div>
        </th>`;
    }
    workingRowHtml += `</tr>`;

    // ลบแถว "มาทำงาน" เก่าทิ้ง (ถ้ามี) แล้ววาดใหม่ก่อนแถววันที่
    const oldWorkingRow = document.getElementById('tableWorkingRow');
    if (oldWorkingRow) oldWorkingRow.remove();
    if (thead) thead.insertAdjacentHTML('beforebegin', workingRowHtml);

    thead.innerHTML = headerHtml;

    // 🚀 Pre-parse swap payloads และจัดกลุ่มตาม user_id ครั้งเดียว (เลี่ยง O(N×D×S))
    const swapsByUserId = {};
    (allSwapData || []).forEach(t => {
        let p = t.payload;
        if (typeof p === 'string') { try { p = JSON.parse(p); } catch(e) { p = {}; } }
        if (!p || !p.user_id) return;
        const uid = String(p.user_id);
        if (!swapsByUserId[uid]) swapsByUserId[uid] = [];
        swapsByUserId[uid].push({ scheduled_for: t.scheduled_for, status: t.status, _p: p });
    });
    Object.keys(swapsByUserId).forEach(uid => {
        swapsByUserId[uid].sort((a, b) => new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime());
    });

    let bodyHtml = '';
    staffListToRender.forEach((u, index) => {
        const isMe = String(u.id) === String(currentUser.id);
        const strUid = String(u.id);
        const nameClass = isMe ? "text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-900/10" : "";
        const rowClass = isMe ? "bg-rose-50/30 dark:bg-rose-900/5" : "";
        
        // 🌟 ดึงข้อมูลที่นับแบบแยกประเภทแล้วออกมาใช้
        const myLeaveData = personalCounts[strUid] || { total: 0, details: {} };
        
        // 🌟 แก้ไข: ให้ดึงเฉพาะยอดของประเภท "X" มาใช้คำนวณโควตาและแสดงในวงกลม
        const myTotal = myLeaveData.details['X'] || 0; 
        const isPersonalFull = myTotal >= s.limit;

        let targetQuota = s.quotaM || 2; 
        if(u.allowed_shift === 'กะเช้า') targetQuota = s.quotaM;
        else if(u.allowed_shift === 'กะกลาง') targetQuota = s.quotaA;
        else if(u.allowed_shift === 'กะดึก') targetQuota = s.quotaN;

        let removeBtn = '';
        if (isAdmin && currentViewDept === 'TRAINER') {
            if(typeof removeFromNewDept === 'function') {
                removeBtn = `<button onclick="removeFromNewDept(${u.id}, '${u.username}')" class="ml-1 text-gray-400 hover:text-red-500 transition"><span class="material-icons text-[10px]">close</span></button>`;
            }
        } else if (isAdmin && currentViewDept === 'SPECIAL') {
             removeBtn = `<button onclick="removeFromSpecialDept(${u.id}, '${u.username}')" class="ml-1 text-gray-400 hover:text-red-500 transition"><span class="material-icons text-[10px]">close</span></button>`;
        }

        // 🌟 สร้าง HTML แสดงจำนวนลางานแยกตามประเภท ให้ครบทุกแบบตามหน้าเว็บคุณ
        let breakdownHtml = '';
        const detailItems = [];
        // กำหนดสีให้ครบตามประเภทการลาเลยครับ
        const colors = {
            'X': 'text-red-500 font-black',
            'XX': 'text-yellow-600 font-black',
            'X4': 'text-pink-500 font-black',
            'KL': 'text-green-600 font-black',
            'TX': 'text-blue-500 font-black',
            'TL': 'text-blue-500 font-black',
            'PN': 'text-amber-700 font-black',
            'KP': 'text-yellow-800 font-black'
        };

        // 🌟 บังคับโชว์สถานะวันหยุดปกติ (X) เป็นค่าเริ่มต้นเสมอ แม้จะยังไม่เคยกดอะไรเลยก็ตาม
        const defaultXCount = myLeaveData.details['X'] || myLeaveData.details['Table-Booking'] || 0;
        detailItems.push(`<span class="${colors['X']} bg-slate-100 dark:bg-slate-800 px-1 rounded shadow-sm border border-gray-200 dark:border-slate-600">X:${defaultXCount}</span>`);

        if (myLeaveData.total > 0) {
            for (const [rsn, count] of Object.entries(myLeaveData.details)) {
                // เผื่อมีค่า Table-Booking หลุดมา ให้โชว์เป็น X
                let displayRsn = (rsn === 'Table-Booking') ? 'X' : rsn;
                if (displayRsn === 'X') continue; // ข้าม X เพราะถูกดึงมาโชว์เป็นค่าตั้งต้นแล้ว

                const colorCls = colors[displayRsn] || 'text-gray-500 font-black';
                
                // เช็คกันซ้ำ
                if (!detailItems.some(item => item.includes(`>${displayRsn}:`))) {
                    detailItems.push(`<span class="${colorCls} bg-slate-100 dark:bg-slate-800 px-1 rounded shadow-sm border border-gray-200 dark:border-slate-600">${displayRsn}:${count}</span>`);
                }
            }
        }
        breakdownHtml = `<div class="text-[9px] leading-tight mt-1.5 flex flex-nowrap overflow-x-auto custom-scrollbar pb-1 gap-x-1">${detailItems.join('')}</div>`;

    let rowHtml = `<tr class="transition ${rowClass} h-[56px]">`;
    
    // 🌟 ใช้ shadow-inset แทน border-b เพื่อแก้ปัญหาเส้นขอบแหว่ง/หาย ตอนเลื่อนตาราง
    rowHtml += `<td class="p-2 sticky left-0 z-10 bg-white dark:bg-slate-900 border-r dark:border-slate-700 shadow-[inset_0_-1px_0_0_#e5e7eb] dark:shadow-[inset_0_-1px_0_0_#334155] text-[10px] text-center text-gray-400 font-mono w-[40px] min-w-[40px] max-w-[40px]">${index + 1}</td>`;
    
    rowHtml += `<td class="p-2 sticky left-[39px] z-10 bg-white dark:bg-slate-900 border-r dark:border-slate-700 shadow-[inset_0_-1px_0_0_#e5e7eb] dark:shadow-[inset_0_-1px_0_0_#334155] text-xs ${nameClass} w-[140px] min-w-[140px] max-w-[140px]">
        <div class="flex justify-between items-start gap-1">
            <div class="flex flex-col min-w-0 flex-1">
                <div class="flex items-center"><span class="truncate max-w-[70px] font-bold text-[13px]">${u.username}</span>${removeBtn}</div>
                ${breakdownHtml}
            </div>
            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 mt-0.5 ${isPersonalFull ? 'bg-red-100 text-red-600 border-red-200' : 'bg-gray-100 text-gray-500 border-gray-200 shadow-inner'}">${myTotal}/${s.limit}</span>
        </div>
    </td>`;

        // 🚀 ใช้ swap ที่ pre-parsed/sorted แล้ว แทนการ filter+parse ซ้ำทุก user
        const myMonthSwaps = swapsByUserId[strUid] || [];

        // 🚀 cache swapDate.getTime() เป็น array ก่อน เพื่อไม่ต้องสร้าง Date object ในลูปวัน
        const swapTimestamps = myMonthSwaps.map(s => {
            const dt = new Date(s.scheduled_for);
            dt.setHours(0, 0, 0, 0);
            return dt.getTime();
        });

        let shiftTimeline = {};
        const monthIdx = currentCalendarDate.getMonth();

        for (let d = 1; d <= daysInMonth; d++) {
            const loopDate = new Date(year, monthIdx, d);
            loopDate.setHours(0, 0, 0, 0);
            const loopTs = loopDate.getTime();

            let dayShift = u.allowed_shift;

            for (let i = 0; i < myMonthSwaps.length; i++) {
                const swap = myMonthSwaps[i];
                const p = swap._p;
                const swapTs = swapTimestamps[i];

                if (swap.status === 'pending') {
                    if (loopTs >= swapTs && p.target_shift !== 'คงเดิม') {
                        dayShift = p.target_shift;
                    }
                } else if (swap.status === 'completed') {
                    if (loopTs < swapTs) {
                        let orig = p.original_shift;
                        if (!orig) {
                            if (p.target_shift === 'กะดึก') orig = 'กะเช้า';
                            else if (p.target_shift === 'กะเช้า') orig = 'กะดึก';
                            else orig = 'กะกลาง';
                        }
                        dayShift = orig;
                    } else if (p.target_shift !== 'คงเดิม') {
                        dayShift = p.target_shift;
                    }
                }
            }

            shiftTimeline[d] = dayShift;
        }

        let isThisUserShiftOpen = true;
        if (typeof checkBookingWindow === 'function') {
            isThisUserShiftOpen = checkBookingWindow(u.allowed_shift);
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            
            const leaveReason = bookedMap.get(`${strUid}_${dateStr}`);
            const isBooked = !!leaveReason;
            
            const shiftCountKey = `${dateStr}_${u.allowed_shift}`;
            const currentShiftCount = shiftDailyCounts[shiftCountKey] || 0;
            const isShiftFull = currentShiftCount >= targetQuota;
            
            let isDateLocked = false;
            if (s.startDay && d < s.startDay) isDateLocked = true;
            if (s.endDay && d > s.endDay) isDateLocked = true;

            // 🌟 NEW: กำหนดสีพื้นหลังตามกะของวันนั้น
            let activeShiftForThisDay = shiftTimeline[d];
            let shiftBgColor = '';
            
            // ปรับสีกะเช้าให้เป็นโทนเหลืองทอง/น้ำตาล เพื่อให้ตัดกับป้ายวันหยุดสีแดงได้ชัดเจนขึ้น
            // ปรับสีกะเช้าให้เป็นโทนส้มน้ำตาล
            if (activeShiftForThisDay === 'กะเช้า') {
                shiftBgColor = 'bg-amber-100 dark:bg-[#4a3615]'; // โทนเหลืองทอง/น้ำตาลหม่น
            } else if (activeShiftForThisDay === 'กะดึก') {
                shiftBgColor = 'bg-indigo-100 dark:bg-[#3d2c6b]'; // โทนม่วง/ฟ้าพาสเทล
                shiftBgColor = 'bg-indigo-100 dark:bg-[#3d2c6b]'; // โทนม่วง
            } else if (activeShiftForThisDay === 'กะกลาง') {
                shiftBgColor = 'bg-sky-100 dark:bg-[#1e4875]'; // โทนน้ำเงิน/ฟ้าพาสเทล
                shiftBgColor = 'bg-sky-100 dark:bg-[#1e4875]'; // โทนฟ้า
            }

            let cellClass = `cursor-pointer ${shiftBgColor}`;
            let cellContent = "";
            let baseDeptColor = 'bg-rose-500'; 
            if(currentViewDept === 'OD') baseDeptColor = 'bg-fuchsia-500';
            if(currentViewDept === 'TRAINER') baseDeptColor = 'bg-indigo-500';

            if (isDateLocked && !isAdmin) {
                if (isBooked) {
                    let badgeStyle = getLeaveBadgeStyle(leaveReason, baseDeptColor);
                    // 🌟 แก้ไข: ย้ายสีวันหยุดไปทับพื้นหลังของช่อง (td) ให้เต็มช่อง และเอาป้ายอันเล็กออก
                    cellClass = `cursor-not-allowed opacity-70 ${badgeStyle}`; 
                    cellContent = `<div class="flex items-center justify-center w-full h-full text-white text-[12px] font-bold">${leaveReason}</div>`;
                } else {
                    cellClass = `${shiftBgColor} cursor-not-allowed opacity-40`;
                    cellContent = `<div class="flex items-center justify-center w-full h-full"><span class="material-icons text-gray-400 dark:text-slate-500 text-xs">lock</span></div>`;
                }
            } else {
                if (isBooked) {
                    let badgeStyle = getLeaveBadgeStyle(leaveReason, baseDeptColor);
                    // 🌟 แก้ไข: ย้ายสีวันหยุดไปทับพื้นหลังของช่อง (td) ให้เต็มช่อง
                    cellClass = `cursor-pointer hover:opacity-90 transition-opacity duration-300 ${badgeStyle}`;
                    cellContent = `<div class="flex items-center justify-center w-full h-full text-white text-[12px] font-bold animate-fade-in">${leaveReason}</div>`;
                } else {
                    // ถ้าไม่ใช่วันหยุด ปล่อยช่องว่างไว้ (ไม่ render วงกลม + transitions เพื่อความเร็ว scroll)
                    cellContent = '';
                }
            }

            let hoverAttr = `data-col="${d-1}"`;
            let clickAttr = "";
            
            if (isDateLocked && !isAdmin) {
                if(isMe) clickAttr = `onclick="Swal.fire({icon:'error', title:'ล็อกวัน', text:'วันที่นี้ถูกล็อก ไม่สามารถทำรายการได้', timer:1500, showConfirmButton:false})"`;
            } else if (!isThisUserShiftOpen && !isAdmin && isMe) {
                clickAttr = `onclick="Swal.fire({icon:'error', title:'ปิดจองแล้ว', text:'อยู่นอกเวลาทำรายการของกะคุณ', timer:2000, showConfirmButton:false})"`;
            } else if (isMe || isAdmin) {
                if (!canRequest && isMe && !isAdmin) {
                    clickAttr = `onclick="Swal.fire({icon:'error', title:'ไม่มีสิทธิ์', text:'คุณไม่มีสิทธิ์กดจอง/ยกเลิกวันหยุด', timer:1500, showConfirmButton:false})"`;
                } else {
                    if (isBooked) {
                        clickAttr = `onclick="toggleLeaveTable('${dateStr}', 'remove', ${u.id}, '${u.username}', '${u.allowed_shift}')"`;
                    } else if (!isShiftFull || isAdmin) { 
                        if (!isPersonalFull || isAdmin) {
                            clickAttr = `onclick="toggleLeaveTable('${dateStr}', 'add', ${u.id}, '${u.username}', '${u.allowed_shift}')"`;
                        } else if (isMe) {
                            clickAttr = `onclick="Swal.fire({icon:'warning', title:'ครบโควตา', text:'คุณใช้สิทธิ์ครบ ${s.limit} วันแล้ว', timer:1500, showConfirmButton:false})"`;
                        }
                    }
                }
            }
            
            rowHtml += `<td class="border-r border-b dark:border-slate-700 text-center ${cellClass}" ${clickAttr} ${hoverAttr}>${cellContent}</td>`;
        }
        rowHtml += `</tr>`;
        bodyHtml += rowHtml;
    });
    
    if(staffListToRender.length === 0) bodyHtml = `<tr><td colspan="${daysInMonth + 2}" class="p-10 text-center text-gray-400">ไม่พบรายชื่อในแผนก ${displayDeptText}</td></tr>`;
    tbody.innerHTML = bodyHtml;
};

window.changeMonth = function(step) { currentCalendarDate.setMonth(currentCalendarDate.getMonth() + step); updateMonthPicker(); fetchLeaveData(); }
window.updateMonthPicker = function() { 
    const y = currentCalendarDate.getFullYear(); const m = String(currentCalendarDate.getMonth() + 1).padStart(2, '0'); 
    if(document.getElementById('viewMonthPicker')) document.getElementById('viewMonthPicker').value = `${y}-${m}`; 
    window.updateThaiMonthDisplay();
}
window.jumpToMonth = function() { const val = document.getElementById('viewMonthPicker').value; if(val) { const [y, m] = val.split('-'); currentCalendarDate = new Date(parseInt(y), parseInt(m)-1, 1); fetchLeaveData(); } }

window.updateThaiMonthDisplay = function() {
    const thaiMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    const viewPicker = document.getElementById('viewMonthPicker');
    const viewDisplay = document.getElementById('viewMonthDisplay');
    if (viewPicker && viewDisplay && viewPicker.value) {
        const [y, m] = viewPicker.value.split('-');
        viewDisplay.innerText = `${thaiMonths[parseInt(m) - 1]} ${parseInt(y) + 543}`;
    }
    const setPicker = document.getElementById('setAllowedMonth');
    const setDisplay = document.getElementById('setMonthDisplay');
    if (setPicker && setDisplay) {
        if (setPicker.value) {
            const [y, m] = setPicker.value.split('-');
            setDisplay.innerText = `${thaiMonths[parseInt(m) - 1]} ${parseInt(y) + 543}`;
        } else {
            setDisplay.innerText = 'เลือกเดือน';
        }
    }
};

window.changeAdminMonth = function(step) {
    const inputEl = document.getElementById('setAllowedMonth');
    if (!inputEl) return;

    let currentVal = inputEl.value;
    let d;

    if (currentVal) {
        const [y, m] = currentVal.split('-');
        d = new Date(parseInt(y), parseInt(m) - 1, 1);
    } else {
        d = new Date();
    }

    d.setMonth(d.getMonth() + step);

    const newY = d.getFullYear();
    const newM = String(d.getMonth() + 1).padStart(2, '0');
    
    inputEl.value = `${newY}-${newM}`;
    
    if (typeof window.updateThaiMonthDisplay === 'function') {
        window.updateThaiMonthDisplay();
    }
};

window.toggleLeaveTable = async function(dateStr, action, targetUserId, targetUserName, targetUserShift) {
    const typeToSave = window.activeLeaveType || 'X';

    if (action === 'remove') {
        const result = await Swal.fire({
            title: 'ยืนยันการลบ?',
            text: `ยกเลิกรายการของ ${targetUserName} วันที่ ${dateStr} ใช่หรือไม่?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'ใช่, ลบเลย!',
            cancelButtonText: 'ยกเลิก'
        });
        if (!result.isConfirmed) return;
    }

    window.isEditingLeave = true; 
    Swal.fire({title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});

    try {
        if (action === 'add') {
            const { error } = await appDB.from('leave_requests').insert([
                { 
                    user_id: targetUserId, 
                    user_name: targetUserName,
                    leave_date: dateStr, 
                    reason: typeToSave, 
                    status: 'approved' 
                }
            ]);
            if (error) throw error;
            
            // 🌟 แก้ไข: เรียกใช้ logLeaveAction เพื่อให้มันบันทึกลงตาราง leave_logs ให้ถูกต้อง
            await logLeaveAction(`จอง [${typeToSave}]`, targetUserId, targetUserName, dateStr);

       } else if (action === 'remove') {
            const { error } = await appDB.from('leave_requests')
                .delete()
                .eq('user_id', targetUserId)
                .eq('leave_date', dateStr);
            
            if (error) throw error;

            // 🌟 แก้ไข: เรียกใช้ logLeaveAction เพื่อบันทึกประวัติการยกเลิก
            await logLeaveAction('ยกเลิก', targetUserId, targetUserName, dateStr);
        }
        
        // 🌟 อัปเดตตารางด้วยข้อมูลล่าสุดจากฐานข้อมูลโดยตรง (ชัวร์และแม่นยำ 100%)
        await fetchLeaveData(); 
        Swal.fire({ icon: 'success', title: action === 'add' ? 'บันทึกสำเร็จ' : 'ลบสำเร็จ', showConfirmButton: false, timer: 1000 });

    } catch (error) {
        console.error('Toggle Leave Error:', error);
        Swal.fire('ข้อผิดพลาด', error.message, 'error');
    } finally {
        setTimeout(() => { window.isEditingLeave = false; }, 500); 
    }
};

window.executeSaveSettings = async function() {
    try {
        Swal.fire({ title: 'กำลังบันทึกข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const q = document.getElementById('setQuota')?.value || "0";
        const p = document.getElementById('setPersonLimit')?.value || "4";
        const sM = document.getElementById('setStartM')?.value || '';
        const eM = document.getElementById('setEndM')?.value || '';
        const sA = document.getElementById('setStartA')?.value || '';
        const eA = document.getElementById('setEndA')?.value || '';
        const sN = document.getElementById('setStartN')?.value || '';
        const eN = document.getElementById('setEndN')?.value || '';
        const forceOpen = document.getElementById('setForceOpen')?.checked || false;
        const qM = document.getElementById('setQuotaM')?.value || "0";
        const qA = document.getElementById('setQuotaA')?.value || "0";
        const qN = document.getElementById('setQuotaN')?.value || "0";
        const viewMonth = document.getElementById('setAllowedMonth')?.value || '';
        const sDay = document.getElementById('setStartDay')?.value || '';
        const eDay = document.getElementById('setEndDay')?.value || '';
        const dept = typeof currentViewDept !== 'undefined' ? currentViewDept : 'AM';

        if (typeof deptSettings !== 'undefined') {
            deptSettings[dept] = { quota: parseInt(q), limit: parseInt(p), startM: sM, endM: eM, startA: sA, endA: eA, startN: sN, endN: eN, isOpen: forceOpen, quotaM: parseInt(qM), quotaA: parseInt(qA), quotaN: parseInt(qN), viewMonth: viewMonth, startDay: parseInt(sDay), endDay: parseInt(eDay) };
        }

        const updates = [
            { key: `${dept}_quota`, value: String(q) }, { key: `${dept}_limit`, value: String(p) },
            { key: `${dept}_startM`, value: sM }, { key: `${dept}_endM`, value: eM },
            { key: `${dept}_startA`, value: sA }, { key: `${dept}_endA`, value: eA },
            { key: `${dept}_startN`, value: sN }, { key: `${dept}_endN`, value: eN },
            { key: `${dept}_is_open`, value: String(forceOpen) },
            { key: `${dept}_quota_m`, value: String(qM) }, { key: `${dept}_quota_a`, value: String(qA) }, { key: `${dept}_quota_n`, value: String(qN) },
            { key: `${dept}_view_month`, value: viewMonth },
            { key: `${dept}_lock_start`, value: String(sDay) }, { key: `${dept}_lock_end`, value: String(eDay) }
        ];

        // [FIX] sync is_open ให้ AMQL/ODQL ตามไปด้วยเสมอ
        if (dept === 'AM') updates.push({ key: 'AMQL_is_open', value: String(forceOpen) });
        if (dept === 'OD') updates.push({ key: 'ODQL_is_open', value: String(forceOpen) });

        const { error } = await appDB.from('settings').upsert(updates);
        if (error) throw error;
        appDB.channel('settings-updates').send({ type: 'broadcast', event: 'force_leave_reload' });

        if (viewMonth && typeof currentCalendarDate !== 'undefined') {
            const [y, m] = viewMonth.split('-');
            currentCalendarDate = new Date(parseInt(y), parseInt(m) - 1, 1);
            if (typeof updateMonthPicker === 'function') updateMonthPicker();
        }

        setTimeout(async () => {
            if (typeof checkBookingWindow === 'function') checkBookingWindow();
            if (typeof fetchLeaveData === 'function') await fetchLeaveData(); 
            Swal.fire({ icon: 'success', title: `บันทึกเรียบร้อย!`, showConfirmButton: false, timer: 1500 });
        }, 100);
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด!', text: err.message || 'ไม่สามารถบันทึกได้' });
    }
};

window.exportLeaveToExcel = async function() {
    // 1. เช็คข้อมูลพนักงานก่อน
    if (!GLOBAL_USER_LIST || GLOBAL_USER_LIST.length === 0) return Swal.fire('ข้อมูลยังไม่พร้อม', 'กรุณารอสักครู่แล้วลองใหม่', 'warning');

    // 2. เรียกใช้ฟังก์ชันแอบโหลด ExcelJS (ดึงมาจากที่เราสร้างไว้ใน summary.js)
    window.loadExcelLibrary(async function() {
        Swal.fire({ title: 'กำลังสร้างไฟล์ Excel...', text: 'รอสักครู่นะครับ', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        
        try {
            const year = currentCalendarDate.getFullYear();
            const month = currentCalendarDate.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const monthNamesThai = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
            const monthName = `${monthNamesThai[month]} ${year}`;

            const staffList = GLOBAL_USER_LIST.filter(u => {
                const uDept = u.department || 'AM';
                if (currentViewDept === 'TRAINER') return uDept === 'TRAINER';
                return u.role === 'staff' && uDept === currentViewDept;
            }).sort((a,b) => a.username.localeCompare(b.username));

            if (staffList.length === 0) { Swal.close(); return Swal.fire('ไม่มีข้อมูล', `ไม่มีรายชื่อพนักงานในแผนก ${currentViewDept}`, 'warning'); }

            const bookedMap = new Map();
            allLeaveData.forEach(l => { 
                const cleanDate = String(l.leave_date || '').split('T')[0].split(' ')[0];
                const rsn = (l.reason === 'Table-Booking' || !l.reason) ? 'X' : l.reason; 
                bookedMap.set(`${l.user_id}_${cleanDate}`, rsn); 
            });

            const styleMap = {
                'X':  { bg: 'FFEF4444', font: 'FFFFFFFF' }, 'XX': { bg: 'FFFACC15', font: 'FF854D0E' },
                'X4': { bg: 'FFEC4899', font: 'FFFFFFFF' }, 'KL': { bg: 'FF22C55E', font: 'FFFFFFFF' },
                'TL': { bg: 'FF3B82F6', font: 'FFFFFFFF' }, 'TX': { bg: 'FF3B82F6', font: 'FFFFFFFF' },
                'PN': { bg: 'FF92400E', font: 'FFFFFFFF' },
                'KP': { bg: 'FFA16207', font: 'FFFFFFFF' }
            };

            const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet(`วันหยุด ${currentViewDept}`);
            ws.views = [{ state: 'frozen', xSplit: 4, ySplit: 1 }];

            let headers = ['ลำดับ', 'ชื่อพนักงาน', 'กะที่ทำ', 'รวมวันหยุด'];
            for (let d = 1; d <= daysInMonth; d++) headers.push(String(d)); 
            const headerRow = ws.addRow(headers);
            
            headerRow.eachCell((cell) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
                cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border = { top: {style:'thin', color: {argb:'FF334155'}}, left: {style:'thin', color: {argb:'FF334155'}}, bottom: {style:'thin', color: {argb:'FF334155'}}, right: {style:'thin', color: {argb:'FF334155'}} };
            });

            staffList.forEach((u, index) => {
                let rowData = [ index + 1, u.username, (u.allowed_shift || '-').replace('กะ', ''), 0 ];
                let leaveCount = 0; let dailyReasons = [];
                for (let d = 1; d <= daysInMonth; d++) {
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    let rsn = bookedMap.get(`${u.id}_${dateStr}`);
                    if (rsn) { leaveCount++; if(rsn === 'Table-Booking') rsn = 'X'; dailyReasons.push(rsn); } else { dailyReasons.push(''); }
                }
                rowData[3] = leaveCount; 
                const excelRow = ws.addRow(rowData.concat(dailyReasons));

                for (let d = 1; d <= daysInMonth; d++) {
                    const cellVal = dailyReasons[d - 1]; const cell = excelRow.getCell(d + 4); 
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    cell.border = { top: {style:'thin', color: {argb:'FFE2E8F0'}}, left: {style:'thin', color: {argb:'FFE2E8F0'}}, bottom: {style:'thin', color: {argb:'FFE2E8F0'}}, right: {style:'thin', color: {argb:'FFE2E8F0'}} };
                    if (cellVal && styleMap[cellVal]) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: styleMap[cellVal].bg } };
                        cell.font = { color: { argb: styleMap[cellVal].font }, bold: true };
                    }
                }
                excelRow.getCell(1).alignment = { horizontal: 'center' }; excelRow.getCell(2).font = { bold: true }; excelRow.getCell(3).alignment = { horizontal: 'center' }; excelRow.getCell(4).alignment = { horizontal: 'center' }; excelRow.getCell(4).font = { bold: true, color: { argb: 'FFEF4444' } }; 
            });

            ws.columns.forEach((col, index) => {
                if (index === 0) col.width = 6; else if (index === 1) col.width = 20; else if (index === 2) col.width = 10; else if (index === 3) col.width = 12; else col.width = 5; 
            });

            const buffer = await wb.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url; link.download = `ตารางวันหยุด_${currentViewDept}_${monthName}.xlsx`; document.body.appendChild(link);
            link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);

            Swal.fire({ icon: 'success', title: 'ดาวน์โหลดไฟล์ Excel สำเร็จ!', timer: 1500, showConfirmButton: false });
        } catch (err) { Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถสร้างไฟล์ Excel ได้: ' + err.message, 'error'); }
    });
};

window.openHistoryModal = async function() {
    let htmlContent = `
        <div class="text-left w-full">
            <div class="relative mb-4">
                <span class="material-icons absolute left-3 top-3 text-gray-400 text-lg">search</span>
                <input type="text" id="historySearch" placeholder="พิมพ์ชื่อพนักงานเพื่อค้นหา..." class="w-full pl-10 pr-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner transition" onkeyup="debounceHistorySearch()">
            </div>
            <div class="overflow-hidden rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
                <div class="overflow-y-auto max-h-[60vh] custom-scrollbar">
                    <table class="w-full text-sm text-left">
                        <thead class="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-slate-100 dark:bg-slate-900 sticky top-0 z-10 shadow-sm">
                            <tr><th class="px-4 py-3 font-bold w-[15%]">เวลาที่กด</th><th class="px-4 py-3 font-bold w-[30%]">ชื่อพนักงาน</th><th class="px-4 py-3 font-bold w-[30%]">สถานะ / ทำรายการ</th><th class="px-4 py-3 font-bold w-[25%]">สำหรับวันที่</th></tr>
                        </thead>
                        <tbody id="historyTableBody" class="divide-y divide-gray-100 dark:divide-slate-700/50">
                            <tr><td colspan="4" class="text-center p-10"><span class="material-icons animate-spin text-4xl text-indigo-500">sync</span></td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    Swal.fire({
        title: `
            <div class="flex items-center gap-3 border-b border-slate-200 dark:border-slate-700 pb-3">
                <div class="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner"><span class="material-icons text-xl">history</span></div>
                <div class="text-left">
                    <div class="text-xl font-black text-slate-800 dark:text-white tracking-wide">ประวัติการกด <span class="text-indigo-500">(${currentViewDept})</span></div>
                    <div class="text-xs text-gray-500 font-normal mt-0.5">แสดงข้อมูลการ จอง/ยกเลิก วันหยุดล่าสุด</div>
                </div>
            </div>
        `,
        html: htmlContent, width: '700px', showConfirmButton: false, showCloseButton: true,
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-[1.5rem] shadow-2xl p-6' },
        didOpen: () => { fetchHistoryLogs(); }
    });
}

window.debounceHistorySearch = function() {
    clearTimeout(window.historySearchTimer); 
    window.historySearchTimer = setTimeout(() => {
        fetchHistoryLogs(); 
    }, 500); 
};

window.fetchHistoryLogs = async function() {
    const search = document.getElementById('historySearch').value.trim();
    const tbody = document.getElementById('historyTableBody');
    let query = appDB.from('leave_logs').select('*').eq('department', currentViewDept).order('created_at', { ascending: false }).limit(100);
    if (search) query = query.ilike('username', `%${search}%`);

    const { data, error } = await query;
    if (error || !data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center p-10 text-gray-400 font-bold flex flex-col items-center"><span class="material-icons text-5xl opacity-20 mb-2">search_off</span>ไม่พบข้อมูลประวัติ</td></tr>`;
        return;
    }

    const thaiMonths = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
    let rows = '';
    data.forEach(log => {
        const dateObj = new Date(log.created_at);
        const timeStr = dateObj.toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'});
        const dateStr = dateObj.toLocaleDateString('th-TH', {day: '2-digit', month:'short'});
        
        let displayLeaveDate = log.leave_date;
        try { const [lY, lM, lD] = log.leave_date.split('-'); displayLeaveDate = `${parseInt(lD)} ${thaiMonths[parseInt(lM)-1]} ${parseInt(lY)+543}`; } catch(e) {}
        
        let actionBadge = ''; let rowClass = 'hover:bg-slate-50 dark:hover:bg-slate-700/30 transition duration-200';

        if (log.action_type.includes('จอง')) {
            let leaveType = log.action_type.replace('จอง [', '').replace(']', '').trim();
            if(!leaveType || leaveType === 'จอง') leaveType = 'X';
            actionBadge = `<div class="flex items-center gap-1.5"><span class="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 px-2 py-1 rounded-md text-[11px] font-black flex items-center gap-1 shadow-sm"><span class="material-icons text-[14px]">event_available</span> จอง</span><span class="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-gray-200 border border-slate-300 dark:border-slate-600 px-2 py-1 rounded-md text-[10px] font-bold shadow-sm">${leaveType}</span></div>`;
        } else {
            rowClass = 'bg-red-50/40 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20 transition duration-200';
            actionBadge = `<div class="flex items-center gap-1.5"><span class="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 px-2 py-1 rounded-md text-[11px] font-black flex items-center gap-1 shadow-sm"><span class="material-icons text-[14px]">event_busy</span> ยกเลิก</span></div>`;
        }

        let actorHtml = log.actor_name !== log.username ? `<div class="text-[10px] text-orange-500 dark:text-orange-400 mt-1 flex items-center gap-1 font-bold"><span class="material-icons text-[12px]">support_agent</span> แอดมิน ${log.actor_name} กดให้</div>` : `<div class="text-[10px] text-gray-400 mt-1 flex items-center gap-1"><span class="material-icons text-[12px]">touch_app</span> กดด้วยตัวเอง</div>`;

        rows += `<tr class="${rowClass}"><td class="px-4 py-3 align-top"><div class="font-mono text-xs font-black text-indigo-500 dark:text-indigo-400">${timeStr} น.</div><div class="text-[10px] text-gray-500 font-bold mt-0.5">${dateStr}</div></td><td class="px-4 py-3 align-top"><div class="font-black text-sm text-slate-800 dark:text-white tracking-wide">${log.username}</div>${actorHtml}</td><td class="px-4 py-3 align-top">${actionBadge}</td><td class="px-4 py-3 align-top"><div class="font-extrabold text-xs text-slate-700 dark:text-gray-200 bg-white dark:bg-slate-900 inline-block px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-1.5 w-fit"><span class="material-icons text-gray-400 text-[14px]">today</span> ${displayLeaveDate}</div></td></tr>`;
    });
    tbody.innerHTML = rows;
}

window.toggleLeaveStatus = async function(isChecked) {
    const statusValue = isChecked ? 'true' : 'false'; 
    
    Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        if (typeof appDB === 'undefined') throw new Error('ไม่พบตัวแปรเชื่อมต่อฐานข้อมูล');

        const { error } = await appDB.from('settings').upsert([
            { key: `${currentViewDept}_is_open`, value: statusValue } 
        ]);

        if (error) throw error;

        if(deptSettings[currentViewDept]) {
            deptSettings[currentViewDept].isOpen = isChecked;
        }

        Swal.fire({ 
            icon: 'success', title: 'บันทึกสำเร็จ!', 
            text: `ระบบจองวันหยุดแผนก ${currentViewDept} ถูก ${isChecked ? 'เปิด' : 'ปิด'} แล้ว`, 
            timer: 1500, showConfirmButton: false 
        });

    } catch (error) {
        console.error('Toggle Leave Error:', error);
        Swal.fire('เกิดข้อผิดพลาด', error.message, 'error');
        document.getElementById('setForceOpen').checked = !isChecked; 
    }
};

window.loadLeaveStatusConfig = async function() {
    try {
        // [FIX] อ่านจาก deptSettings ที่โหลดมาถูกต้องแล้ว
        if (!window.leaveStatusConfig) window.leaveStatusConfig = {};
        ['AM','OD','TRAINER','AMQL','ODQL','SPECIAL','NEW'].forEach(dept => {
            if (deptSettings[dept]) {
                window.leaveStatusConfig[dept] = deptSettings[dept].isOpen ? 'true' : 'false';
            }
        });
        updateLeaveToggleUI();
    } catch(e) { console.error('Load Leave Status Error:', e); }
};

window.updateLeaveToggleUI = function() {
    const toggleBtn = document.getElementById('setForceOpen');
    if (!toggleBtn) return;

    // 🌟 เช็คค่าที่ดึงมาจาก Database ล่าสุดของแผนกปัจจุบันมาอัปเดตสวิตช์
    const s = deptSettings[currentViewDept];
    if (s && s.isOpen !== undefined) {
        toggleBtn.checked = s.isOpen;
    }
};

setTimeout(async () => {
    // รอ appDB พร้อมก่อน (สูงสุด 5 วินาที)
    let waited = 0;
    while (typeof appDB === 'undefined' && waited < 5000) {
        await new Promise(r => setTimeout(r, 200));
        waited += 200;
    }
    if (typeof loadLeaveStatusConfig === 'function') loadLeaveStatusConfig();
}, 500);

setTimeout(() => {
    const targetNode = document.getElementById('settingTargetLabel');
    if (targetNode) {
        const observer = new MutationObserver(() => { updateLeaveToggleUI(); });
        observer.observe(targetNode, { childList: true, characterData: true, subtree: true });
    }
}, 1000);

window.removeFromNewDept = async function(id, username) {
    Swal.fire({
        title: 'ยืนยันการนำออก?',
        text: `ต้องการย้าย ${username} กลับไปอยู่แผนก AM ใช่หรือไม่?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#0891b2',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'ใช่, ย้ายกลับเลย',
        cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({title: 'กำลังย้าย...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
            
            const userIndex = GLOBAL_USER_LIST.findIndex(u => String(u.id) === String(id));
            if (userIndex !== -1) GLOBAL_USER_LIST[userIndex].department = 'AM';
            
            const { error } = await appDB.from('users').update({ department: 'AM' }).eq('id', id);
            
            if (error) {
                Swal.fire('Error', error.message, 'error');
            } else {
                window.renderLeaveTable();
                Swal.fire({ icon: 'success', title: 'ย้ายสำเร็จ', timer: 1500, showConfirmButton: false });
            }
        }
    });
};

// ฟังก์ชันสำหรับบันทึกประวัติการจอง/ยกเลิกวันหยุด
window.logLeaveAction = async function(action, userId, username, dateStr) {
    try {
        if (typeof appDB !== 'undefined') {
            await appDB.from('leave_logs').insert({ 
                action_type: action, 
                user_id: userId, 
                username: username, 
                actor_name: (typeof currentUser !== 'undefined' && currentUser.username) ? currentUser.username : 'Unknown', 
                leave_date: dateStr, 
                department: (typeof currentViewDept !== 'undefined') ? currentViewDept : 'AM' 
            });
        }
    } catch (err) { 
        console.error("Log Error:", err); 
    }
};

// =========================================
// 🌟 ระบบหน่วงเวลาช่องค้นหา (พิมพ์เสร็จค่อยหา)
// =========================================
let leaveSearchTimeout = null;
window.onLeaveSearch = function() {
    clearTimeout(leaveSearchTimeout);
    leaveSearchTimeout = setTimeout(() => {
        renderLeaveTable(); // สั่งวาดตารางเมื่อหยุดพิมพ์ไปแล้ว 300ms
    }, 300); 
};

window.openManageSpecialModal = async function() {
    const users = GLOBAL_USER_LIST.filter(u => u.role === 'staff' || u.role === 'manager' || u.role === 'admin').sort((a, b) => a.username.localeCompare(b.username));
    
    // โหลดข้อมูลล่าสุดกันเหนียว
    window.specialGroupUserIds = window.specialGroupUserIds || [];

    let html = `
        <div class="flex flex-col h-full text-left">
            <div class="sticky top-0 bg-white dark:bg-slate-800 z-10 pb-2 border-b border-gray-200 dark:border-gray-600 mb-2">
                <input type="text" id="specialSearchInput" onkeyup="filterSpecialList()" placeholder="🔍 พิมพ์ชื่อเพื่อค้นหา..." 
                    class="w-full p-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-amber-500 transition font-bold text-sm">
            </div>
            <div id="specialListContainer" class="max-h-[50vh] overflow-y-auto custom-scrollbar pr-1">
    `;
    
    users.forEach(u => {
        // เช็คว่าเคยถูกติ๊กเลือกไว้ในกลุ่มพิเศษหรือยัง
        const isSpecial = window.specialGroupUserIds.includes(String(u.id)); 
        const currentDept = u.department || 'AM';
        
        let badgeColor = 'bg-blue-100 text-blue-700';
        if(currentDept === 'OD') badgeColor = 'bg-pink-100 text-pink-700';
        else if(currentDept === 'TRAINER') badgeColor = 'bg-cyan-100 text-cyan-700';
        
        html += `
            <label class="flex items-center justify-between p-2 hover:bg-amber-50 dark:hover:bg-slate-700/50 rounded-lg cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-0 transition group">
                <div class="flex items-center gap-2">
                    <span class="staff-name font-bold text-sm text-slate-700 dark:text-gray-200 group-hover:text-amber-600 transition">${u.username}</span>
                    <span class="text-[9px] font-bold ${badgeColor} px-1.5 py-0.5 rounded border border-black/5 shadow-sm">${currentDept}</span>
                </div>
                <input type="checkbox" class="special-cb w-5 h-5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer border-gray-300" value="${u.id}" ${isSpecial ? 'checked' : ''}>
            </label>
        `;
    });
    html += '</div></div>';

    const { value: selectedIds } = await Swal.fire({
        title: 'จัดการรายชื่อ (พนักงานใหม่)', html: html, showCancelButton: true, confirmButtonText: 'บันทึก', confirmButtonColor: '#f59e0b', cancelButtonText: 'ยกเลิก', width: '400px',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white' },
        preConfirm: () => {
            const checkboxes = document.querySelectorAll('.special-cb:checked');
            const ids = []; checkboxes.forEach(cb => ids.push(String(cb.value))); return ids;
        }
    });

    if (selectedIds) {
        Swal.fire({title: 'กำลังบันทึกกลุ่ม...', didOpen: () => Swal.showLoading()});
        
        // 🌟 บันทึก ID ลงในตั้งค่าระบบ โดยไม่ไปแตะแผนกหลักของพนักงาน
        window.specialGroupUserIds = selectedIds;
        await appDB.from('settings').upsert([{ key: 'leave_special_users', value: JSON.stringify(window.specialGroupUserIds) }]);

        window.renderLeaveTable();
        Swal.fire({ icon: 'success', title: 'สำเร็จ', text: 'อัปเดตรายชื่อในกลุ่มเรียบร้อย', timer: 2000, showConfirmButton: false });
    }
};

window.filterSpecialList = function() {
    const input = document.getElementById('specialSearchInput'); const filter = input.value.toLowerCase();
    const container = document.getElementById('specialListContainer'); const labels = container.getElementsByTagName('label');
    for (let i = 0; i < labels.length; i++) {
        const nameSpan = labels[i].querySelector('.staff-name');
        if (nameSpan) {
            const txtValue = nameSpan.textContent || nameSpan.innerText;
            labels[i].style.display = txtValue.toLowerCase().indexOf(filter) > -1 ? "flex" : "none";
        }
    }
};

window.removeFromSpecialDept = async function(id, username) {
    Swal.fire({
        title: 'ยืนยันการนำออก?',
        text: `ต้องการเอา ${username} ออกจากกลุ่มพิเศษนี้ใช่หรือไม่? (พนักงานจะยังอยู่ในแผนกปกติ)`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#f59e0b',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'ใช่, นำออกเลย',
        cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({title: 'กำลังนำออก...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
            
            // 🌟 ลบ ID ออกจาก Array แล้วบันทึกกลับลงไป
            window.specialGroupUserIds = window.specialGroupUserIds.filter(uid => String(uid) !== String(id));
            await appDB.from('settings').upsert([{ key: 'leave_special_users', value: JSON.stringify(window.specialGroupUserIds) }]);
            
            window.renderLeaveTable();
            Swal.fire({ icon: 'success', title: 'นำออกสำเร็จ', timer: 1500, showConfirmButton: false });
        }
    });
};

// ฟังก์ชันสำหรับดึงสีของป้ายวันหยุดแต่ละประเภท
function getLeaveBadgeStyle(reason, baseDeptColor) {
    if (reason === 'X') return 'bg-red-500 border border-red-600';
    if (reason === 'XX') return 'bg-yellow-400 text-yellow-900 border border-yellow-500';
    if (reason === 'X4') return 'bg-fuchsia-500 border border-fuchsia-600';
    if (reason === 'KL') return 'bg-green-500 border border-green-600';
    if (reason === 'TX') return 'bg-blue-500 border border-blue-600';
    if (reason === 'PN') return 'bg-orange-500 border border-orange-600';
    if (reason === 'KP') return 'bg-stone-500 border border-stone-600';
    return baseDeptColor;
}

// ผูกเข้ากับ window เผื่อมีการเรียกใช้จากจุดอื่น
window.getLeaveBadgeStyle = getLeaveBadgeStyle;

// ฟังก์ชันรับสัญญาณเรียลไทม์เวลาแอดมินกดสลับกะ
window.subscribeScheduledTasksChanges = function() {
    if(window.scheduledTasksSubscription) appDB.removeChannel(window.scheduledTasksSubscription);
    window.scheduledTasksSubscription = appDB.channel('tasks-leave-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_tasks' }, (payload) => {
        const leaveAppEl = document.getElementById('leaveApp');
        if (leaveAppEl && !leaveAppEl.classList.contains('hidden')) {
            if (typeof fetchLeaveData === 'function') fetchLeaveData();
        }
    }).subscribe();
    if (typeof window.registerPageSubscription === 'function') window.registerPageSubscription(window.scheduledTasksSubscription);
};

// ผูกฟังก์ชันเข้ากับ window ป้องกัน error หาไม่เจอ
if (typeof subscribeScheduledTasksChanges === 'undefined') {
    var subscribeScheduledTasksChanges = window.subscribeScheduledTasksChanges;
}
