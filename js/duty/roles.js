window.ensureImportantTasksContainer = function() {
  let container = document.getElementById('importantTasksPanel');
  if (!container) {
    const resultGrid = document.getElementById('dutyResultGrid');
    const matrixGrid = document.getElementById('dutyMatrixGrid');
    const gridParent = resultGrid.parentElement;
    if (gridParent.id === 'dutyRosterWrapper') return;
    const wrapper = document.createElement('div');
    wrapper.id = 'dutyRosterWrapper';
    wrapper.className = 'flex flex-col xl:flex-row gap-5 w-full items-start';
    const leftPanel = document.createElement('div');
    leftPanel.id = 'importantTasksPanel';
    leftPanel.className = 'w-full xl:w-[340px] shrink-0 hidden transition-all';
    const rightPanel = document.createElement('div');
    rightPanel.id = 'mainRosterPanel';
    rightPanel.className = 'flex-1 min-w-0 w-full';
    gridParent.insertBefore(wrapper, resultGrid);
    rightPanel.appendChild(resultGrid);
    if (matrixGrid) rightPanel.appendChild(matrixGrid);
    wrapper.appendChild(leftPanel);
    wrapper.appendChild(rightPanel);
  }
};

window.renderImportantTasksPanel = function() {
  const panel = document.getElementById('importantTasksPanel');
  if (!panel) return;
  const isTrainerDept = window.isTrainerDept();
  const isAMDept = currentDutyDept === 'AM';
  const isStaffViewDept = currentDutyDept === 'AM' || currentDutyDept === 'OD';
  if (!isTrainerDept && !isStaffViewDept) {
    panel.classList.add('hidden');
    return;
  }
  panel.classList.remove('hidden');
  const isAdmin = window.isDutyAdmin();
  const targetDate = document.getElementById('dutyDate').value;
  const shiftFilter = document.getElementById('dutyShiftSelect').value;
  const savedRooms = Array.isArray(window.savedMergeRooms) ? window.savedMergeRooms : [];
  const isSaved = savedRooms.length > 0;
  let mergeBodyHtml = '';
  if (isSaved) {
    mergeBodyHtml = savedRooms.map((room => {
      const teamsHtml = room.teams.map((team => {
        const colorClass = TEAM_COLORS[team] || TEAM_COLORS['DEFAULT'];
        return `<span class="text-[11px] font-black px-2 py-0.5 rounded-lg border ${colorClass.border} ${colorClass.lightBg} ${colorClass.lightText}">${team}</span>`;
      })).join('');
      return `\n                <div class="flex items-center gap-2 py-1.5 border-b border-slate-700/50 last:border-0">\n                    <span class="w-5 h-5 rounded-full bg-violet-600 text-white text-[10px] font-black flex items-center justify-center shrink-0">${room.id}</span>\n                    <div class="flex flex-wrap gap-1">${teamsHtml}</div>\n                </div>`;
    })).join('');
  } else {
    const rooms = window.currentMergeRooms || [];
    if (rooms.length > 0) {
      mergeBodyHtml = rooms.map((room => {
        const teamsHtml = room.teams.map((team => {
          const colorClass = TEAM_COLORS[team] || TEAM_COLORS['DEFAULT'];
          return `\n                        <span class="inline-flex items-center text-[11px] font-black px-2 py-0.5 rounded-lg border ${colorClass.border} ${colorClass.lightBg} ${colorClass.lightText} cursor-grab active:cursor-grabbing select-none"\n                              draggable="true"\n                              ondragstart="window.mergeRoomDragStart(event, ${room.id}, '${team}')"\n                              ondragend="window.mergeRoomDragEnd(event)">${team}</span>`;
        })).join('');
        return `\n                    <div class="merge-room-drop py-1.5 border-b border-slate-700/50 last:border-0 transition-colors rounded"\n                         ondragover="window.mergeRoomDragOver(event)"\n                         ondrop="window.mergeRoomDropInline(event, ${room.id})">\n                        <div class="flex items-start gap-2">\n                            <span class="w-5 h-5 rounded-full bg-violet-600 text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">${room.id}</span>\n                            <div class="flex flex-wrap gap-1">${teamsHtml}</div>\n                        </div>\n                    </div>`;
      })).join('');
    } else {
      mergeBodyHtml = `<div class="text-center text-[11px] text-slate-500 font-bold py-2">กดสุ่มรวมห้องเพื่อเริ่ม</div>`;
    }
  }
  const mergeHtml = `\n        <div class="bg-[#151f32] border border-violet-700/60 rounded-2xl shadow-lg overflow-hidden mt-3">\n            <div class="bg-gradient-to-r from-violet-700 to-purple-600 text-white px-3 py-2 flex justify-between items-center">\n                <div class="flex items-center gap-1.5">\n                    <span class="material-icons text-[16px]">meeting_room</span>\n                    <h4 class="font-black text-xs tracking-wide">การรวมห้อง Discord</h4>\n                </div>\n                <div class="flex gap-1">\n                    ${isStaffViewDept ? '' : isSaved ? `\n                        <button onclick="window.deleteMergeRooms()" class="bg-red-600/80 hover:bg-red-600 px-2 py-1 rounded text-[10px] font-bold transition flex items-center gap-1 border border-red-400/50 active:scale-95">\n                            <span class="material-icons text-[11px]">delete</span> ลบ\n                        </button>` : `\n                        <button onclick="window.shuffleMergeRoomsInline()" class="bg-black/20 hover:bg-black/30 px-2 py-1 rounded text-[10px] font-bold transition flex items-center gap-1 border border-white/20 active:scale-95">\n                            <span class="material-icons text-[11px]">shuffle</span> สุ่ม\n                        </button>\n                        ${window.currentMergeRooms && window.currentMergeRooms.length > 0 ? `\n                        <button onclick="window.saveMergeRooms()" class="bg-emerald-600 hover:bg-emerald-500 px-2 py-1 rounded text-[10px] font-bold transition flex items-center gap-1 border border-emerald-400/50 active:scale-95">\n                            <span class="material-icons text-[11px]">save</span> บันทึก\n                        </button>` : ''}\n                    `}\n                </div>\n            </div>\n            <div class="p-2.5 flex flex-col">${mergeBodyHtml}</div>\n        </div>`;
  const esc = window.escapeHtml, escJ = window.escapeJsAttr;
  window.currentImportantAssigns = window.impNormMap(window.currentImportantAssigns);
  window.lockedImportantTasks = window.impNormMap(window.lockedImportantTasks);
  const assigns = window.currentImportantAssigns;
  const locks = window.lockedImportantTasks;
  let html = `\n        <div class="bg-[#151f32] border border-slate-700/80 rounded-2xl shadow-lg flex flex-col max-h-[750px] overflow-hidden">\n            <div class="bg-gradient-to-r from-amber-600 to-yellow-500 text-white p-3 flex justify-between items-center shadow-md shrink-0">\n                <div class="flex items-center gap-2">\n                    <span class="material-icons">star</span>\n                    <h4 class="font-black text-sm tracking-wide">หน้าที่ประจำ / พิเศษ</h4>\n                </div>\n                <div class="flex gap-1">\n                    ${isAdmin ? `<button onclick="window.randomizeImportantTasks()" class="bg-indigo-600 hover:bg-indigo-500 px-2 py-1 rounded text-[10px] font-bold shadow-inner transition flex items-center gap-1 border border-indigo-400 active:scale-95"><span class="material-icons text-[12px]">casino</span> สุ่มลงงาน</button>` : ''}\n                    ${isAdmin ? `<button onclick="window.addImportantTask()" class="bg-black/20 hover:bg-black/30 px-2 py-1 rounded text-[10px] font-bold shadow-inner transition flex items-center gap-1 border border-white/20"><span class="material-icons text-[12px]">add</span> เพิ่ม</button>` : ''}\n                </div>\n            </div>\n            <div class="p-3 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3">\n    `;
  const allTasksToShow = [ ...new Set([ ...window.globalImportantTasks, ...Object.keys(assigns) ]) ];
  if (allTasksToShow.length === 0) {
    html += `<div class="text-center py-10 text-gray-500 text-xs font-bold border border-dashed border-slate-700 rounded-xl bg-slate-900/50">แอดมินยังไม่ได้ตั้งค่างานพิเศษ</div>`;
  } else {
    allTasksToShow.forEach((task => {
      const team = window.impTeamOf(task);
      const cfg = window.impCfgOf(task);
      const isLegacy = !window.globalImportantTasks.includes(task);
      const lockOf = locks[task] || {
        main: [],
        support: []
      };
      const lockedCount = lockOf.main.length + lockOf.support.length;
      const canEdit = isAdmin && !isLegacy;
      const missMain = Math.max(0, cfg.main - team.main.length);
      const missSup = Math.max(0, cfg.support - team.support.length);
      let boxClass;
      if (team.main.length === 0) boxClass = 'border-red-500/50 bg-red-900/10 hover:border-red-400'; else if (missMain || missSup) boxClass = 'border-amber-500/50 bg-amber-900/10 hover:border-amber-400'; else boxClass = 'border-emerald-500/30 bg-emerald-900/10 hover:border-emerald-400';
      const chip = (name, role) => {
        const isLk = (lockOf[role] || []).includes(name);
        const c = isLk ? 'bg-amber-900/30 border-amber-500/50 text-amber-400' : role === 'main' ? 'bg-emerald-900/30 border-emerald-500/30 text-emerald-400' : 'bg-sky-900/30 border-sky-500/30 text-sky-400';
        const lkTitle = isLk ? 'ปลดล็อก (เลิกเป็นหน้าที่ประจำ)' : 'ล็อกคนนี้เป็นหน้าที่ประจำ (ใส่ให้อัตโนมัติทุกวัน)';
        const lkBtn = canEdit ? `<button onclick="window.toggleLockImportantPerson('${escJ(task)}','${role}','${escJ(name)}')" class="${isLk ? 'text-amber-500' : 'text-gray-400 hover:text-white'} bg-slate-800 rounded px-1 py-0.5 border border-slate-700 transition" title="${lkTitle}"><span class="material-icons text-[13px] block">${isLk ? 'lock' : 'lock_open'}</span></button>` : isLk ? '<span class="material-icons text-[13px] text-amber-500" title="หน้าที่ประจำ">lock</span>' : '';
        const xBtn = canEdit ? `<button onclick="window.impRemovePerson('${escJ(task)}','${role}','${escJ(name)}')" class="text-red-400 hover:text-red-500 bg-slate-800 rounded px-1 py-0.5 border border-slate-700 transition" title="ปลดคนนี้ออก"><span class="material-icons text-[13px] block">close</span></button>` : '';
        return `\n                    <div class="flex items-center justify-between gap-1 px-2 py-1 rounded-lg border ${c}">\n                        <span class="flex items-center gap-1.5 font-extrabold text-[12px] min-w-0">\n                            <span class="material-icons text-[14px]">${role === 'main' ? 'person' : 'support_agent'}</span>\n                            <span class="truncate">${esc(name)}</span>\n                            ${isLk ? '<span class="text-[9px] bg-amber-900/50 text-amber-300 px-1 rounded shrink-0">ประจำ</span>' : ''}\n                        </span>\n                        <div class="flex gap-1 shrink-0">${lkBtn}${xBtn}</div>\n                    </div>`;
      };
      const section = (role, label, list, need, miss) => {
        if (need === 0 && list.length === 0) return '';
        const over = list.length > need;
        const cntCls = miss > 0 ? 'text-red-400' : over ? 'text-amber-400' : 'text-slate-400';
        const addBtn = canEdit ? `<button onclick="window.assignImportantTask('${escJ(task)}','${role}')" class="w-full flex items-center justify-center gap-1 px-2 py-1 rounded-lg border border-dashed ${role === 'main' ? 'border-emerald-500/50 text-emerald-400' : 'border-sky-500/40 text-sky-400'} text-[11px] font-bold hover:bg-white/10 transition"><span class="material-icons text-[13px]">person_add</span> เลือกคน (ขาด ${miss})</button>` : `<div class="text-[11px] font-bold text-red-400 flex items-center gap-1"><span class="material-icons text-[13px]">warning</span> ยังขาด ${miss} คน</div>`;
        return `\n                    <div class="mt-2">\n                        <div class="flex items-center justify-between text-[10px] font-black tracking-wide mb-1">\n                            <span class="${role === 'main' ? 'text-emerald-400' : 'text-sky-400'}">${label}${role === 'support' && team.main.length === 0 && list.length ? ' · ดูแลแทนหลัก' : ''}</span>\n                            <span class="${cntCls}">${list.length}/${need}</span>\n                        </div>\n                        <div class="flex flex-col gap-1">\n                            ${list.map((n => chip(n, role))).join('')}\n                            ${miss > 0 ? addBtn : ''}\n                        </div>\n                    </div>`;
      };
      const cfgBtn = canEdit ? `<button onclick="window.configImportantTask('${escJ(task)}')" class="text-gray-400 hover:text-white bg-slate-800 rounded px-1.5 py-0.5 border border-slate-700 transition" title="ตั้งจำนวนคน หลัก / ซัพพอร์ต"><span class="material-icons text-[14px] block">tune</span></button>` : '';
      const delBtn = canEdit ? `<button onclick="window.deleteImportantTask('${escJ(task)}')" class="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition bg-slate-800 rounded px-1.5 py-0.5 border border-slate-700" title="ลบหน้าที่นี้"><span class="material-icons text-[14px] block">delete</span></button>` : '';
      html += `\n                <div class="p-3 rounded-xl border transition shadow-sm group bg-slate-800 ${boxClass}">\n                    <div class="flex justify-between items-start gap-2">\n                        <div class="font-bold text-sm text-slate-200 leading-tight flex-1 min-w-0">\n                            ${esc(task)}\n                            ${isLegacy ? '<span class="text-[9px] text-gray-500 ml-1 font-normal">(งานนี้ถูกลบแล้ว)</span>' : ''}\n                            <div class="flex flex-wrap items-center gap-1 mt-1">\n                                <span class="text-[9px] font-bold text-slate-400 bg-slate-900/50 border border-slate-700 px-1.5 rounded">หลัก ${cfg.main} · ซัพ ${cfg.support}</span>\n                                ${lockedCount ? `<span class="text-[9px] bg-amber-900/50 text-amber-300 px-1 rounded">🔒 ประจำ ${lockedCount} คน</span>` : ''}\n                            </div>\n                        </div>\n                        <div class="flex gap-1 shrink-0">${delBtn}${cfgBtn}</div>\n                    </div>\n                    ${section('main', 'หลัก', team.main, cfg.main, missMain)}\n                    ${section('support', 'ซัพพอร์ต', team.support, cfg.support, missSup)}\n                </div>\n            `;
    }));
  }
  html += `</div></div>`;
  panel.innerHTML = isStaffViewDept ? mergeHtml : html + mergeHtml;
  window.impRefreshRosterTags();
  if (isAMDept) window.renderHelpCalcPanel();
};

