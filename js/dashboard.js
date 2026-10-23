function _mtTaskDateTH(ts) {
  if (!ts) return '';
  let s = String(ts).trim().replace(' ', 'T');
  if (!/([zZ]|[+-]\d\d(:?\d\d)?)$/.test(s)) s += 'Z';
  const d = new Date(s);
  if (isNaN(d)) return String(ts).slice(0, 10);
  return new Date(d.getTime() + 7 * 36e5).toISOString().slice(0, 10);
}

window.initDashboard = async function() {
  if (!window.currentUser || !window.currentUser.id) {
    const savedUser = sessionStorage.getItem('user_platinum_plus');
    if (savedUser) {
      window.currentUser = JSON.parse(savedUser);
    } else {
      let retry = 0;
      while ((!window.currentUser || !window.currentUser.id) && retry < 10) {
        await new Promise((r => setTimeout(r, 100)));
        retry++;
      }
      if (!window.currentUser || !window.currentUser.id) return;
    }
  }
  if (typeof window.refreshCurrentUserFromDB === 'function') await window.refreshCurrentUserFromDB();
  if (typeof updateDashboardUserInfo === 'function') updateDashboardUserInfo();
  const btnCheckMissing = document.getElementById('btnCheckMissingLunch');
  if (btnCheckMissing) {
    if (window.hasUserPerm('admin') || window.hasUserPerm('leave_manage_am')) {
      btnCheckMissing.classList.remove('hidden');
    }
  }
  if (typeof populateTeamSelects === 'function') populateTeamSelects();
  const dInput = document.getElementById('wDate');
  if (dInput) {
    const today = new Date;
    const currentHour = today.getHours();
    if (currentHour >= 0 && currentHour < 8) {
      today.setDate(today.getDate() - 1);
    }
    const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 6e4).toISOString().split('T')[0];
    dInput.value = localDate;
    const displayDate = document.getElementById('displayDate');
    if (displayDate) displayDate.innerText = new Date(localDate).toLocaleDateString('th-TH');
  }
  if (typeof renderShiftButtons === 'function') renderShiftButtons(window.currentUser.allowed_shift);
  if (typeof initQuickRebook === 'function') setTimeout((() => initQuickRebook()), 400);
  localStorage.removeItem(`last_team_${window.currentUser.username}`);
  const teamSelect = document.getElementById('dailyTeam');
  if (teamSelect && window.currentUser.team) teamSelect.value = window.currentUser.team;
  if (typeof window.renderMyToday === 'function') window.renderMyToday();
  if (typeof refreshTimeSlots === 'function') await refreshTimeSlots();
  if (typeof fetchData === 'function') fetchData();
  if (typeof subscribeDashboardChanges === 'function') subscribeDashboardChanges();
};

window.updateDashboardUserInfo = function() {
  if (!window.currentUser || !window.currentUser.id) return;
  if (document.getElementById('uName')) {
    document.getElementById('uName').innerText = window.currentUser.username || 'Unknown';
  }
  const _uTagEl = document.getElementById('uTagBadge');
  if (_uTagEl) {
    const _tag = window.currentUser.tag;
    _uTagEl.innerHTML = window.getTagBadge && _tag ? window.getTagBadge(_tag, currentUser?.department) : '';
  }
  if (document.getElementById('checkTypeDisplay')) document.getElementById('checkTypeDisplay').innerText = window.currentUser.check_type === 'shift' ? 'เช็คโควตากะ' : 'เช็คโควตาทีม';
  if (document.getElementById('quotaDisplay')) document.getElementById('quotaDisplay').innerText = window.currentUser.department || 'AM';
  if (typeof SETTINGS !== 'undefined') {
    if (document.getElementById('periodLimitDisplay')) document.getElementById('periodLimitDisplay').innerText = SETTINGS.period_limit || 1;
    if (document.getElementById('limitDisplay')) document.getElementById('limitDisplay').innerText = SETTINGS.daily_limit || 2;
  }
};

window.populateTeamSelects = function() {
  const dt = document.getElementById('dailyTeam');
  const tf = document.getElementById('tableTeamFilter');
  const nt = document.getElementById('newTeam');
  const mt = document.getElementById('moveTargetTeam');
  let html = '';
  let fHtml = '<option value="all">-- ทุกเว็บ --</option>';
  let ntHtml = '<option value="">- ไม่ระบุทีม -</option>';
  const sortedTeams = [ ...typeof TEAM_LIST !== 'undefined' ? TEAM_LIST : [] ].sort(((a, b) => a.localeCompare(b)));
  sortedTeams.forEach((t => {
    html += `<option value="${t}">${t}</option>`;
    fHtml += `<option value="${t}">${t}</option>`;
    ntHtml += `<option value="${t}">${t}</option>`;
  }));
  if (dt) dt.innerHTML = html;
  if (tf) tf.innerHTML = fHtml;
  if (nt) nt.innerHTML = ntHtml;
  if (mt) mt.innerHTML = ntHtml;
  if (dt && window.currentUser && window.currentUser.team) dt.value = window.currentUser.team;
};

window.renderShiftButtons = function(allowedShift) {
  const container = document.getElementById('shiftContainer');
  if (!container) return;
  container.innerHTML = '';
  const shifts = [ 'กะเช้า', 'กะกลาง', 'กะดึก' ];
  let hasChecked = false;
  const shiftRight = allowedShift || 'all';
  const isAdmin = window.hasUserPerm('ds_manage') || window.hasUserPerm('admin');
  const canViewAllShifts = isAdmin || window.hasUserPerm('dashboard_view_all_shifts');
  shifts.forEach(((s, index) => {
    if (!canViewAllShifts && shiftRight !== 'all' && shiftRight !== s) {
      return;
    }
    let bgClass = 'bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer';
    let textClass = 'text-gray-700 dark:text-gray-300';
    let borderClass = 'border-gray-200 dark:border-slate-600';
    let isChecked = false;
    if (!hasChecked) {
      if (shiftRight === 'all' || isAdmin) {
        if (index === 0) {
          isChecked = true;
          hasChecked = true;
        }
      } else if (shiftRight === s) {
        isChecked = true;
        hasChecked = true;
      }
    }
    let icon = s === 'กะเช้า' ? 'wb_sunny' : s === 'กะกลาง' ? 'cloud' : 'dark_mode';
    let color = s === 'กะเช้า' ? 'text-orange-500' : s === 'กะกลาง' ? 'text-blue-500' : 'text-purple-500';
    container.innerHTML += `\n            <label class="relative flex items-center justify-center rounded-xl border-2 ${borderClass} ${bgClass} transition shadow-sm" style="gap:5px;padding:9px 4px;user-select:none">\n                <input type="radio" name="shift" value="${s}" class="peer hidden" onchange="refreshTimeSlots(); if(typeof fetchData==='function') fetchData();" ${isChecked ? 'checked' : ''}>\n                <span class="material-icons ${color} peer-checked:scale-110 transition-transform" style="font-size:16px">${icon}</span>\n                <span class="font-bold ${textClass}" style="font-size:12px;white-space:nowrap">${s}</span>\n                <div class="absolute inset-0 border-2 border-transparent peer-checked:border-blue-500 rounded-xl pointer-events-none transition-colors"></div>\n                <div class="absolute rounded-full bg-blue-500 opacity-0 peer-checked:opacity-100 transition-opacity" style="top:4px;right:5px;width:7px;height:7px"></div>\n            </label>\n        `;
  }));
};

window.initQuickRebook = async function() {
  const box = document.getElementById('quickRebookBox');
  if (!box || !window.currentUser || !currentUser.username) return;
  box.innerHTML = '';
  try {
    const today = document.getElementById('wDate') ? document.getElementById('wDate').value : '';
    if (!today) return;
    const y = new Date(today + 'T00:00:00');
    y.setDate(y.getDate() - 1);
    const p2 = n => String(n).padStart(2, '0');
    const yISO = `${y.getFullYear()}-${p2(y.getMonth() + 1)}-${p2(y.getDate())}`;
    const [yr, tr] = await Promise.all([ appDB.from('schedules').select('team, shift_name, time_slot').eq('work_date', yISO).eq('staff_name', currentUser.username).order('time_slot'), appDB.from('schedules').select('shift_name, time_slot').eq('work_date', today).eq('staff_name', currentUser.username) ]);
    const yest = yr.data || [];
    if (!yest.length) return;
    const doneToday = new Set((tr.data || []).map((m => `${m.shift_name}|${m.time_slot}`)));
    const items = yest.filter((b => !doneToday.has(`${b.shift_name}|${b.time_slot}`)));
    if (!items.length) return;
    window._qrbItems = items;
    const esc = v => window.escapeHtml ? window.escapeHtml(v) : String(v ?? '');
    box.innerHTML = `\n        <div style="background:linear-gradient(135deg,rgba(59,130,246,.12),rgba(99,102,241,.08));border:1px solid rgba(96,165,250,.35);border-radius:14px;padding:11px 13px;margin-bottom:18px;box-shadow:0 4px 14px rgba(37,99,235,.12)">\n            <div style="font-size:11px;font-weight:900;color:light-dark(#0352aa,#93c5fd);margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;gap:5px;letter-spacing:.02em">\n                <span style="display:flex;align-items:center;gap:5px;flex-wrap:wrap"><span class="material-icons" style="font-size:14px">bolt</span> ลงเวลาเหมือนเมื่อวาน <span style="font-weight:700;color:var(--k-tx3);font-size:10px">(${srcNote})</span></span>\n                ${items.length > 1 ? `<button type="button" id="qrbAllBtn" onclick="quickRebookAll('qrbAllBtn')" style="background:linear-gradient(135deg,#2563eb,#4f46e5);border:1px solid #60a5fa;border-radius:9px;padding:4px 12px;color:#fff;font-size:11px;font-weight:900;cursor:pointer;display:inline-flex;align-items:center;gap:4px;box-shadow:0 3px 10px rgba(59,130,246,.35)"><span class="material-icons" style="font-size:13px">done_all</span> ลงทั้ง ${items.length} รอบเลย</button>` : ''}\n            </div>\n            <div style="display:flex;flex-direction:column;gap:6px">\n                ${items.map(((b, i) => `\n                <button type="button" id="qrbBtn${i}" onclick="quickRebook('${esc(b.team)}','${esc(b.shift_name)}','${esc(b.time_slot)}','qrbBtn${i}')"\n                    style="display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;background:color-mix(in srgb,var(--k-panel2) 65.0%,transparent);border:1px solid rgba(96,165,250,.3);border-radius:11px;padding:9px 13px;color:var(--k-tx);font-size:13px;font-weight:800;cursor:pointer;transition:all .15s;text-align:left"\n                    onmouseover="this.style.borderColor='#60a5fa';this.style.background='rgba(30,58,138,.35)'" onmouseout="this.style.borderColor='rgba(96,165,250,.3)';this.style.background='rgba(15,23,42,.65)'">\n                    <span>🍚 <b style="font-family:monospace;color:var(--k-tx-strong)">${esc(b.time_slot)}</b> <span style="color:var(--k-tx3);font-weight:700;font-size:11.5px">· ${esc(b.team)} · ${esc(b.shift_name)}</span></span>\n                    <span class="material-icons" style="font-size:17px;color:light-dark(#054ea8,#60a5fa)">play_circle</span>\n                </button>`)).join('')}\n            </div>\n        </div>`;
  } catch (e) {}
};

async function _qrbBookOne(team, shift, slot) {
  const ts = document.getElementById('dailyTeam');
  if (ts) {
    const has = [ ...ts.options ].some((o => o.value === team));
    if (has) {
      ts.value = team;
    } else throw new Error(`เว็บ "${team}" ไม่อยู่ในรายการแล้ว — เลือกจากฟอร์มด้านล่างแทนนะ`);
  }
  const radio = document.querySelector(`input[name="shift"][value="${shift}"]`);
  if (!radio) throw new Error(`วันนี้คุณลง${shift}ไม่ได้ (ไม่มีสิทธิ์กะนี้)`);
  radio.checked = true;
  if (typeof refreshTimeSlots === 'function') await refreshTimeSlots();
  const sel = document.getElementById('tSlot');
  const opt = sel ? [ ...sel.options ].find((o => o.value === slot)) : null;
  if (!opt) throw new Error(`วันนี้ไม่มีรอบ ${slot} ในตั้งค่าแล้ว`);
  if (opt.disabled) throw new Error(`รอบ ${slot} วันนี้เต็มแล้ว`);
  sel.value = slot;
  if (typeof saveData === 'function') await saveData({
    preventDefault: () => {}
  });
}

window.quickRebook = async function(team, shift, slot, btnId) {
  const btn = document.getElementById(btnId);
  if (btn) {
    btn.disabled = true;
    btn.style.opacity = '.6';
    btn.innerHTML = '<span class="animate-spin material-icons" style="font-size:15px">sync</span> <span style="font-size:12px">กำลังลงให้...</span>';
  }
  try {
    await _qrbBookOne(team, shift, slot);
  } catch (e) {
    Swal.fire({
      icon: 'warning',
      title: 'ลงเวลาเดิมไม่ได้',
      text: String(e.message || e)
    });
  }
  if (typeof initQuickRebook === 'function') initQuickRebook();
};

