// ==========================================
// 🔄 ระบบสลับกะการทำงาน (SWAP SHIFT MANAGER)
// ==========================================

let generatedSwapPlan = []; 
let excludeMList = []; 
let excludeNList = []; 
let activeSwapTypeFilter = 'all';
let activeSwapDeptFilter = 'AM';
let draggedSwapUser = null;

// ฟังก์ชันเปิดหน้าจอ
window.openAutoSwapModal = async function() {
    const adminPanel = document.getElementById('adminSwapControls');
    const previewPanel = document.getElementById('swapPlanPreview');
    const managerToolbar = document.getElementById('managerSwapToolbar');

    if (typeof GLOBAL_USER_LIST === 'undefined' || GLOBAL_USER_LIST.length === 0) {
        await fetchUsers();
    }

    await fetchPublicSwapSchedule();
    
    if (currentUser && (currentUser.role === 'manager' || currentUser.role === 'admin')) {
        if(adminPanel) adminPanel.style.display = 'block';
        if(managerToolbar) managerToolbar.style.display = 'flex';
        if(previewPanel) previewPanel.style.display = 'none';
        
        if(typeof clearExcludeStaff === 'function') clearExcludeStaff();

        const now = new Date();
        now.setMonth(now.getMonth() + 1);
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        
        if(document.getElementById('swapStartDate')) document.getElementById('swapStartDate').value = `${y}-${m}-01`;
        if(document.getElementById('swapEndDate')) document.getElementById('swapEndDate').value = `${y}-${m}-06`;

        updateSwapMonthLabel();
        if(typeof checkSwapBackup === 'function') window.checkSwapBackup();
    } else {
        if(adminPanel) adminPanel.style.display = 'none';
        if(managerToolbar) managerToolbar.style.display = 'none';
        if(previewPanel) previewPanel.style.display = 'none';
    }
}

window.updateSwapMonthLabel = function() {
    const startDateVal = document.getElementById('swapStartDate').value;
    if(startDateVal) {
        const d = new Date(startDateVal);
        const monthStr = d.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
        const label = document.getElementById('swapTargetMonthLabel');
        if(label) label.innerText = `(อิงวันหยุดเดือน: ${monthStr})`;
    }
}

window.clearExcludeStaff = function() {
    excludeMList = []; excludeNList = [];
    renderExcludeTags('กะเช้า'); renderExcludeTags('กะดึก');
    document.getElementById('swapPlanPreview').style.display = 'none';
}

window.searchExcludeStaff = function(shiftType) {
    const inputId = shiftType === 'กะเช้า' ? 'searchExcludeM' : 'searchExcludeN';
    const dropId = shiftType === 'กะเช้า' ? 'dropdownExcludeM' : 'dropdownExcludeN';
    const searchText = document.getElementById(inputId).value.toLowerCase();
    const dropdown = document.getElementById(dropId);
    const targetDept = document.getElementById('swapDeptSelect').value;

    if (!searchText) { dropdown.classList.add('hidden'); return; }

    const availableUsers = GLOBAL_USER_LIST.filter(u => {
        const uDept = u.department || 'AM'; 
        if (u.role !== 'staff' && u.role !== 'trainer' && uDept !== 'TRAINER') return false;
        if (u.allowed_shift !== shiftType) return false;
        if (targetDept !== 'ALL' && uDept !== targetDept) return false;
        if (!u.username.toLowerCase().includes(searchText)) return false;
        if (shiftType === 'กะเช้า' && excludeMList.find(e => e.id === u.id)) return false;
        if (shiftType === 'กะดึก' && excludeNList.find(e => e.id === u.id)) return false;
        return true;
    });

    if (availableUsers.length > 0) {
        dropdown.innerHTML = availableUsers.map(u => {
            return window.renderTemplate('tpl-swap-exclude-dropdown-item', {
                id: u.id,
                shiftType: shiftType,
                username: u.username,
                dept: u.department || 'AM'
            });
        }).join('');
    } else {
        dropdown.innerHTML = `<div class="px-3 py-2 text-gray-400 text-xs text-center">ไม่พบรายชื่อ หรือถูกเลือกไปแล้ว</div>`;
    }
    dropdown.classList.remove('hidden');
}

window.addExcludeStaff = function(userId, shiftType) {
    const user = GLOBAL_USER_LIST.find(u => u.id === userId);
    if (!user) return;
    if (shiftType === 'กะเช้า') {
        excludeMList.push(user); document.getElementById('searchExcludeM').value = ''; document.getElementById('dropdownExcludeM').classList.add('hidden');
    } else {
        excludeNList.push(user); document.getElementById('searchExcludeN').value = ''; document.getElementById('dropdownExcludeN').classList.add('hidden');
    }
    document.getElementById('swapPlanPreview').style.display = 'none';
    renderExcludeTags(shiftType);
}

window.removeExcludeStaff = function(userId, shiftType) {
    if (shiftType === 'กะเช้า') excludeMList = excludeMList.filter(u => u.id !== userId);
    else excludeNList = excludeNList.filter(u => u.id !== userId);
    document.getElementById('swapPlanPreview').style.display = 'none';
    renderExcludeTags(shiftType);
}

