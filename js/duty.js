let currentDutyDept = 'AM';
let dutyAccessMatrix = {}; 
let customDutyRoles = {}; 
let currentDutyLeaves = new Set(); 
let dutySubscription = null;
let sortedTeams = []; 
let currentRosterData = {};
let window_currentAssignedStaff = [];

const TEAM_COLORS = {
    'Jun88': { bg: 'bg-blue-600', text: 'text-white', border: 'border-blue-800', lightBg: 'bg-blue-100', lightText: 'text-blue-800' },
    'MK8': { bg: 'bg-black', text: 'text-yellow-400', border: 'border-yellow-600', lightBg: 'bg-gray-800', lightText: 'text-yellow-500' },
    'F168': { bg: 'bg-orange-500', text: 'text-white', border: 'border-orange-700', lightBg: 'bg-orange-100', lightText: 'text-orange-800' },
    'PG688': { bg: 'bg-amber-100', text: 'text-amber-900', border: 'border-amber-300', lightBg: 'bg-amber-50', lightText: 'text-amber-700' },
    'JL69': { bg: 'bg-slate-500', text: 'text-white', border: 'border-slate-700', lightBg: 'bg-slate-200', lightText: 'text-slate-800' },
    'TH26': { bg: 'bg-gray-700', text: 'text-white', border: 'border-gray-900', lightBg: 'bg-gray-200', lightText: 'text-gray-800' },
    'VV72': { bg: 'bg-red-800', text: 'text-white', border: 'border-red-950', lightBg: 'bg-red-100', lightText: 'text-red-800' },
    'NM9': { bg: 'bg-pink-500', text: 'text-white', border: 'border-pink-700', lightBg: 'bg-pink-100', lightText: 'text-pink-800' },
    'สอนงาน': { bg: 'bg-emerald-500', text: 'text-white', border: 'border-emerald-700', lightBg: 'bg-emerald-100', lightText: 'text-emerald-800' },
    'Telegram': { bg: 'bg-sky-500', text: 'text-white', border: 'border-sky-700', lightBg: 'bg-sky-100', lightText: 'text-sky-800' },
    'DEFAULT': { bg: 'bg-indigo-500', text: 'text-white', border: 'border-indigo-700', lightBg: 'bg-indigo-100', lightText: 'text-indigo-800' }
};

window.syncTeamOrder = function() {
    if (currentDutyDept === 'TRAINER') {
        const mode = document.getElementById('trainerTaskMode') ? document.getElementById('trainerTaskMode').value : 'normal';
        if (mode === 'telegram') sortedTeams = ['Telegram']; 
        else sortedTeams = ['สอนงาน', 'Telegram'];
    } else {
        const savedOrder = JSON.parse(localStorage.getItem('duty_team_order') || '[]');
        let validSaved = savedOrder.filter(t => TEAM_LIST.includes(t));
        TEAM_LIST.forEach(t => { if(!validSaved.includes(t)) validSaved.push(t); });
        sortedTeams = validSaved;
    }
}

window.moveTeam = function(teamName, direction) {
    if (currentDutyDept === 'TRAINER') return; 
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
        if(teamSelect) teamSelect.innerHTML = TEAM_LIST.map(t => `<option value="${t}">${t}</option>`).join('');
        
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
            if(rolesData && rolesData.value) customDutyRoles = JSON.parse(rolesData.value);
            else { customDutyRoles = {}; TEAM_LIST.forEach(t => customDutyRoles[t] = ['แอดมินหลัก', 'ฝาก-ถอน']); }
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
    const isAdmin = (currentUser.role === 'manager' || currentUser.role === 'admin');
    const isTrainerDept = (currentUser.department === 'TRAINER'); 
    const isTrainerRole = (currentUser.role && currentUser.role.toLowerCase() === 'trainer');

    let canManageDuty = false;
    if (isAdmin) canManageDuty = true; 
    else if (currentDutyDept === 'TRAINER') canManageDuty = false; 
    else canManageDuty = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('duty_manage') : false; 
    
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
        if(currentUser.role === 'manager' || currentUser.role === 'admin') window.updateDutyStats();
    } else {
        document.getElementById('dutyTabSettings').classList.remove('hidden'); document.getElementById('dutyTabSettings').classList.add('flex');
        document.getElementById('dutyTabRoster').classList.add('hidden'); document.getElementById('dutyTabRoster').classList.remove('flex');
        document.getElementById('tabBtnSettings').className = 'px-3 py-1.5 rounded-md text-xs font-bold bg-indigo-500 text-white shadow transition';
        document.getElementById('tabBtnRoster').className = 'px-3 py-1.5 rounded-md text-xs font-bold text-indigo-300 hover:text-white transition';
    }
}