window.quickRebookAll = async function(btnId) {
  const btn = document.getElementById(btnId);
  if (btn) {
    btn.disabled = true;
    btn.style.opacity = '.6';
    btn.innerHTML = '<span class="animate-spin material-icons" style="font-size:13px">sync</span> กำลังลงให้ทุกรอบ...';
  }
  const items = [ ...window._qrbItems || [] ];
  const fails = [];
  window._qrbSilent = true;
  try {
    for (const b of items) {
      try {
        await _qrbBookOne(b.team, b.shift_name, b.time_slot);
      } catch (e) {
        fails.push(`${b.time_slot}: ${String(e.message || e)}`);
      }
      await new Promise((r => setTimeout(r, 300)));
    }
  } finally {
    window._qrbSilent = false;
  }
  const okCount = items.length - fails.length;
  if (!fails.length) {
    Swal.fire({
      icon: 'success',
      title: `ลงครบทั้ง ${okCount} รอบแล้ว 🎉`,
      timer: 1600,
      showConfirmButton: false
    });
  } else {
    Swal.fire({
      icon: okCount ? 'warning' : 'error',
      title: `ลงสำเร็จ ${okCount}/${items.length} รอบ`,
      html: `<div style="text-align:left;font-size:13px;line-height:1.8">${fails.map((f => '• ' + f)).join('<br>')}</div>`
    });
  }
  if (typeof initQuickRebook === 'function') initQuickRebook();
};

window.renderSlotChips = function() {
  const box = document.getElementById('tSlotChips');
  const sel = document.getElementById('tSlot');
  if (!box || !sel) return;
  const opts = [ ...sel.options ].filter((o => o.value));
  if (!opts.length) {
    box.innerHTML = '<div class="slotc-empty">☝️ เลือกกะก่อน แล้วรอบเวลาจะขึ้นให้เลือกตรงนี้</div>';
    return;
  }
  if (window._rosterMissing) {
    window._pickedSlots = [];
    sel.value = '';
    const notIn = window._rosterMissing === 'not_in';
    box.innerHTML = `<div style="border:1px dashed rgba(251,191,36,.45);background:rgba(251,191,36,.06);border-radius:14px;padding:18px 12px;text-align:center">\n            <div style="font-size:26px;margin-bottom:6px">🔒</div>\n            <div style="font-size:12.5px;font-weight:800;color:var(--k-amber-tx);margin-bottom:4px">${notIn ? 'ยังลงเวลาพักไม่ได้ — คุณยังไม่ถูกจัดลงเว็บ' : 'ยังลงเวลาพักไม่ได้ — เวรวันนี้ยังไม่ออก'}</div>\n            <div style="font-size:11px;color:var(--k-tx3);line-height:1.7">${notIn ? 'เวรของกะนี้ออกแล้ว แต่ไม่มีชื่อคุณในตาราง (เพิ่งสลับกะมา?)<br>แจ้งหัวหน้าให้จัดคุณลงเว็บก่อน — พอมีชื่อ ปุ่มจะขึ้นให้เองทันที' : 'รอหัวหน้าจัดหน้าที่/เวรของกะนี้ก่อน<br>พอเวรออก ปุ่มเวลาจะขึ้นให้กดเองทันที ไม่ต้องรีเฟรช'}</div>\n        </div>`;
    const btn = document.getElementById('btnSave');
    if (btn) btn.innerHTML = `<span class="material-icons" style="font-size:19px">lock</span> ${notIn ? 'รอหัวหน้าจัดคุณลงเว็บ' : 'รอเวรออกก่อน'}`;
    return;
  }
  const info = window._slotInfo || {};
  const okVals = new Set(opts.filter((o => !o.disabled)).map((o => o.value)));
  const mineSet = window._myBookedSlots || new Set;
  window._pickedSlots = (window._pickedSlots || []).filter((t => okVals.has(t) && !mineSet.has(t)));
  sel.value = window._pickedSlots[0] || '';
  const blocks = [];
  {
    const nChunks = Math.min(3, opts.length);
    const per = Math.ceil(opts.length / nChunks);
    for (let c = 0; c < nChunks; c++) {
      const part = opts.slice(c * per, (c + 1) * per);
      if (!part.length) continue;
      blocks.push({
        start: part[0].value.split('-')[0],
        end: part[part.length - 1].value.split('-')[1],
        items: part.map((o => o.value))
      });
    }
  }
  if (window._slotFilter && !blocks.some((b => `${b.start}-${b.end}` === window._slotFilter))) window._slotFilter = '';
  let filterHtml = '';
  if (blocks.length > 1) {
    filterHtml = '<div class="slotf-bar">' + `<button type="button" onclick="setSlotFilter('')" class="slotf ${!window._slotFilter ? 'on' : ''}">ทั้งหมด</button>` + blocks.map((b => {
      const lb = `${b.start}-${b.end}`;
      return `<button type="button" onclick="setSlotFilter('${lb}')" class="slotf ${window._slotFilter === lb ? 'on' : ''}">${b.start} – ${b.end}</button>`;
    })).join('') + '</div>';
  }
  const showSet = window._slotFilter ? new Set((blocks.find((b => `${b.start}-${b.end}` === window._slotFilter)) || {
    items: []
  }).items) : null;
  let html = filterHtml + '<div class="slotc-grid">';
  opts.forEach((o => {
    if (showSet && !showSet.has(o.value)) return;
    const time = o.value;
    const i = info[time] || {};
    const isMine = mineSet.has(time);
    const isOn = window._pickedSlots.includes(time);
    const isFull = (o.disabled || i.full) && !isMine;
    let statusHtml;
    if (isMine) {
      statusHtml = '<span style="color:var(--k-green-tx);font-weight:900">✓ คุณลงรอบนี้แล้ว</span>';
    } else if (isFull) {
      statusHtml = '<span style="color:var(--k-red-tx);font-weight:900">⛔ เต็มแล้ว</span>';
    } else {
      statusHtml = `<span style="color:var(--k-amber-tx);font-weight:900">ลงแล้ว ${i.booked ?? 0}</span>`;
      if (i.free !== null && i.free !== undefined) statusHtml += ` <span style="color:var(--k-mute3)">·</span> <span style="color:var(--k-green-tx);font-weight:900">ว่าง ${i.free}</span>`;
    }
    const click = isMine ? `onclick="myBookedAlert('${time}')"` : isFull ? `onclick="slotFullAlert('${time}')"` : `onclick="pickTimeSlot('${time}')"`;
    html += `<div class="slot-chip ${isOn ? 'on' : ''} ${isFull ? 'full' : ''} ${isMine ? 'mine' : ''}" ${click} title="${isMine ? 'คุณลงรอบนี้ไปแล้ว' : isFull ? 'รอบนี้เต็มแล้ว' : 'กดเพื่อเลือกรอบนี้'}">\n            <div class="t">${time.replace('-', ' – ')}</div>\n            <div class="s">${statusHtml}</div>\n        </div>`;
  }));
  html += '</div>';
  box.innerHTML = html;
  const btn = document.getElementById('btnSave');
  if (btn) {
    const n = window._pickedSlots.length;
    btn.innerHTML = `<span class="material-icons" style="font-size:19px">save</span> ${n >= 2 ? `บันทึกทั้ง ${n} รอบ (${window._pickedSlots.join(' · ')})` : 'บันทึกข้อมูล'}`;
  }
};

window.slotFullAlert = function(time) {
  const i = (window._slotInfo || {})[time] || {};
  Swal.fire({
    icon: 'error',
    title: `รอบ ${time} เต็มแล้ว`,
    html: `${i.reason ? `<b class="text-red-400">${i.reason}</b><br><br>` : ''}<span class="text-xs text-gray-400">เลือกรอบอื่น หรือรอให้เพื่อนในเว็บกลับจากพักก่อน</span>`,
    confirmButtonText: 'เลือกรอบอื่น'
  });
};

window._pickedSlots = window._pickedSlots || [];

window.setSlotFilter = function(label) {
  window._slotFilter = label || '';
  window.renderSlotChips();
};

window.myBookedAlert = function(time) {
  Swal.fire({
    icon: 'success',
    title: `รอบ ${time} เป็นของคุณอยู่แล้ว`,
    html: '<span class="text-xs text-gray-400">อยากเปลี่ยนรอบ? ลบรอบนี้ได้จากการ์ด "วันนี้ของฉัน" (ปุ่ม ✕ ข้างเวลา) แล้วค่อยเลือกใหม่</span>',
    confirmButtonText: 'เข้าใจแล้ว'
  });
};

window.pickTimeSlot = function(time) {
  const sel = document.getElementById('tSlot');
  if (!sel) return;
  const opt = [ ...sel.options ].find((o => o.value === time));
  if (!opt || opt.disabled) return;
  const P = window._pickedSlots;
  const i = P.indexOf(time);
  if (i > -1) {
    P.splice(i, 1);
  } else {
    const maxPick = Math.max(1, parseInt(typeof SETTINGS !== 'undefined' && SETTINGS.daily_limit || 2));
    if (P.length >= maxPick) return Swal.fire({
      icon: 'info',
      title: `เลือกได้สูงสุด ${maxPick} รอบ`,
      text: 'เอารอบที่เลือกไว้ออกก่อน (กดซ้ำที่ปุ่มนั้น) แล้วค่อยเลือกใหม่',
      timer: 2200,
      showConfirmButton: false
    });
    const gapMin = typeof window.getBreakGapMin === 'function' ? window.getBreakGapMin() : 0;
    const near = [ ...P, ...window._myBookedSlots || [] ].find((t => window.isSlotTooClose(t, time, gapMin)));
    if (near) {
      const gapTxt = window.fmtGapText(gapMin);
      return Swal.fire({
        icon: 'warning',
        title: gapMin > 0 ? 'เว้นระยะไม่พอ' : 'ลงติดกันไม่ได้',
        text: gapMin > 0 ? `รอบ ${time} ห่างจาก ${near} ไม่ถึง ${gapTxt} — เลือกรอบที่ห่างกว่านี้นะ` : `รอบ ${time} ต่อเนื่องกับ ${near} — ห้ามควบพักยาว เว้นช่วงหน่อยนะ`
      });
    }
    P.push(time);
  }
  sel.value = P[0] || '';
  window.renderSlotChips();
};

window.saveMulti = async function(ev) {
  if (ev && ev.preventDefault) ev.preventDefault();
  const picks = [ ...window._pickedSlots || [] ];
  const sel = document.getElementById('tSlot');
  if (picks.length <= 1) {
    if (sel) sel.value = picks[0] || sel.value || '';
    return saveData({
      preventDefault: () => {}
    });
  }
  window._qrbSilent = true;
  try {
    for (const t of picks) {
      if (sel) sel.value = t;
      try {
        await saveData({
          preventDefault: () => {}
        });
      } catch (e) {}
      await new Promise((r => setTimeout(r, 350)));
    }
  } finally {
    window._qrbSilent = false;
  }
  try {
    const d = document.getElementById('wDate') ? document.getElementById('wDate').value : '';
    const {data: data} = await appDB.from('schedules').select('time_slot').eq('work_date', d).eq('staff_name', currentUser.username);
    const got = new Set((data || []).map((x => x.time_slot)));
    const ok = picks.filter((t => got.has(t)));
    if (ok.length === picks.length) Swal.fire({
      icon: 'success',
      title: `ลงครบทั้ง ${picks.length} รอบแล้ว 🎉`,
      text: ok.join(' และ '),
      timer: 2e3,
      showConfirmButton: false
    }); else if (ok.length) Swal.fire({
      icon: 'warning',
      title: `ลงสำเร็จ ${ok.length}/${picks.length} รอบ`,
      text: `สำเร็จ: ${ok.join(', ')} — อีกรอบไม่ผ่าน (ดูเหตุผลจากกล่องเตือนก่อนหน้า)`
    });
  } catch (e) {}
  window._pickedSlots = [];
  if (sel) sel.value = '';
  if (typeof refreshTimeSlots === 'function') refreshTimeSlots();
};

let _refreshSlotsTimer = null;

let _refreshSlotsPending = null;

window.refreshTimeSlots = function() {
  if (!_refreshSlotsPending) {
    let _res;
    const _p = new Promise((r => {
      _res = r;
    }));
    _refreshSlotsPending = {
      promise: _p,
      resolve: _res
    };
  }
  const _shared = _refreshSlotsPending;
  clearTimeout(_refreshSlotsTimer);
  _refreshSlotsTimer = setTimeout((() => {
    _refreshSlotsPending = null;
    _shared.resolve(_doRefreshTimeSlots().catch((e => {
      console.error("Refresh Slots Error:", e);
    })));
  }), 80);
  return _shared.promise;
};

