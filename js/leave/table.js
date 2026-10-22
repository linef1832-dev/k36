window.renderLeaveTable = function() {
  const thead = document.getElementById('tableHeaderRow');
  const tbody = document.getElementById('tableBody');
  const searchInput = document.getElementById('leaveSearchInput');
  const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
  const shiftFilterSelect = document.getElementById('leaveShiftFilter');
  const shiftFilter = shiftFilterSelect ? shiftFilterSelect.value : 'all';
  if (!thead || !tbody) return;
  thead.innerHTML = '';
  tbody.innerHTML = '';
  tbody.classList.remove('divide-y', 'divide-gray-100', 'dark:divide-slate-700');
  const _settingDept = currentViewDept;
  const s = deptSettings[_settingDept] || {
    limit: 4,
    quotaM: 0,
    quotaA: 0,
    quotaN: 0
  };
  const isGlobalAdmin = canPerm('leave_manage');
  const _d = currentViewDept || 'AM';
  const isTrainerRole = [ 'AMQL', 'ODQL', 'TRAINER' ].includes(currentUser.department);
  const isTrainerAM = currentUser.department === 'AMQL' || isTrainerRole && currentUser.department === 'AM';
  const isTrainerOD = currentUser.department === 'ODQL' || isTrainerRole && currentUser.department === 'OD';
  const isTrainerInThisPage = _d === 'AMQL' && isTrainerAM || _d === 'ODQL' && isTrainerOD || _d === 'TRAINER' && isTrainerRole;
  const isAdmin = isGlobalAdmin || window.hasUserPerm('leave_manage') || _d === 'AM' && window.hasUserPerm('leave_manage_am') || _d === 'OD' && window.hasUserPerm('leave_manage_od') || _d === 'SPECIAL' && window.hasUserPerm('leave_manage_am') || [ 'AMQL', 'ODQL', 'TRAINER' ].includes(_d) && window.hasUserPerm('leave_manage_trainer');
  const canViewAnyMonth = isAdmin || window.hasUserPerm('leave_view_any_month');
  const canRequest = isGlobalAdmin || window.hasUserPerm('leave_request') || currentViewDept === 'SPECIAL' || isTrainerInThisPage;
  const picker = document.getElementById('viewMonthPicker');
  const btnPrev = document.getElementById('btnPrevMonth');
  const btnNext = document.getElementById('btnNextMonth');
  if (!canViewAnyMonth && s.viewMonth) {
    if (picker) {
      picker.disabled = true;
      picker.classList.add('opacity-50', 'cursor-not-allowed');
    }
    if (btnPrev) btnPrev.classList.add('hidden');
    if (btnNext) btnNext.classList.add('hidden');
    const currentY = currentCalendarDate.getFullYear();
    const currentM = String(currentCalendarDate.getMonth() + 1).padStart(2, '0');
    if (`${currentY}-${currentM}` !== s.viewMonth) {
      const [y, m] = s.viewMonth.split('-');
      currentCalendarDate = new Date(parseInt(y), parseInt(m) - 1, 1);
      if (typeof updateMonthPicker === 'function') updateMonthPicker();
      fetchLeaveData();
      return;
    }
  } else {
    if (picker) {
      picker.disabled = false;
      picker.classList.remove('opacity-50', 'cursor-not-allowed');
    }
    if (btnPrev) btnPrev.classList.remove('hidden');
    if (btnNext) btnNext.classList.remove('hidden');
  }
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  if (typeof checkBookingWindow === 'function') checkBookingWindow();
  const allDeptUsers = GLOBAL_USER_LIST.filter((u => {
    const uDept = u.department || 'AM';
    const uRole = u.role ? u.role.toLowerCase() : 'staff';
    const isInSpecial = window.specialGroupUserIds && window.specialGroupUserIds.includes(String(u.id));
    if (currentViewDept === 'SPECIAL') {
      return isInSpecial;
    } else if (currentViewDept === 'TRAINER') {
      return (uDept.startsWith('TRAINER') || uRole === 'trainer') && !isInSpecial;
    } else if (currentViewDept === 'AMQL' || currentViewDept === 'TRAINER_AM') {
      return (uDept === 'AM' && uRole === 'trainer' || uDept === 'AMQL' || uDept === 'TRAINER_AM') && !isInSpecial;
    } else if (currentViewDept === 'ODQL' || currentViewDept === 'TRAINER_OD') {
      return (uDept === 'OD' && uRole === 'trainer' || uDept === 'ODQL' || uDept === 'TRAINER_OD') && !isInSpecial;
    } else {
      return uRole === 'staff' && uDept === currentViewDept && !isInSpecial;
    }
  }));
  const allDeptUserIds = new Set(allDeptUsers.map((u => String(u.id))));
  const userShiftMapAll = {};
  allDeptUsers.forEach((u => userShiftMapAll[String(u.id)] = u.allowed_shift || 'all'));
  const staffListToRender = allDeptUsers.filter((u => u.username.toLowerCase().includes(searchTerm) && (shiftFilter === 'all' || u.allowed_shift === shiftFilter))).sort(((a, b) => a.username.localeCompare(b.username)));
  const bookedMap = new Map;
  const personalCounts = {};
  const shiftDailyCounts = {};
  allLeaveData.forEach((l => {
    const strUid = String(l.user_id);
    if (!allDeptUserIds.has(strUid)) return;
    const cleanDate = String(l.leave_date || '').split('T')[0].split(' ')[0];
    const rsn = l.reason === 'Table-Booking' || !l.reason ? 'X' : l.reason;
    bookedMap.set(`${strUid}_${cleanDate}`, rsn);
    const uShift = userShiftMapAll[strUid];
    const shiftKey = `${cleanDate}_${uShift}`;
    if (!shiftDailyCounts[shiftKey]) shiftDailyCounts[shiftKey] = 0;
    shiftDailyCounts[shiftKey]++;
    const parts = cleanDate.split('-');
    if (parts.length >= 3 && parseInt(parts[1], 10) === month + 1 && parseInt(parts[0], 10) === year) {
      if (!personalCounts[strUid]) {
        personalCounts[strUid] = {
          total: 0,
          details: {}
        };
      }
      personalCounts[strUid].total++;
      if (!personalCounts[strUid].details[rsn]) {
        personalCounts[strUid].details[rsn] = 0;
      }
      personalCounts[strUid].details[rsn]++;
    }
  }));
  let displayDeptText = currentViewDept;
  if (currentViewDept === 'TRAINER') displayDeptText = 'ผู้สอน';
  if (currentViewDept === 'SPECIAL') displayDeptText = 'พนักงานใหม่';
  const totalByShift = {
    'กะเช้า': 0,
    'กะกลาง': 0,
    'กะดึก': 0
  };
  allDeptUsers.forEach((u => {
    if (totalByShift[u.allowed_shift] !== undefined) totalByShift[u.allowed_shift]++;
  }));
  let workingRowHtml = `<tr id="tableWorkingRow">\n        <th colspan="2" class="p-1.5 sticky left-0 z-30 bg-emerald-50 dark:bg-[#04251b] border-b border-r dark:border-slate-700 text-left pl-4 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400">\n            <span class="material-icons text-[12px] align-middle">groups</span> มาทำงาน (เหลือ/ทั้งหมด)\n        </th>\n    `;
  let headerHtml = `\n        <th class="p-2 sticky left-0 z-30 bg-slate-50 dark:bg-slate-800 border-b border-r dark:border-slate-700 w-[40px] min-w-[40px] max-w-[40px] text-center">No.</th>\n        <th class="p-2 sticky left-[39px] z-30 bg-slate-50 dark:bg-slate-800 border-b border-r dark:border-slate-700 w-[140px] min-w-[140px] max-w-[140px] text-left pl-4">\n            รายชื่อ (${displayDeptText})\n        </th>\n    `;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const countM = shiftDailyCounts[`${dateStr}_กะเช้า`] || 0;
    const countA = shiftDailyCounts[`${dateStr}_กะกลาง`] || 0;
    const countN = shiftDailyCounts[`${dateStr}_กะดึก`] || 0;
    const workM = Math.max(0, totalByShift['กะเช้า'] - countM);
    const workA = Math.max(0, totalByShift['กะกลาง'] - countA);
    const workN = Math.max(0, totalByShift['กะดึก'] - countN);
    workingRowHtml += `<th data-col="${d - 1}" class="p-1 border-b border-r dark:border-slate-700 align-middle bg-emerald-50 dark:bg-[#0a1f1a] min-w-[75px]">\n            <div class="flex flex-col gap-0.5">\n                <div class="flex justify-between items-center">\n                    <span class="text-[9px] font-bold text-orange-500">เช้า</span>\n                    <span class="text-[10px] font-mono font-extrabold text-emerald-700 dark:text-emerald-300">${workM}/${totalByShift['กะเช้า']}</span>\n                </div>\n                <div class="flex justify-between items-center">\n                    <span class="text-[9px] font-bold text-blue-500">กลาง</span>\n                    <span class="text-[10px] font-mono font-extrabold text-emerald-700 dark:text-emerald-300">${workA}/${totalByShift['กะกลาง']}</span>\n                </div>\n                <div class="flex justify-between items-center">\n                    <span class="text-[9px] font-bold text-purple-400">ดึก</span>\n                    <span class="text-[10px] font-mono font-extrabold text-emerald-700 dark:text-emerald-300">${workN}/${totalByShift['กะดึก']}</span>\n                </div>\n            </div>\n        </th>`;
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
    if (isLocked) bgClass = "locked-day-col bg-gray-200 dark:bg-[#0a1120]";
    headerHtml += `<th data-col="${d - 1}" class="p-1.5 border-b border-r dark:border-slate-700 min-w-[75px] align-top ${bgClass}">\n            <div class="text-[14px] text-slate-800 dark:text-white font-extrabold text-center mb-1 pb-0.5 border-b border-gray-200 dark:border-slate-600">${d}</div>\n            <div class="flex flex-col gap-1">\n                <div class="flex justify-between items-center">\n                    <span class="text-[10px] font-bold text-orange-500">เช้า</span>\n                    <span class="text-[11px] font-mono font-bold ${textM}">${countM}/${s.quotaM || 0}</span>\n                </div>\n                <div class="flex justify-between items-center">\n                    <span class="text-[10px] font-bold text-blue-500">กลาง</span>\n                    <span class="text-[11px] font-mono font-bold ${textA}">${countA}/${s.quotaA || 0}</span>\n                </div>\n                <div class="flex justify-between items-center">\n                    <span class="text-[10px] font-bold text-purple-400">ดึก</span>\n                    <span class="text-[11px] font-mono font-bold ${textN}">${countN}/${s.quotaN || 0}</span>\n                </div>\n            </div>\n        </th>`;
  }
  workingRowHtml += `</tr>`;
  const oldWorkingRow = document.getElementById('tableWorkingRow');
  if (oldWorkingRow) oldWorkingRow.remove();
  if (thead) thead.insertAdjacentHTML('beforebegin', workingRowHtml);
  thead.innerHTML = headerHtml;
  const swapsByUserId = {};
  (allSwapData || []).forEach((t => {
    let p = t.payload;
    if (typeof p === 'string') {
      try {
        p = JSON.parse(p);
      } catch (e) {
        p = {};
      }
    }
    if (!p || !p.user_id) return;
    const uid = String(p.user_id);
    if (!swapsByUserId[uid]) swapsByUserId[uid] = [];
    swapsByUserId[uid].push({
      scheduled_for: t.scheduled_for,
      status: t.status,
      _p: p
    });
  }));
  Object.keys(swapsByUserId).forEach((uid => {
    swapsByUserId[uid].sort(((a, b) => new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime()));
  }));
  let bodyHtml = '';
  staffListToRender.forEach(((u, index) => {
    const isMe = String(u.id) === String(currentUser.id);
    const strUid = String(u.id);
    const nameClass = isMe ? "text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-900/10" : "";
    const rowClass = isMe ? "bg-rose-50/30 dark:bg-rose-900/5" : "";
    const myLeaveData = personalCounts[strUid] || {
      total: 0,
      details: {}
    };
    const myTotal = myLeaveData.details['X'] || 0;
    const isPersonalFull = myTotal >= s.limit;
    let targetQuota = s.quotaM || 2;
    if (u.allowed_shift === 'กะเช้า') targetQuota = s.quotaM; else if (u.allowed_shift === 'กะกลาง') targetQuota = s.quotaA; else if (u.allowed_shift === 'กะดึก') targetQuota = s.quotaN;
    let removeBtn = '';
    if (isAdmin && currentViewDept === 'TRAINER') {
      if (typeof removeFromNewDept === 'function') {
        removeBtn = `<button onclick="removeFromNewDept(${u.id}, '${window.escapeJsAttr(u.username)}')" class="ml-1 text-gray-400 hover:text-red-500 transition"><span class="material-icons text-[10px]">close</span></button>`;
      }
    } else if (isAdmin && currentViewDept === 'SPECIAL') {
      removeBtn = `<button onclick="removeFromSpecialDept(${u.id}, '${window.escapeJsAttr(u.username)}')" class="ml-1 text-gray-400 hover:text-red-500 transition"><span class="material-icons text-[10px]">close</span></button>`;
    }
    let breakdownHtml = '';
    const detailItems = [];
    const colors = {
      X: 'text-red-500 font-black',
      XX: 'text-yellow-600 font-black',
      X4: 'text-pink-500 font-black',
      KL: 'text-green-600 font-black',
      TX: 'text-blue-500 font-black',
      TL: 'text-blue-500 font-black',
      PN: 'text-amber-700 font-black',
      KP: 'text-yellow-800 font-black'
    };
    const defaultXCount = myLeaveData.details['X'] || myLeaveData.details['Table-Booking'] || 0;
    detailItems.push(`<span class="${colors['X']} bg-slate-100 dark:bg-slate-800 px-1 rounded shadow-sm border border-gray-200 dark:border-slate-600">X:${defaultXCount}</span>`);
    if (myLeaveData.total > 0) {
      for (const [rsn, count] of Object.entries(myLeaveData.details)) {
        let displayRsn = rsn === 'Table-Booking' ? 'X' : rsn;
        if (displayRsn === 'X') continue;
        const colorCls = colors[displayRsn] || 'text-gray-500 font-black';
        if (!detailItems.some((item => item.includes(`>${displayRsn}:`)))) {
          detailItems.push(`<span class="${colorCls} bg-slate-100 dark:bg-slate-800 px-1 rounded shadow-sm border border-gray-200 dark:border-slate-600">${displayRsn}:${count}</span>`);
        }
      }
    }
    breakdownHtml = `<div class="text-[9px] leading-tight mt-1.5 flex flex-nowrap overflow-x-auto custom-scrollbar pb-1 gap-x-1">${detailItems.join('')}</div>`;
    let rowHtml = `<tr class="transition ${rowClass} h-[56px]">`;
    rowHtml += `<td class="p-2 sticky left-0 z-10 bg-white dark:bg-slate-900 border-r dark:border-slate-700 shadow-[inset_0_-1px_0_0_#e5e7eb] dark:shadow-[inset_0_-1px_0_0_#334155] text-[10px] text-center text-gray-400 font-mono w-[40px] min-w-[40px] max-w-[40px]">${index + 1}</td>`;
    rowHtml += `<td class="p-2 sticky left-[39px] z-10 bg-white dark:bg-slate-900 border-r dark:border-slate-700 shadow-[inset_0_-1px_0_0_#e5e7eb] dark:shadow-[inset_0_-1px_0_0_#334155] text-xs ${nameClass} w-[140px] min-w-[140px] max-w-[140px]">\n        <div class="flex justify-between items-start gap-1">\n            <div class="flex flex-col min-w-0 flex-1">\n                <div class="flex items-center"><span class="truncate max-w-[70px] font-bold text-[13px]">${window.escapeHtml(u.username)}</span>${removeBtn}</div>\n                ${breakdownHtml}\n            </div>\n            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 mt-0.5 ${isPersonalFull ? 'bg-red-100 text-red-600 border-red-200' : 'bg-gray-100 text-gray-500 border-gray-200 shadow-inner'}">${myTotal}/${s.limit}</span>\n        </div>\n    </td>`;
    const myMonthSwaps = swapsByUserId[strUid] || [];
    const swapTimestamps = myMonthSwaps.map((s => {
      const dt = new Date(s.scheduled_for);
      dt.setHours(0, 0, 0, 0);
      return dt.getTime();
    }));
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
              if (p.target_shift === 'กะดึก') orig = 'กะเช้า'; else if (p.target_shift === 'กะเช้า') orig = 'กะดึก'; else orig = 'กะกลาง';
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
      let activeShiftForThisDay = shiftTimeline[d];
      let shiftBgColor = '';
      if (activeShiftForThisDay === 'กะเช้า') {
        shiftBgColor = 'bg-amber-100 dark:bg-[#4a3615]';
      } else if (activeShiftForThisDay === 'กะดึก') {
        shiftBgColor = 'bg-indigo-100 dark:bg-[#3d2c6b]';
        shiftBgColor = 'bg-indigo-100 dark:bg-[#3d2c6b]';
      } else if (activeShiftForThisDay === 'กะกลาง') {
        shiftBgColor = 'bg-sky-100 dark:bg-[#1e4875]';
        shiftBgColor = 'bg-sky-100 dark:bg-[#1e4875]';
      }
      let cellClass = `cursor-pointer ${shiftBgColor}`;
      let cellContent = "";
      let baseDeptColor = 'bg-rose-500';
      if (currentViewDept === 'OD') baseDeptColor = 'bg-fuchsia-500';
      if (currentViewDept === 'TRAINER') baseDeptColor = 'bg-indigo-500';
      if (isDateLocked && !isAdmin) {
        if (isBooked) {
          let badgeStyle = getLeaveBadgeStyle(leaveReason, baseDeptColor);
          cellClass = `cursor-not-allowed opacity-70 ${badgeStyle}`;
          cellContent = `<div class="flex items-center justify-center w-full h-full text-white text-[12px] font-bold">${leaveReason}</div>`;
        } else {
          cellClass = `${shiftBgColor} cursor-not-allowed opacity-40`;
          cellContent = `<div class="flex items-center justify-center w-full h-full"><span class="material-icons text-gray-400 dark:text-slate-500 text-xs">lock</span></div>`;
        }
      } else {
        if (isBooked) {
          let badgeStyle = getLeaveBadgeStyle(leaveReason, baseDeptColor);
          cellClass = `cursor-pointer hover:opacity-90 transition-opacity duration-300 ${badgeStyle}`;
          cellContent = `<div class="flex items-center justify-center w-full h-full text-white text-[12px] font-bold animate-fade-in">${leaveReason}</div>`;
        } else {
          cellContent = '';
        }
      }
      let hoverAttr = `data-col="${d - 1}"`;
      let clickAttr = "";
      if (isDateLocked && !isAdmin) {
        if (isMe) clickAttr = `onclick="Swal.fire({icon:'error', title:'ล็อกวัน', text:'วันที่นี้ถูกล็อก ไม่สามารถทำรายการได้', timer:1500, showConfirmButton:false})"`;
      } else if (!isThisUserShiftOpen && !isAdmin && isMe) {
        clickAttr = `onclick="Swal.fire({icon:'error', title:'ปิดจองแล้ว', text:'อยู่นอกเวลาทำรายการของกะคุณ', timer:2000, showConfirmButton:false})"`;
      } else if (isMe || isAdmin) {
        if (!canRequest && isMe && !isAdmin) {
          clickAttr = `onclick="Swal.fire({icon:'error', title:'ไม่มีสิทธิ์', text:'คุณไม่มีสิทธิ์กดจอง/ยกเลิกวันหยุด', timer:1500, showConfirmButton:false})"`;
        } else {
          if (isBooked) {
            clickAttr = `onclick="toggleLeaveTable('${dateStr}', 'remove', ${u.id}, '${window.escapeJsAttr(u.username)}', '${u.allowed_shift}')"`;
          } else if (!isShiftFull || isAdmin) {
            if (!isPersonalFull || isAdmin) {
              clickAttr = `onclick="toggleLeaveTable('${dateStr}', 'add', ${u.id}, '${window.escapeJsAttr(u.username)}', '${u.allowed_shift}')"`;
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
  }));
  if (staffListToRender.length === 0) bodyHtml = `<tr><td colspan="${daysInMonth + 2}" class="p-10 text-center text-gray-400">ไม่พบรายชื่อในแผนก ${displayDeptText}</td></tr>`;
  tbody.innerHTML = bodyHtml;
};
