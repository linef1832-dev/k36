window.leaveDeptUsers = function(dept) {
  const view = dept || currentViewDept;
  return GLOBAL_USER_LIST.filter((u => {
    const uDept = u.department || 'AM';
    const isInSpecial = window.specialGroupUserIds && window.specialGroupUserIds.includes(String(u.id));
    if (view === 'SPECIAL') {
      return isInSpecial;
    } else if (view === 'AMQL' || view === 'TRAINER_AM') {
      return (uDept === 'AMQL' || uDept === 'TRAINER_AM') && !isInSpecial;
    } else if (view === 'ODQL' || view === 'TRAINER_OD') {
      return (uDept === 'ODQL' || uDept === 'TRAINER_OD') && !isInSpecial;
    } else {
      return uDept === view && !isInSpecial;
    }
  }));
};

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
  const myDeptU = String(currentUser.department || '').toUpperCase();
  const isTrainerInThisPage = [ 'AMQL', 'ODQL' ].includes(_d) && myDeptU === _d || _d === 'TRAINER' && [ 'AMQL', 'ODQL', 'TRAINER' ].includes(myDeptU);
  const isAdmin = isGlobalAdmin || window.leaveCanManage(_d);
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
  const allDeptUsers = window.leaveDeptUsers();
  const allDeptUserIds = new Set(allDeptUsers.map((u => String(u.id))));
  const staffListToRender = allDeptUsers.filter((u => u.username.toLowerCase().includes(searchTerm) && (shiftFilter === 'all' || u.allowed_shift === shiftFilter))).sort(((a, b) => a.username.localeCompare(b.username)));
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
  const _tlCache = {};
  const _timelineOf = u => {
    const strUid = String(u.id);
    if (_tlCache[strUid]) return _tlCache[strUid];
    const myMonthSwaps = swapsByUserId[strUid] || [];
    const swapTimestamps = myMonthSwaps.map((s => {
      const dt = new Date(s.scheduled_for);
      dt.setHours(0, 0, 0, 0);
      return dt.getTime();
    }));
    const shiftTimeline = {};
    const monthIdx = currentCalendarDate.getMonth();
    let baseShift = u.allowed_shift;
    const _inMonth = sw => {
      const sd = new Date(sw.scheduled_for);
      return sd.getFullYear() === year && sd.getMonth() === monthIdx;
    };
    const _movedThisMonth = myMonthSwaps.some((sw => (sw.status === 'pending' || sw.status === 'completed') && [ 'กะเช้า', 'กะกลาง', 'กะดึก' ].includes((sw._p || {}).target_shift) && _inMonth(sw)));
    myMonthSwaps.forEach((sw => {
      const sp = sw._p || {};
      if (_movedThisMonth) return;
      if (sw.status !== 'info_only' && sp.target_shift !== 'คงเดิม') return;
      if (![ 'กะเช้า', 'กะกลาง', 'กะดึก' ].includes(sp.original_shift)) return;
      const sd = new Date(sw.scheduled_for);
      if (sd.getFullYear() === year && sd.getMonth() === monthIdx) baseShift = sp.original_shift;
    }));
    const _SH = [ 'กะเช้า', 'กะกลาง', 'กะดึก' ];
    const eff = [];
    for (let i = 0; i < myMonthSwaps.length; i++) {
      const sw = myMonthSwaps[i];
      if ((sw.status === 'pending' || sw.status === 'completed') && _SH.includes((sw._p || {}).target_shift)) eff.push({
        ts: swapTimestamps[i],
        status: sw.status,
        p: sw._p
      });
    }
    let lastDone = null;
    eff.forEach((e => {
      if (e.status === 'completed') lastDone = e;
    }));
    for (let d = 0; d <= daysInMonth; d++) {
      const loopDate = new Date(year, monthIdx, d);
      loopDate.setHours(0, 0, 0, 0);
      const loopTs = loopDate.getTime();
      let prev = null, next = null;
      for (let i = 0; i < eff.length; i++) {
        if (loopTs >= eff[i].ts) prev = eff[i]; else {
          next = eff[i];
          break;
        }
      }
      let dayShift = baseShift;
      if (prev) {
        dayShift = prev === lastDone ? baseShift : prev.p.target_shift;
      } else if (next && next.status === 'completed') {
        let orig = next.p.original_shift;
        if (!_SH.includes(orig)) {
          if (next.p.target_shift === 'กะดึก') orig = 'กะเช้า'; else if (next.p.target_shift === 'กะเช้า') orig = 'กะดึก'; else orig = 'กะกลาง';
        }
        dayShift = orig;
      }
      shiftTimeline[d] = dayShift;
    }
    _tlCache[strUid] = shiftTimeline;
    return shiftTimeline;
  };
  const _shRank = sh => sh === 'กะดึก' ? 0 : sh === 'กะเช้า' ? 1 : sh === 'กะกลาง' ? 2 : 3;
  const _sortInfo = {};
  allDeptUsers.forEach((u => {
    const tl = _timelineOf(u);
    const first = tl[0];
    let stay = daysInMonth;
    for (let d = 1; d <= daysInMonth; d++) if (tl[d] !== first) {
      stay = d - 1;
      break;
    }
    _sortInfo[String(u.id)] = {
      rank: _shRank(first),
      stay: stay
    };
  }));
  const _leaveCmp = (a, b) => {
    const x = _sortInfo[String(a.id)] || {
      rank: 9,
      stay: 0
    }, y = _sortInfo[String(b.id)] || {
      rank: 9,
      stay: 0
    };
    return x.rank - y.rank || y.stay - x.stay || a.username.localeCompare(b.username);
  };
  staffListToRender.sort(_leaveCmp);
  window._leaveSortCmp = _leaveCmp;
  window._leaveSortKey = `${currentViewDept}|${year}-${String(month + 1).padStart(2, '0')}-`;
  const _monthKey = `${year}-${String(month + 1).padStart(2, '0')}-`;
  const _shiftOnDate = (uid, dateStr) => {
    const u = allDeptUsers.find((x => String(x.id) === String(uid)));
    if (!u) return 'all';
    if (!String(dateStr).startsWith(_monthKey)) return u.allowed_shift || 'all';
    const tl = _timelineOf(u);
    return tl[parseInt(String(dateStr).slice(8, 10), 10)] || u.allowed_shift || 'all';
  };
  window._leaveShiftOnDate = _shiftOnDate;
  window._leaveShiftOnDateDept = currentViewDept;
  const bookedMap = new Map;
  const personalCounts = {};
  const shiftDailyCounts = {};
  const absentCounts = {};
  const xxSet = new Set;
  allLeaveData.forEach((l => {
    if (l.reason === 'XX' && allDeptUserIds.has(String(l.user_id))) xxSet.add(String(l.user_id) + '_' + String(l.leave_date || '').split('T')[0].split(' ')[0]);
  }));
  const _cntShift = (uid, dateStr) => {
    const sid = String(uid);
    if (!xxSet.has(`${sid}_${dateStr}`) || !String(dateStr).startsWith(_monthKey)) return _shiftOnDate(sid, dateStr);
    const u = allDeptUsers.find((x => String(x.id) === sid));
    if (!u) return 'all';
    const tl = _timelineOf(u);
    let dd = parseInt(String(dateStr).slice(8, 10), 10) - 1;
    while (dd >= 1 && xxSet.has(`${sid}_${_monthKey}${String(dd).padStart(2, '0')}`)) dd--;
    return tl[dd] || u.allowed_shift || 'all';
  };
  const seenLeave = new Set;
  allLeaveData.forEach((l => {
    const strUid = String(l.user_id);
    if (!allDeptUserIds.has(strUid)) return;
    const dupKey = strUid + '_' + String(l.leave_date || '').split('T')[0].split(' ')[0];
    if (seenLeave.has(dupKey)) return;
    seenLeave.add(dupKey);
    const cleanDate = String(l.leave_date || '').split('T')[0].split(' ')[0];
    const rsn = l.reason === 'Table-Booking' || !l.reason ? 'X' : l.reason;
    bookedMap.set(`${strUid}_${cleanDate}`, rsn);
    const absKey = `${cleanDate}_${_cntShift(strUid, cleanDate)}`;
    absentCounts[absKey] = (absentCounts[absKey] || 0) + 1;
    if (rsn !== 'XX') {
      const shiftKey = `${cleanDate}_${_shiftOnDate(strUid, cleanDate)}`;
      shiftDailyCounts[shiftKey] = (shiftDailyCounts[shiftKey] || 0) + 1;
    }
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
  const totalByShiftDay = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const t = totalByShiftDay[d] = {
      'กะเช้า': 0,
      'กะกลาง': 0,
      'กะดึก': 0
    };
    const _dStr = `${_monthKey}${String(d).padStart(2, '0')}`;
    allDeptUsers.forEach((u => {
      const sh = xxSet.has(`${u.id}_${_dStr}`) ? _cntShift(u.id, _dStr) : _timelineOf(u)[d];
      if (t[sh] !== undefined) t[sh]++;
    }));
  }
  let workingRowHtml = `<tr id="tableWorkingRow">\n        <th colspan="2" class="p-1.5 sticky left-0 z-30 bg-emerald-50 dark:bg-[#04251b] border-b border-r dark:border-slate-700 text-left pl-4 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400">\n            <span class="material-icons text-[12px] align-middle">groups</span> มาทำงาน (เหลือ/ทั้งหมด)\n        </th>\n    `;
  let headerHtml = `\n        <th class="p-2 sticky left-0 z-30 bg-slate-50 dark:bg-slate-800 border-b border-r dark:border-slate-700 w-[40px] min-w-[40px] max-w-[40px] text-center">No.</th>\n        <th class="p-2 sticky left-[39px] z-30 bg-slate-50 dark:bg-slate-800 border-b border-r dark:border-slate-700 w-[140px] min-w-[140px] max-w-[140px] text-left pl-4">\n            รายชื่อ (${displayDeptText})\n        </th>\n    `;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const countM = shiftDailyCounts[`${dateStr}_กะเช้า`] || 0;
    const countA = shiftDailyCounts[`${dateStr}_กะกลาง`] || 0;
    const countN = shiftDailyCounts[`${dateStr}_กะดึก`] || 0;
    const totalByShift = totalByShiftDay[d];
    const workM = Math.max(0, totalByShift['กะเช้า'] - (absentCounts[`${dateStr}_กะเช้า`] || 0));
    const workA = Math.max(0, totalByShift['กะกลาง'] - (absentCounts[`${dateStr}_กะกลาง`] || 0));
    const workN = Math.max(0, totalByShift['กะดึก'] - (absentCounts[`${dateStr}_กะดึก`] || 0));
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
    if (isAdmin && currentViewDept === 'SPECIAL') {
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
    const shiftTimeline = _timelineOf(u);
    let isThisUserShiftOpen = true;
    if (typeof checkBookingWindow === 'function') {
      isThisUserShiftOpen = checkBookingWindow(typeof window._leaveWindowShift === 'function' ? window._leaveWindowShift(u.id, u.allowed_shift) : u.allowed_shift);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const leaveReason = bookedMap.get(`${strUid}_${dateStr}`);
      const isBooked = !!leaveReason;
      const dayShiftQ = shiftTimeline[d] || u.allowed_shift;
      const dayQuota = dayShiftQ === 'กะเช้า' ? s.quotaM : dayShiftQ === 'กะกลาง' ? s.quotaA : dayShiftQ === 'กะดึก' ? s.quotaN : targetQuota;
      const shiftCountKey = `${dateStr}_${dayShiftQ}`;
      const currentShiftCount = shiftDailyCounts[shiftCountKey] || 0;
      const isShiftFull = currentShiftCount >= (dayQuota || 0);
      let isDateLocked = false;
      if (s.startDay && d < s.startDay) isDateLocked = true;
      if (s.endDay && d > s.endDay) isDateLocked = true;
      let activeShiftForThisDay = shiftTimeline[d];
      let shiftBgColor = '';
      if (activeShiftForThisDay === 'กะเช้า') {
        shiftBgColor = 'bg-amber-100 dark:bg-[#4a3615]';
      } else if (activeShiftForThisDay === 'กะดึก') {
        shiftBgColor = 'bg-indigo-100 dark:bg-[#3d2c6b]';
      } else if (activeShiftForThisDay === 'กะกลาง') {
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
          cellContent = `<div class="flex items-center justify-center w-full h-full text-white text-[12px] font-bold">${window.escapeHtml(leaveReason)}</div>`;
        } else {
          cellClass = `${shiftBgColor} cursor-not-allowed opacity-40`;
          cellContent = `<div class="flex items-center justify-center w-full h-full"><span class="material-icons text-gray-400 dark:text-slate-500 text-xs">lock</span></div>`;
        }
      } else {
        if (isBooked) {
          let badgeStyle = getLeaveBadgeStyle(leaveReason, baseDeptColor);
          cellClass = `cursor-pointer hover:opacity-90 transition-opacity duration-300 ${badgeStyle}`;
          cellContent = `<div class="flex items-center justify-center w-full h-full text-white text-[12px] font-bold animate-fade-in">${window.escapeHtml(leaveReason)}</div>`;
        } else {
          cellContent = '';
        }
      }
      let hoverAttr = `data-col="${d - 1}"`;
      let clickAttr = "";
      if (isDateLocked && !isAdmin) {
        if (isMe) clickAttr = `onclick="Swal.fire({icon:'error', title:'ล็อกวัน', text:'วันที่นี้ถูกล็อก ไม่สามารถทำรายการได้', timer:1500, showConfirmButton:false})"`;
      } else if (!isThisUserShiftOpen && !isAdmin && isMe) {
        clickAttr = `onclick="Swal.fire({icon:'error', title:'ปิดจองแล้ว', text:'${typeof window._leaveStayOf === 'function' && window._leaveStayOf(u.id) ? 'กลุ่มอยู่กะเดิม (ไม่สลับ) เปิดจองพร้อมรอบ' + window._leaveWindowShift(u.id, u.allowed_shift) : 'อยู่นอกเวลาทำรายการของกะคุณ'}', timer:2500, showConfirmButton:false})"`;
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
          } else if (isMe) {
            clickAttr = dayQuota ? `onclick="Swal.fire({icon:'warning', title:'วันนี้เต็มแล้ว', text:'กะของคุณวันนี้มีคนหยุดครบ ${dayQuota} คนแล้ว', timer:1800, showConfirmButton:false})"` : `onclick="Swal.fire({icon:'info', title:'ยังไม่เปิดโควตา', text:'กะของคุณยังไม่ได้ตั้งจำนวนคนหยุดต่อวัน', timer:1800, showConfirmButton:false})"`;
          }
        }
      }
      rowHtml += `<td class="border-r border-b dark:border-slate-700 text-center ${cellClass}" ${clickAttr} ${hoverAttr}>${cellContent}</td>`;
    }
    rowHtml += `</tr>`;
    bodyHtml += rowHtml;
  }));
  if (staffListToRender.length === 0) {
    const isSp = currentViewDept === 'SPECIAL';
    const canMg = typeof window.leaveCanManage === 'function' && window.leaveCanManage(currentViewDept);
    const hint = isSp ? canMg ? `<div style="margin-top:8px;font-size:12px;color:var(--k-mute)">กลุ่มนี้เป็นกลุ่มที่จัดเอง — เพิ่มชื่อได้ที่ <b>ตั้งค่า → จัดการรายชื่อ</b></div><button type="button" onclick="openManageSpecialModal()" class="lv2-btn" style="margin:10px auto 0;display:inline-flex"><span class="material-icons">group_add</span>จัดการรายชื่อ</button>` : `<div style="margin-top:8px;font-size:12px;color:var(--k-mute)">ยังไม่มีใครถูกจัดเข้ากลุ่มนี้</div>` : '';
    bodyHtml = `<tr><td colspan="${daysInMonth + 2}" class="p-10 text-center text-gray-400">ไม่พบรายชื่อในแผนก ${displayDeptText}${hint}</td></tr>`;
  }
  tbody.innerHTML = bodyHtml;
};
