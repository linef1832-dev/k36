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

        if(GLOBAL_USER_LIST.length === 0 && typeof fetchUsers === 'function') await fetchUsers();
        await window.loadDutyAccessAndRoles();
        
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

window.subscribeDutyChanges = function() {
    if(dutySubscription) appDB.removeChannel(dutySubscription);
    dutySubscription = appDB.channel('duty-updates').on('broadcast', { event: 'force_reload' }, () => {
        if (!document.getElementById('dutyApp').classList.contains('hidden')) window.refreshDutyData();
    }).subscribe();
}

window.applyDutyRoleUI = function() {
    const isAdmin = window.isDutyAdmin();
    const isTrainerDept = (currentUser.department === 'AMQL' || currentUser.department === 'ODQL' || (currentUser.department && currentUser.department.startsWith('TRAINER'))); 
    const isTrainerRole = (currentUser.role && currentUser.role.toLowerCase() === 'trainer');

    let canManageDuty = false;
    if (isAdmin) canManageDuty = true; 
    else if (currentDutyDept === 'AMQL' || currentDutyDept === 'ODQL' || currentDutyDept.startsWith('TRAINER')) canManageDuty = false; 
    else canManageDuty = window.isDutyAdmin();
    
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
    if(tabName === 'roster') {
        document.getElementById('dutyTabRoster').classList.remove('hidden'); document.getElementById('dutyTabRoster').classList.add('flex');
        document.getElementById('dutyTabSettings').classList.add('hidden'); document.getElementById('dutyTabSettings').classList.remove('flex');
        document.getElementById('tabBtnRoster').className = 'px-3 py-1.5 rounded-md text-xs font-bold bg-indigo-500 text-white shadow transition';
        document.getElementById('tabBtnSettings').className = 'px-3 py-1.5 rounded-md text-xs font-bold text-indigo-300 hover:text-white transition';
        window.renderDutyRequirements();
        if(window.isDutyAdmin()) window.updateDutyStats();
    } else {
        document.getElementById('dutyTabSettings').classList.remove('hidden'); document.getElementById('dutyTabSettings').classList.add('flex');
        document.getElementById('dutyTabRoster').classList.add('hidden'); document.getElementById('dutyTabRoster').classList.remove('flex');
        document.getElementById('tabBtnSettings').className = 'px-3 py-1.5 rounded-md text-xs font-bold bg-indigo-500 text-white shadow transition';
        document.getElementById('tabBtnRoster').className = 'px-3 py-1.5 rounded-md text-xs font-bold text-indigo-300 hover:text-white transition';
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
        const targetDateInput = document.getElementById('dutyDate');
        const shiftFilterInput = document.getElementById('dutyShiftSelect');
        
        if (!targetDateInput || !shiftFilterInput) return; 
        
        const targetDate = targetDateInput.value;
        const shiftFilter = shiftFilterInput.value;
        if(!targetDate) return;

        const { data: leaves } = await appDB.from('leave_requests').select('user_id, reason, user_name').eq('leave_date', targetDate);
        currentDutyLeaves = new Set();
        if (leaves) leaves.forEach(l => currentDutyLeaves.add(String(l.user_id))); 

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

        const saveKey = getDutySaveKey(targetDate, shiftFilter); 
        
        let savedRoster = null;
        try {
            const { data } = await appDB.from('settings').select('value').eq('key', saveKey);
            if (data && data.length > 0) savedRoster = data[0];
        } catch(e) { console.log(e); }
        
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
                if (!isExist) currentRosterData[selectedTeam].push(fullUserObj);
                
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

window.clearDutyRoster = async function() {
    const targetDate = document.getElementById('dutyDate').value;
    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    if(!targetDate) return Swal.fire('!', 'กรุณาเลือกวันที่ก่อน', 'warning');

    Swal.fire({
        title: 'ยืนยันการล้างตาราง?', text: `คุณต้องการลบตารางงานวันที่ ${targetDate} (${shiftFilter}) ใช่หรือไม่? (สามารถกดกู้คืนได้)`, icon: 'warning',
        showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'ล้างเลย', cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({title: 'กำลังล้างข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
            const saveKey = getDutySaveKey(targetDate, shiftFilter);
            const reportKey = `report_${currentDutyDept}_${targetDate}_${shiftFilter}`; 
            
            try {
                let currentDataVal = null;
                const { data: currentData } = await appDB.from('settings').select('value').eq('key', saveKey);
                if (currentData && currentData.length > 0) currentDataVal = currentData[0].value;
                
                if (currentDataVal) {
                    localStorage.setItem(`backup_${saveKey}`, currentDataVal);
                    if (currentDutyDept === 'AMQL' || currentDutyDept === 'ODQL' || currentDutyDept.startsWith('TRAINER')) {
                        let currentReportVal = null;
                        const { data: currentReport } = await appDB.from('settings').select('value').eq('key', reportKey);
                        if (currentReport && currentReport.length > 0) currentReportVal = currentReport[0].value;
                        if (currentReportVal) localStorage.setItem(`backup_${reportKey}`, currentReportVal);
                    }
                }
                
                await appDB.from('settings').delete().eq('key', saveKey);
                if (currentDutyDept === 'AMQL' || currentDutyDept === 'ODQL' || currentDutyDept.startsWith('TRAINER')) await appDB.from('settings').delete().eq('key', reportKey);
                
                await appDB.from('system_logs').insert([{ action_type: 'ล้างตารางงาน', performed_by: currentUser.username, target_details: `ล้างตารางของแผนก ${currentDutyDept} (กะ: ${shiftFilter}, วันที่: ${targetDate})` }]);
                appDB.channel('duty-updates').send({ type: 'broadcast', event: 'force_reload' });
                
                Swal.fire({ icon: 'success', title: 'ล้างตารางเรียบร้อย', text: 'สามารถกดปุ่ม "กู้คืน" ที่เพิ่มขึ้นมาได้', timer: 2000, showConfirmButton: false });
                if(typeof window.refreshDutyData === 'function') window.refreshDutyData(); 
            } catch (e) { Swal.fire('Error', e.message, 'error'); }
        }
    });
};

window.restoreDutyRoster = async function() {
    const targetDate = document.getElementById('dutyDate').value;
    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    const saveKey = getDutySaveKey(targetDate, shiftFilter);
    const reportKey = `report_${currentDutyDept}_${targetDate}_${shiftFilter}`;

    const backupData = localStorage.getItem(`backup_${saveKey}`);
    if (!backupData) return Swal.fire('ไม่พบข้อมูล', 'ไม่มีข้อมูลสำรองให้กู้คืนสำหรับกะนี้', 'error');

    Swal.fire({
        title: 'กู้คืนตาราง?', text: 'ระบบจะนำตารางที่คุณเพิ่งลบไปกลับมาใช้งาน', icon: 'question',
        showCancelButton: true, confirmButtonColor: '#10b981', confirmButtonText: 'กู้คืนเลย', cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({title: 'กำลังกู้คืน...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
            try {
                await appDB.from('settings').upsert([{ key: saveKey, value: backupData }]);
                const backupReport = localStorage.getItem(`backup_${reportKey}`);
                if ((currentDutyDept === 'AMQL' || currentDutyDept === 'ODQL' || currentDutyDept.startsWith('TRAINER')) && backupReport) await appDB.from('settings').upsert([{ key: reportKey, value: backupReport }]);

                await appDB.from('system_logs').insert([{ action_type: 'กู้คืนตารางงาน', performed_by: currentUser.username, target_details: `กู้คืนตารางแผนก ${currentDutyDept} (กะ: ${shiftFilter}, วันที่: ${targetDate})` }]);
                localStorage.removeItem(`backup_${saveKey}`); localStorage.removeItem(`backup_${reportKey}`);
                appDB.channel('duty-updates').send({ type: 'broadcast', event: 'force_reload' });
                
                Swal.fire({ icon: 'success', title: 'กู้คืนสำเร็จ!', timer: 1500, showConfirmButton: false });
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

    Swal.fire({title: 'กำลังจัดและวิเคราะห์คิว...', text: 'ระบบกำลังเช็คประวัติเมื่อวาน เพื่อกระจายเว็บไม่ให้ซ้ำ...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});

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
                let eligible = unassignedPool.filter(u => {
                    const access = dutyAccessMatrix[u.id] || [];
                    return access.includes(team);
                });
                return { team: team, eligibleCount: eligible.length, eligibleUsers: eligible };
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

            let pickedUser = { ...userOptions[0].user }; 
            rosterResult[teamToFill].push(pickedUser);
            remainingReqs[teamToFill]--;
            unassignedPool = unassignedPool.filter(u => u.id !== pickedUser.id);
        }

        let secondaryCounts = {};
        sortedTeams.forEach(t => secondaryCounts[t] = 0); 
        let allAssignedUsers = [];
        
        for (const primaryTeam in rosterResult) {
            rosterResult[primaryTeam].forEach(u => {
                if (!u.username.includes('ขาดคน')) allAssignedUsers.push({ userObj: u, primaryTeam: primaryTeam });
            });
        }

        allAssignedUsers.sort(() => Math.random() - 0.5);

        allAssignedUsers.forEach(item => {
            const u = item.userObj; const primaryTeam = item.primaryTeam;
            const access = dutyAccessMatrix[u.id] || [];
            let possibleSecondary = access.filter(t => t !== primaryTeam && sortedTeams.includes(t));

            if (possibleSecondary.length > 0) {
                possibleSecondary.sort((teamA, teamB) => secondaryCounts[teamA] - secondaryCounts[teamB]);
                const minCount = secondaryCounts[possibleSecondary[0]];
                const minTeams = possibleSecondary.filter(t => secondaryCounts[t] === minCount);
                const pickedSecondary = minTeams[Math.floor(Math.random() * minTeams.length)];

                u.secondary_team = pickedSecondary;
                secondaryCounts[pickedSecondary]++; 
            } else { u.secondary_team = null; }
        });

        const saveKey = getDutySaveKey(targetDate, shiftFilter);
        const { error } = await appDB.from('settings').upsert([{ key: saveKey, value: JSON.stringify(rosterResult) }]);
        if (error) throw error;

        try {
            await appDB.from('system_logs').insert([{ action_type: 'สุ่มจัดหน้าที่', performed_by: currentUser.username, target_details: `จัดเวรแผนก ${currentDutyDept} (กะ: ${shiftFilter}, วันที่: ${targetDate})` }]);
            if(appDB.channel) appDB.channel('duty-updates').send({ type: 'broadcast', event: 'force_reload' });
        } catch(logError) {}

        window.refreshDutyData(); 
        
        if (unassignedPool.length > 0) {
            const leftNames = unassignedPool.map(u => u.username).join(', ');
            Swal.fire({ icon: 'warning', title: `จัดสำเร็จ! (แต่มีคนไม่ได้ลงเว็บ)`, html: `เหลือพนักงานไม่ได้ลงเว็บ <b>${unassignedPool.length} คน</b> เพราะไม่ได้ติ๊กสิทธิ์หลังบ้านไว้:<br><br><span class="text-red-500 font-bold">${leftNames}</span>` });
        } else {
            Swal.fire({ icon: 'success', title: `จัดคนพร้อมสลับเว็บสำเร็จ!`, timer: 2000, showConfirmButton: false });
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
            const cursorClass = canDrag ? 'cursor-grab active:cursor-grabbing hover:scale-[1.02] hover:shadow-lg' : 'cursor-default';

            let secHtml = '';
            if (a.secondary_team && !isMissing) {
                const secTeamColors = TEAM_COLORS[a.secondary_team] || TEAM_COLORS['DEFAULT'];
                const actionClick = isAdmin ? `onclick="event.stopPropagation(); changeSecondaryTeam('${team}', '${a.id}', '${a.username}')"` : '';
                const hoverFx = isAdmin ? 'hover:border-transparent hover:shadow-md cursor-pointer hover:scale-[1.03]' : 'border-gray-200 dark:border-slate-600';

                secHtml = `
                <div ${actionClick} title="${isAdmin ? 'คลิกเพื่อเปลี่ยนงานรอง' : 'นี่คืองานรองของคุณ'}" class="mt-2.5 flex items-stretch w-full bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 shadow-inner transition ${hoverFx} overflow-hidden group/sec">
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
                </div>`;
            } else if (!isMissing && isAdmin) {
                secHtml = `
                <div onclick="event.stopPropagation(); changeSecondaryTeam('${team}', '${a.id}', '${a.username}')" class="mt-2.5 flex items-center justify-center gap-1.5 w-full bg-slate-50 dark:bg-slate-800/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-gray-400 hover:text-indigo-500 border border-dashed border-gray-300 dark:border-slate-600 hover:border-indigo-400 py-2 rounded-lg text-[9.5px] font-bold transition cursor-pointer group/add shadow-inner">
                    <span class="material-icons text-[14px] group-hover/add:rotate-90 transition-transform">add_task</span>
                    แจกงานรองให้พนักงาน
                </div>`;
            }

            return `
            <div class="duty-user-card flex flex-col p-3 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm transition shrink-0 group ${cursorClass}" data-name="${(a.username || '').toLowerCase()}" ${dragAttrs}>
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2.5">
                        <span class="material-icons text-green-500 text-[18px] pointer-events-none drop-shadow-sm">${isMissing ? 'warning' : 'check_circle'}</span> 
                        <span class="font-black text-slate-800 dark:text-gray-100 text-sm pointer-events-none truncate tracking-wide">${a.username}</span>
                    </div>
                </div>
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
            currentRosterData[primaryTeam][userIndex].secondary_team = selectedSec === 'none' ? null : selectedSec;
            const targetDate = document.getElementById('dutyDate').value; const shiftFilter = document.getElementById('dutyShiftSelect').value;
            const saveKey = `duty_roster_${currentDutyDept}_${targetDate}_${shiftFilter}`;
            
            Swal.fire({title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen:()=>Swal.showLoading()});
            await appDB.from('settings').upsert([{ key: saveKey, value: JSON.stringify(currentRosterData) }]);
            
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
    const namesHtml = list.map((item, i) => `
        <div class="p-3 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-600 shadow-sm flex items-center justify-between group hover:border-amber-400 transition">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-xs shadow-inner">${i + 1}</div>
                <div class="text-left"><div class="font-extrabold text-slate-800 dark:text-white text-sm">${item.name}</div><div class="text-[9px] text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1">ย้ายมาจากเว็บหลัก: <span class="font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-1 rounded">${item.fromTeam}</span></div></div>
            </div>
            <span class="material-icons text-amber-400 text-xl opacity-50 group-hover:scale-110 transition">support_agent</span>
        </div>
    `).join('');

    Swal.fire({
        title: `<div class="flex flex-col items-center gap-1"><span class="text-sm text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">ทีมสแตนด์บายช่วย</span><span class="text-2xl font-black ${teamColor.text} ${teamColor.bg} px-4 py-1 rounded-lg shadow-md border ${teamColor.border}">${team}</span></div>`,
        html: `<div class="flex flex-col gap-2 mt-4 max-h-[50vh] overflow-y-auto custom-scrollbar p-1">${namesHtml}</div>`,
        confirmButtonText: 'ปิดหน้าต่าง', confirmButtonColor: '#64748b',
        customClass: { popup: 'dark:bg-slate-900 dark:text-white rounded-3xl' }
    });
};

window.filterDutyResult = function() {
    const term = document.getElementById('dutySearchInput').value.toLowerCase();
    const siteCards = document.querySelectorAll('.duty-site-card');
    
    siteCards.forEach(card => {
        const userCards = card.querySelectorAll('.duty-user-card');
        let cardHasMatch = false;

        userCards.forEach(uCard => {
            const name = uCard.dataset.name;
            if(name && name.includes(term)) { uCard.classList.add('ring-2', 'ring-amber-500', 'bg-amber-50'); cardHasMatch = true; } 
            else { uCard.classList.remove('ring-2', 'ring-amber-500', 'bg-amber-50'); }
        });

        if(term === '') {
            card.style.display = 'flex'; userCards.forEach(u => u.classList.remove('ring-2', 'ring-amber-500', 'bg-amber-50'));
        } else { card.style.display = cardHasMatch ? 'flex' : 'none'; }
    });
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

    currentRosterData[fromTeam] = currentRosterData[fromTeam].filter(u => String(u.id) !== String(id));

    const fullUserObj = GLOBAL_USER_LIST.find(u => String(u.id) === String(id));
    if (fullUserObj) {
        if(!currentRosterData[toTeam]) currentRosterData[toTeam] = [];
        currentRosterData[toTeam].push(fullUserObj);
    }

    const saveKey = typeof getDutySaveKey === 'function' ? getDutySaveKey(targetDate, shiftFilter) : `duty_roster_${currentDutyDept}_${targetDate}_${shiftFilter}`;

    Swal.fire({title: 'กำลังอัปเดตตาราง...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});

    try {
        const { error } = await appDB.from('settings').upsert([{ key: saveKey, value: JSON.stringify(currentRosterData) }]);
        if (error) throw error;

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
        const { data, error } = await appDB.from('system_logs').select('*').in('action_type', ['จัดหน้าที่', 'ล้างตารางงาน', 'ประเมินงานผู้สอน', 'ย้ายหน้าที่', 'กู้คืนตารางงาน']).order('created_at', { ascending: false }).limit(50);
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

if (window.appDB && appDB.from) {
    const originalDbUpsert = appDB.from('settings').upsert;
    appDB.from('settings').upsert = async function(payload) {
        const result = await originalDbUpsert.call(this, payload);
        try {
            if (payload && payload[0] && payload[0].key && payload[0].key.startsWith('report_')) {
                const parts = payload[0].key.split('_');
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
            }
        } catch(e) {}
        return result;
    };
}

let dutySearchTimeout = null;
window.onDutySearch = function() {
    clearTimeout(dutySearchTimeout);
    dutySearchTimeout = setTimeout(() => {
        filterDutyResult(); 
    }, 300); 
};

// 🟢 อัปเดตตาราง OD ให้หัวข้อแสดงตามที่ตั้งค่าไว้เป๊ะๆ (ปรับขนาดให้อ่านง่ายขึ้น)
window.renderTrainerOdMatrix = function(rosterData) {
    const matrixGrid = document.getElementById('dutyMatrixGrid');
    if (!matrixGrid) return;

    // ใช้รายชื่อเว็บตายตัวตามที่คุณกำหนด เพื่อให้แสดงครบทุกเว็บแน่นอน
    const matrixWebsites = ['Jun88', 'MK8', 'VV72', 'TH26', 'K188', 'BT678', 'PG688', 'JL69', 'NM9', 'F168', 'หน้าที่ส่วนกลาง'];

    // ดึงรายชื่อพนักงานที่เป็นผู้สอน OD 
    const staffList = GLOBAL_USER_LIST.filter(u => {
        if (u.department === 'ODQL' || u.department === 'TRAINER_OD') return true;
        if (u.department === 'OD' && (u.role === 'trainer' || u.role === 'TRAINER')) return true;
        return false;
    });

    let html = `<div class="w-full min-w-max border border-slate-600 shadow-sm rounded-lg overflow-hidden">
        <table class="w-full text-center border-collapse text-sm whitespace-nowrap dark:text-white">`;
    
    // ---------------- สร้างหัวตาราง (Header) แถวแรก ชื่อเว็บ ----------------
    html += `<thead class="bg-slate-200 dark:bg-slate-900 border-b-2 border-slate-400 dark:border-slate-600"><tr>`;
    html += `<th rowspan="2" class="border border-slate-300 dark:border-slate-700 p-3 w-[1%] whitespace-nowrap text-sm">กะ</th>`;
    // ขยายช่องชื่อให้กว้างขึ้น
    html += `<th rowspan="2" class="border border-slate-300 dark:border-slate-700 p-3 w-[180px] min-w-[180px] whitespace-nowrap text-sm">รายชื่อผู้ดูแล</th>`;
    
    matrixWebsites.forEach(web => {
        // ดึงหัวข้อจากหน้าตั้งค่า (ถ้าไม่มีเลย ให้แสดงเป็นขีด '-')
        // ใช้ Vv72 เผื่อมีการสะกดต่างกัน
        let webTasks = customDutyRoles[web] || customDutyRoles[(web === 'VV72' ? 'Vv72' : web)] || ['ไม่มีหัวข้อ'];
        if (webTasks.length === 0) webTasks = ['-'];

        let bg = 'bg-blue-600 text-white';
        if(web === 'MK8') bg = 'bg-yellow-500 text-black';
        else if (web === 'Vv72' || web === 'VV72') bg = 'bg-green-700 text-white';
        else if (web === 'TH26') bg = 'bg-gray-700 text-white';
        else if (web === 'PG688') bg = 'bg-amber-100 text-amber-900';
        else if (web === 'F168') bg = 'bg-orange-500 text-white';
        else if (web === 'NM9') bg = 'bg-pink-500 text-white';
        else if (web === 'JL69') bg = 'bg-slate-500 text-white';
        else if (web === 'K188') bg = 'bg-blue-500 text-white';
        else if (web === 'BT678') bg = 'bg-red-500 text-white';
        else if (web === 'หน้าที่ส่วนกลาง') bg = 'bg-indigo-900 text-amber-400 border-b border-amber-500';
        
        // ขยาย colspan ตามจำนวนหัวข้อของเว็บนั้นจริงๆ (ปรับฟอนต์ใหญ่ขึ้น)
        html += `<th colspan="${webTasks.length}" class="border border-slate-300 dark:border-slate-700 p-2 font-black text-sm tracking-wide ${bg}">${web}</th>`;
    });
    html += `</tr><tr>`;
    
    // ---------------- สร้างหัวตาราง (Header) แถวที่สอง หัวข้องาน ----------------
    matrixWebsites.forEach(web => {
        let webTasks = customDutyRoles[web] || customDutyRoles[(web === 'VV72' ? 'Vv72' : web)] || ['ไม่มีหัวข้อ'];
        if (webTasks.length === 0) webTasks = ['-'];
        
        webTasks.forEach(task => {
            // บังคับกว้าง 90px ฟอนต์ใหญ่ขึ้นเป็น xs
            html += `<th class="border border-slate-300 dark:border-slate-700 p-2 text-xs bg-slate-50 dark:bg-slate-800 min-w-[90px]">${task}</th>`;
        });
    });
    html += `</tr></thead><tbody>`;

   // ---------------- สร้างแถวพนักงาน ----------------
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
            html += `<tr class="hover:bg-slate-100 dark:hover:bg-slate-800/50 transition border-b border-slate-200 dark:border-slate-700">`;
            
            if (index === 0) {
                html += `<td rowspan="${shiftStaff.length}" class="border border-slate-300 dark:border-slate-700 font-black text-sm ${shiftColor}">${shiftNameDisplay}</td>`;
            }
            
            html += `<td class="border border-slate-300 dark:border-slate-700 p-2 text-left font-bold text-green-600 dark:text-green-400 pl-3 text-sm">
                <span class="uppercase">${user.username}</span>
            </td>`;
            
            // วนลูปวาดกล่องตัวเลือก (Dropdown) ให้ตรงกับจำนวนหัวข้อเป๊ะๆ
            matrixWebsites.forEach(web => {
                let webTasks = customDutyRoles[web] || customDutyRoles[(web === 'VV72' ? 'Vv72' : web)] || ['ไม่มีหัวข้อ'];
                if (webTasks.length === 0) webTasks = ['-'];
                
                webTasks.forEach(task => {
                    // ปิดช่องถ้าหัวข้อคือ "-"
                    if (task === '-') {
                        html += `<td class="border border-slate-300 dark:border-slate-700 p-1.5 bg-gray-100 dark:bg-slate-800"></td>`;
                    } else {
                        // ปรับขนาด dropdown ให้กว้างขึ้น และตัวหนังสือใหญ่ขึ้น
                        html += `<td class="border border-slate-300 dark:border-slate-700 p-1.5">
                            <select class="text-xs p-1 rounded outline-none cursor-pointer bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 font-bold focus:ring-2 focus:ring-blue-500 w-full min-w-[90px] text-center shadow-sm">
                                <option value="not" class="text-red-500">🚫 Not</option>
                                <option value="job" class="text-green-500">✅ Job</option>
                                <option value="sup" class="text-yellow-600">👉 Sup</option>
                                <option value="off" class="text-gray-500">⛔ OFF</option>
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