window.impRefreshRosterTags = function() {
  const slots = document.querySelectorAll('#dutyApp [data-imp-name]');
  if (!slots.length) return;
  const on = typeof window.isTrainerDept === 'function' && window.isTrainerDept();
  const byName = new Map;
  if (on) {
    const assigns = window.impNormMap(window.currentImportantAssigns);
    const locks = window.impNormMap(window.lockedImportantTasks);
    const order = [ ...new Set([ ...window.globalImportantTasks || [], ...Object.keys(assigns) ]) ];
    order.forEach((task => {
      const t = assigns[task];
      if (!t) return;
      const lk = locks[task] || {
        main: [],
        support: []
      };
      const add = (n, role) => {
        const key = String(n).trim().toLowerCase();
        if (!byName.has(key)) byName.set(key, []);
        byName.get(key).push({
          task: task,
          role: role,
          locked: lk[role].includes(n)
        });
      };
      t.main.forEach((n => add(n, 'main')));
      t.support.forEach((n => add(n, 'support')));
    }));
    byName.forEach((list => list.sort(((a, b) => (a.role === 'main' ? 0 : 1) - (b.role === 'main' ? 0 : 1)))));
  }
  const esc = window.escapeHtml;
  slots.forEach((el => {
    const list = byName.get(String(el.getAttribute('data-imp-name') || '').trim().toLowerCase()) || [];
    if (el.getAttribute('data-imp-bar')) {
      el.innerHTML = list.length ? ' · หน้าที่พิเศษ ' + list.map((x => `<b class="dv-it ${x.role === 'main' ? 'main' : 'sup'}">${x.role === 'main' ? 'หลัก' : 'ซัพ'} · ${esc(x.task)}${x.locked ? ' 🔒' : ''}</b>`)).join(' ') : '';
      return;
    }
    el.innerHTML = list.map((x => `<span class="ov-it ${x.role === 'main' ? 'main' : 'sup'}${x.locked ? ' lk' : ''}" title="${x.role === 'main' ? 'หลัก' : 'ซัพพอร์ต'}: ${esc(x.task)}${x.locked ? ' (หน้าที่ประจำ)' : ''}">` + `<span class="material-icons">${x.role === 'main' ? 'star' : 'support_agent'}</span>` + `<em>${x.role === 'main' ? 'หลัก' : 'ซัพ'}</em><span class="ov-itx">${esc(x.task)}</span>${x.locked ? ' 🔒' : ''}</span>`)).join('');
  }));
};

