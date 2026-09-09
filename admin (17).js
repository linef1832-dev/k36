// ════════════════════════════════════════════════════════════════════
// 📦 swap/admin.js — ส่วนที่ 3/4 ของระบบสลับกะ (แยกจาก swap.js เดิม 1,633 บรรทัด)
// เนื้อหา: จัดการพนักงานในแผน, เพิ่มคนตกหล่น, จัดการรายการที่บันทึกแล้ว (Admin)
// ⚠️ ลำดับโหลด: swap/core → swap/view → swap/admin → swap/extras (ห้ามสลับ — ตัวแปร top-level แชร์ scope เดียวกัน)
// ════════════════════════════════════════════════════════════════════
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

    // ใช้เกณฑ์เดียวกับตอนกดคำนวณ (แยกตามทิศทาง)
    const hasConflict = hasSwapLeaveConflict(targetDateStr, direction, userLeaves);

    if (hasConflict) {
        Swal.fire({ icon: 'warning', title: 'ย้ายไม่ได้!', text: getSwapConflictMsg(direction), confirmButtonColor: '#f59e0b' });
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
    const today = getTodayStrLocal(); // [FIX เวลา] เดิมเป็นวันที่ UTC ทำให้ช่วงดึก-เช้าตรู่ได้วันที่เมื่อวาน

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

        const originalShift = user.allowed_shift;
        if (action === 'swap') {
            const targetShift = originalShift === 'กะเช้า' ? 'กะดึก' : 'กะเช้า';
            const dispDate = new Date(date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
            const prevDate = getSafeDateStr(date, -1);
            const prevDispDate = new Date(prevDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
            // 🟢 format ให้ครบ 2 ส่วน เหมือนตอน auto-generate
            const desc = targetShift === 'กะดึก'
                ? `ทำเช้าวันสุดท้าย: ${prevDispDate} | เริ่มเข้าดึกวันแรก: ${dispDate}`
                : `ออกกะเช้าวันที่: ${prevDispDate} (ได้พัก 1 วัน) | เริ่มเข้าเช้าวันที่: ${dispDate}`;

            payload = { user_id: user.id, user_name: user.username, target_shift: targetShift, from_shift: originalShift, display_desc: desc };
            scheduledFor = new Date(`${date}T05:00:00+07:00`).toISOString();
            status = 'pending';

            // กะดึก (MtoN): XX วันเดียวกัน, กะเช้า (NtoM): XX วันก่อน 1 วัน
            const offset = targetShift === 'กะเช้า' ? -1 : 0;
            const xxDate = getSafeDateStr(date, offset);
            leaveRequest = { user_id: user.id, user_name: user.username, leave_date: xxDate, reason: 'XX', status: 'approved' };
        } else {
            // stay
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

    const today = getTodayStrLocal(); // [FIX เวลา] เดิมเป็นวันที่ UTC ทำให้ช่วงดึก-เช้าตรู่ได้วันที่เมื่อวาน
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