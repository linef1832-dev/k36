window.currentSupportData = {};

window.getSupportKey = function(dateStr, shift) {
  return `duty_support_${currentDutyDept}_${dateStr}_${shift}`;
};

window.supportEntryKey = function(source, target) {
  return `${source}→${target}`;
};

window.normalizeSupportData = function(raw) {
  const out = {};
  Object.entries(raw || {}).forEach((([k, v]) => {
    if (!v || !Array.isArray(v.slots)) return;
    const target = v.target || k;
    const source = v.source || '?';
    out[window.supportEntryKey(source, target)] = {
      ...v,
      source: source,
      target: target
    };
  }));
  return out;
};

window.parseShiftTime = function(str, cfg) {
  const m = timeToMin(str);
  if (m == null || isNaN(m)) return null;
  const crossesMidnight = cfg.end > 24 * 60;
  return crossesMidnight && m < cfg.start ? m + 24 * 60 : m;
};

window.supportWindowPref = null;

window.rememberSupportWindow = function() {
  const s = document.getElementById('supportStartTime');
  const e = document.getElementById('supportEndTime');
  const shift = document.getElementById('dutyShiftSelect');
  if (!s || !e || !shift) return;
  window.supportWindowPref = {
    shift: shift.value,
    start: s.value,
    end: e.value
  };
};

window.resetSupportWindow = function() {
  window.supportWindowPref = null;
  window.renderHelpCalcPanel();
};

window.buildBreakMap = function(schedules, cfg) {
  const map = {};
  (schedules || []).forEach((sc => {
    if (!map[sc.staff_name]) map[sc.staff_name] = [];
    (sc.time_slot || '').split(',').map((t => t.trim())).filter(Boolean).forEach((slot => {
      const [s, e] = slot.split('-').map(timeToMin);
      if (s == null || e == null) return;
      if (cfg.start >= 20 * 60 && s < 12 * 60) map[sc.staff_name].push({
        s: s + 24 * 60,
        e: e + 24 * 60
      }); else map[sc.staff_name].push({
        s: s,
        e: e
      });
    }));
  }));
  return map;
};