window.renderExcludeTags = function(shiftType) {
    const containerId = shiftType === 'กะเช้า' ? 'tagsExcludeM' : 'tagsExcludeN';
    const container = document.getElementById(containerId);
    const list = shiftType === 'กะเช้า' ? excludeMList : excludeNList;
    const colorClass = shiftType === 'กะเช้า' ? 'bg-orange-100 text-orange-800 border-orange-200' : 'bg-purple-100 text-purple-800 border-purple-200';

    if (list.length === 0) {
        container.innerHTML = `<span class="text-gray-400 text-[10px] italic w-full text-center py-2">ยังไม่มีรายชื่อ</span>`;
        return;
    }
    container.innerHTML = list.map(u => {
        return window.renderTemplate('tpl-swap-exclude-tag', {
            colorClass: colorClass,
            username: u.username,
            id: u.id,
            shiftType: shiftType
        });
    }).join('');
}

document.addEventListener('click', function(event) {
    const mInput = document.getElementById('searchExcludeM'); const nInput = document.getElementById('searchExcludeN');
    const mDrop = document.getElementById('dropdownExcludeM'); const nDrop = document.getElementById('dropdownExcludeN');
    if (mInput && !mInput.contains(event.target) && !mDrop.contains(event.target)) mDrop.classList.add('hidden');
    if (nInput && !nInput.contains(event.target) && !nDrop.contains(event.target)) nDrop.classList.add('hidden');
});

function getSafeDateStr(baseDateStr, offsetDays) {
    const d = new Date(baseDateStr + 'T12:00:00'); d.setDate(d.getDate() + offsetDays); return d.toISOString().split('T')[0];
}

