// ==========================================
// 🔄 ระบบสลับกะการทำงาน (SWAP SHIFT MANAGER)
// ==========================================

let generatedSwapPlan = []; 
let excludeMList = []; 
let excludeNList = []; 
let activeSwapTypeFilter = 'all';
let activeSwapDeptFilter = 'AM';
let draggedSwapUser = null;
// [FIX] เก็บ pair ไว้ระดับ module ให้ confirmAndSaveSwapPlan เข้าถึงได้
let currentSwapPair = null;

// ฟังก์ชันเปิดหน้าจอ
window.openAutoSwapModal = async function() {
    const adminPanel = document.getElementById('adminSwapControls');
    const previewPanel = document.getElementById('swapPlanPreview');
    const managerToolbar = document.getElementById('managerSwapToolbar');

    // [FIX] fetch users แบบ background ไม่ block UI — โหลด swap schedule ไปก่อน
    if (typeof GLOBAL_USER_LIST === 'undefined' || GLOBAL_USER_LIST.length === 0) {
        fetchUsers(); // ไม่ await — โหลด background
    }

    await fetchPublicSwapSchedule();
    
    // เช็คสิทธิ์
    const isGlobalAdmin = (currentUser && (currentUser.role === 'manager' || currentUser.role === 'admin'));
    const canManageSwap = isGlobalAdmin || (typeof window.hasUserPerm === 'function' && window.hasUserPerm('swap_manage'));

    if (canManageSwap) {
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

    // [FIX] ซ่อน/แสดงช่อง "อยู่ดึกต่อ" ตามว่า bidirectional หรือไม่
    const SHIFT_MAP_CHECK = {
        'M_N': true, 'M_A': true, 'A_N': true,
        'N_M': false, 'M_only': false
    };
    const shiftPairVal = document.getElementById('swapShiftPair')?.value || 'M_N';
    const isBidi = SHIFT_MAP_CHECK[shiftPairVal] !== false;
    const excludeNBlock = document.getElementById('excludeNBlock');
    if (excludeNBlock) {
        excludeNBlock.style.display = isBidi ? '' : 'none';
    }
    // แก้ label ฝั่งเช้าให้ตรงกับทิศทางที่เลือก
    const excludeMLabel = document.getElementById('excludeMLabel');
    if (excludeMLabel) {
        if (shiftPairVal === 'N_M') excludeMLabel.innerHTML = '<span class="material-icons text-sm">dark_mode</span> อยู่ดึกต่อ (ไม่ไปเช้า)';
        else if (shiftPairVal === 'M_only') excludeMLabel.innerHTML = '<span class="material-icons text-sm">wb_sunny</span> อยู่เช้าต่อ (ไม่ไปดึก)';
        else excludeMLabel.innerHTML = '<span class="material-icons text-sm">wb_sunny</span> อยู่เช้าต่อ (ไม่ไปดึก)';
    }
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
        const shiftPair = document.getElementById('swapShiftPair')?.value || 'M_N';

        // กำหนดกะจาก dropdown
        const SHIFT_MAP = {
            // ↔ แบบ 2 ทาง (สลับสับเปลี่ยนกัน)
            'M_N':    { from: 'กะเช้า', to: 'กะดึก',  toLabel: 'ดึก',   fromLabel: 'เช้า',  bidirectional: true  },
            'M_A':    { from: 'กะเช้า', to: 'กะกลาง', toLabel: 'กลาง',  fromLabel: 'เช้า',  bidirectional: true  },
            'A_N':    { from: 'กะกลาง', to: 'กะดึก',  toLabel: 'ดึก',   fromLabel: 'กลาง',  bidirectional: true  },
            // → แบบ 1 ทาง (เฉพาะ from ย้ายไป to ฝ่ายเดียว ไม่มีสลับกลับ)
            'N_M':    { from: 'กะดึก',  to: 'กะเช้า', toLabel: 'เช้า',  fromLabel: 'ดึก',   bidirectional: false },
            'M_only': { from: 'กะเช้า', to: 'กะดึก',  toLabel: 'ดึก',   fromLabel: 'เช้า',  bidirectional: false },
        };
        const pair = SHIFT_MAP[shiftPair] || SHIFT_MAP['M_N'];
        currentSwapPair = pair; // [FIX] เก็บไว้ให้ confirmAndSaveSwapPlan ใช้
        
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
            if (u.allowed_shift !== pair.from) return false;
            if (targetDept === 'TRAINER') { if (uDept === 'AM' || uDept === 'OD') return false; }
            else if (targetDept !== 'ALL') { if (uDept !== targetDept) return false; }
            if (excludeMList.some(e => e.id === u.id)) return false;
            return true;
        });

        let nStaff = pair.bidirectional ? GLOBAL_USER_LIST.filter(u => {
            const uDept = u.department || 'AM';
            if (u.allowed_shift !== pair.to) return false;
            if (targetDept === 'TRAINER') { if (uDept === 'AM' || uDept === 'OD') return false; }
            else if (targetDept !== 'ALL') { if (uDept !== targetDept) return false; }
            if (excludeNList.some(e => e.id === u.id)) return false;
            return true;
        }) : [];

        if (mStaff.length === 0 && nStaff.length === 0) return Swal.fire('ไม่พบข้อมูล', `ไม่มีพนักงานให้สลับในแผนกที่เลือก`, 'error');

        mStaff.sort(() => Math.random() - 0.5); nStaff.sort(() => Math.random() - 0.5);

        let mBuckets = Array.from({length: daysToDistribute}, () => []);
        let nBuckets = Array.from({length: daysToDistribute}, () => []);
        let failedMStaff = []; let failedNStaff = [];

        // 🌟 1. เช็คสลับกะ เช้า -> ดึก (บังคับเว้นวันหยุดหน้า/หลัง)
        for (let u of mStaff) {
            let bestDayIndex = -1; let minCount = Infinity; let validDaysStrict = [];
            for (let i = 0; i < daysToDistribute; i++) {
                const targetDate = getSafeDateStr(startDateVal, i); 
                const dMinus2 = getSafeDateStr(targetDate, -2);
                const dMinus1 = getSafeDateStr(targetDate, -1);
                const dPlus1 = getSafeDateStr(targetDate, 1);
                const dPlus2 = getSafeDateStr(targetDate, 2);
                
                // ล็อคเด็ดขาด: ต้องไม่มีวันหยุดในระยะ -2 ถึง +2 วันจากวันสลับกะ
                if (!hasLeave(u.id, dMinus2) && !hasLeave(u.id, dMinus1) && !hasLeave(u.id, targetDate) && !hasLeave(u.id, dPlus1) && !hasLeave(u.id, dPlus2)) {
                    validDaysStrict.push(i);
                }
            }
            if (validDaysStrict.length > 0) {
                for (let idx of validDaysStrict) { if (mBuckets[idx].length < minCount) { minCount = mBuckets[idx].length; bestDayIndex = idx; } }
            }
            if (bestDayIndex !== -1) mBuckets[bestDayIndex].push(u); else failedMStaff.push(u); 
        }

        // 🌟 2. เช็คสลับกะ ดึก -> เช้า (บังคับเว้นวันหยุดหน้า/หลัง)
        for (let u of nStaff) {
            let bestDayIndex = -1; let minCount = Infinity; let validDaysStrict = [];
            for (let i = 0; i < daysToDistribute; i++) {
                const gapDate = getSafeDateStr(startDateVal, i); 
                const dMinus2 = getSafeDateStr(gapDate, -2);
                const dMinus1 = getSafeDateStr(gapDate, -1);
                const dPlus1 = getSafeDateStr(gapDate, 1);
                const dPlus2 = getSafeDateStr(gapDate, 2);
                const dPlus3 = getSafeDateStr(gapDate, 3);
                
                // ล็อคเด็ดขาด: ต้องไม่มีวันหยุดในระยะ -2 ถึง +3 วัน (เนื่องจากกะดึกไปเช้ามีวันพักคั่น)
                if (!hasLeave(u.id, dMinus2) && !hasLeave(u.id, dMinus1) && !hasLeave(u.id, gapDate) && !hasLeave(u.id, dPlus1) && !hasLeave(u.id, dPlus2) && !hasLeave(u.id, dPlus3)) {
                    validDaysStrict.push(i);
                }
            }
            if (validDaysStrict.length > 0) {
                for (let idx of validDaysStrict) { if (nBuckets[idx].length < minCount) { minCount = nBuckets[idx].length; bestDayIndex = idx; } }
            }
            if (bestDayIndex !== -1) nBuckets[bestDayIndex].push(u); else failedNStaff.push(u); 
        }

        // [FIX] ไม่ดันเข้า exclude อัตโนมัติ — แค่แจ้งเตือนให้รู้ว่ามีใครชนวันหยุด
        if (failedMStaff.length > 0 || failedNStaff.length > 0) {
            const allFailed = [...failedMStaff, ...failedNStaff];
            const nameList = allFailed.map(u => u.username).join(', ');
            Swal.fire({ icon: 'warning', title: `⚠️ พบ ${allFailed.length} คน ที่ชนวันหยุด`, html: `<div class="text-left text-sm"><p class="mb-2">พนักงานต่อไปนี้คิวสลับชนกับวันหยุดพอดี ระบบยังคงจัดให้สลับกะตามปกติ</p><p class="font-bold text-orange-600">${nameList}</p><p class="mt-2 text-xs text-gray-500">ถ้าต้องการให้ใครอยู่กะเดิม ให้เลือกเองที่ช่อง "ล็อกพนักงาน" แล้วคำนวณใหม่</p></div>`, confirmButtonText: 'รับทราบ' });
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
            // [FIX] ดึก→เช้า: ทำดึกวันสุดท้าย (dateStr) เลิก 08.00 วันถัดไป
            // ต้องพัก 1 วันก่อน = dateStr+1 คือวันพัก, dateStr+2 คือวันเริ่มเช้า
            const restDateStr = getSafeDateStr(dateStr, 1);   // วันพัก
            const startMornStr = getSafeDateStr(dateStr, 2);   // วันเริ่มเช้า
            const restDateDisplay = new Date(restDateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
            const startMornDisplay = new Date(startMornStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });

            const mList = mBuckets[i] || []; const nList = nBuckets[i] || [];
            if (mList.length === 0 && nList.length === 0) continue;

            generatedSwapPlan.push({
                dayNumber: i + 1, targetDate: dateStr,
                // M→N: เริ่มเข้าดึกวันถัดไป (targetDate+1)
                targetNextDate: nextDateStr,
                // N→M: เริ่มเข้าเช้าหลังพัก 1 วัน (targetDate+2)
                targetMornDate: startMornStr,
                morningToNight: mList, nightToMorning: nList,
                descMtoN: `ทำเช้าวันสุดท้าย: ${prevDateDisplay} → เริ่มเข้าดึกวันแรก: ${displayDate}`,
                descNtoM: `ทำดึกวันสุดท้าย: ${displayDate} → หยุดพัก 1 วัน (${restDateDisplay}) → เริ่มเข้าเช้า: ${startMornDisplay}`
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
                // [FIX] declare _p ก่อน forEach เพื่อให้ excludeMList/excludeNList ใช้ได้ด้วย
                const _p = currentSwapPair || { to: 'กะดึก', from: 'กะเช้า', toLabel: 'ดึก', fromLabel: 'เช้า' };

                generatedSwapPlan.forEach(dayPlan => {
                    dayPlan.morningToNight.forEach(user => {
                        let exactTime = new Date(`${dayPlan.targetDate}T05:00:00+07:00`);
                        tasksToInsert.push({ task_type: 'individual_shift_update', payload: { user_id: user.id, user_name: user.username, target_shift: _p.to, display_desc: dayPlan.descMtoN }, scheduled_for: exactTime.toISOString(), status: 'pending' });
                        leaveRequestsToInsert.push({ user_id: user.id, user_name: user.username, leave_date: dayPlan.targetDate, reason: 'XX', status: 'approved' }); 
                    });
                    dayPlan.nightToMorning.forEach(user => {
                        // [FIX] ดึก→เช้า: เริ่มเช้าหลังพัก 1 วัน = targetMornDate (targetDate+2)
                        const mornDate = dayPlan.targetMornDate || dayPlan.targetNextDate;
                        let exactTime = new Date(`${mornDate}T05:00:00+07:00`);
                        tasksToInsert.push({ task_type: 'individual_shift_update', payload: { user_id: user.id, user_name: user.username, target_shift: _p.from, display_desc: dayPlan.descNtoM }, scheduled_for: exactTime.toISOString(), status: 'pending' });
                        // พักวันที่ targetDate (วันที่ยังทำดึกอยู่) และ targetNextDate (วันพัก)
                        leaveRequestsToInsert.push({ user_id: user.id, user_name: user.username, leave_date: dayPlan.targetDate, reason: 'XX', status: 'approved' });
                        if (dayPlan.targetNextDate) {
                            leaveRequestsToInsert.push({ user_id: user.id, user_name: user.username, leave_date: dayPlan.targetNextDate, reason: 'XX', status: 'approved' });
                        }
                    });
                });

                excludeMList.forEach(user => { tasksToInsert.push({ task_type: 'individual_shift_update', payload: { user_id: user.id, user_name: user.username, target_shift: 'คงเดิม', original_shift: _p.from, display_desc: `อยู่${_p.fromLabel}ตามเดิม` }, scheduled_for: `${startDateStr}T00:00:00`, status: 'info_only' }); });
                excludeNList.forEach(user => { tasksToInsert.push({ task_type: 'individual_shift_update', payload: { user_id: user.id, user_name: user.username, target_shift: 'คงเดิม', original_shift: _p.to, display_desc: `อยู่${_p.toLabel}ตามเดิม` }, scheduled_for: `${startDateStr}T00:00:00`, status: 'info_only' }); });

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
            window._swapScheduleTasks = Object.fromEntries(data.map(t => [t.id, t]));

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
                    if (p.display_desc) {
                        const parts = p.display_desc.split(' → ');
                        if (parts.length >= 2) {
                            detailHtml = parts.map((part, i) => {
                                const color = i === 0 ? 'text-orange-400' : 'text-purple-400';
                                return `<span class="block text-xs font-bold mt-0.5 ${color}">${part}</span>`;
                            }).join('');
                        } else {
                            detailHtml = `<span class="text-purple-400 font-bold text-xs">${p.display_desc}</span>`;
                        }
                    } else {
                        detailHtml = `<span class="text-purple-400 font-bold text-xs">เริ่มเข้าดึกวันที่: <b class="text-gray-200">${dateStr}</b></span>`;
                    }
                    swapTypeForFilter = 'night'; countNight++; 
                } 
                else if (targetShift === 'กะเช้า') {
                    icon = 'wb_sunny'; bgClass = 'bg-[#422006] border-orange-900/50'; txtClass = 'text-orange-500'; actionTitle = 'สลับไปเช้า';
                    if (p.display_desc) {
                        const parts = p.display_desc.split(' → ');
                        if (parts.length >= 2) {
                            const colors = ['text-orange-400', 'text-yellow-400', 'text-green-400'];
                            detailHtml = parts.map((part, i) => {
                                const color = colors[i] || 'text-orange-400';
                                return `<span class="block text-xs font-bold mt-0.5 ${color}">${part}</span>`;
                            }).join('');
                        } else {
                            detailHtml = `<span class="text-orange-400 font-bold text-xs">${p.display_desc}</span>`;
                        }
                    } else {
                        detailHtml = `<span class="block text-xs leading-tight text-gray-400">หยุดพัก: <b class="text-gray-200">${prevDateStr}</b></span><span class="block text-xs leading-tight mt-0.5 text-orange-400 font-bold">เริ่มเข้าเช้าวันที่: <b class="text-green-400">${dateStr}</b></span>`;
                    }
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
                
                const isGlobalAdmin = (currentUser && (currentUser.role === 'manager' || currentUser.role === 'admin'));
                const canManageSwap = isGlobalAdmin || (typeof window.hasUserPerm === 'function' && window.hasUserPerm('swap_manage'));
                const adminDelete = canManageSwap ? `<button onclick="deleteTask(${task.id}); setTimeout(fetchPublicSwapSchedule, 500);" class="absolute top-2 right-2 text-red-500 hover:text-red-400 p-1 bg-black/20 rounded-lg transition z-20" title="${task.status === 'completed' ? 'ลบประวัตินี้' : 'ยกเลิกคิวนี้'}"><span class="material-icons text-sm">delete</span></button>` : '';

                let displayDeptBadge = userDept;
                if (userDept !== 'AM' && userDept !== 'OD') displayDeptBadge = 'AMQL';

                const canEditSaved = canManageSwap && task.status !== 'completed';
                const userNameHtml = canEditSaved
                    ? `<span onclick="openSavedSwapMenu(${task.id})" class="cursor-pointer hover:underline hover:text-blue-300 transition" title="คลิกเพื่อจัดการ">${userName}</span>`
                    : userName;

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
                    userNameHtml: userNameHtml,
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

        const isGlobalAdminStat = (currentUser && (currentUser.role === 'manager' || currentUser.role === 'admin'));
        const canManageSwapStat = isGlobalAdminStat || (typeof window.hasUserPerm === 'function' && window.hasUserPerm('swap_manage'));
        
        if (isGlobalAdminStat || canManageSwapStat) {
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
    const isGlobalAdmin = (currentUser && (currentUser.role === 'manager' || currentUser.role === 'admin'));
    const canManageSwap = isGlobalAdmin || (typeof window.hasUserPerm === 'function' && window.hasUserPerm('swap_manage'));
    if (!canManageSwap) return;
    
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
                        window.safeSetItem(`backup_swap_${activeSwapDeptFilter}`, JSON.stringify(tasksToBackup));
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
// 🎯 เมนูจัดการพนักงานในแผนสลับกะ (Admin Only)
// ==========================================
window.openSwapUserMenu = function(userId, dayIndex, direction) {
    const isGlobalAdmin = (currentUser && (currentUser.role === 'manager' || currentUser.role === 'admin'));
    const canManageSwap = isGlobalAdmin || (typeof window.hasUserPerm === 'function' && window.hasUserPerm('swap_manage'));
    if (!canManageSwap) {
        Swal.fire({ icon: 'error', title: 'ไม่มีสิทธิ์', text: 'เฉพาะ Admin เท่านั้นที่กำหนดการสลับกะได้', confirmButtonColor: '#ef4444' });
        return;
    }

    const sourcePlan = generatedSwapPlan[dayIndex];
    if (!sourcePlan) return;
    const sourceArray = direction === 'MtoN' ? sourcePlan.morningToNight : sourcePlan.nightToMorning;
    const user = sourceArray.find(u => String(u.id) === String(userId));
    if (!user) return;

    const inputOptions = {};
    generatedSwapPlan.forEach((plan, i) => {
        const displayDate = new Date(plan.targetDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
        const tag = (i === dayIndex) ? ' (ปัจจุบัน)' : '';
        inputOptions[`day:${i}`] = `🗓️ คิวที่ ${plan.dayNumber} - ${displayDate}${tag}`;
    });
    inputOptions['exclude'] = '❌ ไม่ต้องสลับกะ (อยู่กะเดิม)';

    const directionLabel = direction === 'MtoN' ? '☀️ → 🌙 เช้าไปดึก' : '🌙 → ☀️ ดึกไปเช้า';

    Swal.fire({
        title: `จัดการ ${user.username}`,
        text: `ประเภทปัจจุบัน: ${directionLabel}`,
        input: 'select',
        inputOptions: inputOptions,
        inputValue: `day:${dayIndex}`,
        showCancelButton: true,
        confirmButtonText: 'ยืนยัน',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#3b82f6'
    }).then(result => {
        if (!result.isConfirmed || !result.value) return;
        const val = result.value;
        if (val === 'exclude') {
            moveSwapUserToExclude(userId, dayIndex, direction);
        } else if (val.startsWith('day:')) {
            const toDayIndex = parseInt(val.substring(4), 10);
            if (toDayIndex === dayIndex) return;
            moveSwapUserToDay(userId, dayIndex, toDayIndex, direction);
        }
    });
};

window.moveSwapUserToDay = function(userId, fromDayIndex, toDayIndex, direction) {
    const targetPlan = generatedSwapPlan[toDayIndex];
    const sourcePlan = generatedSwapPlan[fromDayIndex];
    if (!targetPlan || !sourcePlan) return;

    const userLeaves = window.globalUserLeaves ? (window.globalUserLeaves[userId] || new Set()) : new Set();
    const targetDateStr = targetPlan.targetDate;
    const dMinus2 = getSafeDateStr(targetDateStr, -2);
    const dMinus1 = getSafeDateStr(targetDateStr, -1);
    const dPlus1 = getSafeDateStr(targetDateStr, 1);
    const dPlus2 = getSafeDateStr(targetDateStr, 2);
    const dPlus3 = getSafeDateStr(targetDateStr, 3);

    let hasConflict = false;
    if (direction === 'MtoN') {
        if (userLeaves.has(dMinus2) || userLeaves.has(dMinus1) || userLeaves.has(targetDateStr) || userLeaves.has(dPlus1) || userLeaves.has(dPlus2)) hasConflict = true;
    } else {
        if (userLeaves.has(dMinus2) || userLeaves.has(dMinus1) || userLeaves.has(targetDateStr) || userLeaves.has(dPlus1) || userLeaves.has(dPlus2) || userLeaves.has(dPlus3)) hasConflict = true;
    }

    if (hasConflict) {
        Swal.fire({ icon: 'warning', title: 'ย้ายไม่ได้!', text: 'พนักงานมีวันหยุดใกล้กับช่วงสลับกะ (ต้องห่างจากวันหยุดอย่างน้อย 1 วัน)', confirmButtonColor: '#f59e0b' });
        return;
    }

    const sourceArray = direction === 'MtoN' ? sourcePlan.morningToNight : sourcePlan.nightToMorning;
    const userIndex = sourceArray.findIndex(u => String(u.id) === String(userId));
    if (userIndex < 0) return;

    const userObj = sourceArray.splice(userIndex, 1)[0];
    const targetArray = direction === 'MtoN' ? targetPlan.morningToNight : targetPlan.nightToMorning;
    targetArray.push(userObj);

    window.renderSwapPlanPreviewUI();
};

window.moveSwapUserToExclude = function(userId, fromDayIndex, direction) {
    const sourcePlan = generatedSwapPlan[fromDayIndex];
    if (!sourcePlan) return;

    const sourceArray = direction === 'MtoN' ? sourcePlan.morningToNight : sourcePlan.nightToMorning;
    const userIndex = sourceArray.findIndex(u => String(u.id) === String(userId));
    if (userIndex < 0) return;

    const userObj = sourceArray.splice(userIndex, 1)[0];

    if (direction === 'MtoN') {
        if (!excludeMList.some(e => e.id === userObj.id)) excludeMList.push(userObj);
        renderExcludeTags('กะเช้า');
    } else {
        if (!excludeNList.some(e => e.id === userObj.id)) excludeNList.push(userObj);
        renderExcludeTags('กะดึก');
    }

    window.renderSwapPlanPreviewUI();
    Swal.fire({ icon: 'success', title: 'อัปเดตแล้ว', text: `${userObj.username} จะอยู่กะเดิม ไม่ต้องสลับกะ`, timer: 1500, showConfirmButton: false });
};

// ==========================================
// ➕ เพิ่มพนักงานที่ตกหล่นเข้าตารางสลับกะ (Admin Only)
// ==========================================
window.openAddMissingSwap = async function() {
    const isGlobalAdmin = (currentUser && (currentUser.role === 'manager' || currentUser.role === 'admin'));
    const canManageSwap = isGlobalAdmin || (typeof window.hasUserPerm === 'function' && window.hasUserPerm('swap_manage'));
    if (!canManageSwap) {
        Swal.fire({ icon: 'error', title: 'ไม่มีสิทธิ์', text: 'เฉพาะ Admin เท่านั้นที่ใช้ได้', confirmButtonColor: '#ef4444' });
        return;
    }

    if (!GLOBAL_USER_LIST || GLOBAL_USER_LIST.length === 0) {
        if (typeof fetchUsers === 'function') await fetchUsers();
    }

    // หา user_id ที่มีรายการอยู่แล้วในตารางปัจจุบัน เพื่อจะได้ไม่ให้ซ้ำ
    const existingUserIds = new Set();
    for (const id in (window._swapScheduleTasks || {})) {
        const task = window._swapScheduleTasks[id];
        if (task.status === 'completed') continue;
        let p = {}; try { p = typeof task.payload === 'string' ? JSON.parse(task.payload) : (task.payload || {}); } catch(e) {}
        if (p.user_id) existingUserIds.add(String(p.user_id));
    }

    const eligibleUsers = GLOBAL_USER_LIST.filter(u => {
        if (existingUserIds.has(String(u.id))) return false;
        if (!['กะเช้า', 'กะดึก'].includes(u.allowed_shift)) return false;
        if (u.role !== 'staff' && u.role !== 'trainer') return false;
        const uDept = u.department || 'AM';
        if (activeSwapDeptFilter === 'TRAINER') return uDept !== 'AM' && uDept !== 'OD';
        if (activeSwapDeptFilter !== 'ALL') return uDept === activeSwapDeptFilter;
        return true;
    });

    if (eligibleUsers.length === 0) {
        return Swal.fire({ icon: 'info', title: 'ไม่มีพนักงานให้เพิ่ม', text: 'พนักงานทุกคนในแผนกนี้มีรายการสลับกะอยู่แล้ว' });
    }

    eligibleUsers.sort((a, b) => a.username.localeCompare(b.username));
    const today = new Date().toISOString().split('T')[0];

    const userOpts = eligibleUsers.map(u => {
        const dept = u.department || 'AM';
        const shiftShort = (u.allowed_shift || '').replace('กะ', '');
        return `<option value="${u.id}">${u.username} [${dept} | ${shiftShort}]</option>`;
    }).join('');

    const result = await Swal.fire({
        title: 'เพิ่มพนักงานที่ตกหล่น',
        html: `
            <div style="text-align:left">
                <label style="font-size:12px; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">เลือกพนักงาน:</label>
                <select id="addSwapUser" class="swal2-select" style="width:100%; margin: 0 0 12px; display:block;">
                    <option value="">-- กรุณาเลือก --</option>
                    ${userOpts}
                </select>

                <label style="font-size:12px; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">ประเภท:</label>
                <select id="addSwapAction" class="swal2-select" style="width:100%; margin: 0 0 12px; display:block;">
                    <option value="swap">✨ สลับกะ (เช้า↔ดึก)</option>
                    <option value="stay">⏸️ ไม่สลับ (อยู่กะเดิม)</option>
                </select>

                <label style="font-size:12px; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">วันที่:</label>
                <input id="addSwapDate" type="date" value="${today}" class="swal2-input" style="width:100%; margin: 0; display:block;">
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'เพิ่ม',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#10b981',
        focusConfirm: false,
        preConfirm: () => {
            const userId = document.getElementById('addSwapUser').value;
            const action = document.getElementById('addSwapAction').value;
            const date = document.getElementById('addSwapDate').value;
            if (!userId) { Swal.showValidationMessage('กรุณาเลือกพนักงาน'); return false; }
            if (!action) { Swal.showValidationMessage('กรุณาเลือกประเภท'); return false; }
            if (!date) { Swal.showValidationMessage('กรุณาเลือกวันที่'); return false; }
            return { userId, action, date };
        }
    });

    if (!result.isConfirmed || !result.value) return;
    const { userId, action, date } = result.value;
    const user = GLOBAL_USER_LIST.find(u => String(u.id) === String(userId));
    if (!user) return;

    Swal.fire({ title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading() });

    try {
        let payload, scheduledFor, status;
        let leaveRequest = null;

        if (action === 'swap') {
            const targetShift = user.allowed_shift === 'กะเช้า' ? 'กะดึก' : 'กะเช้า';
            const dispDate = new Date(date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
            const prevDate = getSafeDateStr(date, -1);
            const prevDispDate = new Date(prevDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
            // 🟢 format ให้ครบ 2 ส่วน เหมือนตอน auto-generate
            const desc = targetShift === 'กะดึก'
                ? `ทำเช้าวันสุดท้าย: ${prevDispDate} | เริ่มเข้าดึกวันแรก: ${dispDate}`
                : `ออกกะเช้าวันที่: ${prevDispDate} (ได้พัก 1 วัน) | เริ่มเข้าเช้าวันที่: ${dispDate}`;

            payload = { user_id: user.id, user_name: user.username, target_shift: targetShift, display_desc: desc };
            scheduledFor = new Date(`${date}T05:00:00+07:00`).toISOString();
            status = 'pending';

            // กะดึก (MtoN): XX วันเดียวกัน, กะเช้า (NtoM): XX วันก่อน 1 วัน
            const offset = targetShift === 'กะเช้า' ? -1 : 0;
            const xxDate = getSafeDateStr(date, offset);
            leaveRequest = { user_id: user.id, user_name: user.username, leave_date: xxDate, reason: 'XX', status: 'approved' };
        } else {
            // stay
            const originalShift = user.allowed_shift;
            const desc = originalShift === 'กะเช้า' ? 'อยู่กะเช้าตามเดิม' : 'อยู่กะดึกตามเดิม';
            payload = { user_id: user.id, user_name: user.username, target_shift: 'คงเดิม', original_shift: originalShift, display_desc: desc };
            scheduledFor = `${date}T00:00:00`;
            status = 'info_only';
        }

        const { error } = await appDB.from('scheduled_tasks').insert({
            task_type: 'individual_shift_update',
            payload: payload,
            scheduled_for: scheduledFor,
            status: status
        });
        if (error) throw error;

        if (leaveRequest) {
            await appDB.from('leave_requests').delete().eq('user_id', user.id).eq('leave_date', leaveRequest.leave_date);
            await appDB.from('leave_requests').insert(leaveRequest);
        }

        if (typeof logAction === 'function') {
            const actionDesc = action === 'swap' ? 'สลับกะ' : 'ไม่สลับ (อยู่กะเดิม)';
            await logAction('Add Missing Swap', `เพิ่ม ${user.username} เข้าตาราง: ${actionDesc} วันที่ ${date}`);
        }

        Swal.fire({ icon: 'success', title: 'เพิ่มสำเร็จ', text: `เพิ่ม ${user.username} เข้าตารางแล้ว`, timer: 1800, showConfirmButton: false });
        fetchPublicSwapSchedule();
        if (typeof fetchLeaveData === 'function') fetchLeaveData();
    } catch (err) {
        Swal.fire('Error', 'ไม่สามารถบันทึกได้: ' + err.message, 'error');
    }
};

// ==========================================
// 🛠️ เมนูจัดการรายการสลับกะที่บันทึกแล้ว (Admin Only)
// ==========================================
window._swapScheduleTasks = window._swapScheduleTasks || {};

window.openSavedSwapMenu = async function(taskId) {
    const isGlobalAdmin = (currentUser && (currentUser.role === 'manager' || currentUser.role === 'admin'));
    const canManageSwap = isGlobalAdmin || (typeof window.hasUserPerm === 'function' && window.hasUserPerm('swap_manage'));
    if (!canManageSwap) {
        Swal.fire({ icon: 'error', title: 'ไม่มีสิทธิ์', text: 'เฉพาะ Admin เท่านั้นที่จัดการได้', confirmButtonColor: '#ef4444' });
        return;
    }

    const task = window._swapScheduleTasks[taskId];
    if (!task) { Swal.fire({ icon: 'error', title: 'ไม่พบรายการ', text: 'กรุณาโหลดหน้าใหม่' }); return; }

    let p = {};
    try { p = typeof task.payload === 'string' ? JSON.parse(task.payload) : (task.payload || {}); } catch(e) {}

    const userName = p.user_name || 'ไม่ทราบชื่อ';
    const targetShift = p.target_shift || '';

    if (task.status === 'completed') {
        Swal.fire({ icon: 'info', title: userName, text: 'รายการนี้สลับกะสำเร็จแล้ว ไม่สามารถแก้ไขได้' });
        return;
    }

    const isPending = task.status === 'pending' && (targetShift === 'กะเช้า' || targetShift === 'กะดึก');
    const isInfoOnly = task.status === 'info_only' || targetShift === 'คงเดิม';

    let inputOptions = {}; let titleText = '';
    if (isPending) {
        inputOptions['change_date'] = '🗓️ เปลี่ยนวันที่สลับ';
        inputOptions['to_stay'] = '❌ ยกเลิกการสลับ (อยู่กะเดิม)';
        titleText = `ประเภทปัจจุบัน: สลับไป${targetShift}`;
    } else if (isInfoOnly) {
        inputOptions['reactivate'] = '✅ เปิดให้สลับกะ (เลือกวันใหม่)';
        titleText = `ประเภทปัจจุบัน: อยู่${p.original_shift || 'กะเดิม'}ตามเดิม`;
    } else { return; }

    const result = await Swal.fire({
        title: `จัดการ ${userName}`,
        text: titleText,
        input: 'select',
        inputOptions: inputOptions,
        showCancelButton: true,
        confirmButtonText: 'ดำเนินการ',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#3b82f6'
    });
    if (!result.isConfirmed || !result.value) return;

    const action = result.value;
    if (action === 'change_date') await window.changeSavedSwapDate(taskId);
    else if (action === 'to_stay') await window.changeSavedSwapToStay(taskId);
    else if (action === 'reactivate') await window.reactivateSavedSwap(taskId);
};

window.changeSavedSwapDate = async function(taskId) {
    const task = window._swapScheduleTasks[taskId];
    if (!task) return;
    let p = {}; try { p = typeof task.payload === 'string' ? JSON.parse(task.payload) : (task.payload || {}); } catch(e) {}

    const currentDate = task.scheduled_for ? task.scheduled_for.split('T')[0] : '';

    const result = await Swal.fire({
        title: 'เลือกวันที่ใหม่',
        text: `วันที่ปัจจุบัน: ${currentDate}`,
        input: 'date',
        inputValue: currentDate,
        showCancelButton: true,
        confirmButtonText: 'บันทึก',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#3b82f6',
        inputValidator: (value) => { if (!value) return 'กรุณาเลือกวันที่'; }
    });
    if (!result.isConfirmed) return;
    const newDate = result.value;
    if (!newDate || newDate === currentDate) return;

    Swal.fire({ title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading() });
    try {
        const newScheduledFor = new Date(`${newDate}T05:00:00+07:00`).toISOString();

        // 🟢 สร้าง display_desc ใหม่ให้ครบ 2 ส่วน (ไม่งั้นจะแสดงไม่ครบ)
        const newDateDisplay = new Date(newDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
        const prevDate = getSafeDateStr(newDate, -1);
        const prevDateDisplay = new Date(prevDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
        let newDesc;
        if (p.target_shift === 'กะดึก') {
            // MtoN: prev = วันสุดท้ายทำเช้า, new = วันเริ่มเข้าดึก
            newDesc = `ทำเช้าวันสุดท้าย: ${prevDateDisplay} | เริ่มเข้าดึกวันแรก: ${newDateDisplay}`;
        } else if (p.target_shift === 'กะเช้า') {
            // NtoM: prev = วันพัก, new = วันเริ่มเข้าเช้า
            newDesc = `ออกกะเช้าวันที่: ${prevDateDisplay} (ได้พัก 1 วัน) | เริ่มเข้าเช้าวันที่: ${newDateDisplay}`;
        } else {
            newDesc = p.display_desc || '';
        }

        const newPayload = { ...p, display_desc: newDesc };

        const { error: updErr } = await appDB.from('scheduled_tasks').update({
            scheduled_for: newScheduledFor,
            payload: newPayload
        }).eq('id', taskId);
        if (updErr) throw updErr;

        // กะเช้า (NtoM): XX อยู่ก่อน 1 วัน, กะดึก (MtoN): XX วันเดียวกัน
        const offset = p.target_shift === 'กะเช้า' ? -1 : 0;
        const oldLeaveDate = getSafeDateStr(currentDate, offset);
        const newLeaveDate = getSafeDateStr(newDate, offset);

        if (p.user_id) {
            await appDB.from('leave_requests').delete().eq('user_id', p.user_id).eq('leave_date', oldLeaveDate).eq('reason', 'XX');
            await appDB.from('leave_requests').delete().eq('user_id', p.user_id).eq('leave_date', newLeaveDate);
            await appDB.from('leave_requests').insert({ user_id: p.user_id, user_name: p.user_name, leave_date: newLeaveDate, reason: 'XX', status: 'approved' });
        }

        if (typeof logAction === 'function') await logAction('Swap Date Change', `ย้ายวันสลับกะของ ${p.user_name}: ${currentDate} → ${newDate}`);

        Swal.fire({ icon: 'success', title: 'บันทึกแล้ว', timer: 1500, showConfirmButton: false });
        fetchPublicSwapSchedule();
        if (typeof fetchLeaveData === 'function') fetchLeaveData();
    } catch (err) {
        Swal.fire('Error', 'ไม่สามารถบันทึกได้: ' + err.message, 'error');
    }
};

window.changeSavedSwapToStay = async function(taskId) {
    const task = window._swapScheduleTasks[taskId];
    if (!task) return;
    let p = {}; try { p = typeof task.payload === 'string' ? JSON.parse(task.payload) : (task.payload || {}); } catch(e) {}

    const targetShift = p.target_shift;
    const originalShift = targetShift === 'กะดึก' ? 'กะเช้า' : 'กะดึก';
    const newDesc = originalShift === 'กะเช้า' ? 'อยู่กะเช้าตามเดิม' : 'อยู่กะดึกตามเดิม';

    const confirm = await Swal.fire({
        title: 'ยกเลิกการสลับกะ?',
        text: `${p.user_name} จะอยู่${originalShift}ตามเดิม ไม่สลับในรอบนี้`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'ยืนยัน',
        cancelButtonText: 'กลับ',
        confirmButtonColor: '#ef4444'
    });
    if (!confirm.isConfirmed) return;

    Swal.fire({ title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading() });
    try {
        const newPayload = { ...p, target_shift: 'คงเดิม', original_shift: originalShift, display_desc: newDesc };

        const { error: updErr } = await appDB.from('scheduled_tasks').update({
            payload: newPayload,
            status: 'info_only'
        }).eq('id', taskId);
        if (updErr) throw updErr;

        const offset = targetShift === 'กะเช้า' ? -1 : 0;
        const swapDate = task.scheduled_for ? task.scheduled_for.split('T')[0] : null;
        if (p.user_id && swapDate) {
            const xxDate = getSafeDateStr(swapDate, offset);
            await appDB.from('leave_requests').delete().eq('user_id', p.user_id).eq('leave_date', xxDate).eq('reason', 'XX');
        }

        if (typeof logAction === 'function') await logAction('Swap Cancel', `ยกเลิกสลับกะ ${p.user_name} (อยู่${originalShift}ตามเดิม)`);

        Swal.fire({ icon: 'success', title: 'ยกเลิกแล้ว', text: `${p.user_name} จะอยู่${originalShift}ตามเดิม`, timer: 1800, showConfirmButton: false });
        fetchPublicSwapSchedule();
        if (typeof fetchLeaveData === 'function') fetchLeaveData();
    } catch (err) {
        Swal.fire('Error', 'ไม่สามารถบันทึกได้: ' + err.message, 'error');
    }
};

window.reactivateSavedSwap = async function(taskId) {
    const task = window._swapScheduleTasks[taskId];
    if (!task) return;
    let p = {}; try { p = typeof task.payload === 'string' ? JSON.parse(task.payload) : (task.payload || {}); } catch(e) {}

    let originalShift = p.original_shift;
    if (!originalShift) {
        const dbUser = (typeof GLOBAL_USER_LIST !== 'undefined') ? GLOBAL_USER_LIST.find(u => u.id === p.user_id) : null;
        originalShift = dbUser ? dbUser.allowed_shift : null;
    }
    if (!originalShift) {
        Swal.fire({ icon: 'error', title: 'ข้อมูลไม่ครบ', text: 'ไม่สามารถระบุกะเดิมของพนักงานได้' });
        return;
    }
    const newTargetShift = originalShift === 'กะเช้า' ? 'กะดึก' : 'กะเช้า';
    const directionLabel = originalShift === 'กะเช้า' ? '☀️ → 🌙 เช้าไปดึก' : '🌙 → ☀️ ดึกไปเช้า';

    const today = new Date().toISOString().split('T')[0];
    const result = await Swal.fire({
        title: `เปิดให้ ${p.user_name} สลับกะ`,
        text: `จะให้สลับเป็น: ${directionLabel}`,
        input: 'date',
        inputValue: today,
        showCancelButton: true,
        confirmButtonText: 'บันทึก',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#10b981',
        inputValidator: (value) => { if (!value) return 'กรุณาเลือกวันที่สลับ'; }
    });
    if (!result.isConfirmed || !result.value) return;
    const swapDate = result.value;

    Swal.fire({ title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading() });
    try {
        const newScheduledFor = new Date(`${swapDate}T05:00:00+07:00`).toISOString();
        const swapDateDisplay = new Date(swapDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
        const prevDate = getSafeDateStr(swapDate, -1);
        const prevDateDisplay = new Date(prevDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
        // 🟢 format ให้ครบ 2 ส่วน
        const newDesc = newTargetShift === 'กะดึก'
            ? `ทำเช้าวันสุดท้าย: ${prevDateDisplay} | เริ่มเข้าดึกวันแรก: ${swapDateDisplay}`
            : `ออกกะเช้าวันที่: ${prevDateDisplay} (ได้พัก 1 วัน) | เริ่มเข้าเช้าวันที่: ${swapDateDisplay}`;

        const newPayload = {
            user_id: p.user_id,
            user_name: p.user_name,
            target_shift: newTargetShift,
            display_desc: newDesc
        };

        const { error: updErr } = await appDB.from('scheduled_tasks').update({
            scheduled_for: newScheduledFor,
            payload: newPayload,
            status: 'pending'
        }).eq('id', taskId);
        if (updErr) throw updErr;

        const offset = newTargetShift === 'กะเช้า' ? -1 : 0;
        const xxDate = getSafeDateStr(swapDate, offset);
        if (p.user_id) {
            await appDB.from('leave_requests').delete().eq('user_id', p.user_id).eq('leave_date', xxDate);
            await appDB.from('leave_requests').insert({ user_id: p.user_id, user_name: p.user_name, leave_date: xxDate, reason: 'XX', status: 'approved' });
        }

        if (typeof logAction === 'function') await logAction('Swap Reactivate', `เปิดให้ ${p.user_name} สลับกะวันที่ ${swapDate}`);

        Swal.fire({ icon: 'success', title: 'เปิดแล้ว', text: `${p.user_name} จะ${directionLabel} วันที่ ${swapDate}`, timer: 2000, showConfirmButton: false });
        fetchPublicSwapSchedule();
        if (typeof fetchLeaveData === 'function') fetchLeaveData();
    } catch (err) {
        Swal.fire('Error', 'ไม่สามารถบันทึกได้: ' + err.message, 'error');
    }
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

    const targetDateStr = targetPlan.targetDate;
    const dMinus2 = getSafeDateStr(targetDateStr, -2);
    const dMinus1 = getSafeDateStr(targetDateStr, -1);
    const dPlus1 = getSafeDateStr(targetDateStr, 1);
    const dPlus2 = getSafeDateStr(targetDateStr, 2);
    const dPlus3 = getSafeDateStr(targetDateStr, 3);

    // 🌟 ดักจับการลากวาง: เช็คว่าติดวันหยุดไหม (ห่าง 1 วัน)
    if (shiftType === 'MtoN') {
        if (userLeaves.has(dMinus2) || userLeaves.has(dMinus1) || userLeaves.has(targetDateStr) || userLeaves.has(dPlus1) || userLeaves.has(dPlus2)) {
            hasConflict = true;
            conflictMsg = `พนักงานมีวันหยุดใกล้กับช่วงสลับกะ (ต้องห่างจากวันหยุดอย่างน้อย 1 วัน)`;
        }
    } else {
        if (userLeaves.has(dMinus2) || userLeaves.has(dMinus1) || userLeaves.has(targetDateStr) || userLeaves.has(dPlus1) || userLeaves.has(dPlus2) || userLeaves.has(dPlus3)) {
            hasConflict = true;
            conflictMsg = `พนักงานมีวันหยุดใกล้กับช่วงสลับกะ (ต้องห่างจากวันหยุดอย่างน้อย 1 วัน)`;
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




// ==========================================
// 📊 Export ตารางสลับกะ — รูปแบบ AMOL
// ==========================================
window.exportSwapReport = async function() {
    if (typeof ExcelJS === 'undefined') {
        try {
            Swal.fire({ title: 'กำลังเตรียม Excel...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            await new Promise((res, rej) => {
                const s = document.createElement('script');
                s.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
                s.onload = res; s.onerror = () => rej(new Error('โหลด ExcelJS ไม่ได้'));
                document.head.appendChild(s);
            });
        } catch(e) { return Swal.fire('Error', e.message, 'error'); }
    }

    Swal.fire({ title: 'กำลังดึงข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const { data: tasks, error } = await appDB
        .from('scheduled_tasks')
        .select('*')
        .eq('task_type', 'individual_shift_update')
        .in('status', ['pending', 'completed', 'info_only'])
        .order('scheduled_for', { ascending: true });

    if (error || !tasks || tasks.length === 0) {
        return Swal.fire('ไม่พบข้อมูล', 'ยังไม่มีตารางสลับกะ', 'warning');
    }

    // parse
    const shiftMap = {}, userMeta = {};
    let minDate = null;

    tasks.filter(t => t.status !== 'info_only').forEach(t => {
        let p = t.payload;
        if (typeof p === 'string') { try { p = JSON.parse(p); } catch(e) { p = {}; } }
        const name = p.user_name || p.username || '-';
        if (!name || name === '-') return;

        const d = new Date(t.scheduled_for);
        const day = d.getDate();
        if (!minDate || d < minDate) minDate = new Date(d.getFullYear(), d.getMonth(), 1);

        const label = p.target_shift === 'กะเช้า' ? 'เช้า'
                    : p.target_shift === 'กะดึก'  ? 'ดึก'
                    : p.target_shift === 'กะกลาง' ? 'กลาง'
                    : (p.target_shift || '');

        if (!shiftMap[name]) shiftMap[name] = {};
        shiftMap[name][day] = label;

        if (!userMeta[name]) {
            const u = typeof GLOBAL_USER_LIST !== 'undefined' ? GLOBAL_USER_LIST.find(x => x.username === name) : null;
            userMeta[name] = {
                web:   u?.team || u?.department || '-',
                dept:  u?.department || '-',
                shift: u?.allowed_shift === 'กะเช้า' ? 'เช้า' : u?.allowed_shift === 'กะดึก' ? 'ดึก' : (u?.allowed_shift || '-'),
                pos:   u?.role || 'NV'
            };
        }
    });

    if (!minDate) return Swal.fire('ไม่พบข้อมูล', '', 'warning');

    const YEAR = minDate.getFullYear();
    const MONTH = minDate.getMonth();
    const daysInMonth = new Date(YEAR, MONTH + 1, 0).getDate();
    const thaiMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
                        'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
    const monthThai = `${thaiMonths[MONTH]} ${YEAR + 543}`;

    // สีตรงแบบ AMOL
    const C = {
        title:   'FFE2EFD9', header:  'FFFFC000', daySun:  'FFFFD966',
        morning: 'FFB6D7A8', night:   'FFB6D7A8',
        secAm:   'FFFFD966', secNt:   'FF6FA8DC',
        X:       'FFFB9DAD', KL:      'FF548135', TX:      'FF00B0F0',
        change:  'FFFFFF00', am_cell: 'FFFFC000', nt_cell: 'FF9FC5E8',
    };

    const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
    const font = (color='FF000000', bold=false, size=10) => ({ name: 'Arial', color: { argb: color }, bold, size });
    const align = (h='center', v='middle') => ({ horizontal: h, vertical: v });
    const border = () => {
        const s = { style: 'thin', color: { argb: 'FFCCCCCC' } };
        return { left: s, right: s, top: s, bottom: s };
    };

    const getCellStyle = (label, rowBg) => {
        let bg = rowBg, fc = 'FF000000', bold = false;
        if (label === 'X')       { bg = C.X; }
        else if (label === 'KL') { bg = C.KL; fc = 'FFFFFFFF'; bold = true; }
        else if (label === 'TX') { bg = C.TX; fc = 'FFFFFFFF'; }
        else if (label === 'เปลี่ยน') { bg = C.change; bold = true; }
        else if (label === 'เช้า')    { bg = C.am_cell; }
        else if (label === 'ดึก')     { bg = C.nt_cell; }
        return { bg, fc, bold };
    };

    const COL_STT=2, COL_NAME=3, COL_WEB=4, COL_DEPT=5, COL_SHFT=6, COL_POS=7, COL_D1=8;
    const lastCol = COL_D1 + daysInMonth - 1;

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('ตารางสลับกะ');

    // col widths
    ws.getColumn(1).width = 2.5;
    ws.getColumn(2).width = 5;
    ws.getColumn(3).width = 14;
    ws.getColumn(4).width = 8;
    ws.getColumn(5).width = 7;
    ws.getColumn(6).width = 6;
    ws.getColumn(7).width = 7;
    for (let d = 1; d <= daysInMonth; d++) ws.getColumn(COL_D1+d-1).width = 4.5;

    // ROW 1: Title
    ws.getRow(1).height = 22;
    const r1 = ws.getCell(1, 1);
    r1.value = `ตารางสลับกะ  ${monthThai}`;
    r1.fill = fill(C.title); r1.font = font('FF000000', true, 13);
    r1.alignment = align('center');
    ws.mergeCells(1, 1, 1, lastCol);

    // ROW 2-3: เว้น
    ws.getRow(2).height = 4; ws.getRow(3).height = 4;

    // ROW 4: Header
    ws.getRow(4).height = 20;
    [[COL_STT,'STT'],[COL_NAME,'ชื่อ'],[COL_WEB,'เว็บ'],[COL_DEPT,'แผนก'],[COL_SHFT,'เข้ากะ'],[COL_POS,'ตำแหน่ง']].forEach(([col,h]) => {
        const c = ws.getCell(4, col);
        c.value = h; c.fill = fill(C.header);
        c.font = font('FF000000', true, 10);
        c.alignment = align(); c.border = border();
    });
    for (let d = 1; d <= daysInMonth; d++) {
        const c = ws.getCell(4, COL_D1+d-1);
        c.value = d; c.fill = fill(C.header);
        c.font = font('FF000000', true, 9);
        c.alignment = align(); c.border = border();
    }

    // ROW 5: วันในสัปดาห์
    ws.getRow(5).height = 13;
    const thaiDays = ['อา','จ','อ','พ','พฤ','ศ','ส'];
    for (let d = 1; d <= daysInMonth; d++) {
        const dt = new Date(YEAR, MONTH, d);
        const dow = (dt.getDay()); // 0=อา
        const c = ws.getCell(5, COL_D1+d-1);
        c.value = thaiDays[dow];
        c.fill = fill(dow === 0 ? C.daySun : C.header);
        c.font = font('FF000000', false, 8);
        c.alignment = align(); c.border = border();
    }

    // แบ่ง user ตามกะ
    const morning = Object.keys(shiftMap).filter(n => userMeta[n]?.shift === 'เช้า').sort();
    const night   = Object.keys(shiftMap).filter(n => userMeta[n]?.shift === 'ดึก').sort();
    const others  = Object.keys(shiftMap).filter(n => !morning.includes(n) && !night.includes(n)).sort();

    let rowNum = 6;

    const addSection = (label, bg) => {
        ws.getRow(rowNum).height = 15;
        const c = ws.getCell(rowNum, 1);
        c.value = label; c.fill = fill(bg);
        c.font = font('FF000000', true, 10);
        c.alignment = align('left');
        ws.mergeCells(rowNum, 1, rowNum, lastCol);
        rowNum++;
    };

    const addUserRow = (name, idx) => {
        ws.getRow(rowNum).height = 16;
        const meta = userMeta[name] || {};
        const days = shiftMap[name] || {};
        const rowBg = meta.shift === 'ดึก' ? C.night : C.morning;

        [[1,''],[COL_STT,idx+1],[COL_NAME,name],[COL_WEB,meta.web||'-'],[COL_DEPT,meta.dept||'-'],[COL_SHFT,meta.shift||'-'],[COL_POS,meta.pos||'NV']].forEach(([col,val]) => {
            const c = ws.getCell(rowNum, col);
            c.value = val; c.fill = fill(rowBg);
            c.font = font('FF000000', col===COL_NAME, col===COL_STT?9:10);
            c.alignment = align(col===COL_NAME?'left':'center');
            c.border = border();
        });

        for (let d = 1; d <= daysInMonth; d++) {
            const label = days[d] || '';
            const c = ws.getCell(rowNum, COL_D1+d-1);
            const { bg, fc, bold } = getCellStyle(label, rowBg);
            c.value = label;
            c.fill = fill(bg); c.font = font(fc, bold, 9);
            c.alignment = align(); c.border = border();
        }
        rowNum++;
    };

    if (morning.length > 0) {
        addSection('☀  กะเช้า', C.secAm);
        morning.forEach((n, i) => addUserRow(n, i));
    }
    if (night.length > 0) {
        ws.getRow(rowNum).height = 4; rowNum++;
        addSection('🌙  กะดึก', C.secNt);
        night.forEach((n, i) => addUserRow(n, i));
    }
    if (others.length > 0) {
        ws.getRow(rowNum).height = 4; rowNum++;
        addSection('👥  อื่น', 'FFCCCCCC');
        others.forEach((n, i) => addUserRow(n, i));
    }

    ws.views = [{ state: 'frozen', xSplit: 7, ySplit: 5 }];

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `ตารางสลับกะ_${monthThai}.xlsx`;
    a.click(); URL.revokeObjectURL(url);

    const total = morning.length + night.length + others.length;
    Swal.fire({ icon: 'success', title: 'ดาวน์โหลดสำเร็จ!', text: `${total} คน × ${daysInMonth} วัน`, timer: 1800, showConfirmButton: false });
};