window.splitShiftAmong = function(members, cfg, breakMap) {
  const n = members.length;
  if (n === 0) return [];
  const slotMin = Math.floor((cfg.end - cfg.start) / n);
  const slots = Array.from({
    length: n
  }, ((_, i) => ({
    start: cfg.start + i * slotMin,
    end: cfg.start + (i + 1) * slotMin
  })));
  slots[n - 1].end = cfg.end;
  const overlap = (name, a, b) => (breakMap[name] || []).reduce(((t, br) => t + Math.max(0, Math.min(br.e, b) - Math.max(br.s, a))), 0);
  const cost = (mi, si) => overlap(members[mi].username, slots[si].start, slots[si].end);
  const pairs = [];
  members.forEach(((_, mi) => slots.forEach(((_, si) => pairs.push({
    mi: mi,
    si: si,
    c: cost(mi, si)
  })))));
  pairs.sort(((a, b) => a.c - b.c));
  const assign = new Array(n).fill(-1);
  const usedM = new Set, usedS = new Set;
  pairs.forEach((p => {
    if (usedM.has(p.mi) || usedS.has(p.si)) return;
    usedM.add(p.mi);
    usedS.add(p.si);
    assign[p.si] = p.mi;
  }));
  for (let pass = 0; pass < 5; pass++) {
    let changed = false;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const mi = assign[i], mj = assign[j];
        if (mi < 0 || mj < 0) continue;
        if (cost(mi, j) + cost(mj, i) < cost(mi, i) + cost(mj, j)) {
          assign[i] = mj;
          assign[j] = mi;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  return assign.map(((mi, si) => ({
    id: members[mi].id,
    name: members[mi].username,
    start: slots[si].start,
    end: slots[si].end,
    breakMin: cost(mi, si)
  })));
};

window.assignSupportTeam = async function() {
  if (window.blockIfPreview()) return;
  if (!window.isDutyAdmin()) return;
  if (currentDutyDept !== 'AM') {
    return Swal.fire('ใช้ได้เฉพาะ AM', 'ระบบซัพพอร์ตข้ามเว็บเปิดใช้เฉพาะแผนก AM ครับ', 'info');
  }
  const shiftFilter = document.getElementById('dutyShiftSelect').value;
  const targetDate = document.getElementById('dutyDate').value;
  const cfg = SHIFT_CONFIG[shiftFilter];
  if (!cfg) return Swal.fire('เตือน', 'ระบบรองรับแค่กะเช้าและกะดึกครับ', 'warning');
  const srcEl = document.getElementById('supportSourceSel');
  const tgtEl = document.getElementById('supportTargetSel');
  const source = srcEl ? srcEl.value : '';
  const target = tgtEl ? tgtEl.value : '';
  if (!source || !target) return Swal.fire('เตือน', 'เลือกเว็บต้นทางและเว็บเป้าหมายก่อนครับ', 'warning');
  if (source === target) return Swal.fire('เตือน', 'เว็บต้นทางกับเป้าหมายต้องคนละเว็บครับ', 'warning');
  const roster = currentRosterData || {};
  const hasStaff = t => (roster[t] || []).filter((u => u && u.id && !String(u.username || '').includes('ขาดคน')));
  const members = hasStaff(source);
  if (members.length === 0) {
    const usable = (sortedTeams || []).filter((t => hasStaff(t).length > 0));
    return Swal.fire({
      icon: 'error',
      title: `เว็บ ${source} ไม่มีคน`,
      html: usable.length ? `<div style="font-size:13px;color:var(--k-tx3);line-height:1.8">เว็บนี้ไม่มีพนักงานในตารางวันนี้ จึงส่งไปช่วยใครไม่ได้<br><br>\n                     เว็บที่ส่งคนไปช่วยได้:<br><b style="color:light-dark(#0676a8,#38bdf8)">${usable.map((t => `${t} (${hasStaff(t).length})`)).join(' · ')}</b></div>` : `<div style="font-size:13px;color:var(--k-tx3)">ยังไม่ได้จัดเวรของวันนี้เลย — กด <b style="color:light-dark(#0917a4,#818cf8)">"สุ่มจัดหน้าที่"</b> ก่อนครับ</div>`,
      background: '#0b1120',
      confirmButtonColor: '#6366f1',
      customClass: {
        popup: 'rounded-3xl border border-slate-700 dark:text-white'
      }
    });
  }
  const sEl = document.getElementById('supportStartTime');
  const eEl = document.getElementById('supportEndTime');
  const winStart = sEl && sEl.value ? window.parseShiftTime(sEl.value, cfg) : cfg.start;
  const winEnd = eEl && eEl.value ? window.parseShiftTime(eEl.value, cfg) : cfg.end;
  const badTime = msg => Swal.fire({
    icon: 'warning',
    title: 'ช่วงเวลาไม่ถูกต้อง',
    html: `<div style="font-size:13px;color:var(--k-tx3);line-height:1.8">${msg}<br><br>\n                 กะ <b style="color:var(--k-tx)">${shiftFilter}</b> อยู่ในช่วง\n                 <b style="color:light-dark(#0676a8,#38bdf8)">${minToTime(cfg.start)}–${minToTime(cfg.end)}</b></div>`,
    background: '#0b1120',
    confirmButtonColor: '#6366f1',
    customClass: {
      popup: 'rounded-3xl border border-slate-700 dark:text-white'
    }
  });
  if (winStart == null || winEnd == null) return badTime('กรอกเวลาไม่ครบหรือรูปแบบไม่ถูกต้อง');
  if (winStart >= winEnd) return badTime('เวลาเริ่มต้องมาก่อนเวลาสิ้นสุด');
  if (winStart < cfg.start || winEnd > cfg.end) return badTime('ช่วงเวลาต้องอยู่ในกะนี้เท่านั้น');
  const spanMin = winEnd - winStart;
  if (spanMin < members.length * 15) {
    return badTime(`ช่วงนี้ยาว ${spanMin} นาที แบ่งให้ ${members.length} คนแล้วได้คนละไม่ถึง 15 นาที`);
  }
  const breakMap = window.buildBreakMap(window.currentDutySchedules || [], cfg);
  const slots = window.splitShiftAmong(members, {
    start: winStart,
    end: winEnd
  }, breakMap);
  const perSlot = Math.floor(spanMin / members.length);
  const preview = slots.map(((s, i) => `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--k-line)">\n            <span style="width:18px;height:18px;border-radius:50%;background:#0369a1;color:#fff;font-size:9px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i + 1}</span>\n            <span style="flex:1;text-align:left;font-weight:800;font-size:12px;color:var(--k-tx)">${window.escapeHtml(s.name)}</span>\n            <span style="font-size:11px;font-weight:800;color:light-dark(#0676a8,#38bdf8)">${minToTime(s.start)}–${minToTime(s.end)}</span>\n            <span style="font-size:9px;color:${s.breakMin > 0 ? 'var(--k-amber-tx)' : 'var(--k-green-tx)'};min-width:56px;text-align:right">${s.breakMin > 0 ? `พักใน ${s.breakMin} น.` : 'ไม่ชนพัก'}</span>\n        </div>`)).join('');
  const clashes = [];
  slots.forEach((s => {
    (window.getSupportForUser(s.id) || []).forEach((prev => {
      if (prev.target === target && prev.source === source) return;
      if (s.start < prev.end && prev.start < s.end) {
        clashes.push(`${window.escapeHtml(s.name)} — ช่วยเว็บ ${prev.target} อยู่แล้ว ${minToTime(prev.start)}–${minToTime(prev.end)}`);
      }
    }));
  }));
  const existingKey = window.supportEntryKey(source, target);
  const isReplace = !!window.currentSupportData[existingKey];
  const confirm = await Swal.fire({
    title: `<div style="font-size:15px;font-weight:900">🤝 ${source} → ซัพพอร์ต ${target}</div>`,
    html: `<div style="font-size:11.5px;color:var(--k-tx3);margin-bottom:10px">\n                   ช่วง <b style="color:light-dark(#0676a8,#38bdf8)">${minToTime(winStart)}–${minToTime(winEnd)}</b>\n                   ${spanMin === cfg.end - cfg.start ? '<span style="opacity:.7">(เต็มกะ)</span>' : `<span style="opacity:.7">(${Math.floor(spanMin / 60)} ชม. ${spanMin % 60 ? spanMin % 60 + ' น.' : ''})</span>`}\n                   <br>${members.length} คน ผลัดกันคนละ <b style="color:var(--k-tx)">${perSlot} นาที</b>\n               </div>\n               ${isReplace ? `<div style="background:rgba(251,191,36,.12);border:1px solid rgba(251,191,36,.35);border-radius:10px;padding:7px 10px;font-size:11px;color:var(--k-amber-tx);margin-bottom:8px;text-align:left">\n                   ⚠️ มีตาราง <b>${source} → ${target}</b> อยู่แล้ว กดยืนยันจะเขียนทับของเดิม</div>` : ''}\n               ${clashes.length ? `<div style="background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.35);border-radius:10px;padding:7px 10px;font-size:11px;color:var(--k-red-tx);margin-bottom:8px;text-align:left;line-height:1.7">\n                   🚨 <b>เวลาชนกัน</b> — คนเหล่านี้ถูกจัดไปช่วยที่อื่นในเวลาเดียวกันอยู่แล้ว:<br>${clashes.join('<br>')}</div>` : ''}\n               <div style="max-height:46vh;overflow-y:auto">${preview}</div>`,
    background: '#0b1120',
    width: 480,
    showCancelButton: true,
    confirmButtonText: 'บันทึกตารางนี้',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#0284c7',
    cancelButtonColor: '#475569',
    customClass: {
      popup: 'rounded-3xl border border-slate-700 dark:text-white'
    }
  });
  if (!confirm.isConfirmed) return;
  Swal.fire({
    title: 'กำลังบันทึก...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });
  try {
    window.currentSupportData[existingKey] = {
      source: source,
      target: target,
      slots: slots,
      win: {
        start: winStart,
        end: winEnd
      }
    };
    window.clearSettingCache();
    const {error: error} = await appDB.from('settings').upsert([ {
      key: window.getSupportKey(targetDate, shiftFilter),
      value: JSON.stringify(window.currentSupportData)
    } ]);
    if (error) throw error;
    await appDB.from('system_logs').insert([ {
      action_type: 'จัดซัพพอร์ต',
      performed_by: currentUser.username,
      target_details: `${source} → ซัพพอร์ต ${target} (${members.length} คน คนละ ${perSlot} นาที, ` + `${currentDutyDept}, ${shiftFilter}, ${targetDate}) — ` + slots.map((s => `${s.name} ${minToTime(s.start)}-${minToTime(s.end)}`)).join(', ')
    } ]);
    window.debouncedBroadcast('duty-updates', 'force_reload');
    window.renderRosterGrid(currentRosterData);
    window.renderHelpCalcPanel();
    Swal.fire({
      icon: 'success',
      title: 'บันทึกแล้ว!',
      text: `${source} จะช่วย ${target} ผลัดกันคนละ ${perSlot} นาที`,
      timer: 2200,
      showConfirmButton: false
    });
  } catch (e) {
    Swal.fire('Error', e.message, 'error');
  }
};

window.clearSupportForTarget = async function(entryKey) {
  if (!window.isDutyAdmin()) return;
  const shiftFilter = document.getElementById('dutyShiftSelect').value;
  const targetDate = document.getElementById('dutyDate').value;
  const info = (window.currentSupportData || {})[entryKey];
  if (!info) return;
  const target = info.target || entryKey;
  const ok = await Swal.fire({
    icon: 'warning',
    title: `ลบตาราง ${info.source} → ${target}?`,
    text: 'ตารางซัพพอร์ตคู่อื่นจะไม่ถูกแตะ',
    showCancelButton: true,
    confirmButtonText: 'ลบ',
    cancelButtonText: 'ไม่',
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    customClass: {
      popup: 'dark:bg-slate-800 dark:text-white rounded-3xl'
    }
  });
  if (!ok.isConfirmed) return;
  try {
    delete window.currentSupportData[entryKey];
    window.clearSettingCache();
    await appDB.from('settings').upsert([ {
      key: window.getSupportKey(targetDate, shiftFilter),
      value: JSON.stringify(window.currentSupportData)
    } ]);
    await appDB.from('system_logs').insert([ {
      action_type: 'จัดซัพพอร์ต',
      performed_by: currentUser.username,
      target_details: `ลบตารางซัพพอร์ต ${info.source} → ${target} (${currentDutyDept}, ${shiftFilter}, ${targetDate})`
    } ]);
    window.debouncedBroadcast('duty-updates', 'force_reload');
    window.renderRosterGrid(currentRosterData);
    window.renderHelpCalcPanel();
    Swal.fire({
      icon: 'success',
      title: 'ลบแล้ว',
      timer: 1200,
      showConfirmButton: false
    });
  } catch (e) {
    Swal.fire('Error', e.message, 'error');
  }
};

window.getSupportForUser = function(userId) {
  const found = [];
  Object.values(window.currentSupportData || {}).forEach((info => {
    const hit = (info.slots || []).find((s => String(s.id) === String(userId)));
    if (hit) found.push({
      target: info.target,
      source: info.source,
      ...hit
    });
  }));
  return found.sort(((a, b) => a.start - b.start));
};

window.calcHelpTime = async function() {
  const shiftFilter = document.getElementById('dutyShiftSelect').value;
  const cfg = SHIFT_CONFIG[shiftFilter];
  if (!cfg) return Swal.fire('เตือน', 'ระบบรองรับแค่กะเช้าและกะดึกครับ', 'warning');
  const targetDate = document.getElementById('dutyDate').value;
  const shiftDuration = cfg.end - cfg.start;
  let roster = {};
  let schedules = [];
  try {
    const key = getDutySaveKey(targetDate, shiftFilter);
    const [rosterRes, schedRes] = await Promise.all([ appDB.from('settings').select('value').eq('key', key), appDB.from('schedules').select('staff_name, time_slot').eq('work_date', targetDate).eq('shift_name', shiftFilter) ]);
    if (rosterRes.data?.[0]?.value) roster = JSON.parse(rosterRes.data[0].value);
    if (schedRes.data?.length > 0) schedules = schedRes.data;
  } catch (e) {}
  if (Object.keys(roster).length === 0) roster = currentRosterData || {};
  if (schedules.length === 0) schedules = window.currentDutySchedules || [];
  const breakMap = window.buildBreakMap(schedules, cfg);
  const results = [];
  Object.keys(roster).forEach((team => {
    const members = (roster[team] || []).filter((u => u && !String(u.username || '').includes('ขาดคน')));
    if (members.length === 0) return;
    const slotMin = Math.floor(shiftDuration / members.length);
    window.splitShiftAmong(members, cfg, breakMap).forEach((sl => {
      results.push({
        team: team,
        name: sl.name,
        helpStart: sl.start,
        helpEnd: sl.end,
        breakMin: sl.breakMin,
        slotMin: slotMin
      });
    }));
  }));
  window.helpCalcResult = results;
  window.renderHelpCalcPanel();
};

window.dutyStayPins = {};

window.getStayPinKey = function() {
  return `duty_stay_pins_${currentDutyDept}`;
};

window.canManageStayPin = function() {
  if (window.isDutyAdmin()) return true;
  return typeof window.hasUserPerm === 'function' && window.hasUserPerm('duty_stay_pin');
};

window.dutyAddDays = function(dateStr, n) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
};

window.dutyDiffDays = function(fromStr, toStr) {
  const p = s => {
    const [y, m, d] = String(s).split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((p(toStr) - p(fromStr)) / 864e5);
};

window.dutyTodayStr = function() {
  const t = new Date;
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

window.dutyFmtShortDate = function(dateStr) {
  const TH_MONTHS = [ 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.' ];
  const [y, m, d] = String(dateStr).split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  return `${d} ${TH_MONTHS[m - 1]} ${String(y + 543).slice(-2)}`;
};

window.loadStayPins = async function() {
  try {
    const {data: data} = await appDB.from('settings').select('value').eq('key', window.getStayPinKey()).maybeSingle();
    window.dutyStayPins = data && data.value ? JSON.parse(data.value) : {};
  } catch (e) {
    window.dutyStayPins = {};
  }
  return window.dutyStayPins;
};

window.prunePins = function(pins) {
  const today = window.dutyTodayStr();
  let changed = false;
  const kept = {};
  Object.entries(pins || {}).forEach((([uid, p]) => {
    if (p && p.until && p.until >= today) kept[uid] = p; else changed = true;
  }));
  if (changed) {
    window.dutyStayPins = kept;
    window.clearSettingCache();
    appDB.from('settings').upsert([ {
      key: window.getStayPinKey(),
      value: JSON.stringify(kept)
    } ]).then((() => {}), (e => console.warn('[stayPin] prune failed', e)));
  }
  return kept;
};

window.saveStayPins = async function() {
  window.clearSettingCache();
  const {error: error} = await appDB.from('settings').upsert([ {
    key: window.getStayPinKey(),
    value: JSON.stringify(window.dutyStayPins)
  } ]);
  if (error) throw error;
};

window.getActiveStayPin = function(userId, dateStr) {
  const p = (window.dutyStayPins || {})[String(userId)];
  if (!p || !p.until || !p.from) return null;
  if (dateStr < p.from || dateStr > p.until) return null;
  return p;
};

window.getLiveStayPin = function(userId, dateStr) {
  return window.getActiveStayPin(userId, dateStr || window.dutyTodayStr());
};

window.renderStayPinHtml = function(a, team, isAdmin) {
  if (!a || !a.id) return '';
  if (!isAdmin) return '';
  const dateEl = document.getElementById('dutyDate');
  const dateStr = dateEl ? dateEl.value : window.dutyTodayStr();
  const pin = window.getLiveStayPin(a.id, dateStr);
  const safeName = String(a.username || '').replace(/'/g, "\\'");
  if (pin) {
    const left = Math.max(0, window.dutyDiffDays(dateStr, pin.until));
    const warn = pin.team !== team ? `<span class="text-[9px] text-red-600 dark:text-red-400 font-bold ml-1" title="pin ชี้ไปเว็บ ${window.escapeHtml(pin.team)}">(≠ ${pin.team})</span>` : '';
    return `<div onclick="event.stopPropagation(); openStayPinModal('${team}', '${a.id}', '${safeName}')"\n            title="คลิกเพื่อแก้ไข / ยกเลิกการอยู่ต่อ"\n            class="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-300 px-2.5 py-1 rounded-md border border-amber-300 dark:border-amber-800/50 w-fit shadow-sm cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-800/40 transition">\n            <span class="material-icons text-[14px]">push_pin</span>\n            อยู่ต่อ ${left > 0 ? `อีก ${left} วัน` : 'วันสุดท้าย'} (ถึง ${window.dutyFmtShortDate(pin.until)})${warn}\n            <span class="material-icons text-[11px] opacity-50 ml-0.5">edit</span>\n        </div>`;
  }
  return `<div onclick="event.stopPropagation(); openStayPinModal('${team}', '${a.id}', '${safeName}')"\n        title="ล็อกให้อยู่เว็บนี้ต่ออีกหลายวัน"\n        class="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 bg-slate-50 dark:bg-slate-800/50 hover:bg-amber-50 dark:hover:bg-amber-900/20 px-2 py-0.5 rounded-md border border-dashed border-slate-300 dark:border-slate-600 hover:border-amber-400 w-fit transition cursor-pointer">\n        <span class="material-icons text-[13px]">push_pin</span> อยู่ต่อ...\n    </div>`;
};

window.isRosterPreview = false;

window.buildStayPinPreview = function(dateStr, shiftFilter) {
  const roster = {};
  sortedTeams.forEach((t => roster[t] = []));
  let count = 0;
  Object.keys(window.dutyStayPins || {}).forEach((uid => {
    const pin = window.getActiveStayPin(uid, dateStr);
    if (!pin || !pin.team || !sortedTeams.includes(pin.team)) return;
    if (currentDutyLeaves.has(String(uid))) return;
    const u = (GLOBAL_USER_LIST || []).find((x => String(x.id) === String(uid)));
    if (!u) return;
    if (!window.isDutyShiftMatch(u, shiftFilter)) return;
    let uDept = u.department || 'AM';
    if (uDept === 'TRAINER') uDept = 'AMQL';
    if (uDept !== currentDutyDept) return;
    roster[pin.team].push({
      ...u,
      secondary_team: null,
      stay_pinned: true
    });
    count++;
  }));
  return {
    roster: roster,
    count: count
  };
};

window.blockIfPreview = function() {
  if (!window.isRosterPreview) return false;
  Swal.fire({
    icon: 'info',
    title: 'ยังไม่ได้จัดเวรวันนี้',
    html: `<div style="font-size:13px;color:var(--k-tx3);line-height:1.7">\n                 ที่เห็นอยู่เป็น <b style="color:var(--k-amber-tx)">ภาพตัวอย่าง</b> จากคนที่ถูกล็อก "อยู่ต่อ" เท่านั้น<br>\n                 กรุณากด <b style="color:light-dark(#0917a4,#818cf8)">"สุ่มจัดหน้าที่"</b> เพื่อจัดคนที่เหลือให้ครบก่อนครับ\n               </div>`,
    background: '#0b1120',
    confirmButtonText: 'เข้าใจแล้ว',
    confirmButtonColor: '#6366f1',
    customClass: {
      popup: 'rounded-3xl border border-slate-700 dark:text-white'
    }
  });
  return true;
};

window.openStayPinModal = async function(team, userId, username) {
  if (!window.canManageStayPin()) return;
  const dateStr = document.getElementById('dutyDate').value;
  const shift = document.getElementById('dutyShiftSelect').value;
  if (!dateStr) return Swal.fire('!', 'กรุณาเลือกวันที่ก่อน', 'warning');
  const existing = window.getLiveStayPin(userId, dateStr);
  const baseDate = dateStr;
  const defaultDays = existing ? Math.max(1, window.dutyDiffDays(dateStr, existing.until)) : 3;
  const movingFrom = existing && existing.team !== team ? existing.team : null;
  const chip = n => `<button type="button" data-days="${n}"\n        class="stay-day-chip px-3 py-2 rounded-lg border-2 font-black text-sm transition"\n        style="min-width:44px">${n}</button>`;
  const {value: result} = await Swal.fire({
    title: `<div class="text-base font-black">📌 ให้อยู่เว็บ <span style="color:light-dark(#0e119f,#6366f1)">${team}</span> ต่ออีกกี่วัน?</div>`,
    html: `\n            <div style="text-align:left">\n                <div style="font-size:12px;color:var(--k-tx3);margin-bottom:14px">\n                    พนักงาน: <b style="color:var(--k-tx);font-size:14px">${username}</b>\n                    &nbsp;•&nbsp; กะ: <b style="color:var(--k-tx)">${shift}</b>\n                </div>\n\n                ${movingFrom ? `<div style="background:rgba(56,189,248,.12);border:1px solid rgba(56,189,248,.35);border-radius:10px;padding:8px 11px;font-size:11.5px;color:light-dark(#0474a9,#7dd3fc);margin-bottom:14px;line-height:1.6">\n                    🔀 เดิมล็อกไว้ที่เว็บ <b>${movingFrom}</b> — กดยืนยันแล้วจะย้ายมาล็อกที่ <b>${team}</b> แทน\n                </div>` : ''}\n\n                <div style="font-size:11px;font-weight:800;color:var(--k-mute);letter-spacing:.5px;margin-bottom:6px">เลือกจำนวนวัน</div>\n                <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">\n                    ${[ 1, 2, 3, 4, 5, 7, 14 ].map(chip).join('')}\n                </div>\n\n                <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">\n                    <span style="font-size:11px;font-weight:800;color:var(--k-mute)">หรือพิมพ์เอง</span>\n                    <input id="stayDaysInput" type="number" min="1" max="60" value="${defaultDays}"\n                        style="width:80px;padding:8px 10px;border-radius:10px;border:1.5px solid var(--k-line2);background:var(--k-panel2);color:var(--k-tx);font-weight:800;text-align:center;outline:none">\n                    <span style="font-size:12px;color:var(--k-tx3)">วัน</span>\n                </div>\n\n                <div id="stayPreview" style="background:rgba(99,102,241,.12);border:1px solid rgba(99,102,241,.35);border-radius:12px;padding:10px 12px;font-size:12px;color:var(--k-tx);line-height:1.7"></div>\n\n                <div style="margin-top:10px;font-size:10.5px;color:var(--k-mute);line-height:1.6">\n                    ℹ️ ระบบจะจัด <b>${username}</b> ลงเว็บ <b>${team}</b> ให้อัตโนมัติทุกครั้งที่กด "สุ่มจัดหน้าที่" ในช่วงวันดังกล่าว\n                    (ข้ามกฎห้ามซ้ำเว็บเดิม) — ถ้าวันไหนติดลาหยุด ระบบจะข้ามวันนั้นให้เอง\n                </div>\n            </div>\n        `,
    background: '#0b1120',
    showCancelButton: true,
    showDenyButton: !!existing,
    confirmButtonText: existing ? 'อัปเดต' : 'ยืนยัน',
    denyButtonText: 'ยกเลิกการอยู่ต่อ',
    cancelButtonText: 'ปิด',
    confirmButtonColor: '#6366f1',
    denyButtonColor: '#ef4444',
    cancelButtonColor: '#475569',
    customClass: {
      popup: 'rounded-3xl border border-slate-700 dark:text-white'
    },
    didOpen: () => {
      const input = document.getElementById('stayDaysInput');
      const preview = document.getElementById('stayPreview');
      const chips = Array.from(document.querySelectorAll('.stay-day-chip'));
      const paint = () => {
        const n = parseInt(input.value) || 0;
        chips.forEach((c => {
          const on = parseInt(c.dataset.days) === n;
          c.style.borderColor = on ? '#6366f1' : '#334155';
          c.style.background = on ? 'rgba(99,102,241,.2)' : '#0f172a';
          c.style.color = on ? '#c7d2fe' : '#94a3b8';
        }));
        if (n < 1) {
          preview.innerHTML = '<span style="color:var(--k-red-tx)">กรุณาใส่จำนวนวันอย่างน้อย 1 วัน</span>';
          return;
        }
        const until = window.dutyAddDays(baseDate, n);
        const start = window.dutyAddDays(baseDate, 1);
        preview.innerHTML = `📅 อยู่เว็บ <b>${team}</b> ตั้งแต่ <b>${window.dutyFmtShortDate(start)}</b>` + ` ถึง <b>${window.dutyFmtShortDate(until)}</b> รวม <b>${n} วัน</b>`;
      };
      chips.forEach((c => c.addEventListener('click', (() => {
        input.value = c.dataset.days;
        paint();
      }))));
      input.addEventListener('input', paint);
      paint();
    },
    preConfirm: () => {
      const n = parseInt(document.getElementById('stayDaysInput').value) || 0;
      if (n < 1) {
        Swal.showValidationMessage('ใส่จำนวนวันอย่างน้อย 1 วันครับ');
        return false;
      }
      if (n > 60) {
        Swal.showValidationMessage('เกิน 60 วันไม่ได้ครับ');
        return false;
      }
      return {
        days: n
      };
    }
  });
  if (result === false) return window.removeStayPin(userId, username);
  if (!result || !result.days) return;
  const until = window.dutyAddDays(baseDate, result.days);
  Swal.fire({
    title: 'กำลังบันทึก...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });
  try {
    window.dutyStayPins[String(userId)] = {
      username: username,
      team: team,
      shift: shift,
      from: baseDate,
      until: until,
      days: result.days,
      by: currentUser.username
    };
    await window.saveStayPins();
    await appDB.from('system_logs').insert([ {
      action_type: 'ล็อกอยู่ต่อ',
      performed_by: currentUser.username,
      target_details: `ล็อก ${username} ให้อยู่เว็บ [${team}] ต่ออีก ${result.days} วัน ` + `(${window.dutyAddDays(baseDate, 1)} ถึง ${until}, แผนก ${currentDutyDept}, กะ ${shift})` + (movingFrom ? ` — ย้ายมาจากเว็บ [${movingFrom}]` : '')
    } ]);
    window.debouncedBroadcast('duty-updates', 'force_reload');
    window.renderRosterGrid(currentRosterData);
    window.updateStayPinButton();
    Swal.fire({
      icon: 'success',
      title: movingFrom ? 'ย้ายการล็อกเรียบร้อย!' : 'ล็อกเรียบร้อย!',
      html: (movingFrom ? `ย้ายจากเว็บ <b>${movingFrom}</b> → <b>${team}</b><br>` : '') + `<b>${username}</b> จะอยู่เว็บ <b>${team}</b> ถึงวันที่ <b>${window.dutyFmtShortDate(until)}</b>`,
      timer: 2600,
      showConfirmButton: false
    });
  } catch (e) {
    Swal.fire('Error', e.message, 'error');
  }
};

window.removeStayPin = async function(userId, username) {
  if (!window.canManageStayPin()) return;
  const pin = (window.dutyStayPins || {})[String(userId)];
  if (!pin) return;
  const ok = await Swal.fire({
    icon: 'warning',
    title: 'ยกเลิกการอยู่ต่อ?',
    html: `<b>${window.escapeHtml(username || pin.username)}</b> จะกลับไปหมุนเว็บตามปกติ`,
    showCancelButton: true,
    confirmButtonText: 'ยกเลิกการล็อก',
    cancelButtonText: 'ไม่',
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    customClass: {
      popup: 'dark:bg-slate-800 dark:text-white rounded-3xl'
    }
  });
  if (!ok.isConfirmed) return;
  try {
    delete window.dutyStayPins[String(userId)];
    await window.saveStayPins();
    await appDB.from('system_logs').insert([ {
      action_type: 'ล็อกอยู่ต่อ',
      performed_by: currentUser.username,
      target_details: `ยกเลิกล็อก ${username || pin.username} (เดิมอยู่เว็บ [${pin.team}] ถึง ${pin.until}, แผนก ${currentDutyDept})`
    } ]);
    window.debouncedBroadcast('duty-updates', 'force_reload');
    window.renderRosterGrid(currentRosterData);
    window.updateStayPinButton();
    Swal.fire({
      icon: 'success',
      title: 'ยกเลิกแล้ว',
      timer: 1200,
      showConfirmButton: false
    });
  } catch (e) {
    Swal.fire('Error', e.message, 'error');
  }
};

window.updateStayPinButton = function() {
  const btn = document.getElementById('btnStayPinList');
  if (!btn) return;
  if (!window.canManageStayPin()) {
    btn.style.display = 'none';
    return;
  }
  btn.style.display = 'flex';
  const today = window.dutyTodayStr();
  const n = Object.values(window.dutyStayPins || {}).filter((p => p && p.until >= today)).length;
  const badge = document.getElementById('stayPinCount');
  if (badge) badge.innerText = n;
  if (n > 0) btn.classList.remove('opacity-60'); else btn.classList.add('opacity-60');
};
