let currentDutyDept = 'AM';

let dutyAccessMatrix = {};

let customDutyRoles = {};

let currentDutyLeaves = new Set;

window.getDutyShiftForToday = function(u) {
  if (!u) return null;
  const override = window.currentDutyShiftToday && window.currentDutyShiftToday[String(u.id)];
  return override || u.allowed_shift;
};

window.dutyDbOk = function(res) {
  if (res && res.error) throw res.error;
  return res;
};

window.isDutyShiftMatch = function(u, shiftFilter) {
  const shift = window.getDutyShiftForToday(u);
  return shift === shiftFilter || shift === 'all';
};

let dutySubscription = null;

let sortedTeams = [];

let currentRosterData = {};

window.isDutyAdmin = function() {
  let deptCheck = currentDutyDept;
  if (deptCheck === 'TRAINER_AM') deptCheck = 'AMQL';
  if (deptCheck === 'TRAINER_OD') deptCheck = 'ODQL';
  const reqPerm = 'duty_manage_' + deptCheck.toLowerCase();
  return window.hasUserPerm(reqPerm) || window.hasUserPerm('duty_manage');
};

window.dutySideOf = function(dept) {
  const d = String(dept || currentDutyDept || 'AM').toUpperCase();
  if (d === 'OD' || d === 'ODQL' || d.startsWith('TRAINER_OD')) return 'OD';
  return 'AM';
};

window.dutyMergeKey = function(date, shift, dept) {
  return 'duty_merge_rooms_' + window.dutySideOf(dept) + '_' + date + '_' + shift;
};

window.dutyMergeKeyLegacy = function(date, shift) {
  return 'duty_merge_rooms_' + date + '_' + shift;
};

window.isTrainerDept = function(dept) {
  dept = dept || currentDutyDept || '';
  return dept === 'AMQL' || dept === 'ODQL' || dept.startsWith('TRAINER');
};

window.normalizeUserDept = function(u) {
  let d = u && u.department || 'AM';
  if (d === 'TRAINER') d = 'AMQL';
  return d;
};

window.getDutyActiveStaff = function(shiftFilter, opts) {
  opts = opts || {};
  const trainer = window.isTrainerDept();
  return (GLOBAL_USER_LIST || []).filter((u => {
    if (!u) return false;
    if (window.normalizeUserDept(u) !== currentDutyDept) return false;
    if (!opts.anyRole && !trainer && u.role !== 'staff') return false;
    if (!window.isDutyShiftMatch(u, shiftFilter)) return false;
    if (currentDutyLeaves && currentDutyLeaves.has(String(u.id))) return false;
    return true;
  }));
};

const TEAM_COLORS = {
  Jun88: {
    bg: 'bg-blue-600',
    text: 'text-white',
    border: 'border-blue-800',
    lightBg: 'bg-blue-100',
    lightText: 'text-blue-800'
  },
  MK8: {
    bg: 'bg-black',
    text: 'text-yellow-400',
    border: 'border-yellow-600',
    lightBg: 'bg-gray-800',
    lightText: 'text-yellow-500'
  },
  F168: {
    bg: 'bg-orange-500',
    text: 'text-white',
    border: 'border-orange-700',
    lightBg: 'bg-orange-100',
    lightText: 'text-orange-800'
  },
  PG688: {
    bg: 'bg-amber-100',
    text: 'text-amber-900',
    border: 'border-amber-300',
    lightBg: 'bg-amber-50',
    lightText: 'text-amber-700'
  },
  JL69: {
    bg: 'bg-slate-500',
    text: 'text-white',
    border: 'border-slate-700',
    lightBg: 'bg-slate-200',
    lightText: 'text-slate-800'
  },
  TH26: {
    bg: 'bg-gray-700',
    text: 'text-white',
    border: 'border-gray-900',
    lightBg: 'bg-gray-200',
    lightText: 'text-gray-800'
  },
  VV72: {
    bg: 'bg-red-800',
    text: 'text-white',
    border: 'border-red-950',
    lightBg: 'bg-red-100',
    lightText: 'text-red-800'
  },
  NM9: {
    bg: 'bg-pink-500',
    text: 'text-white',
    border: 'border-pink-700',
    lightBg: 'bg-pink-100',
    lightText: 'text-pink-800'
  },
  'สอนงาน': {
    bg: 'bg-emerald-500',
    text: 'text-white',
    border: 'border-emerald-700',
    lightBg: 'bg-emerald-100',
    lightText: 'text-emerald-800'
  },
  Telegram: {
    bg: 'bg-sky-500',
    text: 'text-white',
    border: 'border-sky-700',
    lightBg: 'bg-sky-100',
    lightText: 'text-sky-800'
  },
  DEFAULT: {
    bg: 'bg-indigo-500',
    text: 'text-white',
    border: 'border-indigo-700',
    lightBg: 'bg-indigo-100',
    lightText: 'text-indigo-800'
  }
};

window.syncTeamOrder = function() {
  const savedOrder = JSON.parse(localStorage.getItem('duty_team_order') || '[]');
  let validSaved = savedOrder.filter((t => TEAM_LIST.includes(t)));
  TEAM_LIST.forEach((t => {
    if (!validSaved.includes(t)) validSaved.push(t);
  }));
  sortedTeams = validSaved;
};

window.moveTeam = function(teamName, direction) {
  if (window.isTrainerDept()) return;
  const index = sortedTeams.indexOf(teamName);
  if (index === -1) return;
  if (direction === -1 && index > 0) {
    [sortedTeams[index - 1], sortedTeams[index]] = [ sortedTeams[index], sortedTeams[index - 1] ];
  } else if (direction === 1 && index < sortedTeams.length - 1) {
    [sortedTeams[index], sortedTeams[index + 1]] = [ sortedTeams[index + 1], sortedTeams[index] ];
  }
  window.safeSetItem('duty_team_order', JSON.stringify(sortedTeams));
  window.renderDutyRequirements();
  window.updateDutyStats();
};