window.generateSwapPlan = async function() {
    try { 
        const startDateVal = document.getElementById('swapStartDate').value;
        const endDateVal = document.getElementById('swapEndDate').value;
        const targetDept = document.getElementById('swapDeptSelect').value; 
        
        if (!startDateVal || !endDateVal) return Swal.fire('แจ้งเตือน', 'กรุณาระบุวันที่เริ่มต้นและสิ้นสุด', 'warning');
        const startDateObj = new Date(startDateVal); const endDateObj = new Date(endDateVal);
        if (startDateObj > endDateObj) return Swal.fire('แจ้งเตือน', 'วันที่เริ่มต้น ต้องมาก่อนวันที่สิ้นสุด', 'warning');
        const diffTime = Math.abs(endDateObj - startDateObj);
        const daysToDistribute = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        if (daysToDistribute > 31) return Swal.fire('แจ้งเตือน', 'ช่วงเวลาห่างกันเกินไป (ไม่ควรเกิน 1 เดือน)', 'warning');

        const targetMonthStr = startDateObj.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
        Swal.fire({ title: 'กำลังคำนวณแผน...', text: `ระบบกำลังดึงข้อมูลวันหยุดของเดือน "${targetMonthStr}" มาคำนวณ`, didOpen: () => Swal.showLoading() });

        await fetchUsers(); 
        let userLeaves = {};
        try {
            const bufferStart = getSafeDateStr(startDateVal, -7); const bufferEnd = getSafeDateStr(endDateVal, 7);
            const { data: leaveData } = await appDB.from('leave_requests').select('user_id, leave_date').gte('leave_date', bufferStart).lte('leave_date', bufferEnd);
            if (leaveData) { leaveData.forEach(l => { if (!userLeaves[l.user_id]) userLeaves[l.user_id] = new Set(); userLeaves[l.user_id].add(l.leave_date); }); }
        } catch (dbError) {}

        const hasLeave = (userId, dateStr) => userLeaves[userId] && userLeaves[userId].has(dateStr);

        let mStaff = GLOBAL_USER_LIST.filter(u => {
            const uDept = u.department || 'AM';
            if (u.allowed_shift !== 'กะเช้า') return false;
            if (targetDept === 'TRAINER') { if (uDept === 'AM' || uDept === 'OD') return false; } 
            else if (targetDept !== 'ALL') { if (uDept !== targetDept) return false; }
            if (excludeMList.some(e => e.id === u.id)) return false;
            return true;
        });

        let nStaff = GLOBAL_USER_LIST.filter(u => {
            const uDept = u.department || 'AM';
            if (u.allowed_shift !== 'กะดึก') return false;
            if (targetDept === 'TRAINER') { if (uDept === 'AM' || uDept === 'OD') return false; } 
            else if (targetDept !== 'ALL') { if (uDept !== targetDept) return false; }
            if (excludeNList.some(e => e.id === u.id)) return false;
            return true;
        });

        if (mStaff.length === 0 && nStaff.length === 0) return Swal.fire('ไม่พบข้อมูล', `ไม่มีพนักงานให้สลับในแผนกที่เลือก`, 'error');

        mStaff.sort(() => Math.random() - 0.5); nStaff.sort(() => Math.random() - 0.5);

        let mBuckets = Array.from({length: daysToDistribute}, () => []);
        let nBuckets = Array.from({length: daysToDistribute}, () => []);
        let failedMStaff = []; let failedNStaff = [];

        for (let u of mStaff) {
            let bestDayIndex = -1; let minCount = Infinity; let validDaysStrict = []; let validDaysLoose = [];  
            for (let i = 0; i < daysToDistribute; i++) {
                const targetDate = getSafeDateStr(startDateVal, i); const prevDate = getSafeDateStr(targetDate, -1); const nextDate = getSafeDateStr(targetDate, 1);
                if (!hasLeave(u.id, targetDate)) {
                    validDaysLoose.push(i);
                    if (!hasLeave(u.id, prevDate) && !hasLeave(u.id, nextDate)) validDaysStrict.push(i);
                }
            }
            let daysToConsider = validDaysStrict.length > 0 ? validDaysStrict : validDaysLoose;
            if (daysToConsider.length > 0) {
                for (let idx of daysToConsider) { if (mBuckets[idx].length < minCount) { minCount = mBuckets[idx].length; bestDayIndex = idx; } }
            }
            if (bestDayIndex !== -1) mBuckets[bestDayIndex].push(u); else failedMStaff.push(u); 
        }

        for (let u of nStaff) {
            let bestDayIndex = -1; let minCount = Infinity; let validDaysStrict = []; let validDaysLoose = [];
            for (let i = 0; i < daysToDistribute; i++) {
                const gapDate = getSafeDateStr(startDateVal, i); const nextDate = getSafeDateStr(gapDate, 1);     
                const prevDate = getSafeDateStr(gapDate, -1); const nextNextDate = getSafeDateStr(nextDate, 1);
                if (!hasLeave(u.id, gapDate) && !hasLeave(u.id, nextDate)) {
                    validDaysLoose.push(i);
                    if (!hasLeave(u.id, prevDate) && !hasLeave(u.id, nextNextDate)) validDaysStrict.push(i);
                }
            }
            let daysToConsider = validDaysStrict.length > 0 ? validDaysStrict : validDaysLoose;
            if (daysToConsider.length > 0) {
                for (let idx of daysToConsider) { if (nBuckets[idx].length < minCount) { minCount = nBuckets[idx].length; bestDayIndex = idx; } }
            }
            if (bestDayIndex !== -1) nBuckets[bestDayIndex].push(u); else failedNStaff.push(u); 
        }

        if (failedMStaff.length > 0 || failedNStaff.length > 0) {
            failedMStaff.forEach(u => { if(!excludeMList.some(e=>e.id===u.id)) excludeMList.push(u); });
            failedNStaff.forEach(u => { if(!excludeNList.some(e=>e.id===u.id)) excludeNList.push(u); });
            renderExcludeTags('กะเช้า'); renderExcludeTags('กะดึก');
            Swal.fire({ icon: 'info', title: 'จัดตารางเสร็จสิ้น (มีคนติดวันหยุด)', text: `พบพนักงาน ${failedMStaff.length + failedNStaff.length} คน ที่คิวสลับชนกับวันหยุดพอดี ระบบได้ดันไปอยู่กล่อง "ไม่ต้องสลับกะ" ให้อัตโนมัติครับ`, confirmButtonText: 'รับทราบ' });
        } else { Swal.close(); }

        window.globalUserLeaves = userLeaves;

        generatedSwapPlan = [];
        for (let i = 0; i < daysToDistribute; i++) {
            const dateStr = getSafeDateStr(startDateVal, i);
            const displayDate = new Date(dateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
            const prevDateStr = getSafeDateStr(dateStr, -1);
            const prevDateDisplay = new Date(prevDateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
            const nextDateStr = getSafeDateStr(dateStr, 1);
            const nextDateDisplay = new Date(nextDateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });

            const mList = mBuckets[i] || []; const nList = nBuckets[i] || [];
            if (mList.length === 0 && nList.length === 0) continue;

            generatedSwapPlan.push({
                dayNumber: i + 1, targetDate: dateStr, targetNextDate: nextDateStr, 
                morningToNight: mList, nightToMorning: nList,
                descMtoN: `ทำเช้าวันสุดท้าย: ${prevDateDisplay} | เริ่มเข้าดึกคืนแรก: ${displayDate}`,
                descNtoM: `ออกกะเช้าวันที่: ${displayDate} (ได้พัก 1 วัน) | เริ่มเข้าเช้าวันที่: ${nextDateDisplay}`
            });
        }

        window.renderSwapPlanPreviewUI();
        document.getElementById('swapPlanPreview').style.display = 'block';
        setTimeout(() => { document.getElementById('autoSwapModalBody').scrollTop = document.getElementById('autoSwapModalBody').scrollHeight; }, 100);

    } catch (error) { Swal.fire('Error โค้ดมีปัญหา!', error.message, 'error'); }
}

window.renderSwapPlanPreviewUI = function() {
    const container = document.getElementById('planDaysContainer');
    if (!container) return;
    
    let html = generatedSwapPlan.map((plan, i) => {
        const displayDate = new Date(plan.targetDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
        const prevDateDisplay = new Date(getSafeDateStr(plan.targetDate, -1)).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
        const nextDateDisplay = new Date(plan.targetNextDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });

        const mNames = plan.morningToNight.map(u => {
            return window.renderTemplate('tpl-swap-plan-user', {
                id: u.id,
                dayIndex: i,
                direction: 'MtoN',
                colorClass: 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200',
                username: u.username
            });
        }).join('');

        const nNames = plan.nightToMorning.map(u => {
            return window.renderTemplate('tpl-swap-plan-user', {
                id: u.id,
                dayIndex: i,
                direction: 'NtoM',
                colorClass: 'bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200',
                username: u.username
            });
        }).join('');

        return window.renderTemplate('tpl-swap-plan-day', {
            dayNumber: plan.dayNumber,
            displayDate: displayDate,
            index: i,
            mCount: plan.morningToNight.length,
            prevDateDisplay: prevDateDisplay,
            mNamesHtml: mNames || '<span class="text-gray-400 text-xs pointer-events-none mt-1">ลากมาวางที่นี่...</span>',
            nCount: plan.nightToMorning.length,
            nextDateDisplay: nextDateDisplay,
            nNamesHtml: nNames || '<span class="text-gray-400 text-xs pointer-events-none mt-1">ลากมาวางที่นี่...</span>'
        });
    }).join('');
    
    container.innerHTML = html;
};

window.confirmAndSaveSwapPlan = async function() {
    if (!generatedSwapPlan || generatedSwapPlan.length === 0) return;

    Swal.fire({
        title: 'ยืนยันสร้างตารางสลับกะ?', text: 'ระบบจะตั้งเวลาสลับกะ และลงวันหยุด XX ให้กลุ่มที่สลับกะอัตโนมัติ', icon: 'question',
        showCancelButton: true, confirmButtonColor: '#059669', confirmButtonText: 'บันทึกเลย', cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({ title: 'กำลังบันทึกข้อมูล...', didOpen: () => Swal.showLoading() });
            try {
                let tasksToInsert = []; let leaveRequestsToInsert = []; 
                const startDateStr = document.getElementById('swapStartDate').value;

                generatedSwapPlan.forEach(dayPlan => {
                    dayPlan.morningToNight.forEach(user => {
                        let exactTime = new Date(`${dayPlan.targetDate}T05:00:00+07:00`);
                        tasksToInsert.push({ task_type: 'individual_shift_update', payload: { user_id: user.id, user_name: user.username, target_shift: 'กะดึก', display_desc: dayPlan.descMtoN }, scheduled_for: exactTime.toISOString(), status: 'pending' });
                        leaveRequestsToInsert.push({ user_id: user.id, user_name: user.username, leave_date: dayPlan.targetDate, reason: 'XX', status: 'approved' }); 
                    });
                    dayPlan.nightToMorning.forEach(user => {
                        let exactTime = new Date(`${dayPlan.targetNextDate}T05:00:00+07:00`);
                        tasksToInsert.push({ task_type: 'individual_shift_update', payload: { user_id: user.id, user_name: user.username, target_shift: 'กะเช้า', display_desc: dayPlan.descNtoM }, scheduled_for: exactTime.toISOString(), status: 'pending' });
                        leaveRequestsToInsert.push({ user_id: user.id, user_name: user.username, leave_date: dayPlan.targetDate, reason: 'XX', status: 'approved' }); 
                    });
                });

                excludeMList.forEach(user => { tasksToInsert.push({ task_type: 'individual_shift_update', payload: { user_id: user.id, user_name: user.username, target_shift: 'คงเดิม', original_shift: 'กะเช้า', display_desc: 'อยู่กะเช้าตามเดิม' }, scheduled_for: `${startDateStr}T00:00:00`, status: 'info_only' }); });
                excludeNList.forEach(user => { tasksToInsert.push({ task_type: 'individual_shift_update', payload: { user_id: user.id, user_name: user.username, target_shift: 'คงเดิม', original_shift: 'กะดึก', display_desc: 'อยู่กะดึกตามเดิม' }, scheduled_for: `${startDateStr}T00:00:00`, status: 'info_only' }); });

                if (tasksToInsert.length > 0) { 
                    const { error } = await appDB.from('scheduled_tasks').insert(tasksToInsert); 
                    if (error) throw error; 
                }
                
                if (leaveRequestsToInsert.length > 0) { 
                    for (let req of leaveRequestsToInsert) {
                        await appDB.from('leave_requests').delete().eq('user_id', req.user_id).eq('leave_date', req.leave_date);
                    }
                    const { error: leaveError } = await appDB.from('leave_requests').insert(leaveRequestsToInsert); 
                    if (leaveError) throw leaveError;
                }

                if(typeof logAction === 'function') await logAction('Auto Swap Plan', `สร้างแผนสลับกะ และลง XX อัตโนมัติ`);

                Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', text: 'พนักงานสามารถเช็คตารางของตัวเองได้แล้ว', timer: 2500 });
                document.getElementById('swapPlanPreview').style.display = 'none';
                clearExcludeStaff(); fetchPublicSwapSchedule(); 
                if(typeof fetchLeaveData === 'function') fetchLeaveData();
            } catch (err) { 
                Swal.fire('Error', 'เกิดข้อผิดพลาดในการบันทึก: ' + err.message, 'error'); 
                console.error(err);
            }
        }
    });
}

