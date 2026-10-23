window.addToPendingList = function() {
  const shift = document.getElementById('indivTargetShift').value;
  const dateVal = document.getElementById('indivDate').value;
  const checkedBoxes = document.querySelectorAll('.indiv-user-cb:checked');
  if (checkedBoxes.length === 0) return Swal.fire('ไม่ได้เลือก', 'กรุณาติ๊กเลือกพนักงานอย่างน้อย 1 คน', 'warning');
  if (!dateVal) return Swal.fire('ไม่ได้เลือกเวลา', 'กรุณาระบุวัน/เวลาที่มีผล', 'warning');
  let addedCount = 0, dupCount = 0;
  const whenIso = new Date(dateVal).toISOString();
  checkedBoxes.forEach((cb => {
    let userId = cb.value;
    if (!isNaN(Number(userId))) userId = Number(userId);
    const userName = cb.dataset.name;
    if (pendingSchedules.some((p => String(p.user_id) === String(userId) && p.scheduled_for === whenIso))) {
      cb.checked = false;
      dupCount++;
      return;
    }
    pendingSchedules.push({
      user_id: userId,
      user_name: userName,
      target_shift: shift,
      scheduled_for: whenIso
    });
    cb.checked = false;
    addedCount++;
  }));
  renderPendingTable();
  const selectAllCb = document.querySelector('input[onchange="toggleSelectAllIndiv(this)"]');
  if (selectAllCb) selectAllCb.checked = false;
  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2e3
  });
  Toast.fire({
    icon: addedCount ? 'success' : 'info',
    title: `เพิ่ม ${addedCount} รายการรอรันแล้ว${dupCount ? ` (ข้าม ${dupCount} ที่ซ้ำ)` : ''}`
  });
};

window.renderPendingTable = function() {
  const tbody = document.getElementById('pendingTableBody');
  const container = document.getElementById('pendingListContainer');
  const countSpan = document.getElementById('pendingCount');
  if (!tbody || !container) return;
  if (pendingSchedules.length > 0) {
    container.classList.remove('hidden');
    container.classList.add('flex');
  } else {
    container.classList.add('hidden');
    container.classList.remove('flex');
  }
  if (countSpan) countSpan.innerText = pendingSchedules.length;
  tbody.innerHTML = pendingSchedules.map(((item, index) => `\n        <tr class="border-b border-gray-600/50">\n            <td class="p-1.5">${window.escapeHtml(item.user_name)}</td>\n            <td class="p-1.5 font-bold text-yellow-200">${item.target_shift}</td>\n            <td class="p-1.5 font-mono">${new Date(item.scheduled_for).toLocaleString('th-TH')}</td>\n            <td class="p-1.5 text-center">\n                <button onclick="removeFromPendingList(${index})" class="text-red-400 hover:text-red-300 font-bold bg-slate-800 px-2 py-0.5 rounded transition">x</button>\n            </td>\n        </tr>\n    `)).join('');
};

window.removeFromPendingList = function(index) {
  pendingSchedules.splice(index, 1);
  renderPendingTable();
};

async function commitIndividualSchedules() {
  if (!window.sysRequireAdmin()) return;
  if (pendingSchedules.length === 0) return;
  Swal.fire({
    title: 'กำลังบันทึก...',
    didOpen: () => Swal.showLoading()
  });
  const insertData = pendingSchedules.map((item => ({
    task_type: 'individual_shift_update',
    payload: {
      user_id: item.user_id,
      user_name: item.user_name,
      target_shift: item.target_shift
    },
    scheduled_for: item.scheduled_for,
    status: 'pending'
  })));
  const {error: error} = await appDB.from('scheduled_tasks').insert(insertData);
  if (error) {
    Swal.fire('Error', error.message, 'error');
  } else {
    pendingSchedules = [];
    renderPendingTable();
    if (typeof fetchIndividualTasks === 'function') await fetchIndividualTasks();
    Swal.fire('สำเร็จ', 'บันทึกรายการเปลี่ยนกะล่วงหน้าเรียบร้อย', 'success');
  }
}

async function manualRefreshIndiv() {
  if (typeof fetchIndividualTasks === 'function') await fetchIndividualTasks();
  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 1500,
    timerProgressBar: true
  });
  Toast.fire({
    icon: 'success',
    title: 'รีเฟรชประวัติแล้ว'
  });
}

async function fetchIndividualTasks() {
  try {
    if (typeof processPendingTasks === 'function') await processPendingTasks();
  } catch (e) {
    console.warn('[fetchIndividualTasks] processPendingTasks error:', e);
  }
  const base = () => appDB.from('scheduled_tasks').select('*').eq('task_type', 'individual_shift_update');
  const [pend, done] = await Promise.all([ base().eq('status', 'pending').order('scheduled_for', {
    ascending: true
  }).limit(1e3), base().eq('status', 'completed').order('scheduled_for', {
    ascending: false
  }).limit(300) ]);
  GLOBAL_INDIV_TASKS = [ ...pend.data || [], ...(done.data || []).slice().reverse() ];
  renderIndivTaskLog(GLOBAL_INDIV_TASKS);
}

function renderIndivTaskLog(data) {
  const pendingContainer = document.getElementById('indivTaskLogPending');
  const completedContainer = document.getElementById('indivTaskLogCompleted');
  if (!pendingContainer || !completedContainer) return;
  let counts = {
    'กะเช้า': 0,
    'กะกลาง': 0,
    'กะดึก': 0
  };
  if (data) {
    data.forEach((t => {
      if (t.payload && t.payload.target_shift && counts[t.payload.target_shift] !== undefined) {
        counts[t.payload.target_shift]++;
      }
    }));
  }
  if (document.getElementById('sumIndivM')) document.getElementById('sumIndivM').innerText = counts['กะเช้า'];
  if (document.getElementById('sumIndivA')) document.getElementById('sumIndivA').innerText = counts['กะกลาง'];
  if (document.getElementById('sumIndivN')) document.getElementById('sumIndivN').innerText = counts['กะดึก'];
  if (!data || data.length === 0) {
    pendingContainer.innerHTML = '<span class="text-gray-500 italic">ไม่มีข้อมูล</span>';
    completedContainer.innerHTML = '<span class="text-gray-500 italic">ไม่มีข้อมูล</span>';
    return;
  }
  const pendingHTML = data.filter((t => t.status === 'pending')).map((t => createIndivLogItem(t))).join('');
  const completedHTML = data.filter((t => t.status === 'completed')).map((t => createIndivLogItem(t, true))).join('');
  pendingContainer.innerHTML = pendingHTML || '<span class="text-gray-500 italic">ไม่มีรายการรอ</span>';
  completedContainer.innerHTML = completedHTML || '<span class="text-gray-500 italic">ไม่มีประวัติ</span>';
}

function createIndivLogItem(t, isCompleted = false) {
  const time = new Date(t.scheduled_for).toLocaleString('th-TH');
  let p = t.payload || {};
  if (typeof p === 'string') {
    try {
      p = JSON.parse(p);
    } catch (e) {
      p = {};
    }
  }
  const statusBadge = isCompleted ? '<span class="text-[9px] bg-green-900 text-green-300 px-1 rounded">สำเร็จ</span>' : '';
  const shiftClass = p.target_shift === 'กะเช้า' ? 'text-orange-300' : p.target_shift === 'กะกลาง' ? 'text-blue-300' : 'text-purple-300';
  return `<div class="flex justify-between border-b border-gray-700 py-1 indiv-log-item" data-shift="${p.target_shift}">\n        <span><span class="text-white font-bold user-name-span">${window.escapeHtml(p.user_name || '-')}</span> -> <span class="${shiftClass}">${p.target_shift}</span> <span class="text-[9px] text-gray-500">[${time}]</span> ${statusBadge}</span>\n        <span onclick="deleteTask(${t.id})" class="text-red-400 cursor-pointer material-icons text-xs hover:text-red-200">delete</span>\n     </div>`;
}

function filterIndivTaskLog(shiftFilter = "") {
  const searchInput = document.getElementById('indivHistorySearch');
  const nameFilter = searchInput ? searchInput.value.toLowerCase() : '';
  const items = document.querySelectorAll('.indiv-log-item');
  items.forEach((item => {
    const nameSpan = item.querySelector('.user-name-span');
    const itemShift = item.dataset.shift;
    let show = true;
    if (nameFilter && nameSpan) {
      if (nameSpan.innerText.toLowerCase().indexOf(nameFilter) === -1) show = false;
    }
    if (shiftFilter && itemShift !== shiftFilter) show = false;
    if (show) item.classList.remove('hidden'); else item.classList.add('hidden');
  }));
}

async function deleteTask(id) {
  if (!window.sysRequireAdmin()) return;
  Swal.fire({
    title: 'ยืนยันลบ?',
    text: "ต้องการลบรายการนี้ใช่หรือไม่ (วันหยุด XX ที่ระบบลงให้จากรายการนี้จะถูกลบออกจากตารางวันหยุดด้วย)",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    confirmButtonText: 'ใช่, ลบเลย!',
    cancelButtonText: 'ยกเลิก'
  }).then((async result => {
    if (result.isConfirmed) {
      let xxCleanup = null;
      try {
        const {data: taskRow} = await appDB.from('scheduled_tasks').select('*').eq('id', id).maybeSingle();
        if (taskRow && taskRow.task_type === 'individual_shift_update' && taskRow.payload && taskRow.payload.user_id && taskRow.payload.target_shift !== 'คงเดิม') {
          const d = new Date(taskRow.scheduled_for);
          if ((taskRow.payload.target_shift || '').includes('เช้า')) d.setDate(d.getDate() - 1);
          const xxDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          xxCleanup = {
            user_id: taskRow.payload.user_id,
            date: xxDate
          };
        }
      } catch (e) {
        console.error('เตรียมลบ XX:', e);
      }
      const {error: error} = await appDB.from('scheduled_tasks').delete().eq('id', id);
      if (error) {
        Swal.fire('Error', error.message, 'error');
      } else {
        if (xxCleanup) {
          try {
            await appDB.from('leave_requests').delete().eq('user_id', xxCleanup.user_id).eq('leave_date', xxCleanup.date).eq('reason', 'XX');
          } catch (e) {
            console.error('ลบ XX:', e);
          }
        }
        if (typeof fetchTasks === 'function') fetchTasks();
        if (typeof fetchIndividualTasks === 'function') fetchIndividualTasks();
        if (typeof fetchLeaveData === 'function') fetchLeaveData();
        Swal.fire('ลบสำเร็จ!', 'ลบรายการและวันหยุด XX ที่เกี่ยวข้องเรียบร้อยแล้ว', 'success');
      }
    }
  }));
}

