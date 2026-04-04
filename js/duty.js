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
    Swal.fire({title: 'โหลดข้อมูล...', didOpen: () => Swal.showLoading()});
    
    const dateInput = document.getElementById('dutyDate');
    if (dateInput && !dateInput.value) {
        const today = new Date();
        const offset = today.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(today - offset)).toISOString().slice(0, 10);
        dateInput.value = localISOTime;
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
    Swal.close();
}

window.subscribeDutyChanges = function() {
    if(dutySubscription) appDB.removeChannel(dutySubscription);
    dutySubscription = appDB.channel('duty-updates')
    .on('broadcast', { event: 'force_reload' }, () => {
        if (!document.getElementById('dutyApp').classList.contains('hidden')) {
            window.refreshDutyData();
        }
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
            trainerBtn.classList.remove('hidden', 'no-perm-hidden'); 
            trainerBtn.style.display = '';
        } else {
            trainerBtn.classList.add('hidden');
        }
    }
    
    if (!canManageDuty) {
        adminElements.forEach(el => { el.style.display = 'none'; el.classList.add('hidden'); });
        const shiftSelect = document.getElementById('dutyShiftSelect');
        if (shiftSelect && currentUser.allowed_shift !== 'all') shiftSelect.value = currentUser.allowed_shift;
        const indicator = document.getElementById('staffShiftIndicator');
        if (indicator) {
            indicator.classList.remove('hidden', 'no-perm-hidden');
            indicator.style.display = '';
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
        document.getElementById('dutyTabRoster').classList.remove('hidden');
        document.getElementById('dutyTabRoster').classList.add('flex');
        document.getElementById('dutyTabSettings').classList.add('hidden');
        document.getElementById('dutyTabSettings').classList.remove('flex');
        
        document.getElementById('tabBtnRoster').className = 'px-3 py-1.5 rounded-md text-xs font-bold bg-indigo-500 text-white shadow transition';
        document.getElementById('tabBtnSettings').className = 'px-3 py-1.5 rounded-md text-xs font-bold text-indigo-300 hover:text-white transition';
        window.renderDutyRequirements();
        if(currentUser.role === 'manager' || currentUser.role === 'admin') window.updateDutyStats();
    } else {
        document.getElementById('dutyTabSettings').classList.remove('hidden');
        document.getElementById('dutyTabSettings').classList.add('flex');
        document.getElementById('dutyTabRoster').classList.add('hidden');
        document.getElementById('dutyTabRoster').classList.remove('flex');
        
        document.getElementById('tabBtnSettings').className = 'px-3 py-1.5 rounded-md text-xs font-bold bg-indigo-500 text-white shadow transition';
        document.getElementById('tabBtnRoster').className = 'px-3 py-1.5 rounded-md text-xs font-bold text-indigo-300 hover:text-white transition';
    }
}

window.switchDutyDept = function(dept) {
    currentDutyDept = dept;
    document.getElementById('btnDutyAM')?.classList.remove('active');
    document.getElementById('btnDutyOD')?.classList.remove('active');
    document.getElementById('btnDutyTRAINER')?.classList.remove('active');
    document.getElementById(`btnDuty${dept}`)?.classList.add('active');
    
    let labelText = dept;
    if(dept === 'TRAINER') labelText = 'ผู้สอน';
    const labelEl = document.getElementById('dutyDeptLabel');
    if(labelEl) labelEl.innerText = labelText;
    
    const btnManageTrainer = document.getElementById('btnManageTrainer');
    const filterTrainer = document.getElementById('trainerDeptFilterContainer');
    const taskModeContainer = document.getElementById('trainerTaskModeContainer');
    
    if (dept === 'TRAINER') {
        if (btnManageTrainer && (currentUser.role === 'manager' || currentUser.role === 'admin')) btnManageTrainer.classList.remove('hidden');
        if (filterTrainer) filterTrainer.classList.remove('hidden');
        if (taskModeContainer && (currentUser.role === 'manager' || currentUser.role === 'admin')) {
            taskModeContainer.classList.remove('hidden'); taskModeContainer.classList.add('flex');
        }
    } else {
        if (btnManageTrainer) btnManageTrainer.classList.add('hidden');
        if (filterTrainer) filterTrainer.classList.add('hidden');
        if (taskModeContainer) { taskModeContainer.classList.add('hidden'); taskModeContainer.classList.remove('flex'); }
        if (document.getElementById('trainerTaskMode')) document.getElementById('trainerTaskMode').value = 'normal';
    }
    
    const grid = document.getElementById('dutyResultGrid');
    if (grid) {
        grid.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center py-20 text-gray-400">
            <span class="material-icons animate-spin text-5xl text-indigo-500 mb-2">sync</span>
            <span class="font-bold text-sm">กำลังจัดเตรียมตาราง...</span>
        </div>`;
    }
    
    setTimeout(() => {
        window.syncTeamOrder();
        window.applyDutyRoleUI(); 
        window.renderDutyAccessTable();
        window.renderDutyRequirements();
        window.refreshDutyData(); 
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
    const targetDate = document.getElementById('dutyDate').value;
    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    if(!targetDate) return;

    const { data: leaves } = await appDB.from('leave_requests').select('user_id, reason, user_name').eq('leave_date', targetDate);

    currentDutyLeaves = new Set();
    if (leaves) { leaves.forEach(l => currentDutyLeaves.add(String(l.user_id))); }

    const relevantLeaves = [];
    if (leaves && GLOBAL_USER_LIST.length > 0) {
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
    const { data: savedRoster } = await appDB.from('settings').select('value').eq('key', saveKey).single();
    const btnGen = document.getElementById('btnGenerateRoster');

    if (savedRoster && savedRoster.value) {
        const parsedRoster = JSON.parse(savedRoster.value);
        window.renderRosterGrid(parsedRoster); 
        if (btnGen) {
            btnGen.disabled = true;
            btnGen.innerHTML = '<span class="material-icons text-base">lock</span> จัดแล้ว (ต้องล้างก่อน)';
            btnGen.classList.replace('bg-indigo-600', 'bg-gray-500');
            btnGen.classList.replace('hover:bg-indigo-700', 'hover:bg-gray-600');
        }
    } else {
        document.getElementById('dutyResultGrid').innerHTML = '<div class="col-span-full flex flex-col items-center justify-center py-20 text-gray-400 opacity-50"><span class="material-icons text-6xl mb-2">event_busy</span><span class="font-bold text-lg">ยังไม่มีการจัดเวรในกะนี้</span></div>';
        if (btnGen) {
            btnGen.disabled = false;
            btnGen.innerHTML = '<span class="material-icons text-base">casino</span> สุ่มจัดหน้าที่';
            btnGen.classList.replace('bg-gray-500', 'bg-indigo-600');
            btnGen.classList.replace('hover:bg-gray-600', 'hover:bg-indigo-700');
        }
    }

    const backupData = localStorage.getItem(`backup_${saveKey}`);
    const btnRestore = document.getElementById('btnRestoreRoster');
    if (btnRestore) {
        if (backupData && (!savedRoster || !savedRoster.value)) btnRestore.classList.remove('hidden');
        else btnRestore.classList.add('hidden');
    }

    if (currentUser.role === 'manager' || currentUser.role === 'admin') window.updateDutyStats(); 
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
    leaveContainer.innerHTML = '';

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

            leaveContainer.innerHTML += `
                <div onclick="restoreFromLeave('${l.user_id}', '${l.username}')" title="คลิกเพื่อดึงกลับมาทำงาน" class="bg-white dark:bg-slate-700 p-1.5 rounded-lg border ${boxBorder} shadow-sm flex justify-between items-center mb-1.5 transition-all hover:bg-blue-50 dark:hover:bg-slate-600 group cursor-pointer hover:border-blue-500">
                    <span class="text-[11px] font-bold text-slate-700 dark:text-gray-200 truncate pr-2 flex items-center">
                        <span class="material-icons text-[14px] text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity mr-1">settings_backup_restore</span>
                        ${l.username} ${shiftTag}
                    </span>
                    <span class="text-[9px] font-black ${badgeColor} px-1.5 py-0.5 rounded border shadow-sm whitespace-nowrap group-hover:scale-105 transition-transform">${displayRsn}</span>
                </div>
            `;
        });
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
        } catch (err) {
            Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
        }
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
                const { data: currentData } = await appDB.from('settings').select('value').eq('key', saveKey).single();
                if (currentData && currentData.value) {
                    localStorage.setItem(`backup_${saveKey}`, currentData.value);
                    if (currentDutyDept === 'TRAINER') {
                        const { data: currentReport } = await appDB.from('settings').select('value').eq('key', reportKey).single();
                        if (currentReport && currentReport.value) localStorage.setItem(`backup_${reportKey}`, currentReport.value);
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

// ==========================================
// 🧠 อัลกอริทึม สุ่มจัดหน้าที่ (Algorithm)
// ==========================================
window.generateDutyRoster = async function() {
    const targetDate = document.getElementById('dutyDate').value;
    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    if(!targetDate) return Swal.fire('!', 'กรุณาเลือกวันที่ก่อน', 'warning');

    const saveKeyCheck = getDutySaveKey(targetDate, shiftFilter);
    const { data: checkExist } = await appDB.from('settings').select('value').eq('key', saveKeyCheck).single();
    if (checkExist && checkExist.value) {
         window.refreshDutyData(); 
         return Swal.fire('ป้องกันการจัดซ้ำ!', 'กะนี้มีการจัดหน้าที่ไปแล้ว กรุณากดปุ่ม "ล้างตาราง" ก่อนสุ่มใหม่ครับ', 'warning');
    }

    const activeStaff = GLOBAL_USER_LIST.filter(u => {
        const isCorrectDept = (u.department || 'AM') === currentDutyDept;
        const hasValidRole = (currentDutyDept === 'TRAINER') ? true : (u.role === 'staff');
        const isShiftMatch = (u.allowed_shift === shiftFilter || u.allowed_shift === 'all');
        return hasValidRole && isCorrectDept && isShiftMatch && !currentDutyLeaves.has(String(u.id));
    });
    
    let requiredCount = 0; document.querySelectorAll('.req-input').forEach(i => requiredCount += (parseInt(i.value) || 0));

    if(activeStaff.length === 0) return Swal.fire('ข้อมูลไม่พอ', `ไม่มีพนักงานมาทำงานในกะนี้เลย`, 'error');
    if(requiredCount > activeStaff.length) return Swal.fire('ขาดคน!', `คุณจัดงาน ${requiredCount} คน แต่มีคนว่างแค่ ${activeStaff.length} คน (กรุณาลดจำนวน)`, 'error');

    Swal.fire({title: 'กำลังสุ่มและวิเคราะห์...', text: 'ระบบกำลังจับคู่งานหลักและกระจายงานรองให้สมดุล...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});

    try {
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

        // 🌟 Step 1: สุ่มงานหลัก
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
                return { user: u, flexibility: viableTeamsCount, access: access }; 
            });

            userOptions.sort((a, b) => {
                if (a.flexibility === b.flexibility) return Math.random() - 0.5;
                return a.flexibility - b.flexibility;
            });

            let pickedUser = { ...userOptions[0].user }; 
            rosterResult[teamToFill].push(pickedUser);
            remainingReqs[teamToFill]--;
            unassignedPool = unassignedPool.filter(u => u.id !== pickedUser.id);
        }

        // 🌟 Step 2: ระบบกระจายงานรองให้สมดุล (Balancing Algorithm)
        let secondaryCounts = {};
        sortedTeams.forEach(t => secondaryCounts[t] = 0); 
        let allAssignedUsers = [];
        
        for (const primaryTeam in rosterResult) {
            rosterResult[primaryTeam].forEach(u => {
                if (!u.username.includes('ขาดคน')) {
                    allAssignedUsers.push({ userObj: u, primaryTeam: primaryTeam });
                }
            });
        }

        allAssignedUsers.sort(() => Math.random() - 0.5);

        allAssignedUsers.forEach(item => {
            const u = item.userObj;
            const primaryTeam = item.primaryTeam;
            const access = dutyAccessMatrix[u.id] || [];
            let possibleSecondary = access.filter(t => t !== primaryTeam && sortedTeams.includes(t));

            if (possibleSecondary.length > 0) {
                possibleSecondary.sort((teamA, teamB) => secondaryCounts[teamA] - secondaryCounts[teamB]);
                const minCount = secondaryCounts[possibleSecondary[0]];
                const minTeams = possibleSecondary.filter(t => secondaryCounts[t] === minCount);
                const pickedSecondary = minTeams[Math.floor(Math.random() * minTeams.length)];

                u.secondary_team = pickedSecondary;
                secondaryCounts[pickedSecondary]++; 
            } else {
                u.secondary_team = null; 
            }
        });

        const saveKey = getDutySaveKey(targetDate, shiftFilter);
        const { error } = await appDB.from('settings').upsert([{ key: saveKey, value: JSON.stringify(rosterResult) }]);
        if (error) throw error;

        try {
            await appDB.from('system_logs').insert([{ 
                action_type: 'สุ่มจัดหน้าที่', 
                performed_by: currentUser.username, 
                target_details: `สุ่มจัดเวรแผนก ${currentDutyDept} (กะ: ${shiftFilter}, วันที่: ${targetDate})` 
            }]);
            if(appDB.channel) appDB.channel('duty-updates').send({ type: 'broadcast', event: 'force_reload' });
        } catch(logError) {}

        window.refreshDutyData(); 
        
        if (unassignedPool.length > 0) {
            const leftNames = unassignedPool.map(u => u.username).join(', ');
            Swal.fire({ 
                icon: 'warning', 
                title: `จัดสำเร็จ! (แต่มีคนไม่ได้ลงเว็บ)`, 
                html: `เหลือพนักงานไม่ได้ลงเว็บ <b>${unassignedPool.length} คน</b> เพราะไม่ได้ติ๊กสิทธิ์หลังบ้านไว้:<br><br><span class="text-red-500 font-bold">${leftNames}</span>` 
            });
        } else {
            Swal.fire({ icon: 'success', title: `จัดคนพอดีเป๊ะ 100%`, timer: 2000, showConfirmButton: false });
        }

    } catch(e) { 
        console.error(e); 
        Swal.fire('Error', e.message, 'error'); 
    }
};

window.renderRosterGrid = async function(rosterData) {
    const grid = document.getElementById('dutyResultGrid');
    if(!grid) return;
    grid.innerHTML = '';
    currentRosterData = rosterData; 
    
    const isAdmin = (currentUser && (currentUser.role === 'manager' || currentUser.role === 'admin'));

    let trainerReports = {};
    const targetDate = document.getElementById('dutyDate') ? document.getElementById('dutyDate').value : '';
    const shiftFilter = document.getElementById('dutyShiftSelect') ? document.getElementById('dutyShiftSelect').value : '';
    
    if (currentDutyDept === 'TRAINER' && targetDate) {
        const reportKey = `report_TRAINER_${targetDate}_${shiftFilter}`;
        try {
            const { data: reportData } = await appDB.from('settings').select('value').eq('key', reportKey).single();
            if (reportData && reportData.value) trainerReports = JSON.parse(reportData.value);
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
                            <span class="text-[9.5px] font-bold text-gray-500 dark:text-gray-400 tracking-wide">สแตนด์บาย :</span>
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
            </div>
            `;
        }).join('');

        let trainerReportHtml = '';
        if (currentDutyDept === 'TRAINER') {
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

            const isTrainerStaff = (currentUser.department === 'TRAINER');
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

        grid.innerHTML += `
            <div class="duty-site-card bg-slate-50 dark:bg-slate-900 border-2 ${colorClass.border} rounded-2xl shadow-md flex flex-col h-[500px] overflow-hidden">
                <div class="flex justify-between items-center ${colorClass.bg} ${colorClass.text} p-3 shadow-sm shrink-0">
                    <div class="flex items-center flex-wrap gap-2 w-full">
                        <h4 class="font-black text-base pointer-events-none tracking-wide">${team}</h4>
                        <div class="flex items-center gap-2 ml-auto">
                            <div class="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-lg shadow-inner whitespace-nowrap border border-white/30 flex items-center gap-1" style="color: inherit;">
                                <span class="opacity-80">หลัก</span><span class="text-xs font-black bg-black/20 px-1 rounded-md">${primaryCount}</span>
                            </div>
                            <button onclick="viewStandbyList('${team}')" class="cursor-pointer text-[10px] font-extrabold bg-gradient-to-br from-amber-300 to-yellow-500 text-amber-950 px-2 py-0.5 rounded-lg shadow-md whitespace-nowrap transition hover:from-amber-200 hover:to-yellow-400 hover:scale-105 border border-amber-600 flex items-center gap-1 active:scale-95">
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
};

// ==========================================
// 🧠 อัลกอริทึม คำนวณยอดคน และ เปลี่ยนงานรอง
// ==========================================
window.autoCalculateTeamQuotas = async function() {
    const rows = document.querySelectorAll('.quota-row-team');
    if (rows.length === 0) return Swal.fire('เตือน', 'ไม่มีรายชื่อทีมให้คำนวณ', 'warning');

    let defaultDate = document.getElementById('wDate') ? document.getElementById('wDate').value : '';
    if (!defaultDate) {
        const today = new Date(); const offset = today.getTimezoneOffset() * 60000;
        defaultDate = (new Date(today - offset)).toISOString().slice(0, 10);
    }

    const { value: selectedDate } = await Swal.fire({
        title: 'เลือกวันที่จัดหน้าที่', text: 'ระบบจะดึงยอดคนที่ได้ลงเวรจริงมาคำนวณโควตา',
        input: 'date', inputValue: defaultDate,
        showCancelButton: true, confirmButtonColor: '#0891b2'
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
                const dept = parts[2]; const shift = parts[4];
                if (rosters[dept] && rosters[dept][shift]) rosters[dept][shift] = JSON.parse(row.value);
            });
        }

        let sumM = 0, sumA = 0, sumN = 0, sumOdM = 0, sumOdA = 0, sumOdN = 0, updatedCount = 0;

        function calculateQuotaByRule(totalStaff) {
            if (totalStaff === 0) return 0;
            if (totalStaff <= 4) return 1;  if (totalStaff <= 7) return 2;  if (totalStaff <= 10) return 3; 
            if (totalStaff <= 14) return 4; if (totalStaff <= 20) return 5; if (totalStaff <= 25) return 6; 
            if (totalStaff <= 30) return 7; return 8;                       
        }

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

            let countM = getCountFromRoster('กะเช้า'); let countA = getCountFromRoster('กะกลาง'); let countN = getCountFromRoster('กะดึก');
            const qM = calculateQuotaByRule(countM); const qA = calculateQuotaByRule(countA); const qN = calculateQuotaByRule(countN);

            row.querySelector('.val-m').value = qM; row.querySelector('.val-a').value = qA; row.querySelector('.val-n').value = qN;

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

        Swal.fire({ icon: 'success', title: 'คำนวณสำเร็จ!', html: `อัปเดตโควตาให้แล้ว ${updatedCount} ทีม<br><span class="text-sm text-red-500 font-bold">* อย่าลืมกดปุ่ม "บันทึกโควตา"</span>`});
    } catch (error) { Swal.fire('Error', 'เกิดข้อผิดพลาดในการดึงข้อมูลตารางงาน', 'error'); }
};

window.autoSuggestRequirements = function() {
    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    const targetDate = document.getElementById('dutyDate').value;
    if(!targetDate) return Swal.fire('!', 'กรุณาเลือกวันที่ก่อน', 'warning');

    const activeStaff = GLOBAL_USER_LIST.filter(u => {
        const isCorrectDept = (u.department || 'AM') === currentDutyDept;
        const hasValidRole = (currentDutyDept === 'TRAINER') ? true : (u.role === 'staff');
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
            icon: 'warning', title: 'มีคนไม่มีสิทธิ์!', 
            html: `ระบบดึงคนมาคำนวณทั้งหมด ${activeStaff.length} คน<br>แต่พบพนักงาน <b>${unassignedUsers.length} คน</b> ที่ไม่มีสิทธิ์เข้าเว็บใดๆ เลย:<br><br><span class="text-red-500 font-bold">${unassignedUsers.join(', ')}</span>`
        });
    } else {
        const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
        Toast.fire({ icon: 'success', title: 'คำนวณยอดคนออโต้สำเร็จ!' });
    }
}

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
                <div class="text-left"><div class="font-bold text-slate-700 dark:text-gray-200 text-sm">ปลดงานรองออก</div></div>
            </div>
        </div>`;

    possibleSecondary.forEach(t => {
        const isActive = currentSec === t ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/30 shadow-md' : 'bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20';
        const teamColor = TEAM_COLORS[t] || TEAM_COLORS['DEFAULT'];
        htmlContent += `
            <div onclick="selectSecOption(this, '${t}')" class="sec-opt p-3 rounded-xl border border-gray-200 dark:border-slate-600 cursor-pointer transition-all flex items-center justify-between group overflow-hidden relative ${isActive}">
                <div class="absolute left-0 top-0 bottom-0 w-1.5 ${teamColor.bg}"></div>
                <div class="flex items-center gap-3 pl-3 z-10">
                    <div class="w-10 h-10 rounded-full ${teamColor.lightBg} ${teamColor.lightText} flex items-center justify-center font-bold text-sm shadow-inner group-hover:scale-110 transition">${t.substring(0,2)}</div>
                    <div class="text-left"><div class="font-black text-slate-800 dark:text-white text-base">${t}</div></div>
                </div>
            </div>`;
    });
    
    htmlContent += `</div><input type="hidden" id="swal-sec-val" value="${currentSec || 'none'}">`;

    const { isConfirmed } = await Swal.fire({
        title: `<div class="text-xl font-black mb-1">สแตนด์บายช่วย (${username})</div>`,
        html: `<div class="text-xs text-gray-500 mb-2">กดเลือกการ์ดด้านล่างเพื่อกำหนดงานรอง</div>${htmlContent}`,
        showCancelButton: true, confirmButtonText: 'บันทึกงานรอง', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#3b82f6',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl' },
        preConfirm: () => document.getElementById('swal-sec-val').value
    });

    if (isConfirmed) {
        const selectedSec = document.getElementById('swal-sec-val').value;
        let userIndex = currentRosterData[primaryTeam].findIndex(u => String(u.id) === String(userId));
        
        if(userIndex > -1) {
            currentRosterData[primaryTeam][userIndex].secondary_team = selectedSec === 'none' ? null : selectedSec;
            const targetDate = document.getElementById('dutyDate').value;
            const shiftFilter = document.getElementById('dutyShiftSelect').value;
            const saveKey = getDutySaveKey(targetDate, shiftFilter);
            
            Swal.fire({title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen:()=>Swal.showLoading()});
            await appDB.from('settings').upsert([{ key: saveKey, value: JSON.stringify(currentRosterData) }]);
            
            window.renderRosterGrid(currentRosterData); 
            if(appDB.channel) appDB.channel('duty-updates').send({ type: 'broadcast', event: 'force_reload' }); 
            Swal.fire({icon: 'success', title: 'อัปเดตงานรองแล้ว!', timer: 1200, showConfirmButton: false});
        }
    }
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