window.impNormTeam = function(v) {
  const arr = x => (Array.isArray(x) ? x : x ? [ x ] : []).map((s => String(s).trim())).filter(Boolean);
  if (!v) return null;
  let t;
  if (typeof v === 'string' || Array.isArray(v)) t = {
    main: arr(v),
    support: []
  }; else if (typeof v === 'object') t = {
    main: arr(v.main),
    support: arr(v.support)
  }; else return null;
  t.main = [ ...new Set(t.main) ];
  t.support = [ ...new Set(t.support) ].filter((n => !t.main.includes(n)));
  return t.main.length || t.support.length ? t : null;
};

window.impNormMap = function(m) {
  const out = {};
  if (m && typeof m === 'object' && !Array.isArray(m)) {
    for (const k in m) {
      const t = window.impNormTeam(m[k]);
      if (t) out[k] = t;
    }
  }
  return out;
};

window.impTeamOf = function(task) {
  const t = window.impNormTeam((window.currentImportantAssigns || {})[task]);
  return t ? {
    main: [ ...t.main ],
    support: [ ...t.support ]
  } : {
    main: [],
    support: []
  };
};

window.impCfgOf = function(task) {
  const c = (window.importantTaskCfg || {})[task] || {};
  const m = parseInt(c.main, 10), s = parseInt(c.support, 10);
  return {
    main: isNaN(m) || m < 1 ? 1 : Math.min(m, 20),
    support: isNaN(s) || s < 0 ? 0 : Math.min(s, 20)
  };
};

window.impKeys = function() {
  const date = document.getElementById('dutyDate').value;
  const shift = document.getElementById('dutyShiftSelect').value;
  return {
    date: date,
    shift: shift,
    list: `duty_important_tasks_list_${currentDutyDept}_${shift}`,
    assign: `duty_important_assign_${currentDutyDept}_${date}_${shift}`,
    lock: `duty_important_permanent_lock_${currentDutyDept}_${shift}`,
    cfg: `duty_important_task_cfg_${currentDutyDept}_${shift}`
  };
};

window.impBusyMap = function(exceptTask) {
  const out = new Map;
  const a = window.currentImportantAssigns || {};
  for (const task in a) {
    if (task === exceptTask) continue;
    const t = window.impNormTeam(a[task]);
    if (!t) continue;
    [ ...t.main, ...t.support ].forEach((n => {
      if (!out.has(n)) out.set(n, task);
    }));
  }
  return out;
};

window.impSameTeam = function(a, b) {
  const na = window.impNormTeam(a), nb = window.impNormTeam(b);
  if (!na || !nb) return !na && !nb;
  const key = t => JSON.stringify([ [ ...t.main ].sort(), [ ...t.support ].sort() ]);
  return key(na) === key(nb);
};

window._impLog = function(detail) {
  const k = window.impKeys();
  try {
    appDB.from('system_logs').insert([ {
      action_type: 'ย้ายหน้าที่',
      performed_by: currentUser.username,
      target_details: `${detail} (กะ: ${k.shift}, วันที่: ${k.date})`
    } ]).then((() => {}), (() => {}));
  } catch (e) {}
};

window.impApplyLocks = function() {
  const assigns = window.currentImportantAssigns = window.impNormMap(window.currentImportantAssigns);
  const locks = window.lockedImportantTasks = window.impNormMap(window.lockedImportantTasks);
  let changed = false;
  for (const task in locks) {
    if (!window.globalImportantTasks.includes(task)) continue;
    const team = window.impTeamOf(task);
    [ 'main', 'support' ].forEach((role => {
      const other = role === 'main' ? 'support' : 'main';
      locks[task][role].forEach((n => {
        if (team[role].includes(n)) return;
        team[other] = team[other].filter((x => x !== n));
        team[role].push(n);
        changed = true;
      }));
    }));
    if (changed) assigns[task] = window.impNormTeam(team);
  }
  return changed;
};

window.impPruneLocks = function(task) {
  const locks = window.lockedImportantTasks || {};
  const lk = window.impNormTeam(locks[task]);
  if (!lk) {
    if (locks[task]) {
      delete locks[task];
      return true;
    }
    return false;
  }
  const team = window.impTeamOf(task);
  const next = window.impNormTeam({
    main: lk.main.filter((n => team.main.includes(n))),
    support: lk.support.filter((n => team.support.includes(n)))
  });
  if (window.impSameTeam(next, lk)) return false;
  if (next) locks[task] = next; else delete locks[task];
  return true;
};

window.impSaveTeam = async function(task, team, logDetail) {
  const k = window.impKeys();
  const t = window.impNormTeam(team);
  if (t) window.currentImportantAssigns[task] = t; else delete window.currentImportantAssigns[task];
  const rows = [ {
    key: k.assign,
    value: JSON.stringify(window.currentImportantAssigns)
  } ];
  if (window.impPruneLocks(task)) rows.push({
    key: k.lock,
    value: JSON.stringify(window.lockedImportantTasks)
  });
  window.clearSettingCache();
  const {error: error} = await appDB.from('settings').upsert(rows);
  if (error) throw error;
  if (logDetail) window._impLog(logDetail);
  window.renderImportantTasksPanel();
  window.debouncedBroadcast('duty-updates', 'force_reload');
};

window._impDenied = function() {
  if (window.isDutyAdmin()) return false;
  Swal.fire('ไม่มีสิทธิ์', 'เฉพาะผู้จัดเวรเท่านั้นครับ', 'error');
  return true;
};