async function fetchTasks() {
  const {data: data} = await appDB.from('scheduled_tasks').select('*').neq('task_type', 'individual_shift_update').order('created_at', {
    ascending: false
  }).limit(5);
  const taskLog = document.getElementById('taskLog');
  if (taskLog) {
    const pl = t => {
      let p = t.payload || {};
      if (typeof p === 'string') {
        try {
          p = JSON.parse(p);
        } catch (e) {
          p = {};
        }
      }
      return p;
    };
    taskLog.innerHTML = (data || []).map((t => `<div class="flex justify-between border-b border-gray-700 py-1"><span>${new Date(t.scheduled_for).toLocaleString('th-TH')} ${pl(t).from || '-'} → ${pl(t).to || '-'}${t.status === 'completed' ? ' ✓' : ''}</span><span onclick="deleteTask(${t.id})" class="text-red-400 cursor-pointer material-icons text-xs">delete</span></div>`)).join('');
  }
}

window.processPendingTasks = async function() {
  if (!window.sysIsAdmin()) return;
  if (window._procTasksRunning) return;
  window._procTasksRunning = true;
  try {
    const now = (new Date).toISOString();
    const {data: data} = await appDB.from('scheduled_tasks').select('*').eq('status', 'pending').lte('scheduled_for', now);
    if (data && data.length > 0) {
      let updateCount = 0;
      const completedTaskIds = [];
      for (let t of data) {
        let p = t.payload;
        if (typeof p === 'string') {
          try {
            p = JSON.parse(p);
          } catch (e) {
            p = {};
          }
        }
        let okTask = true;
        if (t.task_type === 'move_shift') {
          const {error: mErr} = await appDB.from('users').update({
            allowed_shift: p.to
          }).eq('allowed_shift', p.from);
          if (mErr) {
            okTask = false;
            console.error('ย้ายกะทั้งกลุ่มไม่สำเร็จ:', mErr);
          }
        } else if (t.task_type === 'individual_shift_update') {
          const targetName = p.user_name;
          const targetShift = p.target_shift;
          if ((p.user_id || targetName) && targetShift && targetShift !== 'คงเดิม') {
            let q = appDB.from('users').update({
              allowed_shift: targetShift
            });
            q = p.user_id ? q.eq('id', p.user_id) : q.eq('username', targetName);
            const {error: uErr} = await q;
            if (uErr) {
              okTask = false;
              console.error("อัปเดตกะไม่สำเร็จ:", uErr);
            }
          }
        }
        if (!okTask) continue;
        completedTaskIds.push(t.id);
        updateCount++;
      }
      if (completedTaskIds.length > 0) {
        const {error: bulkErr} = await appDB.from('scheduled_tasks').update({
          status: 'completed'
        }).in('id', completedTaskIds);
        if (bulkErr) console.error('[processPendingTasks] อัปเดต status=completed ไม่สำเร็จ:', bulkErr);
      }
      window._procTasksRunning = false;
      if (typeof fetchTasks === 'function') fetchTasks();
      if (typeof fetchIndividualTasks === 'function') fetchIndividualTasks();
      if (typeof fetchUsers === 'function') await fetchUsers();
      if (updateCount) {
        const Toast = Swal.mixin({
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3e3
        });
        Toast.fire({
          icon: 'success',
          title: `ถึงเวลาย้ายกะอัตโนมัติสำเร็จ ${updateCount} คน`
        });
      }
    }
  } catch (error) {
    console.error("Auto Shift Error:", error);
  } finally {
    window._procTasksRunning = false;
  }
};

function renderOperatingHours() {
  const container = document.getElementById('operatingTimeContainer');
  if (!container) return;
  container.innerHTML = '';
  const shifts = new Set;
  Object.keys(SETTINGS).forEach((k => {
    if (k.startsWith('open_time_')) shifts.add(k.replace('open_time_', ''));
  }));
  if (!shifts.has('เช้า')) shifts.add('เช้า');
  if (!shifts.has('กลาง')) shifts.add('กลาง');
  if (!shifts.has('ดึก')) shifts.add('ดึก');
  let opHtml = '';
  shifts.forEach((suffix => {
    const openVal = SETTINGS[`open_time_${suffix}`] || '00:00';
    const closeVal = SETTINGS[`close_time_${suffix}`] || '23:59';
    const color = suffix === 'เช้า' ? 'orange' : suffix === 'กลาง' ? 'blue' : 'purple';
    opHtml += `\n            <div class="flex items-center gap-2 text-xs operating-row bg-slate-900/50 p-1 rounded border border-slate-700" data-suffix="${window.escapeHtml(suffix)}">\n                <span class="w-10 text-${color}-300 font-bold capitalize shift-label">${window.escapeHtml(suffix)}:</span>\n                <input type="time" class="bg-slate-800 text-white p-1 rounded border border-slate-600 text-center flex-1 open-input" value="${openVal}">\n                <span class="text-gray-500">-</span>\n                <input type="time" class="bg-slate-800 text-white p-1 rounded border border-slate-600 text-center flex-1 close-input" value="${closeVal}">\n                <button onclick="deleteOperatingShift(this.closest('.operating-row').dataset.suffix)" class="text-red-400 hover:text-red-300 ml-1" title="ลบกะนี้"><span class="material-icons text-sm">close</span></button>\n            </div>\n        `;
  }));
  container.innerHTML = opHtml;
}