async function _doRefreshTimeSlots() {
  const shiftEl = document.querySelector('input[name="shift"]:checked');
  const slotSelect = document.getElementById('tSlot');
  const dateEl = document.getElementById('wDate');
  const teamSelect = document.getElementById('dailyTeam');
  if (!slotSelect) return;
  if (!shiftEl || !dateEl || !dateEl.value) {
    slotSelect.innerHTML = '<option value="">-- กรุณาเลือกกะ/วันทีก่อน --</option>';
    return;
  }
  const shiftName = shiftEl.value;
  const myDep = window.currentUser?.department || 'AM';
  const dateVal = dateEl.value;
  const now = Date.now();
  if (canPerm('dashboard_bypass_rules')) window._rosterMissing = false;
  if (teamSelect && !canPerm('dashboard_bypass_rules')) {
    const rosterKey = `duty_roster_${myDep}_${dateVal}_${shiftName}`;
    let assignedTeams = [];
    let coverageMap = null;
    if (_rosterCache[rosterKey] && now - _rosterCache[rosterKey].ts < _SLOT_TTL) {
      assignedTeams = _rosterCache[rosterKey].data;
      coverageMap = _rosterCache[rosterKey].covMap || null;
    } else {
      try {
        const {data: rosterData} = await appDB.from('settings').select('value').eq('key', rosterKey).maybeSingle();
        if (rosterData && rosterData.value) {
          const roster = JSON.parse(rosterData.value);
          await window.loadBreakMinRemainCfg();
          await window.loadBreakWebGroups();
          coverageMap = window.buildCoverageMap(roster, myDep, shiftName);
          for (const team in roster) {
            (roster[team] || []).forEach((u => {
              if (String(u.id) === String(currentUser.id)) {
                if (!assignedTeams.includes(team)) assignedTeams.push(team);
                if (u.secondary_team && !assignedTeams.includes(u.secondary_team)) assignedTeams.push(u.secondary_team);
              }
            }));
          }
        }
        _rosterCache[rosterKey] = {
          data: assignedTeams,
          covMap: coverageMap,
          ts: now
        };
      } catch (e) {
        console.error(e);
      }
    }
    window._myAssignedTeams = assignedTeams;
    window._myCoverageMap = coverageMap;
    const _lockable = currentUser.check_type !== 'shift' && [ 'AM', 'OD' ].includes(myDep);
    const _inRoster = coverageMap && ((coverageMap.combinedOf && coverageMap.combinedOf[currentUser.username] || []).length > 0 || assignedTeams.length > 0);
    window._rosterMissing = _lockable ? !coverageMap ? 'no_roster' : !_inRoster ? 'not_in' : false : false;
    const oldVal = teamSelect.value;
    const sortedTeams = [ ...TEAM_LIST ].sort(((a, b) => a.localeCompare(b)));
    let tHtml = '';
    sortedTeams.forEach((t => {
      const isAssigned = assignedTeams.includes(t);
      tHtml += `<option value="${t}">${isAssigned ? `⭐ ${t} (หน้าที่ของคุณ)` : t}</option>`;
    }));
    teamSelect.innerHTML = tHtml;
    if (oldVal && sortedTeams.includes(oldVal)) teamSelect.value = oldVal; else if (assignedTeams.length > 0) teamSelect.value = assignedTeams[0];
  }
  const selectedTeam = teamSelect ? teamSelect.value : window.currentUser?.team || '';
  const previousSelectedSlot = slotSelect.value;
  const loadingIcon = document.getElementById('slotLoading');
  if (loadingIcon) loadingIcon.classList.remove('hidden');
  try {
    const slotCacheKey = `${dateVal}|${shiftName}`;
    let bookings;
    if (_slotCache[slotCacheKey] && now - _slotCache[slotCacheKey].ts < _SLOT_TTL) {
      bookings = _slotCache[slotCacheKey].data;
    } else {
      const {data: data} = await appDB.from('schedules').select('time_slot, department, team, staff_name').eq('work_date', dateVal).eq('shift_name', shiftName);
      bookings = data;
      _slotCache[slotCacheKey] = {
        data: bookings,
        ts: now
      };
    }
    const _g = typeof SHIFT_GROUPS !== 'undefined' ? SHIFT_GROUPS[shiftName] : null;
    const times = Array.isArray(_g) ? _g : [].concat(...Object.values(_g || {}));
    let html = '<option value="">-- เลือกรอบเวลา --</option>';
    window._myBookedSlots = new Set((bookings || []).filter((b => b.staff_name === currentUser.username)).map((b => b.time_slot)));
    const _slotInfo = {};
    {
      times.forEach((time => {
        const slotB = (bookings || []).filter((b => b.time_slot === time));
        const deptBooked = slotB.filter((b => (b.department || 'AM') === myDep)).length;
        let isFull = false, statusText = '', freeN = null, fullReason = '';
        if (window._myCoverageMap && currentUser.check_type !== 'shift') {
          const cov = window.checkCoverage(currentUser.username, window._myCoverageMap, slotB);
          if (!cov.ok) {
            isFull = true;
            fullReason = cov.problems.map((pb => `${pb.team} เต็ม ${pb.used}/${pb.cap}`)).join(', ');
            statusText = `(${fullReason})`;
            freeN = 0;
          } else if (cov.canLeave === Infinity) {
            statusText = `(ลงแล้ว ${deptBooked})`;
          } else {
            statusText = `(ว่าง: ${cov.canLeave})`;
            freeN = cov.canLeave;
          }
        } else {
          statusText = `(ลงแล้ว ${deptBooked})`;
        }
        _slotInfo[time] = {
          booked: deptBooked,
          free: freeN,
          full: isFull,
          reason: fullReason
        };
        html += `<option value="${time}" ${isFull ? 'disabled class="text-gray-400 bg-gray-100 dark:bg-slate-800"' : 'class="text-blue-600 font-bold dark:text-blue-400"'}>${time} ${statusText}</option>`;
      }));
    }
    slotSelect.innerHTML = html;
    if (previousSelectedSlot) {
      const opt = slotSelect.querySelector(`option[value="${previousSelectedSlot}"]`);
      if (opt && !opt.disabled) slotSelect.value = previousSelectedSlot;
    }
    window._slotInfo = _slotInfo;
    if (typeof window.renderSlotChips === 'function') window.renderSlotChips();
  } catch (e) {
    console.error("Refresh Slots Error:", e);
  } finally {
    if (loadingIcon) loadingIcon.classList.add('hidden');
  }
}

window.switchAdminTab = function(tab) {
  const tabs = [ 'settings', 'users', 'perms', 'quotalog', 'contacts' ];
  tabs.forEach((t => {
    const btn = document.getElementById('btnAdminTab_' + t);
    if (btn) {
      if (t === tab) {
        btn.className = 'ap-tab active';
      } else {
        btn.className = 'ap-tab';
      }
    }
    const view = document.getElementById('adminView_' + t);
    if (view) {
      if (t === tab) {
        view.classList.remove('hidden');
        view.classList.add('flex');
      } else {
        view.classList.add('hidden');
        view.classList.remove('flex');
      }
    }
  }));
  if (tab === 'quotalog' && typeof window.renderQuotaHistory === 'function') window.renderQuotaHistory();
  if (tab === 'contacts' && typeof window.renderHeadContactsEditor === 'function') window.renderHeadContactsEditor();
  if (tab === 'users') {
    if (!window.GLOBAL_USER_LIST || window.GLOBAL_USER_LIST.length === 0) {
      if (typeof fetchUsers === 'function') fetchUsers();
    } else {
      if (typeof renderUserTableDirectly === 'function') window.renderUserTableDirectly();
      if (typeof fastRecalculateStats === 'function') window.fastRecalculateStats();
    }
  }
};

window._fetchLogsTimer = null;

window.debounceFetchLogs = function() {
  clearTimeout(window._fetchLogsTimer);
  window._fetchLogsTimer = setTimeout((() => {
    if (typeof fetchLogs === 'function') fetchLogs();
  }), 300);
};

window.fetchLogs = async function() {
  const dateVal = document.getElementById('logDate') ? document.getElementById('logDate').value : '';
  const actionVal = document.getElementById('logAction') ? document.getElementById('logAction').value : '';
  const userVal = document.getElementById('logUser') ? document.getElementById('logUser').value.toLowerCase() : '';
  const teamVal = document.getElementById('logTeam') ? document.getElementById('logTeam').value : '';
  const deptVal = document.getElementById('logDept') ? document.getElementById('logDept').value : '';
  let query = appDB.from('system_logs').select('*').order('log_date', {
    ascending: false
  });
  if (dateVal) {
    query = query.gte('log_date', dateVal + 'T00:00:00').lte('log_date', dateVal + 'T23:59:59');
  } else {
    query = query.limit(100);
  }
  if (actionVal) query = query.eq('action_type', actionVal);
  if (teamVal) query = query.ilike('target_details', `%${teamVal}%`);
  if (deptVal) query = query.ilike('target_details', `%[${deptVal}]%`);
  const {data: data, error: error} = await query;
  const box = document.getElementById('logTableBody');
  if (!box) return;
  box.innerHTML = '';
  if (error) {
    box.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-red-400">เกิดข้อผิดพลาดในการดึงข้อมูล</td></tr>`;
    return;
  }
  if (data && data.length > 0) {
    const filtered = data.filter((log => !userVal || (log.performed_by || '').toLowerCase().includes(userVal)));
    if (filtered.length === 0) {
      box.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-gray-500">ไม่พบประวัติที่ค้นหา</td></tr>`;
      return;
    }
    let logsHtml = '';
    filtered.forEach((log => {
      const time = new Date(log.log_date).toLocaleString('th-TH');
      const badgeColor = log.action_type === 'ลงเวลา' ? 'bg-green-900/50 text-green-400 border-green-700' : (log.action_type || '').includes('ลบ') ? 'bg-red-900/50 text-red-400 border-red-700' : 'bg-blue-900/50 text-blue-400 border-blue-700';
      logsHtml += `\n            <tr class="border-b border-slate-700/50 hover:bg-slate-800/50 transition">\n                <td class="px-4 py-3 text-xs text-gray-400">${time}</td>\n                <td class="px-4 py-3 font-bold text-white">${log.performed_by || '-'}</td>\n                <td class="px-4 py-3"><span class="px-2 py-1 rounded text-[10px] font-bold border ${badgeColor}">${log.action_type || '-'}</span></td>\n                <td class="px-4 py-3 text-xs text-gray-300">${log.target_details || ''}</td>\n            </tr>`;
    }));
    box.innerHTML = logsHtml;
  } else {
    box.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-gray-500">ไม่พบประวัติ</td></tr>`;
  }
};

let dashboardSubscription = null;

const _rosterCache = {};

const _slotCache = {};

const _SLOT_TTL = 90 * 1e3;

window.subscribeDashboardChanges = function() {
  if (dashboardSubscription) {
    try {
      appDB.removeChannel(dashboardSubscription);
    } catch (e) {}
    dashboardSubscription = null;
  }
  dashboardSubscription = appDB.channel('dashboard-schedules').on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'settings'
  }, (payload => {
    const key = payload.new && payload.new.key || payload.old && payload.old.key || '';
    if (!key) return;
    if (key === 'head_contacts' || key.startsWith('open_time_') || key.startsWith('close_time_')) {
      if (typeof SETTINGS !== 'undefined' && key !== 'head_contacts') SETTINGS[key] = payload.new ? payload.new.value : undefined;
      if (key === 'head_contacts') window._headContactsAt = 0;
      window._myTodayRefresh();
    }
    if (key.startsWith('quota_') || key.startsWith('mincover_')) {
      if (typeof SETTINGS !== 'undefined') SETTINGS[key] = payload.new ? payload.new.value : undefined;
      if (typeof window.refreshTimeSlots === 'function') window.refreshTimeSlots();
    } else if (key.startsWith('duty_roster_') || key.startsWith('duty_od_rooms_')) {
      if (typeof _rosterCache !== 'undefined') delete _rosterCache[key];
      const myDep = window.currentUser && window.currentUser.department || 'AM';
      const relevant = key.startsWith(`duty_roster_${myDep}_`) || myDep === 'OD' && key.startsWith('duty_od_rooms_');
      if (!relevant) return;
      window._myTodayRefresh();
      if (typeof window.refreshTimeSlots === 'function') window.refreshTimeSlots();
    } else if (key === 'break_min_remain') {
      window.loadBreakMinRemainCfg && window.loadBreakMinRemainCfg(true).then((() => {
        window.loadBreakWebGroups(true);
        if (typeof window.refreshTimeSlots === 'function') window.refreshTimeSlots();
      }));
    } else if (key === 'break_gap_min') {
      if (typeof SETTINGS !== 'undefined') SETTINGS.break_gap_min = payload.new && payload.new.value || '0';
    } else if (key === 'daily_limit') {
      if (typeof SETTINGS !== 'undefined') SETTINGS.daily_limit = parseInt(payload.new && payload.new.value || 2);
      const ld = document.getElementById('limitDisplay');
      if (ld) ld.innerText = SETTINGS.daily_limit;
      if (typeof window._myTodayRefresh === 'function') window._myTodayRefresh();
    } else if (key === 'custom_time_slots') {
      if (typeof SETTINGS !== 'undefined') SETTINGS[key] = payload.new ? payload.new.value : undefined;
      if (typeof window.applyCustomTimeSlots === 'function') window.applyCustomTimeSlots();
      if (typeof window.refreshTimeSlots === 'function') window.refreshTimeSlots();
      if (window._lastSummaryData && typeof updateTableSummary === 'function') updateTableSummary(window._lastSummaryData);
    }
  })).on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'schedules'
  }, (payload => {
    const _mine = window._rtIsMine(payload.new && payload.new.staff_name != null ? payload.new : payload.old);
    if (_mine) {
      if (document.hidden) window._qrbStale = true; else {
        clearTimeout(window._qrbRtTimer);
        window._qrbRtTimer = setTimeout((() => {
          if (typeof initQuickRebook === 'function') initQuickRebook();
        }), 600);
      }
    }
    const mainContent = document.getElementById('mainContentArea');
    if (mainContent && !mainContent.classList.contains('hidden')) {
      const dateEl = document.getElementById('wDate');
      const dateVal = dateEl ? dateEl.value : '';
      if (payload.eventType !== 'DELETE' && payload.new.work_date !== dateVal) return;
      const _rtDate = payload.new?.work_date || payload.old?.work_date;
      const _rtShift = payload.new?.shift_name || payload.old?.shift_name;
      if (_rtDate && _rtShift) {
        const _rtKey = `${_rtDate}|${_rtShift}`;
        if (_slotCache[_rtKey]) delete _slotCache[_rtKey];
      } else if (payload.eventType === 'DELETE') {
        for (const k in _slotCache) delete _slotCache[k];
      }
      if (payload.eventType === 'INSERT') {
        const isExist = globalScheduleData.some((item => String(item.id) === String(payload.new.id)));
        if (!isExist) globalScheduleData.push(payload.new);
      } else if (payload.eventType === 'DELETE') {
        globalScheduleData = globalScheduleData.filter((item => String(item.id) !== String(payload.old.id)));
      } else if (payload.eventType === 'UPDATE') {
        const idx = globalScheduleData.findIndex((item => String(item.id) === String(payload.new.id)));
        if (idx > -1) globalScheduleData[idx] = payload.new;
      }
      globalScheduleData.sort(((a, b) => String(a.time_slot || '').localeCompare(String(b.time_slot || ''))));
      let dataToRender = globalScheduleData;
      const tableTeam = document.getElementById('tableTeamFilter') ? document.getElementById('tableTeamFilter').value : 'all';
      if (tableTeam !== 'all') dataToRender = dataToRender.filter((item => item.team === tableTeam));
      if (typeof currentUser !== 'undefined' && !canPerm('dashboard_view_all_shifts')) {
        if ([ 'กะเช้า', 'กะกลาง', 'กะดึก' ].includes(currentUser.allowed_shift)) {
          dataToRender = dataToRender.filter((item => item.shift_name === currentUser.allowed_shift));
        }
      }
      const deptFilterForSummary = document.getElementById('summaryDeptFilter') ? document.getElementById('summaryDeptFilter').value : 'all';
      let dataForSummary = dataToRender;
      if (deptFilterForSummary !== 'all') {
        dataForSummary = dataToRender.filter((i => (i.department || 'AM') === deptFilterForSummary));
      }
      clearTimeout(window.realtimeRenderTimer);
      window.realtimeRenderTimer = setTimeout((() => {
        if (typeof updateTableSummary === 'function') updateTableSummary(dataForSummary);
        if (typeof renderTableRows === 'function') renderTableRows(dataToRender);
        if (typeof refreshTimeSlots === 'function') refreshTimeSlots();
      }), 200);
    }
    if (_mine) window._myTodayRefresh();
  })).on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'scheduled_tasks'
  }, (payload => {
    const row = payload.new && payload.new.payload !== undefined ? payload.new : null;
    if (row) {
      let pl = row.payload;
      if (typeof pl === 'string') {
        try {
          pl = JSON.parse(pl);
        } catch (e) {
          pl = null;
        }
      }
      const me = window.currentUser;
      if (pl && me && pl.user_id != null && String(pl.user_id) !== String(me.id)) return;
    }
    clearTimeout(window._myTaskRtTimer);
    window._myTaskRtTimer = setTimeout((() => window._myTodayRefresh()), 1500);
  })).on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'leave_requests'
  }, (payload => {
    const uid = String(payload.new && payload.new.user_id || payload.old && payload.old.user_id || '');
    if (!uid || window.currentUser && uid === String(window.currentUser.id)) window._myTodayRefresh();
  })).subscribe();
  if (typeof window.registerPageSubscription === 'function') window.registerPageSubscription(dashboardSubscription);
};