window.toggleLockImportantPerson = async function(taskName, role, name) {
  if (window._impDenied()) return;
  role = role === 'support' ? 'support' : 'main';
  const k = window.impKeys();
  const locks = window.lockedImportantTasks = window.impNormMap(window.lockedImportantTasks);
  const lk = locks[taskName] ? {
    main: [ ...locks[taskName].main ],
    support: [ ...locks[taskName].support ]
  } : {
    main: [],
    support: []
  };
  const roleLabel = role === 'main' ? 'หลัก' : 'ซัพพอร์ต';
  let msg;
  if (lk[role].includes(name)) {
    lk[role] = lk[role].filter((n => n !== name));
    msg = `ปลดล็อก ${name} แล้ว`;
  } else {
    if (!window.impTeamOf(taskName)[role].includes(name)) return;
    lk[role].push(name);
    msg = `ล็อก ${name} เป็น${roleLabel}ประจำแล้ว`;
  }
  const next = window.impNormTeam(lk);
  if (next) locks[taskName] = next; else delete locks[taskName];
  window.clearSettingCache();
  const {error: error} = await appDB.from('settings').upsert([ {
    key: k.lock,
    value: JSON.stringify(locks)
  } ]);
  if (error) return;
  window._impLog(`${msg} — งาน "${taskName}" [${roleLabel}]`);
  Swal.fire({
    toast: true,
    position: 'top-end',
    icon: 'success',
    title: msg,
    showConfirmButton: false,
    timer: 1500
  });
  window.renderImportantTasksPanel();
};

window.randomizeImportantTasks = async function() {
  if (window._impDenied()) return;
  if (window.globalImportantTasks.length === 0) return Swal.fire('ไม่มีงาน', 'กรุณาเพิ่มหน้าที่สำคัญก่อนทำการสุ่มครับ', 'warning');
  const k = window.impKeys();
  const available = window.getDutyActiveStaff(k.shift, {
    anyRole: true
  }).map((u => u.username));
  if (available.length === 0) return Swal.fire('ไม่มีพนักงาน', 'ไม่พบรายชื่อผู้สอนในกะนี้ครับ', 'error');
  window.impApplyLocks();
  const tasks = window.globalImportantTasks.slice();
  const teams = {};
  tasks.forEach((t => {
    teams[t] = window.impTeamOf(t);
  }));
  const load = new Map, mainOf = new Set;
  const bump = n => load.set(n, (load.get(n) || 0) + 1);
  for (const t in window.currentImportantAssigns) {
    const tm = teams[t] || window.impNormTeam(window.currentImportantAssigns[t]);
    if (!tm) continue;
    tm.main.forEach((n => {
      mainOf.add(n);
      bump(n);
    }));
    tm.support.forEach(bump);
  }
  const rank = new Map(available.slice().sort((() => Math.random() - .5)).map(((n, i) => [ n, i ])));
  const inTask = (t, n) => teams[t].main.includes(n) || teams[t].support.includes(n);
  const pickLeast = cands => cands.sort(((a, b) => (load.get(a) || 0) - (load.get(b) || 0) || rank.get(a) - rank.get(b)))[0];
  const fill = (role, order, target, candOk) => {
    let added = 0, progress = true;
    while (progress) {
      progress = false;
      for (const t of order) {
        if (teams[t][role].length >= target(t)) continue;
        const n = pickLeast(available.filter((x => !inTask(t, x) && candOk(x))));
        if (!n) continue;
        teams[t][role].push(n);
        bump(n);
        if (role === 'main') mainOf.add(n);
        added++;
        progress = true;
      }
    }
    return added;
  };
  const cfgOf = t => window.impCfgOf(t);
  const mainAdded = fill('main', tasks, (t => cfgOf(t).main), (n => !mainOf.has(n)));
  const noMain = tasks.filter((t => teams[t].main.length === 0));
  const withMain = tasks.filter((t => teams[t].main.length > 0));
  const coverAdded = fill('support', noMain, (t => Math.max(1, cfgOf(t).support)), (() => true));
  const supAdded = fill('support', withMain, (t => cfgOf(t).support), (() => true));
  let shortMain = 0, shortSup = 0;
  tasks.forEach((t => {
    const c = cfgOf(t);
    shortMain += Math.max(0, c.main - teams[t].main.length);
    shortSup += Math.max(0, (teams[t].main.length ? c.support : Math.max(1, c.support)) - teams[t].support.length);
  }));
  if (mainAdded + coverAdded + supAdded === 0) {
    if (shortMain + shortSup > 0) return Swal.fire('คนไม่พอ', `ยังขาด หลัก ${shortMain} · ซัพ ${shortSup} ตำแหน่ง แต่ไม่มีผู้สอนเหลือให้สุ่มแล้วครับ`, 'info');
    return Swal.fire('เตือน', 'ทุกหน้าที่มีคนครบตามจำนวนที่ตั้งไว้แล้วครับ', 'info');
  }
  Swal.fire({
    title: 'กำลังสุ่มและจัดเรียงงาน...',
    didOpen: () => Swal.showLoading()
  });
  tasks.forEach((t => {
    const n = window.impNormTeam(teams[t]);
    if (n) window.currentImportantAssigns[t] = n;
  }));
  window.clearSettingCache();
  const {error: error} = await appDB.from('settings').upsert([ {
    key: k.assign,
    value: JSON.stringify(window.currentImportantAssigns)
  } ]);
  Swal.close();
  if (error) return;
  window._impLog(`สุ่มหน้าที่พิเศษ: เพิ่มหลัก ${mainAdded} · ซัพ ${supAdded} · ซัพดูแลแทนหลัก ${coverAdded}`);
  window.renderImportantTasksPanel();
  window.debouncedBroadcast('duty-updates', 'force_reload');
  const sum = `เพิ่มหลัก ${mainAdded} · ซัพ ${supAdded + coverAdded} คน`;
  if (shortMain > 0) {
    Swal.fire('สุ่มแล้ว — คนไม่พอเป็นหลัก', `${sum}<br>มี <b>${noMain.length}</b> หน้าที่ที่ไม่มีหลัก → ใส่ซัพพอร์ตดูแลแทนให้แล้ว` + (shortSup ? `<br>ยังขาดซัพพอร์ต <b>${shortSup}</b> ตำแหน่ง` : ''), 'warning');
  } else if (shortSup > 0) {
    Swal.fire('สุ่มแล้ว แต่คนไม่พอ', `${sum}<br>ยังขาดซัพพอร์ต <b>${shortSup}</b> ตำแหน่ง`, 'warning');
  } else {
    Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 2e3
    }).fire({
      icon: 'success',
      title: `สุ่มสำเร็จ: ${sum}`
    });
  }
};

window._impCountFieldsHtml = function(main, support) {
  const box = 'width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1px solid rgba(148,163,184,.35);background:transparent;color:inherit;font-size:15px;font-weight:700;text-align:center';
  const lab = 'display:block;font-size:12px;font-weight:700;margin-bottom:6px;text-align:left';
  return `\n        <div style="display:flex;gap:10px;margin-top:12px">\n            <div style="flex:1"><label style="${lab};color:#34d399">👤 หลัก (คน)</label>\n                <input id="impCntMain" type="number" min="1" max="20" value="${main}" style="${box}"></div>\n            <div style="flex:1"><label style="${lab};color:#38bdf8">🎧 ซัพพอร์ต (คน)</label>\n                <input id="impCntSup" type="number" min="0" max="20" value="${support}" style="${box}"></div>\n        </div>\n        <div style="font-size:11px;opacity:.6;margin-top:8px;text-align:left">ซัพพอร์ตใส่ 0 ได้ ถ้างานนี้ไม่ต้องมีคนช่วย</div>`;
};

window._impReadCounts = function() {
  const m = parseInt(document.getElementById('impCntMain').value, 10);
  const s = parseInt(document.getElementById('impCntSup').value, 10);
  if (isNaN(m) || m < 1 || m > 20) {
    Swal.showValidationMessage('จำนวนหลักต้องเป็น 1–20 คน');
    return null;
  }
  if (isNaN(s) || s < 0 || s > 20) {
    Swal.showValidationMessage('จำนวนซัพพอร์ตต้องเป็น 0–20 คน');
    return null;
  }
  return {
    main: m,
    support: s
  };
};