window.initDutyApp = async function() {
  Swal.fire({
    title: 'โหลดข้อมูล...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });
  try {
    const dateInput = document.getElementById('dutyDate');
    if (dateInput && !dateInput.value) {
      const today = new Date;
      const offset = today.getTimezoneOffset() * 6e4;
      dateInput.value = new Date(today - offset).toISOString().slice(0, 10);
    }
    if (typeof window.fillRotationGapInput === 'function') window.fillRotationGapInput();
    const initFetches = [ window.loadDutyAccessAndRoles() ];
    if (typeof fetchUsers === 'function') {
      initFetches.push(fetchUsers());
    }
    await Promise.all(initFetches);
    const teamSelect = document.getElementById('roleEditorTeam');
    if (teamSelect) {
      let opts = TEAM_LIST.map((t => `<option value="${t}">${t}</option>`));
      teamSelect.innerHTML = opts.join('');
    }
    window.syncTeamOrder();
    window.ensureDutyExtraButtons();
    window.applyDutyRoleUI();
    if (typeof window._dutyAccessMarkDirty === 'function') window._dutyAccessMarkDirty(false);
    window.renderDutyAccessTable();
    window.renderDutyRequirements();
    await window.refreshDutyData();
    window.renderRoleEditorList();
    window.subscribeDutyChanges();
    window._dutyPendingReload = false;
    window._dutyLastReloadTime = Date.now();
  } catch (err) {
    console.error("Init Duty Error:", err);
  } finally {
    Swal.close();
  }
};

const TEAM_ALIASES = {
  Vv72: 'VV72'
};

window.normalizeTeamName = function(t) {
  return TEAM_ALIASES[t] || t;
};

function normalizeRolesObject(roles) {
  let changed = false;
  Object.keys(TEAM_ALIASES).forEach((oldKey => {
    if (!(oldKey in roles)) return;
    const newKey = TEAM_ALIASES[oldKey];
    const merged = [ ...roles[newKey] || [] ];
    (roles[oldKey] || []).forEach((r => {
      if (!merged.includes(r)) merged.push(r);
    }));
    roles[newKey] = merged;
    delete roles[oldKey];
    changed = true;
  }));
  return changed;
}

function normalizeAccessMatrix(matrix) {
  let changed = false;
  Object.keys(matrix).forEach((uid => {
    const arr = matrix[uid];
    if (!Array.isArray(arr)) return;
    const fixed = [];
    arr.forEach((t => {
      const n = window.normalizeTeamName(t);
      if (!fixed.includes(n)) fixed.push(n);
    }));
    if (fixed.length !== arr.length || fixed.some(((t, i) => t !== arr[i]))) {
      matrix[uid] = fixed;
      changed = true;
    }
  }));
  return changed;
}

window.loadDutyAccessAndRoles = async function() {
  try {
    const {data: data} = await appDB.from('settings').select('*').in('key', [ 'duty_access_matrix', 'duty_custom_roles', 'duty_rotation_gap' ]);
    try {
      const _gapRow = (data || []).find((r => r.key === 'duty_rotation_gap'));
      if (_gapRow && typeof SETTINGS !== 'undefined') SETTINGS.duty_rotation_gap = _gapRow.value;
      if (typeof window.fillRotationGapInput === 'function') window.fillRotationGapInput();
    } catch (e) {}
    if (data) {
      const accessData = data.find((d => d.key === 'duty_access_matrix'));
      if (accessData && accessData.value) dutyAccessMatrix = JSON.parse(accessData.value); else dutyAccessMatrix = {};
      if (normalizeAccessMatrix(dutyAccessMatrix)) {
        window.clearSettingCache();
        appDB.from('settings').upsert([ {
          key: 'duty_access_matrix',
          value: JSON.stringify(dutyAccessMatrix)
        } ]).then((() => {}), (() => {}));
      }
      const rolesData = data.find((d => d.key === 'duty_custom_roles'));
      if (rolesData && rolesData.value && Object.keys(JSON.parse(rolesData.value)).length > 0) {
        customDutyRoles = JSON.parse(rolesData.value);
        if (normalizeRolesObject(customDutyRoles)) {
          window.clearSettingCache();
          appDB.from('settings').upsert([ {
            key: 'duty_custom_roles',
            value: JSON.stringify(customDutyRoles)
          } ]).then((() => {}), (() => {}));
        }
      } else {
        customDutyRoles = {
          Jun88: [],
          MK8: [],
          VV72: [],
          TH26: [],
          K188: [],
          BT678: [],
          PG688: [],
          JL69: [],
          NM9: [],
          F168: []
        };
        appDB.from('settings').upsert([ {
          key: 'duty_custom_roles',
          value: JSON.stringify(customDutyRoles)
        } ]);
      }
    }
  } catch (e) {
    dutyAccessMatrix = {};
    customDutyRoles = {};
  }
};

window._dutyPendingReload = false;

window._dutyLastReloadTime = 0;

window.subscribeDutyChanges = function() {
  if (dutySubscription) {
    try {
      appDB.removeChannel(dutySubscription);
    } catch (e) {}
    dutySubscription = null;
  }
  dutySubscription = appDB.channel('duty-updates').on('broadcast', {
    event: 'force_reload'
  }, (() => {
    const dutyApp = document.getElementById('dutyApp');
    const isOnDutyPage = dutyApp && !dutyApp.classList.contains('hidden');
    if (isOnDutyPage) {
      const now = Date.now();
      if (now - window._dutyLastReloadTime < 800) {
        window._dutyPendingReload = true;
        setTimeout((() => {
          if (window._dutyPendingReload && !document.getElementById('dutyApp').classList.contains('hidden')) {
            window._dutyPendingReload = false;
            window._dutyLastReloadTime = Date.now();
            window.refreshDutyData();
          }
        }), 1e3);
        return;
      }
      window._dutyLastReloadTime = now;
      window.refreshDutyData();
    } else {
      window._dutyPendingReload = true;
    }
  })).subscribe();
  if (typeof window.registerPageSubscription === 'function') window.registerPageSubscription(dutySubscription);
  if (dutySubscription && !dutySubscription._dutyPatched) {
    dutySubscription._dutyPatched = true;
    const _origUnsub = dutySubscription.unsubscribe && dutySubscription.unsubscribe.bind(dutySubscription);
    if (_origUnsub) dutySubscription.unsubscribe = function() {
      if (window._dutyPollingTimer) {
        clearInterval(window._dutyPollingTimer);
        window._dutyPollingTimer = null;
      }
      return _origUnsub.apply(this, arguments);
    };
  }
  if (window._dutyPollingTimer) clearInterval(window._dutyPollingTimer);
  window._dutyPollingTimer = setInterval((() => {
    const dutyApp = document.getElementById('dutyApp');
    if (!dutyApp) {
      clearInterval(window._dutyPollingTimer);
      window._dutyPollingTimer = null;
      return;
    }
    if (dutyApp && !dutyApp.classList.contains('hidden') && !document.hidden) {
      if (document.hidden) return;
      if (typeof window.refreshDutyData === 'function') {
        window._dutyPollTick = true;
        window.refreshDutyData();
      }
    }
  }), 12e4);
  if (!window.__dutyVisBound) {
    window.__dutyVisBound = true;
    document.addEventListener('visibilitychange', (() => {
      if (document.hidden) return;
      const dutyApp = document.getElementById('dutyApp');
      if (dutyApp && !dutyApp.classList.contains('hidden') && typeof window.refreshDutyData === 'function') {
        window._dutyPollTick = true;
        window.refreshDutyData();
      }
    }));
  }
};

window.applyDutyRoleUI = function() {
  const isAdmin = window.isDutyAdmin();
  const isTrainerDept = currentUser.department === 'AMQL' || currentUser.department === 'ODQL' || currentUser.department && currentUser.department.startsWith('TRAINER');
  const isTrainerRole = [ 'AMQL', 'ODQL', 'TRAINER' ].includes(currentUser.department);
  let canManageDuty = isAdmin;
  if (window.isTrainerDept()) {
    if (!canPerm('duty_manage_amql') && !canPerm('duty_manage_odql')) {
      canManageDuty = false;
    }
  }
  const adminElements = document.querySelectorAll('.duty-admin-only');
  const trainerBtn = document.getElementById('btnDutyTRAINER');
  if (trainerBtn) {
    if (isAdmin || isTrainerDept || isTrainerRole) {
      trainerBtn.classList.remove('hidden', 'no-perm-hidden');
      trainerBtn.style.display = '';
    } else trainerBtn.classList.add('hidden');
  }
  if (!canManageDuty) {
    adminElements.forEach((el => {
      el.style.display = 'none';
      el.classList.add('hidden');
    }));
    const shiftSelect = document.getElementById('dutyShiftSelect');
    if (shiftSelect && currentUser.allowed_shift !== 'all') shiftSelect.value = currentUser.allowed_shift;
    const indicator = document.getElementById('staffShiftIndicator');
    if (indicator) {
      indicator.classList.remove('hidden', 'no-perm-hidden');
      indicator.style.display = '';
      document.getElementById('staffShiftLabel').innerText = currentUser.allowed_shift || 'ไม่ระบุกะ';
    }
  } else {
    adminElements.forEach((el => {
      el.style.display = '';
      el.classList.remove('hidden', 'no-perm-hidden');
    }));
    const indicator = document.getElementById('staffShiftIndicator');
    if (indicator) indicator.classList.add('hidden');
  }
};

window.switchDutyTab = function(tabName) {
  document.getElementById('dutyTabRoster')?.classList.add('hidden');
  document.getElementById('dutyTabRoster')?.classList.remove('flex');
  document.getElementById('dutyTabSettings')?.classList.add('hidden');
  document.getElementById('dutyTabSettings')?.classList.remove('flex');
  const resetClass = 'dh-tab';
  const activeClass = 'dh-tab active';
  const btnRoster = document.getElementById('tabBtnRoster');
  const btnSettings = document.getElementById('tabBtnSettings');
  if (btnRoster) btnRoster.className = resetClass;
  if (btnSettings) btnSettings.className = resetClass;
  if (tabName === 'roster') {
    document.getElementById('dutyTabRoster').classList.remove('hidden');
    document.getElementById('dutyTabRoster').classList.add('flex');
    if (btnRoster) btnRoster.className = activeClass;
    window.renderDutyRequirements();
    if (window.isDutyAdmin()) window.updateDutyStats();
  } else {
    document.getElementById('dutyTabSettings').classList.remove('hidden');
    document.getElementById('dutyTabSettings').classList.add('flex');
    if (btnSettings) btnSettings.className = activeClass;
  }
};

window.switchDutyDept = function(dept) {
  currentDutyDept = dept;
  if (typeof window.fillRotationGapInput === 'function') window.fillRotationGapInput();
  document.getElementById('btnDutyAM')?.classList.remove('active');
  document.getElementById('btnDutyOD')?.classList.remove('active');
  document.getElementById('btnDutyAMQL')?.classList.remove('active');
  document.getElementById('btnDutyODQL')?.classList.remove('active');
  document.getElementById('btnDutyTRAINER_AM')?.classList.remove('active');
  document.getElementById('btnDutyTRAINER_OD')?.classList.remove('active');
  document.getElementById(`btnDuty${dept}`)?.classList.add('active');
  let labelText = dept;
  if (dept === 'AMQL') labelText = 'ผู้สอน AM'; else if (dept === 'ODQL') labelText = 'ผู้สอน OD'; else if (dept.startsWith('TRAINER')) {
    labelText = dept.replace('TRAINER_', 'ผู้สอน ');
  }
  const labelEl = document.getElementById('dutyDeptLabel');
  if (labelEl) labelEl.innerText = labelText;
  const filterTrainer = document.getElementById('trainerDeptFilterContainer');
  if (window.isTrainerDept(dept)) {
    if (filterTrainer) filterTrainer.classList.remove('hidden');
  } else {
    if (filterTrainer) filterTrainer.classList.add('hidden');
  }
  const taskModeContainer = document.getElementById('trainerTaskModeContainer');
  if (taskModeContainer) {
    taskModeContainer.classList.add('hidden');
    taskModeContainer.classList.remove('flex');
  }
  const grid = document.getElementById('dutyResultGrid');
  if (grid) grid.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center py-20 text-gray-400"><span class="material-icons animate-spin text-5xl text-indigo-500 mb-2">sync</span><span class="font-bold text-sm">กำลังจัดเตรียมตาราง...</span></div>`;
  setTimeout((() => {
    window.syncTeamOrder();
    window.applyDutyRoleUI();
    window.renderDutyAccessTable();
    window.renderDutyRequirements();
    window.refreshDutyData();
  }), 50);
};

function getDutySaveKey(date, shift) {
  return `duty_roster_${currentDutyDept}_${date}_${shift}`;
}

window.currentDutyLeaveData = [];

window.refreshDutyData = async function() {
  try {
    window.ensureImportantTasksContainer();
    const targetDateInput = document.getElementById('dutyDate');
    const shiftFilterInput = document.getElementById('dutyShiftSelect');
    if (!targetDateInput || !shiftFilterInput) return;
    const targetDate = targetDateInput.value;
    const shiftFilter = shiftFilterInput.value;
    if (!targetDate) return;
    const saveKey = getDutySaveKey(targetDate, shiftFilter);
    const impListKey = `duty_important_tasks_list_${currentDutyDept}_${shiftFilter}`;
    const impAssignKey = `duty_important_assign_${currentDutyDept}_${targetDate}_${shiftFilter}`;
    const impLockKey = `duty_important_permanent_lock_${currentDutyDept}_${shiftFilter}`;
    const impCfgKey = `duty_important_task_cfg_${currentDutyDept}_${shiftFilter}`;
    const stayPinKey = `duty_stay_pins_${currentDutyDept}`;
    const supportKey = `duty_support_${currentDutyDept}_${targetDate}_${shiftFilter}`;
    const mergeKey = window.dutyMergeKey(targetDate, shiftFilter, currentDutyDept);
    const mergeKeyOld = window.dutyMergeKeyLegacy(targetDate, shiftFilter);
    const webGroupKey = 'break_web_groups';
    const backupKey = `backup_${saveKey}`;
    const taskDayStart = `${targetDate}T00:00:00+07:00`;
    const taskDayEnd = `${targetDate}T23:59:59+07:00`;
    const [leavesRes, schedulesRes, settingsRes, swapRes] = await Promise.all([ appDB.from('leave_requests').select('user_id, reason, user_name').eq('leave_date', targetDate), appDB.from('schedules').select('staff_name, time_slot').eq('work_date', targetDate).eq('shift_name', shiftFilter), appDB.from('settings').select('value, key').in('key', [ saveKey, impListKey, impAssignKey, impLockKey, impCfgKey, stayPinKey, supportKey, mergeKey, mergeKeyOld, webGroupKey, backupKey ]), appDB.from('scheduled_tasks').select('payload, scheduled_for, status').eq('task_type', 'individual_shift_update').gte('scheduled_for', taskDayStart).lte('scheduled_for', taskDayEnd) ]);
    try {
      const _sig = JSON.stringify([ targetDate, shiftFilter, currentDutyDept, leavesRes && leavesRes.data, schedulesRes && schedulesRes.data, settingsRes && settingsRes.data, swapRes && swapRes.data ]);
      const _isPoll = window._dutyPollTick === true;
      window._dutyPollTick = false;
      if (_isPoll && window._dutyLastSig === _sig) return;
      window._dutyLastSig = _sig;
    } catch (e) {}
    window.currentDutyShiftToday = {};
    const swapToNightIds = new Set;
    (swapRes && swapRes.data ? swapRes.data : []).forEach((t => {
      let pl = t.payload;
      if (typeof pl === 'string') {
        try {
          pl = JSON.parse(pl);
        } catch (e) {
          pl = {};
        }
      }
      if (!pl || !pl.user_id) return;
      const uid = String(pl.user_id);
      if (pl.target_shift && pl.target_shift !== 'คงเดิม') {
        window.currentDutyShiftToday[uid] = pl.target_shift;
        if (pl.target_shift === 'กะดึก') swapToNightIds.add(uid);
      }
    }));
    const leaves = leavesRes && leavesRes.data;
    currentDutyLeaves = new Set;
    if (leaves) leaves.forEach((l => {
      const uid = String(l.user_id);
      if (l.reason === 'XX' && swapToNightIds.has(uid)) return;
      currentDutyLeaves.add(uid);
    }));
    window.currentDutySchedules = schedulesRes && schedulesRes.data ? schedulesRes.data : [];
    const relevantLeaves = [];
    if (leaves && typeof GLOBAL_USER_LIST !== 'undefined' && GLOBAL_USER_LIST.length > 0) {
      leaves.forEach((l => {
        if (l.reason === 'XX' && swapToNightIds.has(String(l.user_id))) return;
        let userObj = GLOBAL_USER_LIST.find((u => String(u.id) === String(l.user_id) || u.username === l.user_name));
        if (userObj) {
          let uDept = userObj.department || 'AM';
          if (uDept === 'TRAINER') uDept = 'AMQL';
          if (uDept === currentDutyDept) {
            relevantLeaves.push({
              user_id: userObj.id,
              username: userObj.username,
              reason: l.reason,
              originalShift: userObj.allowed_shift || 'all'
            });
          }
        }
      }));
    }
    window.currentDutyLeaveData = relevantLeaves;
    window.renderDutyLeaveBox();
    if (typeof window.loadBreakMinRemainCfg === 'function') window.loadBreakMinRemainCfg();
    if (typeof window.updateDutyStats === 'function') window.updateDutyStats();
    let savedRoster = null;
    window.globalImportantTasks = [];
    window.currentImportantAssigns = {};
    window.lockedImportantTasks = {};
    window.importantTaskCfg = {};
    window.dutyStayPins = {};
    window.currentSupportData = {};
    window.savedMergeRooms = [];
    try {
      const data = settingsRes && settingsRes.data;
      const wgRow = data ? data.find((d => d.key === webGroupKey)) : null;
      try {
        window._breakWebGroups = wgRow && wgRow.value ? JSON.parse(wgRow.value) : {};
      } catch (e) {
        window._breakWebGroups = {};
      }
      const mergeRow = data ? data.find((d => d.key === mergeKey)) || data.find((d => d.key === mergeKeyOld)) : null;
      if (mergeRow && mergeRow.value) {
        try {
          const m = JSON.parse(mergeRow.value);
          window.savedMergeRooms = Array.isArray(m) ? m : [];
        } catch (e) {}
      } else {
        const legacy = window.safeGetItem(mergeKey, null);
        if (legacy) {
          try {
            const m = JSON.parse(legacy);
            if (Array.isArray(m) && m.length > 0) {
              window.savedMergeRooms = m;
              window.clearSettingCache();
              appDB.from('settings').upsert([ {
                key: mergeKey,
                value: legacy
              } ]).then((() => {
                try {
                  localStorage.removeItem(mergeKey);
                } catch (e) {}
              }), (() => {}));
            }
          } catch (e) {}
        }
      }
      if (data && data.length > 0) {
        const rosterRow = data.find((d => d.key === saveKey));
        if (rosterRow && rosterRow.value) savedRoster = rosterRow;
        const listRow = data.find((d => d.key === impListKey));
        if (listRow && listRow.value) window.globalImportantTasks = JSON.parse(listRow.value);
        const assignRow = data.find((d => d.key === impAssignKey));
        if (assignRow && assignRow.value) window.currentImportantAssigns = JSON.parse(assignRow.value);
        if (typeof window.impNormMap === 'function') window.currentImportantAssigns = window.impNormMap(window.currentImportantAssigns);
        const cfgRow = data.find((d => d.key === impCfgKey));
        if (cfgRow && cfgRow.value) {
          try {
            const c = JSON.parse(cfgRow.value);
            window.importantTaskCfg = c && !Array.isArray(c) ? c : {};
          } catch (e) {}
        }
        const lockRow = data.find((d => d.key === impLockKey));
        if (lockRow && lockRow.value) {
          let parsedLock = JSON.parse(lockRow.value);
          if (Array.isArray(parsedLock)) {
            window.lockedImportantTasks = {};
          } else {
            window.lockedImportantTasks = parsedLock || {};
          }
          if (typeof window.impNormMap === 'function') window.lockedImportantTasks = window.impNormMap(window.lockedImportantTasks);
        }
        const stayPinRow = data.find((d => d.key === stayPinKey));
        if (stayPinRow && stayPinRow.value) {
          try {
            const parsedPins = JSON.parse(stayPinRow.value);
            window.dutyStayPins = parsedPins && !Array.isArray(parsedPins) ? parsedPins : {};
            window.prunePins(window.dutyStayPins);
          } catch (e) {
            window.dutyStayPins = {};
          }
        }
        const supportRow = data.find((d => d.key === supportKey));
        if (supportRow && supportRow.value) {
          try {
            const parsed = JSON.parse(supportRow.value);
            window.currentSupportData = parsed && !Array.isArray(parsed) ? window.normalizeSupportData(parsed) : {};
          } catch (e) {
            window.currentSupportData = {};
          }
        }
      }
      let needSave = false;
      const t = new Date;
      const todayStr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
      if (targetDate >= todayStr) {
        if (typeof window.impApplyLocks === 'function' && window.impApplyLocks()) needSave = true;
      }
      if (needSave && targetDate) {
        appDB.from('settings').upsert([ {
          key: impAssignKey,
          value: JSON.stringify(window.currentImportantAssigns)
        } ]);
      }
    } catch (e) {
      console.log(e);
    }
    window.renderImportantTasksPanel();
    const btnGen = document.getElementById('btnGenerateRoster');
    const grid = document.getElementById('dutyResultGrid');
    const matrixGrid = document.getElementById('dutyMatrixGrid');
    if (savedRoster && savedRoster.value) {
      const parsedRoster = JSON.parse(savedRoster.value);
      window.isRosterPreview = false;
      Promise.resolve(window.renderRosterGrid(parsedRoster)).catch((err => {
        console.error('[duty] วาดตารางไม่สำเร็จ:', err);
        if (grid) grid.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center py-16 text-red-400"><span class="material-icons text-5xl mb-2">error_outline</span><span class="font-bold">โหลดตารางวันนี้ไม่สำเร็จ</span><span class="text-xs opacity-80 mt-1">${String(err && err.message || err)}</span><span class="text-[11px] opacity-60 mt-2">ข้อมูลยังอยู่ในระบบ ลองรีเฟรชหน้า หรือส่งข้อความนี้ให้ผู้ดูแล</span></div>`;
      }));
      if (btnGen) {
        btnGen.disabled = true;
        btnGen.innerHTML = '<span class="material-icons text-base">lock</span> จัดแล้ว (ต้องล้างก่อน)';
        btnGen.classList.replace('bg-indigo-600', 'bg-gray-500');
        btnGen.classList.replace('hover:bg-indigo-700', 'hover:bg-gray-600');
      }
    } else {
      const preview = window.canManageStayPin() ? window.buildStayPinPreview(targetDate, shiftFilter) : {
        roster: {},
        count: 0
      };
      if (preview.count > 0) {
        window.isRosterPreview = true;
        window.renderRosterGrid(preview.roster);
      } else {
        window.isRosterPreview = false;
        if (grid) grid.innerHTML = '<div class="col-span-full flex flex-col items-center justify-center py-20 text-gray-400 opacity-50"><span class="material-icons text-6xl mb-2">event_busy</span><span class="font-bold text-lg">ยังไม่มีการจัดเวรในกะนี้</span></div>';
        if (matrixGrid) matrixGrid.innerHTML = '<div class="flex flex-col items-center justify-center py-20 text-gray-400 opacity-50 h-full"><span class="material-icons text-6xl mb-2">event_busy</span><span class="font-bold text-lg">ยังไม่มีการจัดเวรในกะนี้</span></div>';
      }
      if (btnGen) {
        btnGen.disabled = false;
        btnGen.innerHTML = '<span class="material-icons text-base">casino</span> สุ่มจัดหน้าที่';
        btnGen.classList.replace('bg-gray-500', 'bg-indigo-600');
        btnGen.classList.replace('hover:bg-gray-600', 'hover:bg-indigo-700');
      }
    }
    if (currentDutyDept === 'AM' && typeof window.renderHelpCalcPanel === 'function') {
      window.renderHelpCalcPanel();
    }
    const backupRow = settingsRes && settingsRes.data ? settingsRes.data.find((d => d.key === backupKey)) : null;
    const backupData = backupRow && backupRow.value || window.safeGetItem(backupKey, null);
    const btnRestore = document.getElementById('btnRestoreRoster');
    if (btnRestore) {
      if (backupData && (!savedRoster || !savedRoster.value)) btnRestore.classList.remove('hidden'); else btnRestore.classList.add('hidden');
    }
    if (window.isDutyAdmin()) window.updateDutyStats();
    window.updateStayPinButton();
  } catch (err) {
    console.error("Refresh Duty Data Error:", err);
  }
};

window.renderDutyLeaveBox = function() {
  const leaveContainer = document.getElementById('dutyLeaveList');
  const leaveBadge = document.getElementById('leaveCountBadge');
  if (!leaveContainer) return;
  const shiftFilterEl = document.getElementById('dutyLeaveShiftFilter');
  const typeFilterEl = document.getElementById('dutyLeaveTypeFilter');
  const shiftFilter = shiftFilterEl ? shiftFilterEl.value : 'all';
  const typeFilter = typeFilterEl ? typeFilterEl.value : 'all';
  let filteredLeaves = [ ...window.currentDutyLeaveData ];
  if (shiftFilter !== 'all') {
    if (shiftFilter === 'all_shift') filteredLeaves = filteredLeaves.filter((l => l.originalShift === 'all')); else filteredLeaves = filteredLeaves.filter((l => l.originalShift === shiftFilter));
  }
  if (typeFilter !== 'all') {
    filteredLeaves = filteredLeaves.filter((l => {
      const rsn = l.reason || 'X';
      if (typeFilter === 'X') return rsn === 'X' || rsn === 'Table-Booking';
      if (typeFilter === 'TL') return rsn === 'TL' || rsn === 'TX';
      return rsn === typeFilter;
    }));
  }
  leaveBadge.innerText = filteredLeaves.length;
  const LV_META = [ {
    key: 'X',
    label: 'หยุดปกติ',
    color: '#ef4444',
    match: r => r === 'X' || r === 'Table-Booking'
  }, {
    key: 'XX',
    label: 'เปลี่ยนกะ',
    color: '#eab308',
    match: r => r === 'XX'
  }, {
    key: 'X4',
    label: 'ลาครึ่งวัน',
    color: '#ec4899',
    match: r => r === 'X4'
  }, {
    key: 'KL',
    label: 'ลากิจ',
    color: '#22c55e',
    match: r => r === 'KL'
  }, {
    key: 'TL',
    label: 'สลับวันหยุด',
    color: '#3b82f6',
    match: r => r === 'TL' || r === 'TX'
  }, {
    key: 'PN',
    label: 'พักร้อน',
    color: '#d97706',
    match: r => r === 'PN'
  } ];
  if (filteredLeaves.length === 0) {
    leaveContainer.innerHTML = `<div class="lv-empty">ไม่มีคนลาตามตัวกรองนี้</div>`;
    return;
  }
  const used = new Set;
  let leaveHtml = '';
  const rowOf = (l, color) => {
    const sh = l.originalShift && l.originalShift !== '?' ? l.originalShift === 'all' ? 'อิสระ' : String(l.originalShift).replace('กะ', '') : '';
    return `<div class="lv-row" style="--c:${color}" onclick="restoreFromLeave('${l.user_id}', '${window.escapeJsAttr(l.username)}')" title="คลิกเพื่อดึงกลับมาทำงาน">\n            <b>${window.escapeHtml(l.username)}</b>${sh ? `<span class="lv-sh">${sh}</span>` : ''}<span class="lv-back"><span class="material-icons">settings_backup_restore</span>ดึงกลับ</span>\n        </div>`;
  };
  LV_META.forEach((m => {
    const list = filteredLeaves.filter((l => m.match(l.reason || 'X'))).sort(((a, b) => a.username.localeCompare(b.username)));
    if (!list.length) return;
    list.forEach((l => used.add(l)));
    leaveHtml += `<div class="lv-grp"><div class="lv-gh" style="--c:${m.color}"><i></i>${m.label}<span>${list.length}</span></div>${list.map((l => rowOf(l, m.color))).join('')}</div>`;
  }));
  const others = filteredLeaves.filter((l => !used.has(l))).sort(((a, b) => a.username.localeCompare(b.username)));
  if (others.length) leaveHtml += `<div class="lv-grp"><div class="lv-gh" style="--c:#64748b"><i></i>อื่นๆ<span>${others.length}</span></div>${others.map((l => rowOf(l, '#64748b'))).join('')}</div>`;
  leaveContainer.innerHTML = leaveHtml;
};

window.restoreFromLeave = async function(userId, username) {
  const canRestore = window.isDutyAdmin();
  if (!canRestore) {
    return Swal.fire({
      icon: 'error',
      title: 'ไม่มีสิทธิ์ทำรายการ',
      text: 'เฉพาะ Admin, Manager และ Trainer เท่านั้น ที่สามารถดึงพนักงานกลับมาทำงานได้ครับ!',
      confirmButtonColor: '#d33',
      customClass: {
        popup: 'dark:bg-slate-800 dark:text-white rounded-3xl'
      }
    });
  }
  let optionsHtml = '<option value="" disabled selected>-- เลือกเว็บที่จะให้ไปทำ --</option>';
  sortedTeams.forEach((t => {
    optionsHtml += `<option value="${t}">${t}</option>`;
  }));
  const {value: selectedTeam} = await Swal.fire({
    title: `<div class="text-xl font-black text-blue-500 mt-2">ดึงพนักงานกลับมาทำงาน</div>`,
    html: `\n            <div class="mb-4 text-sm text-gray-500 dark:text-gray-400">ดึง <b class="text-slate-800 dark:text-white text-lg">${username}</b> ออกจากช่องลาหยุด<br>ต้องการให้ไปลงหน้าที่เว็บไหนครับ?</div>\n            <select id="swal-restore-team" class="w-full p-3.5 rounded-xl border border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500 shadow-inner cursor-pointer text-sm transition">\n                ${optionsHtml}\n            </select>\n        `,
    showCancelButton: true,
    confirmButtonColor: '#3b82f6',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'ยืนยัน (ดึงกลับ)',
    cancelButtonText: 'ยกเลิก',
    customClass: {
      popup: 'dark:bg-slate-800 dark:text-white rounded-3xl border border-slate-700 shadow-2xl'
    },
    preConfirm: () => {
      const select = document.getElementById('swal-restore-team');
      if (!select.value) {
        Swal.showValidationMessage('กรุณาเลือกเว็บด้วยครับ!');
        return false;
      }
      return select.value;
    }
  });
  if (selectedTeam) {
    Swal.fire({
      title: 'กำลังย้ายข้อมูล...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });
    try {
      const targetDate = document.getElementById('dutyDate').value;
      const shiftFilter = document.getElementById('dutyShiftSelect').value;
      window.dutyDbOk(await appDB.from('leave_requests').delete().eq('user_id', userId).eq('leave_date', targetDate));
      const fullUserObj = GLOBAL_USER_LIST.find((u => String(u.id) === String(userId)));
      if (fullUserObj) {
        if (!currentRosterData[selectedTeam]) currentRosterData[selectedTeam] = [];
        const movedFrom = window.dutyRemoveFromOtherTeams(currentRosterData, userId, selectedTeam);
        const isExist = currentRosterData[selectedTeam].some((u => String(u.id) === String(userId)));
        if (!isExist) currentRosterData[selectedTeam].push({
          ...fullUserObj,
          assigned_by: currentUser.username,
          assigned_at: (new Date).toISOString()
        });
        const saveKey = getDutySaveKey(targetDate, shiftFilter);
        if (typeof window.dutyDedupeRoster === "function") window.dutyDedupeRoster(currentRosterData);
        window.clearSettingCache();
        window.dutyDbOk(await appDB.from('settings').upsert([ {
          key: saveKey,
          value: JSON.stringify(currentRosterData)
        } ]));
      }
      await appDB.from('system_logs').insert([ {
        action_type: 'ย้ายหน้าที่',
        performed_by: currentUser.username,
        target_details: `ดึง ${username} กลับจากการลา ไปใส่เว็บ [${selectedTeam}] วันที่: ${targetDate}`
      } ]);
      window.debouncedBroadcast('duty-updates', 'force_reload');
      await window.refreshDutyData();
      Swal.fire({
        icon: 'success',
        title: 'ดึงกลับสำเร็จ!',
        text: `${movedFrom.length ? 'ย้ายจาก ' + movedFrom.join(', ') + ' — ' : ''}${username} ไปอยู่เว็บ ${selectedTeam} แล้ว`,
        timer: 1500,
        showConfirmButton: false
      });
    } catch (err) {
      Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
    }
  }
};

window.saveRotationGap = async function(v) {
  const n = Math.max(0, Math.min(30, parseInt(v) || 0));
  const dept = currentDutyDept || 'AM';
  try {
    let cfg = {};
    try {
      const raw = typeof SETTINGS !== 'undefined' ? SETTINGS.duty_rotation_gap : null;
      const parsed = raw ? typeof raw === 'string' ? JSON.parse(raw) : raw : {};
      if (parsed && typeof parsed === 'object') cfg = parsed; else if (!isNaN(parseInt(parsed))) {
        const L = parseInt(parsed);
        cfg = {
          AM: L,
          OD: L,
          AMQL: L,
          ODQL: L
        };
      }
    } catch (e) {
      cfg = {};
    }
    cfg[dept] = n;
    const val = JSON.stringify(cfg);
    await appDB.from('settings').upsert([ {
      key: 'duty_rotation_gap',
      value: val
    } ]);
    if (typeof SETTINGS !== 'undefined') SETTINGS.duty_rotation_gap = val;
    try {
      window._ydRosterCache = null;
      if (typeof window.renderRosterGrid === 'function' && typeof currentRosterData !== 'undefined' && currentRosterData) window.renderRosterGrid(currentRosterData);
    } catch (e) {}
    const depLabel = dept === 'AMQL' ? 'ผู้สอน AM' : dept === 'ODQL' ? 'ผู้สอน OD' : dept;
    Swal.fire({
      icon: 'success',
      title: n > 0 ? `${depLabel}: เว้น ${n} วันก่อนกลับเว็บเดิม` : `${depLabel}: ปิดการเว้นวันแล้ว`,
      text: n > 0 ? 'ค่านี้ใช้เฉพาะแผนกนี้ แผนกอื่นไม่กระทบ' : '',
      timer: 2e3,
      showConfirmButton: false
    });
  } catch (e) {
    Swal.fire('บันทึกไม่สำเร็จ', e.message, 'error');
  }
};

window.fillRotationGapInput = function() {
  const el = document.getElementById('rotGapInput');
  if (!el) return;
  el.value = typeof window.getRotationGapDays === 'function' ? window.getRotationGapDays(currentDutyDept) : 3;
  const depLabel = currentDutyDept === 'AMQL' ? 'ผู้สอน AM' : currentDutyDept === 'ODQL' ? 'ผู้สอน OD' : currentDutyDept;
  const box = el.closest('div');
  if (box) box.title = `เว้นซ้ำเว็บของแผนก ${depLabel} — ทำเว็บนี้แล้วต้องเว้นกี่วันถึงกลับมาได้อีก (แต่ละแผนกตั้งแยกกัน)`;
  const tag = document.getElementById('rotGapDept');
  if (tag) tag.textContent = depLabel;
};

window.addStaffToRoster = async function() {
  if (window.blockIfPreview()) return;
  if (typeof fetchUsers === 'function') {
    try {
      await fetchUsers();
    } catch (e) {}
  }
  const targetDate = document.getElementById('dutyDate').value;
  const shiftFilter = document.getElementById('dutyShiftSelect').value;
  if (!targetDate) return Swal.fire('!', 'กรุณาเลือกวันที่ก่อน', 'warning');
  if (typeof GLOBAL_USER_LIST === 'undefined' || !GLOBAL_USER_LIST || GLOBAL_USER_LIST.length === 0) {
    return Swal.fire('!', 'ยังโหลดรายชื่อพนักงานไม่เสร็จ กรุณารอสักครู่แล้วลองใหม่', 'warning');
  }
  const alreadyAssignedIds = new Set;
  for (const team in currentRosterData) {
    (currentRosterData[team] || []).forEach((u => {
      if (u && u.id) alreadyAssignedIds.add(String(u.id));
    }));
  }
  const candidates = GLOBAL_USER_LIST.filter((u => {
    if (!u || !u.username) return false;
    if (alreadyAssignedIds.has(String(u.id))) return false;
    if (currentDutyLeaves && currentDutyLeaves.has(String(u.id))) return false;
    const role = (u.role || 'staff').toLowerCase();
    if ([ 'admin', 'manager' ].includes(role)) return false;
    let uDept = u.department || 'AM';
    if (uDept === 'TRAINER') uDept = 'AMQL';
    if (uDept !== currentDutyDept) return false;
    if (!window.isDutyShiftMatch(u, shiftFilter)) return false;
    return true;
  })).sort(((a, b) => a.username.localeCompare(b.username, 'th')));
  const candidatesAll = GLOBAL_USER_LIST.filter((u => {
    if (!u || !u.username) return false;
    if (alreadyAssignedIds.has(String(u.id))) return false;
    if (currentDutyLeaves && currentDutyLeaves.has(String(u.id))) return false;
    const role = (u.role || 'staff').toLowerCase();
    if ([ 'admin', 'manager' ].includes(role)) return false;
    let uDept = u.department || 'AM';
    if (uDept === 'TRAINER') uDept = 'AMQL';
    if (uDept !== currentDutyDept) return false;
    return true;
  })).sort(((a, b) => a.username.localeCompare(b.username, 'th')));
  if (candidates.length === 0 && candidatesAll.length === 0) {
    return Swal.fire({
      icon: 'info',
      title: 'ไม่มีพนักงานให้เพิ่ม',
      html: `ไม่พบพนักงานที่:<br>• แผนก <b>${currentDutyDept}</b><br>• กะ <b>${shiftFilter}</b><br>• ยังไม่อยู่ในตาราง / ไม่ลาหยุด`,
      customClass: {
        popup: 'dark:bg-slate-800 dark:text-white rounded-3xl'
      }
    });
  }
  const teamChoices = sortedTeams && sortedTeams.length ? [ ...sortedTeams ] : typeof TEAM_LIST !== 'undefined' ? [ ...TEAM_LIST ] : Object.keys(currentRosterData);
  if (teamChoices.length === 0) {
    return Swal.fire('!', 'ไม่มีรายชื่อเว็บ/ทีมในระบบ', 'warning');
  }
  const _optOf = list => {
    let h = '<option value="" disabled selected>-- เลือกพนักงาน --</option>';
    list.forEach((u => {
      const shiftTag = u.allowed_shift && u.allowed_shift !== 'all' ? ` [${u.allowed_shift.replace('กะ', '')}]` : ' [อิสระ]';
      h += `<option value="${u.id}">${window.escapeHtml(u.username)}${shiftTag}</option>`;
    }));
    return h;
  };
  const userOptionsHtml = _optOf(candidates);
  window._pullStaffOpts = {
    match: userOptionsHtml,
    all: _optOf(candidatesAll)
  };
  let teamOptionsHtml = '<option value="" disabled selected>-- เลือกเว็บหลัก --</option>';
  let subOptionsHtml = '<option value="">— ไม่ใส่เว็บรอง —</option>';
  teamChoices.forEach((t => {
    const cnt = (currentRosterData[t] || []).length;
    teamOptionsHtml += `<option value="${t}">${t} (${cnt} คน)</option>`;
    subOptionsHtml += `<option value="${t}">${t}</option>`;
  }));
  const result = await Swal.fire({
    title: `<div class="text-xl font-black text-emerald-500 mt-2">🫳 ดึงคนเข้างาน</div>`,
    html: `\n            <div class="text-left text-xs text-gray-500 dark:text-gray-400 mb-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-2.5 rounded-lg">\n                <span class="material-icons text-[14px] align-middle text-emerald-500">info</span>\n                <span class="align-middle">วันที่: <b class="text-slate-800 dark:text-white">${targetDate}</b> | กะ: <b class="text-slate-800 dark:text-white">${shiftFilter}</b> | แผนก: <b class="text-slate-800 dark:text-white">${currentDutyDept}</b></span>\n            </div>\n            <div class="text-left mb-1 flex items-center justify-between">\n                <label class="text-xs font-bold text-gray-600 dark:text-gray-300">พนักงาน (ที่ยังไม่อยู่ในตาราง):</label>\n                <label class="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-amber-500 select-none">\n                    <input type="checkbox" id="swal-add-allshift" class="w-3.5 h-3.5 accent-amber-500 cursor-pointer"\n                        onchange="document.getElementById('swal-add-user').innerHTML = this.checked ? window._pullStaffOpts.all : window._pullStaffOpts.match">\n                    รวมทุกกะ (โยกกลางคัน)\n                </label>\n            </div>\n            <select id="swal-add-user" class="w-full p-3 rounded-xl border border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-white font-bold outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer text-sm mb-3">\n                ${userOptionsHtml}\n            </select>\n            <div class="text-left mb-2"><label class="text-xs font-bold text-gray-600 dark:text-gray-300">เว็บหลัก:</label></div>\n            <select id="swal-add-team" class="w-full p-3 rounded-xl border border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-white font-bold outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer text-sm mb-3">\n                ${teamOptionsHtml}\n            </select>\n            <div class="text-left mb-2"><label class="text-xs font-bold text-gray-600 dark:text-gray-300">เว็บรอง <span class="text-gray-400 font-normal">(ไม่บังคับ)</span>:</label></div>\n            <select id="swal-add-subteam" class="w-full p-3 rounded-xl border border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-white font-bold outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer text-sm">\n                ${subOptionsHtml}\n            </select>\n        `,
    showCancelButton: true,
    confirmButtonColor: '#10b981',
    cancelButtonColor: '#64748b',
    confirmButtonText: '🫳 ดึงเข้างานเลย',
    cancelButtonText: 'ยกเลิก',
    customClass: {
      popup: 'dark:bg-slate-800 dark:text-white rounded-3xl border border-slate-700 shadow-2xl'
    },
    preConfirm: () => {
      const userId = document.getElementById('swal-add-user').value;
      const team = document.getElementById('swal-add-team').value;
      const subTeam = document.getElementById('swal-add-subteam').value || '';
      if (!userId) {
        Swal.showValidationMessage('กรุณาเลือกพนักงาน');
        return false;
      }
      if (!team) {
        Swal.showValidationMessage('กรุณาเลือกเว็บหลัก');
        return false;
      }
      if (subTeam && subTeam === team) {
        Swal.showValidationMessage('เว็บรองต้องไม่ซ้ำกับเว็บหลัก');
        return false;
      }
      return {
        userId: userId,
        team: team,
        subTeam: subTeam
      };
    }
  });
  if (!result.isConfirmed || !result.value) return;
  const {userId: userId, team: team, subTeam: subTeam} = result.value;
  Swal.fire({
    title: 'กำลังเพิ่ม...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });
  try {
    const fullUserObj = GLOBAL_USER_LIST.find((u => String(u.id) === String(userId)));
    if (!fullUserObj) throw new Error('ไม่พบข้อมูลพนักงาน');
    if (!currentRosterData[team]) currentRosterData[team] = [];
    const isExist = currentRosterData[team].some((u => String(u.id) === String(userId)));
    if (isExist) {
      return Swal.fire('ซ้ำ!', `${fullUserObj.username} อยู่ในเว็บ ${team} อยู่แล้ว`, 'info');
    }
    const movedFrom2 = window.dutyRemoveFromOtherTeams(currentRosterData, userId, team);
    currentRosterData[team].push({
      ...fullUserObj,
      secondary_team: subTeam || null,
      assigned_by: currentUser.username,
      assigned_at: (new Date).toISOString()
    });
    const saveKey = getDutySaveKey(targetDate, shiftFilter);
    if (typeof window.dutyDedupeRoster === "function") window.dutyDedupeRoster(currentRosterData);
    window.clearSettingCache();
    const {error: _upsertErr} = window.dutyDbOk(await appDB.from('settings').upsert([ {
      key: saveKey,
      value: JSON.stringify(currentRosterData)
    } ]));
    if (_upsertErr) throw _upsertErr;
    await appDB.from('system_logs').insert([ {
      action_type: 'ย้ายหน้าที่',
      performed_by: currentUser.username,
      target_details: `ดึง ${fullUserObj.username} เข้างาน → หลัก [${team}]${subTeam ? ` + รอง [${subTeam}]` : ''} (${currentDutyDept}, ${shiftFilter}, ${targetDate})`
    } ]);
    try {
      window.debouncedBroadcast('duty-updates', 'force_reload');
    } catch (e) {}
    await window.refreshDutyData();
    Swal.fire({
      icon: 'success',
      title: 'เพิ่มสำเร็จ!',
      text: `${movedFrom2.length ? 'ย้ายจาก ' + movedFrom2.join(', ') + ' — ' : ''}${fullUserObj.username} → หลัก ${team}${subTeam ? ' + รอง ' + subTeam : ''} เรียบร้อย`,
      timer: 1500,
      showConfirmButton: false
    });
  } catch (err) {
    console.error('addStaffToRoster error:', err);
    Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
  }
};

window.dutyDedupeRoster = function(rosterData) {
  if (!rosterData || typeof rosterData !== "object") return {
    data: rosterData,
    removed: []
  };
  const best = {};
  Object.entries(rosterData).forEach((([team, list]) => {
    (list || []).forEach((u => {
      if (!u || !u.id) return;
      const id = String(u.id);
      const at = String(u.assigned_at || "");
      if (!best[id] || at >= best[id].at) best[id] = {
        team: team,
        at: at
      };
    }));
  }));
  const removed = [];
  Object.entries(rosterData).forEach((([team, list]) => {
    rosterData[team] = (list || []).filter((u => {
      if (!u || !u.id) return true;
      const id = String(u.id);
      if (best[id] && best[id].team !== team) {
        removed.push({
          username: u.username,
          from: team,
          keep: best[id].team
        });
        return false;
      }
      return true;
    }));
  }));
  if (removed.length) console.warn("[กันชื่อซ้ำ] ตัดออก", removed);
  return {
    data: rosterData,
    removed: removed
  };
};

window.dutyRemoveFromOtherTeams = function(rosterData, userId, keepTeam) {
  const removed = [];
  Object.keys(rosterData || {}).forEach((team => {
    if (team === keepTeam) return;
    const before = (rosterData[team] || []).length;
    rosterData[team] = (rosterData[team] || []).filter((u => !u || String(u.id) !== String(userId)));
    if (rosterData[team].length < before) removed.push(team);
  }));
  return removed;
};

window.clearDutyRoster = async function() {
  const targetDate = document.getElementById('dutyDate').value;
  const shiftFilter = document.getElementById('dutyShiftSelect').value;
  if (!targetDate) return Swal.fire('!', 'กรุณาเลือกวันที่ก่อน', 'warning');
  Swal.fire({
    title: 'ยืนยันการล้างตาราง?',
    text: `คุณต้องการลบตารางงานวันที่ ${targetDate} (${shiftFilter}) ใช่หรือไม่? (หน้าที่ประจำที่ล็อคไว้จะไม่หาย)`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    confirmButtonText: 'ล้างเลย',
    cancelButtonText: 'ยกเลิก'
  }).then((async result => {
    if (result.isConfirmed) {
      Swal.fire({
        title: 'กำลังล้างข้อมูล...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });
      const saveKey = getDutySaveKey(targetDate, shiftFilter);
      const reportKey = `report_${currentDutyDept}_${targetDate}_${shiftFilter}`;
      const impAssignKey = `duty_important_assign_${currentDutyDept}_${targetDate}_${shiftFilter}`;
      try {
        let currentDataVal = null;
        const {data: currentData} = await appDB.from('settings').select('value').eq('key', saveKey);
        if (currentData && currentData.length > 0) currentDataVal = currentData[0].value;
        if (currentDataVal) {
          window.safeSetItem(`backup_${saveKey}`, currentDataVal);
          window.dutyDbOk(await appDB.from('settings').upsert([ {
            key: `backup_${saveKey}`,
            value: currentDataVal
          } ]));
        }
        window.dutyDbOk(await appDB.from('settings').delete().eq('key', saveKey));
        const keysKept = Object.keys(window.lockedImportantTasks);
        keysKept.forEach((k => {
          if (!window.globalImportantTasks.includes(k)) delete window.currentImportantAssigns[k];
        }));
        let newAssigns = {};
        for (const [k, v] of Object.entries(window.lockedImportantTasks)) {
          if (window.globalImportantTasks.includes(k)) newAssigns[k] = v;
        }
        window.clearSettingCache();
        window.dutyDbOk(await appDB.from('settings').upsert([ {
          key: impAssignKey,
          value: JSON.stringify(newAssigns)
        } ]));
        if (window.isTrainerDept()) await appDB.from('settings').delete().eq('key', reportKey);
        await appDB.from('system_logs').insert([ {
          action_type: 'ล้างตารางงาน',
          performed_by: currentUser.username,
          target_details: `ล้างตาราง ${currentDutyDept} (${shiftFilter}, ${targetDate})`
        } ]);
        window.debouncedBroadcast('duty-updates', 'force_reload');
        Swal.fire({
          icon: 'success',
          title: 'ล้างตารางเรียบร้อย',
          showConfirmButton: false,
          timer: 1500
        });
        if (typeof window.refreshDutyData === 'function') window.refreshDutyData();
      } catch (e) {
        Swal.fire('Error', e.message, 'error');
      }
    }
  }));
};

window.generateDutyRoster = async function() {
  if (typeof fetchUsers === 'function') {
    try {
      await fetchUsers();
    } catch (e) {}
  }
  const targetDate = document.getElementById('dutyDate').value;
  const shiftFilter = document.getElementById('dutyShiftSelect').value;
  if (!targetDate) return Swal.fire('!', 'กรุณาเลือกวันที่ก่อน', 'warning');
  const saveKeyCheck = getDutySaveKey(targetDate, shiftFilter);
  let checkExistVal = null;
  try {
    const {data: checkExist} = await appDB.from('settings').select('value').eq('key', saveKeyCheck);
    if (checkExist && checkExist.length > 0) checkExistVal = checkExist[0].value;
  } catch (e) {}
  if (checkExistVal) {
    window.refreshDutyData();
    return Swal.fire('ป้องกันการจัดซ้ำ!', 'กะนี้มีการจัดหน้าที่ไปแล้ว กรุณากดปุ่ม "ล้างตาราง" ก่อนสุ่มใหม่ครับ', 'warning');
  }
  const activeStaff = window.getDutyActiveStaff(shiftFilter);
  let requiredCount = 0;
  document.querySelectorAll('.req-input').forEach((i => requiredCount += parseInt(i.value) || 0));
  if (activeStaff.length === 0) return Swal.fire('ข้อมูลไม่พอ', `ไม่มีพนักงานมาทำงานในกะนี้เลย (ลองเช็คสิทธิ์หรือรายชื่ออีกครั้ง)`, 'error');
  if (requiredCount === 0) {
    const ask = await Swal.fire({
      icon: 'question',
      title: 'ยังไม่ได้ระบุจำนวนคนต่อเว็บ',
      html: `ช่องจำนวนคนทุกเว็บเป็น <b>0</b> อยู่ ระบบจึงจัดใครลงเว็บไม่ได้<br><br>ให้ระบบ <b>คำนวณยอดคนออโต้</b> (${activeStaff.length} คน) แล้วจัดหน้าที่ต่อเลยไหมครับ?`,
      showCancelButton: true,
      confirmButtonText: '⚡ คำนวณออโต้แล้วจัดเลย',
      cancelButtonText: 'ยกเลิก ไปกรอกเอง'
    });
    if (!ask.isConfirmed) return;
    window.autoSuggestRequirements();
    requiredCount = 0;
    document.querySelectorAll('.req-input').forEach((i => requiredCount += parseInt(i.value) || 0));
    if (requiredCount === 0) return;
  }
  if (requiredCount > activeStaff.length) return Swal.fire('ขาดคน!', `คุณจัดงาน ${requiredCount} คน แต่มีคนว่างแค่ ${activeStaff.length} คน (กรุณาลดจำนวน)`, 'error');
  Swal.fire({
    title: 'กำลังจัดตารางหลัก...',
    text: 'ระบบกำลังจัดหน้าที่หลัก โดยจะยังไม่แจกงานรอง...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });
  try {
    const rotation = await window.loadDutyRotationHistory(targetDate, shiftFilter);
    const yestTeamMap = {};
    Object.entries(rotation.lastTeam).forEach((([uid, v]) => {
      yestTeamMap[uid] = v.team;
    }));
    const requirements = {};
    const reqsToSave = {};
    document.querySelectorAll('.req-input').forEach((input => {
      const team = input.id.replace('req_', '');
      const count = parseInt(input.value) || 0;
      requirements[team] = count;
      reqsToSave[input.id] = count;
    }));
    window.safeSetItem(`duty_reqs_${currentDutyDept}`, JSON.stringify(reqsToSave));
    let unassignedPool = [ ...activeStaff ];
    const rosterResult = {};
    sortedTeams.forEach((t => rosterResult[t] = []));
    let remainingReqs = {
      ...requirements
    };
    await window.loadStayPins();
    const pinnedPlaced = [];
    const pinnedIds = new Set;
    const pinnedSkipped = [];
    const pinnedOverQuota = [];
    Object.keys(window.dutyStayPins || {}).forEach((uid => {
      const pin = window.getActiveStayPin(uid, targetDate);
      if (!pin || !pin.team) return;
      if (!sortedTeams.includes(pin.team)) return;
      const u = unassignedPool.find((x => String(x.id) === String(uid)));
      if (!u) {
        pinnedSkipped.push({
          username: pin.username,
          team: pin.team
        });
        return;
      }
      if ((remainingReqs[pin.team] || 0) <= 0) pinnedOverQuota.push(`${window.escapeHtml(pin.username)} (${pin.team})`);
      rosterResult[pin.team].push({
        ...u,
        secondary_team: null,
        assigned_by: currentUser.username,
        assigned_at: (new Date).toISOString(),
        stay_pinned: true
      });
      remainingReqs[pin.team] = Math.max(0, (remainingReqs[pin.team] || 0) - 1);
      unassignedPool = unassignedPool.filter((x => String(x.id) !== String(uid)));
      pinnedPlaced.push(`${window.escapeHtml(pin.username)} → ${pin.team}`);
      pinnedIds.add(String(uid));
    }));
    const rotationStats = {
      fresh: 0,
      rotated: 0,
      repeated: 0,
      repeatedNames: []
    };
    while (true) {
      let teamsNeedingPeople = sortedTeams.filter((t => remainingReqs[t] > 0));
      if (teamsNeedingPeople.length === 0) break;
      let teamStats = teamsNeedingPeople.map((team => {
        const withAccess = unassignedPool.filter((u => (dutyAccessMatrix[String(u.id)] || []).includes(team)));
        let eligible = withAccess.filter((u => {
          const cycleLen = (dutyAccessMatrix[String(u.id)] || []).length;
          return window.dutyDaysAgoOnTeam(rotation, u.id, team) >= cycleLen;
        }));
        if (eligible.length === 0) {
          eligible = withAccess.filter((u => yestTeamMap[String(u.id)] !== team));
        }
        if (eligible.length === 0) {
          eligible = withAccess;
        }
        return {
          team: team,
          eligibleCount: eligible.length,
          eligibleUsers: eligible
        };
      }));
      teamStats.sort(((a, b) => a.eligibleCount - b.eligibleCount));
      let target = teamStats[0];
      let teamToFill = target.team;
      if (target.eligibleCount === 0) {
        rosterResult[teamToFill].push({
          username: 'ขาดคน (ไม่มีสิทธิ์)'
        });
        remainingReqs[teamToFill]--;
        continue;
      }
      let userOptions = target.eligibleUsers.map((u => {
        const uid = String(u.id);
        const access = dutyAccessMatrix[uid] || [];
        const viableTeamsCount = access.filter((t => remainingReqs[t] > 0)).length;
        return {
          user: u,
          flexibility: viableTeamsCount,
          access: access,
          daysAgo: window.dutyDaysAgoOnTeam(rotation, uid, teamToFill),
          timesOnTeam: rotation.counts[uid] && rotation.counts[uid][teamToFill] || 0
        };
      }));
      userOptions.sort(((a, b) => {
        if (a.daysAgo !== b.daysAgo) {
          if (a.daysAgo === Infinity) return -1;
          if (b.daysAgo === Infinity) return 1;
          return b.daysAgo - a.daysAgo;
        }
        if (a.timesOnTeam !== b.timesOnTeam) return a.timesOnTeam - b.timesOnTeam;
        if (a.flexibility !== b.flexibility) return a.flexibility - b.flexibility;
        return Math.random() - .5;
      }));
      const chosen = userOptions[0];
      let pickedUser = {
        ...chosen.user
      };
      pickedUser.secondary_team = null;
      pickedUser.assigned_by = currentUser.username;
      pickedUser.assigned_at = (new Date).toISOString();
      rosterResult[teamToFill].push(pickedUser);
      remainingReqs[teamToFill]--;
      unassignedPool = unassignedPool.filter((u => u.id !== pickedUser.id));
    }
    const lockedIds = pinnedIds;
    const repairSwaps = window.repairRosterRotation(rosterResult, rotation, lockedIds);
    Object.entries(rosterResult).forEach((([team, list]) => {
      (list || []).forEach((u => {
        if (!u || !u.id) return;
        if (lockedIds.has(String(u.id))) return;
        const ago = window.dutyDaysAgoOnTeam(rotation, u.id, team);
        const cycleLen = (dutyAccessMatrix[String(u.id)] || []).length;
        if (ago === Infinity) rotationStats.fresh++; else if (ago >= cycleLen) rotationStats.rotated++; else {
          rotationStats.repeated++;
          rotationStats.repeatedNames.push(`${window.escapeHtml(u.username)} → ${team} (เพิ่งทำเมื่อ ${ago} วันก่อน)`);
        }
      }));
    }));
    rotationStats.repairSwaps = repairSwaps;
    const saveKey = getDutySaveKey(targetDate, shiftFilter);
    if (typeof window.dutyDedupeRoster === "function") window.dutyDedupeRoster(rosterResult);
    window.clearSettingCache();
    const {error: _upsertErr2} = window.dutyDbOk(await appDB.from('settings').upsert([ {
      key: saveKey,
      value: JSON.stringify(rosterResult)
    } ]));
    if (_upsertErr2) throw _upsertErr2;
    if (currentDutyDept === 'OD') {
      try {
        const _rooms = window.getOdDiscordRooms();
        const _roomMap = window.assignOdRooms(rosterResult, _rooms);
        await appDB.from('settings').upsert([ {
          key: `duty_od_rooms_${targetDate}_${shiftFilter}`,
          value: JSON.stringify(_roomMap)
        } ]);
        window._odRoomCache = null;
      } catch (e) {
        console.warn('จัดห้องดิส OD ไม่สำเร็จ:', e);
      }
    }
    try {
      const summaryParts = [];
      let totalAssigned = 0;
      for (const team of Object.keys(rosterResult).sort(((a, b) => a.localeCompare(b)))) {
        const names = (rosterResult[team] || []).filter((u => !u.username.includes('ขาดคน'))).map((u => u.username));
        if (names.length > 0) {
          summaryParts.push(`[${team}] ${names.join(', ')}`);
          totalAssigned += names.length;
        }
      }
      const detailText = `จัดเวรแผนก ${currentDutyDept} (กะ: ${shiftFilter}, วันที่: ${targetDate}) — รวม ${totalAssigned} คน\n${summaryParts.join(' | ')}`;
      await appDB.from('system_logs').insert([ {
        action_type: 'สุ่มจัดหน้าที่',
        performed_by: currentUser.username,
        target_details: detailText
      } ]);
      if (appDB.channel) window.debouncedBroadcast('duty-updates', 'force_reload');
    } catch (logError) {}
    window.refreshDutyData();
    let pinSummary = '';
    const totalPicked = rotationStats.fresh + rotationStats.rotated + rotationStats.repeated;
    if (totalPicked > 0) {
      pinSummary += `<div style="margin-top:12px;text-align:left;background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.35);border-radius:12px;padding:10px 12px;font-size:12px;color:#047857">\n                <b>🔄 การหมุนเวียนเว็บ</b> <span style="font-size:10.5px;opacity:.75">(ดูประวัติย้อนหลัง ${rotation.lookback} วัน พบตาราง ${rotation.daysFound} วัน)</span><br>\n                • ได้เว็บที่ <b>ไม่เคยทำเลย</b> — ${rotationStats.fresh} คน<br>\n                • ได้เว็บที่ <b>วนครบรอบแล้ว</b> — ${rotationStats.rotated} คน\n                ${rotationStats.repeated > 0 ? `<br>• <span style="color:#b45309">ยังต้องทำซ้ำก่อนครบรอบ — ${rotationStats.repeated} คน</span>` : ''}\n                ${rotationStats.repairSwaps > 0 ? `<br><span style="font-size:10.5px;opacity:.8">🔧 ปรับสลับให้อีก ${rotationStats.repairSwaps} คู่ เพื่อลดการซ้ำเว็บ</span>` : ''}\n            </div>`;
    }
    if (rotationStats.repeated > 0) {
      pinSummary += `<div style="margin-top:8px;text-align:left;background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.3);border-radius:12px;padding:10px 12px;font-size:11px;color:#92400e;max-height:140px;overflow-y:auto">\n                คนที่ยังหมุนไม่ครบรอบ (เพราะสิทธิ์หลังบ้านจำกัด หรือคนไม่พอ):<br>${rotationStats.repeatedNames.join('<br>')}</div>`;
    }
    if (pinnedPlaced.length > 0) {
      pinSummary += `<div style="margin-top:12px;text-align:left;background:rgba(251,191,36,.12);border:1px solid rgba(251,191,36,.35);border-radius:12px;padding:10px 12px;font-size:12px;color:#b45309">\n                <b>📌 อยู่ต่อจากที่ล็อกไว้ ${pinnedPlaced.length} คน</b><br>${pinnedPlaced.join('<br>')}</div>`;
    }
    if (pinnedOverQuota.length > 0) {
      pinSummary += `<div style="margin-top:8px;text-align:left;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:12px;padding:10px 12px;font-size:11.5px;color:#b91c1c">\n                ⚠️ เว็บเหล่านี้มีคนล็อกไว้เกินโควตาที่ตั้ง — ยอดคนจะเกินที่ระบุ:<br><b>${pinnedOverQuota.join(', ')}</b></div>`;
    }
    if (pinnedSkipped.length > 0) {
      const lines = pinnedSkipped.map((s => {
        const newFaces = (rosterResult[s.team] || []).filter((u => u && u.id && yestTeamMap[String(u.id)] !== s.team)).map((u => u.username));
        return `• <b>${window.escapeHtml(s.username)}</b> (ล็อกไว้ที่ ${s.team}) → ` + (newFaces.length ? `วันนี้ <b>${s.team}</b> ได้ <b>${newFaces.join(', ')}</b> มาแทน` : `วันนี้ <b>${s.team}</b> ใช้คนเดิมทั้งหมด`);
      }));
      pinSummary += `<div style="margin-top:8px;text-align:left;background:rgba(148,163,184,.12);border:1px solid rgba(148,163,184,.3);border-radius:12px;padding:10px 12px;font-size:11.5px;color:var(--k-mute);line-height:1.8">\n                ℹ️ <b>คนที่ถูกล็อกแต่วันนี้ไม่ได้ทำงาน</b> (ลาหยุด / สลับกะ) — การล็อกยังอยู่ ใช้ต่อวันถัดไปได้<br>\n                ${lines.join('<br>')}\n                <div style="margin-top:6px;opacity:.8">คนที่มาแทนไม่ได้ถูกล็อกไว้ พรุ่งนี้จะหมุนตามปกติ ถ้าอยากให้อยู่ต่อให้กด 📌 เอง</div>\n            </div>`;
    }
    if (unassignedPool.length > 0) {
      const noAccess = unassignedPool.filter((u => !(dutyAccessMatrix[String(u.id)] || []).some((t => sortedTeams.includes(t)))));
      const quotaFull = unassignedPool.filter((u => !noAccess.includes(u)));
      let reasonHtml = '';
      if (quotaFull.length > 0) {
        reasonHtml += `<div style="margin-top:6px">มีสิทธิ์แต่<b>โควตาเว็บเต็ม</b> (ตั้งจำนวนรวม ${requiredCount} คน แต่มาทำ ${activeStaff.length} คน) <b>${quotaFull.length} คน</b>:<br><span class="text-amber-500 font-bold">${quotaFull.map((u => window.escapeHtml(u.username))).join(', ')}</span><br><span style="font-size:11px;opacity:.8">→ เพิ่มจำนวนคนต่อเว็บ หรือกด "คำนวณยอดคนออโต้" แล้วล้างตารางจัดใหม่</span></div>`;
      }
      if (noAccess.length > 0) {
        reasonHtml += `<div style="margin-top:6px">ไม่ได้ติ๊กสิทธิ์หลังบ้านเว็บไหนเลย <b>${noAccess.length} คน</b>:<br><span class="text-red-500 font-bold">${noAccess.map((u => window.escapeHtml(u.username))).join(', ')}</span></div>`;
      }
      Swal.fire({
        icon: 'warning',
        title: `จัดหลักสำเร็จ! (มีคนเหลือ)`,
        html: `เหลือพนักงานไม่ได้ลงเว็บ <b>${unassignedPool.length} คน</b>${reasonHtml}${pinSummary}`
      });
    } else if (pinSummary) {
      Swal.fire({
        icon: 'success',
        title: `จัดตำแหน่งหลักสำเร็จ!`,
        html: `กรุณากดปุ่มสายฟ้า (จัดตำแหน่งรองด่วน) เพื่อจับคู่เวลาพักครับ${pinSummary}`
      });
    } else {
      Swal.fire({
        icon: 'success',
        title: `จัดตำแหน่งหลักสำเร็จ!`,
        text: 'กรุณากดปุ่มสายฟ้า (จัดตำแหน่งรองด่วน) เพื่อจับคู่เวลาพักครับ',
        timer: 2500,
        showConfirmButton: false
      });
    }
  } catch (e) {
    Swal.fire('Error', e.message, 'error');
  }
};

window.renderRosterGrid = async function(rosterData) {
  const cardGrid = document.getElementById('dutyResultGrid');
  const matrixGrid = document.getElementById('dutyMatrixGrid');
  if (!cardGrid) return;
  if (currentDutyDept === 'ODQL' || currentDutyDept === 'TRAINER_OD') {
    cardGrid.classList.add('hidden');
    if (matrixGrid) matrixGrid.classList.remove('hidden');
    if (typeof window.renderTrainerOdMatrix === 'function') {
      window.renderTrainerOdMatrix(rosterData);
    }
    return;
  } else {
    cardGrid.classList.remove('hidden');
    if (matrixGrid) matrixGrid.classList.add('hidden');
  }
  cardGrid.innerHTML = '';
  let finalGridHtml = '';
  const _dmItems = [];
  const _me = typeof currentUser !== 'undefined' && currentUser ? currentUser : null;
  const _isMe = u => !!(_me && u && (u.id != null && _me.id != null && String(u.id) === String(_me.id) || u.username && _me.username && String(u.username).toLowerCase() === String(_me.username).toLowerCase()));
  currentRosterData = rosterData;
  const isAdmin = window.isDutyAdmin() && !window.isRosterPreview;
  if (window.isRosterPreview) {
    finalGridHtml += `\n        <div class="col-span-full bg-amber-50 dark:bg-amber-900/20 border-2 border-dashed border-amber-400 dark:border-amber-700 rounded-2xl p-3 flex items-center gap-3">\n            <span class="material-icons text-amber-500 text-2xl shrink-0">push_pin</span>\n            <div class="flex-1 min-w-0">\n                <div class="font-black text-sm text-amber-800 dark:text-amber-300">ภาพตัวอย่าง — ยังไม่ได้จัดเวรวันนี้</div>\n                <div class="text-[11px] text-amber-700 dark:text-amber-400/80 mt-0.5">\n                    ที่เห็นคือคนที่ถูกล็อก "อยู่ต่อ" ไว้ล่วงหน้า ยังไม่ได้บันทึกลงระบบ —\n                    กด <b>"สุ่มจัดหน้าที่"</b> เพื่อจัดคนที่เหลือให้ครบ แล้วชื่อเหล่านี้จะถูกวางที่เดิมให้อัตโนมัติ\n                </div>\n            </div>\n        </div>`;
  }
  let trainerReports = {};
  const targetDate = document.getElementById('dutyDate') ? document.getElementById('dutyDate').value : '';
  const shiftFilter = document.getElementById('dutyShiftSelect') ? document.getElementById('dutyShiftSelect').value : '';
  if (window.isTrainerDept() && targetDate) {
    const reportKey = `report_${currentDutyDept}_${targetDate}_${shiftFilter}`;
    try {
      let reportDataVal = null;
      const {data: reportData} = await appDB.from('settings').select('value').eq('key', reportKey);
      if (reportData && reportData.length > 0) reportDataVal = reportData[0].value;
      if (reportDataVal) trainerReports = JSON.parse(reportDataVal);
    } catch (e) {}
  }
  window.currentStandbyData = {};
  let standbyData = {};
  sortedTeams.forEach((t => standbyData[t] = []));
  for (const primaryTeam in rosterData) {
    if (!rosterData[primaryTeam]) continue;
    rosterData[primaryTeam].forEach((u => {
      if (u.secondary_team && sortedTeams.includes(u.secondary_team) && !u.username.includes('ขาดคน')) {
        standbyData[u.secondary_team].push({
          name: u.username,
          fromTeam: primaryTeam
        });
      }
    }));
  }
  window.currentStandbyData = standbyData;
  let odRoomOf = {};
  let odRoomIdx = {};
  {
    const _bt = document.getElementById('odRoomsBtn');
    if (_bt) _bt.style.display = currentDutyDept === 'OD' ? '' : 'none';
  }
  if (currentDutyDept === 'OD' && targetDate) {
    try {
      const _rk = `duty_od_rooms_${targetDate}_${shiftFilter}`;
      if (window._odRoomCache && window._odRoomCache.key === _rk) {
        odRoomOf = window._odRoomCache.map;
      } else {
        const {data: _rd} = await appDB.from('settings').select('value').eq('key', _rk).maybeSingle();
        if (_rd && _rd.value) odRoomOf = JSON.parse(_rd.value);
        window._odRoomCache = {
          key: _rk,
          map: odRoomOf
        };
      }
      window.getOdDiscordRooms().forEach(((r, i) => {
        odRoomIdx[r] = i;
      }));
      try {
        const _rooms = window.getOdDiscordRooms();
        if (_rooms.length) {
          const _load = {};
          _rooms.forEach((r => _load[r] = 0));
          const _cnt = t => (rosterData[t] || []).filter((u => u && u.username && !String(u.username).includes('ขาดคน'))).length;
          Object.keys(odRoomOf).forEach((t => {
            if (_load[odRoomOf[t]] !== undefined) _load[odRoomOf[t]] += _cnt(t);
          }));
          let _changed = false;
          sortedTeams.filter((t => _cnt(t) > 0 && !odRoomOf[t])).forEach((t => {
            const _best = _rooms.reduce(((a, b) => _load[b] < _load[a] ? b : a), _rooms[0]);
            odRoomOf[t] = _best;
            _load[_best] += _cnt(t);
            _changed = true;
          }));
          if (_changed) {
            window._odRoomCache = {
              key: _rk,
              map: odRoomOf
            };
            appDB.from('settings').upsert([ {
              key: _rk,
              value: JSON.stringify(odRoomOf)
            } ]).then((() => {}));
          }
        }
      } catch (e) {
        console.warn('[odRooms] เติมห้องให้เว็บที่ตกหล่นไม่สำเร็จ:', e);
      }
    } catch (e) {
      odRoomOf = {};
    }
  }
  const DUTY_HISTORY_DAYS = Math.max(1, Math.min(7, typeof window.getRotationGapDays === 'function' ? window.getRotationGapDays(currentDutyDept) || 1 : 3));
  const HIST_SHIFTS = [ 'กะเช้า', 'กะกลาง', 'กะดึก' ];
  let historyTeamOf = {};
  if (targetDate) {
    try {
      const histKeys = [], metaOf = {};
      for (let k = 1; k <= DUTY_HISTORY_DAYS; k++) {
        const dd = new Date(targetDate + 'T00:00:00');
        dd.setDate(dd.getDate() - k);
        const ds = `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}-${String(dd.getDate()).padStart(2, '0')}`;
        HIST_SHIFTS.forEach((sh => {
          const key = `duty_roster_${currentDutyDept}_${ds}_${sh}`;
          histKeys.push(key);
          metaOf[key] = {
            ago: k,
            shift: sh
          };
        }));
      }
      const cacheKey = histKeys.join('|');
      if (window._ydRosterCache && window._ydRosterCache.key === cacheKey) {
        historyTeamOf = window._ydRosterCache.map;
      } else {
        const {data: histData} = await appDB.from('settings').select('key, value').in('key', histKeys);
        const byDay = {};
        (histData || []).forEach((row => {
          const meta = metaOf[row.key];
          if (!meta) return;
          let roster = null;
          try {
            roster = JSON.parse(row.value);
          } catch (e) {
            return;
          }
          for (const t in roster) {
            (roster[t] || []).forEach((u => {
              if (!u || !u.username || String(u.username).includes('ขาดคน')) return;
              const slot = byDay[u.username] = byDay[u.username] || {};
              const cur = slot[meta.ago];
              if (!cur || cur.shift !== shiftFilter && meta.shift === shiftFilter) {
                slot[meta.ago] = {
                  ago: meta.ago,
                  shift: meta.shift,
                  main: t,
                  sec: u.secondary_team || null
                };
              }
            }));
          }
        }));
        Object.keys(byDay).forEach((n => {
          historyTeamOf[n] = Object.values(byDay[n]).sort(((a, b) => a.ago - b.ago));
        }));
        window._ydRosterCache = {
          key: cacheKey,
          map: historyTeamOf
        };
      }
    } catch (e) {
      console.error('โหลดตารางย้อนหลังไม่สำเร็จ:', e);
    }
  }
  sortedTeams.forEach((team => {
    const _pool = typeof window.getBreakWebPool === 'function' ? window.getBreakWebPool(currentDutyDept, team, (document.getElementById('dutyShiftSelect') || {}).value || '') : {
      members: [ team ],
      grouped: false
    };
    const _grpTeams = _pool.grouped ? sortedTeams.filter((t => _pool.members.includes(t))) : [ team ];
    if (_pool.grouped && _grpTeams.length > 1 && _grpTeams[0] !== team) return;
    const _isGrp = _grpTeams.length > 1;
    const _title = _grpTeams.join(' + ');
    let assignees = _grpTeams.flatMap((t => (rosterData[t] || []).filter((a => a && typeof a.username === 'string'))));
    if (window.isTrainerDept()) {}
    const rolesForThisTeam = [ ...new Set(_grpTeams.flatMap((t => customDutyRoles[t] || []))) ];
    const colorClass = TEAM_COLORS[team] || TEAM_COLORS['DEFAULT'];
    let rolesTags = rolesForThisTeam.map((r => `<span class="${colorClass.lightBg} ${colorClass.lightText} px-1.5 py-0.5 rounded text-[9px] mr-1 mb-1 font-bold inline-block border ${colorClass.border} opacity-90">${r}</span>`)).join('');
    let namesHtml = assignees.map((a => {
      const isMissing = a.username.includes('ขาดคน');
      const canDrag = !isMissing && a.id && isAdmin;
      const dragAttrs = canDrag ? `draggable="true" ondragstart="handleDragStart(event, '${a.id}', '${window.escapeJsAttr(a.username)}', '${team}')"` : '';
      const cursorClass = canDrag ? 'cursor-grab active:cursor-grabbing hover:shadow-md' : 'cursor-default';
      let breakTimeHtml = '';
      if (!isMissing) {
        const mySchedules = (window.currentDutySchedules || []).filter((s => s.staff_name === a.username));
        if (mySchedules && mySchedules.length > 0) {
          const slots = mySchedules.map((s => String(s.time_slot || ''))).join(',').split(',').map((x => x.trim())).filter(Boolean).sort(((t1, t2) => t1.localeCompare(t2)));
          breakTimeHtml = `<span class="dc-break" title="เวลาพัก: ${slots.join(', ')}"><span class="material-icons">restaurant</span>${slots.map((x => `<b>${x.replace(/\s/g, '')}</b>`)).join('')}</span>`;
        } else {
          breakTimeHtml = `<span class="dc-break none"><span class="material-icons">schedule</span>ยังไม่ลงเวลาพัก</span>`;
        }
      }
      let secHtml = '';
      if (a.secondary_team && !isMissing) {
        const sc2 = TEAM_COLORS[a.secondary_team] || TEAM_COLORS['DEFAULT'];
        const actionClick = isAdmin ? `onclick="event.stopPropagation(); changeSecondaryTeam('${team}', '${a.id}', '${window.escapeJsAttr(a.username)}')"` : '';
        secHtml = `<span ${actionClick} class="dc-sec ${isAdmin ? 'can' : ''}" title="${isAdmin ? 'งานรอง (สแตนด์บายช่วย) — คลิกเพื่อเปลี่ยน' : 'งานรองของคุณ: สแตนด์บายช่วยเว็บนี้'}">\n                    <span class="material-icons">transfer_within_a_station</span>รอง <b class="${sc2.bg} ${sc2.text}">${a.secondary_team}</b>${isAdmin ? '<span class="material-icons ed">edit</span>' : ''}</span>`;
      } else if (!isMissing && isAdmin) {
        secHtml = `<span onclick="event.stopPropagation(); changeSecondaryTeam('${team}', '${a.id}', '${window.escapeJsAttr(a.username)}')" class="dc-sec add" title="แจกงานรอง (สแตนด์บายช่วยเว็บอื่น)"><span class="material-icons">add</span>งานรอง</span>`;
      }
      const odTaskHtml = '';
      const stayPinHtml = isMissing ? '' : window.renderStayPinHtml(a, team, window.canManageStayPin());
      let supportHtml = '';
      if (!isMissing && a.id) {
        supportHtml = window.getSupportForUser(a.id).map((sup => {
          const c = TEAM_COLORS[sup.target] || TEAM_COLORS['DEFAULT'];
          return `<div title="ไปประจำเว็บ ${sup.target} ในช่วงเวลานี้"\n                        class="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-cyan-700 bg-cyan-50 dark:bg-cyan-900/30 dark:text-cyan-300 px-2.5 py-1 rounded-md border border-cyan-300 dark:border-cyan-800/50 w-fit shadow-sm">\n                        <span class="material-icons text-[14px]">support_agent</span>\n                        ช่วย <span class="${c.lightBg} ${c.lightText} px-1.5 rounded font-black">${sup.target}</span>\n                        ${minToTime(sup.start)}–${minToTime(sup.end)}\n                    </div>`;
        })).join('');
      }
      const histHtml = (() => {
        const hist = !isMissing ? historyTeamOf[a.username] || [] : [];
        if (!hist.length) return '';
        const agoLabel = n => n === 1 ? 'เมื่อวาน' : n + ' วันก่อน';
        const parts = hist.filter((h => h.main || h.sec)).map((h => {
          const mc = TEAM_COLORS[h.main] || TEAM_COLORS['DEFAULT'];
          const shDiff = h.shift && h.shift !== shiftFilter ? ` <i>${String(h.shift).replace('กะ', '')}</i>` : '';
          const sec = h.sec ? `<em title="งานรอง ${h.sec}">+รอง ${h.sec}</em>` : '';
          return `<span class="dc-h" title="${agoLabel(h.ago)} งานหลัก ${h.main || '-'}${h.sec ? ' · งานรอง ' + h.sec : ''}${h.shift && h.shift !== shiftFilter ? ' (' + h.shift + ')' : ''}"><small>${agoLabel(h.ago)}</small>${h.main ? `<span class="dc-dot ${mc.bg}"></span>${h.main}` : ''}${shDiff}${sec}</span>`;
        }));
        return parts.length ? `<div class="dc-hist"><span class="material-icons">history</span>${parts.join('')}</div>` : '';
      })();
      const nameTxt = window.escapeHtml(String(a.username).replace(/<[^>]*>/g, '').replace(/^\s*warning\s*/, '').trim());
      return `\n            <div class="duty-user-card dc-card ${isMissing ? 'missing' : ''} ${_isMe(a) ? 'me' : ''} group ${cursorClass}" data-name="${window.escapeHtml((a.username || '').toLowerCase())}" ${dragAttrs}>\n                <div class="dc-top">\n                    <span class="dc-st ${isMissing ? 'bad' : ''}"></span>\n                    <span class="dc-name">${nameTxt}</span>${_isMe(a) ? '<span class="dc-me">ฉัน</span>' : ''}\n                    ${secHtml}\n                </div>\n                ${isMissing ? '' : `<div class="dc-mid">${breakTimeHtml}${stayPinHtml}</div>`}\n                ${supportHtml}\n                ${histHtml}\n                ${odTaskHtml}\n            </div>`;
    })).join('');
    let trainerReportHtml = '';
    if (window.isTrainerDept()) {
      const tr = trainerReports[team] || {
        missed: 0,
        checker: '-',
        score: '-',
        mistakes: []
      };
      const scoreNum = parseInt(tr.score);
      let scoreColor = 'text-gray-500';
      if (scoreNum >= 8) scoreColor = 'text-green-600'; else if (scoreNum >= 5) scoreColor = 'text-amber-500'; else if (scoreNum > 0) scoreColor = 'text-red-600';
      const missedColor = parseInt(tr.missed) > 0 ? 'text-red-500 font-bold' : 'text-green-600';
      let behaviorHtml = '<span class="text-gray-400 mt-0.5 block">- ไม่มี -</span>';
      if (tr.mistakes && tr.mistakes.length > 0) {
        behaviorHtml = tr.mistakes.map((m => `\n                    <div class="mt-1 p-1.5 bg-red-50 dark:bg-red-900/30 rounded border border-red-100 dark:border-red-800 text-[10px]">\n                        <span class="font-bold text-red-600">${window.escapeHtml(m.empName)}</span>: <span class="text-slate-600 dark:text-slate-300">${window.escapeHtml(m.note || '-')}</span>\n                        <div class="flex gap-1 mt-1 overflow-x-auto">\n                            ${m.images && m.images.length > 0 ? m.images.map((img => `<img src="${img}" class="h-10 w-auto rounded shadow-sm border border-red-200 cursor-pointer" onclick="window.open('${img}','_blank')">`)).join('') : ''}\n                        </div>\n                    </div>\n                `)).join('');
      } else if (tr.bad_behavior && tr.bad_behavior !== '-') {
        behaviorHtml = `<span class="text-red-600 bg-red-50 p-1 rounded font-bold block mt-0.5 break-words">${tr.bad_behavior}</span>`;
      }
      const isTrainerStaff = currentUser.department === 'AMQL' || currentUser.department === 'ODQL' || currentUser.department && currentUser.department.startsWith('TRAINER');
      const btnLogData = isAdmin || isTrainerStaff ? `<button onclick="openTrainerReportModal('${team}')" class="text-[9px] bg-amber-500 hover:bg-amber-600 text-white px-2 py-0.5 rounded shadow transition font-bold border border-amber-600">📝 ประเมิน</button>` : '';
      trainerReportHtml = `\n            <div class="mt-2 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-700/50 p-2 flex flex-col gap-1.5 shrink-0">\n                <div class="flex justify-between items-center mb-1 border-b border-amber-200/50 pb-1">\n                    <span class="text-[10px] font-extrabold text-amber-800 dark:text-amber-400 flex items-center gap-1"><span class="material-icons text-[12px]">assignment</span> สรุปรายงานดูแลเว็บ</span>\n                    ${btnLogData}\n                </div>\n                <div class="text-[10px] text-slate-700 dark:text-slate-300 leading-tight bg-white dark:bg-slate-800 p-2 rounded border border-gray-200 dark:border-slate-600 space-y-1">\n                    <div class="flex justify-between border-b border-gray-100 dark:border-slate-700 pb-1">\n                        <span class="font-bold">👮 คนเช็คชื่อ:</span> <span class="text-blue-600 font-bold">${tr.checker || '-'}</span>\n                    </div>\n                    <div class="flex justify-between border-b border-gray-100 dark:border-slate-700 pb-1">\n                        <span class="font-bold">🚨 แชทหลุด:</span> <span class="${missedColor}">${tr.missed} แชท</span>\n                    </div>\n                    <div class="flex justify-between border-b border-gray-100 dark:border-slate-700 pb-1">\n                        <span class="font-bold">⭐ คะแนนรวม:</span> <span class="font-extrabold text-[12px] ${scoreColor}">${tr.score !== '-' ? tr.score + '/10' : '-'}</span>\n                    </div>\n                    <div class="pt-1">\n                        <span class="font-bold text-red-500 flex items-center">⚠️ พฤติกรรมไม่ดี:</span>\n                        ${behaviorHtml}\n                    </div>\n                </div>\n            </div>`;
    }
    const primaryCount = assignees.filter((u => !u.username.includes('ขาดคน'))).length;
    const standbyList = _grpTeams.flatMap((t => standbyData[t] || []));
    const standbyCount = standbyList.length;
    let breakWarnHtml = '';
    {
      const mainMembers = assignees.filter((u => u.id && !u.username.includes('ขาดคน'))).map((u => u.username));
      const secMembers = standbyList.map((s => s.name)).filter((n => n && !mainMembers.includes(n)));
      const allMembers = [ ...mainMembers, ...secMembers ];
      const shiftSel = document.getElementById('dutyShiftSelect');
      const raw = typeof window.getBreakMinRemainRaw === 'function' && shiftSel ? _grpTeams.reduce(((acc, t) => {
        const v = window.getBreakMinRemainRaw(currentDutyDept, shiftSel.value, t);
        return v === null ? acc : acc === null ? v : Math.max(acc, v);
      }), null) : null;
      const minRemain = raw === null ? 1 : raw;
      const cap = allMembers.length <= 1 ? allMembers.length : Math.max(0, allMembers.length - minRemain);
      const warnLines = [];
      if (allMembers.length >= 2) {
        const perSlot = {};
        (window.currentDutySchedules || []).forEach((sc => {
          if (!allMembers.includes(sc.staff_name)) return;
          String(sc.time_slot || '').split(',').map((x => x.trim())).filter(Boolean).forEach((slot => {
            (perSlot[slot] = perSlot[slot] || new Set).add(sc.staff_name);
          }));
        }));
        Object.entries(perSlot).filter((([, set]) => set.size > cap)).sort(((a, b) => a[0].localeCompare(b[0]))).forEach((([slot, set]) => warnLines.push(`<div class="ml-4 font-normal">[เหลือเฝ้าไม่พอ] ${slot} → พัก ${set.size}/${cap}: ${[ ...set ].join(', ')}</div>`)));
      }
      if (warnLines.length > 0) {
        breakWarnHtml = `<div class="mx-2 mt-2 bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg px-2 py-1.5 text-[10px] font-bold text-red-600 dark:text-red-300 shrink-0">\n                    <div class="flex items-center gap-1"><span class="material-icons text-[13px]">warning</span> พักพร้อมกันเกินเพดาน (หลัก ${mainMembers.length} + รอง ${secMembers.length} คน · พักพร้อมกันได้สูงสุด ${cap} คน)</div>\n                    ${warnLines.join('')}\n                </div>`;
      }
    }
    _dmItems.push({
      team: team,
      title: _title,
      color: colorClass,
      count: primaryCount,
      standby: standbyCount,
      warn: !!breakWarnHtml,
      missing: assignees.some((u => String(u.username).includes('ขาดคน'))) || primaryCount === 0,
      standbyNames: standbyList.map((x => x.name)),
      people: assignees.map((a => {
        const miss = String(a.username).includes('ขาดคน');
        const slots = miss ? [] : (window.currentDutySchedules || []).filter((sc => sc.staff_name === a.username)).map((sc => String(sc.time_slot || ''))).join(',').split(',').map((x => x.trim())).filter(Boolean).sort();
        const pin = !miss && a.id && typeof window.renderStayPinHtml === 'function' ? window.renderStayPinHtml(a, team, isAdmin) : '';
        const sup = !miss && a.id && typeof window.getSupportForUser === 'function' ? window.getSupportForUser(a.id).map((x => `ช่วย ${x.target} ${typeof minToTime === 'function' ? minToTime(x.start) + '–' + minToTime(x.end) : ''}`.trim())) : [];
        const histArr = (!miss ? historyTeamOf[a.username] || [] : []).filter((h => h.main || h.sec));
        const hist = histArr.map((h => `${h.ago === 1 ? 'เมื่อวาน' : h.ago + ' วันก่อน'} ${h.main || '-'}${h.sec ? ' (รอง ' + h.sec + ')' : ''}`)).join(' · ');
        const histHtml = histArr.map((h => {
          const mc = TEAM_COLORS[h.main] || TEAM_COLORS['DEFAULT'];
          return `<span class="ov-hi" title="${h.ago === 1 ? 'เมื่อวาน' : h.ago + ' วันก่อน'} ${h.main || '-'}${h.sec ? ' + รอง ' + h.sec : ''}"><small>${h.ago === 1 ? 'เมื่อวาน' : h.ago + ' วันก่อน'}</small><i class="ov-dot ${mc.bg}"></i>${h.main || '-'}${h.sec ? `<em>+รอง ${h.sec}</em>` : ''}</span>`;
        })).join('');
        return {
          id: a.id,
          name: String(a.username).replace(/<[^>]*>/g, '').trim(),
          miss: miss,
          slots: slots,
          sec: a.secondary_team || '',
          drag: !miss && a.id && isAdmin,
          me: _isMe(a),
          pin: pin,
          sup: sup,
          hist: hist,
          histHtml: histHtml
        };
      })),
      trainerBtn: window.isTrainerDept && window.isTrainerDept() && (isAdmin || currentUser && (currentUser.department === 'AMQL' || currentUser.department === 'ODQL' || String(currentUser.department || '').startsWith('TRAINER'))) ? `<button type="button" class="ov-trbtn" onclick="openTrainerReportModal('${team}')" title="บันทึกประเมินการดูแลเว็บนี้">📝 ประเมิน</button>` : ''
    });
    finalGridHtml += `\n            <div class="duty-site-card dc-site flex flex-col h-[500px] overflow-hidden w-full" data-team="${team}" style="--tc-border:currentColor">\n                <div class="dc-head ${colorClass.bg} ${colorClass.text}">\n                    <div class="dc-head-l">\n                        <h4 class="dc-team">${_title}</h4>\n                        ${_isGrp ? `<span class="dc-grp" title="สองเว็บนี้ถูกจับกลุ่มให้ทำงานรวมกัน">🔗 รวม ${_grpTeams.length} เว็บ</span>` : ''}\n                        ${(() => {
      const _room = odRoomOf[team];
      if (!_room) return '';
      return `<span class="dc-room" title="เข้าห้อง Discord: ${_room}"><span class="material-icons">headset_mic</span>${_room}</span>`;
    })()}\n                    </div>\n                    <div class="dc-head-r">\n                        <span class="dc-cnt" title="งานหลัก"><b>${primaryCount}</b> คน</span>\n                        <button onclick="viewStandbyList('${team}')" class="dc-cnt btn" title="คลิกดูรายชื่อสแตนด์บาย (งานรอง)">รอง <b>${standbyCount}</b></button>\n                    </div>\n                </div>\n                ${rolesTags ? `<div class="dc-roles">${rolesTags}</div>` : ''}\n                ${breakWarnHtml}\n                <div class="dc-list flex flex-col flex-1 overflow-y-auto custom-scrollbar content-start drop-zone" ondragover="handleDragOver(event)" ondrop="handleDrop(event, '${team}')">\n                    ${namesHtml || `\n                        <div class="flex flex-col items-center justify-center h-full py-6 pointer-events-none select-none opacity-40">\n                            <span class="material-icons text-3xl text-gray-400 mb-1">person_off</span>\n                            <span class="text-xs font-bold text-gray-400">ไม่มีพนักงาน</span>\n                            <span class="text-[10px] text-gray-400 mt-0.5">ลากคนมาวางได้เลย</span>\n                        </div>`}\n                </div>\n                ${trainerReportHtml}\n            </div>\n        `;
  }));
  const _cut = finalGridHtml.indexOf('<div class="duty-site-card');
  const _previewNote = window.isRosterPreview ? _cut < 0 ? finalGridHtml : finalGridHtml.slice(0, _cut) : '';
  const _canSec = typeof window.isDutyAdmin === 'function' && window.isDutyAdmin() || typeof window.hasUserPerm === 'function' && window.hasUserPerm('duty_secondary');
  const _ovRows = _dmItems.map((it => {
    const st = it.missing ? [ 'bad', 'ขาดคน' ] : it.warn ? [ 'warn', 'พักชนกัน' ] : [ 'ok', 'พร้อม' ];
    const chips = it.people.map((p => p.miss ? `<span class="ov-p miss"><b>ขาดคน</b></span>` : `<span class="ov-p duty-user-card ${p.drag ? 'can' : ''} ${p.me ? 'me' : ''}" data-name="${window.escapeHtml(p.name.toLowerCase())}" ${p.drag ? `draggable="true" ondragstart="handleDragStart(event, '${p.id}', '${window.escapeJsAttr(p.name)}', '${it.team}')"` : ''} title="${window.escapeHtml(p.name)}${p.sec ? ' · งานรอง ' + p.sec : ''}${p.hist ? '\nย้อนหลัง: ' + window.escapeHtml(p.hist) : ''}">\n                <span class="ov-top">\n                <b>${window.escapeHtml(p.name)}</b>${p.me ? '<span class="dc-me">ฉัน</span>' : ''}\n                <small class="${p.slots.length ? '' : 'none'}">${p.slots.length ? p.slots.map((x => x.split('-')[0])).join(' · ') : 'ยังไม่ลงพัก'}</small>\n                ${p.sec ? _canSec ? `<button type="button" class="ov-sec" onclick="event.stopPropagation(); changeSecondaryTeam('${it.team}', '${p.id}', '${window.escapeJsAttr(p.name)}')" title="กดเพื่อเปลี่ยนงานรองของ ${window.escapeHtml(p.name)}">รอง ${p.sec}<span class="material-icons">edit</span></button>` : `<i>รอง ${p.sec}</i>` : _canSec && p.id ? `<button type="button" class="ov-sec add" onclick="event.stopPropagation(); changeSecondaryTeam('${it.team}', '${p.id}', '${window.escapeJsAttr(p.name)}')" title="แจกงานรองให้ ${window.escapeHtml(p.name)}">+ รอง</button>` : ''}\n                ${p.sup.map((t => `<i class="ov-sup">🛟 ${window.escapeHtml(t)}</i>`)).join('')}\n                ${p.pin ? `<span class="ov-pin">${p.pin}</span>` : ''}\n                </span>\n                <span class="ov-imp" data-imp-name="${window.escapeHtml(p.name)}"></span>\n                ${p.histHtml ? `<span class="ov-hist"><span class="material-icons">history</span>${p.histHtml}</span>` : ''}\n            </span>`)).join('') || '<span class="ov-empty">ยังไม่มีคน · ลากชื่อมาวางได้</span>';
    return `<div class="ov-row" data-team="${it.team}" ondragover="handleDragOver(event)" ondrop="handleDrop(event, '${it.team}')">\n            <span class="ov-tint ${it.color.bg}" aria-hidden="true"></span>\n            <div class="ov-team">\n                <span class="ov-bar ${it.color.bg}"></span>\n                <span><b>${it.title}</b><small>${it.count} คน</small>\n                    <span class="ov-narrow"><span class="ov-stp ${st[0]}">${st[1]}</span>${it.standbyNames.length ? `<span class="ov-sbn" title="สแตนด์บายช่วยเว็บนี้">รอง: ${it.standbyNames.map((n => window.escapeHtml(n))).join(', ')}</span>` : ''}</span>\n                    ${it.trainerBtn || ''}</span>\n            </div>\n            <div class="ov-people">${chips}</div>\n            <div class="ov-sb">${it.standbyNames.length ? it.standbyNames.map((n => window.escapeHtml(n))).join(', ') : '—'}</div>\n            <div class="ov-st"><span class="${st[0]}">${st[1]}</span></div>\n        </div>`;
  })).join('');
  const _okN = _dmItems.filter((x => !x.missing)).length, _missN = _dmItems.filter((x => x.missing)).length;
  const _overview = `<section class="ov-wrap">\n            <div class="ov-sum"><span>เว็บพร้อม <b>${_okN}/${_dmItems.length}</b></span>${_missN ? `<span class="bad">ขาดคน <b>${_missN}</b> เว็บ</span>` : ''}<span>คนทำงาน <b>${_dmItems.reduce(((a, x) => a + x.count), 0)}</b></span></div>\n            <div class="ov-scroll custom-scrollbar"><div class="ov-table">\n                <div class="ov-row ov-h"><div>เว็บ</div><div>คนประจำ · เวลาพัก</div><div>สแตนด์บายช่วย</div><div style="text-align:right">สถานะ</div></div>\n                ${_ovRows}\n            </div></div>\n        </section>`;
  let _meBar = '';
  if (_me) {
    const mine = _dmItems.find((it => it.people.some((p => p.me))));
    const leave = (window.currentDutyLeaveData || []).find((l => _isMe({
      id: l.user_id,
      username: l.username
    })));
    const sb = _dmItems.filter((it => it.standbyNames.some((n => _me.username && String(n).toLowerCase() === String(_me.username).toLowerCase())))).map((it => it.title));
    if (mine) {
      const meP = mine.people.find((p => p.me));
      _meBar = `<div class="dv-me">\n                <span class="material-icons">person_pin_circle</span>\n                <span>คุณ <b>${window.escapeHtml(_me.username)}</b> อยู่เว็บ <b class="dv-team ${mine.color.bg} ${mine.color.text}">${mine.title}</b>${meP.sec ? ` · งานรอง <b>${meP.sec}</b>` : ''}${meP.slots.length ? ` · พัก <b>${meP.slots.join(', ')}</b>` : ' · <em>ยังไม่ลงเวลาพัก</em>'}<span class="dv-imp" data-imp-name="${window.escapeHtml(_me.username)}" data-imp-bar="1"></span></span>\n            </div>`;
    } else if (leave) {
      _meBar = `<div class="dv-me off"><span class="material-icons">event_busy</span><span>คุณ <b>${window.escapeHtml(_me.username)}</b> ลาหยุดในกะนี้</span></div>`;
    } else if (sb.length) {
      _meBar = `<div class="dv-me"><span class="material-icons">transfer_within_a_station</span><span>คุณ <b>${window.escapeHtml(_me.username)}</b> สแตนด์บายช่วยเว็บ <b>${sb.join(', ')}</b></span></div>`;
    } else if (_me.role === 'staff') {
      _meBar = `<div class="dv-me off"><span class="material-icons">info</span><span>คุณ <b>${window.escapeHtml(_me.username)}</b> ยังไม่อยู่ในตารางกะนี้</span></div>`;
    }
  }
  cardGrid.innerHTML = `${_previewNote}\n        ${_meBar ? `<div class="dv-top" style="grid-column:1/-1">${_meBar}</div>` : ''}\n        <div class="dv-overview" style="grid-column:1/-1">${_overview}</div>`;
  if (typeof window.impRefreshRosterTags === 'function') window.impRefreshRosterTags();
  const _si = document.getElementById('dutySearchInput');
  if (_si && _si.value && typeof window.filterDutyResult === 'function') window.filterDutyResult();
};

window.selectSecOption = function(el, val) {
  document.querySelectorAll('.secx-opt').forEach((o => o.classList.toggle('on', o === el)));
  document.getElementById('swal-sec-val').value = val;
};

window.changeSecondaryTeam = async function(primaryTeam, userId, username) {
  if (window.blockIfPreview()) return;
  const uidStr = String(userId);
  const access = dutyAccessMatrix[uidStr] || dutyAccessMatrix[Number(userId)] || [];
  let possibleSecondary = access.filter((t => t !== primaryTeam && sortedTeams.includes(t)));
  if (possibleSecondary.length === 0) {
    return Swal.fire({
      icon: 'warning',
      title: 'ไม่มีสิทธิ์เข้าเว็บอื่น',
      text: `${username} ไม่มีสิทธิ์หลังบ้านเว็บไหนเลย (นอกจากเว็บหลัก) จึงแจกงานรองไม่ได้ กรุณาไปเพิ่มสิทธิ์ในหน้าตั้งค่าก่อนครับ`,
      confirmButtonColor: '#3b82f6'
    });
  }
  let currentUserData = currentRosterData[primaryTeam].find((u => String(u.id) === String(userId)));
  let currentSec = currentUserData ? currentUserData.secondary_team : null;
  if (!document.getElementById('secx-css')) {
    const st = document.createElement('style');
    st.id = 'secx-css';
    st.textContent = `\n        .secx-wrap{display:flex;flex-direction:column;gap:10px;margin-top:6px;text-align:left}\n        .secx-none{display:flex;align-items:center;gap:12px;padding:12px 14px !important;border-radius:12px;border:1px solid var(--k-line2);background:var(--k-panel2);cursor:pointer;transition:border-color .15s,background .15s}\n        .secx-none .material-icons{font-size:20px;color:var(--k-red-tx)}\n        .secx-none b{display:block;font-size:13.5px;font-weight:900;color:var(--k-tx-strong)}\n        .secx-none small{display:block;font-size:11.5px;font-weight:600;color:var(--k-mute)}\n        .secx-none.on{border-color:#ef4444;background:var(--k-red-bg)}\n        .secx-lbl{font-size:11.5px;font-weight:800;color:var(--k-mute);margin:2px 2px -2px}\n        .secx-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;max-height:46vh;overflow-y:auto;padding:2px}\n        .secx-opt{position:relative;display:flex;align-items:center;gap:10px;height:52px;padding:0 12px 0 16px;border-radius:12px;border:1px solid var(--k-line2);background:var(--k-card);cursor:pointer;overflow:hidden;transition:border-color .15s,background .15s,transform .08s}\n        .secx-opt:hover{border-color:var(--k-line4)}\n        .secx-opt:active{transform:scale(.98)}\n        .secx-bar{position:absolute;left:0;top:0;bottom:0;width:5px}\n        .secx-opt b{flex:1;min-width:0;font-size:15px;font-weight:900;color:var(--k-tx-strong);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n        .secx-ck{width:22px;height:22px;border-radius:7px;border:2px solid var(--k-line3);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;color:transparent;flex:none}\n        .secx-opt.on{border-color:#E8C15A;background:color-mix(in srgb,#E8C15A 10%,var(--k-card));box-shadow:0 0 0 2px rgba(232,193,90,.25)}\n        .secx-opt.on .secx-ck{background:#E8C15A;border-color:#E8C15A;color:#1b1406}\n        .secx-cur{font-size:10px;font-weight:800;padding:1px 7px;border-radius:999px;background:rgba(232,193,90,.15);color:var(--k-gold-tx);border:1px solid rgba(232,193,90,.4)}\n        .secx-confirm{color:#1b1406 !important;font-weight:900 !important}\n        @media (max-width:420px){ .secx-grid{grid-template-columns:1fr} }`;
    document.head.appendChild(st);
  }
  let htmlContent = `<div class="secx-wrap">\n        <div onclick="selectSecOption(this, 'none')" class="secx-opt secx-none ${!currentSec ? 'on' : ''}" style="height:auto">\n            <span class="material-icons">block</span>\n            <div><b>ไม่มีงานรอง</b><small>ไม่ต้องสแตนด์บายช่วยเว็บอื่น</small></div>\n        </div>\n        <div class="secx-lbl">หรือเลือกเว็บที่จะสแตนด์บายช่วย</div>\n        <div class="secx-grid custom-scrollbar">`;
  possibleSecondary.forEach((t => {
    const teamColor = TEAM_COLORS[t] || TEAM_COLORS['DEFAULT'];
    const on = currentSec === t;
    htmlContent += `<div onclick="selectSecOption(this, '${t}')" class="secx-opt ${on ? 'on' : ''}" title="สแตนด์บายช่วยแชทเว็บ ${t}">\n                <span class="secx-bar ${teamColor.bg}"></span>\n                <b>${t}</b>${on ? '<span class="secx-cur">ตอนนี้</span>' : ''}\n                <span class="secx-ck">✓</span>\n            </div>`;
  }));
  htmlContent += `</div></div>`;
  htmlContent += `<input type="hidden" id="swal-sec-val" value="${currentSec || 'none'}">`;
  const {isConfirmed: isConfirmed} = await Swal.fire({
    title: `<div style="font-size:19px;font-weight:900">งานรองของ ${window.escapeHtml(username)}</div><div style="font-size:12px;font-weight:600;color:var(--k-mute);margin-top:4px">เว็บหลัก: ${window.escapeHtml(primaryTeam)} · เลือกเว็บที่จะสแตนด์บายช่วย</div>`,
    html: htmlContent,
    showCancelButton: true,
    confirmButtonText: 'บันทึกงานรอง',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#E8C15A',
    cancelButtonColor: '#64748b',
    reverseButtons: true,
    width: 520,
    customClass: {
      popup: 'rounded-3xl',
      confirmButton: 'secx-confirm'
    },
    preConfirm: () => document.getElementById('swal-sec-val').value
  });
  if (isConfirmed) {
    const selectedSec = document.getElementById('swal-sec-val').value;
    let userIndex = currentRosterData[primaryTeam].findIndex((u => String(u.id) === String(userId)));
    if (userIndex > -1) {
      const prevSec = currentRosterData[primaryTeam][userIndex].secondary_team || null;
      const newSec = selectedSec === 'none' ? null : selectedSec;
      currentRosterData[primaryTeam][userIndex].secondary_team = newSec;
      const targetDate = document.getElementById('dutyDate').value;
      const shiftFilter = document.getElementById('dutyShiftSelect').value;
      const saveKey = getDutySaveKey(targetDate, shiftFilter);
      Swal.fire({
        title: 'กำลังบันทึก...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });
      if (typeof window.dutyDedupeRoster === "function") window.dutyDedupeRoster(currentRosterData);
      window.clearSettingCache();
      const {error: secErr} = await appDB.from('settings').upsert([ {
        key: saveKey,
        value: JSON.stringify(currentRosterData)
      } ]);
      if (secErr) {
        currentRosterData[primaryTeam][userIndex].secondary_team = prevSec;
        return Swal.fire('บันทึกไม่สำเร็จ', secErr.message, 'error');
      }
      let logDetail;
      if (!prevSec && newSec) logDetail = `แจกงานรองให้ ${username} (เว็บหลัก: ${primaryTeam}) → สแตนด์บายช่วย [${newSec}]`; else if (prevSec && !newSec) logDetail = `ปลดงานรอง ${username} (ออกจากการสแตนด์บายช่วย [${prevSec}])`; else if (prevSec !== newSec) logDetail = `เปลี่ยนงานรอง ${username}: [${prevSec}] → [${newSec}]`;
      if (logDetail) {
        await appDB.from('system_logs').insert([ {
          action_type: 'ย้ายหน้าที่',
          performed_by: currentUser.username,
          target_details: `${logDetail} (กะ: ${shiftFilter}, วันที่: ${targetDate})`
        } ]);
      }
      window.renderRosterGrid(currentRosterData);
      if (appDB.channel) window.debouncedBroadcast('duty-updates', 'force_reload');
      Swal.fire({
        icon: 'success',
        title: 'อัปเดตงานรองแล้ว!',
        timer: 1200,
        showConfirmButton: false
      });
    }
  }
};

window.viewStandbyList = function(team) {
  const list = window.currentStandbyData[team] || [];
  if (list.length === 0) {
    return Swal.fire({
      icon: 'info',
      title: `ทีม ${team}`,
      text: 'ยังไม่มีพนักงานถูกสั่งให้มาสแตนด์บายช่วยเว็บนี้ครับ',
      confirmButtonColor: '#3b82f6',
      customClass: {
        popup: 'dark:bg-slate-800 dark:text-white rounded-3xl'
      }
    });
  }
  const teamColor = TEAM_COLORS[team] || TEAM_COLORS['DEFAULT'];
  const namesHtml = list.map(((item, i) => {
    let breakTimeHtml = '';
    const mySchedules = (window.currentDutySchedules || []).filter((s => s.staff_name === item.name));
    if (mySchedules && mySchedules.length > 0) {
      const timeSlotsText = mySchedules.map((s => String(s.time_slot || ''))).sort(((t1, t2) => t1.localeCompare(t2))).join(', ');
      breakTimeHtml = `<span class="text-xs text-sky-600 dark:text-sky-400 font-bold bg-sky-50 dark:bg-sky-900/30 px-2.5 py-1 rounded-md flex items-center gap-1 border border-sky-200 dark:border-sky-800/50 shadow-sm"><span class="material-icons text-[14px]">restaurant</span> พัก: ${timeSlotsText}</span>`;
    } else {
      breakTimeHtml = `<span class="text-xs text-red-500 font-bold bg-red-50 dark:bg-red-900/30 px-2.5 py-1 rounded-md flex items-center gap-1 border border-red-200 dark:border-red-800/50 shadow-sm animate-pulse"><span class="material-icons text-[14px]">warning</span> ยังไม่ลงเวลา</span>`;
    }
    return `\n        <div class="p-3.5 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-600 shadow-sm flex items-center justify-between group hover:border-amber-400 transition mb-2.5">\n            <div class="flex items-center gap-4">\n                <div class="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-black text-sm shadow-inner shrink-0">${i + 1}</div>\n                <div class="text-left flex flex-col gap-1.5">\n                    <div class="font-black text-slate-800 dark:text-white text-[15px] uppercase tracking-wide">${window.escapeHtml(item.name)}</div>\n                    <div class="flex flex-wrap items-center gap-2">\n                        <div class="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1">จากเว็บหลัก: <span class="font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800/50">${item.fromTeam}</span></div>\n                        ${breakTimeHtml}\n                    </div>\n                </div>\n            </div>\n            <span class="material-icons text-amber-400 text-2xl opacity-40 group-hover:scale-110 transition shrink-0 ml-2">support_agent</span>\n        </div>\n        `;
  })).join('');
  Swal.fire({
    title: `<div class="flex flex-col items-center gap-1.5"><span class="text-sm text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">ทีมสแตนด์บายช่วย</span><span class="text-3xl font-black ${teamColor.text} ${teamColor.bg} px-5 py-1.5 rounded-xl shadow-md border-2 ${teamColor.border}">${team}</span></div>`,
    html: `<div class="flex flex-col mt-4 max-h-[55vh] overflow-y-auto custom-scrollbar p-1">${namesHtml}</div>`,
    confirmButtonText: 'ปิดหน้าต่าง',
    confirmButtonColor: '#64748b',
    width: '500px',
    customClass: {
      popup: 'dark:bg-slate-900 dark:text-white rounded-3xl'
    }
  });
};

window.filterDutyResult = function() {
  const term = document.getElementById('dutySearchInput').value.toLowerCase();
  const siteCards = document.querySelectorAll('.duty-site-card');
  siteCards.forEach((card => {
    const userCards = card.querySelectorAll('.duty-user-card');
    let cardHasMatch = false;
    userCards.forEach((uCard => {
      const name = uCard.dataset.name;
      if (name && name.includes(term)) {
        uCard.style.display = 'flex';
        if (term !== '') {
          uCard.classList.add('ring-2', 'ring-amber-500', 'bg-amber-50');
          cardHasMatch = true;
        } else {
          uCard.classList.remove('ring-2', 'ring-amber-500', 'bg-amber-50');
        }
      } else {
        uCard.style.display = term === '' ? 'flex' : 'none';
        uCard.classList.remove('ring-2', 'ring-amber-500', 'bg-amber-50');
      }
    }));
    if (term === '') {
      card.style.display = 'flex';
    } else {
      card.style.display = cardHasMatch ? 'flex' : 'none';
    }
  }));
  document.querySelectorAll('#dutyResultGrid .ov-table .ov-row:not(.ov-h)').forEach((row => {
    let hit = false;
    row.querySelectorAll('.ov-p[data-name]').forEach((ch => {
      const m = !term || ch.dataset.name.includes(term);
      if (m && term) hit = true;
      ch.style.opacity = m ? '' : '.3';
      ch.style.outline = m && term ? '2px solid #E8C15A' : '';
    }));
    row.style.display = !term || hit ? '' : 'none';
  }));
  const matrixGrid = document.getElementById('dutyMatrixGrid');
  if (matrixGrid && !matrixGrid.classList.contains('hidden')) {
    const trs = matrixGrid.querySelectorAll('tbody tr');
    let currentShiftDisplay = null;
    let visibleCountInShift = 0;
    trs.forEach((tr => {
      const nameCell = tr.querySelector('td:nth-child(2) span, td:nth-child(1) span');
      if (!nameCell) return;
      const name = nameCell.innerText.toLowerCase();
      const shiftCell = tr.querySelector('td[rowspan]');
      if (shiftCell) {
        currentShiftDisplay = shiftCell;
        visibleCountInShift = 0;
      }
      if (term === '' || name.includes(term)) {
        tr.style.display = 'table-row';
        visibleCountInShift++;
        if (term !== '') nameCell.parentElement.classList.add('bg-amber-100', 'rounded', 'px-1'); else nameCell.parentElement.classList.remove('bg-amber-100', 'rounded', 'px-1');
      } else {
        tr.style.display = 'none';
        nameCell.parentElement.classList.remove('bg-amber-100', 'rounded', 'px-1');
      }
      if (shiftCell) {
        shiftCell.rowSpan = 1;
      } else if (currentShiftDisplay && tr.style.display !== 'none') {
        currentShiftDisplay.rowSpan = visibleCountInShift;
        currentShiftDisplay.parentElement.style.display = 'table-row';
      }
      if (currentShiftDisplay && visibleCountInShift === 0 && tr.style.display === 'none' && !tr.querySelector('td[rowspan]')) {
        currentShiftDisplay.parentElement.style.display = 'none';
      }
    }));
  }
};

window.searchDutyMyself = function() {
  const searchInput = document.getElementById('dutySearchInput');
  if (currentUser && currentUser.username) {
    searchInput.value = currentUser.username;
    window.filterDutyResult();
  }
};