setTimeout((() => {
  const dInput = document.getElementById('wDate');
  if (dInput) {
    dInput.addEventListener('change', (() => {
      if (typeof refreshTimeSlots === 'function') refreshTimeSlots();
      if (typeof fetchData === 'function') fetchData();
    }));
  }
}), 1e3);

setTimeout((() => {
  const teamInput = document.getElementById('dailyTeam');
  if (teamInput) {
    teamInput.addEventListener('change', (() => {
      if (typeof refreshTimeSlots === 'function') refreshTimeSlots();
    }));
  }
}), 1e3);

window.openLogsPage = async function() {
  window._openingLogsPage = true;
  setTimeout((() => {
    window._openingLogsPage = false;
  }), 8e3);
  if (!document.getElementById('logsPage')) {
    if (typeof showPage === 'function') await showPage('dashboard');
    if (typeof initDashboard === 'function') initDashboard();
  }
  const mainContent = document.getElementById('mainContentArea');
  if (mainContent) mainContent.classList.add('hidden');
  const adminPanel = document.getElementById('adminPanel');
  if (adminPanel) {
    adminPanel.classList.add('hidden');
    adminPanel.classList.remove('flex');
  }
  const _btp = document.getElementById('breakTablePage');
  if (_btp) {
    _btp.classList.add('hidden');
    _btp.classList.remove('flex');
  }
  const logsPage = document.getElementById('logsPage');
  if (logsPage) {
    logsPage.classList.remove('hidden');
    logsPage.classList.add('flex');
    const teamSel = document.getElementById('logTeam');
    if (teamSel && teamSel.options.length <= 1 && typeof TEAM_LIST !== 'undefined') {
      [ ...TEAM_LIST ].sort(((a, b) => a.localeCompare(b))).forEach((t => {
        const o = document.createElement('option');
        o.value = t;
        o.textContent = t;
        teamSel.appendChild(o);
      }));
    }
    const logDateEl = document.getElementById('logDate');
    if (logDateEl && !logDateEl.value) {
      const t = new Date;
      logDateEl.value = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    }
    if (typeof fetchLogs === 'function') fetchLogs();
  }
  requestAnimationFrame((() => requestAnimationFrame((() => {
    window._openingLogsPage = false;
  }))));
};

window.backToDashboard = function() {
  const btp = document.getElementById('breakTablePage');
  if (btp) {
    btp.classList.add('hidden');
    btp.classList.remove('flex');
  }
  const logsPage = document.getElementById('logsPage');
  if (logsPage) {
    logsPage.classList.add('hidden');
    logsPage.classList.remove('flex');
  }
  const adminPanel = document.getElementById('adminPanel');
  if (adminPanel) {
    adminPanel.classList.add('hidden');
    adminPanel.classList.remove('flex');
  }
  const mainContent = document.getElementById('mainContentArea');
  if (mainContent) {
    mainContent.classList.remove('hidden');
  }
  if (typeof initDashboard === 'function') initDashboard();
};

window.tempMissingStaffData = {};

window.renderMissingList = function() {
  const shiftFilter = document.getElementById('missingShiftFilter').value;
  const deptFilter = document.getElementById('missingDeptFilter').value;
  const container = document.getElementById('missingListContainer');
  if (!container) return;
  let html = '';
  let totalCount = 0;
  const renderList = (shiftName, listKey, colorClass) => {
    let list = window.tempMissingStaffData[listKey] || [];
    if (deptFilter !== 'all') {
      list = list.filter((s => s.dept === deptFilter));
    }
    if (list.length === 0) return '';
    totalCount += list.length;
    const badgeBg = {
      'text-orange-500': 'rgba(249,115,22,.14)',
      'text-blue-500': 'rgba(59,130,246,.14)',
      'text-purple-500': 'rgba(168,85,247,.14)'
    }[colorClass] || 'rgba(100,116,139,.14)';
    let htmlChunk = `\n            <div class="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-3 shadow-sm mb-3">\n                <div class="flex justify-between items-center mb-2 border-b border-slate-200 dark:border-slate-700 pb-2">\n                    <span class="font-black ${colorClass} flex items-center gap-1">${shiftName}</span>\n                    <span class="text-[10px] font-bold px-2 py-0.5 rounded shadow-inner border border-current opacity-80" style="background:${badgeBg}">${list.length} คน</span>\n                </div>\n                <div class="flex flex-wrap gap-2">\n        `;
    list.forEach((staff => {
      const deptColor = staff.dept === 'OD' ? 'text-pink-600 bg-pink-100 dark:bg-pink-900/30 border-pink-200' : 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 border-blue-200';
      const missingBadgeHtml = `<span class="text-[9px] font-black text-red-500 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-1 rounded shadow-sm">ขาด ${staff.missingAmount}</span>`;
      htmlChunk += `<div class="text-xs font-bold text-slate-700 dark:text-gray-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 px-2 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition hover:scale-105 cursor-default hover:border-indigo-400">\n                ${staff.name}\n                ${missingBadgeHtml}\n                <span class="text-[9px] font-black ${deptColor} border px-1 rounded shadow-sm">${staff.dept}</span>\n            </div>`;
    }));
    htmlChunk += `</div></div>`;
    return htmlChunk;
  };
  if (shiftFilter === 'all' || shiftFilter === 'กะเช้า') html += renderList('☀️ กะเช้า', 'กะเช้า', 'text-orange-500');
  if (shiftFilter === 'all' || shiftFilter === 'กะกลาง') html += renderList('🌤️ กะกลาง', 'กะกลาง', 'text-blue-500');
  if (shiftFilter === 'all' || shiftFilter === 'กะดึก') html += renderList('🌙 กะดึก', 'กะดึก', 'text-purple-500');
  if (html === '') {
    html = '<div class="text-center py-10 text-gray-500 text-sm font-bold bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-gray-300 dark:border-slate-600 mt-2">ไม่พบรายชื่อในเงื่อนไขที่เลือก</div>';
  }
  container.innerHTML = html;
  const countEl = document.getElementById('missingTotalCount');
  if (countEl) countEl.innerText = totalCount;
};

window.checkMissingLunch = async function() {
  const dateVal = document.getElementById('wDate').value;
  if (!dateVal) return Swal.fire('เตือน', 'กรุณาเลือกวันที่ต้องการตรวจสอบก่อนครับ', 'warning');
  Swal.fire({
    title: 'กำลังสแกนยอดการลงเวลา...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });
  try {
    if (typeof GLOBAL_USER_LIST === 'undefined' || !GLOBAL_USER_LIST || GLOBAL_USER_LIST.length === 0) {
      if (typeof fetchUsers === 'function') await fetchUsers(true);
    }
    const {data: schedules} = await appDB.from('schedules').select('staff_name').eq('work_date', dateVal);
    const bookingCounts = {};
    if (schedules) {
      schedules.forEach((s => {
        bookingCounts[s.staff_name] = (bookingCounts[s.staff_name] || 0) + 1;
      }));
    }
    const {data: leaves} = await appDB.from('leave_requests').select('user_name').eq('leave_date', dateVal);
    const onLeaveNames = (leaves || []).map((l => l.user_name));
    window.tempMissingStaffData = {
      'กะเช้า': [],
      'กะกลาง': [],
      'กะดึก': []
    };
    let missingCount = 0;
    const dailyQuota = typeof SETTINGS !== 'undefined' && SETTINGS.daily_limit ? parseInt(SETTINGS.daily_limit) : 2;
    GLOBAL_USER_LIST.forEach((u => {
      if (u.role === 'admin' || u.role === 'manager' || u.role === 'trainer') return;
      if (u.department === 'TRAINER' || u.department === 'NEW') return;
      if (![ 'กะเช้า', 'กะกลาง', 'กะดึก' ].includes(u.allowed_shift)) return;
      if (onLeaveNames.includes(u.username)) return;
      const userBookedTimes = bookingCounts[u.username] || 0;
      if (userBookedTimes < dailyQuota) {
        const missingAmt = dailyQuota - userBookedTimes;
        window.tempMissingStaffData[u.allowed_shift].push({
          name: u.username,
          dept: u.department || 'AM',
          missingAmount: missingAmt
        });
        missingCount++;
      }
    }));
    if (missingCount === 0) {
      return Swal.fire({
        icon: 'success',
        title: 'ครบทุกคน!',
        text: 'พนักงานในกะทุกคนลงเวลาครบตามโควตา หรือลาหยุดเรียบร้อยแล้วครับ 🎉',
        confirmButtonColor: '#3b82f6'
      });
    }
    const currentShiftEl = document.querySelector('input[name="shift"]:checked');
    const defaultShift = currentShiftEl ? currentShiftEl.value : 'all';
    Swal.fire({
      title: `<div class="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-3"><span class="material-icons text-indigo-500 text-3xl">person_search</span> รายชื่อคนที่ยังไม่ลงเวลา (หรือลงไม่ครบ)</div>`,
      html: `\n                <div class="text-xs text-gray-500 dark:text-gray-400 text-left mb-3">ระบบคัดกรองพนักงานที่ยังลงเวลา <span class="text-red-500 font-bold underline">ไม่ครบ ${dailyQuota} ครั้ง</span> (รวมที่แสดง: <span id="missingTotalCount" class="text-indigo-500 font-bold">${missingCount}</span> คน)</div>\n                <div class="flex gap-2 mb-3 border-b border-gray-100 dark:border-slate-700 pb-3">\n                    <select id="missingShiftFilter" onchange="renderMissingList()" class="flex-1 bg-slate-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white rounded-xl p-2.5 text-xs font-bold outline-none cursor-pointer shadow-inner focus:border-indigo-500 transition">\n                        <option value="all">🌐 ทุกกะ</option>\n                        <option value="กะเช้า" ${defaultShift === 'กะเช้า' ? 'selected' : ''}>☀️ กะเช้า</option>\n                        <option value="กะกลาง" ${defaultShift === 'กะกลาง' ? 'selected' : ''}>🌤️ กะกลาง</option>\n                        <option value="กะดึก" ${defaultShift === 'กะดึก' ? 'selected' : ''}>🌙 กะดึก</option>\n                    </select>\n                    <select id="missingDeptFilter" onchange="renderMissingList()" class="flex-1 bg-slate-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white rounded-xl p-2.5 text-xs font-bold outline-none cursor-pointer shadow-inner focus:border-indigo-500 transition">\n                        <option value="all">🏢 ทุกแผนก</option>\n                        <option value="AM">เฉพาะ AM</option>\n                        <option value="OD">เฉพาะ OD</option>\n                    </select>\n                </div>\n                <div id="missingListContainer" class="text-left max-h-[45vh] overflow-y-auto custom-scrollbar pr-2 pb-2"></div>\n            `,
      showCloseButton: true,
      showConfirmButton: false,
      width: '600px',
      customClass: {
        popup: 'dark:bg-slate-900 dark:text-white rounded-[2rem] border border-slate-700 shadow-2xl'
      },
      didOpen: () => {
        window.renderMissingList();
      }
    });
  } catch (e) {
    console.error("Missing Lunch Error:", e);
    Swal.fire('ข้อผิดพลาด', 'ดึงข้อมูลไม่สำเร็จ: ' + e.message, 'error');
  }
};

window._manualRefreshBusy = false;

window.manualRefreshDashboard = async function() {
  if (window._manualRefreshBusy) return;
  window._manualRefreshBusy = true;
  const icon = document.getElementById('manualRefreshIcon');
  const btn = document.getElementById('btnManualRefreshDashboard');
  if (icon) icon.classList.add('animate-spin');
  if (btn) btn.style.pointerEvents = 'none';
  try {
    if (typeof refreshTimeSlots === 'function') await refreshTimeSlots();
    if (typeof fetchData === 'function') await fetchData();
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'อัปเดตข้อมูลล่าสุดแล้ว',
        showConfirmButton: false,
        timer: 1400
      });
    }
  } catch (e) {
    console.error('manualRefreshDashboard error:', e);
  } finally {
    if (icon) icon.classList.remove('animate-spin');
    if (btn) btn.style.pointerEvents = '';
    window._manualRefreshBusy = false;
  }
};