window.addImportantTask = async function() {
  if (window._impDenied()) return;
  const {value: form} = await Swal.fire({
    title: 'เพิ่มหน้าที่สำคัญ / พิเศษ',
    html: `<input id="impNewName" class="swal2-input" style="margin:6px 0 0;width:100%;box-sizing:border-box" placeholder="เช่น ดูแลระบบฝากถอน, เช็คแชท VIP...">` + window._impCountFieldsHtml(1, 0),
    showCancelButton: true,
    confirmButtonText: 'บันทึก',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#f59e0b',
    customClass: {
      popup: 'dark:bg-slate-800 dark:text-white rounded-3xl'
    },
    didOpen: () => {
      const el = document.getElementById('impNewName');
      if (el) el.focus();
    },
    preConfirm: () => {
      const name = (document.getElementById('impNewName').value || '').trim();
      if (!name) {
        Swal.showValidationMessage('กรุณาใส่ชื่อหน้าที่');
        return false;
      }
      const counts = window._impReadCounts();
      if (!counts) return false;
      return {
        name: name,
        counts: counts
      };
    }
  });
  if (!form) return;
  if (window.globalImportantTasks.includes(form.name)) return Swal.fire('เตือน', 'มีหน้าที่นี้อยู่ในระบบแล้วครับ', 'warning');
  const k = window.impKeys();
  window.globalImportantTasks.push(form.name);
  window.importantTaskCfg = window.importantTaskCfg || {};
  window.importantTaskCfg[form.name] = form.counts;
  Swal.fire({
    title: 'กำลังบันทึก...',
    didOpen: () => Swal.showLoading()
  });
  window.clearSettingCache();
  await appDB.from('settings').upsert([ {
    key: k.list,
    value: JSON.stringify(window.globalImportantTasks)
  }, {
    key: k.cfg,
    value: JSON.stringify(window.importantTaskCfg)
  } ]);
  window.renderImportantTasksPanel();
  Swal.close();
};

window.configImportantTask = async function(taskName) {
  if (window._impDenied()) return;
  const cur = window.impCfgOf(taskName);
  const {value: counts} = await Swal.fire({
    title: `<div class="text-sm text-gray-400 mb-1">ตั้งจำนวนคน:</div><div class="text-amber-500 font-black">${window.escapeHtml(taskName)}</div>`,
    html: window._impCountFieldsHtml(cur.main, cur.support),
    showCancelButton: true,
    confirmButtonText: 'บันทึก',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#f59e0b',
    customClass: {
      popup: 'dark:bg-slate-800 dark:text-white rounded-3xl'
    },
    preConfirm: () => window._impReadCounts() || false
  });
  if (!counts) return;
  const k = window.impKeys();
  window.importantTaskCfg = window.importantTaskCfg || {};
  window.importantTaskCfg[taskName] = counts;
  const rows = [ {
    key: k.cfg,
    value: JSON.stringify(window.importantTaskCfg)
  } ];
  const team = window.impTeamOf(taskName);
  const lk = (window.lockedImportantTasks || {})[taskName] || {
    main: [],
    support: []
  };
  const keepOf = (role, need) => {
    const list = team[role];
    if (list.length <= need) return list.slice();
    const locked = list.filter((n => lk[role].includes(n))).slice(0, need);
    const rest = list.filter((n => !lk[role].includes(n))).slice(0, Math.max(0, need - locked.length));
    const keep = new Set([ ...locked, ...rest ]);
    return list.filter((n => keep.has(n)));
  };
  const keptMain = keepOf('main', counts.main), keptSup = keepOf('support', counts.support);
  const cutMain = team.main.filter((n => !keptMain.includes(n))), cutSup = team.support.filter((n => !keptSup.includes(n)));
  if (cutMain.length || cutSup.length) {
    const trimmed = window.impNormTeam({
      main: keptMain,
      support: keptSup
    });
    if (trimmed) window.currentImportantAssigns[taskName] = trimmed; else delete window.currentImportantAssigns[taskName];
    rows.push({
      key: k.assign,
      value: JSON.stringify(window.currentImportantAssigns)
    });
    if (window.impPruneLocks(taskName)) rows.push({
      key: k.lock,
      value: JSON.stringify(window.lockedImportantTasks)
    });
  }
  window.clearSettingCache();
  const {error: error} = await appDB.from('settings').upsert(rows);
  if (error) return;
  const cut = [ ...cutMain, ...cutSup ];
  if (cut.length) window._impLog(`ลดจำนวนคนงาน "${taskName}" → ปลด ${cut.join(', ')}`);
  window.renderImportantTasksPanel();
  window.debouncedBroadcast('duty-updates', 'force_reload');
  Swal.fire({
    toast: true,
    position: 'top-end',
    icon: 'success',
    showConfirmButton: false,
    timer: cut.length ? 3e3 : 1500,
    title: `ตั้งเป็น หลัก ${counts.main} · ซัพ ${counts.support} แล้ว` + (cut.length ? ` (ปลดออก: ${cut.join(', ')})` : '')
  });
};

window.deleteImportantTask = async function(taskName) {
  if (window._impDenied()) return;
  const res = await Swal.fire({
    title: 'ลบหน้าที่นี้?',
    text: `ต้องการลบ "${taskName}" ออกจากรายการงานพิเศษใช่หรือไม่? (ลบทิ้งถาวร)`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    confirmButtonText: 'ลบทิ้งเลย',
    customClass: {
      popup: 'dark:bg-slate-800 dark:text-white rounded-3xl'
    }
  });
  if (!res.isConfirmed) return;
  const k = window.impKeys();
  window.globalImportantTasks = window.globalImportantTasks.filter((t => t !== taskName));
  delete window.currentImportantAssigns[taskName];
  if (window.lockedImportantTasks) delete window.lockedImportantTasks[taskName];
  window.importantTaskCfg = window.importantTaskCfg || {};
  delete window.importantTaskCfg[taskName];
  Swal.fire({
    title: 'กำลังลบ...',
    didOpen: () => Swal.showLoading()
  });
  window.clearSettingCache();
  await appDB.from('settings').upsert([ {
    key: k.list,
    value: JSON.stringify(window.globalImportantTasks)
  }, {
    key: k.assign,
    value: JSON.stringify(window.currentImportantAssigns)
  }, {
    key: k.lock,
    value: JSON.stringify(window.lockedImportantTasks)
  }, {
    key: k.cfg,
    value: JSON.stringify(window.importantTaskCfg)
  } ]);
  window.renderImportantTasksPanel();
  Swal.close();
};

