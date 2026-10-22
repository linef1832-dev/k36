let generatedSwapPlan = [];

let excludeMList = [];

let excludeNList = [];

let activeSwapTypeFilter = 'all';

let activeSwapDeptFilter = 'AM';

let draggedSwapUser = null;

let currentSwapPair = null;

window.openAutoSwapModal = async function() {
  const adminPanel = document.getElementById('adminSwapControls');
  const previewPanel = document.getElementById('swapPlanPreview');
  const managerToolbar = document.getElementById('managerSwapToolbar');
  if (typeof GLOBAL_USER_LIST === 'undefined' || GLOBAL_USER_LIST.length === 0) {
    fetchUsers();
  }
  await fetchPublicSwapSchedule();
  const isGlobalAdmin = canPerm('swap_manage');
  const canManageSwap = isGlobalAdmin || typeof window.hasUserPerm === 'function' && window.hasUserPerm('swap_manage');
  if (canManageSwap) {
    if (managerToolbar) managerToolbar.style.display = 'flex';
    if (previewPanel) previewPanel.style.display = 'none';
    if (typeof clearExcludeStaff === 'function') clearExcludeStaff();
    const now = new Date;
    now.setMonth(now.getMonth() + 1);
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    if (document.getElementById('swapStartDate')) document.getElementById('swapStartDate').value = `${y}-${m}-01`;
    if (document.getElementById('swapEndDate')) document.getElementById('swapEndDate').value = `${y}-${m}-06`;
    updateSwapMonthLabel();
    if (typeof checkSwapBackup === 'function') window.checkSwapBackup();
  } else {
    if (adminPanel) adminPanel.style.display = 'none';
    if (managerToolbar) managerToolbar.style.display = 'none';
    if (previewPanel) previewPanel.style.display = 'none';
  }
  if (typeof window.swapSyncUI === 'function') window.swapSyncUI();
};

window.updateSwapMonthLabel = function() {
  const startDateVal = document.getElementById('swapStartDate').value;
  if (startDateVal) {
    const d = new Date(startDateVal);
    const monthStr = d.toLocaleDateString('th-TH', {
      month: 'long',
      year: 'numeric'
    });
    const label = document.getElementById('swapTargetMonthLabel');
    if (label) label.innerText = `อิงวันหยุดเดือน ${monthStr}`;
  }
};

window.clearExcludeStaff = function() {
  excludeMList = [];
  excludeNList = [];
  renderExcludeTags('กะเช้า');
  renderExcludeTags('กะดึก');
  document.getElementById('swapPlanPreview').style.display = 'none';
  const SHIFT_MAP_CHECK = {
    M_N: true,
    M_A: true,
    A_N: true,
    N_M: false,
    M_only: false
  };
  const shiftPairVal = document.getElementById('swapShiftPair')?.value || 'M_N';
  const isBidi = SHIFT_MAP_CHECK[shiftPairVal] !== false;
  const excludeNBlock = document.getElementById('excludeNBlock');
  if (excludeNBlock) {
    excludeNBlock.style.display = isBidi ? '' : 'none';
  }
  const excludeMLabel = document.getElementById('excludeMLabel');
  if (excludeMLabel) {
    if (shiftPairVal === 'N_M') excludeMLabel.innerHTML = '<span class="material-icons text-sm">dark_mode</span> อยู่ดึกต่อ (ไม่ไปเช้า)'; else if (shiftPairVal === 'M_only') excludeMLabel.innerHTML = '<span class="material-icons text-sm">wb_sunny</span> อยู่เช้าต่อ (ไม่ไปดึก)'; else excludeMLabel.innerHTML = '<span class="material-icons text-sm">wb_sunny</span> อยู่เช้าต่อ (ไม่ไปดึก)';
  }
};

