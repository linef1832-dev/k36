const DISCORD_API_URL = 'https://my-discord-production-9382.up.railway.app';

let spyInterval;

let logInterval;

let isDataLoaded = false;

let globalSpyData = [];

let dsRoomList = [];

let extStaffList = [];

let extOnlineUsers = [];

let extStaffGroups = {};

let scheduledTransfers = [];

let transferHistory = [];

let selectedTransfer = new Set;

let spySelectedUsers = new Set;

let dsTimers = {};

window.customDiscordNames = window.customDiscordNames || {};

window.isSpyDropdownFocused = false;

function dsDebounce(key, func, delay = 200) {
  clearTimeout(dsTimers[key]);
  dsTimers[key] = setTimeout(func, delay);
}

window.dsCan = function(perm) {
  return typeof window.hasUserPerm === 'function' && window.hasUserPerm(perm);
};

window.dsRequire = function(perm) {
  if (window.dsCan(perm)) return true;
  Swal.fire('ไม่มีสิทธิ์', 'คุณไม่มีสิทธิ์ใช้งานส่วนนี้ครับ', 'error');
  return false;
};

window.dsEsc = function(v) {
  return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};

function getDbUserFromDiscordName(discordName) {
  if (!window.GLOBAL_USER_LIST || window.GLOBAL_USER_LIST.length === 0) return null;
  const dsNameClean = discordName.toLowerCase().replace(/[^a-z0-9ก-๙]/g, '');
  let matchedUser = window.GLOBAL_USER_LIST.find((u => {
    const dbNameClean = u.username ? u.username.toLowerCase().replace(/[^a-z0-9ก-๙]/g, '') : '';
    return dbNameClean.length > 1 && (dsNameClean.includes(dbNameClean) || dbNameClean.includes(dsNameClean));
  }));
  if (matchedUser) return matchedUser;
  const parts = discordName.toLowerCase().split(/[-_\s|]+/).filter((p => p.length >= 2));
  for (const part of parts) {
    const pClean = part.replace(/[^a-z0-9ก-๙]/g, '');
    if (pClean.length >= 2) {
      matchedUser = window.GLOBAL_USER_LIST.find((u => {
        const dbNameClean = u.username ? u.username.toLowerCase().replace(/[^a-z0-9ก-๙]/g, '') : '';
        return dbNameClean === pClean;
      }));
      if (matchedUser) return matchedUser;
    }
  }
  return null;
}

function parseDiscordGroupName(groupName) {
  if (!groupName || groupName === 'ALL') return {
    dept: null,
    shift: null
  };
  const tokens = String(groupName).split(/\s+/);
  let dept = null, shift = null;
  for (const t of tokens) {
    if (t.startsWith('กะ')) shift = t; else if (/^[A-Z]+$/.test(t)) dept = t;
  }
  return {
    dept: dept,
    shift: shift
  };
}

function getDiscordGroupMismatch(staff) {
  const dbUser = getDbUserFromDiscordName(staff.name);
  if (!dbUser || !dbUser.allowed_shift || !dbUser.allowed_shift.startsWith('กะ')) return null;
  const expectedShift = dbUser.allowed_shift;
  const expectedDept = dbUser.department || 'AM';
  const inGroups = [];
  for (const g in extStaffGroups) {
    if (extStaffGroups[g].includes(staff.id)) inGroups.push(g);
  }
  const shiftGroups = inGroups.filter((g => /กะ(เช้า|กลาง|ดึก)/.test(g)));
  if (shiftGroups.length === 0) return null;
  const correctGroup = shiftGroups.find((g => {
    const {dept: dept, shift: shift} = parseDiscordGroupName(g);
    return dept === expectedDept && shift === expectedShift;
  }));
  if (correctGroup) return null;
  const wrongShiftGroups = shiftGroups.filter((g => {
    const {shift: shift} = parseDiscordGroupName(g);
    return shift && shift !== expectedShift;
  }));
  if (wrongShiftGroups.length === 0) return null;
  return {
    wrongGroups: wrongShiftGroups,
    expectedGroup: `${expectedDept} ${expectedShift}`,
    dbDept: expectedDept,
    dbShift: expectedShift
  };
}

window.autoFixStaffGroup = async function(staffId) {
  if (!window.dsRequire('ds_manage')) return;
  const staff = extStaffList.find((s => s.id === staffId));
  if (!staff) return Swal.fire('Error', 'ไม่พบพนักงานคนนี้', 'error');
  const mismatch = getDiscordGroupMismatch(staff);
  if (!mismatch) return Swal.fire('OK', 'พนักงานคนนี้อยู่ในกลุ่มที่ถูกต้องแล้ว', 'success');
  if (!extStaffGroups[mismatch.expectedGroup]) {
    return Swal.fire('Error', `ไม่พบกลุ่ม "${mismatch.expectedGroup}" ใน Discord<br>กรุณาสร้างกลุ่มก่อน`, 'error');
  }
  const confirm = await Swal.fire({
    title: 'ย้ายกลุ่มอัตโนมัติ?',
    html: `\n            <div class="text-left text-sm">\n                <p class="mb-2"><b>${dsEsc(staff.name)}</b></p>\n                <p class="text-gray-500">ระบบจะ:</p>\n                <ul class="text-xs text-gray-400 list-disc pl-5 mt-1">\n                    <li>เอาออกจาก: <span class="text-red-500 font-bold">${mismatch.wrongGroups.join(', ')}</span></li>\n                    <li>เพิ่มเข้า: <span class="text-emerald-500 font-bold">${mismatch.expectedGroup}</span></li>\n                </ul>\n            </div>`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'ย้ายเลย',
    confirmButtonColor: '#10b981',
    cancelButtonText: 'ยกเลิก',
    customClass: {
      popup: 'dark:bg-slate-800 dark:text-white rounded-3xl'
    }
  });
  if (!confirm.isConfirmed) return;
  Swal.fire({
    title: 'กำลังย้าย...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });
  try {
    for (const wrongG of mismatch.wrongGroups) {
      await fetch(DISCORD_API_URL + '/api/groups/remove-member', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          groupName: wrongG,
          staffId: staff.id
        })
      });
      extStaffGroups[wrongG] = (extStaffGroups[wrongG] || []).filter((id => id !== staff.id));
    }
    await fetch(DISCORD_API_URL + '/api/groups/assign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        groupName: mismatch.expectedGroup,
        staffIds: [ staff.id ]
      })
    });
    if (!extStaffGroups[mismatch.expectedGroup]) extStaffGroups[mismatch.expectedGroup] = [];
    if (!extStaffGroups[mismatch.expectedGroup].includes(staff.id)) {
      extStaffGroups[mismatch.expectedGroup].push(staff.id);
    }
    Swal.fire({
      icon: 'success',
      title: 'ย้ายเรียบร้อย!',
      timer: 1500,
      showConfirmButton: false
    });
    if (typeof _doRenderManagerList === 'function') _doRenderManagerList();
    if (typeof renderGroupList === 'function') renderGroupList();
  } catch (err) {
    Swal.fire('Error', 'เกิดข้อผิดพลาด: ' + err.message, 'error');
  }
};

