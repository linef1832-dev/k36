window.openAdminPanel = async function() {
  if (!window.sysRequireAdmin()) return;
  window._openingAdminPanel = true;
  setTimeout((() => {
    window._openingAdminPanel = false;
  }), 8e3);
  Swal.fire({
    title: 'กำลังดึงรายชื่อพนักงาน...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });
  if (!document.getElementById('adminPanel')) {
    if (typeof showPage === 'function') await showPage('dashboard');
    for (let i = 0; i < 40 && !document.getElementById('adminPanel'); i++) {
      await new Promise((r => setTimeout(r, 50)));
    }
    if (typeof initDashboard === 'function') initDashboard();
  }
  if (!window.GLOBAL_USER_LIST || window.GLOBAL_USER_LIST.length === 0) {
    if (typeof fetchUsers === 'function') {
      await fetchUsers();
    }
  } else {
    if (typeof renderUserTableDirectly === 'function') window.renderUserTableDirectly();
  }
  if (document.getElementById('mainContentArea')) document.getElementById('mainContentArea').classList.add('hidden');
  if (document.getElementById('logsPage')) {
    document.getElementById('logsPage').classList.add('hidden');
    document.getElementById('logsPage').classList.remove('flex');
  }
  const adminPanel = document.getElementById('adminPanel');
  if (adminPanel) {
    adminPanel.classList.remove('hidden');
    adminPanel.classList.add('flex');
  }
  requestAnimationFrame((() => requestAnimationFrame((() => {
    window._openingAdminPanel = false;
  }))));
  const canSeeSettings = typeof window.hasUserPerm === 'function' && window.hasUserPerm('admin_settings');
  const canSeeUsers = typeof window.hasUserPerm === 'function' && window.hasUserPerm('admin_users');
  const canSeePerms = typeof window.hasUserPerm === 'function' && window.hasUserPerm('admin_perms');
  const canSeeInfo = typeof window.hasUserPerm === 'function' && window.hasUserPerm('admin_info');
  const btnSettings = document.getElementById('btnAdminTab_settings');
  const btnUsers = document.getElementById('btnAdminTab_users');
  const btnPerms = document.getElementById('btnAdminTab_perms');
  const btnInfo = document.getElementById('btnAdminTab_quotalog');
  if (btnSettings) btnSettings.style.display = canSeeSettings ? '' : 'none';
  if (btnUsers) btnUsers.style.display = canSeeUsers ? '' : 'none';
  if (btnPerms) btnPerms.style.display = canSeePerms ? '' : 'none';
  if (btnInfo) btnInfo.style.display = canSeeInfo ? '' : 'none';
  window.populateClearScheduleDept();
  window.syncUndoScheduleBtn();
  window.setClearScheduleDefaultDate();
  if (typeof switchAdminTab === 'function') {
    if (canSeeSettings) switchAdminTab('settings'); else if (canSeeUsers) switchAdminTab('users'); else if (canSeePerms) switchAdminTab('perms'); else if (canSeeInfo) switchAdminTab('quotalog');
  }
  Swal.close();
};

window.selectAllSchedulesByDate = async function(dateVal) {
  const PAGE = 1e3;
  let all = [], from = 0;
  while (true) {
    const {data: data, error: error} = await appDB.from('schedules').select('*').eq('work_date', dateVal).order('id', {
      ascending: true
    }).range(from, from + PAGE - 1);
    if (error) throw error;
    all = all.concat(data || []);
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return all;
};

window.populateClearScheduleDept = function() {
  const sel = document.getElementById('clearScheduleDept');
  if (!sel) return;
  const keep = sel.value || 'all';
  const depts = typeof window.getSystemDepts === 'function' ? window.getSystemDepts() : [ 'AM', 'OD', 'AMQL' ];
  let html = '<option value="all">🌐 ทุกแผนก</option>';
  depts.forEach((d => {
    html += `<option value="${d}">เฉพาะ ${d}</option>`;
  }));
  sel.innerHTML = html;
  sel.value = [ ...sel.options ].some((o => o.value === keep)) ? keep : 'all';
};

window._schBackupStack = function() {
  try {
    const st = JSON.parse(sessionStorage.getItem('temp_schedule_backup_stack') || '[]');
    if (Array.isArray(st) && st.length) return st;
    const old = sessionStorage.getItem('temp_schedule_backup');
    if (old) return [ {
      rows: JSON.parse(old),
      date: '',
      dept: 'all',
      shift: 'all'
    } ];
  } catch (e) {}
  return [];
};

window._schBackupSave = function(stack) {
  sessionStorage.removeItem('temp_schedule_backup');
  if (stack.length) sessionStorage.setItem('temp_schedule_backup_stack', JSON.stringify(stack)); else sessionStorage.removeItem('temp_schedule_backup_stack');
};

window.syncUndoScheduleBtn = function() {
  const btn = document.getElementById('undoScheduleBtn');
  if (!btn) return;
  const n = window._schBackupStack().length;
  btn.classList.toggle('hidden', !n);
  const lbl = btn.querySelector('.undo-count');
  if (lbl) lbl.textContent = n > 1 ? ` (${n} ชุด)` : '';
};

let _boardChannel = null;

window.subscribeBoardEvents = function() {
  if (!window.appDB) return;
  if (_boardChannel) {
    try {
      appDB.removeChannel(_boardChannel);
    } catch (e) {}
  }
  const _localToday = () => {
    const d = new Date;
    return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().split('T')[0];
  };
  const _refreshBoard = () => {
    try {
      if (typeof window.refreshTimeSlots === 'function') window.refreshTimeSlots();
    } catch (e) {}
    try {
      if (typeof fetchData === 'function') fetchData();
    } catch (e) {}
  };
  const _toast = (icon, title, text) => Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 9e3,
    timerProgressBar: true
  }).fire({
    icon: icon,
    title: title,
    text: text
  });
  const _isMe = names => currentUser && Array.isArray(names) && names.some((n => String(n || '').trim().toLowerCase() === String(currentUser.username || '').trim().toLowerCase()));
  const _cond = p => `วันที่ ${p.date}${p.dept !== 'all' ? ' · แผนก ' + p.dept : ''}${p.shift !== 'all' ? ' · ' + p.shift : ''}`;
  _boardChannel = appDB.channel('board-events', {
    config: {
      broadcast: {
        self: false
      }
    }
  }).on('broadcast', {
    event: 'schedule_cleared'
  }, (({payload: p}) => {
    if (!p) return;
    if (_isMe(p.names)) {
      const mine = (p.items || []).filter((i => String(i.staff_name || '').toLowerCase() === String(currentUser.username || '').toLowerCase()));
      const slots = mine.map((i => `${i.shift_name} ${i.time_slot}`)).join(', ');
      _toast('warning', '⚠️ เวลาพักของคุณถูกล้างโดยแอดมิน', `${_cond(p)}${slots ? ' — ' + slots : ''} กรุณาลงเวลาใหม่`);
    }
    _refreshBoard();
  })).on('broadcast', {
    event: 'schedule_restored'
  }, (({payload: p}) => {
    if (!p) return;
    if (_isMe(p.names)) _toast('success', '✅ เวลาพักของคุณถูกกู้คืนแล้ว', `${_cond(p)} — ไม่ต้องลงใหม่`);
    _refreshBoard();
  })).on('broadcast', {
    event: 'force_logout'
  }, (({payload: p}) => {
    if (!p || !currentUser) return;
    if (String(p.user_id) !== String(currentUser.id)) return;
    window._forceLogoutNow(p.by);
  })).subscribe();
  window._boardChannel = _boardChannel;
};

window._forceLogoutNow = function(byWhom) {
  Swal.fire({
    icon: 'warning',
    title: 'คุณถูกให้ออกจากระบบ',
    text: `ผู้ดูแลระบบ${byWhom ? ' (' + byWhom + ')' : ''} ให้คุณออกจากระบบ กรุณาล็อกอินใหม่`,
    allowOutsideClick: false,
    allowEscapeKey: false,
    confirmButtonText: 'ตกลง',
    timer: 6e3,
    timerProgressBar: true
  }).then((() => {
    if (typeof logout === 'function') logout(); else location.reload();
  }));
};

window.kickUserOut = async function(userId, username) {
  if (!canPerm('admin_users')) return Swal.fire('ไม่มีสิทธิ์', 'ต้องมีสิทธิ์ จัดการผู้ใช้', 'error');
  if (String(userId) === String(currentUser.id)) return Swal.fire('ไม่ได้', 'เตะตัวเองไม่ได้ ใช้ปุ่มออกจากระบบแทน', 'warning');
  const ask = await Swal.fire({
    icon: 'question',
    title: `เตะ ${username} ออกจากระบบ?`,
    html: `<div class="text-sm text-gray-400">คนนี้จะหลุดจากเว็บทันทีทุกอุปกรณ์ที่เปิดอยู่<br>และต้อง<b>ล็อกอินใหม่</b>ถึงจะเข้าได้อีก (ไม่ได้ลบ/แบนบัญชี)</div>`,
    showCancelButton: true,
    confirmButtonText: '🚪 เตะออกเลย',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#dc2626'
  });
  if (!ask.isConfirmed) return;
  try {
    await appDB.from('settings').upsert({
      key: `force_logout_${userId}`,
      value: String(Date.now())
    }, {
      onConflict: 'key'
    });
    await _broadcastBoard('force_logout', {
      user_id: userId,
      username: username,
      by: currentUser.username
    });
    if (typeof logAction === 'function') await logAction('เตะออกจากระบบ', `เตะ ${username} ออกจากระบบ`);
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: `เตะ ${username} ออกแล้ว`,
      showConfirmButton: false,
      timer: 2500
    });
  } catch (e) {
    Swal.fire('ผิดพลาด', e.message, 'error');
  }
};