window.switchDutyDept = function(dept) {
    currentDutyDept = dept;
    document.getElementById('btnDutyAM')?.classList.remove('active'); document.getElementById('btnDutyOD')?.classList.remove('active');
    document.getElementById('btnDutyTRAINER')?.classList.remove('active'); document.getElementById(`btnDuty${dept}`)?.classList.add('active');
    
    let labelText = dept === 'TRAINER' ? 'ผู้สอน' : dept;
    const labelEl = document.getElementById('dutyDeptLabel'); if(labelEl) labelEl.innerText = labelText;
    
    const btnManageTrainer = document.getElementById('btnManageTrainer');
    const filterTrainer = document.getElementById('trainerDeptFilterContainer');
    const taskModeContainer = document.getElementById('trainerTaskModeContainer');
    
    if (dept === 'TRAINER') {
        if (btnManageTrainer && (currentUser.role === 'manager' || currentUser.role === 'admin')) btnManageTrainer.classList.remove('hidden');
        if (filterTrainer) filterTrainer.classList.remove('hidden');
        if (taskModeContainer && (currentUser.role === 'manager' || currentUser.role === 'admin')) { taskModeContainer.classList.remove('hidden'); taskModeContainer.classList.add('flex'); }
    } else {
        if (btnManageTrainer) btnManageTrainer.classList.add('hidden');
        if (filterTrainer) filterTrainer.classList.add('hidden');
        if (taskModeContainer) { taskModeContainer.classList.add('hidden'); taskModeContainer.classList.remove('flex'); }
        if (document.getElementById('trainerTaskMode')) document.getElementById('trainerTaskMode').value = 'normal';
    }
    
    const grid = document.getElementById('dutyResultGrid');
    if (grid) grid.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center py-20 text-gray-400"><span class="material-icons animate-spin text-5xl text-indigo-500 mb-2">sync</span><span class="font-bold text-sm">กำลังจัดเตรียมตาราง...</span></div>`;
    
    setTimeout(() => {
        window.syncTeamOrder(); window.applyDutyRoleUI(); window.renderDutyAccessTable(); window.renderDutyRequirements(); window.refreshDutyData(); 
    }, 50);
};

function getDutySaveKey(date, shift) {
    let key = `duty_roster_${currentDutyDept}_${date}_${shift}`;
    if (currentDutyDept === 'TRAINER') {
        const mode = document.getElementById('trainerTaskMode') ? document.getElementById('trainerTaskMode').value : 'normal';
        if (mode === 'telegram') key += '_telegram';
    }
    return key;
}

window.currentDutyLeaveData = []; 