// ==========================================
// 👁️ ตัวกรองหน้าสลับกะ (Filter)
// ==========================================
window.setSwapTypeFilter = function(type) {
    activeSwapTypeFilter = type;
    document.querySelectorAll('.swap-filter-btn').forEach(btn => {
        btn.classList.remove('ring-2', 'ring-blue-400', 'scale-[1.02]');
        btn.classList.add('opacity-60');
        if (btn.id === 'btnFilterSwapall') btn.classList.replace('bg-blue-600', 'bg-slate-600');
    });
    
    const activeBtn = document.getElementById(`btnFilterSwap${type}`);
    if (activeBtn) {
        activeBtn.classList.remove('opacity-60');
        activeBtn.classList.add('scale-[1.02]', 'ring-2', 'ring-blue-400');
        if (type === 'all') activeBtn.classList.replace('bg-slate-600', 'bg-blue-600');
    }
    window.filterSwapSchedule(); 
};

window.setSwapDeptFilter = function(dept) {
    activeSwapDeptFilter = dept;
    ['AM', 'OD', 'TRAINER'].forEach(d => {
        const btn = document.getElementById(`btnSwapDept${d}`);
        if (btn) { if (d === dept) btn.classList.add('active'); else btn.classList.remove('active'); }
    });

    const deptSelect = document.getElementById('swapDeptSelect');
    if (deptSelect && deptSelect.value !== dept) { deptSelect.value = dept; if(typeof clearExcludeStaff === 'function') clearExcludeStaff(); }
    
    window.fetchPublicSwapSchedule(); 
    if(typeof checkSwapBackup === 'function') window.checkSwapBackup(); 
};