window.searchExcludeStaff = function(shiftType) {
  const inputId = shiftType === 'กะเช้า' ? 'searchExcludeM' : 'searchExcludeN';
  const dropId = shiftType === 'กะเช้า' ? 'dropdownExcludeM' : 'dropdownExcludeN';
  const searchText = document.getElementById(inputId).value.toLowerCase();
  const dropdown = document.getElementById(dropId);
  const targetDept = document.getElementById('swapDeptSelect').value;
  if (!searchText) {
    dropdown.classList.add('hidden');
    return;
  }
  const availableUsers = GLOBAL_USER_LIST.filter((u => {
    const uDept = u.department || 'AM';
    if (u.role !== 'staff' && u.role !== 'trainer' && uDept !== 'TRAINER') return false;
    if (u.allowed_shift !== shiftType) return false;
    if (targetDept !== 'ALL' && uDept !== targetDept) return false;
    if (!u.username.toLowerCase().includes(searchText)) return false;
    if (shiftType === 'กะเช้า' && excludeMList.find((e => e.id === u.id))) return false;
    if (shiftType === 'กะดึก' && excludeNList.find((e => e.id === u.id))) return false;
    return true;
  }));
  if (availableUsers.length > 0) {
    dropdown.innerHTML = availableUsers.map((u => window.renderTemplate('tpl-swap-exclude-dropdown-item', {
      id: u.id,
      shiftType: shiftType,
      username: u.username,
      dept: u.department || 'AM'
    }))).join('');
  } else {
    dropdown.innerHTML = `<div class="px-3 py-2 text-gray-400 text-xs text-center">ไม่พบรายชื่อ หรือถูกเลือกไปแล้ว</div>`;
  }
  dropdown.classList.remove('hidden');
};

window.addExcludeStaff = function(userId, shiftType) {
  const user = GLOBAL_USER_LIST.find((u => u.id === userId));
  if (!user) return;
  if (shiftType === 'กะเช้า') {
    excludeMList.push(user);
    document.getElementById('searchExcludeM').value = '';
    document.getElementById('dropdownExcludeM').classList.add('hidden');
  } else {
    excludeNList.push(user);
    document.getElementById('searchExcludeN').value = '';
    document.getElementById('dropdownExcludeN').classList.add('hidden');
  }
  document.getElementById('swapPlanPreview').style.display = 'none';
  renderExcludeTags(shiftType);
};

window.removeExcludeStaff = function(userId, shiftType) {
  if (shiftType === 'กะเช้า') excludeMList = excludeMList.filter((u => u.id !== userId)); else excludeNList = excludeNList.filter((u => u.id !== userId));
  document.getElementById('swapPlanPreview').style.display = 'none';
  renderExcludeTags(shiftType);
};

window.renderExcludeTags = function(shiftType) {
  const containerId = shiftType === 'กะเช้า' ? 'tagsExcludeM' : 'tagsExcludeN';
  const container = document.getElementById(containerId);
  const list = shiftType === 'กะเช้า' ? excludeMList : excludeNList;
  const colorClass = shiftType === 'กะเช้า' ? 'bg-orange-100 text-orange-800 border-orange-200' : 'bg-purple-100 text-purple-800 border-purple-200';
  if (list.length === 0) {
    container.innerHTML = `<span class="text-gray-400 text-[10px] italic w-full text-center py-2">ยังไม่มีรายชื่อ</span>`;
    return;
  }
  container.innerHTML = list.map((u => window.renderTemplate('tpl-swap-exclude-tag', {
    colorClass: colorClass,
    username: u.username,
    id: u.id,
    shiftType: shiftType
  }))).join('');
};

document.addEventListener('click', (function(event) {
  const mInput = document.getElementById('searchExcludeM');
  const nInput = document.getElementById('searchExcludeN');
  const mDrop = document.getElementById('dropdownExcludeM');
  const nDrop = document.getElementById('dropdownExcludeN');
  if (mInput && !mInput.contains(event.target) && !mDrop.contains(event.target)) mDrop.classList.add('hidden');
  if (nInput && !nInput.contains(event.target) && !nDrop.contains(event.target)) nDrop.classList.add('hidden');
}));

function swapTaskDateTH(ts) {
  if (!ts) return '';
  let s = String(ts).trim().replace(' ', 'T');
  if (!/([zZ]|[+-]\d\d(:?\d\d)?)$/.test(s)) s += 'Z';
  const d = new Date(s);
  if (isNaN(d)) return String(ts).slice(0, 10);
  return new Date(d.getTime() + 7 * 36e5).toISOString().slice(0, 10);
}

async function swapDeleteLeavesBatch(rows, onlyXX) {
  const byDate = {};
  (rows || []).forEach((r => {
    if (r && r.user_id != null && r.leave_date) (byDate[r.leave_date] = byDate[r.leave_date] || new Set).add(r.user_id);
  }));
  const jobs = [];
  Object.entries(byDate).forEach((([d, set]) => {
    const ids = [ ...set ];
    for (let i = 0; i < ids.length; i += 150) {
      let q = appDB.from('leave_requests').delete().eq('leave_date', d).in('user_id', ids.slice(i, i + 150));
      if (onlyXX) q = q.eq('reason', 'XX');
      jobs.push(q);
    }
  }));
  for (let i = 0; i < jobs.length; i += 6) {
    const res = await Promise.all(jobs.slice(i, i + 6));
    const bad = res.find((r => r && r.error));
    if (bad) throw bad.error;
  }
}