async function addOperatingShift() {
  if (!window.sysRequireAdmin()) return;
  const {value: name} = await Swal.fire({
    title: 'ชื่อกะใหม่ (เช่น เช้า, สาย, ดึก)',
    input: 'text',
    showCancelButton: true
  });
  const nm = String(name || '').trim().replace(/^กะ/, '');
  if (nm) {
    if (/[:'"<>]/.test(nm)) return Swal.fire('ชื่อไม่ถูกต้อง', 'ชื่อกะห้ามมีเครื่องหมาย : \' " < >', 'warning');
    if (SETTINGS[`open_time_${nm}`]) return Swal.fire('Error', 'มีกะนี้อยู่แล้ว', 'error');
    const name = nm;
    SETTINGS[`open_time_${name}`] = '00:00';
    SETTINGS[`close_time_${name}`] = '23:59';
    renderOperatingHours();
  }
}

async function deleteOperatingShift(suffix) {
  if (!window.sysRequireAdmin()) return;
  Swal.fire({
    title: `ลบกะ "${suffix}"?`,
    text: "การลบนี้จะทำให้การเช็คเวลาสำหรับกะนี้หายไป (แต่ไม่ลบข้อมูลในตาราง)",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    confirmButtonText: 'ลบ'
  }).then((async result => {
    if (result.isConfirmed) {
      const {error: dErr} = await appDB.from('settings').delete().in('key', [ `open_time_${suffix}`, `close_time_${suffix}` ]);
      if (dErr) return Swal.fire('ลบไม่สำเร็จ', dErr.message, 'error');
      delete SETTINGS[`open_time_${suffix}`];
      delete SETTINGS[`close_time_${suffix}`];
      if (typeof loadSettings === 'function') await loadSettings();
      renderOperatingHours();
    }
  }));
}

async function saveTimeSettings() {
  if (!window.sysRequireAdmin()) return;
  const updates = [];
  const container = document.getElementById('operatingTimeContainer');
  const rows = container.querySelectorAll('.operating-row');
  let bad = '';
  rows.forEach((row => {
    const suffix = row.dataset.suffix || row.querySelector('.shift-label').innerText.replace(':', '').trim();
    const openVal = row.querySelector('.open-input').value;
    const closeVal = row.querySelector('.close-input').value;
    if (!openVal || !closeVal) bad = suffix;
    updates.push({
      key: `open_time_${suffix}`,
      value: openVal
    });
    updates.push({
      key: `close_time_${suffix}`,
      value: closeVal
    });
  }));
  if (bad) return Swal.fire('เวลาไม่ครบ', `กะ ${bad} ยังใส่เวลาเปิด/ปิดไม่ครบ`, 'warning');
  const {error: error} = await appDB.from('settings').upsert(updates);
  if (error) return Swal.fire('บันทึกไม่สำเร็จ', error.message, 'error');
  updates.forEach((u => SETTINGS[u.key] = u.value));
  Swal.fire('Saved', 'บันทึกเวลาเปิด-ปิดเรียบร้อย', 'success');
}

async function saveDailyLimit() {
  if (!window.sysRequireAdmin()) return;
  const dailyVal = String(parseInt(document.getElementById('dailyLimitInput').value, 10) || '');
  if (!dailyVal || +dailyVal < 1 || +dailyVal > 50) return Swal.fire('ค่าไม่ถูกต้อง', 'จำนวนครั้งต่อวันต้องเป็นเลข 1–50', 'warning');
  const gEl = document.getElementById('gapValueInput'), uEl = document.getElementById('gapUnitInput');
  const gapMin = gEl ? Math.max(0, (parseInt(gEl.value) || 0) * (uEl && uEl.value === 'hour' ? 60 : 1)) : 0;
  const {error: lErr} = await appDB.from('settings').upsert([ {
    key: 'daily_limit',
    value: dailyVal
  }, {
    key: 'break_gap_min',
    value: String(gapMin)
  } ]);
  if (lErr) return Swal.fire('บันทึกไม่สำเร็จ', lErr.message, 'error');
  SETTINGS.daily_limit = parseInt(dailyVal);
  SETTINGS.break_gap_min = String(gapMin);
  if (document.getElementById('limitDisplay')) document.getElementById('limitDisplay').innerText = dailyVal;
  Swal.fire('Saved', '', 'success');
}

window.populateAdminDeptSelects = function() {
  let dbDepts = [];
  try {
    dbDepts = JSON.parse(SETTINGS['custom_departments'] || '[]');
  } catch (e) {}
  let availableDepts = new Set([ 'AM', 'OD', 'AMQL', ...dbDepts ]);
  const deptListArray = window.getSystemDepts();
  const newDeptSelect = document.getElementById('newDept');
  if (newDeptSelect) {
    let html = '';
    deptListArray.forEach((d => {
      html += `<option value="${d}">แผนก ${d}</option>`;
    }));
    newDeptSelect.innerHTML = html;
  }
  const filterUserDept = document.getElementById('filterUserDept');
  if (filterUserDept) {
    const currentVal = filterUserDept.value;
    let html = '<option value="all">ทุกแผนก</option>';
    deptListArray.forEach((d => {
      html += `<option value="${d}">แผนก ${d}</option>`;
    }));
    filterUserDept.innerHTML = html;
    filterUserDept.value = currentVal || 'all';
  }
  if (typeof window.populateClearScheduleDept === 'function') window.populateClearScheduleDept();
};

async function addUsersBulk() {
  if (!window.sysRequireAdmin()) return;
  const text = document.getElementById('newUsersArea').value.trim();
  const s = document.getElementById('newAllowedShift').value;
  const tm = document.getElementById('newTeam').value;
  const cType = document.getElementById('newCheckType').value;
  const dept = document.getElementById('newDept').value;
  if (!text) return;
  const names = text.split('\n').map((n => n.trim())).filter((n => n));
  Swal.fire({
    title: 'กำลังบันทึก...',
    didOpen: () => Swal.showLoading()
  });
  const discordId = (document.getElementById('newDiscordId')?.value || '').trim();
  const telegramId = (document.getElementById('newTelegramId')?.value || '').trim();
  const newTag = (document.getElementById('newTag')?.value || '').trim();
  const {error: error} = await appDB.from('users').insert(names.map((n => ({
    username: n,
    allowed_shift: s,
    team: tm || null,
    role: 'staff',
    check_type: cType,
    department: dept,
    discord_id: discordId || null,
    telegram_id: telegramId || null,
    tag: newTag || null
  }))));
  if (!error) {
    document.getElementById('newUsersArea').value = '';
    if (document.getElementById('newDiscordId')) document.getElementById('newDiscordId').value = '';
    if (document.getElementById('newTelegramId')) document.getElementById('newTelegramId').value = '';
    if (document.getElementById('newTag')) document.getElementById('newTag').value = '';
    if (typeof fetchUsers === 'function') fetchUsers();
    Swal.fire('สำเร็จ', `เพิ่มพนักงาน ${names.length} คน ลงแผนก ${dept} เรียบร้อย`, 'success');
  } else {
    Swal.fire('Error', error.message, 'error');
  }
}

function populateIndivUserSelect(filter = "") {
  const container = document.getElementById('indivUserListContainer');
  if (!container) return;
  container.innerHTML = '';
  const sortedData = [ ...GLOBAL_USER_LIST ].sort(((a, b) => a.username.localeCompare(b.username)));
  let count = 0;
  sortedData.forEach((u => {
    if (filter === "" || u.username.toLowerCase().includes(filter.toLowerCase())) {
      const shiftColor = u.allowed_shift === 'กะเช้า' ? 'text-orange-600' : u.allowed_shift === 'กะกลาง' ? 'text-blue-600' : 'text-purple-600';
      const itemDiv = document.createElement('div');
      itemDiv.className = "flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 border-b border-gray-100 last:border-0 cursor-pointer select-none transition";
      itemDiv.innerHTML = `\n                <input type="checkbox" class="indiv-user-cb w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer" value="${u.id}" data-name="${window.escapeHtml(u.username)}">\n                <div class="flex-1 text-xs flex justify-between items-center">\n                    <span class="font-bold text-slate-700">${window.escapeHtml(u.username)}</span>${window.getTagBadge ? window.getTagBadge(u.tag, u.department) : ""}\n                    <span class="text-[9px] ${shiftColor} bg-gray-100 px-1.5 py-0.5 rounded ml-1 font-bold">${u.allowed_shift}</span>\n                </div>\n            `;
      itemDiv.onclick = e => {
        if (e.target.type !== 'checkbox') {
          const cb = itemDiv.querySelector('input');
          cb.checked = !cb.checked;
        }
      };
      container.appendChild(itemDiv);
      count++;
    }
  }));
  if (count === 0) container.innerHTML = '<div class="text-center text-gray-400 text-xs py-4">ไม่พบรายชื่อ</div>';
}

function filterIndivUserSelect() {
  const q = (document.getElementById('indivSearchUser').value || '').trim().toLowerCase();
  const container = document.getElementById('indivUserListContainer');
  if (!container) return;
  if (!container.querySelector('.indiv-user-cb')) {
    populateIndivUserSelect();
  }
  let shown = 0;
  container.querySelectorAll('.indiv-user-cb').forEach((cb => {
    const row = cb.closest('div');
    const ok = !q || String(cb.dataset.name || '').toLowerCase().includes(q);
    if (row) row.style.display = ok ? '' : 'none';
    if (ok) shown++;
  }));
  let empty = container.querySelector('.indiv-empty');
  if (!shown) {
    if (!empty) container.insertAdjacentHTML('beforeend', '<div class="indiv-empty text-center text-gray-400 text-xs py-4">ไม่พบรายชื่อ</div>');
  } else if (empty) empty.remove();
}

window.toggleSelectAllIndiv = function(source) {
  document.querySelectorAll('.indiv-user-cb').forEach((cb => {
    const row = cb.closest('div');
    if (!row || row.style.display !== 'none') cb.checked = source.checked;
  }));
};

let isFetchingUsers = false;

async function fetchUsers(forceRefresh = false) {
  if (isFetchingUsers) return;
  isFetchingUsers = true;
  try {
    const {data: data} = await appDB.from('users').select('*').order('created_at', {
      ascending: false
    });
    const box = document.getElementById('userTableBody');
    if (box) box.innerHTML = '';
    GLOBAL_USER_LIST = data || [];
    if (typeof populateIndivUserSelect === 'function') populateIndivUserSelect();
    if (typeof populateAdminDeptSelects === 'function') populateAdminDeptSelects();
    requestAnimationFrame((() => {
      if (typeof fastRecalculateStats === 'function') fastRecalculateStats();
      if (typeof renderUserTableDirectly === 'function') renderUserTableDirectly();
    }));
  } catch (e) {
    console.error("Fetch User Error:", e);
  } finally {
    isFetchingUsers = false;
  }
}

window.renderUserTableDirectly = function() {
  const box = document.getElementById('userTableBody');
  if (!box || GLOBAL_USER_LIST.length === 0) return;
  const inputSearch = document.getElementById('searchUser') ? document.getElementById('searchUser').value.toLowerCase() : '';
  const shiftFilter = document.getElementById('filterUserShift') ? document.getElementById('filterUserShift').value : 'all';
  const deptFilter = document.getElementById('filterUserDept') ? document.getElementById('filterUserDept').value : 'all';
  let filteredUsers = GLOBAL_USER_LIST.filter((u => {
    const matchName = u.username.toLowerCase().includes(inputSearch);
    const matchShift = shiftFilter === 'all' || u.allowed_shift === shiftFilter;
    const matchDept = deptFilter === 'all' || (u.department || 'AM') === deptFilter;
    return matchName && matchShift && matchDept;
  }));
  let totalUsers = filteredUsers.length;
  let totalPages = userRowsPerPage === 'all' ? 1 : Math.ceil(totalUsers / parseInt(userRowsPerPage));
  if (userCurrentPage > totalPages) userCurrentPage = Math.max(1, totalPages);
  let paginatedUsers = filteredUsers;
  let startIndex = 0;
  if (userRowsPerPage !== 'all') {
    startIndex = (userCurrentPage - 1) * parseInt(userRowsPerPage);
    paginatedUsers = filteredUsers.slice(startIndex, startIndex + parseInt(userRowsPerPage));
  }
  let dbDepts = [];
  try {
    dbDepts = JSON.parse(SETTINGS['custom_departments'] || '[]');
  } catch (e) {}
  let availableDepts = new Set([ 'AM', 'OD', 'AMQL', ...dbDepts ]);
  const deptListArray = window.getSystemDepts();
  let dbRoles = [];
  try {
    dbRoles = JSON.parse(SETTINGS['custom_roles'] || '[]');
  } catch (e) {}
  let rawRoles = [ 'staff', 'trainer', 'manager', ...dbRoles ];
  const uniqueRoles = [ ...new Set(rawRoles) ];
  let html = '';
  paginatedUsers.forEach(((u, index) => {
    const displayIndex = startIndex + index + 1;
    let currentDep = u.department || 'AM';
    if (currentDep === 'TRAINER') currentDep = 'AM';
    let depColor = currentDep === 'OD' ? 'text-pink-400' : currentDep === 'AM' ? 'text-blue-400' : currentDep === 'NEW' ? 'text-emerald-400' : 'text-teal-400';
    let depBadge = `<select onchange="updateUserDepartment(${u.id}, this.value)" class="bg-slate-900 ${depColor} text-[10px] p-1.5 rounded-md border border-slate-700 font-bold outline-none cursor-pointer hover:bg-slate-950 shadow-inner text-center w-[60px]">`;
    if (currentDep === 'NEW') {
      depBadge += `<option value="NEW" selected class="text-white">NEW</option>`;
    }
    deptListArray.forEach((dName => {
      depBadge += `<option value="${dName}" ${currentDep === dName ? 'selected' : ''} class="text-white">${dName}</option>`;
    }));
    depBadge += `</select>`;
    const teamBadge = `<button class="bg-indigo-900/50 text-indigo-300 text-xs px-2.5 py-1 rounded-md font-bold hover:bg-indigo-800 transition border border-indigo-700/50 shadow-inner" onclick="updateUserTeam('${u.id}', '${window.escapeJsAttr(u.team || '')}')">${window.escapeHtml(u.team || '-')}</button>`;
    let shiftColor = u.allowed_shift === 'กะเช้า' ? 'text-orange-400' : u.allowed_shift === 'กะกลาง' ? 'text-blue-400' : u.allowed_shift === 'กะดึก' ? 'text-purple-400' : 'text-gray-400';
    let shiftSelect = `<select onchange="updateUserShift(this, ${u.id}, this.value)" class="bg-slate-900 ${shiftColor} text-xs p-1.5 rounded-md border border-slate-700 font-bold outline-none cursor-pointer hover:bg-slate-950 shadow-inner text-center">`;
    [ 'all', 'กะเช้า', 'กะกลาง', 'กะดึก' ].forEach((opt => {
      shiftSelect += `<option value="${opt}" ${u.allowed_shift === opt ? 'selected' : ''} class="text-white">${opt}</option>`;
    }));
    shiftSelect += `</select>`;
    const checkType = u.check_type || 'team';
    const typeBadge = `<button class="${checkType === 'shift' ? 'bg-fuchsia-900/40 text-fuchsia-400 border-fuchsia-800/50' : 'bg-emerald-900/40 text-emerald-400 border-emerald-800/50'} text-[10px] px-2 py-1 rounded-md font-bold hover:opacity-80 border shadow-inner transition" onclick="updateCheckType(this, ${u.id}, '${checkType}')">${checkType === 'shift' ? 'เน้นกะ' : 'เน้นทีม'}</button>`;
    const pinDisplay = u.has_pin ? `<div class="flex items-center justify-center gap-1 group"><span class="font-mono text-amber-400 font-bold bg-amber-900/20 px-2 py-1 rounded-md border border-amber-700/50 tracking-widest text-xs" title="ตั้ง PIN แล้ว">••••••</span><button onclick="resetUserPin(${u.id}, '${window.escapeJsAttr(u.username)}')" class="text-slate-500 hover:text-red-400 p-1 bg-slate-800 rounded-md transition opacity-0 group-hover:opacity-100" title="ล้างรหัสผ่านให้ตั้งใหม่"><span class="material-icons text-[14px]">lock_reset</span></button></div>` : `<div class="flex items-center justify-center gap-1 group"><span class="text-slate-500 text-[10px] italic bg-slate-800 px-2 py-1 rounded-md">ยังไม่ตั้ง</span><button onclick="resetUserPin(${u.id}, '${window.escapeJsAttr(u.username)}')" class="text-slate-500 hover:text-green-400 p-1 bg-slate-800 rounded-md transition opacity-0 group-hover:opacity-100" title="รีเซ็ต"><span class="material-icons text-[14px]">refresh</span></button></div>`;
    const avatarColors = [ {
      bg: '#1e3a5f',
      color: '#60a5fa'
    }, {
      bg: '#1a2e1a',
      color: '#4ade80'
    }, {
      bg: '#3b1f1f',
      color: '#f87171'
    }, {
      bg: '#2d1f3d',
      color: '#c084fc'
    }, {
      bg: '#1f2d3d',
      color: '#38bdf8'
    }, {
      bg: '#3d2d1f',
      color: '#fb923c'
    }, {
      bg: '#1f3d2d',
      color: '#34d399'
    }, {
      bg: '#3d1f2d',
      color: '#f472b6'
    } ];
    const ac = avatarColors[displayIndex % avatarColors.length];
    const disBadge = `<span style="font-size:8.5px;font-weight:700;color:light-dark(#5704a9,#c084fc);background:var(--k-card);border:0.5px solid rgba(124,58,237,.35);padding:1px 5px;border-radius:3px;letter-spacing:.4px;flex-shrink:0;">DIS</span>`;
    const telBadge = `<span style="font-size:8.5px;font-weight:700;color:light-dark(#0676a8,#38bdf8);background:var(--k-card);border:0.5px solid rgba(2,132,199,.35);padding:1px 5px;border-radius:3px;letter-spacing:.4px;flex-shrink:0;">TEL</span>`;
    const discordChip = u.discord_id ? `<span style="display:inline-flex;align-items:center;gap:4px;">${disBadge}<span style="font-size:10px;color:var(--k-tx3);font-family:monospace;letter-spacing:.2px;" title="${u.discord_id}">${u.discord_id}</span></span>` : `<span style="display:inline-flex;align-items:center;gap:4px;">${disBadge}<span style="font-size:10px;color:var(--k-mute3);font-style:italic;">ยังไม่มี</span></span>`;
    const telegramChip = u.telegram_id ? `<span style="display:inline-flex;align-items:center;gap:4px;">${telBadge}<span style="font-size:10px;color:var(--k-tx3);font-family:monospace;letter-spacing:.2px;" title="${u.telegram_id}">${u.telegram_id}</span></span>` : `<span style="display:inline-flex;align-items:center;gap:4px;">${telBadge}<span style="font-size:10px;color:var(--k-mute3);font-style:italic;">ยังไม่มี</span></span>`;
    const idRow = `<div style="margin-top:4px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">${discordChip}${telegramChip}</div>`;
    html += `\n            <tr class="staff-row hover:bg-slate-700/30 transition duration-200">\n                <td class="p-3 text-center border-b border-slate-700/50"><input type="checkbox" class="user-check w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500 cursor-pointer" value="${u.id}"></td>\n                <td class="p-3 text-center border-b border-slate-700/50" style="font-size:12px;font-weight:800;color:var(--k-mute);font-variant-numeric:tabular-nums">${displayIndex}</td>\n                <td class="p-3 text-left border-b border-slate-700/50">\n                    <div style="display:flex;align-items:center;gap:10px;">\n                        <div style="width:34px;height:34px;border-radius:50%;background:${ac.bg};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:${ac.color};flex-shrink:0;letter-spacing:.5px;">${window.escapeHtml(u.username.substring(0, 2).toUpperCase())}</div>\n                        <div style="min-width:0;flex:1;">\n                            <div style="display:flex;align-items:center;gap:5px;">\n                                <span style="font-weight:500;color:var(--text-primary);font-size:13px;">${window.escapeHtml(u.username)}</span>${window.getTagBadge ? window.getTagBadge(u.tag, u.department) : ""}\n                                <button class="row-edit-btn" onclick="window.openEditUserModal(${u.id})" style="border:none;background:none;padding:3px;cursor:pointer;color:var(--k-mute3);line-height:1;border-radius:5px;opacity:0;transition:opacity .15s,color .15s,background .15s;display:inline-flex;align-items:center;justify-content:center;" title="แก้ไข" onmouseenter="this.style.color='#c084fc';this.style.background='rgba(192,132,252,.12)'" onmouseleave="this.style.color='#475569';this.style.background='none'"><span class="material-icons" style="font-size:14px;">edit</span></button>\n                                <button class="row-edit-btn" onclick="window.kickUserOut(${u.id}, '${window.escapeJsAttr(u.username)}')" style="border:none;background:none;padding:3px;cursor:pointer;color:var(--k-mute3);line-height:1;border-radius:5px;opacity:0;transition:opacity .15s,color .15s,background .15s;display:inline-flex;align-items:center;justify-content:center;" title="เตะออกจากระบบ (ต้องล็อกอินใหม่)" onmouseenter="this.style.color='#f87171';this.style.background='rgba(248,113,113,.12)'" onmouseleave="this.style.color='#475569';this.style.background='none'"><span class="material-icons" style="font-size:14px;">logout</span></button>\n                            </div>\n                            ${idRow}\n                        </div>\n                    </div>\n                </td>\n                <td class="p-3 text-center border-b border-slate-700/50">${depBadge}</td>\n                <td class="p-3 text-center border-b border-slate-700/50">${teamBadge}</td>\n                <td class="p-3 text-center border-b border-slate-700/50">${shiftSelect}</td>\n                <td class="p-3 text-center border-b border-slate-700/50 bg-black/10">${pinDisplay}</td>\n                <td class="p-3 text-center border-b border-slate-700/50">${typeBadge}</td> \n            </tr>`;
  }));
  if (paginatedUsers.length === 0) {
    html = `<tr><td colspan="8" class="text-center p-10 text-gray-400">ไม่พบรายชื่อพนักงานตามเงื่อนไขที่ค้นหา</td></tr>`;
  }
  box.innerHTML = html;
  const totalBadge = document.getElementById('userTotalBadge');
  if (totalBadge) totalBadge.textContent = totalUsers === GLOBAL_USER_LIST.length ? `${GLOBAL_USER_LIST.length} คน` : `พบ ${totalUsers} จาก ${GLOBAL_USER_LIST.length} คน`;
  window.renderPaginationControls(totalUsers, totalPages);
  if (typeof populateTeamSelects === 'function') populateTeamSelects();
};

window.renderPaginationControls = function(totalUsers, totalPages) {
  let paginationBox = document.getElementById('userPaginationControls');
  if (!paginationBox) {
    const tableContainer = document.getElementById('userTableBody').closest('.max-h-\\[500px\\]').parentElement;
    tableContainer.insertAdjacentHTML('beforeend', `<div id="userPaginationControls" class="p-4 bg-slate-900 border-t border-slate-700 flex flex-wrap justify-between items-center gap-4 text-sm text-gray-400"></div>`);
    paginationBox = document.getElementById('userPaginationControls');
  }
  if (totalUsers === 0) {
    paginationBox.innerHTML = '';
    return;
  }
  let startCount = userRowsPerPage === 'all' ? 1 : (userCurrentPage - 1) * parseInt(userRowsPerPage) + 1;
  let endCount = userRowsPerPage === 'all' ? totalUsers : Math.min(userCurrentPage * parseInt(userRowsPerPage), totalUsers);
  paginationBox.innerHTML = `\n        <div class="flex items-center gap-3">\n            <span class="font-bold">แสดง:</span>\n           <select onchange="userRowsPerPage = this.value; userCurrentPage = 1; window.renderUserTableDirectly();" class="bg-slate-800 border border-slate-600 text-white rounded p-1 outline-none font-bold">\n                <option value="5" ${userRowsPerPage == 5 ? 'selected' : ''}>5</option>\n                <option value="10" ${userRowsPerPage == 10 ? 'selected' : ''}>10</option>\n                <option value="50" ${userRowsPerPage == 50 ? 'selected' : ''}>50</option>\n                <option value="100" ${userRowsPerPage == 100 ? 'selected' : ''}>100</option>\n                <option value="all" ${userRowsPerPage === 'all' ? 'selected' : ''}>ทั้งหมด</option>\n            </select>\n            <span style="font-size:12.5px;font-weight:700;color:var(--k-tx3)">ลำดับที่ <b style="color:var(--k-tx-strong)">${startCount}–${endCount}</b> จากทั้งหมด <b style="color:var(--k-gold-tx)">${totalUsers}</b> คน</span>\n        </div>\n        <div class="flex items-center gap-2">\n            <button onclick="if(userCurrentPage > 1) { userCurrentPage--; window.renderUserTableDirectly(); }" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold transition disabled:opacity-30 disabled:cursor-not-allowed" ${userCurrentPage === 1 ? 'disabled' : ''}>◀ ก่อนหน้า</button>\n            <span class="text-white font-bold px-3">หน้า ${userCurrentPage} / ${totalPages}</span>\n            <button onclick="if(userCurrentPage < ${totalPages}) { userCurrentPage++; window.renderUserTableDirectly(); }" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold transition disabled:opacity-30 disabled:cursor-not-allowed" ${userCurrentPage >= totalPages ? 'disabled' : ''}>ถัดไป ▶</button>\n        </div>\n    `;
};

function fastRecalculateStats() {
  let stats = {
    'กะเช้า': {
      total: 0,
      AM: 0,
      OD: 0
    },
    'กะกลาง': {
      total: 0,
      AM: 0,
      OD: 0
    },
    'กะดึก': {
      total: 0,
      AM: 0,
      OD: 0
    }
  };
  GLOBAL_USER_LIST.forEach((u => {
    if (stats[u.allowed_shift]) {
      stats[u.allowed_shift].total++;
      if (u.department === 'OD') stats[u.allowed_shift].OD++; else stats[u.allowed_shift].AM++;
    }
  }));
  const updateBox = (elId, st) => {
    const el = document.getElementById(elId);
    if (el) {
      if (el.querySelector('.stat-total')) el.querySelector('.stat-total').innerText = st.total;
      if (el.querySelector('.stat-am')) el.querySelector('.stat-am').innerText = st.AM;
      if (el.querySelector('.stat-od')) el.querySelector('.stat-od').innerText = st.OD;
    }
  };
  updateBox('countShiftM', stats['กะเช้า']);
  updateBox('countShiftA', stats['กะกลาง']);
  updateBox('countShiftN', stats['กะดึก']);
}

window.updateUserDepartment = async function(id, newDept) {
  if (!window.sysRequireAdmin()) return;
  const user = GLOBAL_USER_LIST.find((u => String(u.id) === String(id)));
  if (user) user.department = newDept;
  if (typeof fastRecalculateStats === 'function') fastRecalculateStats();
  const selectEl = document.querySelector(`select[onchange*="updateUserDepartment(${id}"]`);
  if (selectEl) {
    selectEl.classList.remove('text-blue-400', 'text-pink-400', 'text-teal-400');
    if (newDept === 'OD') selectEl.classList.add('text-pink-400'); else if (newDept === 'AM') selectEl.classList.add('text-blue-400'); else selectEl.classList.add('text-teal-400');
  }
  appDB.from('users').update({
    department: newDept
  }).eq('id', id).then((({error: error}) => {
    if (error) {
      Swal.fire('เกิดข้อผิดพลาด', error.message, 'error');
      if (typeof fetchUsers === 'function') fetchUsers();
    }
  }));
  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 1e3
  });
  Toast.fire({
    icon: 'success',
    title: `ย้ายไปแผนก ${newDept} แล้ว`
  });
};