// ==========================================
// 📊 ดึงตารางสลับกะมาแสดง
// ==========================================
window.fetchPublicSwapSchedule = async function() {
    const box = document.getElementById('publicSwapList');
    if (!box) return;
    box.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center py-10"><span class="material-icons animate-spin text-blue-500 text-4xl mb-2">sync</span><span class="text-gray-500 font-bold text-sm">กำลังดึงข้อมูลตารางสลับกะ...</span></div>`;

    try {
        const statusFilterEl = document.getElementById('swapStatusFilter');
        const statusMode = statusFilterEl ? statusFilterEl.value : 'pending';
        let statusesToFetch = statusMode === 'pending' ? ['pending', 'info_only'] : ['completed'];

        let query = appDB.from('scheduled_tasks').select('*').eq('task_type', 'individual_shift_update').in('status', statusesToFetch);
        if (statusMode === 'pending') query = query.order('status', { ascending: false }).order('scheduled_for', { ascending: true });
        else query = query.order('scheduled_for', { ascending: false }).limit(200);

        const { data, error } = await query;
        if (error) throw error;

        let countMorning = 0; let countNight = 0; let countSame = 0; let validDataCount = 0; let html = '';

        if (data && data.length > 0) {
            const safeUserList = (typeof GLOBAL_USER_LIST !== 'undefined') ? GLOBAL_USER_LIST : [];

            html = data.map(task => {
                let p = {}; try { p = typeof task.payload === 'string' ? JSON.parse(task.payload) : (task.payload || {}); } catch(e) {}
                const userName = String(p.user_name || 'ไม่ทราบชื่อ'); 
                const targetShift = String(p.target_shift || '');
                let origShift = String(p.original_shift || ''); 

                const dbUser = safeUserList.find(u => u.username === userName);
                const userDept = dbUser ? (dbUser.department || 'AM') : 'AM';

                if (activeSwapDeptFilter !== 'ALL') {
                    if (activeSwapDeptFilter === 'TRAINER') { if (userDept === 'AM' || userDept === 'OD') return ''; } 
                    else { if (userDept !== activeSwapDeptFilter) return ''; }
                }

                validDataCount++; 
                if (!origShift && (task.status === 'info_only' || targetShift === 'คงเดิม')) {
                    if (p.display_desc && p.display_desc.includes('เช้า')) origShift = 'กะเช้า';
                    if (p.display_desc && p.display_desc.includes('ดึก')) origShift = 'กะดึก';
                }
                
                let dateStr = '-'; let prevDateStr = '-';
                if (task.scheduled_for) {
                    const dateObj = new Date(task.scheduled_for);
                    dateStr = dateObj.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
                    const prevDateObj = new Date(dateObj); prevDateObj.setDate(prevDateObj.getDate() - 1);
                    prevDateStr = prevDateObj.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
                }

                let icon = '', bgClass = '', txtClass = '', actionTitle = '', detailHtml = '';
                let swapTypeForFilter = 'same'; 

                if (task.status === 'info_only' || targetShift === 'คงเดิม') {
                    if (origShift === 'กะเช้า') { icon = 'wb_sunny'; actionTitle = 'ไม่ได้สลับกะ (อยู่เช้าต่อ)'; bgClass = 'bg-slate-800 border-orange-900/30 opacity-90'; txtClass = 'text-orange-400'; } 
                    else if (origShift === 'กะดึก') { icon = 'dark_mode'; actionTitle = 'ไม่ได้สลับกะ (อยู่ดึกต่อ)'; bgClass = 'bg-slate-800 border-purple-900/30 opacity-90'; txtClass = 'text-purple-400'; } 
                    else { icon = 'person_off'; actionTitle = 'ไม่ได้สลับกะ (อยู่กะเดิม)'; bgClass = 'bg-slate-800 border-gray-600 opacity-90'; txtClass = 'text-gray-400'; }
                    detailHtml = `<span class="text-gray-400">${p.display_desc || 'อยู่กะเดิมในรอบนี้'}</span>`;
                    swapTypeForFilter = 'same'; countSame++; 
                } 
                else if (targetShift === 'กะดึก') {
                    icon = 'dark_mode'; bgClass = 'bg-[#1e1b4b] border-purple-900/50'; txtClass = 'text-purple-400'; actionTitle = 'สลับไปดึก';
                    detailHtml = `<span class="text-gray-400">${p.display_desc || `เริ่มเข้าดึกคืนวันที่: <b class="text-gray-200">${dateStr}</b>`}</span>`;
                    swapTypeForFilter = 'night'; countNight++; 
                } 
                else if (targetShift === 'กะเช้า') {
                    icon = 'wb_sunny'; bgClass = 'bg-[#422006] border-orange-900/50'; txtClass = 'text-orange-500'; actionTitle = 'สลับไปเช้า';
                    detailHtml = `<span class="text-gray-400">${p.display_desc || `<span class="block leading-tight">หยุดพัก: <b class="text-gray-200">${prevDateStr}</b></span><span class="block leading-tight">เริ่มเข้าเช้าวันที่: <b class="text-green-500">${dateStr}</b></span>`}</span>`;
                    swapTypeForFilter = 'morning'; countMorning++; 
                }

                let completedBadge = '';
                if (task.status === 'completed') {
                    bgClass = bgClass.replace(/border-(purple|orange)-900\/50/g, 'border-green-900/50').replace('bg-[#1e1b4b]', 'bg-slate-900').replace('bg-[#422006]', 'bg-slate-900');
                    completedBadge = `<div class="absolute -top-3 -right-2 bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 border border-green-400 z-20"><span class="material-icons text-[10px]">check_circle</span> สำเร็จแล้ว</div>`;
                    txtClass = 'text-gray-400'; 
                }

                const isMe = userName === (currentUser.username || '');
                const myHighlight = isMe ? 'ring-2 ring-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] scale-[1.02] z-10' : '';
                const safeSearchName = userName.toLowerCase();
                const adminDelete = (currentUser && (currentUser.role === 'manager' || currentUser.role === 'admin')) ? `<button onclick="deleteTask(${task.id}); setTimeout(fetchPublicSwapSchedule, 500);" class="absolute top-2 right-2 text-red-500 hover:text-red-400 p-1 bg-black/20 rounded-lg transition z-20" title="${task.status === 'completed' ? 'ลบประวัตินี้' : 'ยกเลิกคิวนี้'}"><span class="material-icons text-sm">delete</span></button>` : '';

                let displayDeptBadge = userDept;
                if (userDept !== 'AM' && userDept !== 'OD') displayDeptBadge = 'AMQL';

                return window.renderTemplate('tpl-swap-schedule-item', {
                    bgClass: bgClass,
                    myHighlight: myHighlight,
                    safeSearchName: safeSearchName,
                    swapTypeForFilter: swapTypeForFilter,
                    userDept: userDept,
                    completedBadge: completedBadge,
                    adminDelete: adminDelete,
                    txtClass: txtClass,
                    icon: icon,
                    userName: userName,
                    displayDeptBadge: displayDeptBadge,
                    isMeBadge: isMe ? '<span class="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded shadow-sm">คุณ</span>' : '',
                    actionTitle: actionTitle,
                    detailHtml: detailHtml
                });
            }).join('');
        }

        if (validDataCount === 0) {
            const noDataMsg = statusMode === 'pending' ? 'ไม่มีกำหนดการสลับกะในช่วงนี้' : 'ยังไม่มีประวัติการสลับกะที่สำเร็จแล้ว';
            box.innerHTML = `<div class="col-span-full text-center text-gray-400 py-8 bg-slate-800/50 rounded-xl border border-dashed border-slate-600">${noDataMsg}</div>`;
        } else { box.innerHTML = html; }

        if (currentUser.role === 'manager' || currentUser.role === 'admin') {
            const elMorning = document.getElementById('statSwapMorning'); const elNight = document.getElementById('statSwapNight'); const elSame = document.getElementById('statSwapSame');
            if (elMorning) { elMorning.innerText = countMorning; elMorning.style.color = '#ffffff'; }
            if (elNight) { elNight.innerText = countNight; elNight.style.color = '#ffffff'; }
            if (elSame) { elSame.innerText = countSame; elSame.style.color = '#ffffff'; }
        }

        window.filterSwapSchedule();
    } catch (err) {
        box.innerHTML = `<div class="col-span-full text-center text-red-500 py-6">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>`;
    }
}

