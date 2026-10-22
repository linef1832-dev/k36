window.restoreDutyRoster = async function() {
  const targetDate = document.getElementById('dutyDate').value;
  const shiftFilter = document.getElementById('dutyShiftSelect').value;
  if (!targetDate) return Swal.fire('!', 'กรุณาเลือกวันที่ก่อน', 'warning');
  const saveKey = getDutySaveKey(targetDate, shiftFilter);
  let backupData = null;
  try {
    const {data: data} = await appDB.from('settings').select('value').eq('key', `backup_${saveKey}`);
    if (data && data.length > 0 && data[0].value) backupData = data[0].value;
  } catch (e) {}
  if (!backupData) backupData = window.safeGetItem(`backup_${saveKey}`, null);
  if (!backupData) {
    return Swal.fire('ไม่พบข้อมูล', 'ไม่มีข้อมูลสำรองสำหรับกะและวันที่นี้ครับ', 'error');
  }
  Swal.fire({
    title: 'ยืนยันการกู้คืน?',
    text: `ต้องการกู้คืนตารางงานของวันที่ ${targetDate} (${shiftFilter}) ใช่หรือไม่?`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#10b981',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'กู้คืนเลย',
    cancelButtonText: 'ยกเลิก',
    customClass: {
      popup: 'dark:bg-slate-800 dark:text-white rounded-3xl'
    }
  }).then((async result => {
    if (result.isConfirmed) {
      Swal.fire({
        title: 'กำลังกู้คืนข้อมูล...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });
      try {
        window.clearSettingCache();
        window.dutyDbOk(await appDB.from('settings').upsert([ {
          key: saveKey,
          value: backupData
        } ]));
        await appDB.from('system_logs').insert([ {
          action_type: 'กู้คืนตารางงาน',
          performed_by: currentUser.username,
          target_details: `กู้คืนตาราง ${currentDutyDept} (${shiftFilter}, ${targetDate})`
        } ]);
        if (appDB.channel) window.debouncedBroadcast('duty-updates', 'force_reload');
        Swal.fire({
          icon: 'success',
          title: 'กู้คืนตารางเรียบร้อย',
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

window.currentMergeRooms = [];

let mergeRoomDragSource = null;

window.shuffleMergeRooms = async function() {
  const targetDate = document.getElementById('dutyDate').value;
  const shiftFilter = document.getElementById('dutyShiftSelect').value;
  const amqlSaveKey = `duty_roster_AMQL_${targetDate}_${shiftFilter}`;
  let amqlRoster = {};
  try {
    const {data: data} = await appDB.from('settings').select('value').eq('key', amqlSaveKey);
    if (data && data.length > 0 && data[0].value) amqlRoster = JSON.parse(data[0].value);
  } catch (e) {}
  const shuffle = arr => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [ arr[j], arr[i] ];
    }
    return arr;
  };
  const teamsWithAMQL = [];
  const teamsWithoutAMQL = [];
  sortedTeams.forEach((team => {
    const assignees = (amqlRoster[team] || []).filter((u => !u.username?.includes('ขาดคน')));
    if (assignees.length > 0) teamsWithAMQL.push(team); else teamsWithoutAMQL.push(team);
  }));
  shuffle(teamsWithAMQL);
  shuffle(teamsWithoutAMQL);
  const totalTeams = sortedTeams.length;
  const numRooms = Math.floor(totalTeams / 2);
  const rooms = Array.from({
    length: numRooms
  }, ((_, i) => ({
    id: i + 1,
    teams: []
  })));
  const amqlQueue = [ ...teamsWithAMQL ];
  const noAmqlQueue = [ ...teamsWithoutAMQL ];
  rooms.forEach((room => {
    if (amqlQueue.length > 0) room.teams.push(amqlQueue.shift()); else if (noAmqlQueue.length > 0) room.teams.push(noAmqlQueue.shift());
  }));
  rooms.forEach((room => {
    const hasAMQL = room.teams.some((t => teamsWithAMQL.includes(t)));
    if (hasAMQL) {
      if (amqlQueue.length > 0) room.teams.push(amqlQueue.shift()); else if (noAmqlQueue.length > 0) room.teams.push(noAmqlQueue.shift());
    } else {
      if (amqlQueue.length > 0) room.teams.push(amqlQueue.shift());
    }
  }));
  const remaining = [ ...amqlQueue, ...noAmqlQueue ];
  remaining.forEach((team => {
    let eligibleRooms = rooms.filter((r => {
      const amqlCount = r.teams.filter((t => teamsWithAMQL.includes(t))).length;
      return amqlCount >= 2;
    }));
    if (eligibleRooms.length === 0) {
      eligibleRooms = rooms.filter((r => r.teams.some((t => teamsWithAMQL.includes(t)))));
    }
    if (eligibleRooms.length === 0) eligibleRooms = rooms;
    eligibleRooms.sort(((a, b) => a.teams.length - b.teams.length));
    eligibleRooms[0].teams.push(team);
  }));
  window.currentMergeRooms = rooms;
  if (typeof window.renderImportantTasksPanel === 'function') window.renderImportantTasksPanel();
};

window.mergeRoomDragStart = function(e, roomId, team) {
  mergeRoomDragSource = {
    roomId: roomId,
    team: team
  };
  e.dataTransfer.effectAllowed = 'move';
  e.currentTarget.style.opacity = '0.5';
};

window.mergeRoomDragEnd = function(e) {
  e.currentTarget.style.opacity = '1';
  document.querySelectorAll('.merge-room-card').forEach((el => el.classList.remove('border-violet-400', 'bg-violet-900/20')));
};

window.mergeRoomDragOver = function(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const card = e.currentTarget;
  card.classList.add('border-violet-400', 'bg-violet-900/20');
};

window.shuffleMergeRoomsInline = async function() {
  await window.shuffleMergeRooms();
  window.renderImportantTasksPanel();
};

window.saveMergeRooms = async function() {
  if (!window.isDutyAdmin()) return;
  const targetDate = document.getElementById('dutyDate').value;
  const shiftFilter = document.getElementById('dutyShiftSelect').value;
  const key = window.dutyMergeKey(targetDate, shiftFilter, currentDutyDept);
  Swal.fire({
    title: 'กำลังบันทึก...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });
  try {
    window.clearSettingCache();
    const {error: error} = await appDB.from('settings').upsert([ {
      key: key,
      value: JSON.stringify(window.currentMergeRooms)
    } ]);
    if (error) throw error;
    window.savedMergeRooms = [ ...window.currentMergeRooms ];
    try {
      await appDB.from('system_logs').insert([ {
        action_type: 'รวมห้อง Discord',
        performed_by: currentUser.username,
        target_details: `บันทึกการรวมห้อง (${shiftFilter}, ${targetDate}) — ` + window.currentMergeRooms.map((r => `ห้อง ${r.id}: ${r.teams.join('+')}`)).join(' | ')
      } ]);
    } catch (e) {}
    window.debouncedBroadcast('duty-updates', 'force_reload');
    window.renderImportantTasksPanel();
    Swal.fire({
      icon: 'success',
      title: 'บันทึกการรวมห้องแล้ว!',
      timer: 1500,
      showConfirmButton: false
    });
  } catch (e) {
    Swal.fire('Error', e.message, 'error');
  }
};

window.deleteMergeRooms = function() {
  Swal.fire({
    title: 'ลบการรวมห้อง?',
    text: 'จะสามารถสุ่มรวมห้องใหม่ได้หลังจากลบ',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    confirmButtonText: 'ลบเลย',
    cancelButtonText: 'ยกเลิก'
  }).then((async result => {
    if (result.isConfirmed) {
      const targetDate = document.getElementById('dutyDate').value;
      const shiftFilter = document.getElementById('dutyShiftSelect').value;
      const key = window.dutyMergeKey(targetDate, shiftFilter, currentDutyDept);
      try {
        window.clearSettingCache();
        await appDB.from('settings').delete().eq('key', key);
        try {
          localStorage.removeItem(key);
        } catch (e) {}
        try {
          await appDB.from('system_logs').insert([ {
            action_type: 'รวมห้อง Discord',
            performed_by: currentUser.username,
            target_details: `ลบการรวมห้อง (${shiftFilter}, ${targetDate})`
          } ]);
        } catch (e) {}
        window.debouncedBroadcast('duty-updates', 'force_reload');
      } catch (e) {
        return Swal.fire('Error', e.message, 'error');
      }
      try {
        await appDB.from('settings').delete().eq('key', window.dutyMergeKeyLegacy(targetDate, shiftFilter));
      } catch (e) {}
      window.savedMergeRooms = [];
      window.currentMergeRooms = [];
      window.renderImportantTasksPanel();
    }
  }));
};

window.mergeRoomDropInline = function(e, targetRoomId) {
  e.preventDefault();
  document.querySelectorAll('.merge-room-drop').forEach((el => el.classList.remove('bg-violet-900/20')));
  if (!mergeRoomDragSource) return;
  const {roomId: srcRoomId, team: team} = mergeRoomDragSource;
  if (srcRoomId === targetRoomId) return;
  const rooms = window.currentMergeRooms;
  const srcRoom = rooms.find((r => r.id === srcRoomId));
  const tgtRoom = rooms.find((r => r.id === targetRoomId));
  if (!srcRoom || !tgtRoom) return;
  srcRoom.teams = srcRoom.teams.filter((t => t !== team));
  tgtRoom.teams.push(team);
  mergeRoomDragSource = null;
  window.renderImportantTasksPanel();
};

const SHIFT_CONFIG = {
  'กะเช้า': {
    start: 8 * 60,
    end: 20 * 60
  },
  'กะดึก': {
    start: 20 * 60,
    end: 32 * 60
  }
};

function timeToMin(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minToTime(m) {
  const total = (m % (24 * 60) + 24 * 60) % (24 * 60);
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

window.renderHelpCalcPanel = function() {
  const panel = document.getElementById('importantTasksPanel');
  if (!panel || currentDutyDept !== 'AM') return;
  const shiftFilter = document.getElementById('dutyShiftSelect').value;
  const cfg = SHIFT_CONFIG[shiftFilter];
  if (!cfg) return;
  const roster = currentRosterData || {};
  const schedules = window.currentDutySchedules || [];
  const allTeams = sortedTeams || TEAM_LIST;
  const isAdmin = window.isDutyAdmin();
  const roster0 = currentRosterData || {};
  const headCount = t => (roster0[t] || []).filter((u => u && u.id && !String(u.username || '').includes('ขาดคน'))).length;
  const staffedTeams = allTeams.filter((t => headCount(t) > 0));
  const defSource = staffedTeams[0] || allTeams[0];
  const defTarget = allTeams.find((t => t !== defSource)) || allTeams[0];
  const prefOk = window.supportWindowPref && window.supportWindowPref.shift === shiftFilter;
  const fullStart = minToTime(cfg.start);
  const fullEnd = minToTime(cfg.end);
  const winStart = prefOk ? window.supportWindowPref.start : fullStart;
  const winEnd = prefOk ? window.supportWindowPref.end : fullEnd;
  const isCustomWin = winStart !== fullStart || winEnd !== fullEnd;
  const optsFor = (sel, srcMode) => allTeams.map((t => {
    const n = headCount(t);
    const dis = srcMode && n === 0 ? 'disabled' : '';
    return `<option value="${t}" ${t === sel ? 'selected' : ''} ${dis}>${t}${n ? ` (${n} คน)` : ' — ว่าง'}</option>`;
  })).join('');
  const assigned = Object.entries(window.currentSupportData || {});
  const assignedHtml = assigned.length === 0 ? `<div class="text-center text-[10.5px] text-slate-500 py-1.5">ยังไม่มีเว็บไหนได้รับซัพพอร์ต</div>` : assigned.map((([entryKey, info]) => {
    const target = info.target || entryKey;
    const c = TEAM_COLORS[target] || TEAM_COLORS['DEFAULT'];
    const rows = (info.slots || []).map(((s, i) => `\n                <div class="flex items-center gap-2 py-1 border-b border-slate-700/30 last:border-0">\n                    <span class="w-4 h-4 rounded-full bg-cyan-700 text-white text-[9px] font-black flex items-center justify-center shrink-0">${i + 1}</span>\n                    <span class="flex-1 min-w-0 text-[11px] font-black text-white truncate">${window.escapeHtml(s.name)}</span>\n                    <span class="text-[10px] text-cyan-300 font-bold shrink-0">${minToTime(s.start)}–${minToTime(s.end)}</span>\n                    <span class="text-[9px] shrink-0 ${s.breakMin > 0 ? 'text-amber-400' : 'text-emerald-400'}">${s.breakMin > 0 ? `พัก ${s.breakMin}น.` : 'ว่าง'}</span>\n                </div>`)).join('');
    return `\n                <div class="mb-2 last:mb-0">\n                    <div class="flex items-center gap-1 mb-1 flex-wrap">\n                        <span class="text-[10px] font-black px-2 py-0.5 rounded border ${c.border} ${c.lightBg} ${c.lightText}">🤝 ${info.source} → ${target}</span>\n                        ${info.win ? `<span class="text-[9px] font-bold text-cyan-300 bg-cyan-900/40 border border-cyan-700/50 px-1.5 py-0.5 rounded">${minToTime(info.win.start)}–${minToTime(info.win.end)}</span>` : ''}\n                        ${isAdmin ? `<button onclick="window.clearSupportForTarget('${entryKey}')" title="ลบตารางนี้" class="ml-auto text-red-400 hover:text-red-300 flex items-center"><span class="material-icons text-[13px]">delete</span></button>` : ''}\n                    </div>\n                    <div class="bg-slate-800/50 rounded-lg px-2 py-1">${rows}</div>\n                </div>`;
  })).join('');
  const supportPanelHtml = `\n        <div class="bg-[#151f32] border border-cyan-700/60 rounded-2xl shadow-lg overflow-hidden mt-3">\n            <div class="bg-gradient-to-r from-cyan-700 to-teal-600 text-white px-3 py-2 flex items-center gap-2">\n                <span class="material-icons text-[16px]">groups</span>\n                <h4 class="font-black text-xs tracking-wide">จัดคนซัพพอร์ตข้ามเว็บ</h4>\n            </div>\n            ${isAdmin ? `\n            <div class="p-2.5 border-b border-slate-700/50 flex flex-col gap-1.5">\n                <div class="flex items-center gap-1.5">\n                    <select id="supportSourceSel" class="flex-1 min-w-0 bg-slate-900 border border-slate-600 text-white text-[10.5px] font-bold rounded-lg px-1.5 py-1.5 outline-none focus:border-cyan-500">${optsFor(defSource, true)}</select>\n                    <span class="material-icons text-cyan-400 text-[15px] shrink-0">east</span>\n                    <select id="supportTargetSel" class="flex-1 min-w-0 bg-slate-900 border border-slate-600 text-white text-[10.5px] font-bold rounded-lg px-1.5 py-1.5 outline-none focus:border-cyan-500">${optsFor(defTarget, false)}</select>\n                </div>\n                <div class="flex items-center gap-1.5">\n                    <span class="material-icons text-slate-500 text-[13px] shrink-0" title="ช่วงเวลาที่ต้องการซัพพอร์ต">schedule</span>\n                    <input id="supportStartTime" type="time" value="${winStart}" onchange="window.rememberSupportWindow()"\n                        class="flex-1 min-w-0 bg-slate-900 border border-slate-600 text-white text-[10.5px] font-bold rounded-lg px-1.5 py-1 outline-none focus:border-cyan-500">\n                    <span class="text-slate-500 text-[10px] shrink-0">ถึง</span>\n                    <input id="supportEndTime" type="time" value="${winEnd}" onchange="window.rememberSupportWindow()"\n                        class="flex-1 min-w-0 bg-slate-900 border border-slate-600 text-white text-[10.5px] font-bold rounded-lg px-1.5 py-1 outline-none focus:border-cyan-500">\n                    ${isCustomWin ? `<button onclick="window.resetSupportWindow()" title="กลับไปเต็มกะ" class="text-slate-400 hover:text-cyan-300 shrink-0 flex items-center"><span class="material-icons text-[14px]">restart_alt</span></button>` : ''}\n                </div>\n                <button onclick="window.assignSupportTeam()" class="w-full bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-black py-1.5 rounded-lg transition flex items-center justify-center gap-1 active:scale-95 shadow">\n                    <span class="material-icons text-[14px]">bolt</span> จัดคนซัพพอร์ต\n                </button>\n                <div class="text-[9.5px] text-slate-500 leading-relaxed">คนของเว็บต้นทางจะผลัดกันไปประจำเว็บเป้าหมาย แบ่งช่วงเวลาที่กำหนดให้เท่าๆ กัน และเลี่ยงเวลาพักให้อัตโนมัติ${isCustomWin ? '' : ' — ตอนนี้ตั้งเป็นเต็มกะ'}</div>\n            </div>` : ''}\n            <div class="p-2.5">${assignedHtml}</div>\n        </div>`;
  let resultHtml = `<div class="text-center text-[11px] text-slate-500 py-2">กดคำนวณเพื่อแบ่งเวลาให้ทุกเว็บ</div>`;
  if (window.helpCalcResult && window.helpCalcResult.length > 0) {
    const grouped = {};
    window.helpCalcResult.forEach((item => {
      if (!grouped[item.team]) grouped[item.team] = [];
      grouped[item.team].push(item);
    }));
    resultHtml = Object.keys(grouped).map((team => {
      const colorClass = TEAM_COLORS[team] || TEAM_COLORS['DEFAULT'];
      const membersHtml = grouped[team].map(((item, i) => {
        const breakNote = item.breakMin > 0 ? `<span class="text-[9px] text-amber-400 ml-1">(พักใน ${item.breakMin}น.)</span>` : `<span class="text-[9px] text-emerald-400 ml-1">(ไม่มีพัก)</span>`;
        return `\n                <div class="flex items-center gap-2 py-1 border-b border-slate-700/30 last:border-0">\n                    <span class="w-4 h-4 rounded-full bg-sky-700 text-white text-[9px] font-black flex items-center justify-center shrink-0">${i + 1}</span>\n                    <div class="flex-1 min-w-0">\n                        <span class="text-[11px] font-black text-white">${window.escapeHtml(item.name)}</span>\n                        <span class="text-[10px] text-sky-400 font-bold ml-1.5">${minToTime(item.helpStart)}–${minToTime(item.helpEnd)}</span>\n                        ${breakNote}\n                    </div>\n                </div>`;
      })).join('');
      return `\n                <div class="mb-2 last:mb-0">\n                    <div class="text-[10px] font-black px-2 py-0.5 rounded mb-1 inline-block border ${colorClass.border} ${colorClass.lightBg} ${colorClass.lightText}">${team} · ${grouped[team].length} คน · คนละ ${Math.floor(720 / grouped[team].length)} นาที</div>\n                    <div class="bg-slate-800/50 rounded-lg px-2 py-1">${membersHtml}</div>\n                </div>`;
    })).join('');
  }
  const calcHtml = `\n        <div class="bg-[#151f32] border border-sky-700/60 rounded-2xl shadow-lg overflow-hidden mt-3">\n            <div class="bg-gradient-to-r from-sky-700 to-cyan-600 text-white px-3 py-2 flex items-center justify-between">\n                <div class="flex items-center gap-2">\n                    <span class="material-icons text-[16px]">support_agent</span>\n                    <h4 class="font-black text-xs tracking-wide">ตารางซัพพอร์ต</h4>\n                </div>\n                <div class="flex gap-1">\n                    ${window.helpCalcResult && window.helpCalcResult.length > 0 ? `\n                    <button onclick="window.clearHelpCalc()" class="bg-red-600/80 hover:bg-red-600 px-2 py-1 rounded text-[10px] font-bold transition flex items-center gap-1 border border-red-400/50 active:scale-95">\n                        <span class="material-icons text-[11px]">delete</span> ลบ\n                    </button>` : ''}\n                    <button onclick="window.calcHelpTime()" class="bg-black/20 hover:bg-black/30 text-white text-[11px] px-3 py-1 rounded-lg font-bold transition flex items-center gap-1 active:scale-95 border border-white/20">\n                        <span class="material-icons text-[13px]">play_arrow</span> คำนวณ\n                    </button>\n                </div>\n            </div>\n            <div class="flex flex-col p-2.5 gap-1">${resultHtml}</div>\n        </div>`;
  const existing = panel.querySelector('#helpCalcSection');
  if (existing) existing.remove();
  const div = document.createElement('div');
  div.id = 'helpCalcSection';
  div.innerHTML = supportPanelHtml + calcHtml;
  panel.appendChild(div);
};

window.clearHelpCalc = function() {
  window.helpCalcResult = null;
  window.renderHelpCalcPanel();
};

window.getOdDiscordRooms = function() {
  try {
    const raw = SETTINGS['discord_rooms_OD'];
    const a = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(a) && a.length) return a.map((x => String(x).trim())).filter(Boolean);
  } catch (e) {}
  return [ 'ห้อง 1', 'ห้อง 2' ];
};

window.assignOdRooms = function(rosterResult, rooms) {
  const sizes = Object.keys(rosterResult || {}).map((t => ({
    t: t,
    n: (rosterResult[t] || []).filter((u => u && u.username && !String(u.username).includes('ขาดคน'))).length
  }))).filter((x => x.n > 0));
  sizes.sort(((a, b) => b.n - a.n || a.t.localeCompare(b.t)));
  const load = rooms.map((() => 0));
  const map = {};
  sizes.forEach((x => {
    let mi = 0;
    for (let i = 1; i < load.length; i++) if (load[i] < load[mi]) mi = i;
    map[x.t] = rooms[mi];
    load[mi] += x.n;
  }));
  return map;
};

window.configOdDiscordRooms = async function() {
  const rooms = window.getOdDiscordRooms();
  const r = await Swal.fire({
    title: '🎧 ห้อง Discord (OD)',
    html: `<div style="font-size:12px;color:var(--k-tx3);margin-bottom:8px">พิมพ์ชื่อห้อง 1 ห้องต่อ 1 บรรทัด — ระบบจะเฉลี่ยคนลงห้องพวกนี้ตอนกด "สุ่มจัดหน้าที่"</div>\n               <textarea id="odRoomsTa" style="width:100%;height:120px;background:var(--k-panel2);color:var(--k-tx-strong);border:1px solid var(--k-line2);border-radius:10px;padding:10px;font-size:13px;outline:none">${rooms.join('\n')}</textarea>`,
    showCancelButton: true,
    confirmButtonText: 'บันทึก',
    cancelButtonText: 'ยกเลิก',
    preConfirm: () => {
      const lines = (document.getElementById('odRoomsTa').value || '').split('\n').map((x => x.trim())).filter(Boolean);
      if (!lines.length) {
        Swal.showValidationMessage('ต้องมีอย่างน้อย 1 ห้อง');
        return false;
      }
      return lines;
    }
  });
  if (!r.isConfirmed || !r.value) return;
  try {
    await appDB.from('settings').upsert([ {
      key: 'discord_rooms_OD',
      value: JSON.stringify(r.value)
    } ]);
    SETTINGS['discord_rooms_OD'] = JSON.stringify(r.value);
    Swal.fire({
      icon: 'success',
      title: 'บันทึกห้องแล้ว',
      text: 'มีผลตอนกด "สุ่มจัดหน้าที่" ครั้งถัดไป',
      timer: 1800,
      showConfirmButton: false
    });
  } catch (e) {
    Swal.fire('ผิดพลาด', e.message, 'error');
  }
};