async function swapDeleteTasksBatch(ids) {
  const jobs = [];
  for (let i = 0; i < (ids || []).length; i += 200) jobs.push(appDB.from('scheduled_tasks').delete().in('id', ids.slice(i, i + 200)));
  const res = await Promise.all(jobs);
  const bad = res.find((r => r && r.error));
  if (bad) throw bad.error;
}

function getSafeDateStr(baseDateStr, offsetDays) {
  const d = new Date(baseDateStr + 'T12:00:00');
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

function getTodayStrLocal() {
  const d = new Date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const SWAP_LEAVE_OFFSETS = {
  NtoM: [ -1, 0, 1 ],
  MtoN: [ 0, 1 ]
};

function getSwapBlockDates(targetDateStr, direction) {
  const offsets = SWAP_LEAVE_OFFSETS[direction] || SWAP_LEAVE_OFFSETS.NtoM;
  return offsets.map((o => o === 0 ? targetDateStr : getSafeDateStr(targetDateStr, o)));
}

function hasSwapLeaveConflict(targetDateStr, direction, leaveLookup) {
  const dates = getSwapBlockDates(targetDateStr, direction);
  const check = typeof leaveLookup === 'function' ? leaveLookup : d => !!(leaveLookup && leaveLookup.has && leaveLookup.has(d));
  return dates.some(check);
}

function getSwapConflictMsg(direction) {
  return direction === 'MtoN' ? 'พนักงานมีวันหยุดชนกับช่วงเข้าดึก (วันสลับกะ หรือวันถัดไป)' : 'พนักงานมีวันหยุดติดกับวันสลับกะ (วันก่อนหน้า วันสลับ หรือวันถัดไป) จะกลายเป็นหยุดติดกันหลายวัน';
}

window.generateSwapPlan = async function() {
  try {
    const startDateVal = document.getElementById('swapStartDate').value;
    const endDateVal = document.getElementById('swapEndDate').value;
    const targetDept = document.getElementById('swapDeptSelect').value;
    const shiftPair = document.getElementById('swapShiftPair')?.value || 'M_N';
    const SHIFT_MAP = {
      M_N: {
        from: 'กะเช้า',
        to: 'กะดึก',
        toLabel: 'ดึก',
        fromLabel: 'เช้า',
        bidirectional: true
      },
      M_A: {
        from: 'กะเช้า',
        to: 'กะกลาง',
        toLabel: 'กลาง',
        fromLabel: 'เช้า',
        bidirectional: true
      },
      A_N: {
        from: 'กะกลาง',
        to: 'กะดึก',
        toLabel: 'ดึก',
        fromLabel: 'กลาง',
        bidirectional: true
      },
      N_M: {
        from: 'กะดึก',
        to: 'กะเช้า',
        toLabel: 'เช้า',
        fromLabel: 'ดึก',
        bidirectional: false
      },
      M_only: {
        from: 'กะเช้า',
        to: 'กะดึก',
        toLabel: 'ดึก',
        fromLabel: 'เช้า',
        bidirectional: false
      }
    };
    const pair = SHIFT_MAP[shiftPair] || SHIFT_MAP['M_N'];
    currentSwapPair = pair;
    if (!startDateVal || !endDateVal) return Swal.fire('แจ้งเตือน', 'กรุณาระบุวันที่เริ่มต้นและสิ้นสุด', 'warning');
    const startDateObj = new Date(startDateVal);
    const endDateObj = new Date(endDateVal);
    if (startDateObj > endDateObj) return Swal.fire('แจ้งเตือน', 'วันที่เริ่มต้น ต้องมาก่อนวันที่สิ้นสุด', 'warning');
    const diffTime = Math.abs(endDateObj - startDateObj);
    const daysToDistribute = Math.ceil(diffTime / (1e3 * 60 * 60 * 24)) + 1;
    if (daysToDistribute > 31) return Swal.fire('แจ้งเตือน', 'ช่วงเวลาห่างกันเกินไป (ไม่ควรเกิน 1 เดือน)', 'warning');
    const targetMonthStr = startDateObj.toLocaleDateString('th-TH', {
      month: 'long',
      year: 'numeric'
    });
    Swal.fire({
      title: 'กำลังคำนวณแผน...',
      text: `ระบบกำลังดึงข้อมูลวันหยุดของเดือน "${targetMonthStr}" มาคำนวณ`,
      didOpen: () => Swal.showLoading()
    });
    if (typeof window.getUsersCached === 'function') {
      const users = await window.getUsersCached();
      if (users && users.length > 0) window.GLOBAL_USER_LIST = users;
    } else {
      await fetchUsers();
    }
    let userLeaves = {};
    try {
      const bufferStart = getSafeDateStr(startDateVal, -7);
      const bufferEnd = getSafeDateStr(endDateVal, 7);
      const {data: leaveData} = await appDB.from('leave_requests').select('user_id, leave_date').gte('leave_date', bufferStart).lte('leave_date', bufferEnd);
      if (leaveData) {
        leaveData.forEach((l => {
          if (!userLeaves[l.user_id]) userLeaves[l.user_id] = new Set;
          userLeaves[l.user_id].add(l.leave_date);
        }));
      }
    } catch (dbError) {}
    const hasLeave = (userId, dateStr) => userLeaves[userId] && userLeaves[userId].has(dateStr);
    let mStaff = GLOBAL_USER_LIST.filter((u => {
      const uDept = u.department || 'AM';
      if (u.allowed_shift !== pair.from) return false;
      if (targetDept === 'TRAINER') {
        if (uDept === 'AM' || uDept === 'OD') return false;
      } else if (targetDept !== 'ALL') {
        if (uDept !== targetDept) return false;
      }
      if (excludeMList.some((e => e.id === u.id))) return false;
      return true;
    }));
    let nStaff = pair.bidirectional ? GLOBAL_USER_LIST.filter((u => {
      const uDept = u.department || 'AM';
      if (u.allowed_shift !== pair.to) return false;
      if (targetDept === 'TRAINER') {
        if (uDept === 'AM' || uDept === 'OD') return false;
      } else if (targetDept !== 'ALL') {
        if (uDept !== targetDept) return false;
      }
      if (excludeNList.some((e => e.id === u.id))) return false;
      return true;
    })) : [];
    if (mStaff.length === 0 && nStaff.length === 0) return Swal.fire('ไม่พบข้อมูล', `ไม่มีพนักงานให้สลับในแผนกที่เลือก`, 'error');
    mStaff.sort((() => Math.random() - .5));
    nStaff.sort((() => Math.random() - .5));
    let mBuckets = Array.from({
      length: daysToDistribute
    }, (() => []));
    let nBuckets = Array.from({
      length: daysToDistribute
    }, (() => []));
    let failedMStaff = [];
    let failedNStaff = [];
    for (let u of mStaff) {
      let bestDayIndex = -1;
      let minCount = Infinity;
      let validDaysStrict = [];
      for (let i = 0; i < daysToDistribute; i++) {
        const targetDate = getSafeDateStr(startDateVal, i);
        if (!hasSwapLeaveConflict(targetDate, 'MtoN', (d => hasLeave(u.id, d)))) {
          validDaysStrict.push(i);
        }
      }
      if (validDaysStrict.length > 0) {
        for (let idx of validDaysStrict) {
          if (mBuckets[idx].length < minCount) {
            minCount = mBuckets[idx].length;
            bestDayIndex = idx;
          }
        }
      }
      if (bestDayIndex !== -1) mBuckets[bestDayIndex].push(u); else failedMStaff.push(u);
    }
    for (let u of nStaff) {
      let bestDayIndex = -1;
      let minCount = Infinity;
      let validDaysStrict = [];
      for (let i = 0; i < daysToDistribute; i++) {
        const gapDate = getSafeDateStr(startDateVal, i);
        if (!hasSwapLeaveConflict(gapDate, 'NtoM', (d => hasLeave(u.id, d)))) {
          validDaysStrict.push(i);
        }
      }
      if (validDaysStrict.length > 0) {
        for (let idx of validDaysStrict) {
          if (nBuckets[idx].length < minCount) {
            minCount = nBuckets[idx].length;
            bestDayIndex = idx;
          }
        }
      }
      if (bestDayIndex !== -1) nBuckets[bestDayIndex].push(u); else failedNStaff.push(u);
    }
    if (failedMStaff.length > 0 || failedNStaff.length > 0) {
      const allFailed = [ ...failedMStaff, ...failedNStaff ];
      const nameList = allFailed.map((u => u.username)).join(', ');
      Swal.fire({
        icon: 'warning',
        title: `⚠️ พบ ${allFailed.length} คน ที่ชนวันหยุด`,
        html: `<div class="text-left text-sm"><p class="mb-2">พนักงานต่อไปนี้คิวสลับชนกับวันหยุดพอดี ระบบยังคงจัดให้สลับกะตามปกติ</p><p class="font-bold text-orange-600">${nameList}</p><p class="mt-2 text-xs text-gray-500">ถ้าต้องการให้ใครอยู่กะเดิม ให้เลือกเองที่ช่อง "ล็อกพนักงาน" แล้วคำนวณใหม่</p></div>`,
        confirmButtonText: 'รับทราบ'
      });
    } else {
      Swal.close();
    }
    window.globalUserLeaves = userLeaves;
    generatedSwapPlan = [];
    for (let i = 0; i < daysToDistribute; i++) {
      const dateStr = getSafeDateStr(startDateVal, i);
      const displayDate = new Date(dateStr).toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
      const prevDateStr = getSafeDateStr(dateStr, -1);
      const prevDateDisplay = new Date(prevDateStr).toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short'
      });
      const nextDateStr = getSafeDateStr(dateStr, 1);
      const nextDateDisplay = new Date(nextDateStr).toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short'
      });
      const restDateStr = dateStr;
      const startMornStr = getSafeDateStr(dateStr, 1);
      const lastNightStr = getSafeDateStr(dateStr, -1);
      const restDateDisplay = new Date(restDateStr).toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short'
      });
      const startMornDisplay = new Date(startMornStr).toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short'
      });
      const lastNightDisplay = new Date(lastNightStr).toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short'
      });
      const mList = mBuckets[i] || [];
      const nList = nBuckets[i] || [];
      if (mList.length === 0 && nList.length === 0) continue;
      generatedSwapPlan.push({
        dayNumber: i + 1,
        targetDate: dateStr,
        targetNextDate: nextDateStr,
        targetMornDate: startMornStr,
        morningToNight: mList,
        nightToMorning: nList,
        descMtoN: `ทำเช้าวันสุดท้าย: ${prevDateDisplay} → เริ่มเข้าดึกวันแรก: ${displayDate}`,
        descNtoM: `ทำดึกคืนสุดท้าย: ${lastNightDisplay} → หยุดพัก 1 วัน (${restDateDisplay}) → เริ่มเข้าเช้า: ${startMornDisplay}`
      });
    }
    window.renderSwapPlanPreviewUI();
    document.getElementById('swapPlanPreview').style.display = 'block';
    setTimeout((() => {
      document.getElementById('autoSwapModalBody').scrollTop = document.getElementById('autoSwapModalBody').scrollHeight;
    }), 100);
  } catch (error) {
    Swal.fire('Error โค้ดมีปัญหา!', error.message, 'error');
  }
};

