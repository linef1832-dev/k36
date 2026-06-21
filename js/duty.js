let currentDutyDept = 'AM';
let dutyAccessMatrix = {}; 
let customDutyRoles = {}; 
let currentDutyLeaves = new Set(); 
let dutySubscription = null;
let sortedTeams = []; 
let currentRosterData = {};
let window_currentAssignedStaff = [];

window.isDutyAdmin = function() {
    // ปรับชื่อแผนกให้ตรงกับรหัสสิทธิ์
    let deptCheck = currentDutyDept;
    if (deptCheck === 'TRAINER_AM') deptCheck = 'AMQL';
    if (deptCheck === 'TRAINER_OD') deptCheck = 'ODQL';
    
    // ดึงค่าสิทธิ์ตามแท็บที่เปิดดูอยู่ เช่น duty_manage_am, duty_manage_od
    const reqPerm = 'duty_manage_' + deptCheck.toLowerCase();
    
    // ระบบจะยอมให้จัดการได้ ถ้ามีสิทธิ์ตรงตามแผนก หรือมีสิทธิ์จัดการแบบรวม (เผื่อแอดมินหลัก)
    return window.hasUserPerm(reqPerm) || window.hasUserPerm('duty_manage'); 
};

const LEAVE_STYLES = {
    'X': { text: '✕ หยุดปกติ', color: 'text-red-700 bg-red-100 border-red-300 dark:bg-red-900/40 dark:text-red-400', border: 'border-red-200 dark:border-red-900/50' },
    'Table-Booking': { text: '✕ หยุดปกติ', color: 'text-red-700 bg-red-100 border-red-300 dark:bg-red-900/40 dark:text-red-400', border: 'border-red-200 dark:border-red-900/50' },
    'XX': { text: 'XX เปลี่ยนกะ', color: 'text-yellow-800 bg-yellow-100 border-yellow-400 dark:bg-yellow-900/40 dark:text-yellow-400', border: 'border-yellow-300 dark:border-yellow-700/50' },
    'X4': { text: 'X4 ลาครึ่งวัน', color: 'text-pink-700 bg-pink-100 border-pink-300 dark:bg-pink-900/40 dark:text-pink-400', border: 'border-pink-200 dark:border-pink-900/50' },
    'KL': { text: 'KL ลากิจ', color: 'text-green-800 bg-green-100 border-green-400 dark:bg-green-900/40 dark:text-green-400', border: 'border-green-300 dark:border-green-800/50' },
    'TL': { text: 'TL สลับวันหยุด', color: 'text-blue-800 bg-blue-100 border-blue-400 dark:bg-blue-900/40 dark:text-blue-400', border: 'border-blue-300 dark:border-blue-800/50' },
    'TX': { text: 'TX สลับวันหยุด', color: 'text-blue-800 bg-blue-100 border-blue-400 dark:bg-blue-900/40 dark:text-blue-400', border: 'border-blue-300 dark:border-blue-800/50' },
    'PN': { text: 'PN พักร้อน', color: 'text-white bg-amber-800 border-amber-900 dark:bg-amber-900 dark:text-amber-200', border: 'border-amber-700 dark:border-amber-800/50' }
};