window.assignImportantTask = async function(taskName, role) {
  if (window._impDenied()) return;
  role = role === 'support' ? 'support' : 'main';
  const roleLabel = role === 'main' ? 'หลัก' : 'ซัพพอร์ต';
  const k = window.impKeys();
  const cfg = window.impCfgOf(taskName);
  const team = window.impTeamOf(taskName);
  const free = cfg[role] - team[role].length;
  if (free <= 0) return Swal.fire('ครบแล้ว', `${roleLabel}ของงานนี้ครบ ${cfg[role]} คนแล้ว — อยากเพิ่มให้กดปุ่ม ⚙️ ตั้งจำนวนคนก่อนครับ`, 'info');
  const inTask = new Set([ ...team.main, ...team.support ]);
  const busy = window.impBusyMap(taskName);
  const staff = window.getDutyActiveStaff(k.shift, {
    anyRole: true
  }).map((u => u.username)).filter((n => !inTask.has(n))).sort(((a, b) => busy.has(a) - busy.has(b) || a.localeCompare(b)));
  if (staff.length === 0) return Swal.fire('ไม่มีรายชื่อ', 'ไม่มีผู้สอนที่พร้อมทำงานในกะนี้เหลือให้เลือกครับ', 'error');
  const esc = window.escapeHtml;
  const listHtml = staff.map(((n, i) => `\n        <label style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;cursor:pointer;border:1px solid rgba(148,163,184,.2);margin-bottom:6px;text-align:left">\n            <input type="checkbox" class="imp-pick" value="${i}" style="width:16px;height:16px;flex-shrink:0">\n            <span style="font-weight:700;font-size:13px;flex:1">${esc(n)}</span>\n            ${busy.has(n) ? `<span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:6px;background:rgba(245,158,11,.15);color:#f59e0b">มีงาน: ${esc(busy.get(n))}</span>` : ''}\n        </label>`)).join('');
  const {value: picked} = await Swal.fire({
    title: `<div class="text-sm text-gray-400 mb-1">เลือก${roleLabel}ให้งาน:</div><div class="text-amber-500 font-black">${esc(taskName)}</div>`,
    html: `<div style="font-size:12px;opacity:.7;margin-bottom:8px">เลือกได้สูงสุด <b>${free}</b> คน</div>\n               <div style="max-height:320px;overflow-y:auto;padding-right:4px">${listHtml}</div>`,
    showCancelButton: true,
    confirmButtonText: 'มอบหมาย',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#10b981',
    customClass: {
      popup: 'dark:bg-slate-800 dark:text-white rounded-3xl'
    },
    didOpen: () => {
      const boxes = Array.from(document.querySelectorAll('.imp-pick'));
      const sync = () => {
        const n = boxes.filter((b => b.checked)).length;
        boxes.forEach((b => {
          if (!b.checked) b.disabled = n >= free;
          b.parentElement.style.opacity = b.disabled ? '.4' : '1';
        }));
      };
      boxes.forEach((b => b.addEventListener('change', sync)));
    },
    preConfirm: () => {
      const sel = Array.from(document.querySelectorAll('.imp-pick:checked')).map((b => staff[+b.value]));
      if (!sel.length) {
        Swal.showValidationMessage('กรุณาเลือกอย่างน้อย 1 คน');
        return false;
      }
      return sel.slice(0, free);
    }
  });
  if (!picked || !picked.length) return;
  team[role].push(...picked);
  Swal.fire({
    title: 'กำลังบันทึก...',
    didOpen: () => Swal.showLoading()
  });
  try {
    await window.impSaveTeam(taskName, team, `มอบหมายงาน "${taskName}" [${roleLabel}] ให้ ${picked.join(', ')}`);
    Swal.close();
  } catch (e) {
    Swal.close();
  }
};

window.impRemovePerson = async function(taskName, role, name) {
  if (window._impDenied()) return;
  const team = window.impTeamOf(taskName);
  team.main = team.main.filter((n => !(role === 'main' && n === name)));
  team.support = team.support.filter((n => !(role === 'support' && n === name)));
  try {
    await window.impSaveTeam(taskName, team, `ปลด ${name} ออกจากงาน "${taskName}" [${role === 'main' ? 'หลัก' : 'ซัพพอร์ต'}]`);
  } catch (e) {}
};

window.clearSecondaryDuties = async function() {
  if (!window.isDutyAdmin()) return Swal.fire('ไม่มีสิทธิ์', 'เฉพาะผู้จัดเวรเท่านั้นที่ล้างงานรองได้ครับ', 'error');
  if (window.blockIfPreview()) return;
  const targetDate = document.getElementById('dutyDate').value;
  const shiftFilter = document.getElementById('dutyShiftSelect').value;
  if (!targetDate) return Swal.fire('!', 'กรุณาเลือกวันที่ก่อน', 'warning');
  const saveKey = getDutySaveKey(targetDate, shiftFilter);
  let currentDataVal = null;
  try {
    const {data: data} = await appDB.from('settings').select('value').eq('key', saveKey);
    if (data && data.length > 0) currentDataVal = data[0].value;
  } catch (e) {}
  if (!currentDataVal) {
    return Swal.fire('ไม่มีตาราง', 'ยังไม่มีตารางงานในวัน/กะนี้ ไม่มีอะไรให้ล้างครับ', 'info');
  }
  let roster;
  try {
    roster = JSON.parse(currentDataVal);
  } catch (e) {
    return Swal.fire('Error', 'อ่านข้อมูลตารางไม่สำเร็จ', 'error');
  }
  let countHasSecondary = 0;
  for (const team in roster) {
    (roster[team] || []).forEach((u => {
      if (u && u.secondary_team && !u.username.includes('ขาดคน')) countHasSecondary++;
    }));
  }
  if (countHasSecondary === 0) {
    return Swal.fire('ไม่มีงานรอง', 'ยังไม่มีใครได้รับงานรองในวัน/กะนี้ครับ', 'info');
  }
  const confirmRes = await Swal.fire({
    title: 'ยืนยันล้างเฉพาะงานรอง?',
    html: `จะปลดงานรอง (สแตนด์บาย) ของพนักงาน <b class="text-cyan-600">${countHasSecondary} คน</b><br>วันที่ <b>${targetDate}</b> (${shiftFilter})<br><span class="text-[12px] text-gray-500 italic">⚠️ งานหลักจะไม่กระทบ</span>`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#0ea5e9',
    cancelButtonColor: '#64748b',
    cancelButtonText: 'ยกเลิก',
    confirmButtonText: 'ล้างงานรองเลย',
    customClass: {
      popup: 'dark:bg-slate-800 dark:text-white'
    }
  });
  if (!confirmRes.isConfirmed) return;
  Swal.fire({
    title: 'กำลังล้างงานรอง...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });
  try {
    let cleared = 0;
    for (const team in roster) {
      (roster[team] || []).forEach((u => {
        if (u && u.secondary_team) {
          u.secondary_team = null;
          cleared++;
        }
      }));
    }
    window.clearSettingCache();
    window.dutyDbOk(await appDB.from('settings').upsert([ {
      key: saveKey,
      value: JSON.stringify(roster)
    } ]));
    try {
      await appDB.from('system_logs').insert([ {
        action_type: 'ล้างงานรอง',
        performed_by: currentUser.username,
        target_details: `ล้างงานรอง (${currentDutyDept}, ${shiftFilter}, ${targetDate}) → ปลดสแตนด์บาย ${cleared} คน`
      } ]);
    } catch (e) {}
    try {
      if (appDB.channel) window.debouncedBroadcast('duty-updates', 'force_reload');
    } catch (e) {}
    if (typeof window.renderRosterGrid === 'function') {
      window.renderRosterGrid(roster);
    } else if (typeof window.refreshDutyData === 'function') {
      window.refreshDutyData();
    }
    Swal.fire({
      icon: 'success',
      title: 'ล้างงานรองเรียบร้อย',
      text: `ปลดงานรองออกแล้ว ${cleared} คน`,
      timer: 1500,
      showConfirmButton: false
    });
  } catch (e) {
    Swal.fire('Error', e.message, 'error');
  }
};

window.quickAssignBackups = async function() {
  if (!window.isDutyAdmin()) return Swal.fire('ไม่มีสิทธิ์', 'เฉพาะผู้จัดเวรเท่านั้นที่แจกงานรองได้ครับ', 'error');
  if (window.blockIfPreview()) return;
  const targetDate = document.getElementById('dutyDate').value;
  const shiftFilter = document.getElementById('dutyShiftSelect').value;
  if (!targetDate) return Swal.fire('เตือน', 'กรุณาเลือกวันที่ก่อน', 'warning');
  const saveKey = getDutySaveKey(targetDate, shiftFilter);
  let currentDataVal = null;
  try {
    const {data: data} = await appDB.from('settings').select('value').eq('key', saveKey);
    if (data && data.length > 0) currentDataVal = data[0].value;
  } catch (e) {}
  if (!currentDataVal) return Swal.fire('เตือน', 'คุณต้องกด "สุ่มจัดหน้าที่" (สำหรับตำแหน่งหลัก) ให้เสร็จก่อนครับ', 'warning');
  let roster = JSON.parse(currentDataVal);
  let bkRotation = null;
  try {
    if (typeof window.loadDutyRotationHistory === 'function') {
      bkRotation = await window.loadDutyRotationHistory(targetDate, shiftFilter);
    }
  } catch (e) {
    console.warn('[backup] โหลดประวัติไม่สำเร็จ ข้ามกฎกันซ้ำ', e);
  }
  const _gapDays = typeof window.getRotationGapDays === 'function' ? window.getRotationGapDays() : 3;
  const touchedYesterday = (uid, team) => {
    if (!bkRotation) return false;
    const p = window.dutyDaysAgoOnTeam ? window.dutyDaysAgoOnTeam(bkRotation, uid, team) : Infinity;
    const s = window.dutyDaysAgoOnSecTeam ? window.dutyDaysAgoOnSecTeam(bkRotation, uid, team) : Infinity;
    return Math.min(p, s) <= Math.max(1, _gapDays);
  };
  const daysAwayFromTeam = (uid, team) => {
    if (!bkRotation) return Infinity;
    const p = window.dutyDaysAgoOnTeam ? window.dutyDaysAgoOnTeam(bkRotation, uid, team) : Infinity;
    const s = window.dutyDaysAgoOnSecTeam ? window.dutyDaysAgoOnSecTeam(bkRotation, uid, team) : Infinity;
    return Math.min(p, s);
  };
  Swal.fire({
    title: 'กำลังจับคู่งานรอง...',
    html: '<span class="text-sm text-gray-500">🌱 Phase 1: เติมเว็บที่ยังไม่มีรองให้ครบก่อน...</span>',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });
  let breakTimes = {};
  if (window.currentDutySchedules) {
    window.currentDutySchedules.forEach((s => {
      if (!breakTimes[s.staff_name]) breakTimes[s.staff_name] = [];
      breakTimes[s.staff_name].push(s.time_slot);
    }));
  }
  let availableForBackup = [];
  for (const team in roster) {
    roster[team].forEach((u => {
      if (!u.username.includes('ขาดคน') && !u.secondary_team) {
        availableForBackup.push({
          ...u,
          primaryTeam: team
        });
      }
    }));
  }
  const wouldBreakCap = (c, team) => {
    const members = [];
    (roster[team] || []).forEach((u => {
      if (u && u.id && !String(u.username || '').includes('ขาดคน')) members.push(u.username);
    }));
    for (const t in roster) (roster[t] || []).forEach((u => {
      if (u && u.secondary_team === team && !members.includes(u.username)) members.push(u.username);
    }));
    if (!members.includes(c.username)) members.push(c.username);
    const _shiftSel = document.getElementById('dutyShiftSelect');
    const _raw = typeof window.getBreakMinRemainRaw === 'function' && _shiftSel ? window.getBreakMinRemainRaw(currentDutyDept, _shiftSel.value, team) : null;
    const _remain = _raw === null ? 1 : _raw;
    const cap = Math.max(0, members.length - _remain);
    const cBreaks = breakTimes[c.username] || [];
    for (const slot of cBreaks) {
      let others = 0;
      members.forEach((n => {
        if (n !== c.username && (breakTimes[n] || []).includes(slot)) others++;
      }));
      if (others >= cap) return {
        slot: slot,
        others: others,
        cap: cap
      };
    }
    return null;
  };
  const countBackupsForTeam = team => {
    let n = 0;
    for (const t in roster) {
      roster[t].forEach((u => {
        if (u.secondary_team === team) n++;
      }));
    }
    return n;
  };
  const noBackupReasons = {};
  const phase1FillEmptyTeams = mode => {
    let count = 0;
    const emptyTeams = sortedTeams.filter((t => {
      const primaries = (roster[t] || []).filter((u => !u.username.includes('ขาดคน')));
      if (primaries.length === 0) return false;
      return countBackupsForTeam(t) === 0;
    }));
    emptyTeams.sort((() => Math.random() - .5));
    emptyTeams.forEach((targetTeam => {
      const primaries = (roster[targetTeam] || []).filter((u => !u.username.includes('ขาดคน')));
      let candidates = availableForBackup.filter((c => {
        if (c.secondary_team) return false;
        if (c.primaryTeam === targetTeam) return false;
        const access = dutyAccessMatrix[c.id] || [];
        if (!access.includes(targetTeam)) return false;
        if (wouldBreakCap(c, targetTeam)) return false;
        return true;
      }));
      if (candidates.length === 0) {
        noBackupReasons[targetTeam] = 'ไม่มีใครที่พักไม่ชน';
        return;
      }
      candidates = candidates.filter((c => !touchedYesterday(c.id, targetTeam)));
      if (candidates.length === 0) {
        noBackupReasons[targetTeam] = 'ทุกคนติดกติกาเว้นซ้ำเว็บ';
        return;
      }
      candidates.sort(((a, b) => {
        const accessA = (dutyAccessMatrix[a.id] || []).length;
        const accessB = (dutyAccessMatrix[b.id] || []).length;
        if (accessA !== accessB) return accessA - accessB;
        const awayA = daysAwayFromTeam(a.id, targetTeam);
        const awayB = daysAwayFromTeam(b.id, targetTeam);
        if (awayA !== awayB) return awayB - awayA;
        return Math.random() - .5;
      }));
      const chosen = candidates[0];
      const userInRoster = roster[chosen.primaryTeam].find((u => u.id === chosen.id));
      if (userInRoster && !userInRoster.secondary_team) {
        userInRoster.secondary_team = targetTeam;
        const availIndex = availableForBackup.findIndex((a => a.id === chosen.id));
        if (availIndex > -1) availableForBackup[availIndex].secondary_team = targetTeam;
        count++;
      }
    }));
    return count;
  };
  const phase2DistributeRest = mode => {
    let count = 0;
    const peopleToAssign = availableForBackup.filter((c => !c.secondary_team)).sort((() => Math.random() - .5));
    peopleToAssign.forEach((c => {
      const cBreaks = breakTimes[c.username] || [];
      const access = dutyAccessMatrix[c.id] || [];
      let validTeams = sortedTeams.filter((t => {
        if (t === c.primaryTeam) return false;
        if (!access.includes(t)) return false;
        const primaries = (roster[t] || []).filter((u => !u.username.includes('ขาดคน')));
        if (primaries.length === 0) return false;
        if (wouldBreakCap(c, t)) return false;
        return true;
      }));
      if (validTeams.length === 0) return;
      validTeams = validTeams.filter((t => !touchedYesterday(c.id, t)));
      if (validTeams.length === 0) return;
      validTeams.sort(((a, b) => {
        const cA = countBackupsForTeam(a);
        const cB = countBackupsForTeam(b);
        if (cA !== cB) return cA - cB;
        const awayA = daysAwayFromTeam(c.id, a);
        const awayB = daysAwayFromTeam(c.id, b);
        if (awayA !== awayB) return awayB - awayA;
        return Math.random() - .5;
      }));
      const chosenTeam = validTeams[0];
      const userInRoster = roster[c.primaryTeam].find((u => u.id === c.id));
      if (userInRoster && !userInRoster.secondary_team) {
        userInRoster.secondary_team = chosenTeam;
        const availIndex = availableForBackup.findIndex((a => a.id === c.id));
        if (availIndex > -1) availableForBackup[availIndex].secondary_team = chosenTeam;
        count++;
      }
    }));
    return count;
  };
  const pass1Count = phase1FillEmptyTeams('strict');
  Swal.update({
    html: '<span class="text-sm text-gray-500">📊 Phase 2: กระจายคนที่เหลือเข้าเว็บรองน้อยสุด...</span>'
  });
  await new Promise((r => setTimeout(r, 200)));
  const pass2Count = phase2DistributeRest('strict');
  let totalUnassignedSlots = 0;
  for (const team in roster) {
    roster[team].forEach((u => {
      if (!u.username.includes('ขาดคน') && !u.secondary_team) totalUnassignedSlots++;
    }));
  }
  window.clearSettingCache();
  const {error: qaErr} = await appDB.from('settings').upsert([ {
    key: saveKey,
    value: JSON.stringify(roster)
  } ]);
  if (qaErr) return Swal.fire('บันทึกไม่สำเร็จ', qaErr.message, 'error');
  window.renderRosterGrid(roster);
  try {
    if (appDB.channel) window.debouncedBroadcast('duty-updates', 'force_reload');
  } catch (e) {}
  try {
    await appDB.from('system_logs').insert([ {
      action_type: 'แจกงานรอง',
      performed_by: currentUser.username,
      target_details: `แจกงานรอง (${currentDutyDept}, ${shiftFilter}, ${targetDate}) → กระจายให้ครบ: ${pass1Count} คน, เก็บตก: ${pass2Count} คน, ไม่ได้: ${totalUnassignedSlots} คน`
    } ]);
  } catch (e) {}
  const totalSuccess = pass1Count + pass2Count;
  let emptyTeamCount = 0;
  sortedTeams.forEach((t => {
    const primaries = (roster[t] || []).filter((u => !u.username.includes('ขาดคน')));
    if (primaries.length > 0 && countBackupsForTeam(t) === 0) emptyTeamCount++;
  }));
  let resultHtml = `\n        <div class="text-left text-sm space-y-2 mt-2">\n            <div class="flex justify-between items-center bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-2.5 rounded-lg shadow-sm">\n                <span class="font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">\n                    <span class="material-icons text-[16px]">spa</span> Phase 1 — กระจายให้ครบทุกเว็บ:\n                </span>\n                <span class="font-black text-emerald-600 dark:text-emerald-400 text-base">${pass1Count} คน</span>\n            </div>\n            <div class="flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-2.5 rounded-lg shadow-sm">\n                <span class="font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">\n                    <span class="material-icons text-[16px]">balance</span> Phase 2 — เก็บตก/Load balance:\n                </span>\n                <span class="font-black text-blue-600 dark:text-blue-400 text-base">${pass2Count} คน</span>\n            </div>`;
  const noBackupList = sortedTeams.filter((t => {
    const primaries = (roster[t] || []).filter((u => !u.username.includes('ขาดคน')));
    return primaries.length > 0 && countBackupsForTeam(t) === 0;
  }));
  if (noBackupList.length > 0) {
    resultHtml += `\n            <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-2.5 rounded-lg shadow-sm text-left">\n                <div class="font-bold text-red-700 dark:text-red-300 flex items-center gap-1.5 text-xs"><span class="material-icons text-[16px]">report</span> เว็บที่หารองไม่ได้ (ทุกคนที่เข้าได้ พักชนกับคนในเว็บจนเกินเพดาน):</div>\n                <div class="mt-1 text-[11px] text-red-600 dark:text-red-400 font-bold">${noBackupList.join(', ')}</div>\n                <div class="mt-1 text-[10px] text-gray-500">→ ปรับเวลาพักของคนในเว็บ หรือลากคนมาเป็นรองเอง (การ์ดจะเตือนถ้าพักชน)</div>\n            </div>`;
  }
  if (emptyTeamCount > 0 && noBackupList.length === 0) {
    resultHtml += `\n            <div class="flex justify-between items-center bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-2.5 rounded-lg shadow-sm">\n                <span class="font-bold text-red-700 dark:text-red-300 flex items-center gap-1.5">\n                    <span class="material-icons text-[16px]">warning</span> เว็บที่ยังว่าง:\n                </span>\n                <span class="font-black text-red-600 dark:text-red-400 text-base">${emptyTeamCount} เว็บ</span>\n            </div>`;
  }
  if (totalUnassignedSlots > 0) {
    resultHtml += `\n            <div class="flex justify-between items-center bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-2.5 rounded-lg shadow-sm">\n                <span class="font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">\n                    <span class="material-icons text-[16px]">person_off</span> คนที่ไม่มีงานรอง:\n                </span>\n                <span class="font-black text-amber-600 dark:text-amber-400 text-base">${totalUnassignedSlots} คน</span>\n            </div>\n            <div class="text-[11px] text-gray-500 dark:text-gray-400 italic px-2 pt-1 border-t border-gray-200 dark:border-slate-700 mt-2">\n                💡 <b>คนที่ไม่มีรอง</b> = ไม่มีสิทธิ์เว็บอื่น หรือเวลาพักชนกับทุกเว็บที่เข้าได้\n            </div>`;
  }
  resultHtml += `</div>`;
  Swal.fire({
    icon: emptyTeamCount === 0 && totalUnassignedSlots === 0 ? 'success' : 'info',
    title: emptyTeamCount === 0 && totalUnassignedSlots === 0 ? `<div class="text-emerald-500 font-black">🎉 กระจายครบทุกเว็บ + ทุกคนได้งานรอง!</div>` : emptyTeamCount === 0 ? `<div class="text-emerald-500 font-black">✅ ทุกเว็บมีรองครบแล้ว</div>` : `<div class="text-amber-500 font-black">แจกได้ ${totalSuccess} คน</div>`,
    html: resultHtml,
    confirmButtonText: 'ตกลง',
    confirmButtonColor: totalUnassignedSlots === 0 ? '#10b981' : '#f59e0b',
    customClass: {
      popup: 'dark:bg-slate-800 dark:text-white rounded-3xl border border-slate-700 shadow-2xl'
    }
  });
};

window.ensureDutyExtraButtons = function() {
  const dutyApp = document.getElementById('dutyApp');
  if (!dutyApp) return;
  if (!document.getElementById('btnQuickBackup')) {
    const clearBtn = document.querySelector('button[onclick*="clearDutyRoster"]');
    if (clearBtn) {
      const btn = document.createElement('button');
      btn.id = 'btnQuickBackup';
      btn.className = 'duty-admin-only bg-fuchsia-600 hover:bg-fuchsia-500 text-white px-3 py-1.5 rounded-md text-xs font-bold shadow-md transition flex items-center gap-1 active:scale-95 ml-3 border border-fuchsia-400';
      btn.innerHTML = '<span class="material-icons text-[14px]">bolt</span> จัดรองด่วน (AI)';
      btn.onclick = window.quickAssignBackups;
      clearBtn.parentNode.insertBefore(btn, clearBtn.nextSibling);
      if (typeof window.applyDutyRoleUI === 'function') window.applyDutyRoleUI();
    }
  }
  if (!document.getElementById('btnClearSecondary')) {
    const addStaffBtn = document.querySelector('button[onclick*="addStaffToRoster"]');
    if (addStaffBtn) {
      const btn = document.createElement('button');
      btn.id = 'btnClearSecondary';
      btn.className = 'duty-admin-only bg-cyan-600 hover:bg-cyan-500 text-white text-sm px-4 py-1.5 rounded-lg shadow-md font-bold transition flex items-center gap-1 transform active:scale-95 border border-cyan-400';
      btn.innerHTML = '<span class="material-icons text-base">layers_clear</span> ล้างงานรอง';
      btn.title = 'ล้างเฉพาะงานรอง (สแตนด์บาย) — งานหลักไม่กระทบ';
      btn.onclick = window.clearSecondaryDuties;
      addStaffBtn.parentNode.insertBefore(btn, addStaffBtn.nextSibling);
      if (typeof window.applyDutyRoleUI === 'function') window.applyDutyRoleUI();
    }
  }
};