window.autoFixAllMismatches = async function() {
  if (!window.dsRequire('ds_manage')) return;
  const mismatches = extStaffList.map((s => ({
    staff: s,
    info: getDiscordGroupMismatch(s)
  }))).filter((x => x.info !== null));
  if (mismatches.length === 0) return Swal.fire('OK', 'ทุกคนอยู่ในกลุ่มที่ถูกต้องแล้ว 🎉', 'success');
  const confirm = await Swal.fire({
    title: `ย้ายอัตโนมัติทั้งหมด ${mismatches.length} คน?`,
    html: `<div class="text-left text-xs text-gray-500 max-h-60 overflow-y-auto">\n            ${mismatches.map((m => `\n                <div class="border-b border-slate-200 dark:border-slate-700 py-1.5">\n                    <div class="font-bold text-slate-700 dark:text-white text-sm">${m.staff.name}</div>\n                    <div class="text-[10px]"><span class="text-red-500">${m.info.wrongGroups.join(', ')}</span> → <span class="text-emerald-500">${m.info.expectedGroup}</span></div>\n                </div>`)).join('')}\n        </div>`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ย้ายทั้งหมด',
    confirmButtonColor: '#10b981',
    cancelButtonText: 'ยกเลิก',
    width: '600px',
    customClass: {
      popup: 'dark:bg-slate-800 dark:text-white rounded-3xl'
    }
  });
  if (!confirm.isConfirmed) return;
  Swal.fire({
    title: `กำลังย้าย 0 / ${mismatches.length}`,
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });
  let success = 0, fail = 0;
  for (let i = 0; i < mismatches.length; i++) {
    const {staff: staff, info: info} = mismatches[i];
    try {
      if (!extStaffGroups[info.expectedGroup]) {
        fail++;
        continue;
      }
      for (const wrongG of info.wrongGroups) {
        await fetch(DISCORD_API_URL + '/api/groups/remove-member', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            groupName: wrongG,
            staffId: staff.id
          })
        });
        extStaffGroups[wrongG] = (extStaffGroups[wrongG] || []).filter((id => id !== staff.id));
      }
      await fetch(DISCORD_API_URL + '/api/groups/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          groupName: info.expectedGroup,
          staffIds: [ staff.id ]
        })
      });
      if (!extStaffGroups[info.expectedGroup]) extStaffGroups[info.expectedGroup] = [];
      if (!extStaffGroups[info.expectedGroup].includes(staff.id)) {
        extStaffGroups[info.expectedGroup].push(staff.id);
      }
      success++;
    } catch (e) {
      fail++;
    }
    Swal.update({
      title: `กำลังย้าย ${i + 1} / ${mismatches.length}`
    });
  }
  Swal.fire({
    icon: success > 0 ? 'success' : 'warning',
    title: 'เสร็จสิ้น',
    html: `✅ สำเร็จ: <b class="text-emerald-500">${success}</b> คน<br>❌ ล้มเหลว: <b class="text-red-500">${fail}</b> คน`,
    timer: 3e3
  });
  if (typeof _doRenderManagerList === 'function') _doRenderManagerList();
  if (typeof renderGroupList === 'function') renderGroupList();
};

function buildMgrCache() {
  const dbUserMap = {};
  extStaffList.forEach((s => {
    dbUserMap[s.id] = getDbUserFromDiscordName(s.name);
  }));
  const dbUserAccountCount = {};
  extStaffList.forEach((s => {
    const u = dbUserMap[s.id];
    if (!u) return;
    dbUserAccountCount[u.id] = (dbUserAccountCount[u.id] || 0) + 1;
  }));
  const duplicateSet = new Set;
  extStaffList.forEach((s => {
    const u = dbUserMap[s.id];
    if (u && dbUserAccountCount[u.id] >= 2) duplicateSet.add(s.id);
  }));
  const mismatchMap = {};
  extStaffList.forEach((s => {
    const m = computeMismatchFromCache(s, dbUserMap[s.id]);
    if (m) mismatchMap[s.id] = m;
  }));
  return {
    dbUserMap: dbUserMap,
    dbUserAccountCount: dbUserAccountCount,
    duplicateSet: duplicateSet,
    mismatchMap: mismatchMap
  };
}

function computeMismatchFromCache(staff, dbUser) {
  if (!dbUser || !dbUser.allowed_shift || !dbUser.allowed_shift.startsWith('กะ')) return null;
  const expectedShift = dbUser.allowed_shift;
  const expectedDept = dbUser.department || 'AM';
  const inGroups = [];
  for (const g in extStaffGroups) {
    if (extStaffGroups[g].includes(staff.id)) inGroups.push(g);
  }
  const shiftGroups = inGroups.filter((g => /กะ(เช้า|กลาง|ดึก)/.test(g)));
  if (shiftGroups.length === 0) return null;
  const correctGroup = shiftGroups.find((g => {
    const {dept: dept, shift: shift} = parseDiscordGroupName(g);
    return dept === expectedDept && shift === expectedShift;
  }));
  if (correctGroup) return null;
  const wrongShiftGroups = shiftGroups.filter((g => {
    const {shift: shift} = parseDiscordGroupName(g);
    return shift && shift !== expectedShift;
  }));
  if (wrongShiftGroups.length === 0) return null;
  return {
    wrongGroups: wrongShiftGroups,
    expectedGroup: `${expectedDept} ${expectedShift}`,
    dbDept: expectedDept,
    dbShift: expectedShift
  };
}

function injectMismatchToolbar(cache) {
  if (!cache) cache = buildMgrCache();
  const totalMismatch = Object.keys(cache.mismatchMap).length;
  const dupeUserSet = new Set;
  let totalAccounts = 0;
  cache.duplicateSet.forEach((staffId => {
    const u = cache.dbUserMap[staffId];
    if (u) {
      dupeUserSet.add(u.id);
      totalAccounts++;
    }
  }));
  const totalUsers = dupeUserSet.size;
  if (document.getElementById('mgrMismatchToolbar')) {
    const cntEl = document.getElementById('mgrMismatchCount');
    if (cntEl) cntEl.innerText = totalMismatch;
    const dupeCntEl = document.getElementById('mgrDuplicateCount');
    const dupeUserCntEl = document.getElementById('mgrDuplicateUserCount');
    if (dupeCntEl) dupeCntEl.innerText = totalAccounts;
    if (dupeUserCntEl) dupeUserCntEl.innerText = totalUsers;
    return;
  }
  const container = document.getElementById('manageStaffList');
  if (!container || !container.parentNode) return;
  const toolbar = document.createElement('div');
  toolbar.id = 'mgrMismatchToolbar';
  toolbar.className = 'mb-3 space-y-2';
  toolbar.innerHTML = `\n        \n        <div class="p-3 bg-gradient-to-r from-rose-500/10 to-amber-500/10 border border-rose-500/30 rounded-xl flex items-center justify-between gap-3 flex-wrap">\n            <div class="flex items-center gap-2 flex-1 min-w-0">\n                <span class="material-icons text-rose-400">rule</span>\n                <div class="text-xs">\n                    <div class="font-bold text-rose-300">ตรวจสอบกลุ่ม Discord กับฐานข้อมูล</div>\n                    <div class="text-gray-400 text-[10px]">พนักงานที่กลุ่มไม่ตรงกับกะในระบบลงเวลา: <b id="mgrMismatchCount" class="text-rose-400">${totalMismatch}</b> คน</div>\n                </div>\n            </div>\n            <div class="flex items-center gap-2 flex-wrap">\n                <label class="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-gray-300 bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-600 transition">\n                    <input type="checkbox" id="mgrOnlyMismatchCb" onchange="_doRenderManagerList()" class="cursor-pointer">\n                    <span>🚨 เฉพาะกลุ่มผิด</span>\n                </label>\n                <button onclick="autoFixAllMismatches()" class="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition shadow-md active:scale-95">\n                    <span class="material-icons text-[14px]">auto_fix_high</span> ย้ายอัตโนมัติทั้งหมด\n                </button>\n            </div>\n        </div>\n\n        \n        <div class="p-3 bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/30 rounded-xl flex items-center justify-between gap-3 flex-wrap">\n            <div class="flex items-center gap-2 flex-1 min-w-0">\n                <span class="material-icons text-purple-400">people_alt</span>\n                <div class="text-xs">\n                    <div class="font-bold text-purple-300">ตรวจหา Discord ซ้ำซ้อน</div>\n                    <div class="text-gray-400 text-[10px]">พบ <b id="mgrDuplicateUserCount" class="text-purple-400">${totalUsers}</b> User ที่มี Discord มากกว่า 1 account: <b id="mgrDuplicateCount" class="text-purple-400">${totalAccounts}</b> รายการ</div>\n                </div>\n            </div>\n            <div class="flex items-center gap-2 flex-wrap">\n                <label class="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-gray-300 bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-600 transition">\n                    <input type="checkbox" id="mgrOnlyDuplicateCb" onchange="_doRenderManagerList()" class="cursor-pointer">\n                    <span>🔍 เฉพาะ Discord ซ้ำ</span>\n                </label>\n                <button onclick="openDuplicateModal()" class="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition shadow-md active:scale-95" ${totalAccounts === 0 ? 'disabled' : ''}>\n                    <span class="material-icons text-[14px]">manage_search</span> ดูรายการซ้ำ\n                </button>\n            </div>\n        </div>\n    `;
  container.parentNode.insertBefore(toolbar, container);
}