// ==========================================
// 🔍 ฟังก์ชันค้นหา & กรอง
// ==========================================
window.filterSwapSchedule = function() {
    const input = document.getElementById('searchSwapSchedule');
    if (!input) return;
    const filterText = input.value.toLowerCase();
    const items = document.querySelectorAll('.swap-item');
    
    let foundCount = 0;
    items.forEach(item => {
        const name = item.dataset.name || ''; const type = item.dataset.swaptype || ''; const dept = item.dataset.dept || 'AM'; 
        
        const matchName = name.includes(filterText);
        const matchType = (activeSwapTypeFilter === 'all') || (type === activeSwapTypeFilter);
        let matchDept = false;
        if (activeSwapDeptFilter === 'TRAINER') matchDept = (dept !== 'AM' && dept !== 'OD'); 
        else matchDept = (dept === activeSwapDeptFilter);

        if (matchName && matchType && matchDept) { item.style.display = 'flex'; foundCount++; } 
        else { item.style.display = 'none'; }
    });

    const box = document.getElementById('publicSwapList');
    let noResultMsg = document.getElementById('noSwapResult');
    
    if (foundCount === 0 && (filterText !== '' || activeSwapTypeFilter !== 'all' || activeSwapDeptFilter !== 'ALL')) {
        if (!noResultMsg) box.insertAdjacentHTML('beforeend', `<div id="noSwapResult" class="col-span-full text-center text-gray-400 py-6">ไม่พบรายชื่อตามเงื่อนไขที่ค้นหา</div>`);
        else noResultMsg.style.display = 'block';
    } else if (noResultMsg) { noResultMsg.style.display = 'none'; }
}