window.renderSwapPlanPreviewUI = function() {
  const container = document.getElementById('planDaysContainer');
  if (!container) return;
  let html = generatedSwapPlan.map(((plan, i) => {
    const displayDate = new Date(plan.targetDate).toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    const prevDateDisplay = new Date(getSafeDateStr(plan.targetDate, -1)).toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short'
    });
    const nextDateDisplay = new Date(plan.targetNextDate).toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short'
    });
    const mNames = plan.morningToNight.map((u => window.renderTemplate('tpl-swap-plan-user', {
      id: u.id,
      dayIndex: i,
      direction: 'MtoN',
      colorClass: 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200',
      username: u.username
    }))).join('');
    const nNames = plan.nightToMorning.map((u => window.renderTemplate('tpl-swap-plan-user', {
      id: u.id,
      dayIndex: i,
      direction: 'NtoM',
      colorClass: 'bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200',
      username: u.username
    }))).join('');
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
  })).join('');
  container.innerHTML = html;
};

window.confirmAndSaveSwapPlan = async function() {
  if (!generatedSwapPlan || generatedSwapPlan.length === 0) return;
  Swal.fire({
    title: 'ยืนยันสร้างตารางสลับกะ?',
    text: 'ระบบจะตั้งเวลาสลับกะ และลงวันหยุด XX ให้กลุ่มที่สลับกะอัตโนมัติ',
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#059669',
    confirmButtonText: 'บันทึกเลย',
    cancelButtonText: 'ยกเลิก'
  }).then((async result => {
    if (result.isConfirmed) {
      Swal.fire({
        title: 'กำลังบันทึกข้อมูล...',
        didOpen: () => Swal.showLoading()
      });
      try {
        let tasksToInsert = [];
        let leaveRequestsToInsert = [];
        const startDateStr = document.getElementById('swapStartDate').value;
        const _p = currentSwapPair || {
          to: 'กะดึก',
          from: 'กะเช้า',
          toLabel: 'ดึก',
          fromLabel: 'เช้า'
        };
        generatedSwapPlan.forEach((dayPlan => {
          dayPlan.morningToNight.forEach((user => {
            let exactTime = new Date(`${dayPlan.targetDate}T05:00:00+07:00`);
            tasksToInsert.push({
              task_type: 'individual_shift_update',
              payload: {
                user_id: user.id,
                user_name: user.username,
                target_shift: _p.to,
                from_shift: _p.from,
                display_desc: dayPlan.descMtoN
              },
              scheduled_for: exactTime.toISOString(),
              status: 'pending'
            });
            leaveRequestsToInsert.push({
              user_id: user.id,
              user_name: user.username,
              leave_date: dayPlan.targetDate,
              reason: 'XX',
              status: 'approved'
            });
          }));
          dayPlan.nightToMorning.forEach((user => {
            const mornDate = dayPlan.targetMornDate || dayPlan.targetNextDate;
            let exactTime = new Date(`${mornDate}T05:00:00+07:00`);
            tasksToInsert.push({
              task_type: 'individual_shift_update',
              payload: {
                user_id: user.id,
                user_name: user.username,
                target_shift: _p.from,
                from_shift: _p.to,
                display_desc: dayPlan.descNtoM
              },
              scheduled_for: exactTime.toISOString(),
              status: 'pending'
            });
            const restDate = getSafeDateStr(mornDate, -1);
            leaveRequestsToInsert.push({
              user_id: user.id,
              user_name: user.username,
              leave_date: restDate,
              reason: 'XX',
              status: 'approved'
            });
          }));
        }));
        excludeMList.forEach((user => {
          tasksToInsert.push({
            task_type: 'individual_shift_update',
            payload: {
              user_id: user.id,
              user_name: user.username,
              target_shift: 'คงเดิม',
              original_shift: _p.from,
              display_desc: `อยู่${_p.fromLabel}ตามเดิม`
            },
            scheduled_for: `${startDateStr}T00:00:00`,
            status: 'info_only'
          });
        }));
        excludeNList.forEach((user => {
          tasksToInsert.push({
            task_type: 'individual_shift_update',
            payload: {
              user_id: user.id,
              user_name: user.username,
              target_shift: 'คงเดิม',
              original_shift: _p.to,
              display_desc: `อยู่${_p.toLabel}ตามเดิม`
            },
            scheduled_for: `${startDateStr}T00:00:00`,
            status: 'info_only'
          });
        }));
        if (tasksToInsert.length > 0) {
          const {error: error} = await appDB.from('scheduled_tasks').insert(tasksToInsert);
          if (error) throw error;
        }
        if (leaveRequestsToInsert.length > 0) {
          await swapDeleteLeavesBatch(leaveRequestsToInsert, false);
          const {error: leaveError} = await appDB.from('leave_requests').insert(leaveRequestsToInsert);
          if (leaveError) throw leaveError;
        }
        if (typeof logAction === 'function') await logAction('Auto Swap Plan', `สร้างแผนสลับกะ และลง XX อัตโนมัติ`);
        Swal.fire({
          icon: 'success',
          title: 'บันทึกสำเร็จ',
          text: 'พนักงานสามารถเช็คตารางของตัวเองได้แล้ว',
          timer: 2500
        });
        document.getElementById('swapPlanPreview').style.display = 'none';
        clearExcludeStaff();
        fetchPublicSwapSchedule();
        if (typeof swapSetMainTab === 'function') swapSetMainTab('list');
        if (typeof fetchLeaveData === 'function') fetchLeaveData();
      } catch (err) {
        Swal.fire('Error', 'เกิดข้อผิดพลาดในการบันทึก: ' + err.message, 'error');
        console.error(err);
      }
    }
  }));
};