function findDiscordDuplicates() {
  const groups = {};
  const noMatch = [];
  extStaffList.forEach((s => {
    const dbUser = getDbUserFromDiscordName(s.name);
    if (!dbUser) {
      noMatch.push(s);
      return;
    }
    const key = dbUser.id;
    if (!groups[key]) groups[key] = {
      dbUser: dbUser,
      staffs: []
    };
    groups[key].staffs.push(s);
  }));
  const duplicates = {};
  let totalAccounts = 0;
  let totalUsers = 0;
  Object.keys(groups).forEach((k => {
    if (groups[k].staffs.length >= 2) {
      duplicates[k] = groups[k];
      totalAccounts += groups[k].staffs.length;
      totalUsers++;
    }
  }));
  return {
    duplicates: duplicates,
    totalAccounts: totalAccounts,
    totalUsers: totalUsers,
    noMatch: noMatch
  };
}

window.openDuplicateModal = function() {
  const {duplicates: duplicates, totalAccounts: totalAccounts, totalUsers: totalUsers} = findDiscordDuplicates();
  if (totalAccounts === 0) {
    return Swal.fire('OK', 'ไม่พบ Discord ที่ซ้ำซ้อน 🎉', 'success');
  }
  const groupHtml = Object.values(duplicates).map((grp => {
    const u = grp.dbUser;
    const tag = `<span class="bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded text-[10px] font-bold border border-indigo-700/50">${u.department || 'AM'} | ${(u.allowed_shift || '').replace('กะ', '')}</span>`;
    const accountsHtml = grp.staffs.map((s => {
      const groupsIn = [];
      for (const g in extStaffGroups) {
        if (extStaffGroups[g].includes(s.id)) groupsIn.push(g);
      }
      const gTags = groupsIn.length > 0 ? groupsIn.map((g => `<span class="bg-slate-700 text-gray-300 px-1.5 py-0.5 rounded text-[9px]">${g}</span>`)).join(' ') : '<span class="text-gray-500 text-[9px]">- ไม่มีกลุ่ม -</span>';
      return `\n                <div class="flex items-center justify-between gap-2 p-2.5 bg-slate-800/60 rounded-lg border border-slate-700">\n                    <div class="flex-1 min-w-0">\n                        <div class="font-bold text-sm text-slate-100 truncate">${dsEsc(s.name)}</div>\n                        <div class="text-[10px] text-gray-500 mt-0.5">Discord ID: <span class="font-mono">${s.id}</span></div>\n                        <div class="mt-1 flex flex-wrap gap-1">${gTags}</div>\n                    </div>\n                    <button onclick="confirmDeleteDuplicate('${s.id}', '${s.name.replace(/'/g, "\\'")}')" \n                        class="bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition shrink-0">\n                        <span class="material-icons text-[14px]">delete_forever</span> ลบ\n                    </button>\n                </div>`;
    })).join('');
    return `\n            <div class="border border-purple-500/30 bg-purple-500/5 rounded-xl p-3 mb-3">\n                <div class="flex items-center justify-between mb-2 pb-2 border-b border-purple-500/20">\n                    <div class="flex items-center gap-2">\n                        <span class="material-icons text-purple-400 text-[20px]">person</span>\n                        <span class="font-bold text-purple-200">${u.username}</span>\n                        ${tag}\n                    </div>\n                    <span class="bg-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">${grp.staffs.length} accounts</span>\n                </div>\n                <div class="space-y-2">${accountsHtml}</div>\n            </div>`;
  })).join('');
  Swal.fire({
    title: `<span class="text-purple-400">🔍 Discord ซ้ำซ้อน</span>`,
    html: `\n            <div class="text-left">\n                <div class="text-xs text-gray-400 mb-3 bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-lg">\n                    <span class="material-icons text-amber-400 text-[14px] align-middle">info</span>\n                    <span class="align-middle ml-1">พบ User <b class="text-amber-300">${totalUsers}</b> คนที่มี Discord มากกว่า 1 account รวม <b class="text-amber-300">${totalAccounts}</b> รายการ — กดปุ่ม "ลบ" เพื่อ Kick Discord ที่ตกค้างออก</span>\n                </div>\n                <div class="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">${groupHtml}</div>\n            </div>`,
    width: '700px',
    showConfirmButton: false,
    showCloseButton: true,
    customClass: {
      popup: 'dark:bg-slate-800 dark:text-white rounded-3xl border border-slate-600'
    }
  });
};