async function _broadcastBoard(event, payload) {
  try {
    if (!_boardChannel) window.subscribeBoardEvents();
    if (!_boardChannel) return;
    await _boardChannel.send({
      type: 'broadcast',
      event: event,
      payload: payload
    });
  } catch (e) {
    console.warn('[board-events] ส่งแจ้งเตือนไม่สำเร็จ', e);
  }
}

function _boardPayload(rows, dateVal, deptVal, shiftVal) {
  return {
    date: dateVal,
    dept: deptVal,
    shift: shiftVal,
    names: [ ...new Set(rows.map((r => r.staff_name)).filter(Boolean)) ],
    items: rows.map((r => ({
      staff_name: r.staff_name,
      shift_name: r.shift_name,
      time_slot: r.time_slot
    }))),
    by: currentUser ? currentUser.username : 'admin',
    at: Date.now()
  };
}

window.setClearScheduleDefaultDate = function() {
  const el = document.getElementById('clearScheduleDate');
  if (!el || el.value) return;
  const d = new Date;
  el.value = new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().split('T')[0];
};

window.clearAllSchedules = async function() {
  if (!window.sysRequireAdmin()) return;
  const dateInput = document.getElementById('clearScheduleDate');
  const deptInput = document.getElementById('clearScheduleDept');
  const shiftInput = document.getElementById('clearScheduleShift');
  const dateVal = dateInput ? dateInput.value : '';
  const deptVal = deptInput ? deptInput.value : 'all';
  const shiftVal = shiftInput ? shiftInput.value : 'all';
  if (!dateVal) return Swal.fire('แจ้งเตือน', 'กรุณาเลือกวันที่ ที่ต้องการล้างข้อมูลก่อนครับ', 'warning');
  let targetText = `วันที่: <b class="text-red-500">${dateVal}</b>`;
  if (deptVal !== 'all') targetText += `<br>แผนก: <b class="text-sky-400">${deptVal}</b>`; else targetText += `<br>แผนก: <b class="text-gray-300">ทั้งหมด</b>`;
  if (shiftVal !== 'all') targetText += `<br>กะ: <b class="text-orange-400">${shiftVal}</b>`; else targetText += `<br>กะ: <b class="text-gray-300">ทั้งหมด</b>`;
  const confirm = await Swal.fire({
    title: 'ยืนยันการล้างกระดาน?',
    html: `คุณกำลังจะลบข้อมูลการลงเวลาตามเงื่อนไขนี้:<br><br><div class="bg-slate-900 p-4 rounded-lg border border-slate-700 text-left w-fit mx-auto text-sm shadow-inner">${targetText}</div><br><span class="text-xs text-gray-400">พนักงานในกลุ่มนี้จะต้องเข้ามาลงเวลาใหม่ ทำต่อหรือไม่?</span>`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'ใช่, ล้างข้อมูลเลย!',
    cancelButtonText: 'ยกเลิก',
    customClass: {
      popup: 'dark:bg-slate-800 dark:text-white rounded-3xl border border-slate-600'
    }
  });
  if (confirm.isConfirmed) {
    Swal.fire({
      title: 'กำลังประมวลผล...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });
    try {
      const allRows = await window.selectAllSchedulesByDate(dateVal);
      const normDept = v => String(v || 'AM').trim().toUpperCase();
      const normShift = v => String(v || '').trim();
      const wantDept = normDept(deptVal);
      const wantShift = normShift(shiftVal);
      const backupData = allRows.filter((r => (deptVal === 'all' || normDept(r.department) === wantDept) && (shiftVal === 'all' || normShift(r.shift_name) === wantShift)));
      if (backupData.length === 0) {
        return Swal.fire('ไม่พบข้อมูล', 'ไม่มีประวัติการลงเวลาในเงื่อนไขที่เลือกครับ', 'info');
      }
      const _stack = window._schBackupStack();
      _stack.push({
        rows: backupData,
        date: dateVal,
        dept: deptVal,
        shift: shiftVal,
        at: Date.now()
      });
      window._schBackupSave(_stack);
      const ids = backupData.map((r => r.id)).filter((id => id !== null && id !== undefined));
      if (ids.length !== backupData.length) throw new Error('พบแถวที่ไม่มี id — ยกเลิกการลบเพื่อความปลอดภัย');
      const CHUNK = 200;
      let deletedCount = 0;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const part = ids.slice(i, i + CHUNK);
        const {data: delRows, error: error} = await appDB.from('schedules').delete().in('id', part).select('id');
        if (error) throw error;
        deletedCount += Array.isArray(delRows) && delRows.length ? delRows.length : part.length;
      }
      if (deletedCount !== ids.length) {
        console.warn(`[ล้างกระดาน] ตั้งใจลบ ${ids.length} แต่ลบได้ ${deletedCount} (อาจมีคนลบไปก่อน)`);
      }
      if (typeof logAction === 'function') await logAction('ล้างกระดาน', `แอดมินลบเวลากินข้าว วันที่ ${dateVal} [${deptVal}] [${shiftVal}]`);
      Swal.fire('ล้างข้อมูลสำเร็จ!', `ลบข้อมูลไปทั้งหมด ${deletedCount} รายการ (สามารถกดกู้คืนได้หากลบผิด)`, 'success');
      window.syncUndoScheduleBtn();
      await _broadcastBoard('schedule_cleared', _boardPayload(backupData, dateVal, deptVal, shiftVal));
      if (typeof window.refreshTimeSlots === 'function') window.refreshTimeSlots();
      if (typeof fetchData === 'function') fetchData();
    } catch (e) {
      console.error(e);
      window.syncUndoScheduleBtn();
      Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถล้างข้อมูลได้: ' + e.message + (window._schBackupStack().length ? '<br><small>ถ้าลบไปบางส่วนแล้ว กด "กู้คืนข้อมูลล่าสุด" ได้</small>' : ''), 'error');
    }
  }
};

window.undoClearSchedules = async function() {
  if (!window.sysRequireAdmin()) return;
  const stack = window._schBackupStack();
  if (!stack.length) return Swal.fire('ไม่พบข้อมูล', 'ไม่มีข้อมูลให้กู้คืนแล้วครับ', 'error');
  const batch = stack[stack.length - 1];
  const backupData = batch.rows || [];
  const confirm = await Swal.fire({
    title: 'ยืนยันการกู้คืน?',
    text: `คุณต้องการกู้คืนข้อมูลการลงเวลาจำนวน ${backupData.length} รายการ ที่เพิ่งลบทิ้งไปใช่หรือไม่?`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#10b981',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'ใช่, นำข้อมูลกลับมา!',
    cancelButtonText: 'ยกเลิก',
    customClass: {
      popup: 'dark:bg-slate-800 dark:text-white rounded-3xl border border-slate-600'
    }
  });
  if (confirm.isConfirmed) {
    Swal.fire({
      title: 'กำลังกู้คืนข้อมูล...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });
    try {
      const {error: error} = await appDB.from('schedules').upsert(backupData, {
        onConflict: 'id'
      });
      if (error) throw error;
      stack.pop();
      window._schBackupSave(stack);
      window.syncUndoScheduleBtn();
      if (typeof logAction === 'function') await logAction('กู้คืนข้อมูล', `แอดมินกู้คืนข้อมูลการลงเวลาจำนวน ${backupData.length} รายการ`);
      Swal.fire('กู้คืนสำเร็จ!', 'ข้อมูลกลับมาอยู่ที่เดิมเรียบร้อยแล้วครับ', 'success');
      const _d0 = backupData[0] || {};
      await _broadcastBoard('schedule_restored', _boardPayload(backupData, batch.date || _d0.work_date || '', batch.dept || 'all', batch.shift || 'all'));
      if (typeof window.refreshTimeSlots === 'function') window.refreshTimeSlots();
      if (typeof fetchData === 'function') fetchData();
    } catch (e) {
      console.error(e);
      Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถกู้คืนได้: ' + e.message, 'error');
    }
  }
};

window.openEditUserModal = function(id) {
  if (!window.sysRequireAdmin()) return;
  const user = GLOBAL_USER_LIST.find((u => String(u.id) === String(id)));
  if (!user) return;
  document.getElementById('editUserId').value = id;
  document.getElementById('editUserName').value = user.username || '';
  document.getElementById('editDiscordId').value = user.discord_id || '';
  document.getElementById('editTelegramId').value = user.telegram_id || '';
  if (document.getElementById('editTag')) document.getElementById('editTag').value = user.tag || '';
  const modal = document.getElementById('editUserModal');
  if (!modal) return;
  modal.style.display = 'flex';
};

window.closeEditUserModal = function() {
  const modal = document.getElementById('editUserModal');
  if (!modal) return;
  modal.style.display = 'none';
};

window.saveEditUser = async function() {
  if (!window.sysRequireAdmin()) return;
  const id = document.getElementById('editUserId').value;
  const username = document.getElementById('editUserName').value.trim();
  const discordId = document.getElementById('editDiscordId').value.trim();
  const telegramId = document.getElementById('editTelegramId').value.trim();
  const tag = document.getElementById('editTag')?.value.trim() || null;
  if (!username) return Swal.fire('ข้อมูลไม่ครบ', 'กรุณาใส่ชื่อพนักงาน', 'warning');
  Swal.fire({
    title: 'กำลังบันทึก...',
    didOpen: () => Swal.showLoading()
  });
  const {error: error} = await appDB.from('users').update({
    username: username,
    discord_id: discordId || null,
    telegram_id: telegramId || null,
    tag: tag || null
  }).eq('id', id);
  if (error) return Swal.fire('Error', error.message, 'error');
  const idx = GLOBAL_USER_LIST.findIndex((u => String(u.id) === String(id)));
  if (idx !== -1) {
    GLOBAL_USER_LIST[idx].username = username;
    GLOBAL_USER_LIST[idx].discord_id = discordId || null;
    GLOBAL_USER_LIST[idx].telegram_id = telegramId || null;
    GLOBAL_USER_LIST[idx].tag = tag || null;
  }
  closeEditUserModal();
  window.renderUserTableDirectly();
  Swal.fire({
    icon: 'success',
    title: 'บันทึกสำเร็จ',
    timer: 1500,
    showConfirmButton: false
  });
};