const _MT_TH_DAYS = [ 'อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์' ];

const _MT_TH_MON = [ 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.' ];

const _mtFmt = iso => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!m) return iso || '-';
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return `${_MT_TH_DAYS[d.getDay()]} ${d.getDate()} ${_MT_TH_MON[d.getMonth()]} ${d.getFullYear() + 543}`;
};

const _mtEsc = v => window.escapeHtml ? window.escapeHtml(v) : String(v ?? '');

const _mtMin = hhmm => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ''));
  return m ? +m[1] * 60 + +m[2] : null;
};

function _mtShiftHours(shift) {
  const suf = String(shift || '').replace('กะ', '');
  const def = {
    'เช้า': [ '08:00', '20:00' ],
    'กลาง': [ '11:00', '23:00' ],
    'ดึก': [ '20:00', '08:00' ]
  }[suf] || [ null, null ];
  const S = typeof SETTINGS !== 'undefined' && SETTINGS ? SETTINGS : {};
  return {
    open: S[`open_time_${suf}`] || def[0],
    close: S[`close_time_${suf}`] || def[1]
  };
}

function _mtShiftStatus(shift) {
  const {open: open, close: close} = _mtShiftHours(shift);
  const o = _mtMin(open), c = _mtMin(close);
  if (o === null || c === null) return {
    label: '-',
    color: '#64748b',
    bg: 'rgba(100,116,139,.15)'
  };
  const now = new Date;
  const n = now.getHours() * 60 + now.getMinutes();
  const inShift = o <= c ? n >= o && n < c : n >= o || n < c;
  if (inShift) return {
    label: 'อยู่ในกะ',
    color: '#34d399',
    bg: 'rgba(52,211,153,.15)'
  };
  if (o <= c ? n < o : n >= c && n < o) return {
    label: 'ก่อนเข้ากะ',
    color: '#fbbf24',
    bg: 'rgba(251,191,36,.15)'
  };
  return {
    label: 'นอกกะ',
    color: '#94a3b8',
    bg: 'rgba(148,163,184,.15)'
  };
}

const _mtShiftBadge = shift => ({
  'กะเช้า': [ 'D', '#fbbf24', '☀️' ],
  'กะกลาง': [ 'M', '#60a5fa', '🌤️' ],
  'กะดึก': [ 'N', '#a78bfa', '🌙' ]
}[shift] || [ '-', '#94a3b8', '' ]);

window._myTodayTimer = null;

window._myTodayRefresh = function(mode) {
  if (!document.getElementById('myTodayPanel')) return;
  if (mode === 'clock') {
    window._myTodayUseCache = true;
  } else {
    window._myTodayData = null;
    window._myTodayUseCache = false;
  }
  if (document.hidden) {
    window._myTodayStale = true;
    return;
  }
  clearTimeout(window._myTodayTimer);
  window._myTodayTimer = setTimeout((() => {
    if (typeof window.renderMyToday === 'function') window.renderMyToday();
  }), 150);
};

if (!window._myTodayClock) window._myTodayClock = setInterval((() => {
  if (document.getElementById('myTodayPanel')) window._myTodayRefresh('clock');
}), 6e4);

if (!window._myTodayVisBound) {
  window._myTodayVisBound = true;
  document.addEventListener('visibilitychange', (() => {
    if (document.hidden) return;
    if (window._myTodayStale) {
      window._myTodayStale = false;
      window._myTodayRefresh(window._myTodayUseCache ? 'clock' : undefined);
    }
    if (window._qrbStale) {
      window._qrbStale = false;
      if (typeof initQuickRebook === 'function') initQuickRebook();
    }
  }));
}

window._rtIsMine = function(row) {
  const me = window.currentUser;
  if (!me || !row) return false;
  if (row.staff_name != null) return String(row.staff_name).toLowerCase() === String(me.username || '').toLowerCase();
  if (row.id != null && window._myBookingIds) return window._myBookingIds.has(String(row.id));
  return true;
};

window.myTodaySetDate = function(v) {
  window._myTodayDate = v || '';
  if (typeof window.renderMyToday === 'function') window.renderMyToday();
};

window.myTodayShift = function(n) {
  const cur = window._myTodayDate || (document.getElementById('myTodayDate') || {}).value || (new Date).toISOString().slice(0, 10);
  const d = new Date(cur + 'T00:00:00');
  d.setDate(d.getDate() + n);
  window.myTodaySetDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
};

window._myTodayBusy = false;

window._myTodayPending = false;

window.renderMyToday = async function() {
  if (window._myTodayBusy) {
    window._myTodayPending = true;
    return;
  }
  window._myTodayBusy = true;
  try {
    await window._renderMyTodayNow();
  } finally {
    window._myTodayBusy = false;
    if (window._myTodayPending) {
      window._myTodayPending = false;
      setTimeout((() => window.renderMyToday()), 50);
    }
  }
};