window.editCustomName = async function(staffId, currentName) {
  if (!window.dsRequire('ds_manage')) return;
  const hasOverride = !!(window.customDiscordNames && window.customDiscordNames[staffId]);
  const result = await Swal.fire({
    title: 'เปลี่ยนชื่อแสดงผล',
    html: `\n            <div class="text-left text-xs text-gray-400 mb-2">\n                <span class="material-icons text-amber-400 text-[14px] align-middle">info</span>\n                <span class="align-middle">เปลี่ยนเฉพาะชื่อที่แสดงในระบบ ไม่กระทบ Discord จริง</span>\n            </div>\n            <div class="text-left text-xs">\n                <div class="text-gray-500 mb-1">ชื่อปัจจุบัน:</div>\n                <div class="font-bold text-white bg-slate-700/50 px-3 py-1.5 rounded-lg">${currentName}</div>\n            </div>`,
    input: 'text',
    inputValue: currentName,
    inputPlaceholder: 'พิมพ์ชื่อใหม่...',
    inputAttributes: {
      autocapitalize: 'off'
    },
    showCancelButton: true,
    confirmButtonText: 'บันทึก',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#f59e0b',
    showDenyButton: hasOverride,
    denyButtonText: '↩ คืนชื่อเดิม',
    denyButtonColor: '#64748b',
    customClass: {
      popup: 'dark:bg-slate-800 dark:text-white rounded-3xl'
    },
    inputValidator: value => {
      if (!value || !value.trim()) return 'กรุณากรอกชื่อ';
    }
  });
  if (result.dismiss) return;
  if (result.isDenied) {
    Swal.fire({
      title: 'กำลังคืนชื่อเดิม...',
      didOpen: () => Swal.showLoading(),
      allowOutsideClick: false
    });
    try {
      if (window.customDiscordNames) delete window.customDiscordNames[staffId];
      await saveCustomNamesToDb();
      try {
        const tStamp = Date.now();
        const sRes = await fetch(`${DISCORD_API_URL}/api/staff-list?t=${tStamp}`, {
          headers: {
            'Cache-Control': 'no-cache'
          }
        });
        const sData = await sRes.json().catch((() => []));
        const rawList = Array.isArray(sData) ? sData : sData.data || [];
        const original = rawList.find((s => s.id === staffId));
        const idx = extStaffList.findIndex((s => s.id === staffId));
        if (original && idx !== -1) extStaffList[idx].name = original.name;
      } catch (e) {}
      Swal.fire({
        icon: 'success',
        title: 'คืนชื่อเดิมแล้ว',
        timer: 1200,
        showConfirmButton: false
      });
      if (typeof _doRenderManagerList === 'function') _doRenderManagerList();
      if (typeof renderGroupList === 'function') renderGroupList();
    } catch (err) {
      Swal.fire('Error', 'คืนชื่อไม่สำเร็จ: ' + err.message, 'error');
    }
    return;
  }
  if (!result.isConfirmed || !result.value) return;
  const cleanName = result.value.trim();
  if (cleanName === currentName) return;
  Swal.fire({
    title: 'กำลังบันทึก...',
    didOpen: () => Swal.showLoading(),
    allowOutsideClick: false
  });
  try {
    if (!window.customDiscordNames) window.customDiscordNames = {};
    window.customDiscordNames[staffId] = cleanName;
    const idx = extStaffList.findIndex((s => s.id === staffId));
    if (idx !== -1) extStaffList[idx].name = cleanName;
    await saveCustomNamesToDb();
    Swal.fire({
      icon: 'success',
      title: 'บันทึกแล้ว',
      text: `เปลี่ยนชื่อเป็น "${cleanName}"`,
      timer: 1500,
      showConfirmButton: false
    });
    if (typeof _doRenderManagerList === 'function') _doRenderManagerList();
    if (typeof renderGroupList === 'function') renderGroupList();
  } catch (err) {
    Swal.fire('Error', 'บันทึกไม่สำเร็จ: ' + err.message, 'error');
  }
};

async function saveCustomNamesToDb() {
  if (typeof appDB === 'undefined' || !appDB) return;
  const namesObj = window.customDiscordNames || {};
  const {error: _upErr0} = await appDB.from('settings').upsert([ {
    key: 'discord_custom_names',
    value: JSON.stringify(namesObj)
  } ]);
  if (_upErr0) throw _upErr0;
}

window.confirmDeleteDuplicate = async function(staffId, staffName) {
  if (!window.dsRequire('ds_manage')) return;
  const confirm = await Swal.fire({
    title: 'ยืนยันการลบ?',
    html: `\n            <div class="text-left text-sm">\n                <p class="mb-2">จะ <b class="text-red-500">Kick</b> Discord account นี้ออก:</p>\n                <div class="bg-slate-700/50 p-2.5 rounded-lg border border-slate-600">\n                    <div class="font-bold text-white">${staffName}</div>\n                    <div class="text-[10px] text-gray-400 mt-0.5">ID: ${staffId}</div>\n                </div>\n                <p class="text-[10px] text-amber-400 mt-2">⚠ Discord account จะถูกเตะออกจาก Server หากต้องการให้กลับมาต้องส่งคำเชิญใหม่</p>\n            </div>`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ลบเลย',
    confirmButtonColor: '#dc2626',
    cancelButtonText: 'ยกเลิก',
    customClass: {
      popup: 'dark:bg-slate-800 dark:text-white rounded-3xl'
    }
  });
  if (!confirm.isConfirmed) return;
  Swal.fire({
    title: 'กำลังลบ...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });
  try {
    const res = await fetch(DISCORD_API_URL + '/api/kick-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: staffId
      })
    });
    const result = await res.json().catch((() => ({})));
    if (!res.ok || result.success === false) {
      throw new Error(result.error || `API returned ${res.status}`);
    }
    extStaffList = extStaffList.filter((s => s.id !== staffId));
    for (const g in extStaffGroups) {
      extStaffGroups[g] = extStaffGroups[g].filter((id => id !== staffId));
    }
    Swal.fire({
      icon: 'success',
      title: 'ลบเรียบร้อย',
      text: `Kick ${staffName} ออกจาก Discord แล้ว`,
      timer: 1500,
      showConfirmButton: false
    });
    if (typeof _doRenderManagerList === 'function') _doRenderManagerList();
    if (typeof renderGroupList === 'function') renderGroupList();
    setTimeout((() => {
      const dupes = findDiscordDuplicates();
      if (dupes.totalAccounts > 0) {
        openDuplicateModal();
      }
    }), 1600);
  } catch (err) {
    Swal.fire('Error', 'ลบไม่สำเร็จ: ' + err.message, 'error');
  }
};

window.applyDiscordPermissions = function() {
  const tabs = [ {
    btnId: 'tabDsSpy',
    viewId: 'spy',
    reqPerm: 'ds_spy'
  }, {
    btnId: 'tabDsMove',
    viewId: 'move',
    reqPerm: 'ds_move'
  }, {
    btnId: 'tabDsManage',
    viewId: 'manage',
    reqPerm: 'ds_manage'
  }, {
    btnId: 'tabDsVoicelog',
    viewId: 'voicelog',
    reqPerm: 'ds_log'
  }, {
    btnId: 'tabDsBreaktrack',
    viewId: 'breaktrack',
    reqPerm: 'ds_checkin'
  } ];
  let firstAllowedTab = null;
  tabs.forEach((tab => {
    const btn = document.getElementById(tab.btnId);
    if (!btn) return;
    if (canPerm(tab.reqPerm)) {
      btn.classList.remove('no-perm-hidden', 'hidden');
      btn.style.display = '';
      if (!firstAllowedTab) firstAllowedTab = tab.viewId;
    } else {
      btn.classList.add('no-perm-hidden');
      btn.style.display = 'none';
    }
  }));
  if (firstAllowedTab) {
    document.getElementById('discordNoAccessMessage')?.remove();
    const activeTabs = [ 'spy', 'move', 'manage', 'voicelog', 'breaktrack' ];
    let isCurrentTabValid = false;
    activeTabs.forEach((t => {
      const contentBox = document.getElementById('dsContent_' + t);
      if (contentBox && !contentBox.classList.contains('hidden')) {
        const reqPerm = tabs.find((x => x.viewId === t))?.reqPerm;
        if (canPerm(reqPerm)) isCurrentTabValid = true;
      }
    }));
    if (!isCurrentTabValid) {
      switchDiscordTab(firstAllowedTab);
    } else {
      let visibleTab = 'spy';
      activeTabs.forEach((t => {
        const contentBox = document.getElementById('dsContent_' + t);
        if (contentBox && !contentBox.classList.contains('hidden')) visibleTab = t;
      }));
      switchDiscordTab(visibleTab);
    }
  } else {
    tabs.forEach((t => {
      const contentBox = document.getElementById('dsContent_' + t.viewId);
      if (contentBox) contentBox.classList.add('hidden');
    }));
    if (!document.getElementById('discordNoAccessMessage')) {
      const msg = document.createElement('div');
      msg.id = 'discordNoAccessMessage';
      msg.className = 'text-center mt-[15vh] flex flex-col items-center justify-center fade-in';
      msg.innerHTML = `\n                <span class="material-icons text-red-500 text-7xl mb-4 drop-shadow-md">lock</span>\n                <h2 class="text-2xl font-black text-white tracking-wider">คุณไม่มีสิทธิ์เข้าถึงเมนูใดๆ ในระบบดิสคอร์ด</h2>\n                <p class="text-gray-400 mt-2 text-sm">กรุณาติดต่อผู้จัดการเพื่อขอสิทธิ์การเข้าถึง</p>\n            `;
      const appBox = document.querySelector('#discordApp .flex-1');
      if (appBox) appBox.appendChild(msg);
    }
  }
};