window.filterSwapToMyself = function() {
    const input = document.getElementById('searchSwapSchedule');
    if (input && currentUser && currentUser.username) {
        input.value = currentUser.username; filterSwapSchedule(); 
    }
}

window.highlightSwapPreview = function() {
    const input = document.getElementById('searchSwapPreview');
    if (!input) return;
    const term = input.value.toLowerCase().trim();
    const tags = document.querySelectorAll('#planDaysContainer span[draggable="true"]');

    tags.forEach(tag => {
        const name = tag.innerText.toLowerCase();
        if (term === '') {
            tag.classList.remove('ring-2', 'ring-offset-1', 'ring-red-600', 'font-black', 'shadow-md', 'z-10', 'relative');
            tag.style.opacity = '1';
        } else if (name.includes(term)) {
            tag.classList.add('ring-2', 'ring-offset-1', 'ring-red-600', 'font-black', 'shadow-md', 'z-10', 'relative');
            tag.style.opacity = '1';
        } else {
            tag.classList.remove('ring-2', 'ring-offset-1', 'ring-red-600', 'font-black', 'shadow-md', 'z-10', 'relative');
            tag.style.opacity = '0.2';
        }
    });
};

// ==========================================
// 🗑️ ลบ และ กู้คืน ตารางสลับกะ
// ==========================================
window.checkSwapBackup = function() {
    const btn = document.getElementById('btnRestoreSwap');
    if (!btn) return;
    const backupData = localStorage.getItem(`backup_swap_${activeSwapDeptFilter}`);
    if (backupData && JSON.parse(backupData).length > 0) btn.classList.remove('hidden');
    else btn.classList.add('hidden');
};

window.deleteAllSwapSchedules = async function() {
    if (currentUser.role !== 'manager' && currentUser.role !== 'admin') return;
    let deptName = activeSwapDeptFilter === 'TRAINER' ? 'ผู้สอน' : activeSwapDeptFilter;

    Swal.fire({
        title: `ล้างตารางสลับกะ ${deptName}?`, text: `ข้อมูลการสลับกะจะถูกลบ (สามารถกดกู้คืนได้ภายหลัง)`, icon: 'warning',
        showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'ใช่, ลบทิ้งเลย', cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({ title: 'กำลังลบข้อมูล...', didOpen: () => Swal.showLoading() });
            try {
                const { data } = await appDB.from('scheduled_tasks').select('*').eq('task_type', 'individual_shift_update');
                if (data && data.length > 0) {
                    const idsToDelete = []; const tasksToBackup = [];
                    const safeUserList = (typeof GLOBAL_USER_LIST !== 'undefined') ? GLOBAL_USER_LIST : [];

                    data.forEach(task => {
                        let p = {}; try { p = typeof task.payload === 'string' ? JSON.parse(task.payload) : task.payload; } catch(e){}
                        const dbUser = safeUserList.find(u => u.username === p.user_name);
                        const uDept = dbUser ? (dbUser.department || 'AM') : 'AM';
                        
                        let isMatch = false;
                        if (activeSwapDeptFilter === 'TRAINER') isMatch = (uDept !== 'AM' && uDept !== 'OD');
                        else isMatch = (uDept === activeSwapDeptFilter);

                        if (isMatch) { idsToDelete.push(task.id); tasksToBackup.push(task); }
                    });

                    if (idsToDelete.length > 0) {
                        localStorage.setItem(`backup_swap_${activeSwapDeptFilter}`, JSON.stringify(tasksToBackup));
                        await appDB.from('scheduled_tasks').delete().in('id', idsToDelete);
                    }
                }
                
                if(typeof logAction === 'function') await logAction('Auto Swap Delete', `ลบตารางสลับกะเฉพาะแผนก ${deptName} แล้ว`);

                Swal.fire('ลบสำเร็จ', `เคลียร์ข้อมูลของแผนก ${deptName} เรียบร้อย`, 'success');
                fetchPublicSwapSchedule(); checkSwapBackup(); 
            } catch (err) { Swal.fire('Error', 'ไม่สามารถลบข้อมูลได้', 'error'); }
        }
    });
}