window._renderMyTodayNow = async function() {
  const box = document.getElementById('myTodayPanel');
  if (!box || !window.currentUser) return;
  const me = window.currentUser;
  const dateEl = document.getElementById('wDate');
  const t = new Date;
  const todayIso = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  const dateVal = window._myTodayDate || dateEl && dateEl.value || todayIso;
  const isToday = dateVal === todayIso;
  const myDep = me.department || 'AM';
  const myShift = [ 'กะเช้า', 'กะกลาง', 'กะดึก' ].includes(me.allowed_shift) ? me.allowed_shift : document.querySelector('input[name="shift"]:checked')?.value || '';
  const _yd = new Date(dateVal + 'T00:00:00');
  _yd.setDate(_yd.getDate() - 1);
  const ydate = `${_yd.getFullYear()}-${String(_yd.getMonth() + 1).padStart(2, '0')}-${String(_yd.getDate()).padStart(2, '0')}`;
  const shiftsToLoad = myShift ? [ myShift ] : [ 'กะเช้า', 'กะกลาง', 'กะดึก' ];
  const rosterKeys = [ ...shiftsToLoad.map((s => `duty_roster_${myDep}_${dateVal}_${s}`)), ...shiftsToLoad.map((s => `duty_roster_${myDep}_${ydate}_${s}`)) ];
  const roomKeys = myDep === 'OD' ? myShift ? [ `duty_od_rooms_${dateVal}_${myShift}` ] : [ 'กะเช้า', 'กะกลาง', 'กะดึก' ].map((s => `duty_od_rooms_${dateVal}_${s}`)) : [];
  let rosterRows = [], myBreaks = [], myLeaves = [], mySwaps = [];
  try {
    const _swEnd = new Date(dateVal + 'T00:00:00');
    _swEnd.setDate(_swEnd.getDate() + 60);
    const _ck = [ dateVal, myDep, myShift, me.id ].join('|');
    const _c = window._myTodayData;
    const _useCache = window._myTodayUseCache && _c && _c.k === _ck && Date.now() - _c.t < 5 * 60 * 1e3;
    window._myTodayUseCache = false;
    const [r1, r2, r3, r4] = _useCache ? _c.res : await Promise.all([ appDB.from('settings').select('key, value').in('key', [ ...rosterKeys, ...roomKeys ]), appDB.from('schedules').select('id, shift_name, time_slot, team').eq('work_date', dateVal).eq('staff_name', me.username), appDB.from('leave_requests').select('leave_date, reason').eq('user_id', me.id).gte('leave_date', dateVal.slice(0, 8) + '01').lt('leave_date', (() => {
      const d = new Date(+dateVal.slice(0, 4), +dateVal.slice(5, 7) + 1, 1);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01';
    })()).order('leave_date', {
      ascending: true
    }).limit(80), appDB.from('scheduled_tasks').select('payload, scheduled_for, status').eq('task_type', 'individual_shift_update').gte('scheduled_for', dateVal + 'T00:00:00+07:00').lte('scheduled_for', _swEnd.toISOString().slice(0, 10) + 'T23:59:59+07:00').order('scheduled_for', {
      ascending: true
    }) ]);
    if (!_useCache && !r1.error && !r2.error && !r3.error && !r4.error) window._myTodayData = {
      k: _ck,
      t: Date.now(),
      res: [ r1, r2, r3, r4 ]
    };
    rosterRows = r1.data || [];
    myBreaks = r2.data || [];
    if (isToday || !window._myBookingIds) window._myBookingIds = new Set(myBreaks.map((b => String(b.id))));
    myLeaves = r3.data || [];
    mySwaps = (r4.data || []).map((t => {
      let pl = t.payload;
      if (typeof pl === 'string') {
        try {
          pl = JSON.parse(pl);
        } catch (e) {
          pl = {};
        }
      }
      return {
        ...t,
        pl: pl || {}
      };
    })).filter((t => t.pl && String(t.pl.user_id) === String(me.id) && t.status !== 'cancelled'));
  } catch (e) {
    console.warn('renderMyToday:', e);
  }
  const jobs = [], jobsY = [];
  const roomMaps = {};
  rosterRows.filter((r => r.key.startsWith('duty_od_rooms_'))).forEach((r => {
    try {
      roomMaps[r.key.split('_').pop()] = JSON.parse(r.value || '{}');
    } catch (e) {}
  }));
  rosterRows.filter((r => r.key.startsWith('duty_roster_'))).forEach((row => {
    let roster = {};
    try {
      roster = JSON.parse(row.value || '{}');
    } catch (e) {}
    const parts = row.key.split('_');
    const dateOfKey = parts[3], shiftOfKey = parts[4] || parts.pop();
    const target = dateOfKey === dateVal ? jobs : dateOfKey === ydate ? jobsY : null;
    if (!target) return;
    const roomOf = t => (dateOfKey === dateVal ? (roomMaps[shiftOfKey] || {})[t] : '') || '';
    for (const team in roster) (roster[team] || []).forEach((u => {
      if (!u || String(u.username || '').toLowerCase() !== String(me.username).toLowerCase()) return;
      target.push({
        team: team,
        role: 'หลัก',
        shift: shiftOfKey,
        room: roomOf(team)
      });
      if (u.secondary_team) target.push({
        team: u.secondary_team,
        role: 'รอง',
        shift: shiftOfKey,
        room: roomOf(u.secondary_team)
      });
    }));
  }));
  const dailyLimit = parseInt(typeof SETTINGS !== 'undefined' && SETTINGS.daily_limit || 2);
  const remain = Math.max(0, dailyLimit - myBreaks.length);
  const sb = _mtShiftBadge(myShift);
  const sh = _mtShiftHours(myShift);
  const st = myShift ? _mtShiftStatus(myShift) : null;
  const card = (icon, iconColor, label, valueHtml, subHtml) => `\n        <div style="display:flex;align-items:flex-start;gap:14px;padding:14px 4px;border-bottom:1px solid rgba(148,163,184,.12)">\n            <div style="width:44px;height:44px;border-radius:12px;background:${iconColor}22;border:1px solid ${iconColor}55;display:flex;align-items:center;justify-content:center;flex-shrink:0"><span class="material-icons" style="font-size:22px;color:${iconColor}">${icon}</span></div>\n            <div style="min-width:0;flex:1">\n                <div style="font-size:11px;color:var(--k-tx3);margin-bottom:3px">${label}</div>\n                <div style="font-size:15px;font-weight:800;color:var(--k-tx);line-height:1.35">${valueHtml}</div>\n                ${subHtml ? `<div style="font-size:11.5px;color:var(--k-tx3);margin-top:4px">${subHtml}</div>` : ''}\n            </div>\n        </div>`;
  const swapToday = mySwaps.find((t => _mtTaskDateTH(t.scheduled_for) === dateVal && t.pl.target_shift && t.pl.target_shift !== 'คงเดิม'));
  const effShift = swapToday ? swapToday.pl.target_shift : myShift;
  const sbE = _mtShiftBadge(effShift), shE = _mtShiftHours(effShift), stE = effShift ? _mtShiftStatus(effShift) : null;
  const shiftVal = effShift ? `${sbE[2]} ${_mtEsc(effShift)} <span style="font-size:11px;font-weight:700;color:${sbE[1]};background:${sbE[1]}22;padding:2px 7px;border-radius:6px;margin-left:4px">${shE.open}–${shE.close}</span>${swapToday ? ` <span style="font-size:11px;font-weight:800;color:light-dark(#aa4e03,#fb923c);background:rgba(251,146,60,.15);border:1px solid rgba(251,146,60,.45);padding:2px 8px;border-radius:999px;margin-left:4px">🔄 สลับกะ</span>` : ''}` : 'ไม่มีกะ';
  const shiftSub = (stE ? `<span style="color:${stE.color};font-weight:700">● ${stE.label}</span>` : '') + (swapToday ? ` <span style="color:var(--k-tx3)">· วันนี้สลับจาก <b style="color:var(--k-tx2)">${_mtEsc(swapToday.pl.from_shift || swapToday.pl.original_shift || myShift || '-')}</b> → <b style="color:var(--k-amber-tx)">${_mtEsc(swapToday.pl.target_shift)}</b>${swapToday.pl.display_desc ? ` (${_mtEsc(swapToday.pl.display_desc)})` : ''}</span>` : '');
  const mainJob = jobs.find((j => j.role === 'หลัก'));
  const roomBadge = myDep === 'OD' && jobs.length ? mainJob && mainJob.room ? `<span style="display:inline-flex;align-items:center;gap:5px;margin:2px 6px 2px 0;padding:3px 12px;border-radius:999px;font-size:13px;background:#22c55e;color:#052e16;font-weight:900"><span class="material-icons" style="font-size:14px">headset</span>เข้า ${_mtEsc(mainJob.room)}</span>` : `<span style="display:inline-flex;align-items:center;gap:5px;margin:2px 6px 2px 0;padding:3px 10px;border-radius:999px;font-size:11.5px;color:var(--k-tx3);background:rgba(148,163,184,.12)"><span class="material-icons" style="font-size:13px">headset_off</span>ยังไม่จัดห้อง</span>` : '';
  const _jobChip = (j, dim) => `<span style="display:inline-block;margin:2px 6px 2px 0;padding:${dim ? '1px 8px' : '3px 10px'};border-radius:8px;font-size:${dim ? '11.5px' : '13px'};${dim ? 'opacity:.7;' : ''}background:${j.role === 'หลัก' ? 'rgba(96,165,250,.18)' : 'rgba(251,191,36,.15)'};color:${j.role === 'หลัก' ? '#93c5fd' : 'var(--k-amber-tx)'};border:1px solid ${j.role === 'หลัก' ? 'rgba(96,165,250,.4)' : 'rgba(251,191,36,.4)'}">${_mtEsc(j.team)} <span style="font-size:10px;opacity:.8">(${j.role})</span></span>`;
  const jobsVal = jobs.length ? jobs.map((j => _jobChip(j, false))).join('') : 'ยังไม่มีงานที่ได้รับมอบหมาย';
  const roomLine = myDep === 'OD' && jobs.length ? `<div style="margin-top:8px"><span style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:999px;background:rgba(34,197,94,.10);border:1px dashed rgba(34,197,94,.45)"><span class="material-icons" style="font-size:15px;color:light-dark(#1a9447,#22c55e)">headset_mic</span><span style="font-size:11.5px;color:var(--k-tx3)">Discord</span>${mainJob && mainJob.room ? `<b style="color:var(--k-green-tx);font-size:13.5px">${_mtEsc(mainJob.room)}</b>` : `<span style="color:var(--k-tx3);font-size:12px">ยังไม่จัดห้อง</span>`}</span></div>` : '';
  const yLine = `<div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;margin-top:8px"><span style="font-size:11px;color:var(--k-mute);margin-right:4px"><span class="material-icons" style="font-size:12px;vertical-align:-2px">history</span> เมื่อวาน (${_mtFmt(ydate).replace(/^\S+\s/, '')}):</span>${jobsY.length ? jobsY.map((j => _jobChip(j, true))).join('') : '<span style="font-size:11px;color:var(--k-mute)">ไม่มีข้อมูล</span>'}</div>`;
  const jobsSub = (jobs.length ? '' : 'หัวหน้ายังไม่ได้จัดเวรวันนี้ หรือคุณไม่อยู่ในตาราง') + roomLine + yLine;
  const brVal = myBreaks.length ? myBreaks.map((b => `<span class="mt-break-pill" style="display:inline-flex;align-items:center;gap:7px;margin:2px 6px 2px 0;padding:4px 5px 4px 11px;border-radius:10px;font-size:13px;font-family:monospace;font-weight:700;background:linear-gradient(135deg,rgba(16,185,129,.18),rgba(52,211,153,.10));color:light-dark(#199564,#6ee7b7);border:1px solid rgba(52,211,153,.4);box-shadow:0 2px 8px -4px rgba(16,185,129,.5);transition:all .16s">${_mtEsc(b.time_slot)}<button type="button" class="mt-break-x" onclick="if(typeof delSch==='function') delSch(${b.id}, '${_mtEsc(b.shift_name)}')" title="ลบรอบนี้ แล้วลงใหม่ได้" style="border:none;background:rgba(148,163,184,.14);color:var(--k-tx3);width:21px;height:21px;border-radius:7px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0;transition:all .16s"><span class="material-icons" style="font-size:14px;line-height:1">close</span></button></span>`)).join('') : 'ยังไม่ได้เลือกเวลาพัก';
  const brSub = remain > 0 ? `ยังเลือกได้อีก <b style="color:var(--k-amber-tx)">${remain}</b> จาก ${dailyLimit} รอบ${isToday ? ` · <a href="javascript:void(0)" onclick="document.getElementById('btnSave')?.scrollIntoView({behavior:'smooth',block:'center'})" style="color:light-dark(#054ea8,#60a5fa);font-weight:700;text-decoration:underline">ลงเวลาพักที่ฟอร์มด้านซ้าย →</a>` : ' <span style="color:var(--k-mute)">(ฟอร์มด้านซ้ายลงของวันปัจจุบันเท่านั้น)</span>'}` : `ครบ ${dailyLimit} รอบแล้ววันนี้ ✅ · กด ✕ ที่ช่วงที่ต้องการเพื่อลบแล้วลงใหม่`;
  const LV_TYPES = {
    X: {
      name: 'หยุดปกติ',
      bg: '#ef4444',
      fg: '#fff'
    },
    XX: {
      name: 'สลับกะ',
      bg: '#facc15',
      fg: '#713f12'
    },
    X4: {
      name: 'ลาครึ่งวัน',
      bg: '#ec4899',
      fg: '#fff'
    },
    KL: {
      name: 'ลากิจ/ลาป่วย',
      bg: '#22c55e',
      fg: '#fff'
    },
    TX: {
      name: 'สลับวันหยุด',
      bg: '#3b82f6',
      fg: '#fff'
    },
    PN: {
      name: 'พักร้อน',
      bg: '#92400e',
      fg: '#fff'
    },
    KP: {
      name: 'ขาดงาน',
      bg: '#a16207',
      fg: '#fff'
    }
  };
  const _lvChip = l => {
    const iso = String(l.leave_date || '').slice(0, 10);
    const code = String(l.reason || 'X').toUpperCase();
    const t = LV_TYPES[code] || {
      name: code,
      bg: '#64748b',
      fg: '#fff'
    };
    const state = iso < dateVal ? 'past' : iso === dateVal ? 'today' : 'next';
    const dim = state === 'past';
    return `<span style="display:inline-flex;align-items:center;gap:6px;margin:3px 8px 3px 0;padding:4px 10px 4px 6px;border-radius:9px;font-size:12.5px;background:color-mix(in srgb,var(--k-panel2) 70.0%,transparent);border:1px solid ${dim ? 'rgba(148,163,184,.25)' : t.bg + '88'};${dim ? 'opacity:.55;' : ''}${state === 'today' ? 'box-shadow:0 0 0 2px ' + t.bg + '66;' : ''}" title="${state === 'past' ? 'ผ่านมาแล้ว' : state === 'today' ? 'วันนี้' : 'ยังไม่ถึง'}">\n            <span style="background:${t.bg};color:${t.fg};font-weight:900;font-size:11px;padding:2px 7px;border-radius:6px;letter-spacing:.3px">${_mtEsc(code)}</span>\n            <span style="color:${dim ? 'var(--k-tx3)' : 'var(--k-tx)'};font-weight:700;${dim ? 'text-decoration:line-through' : ''}">${_mtFmt(iso)}</span>\n            <span style="color:${dim ? 'var(--k-mute)' : t.bg};font-size:11px;font-weight:700">${t.name}</span>${state === 'today' ? '<b style="font-size:10px;color:var(--k-tx-strong);background:' + t.bg + ';padding:1px 6px;border-radius:5px">วันนี้</b>' : ''}\n        </span>`;
  };
  const _TH_M = [ 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.' ];
  const _ymLabel = ym => {
    const [y, m] = ym.split('-').map(Number);
    return `${_TH_M[m - 1]} ${y + 543}`;
  };
  const _ymAdd = (ym, n) => {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 1 + n, 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  };
  const thisYM = dateVal.slice(0, 7), nextYM = _ymAdd(thisYM, 1);
  const lvByMonth = {
    [thisYM]: [],
    [nextYM]: []
  };
  myLeaves.forEach((l => {
    const ym = String(l.leave_date || '').slice(0, 7);
    if (lvByMonth[ym]) lvByMonth[ym].push(l);
  }));
  const lvTotal = lvByMonth[thisYM].length + lvByMonth[nextYM].length;
  const _lvMonthBlock = (ym, tag, accent) => {
    const rows = lvByMonth[ym];
    const past = rows.filter((l => String(l.leave_date).slice(0, 10) < dateVal)).length;
    const next = rows.length - past;
    const stat = rows.length ? `${rows.length} วัน${past ? ` · <span style="color:var(--k-tx3)">ผ่านแล้ว ${past}</span>` : ''}${next ? ` · <span style="color:${accent}">ยังไม่ถึง ${next}</span>` : ''}` : '<span style="color:var(--k-mute)">ยังไม่ได้จอง</span>';
    return `<div style="margin:2px 0 8px;padding:9px 11px 6px;border-radius:12px;background:linear-gradient(90deg,${accent}12,color-mix(in srgb,var(--k-panel2) 0%,transparent));border:1px solid ${accent}40;border-left:3px solid ${accent}">\n            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">\n                <span style="display:inline-flex;align-items:center;gap:5px;font-size:12.5px;font-weight:900;color:var(--k-tx);letter-spacing:.2px"><span class="material-icons" style="font-size:15px;color:${accent}">calendar_month</span>${_ymLabel(ym)}</span>\n                <span style="font-size:10.5px;font-weight:800;color:${accent};background:${accent}22;border:1px solid ${accent}55;padding:1px 8px;border-radius:999px;letter-spacing:.3px">${tag}</span>\n                <span style="margin-left:auto;font-size:11.5px;font-weight:700;color:var(--k-tx2)">${stat}</span>\n            </div>\n            <div style="display:flex;flex-wrap:wrap">${rows.length ? rows.map(_lvChip).join('') : `<span style="font-size:12px;color:var(--k-mute);padding:2px 0 4px">— ยังไม่มีวันหยุดในเดือนนี้ —</span>`}</div>\n        </div>`;
  };
  const lvVal = _lvMonthBlock(thisYM, 'เดือนนี้', '#f472b6') + _lvMonthBlock(nextYM, 'เดือนหน้า', '#60a5fa');
  const lvSub = `<a href="javascript:void(0)" onclick="showPage('leave')" style="color:light-dark(#054ea8,#60a5fa);font-weight:700;text-decoration:underline">ดู/จองเพิ่ม</a>` + (lvTotal ? ` · รวม ${lvTotal} วัน (2 เดือน)` : ' · ยังไม่ได้จองวันหยุด');
  const swapChip = t => {
    const d = _mtTaskDateTH(t.scheduled_for);
    const isD = d === dateVal;
    const to = t.pl.target_shift || '-', from = t.pl.from_shift || t.pl.original_shift || '';
    const stay = to === 'คงเดิม';
    const b = _mtShiftBadge(stay ? from : to);
    return `<span style="display:inline-flex;align-items:center;gap:6px;margin:3px 8px 3px 0;padding:4px 10px;border-radius:9px;font-size:12.5px;background:color-mix(in srgb,var(--k-panel2) 70.0%,transparent);border:1px solid ${isD ? '#fb923c' : 'rgba(251,146,60,.35)'};${isD ? 'box-shadow:0 0 0 2px rgba(251,146,60,.35);' : ''}">\n            <span style="color:var(--k-tx);font-weight:700">${_mtFmt(d)}</span>\n            ${stay ? `<span style="color:var(--k-tx3);font-size:11px">คงเดิม (${_mtEsc(from)})</span>` : `<span style="color:var(--k-tx3);font-size:11px">${_mtEsc(from || '?')}</span><span style="color:light-dark(#aa4e03,#fb923c);font-weight:900">→</span><span style="background:${b[1]};color:#0f172a;font-weight:900;font-size:11px;padding:1px 7px;border-radius:5px">${_mtEsc(to)}</span>`}\n            ${t.pl.display_desc ? `<span style="color:var(--k-mute);font-size:10.5px">${_mtEsc(t.pl.display_desc)}</span>` : ''}${isD ? '<b style="font-size:10px;color:#fff;background:#fb923c;padding:1px 6px;border-radius:5px">วันนี้</b>' : ''}\n        </span>`;
  };
  const swVal = mySwaps.length ? mySwaps.map(swapChip).join('') : 'ไม่มีการสลับกะ';
  const swSub = mySwaps.length ? `มี ${mySwaps.length} รายการใน 60 วันข้างหน้า · <a href="javascript:void(0)" onclick="showPage('swap')" style="color:light-dark(#054ea8,#60a5fa);font-weight:700;text-decoration:underline">ดูหน้าสลับกะ</a>` : `ถ้ามีสลับกะจะขึ้นที่นี่ · <a href="javascript:void(0)" onclick="showPage('swap')" style="color:light-dark(#054ea8,#60a5fa);font-weight:700;text-decoration:underline">หน้าสลับกะ</a>`;
  const configured = await window.loadHeadContacts();
  let heads;
  if (configured.length) {
    heads = configured.map((c => ({
      username: c.name,
      department: c.dept || 'AM',
      role: null,
      label: c.label || 'หัวหน้า',
      allowed_shift: c.shift || '',
      telegram_id: c.telegram,
      discord_id: c.discord,
      note: c.note
    })));
  } else {
    const all = window.GLOBAL_USER_LIST || [];
    heads = all.filter((u => [ 'manager', 'admin' ].includes(u.role))).map((u => ({
      ...u,
      department: u.role === 'admin' ? 'ทุกแผนก' : u.department || 'AM'
    })));
  }
  const groupOrder = [ myDep, ...[ 'AM', 'OD' ].filter((d => d !== myDep)), 'ทุกแผนก' ];
  const groupTitle = d => d === 'ทุกแผนก' ? '⭐ ผู้จัดการ / ดูแลทุกแผนก' : `👥 หัวหน้า ${d}`;
  const renderOne = u => {
    const b = _mtShiftBadge(u.allowed_shift);
    const ini = _mtEsc(String(u.username || '?').substring(0, 2).toUpperCase());
    const tg = window._tgLink(u.telegram_id);
    const label = u.label || (u.role === 'admin' ? 'ADMIN' : 'หัวหน้า');
    return `\n        <div style="display:flex;align-items:flex-start;gap:12px;padding:12px 4px;border-bottom:1px solid rgba(148,163,184,.1)">\n            <div style="width:40px;height:40px;border-radius:50%;background:var(--k-card);border:1px solid var(--k-line2);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:12px;color:var(--k-tx2);flex-shrink:0">${ini}</div>\n            <div style="min-width:0;flex:1">\n                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">\n                    <span style="font-weight:800;color:var(--k-tx);font-size:14px">${_mtEsc(u.username)}</span>\n                    <span style="font-size:10px;color:var(--k-tx3);background:rgba(148,163,184,.12);padding:1px 7px;border-radius:5px">${_mtEsc(u.department || '-')}</span>\n                    <span style="font-size:10px;color:light-dark(#5704a9,#c084fc);background:rgba(192,132,252,.12);padding:1px 7px;border-radius:5px">${_mtEsc(label)}</span>\n                </div>\n                <div style="display:flex;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap">\n                    ${[ 'กะเช้า', 'กะกลาง', 'กะดึก' ].includes(u.allowed_shift) ? `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11.5px;font-weight:800;color:${b[1]};background:${b[1]}1f;border:1px solid ${b[1]}55;padding:2px 9px;border-radius:999px">${b[2]} ${_mtEsc(u.allowed_shift.replace('กะ', ''))}</span>` : `<span style="font-size:11px;color:var(--k-mute)">ทุกกะ</span>`}\n                </div>\n                ${u.note ? `<div style="font-size:11.5px;color:var(--k-tx3);margin-top:5px">${_mtEsc(u.note)}</div>` : ''}\n                <div style="display:flex;gap:12px;margin-top:6px;flex-wrap:wrap;font-size:12px">\n                    ${tg ? `<a href="${_mtEsc(tg)}" target="_blank" style="color:light-dark(#0676a8,#38bdf8);text-decoration:none;display:inline-flex;align-items:center;gap:4px"><span class="material-icons" style="font-size:14px">send</span>${_mtEsc(String(u.telegram_id).startsWith('@') ? u.telegram_id : 'Telegram')}</a>` : `<span style="color:var(--k-mute3)">ไม่มี Telegram</span>`}\n                    ${u.discord_id ? `<span style="color:light-dark(#2f07a6,#a78bfa);display:inline-flex;align-items:center;gap:4px;cursor:pointer" title="กดเพื่อก็อป Discord" onclick="navigator.clipboard&&navigator.clipboard.writeText('${_mtEsc(u.discord_id)}');Swal.fire({toast:true,position:'top-end',icon:'success',title:'ก็อป Discord แล้ว',showConfirmButton:false,timer:1500})"><span class="material-icons" style="font-size:14px">content_copy</span>${_mtEsc(u.discord_id)}</span>` : ''}\n                </div>\n            </div>\n        </div>`;
  };
  const groups = groupOrder.map((d => ({
    d: d,
    items: heads.filter((u => (u.department || 'AM') === d))
  }))).filter((g => g.items.length));
  heads.filter((u => !groupOrder.includes(u.department || 'AM'))).forEach((u => {
    let g = groups.find((x => x.d === u.department));
    if (!g) {
      g = {
        d: u.department,
        items: []
      };
      groups.splice(groups.length - (groups.some((x => x.d === 'ทุกแผนก')) ? 1 : 0), 0, g);
    }
    g.items.push(u);
  }));
  const groupCol = g => `\n        <div style="min-width:0;background:color-mix(in srgb,var(--k-panel2) 45.0%,transparent);border:1px solid rgba(148,163,184,.12);border-radius:12px;padding:4px 10px 6px">\n            <div style="margin:6px 0 4px;padding:6px 10px;border-radius:9px;background:${g.d === myDep ? 'rgba(96,165,250,.14)' : 'rgba(148,163,184,.08)'};border-left:3px solid ${g.d === myDep ? '#60a5fa' : g.d === 'ทุกแผนก' ? '#fbbf24' : '#64748b'};font-size:12px;font-weight:800;color:${g.d === myDep ? '#93c5fd' : 'var(--k-tx2)'};display:flex;justify-content:space-between;align-items:center">\n                <span>${groupTitle(g.d)}${g.d === myDep ? ' <span style="font-size:10px;font-weight:600;opacity:.8">(แผนกของคุณ)</span>' : ''}</span><span style="font-size:10px;font-weight:600;opacity:.7">${g.items.length} คน</span>\n            </div>${g.items.map(renderOne).join('')}\n        </div>`;
  const headRows = groups.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-top:6px">${groups.map(groupCol).join('')}</div>` : `<div style="padding:16px;color:var(--k-mute);font-size:12px;text-align:center">ยังไม่ได้ตั้งค่าหัวหน้า — แอดมินตั้งได้ที่ ตั้งค่าระบบ → ติดต่อหัวหน้า</div>`;
  const wrap = (title, icon, bodyHtml, rightHtml) => `\n        <div style="background:linear-gradient(165deg,var(--k-panel2),var(--k-bg));border:1px solid rgba(148,163,184,.18);border-radius:18px;padding:16px 18px;box-shadow:0 10px 30px rgba(0,0,0,.3)">\n            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">\n                <div style="display:flex;align-items:center;gap:8px;font-weight:900;font-size:15px;color:var(--k-tx)"><span class="material-icons" style="font-size:19px;color:light-dark(#054ea8,#60a5fa)">${icon}</span>${title}</div>\n                ${rightHtml || ''}\n            </div>\n            ${bodyHtml}\n        </div>`;
  box.innerHTML = `\n        \x3c!-- 📅 แถบวันที่แถวเดียวจบ: [‹] [วันที่กดเลือกได้] [›] + ปุ่มกลับวันนี้ · ไม่มีข้อความซ้ำอีก --\x3e\n        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:2px 4px 2px 2px">\n            <div style="display:flex;align-items:center;height:38px;border-radius:12px;overflow:hidden;background:color-mix(in srgb,var(--k-panel2) 65.0%,transparent);border:1px solid rgba(148,163,184,.22)">\n                <button onclick="myTodayShift(-1)" title="วันก่อนหน้า" style="height:100%;padding:0 9px;display:flex;align-items:center;color:var(--k-tx3);background:none;border:none;cursor:pointer;transition:all .15s"\n                    onmouseover="this.style.color='var(--k-tx-strong)';this.style.background='rgba(148,163,184,.14)'" onmouseout="this.style.color='var(--k-tx3)';this.style.background='none'"><span class="material-icons" style="font-size:18px">chevron_left</span></button>\n                <div style="position:relative;display:flex;align-items:center;gap:7px;height:100%;padding:0 13px;border-left:1px solid rgba(148,163,184,.16);border-right:1px solid rgba(148,163,184,.16);cursor:pointer">\n                    <span style="font-size:14px;font-weight:900;color:var(--k-tx);white-space:nowrap">${_mtFmt(dateVal)}</span>\n                    ${isToday ? '<span style="font-size:10px;font-weight:800;color:light-dark(#054ea8,#60a5fa);background:rgba(96,165,250,.16);padding:2px 7px;border-radius:99px">วันนี้</span>' : ''}\n                    <input type="date" id="myTodayDate" class="mt-date-hidden" value="${dateVal}" onchange="myTodaySetDate(this.value)" title="กดเพื่อเลือกวันที่"\n                        style="position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;color:transparent;background:transparent;border:none;padding:0;font-size:0">\n                </div>\n                <button onclick="myTodayShift(1)" title="วันถัดไป" style="height:100%;padding:0 9px;display:flex;align-items:center;color:var(--k-tx3);background:none;border:none;cursor:pointer;transition:all .15s"\n                    onmouseover="this.style.color='var(--k-tx-strong)';this.style.background='rgba(148,163,184,.14)'" onmouseout="this.style.color='var(--k-tx3)';this.style.background='none'"><span class="material-icons" style="font-size:18px">chevron_right</span></button>\n            </div>\n            ${isToday ? '' : `<button onclick="myTodaySetDate('')" style="height:38px;padding:0 13px;border-radius:12px;border:1px solid rgba(232,193,90,.45);background:rgba(232,193,90,.12);color:var(--k-gold-tx);font-size:12px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:5px"><span class="material-icons" style="font-size:15px">today</span> กลับวันนี้</button>`}\n            <div style="display:flex;align-items:center;gap:5px;margin-left:auto">\n                <span style="background:rgba(148,163,184,.12);padding:4px 10px;border-radius:7px;color:var(--k-tx2);font-weight:800;font-size:11.5px">${_mtEsc(myDep)}</span>\n                ${me.team ? `<span style="background:rgba(96,165,250,.14);padding:4px 10px;border-radius:7px;color:light-dark(#0352aa,#93c5fd);font-weight:800;font-size:11.5px">${_mtEsc(me.team)}</span>` : ''}\n            </div>\n        </div>\n        ${wrap(`วันนี้ของฉัน <span style="font-size:11px;font-weight:600;color:var(--k-mute);margin-left:4px">${_mtEsc(me.username)}</span>`, 'person', `\n            ${card('work', '#818cf8', 'งานของฉัน (เว็บที่รับผิดชอบ)', jobsVal, jobsSub)}\n            ${card('restaurant', '#34d399', 'เวลาพักวันนี้', brVal, brSub)}\n            ${card('event_available', '#f472b6', 'วันหยุดของฉัน', lvVal, lvSub)}\n            ${card('swap_horiz', '#fb923c', 'สลับกะ', swVal, swSub)}\n        `, effShift ? `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end">\n                <span style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:999px;background:${sbE[1]}22;border:1px solid ${sbE[1]}66;color:var(--k-tx);font-weight:800;font-size:13px">${sbE[2]} ${_mtEsc(effShift)} <span style="font-size:11px;color:${sbE[1]};font-family:monospace">${shE.open}–${shE.close}</span></span>\n                ${stE ? `<span style="font-size:11px;font-weight:800;color:${stE.color};background:${stE.bg};padding:4px 9px;border-radius:999px">● ${stE.label}</span>` : ''}\n                ${swapToday ? `<span title="วันนี้สลับจาก ${_mtEsc(swapToday.pl.from_shift || swapToday.pl.original_shift || myShift || '-')} → ${_mtEsc(swapToday.pl.target_shift)}" style="font-size:11px;font-weight:800;color:light-dark(#aa4e03,#fb923c);background:rgba(251,146,60,.15);border:1px solid rgba(251,146,60,.45);padding:4px 9px;border-radius:999px">🔄 สลับกะ</span>` : ''}\n            </div>` : `<span style="font-size:11px;color:var(--k-mute)">ไม่มีกะ</span>`)}\n        ${wrap('ช่องทางติดต่อหัวหน้า', 'support_agent', headRows + `<div style="font-size:11px;color:var(--k-mute);padding-top:10px">หากมีปัญหาหรือติดขัด ติดต่อหัวหน้าก่อนเป็นอันดับแรก</div>`, `<span style="font-size:11px;color:var(--k-tx3)">ทั้งหมด ${heads.length} คน</span>`)}\n    `;
};

window.toggleFullTable = function(force) {
  const sec = document.getElementById('timeTableSection');
  const icon = document.getElementById('toggleFullTableIcon');
  const label = document.getElementById('toggleFullTableLabel');
  if (!sec) return;
  const show = typeof force === 'boolean' ? force : sec.classList.contains('hidden');
  sec.classList.toggle('hidden', !show);
  if (icon) icon.textContent = show ? 'expand_less' : 'expand_more';
  if (label) label.textContent = show ? 'ซ่อนตารางลงเวลาทั้งหมด' : 'ดูตารางลงเวลาทั้งหมด (ใครลงกินข้าวกี่โมง)';
  try {
    localStorage.setItem('k36_show_full_table', show ? '1' : '0');
  } catch (e) {}
};

window._headContacts = [];

window._headContactsAt = 0;

window.loadHeadContacts = async function(force) {
  if (!force && window._headContactsAt && Date.now() - window._headContactsAt < 6e4) return window._headContacts;
  try {
    const {data: data} = await appDB.from('settings').select('value').eq('key', 'head_contacts').maybeSingle();
    window._headContacts = data && data.value ? JSON.parse(data.value) : [];
  } catch (e) {
    window._headContacts = [];
  }
  if (!Array.isArray(window._headContacts)) window._headContacts = [];
  window._headContactsAt = Date.now();
  return window._headContacts;
};

window.renderHeadContactsEditor = async function() {
  const box = document.getElementById('headContactsEditor');
  if (!box) return;
  box.innerHTML = '<div class="text-center text-gray-500 text-xs py-6">กำลังโหลด...</div>';
  await window.loadHeadContacts(true);
  const list = window._headContacts;
  const esc = v => window.escapeHtml ? window.escapeHtml(v) : String(v ?? '');
  const depts = [ 'AM', 'OD', 'ทุกแผนก' ];
  const shifts = [ '', 'กะเช้า', 'กะกลาง', 'กะดึก' ];
  if (!list.length) {
    box.innerHTML = `<div class="text-center text-gray-500 text-xs py-8 border border-dashed border-slate-700 rounded-xl">ยังไม่มีรายชื่อ — กด "เพิ่มคน" เพื่อเริ่ม<br><span class="text-[10px]">(ถ้าไม่ตั้ง ระบบจะดึงแอดมิน/หัวหน้าจากรายชื่อพนักงานให้อัตโนมัติ)</span></div>`;
    return;
  }
  box.innerHTML = `\n        <div class="grid text-[10px] text-gray-500 font-bold px-2" style="grid-template-columns:34px 1.2fr .8fr .9fr .9fr 1.2fr 1fr 1.2fr 70px;gap:6px">\n            <div>#</div><div>ชื่อที่แสดง</div><div>แผนก</div><div>ตำแหน่ง/ป้าย</div><div>กะ</div><div>Telegram (@ หรือลิงก์)</div><div>Discord ID</div><div>หมายเหตุ</div><div></div>\n        </div>` + list.map(((c, i) => `\n        <div class="grid items-center bg-slate-900/60 border border-slate-700 rounded-xl px-2 py-2" style="grid-template-columns:34px 1.2fr .8fr .9fr .9fr 1.2fr 1fr 1.2fr 70px;gap:6px">\n            <div class="text-xs text-gray-500 font-bold text-center">${i + 1}</div>\n            <input data-f="name" data-i="${i}" value="${esc(c.name || '')}" placeholder="ชื่อ" class="hc-in">\n            <select data-f="dept" data-i="${i}" class="hc-in">${depts.map((d => `<option value="${d}" ${(c.dept || 'AM') === d ? 'selected' : ''}>${d}</option>`)).join('')}</select>\n            <input data-f="label" data-i="${i}" value="${esc(c.label || 'หัวหน้า')}" placeholder="เช่น หัวหน้า AM" class="hc-in">\n            <select data-f="shift" data-i="${i}" class="hc-in">${shifts.map((sv => `<option value="${sv}" ${(c.shift || '') === sv ? 'selected' : ''}>${sv || 'ทุกกะ'}</option>`)).join('')}</select>\n            <input data-f="telegram" data-i="${i}" value="${esc(c.telegram || '')}" placeholder="@username" class="hc-in">\n            <input data-f="discord" data-i="${i}" value="${esc(c.discord || '')}" placeholder="Discord ID / ชื่อ" class="hc-in">\n            <input data-f="note" data-i="${i}" value="${esc(c.note || '')}" placeholder="เช่น ติดต่อเรื่องเวร" class="hc-in">\n            <div class="flex gap-1 justify-end">\n                <button onclick="moveHeadContact(${i},-1)" class="text-gray-400 hover:text-white p-1" title="เลื่อนขึ้น"><span class="material-icons text-sm">arrow_upward</span></button>\n                <button onclick="moveHeadContact(${i},1)" class="text-gray-400 hover:text-white p-1" title="เลื่อนลง"><span class="material-icons text-sm">arrow_downward</span></button>\n                <button onclick="removeHeadContact(${i})" class="text-red-400 hover:text-red-300 p-1" title="ลบ"><span class="material-icons text-sm">delete</span></button>\n            </div>\n        </div>`)).join('') + `<style>.hc-in{background:var(--k-panel2);border:1px solid var(--k-line2);color:var(--k-tx);border-radius:8px;padding:7px 9px;font-size:12px;outline:none;min-width:0;width:100%}.hc-in:focus{border-color:#fbbf24}</style>`;
  box.querySelectorAll('.hc-in').forEach((el => el.addEventListener('input', (() => {
    const i = +el.dataset.i, f = el.dataset.f;
    if (window._headContacts[i]) window._headContacts[i][f] = el.value;
  }))));
  box.querySelectorAll('select.hc-in').forEach((el => el.addEventListener('change', (() => {
    const i = +el.dataset.i, f = el.dataset.f;
    if (window._headContacts[i]) window._headContacts[i][f] = el.value;
  }))));
};

window.addHeadContactRow = function() {
  window._headContacts.push({
    name: '',
    dept: window.currentUser && window.currentUser.department || 'AM',
    label: 'หัวหน้า',
    shift: '',
    telegram: '',
    discord: '',
    note: ''
  });
  window._renderHeadContactsFromMemory();
};

window.removeHeadContact = function(i) {
  window._headContacts.splice(i, 1);
  window._renderHeadContactsFromMemory();
};

window.moveHeadContact = function(i, d) {
  const j = i + d;
  const L = window._headContacts;
  if (j < 0 || j >= L.length) return;
  [L[i], L[j]] = [ L[j], L[i] ];
  window._renderHeadContactsFromMemory();
};

window._renderHeadContactsFromMemory = function() {
  const keep = window._headContacts;
  const orig = window.loadHeadContacts;
  window.loadHeadContacts = async () => keep;
  window.renderHeadContactsEditor().finally((() => {
    window.loadHeadContacts = orig;
  }));
};

window.saveHeadContacts = async function() {
  const list = (window._headContacts || []).map((c => ({
    name: String(c.name || '').trim(),
    dept: c.dept || 'AM',
    label: String(c.label || '').trim() || 'หัวหน้า',
    shift: c.shift || '',
    telegram: String(c.telegram || '').trim(),
    discord: String(c.discord || '').trim(),
    note: String(c.note || '').trim()
  }))).filter((c => c.name));
  try {
    await appDB.from('settings').upsert({
      key: 'head_contacts',
      value: JSON.stringify(list)
    }, {
      onConflict: 'key'
    });
    window._headContacts = list;
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: `บันทึกแล้ว (${list.length} คน)`,
      showConfirmButton: false,
      timer: 2e3
    });
    window._renderHeadContactsFromMemory();
    if (typeof window.renderMyToday === 'function') window.renderMyToday();
  } catch (e) {
    Swal.fire('บันทึกไม่สำเร็จ', e.message, 'error');
  }
};