window.switchDiscordTab = function(tabName) {
  try {
    const allViews = [ 'spy', 'move', 'manage', 'voicelog', 'breaktrack' ];
    allViews.forEach((view => {
      const el = document.getElementById('dsContent_' + view);
      if (el) el.classList.add('hidden');
      const btn = document.getElementById('tabDs' + view.charAt(0).toUpperCase() + view.slice(1));
      if (btn) btn.className = "ds-tab";
    }));
    const targetView = document.getElementById('dsContent_' + tabName);
    if (targetView) targetView.classList.remove('hidden');
    if (spyInterval) clearInterval(spyInterval);
    if (logInterval) clearInterval(logInterval);
    const activeBtn = document.getElementById('tabDs' + tabName.charAt(0).toUpperCase() + tabName.slice(1));
    if (activeBtn) {
      if (tabName === 'spy') {
        activeBtn.className = "ds-tab ds-tab-active";
        ds_fetchSpy();
        ds_fetchChannelsSilently();
        spyInterval = setInterval((() => {
          if (!document.hidden) ds_fetchSpy();
        }), 3e3);
        if (typeof window.registerPageInterval === 'function') window.registerPageInterval(spyInterval);
      } else if (tabName === 'move') {
        activeBtn.className = "ds-tab ds-tab-active";
        ds_fetchChannels();
      } else if (tabName === 'manage') {
        activeBtn.className = "ds-tab ds-tab-active";
        if (!isDataLoaded) fetchSystemData(false); else {
          _doRenderManagerList();
          renderGroupList();
          renderTransferUserList();
          fetchTransfers();
        }
      } else if (tabName === 'voicelog') {
        activeBtn.className = "ds-tab ds-tab-active";
        const dateInput = document.getElementById('voiceLogDate');
        if (dateInput && !dateInput.value) {
          const tzOffset = 7 * 60 * 60 * 1e3;
          dateInput.value = new Date(Date.now() + tzOffset).toISOString().split('T')[0];
        }
        ds_fetchVoiceLogs();
        logInterval = setInterval((() => {
          if (!document.hidden) ds_fetchVoiceLogs(false, window.dsCurrentPage);
        }), 15e3);
        if (typeof window.registerPageInterval === 'function') window.registerPageInterval(logInterval);
      } else if (tabName === 'breaktrack') {
        activeBtn.className = "ds-tab ds-tab-active";
        window.initBreaktrack();
      }
    }
  } catch (err) {
    console.error("Tab Switch Error:", err);
  }
};

window.fetchSystemData = async function(forceSync = false, silent = false) {
  if (isDataLoaded && !forceSync && !silent) return;
  try {
    if (forceSync && !silent) Swal.fire({
      title: 'กำลังเชื่อมต่อบอท...',
      text: 'เซิร์ฟเวอร์อาจกำลังตื่นนอน โปรดรอสักครู่...',
      didOpen: () => Swal.showLoading(),
      allowOutsideClick: false
    });
    if (typeof appDB !== 'undefined') {
      const dbUsers = await window.getUsersCached();
      if (dbUsers && dbUsers.length > 0) window.GLOBAL_USER_LIST = dbUsers;
      const {data: customNameData} = await appDB.from('settings').select('value').eq('key', 'discord_custom_names').single();
      if (customNameData && customNameData.value) {
        window.customDiscordNames = JSON.parse(customNameData.value);
      }
    }
    const tStamp = Date.now();
    const fetchOpts = {
      headers: {
        'Cache-Control': 'no-cache',
        'ngrok-skip-browser-warning': 'true'
      }
    };
    const [sRes, oRes, gRes] = await Promise.all([ fetch(`${DISCORD_API_URL}/api/staff-list?t=${tStamp}`, fetchOpts).catch((e => {
      throw new Error('NET_BLOCK');
    })), fetch(`${DISCORD_API_URL}/api/online-status?t=${tStamp}`, fetchOpts).catch((e => {
      throw new Error('NET_BLOCK');
    })), fetch(`${DISCORD_API_URL}/api/staff-groups?t=${tStamp}`, fetchOpts).catch((e => {
      throw new Error('NET_BLOCK');
    })) ]);
    if (!sRes.ok) throw new Error('BOT_SLEEP');
    const sData = await sRes.json().catch((() => []));
    const oData = await oRes.json().catch((() => []));
    const gData = await gRes.json().catch((() => ({})));
    let rawStaffList = Array.isArray(sData) ? sData : sData.data || [];
    extStaffList = rawStaffList.map((s => {
      if (window.customDiscordNames[s.id]) {
        return {
          ...s,
          name: window.customDiscordNames[s.id]
        };
      }
      return s;
    }));
    let rawOnline = Array.isArray(oData) ? oData : oData.data || oData.users || oData.online || [];
    extOnlineUsers = rawOnline.map((item => typeof item === 'object' ? String(item.id || item.user_id) : String(item)));
    if (Object.keys(gData).length > 0) extStaffGroups = gData;
    isDataLoaded = true;
    updateAllFilters();
    if (typeof renderGroupList === 'function') renderGroupList();
    if (typeof _doRenderManagerList === 'function') _doRenderManagerList();
    if (typeof renderTransferUserList === 'function') renderTransferUserList();
    if (typeof fetchTransfers === 'function') fetchTransfers();
    if (forceSync && !silent) {
      Swal.fire({
        icon: 'success',
        title: 'เชื่อมต่อสำเร็จ',
        timer: 1e3,
        showConfirmButton: false
      });
    }
  } catch (e) {
    console.error("System Fetch Error:", e);
    if (!silent) {
      if (e.message === 'NET_BLOCK') Swal.fire('เครื่องนี้บล็อกบอท!', 'เน็ตเวิร์ค หรือ AdBlock บล็อกการเชื่อมต่อ', 'error'); else if (e.message === 'BOT_SLEEP') Swal.fire('บอทกำลังตื่นนอน', 'รอสัก 30 วินาทีแล้วลองกดรีเฟรชใหม่ครับ', 'warning'); else Swal.fire('Error', 'เกิดข้อผิดพลาด: ' + e.message, 'error');
    }
  }
};