window.openChangePinModal = function() {
  if (document.getElementById('newPin1')) document.getElementById('newPin1').value = '';
  if (document.getElementById('newPin2')) document.getElementById('newPin2').value = '';
  if (document.getElementById('oldPin')) document.getElementById('oldPin').value = '';
  const modal = document.getElementById('changePinModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
};

window.closeChangePinModal = function() {
  const modal = document.getElementById('changePinModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
};

window.submitChangePin = async function(e) {
  e.preventDefault();
  const pin1 = document.getElementById('newPin1').value;
  const pin2 = document.getElementById('newPin2').value;
  if (pin1.length !== 6 || pin2.length !== 6) return Swal.fire('แจ้งเตือน', 'กรุณาใส่ตัวเลขให้ครบ 6 หลัก', 'warning');
  if (pin1 !== pin2) return Swal.fire('ผิดพลาด', 'รหัสผ่านทั้งสองช่องไม่ตรงกัน!', 'error');
  if (!currentUser || !currentUser.id) return Swal.fire('ผิดพลาด', 'ไม่พบข้อมูลผู้ใช้งาน กรุณารีเฟรชหน้าเว็บ', 'error');
  Swal.fire({
    title: 'กำลังบันทึก...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });
  try {
    const oldPinEl = document.getElementById('oldPin');
    const oldPin = oldPinEl ? oldPinEl.value : null;
    const {data: res, error: error} = await appDB.rpc('set_user_pin', {
      p_user_id: currentUser.id,
      p_old_pin: oldPin,
      p_new_pin: pin1
    });
    if (error) throw error;
    if (!res || !res.ok) {
      Swal.close();
      if (res && res.reason === 'wrong_old_pin') return Swal.fire('ผิดพลาด', 'PIN เดิมไม่ถูกต้อง', 'error');
      return Swal.fire('ผิดพลาด', 'เปลี่ยน PIN ไม่สำเร็จ', 'error');
    }
    currentUser.has_pin = true;
    sessionStorage.setItem('user_platinum_plus', JSON.stringify(currentUser));
    if (oldPinEl) oldPinEl.value = '';
    closeChangePinModal();
    Swal.fire({
      icon: 'success',
      title: 'เปลี่ยนรหัสสำเร็จ!',
      text: 'คราวหน้ากรุณาใช้รหัสผ่านใหม่นี้เข้าสู่ระบบครับ',
      timer: 2e3,
      showConfirmButton: false
    });
  } catch (err) {
    console.error(err);
    Swal.fire('Error', 'เกิดข้อผิดพลาดในการเปลี่ยนรหัส: ' + err.message, 'error');
  }
};

window.resetUserPin = async function(id, username) {
  if (!window.sysRequireAdmin()) return;
  Swal.fire({
    title: `รีเซ็ต PIN ของ ${username}?`,
    text: "รหัสเดิมจะถูกล้าง พนักงานจะสามารถตั้ง PIN ใหม่ 6 หลักได้ตอนล็อกอินครั้งถัดไป",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#f59e0b',
    cancelButtonColor: '#475569',
    confirmButtonText: 'ล้างรหัส',
    cancelButtonText: 'ยกเลิก',
    customClass: {
      popup: 'dark:bg-slate-800 dark:text-white'
    }
  }).then((async result => {
    if (result.isConfirmed) {
      const {value: adminPin} = await Swal.fire({
        title: 'ยืนยันตัวตน',
        text: 'กรอก PIN ของคุณเพื่อยืนยันการรีเซ็ต',
        input: 'password',
        inputAttributes: {
          maxlength: 6,
          inputmode: 'numeric',
          autocomplete: 'off'
        },
        showCancelButton: true,
        confirmButtonText: 'ยืนยัน',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#f59e0b',
        customClass: {
          popup: 'dark:bg-slate-800 dark:text-white'
        }
      });
      if (!adminPin) return;
      Swal.fire({
        title: 'กำลังล้างรหัส...',
        didOpen: () => Swal.showLoading()
      });
      const {data: res, error: error} = await appDB.rpc('reset_user_pin', {
        p_admin_id: currentUser.id,
        p_admin_pin: adminPin,
        p_target_id: id
      });
      if (error) {
        Swal.fire('Error', error.message, 'error');
      } else if (!res || !res.ok) {
        Swal.fire('ไม่สำเร็จ', res && res.reason === 'wrong_admin_pin' ? 'PIN ของคุณไม่ถูกต้อง' : 'คุณไม่มีสิทธิ์รีเซ็ต PIN', 'error');
      } else {
        if (typeof fetchUsers === 'function') fetchUsers();
        Swal.fire({
          icon: 'success',
          title: 'สำเร็จ',
          text: `รีเซ็ตรหัสของ ${username} แล้ว`,
          timer: 1500,
          showConfirmButton: false
        });
      }
    }
  }));
};

window.getPermRoles = function() {
  let extra = [];
  try {
    extra = JSON.parse(SETTINGS['custom_roles'] || '[]');
  } catch (e) {}
  const all = [ 'STAFF', 'TRAINER', 'MANAGER', ...extra.map((r => String(r).toUpperCase().trim())) ];
  return [ ...new Set(all.filter(Boolean)) ];
};

window.addCustomPermRole = async function() {
  if (!window.sysRequireAdmin()) return;
  const inputEl = document.getElementById('newRoleInput');
  if (!inputEl) return Swal.fire('Error', 'ไม่พบช่องกรอกชื่อตำแหน่ง', 'error');
  const name = inputEl.value.toUpperCase().trim();
  if (!name) return Swal.fire('แจ้งเตือน', 'พิมพ์ชื่อตำแหน่งก่อนครับ', 'warning');
  if (window.getPermRoles().includes(name)) return Swal.fire('เตือน', 'มีตำแหน่งนี้แล้ว', 'warning');
  let extra = [];
  try {
    extra = JSON.parse(SETTINGS['custom_roles'] || '[]');
  } catch (e) {}
  extra.push(name);
  Swal.fire({
    title: 'กำลังบันทึก...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });
  await appDB.from('settings').upsert([ {
    key: 'custom_roles',
    value: JSON.stringify(extra)
  } ]);
  SETTINGS['custom_roles'] = JSON.stringify(extra);
  inputEl.value = '';
  await window.loadSettings();
  if (typeof renderPermsTable === 'function') renderPermsTable();
  Swal.fire({
    icon: 'success',
    title: 'สำเร็จ',
    text: 'เพิ่มตำแหน่ง ' + name + ' แล้ว',
    timer: 1500,
    showConfirmButton: false
  });
};

window.deleteCustomPermRole = async function(name) {
  if (!window.sysRequireAdmin()) return;
  if ([ 'STAFF', 'TRAINER', 'MANAGER' ].includes(name)) return Swal.fire('ลบไม่ได้', 'ตำแหน่งหลักลบไม่ได้ครับ', 'warning');
  const ask = await Swal.fire({
    icon: 'warning',
    title: 'ลบตำแหน่ง ' + name + '?',
    text: 'คนที่ตำแหน่งนี้จะกลับไปใช้ชุดของ STAFF',
    showCancelButton: true,
    confirmButtonText: 'ลบเลย',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#dc2626'
  });
  if (!ask.isConfirmed) return;
  let extra = [];
  try {
    extra = JSON.parse(SETTINGS['custom_roles'] || '[]');
  } catch (e) {}
  extra = extra.filter((r => String(r).toUpperCase().trim() !== name));
  const perms = JSON.parse(JSON.stringify(MENU_PERMS));
  delete perms[name];
  await appDB.from('settings').upsert([ {
    key: 'custom_roles',
    value: JSON.stringify(extra)
  }, {
    key: 'dept_menu_rules',
    value: JSON.stringify(perms)
  } ]);
  SETTINGS['custom_roles'] = JSON.stringify(extra);
  SETTINGS['dept_menu_rules'] = JSON.stringify(perms);
  window.MENU_PERMS = perms;
  await window.loadSettings();
  window.permUI.dept = null;
  if (typeof renderPermsTable === 'function') renderPermsTable();
  Swal.fire({
    icon: 'success',
    title: 'ลบแล้ว',
    timer: 1200,
    showConfirmButton: false
  });
};

window.renameAnyRole = async function(oldName) {
  if (!window.sysRequireAdmin()) return;
  const {value: raw} = await Swal.fire({
    title: 'เปลี่ยนชื่อตำแหน่ง ' + oldName,
    input: 'text',
    inputValue: oldName,
    showCancelButton: true,
    confirmButtonText: 'บันทึก',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#f59e0b'
  });
  if (!raw) return;
  const name = raw.toUpperCase().trim();
  if (!name || name === oldName) return;
  if (window.getPermRoles().includes(name)) return Swal.fire('เตือน', 'มีตำแหน่งชื่อนี้แล้ว', 'warning');
  Swal.fire({
    title: 'กำลังอัปเดต...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });
  let extra = [];
  try {
    extra = JSON.parse(SETTINGS['custom_roles'] || '[]');
  } catch (e) {}
  const core = [ 'STAFF', 'TRAINER', 'MANAGER' ].includes(oldName);
  if (!core) extra = extra.map((r => String(r).toUpperCase().trim() === oldName ? name : r)); else extra = [ ...new Set([ ...extra, name ]) ];
  const perms = JSON.parse(JSON.stringify(MENU_PERMS));
  if (perms[oldName]) {
    perms[name] = perms[oldName];
    if (!core) delete perms[oldName];
  }
  await appDB.from('users').update({
    role: name.toLowerCase()
  }).eq('role', oldName.toLowerCase());
  await appDB.from('settings').upsert([ {
    key: 'custom_roles',
    value: JSON.stringify(extra)
  }, {
    key: 'dept_menu_rules',
    value: JSON.stringify(perms)
  } ]);
  SETTINGS['custom_roles'] = JSON.stringify(extra);
  SETTINGS['dept_menu_rules'] = JSON.stringify(perms);
  window.MENU_PERMS = perms;
  await window.loadSettings();
  window.permUI.dept = name;
  if (typeof renderPermsTable === 'function') renderPermsTable();
  if (typeof window.renderUserTableDirectly === 'function') window.renderUserTableDirectly();
  Swal.fire({
    icon: 'success',
    title: 'เปลี่ยนชื่อแล้ว',
    timer: 1400,
    showConfirmButton: false
  });
};

window.getSystemDepts = function() {
  let dbDepts = [];
  try {
    if (SETTINGS['custom_departments']) {
      dbDepts = JSON.parse(SETTINGS['custom_departments']);
    } else {
      dbDepts = [ 'AM', 'OD', 'AMQL' ];
    }
  } catch (e) {
    dbDepts = [ 'AM', 'OD', 'AMQL' ];
  }
  return [ ...new Set(dbDepts) ].sort();
};

window.addCustomPermDept = async function() {
  if (!window.sysRequireAdmin()) return;
  const inputEl = document.getElementById('newDeptInput');
  if (!inputEl) return Swal.fire('Error', 'ไม่พบช่องกรอกชื่อแผนก', 'error');
  const deptName = inputEl.value.toUpperCase().trim();
  if (!deptName) return Swal.fire('แจ้งเตือน', 'กรุณาพิมพ์ชื่อแผนกก่อนกดเพิ่มครับ', 'warning');
  let currentDepts = window.getSystemDepts();
  if (!currentDepts.includes(deptName)) {
    currentDepts.push(deptName);
    Swal.fire({
      title: 'กำลังบันทึก...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });
    await appDB.from('settings').upsert([ {
      key: 'custom_departments',
      value: JSON.stringify(currentDepts)
    } ]);
    SETTINGS['custom_departments'] = JSON.stringify(currentDepts);
    inputEl.value = '';
    await window.loadSettings();
    if (typeof populateAdminDeptSelects === 'function') populateAdminDeptSelects();
    if (typeof renderUserTableDirectly === 'function') window.renderUserTableDirectly();
    Swal.fire({
      icon: 'success',
      title: 'สำเร็จ',
      text: `เพิ่มแผนก ${deptName} แล้ว`,
      timer: 1500,
      showConfirmButton: false
    });
  } else {
    Swal.fire('เตือน', 'มีแผนกนี้ในระบบแล้ว', 'warning');
  }
};

window.renameAnyDept = async function(oldDept) {
  if (!window.sysRequireAdmin()) return;
  const {value: newDeptRaw} = await Swal.fire({
    title: `เปลี่ยนชื่อแผนก ${oldDept}`,
    input: 'text',
    inputValue: oldDept,
    inputPlaceholder: 'พิมพ์ชื่อแผนกใหม่...',
    showCancelButton: true,
    confirmButtonText: 'บันทึกการเปลี่ยนแปลง',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#f59e0b',
    customClass: {
      popup: 'dark:bg-slate-800 dark:text-white rounded-3xl'
    }
  });
  if (newDeptRaw) {
    const newDept = newDeptRaw.toUpperCase().trim();
    if (!newDept || newDept === oldDept) return;
    let currentDepts = window.getSystemDepts();
    if (currentDepts.includes(newDept)) {
      return Swal.fire('เตือน', 'มีแผนกชื่อนี้อยู่ในระบบแล้วครับ', 'warning');
    }
    Swal.fire({
      title: 'กำลังอัปเดตข้อมูลทั้งระบบ...',
      text: 'โปรดรอสักครู่...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });
    try {
      currentDepts = currentDepts.map((d => d === oldDept ? newDept : d));
      SETTINGS['custom_departments'] = JSON.stringify(currentDepts);
      let newPerms = JSON.parse(JSON.stringify(MENU_PERMS));
      Object.keys(newPerms).forEach((key => {
        if (key.startsWith(oldDept + '_')) {
          const newKey = key.replace(oldDept + '_', newDept + '_');
          newPerms[newKey] = newPerms[key];
          delete newPerms[key];
        }
      }));
      MENU_PERMS = newPerms;
      SETTINGS['dept_menu_rules'] = JSON.stringify(MENU_PERMS);
      window.safeSetItem('cached_menu_rules', JSON.stringify(MENU_PERMS));
      await appDB.from('settings').upsert([ {
        key: 'custom_departments',
        value: JSON.stringify(currentDepts)
      }, {
        key: 'dept_menu_rules',
        value: JSON.stringify(MENU_PERMS)
      } ]);
      await appDB.from('users').update({
        department: newDept
      }).eq('department', oldDept);
      if (typeof GLOBAL_USER_LIST !== 'undefined') {
        GLOBAL_USER_LIST.forEach((u => {
          if (u.department === oldDept) u.department = newDept;
        }));
      }
      window.renderPermsTable();
      if (typeof populateAdminDeptSelects === 'function') populateAdminDeptSelects();
      if (typeof renderUserTableDirectly === 'function') window.renderUserTableDirectly();
      Swal.fire({
        icon: 'success',
        title: 'เปลี่ยนชื่อแผนกสำเร็จ!',
        text: `ระบบอัปเดตแท็กของพนักงานทุกคนเป็น ${newDept} เรียบร้อยแล้วครับ 🎉`,
        timer: 2500,
        showConfirmButton: false
      });
    } catch (e) {
      console.error(e);
      Swal.fire('Error', 'เกิดข้อผิดพลาด: ' + e.message, 'error');
    }
  }
};

window.loadSettings = async function() {
  try {
    const EXCLUDE_PREFIXES = [ 'duty_%', 'backup_%', 'report_%', 'trainer_matrix_roles_%', 'standby_config_by_web', 'sop_%', 'fine_%', 'kb_%', 'app_files_%', 'discord_%', 'qr_check_history', 'slip_check_history', 'saved_excel_files', 'od_form_config', 'chrome_refresh_%', 'vps_%', 'standby_%' ];
    let q = appDB.from('settings').select('*');
    EXCLUDE_PREFIXES.forEach((pfx => {
      q = q.not('key', 'like', pfx);
    }));
    const {data: data} = await q;
    if (data) {
      data.forEach((row => {
        SETTINGS[row.key] = row.value;
      }));
    }
    if (document.getElementById('dailyLimitInput')) document.getElementById('dailyLimitInput').value = SETTINGS.daily_limit || 2;
    const _g = parseInt(SETTINGS.break_gap_min) || 0;
    const gEl = document.getElementById('gapValueInput'), uEl = document.getElementById('gapUnitInput');
    if (gEl && uEl) {
      if (_g > 0 && _g % 60 === 0) {
        gEl.value = _g / 60;
        uEl.value = 'hour';
      } else {
        gEl.value = _g;
        uEl.value = 'min';
      }
    }
    if (document.getElementById('periodLimitInput')) document.getElementById('periodLimitInput').value = SETTINGS.period_limit || 1;
    if (document.getElementById('limitDisplay')) document.getElementById('limitDisplay').innerText = SETTINGS.daily_limit || 2;
    if (document.getElementById('periodLimitDisplay')) document.getElementById('periodLimitDisplay').innerText = SETTINGS.period_limit || 1;
    if (typeof renderOperatingHours === 'function') renderOperatingHours();
    if (typeof renderQuotaSettings === 'function') renderQuotaSettings();
    if (typeof renderPermsTable === 'function') renderPermsTable();
    if (typeof populateAdminDeptSelects === 'function') populateAdminDeptSelects();
    if (typeof GLOBAL_USER_LIST !== 'undefined' && GLOBAL_USER_LIST && GLOBAL_USER_LIST.length && typeof renderUserTableDirectly === 'function') renderUserTableDirectly();
    if (typeof applyCustomTimeSlots === 'function') applyCustomTimeSlots();
    if (typeof renderManualTimeSlots === 'function') renderManualTimeSlots();
    if (typeof refreshTimeSlots === 'function') refreshTimeSlots();
    if (typeof fetchData === 'function') {
      const mainArea = document.getElementById('mainContentArea') || document.getElementById('app-content');
      if (mainArea && !mainArea.classList.contains('hidden')) {
        fetchData();
      }
    }
  } catch (e) {
    console.error("Load Settings Error:", e);
  }
};

window.getQuotaDepts = function() {
  try {
    const raw = SETTINGS['quota_depts'];
    const a = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(a) && a.length) return [ ...new Set(a.map((d => String(d).trim())).filter(Boolean)) ];
  } catch (e) {}
  return [ 'AM', 'OD' ];
};

window._saveQuotaDepts = async function(list) {
  const v = JSON.stringify([ ...new Set(list) ]);
  const {error: error} = await appDB.from('settings').upsert([ {
    key: 'quota_depts',
    value: v
  } ]);
  if (error) {
    Swal.fire('บันทึกไม่สำเร็จ', error.message, 'error');
    throw error;
  }
  SETTINGS['quota_depts'] = v;
  if (typeof window.clearSettingCache === "function") window.clearSettingCache();
};

window.addQuotaDept = async function() {
  if (!window.sysRequireAdmin()) return;
  const sel = document.getElementById('quotaDeptPicker');
  const d = sel && sel.value ? sel.value.trim() : '';
  if (!d) return Swal.fire('เลือกแผนกก่อน', 'เลือกแผนกที่อยากเพิ่มจากช่องข้างปุ่มครับ', 'info');
  const cur = window.getQuotaDepts();
  if (cur.includes(d)) return Swal.fire('มีอยู่แล้ว', 'แผนก ' + d + ' อยู่บนหน้านี้แล้ว', 'warning');
  await window._saveQuotaDepts([ ...cur, d ]);
  await window.renderQuotaSettings();
};

window.removeQuotaDept = async function(d) {
  if (!window.sysRequireAdmin()) return;
  const cur = window.getQuotaDepts();
  if (cur.length <= 1) return Swal.fire('เอาออกไม่ได้', 'ต้องเหลืออย่างน้อย 1 แผนกครับ', 'warning');
  const ask = await Swal.fire({
    icon: 'question',
    title: 'เอาแผนก ' + d + ' ออกจากหน้านี้?',
    text: 'ค่าที่ตั้งไว้ยังอยู่ครบ เพิ่มกลับมาเมื่อไหร่ก็เห็นเหมือนเดิม',
    showCancelButton: true,
    confirmButtonText: 'เอาออก',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#dc2626'
  });
  if (!ask.isConfirmed) return;
  await window._saveQuotaDepts(cur.filter((x => x !== d)));
  await window.renderQuotaSettings();
};

window._saveWebGroups = async function(all) {
  const v = JSON.stringify(all);
  const {error: error} = await appDB.from('settings').upsert([ {
    key: 'break_web_groups',
    value: v
  } ]);
  if (error) {
    Swal.fire('บันทึกไม่สำเร็จ', error.message, 'error');
    throw error;
  }
  SETTINGS['break_web_groups'] = v;
  window._breakWebGroups = all;
  if (typeof window.clearSettingCache === "function") window.clearSettingCache();
};

window._wgShift = window._wgShift || 'กะเช้า';

window.wgPickShift = function(sh) {
  window._wgShift = sh;
  if (typeof renderQuotaSettings === "function") renderQuotaSettings();
};

window._wgNormalize = function(all, dept) {
  const SH = [ 'กะเช้า', 'กะกลาง', 'กะดึก' ];
  if (Array.isArray(all[dept])) {
    const old = all[dept];
    all[dept] = {};
    SH.forEach((s => {
      all[dept][s] = JSON.parse(JSON.stringify(old));
    }));
  }
  if (!all[dept] || typeof all[dept] !== "object") all[dept] = {};
  return all[dept];
};

window.addWebGroup = async function(dept) {
  if (!window.sysRequireAdmin()) return;
  const picked = [ ...document.querySelectorAll('.wgpick-' + dept + ':checked') ].map((el => el.value)).filter(Boolean);
  if (picked.length < 2) return Swal.fire('เลือกอย่างน้อย 2 เว็บ', 'ติ๊กเว็บที่อยากรวมกัน แล้วกดอีกครั้งครับ', 'info');
  const sh = window._wgShift;
  const all = JSON.parse(JSON.stringify(window._breakWebGroups || {}));
  const byShift = window._wgNormalize(all, dept);
  let groups = Array.isArray(byShift[sh]) ? byShift[sh] : [];
  const merged = new Set(picked);
  groups = groups.filter((g => {
    if (g.some((x => merged.has(x)))) {
      g.forEach((x => merged.add(x)));
      return false;
    }
    return true;
  }));
  groups.push([ ...merged ].sort());
  byShift[sh] = groups;
  await window._saveWebGroups(all);
  await window.renderQuotaSettings();
  Swal.fire({
    icon: 'success',
    title: 'รวมแล้ว (' + sh + ')',
    text: [ ...merged ].join(' + '),
    timer: 1600,
    showConfirmButton: false
  });
};

window.copyWebGroupsToAllShifts = async function(dept) {
  if (!window.sysRequireAdmin()) return;
  const sh = window._wgShift;
  const src = window.getWebGroupsOf(dept, sh);
  if (!src.length) return Swal.fire('ยังไม่มีกลุ่ม', 'กะ' + sh.replace('กะ', '') + ' ยังไม่ได้จับกลุ่มอะไรไว้ครับ', 'info');
  const ask = await Swal.fire({
    icon: 'question',
    title: 'ใช้กลุ่มของ' + sh + ' กับทุกกะ?',
    html: 'กลุ่มที่จะคัดลอก: <b>' + src.map((g => g.join(' + '))).join('</b> · <b>') + '</b><br><span style="color:var(--k-red-tx)">กลุ่มเดิมของกะอื่นจะถูกเขียนทับ</span>',
    showCancelButton: true,
    confirmButtonText: 'ใช้เลย',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#f59e0b'
  });
  if (!ask.isConfirmed) return;
  const all = JSON.parse(JSON.stringify(window._breakWebGroups || {}));
  const byShift = window._wgNormalize(all, dept);
  [ 'กะเช้า', 'กะกลาง', 'กะดึก' ].forEach((s => {
    byShift[s] = JSON.parse(JSON.stringify(src));
  }));
  await window._saveWebGroups(all);
  await window.renderQuotaSettings();
  Swal.fire({
    icon: 'success',
    title: 'คัดลอกครบ 3 กะแล้ว',
    timer: 1500,
    showConfirmButton: false
  });
};

window.removeWebGroup = async function(dept, idx) {
  if (!window.sysRequireAdmin()) return;
  const sh = window._wgShift;
  const all = JSON.parse(JSON.stringify(window._breakWebGroups || {}));
  const byShift = window._wgNormalize(all, dept);
  if (!Array.isArray(byShift[sh]) || !byShift[sh][idx]) return;
  const names = byShift[sh][idx].join(' + ');
  const ask = await Swal.fire({
    icon: 'question',
    title: 'แยก ' + names + ' ออกจากกัน?',
    text: 'เฉพาะ' + sh + ' — กะอื่นไม่กระทบ',
    showCancelButton: true,
    confirmButtonText: 'แยกเลย',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#dc2626'
  });
  if (!ask.isConfirmed) return;
  byShift[sh].splice(idx, 1);
  if (!byShift[sh].length) delete byShift[sh];
  if (!Object.keys(byShift).length) delete all[dept];
  await window._saveWebGroups(all);
  await window.renderQuotaSettings();
};

window.renderQuotaSettings = async function() {
  const container = document.getElementById('quotaSettingsContainer');
  if (!container) return;
  const dateEl = document.getElementById('capPreviewDate');
  const t = new Date;
  const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  const dateVal = dateEl && dateEl.value || today;
  const shifts = [ 'กะเช้า', 'กะกลาง', 'กะดึก' ];
  const depts = window.getQuotaDepts();
  const _typed = {};
  container.querySelectorAll('input[data-brm][data-dirty="1"]').forEach((inp => {
    _typed[inp.dataset.brm] = inp.value;
  }));
  await window.loadBreakMinRemainCfg(true);
  await window.loadBreakWebGroups(true);
  const keys = [];
  depts.forEach((d => shifts.forEach((sh => keys.push(`duty_roster_${d}_${dateVal}_${sh}`)))));
  let rows = {};
  try {
    const {data: data} = await appDB.from('settings').select('key, value').in('key', keys);
    (data || []).forEach((r => {
      try {
        rows[r.key] = JSON.parse(r.value);
      } catch (e) {}
    }));
  } catch (e) {}
  const allTeams = [ ...TEAM_LIST ].sort(((a, b) => a.localeCompare(b)));
  const table = dept => {
    const maps = {};
    shifts.forEach((sh => {
      const r = rows[`duty_roster_${dept}_${dateVal}_${sh}`];
      maps[sh] = r ? window.buildCoverageMap(r) : null;
    }));
    const cell = (sh, team) => {
      const m = maps[sh];
      const raw = window.getBreakMinRemainRaw(dept, sh, team);
      const pool = window.getBreakWebPool(dept, team, sh);
      const n = m ? window.poolMembers(m, dept, team).members.size : 0;
      const cap = raw === null ? Math.min(n, window.breakCapByHeadcount(n)) : n <= 1 ? n : Math.max(0, n - raw);
      const autoRemain = n > 0 ? n - Math.min(n, window.breakCapByHeadcount(n)) : 1;
      const capHtml = m ? `<div class="text-[10px] ${n ? 'text-sky-300' : 'text-slate-600'}">คน ${n} → พักได้ <b class="brm-cap ${cap === 0 && n > 0 ? 'text-red-400' : 'text-emerald-300'}" data-n="${n}">${cap}</b></div>` : `<div class="text-[10px] text-slate-600 py-0.5">ยังไม่จัด</div>`;
      return `<div class="w-28 shrink-0 text-center ml-2 rounded-lg border ${raw === null ? 'border-slate-600' : 'border-amber-500/60'} bg-slate-900 py-1 leading-tight">\n                ${capHtml}\n                ${pool.grouped ? `<div class="text-[8px] text-amber-300/90 leading-none -mt-0.5" title="กะนี้รวมกับ ${pool.members.filter((x => x !== team)).join(", ")}">🔗 ${pool.members.filter((x => x !== team)).join(", ")}</div>` : ""}\n                <div class="text-[9px] ${raw === null ? 'text-slate-400' : 'text-amber-300'} flex items-center justify-center gap-1 mt-0.5" title="ช่วงเวลาเดียวกัน ต้องเหลือคนเฝ้าเว็บนี้อย่างน้อยเท่านี้">เฝ้า≥\n                    <input type="number" min="0" max="99" value="${raw === null ? '' : raw}" placeholder="${autoRemain}" data-brm="${dept}|${sh}|${team}" oninput="brmPreview(this)"\n                        class="w-9 bg-slate-800 border ${raw === null ? 'border-slate-600' : 'border-amber-500/60'} rounded text-center text-[10px] py-0.5 outline-none focus:border-amber-400"> คน\n                </div>\n            </div>`;
    };
    return `\n        \n        <div class="flex-1 overflow-x-auto custom-scrollbar min-h-0">\n            <div class="min-w-max h-full flex flex-col">\n                <div class="flex text-[10px] font-bold text-pink-400 mb-2 shrink-0">\n                    <div class="w-24 shrink-0 text-center">เว็บ</div>\n                    <div class="w-28 shrink-0 text-center text-orange-400 ml-2">เช้า</div>\n                    <div class="w-28 shrink-0 text-center text-blue-400 ml-2">กลาง</div>\n                    <div class="w-28 shrink-0 text-center text-purple-400 ml-2">ดึก</div>\n                </div>\n                <div class="space-y-2 flex-1 overflow-y-auto custom-scrollbar pr-1 min-h-0">\n                    ${allTeams.map((team => `\n                    <div class="flex items-center">\n                        <div class="bg-[#f0fdf4] dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-slate-800 dark:text-emerald-100 font-bold px-3 py-1.5 rounded-lg w-24 text-center text-xs shrink-0">${team}</div>\n                        ${cell('กะเช้า', team)}${cell('กะกลาง', team)}${cell('กะดึก', team)}\n                    </div>`)).join('')}\n                </div>\n            </div>\n        </div>`;
  };
  container.innerHTML = `\n        <style>\n            \n            input[data-brm]::placeholder { color:var(--k-mute3); opacity: 1; font-weight: 400; font-style: italic; }\n            input[data-brm] { color:var(--k-amber-tx); font-weight: 700; }   \n        </style>\n        <div class="flex flex-col gap-4 w-full mt-2">\n            <div class="bg-sky-900/20 border border-sky-700/40 rounded-xl p-3 text-[11px] text-sky-200 leading-relaxed flex flex-wrap items-center gap-3">\n                <div class="flex-1 min-w-[260px]">\n                    <b>กติกา:</b> นับรวมทุกคนของเว็บ <b>ไม่สนหลัก/รอง</b> — <b>ไม่ตั้งค่า = เพดานอัตโนมัติตามขั้นบันได:</b>\n                    ≤4→1 · 5-7→2 · 8-10→3 · 11-14→4 · 15-20→5 · 21-25→6 · 26-30→7 · 31-35→8 · 36-40→9 · 41-45→10 · 46-50→11 ·\n                    อยากเข้ม/หลวมกว่านั้นค่อยกรอกช่อง "เฝ้า≥" เอง (ค่าที่กรอกชนะอัตโนมัติ) · ห้ามลงช่วงติดกัน · แยก AM/OD · <b>กดบันทึกถึงมีผล</b>\n                </div>\n                <label class="flex items-center gap-2 text-[11px] text-slate-300 shrink-0">ดูของวันที่\n                    <input type="date" id="capPreviewDate" value="${dateVal}" onchange="renderQuotaSettings()" class="bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-white text-[11px] outline-none focus:border-sky-500">\n                </label>\n                <button onclick="saveBreakMinRemain()" class="shrink-0 bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition shadow"><span class="material-icons text-[13px]">save</span> บันทึกค่าเหลือเฝ้า</button>\n                <button onclick="resetBreakMinRemain()" class="shrink-0 bg-slate-700 hover:bg-slate-600 text-slate-300 text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition" title="ลบค่าที่ตั้งเองทั้งหมด กลับไปใช้ค่าเริ่มต้น (เหลือเฝ้า 1)"><span class="material-icons text-[13px]">restart_alt</span> ล้างเป็นอัตโนมัติ</button>\n                <label class="flex items-center gap-2 text-[11px] text-slate-300 shrink-0 border-l border-slate-700 pl-3">เพิ่มแผนก\n                    <select id="quotaDeptPicker" class="bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-white text-[11px] outline-none focus:border-emerald-500">\n                        ${(typeof window.getSystemDepts === "function" ? window.getSystemDepts() : []).filter((d => !depts.includes(d))).map((d => `<option value="${d}">${d}</option>`)).join('') || '<option value="">— ครบทุกแผนกแล้ว —</option>'}\n                    </select>\n                </label>\n                <button onclick="addQuotaDept()" class="shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"><span class="material-icons text-[13px]">add</span> เพิ่ม</button>\n            </div>\n            <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 w-full">\n                ${depts.map(((d, di) => `\n                <div class="bg-[#151f32] rounded-xl border border-slate-700/80 shadow-inner p-4 flex flex-col h-[460px]">\n                    <h5 class="${[ "text-blue-300", "text-pink-300", "text-emerald-300", "text-amber-300", "text-violet-300", "text-cyan-300", "text-rose-300" ][di % 7]} font-bold text-xs flex items-center gap-1.5 mb-3 border-b border-slate-700/50 pb-2 shrink-0">\n                        <span class="material-icons text-[14px]">${[ "domain", "groups", "apartment", "corporate_fare", "store", "workspaces", "hub" ][di % 7]}</span>\n                        แผนก ${d} — คน → พักพร้อมกันได้\n                        <button onclick="removeQuotaDept('${d}')" title="เอาแผนกนี้ออกจากหน้านี้"\n                            class="ml-auto text-slate-500 hover:text-red-400 transition"><span class="material-icons text-[14px]">close</span></button>\n                    </h5>\n                    <div class="mb-2 shrink-0 text-[10px] bg-slate-900/60 border border-slate-700/60 rounded-lg px-2 py-1.5">\n                        <div class="flex items-center gap-1.5 flex-wrap">\n                            <span class="text-slate-400">🔗 กลุ่มเว็บที่รวมกัน (การ์ดจัดเวร + โควตาพัก)</span>\n                            ${shifts.map((sh => `<button onclick="wgPickShift('${sh}')" class="px-1.5 py-0.5 rounded border font-bold ${window._wgShift === sh ? "bg-amber-600 border-amber-500 text-white" : "bg-slate-800 border-slate-600 text-slate-300 hover:border-amber-500"}">${sh.replace("กะ", "")}</button>`)).join('')}\n                            <span class="text-slate-500">:</span>\n                            ${window.getWebGroupsOf(d, window._wgShift).map(((g, gi) => `<span class="inline-flex items-center gap-1 bg-amber-900/30 border border-amber-600/50 text-amber-200 rounded px-1.5 py-0.5">${g.join(" + ")}\n                                    <button onclick="removeWebGroup('${d}', ${gi})" title="แยกกลับเป็นเว็บเดี่ยว" class="hover:text-red-400"><span class="material-icons text-[11px] align-middle">close</span></button>\n                                </span>`)).join('') || '<span class="text-slate-600 italic">ยังไม่มีกลุ่ม</span>'}\n                        </div>\n                        <div class="text-slate-500 mt-1 text-[9px]">ติ๊กเว็บที่อยากรวมเป็น "กลุ่มเดียวกัน" แล้วกด "รวมที่เลือก" · แยกกลุ่มของแต่ละกะได้ (กดเลือกกะด้านบน) · สร้างได้หลายกลุ่ม ทำทีละกลุ่ม เช่น กลุ่มที่ 1 = BT678+F168 แล้วค่อยติ๊กกลุ่มที่ 2 = JL69+Jun88</div>\n                        <div class="flex items-center gap-1 mt-1.5 flex-wrap">\n                            ${allTeams.map((tm => {
    const inG = window.getWebGroupsOf(d, window._wgShift).some((g => g.includes(tm)));
    return `<label class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border cursor-pointer select-none ${inG ? "border-amber-600/50 bg-amber-900/20 text-amber-200" : "border-slate-600 bg-slate-800 text-slate-300 hover:border-amber-500"}">\n                                    <input type="checkbox" class="wgpick-${d} accent-amber-500 w-3 h-3" value="${tm}">${tm}\n                                </label>`;
  })).join('')}\n                            <button onclick="addWebGroup('${d}')" class="bg-amber-600 hover:bg-amber-500 text-white font-bold px-2 py-0.5 rounded ml-1">รวมที่เลือก</button>\n                            <button onclick="copyWebGroupsToAllShifts('${d}')" class="bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold px-2 py-0.5 rounded" title="เอากลุ่มของกะนี้ไปใช้กับอีก 2 กะด้วย">ใช้กับทุกกะ</button>\n                        </div>\n                    </div>\n                    ${table(d)}\n                </div>`)).join('')}\n            </div>\n        </div>`;
  Object.entries(_typed).forEach((([k, v]) => {
    const inp = container.querySelector(`input[data-brm="${CSS.escape(k)}"]`);
    if (inp) {
      inp.value = v;
      inp.dataset.dirty = '1';
      window.brmPreview(inp);
    }
  }));
};

window.brmPreview = function(inp) {
  inp.dataset.dirty = '1';
  const capEl = inp.closest('.rounded-lg')?.querySelector('.brm-cap');
  if (!capEl) return;
  const n = parseInt(capEl.dataset.n || '0', 10);
  const cap = String(inp.value).trim() === '' ? Math.min(n, window.breakCapByHeadcount(n)) : n <= 1 ? n : Math.max(0, n - Math.max(0, parseInt(inp.value, 10) || 0));
  capEl.textContent = cap;
  capEl.className = 'brm-cap ' + (cap === 0 && n > 0 ? 'text-red-400' : 'text-emerald-300');
};

window.resetBreakMinRemain = async function() {
  if (!window.sysRequireAdmin()) return;
  const r = await Swal.fire({
    title: 'ล้างเป็นอัตโนมัติทั้งหมด?',
    text: 'ค่า "เฝ้า≥" ที่ตั้งเองไว้ทุกช่องจะถูกลบ ทุกเว็บกลับไปใช้เพดานอัตโนมัติตามตารางขั้นบันได (เว็บมีกี่คน → พักได้กี่คน)',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'ล้างเลย',
    cancelButtonText: 'ยกเลิก'
  });
  if (!r.isConfirmed) return;
  try {
    const {error: error} = await appDB.from('settings').upsert([ {
      key: 'break_min_remain',
      value: '{}'
    } ]);
    if (error) throw error;
    await window.loadBreakMinRemainCfg(true);
    await window.loadBreakWebGroups(true);
    try {
      await appDB.from('system_logs').insert([ {
        action_type: 'ตั้งค่าเหลือเฝ้าหน้างาน',
        performed_by: window.currentUser?.username || 'admin',
        target_details: 'ล้างค่ากำหนดเองทั้งหมด กลับไปใช้ค่าเริ่มต้น (เหลือเฝ้า 1)'
      } ]);
    } catch (e) {}
    Swal.fire({
      icon: 'success',
      title: 'ล้างแล้ว',
      text: 'ทุกเว็บใช้กฏอัตโนมัติ',
      timer: 1500,
      showConfirmButton: false
    });
    if (typeof renderQuotaSettings === 'function') renderQuotaSettings();
  } catch (e) {
    Swal.fire('ผิดพลาด', e.message, 'error');
  }
};

window.saveBreakMinRemain = async function() {
  if (!window.sysRequireAdmin()) return;
  const cfg = {};
  let zeroCap = 0, customCount = 0;
  document.querySelectorAll('input[data-brm]').forEach((inp => {
    const [dept, sh, team] = String(inp.dataset.brm).split('|');
    if (!dept || !sh || !team) return;
    if (String(inp.value).trim() === '') return;
    const nVal = Math.max(0, Math.min(99, parseInt(inp.value, 10) || 0));
    ((cfg[dept] = cfg[dept] || {})[sh] = cfg[dept][sh] || {})[team] = nVal;
    customCount++;
    const capEl = inp.closest('.rounded-lg')?.querySelector('.brm-cap');
    if (capEl && parseInt(capEl.dataset.n || '0', 10) > 1 && capEl.textContent === '0') zeroCap++;
  }));
  if (zeroCap > 0) {
    const r = await Swal.fire({
      title: 'มีเว็บที่จะพักไม่ได้เลย',
      html: `มี <b>${zeroCap} ช่อง</b> ที่ตั้งค่าเหลือเฝ้าจนคน "พักได้ 0"<br>คนเว็บนั้นในกะนั้นจะกดจองพักไม่ได้ทั้งวัน — ยืนยันบันทึก?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'บันทึกเลย',
      cancelButtonText: 'กลับไปแก้'
    });
    if (!r.isConfirmed) return;
  }
  try {
    const {error: error} = await appDB.from('settings').upsert([ {
      key: 'break_min_remain',
      value: JSON.stringify(cfg)
    } ]);
    if (error) throw error;
    await window.loadBreakMinRemainCfg(true);
    await window.loadBreakWebGroups(true);
    try {
      await appDB.from('system_logs').insert([ {
        action_type: 'ตั้งค่าเหลือเฝ้าหน้างาน',
        performed_by: window.currentUser?.username || 'admin',
        target_details: 'อัปเดตค่า "พักแล้วต้องเหลือหน้างานกี่คน" (แยกแผนก/กะ/เว็บ)'
      } ]);
    } catch (e) {}
    Swal.fire({
      icon: 'success',
      title: 'บันทึกแล้ว',
      text: 'มีผลกับการจองพักทันที',
      timer: 1800,
      showConfirmButton: false
    });
  } catch (e) {
    Swal.fire('บันทึกไม่สำเร็จ', e.message, 'error');
  }
};

window.renderQuotaHistory = async function() {
  const c = document.getElementById('quotaHistoryContainer');
  if (!c) return;
  c.innerHTML = '<div class="text-center py-10 text-gray-500"><span class="material-icons animate-spin mb-2 text-2xl">sync</span><br>กำลังโหลดประวัติ...</div>';
  try {
    const {data: data, error: error} = await appDB.from('system_logs').select('*').in('action_type', [ 'สุ่มจัดหน้าที่', 'ย้ายหน้าที่', 'ล้างตารางงาน', 'กู้คืนตารางงาน' ]).order('created_at', {
      ascending: false
    }).limit(80);
    if (error) throw error;
    if (!data || data.length === 0) {
      c.innerHTML = '<div class="text-center py-10 text-gray-500 text-sm">ยังไม่มีประวัติ</div>';
      return;
    }
    const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const fmt = d => new Date(d).toLocaleString('th-TH', {
      day: '2-digit',
      month: 'short',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    let html = '<div class="space-y-2">';
    data.forEach((log => {
      let badge = 'bg-slate-700 text-slate-200 border-slate-600';
      if (log.action_type === 'สุ่มจัดหน้าที่') badge = 'bg-indigo-900/40 text-indigo-300 border-indigo-700/50'; else if (log.action_type === 'ย้ายหน้าที่') badge = 'bg-purple-900/40 text-purple-300 border-purple-700/50'; else if (log.action_type === 'ล้างตารางงาน') badge = 'bg-red-900/40 text-red-300 border-red-700/50'; else if (log.action_type === 'กู้คืนตารางงาน') badge = 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50';
      html += `\n            <div class="bg-slate-800/50 border border-slate-700 rounded-xl p-2.5 text-[11px]">\n                <div class="flex flex-wrap items-center gap-2">\n                    <span class="font-mono text-gray-400">${fmt(log.created_at)}</span>\n                    <span class="${badge} border px-2 py-0.5 rounded-md font-bold">${esc(log.action_type)}</span>\n                    <span class="text-gray-500">โดย <b class="text-white">${esc(log.performed_by)}</b></span>\n                </div>\n                <div class="text-gray-300 mt-1 whitespace-pre-wrap break-words">${esc(log.target_details)}</div>\n            </div>`;
    }));
    html += '</div>';
    c.innerHTML = html;
  } catch (e) {
    c.innerHTML = `<div class="text-center py-6 text-red-400 text-sm">โหลดประวัติไม่สำเร็จ: ${e.message}</div>`;
  }
};