window._tgLink = function(v) {
  v = String(v || '').trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^\d+$/.test(v)) return `tg://user?id=${v}`;
  return `https://t.me/${v.replace(/^@/, '').replace(/^t\.me\//i, '')}`;
};

window._shrinkStop = false;

window.shrinkOldImages = async function() {
  if (!canPerm('admin_settings')) return Swal.fire('ไม่มีสิทธิ์', 'ต้องมีสิทธิ์ ตั้งค่าระบบ', 'error');
  const log = document.getElementById('shrinkOldLog'), btn = document.getElementById('shrinkOldBtn'), stopBtn = document.getElementById('shrinkOldStop');
  const say = (m, cls) => {
    if (!log) return;
    log.classList.remove('hidden');
    const d = document.createElement('div');
    d.textContent = m;
    if (cls) d.style.color = cls;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
  };
  const BUCKET = 'staff_images', FOLDERS = [ '', 'files', 'files/covers', 'fines', 'logos', 'sop' ], MIN = 250 * 1024, BATCH = 20;
  const OPTS = {
    '': {
      maxDim: 1920,
      quality: .85
    },
    files: {
      maxDim: 2e3,
      quality: .85
    },
    'files/covers': {
      maxDim: 1400,
      quality: .8
    },
    fines: {
      maxDim: 1600,
      quality: .85
    },
    logos: {
      maxDim: 900,
      quality: .85
    },
    sop: {
      maxDim: 1600,
      quality: .85
    }
  };
  window._shrinkStop = false;
  btn.disabled = true;
  stopBtn.classList.remove('hidden');
  if (log) log.innerHTML = '';
  const DONE_KEY = 'k36_shrink_done_v1';
  let doneSet = new Set;
  try {
    doneSet = new Set(JSON.parse(localStorage.getItem(DONE_KEY) || '[]'));
  } catch (e) {}
  const markDone = path => {
    doneSet.add(path);
    try {
      localStorage.setItem(DONE_KEY, JSON.stringify([ ...doneSet ]));
    } catch (e) {}
  };
  say('🔎 กำลังไล่ดูรายชื่อรูปทั้งหมด...' + (doneSet.size ? ` (เคยทำแล้ว ${doneSet.size} รูป จะข้าม)` : ''));
  const targets = [];
  for (const folder of FOLDERS) {
    let offset = 0;
    while (true) {
      const {data: data, error: error} = await appDB.storage.from(BUCKET).list(folder, {
        limit: 1e3,
        offset: offset,
        sortBy: {
          column: 'name',
          order: 'asc'
        }
      });
      if (error) {
        say(`⚠️ list ${folder || '/'} ไม่ได้: ${error.message}`, '#f87171');
        break;
      }
      (data || []).forEach((o => {
        if (!o.id || !o.metadata) return;
        const size = o.metadata.size || 0, mime = String(o.metadata.mimetype || '');
        if (!mime.startsWith('image/') || mime === 'image/gif' || mime === 'image/svg+xml') return;
        if (o.name.startsWith('thumb_')) return;
        if (size <= MIN) return;
        const path = (folder ? folder + '/' : '') + o.name;
        if (doneSet.has(path)) return;
        targets.push({
          path: path,
          size: size,
          folder: folder,
          mime: mime
        });
      }));
      if (!data || data.length < 1e3) break;
      offset += 1e3;
    }
  }
  const totalMB = targets.reduce(((a, t) => a + t.size), 0) / 1024 / 1024;
  say(`📋 พบรูปที่ควรย่อ ${targets.length} รูป รวม ${totalMB.toFixed(1)} MB (ข้ามรูปที่เล็กอยู่แล้ว)`);
  if (!targets.length) {
    say('✅ ไม่มีรูปเก่าที่ต้องย่อแล้ว — ถอดปุ่มนี้ออกได้เลย', '#4ade80');
    btn.disabled = false;
    stopBtn.classList.add('hidden');
    return;
  }
  let done = 0, saved = 0, fail = 0;
  for (let i = 0; i < targets.length; i += BATCH) {
    if (window._shrinkStop) {
      say(`⏸️ หยุดตามคำสั่ง — ทำไปแล้ว ${done}/${targets.length} กด "ทำต่อ" เพื่อทำต่อจากตรงนี้`, '#fbbf24');
      break;
    }
    const chunk = targets.slice(i, i + BATCH);
    await Promise.all(chunk.map((async t => {
      try {
        const {data: blob, error: dErr} = await appDB.storage.from(BUCKET).download(t.path);
        if (dErr || !blob) throw new Error(dErr ? dErr.message : 'download ว่าง');
        const file = new File([ blob ], t.path.split('/').pop(), {
          type: t.mime
        });
        const small = await window.compressImageFile(file, OPTS[t.folder] || {
          maxDim: 1600,
          quality: .85
        });
        if (small === file || small.size >= t.size * .95) {
          done++;
          markDone(t.path);
          return;
        }
        const {error: uErr} = await appDB.storage.from(BUCKET).upload(t.path, small, {
          upsert: true,
          cacheControl: '3600',
          contentType: small.type
        });
        if (uErr) throw new Error(uErr.message);
        done++;
        saved += t.size - small.size;
        markDone(t.path);
        say(`✔ ${t.path}  ${(t.size / 1024).toFixed(0)}KB → ${(small.size / 1024).toFixed(0)}KB`);
      } catch (e) {
        fail++;
        say(`✖ ${t.path}: ${e.message}`, '#f87171');
      }
    })));
    say(`— ${Math.min(i + BATCH, targets.length)}/${targets.length} · ประหยัดแล้ว ${(saved / 1024 / 1024).toFixed(1)} MB${fail ? ' · พลาด ' + fail : ''}`, '#93c5fd');
  }
  if (!window._shrinkStop) say(`🎉 เสร็จ: ย่อ ${done} รูป ประหยัด ${(saved / 1024 / 1024).toFixed(1)} MB${fail ? ' (พลาด ' + fail + ' รูป — กด "ทำต่อ" จะลองเฉพาะรูปที่พลาด)' : ' — ครบแล้ว ถอดปุ่มออกได้'}`, '#4ade80');
  btn.disabled = false;
  stopBtn.classList.add('hidden');
};