window.syncDiscord = async function() {
  if (!window.dsRequire('ds_manage')) return;
  Swal.fire({
    title: 'กำลังสั่งบอทดึงรายชื่อ...',
    didOpen: () => Swal.showLoading()
  });
  try {
    const res = await fetch(DISCORD_API_URL + '/api/import-discord-members', {
      method: 'POST',
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
    if (!res.ok) throw new Error('API_FAIL');
    await fetchSystemData(true, true);
    Swal.fire({
      icon: 'success',
      title: 'อัปเดตเรียบร้อย',
      timer: 1e3,
      showConfirmButton: false
    });
  } catch (e) {
    Swal.fire({
      icon: 'error',
      title: 'เชื่อมต่อล้มเหลว',
      text: 'บอทอาจจะหลับอยู่ หรือคอมเครื่องนี้มีระบบป้องกัน'
    });
  }
};

window.spy_toggleSelectUser = function(uid) {
  if (spySelectedUsers.has(uid)) spySelectedUsers.delete(uid); else spySelectedUsers.add(uid);
  document.getElementById('spySelectedCount').innerText = spySelectedUsers.size;
};

window.spy_toggleSelectAll = function() {
  const isChecked = document.getElementById('spySelectAll').checked;
  document.querySelectorAll('.spy-user-cb').forEach((cb => {
    cb.checked = isChecked;
    if (isChecked) spySelectedUsers.add(cb.value); else spySelectedUsers.delete(cb.value);
  }));
  document.getElementById('spySelectedCount').innerText = spySelectedUsers.size;
};

window.spy_moveSelectedUsers = async function() {
  if (!window.dsRequire('ds_spy')) return;
  const targetId = document.getElementById('bulkMoveTarget').value;
  const ids = Array.from(spySelectedUsers);
  if (ids.length === 0) return Swal.fire('เตือน', 'กรุณาติ๊กเลือกคนที่จะย้ายก่อน', 'warning');
  if (!targetId) return Swal.fire('เตือน', 'กรุณาเลือกห้องปลายทาง', 'warning');
  Swal.fire({
    title: 'กำลังย้าย...',
    didOpen: () => Swal.showLoading()
  });
  try {
    const res = await fetch(`${DISCORD_API_URL}/api/move-users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userIds: ids,
        targetChannelId: targetId
      })
    });
    const r = await res.json();
    if (r.success) {
      Swal.fire('สำเร็จ', `ย้ายพนักงาน ${r.movedCount} คนแล้ว`, 'success');
      ds_logAction('Spy Move', `ดึงคนย้ายห้อง ${ids.length} คน ไปยังเป้าหมาย`);
      spySelectedUsers.clear();
      document.getElementById('spySelectAll').checked = false;
      document.getElementById('spySelectedCount').innerText = 0;
      ds_fetchSpy();
    } else Swal.fire('Error', r.error, 'error');
  } catch (e) {
    Swal.fire('Error', e.message, 'error');
  }
};

window.spy_returnMove = async function() {
  if (!window.dsRequire('ds_spy')) return;
  Swal.fire({
    title: 'กำลังย้ายกลับ...',
    didOpen: () => Swal.showLoading()
  });
  try {
    const res = await fetch(`${DISCORD_API_URL}/api/spy-return`, {
      method: 'POST'
    });
    const r = await res.json();
    if (r.success) {
      Swal.fire('สำเร็จ', `ย้ายกลับ ${r.count} คนแล้ว`, 'success');
      ds_logAction('Spy Return', `ดึงพนักงาน ${r.count} คนกลับห้องเดิม`);
    } else Swal.fire('Error', r.error, 'error');
  } catch (e) {
    Swal.fire('Error', 'เชื่อมต่อบอทไม่ได้', 'error');
  }
};

window.spy_moveSingleUser = async function(uid, targetId) {
  if (!window.dsRequire('ds_spy')) return;
  if (!targetId) return;
  try {
    await fetch(`${DISCORD_API_URL}/api/move-users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userIds: [ uid ],
        targetChannelId: targetId
      })
    });
    const Toast = Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 1500
    });
    Toast.fire({
      icon: 'success',
      title: 'ย้ายเรียบร้อย'
    });
    ds_logAction('Spy Move Single', `ย้าย 1 คนไปห้องใหม่`);
    ds_fetchSpy();
  } catch (e) {}
};

window.ds_fetchSpy = async function() {
  try {
    const res = await fetch(DISCORD_API_URL + '/api/spy-data?t=' + Date.now());
    if (res.ok) {
      const data = await res.json();
      globalSpyData = Object.keys(data).map((key => ({
        id: key,
        ...data[key]
      }))).sort(((a, b) => a.currentRoom ? -1 : 1));
      if (!window.isSpyDropdownFocused) ds_renderSpyTable();
    }
  } catch (e) {}
};

window.ds_fetchChannelsSilently = async function() {
  try {
    if (typeof appDB !== 'undefined') {
      const {data: data} = await appDB.from('settings').select('value').eq('key', 'discord_channels').single();
      if (data && data.value) {
        dsRoomList = JSON.parse(data.value);
        let dropHtml = '<option value="">-- เลือกห้องปลายทาง --</option>';
        dsRoomList.forEach((c => dropHtml += `<option value="${c.id}">${dsEsc(c.name)}</option>`));
        const targetSelect = document.getElementById('bulkMoveTarget');
        if (targetSelect) targetSelect.innerHTML = dropHtml;
      }
    }
  } catch (e) {}
};

window.filterSourceRooms = function() {
  const term = document.getElementById('searchSourceRoom').value.toLowerCase();
  document.querySelectorAll('.ds-room-item').forEach((el => {
    const name = el.getAttribute('data-name').toLowerCase();
    el.style.display = name.includes(term) ? 'flex' : 'none';
  }));
};

window.ds_fetchChannels = async function() {
  try {
    if (typeof appDB !== 'undefined') {
      const {data: data} = await appDB.from('settings').select('value').eq('key', 'discord_channels').single();
      if (data && data.value) {
        dsRoomList = JSON.parse(data.value);
        let srcHtml = '';
        let targetHtml = '<option value="">-- เลือกห้องที่ต้องการย้ายไป --</option>';
        dsRoomList.forEach((c => {
          srcHtml += window.renderTemplate('tpl-ds-source-room', {
            id: c.id,
            name: c.name
          });
          targetHtml += `<option value="${c.id}">${dsEsc(c.name)}</option>`;
        }));
        document.getElementById('ds_sourceRooms').innerHTML = srcHtml;
        document.getElementById('ds_targetRoom').innerHTML = targetHtml;
      }
    }
  } catch (e) {
    document.getElementById('ds_sourceRooms').innerHTML = '<div class="text-center text-gray-500 py-10">รอโหลดข้อมูล...</div>';
  }
};