const TEAM_COLORS = {
    'Jun88': { bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-800', lightBg: 'bg-blue-100', lightText: 'text-blue-800' },
    'MK8': { bg: 'bg-black', text: 'text-yellow-400', border: 'border-yellow-600', lightBg: 'bg-gray-800', lightText: 'text-yellow-500' },
    'F168': { bg: 'bg-orange-500', text: 'text-white', border: 'border-orange-700', lightBg: 'bg-orange-100', lightText: 'text-orange-800' },
    'PG688': { bg: 'bg-amber-100', text: 'text-amber-900', border: 'border-amber-300', lightBg: 'bg-amber-50', lightText: 'text-amber-700' },
    'JL69': { bg: 'bg-slate-500', text: 'text-white', border: 'border-slate-700', lightBg: 'bg-slate-200', lightText: 'text-slate-800' },
    'TH26': { bg: 'bg-gray-700', text: 'text-white', border: 'border-gray-900', lightBg: 'bg-gray-200', lightText: 'text-gray-800' },
    'VV72': { bg: 'bg-red-800', text: 'text-white', border: 'border-red-950', lightBg: 'bg-red-100', lightText: 'text-red-800' },
    'Vv72': { bg: 'bg-green-700', text: 'text-white', border: 'border-green-900', lightBg: 'bg-green-100', lightText: 'text-green-800' }, 
    'NM9': { bg: 'bg-pink-500', text: 'text-white', border: 'border-pink-700', lightBg: 'bg-pink-100', lightText: 'text-pink-800' },
    'สอนงาน': { bg: 'bg-emerald-500', text: 'text-white', border: 'border-emerald-700', lightBg: 'bg-emerald-100', lightText: 'text-emerald-800' },
    'Telegram': { bg: 'bg-sky-500', text: 'text-white', border: 'border-sky-700', lightBg: 'bg-sky-100', lightText: 'text-sky-800' },
    'DEFAULT': { bg: 'bg-indigo-500', text: 'text-white', border: 'border-indigo-700', lightBg: 'bg-indigo-100', lightText: 'text-indigo-800' }
};

window.syncTeamOrder = function() {
    // ลบเงื่อนไขดักของผู้สอนออก ให้ทุกคนดึงรายชื่อเว็บจาก TEAM_LIST เหมือนกันหมด
    const savedOrder = JSON.parse(localStorage.getItem('duty_team_order') || '[]');
    let validSaved = savedOrder.filter(t => TEAM_LIST.includes(t));
    
    // ดึงเว็บมาตรฐานทั้งหมดมาใส่
    TEAM_LIST.forEach(t => { if(!validSaved.includes(t)) validSaved.push(t); });
    
    // เติม หน้าที่ส่วนกลาง ต่อท้ายเสมอ
    if (!validSaved.includes('หน้าที่ส่วนกลาง')) {
        validSaved.push('หน้าที่ส่วนกลาง');
    }
    
    sortedTeams = validSaved;
}

window.moveTeam = function(teamName, direction) {
    if (currentDutyDept === 'AMQL' || currentDutyDept === 'ODQL' || currentDutyDept.startsWith('TRAINER')) return; 
    const index = sortedTeams.indexOf(teamName);
    if(index === -1) return;
    if(direction === -1 && index > 0) { [sortedTeams[index - 1], sortedTeams[index]] = [sortedTeams[index], sortedTeams[index - 1]]; } 
    else if (direction === 1 && index < sortedTeams.length - 1) { [sortedTeams[index], sortedTeams[index + 1]] = [sortedTeams[index + 1], sortedTeams[index]]; }
    localStorage.setItem('duty_team_order', JSON.stringify(sortedTeams));
    window.renderDutyRequirements();
    window.updateDutyStats(); 
}

window.initDutyApp = async function() {
    Swal.fire({title: 'โหลดข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
    try {
        const dateInput = document.getElementById('dutyDate');
        if (dateInput && !dateInput.value) {
            const today = new Date(); const offset = today.getTimezoneOffset() * 60000;
            dateInput.value = (new Date(today - offset)).toISOString().slice(0, 10);
        }

        // 🚀 ดึง users + access matrix/roles ขนานกัน (อิสระต่อกัน)
        const initFetches = [window.loadDutyAccessAndRoles()];
        if (GLOBAL_USER_LIST.length === 0 && typeof fetchUsers === 'function') {
            initFetches.push(fetchUsers());
        }
        await Promise.all(initFetches);
        
        const teamSelect = document.getElementById('roleEditorTeam');
        if(teamSelect) {
            let opts = TEAM_LIST.map(t => `<option value="${t}">${t}</option>`);
            opts.push(`<option value="หน้าที่ส่วนกลาง" class="font-bold text-amber-500">📌 หน้าที่ส่วนกลาง</option>`);
            teamSelect.innerHTML = opts.join('');
        }
        
        window.syncTeamOrder();
        window.applyDutyRoleUI(); 

        window.renderDutyAccessTable();
        window.renderDutyRequirements();
        await window.refreshDutyData(); 
        window.renderRoleEditorList();

        window.subscribeDutyChanges(); 
        
        // 🌟 [แก้บัค Realtime] reset flag เพราะเพิ่ง refresh ไป
        window._dutyPendingReload = false;
        window._dutyLastReloadTime = Date.now();
    } catch (err) { console.error("Init Duty Error:", err); } 
    finally { Swal.close(); }
}

window.loadDutyAccessAndRoles = async function() {
    try {
        const { data } = await appDB.from('settings').select('*').in('key', ['duty_access_matrix', 'duty_custom_roles']);
        if(data) {
            const accessData = data.find(d => d.key === 'duty_access_matrix');
            if(accessData && accessData.value) dutyAccessMatrix = JSON.parse(accessData.value);
            else dutyAccessMatrix = {};

            const rolesData = data.find(d => d.key === 'duty_custom_roles');
            if(rolesData && rolesData.value && Object.keys(JSON.parse(rolesData.value)).length > 0) {
                customDutyRoles = JSON.parse(rolesData.value);
            } else { 
                // ค่าเริ่มต้นสำหรับแต่ละเว็บ
                customDutyRoles = {
                    'Jun88': ['ถอนเงิน', 'ตรวจถอนเงิน', 'คำขอโปร', 'แนะนำเพื่อน'],
                    'MK8': ['ถอนเงิน', 'ตรวจถอนเงิน'],
                    'Vv72': ['ถอนเงิน', 'ตรวจถอนเงิน', 'คำขอโปร', 'แนะนำเพื่อน'],
                    'VV72': ['ถอนเงิน', 'ตรวจถอนเงิน', 'คำขอโปร', 'แนะนำเพื่อน'],
                    'TH26': ['ถอนเงิน', 'ตรวจถอนเงิน'],
                    'K188': ['ถอนเงิน', 'ตรวจถอนเงิน', 'คำขอโปร', 'แนะนำเพื่อน'],
                    'BT678': ['ถอนเงิน', 'ตรวจถอนเงิน'],
                    'PG688': ['ถอนเงิน', 'ตรวจถอนเงิน'],
                    'JL69': ['ถอนเงิน', 'ตรวจถอนเงิน'],
                    'NM9': ['ถอนเงิน', 'ตรวจถอนเงิน'],
                    'F168': ['ถอนเงิน', 'ตรวจถอนเงิน'],
                    'หน้าที่ส่วนกลาง': ['เคสเทเลแกรม', 'ตรวจสอบหน้าเว็บ', 'ตรวจแนะนำเพื่อนกะดึก OD', 'เช็คส่งแก้ไขข้อมูล']
                }; 
                // บันทึกขึ้นฐานข้อมูลทันทีเพื่อให้แอดมินแก้ไขทีหลังได้
                appDB.from('settings').upsert([{ key: 'duty_custom_roles', value: JSON.stringify(customDutyRoles) }]);
            }
        }
    } catch(e) { dutyAccessMatrix = {}; customDutyRoles = {}; }
}

// 🌟 [แก้บัค Realtime] flag บอกว่ามีการเปลี่ยนตอนไม่อยู่หน้านี้ (ตอนเข้ามาจะ reload ทันที)
window._dutyPendingReload = false;
window._dutyLastReloadTime = 0;

window.subscribeDutyChanges = function() {
    if(dutySubscription) { 
        try { appDB.removeChannel(dutySubscription); } catch(e) {}
        dutySubscription = null;
    }
    
    dutySubscription = appDB.channel('duty-updates').on('broadcast', { event: 'force_reload' }, () => {
        const dutyApp = document.getElementById('dutyApp');
        const isOnDutyPage = dutyApp && !dutyApp.classList.contains('hidden');
        
        if (isOnDutyPage) {
            // กัน reload ถี่เกิน (debounce 800ms) เผื่อ broadcast มาหลายครั้งติดกัน
            const now = Date.now();
            if (now - window._dutyLastReloadTime < 800) {
                window._dutyPendingReload = true;
                setTimeout(() => {
                    if (window._dutyPendingReload && !document.getElementById('dutyApp').classList.contains('hidden')) {
                        window._dutyPendingReload = false;
                        window._dutyLastReloadTime = Date.now();
                        window.refreshDutyData();
                    }
                }, 1000);
                return;
            }
            window._dutyLastReloadTime = now;
            window.refreshDutyData();
        } else {
            // ไม่ได้อยู่หน้านี้ → จำไว้ก่อน ตอนกลับมาเข้าจะ reload
            window._dutyPendingReload = true;
        }
    }).subscribe();
    
    if (typeof window.registerPageSubscription === 'function') window.registerPageSubscription(dutySubscription);
    
    // 🌟 [แก้บัค Realtime] Polling fallback ทุก 30 วิ — เผื่อ broadcast หลุด/เน็ตกระตุก
    if (window._dutyPollingTimer) clearInterval(window._dutyPollingTimer);
    window._dutyPollingTimer = setInterval(() => {
        const dutyApp = document.getElementById('dutyApp');
        if (dutyApp && !dutyApp.classList.contains('hidden')) {
            // เช็คทุก 30 วิว่ามีของใหม่ไหม
            if (typeof window.refreshDutyData === 'function') {
                window.refreshDutyData();
            }
        }
    }, 30000);
}

window.applyDutyRoleUI = function() {
    const isAdmin = window.isDutyAdmin();
    const isTrainerDept = (currentUser.department === 'AMQL' || currentUser.department === 'ODQL' || (currentUser.department && currentUser.department.startsWith('TRAINER'))); 
    const isTrainerRole = (currentUser.role && currentUser.role.toLowerCase() === 'trainer');

    let canManageDuty = isAdmin;
    
    // 🚨 กฎเหล็กฮาร์ดโค้ด: ถ้ากำลังเปิดแท็บ "ผู้สอน" (AMQL, ODQL)
    // คนที่จะมีสิทธิ์จัดการ/สุ่มเวรได้ ต้องเป็น 'admin' หรือ 'manager' เท่านั้น!
    // ผู้สอน (trainer) จะถูกริบสิทธิ์ปุ่มจัดการทันที แม้ในหลังบ้านจะเผลอติ๊กสิทธิ์ไว้ก็ตาม
    if (currentDutyDept === 'AMQL' || currentDutyDept === 'ODQL' || currentDutyDept.startsWith('TRAINER')) {
        if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
            canManageDuty = false; 
        }
    }
    
    const adminElements = document.querySelectorAll('.duty-admin-only');
    const trainerBtn = document.getElementById('btnDutyTRAINER'); 
    
    if(trainerBtn) {
        if(isAdmin || isTrainerDept || isTrainerRole) {
            trainerBtn.classList.remove('hidden', 'no-perm-hidden'); trainerBtn.style.display = '';
        } else trainerBtn.classList.add('hidden');
    }
    
    if (!canManageDuty) {
        adminElements.forEach(el => { el.style.display = 'none'; el.classList.add('hidden'); });
        const shiftSelect = document.getElementById('dutyShiftSelect');
        if (shiftSelect && currentUser.allowed_shift !== 'all') shiftSelect.value = currentUser.allowed_shift;
        const indicator = document.getElementById('staffShiftIndicator');
        if (indicator) {
            indicator.classList.remove('hidden', 'no-perm-hidden'); indicator.style.display = '';
            document.getElementById('staffShiftLabel').innerText = (currentUser.allowed_shift || 'ไม่ระบุกะ');
        }
    } else {
        adminElements.forEach(el => { el.style.display = ''; el.classList.remove('hidden', 'no-perm-hidden'); });
        const indicator = document.getElementById('staffShiftIndicator');
        if(indicator) indicator.classList.add('hidden');
    }
}

window.switchDutyTab = function(tabName) {
    document.getElementById('dutyTabRoster')?.classList.add('hidden');
    document.getElementById('dutyTabRoster')?.classList.remove('flex');
    document.getElementById('dutyTabSettings')?.classList.add('hidden');
    document.getElementById('dutyTabSettings')?.classList.remove('flex');
    document.getElementById('dutyTabStandby')?.classList.add('hidden');
    
    const resetClass = 'px-3 py-1.5 rounded-md text-xs font-bold text-indigo-300 hover:text-white transition';
    const activeClass = 'px-3 py-1.5 rounded-md text-xs font-bold bg-indigo-500 text-white shadow transition';
    
    const btnRoster = document.getElementById('tabBtnRoster');
    const btnSettings = document.getElementById('tabBtnSettings');
    const btnStandby = document.getElementById('tabBtnStandby');
    
    if (btnRoster) btnRoster.className = resetClass;
    if (btnSettings) btnSettings.className = resetClass;
    if (btnStandby) btnStandby.className = resetClass + ' flex items-center gap-1';
    
    if (tabName === 'roster') {
        document.getElementById('dutyTabRoster').classList.remove('hidden');
        document.getElementById('dutyTabRoster').classList.add('flex');
        if (btnRoster) btnRoster.className = activeClass;
        window.renderDutyRequirements();
        if(window.isDutyAdmin()) window.updateDutyStats();
    } else if (tabName === 'standby') {
        document.getElementById('dutyTabStandby').classList.remove('hidden');
        if (btnStandby) btnStandby.className = activeClass + ' flex items-center gap-1';
        if (typeof loadStandbyConfig === 'function') loadStandbyConfig();
    } else {
        document.getElementById('dutyTabSettings').classList.remove('hidden');
        document.getElementById('dutyTabSettings').classList.add('flex');
        if (btnSettings) btnSettings.className = activeClass;
    }
}

window.switchDutyDept = function(dept) {
    currentDutyDept = dept;
    
    document.getElementById('btnDutyAM')?.classList.remove('active'); 
    document.getElementById('btnDutyOD')?.classList.remove('active');
    document.getElementById('btnDutyAMQL')?.classList.remove('active'); 
    document.getElementById('btnDutyODQL')?.classList.remove('active');
    document.getElementById('btnDutyTRAINER_AM')?.classList.remove('active'); 
    document.getElementById('btnDutyTRAINER_OD')?.classList.remove('active');
    
    document.getElementById(`btnDuty${dept}`)?.classList.add('active');

    // แสดง/ซ่อนปุ่มแจกโปร/เคส TG เฉพาะ OD
    const btnODTask = document.getElementById('btnAssignODTasks');
    if (btnODTask) {
        if (dept === 'OD') btnODTask.classList.remove('hidden');
        else btnODTask.classList.add('hidden');
    }
    
    let labelText = dept;
    if (dept === 'AMQL') labelText = 'ผู้สอน AM';
    else if (dept === 'ODQL') labelText = 'ผู้สอน OD';
    else if (dept.startsWith('TRAINER')) {
        labelText = dept.replace('TRAINER_', 'ผู้สอน '); 
    }
    const labelEl = document.getElementById('dutyDeptLabel'); 
    if(labelEl) labelEl.innerText = labelText;
    
    const filterTrainer = document.getElementById('trainerDeptFilterContainer');
    
    // โชว์ตัวกรองแผนกผู้สอนตามปกติ
    if (dept === 'AMQL' || dept === 'ODQL' || dept.startsWith('TRAINER')) {
        if (filterTrainer) filterTrainer.classList.remove('hidden');
    } else {
        if (filterTrainer) filterTrainer.classList.add('hidden');
    }
    
    // บังคับซ่อนช่องเลือกหมวดตลอดเวลา
    const taskModeContainer = document.getElementById('trainerTaskModeContainer');
    if (taskModeContainer) { taskModeContainer.classList.add('hidden'); taskModeContainer.classList.remove('flex'); }
    
    const grid = document.getElementById('dutyResultGrid');
    if (grid) grid.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center py-20 text-gray-400"><span class="material-icons animate-spin text-5xl text-indigo-500 mb-2">sync</span><span class="font-bold text-sm">กำลังจัดเตรียมตาราง...</span></div>`;
    
    setTimeout(() => {
        window.syncTeamOrder(); window.applyDutyRoleUI(); window.renderDutyAccessTable(); window.renderDutyRequirements(); window.refreshDutyData(); 
    }, 50);
};

// ลบการแนบค่า Telegram ลงท้ายชื่อไฟล์เซฟตาราง
function getDutySaveKey(date, shift) {
    return `duty_roster_${currentDutyDept}_${date}_${shift}`;
}

window.currentDutyLeaveData = []; 

window.refreshDutyData = async function() {
    try {
        window.ensureImportantTasksContainer(); // 🌟 NEW: สร้างโครงสร้างกล่องงานพิเศษ

        const targetDateInput = document.getElementById('dutyDate');
        const shiftFilterInput = document.getElementById('dutyShiftSelect');
        
        if (!targetDateInput || !shiftFilterInput) return; 
        
        const targetDate = targetDateInput.value;
        const shiftFilter = shiftFilterInput.value;
        if(!targetDate) return;

        // 🚀 คำนวณคีย์ทั้งหมดก่อน เพื่อยิง 3 query ขนานกันได้ในรอบเดียว
        const saveKey = getDutySaveKey(targetDate, shiftFilter);
        const impListKey = `duty_important_tasks_list_${currentDutyDept}_${shiftFilter}`;
        const impAssignKey = `duty_important_assign_${currentDutyDept}_${targetDate}_${shiftFilter}`;
        const impLockKey = `duty_important_permanent_lock_${currentDutyDept}_${shiftFilter}`;

        // 🚀 ดึง 3 ชุดข้อมูลขนานกัน (leaves + schedules + settings) ลด latency 3 เท่า
        const [leavesRes, schedulesRes, settingsRes] = await Promise.all([
            appDB.from('leave_requests').select('user_id, reason, user_name').eq('leave_date', targetDate),
            appDB.from('schedules').select('staff_name, time_slot').eq('work_date', targetDate).eq('shift_name', shiftFilter),
            appDB.from('settings').select('value, key').in('key', [saveKey, impListKey, impAssignKey, impLockKey])
        ]);

        // ประมวลผล leaves
        const leaves = leavesRes && leavesRes.data;
        currentDutyLeaves = new Set();
        if (leaves) leaves.forEach(l => currentDutyLeaves.add(String(l.user_id)));

        // ประมวลผล schedules
        window.currentDutySchedules = (schedulesRes && schedulesRes.data) ? schedulesRes.data : [];

        const relevantLeaves = [];
        if (leaves && typeof GLOBAL_USER_LIST !== 'undefined' && GLOBAL_USER_LIST.length > 0) {
            leaves.forEach(l => {
                let userObj = GLOBAL_USER_LIST.find(u => String(u.id) === String(l.user_id) || u.username === l.user_name);
                if (userObj) {
                    let uDept = userObj.department || 'AM';
                    if (uDept === 'TRAINER') uDept = 'AMQL';
                    if (uDept === currentDutyDept) {
                        relevantLeaves.push({ user_id: userObj.id, username: userObj.username, reason: l.reason, originalShift: userObj.allowed_shift || 'all' });
                    }
                }
            });
        }
        window.currentDutyLeaveData = relevantLeaves;
        window.renderDutyLeaveBox();

        let savedRoster = null;
        window.globalImportantTasks = [];
        window.currentImportantAssigns = {};
        window.lockedImportantTasks = {};

        try {
            const data = settingsRes && settingsRes.data;
            if (data && data.length > 0) {
                const rosterRow = data.find(d => d.key === saveKey);
                if (rosterRow && rosterRow.value) savedRoster = rosterRow;

                const listRow = data.find(d => d.key === impListKey);
                if (listRow && listRow.value) window.globalImportantTasks = JSON.parse(listRow.value);

                const assignRow = data.find(d => d.key === impAssignKey);
                if (assignRow && assignRow.value) window.currentImportantAssigns = JSON.parse(assignRow.value);

                const lockRow = data.find(d => d.key === impLockKey);
                if (lockRow && lockRow.value) {
                    let parsedLock = JSON.parse(lockRow.value);
                    // 🌟 แก้บั๊ก: ป้องกันโครงสร้างข้อมูลเก่าตีกัน (ถ้าของเก่าเป็น Array ให้ล้างทิ้งเป็น Object)
                    if (Array.isArray(parsedLock)) {
                        window.lockedImportantTasks = {};
                    } else {
                        window.lockedImportantTasks = parsedLock || {};
                    }
                }
            }
            
            // 🌟 ดึงคนที่ถูกล็อค มายัดใส่ในตารางอัตโนมัติ (เฉพาะวันนี้และอนาคต ป้องกันประวัติอดีตหาย)
            let needSave = false;
            
            // สร้างวันที่ปัจจุบัน (อิงตามเวลาท้องถิ่น)
            const t = new Date();
            const todayStr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
            
            // ถ้าย้อนไปดูอดีต จะไม่เอาระบบล็อคปัจจุบันไปทับเด็ดขาด (ทำงานเฉพาะเป้าหมาย >= วันนี้)
            if (targetDate >= todayStr) {
                for (const [lTask, lUser] of Object.entries(window.lockedImportantTasks)) {
                    if (window.globalImportantTasks.includes(lTask)) {
                        if (window.currentImportantAssigns[lTask] !== lUser) {
                            window.currentImportantAssigns[lTask] = lUser;
                            needSave = true; 
                        }
                    }
                }
            }
            
            // ถ้ายัดชื่อเข้าตารางใหม่ ให้บันทึกเพื่อจองตัวในวันนั้นๆ ไปเลย
            if (needSave && targetDate) {
                appDB.from('settings').upsert([{ key: impAssignKey, value: JSON.stringify(window.currentImportantAssigns) }]);
            }
            
        } catch(e) { console.log(e); }
        
        window.renderImportantTasksPanel();
        // ----------------------------------------------------

        const btnGen = document.getElementById('btnGenerateRoster');
        const grid = document.getElementById('dutyResultGrid');
        const matrixGrid = document.getElementById('dutyMatrixGrid');

        if (savedRoster && savedRoster.value) {
            const parsedRoster = JSON.parse(savedRoster.value);
            window.renderRosterGrid(parsedRoster); 
            if (btnGen) {
                btnGen.disabled = true; btnGen.innerHTML = '<span class="material-icons text-base">lock</span> จัดแล้ว (ต้องล้างก่อน)';
                btnGen.classList.replace('bg-indigo-600', 'bg-gray-500'); btnGen.classList.replace('hover:bg-indigo-700', 'hover:bg-gray-600');
            }
        } else {
            if(grid) grid.innerHTML = '<div class="col-span-full flex flex-col items-center justify-center py-20 text-gray-400 opacity-50"><span class="material-icons text-6xl mb-2">event_busy</span><span class="font-bold text-lg">ยังไม่มีการจัดเวรในกะนี้</span></div>';
            
            if(matrixGrid) matrixGrid.innerHTML = '<div class="flex flex-col items-center justify-center py-20 text-gray-400 opacity-50 h-full"><span class="material-icons text-6xl mb-2">event_busy</span><span class="font-bold text-lg">ยังไม่มีการจัดเวรในกะนี้</span></div>'; 

            if (btnGen) {
                btnGen.disabled = false; btnGen.innerHTML = '<span class="material-icons text-base">casino</span> สุ่มจัดหน้าที่';
                btnGen.classList.replace('bg-gray-500', 'bg-indigo-600'); btnGen.classList.replace('hover:bg-gray-600', 'hover:bg-indigo-700');
            }
        }

        const backupData = localStorage.getItem(`backup_${saveKey}`);
        const btnRestore = document.getElementById('btnRestoreRoster');
        if (btnRestore) {
            if (backupData && (!savedRoster || !savedRoster.value)) btnRestore.classList.remove('hidden');
            else btnRestore.classList.add('hidden');
        }

        if (window.isDutyAdmin()) window.updateDutyStats();
    } catch (err) { console.error("Refresh Duty Data Error:", err); }
};

window.renderDutyLeaveBox = function() {
    const leaveContainer = document.getElementById('dutyLeaveList');
    const leaveBadge = document.getElementById('leaveCountBadge');
    if (!leaveContainer) return;

    const shiftFilterEl = document.getElementById('dutyLeaveShiftFilter');
    const typeFilterEl = document.getElementById('dutyLeaveTypeFilter');
    const shiftFilter = shiftFilterEl ? shiftFilterEl.value : 'all';
    const typeFilter = typeFilterEl ? typeFilterEl.value : 'all';

    let filteredLeaves = [...window.currentDutyLeaveData];

    if (shiftFilter !== 'all') {
        if (shiftFilter === 'all_shift') filteredLeaves = filteredLeaves.filter(l => l.originalShift === 'all');
        else filteredLeaves = filteredLeaves.filter(l => l.originalShift === shiftFilter);
    }

    if (typeFilter !== 'all') {
        filteredLeaves = filteredLeaves.filter(l => {
            const rsn = l.reason || 'X';
            if (typeFilter === 'X') return rsn === 'X' || rsn === 'Table-Booking';
            if (typeFilter === 'TL') return rsn === 'TL' || rsn === 'TX';
            return rsn === typeFilter;
        });
    }

    leaveBadge.innerText = filteredLeaves.length;
    let leaveHtml = '';

    if (filteredLeaves.length > 0) {
        filteredLeaves.sort((a, b) => a.username.localeCompare(b.username));
        filteredLeaves.forEach(l => {
            const rsn = l.reason || 'X';
            const style = LEAVE_STYLES[rsn] || { text: rsn, color: 'text-gray-600 bg-gray-100 border-gray-300 dark:bg-slate-700 dark:text-gray-300', border: 'border-gray-200 dark:border-slate-600' };
            let displayRsn = style.text;
            let badgeColor = style.color;
            let boxBorder = style.border;

            const shiftTag = l.originalShift && l.originalShift !== '?' ? `<span class="text-[8px] text-gray-400 ml-1">(${l.originalShift.replace('กะ','')})</span>` : '';

            leaveHtml += `
                <div onclick="restoreFromLeave('${l.user_id}', '${l.username}')" title="คลิกเพื่อดึงกลับมาทำงาน" class="bg-white dark:bg-slate-700 p-1.5 rounded-lg border ${boxBorder} shadow-sm flex justify-between items-center mb-1.5 transition-all hover:bg-blue-50 dark:hover:bg-slate-600 group cursor-pointer hover:border-blue-500">
                    <span class="text-[11px] font-bold text-slate-700 dark:text-gray-200 truncate pr-2 flex items-center">
                        <span class="material-icons text-[14px] text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity mr-1">settings_backup_restore</span>
                        ${l.username} ${shiftTag}
                    </span>
                    <span class="text-[9px] font-black ${badgeColor} px-1.5 py-0.5 rounded border shadow-sm whitespace-nowrap group-hover:scale-105 transition-transform">${displayRsn}</span>
                </div>
            `;
        });
        leaveContainer.innerHTML = leaveHtml; 
    } else { 
        leaveContainer.innerHTML = `<div class="text-center text-[10px] text-gray-400 mt-4">ไม่มีข้อมูลตามตัวกรอง</div>`; 
    }
};

window.restoreFromLeave = async function(userId, username) {
    const canRestore = window.isDutyAdmin();
    
    if (!canRestore) {
        return Swal.fire({
            icon: 'error',
            title: 'ไม่มีสิทธิ์ทำรายการ',
            text: 'เฉพาะ Admin, Manager และ Trainer เท่านั้น ที่สามารถดึงพนักงานกลับมาทำงานได้ครับ!',
            confirmButtonColor: '#d33',
            customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl' }
        });
    }
    
    let optionsHtml = '<option value="" disabled selected>-- เลือกเว็บที่จะให้ไปทำ --</option>';
    sortedTeams.forEach(t => { optionsHtml += `<option value="${t}">${t}</option>`; });

    const { value: selectedTeam } = await Swal.fire({
        title: `<div class="text-xl font-black text-blue-500 mt-2">ดึงพนักงานกลับมาทำงาน</div>`,
        html: `
            <div class="mb-4 text-sm text-gray-500 dark:text-gray-400">ดึง <b class="text-slate-800 dark:text-white text-lg">${username}</b> ออกจากช่องลาหยุด<br>ต้องการให้ไปลงหน้าที่เว็บไหนครับ?</div>
            <select id="swal-restore-team" class="w-full p-3.5 rounded-xl border border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500 shadow-inner cursor-pointer text-sm transition">
                ${optionsHtml}
            </select>
        `,
        showCancelButton: true, confirmButtonColor: '#3b82f6', cancelButtonColor: '#64748b', confirmButtonText: 'ยืนยัน (ดึงกลับ)', cancelButtonText: 'ยกเลิก',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl border border-slate-700 shadow-2xl' },
        preConfirm: () => {
            const select = document.getElementById('swal-restore-team');
            if (!select.value) { Swal.showValidationMessage('กรุณาเลือกเว็บด้วยครับ!'); return false; }
            return select.value;
        }
    });

    if (selectedTeam) {
        Swal.fire({title: 'กำลังย้ายข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
        try {
            const targetDate = document.getElementById('dutyDate').value;
            const shiftFilter = document.getElementById('dutyShiftSelect').value;

            await appDB.from('leave_requests').delete().eq('user_id', userId).eq('leave_date', targetDate);

            const fullUserObj = GLOBAL_USER_LIST.find(u => String(u.id) === String(userId));
            if (fullUserObj) {
                if(!currentRosterData[selectedTeam]) currentRosterData[selectedTeam] = [];
                const isExist = currentRosterData[selectedTeam].some(u => String(u.id) === String(userId));
                if (!isExist) currentRosterData[selectedTeam].push({
                    ...fullUserObj,
                    assigned_by: currentUser.username,
                    assigned_at: new Date().toISOString()
                });
                
                const saveKey = getDutySaveKey(targetDate, shiftFilter);
                await appDB.from('settings').upsert([{ key: saveKey, value: JSON.stringify(currentRosterData) }]);
            }

            await appDB.from('system_logs').insert([{ action_type: 'ย้ายหน้าที่', performed_by: currentUser.username, target_details: `ดึง ${username} กลับจากการลา ไปใส่เว็บ [${selectedTeam}] วันที่: ${targetDate}` }]);
            appDB.channel('duty-updates').send({ type: 'broadcast', event: 'force_reload' });
            await window.refreshDutyData();

            Swal.fire({icon: 'success', title: 'ดึงกลับสำเร็จ!', text: `${username} ไปอยู่เว็บ ${selectedTeam} แล้ว`, timer: 1500, showConfirmButton: false});
        } catch (err) { Swal.fire('เกิดข้อผิดพลาด', err.message, 'error'); }
    }
};

window.addStaffToRoster = async function() {
    const targetDate = document.getElementById('dutyDate').value;
    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    if (!targetDate) return Swal.fire('!', 'กรุณาเลือกวันที่ก่อน', 'warning');

    if (typeof GLOBAL_USER_LIST === 'undefined' || !GLOBAL_USER_LIST || GLOBAL_USER_LIST.length === 0) {
        return Swal.fire('!', 'ยังโหลดรายชื่อพนักงานไม่เสร็จ กรุณารอสักครู่แล้วลองใหม่', 'warning');
    }

    // 1. หาคนที่อยู่ใน roster อยู่แล้ว (ไม่ต้องโชว์ในรายการให้เลือก)
    const alreadyAssignedIds = new Set();
    for (const team in currentRosterData) {
        (currentRosterData[team] || []).forEach(u => {
            if (u && u.id) alreadyAssignedIds.add(String(u.id));
        });
    }

    // 2. คัดกรองพนักงานที่:
    //    - แผนกตรงกับ currentDutyDept (สำหรับ AMQL/ODQL ผ่อนเงื่อนไข)
    //    - กะตรงกับ shiftFilter (หรือ allowed_shift = 'all')
    //    - ไม่ลาหยุด
    //    - ไม่อยู่ใน roster อยู่แล้ว
    //    - ไม่ใช่ admin/manager/trainer
    const candidates = GLOBAL_USER_LIST.filter(u => {
        if (!u || !u.username) return false;
        if (alreadyAssignedIds.has(String(u.id))) return false;
        if (currentDutyLeaves && currentDutyLeaves.has(String(u.id))) return false;

        const role = (u.role || 'staff').toLowerCase();
        if (['admin', 'manager'].includes(role)) return false;

        // เช็คแผนก
        let uDept = u.department || 'AM';
        if (uDept === 'TRAINER') uDept = 'AMQL';
        if (uDept !== currentDutyDept) return false;

        // เช็คกะ
        const allowedShift = u.allowed_shift || 'all';
        if (allowedShift !== 'all' && allowedShift !== shiftFilter) return false;

        return true;
    }).sort((a, b) => a.username.localeCompare(b.username, 'th'));

    if (candidates.length === 0) {
        return Swal.fire({
            icon: 'info',
            title: 'ไม่มีพนักงานให้เพิ่ม',
            html: `ไม่พบพนักงานที่:<br>• แผนก <b>${currentDutyDept}</b><br>• กะ <b>${shiftFilter}</b><br>• ยังไม่อยู่ในตาราง / ไม่ลาหยุด`,
            customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl' }
        });
    }

    // 3. เตรียม dropdown เว็บ (เรียง A-Z)
    const allTeams = (typeof TEAM_LIST !== 'undefined' ? [...TEAM_LIST] : Object.keys(currentRosterData));
    const sortedTeams = allTeams.sort((a, b) => a.localeCompare(b));
    if (sortedTeams.length === 0) {
        return Swal.fire('!', 'ไม่มีรายชื่อเว็บ/ทีมในระบบ', 'warning');
    }

    let userOptionsHtml = '<option value="" disabled selected>-- เลือกพนักงาน --</option>';
    candidates.forEach(u => {
        const shiftTag = (u.allowed_shift && u.allowed_shift !== 'all') ? ` [${u.allowed_shift.replace('กะ','')}]` : ' [อิสระ]';
        userOptionsHtml += `<option value="${u.id}">${u.username}${shiftTag}</option>`;
    });

    let teamOptionsHtml = '<option value="" disabled selected>-- เลือกเว็บที่จะใส่ --</option>';
    sortedTeams.forEach(t => {
        const cnt = (currentRosterData[t] || []).length;
        teamOptionsHtml += `<option value="${t}">${t} (${cnt} คน)</option>`;
    });

    // 4. เปิด Modal ให้เลือก
    const result = await Swal.fire({
        title: `<div class="text-xl font-black text-emerald-500 mt-2">เพิ่มพนักงานเข้าตาราง</div>`,
        html: `
            <div class="text-left text-xs text-gray-500 dark:text-gray-400 mb-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-2.5 rounded-lg">
                <span class="material-icons text-[14px] align-middle text-emerald-500">info</span>
                <span class="align-middle">วันที่: <b class="text-slate-800 dark:text-white">${targetDate}</b> | กะ: <b class="text-slate-800 dark:text-white">${shiftFilter}</b> | แผนก: <b class="text-slate-800 dark:text-white">${currentDutyDept}</b></span>
            </div>
            <div class="text-left mb-2"><label class="text-xs font-bold text-gray-600 dark:text-gray-300">พนักงาน (ที่ยังไม่อยู่ในตาราง):</label></div>
            <select id="swal-add-user" class="w-full p-3 rounded-xl border border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-white font-bold outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer text-sm mb-3">
                ${userOptionsHtml}
            </select>
            <div class="text-left mb-2"><label class="text-xs font-bold text-gray-600 dark:text-gray-300">ใส่เข้าเว็บ:</label></div>
            <select id="swal-add-team" class="w-full p-3 rounded-xl border border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-white font-bold outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer text-sm">
                ${teamOptionsHtml}
            </select>
        `,
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'เพิ่มเข้าตาราง',
        cancelButtonText: 'ยกเลิก',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl border border-slate-700 shadow-2xl' },
        preConfirm: () => {
            const userId = document.getElementById('swal-add-user').value;
            const team = document.getElementById('swal-add-team').value;
            if (!userId) { Swal.showValidationMessage('กรุณาเลือกพนักงาน'); return false; }
            if (!team) { Swal.showValidationMessage('กรุณาเลือกเว็บปลายทาง'); return false; }
            return { userId, team };
        }
    });

    if (!result.isConfirmed || !result.value) return;
    const { userId, team } = result.value;

    // 5. ทำการ save
    Swal.fire({title: 'กำลังเพิ่ม...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
    try {
        const fullUserObj = GLOBAL_USER_LIST.find(u => String(u.id) === String(userId));
        if (!fullUserObj) throw new Error('ไม่พบข้อมูลพนักงาน');

        if (!currentRosterData[team]) currentRosterData[team] = [];
        const isExist = currentRosterData[team].some(u => String(u.id) === String(userId));
        if (isExist) {
            return Swal.fire('ซ้ำ!', `${fullUserObj.username} อยู่ในเว็บ ${team} อยู่แล้ว`, 'info');
        }
        currentRosterData[team].push({
            ...fullUserObj,
            assigned_by: currentUser.username,
            assigned_at: new Date().toISOString()
        });

        const saveKey = getDutySaveKey(targetDate, shiftFilter);
        const { error } = await appDB.from('settings').upsert([{ key: saveKey, value: JSON.stringify(currentRosterData) }]);
        if (error) throw error;

        await appDB.from('system_logs').insert([{
            action_type: 'ย้ายหน้าที่',
            performed_by: currentUser.username,
            target_details: `เพิ่ม ${fullUserObj.username} เข้าเว็บ [${team}] (${currentDutyDept}, ${shiftFilter}, ${targetDate})`
        }]);

        try { appDB.channel('duty-updates').send({ type: 'broadcast', event: 'force_reload' }); } catch(e) {}
        await window.refreshDutyData();

        Swal.fire({
            icon: 'success',
            title: 'เพิ่มสำเร็จ!',
            text: `${fullUserObj.username} ถูกใส่เข้าเว็บ ${team} แล้ว`,
            timer: 1500,
            showConfirmButton: false
        });
    } catch (err) {
        console.error('addStaffToRoster error:', err);
        Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
    }
};

window.clearDutyRoster = async function() {
    const targetDate = document.getElementById('dutyDate').value;
    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    if(!targetDate) return Swal.fire('!', 'กรุณาเลือกวันที่ก่อน', 'warning');

    Swal.fire({
        title: 'ยืนยันการล้างตาราง?', text: `คุณต้องการลบตารางงานวันที่ ${targetDate} (${shiftFilter}) ใช่หรือไม่? (หน้าที่ประจำที่ล็อคไว้จะไม่หาย)`, icon: 'warning',
        showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'ล้างเลย', cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({title: 'กำลังล้างข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
            const saveKey = getDutySaveKey(targetDate, shiftFilter);
            const reportKey = `report_${currentDutyDept}_${targetDate}_${shiftFilter}`; 
            const impAssignKey = `duty_important_assign_${currentDutyDept}_${targetDate}_${shiftFilter}`; 
            
            try {
                let currentDataVal = null;
                const { data: currentData } = await appDB.from('settings').select('value').eq('key', saveKey);
                if (currentData && currentData.length > 0) currentDataVal = currentData[0].value;
                
                if (currentDataVal) {
                    localStorage.setItem(`backup_${saveKey}`, currentDataVal);
                }
                
                await appDB.from('settings').delete().eq('key', saveKey);
                
                // 🌟 เก็บคนที่โดนล็อคไว้ ไม่ลบทิ้ง
                const keysKept = Object.keys(window.lockedImportantTasks);
                keysKept.forEach(k => {
                    if (!window.globalImportantTasks.includes(k)) delete window.currentImportantAssigns[k];
                });
                
                let newAssigns = {};
                for (const [k, v] of Object.entries(window.lockedImportantTasks)) {
                    if (window.globalImportantTasks.includes(k)) newAssigns[k] = v;
                }
                
                await appDB.from('settings').upsert([{ key: impAssignKey, value: JSON.stringify(newAssigns) }]);
                if (currentDutyDept === 'AMQL' || currentDutyDept === 'ODQL' || currentDutyDept.startsWith('TRAINER')) await appDB.from('settings').delete().eq('key', reportKey);
                
                await appDB.from('system_logs').insert([{ action_type: 'ล้างตารางงาน', performed_by: currentUser.username, target_details: `ล้างตาราง ${currentDutyDept} (${shiftFilter}, ${targetDate})` }]);
                appDB.channel('duty-updates').send({ type: 'broadcast', event: 'force_reload' });
                
                Swal.fire({ icon: 'success', title: 'ล้างตารางเรียบร้อย', showConfirmButton: false, timer: 1500 });
                if(typeof window.refreshDutyData === 'function') window.refreshDutyData(); 
            } catch (e) { Swal.fire('Error', e.message, 'error'); }
        }
    });
};

window.generateDutyRoster = async function() {
    const targetDate = document.getElementById('dutyDate').value;
    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    if(!targetDate) return Swal.fire('!', 'กรุณาเลือกวันที่ก่อน', 'warning');

    const saveKeyCheck = getDutySaveKey(targetDate, shiftFilter);
    
    let checkExistVal = null;
    try {
        const { data: checkExist } = await appDB.from('settings').select('value').eq('key', saveKeyCheck);
        if (checkExist && checkExist.length > 0) checkExistVal = checkExist[0].value;
    } catch(e) {}
    
    if (checkExistVal) {
         window.refreshDutyData(); 
         return Swal.fire('ป้องกันการจัดซ้ำ!', 'กะนี้มีการจัดหน้าที่ไปแล้ว กรุณากดปุ่ม "ล้างตาราง" ก่อนสุ่มใหม่ครับ', 'warning');
    }

    const activeStaff = GLOBAL_USER_LIST.filter(u => {
        let uDept = u.department || 'AM';
        if (uDept === 'TRAINER') uDept = 'AMQL'; 
        
        const isCorrectDept = uDept === currentDutyDept;
        const hasValidRole = (currentDutyDept === 'AMQL' || currentDutyDept === 'ODQL' || currentDutyDept.startsWith('TRAINER')) ? true : (u.role === 'staff');
        const isShiftMatch = (u.allowed_shift === shiftFilter || u.allowed_shift === 'all');
        return hasValidRole && isCorrectDept && isShiftMatch && !currentDutyLeaves.has(String(u.id));
    });
    
    let requiredCount = 0; document.querySelectorAll('.req-input').forEach(i => requiredCount += (parseInt(i.value) || 0));

    if(activeStaff.length === 0) return Swal.fire('ข้อมูลไม่พอ', `ไม่มีพนักงานมาทำงานในกะนี้เลย (ลองเช็คสิทธิ์หรือรายชื่ออีกครั้ง)`, 'error');
    if(requiredCount > activeStaff.length) return Swal.fire('ขาดคน!', `คุณจัดงาน ${requiredCount} คน แต่มีคนว่างแค่ ${activeStaff.length} คน (กรุณาลดจำนวน)`, 'error');

    Swal.fire({title: 'กำลังจัดตารางหลัก...', text: 'ระบบกำลังจัดหน้าที่หลัก โดยจะยังไม่แจกงานรอง...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});

    try {
        const tDateObj = new Date(targetDate);
        tDateObj.setDate(tDateObj.getDate() - 1);
        const yestDateStr = tDateObj.toISOString().split('T')[0];
        const yestSaveKey = getDutySaveKey(yestDateStr, shiftFilter);

        let yestTeamMap = {}; 
        try {
            const { data: yestData } = await appDB.from('settings').select('value').eq('key', yestSaveKey);
            if (yestData && yestData.length > 0 && yestData[0].value) {
                const yestRoster = JSON.parse(yestData[0].value);
                for (const team in yestRoster) {
                    yestRoster[team].forEach(u => {
                        if (!u.username.includes('ขาดคน')) {
                            yestTeamMap[u.id] = team;
                        }
                    });
                }
            }
        } catch(e) { console.log("ไม่มีประวัติตารางของเมื่อวาน"); }

        const requirements = {}; const reqsToSave = {};
        document.querySelectorAll('.req-input').forEach(input => {
            const team = input.id.replace('req_', ''); const count = parseInt(input.value) || 0;
            requirements[team] = count; reqsToSave[input.id] = count;
        });
        localStorage.setItem(`duty_reqs_${currentDutyDept}`, JSON.stringify(reqsToSave));

        let unassignedPool = [...activeStaff];
        const rosterResult = {}; 
        sortedTeams.forEach(t => rosterResult[t] = []); 
        let remainingReqs = { ...requirements };

        while (true) {
            let teamsNeedingPeople = sortedTeams.filter(t => remainingReqs[t] > 0);
            if (teamsNeedingPeople.length === 0) break; 

            let teamStats = teamsNeedingPeople.map(team => {
                // 🌟 หาคนที่ "ไม่ได้ทำเว็บนี้เมื่อวาน" และมีสิทธิ์เข้า — กฎเข้ม
                let eligible = unassignedPool.filter(u => {
                    const access = dutyAccessMatrix[u.id] || [];
                    if (!access.includes(team)) return false;
                    if (yestTeamMap[u.id] === team) return false; // ❌ ห้ามทำเว็บเดิมซ้ำกับเมื่อวาน
                    return true;
                });

                // 🛟 Fallback: ถ้าไม่มีคนที่ผ่านเงื่อนไขเลย → ผ่อนกฎ (ยอมให้ทำซ้ำ) เพื่อไม่ให้ตารางขาด
                let relaxed = false;
                if (eligible.length === 0) {
                    eligible = unassignedPool.filter(u => (dutyAccessMatrix[u.id] || []).includes(team));
                    relaxed = true;
                }
                return { team: team, eligibleCount: eligible.length, eligibleUsers: eligible, relaxed };
            });

            teamStats.sort((a, b) => a.eligibleCount - b.eligibleCount);
            let target = teamStats[0];
            let teamToFill = target.team;

            if (target.eligibleCount === 0) {
                rosterResult[teamToFill].push({ username: '<span class="text-red-500 font-bold bg-red-50 px-1 rounded border border-red-200"><span class="material-icons text-[10px]">warning</span> ขาดคน (ไม่มีสิทธิ์)</span>' });
                remainingReqs[teamToFill]--;
                continue;
            }

            let userOptions = target.eligibleUsers.map(u => {
                let access = dutyAccessMatrix[u.id] || [];
                let viableTeamsCount = access.filter(t => remainingReqs[t] > 0).length;
                let didThisTeamYesterday = (yestTeamMap[u.id] === teamToFill) ? 1 : 0;
                
                return { user: u, flexibility: viableTeamsCount, access: access, didYest: didThisTeamYesterday }; 
            });

            userOptions.sort((a, b) => {
                if (a.didYest !== b.didYest) return a.didYest - b.didYest; 
                if (a.flexibility !== b.flexibility) return a.flexibility - b.flexibility;
                return Math.random() - 0.5;
            });

            // 🌟 พระเอกอยู่ตรงนี้: ตอนดึงคนมาลง เราบังคับเคลียร์งานรอง (ความจำเก่า) ทิ้งให้เป็น null เสมอ!
            let pickedUser = { ...userOptions[0].user }; 
            pickedUser.secondary_team = null; 
            pickedUser.assigned_by = currentUser.username;
            pickedUser.assigned_at = new Date().toISOString();
            
            rosterResult[teamToFill].push(pickedUser);
            remainingReqs[teamToFill]--;
            unassignedPool = unassignedPool.filter(u => u.id !== pickedUser.id);
        }

        const saveKey = getDutySaveKey(targetDate, shiftFilter);
        const { error } = await appDB.from('settings').upsert([{ key: saveKey, value: JSON.stringify(rosterResult) }]);
        if (error) throw error;

        try {
            // 🌟 สร้าง summary ของผู้ที่ถูกจัดเข้าแต่ละเว็บ
            const summaryParts = [];
            let totalAssigned = 0;
            for (const team of Object.keys(rosterResult).sort((a,b) => a.localeCompare(b))) {
                const names = (rosterResult[team] || [])
                    .filter(u => !u.username.includes('ขาดคน'))
                    .map(u => u.username);
                if (names.length > 0) {
                    summaryParts.push(`[${team}] ${names.join(', ')}`);
                    totalAssigned += names.length;
                }
            }
            const detailText = `จัดเวรแผนก ${currentDutyDept} (กะ: ${shiftFilter}, วันที่: ${targetDate}) — รวม ${totalAssigned} คน
${summaryParts.join(' | ')}`;

            await appDB.from('system_logs').insert([{ action_type: 'สุ่มจัดหน้าที่', performed_by: currentUser.username, target_details: detailText }]);
            if(appDB.channel) appDB.channel('duty-updates').send({ type: 'broadcast', event: 'force_reload' });
        } catch(logError) {}

        window.refreshDutyData(); 
        
        if (unassignedPool.length > 0) {
            const leftNames = unassignedPool.map(u => u.username).join(', ');
            Swal.fire({ icon: 'warning', title: `จัดหลักสำเร็จ! (มีคนเหลือ)`, html: `เหลือพนักงานไม่ได้ลงเว็บ <b>${unassignedPool.length} คน</b> เพราะไม่ได้ติ๊กสิทธิ์หลังบ้านไว้:<br><br><span class="text-red-500 font-bold">${leftNames}</span>` });
        } else {
            Swal.fire({ icon: 'success', title: `จัดตำแหน่งหลักสำเร็จ!`, text: 'กรุณากดปุ่มสายฟ้า (จัดตำแหน่งรองด่วน) เพื่อจับคู่เวลาพักครับ', timer: 2500, showConfirmButton: false });
        }
    } catch(e) { Swal.fire('Error', e.message, 'error'); }
};

window.renderRosterGrid = async function(rosterData) {
    const cardGrid = document.getElementById('dutyResultGrid'); 
    const matrixGrid = document.getElementById('dutyMatrixGrid'); 
    
    if(!cardGrid) return;
    
    if (currentDutyDept === 'ODQL' || currentDutyDept === 'TRAINER_OD') {
        cardGrid.classList.add('hidden');
        if (matrixGrid) matrixGrid.classList.remove('hidden');
        
        if (typeof window.renderTrainerOdMatrix === 'function') {
            window.renderTrainerOdMatrix(rosterData); 
        }
        return; 
    } 
    else {
        cardGrid.classList.remove('hidden');
        if (matrixGrid) matrixGrid.classList.add('hidden');
    }

    cardGrid.innerHTML = ''; 
    let finalGridHtml = '';
    
    currentRosterData = rosterData; 
    const isAdmin = window.isDutyAdmin();

    let trainerReports = {};
    const targetDate = document.getElementById('dutyDate') ? document.getElementById('dutyDate').value : '';
    const shiftFilter = document.getElementById('dutyShiftSelect') ? document.getElementById('dutyShiftSelect').value : '';
    const subFilter = document.getElementById('trainerDeptFilter') ? document.getElementById('trainerDeptFilter').value : 'ALL';

    if ((currentDutyDept === 'AMQL' || currentDutyDept === 'ODQL' || currentDutyDept.startsWith('TRAINER')) && targetDate) {
        const reportKey = `report_${currentDutyDept}_${targetDate}_${shiftFilter}`;
        try {
            let reportDataVal = null;
            const { data: reportData } = await appDB.from('settings').select('value').eq('key', reportKey);
            if (reportData && reportData.length > 0) reportDataVal = reportData[0].value;
            if (reportDataVal) trainerReports = JSON.parse(reportDataVal);
        } catch(e) {}
    }

    window.currentStandbyData = {};
    let standbyData = {};
    sortedTeams.forEach(t => standbyData[t] = []);
    
    for (const primaryTeam in rosterData) {
        if (!rosterData[primaryTeam]) continue;
        rosterData[primaryTeam].forEach(u => {
            if (u.secondary_team && sortedTeams.includes(u.secondary_team) && !u.username.includes('ขาดคน')) {
                standbyData[u.secondary_team].push({ name: u.username, fromTeam: primaryTeam });
            }
        });
    }
    window.currentStandbyData = standbyData; 

    sortedTeams.forEach(team => {
        let assignees = rosterData[team] || [];
        if(assignees.length === 0) return; 
        
        if (currentDutyDept === 'AMQL' || currentDutyDept === 'ODQL' || currentDutyDept.startsWith('TRAINER')) {
            if (subFilter !== 'ALL') assignees = assignees.filter(a => true);
        }
        
        const rolesForThisTeam = customDutyRoles[team] || [];
        const colorClass = TEAM_COLORS[team] || TEAM_COLORS['DEFAULT'];
        let rolesTags = rolesForThisTeam.map(r => `<span class="${colorClass.lightBg} ${colorClass.lightText} px-1.5 py-0.5 rounded text-[9px] mr-1 mb-1 font-bold inline-block border ${colorClass.border} opacity-90">${r}</span>`).join('');
        
        let namesHtml = assignees.map(a => {
            const isMissing = a.username.includes('ขาดคน');
            const canDrag = !isMissing && a.id && isAdmin;
            const dragAttrs = canDrag ? `draggable="true" ondragstart="handleDragStart(event, '${a.id}', '${a.username}', '${team}')"` : '';
            const cursorClass = canDrag ? 'cursor-grab active:cursor-grabbing hover:shadow-md' : 'cursor-default';

            // 🌟 NEW: สร้างป้ายโชว์เวลากินข้าว (อัปเดตให้ดึงมาทั้งหมด 2 ช่วง และปรับขนาดใหญ่ขึ้น)
            let breakTimeHtml = '';
            if (!isMissing) {
                const mySchedules = (window.currentDutySchedules || []).filter(s => s.staff_name === a.username);
                
                if (mySchedules && mySchedules.length > 0) {
                    const timeSlotsText = mySchedules.map(s => s.time_slot).sort((t1, t2) => t1.localeCompare(t2)).join(', ');
                    
                    // ปรับ text-[10px] เป็น text-xs (ใหญ่ขึ้น), เพิ่มช่องว่าง gap-1.5, ขยายไอคอนเป็น text-[14px], ปรับ Padding px-2.5 py-1
                    breakTimeHtml = `<div class="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-sky-600 bg-sky-50 dark:bg-sky-900/30 dark:text-sky-400 px-2.5 py-1 rounded-md border border-sky-200 dark:border-sky-800/50 w-fit shadow-sm cursor-default"><span class="material-icons text-[14px]">restaurant</span> พัก: ${timeSlotsText}</div>`;
                } else {
                    breakTimeHtml = `<div class="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/30 dark:text-red-400 px-2.5 py-1 rounded-md border border-red-200 dark:border-red-800/50 w-fit shadow-sm"><span class="material-icons text-[14px]">warning</span> ยังไม่ลงเวลา</div>`;
                }
            }
            // 🌟 -----------------------------------

            let secHtml = '';
            if (a.secondary_team && !isMissing) {
                const secTeamColors = TEAM_COLORS[a.secondary_team] || TEAM_COLORS['DEFAULT'];
                const actionClick = isAdmin ? `onclick="event.stopPropagation(); changeSecondaryTeam('${team}', '${a.id}', '${a.username}')"` : '';
                const hoverFx = isAdmin ? 'hover:border-transparent hover:shadow-md cursor-pointer' : 'border-gray-200 dark:border-slate-600';

                secHtml = `
                <div ${actionClick} title="${isAdmin ? 'คลิกเพื่อเปลี่ยนงานรอง' : 'นี่คืองานรองของคุณ'}" class="mt-2.5 flex flex-col w-full bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 shadow-inner ${hoverFx} overflow-hidden group/sec">
                    <div class="flex items-stretch">
                        <div class="w-1.5 ${secTeamColors.bg} ${secTeamColors.border} border-r shadow-inner"></div>
                        <div class="flex-1 p-2 flex items-center justify-between gap-2">
                            <div class="flex items-center gap-1.5">
                                <span class="material-icons text-[14px] text-gray-400 group-hover/sec:text-indigo-500 transition">transfer_within_a_station</span>
                                <span class="text-[9.5px] font-bold text-gray-500 dark:text-gray-400 tracking-wide">สแตนด์บายช่วย :</span>
                            </div>
                            <span class="text-[11px] font-black ${secTeamColors.text} ${secTeamColors.bg} px-2.5 py-0.5 rounded-full shadow-sm border ${secTeamColors.border} flex items-center gap-1">
                                ${a.secondary_team}
                                ${isAdmin ? '<span class="material-icons text-[10px] opacity-70 ml-0.5">edit</span>' : ''}
                            </span>
                        </div>
                    </div>
                    ${a.standby_task ? `
                    <div class="px-2 pb-2 pt-0.5 border-t border-gray-100 dark:border-slate-700/50">
                        <div class="flex items-center gap-1.5">
                            <span class="material-icons text-[12px] text-purple-500">task_alt</span>
                            <span class="text-[9px] font-bold text-gray-500 dark:text-gray-400">หัวข้องาน:</span>
                            <span class="text-[10px] font-black text-purple-600 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800/50 flex-1 truncate">${a.standby_task}</span>
                        </div>
                    </div>
                    ` : ''}
                </div>`;
            } else if (!isMissing && isAdmin) {
                secHtml = `
                <div onclick="event.stopPropagation(); changeSecondaryTeam('${team}', '${a.id}', '${a.username}')" class="mt-2.5 flex items-center justify-center gap-1.5 w-full bg-slate-50 dark:bg-slate-800/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-gray-400 hover:text-indigo-500 border border-dashed border-gray-300 dark:border-slate-600 hover:border-indigo-400 py-2 rounded-lg text-[9.5px] font-bold transition cursor-pointer group/add shadow-inner">
                    <span class="material-icons text-[14px] group-hover/add:rotate-90 transition-transform">add_task</span>
                    แจกงานรองให้พนักงาน
                </div>`;
            }

            let odTaskHtml = '';
            if (currentDutyDept === 'OD' && !isMissing && (a.od_pro_task || a.od_tg_task)) {
                if (a.od_pro_task) {
                    odTaskHtml += `<div class="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-violet-600 bg-violet-50 dark:bg-violet-900/30 dark:text-violet-300 px-2.5 py-1 rounded-md border border-violet-200 dark:border-violet-800/50 w-fit shadow-sm">
                        <span class="material-icons text-[14px]">card_giftcard</span> อนุมัติโปร: ${a.od_pro_task}
                    </div>`;
                }
                if (a.od_tg_task) {
                    odTaskHtml += `<div class="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-sky-600 bg-sky-50 dark:bg-sky-900/30 dark:text-sky-300 px-2.5 py-1 rounded-md border border-sky-200 dark:border-sky-800/50 w-fit shadow-sm">
                        <span class="material-icons text-[14px]">telegram</span> เคส TG: ${a.od_tg_task}
                    </div>`;
                }
            }

            return `
            <div class="duty-user-card flex flex-col p-3 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm shrink-0 group ${cursorClass}" data-name="${(a.username || '').toLowerCase()}" ${dragAttrs}>
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2.5">
                        <span class="material-icons text-green-500 text-[18px] pointer-events-none drop-shadow-sm">${isMissing ? 'warning' : 'check_circle'}</span> 
                        <span class="font-black text-slate-800 dark:text-gray-100 text-sm pointer-events-none truncate tracking-wide">${a.username}</span>
                    </div>
                </div>
                ${breakTimeHtml}
                ${odTaskHtml}
                ${secHtml}
            </div>`;
        }).join('');

        let trainerReportHtml = '';
        if (currentDutyDept === 'AMQL' || currentDutyDept === 'ODQL' || currentDutyDept.startsWith('TRAINER')) {
            const tr = trainerReports[team] || { missed: 0, checker: '-', score: '-', mistakes: [] };
            const scoreNum = parseInt(tr.score);
            let scoreColor = 'text-gray-500';
            if(scoreNum >= 8) scoreColor = 'text-green-600';
            else if(scoreNum >= 5) scoreColor = 'text-amber-500';
            else if(scoreNum > 0) scoreColor = 'text-red-600';
            const missedColor = parseInt(tr.missed) > 0 ? 'text-red-500 font-bold' : 'text-green-600';
            
            let behaviorHtml = '<span class="text-gray-400 mt-0.5 block">- ไม่มี -</span>';
            if (tr.mistakes && tr.mistakes.length > 0) {
                behaviorHtml = tr.mistakes.map(m => `
                    <div class="mt-1 p-1.5 bg-red-50 dark:bg-red-900/30 rounded border border-red-100 dark:border-red-800 text-[10px]">
                        <span class="font-bold text-red-600">${m.empName}</span>: <span class="text-slate-600 dark:text-slate-300">${m.note || '-'}</span>
                        <div class="flex gap-1 mt-1 overflow-x-auto">
                            ${m.images && m.images.length > 0 ? m.images.map(img => `<img src="${img}" class="h-10 w-auto rounded shadow-sm border border-red-200 cursor-pointer" onclick="window.open('${img}','_blank')">`).join('') : ''}
                        </div>
                    </div>
                `).join('');
            } else if (tr.bad_behavior && tr.bad_behavior !== '-') { 
                behaviorHtml = `<span class="text-red-600 bg-red-50 p-1 rounded font-bold block mt-0.5 break-words">${tr.bad_behavior}</span>`;
            }

            const isTrainerStaff = (currentUser.department === 'AMQL' || currentUser.department === 'ODQL' || (currentUser.department && currentUser.department.startsWith('TRAINER')));
            const btnLogData = (isAdmin || isTrainerStaff) ? `<button onclick="openTrainerReportModal('${team}')" class="text-[9px] bg-amber-500 hover:bg-amber-600 text-white px-2 py-0.5 rounded shadow transition font-bold border border-amber-600">📝 ประเมิน</button>` : '';

            trainerReportHtml = `
            <div class="mt-2 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-700/50 p-2 flex flex-col gap-1.5 shrink-0">
                <div class="flex justify-between items-center mb-1 border-b border-amber-200/50 pb-1">
                    <span class="text-[10px] font-extrabold text-amber-800 dark:text-amber-400 flex items-center gap-1"><span class="material-icons text-[12px]">assignment</span> สรุปรายงานดูแลเว็บ</span>
                    ${btnLogData}
                </div>
                <div class="text-[10px] text-slate-700 dark:text-slate-300 leading-tight bg-white dark:bg-slate-800 p-2 rounded border border-gray-200 dark:border-slate-600 space-y-1">
                    <div class="flex justify-between border-b border-gray-100 dark:border-slate-700 pb-1">
                        <span class="font-bold">👮 คนเช็คชื่อ:</span> <span class="text-blue-600 font-bold">${tr.checker || '-'}</span>
                    </div>
                    <div class="flex justify-between border-b border-gray-100 dark:border-slate-700 pb-1">
                        <span class="font-bold">🚨 แชทหลุด:</span> <span class="${missedColor}">${tr.missed} แชท</span>
                    </div>
                    <div class="flex justify-between border-b border-gray-100 dark:border-slate-700 pb-1">
                        <span class="font-bold">⭐ คะแนนรวม:</span> <span class="font-extrabold text-[12px] ${scoreColor}">${tr.score !== '-' ? tr.score + '/10' : '-'}</span>
                    </div>
                    <div class="pt-1">
                        <span class="font-bold text-red-500 flex items-center">⚠️ พฤติกรรมไม่ดี:</span>
                        ${behaviorHtml}
                    </div>
                </div>
            </div>`;
        }

        const primaryCount = assignees.filter(u => !u.username.includes('ขาดคน')).length;
        const standbyList = standbyData[team] || [];
        const standbyCount = standbyList.length;

        finalGridHtml += `
            <div class="duty-site-card bg-slate-50 dark:bg-slate-900 border-2 ${colorClass.border} rounded-2xl shadow-md flex flex-col h-[500px] overflow-hidden w-full">
                <div class="flex justify-between items-center ${colorClass.bg} ${colorClass.text} p-3 shadow-sm shrink-0">
                    <div class="flex items-center flex-wrap gap-2 w-full">
                        <h4 class="font-black text-base pointer-events-none tracking-wide">${team}</h4>
                        <div class="flex items-center gap-2 ml-auto">
                            <div class="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-lg shadow-inner whitespace-nowrap border border-white/30 flex items-center gap-1" style="color: inherit;">
                                <span class="opacity-80">หลัก</span><span class="text-xs font-black bg-black/20 px-1 rounded-md">${primaryCount}</span>
                            </div>
                            <button onclick="viewStandbyList('${team}')" title="คลิกดูรายชื่อสแตนด์บาย" class="cursor-pointer text-[10px] font-extrabold bg-gradient-to-br from-amber-300 to-yellow-500 text-amber-950 px-2 py-0.5 rounded-lg shadow-md whitespace-nowrap transition hover:from-amber-200 hover:to-yellow-400 hover:scale-105 border border-amber-600 flex items-center gap-1 active:scale-95">
                                <span>รอง</span><span class="text-xs font-black bg-white/40 px-1 rounded-md">${standbyCount}</span><span class="material-icons text-[11px] opacity-70">touch_app</span>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="p-2 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0">
                    ${rolesTags || '<span class="text-[9px] text-gray-400">เหมาทุกตำแหน่ง</span>'}
                </div>
                <div class="flex flex-col gap-2.5 flex-1 p-2 overflow-y-auto custom-scrollbar content-start drop-zone" ondragover="handleDragOver(event)" ondrop="handleDrop(event, '${team}')">
                    ${namesHtml}
                </div>
                ${trainerReportHtml}
            </div>
        `;
    });

   cardGrid.innerHTML = finalGridHtml;
};

window.selectSecOption = function(el, val) {
    document.querySelectorAll('.sec-opt').forEach(opt => {
        opt.className = opt.className.replace(/ring-2 ring-(blue|red)-500 bg-(blue|red)-50 dark:bg-(blue|red)-900\/(20|30) shadow-md/g, '');
        if(!opt.className.includes('bg-gray-50') && !opt.className.includes('bg-white')) {
            if(opt.innerText.includes('ปลดงาน')) opt.classList.add('bg-gray-50', 'dark:bg-slate-800');
            else opt.classList.add('bg-white', 'dark:bg-slate-800');
        }
    });
    if(val === 'none') el.className += ' ring-2 ring-red-500 bg-red-50 dark:bg-red-900/30';
    else el.className += ' ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/30 shadow-md';
    document.getElementById('swal-sec-val').value = val;
};

window.changeSecondaryTeam = async function(primaryTeam, userId, username) {
    const uidStr = String(userId);
    const access = dutyAccessMatrix[uidStr] || dutyAccessMatrix[Number(userId)] || [];
    let possibleSecondary = access.filter(t => t !== primaryTeam && sortedTeams.includes(t));

    if (possibleSecondary.length === 0) {
        return Swal.fire({ icon: 'warning', title: 'ไม่มีสิทธิ์เข้าเว็บอื่น', text: `${username} ไม่มีสิทธิ์หลังบ้านเว็บไหนเลย (นอกจากเว็บหลัก) จึงแจกงานรองไม่ได้ กรุณาไปเพิ่มสิทธิ์ในหน้าตั้งค่าก่อนครับ`, confirmButtonColor: '#3b82f6' });
    }

    let currentUserData = currentRosterData[primaryTeam].find(u => String(u.id) === String(userId));
    let currentSec = currentUserData ? currentUserData.secondary_team : null;

    let htmlContent = `<div class="mt-4 flex flex-col gap-2.5 max-h-[45vh] overflow-y-auto custom-scrollbar p-1">`;
    const noneActive = !currentSec ? 'ring-2 ring-red-500 bg-red-50 dark:bg-red-900/30' : 'bg-gray-50 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/20';
    htmlContent += `
        <div onclick="selectSecOption(this, 'none')" class="sec-opt p-3 rounded-xl border border-gray-200 dark:border-slate-600 cursor-pointer transition-all flex items-center justify-between group ${noneActive}">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/50 text-red-500 flex items-center justify-center group-hover:scale-110 transition"><span class="material-icons text-lg">block</span></div>
                <div class="text-left"><div class="font-bold text-slate-700 dark:text-gray-200 text-sm">ปลดงานรองออก</div><div class="text-[10px] text-gray-500 dark:text-gray-400">ไม่ต้องสแตนด์บายช่วยเว็บอื่น</div></div>
            </div>
        </div>
    `;

    possibleSecondary.forEach(t => {
        const isActive = currentSec === t ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/30 shadow-md' : 'bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20';
        const teamColor = TEAM_COLORS[t] || TEAM_COLORS['DEFAULT'];
        htmlContent += `
            <div onclick="selectSecOption(this, '${t}')" class="sec-opt p-3 rounded-xl border border-gray-200 dark:border-slate-600 cursor-pointer transition-all flex items-center justify-between group overflow-hidden relative ${isActive}">
                <div class="absolute left-0 top-0 bottom-0 w-1.5 ${teamColor.bg}"></div>
                <div class="flex items-center gap-3 pl-3 z-10">
                    <div class="w-10 h-10 rounded-full ${teamColor.lightBg} ${teamColor.lightText} flex items-center justify-center font-bold text-sm shadow-inner group-hover:scale-110 transition">${t.substring(0,2)}</div>
                    <div class="text-left"><div class="font-black text-slate-800 dark:text-white text-base">${t}</div><div class="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5"><span class="material-icons text-[12px] text-blue-500">support_agent</span> สแตนด์บายช่วยแชท</div></div>
                </div>
            </div>
        `;
    });
    
    htmlContent += `</div><input type="hidden" id="swal-sec-val" value="${currentSec || 'none'}">`;

    const { isConfirmed } = await Swal.fire({
        title: `<div class="text-xl font-black mb-1">สแตนด์บายช่วย (${username})</div>`, html: `<div class="text-xs text-gray-500 mb-2">กดเลือกการ์ดด้านล่างเพื่อกำหนดงานรอง</div>${htmlContent}`,
        showCancelButton: true, confirmButtonText: 'บันทึกงานรอง', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#3b82f6', cancelButtonColor: '#64748b',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl' },
        preConfirm: () => document.getElementById('swal-sec-val').value
    });

    if (isConfirmed) {
        const selectedSec = document.getElementById('swal-sec-val').value;
        let userIndex = currentRosterData[primaryTeam].findIndex(u => String(u.id) === String(userId));

        if(userIndex > -1) {
            const prevSec = currentRosterData[primaryTeam][userIndex].secondary_team || null;
            const newSec = selectedSec === 'none' ? null : selectedSec;
            currentRosterData[primaryTeam][userIndex].secondary_team = newSec;
            const targetDate = document.getElementById('dutyDate').value; const shiftFilter = document.getElementById('dutyShiftSelect').value;
            const saveKey = `duty_roster_${currentDutyDept}_${targetDate}_${shiftFilter}`;

            Swal.fire({title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen:()=>Swal.showLoading()});
            await appDB.from('settings').upsert([{ key: saveKey, value: JSON.stringify(currentRosterData) }]);

            // 🟢 บันทึก log การเปลี่ยนงานรอง (สแตนด์บาย)
            let logDetail;
            if (!prevSec && newSec) logDetail = `แจกงานรองให้ ${username} (เว็บหลัก: ${primaryTeam}) → สแตนด์บายช่วย [${newSec}]`;
            else if (prevSec && !newSec) logDetail = `ปลดงานรอง ${username} (ออกจากการสแตนด์บายช่วย [${prevSec}])`;
            else if (prevSec !== newSec) logDetail = `เปลี่ยนงานรอง ${username}: [${prevSec}] → [${newSec}]`;
            if (logDetail) {
                await appDB.from('system_logs').insert([{
                    action_type: 'ย้ายหน้าที่',
                    performed_by: currentUser.username,
                    target_details: `${logDetail} (กะ: ${shiftFilter}, วันที่: ${targetDate})`
                }]);
            }

            window.renderRosterGrid(currentRosterData);
            if(appDB.channel) appDB.channel('duty-updates').send({ type: 'broadcast', event: 'force_reload' });
            Swal.fire({icon: 'success', title: 'อัปเดตงานรองแล้ว!', timer: 1200, showConfirmButton: false});
        }
    }
};

window.viewStandbyList = function(team) {
    const list = window.currentStandbyData[team] || [];
    if (list.length === 0) {
        return Swal.fire({ icon: 'info', title: `ทีม ${team}`, text: 'ยังไม่มีพนักงานถูกสั่งให้มาสแตนด์บายช่วยเว็บนี้ครับ', confirmButtonColor: '#3b82f6', customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl' } });
    }

    const teamColor = TEAM_COLORS[team] || TEAM_COLORS['DEFAULT'];
    const namesHtml = list.map((item, i) => {
        let breakTimeHtml = '';
        const mySchedules = (window.currentDutySchedules || []).filter(s => s.staff_name === item.name);
        
        if (mySchedules && mySchedules.length > 0) {
            const timeSlotsText = mySchedules.map(s => s.time_slot).sort((t1, t2) => t1.localeCompare(t2)).join(', ');
            // 🌟 ปรับขนาดป้ายเวลาพักให้ใหญ่ขึ้น (text-xs = 12px, px-2.5 py-1)
            breakTimeHtml = `<span class="text-xs text-sky-600 dark:text-sky-400 font-bold bg-sky-50 dark:bg-sky-900/30 px-2.5 py-1 rounded-md flex items-center gap-1 border border-sky-200 dark:border-sky-800/50 shadow-sm"><span class="material-icons text-[14px]">restaurant</span> พัก: ${timeSlotsText}</span>`;
        } else {
            breakTimeHtml = `<span class="text-xs text-red-500 font-bold bg-red-50 dark:bg-red-900/30 px-2.5 py-1 rounded-md flex items-center gap-1 border border-red-200 dark:border-red-800/50 shadow-sm animate-pulse"><span class="material-icons text-[14px]">warning</span> ยังไม่ลงเวลา</span>`;
        }

        return `
        <div class="p-3.5 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-600 shadow-sm flex items-center justify-between group hover:border-amber-400 transition mb-2.5">
            <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-black text-sm shadow-inner shrink-0">${i + 1}</div>
                <div class="text-left flex flex-col gap-1.5">
                    <div class="font-black text-slate-800 dark:text-white text-[15px] uppercase tracking-wide">${item.name}</div>
                    <div class="flex flex-wrap items-center gap-2">
                        <div class="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1">จากเว็บหลัก: <span class="font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800/50">${item.fromTeam}</span></div>
                        ${breakTimeHtml}
                    </div>
                </div>
            </div>
            <span class="material-icons text-amber-400 text-2xl opacity-40 group-hover:scale-110 transition shrink-0 ml-2">support_agent</span>
        </div>
        `;
    }).join('');

    Swal.fire({
        title: `<div class="flex flex-col items-center gap-1.5"><span class="text-sm text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">ทีมสแตนด์บายช่วย</span><span class="text-3xl font-black ${teamColor.text} ${teamColor.bg} px-5 py-1.5 rounded-xl shadow-md border-2 ${teamColor.border}">${team}</span></div>`,
        html: `<div class="flex flex-col mt-4 max-h-[55vh] overflow-y-auto custom-scrollbar p-1">${namesHtml}</div>`,
        confirmButtonText: 'ปิดหน้าต่าง', confirmButtonColor: '#64748b',
        width: '500px', // 🌟 ขยายขนาดหน้าต่างให้กว้างขึ้น เพื่อให้ข้อความไม่เบียดกัน
        customClass: { popup: 'dark:bg-slate-900 dark:text-white rounded-3xl' }
    });
};

window.filterDutyResult = function() {
    const term = document.getElementById('dutySearchInput').value.toLowerCase();
    
    // 🟢 1. จัดการค้นหาในรูปแบบ การ์ด (Card) ของพนักงาน AM / OD ปกติ
    const siteCards = document.querySelectorAll('.duty-site-card');
    
    siteCards.forEach(card => {
        const userCards = card.querySelectorAll('.duty-user-card');
        let cardHasMatch = false;

        userCards.forEach(uCard => {
            const name = uCard.dataset.name;
            if(name && name.includes(term)) { 
                // ถ้าค้นหาเจอ ให้แสดงกล่องพนักงานนั้น และไฮไลต์สี
                uCard.style.display = 'flex';
                if(term !== '') {
                    uCard.classList.add('ring-2', 'ring-amber-500', 'bg-amber-50'); 
                    cardHasMatch = true; 
                } else {
                    uCard.classList.remove('ring-2', 'ring-amber-500', 'bg-amber-50'); 
                }
            } else { 
                // ถ้าค้นหาไม่เจอ ให้ซ่อนกล่องพนักงานคนนั้นทิ้งไปเลย จะได้ไม่รกตา
                uCard.style.display = term === '' ? 'flex' : 'none'; 
                uCard.classList.remove('ring-2', 'ring-amber-500', 'bg-amber-50'); 
            }
        });

        // ถ้าในเว็บนั้นไม่มีคนที่เราค้นหาเลย ก็ซ่อนการ์ดเว็บนั้นทิ้งไปเลย
        if(term === '') {
            card.style.display = 'flex'; 
        } else { 
            card.style.display = cardHasMatch ? 'flex' : 'none'; 
        }
    });

    // 🟢 2. จัดการค้นหาในรูปแบบ ตาราง (Matrix) ของผู้สอน OD
    const matrixGrid = document.getElementById('dutyMatrixGrid');
    if (matrixGrid && !matrixGrid.classList.contains('hidden')) {
        const trs = matrixGrid.querySelectorAll('tbody tr');
        let currentShiftDisplay = null;
        let visibleCountInShift = 0;

        trs.forEach(tr => {
            const nameCell = tr.querySelector('td:nth-child(2) span, td:nth-child(1) span'); 
            if (!nameCell) return;
            
            const name = nameCell.innerText.toLowerCase();
            const shiftCell = tr.querySelector('td[rowspan]');

            // อัปเดตกะปัจจุบันที่กำลังประมวลผลอยู่
            if (shiftCell) {
                currentShiftDisplay = shiftCell;
                visibleCountInShift = 0; // เริ่มนับคนในกะใหม่
            }

            if (term === '' || name.includes(term)) {
                tr.style.display = 'table-row';
                visibleCountInShift++;
                
                // ไฮไลต์ชื่อถ้าค้นหา
                if (term !== '') nameCell.parentElement.classList.add('bg-amber-100', 'rounded', 'px-1');
                else nameCell.parentElement.classList.remove('bg-amber-100', 'rounded', 'px-1');
            } else {
                tr.style.display = 'none';
                nameCell.parentElement.classList.remove('bg-amber-100', 'rounded', 'px-1');
            }

            // จัดการอัปเดต rowspan ของกะ ให้พอดีกับจำนวนคนที่แสดงอยู่ (จะได้ไม่โบ๋)
            if (shiftCell) {
                shiftCell.rowSpan = 1; // ตั้งค่าเริ่มต้น
            } else if (currentShiftDisplay && tr.style.display !== 'none') {
                 currentShiftDisplay.rowSpan = visibleCountInShift;
                 currentShiftDisplay.parentElement.style.display = 'table-row'; // ให้แน่ใจว่าแถวแม่ของกะแสดงอยู่
            }
            
            // ถ้ากะนั้นไม่มีคนถูกค้นหาเจอเลย ก็ซ่อนแถวที่มีชื่อกะทิ้งไปเลย
            if (currentShiftDisplay && visibleCountInShift === 0 && tr.style.display === 'none' && !tr.querySelector('td[rowspan]')) {
                currentShiftDisplay.parentElement.style.display = 'none';
            }
        });
    }
}

window.searchDutyMyself = function() {
    const searchInput = document.getElementById('dutySearchInput');
    if(currentUser && currentUser.username) {
        searchInput.value = currentUser.username; window.filterDutyResult();
    }
}

// ==========================================
// 🚀 ระบบลากวาง (Drag & Drop)
// ==========================================
let draggedUser = null;

function cleanupDragEffects() {
    const tooltip = document.getElementById('drag-access-tooltip');
    if (tooltip) tooltip.style.display = 'none';
    document.querySelectorAll('.duty-site-card').forEach(card => {
        card.classList.remove('ring-4', 'ring-green-500', 'shadow-[0_0_15px_rgba(34,197,94,0.4)]', 'opacity-40', 'grayscale');
    });
}

document.addEventListener('dragover', (e) => {
    const tooltip = document.getElementById('drag-access-tooltip');
    if (tooltip && tooltip.style.display === 'block') {
        tooltip.style.left = (e.clientX + 15) + 'px'; tooltip.style.top = (e.clientY + 15) + 'px';
    }
});

window.handleDragStart = function(event, userId, username, fromTeam) {
    const canDrag = window.isDutyAdmin();
    if (!canDrag) { event.preventDefault(); return; }
    if(!userId || userId === 'undefined') { event.preventDefault(); return; }
    draggedUser = { id: userId, username: username, fromTeam: fromTeam };
    event.dataTransfer.effectAllowed = "move";
    setTimeout(() => event.target.classList.add('opacity-50', 'scale-95'), 0);

    const userAccess = dutyAccessMatrix[userId] || [];
    let accessText = userAccess.length > 0 ? userAccess.join(', ') : 'ไม่มีสิทธิ์เลย';

    let tooltip = document.getElementById('drag-access-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div'); tooltip.id = 'drag-access-tooltip';
        tooltip.className = 'fixed z-[9999] pointer-events-none bg-slate-900 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-2xl border border-indigo-500 opacity-95';
        document.body.appendChild(tooltip);
    }
    tooltip.innerHTML = `<div class="text-indigo-300 text-[10px] mb-1">สิทธิ์ของ ${username}:</div><div class="text-green-400 text-sm">${accessText}</div>`;
    tooltip.style.display = 'block';

    document.querySelectorAll('.duty-site-card').forEach(card => {
        const teamName = card.querySelector('h4').innerText.trim();
        if (userAccess.includes(teamName)) card.classList.add('ring-4', 'ring-green-500', 'shadow-[0_0_15px_rgba(34,197,94,0.4)]');
        else card.classList.add('opacity-40', 'grayscale');
    });
};

window.handleDragOver = function(event) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; };

window.handleDrop = async function(event, toTeam) {
    event.preventDefault();
    if (!draggedUser) return;
    const { id, username, fromTeam } = draggedUser;

    document.querySelectorAll('.duty-user-card').forEach(el => el.classList.remove('opacity-50', 'scale-95'));
    cleanupDragEffects();

    if (fromTeam === toTeam) { draggedUser = null; return; }

    const targetDate = document.getElementById('dutyDate').value;
    const shiftFilter = document.getElementById('dutyShiftSelect').value;

    if (toTeam === 'leaveList' || event.target.closest('#dutyLeaveList')) {
        const { value: leaveReason } = await Swal.fire({
            title: '<div class="text-red-500 font-black">ระบุสถานะการหยุด</div>',
            html: `
                <div class="text-sm font-bold text-gray-500 dark:text-gray-400 mb-4">
                    พนักงาน: <span class="text-xl text-slate-800 dark:text-white uppercase tracking-wider">${username}</span>
                </div>
                <select id="leaveReasonSelect" class="w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white font-bold text-sm outline-none focus:ring-2 focus:ring-red-500 shadow-inner cursor-pointer appearance-none transition">
                    <option value="" disabled selected>-- เลือกสาเหตุการหยุด --</option>
                    <option value="X">❌ วันหยุดปกติ (X)</option>
                    <option value="KL">📝 ลากิจ (KL)</option>
                    <option value="PN">🏖️ พักร้อน (PN)</option>
                    <option value="XX">⏳ เปลี่ยนกะ / รอเข้ากะ (XX)</option>
                    <option value="TL">🔄 สลับวันหยุด (TL / TX)</option>
                    <option value="X4">⏱️ ลาครึ่งวัน (X4)</option>
                    <option value="ขาดงาน">🚫 ขาดงาน (ไม่แจ้งล่วงหน้า)</option>
                </select>
            `,
            showCancelButton: true, confirmButtonText: 'บันทึกสถานะ', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#ef4444', cancelButtonColor: '#64748b',
            customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl shadow-2xl border border-slate-700' },
            preConfirm: () => {
                const val = document.getElementById('leaveReasonSelect').value;
                if (!val) { Swal.showValidationMessage('กรุณาเลือกสาเหตุด้วยครับ!'); return false; }
                return val;
            }
        });

        if (!leaveReason) { draggedUser = null; return; }

        Swal.fire({title: 'กำลังย้ายข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
        try {
            if (currentRosterData[fromTeam]) {
                currentRosterData[fromTeam] = currentRosterData[fromTeam].filter(u => String(u.id) !== String(id));
                const saveKey = typeof getDutySaveKey === 'function' ? getDutySaveKey(targetDate, shiftFilter) : `duty_roster_${currentDutyDept}_${targetDate}_${shiftFilter}`;
                await appDB.from('settings').upsert([{ key: saveKey, value: JSON.stringify(currentRosterData) }]);
            }

            const { error: leaveErr } = await appDB.from('leave_requests').insert([{ user_id: id, user_name: username, leave_date: targetDate, reason: leaveReason, status: 'approved' }]);
            if (leaveErr) throw leaveErr;

            await appDB.from('system_logs').insert([{ action_type: 'ย้ายหน้าที่', performed_by: currentUser.username, target_details: `ย้าย ${username} จากเว็บ ${fromTeam} ไปอยู่โซนลาหยุด (${leaveReason}) วันที่: ${targetDate}` }]);
            appDB.channel('duty-updates').send({ type: 'broadcast', event: 'force_reload' });
            await window.refreshDutyData();

            Swal.fire({icon: 'success', title: 'อัปเดตสถานะสำเร็จ!', timer: 1500, showConfirmButton: false});
        } catch (err) { Swal.fire('เกิดข้อผิดพลาด', err.message, 'error'); }
        
        draggedUser = null;
        return;
    }

    const userAccess = dutyAccessMatrix[id] || [];
    if (!userAccess.includes(toTeam)) {
        Swal.fire({ icon: 'error', title: 'ย้ายไม่ได้!', text: `ไม่อนุญาต! ${username} ไม่มีสิทธิ์หลังบ้านเว็บ ${toTeam} นะคะ`, confirmButtonText: 'ตกลง', confirmButtonColor: '#d33' });
        draggedUser = null; return;
    }

    // 🌟 NEW: เก็บ "ใครเป็นคนจัดเข้า fromTeam ตั้งแต่แรก" ก่อนที่จะ filter ออก
    const originalUserInFromTeam = currentRosterData[fromTeam].find(u => String(u.id) === String(id));
    const originalAssignedBy = originalUserInFromTeam?.assigned_by || 'ไม่ทราบ';

    currentRosterData[fromTeam] = currentRosterData[fromTeam].filter(u => String(u.id) !== String(id));

    const fullUserObj = GLOBAL_USER_LIST.find(u => String(u.id) === String(id));
    if (fullUserObj) {
        if(!currentRosterData[toTeam]) currentRosterData[toTeam] = [];
        currentRosterData[toTeam].push({
            ...fullUserObj,
            assigned_by: currentUser.username,        // คนล่าสุดที่ย้าย
            assigned_at: new Date().toISOString()
        });
    }

    const saveKey = typeof getDutySaveKey === 'function' ? getDutySaveKey(targetDate, shiftFilter) : `duty_roster_${currentDutyDept}_${targetDate}_${shiftFilter}`;

    Swal.fire({title: 'กำลังอัปเดตตาราง...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});

    try {
        const { error } = await appDB.from('settings').upsert([{ key: saveKey, value: JSON.stringify(currentRosterData) }]);
        if (error) throw error;

        // 🟢 บันทึก log การย้ายระหว่างเว็บ — แสดงทั้ง "คนจัดเดิม" และ "คนย้าย"
        await appDB.from('system_logs').insert([{
            action_type: 'ย้ายหน้าที่',
            performed_by: currentUser.username,
            target_details: `ย้าย ${username} จากเว็บ [${fromTeam}] (จัดโดย ${originalAssignedBy}) → [${toTeam}] (กะ: ${shiftFilter}, วันที่: ${targetDate})`
        }]);

        window.renderRosterGrid(currentRosterData);
        if (typeof window.updateDutyStats === 'function') window.updateDutyStats();

        appDB.channel('duty-updates').send({ type: 'broadcast', event: 'force_reload' });
        Swal.fire({icon: 'success', title: 'ย้ายสำเร็จ', timer: 1000, showConfirmButton: false});
    } catch (e) {
        console.error(e);
        Swal.fire('Error', 'เกิดข้อผิดพลาดในการบันทึกข้อมูล', 'error');
        window.refreshDutyData();
    }
    draggedUser = null;
};

document.addEventListener('dragend', (e) => {
    if(e.target.classList && e.target.classList.contains('duty-user-card')) e.target.classList.remove('opacity-50', 'scale-95');
    cleanupDragEffects(); draggedUser = null;
});

window.filterTrainerList = function() {
    const input = document.getElementById('trainerSearchInput'); const filter = input.value.toLowerCase();
    const container = document.getElementById('trainerListContainer'); const labels = container.getElementsByTagName('label');
    for (let i = 0; i < labels.length; i++) {
        const nameSpan = labels[i].querySelector('.staff-name');
        if (nameSpan) {
            const txtValue = nameSpan.textContent || nameSpan.innerText;
            labels[i].style.display = txtValue.toLowerCase().indexOf(filter) > -1 ? "flex" : "none";
        }
    }
};

window.openTrainerReportModal = async function(team) {
    const targetDate = document.getElementById('dutyDate').value;
    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    
    const reportKey = `report_${currentDutyDept}_${targetDate}_${shiftFilter}`;
    const baseDept = currentDutyDept.replace('TRAINER_', '').replace('QL', ''); 
    const rosterKey = `duty_roster_${baseDept}_${targetDate}_${shiftFilter}`;

    let currentReports = {}; let rosterData = {};

    Swal.fire({title: 'กำลังดึงข้อมูลตารางงาน...', didOpen: () => Swal.showLoading()});
    try {
        const { data } = await appDB.from('settings').select('*').in('key', [reportKey, rosterKey]);
        if (data) {
            const reportRow = data.find(d => d.key === reportKey);
            if (reportRow && reportRow.value) currentReports = JSON.parse(reportRow.value);

            const rosterRow = data.find(d => d.key === rosterKey);
            if (rosterRow && rosterRow.value) rosterData = JSON.parse(rosterRow.value);
        }
    } catch(e) {}
    Swal.close();

    const tr = currentReports[team] || { missed: 0, checker: currentUser.username, score: '', bad_behavior: '', mistakes: [] };
    window._currentAssignedStaff = rosterData[team] ? rosterData[team].filter(u => !u.username.includes('ขาดคน')) : [];
    const datalistOptions = GLOBAL_USER_LIST.map(u => `<option value="${u.username}">`).join('');

    const htmlForm = `
        <div class="text-left space-y-4">
            <datalist id="employee_list_modal">${datalistOptions}</datalist>
            <div class="bg-blue-50 dark:bg-slate-700 p-3 rounded-lg border border-blue-200 dark:border-slate-600">
                <label class="block text-xs font-bold text-blue-800 dark:text-blue-300 mb-1">👮 ผู้เช็คชื่อ (ล็อกชื่ออัตโนมัติ)</label>
                <input type="text" id="trChecker" value="${tr.checker || currentUser.username}" class="w-full p-2 border rounded bg-gray-200 dark:bg-slate-900 dark:text-gray-400 outline-none font-bold text-sm cursor-not-allowed border-gray-300" readonly>
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-bold text-slate-700 dark:text-gray-300 mb-1">🚨 แชทหลุด (จำนวน)</label>
                    <input type="number" id="trMissed" value="${tr.missed}" min="0" class="w-full p-2 border rounded bg-gray-50 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-red-400 font-bold text-center text-lg text-red-600">
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-700 dark:text-gray-300 mb-1">⭐ คะแนนการตอบแชท</label>
                    <select id="trScore" class="w-full p-2 border rounded bg-gray-50 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-amber-400 font-bold text-center text-lg">
                        <option value="">- เลือก -</option>
                        ${[10,9,8,7,6,5,4,3,2,1,0].map(s => `<option value="${s}" ${String(tr.score) === String(s) ? 'selected' : ''}>${s} / 10</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="border border-red-200 dark:border-red-900 rounded p-3 bg-red-50/50 dark:bg-red-900/20">
                <label class="text-xs font-bold text-red-600 dark:text-red-400 mb-2 flex items-center gap-1"><span class="material-icons text-sm">warning</span> บันทึกพฤติกรรมไม่เหมาะสม / ทำผิด</label>
                <div id="mistakes_container" class="space-y-3"></div>
                <button type="button" onclick="addMistakeRow()" class="mt-2 w-full text-xs bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded shadow transition font-bold border border-red-700">+ เพิ่มพนักงานนอกทีม (พิมพ์ชื่อเอง)</button>
            </div>
        </div>
    `;

    const { isConfirmed, value: parsedData } = await Swal.fire({
        title: `การทำงานเว็บ ${team}`, html: htmlForm, showCancelButton: true, confirmButtonText: 'บันทึกข้อมูล', confirmButtonColor: '#f59e0b', cancelButtonText: 'ยกเลิก', width: '600px',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white' },
        didOpen: () => {
            const mistakesContainer = document.querySelector('.swal2-container #mistakes_container');
            if (mistakesContainer) {
                mistakesContainer.innerHTML = ''; 
                if (window._currentAssignedStaff && window._currentAssignedStaff.length > 0) {
                    window._currentAssignedStaff.forEach(u => {
                        const oldMistake = tr.mistakes.find(m => m.empName === u.username);
                        if (oldMistake) window.addMistakeRow(oldMistake.empName, oldMistake.note, oldMistake.images);
                        else window.addMistakeRow(u.username, '', []); 
                    });
                    tr.mistakes.forEach(m => {
                        if (!window._currentAssignedStaff.find(u => u.username === m.empName)) window.addMistakeRow(m.empName, m.note, m.images);
                    });
                } else if (tr.mistakes && tr.mistakes.length > 0) {
                    tr.mistakes.forEach(m => window.addMistakeRow(m.empName, m.note, m.images));
                }
            }
        },
        preConfirm: () => {
            const checkerVal = document.querySelector('.swal2-container #trChecker').value;
            const missedVal = parseInt(document.querySelector('.swal2-container #trMissed').value) || 0;
            const scoreVal = document.querySelector('.swal2-container #trScore').value;

            let mistakes = [];
            document.querySelectorAll('.swal2-container .mistake-row').forEach(row => {
                const selectVal = row.querySelector('.mistake-emp-select').value;
                const manualVal = row.querySelector('.mistake-emp-manual').value.trim();
                let empName = selectVal === 'อื่นๆ' ? manualVal : selectVal;
                let note = row.querySelector('.mistake-note').value.trim();
                
                let images = [];
                row.querySelectorAll('.pasted-img').forEach(img => { images.push(img.src); });

                if (empName && (note !== '' || images.length > 0)) mistakes.push({ empName: empName, note: note, images: images });
            });

            return { checkerVal, missedVal, scoreVal, mistakes };
        }
    });

    if (isConfirmed && parsedData) {
        currentReports[team] = {
            checker: parsedData.checkerVal || currentUser.username, missed: parsedData.missedVal, score: parsedData.scoreVal || '-', bad_behavior: '-', 
            mistakes: parsedData.mistakes, updatedBy: currentUser.username, updatedAt: new Date().toISOString()
        };

        Swal.fire({title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading()});
        appDB.from('settings').upsert([{ key: reportKey, value: JSON.stringify(currentReports) }]).then(({error}) => {
            if (error) { Swal.fire('Error', error.message, 'error'); } 
            else {
                Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', timer: 1000, showConfirmButton: false });
                window.refreshDutyData();
                appDB.channel('duty-updates').send({ type: 'broadcast', event: 'force_reload' });
                // 🌟 [แก้บัค Realtime] เรียก helper เพื่อ insert log + broadcast (แทน monkey-patch เดิมที่ไม่ทำงาน)
                if (typeof window.broadcastTrainerReportChange === 'function') {
                    window.broadcastTrainerReportChange(reportKey);
                }
            }
        });
    }
};

window.addMistakeRow = function(empName = '', note = '', images = []) {
    const container = document.querySelector('.swal2-container #mistakes_container');
    if(!container) return;
    
    const rowId = 'mistake_' + Date.now() + Math.floor(Math.random() * 1000);
    
    let imagesHtml = '';
    if (images && images.length > 0) {
        images.forEach(src => { imagesHtml += `<div class="relative inline-block" title="คลิกสองครั้งเพื่อลบ"><img src="${src}" class="h-16 w-auto border rounded shadow-sm pasted-img cursor-pointer hover:opacity-80 transition" ondblclick="this.parentElement.remove()" onclick="window.open('${src}','_blank')"></div>`; });
    }

    let staffOptionsHTML = '<option value="">-- เลือกพนักงานในทีม --</option>';
    let isOtherName = true;

    if (window._currentAssignedStaff && window._currentAssignedStaff.length > 0) {
        window._currentAssignedStaff.forEach(u => {
            const isSelected = (empName === u.username) ? 'selected' : '';
            if (isSelected) isOtherName = false;
            staffOptionsHTML += `<option value="${u.username}" ${isSelected}>${u.username}</option>`;
        });
    }
    
    if (!empName) isOtherName = false;
    staffOptionsHTML += `<option value="อื่นๆ" ${isOtherName ? 'selected' : ''}>-- คนอื่นๆ (พิมพ์ชื่อเอง) --</option>`;

    const html = `
        <div id="${rowId}" class="mistake-row border border-red-200 dark:border-red-800 p-3 rounded bg-white dark:bg-slate-800 relative shadow-sm">
            <button type="button" onclick="document.getElementById('${rowId}').remove()" class="absolute top-2 right-2 text-red-500 hover:text-red-700 text-xs font-bold bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded transition">❌ ลบกล่องนี้</button>
            <div class="mb-2 pr-16">
                <label class="text-[10px] font-bold text-gray-500 dark:text-gray-400">ชื่อพนักงาน:</label>
                <select class="mistake-emp-select w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded p-1.5 text-xs mt-0.5 outline-none focus:border-red-500 font-bold text-blue-600" onchange="this.nextElementSibling.style.display = this.value === 'อื่นๆ' ? 'block' : 'none'">${staffOptionsHTML}</select>
                <input type="text" list="employee_list_modal" class="mistake-emp-manual w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded p-1.5 text-xs mt-1 outline-none focus:border-red-500" placeholder="พิมพ์ชื่อพนักงาน..." value="${isOtherName ? empName : ''}" style="display: ${isOtherName ? 'block' : 'none'}">
            </div>
            <div class="mb-2">
                <label class="text-[10px] font-bold text-gray-500 dark:text-gray-400">รายละเอียดความผิด:</label>
                <textarea class="mistake-note w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded p-1.5 text-xs mt-0.5 outline-none focus:border-red-500" rows="1" placeholder="พิมพ์ความผิด (ถ้าไม่มี ปล่อยว่างได้)"></textarea>
            </div>
            <div>
                <label class="text-[10px] font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1"><span class="material-icons text-[12px]">image</span> วางรูปลงกล่องด้านล่าง (Ctrl+V / วาง URL ก็ได้):</label>
                <div class="paste-image-area w-full min-h-[50px] border-2 border-dashed border-gray-300 dark:border-slate-600 rounded mt-0.5 p-2 text-center text-gray-400 text-xs focus:border-red-500 outline-none flex flex-wrap gap-2 items-center justify-center dark:bg-slate-900 transition cursor-text" contenteditable="true" oninput="handleUrlPaste(event, this)">
                    ${imagesHtml || 'คลิกที่นี่แล้วกด Ctrl+V เพื่อวางรูปภาพ'}
                </div>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', html);
    setTimeout(() => { document.getElementById(rowId).querySelector('.mistake-note').value = note; }, 10);
};

window.handleUrlPaste = function(e, div) {
    const text = div.innerText.trim();
    if (text.startsWith('http') && (text.match(/\.(jpeg|jpg|gif|png)$/) || text.includes('imgur') || text.includes('googleusercontent'))) {
        e.preventDefault(); div.innerHTML = ''; 
        let wrapper = document.createElement("div"); wrapper.className = "relative inline-block"; wrapper.title = "คลิกสองครั้งเพื่อลบ";
        let img = document.createElement("img"); img.src = text; img.className = "h-16 w-auto border rounded shadow-sm pasted-img cursor-pointer hover:opacity-80 transition";
        img.ondblclick = function() { wrapper.remove(); }; 
        wrapper.appendChild(img); div.appendChild(wrapper);
    } else if (text !== '' && !text.includes('คลิกที่นี่')) {
         setTimeout(()=> div.innerHTML = div.innerHTML.replace(text, ''), 10);
    }
};
document.addEventListener('paste', function(e) {
    let target = e.target;
    while (target && target.nodeName !== 'BODY') {
        if (target.classList && target.classList.contains('paste-image-area')) break;
        target = target.parentNode;
    }

    if (target && target.classList && target.classList.contains('paste-image-area')) {
        let items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let index in items) {
            let item = items[index];
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                e.preventDefault(); 
                let blob = item.getAsFile();
                let reader = new FileReader();
                reader.onload = function(event) {
                    if (target.innerHTML.includes("คลิกที่นี่แล้วกด Ctrl+V")) target.innerHTML = ''; 
                    
                    let wrapper = document.createElement("div"); wrapper.className = "relative inline-block"; wrapper.title = "คลิกสองครั้งเพื่อลบ";
                    let img = document.createElement("img"); img.src = event.target.result; img.className = "h-16 w-auto border rounded shadow-sm pasted-img cursor-pointer hover:opacity-80 transition";
                    img.ondblclick = function() { wrapper.remove(); }; 
                    wrapper.appendChild(img); target.appendChild(wrapper);
                };
                reader.readAsDataURL(blob);
            }
        }
    }
});

window.openDutyHistoryModal = async function() {
    Swal.fire({title: 'กำลังโหลดประวัติ...', didOpen: () => Swal.showLoading()});
    try {
        const { data, error } = await appDB.from('system_logs').select('*').in('action_type', ['จัดหน้าที่', 'สุ่มจัดหน้าที่', 'แจกงานรอง', 'ล้างงานรอง', 'ล้างตารางงาน', 'ประเมินงานผู้สอน', 'ย้ายหน้าที่', 'กู้คืนตารางงาน']).order('created_at', { ascending: false }).limit(50);
        if (error) throw error;

        let rows = '';
        if (!data || data.length === 0) {
            rows = `<tr><td colspan="4" class="text-center p-6 text-gray-500 font-bold">ยังไม่มีประวัติการทำรายการ</td></tr>`;
        } else {
            data.forEach(log => {
                const time = new Date(log.created_at).toLocaleString('th-TH', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'});
                let badgeColor = 'text-blue-600 bg-blue-100 border-blue-200';
                if (log.action_type === 'ล้างตารางงาน') badgeColor = 'text-red-600 bg-red-100 border-red-200';
                if (log.action_type === 'ประเมินงานผู้สอน') badgeColor = 'text-amber-600 bg-amber-100 border-amber-200';
                if (log.action_type === 'ย้ายหน้าที่') badgeColor = 'text-purple-600 bg-purple-100 border-purple-200';
                if (log.action_type === 'สุ่มจัดหน้าที่') badgeColor = 'text-emerald-600 bg-emerald-100 border-emerald-200';
                if (log.action_type === 'แจกงานรอง') badgeColor = 'text-cyan-600 bg-cyan-100 border-cyan-200';
                if (log.action_type === 'ล้างงานรอง') badgeColor = 'text-sky-700 bg-sky-100 border-sky-300';
                if (log.action_type === 'กู้คืนตารางงาน') badgeColor = 'text-indigo-600 bg-indigo-100 border-indigo-200';
                if (log.action_type === 'กู้คืนตารางงาน') badgeColor = 'text-emerald-600 bg-emerald-100 border-emerald-200';

                rows += `
                    <tr class="border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition text-xs">
                        <td class="px-3 py-2 font-mono text-gray-500 whitespace-nowrap">${time}</td>
                        <td class="px-3 py-2 font-bold text-slate-700 dark:text-gray-200">${log.performed_by}</td>
                        <td class="px-3 py-2 whitespace-nowrap"><span class="${badgeColor} px-2 py-0.5 rounded border shadow-sm font-bold text-[10px]">${log.action_type}</span></td>
                        <td class="px-3 py-2 text-gray-600 dark:text-gray-400">${log.target_details}</td>
                    </tr>
                `;
            });
        }

        const htmlContent = `
            <div class="text-left overflow-hidden rounded-lg border border-gray-300 dark:border-slate-600 shadow-inner bg-white dark:bg-slate-900">
                <div class="max-h-[60vh] overflow-y-auto custom-scrollbar">
                    <table class="w-full text-left">
                        <thead class="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-gray-300 sticky top-0 z-10 shadow-sm">
                            <tr class="text-xs uppercase tracking-wider">
                                <th class="px-3 py-2 font-bold">วัน-เวลา</th><th class="px-3 py-2 font-bold">ผู้ทำรายการ</th><th class="px-3 py-2 font-bold">ประเภท</th><th class="px-3 py-2 font-bold">รายละเอียด</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
        `;

        Swal.fire({
            title: '<div class="flex items-center justify-center gap-2"><span class="material-icons text-indigo-500">history</span> ประวัติระบบจัดหน้าที่</div>',
            html: htmlContent, width: '750px', showConfirmButton: false, showCloseButton: true,
            customClass: { popup: 'dark:bg-slate-800 dark:text-white' }
        });

    } catch (e) { Swal.fire('Error', 'ไม่สามารถโหลดประวัติได้: ' + e.message, 'error'); }
};

function calculateQuotaByRule(totalStaff) {
    if (totalStaff === 0) return 0;
    if (totalStaff <= 4) return 1;  
    if (totalStaff <= 7) return 2;  
    if (totalStaff <= 10) return 3; 
    if (totalStaff <= 14) return 4; 
    if (totalStaff <= 20) return 5; 
    if (totalStaff <= 25) return 6; 
    if (totalStaff <= 30) return 7; 
    return 8;                               
}

window.autoCalculateTeamQuotas = async function() {
    const rows = document.querySelectorAll('.quota-row-team');
    if (rows.length === 0) return Swal.fire('เตือน', 'ไม่มีรายชื่อทีมให้คำนวณ', 'warning');

    let defaultDate = document.getElementById('wDate') ? document.getElementById('wDate').value : '';
    if (!defaultDate) {
        const today = new Date();
        const offset = today.getTimezoneOffset() * 60000;
        defaultDate = (new Date(today - offset)).toISOString().slice(0, 10);
    }

    const { value: selectedDate } = await Swal.fire({
        title: 'เลือกวันที่จัดหน้าที่', text: 'ระบบจะไปดึงจำนวนคนที่ได้ลงเวรจริงในวันนั้น มาคำนวณโควตา',
        input: 'date', inputValue: defaultDate, showCancelButton: true, confirmButtonText: 'ดึงข้อมูลและคำนวณ', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#0891b2'
    });

    if (!selectedDate) return; 

    Swal.fire({ title: `กำลังดึงตารางของ ${selectedDate}...`, allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const keysToFetch = [
        `duty_roster_AM_${selectedDate}_กะเช้า`, `duty_roster_AM_${selectedDate}_กะกลาง`, `duty_roster_AM_${selectedDate}_กะดึก`,
        `duty_roster_OD_${selectedDate}_กะเช้า`, `duty_roster_OD_${selectedDate}_กะกลาง`, `duty_roster_OD_${selectedDate}_กะดึก`
    ];

    try {
        const { data } = await appDB.from('settings').select('*').in('key', keysToFetch);
        const rosters = { AM: {}, OD: {} };
        ['AM', 'OD'].forEach(dept => { rosters[dept] = { 'กะเช้า': {}, 'กะกลาง': {}, 'กะดึก': {} }; });

        if (data) {
            data.forEach(row => {
                const parts = row.key.split('_'); 
                const dept = parts[2];
                const shift = parts[4];
                if (rosters[dept] && rosters[dept][shift]) rosters[dept][shift] = JSON.parse(row.value);
            });
        }

        let sumM = 0, sumA = 0, sumN = 0;       
        let sumOdM = 0, sumOdA = 0, sumOdN = 0; 
        let updatedCount = 0;

        rows.forEach(row => {
            const teamName = row.querySelector('.key-input').value.trim();
            const deptName = row.querySelector('.dept-input').value.trim(); 
            if (!teamName) return;

            const getCountFromRoster = (shift) => {
                if (rosters[deptName] && rosters[deptName][shift] && rosters[deptName][shift][teamName]) {
                    const staffAssigned = rosters[deptName][shift][teamName];
                    return staffAssigned.filter(u => !u.username.includes('ขาดคน')).length;
                }
                return 0; 
            };

            let countM = getCountFromRoster('กะเช้า');
            let countA = getCountFromRoster('กะกลาง');
            let countN = getCountFromRoster('กะดึก');

            const qM = calculateQuotaByRule(countM);
            const qA = calculateQuotaByRule(countA);
            const qN = calculateQuotaByRule(countN);

            row.querySelector('.val-m').value = qM;
            row.querySelector('.val-a').value = qA;
            row.querySelector('.val-n').value = qN;

            if (deptName === 'AM') { sumM += qM; sumA += qA; sumN += qN; }
            if (deptName === 'OD') { sumOdM += qM; sumOdA += qA; sumOdN += qN; }
            updatedCount++;
        });

        document.querySelectorAll('.quota-row-total').forEach(row => {
            const shiftName = row.querySelector('.key-input').value.trim();
            if(shiftName === 'เช้า') row.querySelector('.val-input').value = sumM;
            if(shiftName === 'กลาง') row.querySelector('.val-input').value = sumA;
            if(shiftName === 'ดึก') row.querySelector('.val-input').value = sumN;
        });

        document.querySelectorAll('.quota-row-od').forEach(row => {
            const shiftName = row.querySelector('.key-input').value.trim();
            if(shiftName === 'เช้า') row.querySelector('.val-input').value = sumOdM;
            if(shiftName === 'กลาง') row.querySelector('.val-input').value = sumOdA;
            if(shiftName === 'ดึก') row.querySelector('.val-input').value = sumOdN;
        });

        Swal.fire({ icon: 'success', title: 'คำนวณสำเร็จ!', html: `อัปเดตโควตาให้แล้ว ${updatedCount} ทีม<br><span class="text-sm text-red-500 font-bold">* อย่าลืมกดปุ่ม "บันทึกโควตา"</span>`, confirmButtonColor: '#2563eb' });
    } catch (error) { Swal.fire('Error', 'เกิดข้อผิดพลาดในการดึงข้อมูลตารางงาน', 'error'); }
};

window.renderDutyAccessTable = function() {
    const head = document.getElementById('dutyAccessHead');
    const body = document.getElementById('dutyAccessBody');
    if(!head || !body) return;
    
    let staff = GLOBAL_USER_LIST.filter(u => {
        let uDept = u.department || 'AM';
        if (uDept === 'TRAINER') uDept = 'AMQL'; 

        if (currentDutyDept === 'AMQL' || currentDutyDept === 'ODQL' || currentDutyDept.startsWith('TRAINER')) {
            return uDept === currentDutyDept; 
        } else {
            return u.role === 'staff' && uDept === currentDutyDept;
        }
    });

    // 🌟 ดึงลิสต์รายชื่อเว็บมาตรฐาน (บวกหน้าที่ส่วนกลาง) มาใช้เลย ไม่ต้องมีเงื่อนไขพิเศษ
    let headHtml = `<tr><th class="p-2 bg-slate-200 dark:bg-slate-800 border-r dark:border-slate-700 min-w-[120px]">ชื่อพนักงาน</th>`;
    sortedTeams.forEach(team => { headHtml += `<th class="p-2 text-center text-[10px] font-extrabold truncate max-w-[50px] border-r dark:border-slate-700" title="${team}">${team}</th>`; });
    headHtml += `</tr>`;
    head.innerHTML = headHtml;
    
    const shiftFilter = document.getElementById('settingShiftFilter') ? document.getElementById('settingShiftFilter').value : 'all';
    const searchFilter = document.getElementById('settingSearchInput') ? document.getElementById('settingSearchInput').value.toLowerCase() : '';

    if (shiftFilter !== 'all') staff = staff.filter(u => u.allowed_shift === shiftFilter);
    if (searchFilter) staff = staff.filter(u => u.username.toLowerCase().includes(searchFilter));
    
    staff.sort((a,b) => a.username.localeCompare(b.username));
    
    const countEl = document.getElementById('dutyStaffCount');
    if(countEl) countEl.innerText = `${staff.length} คน`;

    let bodyHtml = '';
    staff.forEach(u => {
        const shiftColor = u.allowed_shift === 'กะเช้า' ? 'text-orange-500' : (u.allowed_shift === 'กะกลาง' ? 'text-blue-500' : 'text-purple-500');
        
        let roleBadge = '';
        if (u.role === 'manager' || u.role === 'admin') {
            roleBadge = `<span class="text-[9px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded border border-red-200 shadow-sm ml-1">Manager</span>`;
        }

        const userAccess = dutyAccessMatrix[u.id] || [];
        const validAccessCount = userAccess.filter(t => sortedTeams.includes(t)).length; 

        let noAccessWarning = '';
        let rowBgClass = 'hover:bg-slate-50 dark:hover:bg-slate-800/50'; 

        if (validAccessCount === 0) {
            noAccessWarning = `<span class="text-[9px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded shadow-sm ml-1 animate-pulse" title="พนักงานคนนี้จะจัดตารางไม่ได้เพราะไม่มีสิทธิ์เว็บใดเลย">ไม่มีสิทธิ์</span>`;
            rowBgClass = 'bg-red-50/50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40';
        }

        let rowHtml = `<tr class="${rowBgClass} transition">
            <td class="p-2 font-bold text-slate-700 dark:text-gray-200 border-r dark:border-slate-700 flex justify-between items-center">
                <div class="flex items-center flex-wrap">
                    <span>${u.username}</span>
                    ${roleBadge}
                    ${noAccessWarning} </div>
                <span class="text-[9px] ${shiftColor} bg-gray-100 dark:bg-slate-900 px-1 rounded border dark:border-slate-600 shrink-0 ml-1">${u.allowed_shift.replace('กะ','')}</span>
            </td>`;
        
        sortedTeams.forEach(team => {
            const isChecked = userAccess.includes(team) ? 'checked' : '';
            rowHtml += `<td class="p-1 text-center border-r dark:border-slate-700 bg-white dark:bg-transparent"><input type="checkbox" class="duty-check w-5 h-5 text-green-500 rounded cursor-pointer border-gray-300 focus:ring-green-500 shadow-sm transition" onchange="updateLocalDutyAccess('${u.id}', '${team}', this.checked)" ${isChecked}></td>`;
        });
        rowHtml += `</tr>`;
        bodyHtml += rowHtml;
    });
    
    if(staff.length === 0) bodyHtml = `<tr><td colspan="${sortedTeams.length+1}" class="p-8 text-center text-gray-400">ไม่พบพนักงานที่ค้นหา</td></tr>`;
    body.innerHTML = bodyHtml;
}

window.updateLocalDutyAccess = function(uid, team, isChecked) {
    if(!dutyAccessMatrix[uid]) dutyAccessMatrix[uid] = [];
    if(isChecked) { 
        if(!dutyAccessMatrix[uid].includes(team)) dutyAccessMatrix[uid].push(team); 
    } else { 
        dutyAccessMatrix[uid] = dutyAccessMatrix[uid].filter(t => t !== team); 
    }
}

window.saveDutyAccess = async function() {
    Swal.fire({title: 'กำลังบันทึกสิทธิ์...', didOpen: () => Swal.showLoading()});
    try {
        await appDB.from('settings').upsert([{ key: 'duty_access_matrix', value: JSON.stringify(dutyAccessMatrix) }]);
        Swal.fire({icon: 'success', title: 'บันทึกสำเร็จ', timer: 1000, showConfirmButton: false});
    } catch(e) { Swal.fire('Error', e.message, 'error'); }
}

window.renderRoleEditorList = function() {
    const team = document.getElementById('roleEditorTeam').value;
    const listDiv = document.getElementById('roleEditorList');
    if(!team || !customDutyRoles[team]) { listDiv.innerHTML = ''; return; }
    const roles = customDutyRoles[team];
    if(roles.length === 0) { listDiv.innerHTML = '<div class="text-center text-gray-400 text-xs py-4">ไม่มีหัวข้อในเว็บนี้</div>'; return; }
    listDiv.innerHTML = roles.map((r, idx) => `<div class="flex justify-between items-center bg-white dark:bg-slate-800 p-2 rounded shadow-sm border border-gray-200 dark:border-slate-700"><span class="text-xs font-bold text-slate-700 dark:text-gray-200">${r}</span><button onclick="removeDutyRole('${team}', ${idx})" class="text-red-400 hover:text-red-600"><span class="material-icons text-sm">close</span></button></div>`).join('');
}

window.addDutyRole = async function() {
    const team = document.getElementById('roleEditorTeam').value; const input = document.getElementById('newRoleInput'); const val = input.value.trim();
    if(!val || !team) return;
    if(!customDutyRoles[team]) customDutyRoles[team] = [];
    customDutyRoles[team].push(val); input.value = ''; window.renderRoleEditorList(); await window.saveCustomRolesToDB();
    // ถ้าแก้หัวข้อให้ render ตาราง OD ใหม่ด้วยเผื่อเปิดอยู่
    if (document.getElementById('dutyMatrixGrid') && !document.getElementById('dutyMatrixGrid').classList.contains('hidden')) {
        window.renderTrainerOdMatrix(currentRosterData);
    }
}

window.removeDutyRole = async function(team, idx) {
    if(customDutyRoles[team]) { 
        customDutyRoles[team].splice(idx, 1); 
        window.renderRoleEditorList(); 
        await window.saveCustomRolesToDB(); 
        // ถ้าแก้หัวข้อให้ render ตาราง OD ใหม่ด้วยเผื่อเปิดอยู่
        if (document.getElementById('dutyMatrixGrid') && !document.getElementById('dutyMatrixGrid').classList.contains('hidden')) {
            window.renderTrainerOdMatrix(currentRosterData);
        }
    }
}

window.saveCustomRolesToDB = async function() { await appDB.from('settings').upsert([{ key: 'duty_custom_roles', value: JSON.stringify(customDutyRoles) }]); }

window.renderDutyRequirements = function() {
    const container = document.getElementById('dutyRequirements');
    if(!container) return;
    container.innerHTML = '';
    const savedReqs = JSON.parse(localStorage.getItem(`duty_reqs_${currentDutyDept}`) || '{}');

    sortedTeams.forEach((team, index) => {
        const reqKey = `req_${team}`;
        const defaultVal = savedReqs[reqKey] || 0;
        const colorClass = TEAM_COLORS[team] || TEAM_COLORS['DEFAULT'];

        container.innerHTML += `
            <div class="flex items-center bg-white dark:bg-slate-800 rounded-lg border border-gray-300 dark:border-slate-600 shadow-sm overflow-hidden group hover:border-indigo-400 transition">
                <div class="flex flex-col items-center border-r border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 w-5">
                    <button onclick="moveTeam('${team}', -1)" class="text-gray-400 hover:text-indigo-600 leading-none h-4 ${index === 0 ? 'invisible' : ''}">◀</button>
                    <button onclick="moveTeam('${team}', 1)" class="text-gray-400 hover:text-indigo-600 leading-none h-4 ${index === sortedTeams.length-1 ? 'invisible' : ''}">▶</button>
                </div>
                <div class="${colorClass.bg} ${colorClass.text} text-[11px] font-extrabold px-2 py-1.5 w-16 text-center border-r ${colorClass.border} truncate" title="${team}">${team}</div>
                <input type="number" id="${reqKey}" onchange="window.manualAdjustReq('${team}')" class="req-input w-12 text-center text-sm font-bold bg-transparent outline-none text-slate-800 dark:text-white py-1" value="${defaultVal}" min="0">
            </div>
        `;
    });
}

window.manualAdjustReq = function(changedTeam) {
    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    
    const activeStaff = GLOBAL_USER_LIST.filter(u => {
        let uDept = u.department || 'AM';
        if (uDept === 'TRAINER') uDept = 'AMQL';

        const isCorrectDept = uDept === currentDutyDept;
        const hasValidRole = (currentDutyDept === 'AMQL' || currentDutyDept === 'ODQL' || currentDutyDept.startsWith('TRAINER')) ? true : (u.role === 'staff');
        const isShiftMatch = (u.allowed_shift === shiftFilter || u.allowed_shift === 'all'); 
        return hasValidRole && isCorrectDept && isShiftMatch && !currentDutyLeaves.has(String(u.id));
    });
    
    const availableCount = activeStaff.length;
    if (availableCount === 0) return; 

    let reqs = {};
    let totalReq = 0;
    sortedTeams.forEach(team => {
        const val = parseInt(document.getElementById(`req_${team}`).value) || 0;
        reqs[team] = val;
        totalReq += val;
    });

    const changedInput = document.getElementById(`req_${changedTeam}`);
    let changedVal = parseInt(changedInput.value) || 0;

    if (changedVal < 0) {
        changedVal = 0;
        reqs[changedTeam] = 0;
        totalReq = Object.values(reqs).reduce((a,b) => a+b, 0);
    }

    let diff = totalReq - availableCount;

    if (diff === 0) {
        window.updateDutyStats();
        return; 
    }

    let safeLoopLimit = 1000;

    while (diff > 0 && safeLoopLimit-- > 0) {
        let maxTeam = null; let maxVal = -1;
        sortedTeams.forEach(t => {
            if (t !== changedTeam && reqs[t] > maxVal && reqs[t] > 0) { maxVal = reqs[t]; maxTeam = t; }
        });
        if (maxTeam) { reqs[maxTeam]--; diff--; } 
        else { reqs[changedTeam]--; diff--; }
    }

    while (diff < 0 && safeLoopLimit-- > 0) {
        let minTeam = null; let minVal = Infinity;
        sortedTeams.forEach(t => {
            if (t !== changedTeam && reqs[t] < minVal) { minVal = reqs[t]; minTeam = t; }
        });
        if (minTeam) { reqs[minTeam]++; diff++; } 
        else { reqs[changedTeam]++; diff++; }
    }

    const reqsToSave = {};
    sortedTeams.forEach(team => {
        const input = document.getElementById(`req_${team}`);
        if (input) input.value = reqs[team];
        reqsToSave[`req_${team}`] = reqs[team];
    });
    
    localStorage.setItem(`duty_reqs_${currentDutyDept}`, JSON.stringify(reqsToSave));
    window.updateDutyStats();
};

window.autoSuggestRequirements = function() {
    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    const targetDate = document.getElementById('dutyDate').value;
    if(!targetDate) return Swal.fire('!', 'กรุณาเลือกวันที่ก่อน', 'warning');

    const activeStaff = GLOBAL_USER_LIST.filter(u => {
        let uDept = u.department || 'AM';
        if (uDept === 'TRAINER') uDept = 'AMQL';

        const isCorrectDept = uDept === currentDutyDept;
        const hasValidRole = (currentDutyDept === 'AMQL' || currentDutyDept === 'ODQL' || currentDutyDept.startsWith('TRAINER')) ? true : (u.role === 'staff');
        const isShiftMatch = (u.allowed_shift === shiftFilter || u.allowed_shift === 'all');
        return hasValidRole && isCorrectDept && isShiftMatch && !currentDutyLeaves.has(String(u.id));
    });

    if(activeStaff.length === 0) return Swal.fire('ไม่มีข้อมูล', 'ไม่มีพนักงานว่างในกะนี้เลย', 'info');

    let suggestedReqs = {};
    sortedTeams.forEach(t => suggestedReqs[t] = 0);

    let pool = [...activeStaff].sort(() => Math.random() - 0.5);
    let unassignedUsers = []; 

    pool.forEach(u => {
        const access = dutyAccessMatrix[u.id] || [];
        const validAccess = access.filter(t => sortedTeams.includes(t));

        if (validAccess.length > 0) {
            let minTeam = validAccess[0];
            let minVal = suggestedReqs[minTeam];
            for (let i = 1; i < validAccess.length; i++) {
                if (suggestedReqs[validAccess[i]] < minVal) {
                    minTeam = validAccess[i];
                    minVal = suggestedReqs[validAccess[i]];
                }
            }
            suggestedReqs[minTeam]++;
        } else {
            unassignedUsers.push(u.username); 
        }
    });

    sortedTeams.forEach(team => {
        const input = document.getElementById(`req_${team}`);
        if (input) input.value = suggestedReqs[team];
    });

    const reqsToSave = {};
    sortedTeams.forEach(team => reqsToSave[`req_${team}`] = suggestedReqs[team]);
    localStorage.setItem(`duty_reqs_${currentDutyDept}`, JSON.stringify(reqsToSave));

    window.updateDutyStats();

    if (unassignedUsers.length > 0) {
        Swal.fire({
            icon: 'warning', 
            title: 'มีคนไม่มีสิทธิ์!', 
            html: `ระบบดึงคนมาคำนวณทั้งหมด ${activeStaff.length} คน<br>แต่พบพนักงาน <b>${unassignedUsers.length} คน</b> ที่ไม่มีสิทธิ์เข้าเว็บใดๆ เลย:<br><br><span class="text-red-500 font-bold">${unassignedUsers.join(', ')}</span><br><br><span class="text-[10px] text-gray-500">*ถ้าชื่อเหล่านี้เป็นคนกะอื่น ให้ไปเช็คหน้า "จัดการพนักงาน" ว่าตั้งกะเป็น "กะอิสระ" ทิ้งไว้หรือไม่ครับ</span>`
        });
    } else {
        const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
        Toast.fire({ icon: 'success', title: 'คำนวณยอดคนออโต้สำเร็จ!' });
    }
}

window.updateDutyStats = function() {
    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    const statusBar = document.getElementById('dutyStatusBar');
    if(!statusBar) return;

    const activeStaff = GLOBAL_USER_LIST.filter(u => {
        let uDept = u.department || 'AM';
        if (uDept === 'TRAINER') uDept = 'AMQL'; 

        const isCorrectDept = uDept === currentDutyDept;
        const hasValidRole = (currentDutyDept === 'AMQL' || currentDutyDept === 'ODQL' || currentDutyDept.startsWith('TRAINER')) ? true : (u.role === 'staff');
        const isShiftMatch = (u.allowed_shift === shiftFilter || u.allowed_shift === 'all');
        return hasValidRole && isCorrectDept && isShiftMatch && !currentDutyLeaves.has(String(u.id));
    });
    
    const availableCount = activeStaff.length;

    let requiredCount = 0;
    document.querySelectorAll('.req-input').forEach(input => {
        requiredCount += (parseInt(input.value) || 0);
    });

    let statusHTML = '';
    let statusClass = 'p-2 text-center text-xs font-bold transition-colors duration-300 border-b shadow-sm ';

    if (requiredCount === 0) {
        statusClass += 'bg-gray-200 text-gray-600 border-gray-300 dark:bg-slate-800 dark:border-slate-700';
        statusHTML = `ℹ️ กรุณาใส่จำนวนคนให้แต่ละเว็บ (คนมาทำงานกะนี้: ${availableCount} คน)`;
    } else if (availableCount === requiredCount) {
        statusClass += 'bg-green-500 text-white border-green-600 shadow-[0_0_10px_rgba(34,197,94,0.5)]';
        statusHTML = `✅ ยอดเยี่ยม! จัดคนพอดีเป๊ะ (ว่าง: ${availableCount} คน | ต้องการ: ${requiredCount} คน)`;
    } else if (requiredCount > availableCount) {
        statusClass += 'bg-red-500 text-white border-red-600 shadow-[0_0_10px_rgba(239,68,68,0.5)]';
        statusHTML = `❌ ขาดคน! คุณใส่เลขเกิน (ว่าง: ${availableCount} คน | ต้องการ: ${requiredCount} คน)`;
    } else {
        statusClass += 'bg-amber-400 text-amber-900 border-amber-500 shadow-[0_0_10px_rgba(251,191,36,0.5)]';
        statusHTML = `⚠️ มีคนเหลือว่างงาน! (ว่าง: ${availableCount} คน | ต้องการแค่: ${requiredCount} คน)`;
    }

    statusBar.className = statusClass;
    statusBar.innerHTML = statusHTML;
}

// 🌟 [แก้บัค Realtime] Helper สำหรับ broadcast การเปลี่ยนแปลงและ log
// ใช้แทน monkey-patch เดิมที่ไม่ทำงาน (เพราะ appDB.from() คืน object ใหม่ทุกครั้ง)
// เรียกฟังก์ชันนี้หลังจาก upsert report สำเร็จ
window.broadcastTrainerReportChange = async function(reportKey) {
    try {
        const parts = reportKey.split('_');
        if (parts[1] === 'AMQL' || parts[1] === 'ODQL' || parts[1].startsWith('TRAINER')) {
            const dateStr = parts[parts.length - 2];
            const shiftStr = parts[parts.length - 1];
            
            await appDB.from('system_logs').insert([{ 
                action_type: 'ประเมินงานผู้สอน', 
                performed_by: currentUser.username, 
                target_details: `ลงข้อมูลประเมินการทำงาน (กะ: ${shiftStr}, วันที่: ${dateStr})` 
            }]);
            
            appDB.channel('duty-updates').send({ type: 'broadcast', event: 'force_reload' });
        }
    } catch(e) { console.warn('broadcastTrainerReportChange error:', e); }
};


let dutySearchTimeout = null;
window.onDutySearch = function() {
    clearTimeout(dutySearchTimeout);
    dutySearchTimeout = setTimeout(() => {
        filterDutyResult(); 
    }, 300); 
};

// 🟢 อัปเดตตาราง OD เพิ่มกฎ "แบนงานหลักข้ามกะ" เด็ดขาด (เช้าห้ามแนะนำเพื่อน, ดึกห้ามคำขอโปร)
// 🌟 [แก้บัค Realtime ผู้สอน] Key สำหรับเก็บการเปลี่ยน role ใน DB
// แยกตาม วันที่ + กะ + แผนก (เพื่อให้แต่ละกะของแต่ละวันมีค่าของตัวเอง)
window.getTrainerMatrixRoleKey = function(dept, dateStr, shift) {
    return `trainer_matrix_roles_${dept}_${dateStr}_${shift}`;
};

window.renderTrainerOdMatrix = async function(rosterData) {
    const matrixGrid = document.getElementById('dutyMatrixGrid');
    if (!matrixGrid) return;

    // 🔒 เช็คสิทธิ์การแก้ไข (ถ้าเป็นผู้สอน จะแก้ไขหน้าตารางของตัวเองไม่ได้)
    let canEdit = window.isDutyAdmin();
    if (currentDutyDept === 'AMQL' || currentDutyDept === 'ODQL' || currentDutyDept.startsWith('TRAINER')) {
        if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
            canEdit = false;
        }
    }
    
    let disableAttr = canEdit ? '' : 'disabled';
    let cursorClass = canEdit ? 'cursor-pointer hover:shadow-md' : 'cursor-default pointer-events-none appearance-none opacity-100'; 

    // 🌟 [แก้บัค Realtime ผู้สอน] โหลด override role ที่บันทึกไว้จาก DB
    const targetDate = document.getElementById('dutyDate') ? document.getElementById('dutyDate').value : '';
    const shiftFilterForKey = document.getElementById('dutyShiftSelect') ? document.getElementById('dutyShiftSelect').value : 'all';
    const matrixRoleKey = window.getTrainerMatrixRoleKey(currentDutyDept, targetDate, shiftFilterForKey);
    let savedRoleOverrides = {};
    try {
        if (targetDate) {
            const { data } = await appDB.from('settings').select('value').eq('key', matrixRoleKey).maybeSingle();
            if (data && data.value) savedRoleOverrides = JSON.parse(data.value);
        }
    } catch(e) { console.warn('Load trainer matrix roles failed:', e); savedRoleOverrides = {}; }

    const matrixWebsites = ['Jun88', 'MK8', 'VV72', 'TH26', 'K188', 'BT678', 'PG688', 'JL69', 'NM9', 'F168', 'หน้าที่ส่วนกลาง'];

    const webColors = {
        'Jun88': 'bg-blue-600 text-white',
        'MK8': 'bg-black text-yellow-400',
        'VV72': 'bg-green-700 text-white',
        'Vv72': 'bg-green-700 text-white',
        'TH26': 'bg-gray-700 text-white',
        'K188': 'bg-sky-500 text-white',
        'BT678': 'bg-red-600 text-white',
        'PG688': 'bg-amber-100 text-amber-900',
        'JL69': 'bg-slate-600 text-white',
        'NM9': 'bg-pink-600 text-white',
        'F168': 'bg-orange-600 text-white',
        'หน้าที่ส่วนกลาง': 'bg-indigo-900 text-amber-400'
    };

    const shiftFilter = document.getElementById('dutyShiftSelect') ? document.getElementById('dutyShiftSelect').value : 'all';

    const staffList = GLOBAL_USER_LIST.filter(u => {
        let isOdTrainer = false;
        if (u.department === 'ODQL' || u.department === 'TRAINER_OD') isOdTrainer = true;
        if (u.department === 'OD' && (u.role === 'trainer' || u.role === 'TRAINER')) isOdTrainer = true;
        
        if (!isOdTrainer) return false;
        if (shiftFilter !== 'all') {
             if (u.allowed_shift !== shiftFilter && u.allowed_shift !== 'all') return false;
        }
        return true;
    });

    const leaveIds = new Set(window.currentDutyLeaveData.map(l => String(l.user_id)));
    const activeTrainers = staffList.filter(u => !leaveIds.has(String(u.id)));

    let userTaskRoles = {}; 
    let globalPoolIndex = 0; 

    matrixWebsites.forEach(web => {
        let webTasks = customDutyRoles[web] || customDutyRoles[(web === 'VV72' ? 'Vv72' : web)] || ['ไม่มีหัวข้อ'];
        if (webTasks.length === 0) webTasks = ['-'];
        
        let primaryUsers = (rosterData[web] || []).filter(u => !u.username.includes('ขาดคน'));
        
        if (web === 'หน้าที่ส่วนกลาง' || (primaryUsers.length === 0 && activeTrainers.length > 0)) {
            let pool = activeTrainers.length > 0 ? activeTrainers : primaryUsers;
            
            webTasks.forEach((task, tIdx) => {
                // 🌟 กฎเหล็ก: แบนงานหลักข้ามกะ
                if (shiftFilter === 'กะเช้า' && task === 'แนะนำเพื่อน') return;
                if (shiftFilter === 'กะดึก' && task === 'คำขอโปร') return;

                if (pool.length > 0) {
                    if (web === 'หน้าที่ส่วนกลาง' && task === 'เคสเทเลแกรม') {
                        let uJob1 = pool[globalPoolIndex % pool.length];
                        if (!userTaskRoles[uJob1.id]) userTaskRoles[uJob1.id] = {};
                        if (!userTaskRoles[uJob1.id][web]) userTaskRoles[uJob1.id][web] = {};
                        userTaskRoles[uJob1.id][web][tIdx] = 'job';

                        if (pool.length > 1) {
                            let uJob2 = pool[(globalPoolIndex + 1) % pool.length];
                            if (!userTaskRoles[uJob2.id]) userTaskRoles[uJob2.id] = {};
                            if (!userTaskRoles[uJob2.id][web]) userTaskRoles[uJob2.id][web] = {};
                            userTaskRoles[uJob2.id][web][tIdx] = 'job';
                        }

                        if (pool.length > 2) {
                            for (let i = 2; i < pool.length; i++) {
                                let uSup = pool[(globalPoolIndex + i) % pool.length];
                                if (!userTaskRoles[uSup.id]) userTaskRoles[uSup.id] = {};
                                if (!userTaskRoles[uSup.id][web]) userTaskRoles[uSup.id][web] = {};
                                userTaskRoles[uSup.id][web][tIdx] = 'sup';
                            }
                        }
                        globalPoolIndex += 2; 
                    } else {
                        let uJob = pool[globalPoolIndex % pool.length];
                        if (!userTaskRoles[uJob.id]) userTaskRoles[uJob.id] = {};
                        if (!userTaskRoles[uJob.id][web]) userTaskRoles[uJob.id][web] = {};
                        userTaskRoles[uJob.id][web][tIdx] = 'job';
                        
                        if (pool.length > 1) {
                            let uSup = pool[(globalPoolIndex + 1) % pool.length];
                            if (!userTaskRoles[uSup.id]) userTaskRoles[uSup.id] = {};
                            if (!userTaskRoles[uSup.id][web]) userTaskRoles[uSup.id][web] = {};
                            userTaskRoles[uSup.id][web][tIdx] = 'sup';
                        }
                        globalPoolIndex++; 
                    }
                }
            });
        } else {
            primaryUsers.sort((a,b) => a.username.localeCompare(b.username));
            
            if (web === 'F168') {
                webTasks.forEach((task, tIdx) => {
                    // 🌟 กฎเหล็ก: แบนงานหลักข้ามกะ
                    if (shiftFilter === 'กะเช้า' && task === 'แนะนำเพื่อน') return;
                    if (shiftFilter === 'กะดึก' && task === 'คำขอโปร') return;

                    if (primaryUsers.length > 0) {
                        let uJob1 = primaryUsers[tIdx % primaryUsers.length];
                        if (!userTaskRoles[uJob1.id]) userTaskRoles[uJob1.id] = {};
                        if (!userTaskRoles[uJob1.id][web]) userTaskRoles[uJob1.id][web] = {};
                        userTaskRoles[uJob1.id][web][tIdx] = 'job';
                        
                        if (primaryUsers.length > 1) {
                            let uJob2 = primaryUsers[(tIdx + 1) % primaryUsers.length];
                            if (!userTaskRoles[uJob2.id]) userTaskRoles[uJob2.id] = {};
                            if (!userTaskRoles[uJob2.id][web]) userTaskRoles[uJob2.id][web] = {};
                            userTaskRoles[uJob2.id][web][tIdx] = 'job';
                        }

                        if (primaryUsers.length > 2) {
                            let uJob3 = primaryUsers[(tIdx + 2) % primaryUsers.length];
                            if (!userTaskRoles[uJob3.id]) userTaskRoles[uJob3.id] = {};
                            if (!userTaskRoles[uJob3.id][web]) userTaskRoles[uJob3.id][web] = {};
                            userTaskRoles[uJob3.id][web][tIdx] = 'job';
                        }
                        
                        if (primaryUsers.length > 3) {
                            for (let i = 3; i < primaryUsers.length; i++) {
                                let uSup = primaryUsers[(tIdx + i) % primaryUsers.length];
                                if (!userTaskRoles[uSup.id]) userTaskRoles[uSup.id] = {};
                                if (!userTaskRoles[uSup.id][web]) userTaskRoles[uSup.id][web] = {};
                                userTaskRoles[uSup.id][web][tIdx] = 'sup';
                            }
                        }
                    }
                });
            } else {
                // 🌟 เว็บปกติอื่นๆ: ดักจับและ "แบน" หัวข้อที่ไม่ตรงกะทิ้งไปเลย
                let allowedTaskIndices = [];
                webTasks.forEach((task, i) => {
                    if (shiftFilter === 'กะเช้า' && task === 'แนะนำเพื่อน') return; 
                    if (shiftFilter === 'กะดึก' && task === 'คำขอโปร') return; 
                    allowedTaskIndices.push(i);
                });

                // เรียงลำดับความสำคัญของหัวข้อที่รอดจากการแบน
                allowedTaskIndices.sort((a, b) => {
                    let taskA = webTasks[a];
                    let taskB = webTasks[b];
                    const getScore = (task) => {
                        if (task === 'ถอนเงิน') return 100;
                        if (shiftFilter === 'กะเช้า' && task === 'คำขอโปร') return 90;
                        if (shiftFilter === 'กะดึก' && task === 'แนะนำเพื่อน') return 90;
                        if (task === 'ตรวจถอนเงิน') return 80;
                        if (task === 'คำขอโปร') return 70;
                        if (task === 'แนะนำเพื่อน') return 60;
                        return 50;
                    };
                    return getScore(taskB) - getScore(taskA);
                });

                if (allowedTaskIndices.length > 0) {
                    primaryUsers.forEach((u, pIdx) => {
                        let tIdx = allowedTaskIndices[pIdx % allowedTaskIndices.length];
                        if (!userTaskRoles[u.id]) userTaskRoles[u.id] = {};
                        if (!userTaskRoles[u.id][web]) userTaskRoles[u.id][web] = {};
                        userTaskRoles[u.id][web][tIdx] = 'job';
                    });
                }
            }
        }
    });

    for (const pWeb in rosterData) {
        let standbyUsers = (rosterData[pWeb] || []).filter(u => u.secondary_team && matrixWebsites.includes(u.secondary_team) && !u.username.includes('ขาดคน'));
        standbyUsers.sort((a,b) => a.username.localeCompare(b.username));

        standbyUsers.forEach((u, idx) => {
            let sWeb = u.secondary_team;
            if (!userTaskRoles[u.id]) userTaskRoles[u.id] = {};
            if (!userTaskRoles[u.id][sWeb]) userTaskRoles[u.id][sWeb] = {};
            
            let sWebTasks = customDutyRoles[sWeb] || customDutyRoles[(sWeb === 'VV72' ? 'Vv72' : sWeb)] || ['ไม่มีหัวข้อ'];
            if(sWebTasks.length === 0) sWebTasks = ['-'];
            
            let sTaskIndex = (idx + 1) % sWebTasks.length;
            for (let offset = 0; offset < sWebTasks.length; offset++) {
                let currentTry = (sTaskIndex + offset) % sWebTasks.length;
                if (!userTaskRoles[u.id][sWeb][currentTry]) {
                    userTaskRoles[u.id][sWeb][currentTry] = 'sup';
                    break;
                }
            }
        });
    }

    let html = `
        <style>
            .od-divider { border-right: 3px solid #64748b !important; }
            .dark .od-divider, html.dark .od-divider { border-right: 3px solid #000000 !important; }
        </style>
        <div class="w-full min-w-max border border-slate-600 shadow-sm rounded-lg overflow-hidden">
        <table class="w-full text-center border-collapse whitespace-nowrap dark:text-white">`; 
    
    html += `<thead class="bg-slate-200 dark:bg-slate-900 border-b border-slate-400 dark:border-slate-700"><tr>`;
    html += `<th rowspan="2" class="border border-slate-300 dark:border-slate-700 p-3 w-[1%] whitespace-nowrap text-base">กะ</th>`;
    html += `<th rowspan="2" class="border border-slate-300 dark:border-slate-700 p-3 w-[180px] min-w-[180px] whitespace-nowrap text-[15px] od-divider">รายชื่อผู้ดูแล</th>`;
    
    matrixWebsites.forEach(web => {
        let webTasks = customDutyRoles[web] || customDutyRoles[(web === 'VV72' ? 'Vv72' : web)] || ['ไม่มีหัวข้อ'];
        if (webTasks.length === 0) webTasks = ['-'];

        let bgColor = webColors[web] || 'bg-slate-700 text-white';
        html += `<th colspan="${webTasks.length}" class="border border-slate-300 dark:border-slate-700 p-2 font-black text-base tracking-wide od-divider ${bgColor}">${web}</th>`;
    });
    html += `</tr><tr>`;
    
    matrixWebsites.forEach(web => {
        let webTasks = customDutyRoles[web] || customDutyRoles[(web === 'VV72' ? 'Vv72' : web)] || ['ไม่มีหัวข้อ'];
        if (webTasks.length === 0) webTasks = ['-'];
        
        webTasks.forEach((task, tIdx) => {
            let dividerClass = (tIdx === webTasks.length - 1) ? 'od-divider' : '';
            html += `<th class="border border-slate-300 dark:border-slate-700 p-2.5 text-[13px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-gray-300 min-w-[100px] max-w-[130px] truncate ${dividerClass}" title="${task}">${task}</th>`;
        });
    });
    html += `</tr></thead><tbody>`;

    const shiftGroups = {};
    staffList.forEach(u => {
        const s = u.allowed_shift || 'all';
        if (!shiftGroups[s]) shiftGroups[s] = [];
        shiftGroups[s].push(u);
    });

    const shiftOrder = ['กะเช้า', 'กะกลาง', 'กะดึก', 'all'];
    const sortedShifts = Object.keys(shiftGroups).sort((a, b) => {
        let ia = shiftOrder.indexOf(a); if(ia === -1) ia = 99;
        let ib = shiftOrder.indexOf(b); if(ib === -1) ib = 99;
        return ia - ib;
    });

    sortedShifts.forEach(shift => {
        const shiftStaff = shiftGroups[shift];
        if (shiftStaff.length === 0) return;

        let shiftNameDisplay = shift.replace('กะ', '');
        if (shift === 'all') shiftNameDisplay = 'อิสระ';

        let shiftColor = 'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-200';
        if (shift === 'กะดึก') shiftColor = 'bg-purple-200 text-purple-900 dark:bg-purple-900 dark:text-purple-200';
        else if (shift === 'กะเช้า') shiftColor = 'bg-orange-200 text-orange-900 dark:bg-orange-900 dark:text-orange-200';
        else if (shift === 'กะกลาง') shiftColor = 'bg-blue-200 text-blue-900 dark:bg-blue-900 dark:text-blue-200';
        else if (shift === 'all') shiftColor = 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200';

        shiftStaff.forEach((user, index) => {
            let isLeave = leaveIds.has(String(user.id));
            let rowOpacity = isLeave ? 'opacity-60 bg-red-50/50 dark:bg-red-900/20' : 'hover:bg-slate-100 dark:hover:bg-slate-800/50';
            
            html += `<tr class="${rowOpacity} transition border-b border-slate-200 dark:border-slate-700">`;
            
            if (index === 0) {
                html += `<td rowspan="${shiftStaff.length}" class="border border-slate-300 dark:border-slate-700 font-black text-[15px] ${shiftColor}">${shiftNameDisplay}</td>`;
            }
            
            let nameColor = isLeave ? 'text-red-500' : 'text-green-600 dark:text-green-400';
            let leaveTag = isLeave ? '<span class="text-[11px] bg-red-500 text-white px-1.5 py-0.5 rounded shadow-sm ml-1">ลาหยุด</span>' : '';
            
            html += `<td class="border border-slate-300 dark:border-slate-700 p-3 text-left font-bold ${nameColor} pl-3 text-[15px] od-divider">
                <div class="flex items-center">
                    <span class="uppercase">${user.username}</span> ${leaveTag}
                </div>
            </td>`;
            
            matrixWebsites.forEach(web => {
                let webTasks = customDutyRoles[web] || customDutyRoles[(web === 'VV72' ? 'Vv72' : web)] || ['ไม่มีหัวข้อ'];
                if (webTasks.length === 0) webTasks = ['-'];
                
                webTasks.forEach((task, tIdx) => {
                    let dividerClass = (tIdx === webTasks.length - 1) ? 'od-divider' : '';

                    if (task === '-') {
                        html += `<td class="border border-slate-300 dark:border-slate-700 p-2 bg-gray-100 dark:bg-slate-800/50 ${dividerClass}"></td>`;
                    } else {
                        let role = 'not';
                        if (isLeave) {
                            role = 'off';
                        } else if (userTaskRoles[user.id] && userTaskRoles[user.id][web] && userTaskRoles[user.id][web][tIdx]) {
                            role = userTaskRoles[user.id][web][tIdx];
                        }

                        // 🌟 [แก้บัค Realtime ผู้สอน] ใช้ค่าที่บันทึกใน DB ทับค่าจาก algorithm สุ่ม
                        const overrideKey = `${user.id}_${web}_${tIdx}`;
                        if (savedRoleOverrides[overrideKey] !== undefined) {
                            role = savedRoleOverrides[overrideKey];
                        }

                        let selNot = role === 'not' ? 'selected' : '';
                        let selJob = role === 'job' ? 'selected' : '';
                        let selSup = role === 'sup' ? 'selected' : '';
                        let selOff = role === 'off' ? 'selected' : '';

                        let selectClass = `text-[13px] p-1.5 rounded outline-none ${cursorClass} border font-bold focus:ring-2 focus:ring-blue-500 w-full min-w-[90px] text-center shadow-sm transition `;
                        if (role === 'job') selectClass += "bg-green-50 dark:bg-green-900/30 text-green-600 border-green-300 dark:border-green-700";
                        else if (role === 'sup') selectClass += "bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 border-yellow-300 dark:border-yellow-700";
                        else if (role === 'off') selectClass += "bg-gray-100 dark:bg-slate-800 text-gray-500 border-gray-300 dark:border-slate-600";
                        else selectClass += "bg-white dark:bg-slate-800 text-gray-500 border-gray-300 dark:border-slate-600";

                        // 🌟 [แก้บัค Realtime ผู้สอน] เมื่อ user เปลี่ยน → บันทึกลง DB ทันที + broadcast
                        let onChangeAttr = canEdit ? `onchange="window.saveTrainerMatrixRole('${user.id}', '${web}', ${tIdx}, this.value); this.className = this.options[this.selectedIndex].className + ' text-[13px] p-1.5 rounded outline-none ${cursorClass} border font-bold focus:ring-2 focus:ring-blue-500 w-full min-w-[90px] text-center shadow-sm transition'"` : '';

                        html += `<td class="border border-slate-300 dark:border-slate-700 p-1.5 ${dividerClass}">
                            <select class="${selectClass}" ${disableAttr} ${onChangeAttr}>
                                <option value="not" class="bg-white dark:bg-slate-800 text-gray-500" ${selNot}>🚫 Not</option>
                                <option value="job" class="bg-green-50 dark:bg-green-900/30 text-green-600" ${selJob}>✅ Job</option>
                                <option value="sup" class="bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600" ${selSup}>👉 Sup</option>
                                <option value="off" class="bg-gray-100 dark:bg-slate-800 text-gray-500" ${selOff}>⛔ OFF</option>
                            </select>
                        </td>`;
                    }
                });
            });
            html += `</tr>`;
        });
    });

    html += `</tbody></table></div>`;
    matrixGrid.innerHTML = html;
};

// 🌟 [แก้บัค Realtime ผู้สอน] บันทึกการเปลี่ยน role ของช่องใดช่องหนึ่งลง DB + broadcast
// เรียกจาก onchange ของ <select> แต่ละช่อง — บันทึกแบบ incremental ไม่ต้องส่งทั้งตาราง
window.saveTrainerMatrixRole = async function(userId, web, taskIdx, newRole) {
    try {
        const targetDate = document.getElementById('dutyDate') ? document.getElementById('dutyDate').value : '';
        const shiftFilter = document.getElementById('dutyShiftSelect') ? document.getElementById('dutyShiftSelect').value : 'all';
        if (!targetDate) {
            Swal.fire('!', 'กรุณาเลือกวันที่ก่อน', 'warning');
            return;
        }

        const matrixRoleKey = window.getTrainerMatrixRoleKey(currentDutyDept, targetDate, shiftFilter);
        const overrideKey = `${userId}_${web}_${taskIdx}`;

        // โหลดค่าเก่าก่อน (เพื่อ merge ไม่ใช่ทับ)
        let current = {};
        try {
            const { data } = await appDB.from('settings').select('value').eq('key', matrixRoleKey).maybeSingle();
            if (data && data.value) current = JSON.parse(data.value);
        } catch(e) {}

        current[overrideKey] = newRole;

        const { error } = await appDB.from('settings').upsert([{ key: matrixRoleKey, value: JSON.stringify(current) }]);
        if (error) {
            Swal.fire('Error', 'บันทึกไม่สำเร็จ: ' + error.message, 'error');
            return;
        }

        // log
        try {
            const user = (window.GLOBAL_USER_LIST || []).find(u => String(u.id) === String(userId));
            const userName = user ? user.username : userId;
            await appDB.from('system_logs').insert([{
                action_type: 'จัดหน้าที่',
                performed_by: currentUser.username,
                target_details: `เปลี่ยน role ของ ${userName} ที่ [${web}] หัวข้อ #${taskIdx} → ${newRole} (${currentDutyDept}, ${shiftFilter}, ${targetDate})`
            }]);
        } catch(e) {}

        // broadcast ให้เครื่องอื่นรู้
        try { appDB.channel('duty-updates').send({ type: 'broadcast', event: 'force_reload' }); } catch(e) {}
    } catch (err) {
        console.error('saveTrainerMatrixRole error:', err);
        Swal.fire('Error', err.message, 'error');
    }
};

// ==========================================
// 🌟 ระบบหน้าที่สำคัญ / พิเศษ (แสดงผลซ้ายมือ)
// ==========================================

window.ensureImportantTasksContainer = function() {
    let container = document.getElementById('importantTasksPanel');
    if (!container) {
        const resultGrid = document.getElementById('dutyResultGrid');
        const matrixGrid = document.getElementById('dutyMatrixGrid');
        const gridParent = resultGrid.parentElement;
        
        if (gridParent.id === 'dutyRosterWrapper') return;

        const wrapper = document.createElement('div');
        wrapper.id = 'dutyRosterWrapper';
        wrapper.className = 'flex flex-col xl:flex-row gap-5 w-full items-start';
        
        const leftPanel = document.createElement('div');
        leftPanel.id = 'importantTasksPanel';
        leftPanel.className = 'w-full xl:w-[340px] shrink-0 hidden transition-all';
        
        const rightPanel = document.createElement('div');
        rightPanel.id = 'mainRosterPanel';
        rightPanel.className = 'flex-1 min-w-0 w-full';
        
        gridParent.insertBefore(wrapper, resultGrid);
        rightPanel.appendChild(resultGrid);
        if(matrixGrid) rightPanel.appendChild(matrixGrid);
        
        wrapper.appendChild(leftPanel);
        wrapper.appendChild(rightPanel);
    }
};

window.renderImportantTasksPanel = function() {
    const panel = document.getElementById('importantTasksPanel');
    if (!panel) return;
    
    const isTrainerDept = (currentDutyDept === 'AMQL' || currentDutyDept === 'ODQL' || currentDutyDept.startsWith('TRAINER'));
    if (!isTrainerDept) { panel.classList.add('hidden'); return; }
    
    panel.classList.remove('hidden');
    const isAdmin = window.isDutyAdmin();
    
    let html = `
        <div class="bg-[#151f32] border border-slate-700/80 rounded-2xl shadow-lg flex flex-col max-h-[750px] overflow-hidden">
            <div class="bg-gradient-to-r from-amber-600 to-yellow-500 text-white p-3 flex justify-between items-center shadow-md shrink-0">
                <div class="flex items-center gap-2">
                    <span class="material-icons">star</span>
                    <h4 class="font-black text-sm tracking-wide">หน้าที่ประจำ / พิเศษ</h4>
                </div>
                <div class="flex gap-1">
                    ${isAdmin ? `<button onclick="window.randomizeImportantTasks()" class="bg-indigo-600 hover:bg-indigo-500 px-2 py-1 rounded text-[10px] font-bold shadow-inner transition flex items-center gap-1 border border-indigo-400 active:scale-95"><span class="material-icons text-[12px]">casino</span> สุ่มลงงาน</button>` : ''}
                    ${isAdmin ? `<button onclick="window.addImportantTask()" class="bg-black/20 hover:bg-black/30 px-2 py-1 rounded text-[10px] font-bold shadow-inner transition flex items-center gap-1 border border-white/20 active:scale-95"><span class="material-icons text-[12px]">add</span> เพิ่ม</button>` : ''}
                </div>
            </div>
            <div class="p-3 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3">
    `;
    
    // 🌟 ดึงงานทั้งหมดมาโชว์ (ทั้งงานในปัจจุบัน และงานเก่าในอดีตที่เคยมีคนทำ)
    const allTasksToShow = [...new Set([...window.globalImportantTasks, ...Object.keys(window.currentImportantAssigns)])];
    
    if (allTasksToShow.length === 0) {
        html += `<div class="text-center py-10 text-gray-500 text-xs font-bold border border-dashed border-slate-700 rounded-xl bg-slate-900/50">แอดมินยังไม่ได้ตั้งค่างานพิเศษ</div>`;
    } else {
        allTasksToShow.forEach(task => {
            const assignedUser = window.currentImportantAssigns[task];
            const isLegacy = !window.globalImportantTasks.includes(task); // เช็คว่าเป็นงานที่ถูกลบไปแล้วรึเปล่า
            
            let statusHtml = '';
            let boxClass = '';
            
            if (assignedUser) {
                // 🌟 แก้ไข: ใช้การเช็ค Key ของ Object แทน .includes() เพื่อแก้บั๊ก
                const isLocked = !!(window.lockedImportantTasks && window.lockedImportantTasks[task]); 
                boxClass = isLocked ? 'border-amber-500/50 bg-amber-900/10 hover:border-amber-400' : 'border-emerald-500/30 bg-emerald-900/10 hover:border-emerald-400';
                const lockIcon = isLocked ? 'lock' : 'lock_open';
                const lockColor = isLocked ? 'text-amber-500' : 'text-gray-400 hover:text-slate-700 dark:hover:text-white';
                
                statusHtml = `
                    <div class="mt-2.5 flex items-center justify-between ${isLocked ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800/50' : 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800/50'} px-2.5 py-1.5 rounded-lg border shadow-inner transition-colors">
                        <div class="flex items-center gap-1.5 ${isLocked ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'} font-extrabold text-[12px]">
                            <span class="material-icons text-[16px]">${isLocked ? 'badge' : 'person_check'}</span> ${assignedUser}
                            ${isLocked ? '<span class="text-[9px] bg-amber-200 dark:bg-amber-800/50 text-amber-800 dark:text-amber-300 px-1 rounded ml-1">หน้าที่ประจำ</span>' : ''}
                        </div>
                        ${(isAdmin && !isLegacy) ? `
                        <div class="flex gap-1">
                            <button onclick="window.toggleLockImportantTask('${task}')" class="${lockColor} bg-white dark:bg-slate-800 rounded px-1.5 py-0.5 shadow-sm border border-gray-200 dark:border-slate-700 transition hover:bg-slate-50 dark:hover:bg-slate-700" title="ตั้ง/ยกเลิก เป็นหน้าที่ประจำ"><span class="material-icons text-[14px] block">${lockIcon}</span></button>
                            <button onclick="window.unassignImportantTask('${task}')" class="text-red-400 hover:text-red-500 bg-white dark:bg-slate-800 rounded px-1.5 py-0.5 shadow-sm border border-red-200 dark:border-red-900/50 transition hover:bg-red-50" title="ปลดคนนี้ออก"><span class="material-icons text-[14px] block">close</span></button>
                        </div>
                        ` : ''}
                    </div>
                `;
            } else {
                boxClass = 'border-red-500/50 bg-red-900/10 hover:border-red-400';
                statusHtml = `
                    <div class="mt-2.5 flex items-center justify-between bg-red-50 dark:bg-red-900/30 px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-800/50 animate-pulse shadow-inner">
                        <div class="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-extrabold text-[12px]">
                            <span class="material-icons text-[16px]">warning</span> ยังไม่มีคนดูแล
                        </div>
                        ${(isAdmin && !isLegacy) ? `<button onclick="window.assignImportantTask('${task}')" class="bg-red-600 hover:bg-red-500 text-white px-2.5 py-1 rounded text-[10px] font-bold shadow-md transition border border-red-500 active:scale-95">เลือกคน</button>` : ''}
                    </div>
                `;
            }
            
            html += `
                <div class="p-3 rounded-xl border transition shadow-sm group bg-slate-800 ${boxClass}">
                    <div class="flex justify-between items-start gap-2">
                        <div class="font-bold text-sm text-slate-200 leading-tight flex-1">
                            ${task}
                            ${isLegacy ? '<span class="text-[9px] text-gray-500 ml-1 font-normal">(งานนี้ถูกลบแล้ว)</span>' : ''}
                        </div>
                        ${(isAdmin && !isLegacy) ? `<button onclick="window.deleteImportantTask('${task}')" class="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition bg-slate-900 rounded p-1.5 shadow-inner border border-slate-700" title="ลบงานนี้ทิ้งถาวร"><span class="material-icons text-[14px] block">delete</span></button>` : ''}
                    </div>
                    ${statusHtml}
                </div>
            `;
        });
    }
    html += `</div></div>`;
    panel.innerHTML = html;
};

window.toggleLockImportantTask = async function(taskName) {
    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    const impLockKey = `duty_important_permanent_lock_${currentDutyDept}_${shiftFilter}`;

    if (Array.isArray(window.lockedImportantTasks)) window.lockedImportantTasks = {};

    if (window.lockedImportantTasks && window.lockedImportantTasks[taskName]) {
        delete window.lockedImportantTasks[taskName];
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'ปลดจากหน้าที่ประจำแล้ว', showConfirmButton: false, timer: 1500 });
    } else {
        const currentUser = window.currentImportantAssigns[taskName];
        if (!currentUser) return Swal.fire('เตือน', 'กรุณาเลือกคนก่อน ถึงจะตั้งเป็นหน้าที่ประจำได้ครับ', 'warning');
        window.lockedImportantTasks[taskName] = currentUser;
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'ตั้งเป็นหน้าที่ประจำสำเร็จ!', showConfirmButton: false, timer: 1500 });
    }
    
    await appDB.from('settings').upsert([{ key: impLockKey, value: JSON.stringify(window.lockedImportantTasks) }]);
    window.renderImportantTasksPanel();
};

window.randomizeImportantTasks = async function() {
    if (window.globalImportantTasks.length === 0) return Swal.fire('ไม่มีงาน', 'กรุณาเพิ่มหน้าที่สำคัญก่อนทำการสุ่มครับ', 'warning');
    
    const targetDate = document.getElementById('dutyDate').value;
    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    
    let availableStaff = GLOBAL_USER_LIST.filter(u => {
        let uDept = u.department || 'AM';
        if (uDept === 'TRAINER') uDept = 'AMQL';
        const isCorrectDept = uDept === currentDutyDept;
        const isShiftMatch = (u.allowed_shift === shiftFilter || u.allowed_shift === 'all');
        return isCorrectDept && isShiftMatch && !currentDutyLeaves.has(String(u.id));
    }).map(u => u.username);
    
    if (availableStaff.length === 0) return Swal.fire('ไม่มีพนักงาน', 'ไม่พบรายชื่อผู้สอนในกะนี้ครับ', 'error');

    const assignedStaff = Object.values(window.currentImportantAssigns);
    availableStaff = availableStaff.filter(name => !assignedStaff.includes(name));
    
    availableStaff = availableStaff.sort(() => Math.random() - 0.5);
    
    let staffIndex = 0;
    let assignedCount = 0;
    
    window.globalImportantTasks.forEach(task => {
        if (!window.currentImportantAssigns[task]) { 
            if (staffIndex < availableStaff.length) {
                window.currentImportantAssigns[task] = availableStaff[staffIndex];
                staffIndex++;
                assignedCount++;
            }
        }
    });
    
    Swal.fire({title: 'กำลังสุ่มและจัดเรียงงาน...', didOpen: () => Swal.showLoading()});
    
    const impAssignKey = `duty_important_assign_${currentDutyDept}_${targetDate}_${shiftFilter}`;
    await appDB.from('settings').upsert([{ key: impAssignKey, value: JSON.stringify(window.currentImportantAssigns) }]);
    
    window.renderImportantTasksPanel();
    Swal.close();
    appDB.channel('duty-updates').send({ type: 'broadcast', event: 'force_reload' });
    
    if (assignedCount > 0) {
        Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 }).fire({ icon: 'success', title: `สุ่มสำเร็จ ${assignedCount} หน้าที่` });
    } else {
        Swal.fire('เตือน', 'ไม่มีหน้าที่ว่าง หรือไม่มีพนักงานเหลือให้สุ่มแล้วครับ', 'info');
    }
};

window.addImportantTask = async function() {
    const { value: taskName } = await Swal.fire({
        title: 'เพิ่มหน้าที่สำคัญ / พิเศษ',
        input: 'text',
        inputPlaceholder: 'เช่น ดูแลระบบฝากถอน, เช็คแชท VIP...',
        showCancelButton: true,
        confirmButtonText: 'บันทึก',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#f59e0b',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl' }
    });
    
    if (taskName) {
        const name = taskName.trim();
        if (window.globalImportantTasks.includes(name)) return Swal.fire('เตือน', 'มีหน้าที่นี้อยู่ในระบบแล้วครับ', 'warning');
        
        const shiftFilter = document.getElementById('dutyShiftSelect').value;
        window.globalImportantTasks.push(name);
        Swal.fire({title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading()});
        
        const impListKey = `duty_important_tasks_list_${currentDutyDept}_${shiftFilter}`;
        await appDB.from('settings').upsert([{ key: impListKey, value: JSON.stringify(window.globalImportantTasks) }]);
        
        window.renderImportantTasksPanel();
        Swal.close();
    }
};

window.deleteImportantTask = async function(taskName) {
    const res = await Swal.fire({
        title: 'ลบหน้าที่นี้?',
        text: `ต้องการลบ "${taskName}" ออกจากรายการงานพิเศษใช่หรือไม่? (ลบทิ้งถาวร)`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'ลบทิ้งเลย',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl' }
    });
    
    if (res.isConfirmed) {
        window.globalImportantTasks = window.globalImportantTasks.filter(t => t !== taskName);
        delete window.currentImportantAssigns[taskName]; 
        if (window.lockedImportantTasks) delete window.lockedImportantTasks[taskName]; 
        
        Swal.fire({title: 'กำลังลบ...', didOpen: () => Swal.showLoading()});
        const targetDate = document.getElementById('dutyDate').value;
        const shiftFilter = document.getElementById('dutyShiftSelect').value;
        
        const listKey = `duty_important_tasks_list_${currentDutyDept}_${shiftFilter}`;
        const assignKey = `duty_important_assign_${currentDutyDept}_${targetDate}_${shiftFilter}`;
        const lockKey = `duty_important_permanent_lock_${currentDutyDept}_${shiftFilter}`;
        
        await appDB.from('settings').upsert([
            { key: listKey, value: JSON.stringify(window.globalImportantTasks) },
            { key: assignKey, value: JSON.stringify(window.currentImportantAssigns) },
            { key: lockKey, value: JSON.stringify(window.lockedImportantTasks) }
        ]);
        window.renderImportantTasksPanel();
        Swal.close();
    }
};

window.assignImportantTask = async function(taskName) {
    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    const activeStaff = GLOBAL_USER_LIST.filter(u => {
        let uDept = u.department || 'AM';
        if (uDept === 'TRAINER') uDept = 'AMQL';
        const isCorrectDept = uDept === currentDutyDept;
        const isShiftMatch = (u.allowed_shift === shiftFilter || u.allowed_shift === 'all');
        return isCorrectDept && isShiftMatch && !currentDutyLeaves.has(String(u.id));
    });
    
    if (activeStaff.length === 0) return Swal.fire('ไม่มีรายชื่อ', 'ไม่มีผู้สอนที่พร้อมทำงานในกะนี้เลยครับ', 'error');
    
    let options = {};
    activeStaff.sort((a,b) => a.username.localeCompare(b.username)).forEach(u => options[u.username] = u.username);
    
    const { value: selectedUser } = await Swal.fire({
        title: `<div class="text-sm text-gray-400 mb-1">มอบหมายงาน:</div><div class="text-amber-500 font-black">${taskName}</div>`,
        input: 'select',
        inputOptions: options,
        inputPlaceholder: '-- เลือกผู้รับผิดชอบงานนี้ --',
        showCancelButton: true,
        confirmButtonText: 'มอบหมาย',
        confirmButtonColor: '#10b981',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl' }
    });
    
    if (selectedUser) {
        const prevAssignee = window.currentImportantAssigns[taskName] || null;
        window.currentImportantAssigns[taskName] = selectedUser;
        Swal.fire({title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading()});

        const targetDate = document.getElementById('dutyDate').value;
        const impAssignKey = `duty_important_assign_${currentDutyDept}_${targetDate}_${shiftFilter}`;

        await appDB.from('settings').upsert([{ key: impAssignKey, value: JSON.stringify(window.currentImportantAssigns) }]);

        // 🟢 บันทึก log การมอบหมายงานสำคัญ
        const logDetail = prevAssignee && prevAssignee !== selectedUser
            ? `เปลี่ยนผู้รับผิดชอบงาน "${taskName}": ${prevAssignee} → ${selectedUser}`
            : `มอบหมายงาน "${taskName}" ให้ ${selectedUser}`;
        await appDB.from('system_logs').insert([{
            action_type: 'ย้ายหน้าที่',
            performed_by: currentUser.username,
            target_details: `${logDetail} (กะ: ${shiftFilter}, วันที่: ${targetDate})`
        }]);

        window.renderImportantTasksPanel();
        Swal.close();
        appDB.channel('duty-updates').send({ type: 'broadcast', event: 'force_reload' });
    }
};

window.unassignImportantTask = async function(taskName) {
    const prevAssignee = window.currentImportantAssigns[taskName] || null;
    delete window.currentImportantAssigns[taskName];

    const targetDate = document.getElementById('dutyDate').value;
    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    const impAssignKey = `duty_important_assign_${currentDutyDept}_${targetDate}_${shiftFilter}`;
    const impLockKey = `duty_important_permanent_lock_${currentDutyDept}_${shiftFilter}`;

    let keysToUpdate = [ { key: impAssignKey, value: JSON.stringify(window.currentImportantAssigns) } ];

    if (window.lockedImportantTasks && window.lockedImportantTasks[taskName]) {
        delete window.lockedImportantTasks[taskName];
        keysToUpdate.push({ key: impLockKey, value: JSON.stringify(window.lockedImportantTasks) });
    }

    Swal.fire({title: 'กำลังปลดคน...', didOpen: () => Swal.showLoading()});
    await appDB.from('settings').upsert(keysToUpdate);

    // 🟢 บันทึก log การปลดคนออกจากงานสำคัญ
    if (prevAssignee) {
        await appDB.from('system_logs').insert([{
            action_type: 'ย้ายหน้าที่',
            performed_by: currentUser.username,
            target_details: `ปลด ${prevAssignee} ออกจากงาน "${taskName}" (กะ: ${shiftFilter}, วันที่: ${targetDate})`
        }]);
    }

    window.renderImportantTasksPanel();
    Swal.close();
    appDB.channel('duty-updates').send({ type: 'broadcast', event: 'force_reload' });
};

// ==========================================
// 🌟 ฟังก์ชันล้างเฉพาะงานรอง (ไม่แตะงานหลัก)
// ใช้กับปุ่ม "ล้างงานรอง" บนแถบเครื่องมือ
// ==========================================
window.clearSecondaryDuties = async function() {
    const targetDate = document.getElementById('dutyDate').value;
    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    if (!targetDate) return Swal.fire('!', 'กรุณาเลือกวันที่ก่อน', 'warning');

    const saveKey = typeof getDutySaveKey === 'function'
        ? getDutySaveKey(targetDate, shiftFilter)
        : `duty_roster_${currentDutyDept}_${targetDate}_${shiftFilter}`;

    let currentDataVal = null;
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', saveKey);
        if (data && data.length > 0) currentDataVal = data[0].value;
    } catch(e) {}

    if (!currentDataVal) {
        return Swal.fire('ไม่มีตาราง', 'ยังไม่มีตารางงานในวัน/กะนี้ ไม่มีอะไรให้ล้างครับ', 'info');
    }

    let roster;
    try {
        roster = JSON.parse(currentDataVal);
    } catch(e) {
        return Swal.fire('Error', 'อ่านข้อมูลตารางไม่สำเร็จ', 'error');
    }

    // นับจำนวนคนที่มีงานรองอยู่ตอนนี้
    let countHasSecondary = 0;
    for (const team in roster) {
        (roster[team] || []).forEach(u => {
            if (u && u.secondary_team && !u.username.includes('ขาดคน')) countHasSecondary++;
        });
    }

    if (countHasSecondary === 0) {
        return Swal.fire('ไม่มีงานรอง', 'ยังไม่มีใครได้รับงานรองในวัน/กะนี้ครับ', 'info');
    }

    const confirmRes = await Swal.fire({
        title: 'ยืนยันล้างเฉพาะงานรอง?',
        html: `จะปลดงานรอง (สแตนด์บาย) ของพนักงาน <b class="text-cyan-600">${countHasSecondary} คน</b><br>วันที่ <b>${targetDate}</b> (${shiftFilter})<br><span class="text-[12px] text-gray-500 italic">⚠️ งานหลักจะไม่กระทบ</span>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#0ea5e9',
        cancelButtonColor: '#64748b',
        cancelButtonText: 'ยกเลิก',
        confirmButtonText: 'ล้างงานรองเลย',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white' }
    });

    if (!confirmRes.isConfirmed) return;

    Swal.fire({title: 'กำลังล้างงานรอง...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});

    try {
        // ล้าง secondary_team ของทุกคน (ไม่ยุ่งกับ field อื่น)
        let cleared = 0;
        for (const team in roster) {
            (roster[team] || []).forEach(u => {
                if (u && u.secondary_team) {
                    u.secondary_team = null;
                    cleared++;
                }
            });
        }

        // บันทึกกลับ DB
        await appDB.from('settings').upsert([{ key: saveKey, value: JSON.stringify(roster) }]);

        // เขียน log
        try {
            await appDB.from('system_logs').insert([{
                action_type: 'ล้างงานรอง',
                performed_by: currentUser.username,
                target_details: `ล้างงานรอง (${currentDutyDept}, ${shiftFilter}, ${targetDate}) → ปลดสแตนด์บาย ${cleared} คน`
            }]);
        } catch(e) {}

        // แจ้ง client อื่นให้รีโหลด
        try {
            if (appDB.channel) appDB.channel('duty-updates').send({ type: 'broadcast', event: 'force_reload' });
        } catch(e) {}

        // วาดใหม่
        if (typeof window.renderRosterGrid === 'function') {
            window.renderRosterGrid(roster);
        } else if (typeof window.refreshDutyData === 'function') {
            window.refreshDutyData();
        }

        Swal.fire({
            icon: 'success',
            title: 'ล้างงานรองเรียบร้อย',
            text: `ปลดงานรองออกแล้ว ${cleared} คน`,
            timer: 1500,
            showConfirmButton: false
        });
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
};

// ==========================================
// 🌟 ระบบแจกงานรองด่วน (AI จับคู่ 1 ต่อ 1) — V2: 2-Pass System
// Pass 1: เข้มงวด (เวลาพักไม่ชน)
// Pass 2: ผ่อนเงื่อนไขเวลาพัก (เก็บตกคนที่ตกหล่น)
// ==========================================
window.quickAssignBackups = async function() {
    const targetDate = document.getElementById('dutyDate').value;
    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    if (!targetDate) return Swal.fire('เตือน', 'กรุณาเลือกวันที่ก่อน', 'warning');

    const saveKey = typeof getDutySaveKey === 'function' ? getDutySaveKey(targetDate, shiftFilter) : `duty_roster_${currentDutyDept}_${targetDate}_${shiftFilter}`;
    let currentDataVal = null;
    
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', saveKey);
        if (data && data.length > 0) currentDataVal = data[0].value;
    } catch(e) {}

    if (!currentDataVal) return Swal.fire('เตือน', 'คุณต้องกด "สุ่มจัดหน้าที่" (สำหรับตำแหน่งหลัก) ให้เสร็จก่อนครับ', 'warning');

    let roster = JSON.parse(currentDataVal);

    Swal.fire({
        title: 'กำลังจับคู่งานรอง...', 
        html: '<span class="text-sm text-gray-500">🌱 Phase 1: เติมเว็บที่ยังไม่มีรองให้ครบก่อน...</span>', 
        allowOutsideClick: false, 
        didOpen: () => Swal.showLoading()
    });

    // 1. ดึงข้อมูลเวลาพักของทุกคนจากตารางเวลา
    let breakTimes = {};
    if (window.currentDutySchedules) {
        window.currentDutySchedules.forEach(s => {
            if (!breakTimes[s.staff_name]) breakTimes[s.staff_name] = [];
            breakTimes[s.staff_name].push(s.time_slot);
        });
    }

    // 2. หาคนที่มี "งานหลัก" แล้ว และยังไม่มี "งานรอง" มาเป็นตัวเลือก
    let availableForBackup = [];
    for (const team in roster) {
        roster[team].forEach(u => {
            if (!u.username.includes('ขาดคน') && !u.secondary_team) {
                availableForBackup.push({ ...u, primaryTeam: team });
            }
        });
    }

    // 🌟 V5 — 2 Phase System (เน้นกระจายให้ครบทุกเว็บก่อน)
    //
    // Phase 1: บังคับให้ทุกเว็บได้รองอย่างน้อย 1 คน (เดิน "ทีม" ไปหา "คน")
    //   - 1a: เช็คเวลาพัก + เช็คสิทธิ์
    //   - 1b: ผ่อนเวลาพัก + เช็คสิทธิ์
    // Phase 2: คนที่เหลือกระจายเข้าเว็บรองน้อยสุด (เดิน "คน" ไปหา "ทีม")
    //   - 2a: เช็คเวลาพัก + เช็คสิทธิ์
    //   - 2b: ผ่อนเวลาพัก + เช็คสิทธิ์

    // ฟังก์ชันช่วย: ดูว่าทีมนี้มีรองกี่คนแล้ว
    const countBackupsForTeam = (team) => {
        let n = 0;
        for (const t in roster) {
            roster[t].forEach(u => { if (u.secondary_team === team) n++; });
        }
        return n;
    };

    // 🟢 Phase 1: ให้ทุกเว็บได้รองอย่างน้อย 1 คน
    // mode = 'strict' หรือ 'relaxBreak'
    const phase1FillEmptyTeams = (mode) => {
        let count = 0;

        // หาเฉพาะเว็บที่ "มี primary แต่ยังไม่มีรองเลย"
        const emptyTeams = sortedTeams.filter(t => {
            const primaries = (roster[t] || []).filter(u => !u.username.includes('ขาดคน'));
            if (primaries.length === 0) return false;
            return countBackupsForTeam(t) === 0;
        });

        // สลับลำดับเพื่อกระจายงาน
        emptyTeams.sort(() => Math.random() - 0.5);

        emptyTeams.forEach(targetTeam => {
            const primaries = (roster[targetTeam] || []).filter(u => !u.username.includes('ขาดคน'));

            // คนที่ใส่ได้ — ต้องเข้าเว็บนี้ได้ + ยังไม่มีงานรอง
            let candidates = availableForBackup.filter(c => {
                if (c.secondary_team) return false;
                if (c.primaryTeam === targetTeam) return false;

                const access = dutyAccessMatrix[c.id] || [];
                if (!access.includes(targetTeam)) return false;

                if (mode === 'strict') {
                    const cBreaks = breakTimes[c.username] || [];
                    const allPrimaryBreaks = new Set();
                    primaries.forEach(p => {
                        (breakTimes[p.username] || []).forEach(time => allPrimaryBreaks.add(time));
                    });
                    const hasOverlap = cBreaks.some(time => allPrimaryBreaks.has(time));
                    if (hasOverlap) return false;
                }

                return true;
            });

            if (candidates.length === 0) return;

            // เลือกคนแบบ "ใครเข้าได้น้อยสุด ใส่ก่อน" (กันคนที่เลือกได้แต่เว็บนี้ไม่หลุด)
            candidates.sort((a, b) => {
                const accessA = (dutyAccessMatrix[a.id] || []).length;
                const accessB = (dutyAccessMatrix[b.id] || []).length;
                if (accessA !== accessB) return accessA - accessB;
                return Math.random() - 0.5;
            });

            const chosen = candidates[0];
            const userInRoster = roster[chosen.primaryTeam].find(u => u.id === chosen.id);
            if (userInRoster && !userInRoster.secondary_team) {
                userInRoster.secondary_team = targetTeam;
                const availIndex = availableForBackup.findIndex(a => a.id === chosen.id);
                if (availIndex > -1) availableForBackup[availIndex].secondary_team = targetTeam;
                count++;
            }
        });

        return count;
    };

    // 🟡 Phase 2: คนที่เหลือกระจายเข้าเว็บรองน้อยสุด
    // mode = 'strict' หรือ 'relaxBreak'
    const phase2DistributeRest = (mode) => {
        let count = 0;

        const peopleToAssign = availableForBackup
            .filter(c => !c.secondary_team)
            .sort(() => Math.random() - 0.5);

        peopleToAssign.forEach(c => {
            const cBreaks = breakTimes[c.username] || [];
            const access = dutyAccessMatrix[c.id] || [];

            let validTeams = sortedTeams.filter(t => {
                if (t === c.primaryTeam) return false;
                if (!access.includes(t)) return false;

                const primaries = (roster[t] || []).filter(u => !u.username.includes('ขาดคน'));
                if (primaries.length === 0) return false;

                if (mode === 'strict') {
                    const allPrimaryBreaks = new Set();
                    primaries.forEach(p => {
                        (breakTimes[p.username] || []).forEach(time => allPrimaryBreaks.add(time));
                    });
                    const hasOverlap = cBreaks.some(time => allPrimaryBreaks.has(time));
                    if (hasOverlap) return false;
                }
                return true;
            });

            if (validTeams.length === 0) return;

            // เลือกเว็บที่มีรองน้อยที่สุด (load balance)
            validTeams.sort((a, b) => {
                const cA = countBackupsForTeam(a);
                const cB = countBackupsForTeam(b);
                if (cA !== cB) return cA - cB;
                return Math.random() - 0.5;
            });

            const chosenTeam = validTeams[0];
            const userInRoster = roster[c.primaryTeam].find(u => u.id === c.id);
            if (userInRoster && !userInRoster.secondary_team) {
                userInRoster.secondary_team = chosenTeam;
                const availIndex = availableForBackup.findIndex(a => a.id === c.id);
                if (availIndex > -1) availableForBackup[availIndex].secondary_team = chosenTeam;
                count++;
            }
        });

        return count;
    };

    // 🟢 Phase 1a: บังคับเว็บว่างให้ได้รอง (เช็คเวลาพัก)
    const phase1aCount = phase1FillEmptyTeams('strict');

    // 🟡 Phase 1b: บังคับเว็บว่างที่ยังเหลือ (ผ่อนเวลาพัก)
    Swal.update({ html: '<span class="text-sm text-gray-500">⚡ Phase 1b: เก็บเว็บที่ยังว่างอยู่ (ผ่อนเวลาพัก)...</span>' });
    await new Promise(r => setTimeout(r, 200));
    const phase1bCount = phase1FillEmptyTeams('relaxBreak');

    // 🟢 Phase 2a: คนที่เหลือกระจายเข้าเว็บรองน้อยสุด (เช็คเวลาพัก)
    Swal.update({ html: '<span class="text-sm text-gray-500">📊 Phase 2: กระจายคนที่เหลือเข้าเว็บรองน้อยสุด...</span>' });
    await new Promise(r => setTimeout(r, 200));
    const phase2aCount = phase2DistributeRest('strict');

    // 🟡 Phase 2b: เก็บตกขั้นสุดท้าย (ผ่อนเวลาพัก)
    const phase2bCount = phase2DistributeRest('relaxBreak');

    const pass1Count = phase1aCount + phase1bCount;  // คนที่ Phase 1 จัดได้ (เน้นกระจาย)
    const pass2Count = phase2aCount + phase2bCount;  // คนที่ Phase 2 จัดได้ (load balance)

    // นับคนที่ยังไม่มีงานรองเลย (ทั้งที่ลองทุกเว็บแล้ว)
    let totalUnassignedSlots = 0;
    for (const team in roster) {
        roster[team].forEach(u => {
            if (!u.username.includes('ขาดคน') && !u.secondary_team) totalUnassignedSlots++;
        });
    }

    // 3. บันทึกและวาดตารางใหม่
    // 🌟 NEW: สุ่มหัวข้องานรอง (จาก config ที่ตั้งใน "งานรอง") ให้แต่ละคนตามเว็บที่ไปสแตนบาย
    if (typeof window.assignStandbyTasksAfterAI === 'function') {
        try {
            roster = await window.assignStandbyTasksAfterAI(roster);
        } catch(e) { console.warn('assign standby tasks failed:', e); }
    }
    
    await appDB.from('settings').upsert([{ key: saveKey, value: JSON.stringify(roster) }]);
    window.renderRosterGrid(roster);

    try {
        if (appDB.channel) appDB.channel('duty-updates').send({ type: 'broadcast', event: 'force_reload' });
    } catch(e) {}

    // เขียน log
    try {
        await appDB.from('system_logs').insert([{
            action_type: 'แจกงานรอง',
            performed_by: currentUser.username,
            target_details: `แจกงานรอง (${currentDutyDept}, ${shiftFilter}, ${targetDate}) → กระจายให้ครบ: ${pass1Count} คน, เก็บตก: ${pass2Count} คน, ไม่ได้: ${totalUnassignedSlots} คน`
        }]);
    } catch(e) {}

    // 4. แสดงผลลัพธ์แบบละเอียด
    const totalSuccess = pass1Count + pass2Count;

    // นับเว็บที่ยังไม่มีรองเลย
    let emptyTeamCount = 0;
    sortedTeams.forEach(t => {
        const primaries = (roster[t] || []).filter(u => !u.username.includes('ขาดคน'));
        if (primaries.length > 0 && countBackupsForTeam(t) === 0) emptyTeamCount++;
    });

    let resultHtml = `
        <div class="text-left text-sm space-y-2 mt-2">
            <div class="flex justify-between items-center bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-2.5 rounded-lg shadow-sm">
                <span class="font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                    <span class="material-icons text-[16px]">spa</span> Phase 1 — กระจายให้ครบทุกเว็บ:
                </span>
                <span class="font-black text-emerald-600 dark:text-emerald-400 text-base">${pass1Count} คน</span>
            </div>
            <div class="flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-2.5 rounded-lg shadow-sm">
                <span class="font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                    <span class="material-icons text-[16px]">balance</span> Phase 2 — เก็บตก/Load balance:
                </span>
                <span class="font-black text-blue-600 dark:text-blue-400 text-base">${pass2Count} คน</span>
            </div>`;

    if (emptyTeamCount > 0) {
        resultHtml += `
            <div class="flex justify-between items-center bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-2.5 rounded-lg shadow-sm">
                <span class="font-bold text-red-700 dark:text-red-300 flex items-center gap-1.5">
                    <span class="material-icons text-[16px]">warning</span> เว็บที่ยังว่าง:
                </span>
                <span class="font-black text-red-600 dark:text-red-400 text-base">${emptyTeamCount} เว็บ</span>
            </div>`;
    }

    if (totalUnassignedSlots > 0) {
        resultHtml += `
            <div class="flex justify-between items-center bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-2.5 rounded-lg shadow-sm">
                <span class="font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                    <span class="material-icons text-[16px]">person_off</span> คนที่ไม่มีงานรอง:
                </span>
                <span class="font-black text-amber-600 dark:text-amber-400 text-base">${totalUnassignedSlots} คน</span>
            </div>
            <div class="text-[11px] text-gray-500 dark:text-gray-400 italic px-2 pt-1 border-t border-gray-200 dark:border-slate-700 mt-2">
                💡 <b>คนที่ไม่มีรอง</b> ไม่มีสิทธิ์หลังบ้านเว็บอื่นเลย — ตรวจสอบที่ "ตั้งค่าสิทธิ์ & หัวข้อ"
            </div>`;
    }

    resultHtml += `</div>`;
    
    Swal.fire({
        icon: emptyTeamCount === 0 && totalUnassignedSlots === 0 ? 'success' : 'info',
        title: emptyTeamCount === 0 && totalUnassignedSlots === 0
            ? `<div class="text-emerald-500 font-black">🎉 กระจายครบทุกเว็บ + ทุกคนได้งานรอง!</div>`
            : emptyTeamCount === 0
                ? `<div class="text-emerald-500 font-black">✅ ทุกเว็บมีรองครบแล้ว</div>`
                : `<div class="text-amber-500 font-black">แจกได้ ${totalSuccess} คน</div>`,
        html: resultHtml,
        confirmButtonText: 'ตกลง',
        confirmButtonColor: totalUnassignedSlots === 0 ? '#10b981' : '#f59e0b',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl border border-slate-700 shadow-2xl' }
    });
};

// ==========================================
// 🌟 โค้ดเสกปุ่ม "⚡ จัดรองด่วน (AI)" + "🧹 ล้างงานรอง" ให้โผล่ขึ้นมา
// ==========================================
setInterval(() => {
    // 🟢 bail-early ถ้าไม่ได้อยู่หน้า duty (กัน CPU ทำงานทิ้งทุกหน้าทุกๆ 1 วิ)
    const dutyApp = document.getElementById('dutyApp');
    if (!dutyApp || dutyApp.classList.contains('hidden')) return;

    // ─── ปุ่ม "จัดรองด่วน (AI)" — วางต่อจากปุ่มล้างตาราง ───
    if (!document.getElementById('btnQuickBackup')) {
        const clearBtn = document.querySelector('button[onclick*="clearDutyRoster"]');
        if (clearBtn) {
            const btn = document.createElement('button');
            btn.id = 'btnQuickBackup';
            btn.className = 'bg-fuchsia-600 hover:bg-fuchsia-500 text-white px-3 py-1.5 rounded-md text-xs font-bold shadow-md transition flex items-center gap-1 active:scale-95 ml-3 border border-fuchsia-400';
            btn.innerHTML = '<span class="material-icons text-[14px]">bolt</span> จัดรองด่วน (AI)';
            btn.onclick = window.quickAssignBackups;

            clearBtn.parentNode.insertBefore(btn, clearBtn.nextSibling);
        }
    }

    // ─── 🆕 ปุ่ม "ล้างงานรอง" — วางต่อจากปุ่มเพิ่มพนักงาน ───
    if (!document.getElementById('btnClearSecondary')) {
        const addStaffBtn = document.querySelector('button[onclick*="addStaffToRoster"]');
        if (addStaffBtn) {
            const btn = document.createElement('button');
            btn.id = 'btnClearSecondary';
            btn.className = 'duty-admin-only bg-cyan-600 hover:bg-cyan-500 text-white text-sm px-4 py-1.5 rounded-lg shadow-md font-bold transition flex items-center gap-1 transform active:scale-95 border border-cyan-400';
            btn.innerHTML = '<span class="material-icons text-base">layers_clear</span> ล้างงานรอง';
            btn.title = 'ล้างเฉพาะงานรอง (สแตนด์บาย) — งานหลักไม่กระทบ';
            btn.onclick = window.clearSecondaryDuties;

            addStaffBtn.parentNode.insertBefore(btn, addStaffBtn.nextSibling);
        }
    }
}, 2000);

// ==========================================
// 🌟 ฟังก์ชันกู้คืนตารางงาน (จากที่กดล้างไป)
// ==========================================
window.restoreDutyRoster = async function() {
    const targetDate = document.getElementById('dutyDate').value;
    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    if(!targetDate) return Swal.fire('!', 'กรุณาเลือกวันที่ก่อน', 'warning');

    const saveKey = typeof getDutySaveKey === 'function' ? getDutySaveKey(targetDate, shiftFilter) : `duty_roster_${currentDutyDept}_${targetDate}_${shiftFilter}`;
    const backupData = localStorage.getItem(`backup_${saveKey}`);

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
                await appDB.from('settings').upsert([{ key: saveKey, value: backupData }]);
                await appDB.from('system_logs').insert([{ action_type: 'กู้คืนตารางงาน', performed_by: currentUser.username, target_details: `กู้คืนตาราง ${currentDutyDept} (${shiftFilter}, ${targetDate})` }]);
                
                if(appDB.channel) appDB.channel('duty-updates').send({ type: 'broadcast', event: 'force_reload' });
                
                Swal.fire({ icon: 'success', title: 'กู้คืนตารางเรียบร้อย', showConfirmButton: false, timer: 1500 });
                if(typeof window.refreshDutyData === 'function') window.refreshDutyData(); 
            } catch (e) {
                Swal.fire('Error', e.message, 'error');
            }
        }
    });
};

// ========================================================================
// 🌟 NEW: หน้าตั้งค่างานรอง (Config) — แยกตามเว็บ
//
// Supabase `settings`:
//   key='standby_config_by_web' → { 'K36': ['เช็คโปร', 'ตอบแชต'], 'Jun88': ['เช็คโปร', 'ตอบสลิป'], ... }
//
// ใช้ตอน quickAssignBackups เพื่อสุ่ม "หัวข้องาน" ให้แต่ละคนตามเว็บที่ไปสแตนบาย
// เก็บผลลัพธ์ใน roster: u.standby_task = 'เช็คโปร'
// ========================================================================

window._standbyConfigByWeb = {};   // { 'K36': ['เช็คโปร', 'ตอบแชต'] }
window._standbySelectedWeb = null; // เว็บที่กำลังเลือกใน UI

// ─────────────────────────────────────────────
// โหลด config + render UI
// ─────────────────────────────────────────────
window.loadStandbyConfig = async function() {
    if (typeof appDB === 'undefined') return;
    
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', 'standby_config_by_web');
        window._standbyConfigByWeb = {};
        if (data && data.length > 0 && data[0].value) {
            try {
                const obj = JSON.parse(data[0].value);
                if (obj && typeof obj === 'object') window._standbyConfigByWeb = obj;
            } catch(e) {}
        }
        
        renderStandbyWebTabs();
        if (window._standbySelectedWeb) {
            renderStandbyWebContent(window._standbySelectedWeb);
        }
    } catch(e) {
        console.error('loadStandbyConfig error:', e);
    }
};

// ─────────────────────────────────────────────
// แท็บเว็บ (ปุ่มเลือกเว็บ)
// ─────────────────────────────────────────────
const STANDBY_WEB_COLORS_CFG = {
    'Jun88':'#3b82f6','MK8':'#0f172a','F168':'#f59e0b','PG688':'#fde047',
    'JL69':'#fed7aa','NM9':'#94a3b8','VV72':'#7f1d1d','TH26':'#a78bfa',
    'BT678':'#0e7490','K188':'#16a34a','NM8':'#475569','K36':'#dc2626'
};
function getCfgWebColor(w) { return STANDBY_WEB_COLORS_CFG[w] || '#64748b'; }

function getAllWebs() {
    let allWebs = [];
    if (typeof window.dutyAccessMatrix !== 'undefined' && window.dutyAccessMatrix) {
        Object.values(window.dutyAccessMatrix).forEach(deptMatrix => {
            if (deptMatrix && typeof deptMatrix === 'object') {
                Object.keys(deptMatrix).forEach(team => {
                    if (!allWebs.includes(team)) allWebs.push(team);
                });
            }
        });
    }
    if (allWebs.length === 0) {
        allWebs = ['Jun88','MK8','F168','PG688','JL69','NM9','VV72','TH26','BT678','K188','NM8','K36'];
    }
    const defaultOrder = ['Jun88','MK8','F168','PG688','JL69','NM9','VV72','TH26','BT678','K188','NM8','K36'];
    allWebs.sort((a, b) => {
        const ia = defaultOrder.indexOf(a);
        const ib = defaultOrder.indexOf(b);
        if (ia === -1 && ib === -1) return a.localeCompare(b);
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
    });
    return allWebs;
}

function renderStandbyWebTabs() {
    const wrap = document.getElementById('standbyWebTabs');
    if (!wrap) return;
    
    const webs = getAllWebs();
    
    if (webs.length === 0) {
        wrap.innerHTML = '<div class="text-xs text-slate-400 py-2 px-3">ยังไม่มีเว็บในระบบ</div>';
        return;
    }
    
    // เลือก default ถ้ายังไม่เลือก
    if (!window._standbySelectedWeb || !webs.includes(window._standbySelectedWeb)) {
        window._standbySelectedWeb = webs[0];
    }
    
    wrap.innerHTML = webs.map(w => {
        const isActive = w === window._standbySelectedWeb;
        const color = getCfgWebColor(w);
        const taskCount = (window._standbyConfigByWeb[w] || []).length;
        const txtColor = (color === '#fde047' || color === '#fed7aa') ? '#000' : '#fff';
        
        return `
        <button onclick="selectStandbyWeb('${w}')" class="standby-web-tab flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition ${isActive ? 'shadow-md' : 'opacity-60 hover:opacity-100'}" 
            style="background:${isActive ? color : 'transparent'};color:${isActive ? txtColor : color};border:1.5px solid ${color}">
            ${w}
            ${taskCount > 0 ? `<span class="bg-white/30 backdrop-blur-sm px-1.5 rounded-full text-[9px]">${taskCount}</span>` : ''}
        </button>`;
    }).join('');
    
    renderStandbyWebContent(window._standbySelectedWeb);
}

window.selectStandbyWeb = function(web) {
    window._standbySelectedWeb = web;
    renderStandbyWebTabs();
};

// ─────────────────────────────────────────────
// เนื้อหาของเว็บที่เลือก (รายการหัวข้องาน)
// ─────────────────────────────────────────────
function renderStandbyWebContent(web) {
    const wrap = document.getElementById('standbyWebContent');
    if (!wrap) return;
    
    const tasks = window._standbyConfigByWeb[web] || [];
    const color = getCfgWebColor(web);
    const txtColor = (color === '#fde047' || color === '#fed7aa') ? '#000' : '#fff';
    
    wrap.innerHTML = `
        <div class="flex items-center gap-2 mb-4">
            <div class="w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm shadow" style="background:${color};color:${txtColor}">${web}</div>
            <div class="flex-1">
                <div class="font-black text-base text-slate-800 dark:text-white">หัวข้องานรองของ ${web}</div>
                <div class="text-[11px] text-slate-500 dark:text-slate-400">${tasks.length} หัวข้อ • คนที่มาช่วยเว็บ ${web} จะถูกสุ่มหัวข้อจากนี้</div>
            </div>
        </div>
        
        <!-- เพิ่มหัวข้อใหม่ -->
        <div class="bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-3 mb-3">
            <div class="flex gap-2">
                <input type="text" id="newStandbyWebTask" placeholder="ชื่อหัวข้องาน เช่น เช็คคำขอโปรโมชั่น..." 
                    onkeydown="if(event.key==='Enter') addStandbyWebTask('${web}')"
                    class="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm outline-none focus:border-purple-500 dark:text-white">
                <button onclick="addStandbyWebTask('${web}')" class="bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-600 hover:to-fuchsia-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow transition flex items-center gap-1">
                    <span class="material-icons text-base">add</span> เพิ่ม
                </button>
            </div>
        </div>
        
        <!-- รายการหัวข้อ -->
        ${tasks.length === 0 
            ? `<div class="text-center py-10 text-slate-400">
                <span class="material-icons text-4xl opacity-30">playlist_add</span>
                <p class="font-bold text-sm mt-2">ยังไม่มีหัวข้องานของ ${web}</p>
                <p class="text-[11px] mt-1">เพิ่มหัวข้อในช่องด้านบน — กด Enter ก็ได้</p>
              </div>`
            : `<div class="space-y-2">
                ${tasks.map((task, idx) => `
                    <div class="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-2.5 flex items-center gap-2 group hover:shadow-md transition">
                        <span class="text-white font-black text-[10px] w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style="background:${color};color:${txtColor}">${idx + 1}</span>
                        <input type="text" value="${escapeHtmlCfg(task)}" 
                            onchange="editStandbyWebTask('${web}', ${idx}, this.value)"
                            class="flex-1 bg-transparent border-none outline-none text-sm font-bold text-slate-800 dark:text-white px-1 focus:bg-slate-50 dark:focus:bg-slate-900 rounded">
                        <button onclick="moveStandbyWebTask('${web}', ${idx}, -1)" ${idx === 0 ? 'disabled' : ''} class="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed" title="ขึ้น">
                            <span class="material-icons text-sm">arrow_upward</span>
                        </button>
                        <button onclick="moveStandbyWebTask('${web}', ${idx}, 1)" ${idx === tasks.length-1 ? 'disabled' : ''} class="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed" title="ลง">
                            <span class="material-icons text-sm">arrow_downward</span>
                        </button>
                        <button onclick="deleteStandbyWebTask('${web}', ${idx})" class="p-1 hover:bg-rose-100 dark:hover:bg-rose-900/30 rounded text-rose-500" title="ลบ">
                            <span class="material-icons text-sm">delete</span>
                        </button>
                    </div>
                `).join('')}
              </div>`
        }
    `;
}

window.addStandbyWebTask = async function(web) {
    const input = document.getElementById('newStandbyWebTask');
    if (!input) return;
    const val = input.value.trim();
    if (!val) return;
    
    if (!window._standbyConfigByWeb[web]) window._standbyConfigByWeb[web] = [];
    if (window._standbyConfigByWeb[web].includes(val)) {
        return Swal.fire('!', 'มีหัวข้อนี้อยู่แล้ว', 'warning');
    }
    
    window._standbyConfigByWeb[web].push(val);
    input.value = '';
    renderStandbyWebTabs();
    await saveStandbyConfig();
};

window.editStandbyWebTask = async function(web, idx, newVal) {
    newVal = (newVal || '').trim();
    if (!newVal) {
        renderStandbyWebTabs();
        return Swal.fire('!', 'ต้องระบุชื่อหัวข้อ', 'warning');
    }
    if (!window._standbyConfigByWeb[web]) return;
    window._standbyConfigByWeb[web][idx] = newVal;
    await saveStandbyConfig();
};

window.moveStandbyWebTask = async function(web, idx, dir) {
    const arr = window._standbyConfigByWeb[web];
    if (!arr) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= arr.length) return;
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    renderStandbyWebTabs();
    await saveStandbyConfig();
};

window.deleteStandbyWebTask = async function(web, idx) {
    const arr = window._standbyConfigByWeb[web];
    if (!arr) return;
    const taskName = arr[idx];
    const ok = await Swal.fire({
        title: 'ลบหัวข้อนี้?',
        text: `"${taskName}" ของเว็บ ${web} จะถูกลบ`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'ลบ',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#dc2626'
    });
    if (!ok.isConfirmed) return;
    
    arr.splice(idx, 1);
    renderStandbyWebTabs();
    await saveStandbyConfig();
};

async function saveStandbyConfig() {
    if (typeof appDB === 'undefined') return;
    try {
        await appDB.from('settings').upsert([
            { key: 'standby_config_by_web', value: JSON.stringify(window._standbyConfigByWeb) }
        ]);
    } catch(e) { 
        console.error('save standby config failed:', e); 
        Swal.fire('Error', 'บันทึกไม่สำเร็จ', 'error');
    }
}

function escapeHtmlCfg(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
}

// ========================================================================
// 🎯 Helper สำหรับ quickAssignBackups: สุ่มหัวข้องานให้คนที่ไปสแตนบาย
// เรียกหลัง AI assign secondary_team เสร็จ
// ========================================================================
window.assignStandbyTasksAfterAI = async function(roster) {
    // โหลด config (จาก cache หรือ DB)
    if (Object.keys(window._standbyConfigByWeb || {}).length === 0) {
        try {
            const { data } = await appDB.from('settings').select('value').eq('key', 'standby_config_by_web');
            if (data && data.length > 0 && data[0].value) {
                window._standbyConfigByWeb = JSON.parse(data[0].value) || {};
            }
        } catch(e) {}
    }
    
    const config = window._standbyConfigByWeb || {};
    if (Object.keys(config).length === 0) return roster;  // ไม่มี config = ไม่ทำอะไร
    
    // นับ task ของแต่ละเว็บ — สำหรับสุ่มไม่ซ้ำในรอบเดียวกัน
    const usedTaskByWeb = {};  // { 'K36': ['เช็คโปร'] }
    
    for (const team in roster) {
        if (!Array.isArray(roster[team])) continue;
        roster[team].forEach(u => {
            // เฉพาะคนที่มี secondary_team (ไปสแตนบายเว็บอื่น)
            if (!u || !u.secondary_team || String(u.username || '').includes('ขาดคน')) return;
            
            const targetWeb = u.secondary_team;
            const tasks = config[targetWeb] || [];
            if (tasks.length === 0) {
                u.standby_task = null;  // ไม่มี config → ไม่มีหัวข้อ
                return;
            }
            
            // หา task ที่ยังไม่ถูกใช้ในเว็บนี้รอบนี้
            if (!usedTaskByWeb[targetWeb]) usedTaskByWeb[targetWeb] = [];
            let available = tasks.filter(t => !usedTaskByWeb[targetWeb].includes(t));
            if (available.length === 0) {
                // ถ้าทุกหัวข้อถูกใช้แล้ว → reset วนรอบใหม่
                usedTaskByWeb[targetWeb] = [];
                available = [...tasks];
            }
            
            // สุ่ม
            const picked = available[Math.floor(Math.random() * available.length)];
            u.standby_task = picked;
            usedTaskByWeb[targetWeb].push(picked);
        });
    }
    
    return roster;
};

// ==========================================
// 🎯 แจกโปร/เคส Telegram สำหรับแผนก OD
// กดหลังจัดหน้าที่หลักเสร็จแล้ว
// ==========================================
window.assignODProTelegramTasks = async function() {
    // ตรวจว่ามีข้อมูล roster อยู่ไหม
    if (!currentRosterData || Object.keys(currentRosterData).length === 0) {
        return Swal.fire('แจ้งเตือน', 'กรุณาจัดหน้าที่หลักก่อน แล้วค่อยกดปุ่มนี้', 'warning');
    }

    // นับคนในแต่ละเว็บ
    const webList = sortedTeams.filter(t => t !== 'หน้าที่ส่วนกลาง');
    let preview = '';
    let changeCount = 0;

    webList.forEach(team => {
        const members = (currentRosterData[team] || []).filter(u => !u.username?.includes('ขาดคน'));
        const count = members.length;
        if (count < 2) return; // 1 คน → ไม่แจก

        // วนแจก: คนคู่ → โปร, คนคี่ → เคส TG
        members.forEach((u, idx) => {
            u.od_pro_task  = (idx % 2 === 0) ? team : null;
            u.od_tg_task   = (idx % 2 === 1) ? team : null;
            // ถ้ามี 3+ คน วนต่อ
            if (idx >= 2) {
                if (idx % 2 === 0) { u.od_pro_task = team; u.od_tg_task = null; }
                else               { u.od_tg_task  = team; u.od_pro_task = null; }
            }
            changeCount++;
        });

        preview += `<div class="mb-2"><span class="font-black text-indigo-300">${team}</span> (${count} คน):<br>`;
        members.forEach((u, idx) => {
            const tag = u.od_pro_task ? '🟣 อนุมัติโปร' : '💬 เคส Telegram';
            preview += `&nbsp;&nbsp;<span class="text-sm">${u.username}</span> → <span class="font-bold">${tag}</span><br>`;
        });
        preview += '</div>';
    });

    if (changeCount === 0) {
        return Swal.fire('แจ้งเตือน', 'ไม่มีเว็บไหนที่มี 2 คนขึ้นไป ไม่มีอะไรต้องแจก', 'info');
    }

    const result = await Swal.fire({
        title: '🎯 ยืนยันการแจกโปร/เคส Telegram',
        html: `<div class="text-left text-sm max-h-64 overflow-y-auto">${preview}</div>`,
        showCancelButton: true,
        confirmButtonText: 'ยืนยัน แจกเลย',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#7c3aed',
        background: '#1e293b',
        color: '#e2e8f0',
    });

    if (!result.isConfirmed) return;

    // บันทึกลง DB
    try {
        const targetDate  = document.getElementById('dutyDate').value;
        const shiftFilter = document.getElementById('dutyShiftSelect').value;
        const saveKey     = getDutySaveKey(targetDate, shiftFilter);

        const { error } = await appDB.from('settings').upsert([{
            key:   saveKey,
            value: JSON.stringify(currentRosterData)
        }]);
        if (error) throw error;

        await window.refreshDutyData();
        Swal.fire({ icon: 'success', title: 'แจกงานเรียบร้อย!', timer: 1500, showConfirmButton: false });
    } catch(e) {
        Swal.fire('Error', e.message, 'error');
    }
};