window.restoreDeletedSwapSchedules = async function() {
    const backupData = localStorage.getItem(`backup_swap_${activeSwapDeptFilter}`);
    if (!backupData) return Swal.fire('ไม่พบข้อมูล', 'ไม่มีข้อมูลที่สามารถกู้คืนได้ในขณะนี้', 'error');

    let tasksToRestore = [];
    try { tasksToRestore = JSON.parse(backupData); } catch(e) { return Swal.fire('Error', 'ข้อมูลสำรองเสียหาย', 'error'); }
    if (tasksToRestore.length === 0) return Swal.fire('ไม่พบข้อมูล', 'ข้อมูลสำรองว่างเปล่า', 'error');

    Swal.fire({
        title: 'กู้คืนข้อมูล?', text: `ระบบจะนำตารางสลับกะที่เพิ่งลบไป ${tasksToRestore.length} รายการ กลับมาใช้งานอีกครั้ง`, icon: 'question',
        showCancelButton: true, confirmButtonColor: '#10b981', confirmButtonText: 'กู้คืนเลย', cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({title: 'กำลังกู้คืน...', didOpen: () => Swal.showLoading()});
            try {
                const insertPayload = tasksToRestore.map(t => { const { id, created_at, ...rest } = t; return rest; });
                const { error } = await appDB.from('scheduled_tasks').insert(insertPayload);
                if (error) throw error;

                localStorage.removeItem(`backup_swap_${activeSwapDeptFilter}`);
                
                if(typeof logAction === 'function') {
                    let deptName = activeSwapDeptFilter === 'TRAINER' ? 'ผู้สอน' : activeSwapDeptFilter;
                    await logAction('Auto Swap Restore', `กู้คืนตารางสลับกะแผนก ${deptName}`);
                }

                Swal.fire('กู้คืนสำเร็จ', 'ข้อมูลสลับกะกลับมาเรียบร้อยแล้ว', 'success');
                fetchPublicSwapSchedule(); checkSwapBackup(); 
            } catch (err) { Swal.fire('Error', 'เกิดข้อผิดพลาดในการกู้คืน', 'error'); }
        }
    });
};

// ==========================================
// 🖱️ ระบบลากวาง (Drag & Drop) ในหน้าสลับกะ
// ==========================================
window.swapDragStart = function(event, userId, fromDayIndex, shiftType) {
    draggedSwapUser = { id: userId, fromDay: fromDayIndex, shiftType: shiftType };
    event.dataTransfer.effectAllowed = "move";
    event.target.classList.add('opacity-50', 'scale-90');
};

window.swapDragOver = function(event, shiftType) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (draggedSwapUser && draggedSwapUser.shiftType === shiftType) {
        event.currentTarget.classList.add('bg-slate-700/50', 'ring-2', 'ring-sky-500', 'rounded-lg');
    }
};

window.swapDragLeave = function(event) {
    event.currentTarget.classList.remove('bg-slate-700/50', 'ring-2', 'ring-sky-500', 'rounded-lg');
};

window.swapDrop = function(event, toDayIndex, shiftType) {
    event.preventDefault();
    event.currentTarget.classList.remove('bg-slate-700/50', 'ring-2', 'ring-sky-500', 'rounded-lg');

    if (!draggedSwapUser) return;
    
    if (draggedSwapUser.shiftType !== shiftType) {
        Swal.fire({icon: 'error', title: 'ผิดช่อง!', text: 'ลากข้ามประเภทกะไม่ได้ครับ', confirmButtonColor: '#ef4444'});
        draggedSwapUser = null;
        window.renderSwapPlanPreviewUI();
        return;
    }

    if (draggedSwapUser.fromDay === toDayIndex) {
        draggedSwapUser = null;
        window.renderSwapPlanPreviewUI();
        return;
    }

    const userId = draggedSwapUser.id;
    const targetPlan = generatedSwapPlan[toDayIndex];
    const userLeaves = window.globalUserLeaves ? (window.globalUserLeaves[userId] || new Set()) : new Set();

    let hasConflict = false;
    let conflictMsg = '';

    if (shiftType === 'MtoN') {
        if (userLeaves.has(targetPlan.targetDate)) {
            hasConflict = true;
            conflictMsg = `ติดวันหยุดวันที่ ${new Date(targetPlan.targetDate).toLocaleDateString('th-TH', {day:'numeric', month:'short'})}`;
        }
    } else {
        const prevDayStr = getSafeDateStr(targetPlan.targetDate, -1);
        const prevDayDisplay = new Date(prevDayStr).toLocaleDateString('th-TH', {day:'numeric', month:'short'});

        if (userLeaves.has(prevDayStr)) {
            hasConflict = true;
            conflictMsg = `พนักงานหยุดวันที่ ${prevDayDisplay} ห้ามเริ่มสลับกะในวันถัดไปทันที (กติกา AMQL บล็อกหยุดติดสลับกะ)`;
        } 
        else if (userLeaves.has(targetPlan.targetDate) || userLeaves.has(targetPlan.targetNextDate)) {
            hasConflict = true;
            conflictMsg = `มีวันหยุดคาบเกี่ยวในช่วงที่ย้าย (วันที่ 6 หรือ 7)`;
        }
    }

    if (hasConflict) {
        Swal.fire({icon: 'warning', title: 'ย้ายไม่ได้!', text: conflictMsg, confirmButtonColor: '#f59e0b'});
        draggedSwapUser = null;
        window.renderSwapPlanPreviewUI(); 
        return;
    }

    const sourcePlan = generatedSwapPlan[draggedSwapUser.fromDay];
    const sourceArray = shiftType === 'MtoN' ? sourcePlan.morningToNight : sourcePlan.nightToMorning;
    const userIndex = sourceArray.findIndex(u => String(u.id) === String(userId));
    
    if (userIndex > -1) {
        const userObj = sourceArray.splice(userIndex, 1)[0]; 
        const targetArray = shiftType === 'MtoN' ? targetPlan.morningToNight : targetPlan.nightToMorning;
        targetArray.push(userObj); 
    }

    draggedSwapUser = null;
    window.renderSwapPlanPreviewUI(); 
};