window.ds_startMove = async function() {
  if (!window.dsRequire('ds_move')) return;
  const srcIds = Array.from(document.querySelectorAll('input[name="ds_src"]:checked')).map((cb => cb.value));
  const target = document.getElementById('ds_targetRoom').value;
  if (!target || srcIds.length === 0) return Swal.fire('เตือน', 'เลือกห้องต้นทางและปลายทางก่อน', 'warning');
  Swal.fire({
    title: 'กำลังย้าย...',
    didOpen: () => Swal.showLoading()
  });
  try {
    const res = await fetch(`${DISCORD_API_URL}/api/mass-move-rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sourceChannelIds: srcIds,
        targetChannelId: target
      })
    });
    const r = await res.json();
    if (r.success) {
      Swal.fire('สำเร็จ', `ย้ายพนักงาน ${r.count} คนแล้ว`, 'success');
      ds_logAction('Mass Move', `ย้ายพนักงาน ${r.count} คนไปห้องเป้าหมาย`);
    } else Swal.fire('Error', r.error, 'error');
  } catch (e) {
    Swal.fire('Error', 'เชื่อมต่อบอทไม่ได้', 'error');
  }
};

window.ds_returnMove = async function() {
  if (!window.dsRequire('ds_move')) return;
  Swal.fire({
    title: 'กำลังย้ายกลับ...',
    didOpen: () => Swal.showLoading()
  });
  try {
    const res = await fetch(`${DISCORD_API_URL}/api/mass-return`, {
      method: 'POST'
    });
    const r = await res.json();
    if (r.success) {
      Swal.fire('สำเร็จ', `ย้ายกลับ ${r.count} คนแล้ว`, 'success');
      ds_logAction('Return Move', `ดึงพนักงาน ${r.count} คนกลับห้องเดิม`);
    } else Swal.fire('Error', r.error, 'error');
  } catch (e) {
    Swal.fire('Error', 'เชื่อมต่อบอทไม่ได้', 'error');
  }
};

window.toggleTransfer = function(id) {
  if (selectedTransfer.has(id)) selectedTransfer.delete(id); else selectedTransfer.add(id);
  _doRenderTransferUserList();
};

window.renderTransferUserList = function() {
  dsDebounce('transfer', _doRenderTransferUserList, 200);
};

window._doRenderTransferUserList = function() {
  const t = document.getElementById('transferSearch').value.toLowerCase();
  const group = document.getElementById('filterTransferGroup').value;
  const deptFilter = document.getElementById('filterTransferDept').value;
  const shiftFilter = document.getElementById('filterTransferShift').value;
  const c = document.getElementById('transferUserList');
  if (!c) return;
  document.getElementById('transferSelectedTags').innerHTML = Array.from(selectedTransfer).map((id => {
    const s = extStaffList.find((x => x.id === id));
    return s ? `<span class="bg-emerald-600 text-white px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 shadow-sm">${s.name} <span class="material-icons text-[12px] cursor-pointer hover:text-black transition" onclick="toggleTransfer('${id}')">cancel</span></span>` : '';
  })).join('');
  const filtered = extStaffList.filter((s => {
    const nameMatch = s.name.toLowerCase().includes(t);
    const groupMatch = group === 'ALL' || extStaffGroups[group] && extStaffGroups[group].includes(s.id);
    let matchDept = true;
    let matchShift = true;
    if (deptFilter !== 'ALL' || shiftFilter !== 'ALL') {
      const dbUser = getDbUserFromDiscordName(s.name);
      if (!dbUser) return false;
      if (deptFilter !== 'ALL' && (dbUser.department || 'AM') !== deptFilter) matchDept = false;
      if (shiftFilter !== 'ALL' && dbUser.allowed_shift !== shiftFilter) matchShift = false;
    }
    return nameMatch && groupMatch && matchDept && matchShift;
  }));
  if (filtered.length === 0) {
    c.innerHTML = '<div class="text-center text-gray-500 text-xs py-6">ไม่พบรายชื่อพนักงาน</div>';
    return;
  }
  c.innerHTML = filtered.map((s => {
    const isSel = selectedTransfer.has(s.id);
    const dbUser = getDbUserFromDiscordName(s.name);
    let tagHtml = dbUser ? `<span class="text-[9px] text-gray-500 ml-2">(${dbUser.department || 'AM'} | ${dbUser.allowed_shift.replace('กะ', '')})</span>` : '';
    return window.renderTemplate('tpl-ds-transfer-user-row', {
      id: s.id,
      bgClass: isSel ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-400 shadow-inner ring-1 ring-emerald-500' : 'bg-slate-900 border border-slate-700 text-gray-300 hover:bg-slate-800',
      name: s.name,
      tagHtml: tagHtml,
      iconHtml: isSel ? '<span class="material-icons text-emerald-500">check_circle</span>' : '<span class="material-icons text-gray-600 text-sm">radio_button_unchecked</span>'
    });
  })).join('');
};

window.selectAllVisibleTransfer = function() {
  const t = document.getElementById('transferSearch').value.toLowerCase();
  const group = document.getElementById('filterTransferGroup').value;
  const deptFilter = document.getElementById('filterTransferDept').value;
  const shiftFilter = document.getElementById('filterTransferShift').value;
  extStaffList.filter((s => {
    const nameMatch = s.name.toLowerCase().includes(t);
    const groupMatch = group === 'ALL' || extStaffGroups[group] && extStaffGroups[group].includes(s.id);
    let matchDept = true;
    let matchShift = true;
    if (deptFilter !== 'ALL' || shiftFilter !== 'ALL') {
      const dbUser = getDbUserFromDiscordName(s.name);
      if (!dbUser) return false;
      if (deptFilter !== 'ALL' && (dbUser.department || 'AM') !== deptFilter) matchDept = false;
      if (shiftFilter !== 'ALL' && dbUser.allowed_shift !== shiftFilter) matchShift = false;
    }
    return nameMatch && groupMatch && matchDept && matchShift;
  })).forEach((s => selectedTransfer.add(s.id)));
  _doRenderTransferUserList();
};

window.scheduleTransfer = async function() {
  if (!window.dsRequire('ds_manage')) return;
  const ids = Array.from(selectedTransfer);
  const toGroup = document.getElementById('transferToGroup').value;
  const time = document.getElementById('transferTime').value;
  if (ids.length === 0 || !toGroup || !time) return Swal.fire('ข้อมูลไม่ครบ', 'เลือกคน, กลุ่มปลายทาง, และเวลา', 'warning');
  Swal.fire({
    title: 'กำลังบันทึก...',
    didOpen: () => Swal.showLoading()
  });
  for (const staffId of ids) {
    let fromGroup = '?';
    for (let g in extStaffGroups) {
      if (extStaffGroups[g].includes(staffId)) {
        fromGroup = g;
        break;
      }
    }
    await fetch(DISCORD_API_URL + '/api/schedule-transfer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        staffId: staffId,
        fromGroup: fromGroup,
        toGroup: toGroup,
        executeAt: time
      })
    });
  }
  Swal.fire('สำเร็จ', 'บันทึกการตั้งเวลาย้ายกลุ่มแล้ว', 'success');
  selectedTransfer.clear();
  fetchTransfers();
  _doRenderTransferUserList();
};

window.fetchTransfers = async function() {
  try {
    const [dsRes, webRes] = await Promise.all([ fetch(DISCORD_API_URL + '/api/transfers').catch((() => ({
      json: () => ({
        pending: [],
        history: []
      })
    }))), typeof appDB !== 'undefined' ? appDB.from('scheduled_tasks').select('*').in('task_type', [ 'individual_shift_update', 'group_transfer' ]).order('created_at', {
      ascending: false
    }).limit(100) : Promise.resolve({
      data: []
    }) ]);
    const dsData = await dsRes.json();
    const webData = webRes.data || [];
    let allPending = [ ...dsData.pending || [] ];
    let allHistory = [ ...dsData.history || [] ];
    webData.forEach((t => {
      if (t.task_type === 'individual_shift_update') {
        const p = typeof t.payload === 'string' ? JSON.parse(t.payload) : t.payload;
        const format = {
          id: t.id,
          staffId: p.user_name,
          fromGroup: 'ระบบกะ',
          toGroup: p.target_shift,
          executeAt: t.scheduled_for,
          completedAt: t.completed_at
        };
        if (t.status === 'pending' || t.status === 'info_only') allPending.push(format); else if (t.status === 'completed') allHistory.push(format);
      }
    }));
    allPending = allPending.filter((t => {
      const existsInDs = extStaffList.some((s => s.id === t.staffId || s.name === t.staffId));
      const existsInDb = window.GLOBAL_USER_LIST ? window.GLOBAL_USER_LIST.some((u => u.username === t.staffId)) : false;
      return existsInDs || existsInDb;
    }));
    allPending.sort(((a, b) => new Date(a.executeAt) - new Date(b.executeAt)));
    allHistory.sort(((a, b) => new Date(b.completedAt) - new Date(a.completedAt)));
    scheduledTransfers = allPending;
    transferHistory = allHistory;
    renderTransferLists();
    renderTransferSummary();
  } catch (e) {
    console.error(e);
  }
};

window.renderTransferLists = function() {
  const pSearch = document.getElementById('searchPendingTransfer') ? document.getElementById('searchPendingTransfer').value.toLowerCase() : '';
  const hSearch = document.getElementById('searchHistoryTransfer') ? document.getElementById('searchHistoryTransfer').value.toLowerCase() : '';
  const pBox = document.getElementById('transferList');
  const hBox = document.getElementById('transferHistoryList');
  if (!pBox || !hBox) return;
  const filteredPending = scheduledTransfers.filter((t => {
    const s = extStaffList.find((x => x.id === t.staffId));
    const name = s ? s.name.toLowerCase() : t.staffId.toLowerCase();
    return name.includes(pSearch);
  }));
  if (filteredPending.length === 0) pBox.innerHTML = '<div class="text-center text-gray-500 text-xs py-4">ไม่มีรายการ</div>'; else {
    pBox.innerHTML = filteredPending.map((t => {
      const s = extStaffList.find((x => x.id === t.staffId));
      const name = s ? s.name : t.staffId;
      const dateStr = new Date(t.executeAt).toLocaleString('th-TH');
      return window.renderTemplate('tpl-ds-transfer-pending-row', {
        id: t.id,
        name: name,
        fromGroup: t.fromGroup,
        toGroup: t.toGroup,
        dateStr: dateStr
      });
    })).join('');
  }
  const filteredHistory = transferHistory.slice().filter((t => {
    const s = extStaffList.find((x => x.id === t.staffId));
    const name = s ? s.name.toLowerCase() : t.staffId.toLowerCase();
    return name.includes(hSearch);
  }));
  if (filteredHistory.length === 0) hBox.innerHTML = '<div class="text-center text-gray-500 text-xs py-4">ไม่มีประวัติ</div>'; else {
    hBox.innerHTML = filteredHistory.map((t => {
      const s = extStaffList.find((x => x.id === t.staffId));
      const name = s ? s.name : t.staffId;
      const dateStr = new Date(t.completedAt).toLocaleString('th-TH');
      return window.renderTemplate('tpl-ds-transfer-history-row', {
        name: name,
        fromGroup: t.fromGroup,
        toGroup: t.toGroup,
        dateStr: dateStr
      });
    })).join('');
  }
};

window.renderTransferSummary = function() {
  let summary = {};
  scheduledTransfers.forEach((t => {
    const key = `${t.fromGroup || '?'} ➝ ${t.toGroup}`;
    if (!summary[key]) summary[key] = 0;
    summary[key]++;
  }));
  const board = document.getElementById('transferSummaryBoard');
  if (!board) return;
  if (Object.keys(summary).length === 0) {
    board.innerHTML = '<span class="text-gray-500 text-sm py-2 font-bold flex items-center gap-2"><span class="material-icons text-[18px]">verified</span> ไม่มีคิวโอนย้ายรอดำเนินการ</span>';
  } else {
    board.innerHTML = Object.keys(summary).map((k => window.renderTemplate('tpl-ds-transfer-summary-card', {
      k: k,
      count: summary[k]
    }))).join('');
  }
};

window.showTransferSummaryDetail = function(key) {
  const filtered = scheduledTransfers.filter((t => `${t.fromGroup || '?'} ➝ ${t.toGroup}` === key));
  let listHtml = filtered.map(((t, i) => {
    const s = extStaffList.find((x => x.id === t.staffId));
    const name = s ? s.name : t.staffId;
    const dateStr = new Date(t.executeAt).toLocaleString('th-TH');
    return window.renderTemplate('tpl-ds-transfer-detail-row', {
      index: i + 1,
      searchName: name.toLowerCase(),
      name: name,
      dateStr: dateStr
    });
  })).join('');
  Swal.fire({
    title: `\n            <div class="flex flex-col gap-2 text-left w-full">\n                <div class="text-sm font-bold text-gray-400">รายการรอทำงาน:</div>\n                <div class="flex items-center justify-between border-b border-slate-700 pb-3">\n                    <div class="text-lg font-black text-emerald-400">${key}</div>\n                    <span class="text-xs text-white font-bold bg-slate-700 px-3 py-1 rounded-lg shadow-inner">${filtered.length} คน</span>\n                </div>\n            </div>\n        `,
    html: `\n            <div class="relative mb-3 mt-4">\n                <span class="material-icons absolute left-3 top-2.5 text-gray-400 text-[18px]">search</span>\n                <input type="text" id="popupSummarySearch" onkeyup="filterSummaryPopup()" placeholder="ค้นหาชื่อพนักงานในคิวนี้..." class="w-full pl-10 pr-3 py-2.5 bg-slate-900 border border-slate-600 text-white rounded-xl text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition">\n            </div>\n            <div class="max-h-[45vh] overflow-y-auto custom-scrollbar pr-2 text-left" id="popupSummaryList">\n                ${listHtml || '<div class="text-center text-gray-500 py-4 text-sm font-bold">ไม่มีข้อมูล</div>'}\n            </div>\n        `,
    showCloseButton: true,
    showConfirmButton: false,
    width: '500px',
    customClass: {
      popup: 'dark:bg-slate-800 dark:text-white rounded-[2rem] border border-slate-600 shadow-2xl'
    }
  });
};

window.filterSummaryPopup = function() {
  const term = document.getElementById('popupSummarySearch').value.toLowerCase();
  const list = document.getElementById('popupSummaryList');
  if (!list) return;
  const items = list.children;
  for (let i = 0; i < items.length; i++) {
    const nameEl = items[i].querySelector('[data-search-name]');
    if (nameEl) {
      const name = nameEl.getAttribute('data-search-name');
      items[i].style.display = name.includes(term) ? '' : 'none';
    }
  }
};

window.delTransfer = async function(id) {
  if (!window.dsRequire('ds_manage')) return;
  await fetch(DISCORD_API_URL + '/api/delete-transfer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: id
    })
  });
  fetchTransfers();
};