window.refreshDutyData = async function() {
    try {
        // 🌟 ดัก Error: ตรวจสอบก่อนว่ามีกล่องวันที่ให้ดึงค่าไหม
        const targetDateInput = document.getElementById('dutyDate');
        const shiftFilterInput = document.getElementById('dutyShiftSelect');
        
        if (!targetDateInput || !shiftFilterInput) return; // ถ้าไม่มีให้หยุดทำงาน ไม่ต้องโวยวาย Error
        
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
                if (userObj && (userObj.department || 'AM') === currentDutyDept) {
                    relevantLeaves.push({ user_id: userObj.id, username: userObj.username, reason: l.reason, originalShift: userObj.allowed_shift || 'all' });
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

        if (savedRoster && savedRoster.value) {
            const parsedRoster = JSON.parse(savedRoster.value);
            window.renderRosterGrid(parsedRoster); 
            if (btnGen) {
                btnGen.disabled = true; btnGen.innerHTML = '<span class="material-icons text-base">lock</span> จัดแล้ว (ต้องล้างก่อน)';
                btnGen.classList.replace('bg-indigo-600', 'bg-gray-500'); btnGen.classList.replace('hover:bg-indigo-700', 'hover:bg-gray-600');
            }
        } else {
            if(grid) grid.innerHTML = '<div class="col-span-full flex flex-col items-center justify-center py-20 text-gray-400 opacity-50"><span class="material-icons text-6xl mb-2">event_busy</span><span class="font-bold text-lg">ยังไม่มีการจัดเวรในกะนี้</span></div>';
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

        if (typeof currentUser !== 'undefined' && (currentUser.role === 'manager' || currentUser.role === 'admin')) window.updateDutyStats(); 
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

    // 🌟 แก้ไขตรงนี้: สร้างตัวแปรมารับ HTML ก่อน ไม่สั่งเขียนลงหน้าจอซ้ำๆ
    let leaveHtml = '';

    if (filteredLeaves.length > 0) {
        filteredLeaves.sort((a, b) => a.username.localeCompare(b.username));
        filteredLeaves.forEach(l => {
            const rsn = l.reason || 'X';
            let displayRsn = 'หยุด'; let badgeColor = 'text-gray-600 bg-gray-100 border-gray-300'; let boxBorder = 'border-gray-200 dark:border-slate-600';

            if (rsn === 'X' || rsn === 'Table-Booking') { displayRsn = '✕ หยุดปกติ'; badgeColor = 'text-red-700 bg-red-100 border-red-300 dark:bg-red-900/40 dark:text-red-400'; boxBorder = 'border-red-200 dark:border-red-900/50'; } 
            else if (rsn === 'XX') { displayRsn = 'XX เปลี่ยนกะ'; badgeColor = 'text-yellow-800 bg-yellow-100 border-yellow-400 dark:bg-yellow-900/40 dark:text-yellow-400'; boxBorder = 'border-yellow-300 dark:border-yellow-700/50'; } 
            else if (rsn === 'X4') { displayRsn = 'X4 ลาครึ่งวัน'; badgeColor = 'text-pink-700 bg-pink-100 border-pink-300 dark:bg-pink-900/40 dark:text-pink-400'; boxBorder = 'border-pink-200 dark:border-pink-900/50'; } 
            else if (rsn === 'KL') { displayRsn = 'KL ลากิจ'; badgeColor = 'text-green-800 bg-green-100 border-green-400 dark:bg-green-900/40 dark:text-green-400'; boxBorder = 'border-green-300 dark:border-green-800/50'; } 
            else if (rsn === 'TL' || rsn === 'TX') { displayRsn = rsn + ' สลับวันหยุด'; badgeColor = 'text-blue-800 bg-blue-100 border-blue-400 dark:bg-blue-900/40 dark:text-blue-400'; boxBorder = 'border-blue-300 dark:border-blue-800/50'; } 
            else if (rsn === 'PN') { displayRsn = 'PN พักร้อน'; badgeColor = 'text-white bg-amber-800 border-amber-900 dark:bg-amber-900 dark:text-amber-200'; boxBorder = 'border-amber-700 dark:border-amber-800/50'; } 
            else { displayRsn = rsn; }

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
        leaveContainer.innerHTML = leaveHtml; // 🌟 สั่งเขียนลงหน้าจอทีเดียวจบ
    } else { 
        leaveContainer.innerHTML = `<div class="text-center text-[10px] text-gray-400 mt-4">ไม่มีข้อมูลตามตัวกรอง</div>`; 
    }
};

window.restoreFromLeave = async function(userId, username) {
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
            const reportKey = `report_TRAINER_${targetDate}_${shiftFilter}`; 
            
            try {
                let currentDataVal = null;
                const { data: currentData } = await appDB.from('settings').select('value').eq('key', saveKey);
                if (currentData && currentData.length > 0) currentDataVal = currentData[0].value;
                
                if (currentDataVal) {
                    localStorage.setItem(`backup_${saveKey}`, currentDataVal);
                    if (currentDutyDept === 'TRAINER') {
                        let currentReportVal = null;
                        const { data: currentReport } = await appDB.from('settings').select('value').eq('key', reportKey);
                        if (currentReport && currentReport.length > 0) currentReportVal = currentReport[0].value;
                        if (currentReportVal) localStorage.setItem(`backup_${reportKey}`, currentReportVal);
                    }
                }
                
                await appDB.from('settings').delete().eq('key', saveKey);
                if (currentDutyDept === 'TRAINER') await appDB.from('settings').delete().eq('key', reportKey);
                
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
    const reportKey = `report_TRAINER_${targetDate}_${shiftFilter}`;

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
                if (currentDutyDept === 'TRAINER' && backupReport) await appDB.from('settings').upsert([{ key: reportKey, value: backupReport }]);

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

    let targetDateLeaves = new Set();
    try {
        const { data: leaveData } = await appDB.from('leave_requests').select('user_id').eq('leave_date', targetDate);
        if (leaveData) leaveData.forEach(l => targetDateLeaves.add(String(l.user_id)));
    } catch(e) {}

    const activeStaff = GLOBAL_USER_LIST.filter(u => {
        const isCorrectDept = (u.department || 'AM') === currentDutyDept;
        const hasValidRole = (currentDutyDept === 'TRAINER') ? true : (u.role === 'staff');
        const isShiftMatch = (u.allowed_shift === shiftFilter || u.allowed_shift === 'all');
        return hasValidRole && isCorrectDept && isShiftMatch && !targetDateLeaves.has(String(u.id));
    });
    
    let requiredCount = 0; document.querySelectorAll('.req-input').forEach(i => requiredCount += (parseInt(i.value) || 0));

    if(activeStaff.length === 0) return Swal.fire('ข้อมูลไม่พอ', `ไม่มีพนักงานมาทำงานในกะนี้เลย`, 'error');
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
        } catch(e) {}

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

window.manualAdjustReq = async function(changedTeam) {
    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    const targetDate = document.getElementById('dutyDate').value;
    
    let targetDateLeaves = new Set();
    try {
        const { data: leaveData } = await appDB.from('leave_requests').select('user_id').eq('leave_date', targetDate);
        if (leaveData) leaveData.forEach(l => targetDateLeaves.add(String(l.user_id)));
    } catch(e) {}
    
    const activeStaff = GLOBAL_USER_LIST.filter(u => {
        const isCorrectDept = (u.department || 'AM') === currentDutyDept;
        const hasValidRole = (currentDutyDept === 'TRAINER') ? true : (u.role === 'staff');
        const isShiftMatch = (u.allowed_shift === shiftFilter || u.allowed_shift === 'all'); 
        return hasValidRole && isCorrectDept && isShiftMatch && !targetDateLeaves.has(String(u.id));
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

window.autoSuggestRequirements = async function() {
    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    const targetDate = document.getElementById('dutyDate').value;
    if(!targetDate) return Swal.fire('!', 'กรุณาเลือกวันที่ก่อน', 'warning');

    Swal.fire({title: 'กำลังวิเคราะห์ยอดคน...', didOpen: () => Swal.showLoading()});

    let targetDateLeaves = new Set();
    try {
        const { data: leaveData } = await appDB.from('leave_requests').select('user_id').eq('leave_date', targetDate);
        if (leaveData) leaveData.forEach(l => targetDateLeaves.add(String(l.user_id)));
    } catch(e) {}

    const activeStaff = GLOBAL_USER_LIST.filter(u => {
        const isCorrectDept = (u.department || 'AM') === currentDutyDept;
        const hasValidRole = (currentDutyDept === 'TRAINER') ? true : (u.role === 'staff');
        const isShiftMatch = (u.allowed_shift === shiftFilter || u.allowed_shift === 'all');
        return hasValidRole && isCorrectDept && isShiftMatch && !targetDateLeaves.has(String(u.id));
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

window.updateDutyStats = async function() {
    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    const targetDate = document.getElementById('dutyDate') ? document.getElementById('dutyDate').value : new Date().toISOString().split('T')[0];
    const statusBar = document.getElementById('dutyStatusBar');
    if(!statusBar) return;

    let targetDateLeaves = new Set();
    try {
        const { data: leaveData } = await appDB.from('leave_requests').select('user_id').eq('leave_date', targetDate);
        if (leaveData) leaveData.forEach(l => targetDateLeaves.add(String(l.user_id)));
    } catch(e) {}

    const activeStaff = GLOBAL_USER_LIST.filter(u => {
        const isCorrectDept = (u.department || 'AM') === currentDutyDept;
        const hasValidRole = (currentDutyDept === 'TRAINER') ? true : (u.role === 'staff');
        const isShiftMatch = (u.allowed_shift === shiftFilter || u.allowed_shift === 'all');
        return hasValidRole && isCorrectDept && isShiftMatch && !targetDateLeaves.has(String(u.id));
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
        statusHTML = `ℹ️ กรุณาใส่จำนวนคนให้แต่ละเว็บ (คนพร้อมทำเวร: ${availableCount} คน)`;
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
            if (payload && payload[0] && payload[0].key && payload[0].key.startsWith('report_TRAINER_')) {
                const parts = payload[0].key.split('_');
                const dateStr = parts[2];
                const shiftStr = parts[3];
                
                await appDB.from('system_logs').insert([{ 
                    action_type: 'ประเมินงานผู้สอน', 
                    performed_by: currentUser.username, 
                    target_details: `ลงข้อมูลประเมินการทำงาน (กะ: ${shiftStr}, วันที่: ${dateStr})` 
                }]);
                
                appDB.channel('duty-updates').send({ type: 'broadcast', event: 'force_reload' });
            }
        } catch(e) {}
        return result;
    };
}
