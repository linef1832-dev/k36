window.GLOBAL_SHEETS = [];

window.currentActiveTabId = null;

let recentTabs = JSON.parse(localStorage.getItem('sheet_recent_tabs') || '[]');

window.MY_SHEET_GROUP = 'ชีตของฉัน';

window._sheetPersonalMode = false;

window.sheetMe = function() {
  return window.currentUser && window.currentUser.username ? String(window.currentUser.username) : '';
};

window.sheetIsMgr = function() {
  return canPerm('sheet_manage');
};

window.sheetCanTouch = function(sheet) {
  if (!sheet) return false;
  if (sheet.owner) return sheet.owner === window.sheetMe();
  return window.sheetIsMgr();
};

window.initSheetApp = async function() {
  const adminControls = document.getElementById('sheetAdminControls');
  if (adminControls) adminControls.classList.toggle('hidden', !window.sheetIsMgr());
  const myBtn = document.getElementById('btnMySheets');
  if (myBtn) myBtn.classList.remove('hidden');
  await fetchSheets();
};

window.initSheetRealtime = function() {
  if (window._sheetRtChannel || typeof appDB === 'undefined') return;
  try {
    window._sheetRtChannel = appDB.channel('sheets-realtime').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'external_sheets'
    }, (() => {
      clearTimeout(window._sheetRtTimer);
      window._sheetRtTimer = setTimeout((() => {
        if (window.dbCache) window.dbCache.bust('ext_sheets');
        window.fetchSheets(true);
      }), 350);
    })).subscribe();
  } catch (e) {
    console.warn('Sheet realtime ใช้ไม่ได้:', e.message);
  }
};

async function _fetchSheetsCore(force) {
  try {
    if (typeof appDB === 'undefined') return;
    let data = !force && window.dbCache ? window.dbCache.get('ext_sheets') : undefined;
    if (data === undefined) {
      const res = await appDB.from('external_sheets').select('*').order('id', {
        ascending: true
      });
      if (res.error) throw res.error;
      data = res.data || [];
      if (window.dbCache) window.dbCache.set('ext_sheets', data, 6e4);
    }
    const me = window.sheetMe();
    window.GLOBAL_SHEETS = (data || []).filter((s => !s.owner || s.owner === me));
    const byId = new Map(window.GLOBAL_SHEETS.map(x => [ String(x.id), x ]));
    const pruned = recentTabs.filter(t => byId.has(String(t.id))).map(t => byId.get(String(t.id)));
    if (pruned.length !== recentTabs.length || pruned.some((t, i) => t !== recentTabs[i])) {
      recentTabs = pruned;
      window.safeSetItem('sheet_recent_tabs', JSON.stringify(recentTabs));
    }
    renderSheetMenu();
    if (typeof renderAdminSheetList === 'function') renderAdminSheetList();
    renderRecentTabs();
    if (typeof window.initSheetRealtime === 'function') window.initSheetRealtime();
  } catch (err) {
    console.error('Fetch Sheets Error:', err);
  }
}

window.fetchSheets = async function(force) {
  await _fetchSheetsCore(force);
  if (typeof initCalculator === 'function') await initCalculator();
};

window.shEsc = v => String(v == null ? '' : v).replace(/[&<>"']/g, (c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[c])));

window.SHEET_COLOR_MAP = {
  blue: '#3b82f6',
  green: '#10b981',
  red: '#ef4444',
  yellow: '#f59e0b',
  purple: '#8b5cf6',
  gray: '#64748b'
};

window.sheetColorOf = function(sheet) {
  const c = String(sheet && sheet.color || '');
  if (/^#[0-9a-fA-F]{3,8}$/.test(c)) return c;
  return window.SHEET_COLOR_MAP[c] || '#3b82f6';
};

window.sheetKindOf = function(sheet) {
  const u = String(sheet && (sheet.sheet_id || sheet.url) || '');
  if (u === 'NOTE') return 'note';
  if (u.startsWith('http') || u.startsWith('www')) return 'web';
  return 'gsheet';
};

window.getPinnedSheets = function() {
  try {
    return (JSON.parse(localStorage.getItem('pinned_sheets') || '[]') || []).map(String);
  } catch (e) {
    return [];
  }
};

window._sheetFilter = window._sheetFilter || 'all';

window.setSheetFilter = function(f) {
  window._sheetFilter = f;
  renderSheetMenu();
};

window.renderSheetMenu = function() {
  const container = document.getElementById('sheetGroupsContainer');
  if (!container) return;
  const esc = window.shEsc;
  const term = ((document.getElementById('sheetSearch') || {}).value || '').toLowerCase().trim();
  const pinned = window.getPinnedSheets();
  const isPinned = s => pinned.includes(String(s.id));
  const all = window.GLOBAL_SHEETS || [];
  const KIND = {
    note: {
      icon: 'table_chart',
      label: 'หน้าข้อความ'
    },
    web: {
      icon: 'public',
      label: 'เว็บ'
    },
    gsheet: {
      icon: 'grid_on',
      label: 'Google Sheet'
    }
  };
  const f = window._sheetFilter;
  const match = s => {
    const name = String(s.name || s.title || '').toLowerCase();
    const grp = String(s.group_name || '').toLowerCase();
    if (term && !name.includes(term) && !grp.includes(term)) return false;
    if (f === 'pin') return isPinned(s);
    if (f === 'note') return window.sheetKindOf(s) === 'note';
    if (f === 'link') return window.sheetKindOf(s) !== 'note';
    return true;
  };
  const list = all.filter(match);
  const cnt = {
    all: all.length,
    pin: all.filter(isPinned).length,
    link: all.filter(s => window.sheetKindOf(s) !== 'note').length,
    note: all.filter(s => window.sheetKindOf(s) === 'note').length
  };
  const chip = (k, label, icon) => `<button type="button" class="sm2-chip${f === k ? ' on' : ''}" onclick="setSheetFilter('${k}')"><span class="material-icons">${icon}</span>${label}<b>${cnt[k]}</b></button>`;
  const stat = document.getElementById('sheetStatLine');
  if (stat) stat.textContent = `${all.length} รายการ · ${new Set(all.map(s => s.group_name || 'ทั่วไป')).size} หมวด`;
  const tile = (s, sub) => {
    const k = KIND[window.sheetKindOf(s)];
    const col = window.sheetColorOf(s);
    const name = esc(s.name || s.title || 'ไม่มีชื่อ');
    const id = esc(s.id);
    const pin = isPinned(s);
    const hasImg = s.cover_url && String(s.cover_url).trim();
    const ic = hasImg ? `<span class="sm3-ic img" style="--c:${col}"><img src="${esc(s.cover_url)}" alt="" loading="lazy" onerror="this.parentNode.classList.remove('img');this.remove()"><span class="material-icons">${k.icon}</span></span>` : `<span class="sm3-ic" style="--c:${col}"><span class="material-icons">${k.icon}</span></span>`;
    return `<div class="sm3-tile${pin ? ' pinned' : ''}" role="button" tabindex="0" title="${name}" data-id="${id}" onclick="openSheetById(this.dataset.id)" onkeydown="if(event.key==='Enter')openSheetById(this.dataset.id)">${ic}<span class="sm3-nm">${name}</span><span class="sm3-sub">${esc(sub || k.label)}</span><button type="button" class="sm3-pin${pin ? ' on' : ''}" data-id="${id}" onclick="togglePin(event, this.dataset.id)" title="${pin ? 'เลิกปักหมุด' : 'ปักหมุด'}" aria-label="${pin ? 'เลิกปักหมุด' : 'ปักหมุด'} ${name}"><span class="material-icons">${pin ? 'star' : 'star_outline'}</span></button></div>`;
  };
  let html = `<div class="sm2-bar">${chip('all', 'ทั้งหมด', 'apps')}${chip('pin', 'ปักหมุด', 'star')}${chip('link', 'ลิงก์', 'link')}${chip('note', 'หน้าข้อความ', 'table_chart')}</div>`;
  if (!list.length) {
    container.innerHTML = html + `<div class="sm2-empty"><span class="material-icons">search_off</span><b>${term ? 'ไม่พบ "' + esc(term) + '"' : f === 'pin' ? 'ยังไม่มีรายการที่ปักหมุด' : 'ยังไม่มีรายการ'}</b><span>${f === 'pin' ? 'กดดาว ☆ ท้ายรายการเพื่อปักหมุดไว้บนสุด' : 'ลองคำค้นอื่น หรือเลือก "ทั้งหมด"'}</span></div>`;
    return;
  }
  const pins = list.filter(isPinned);
  if (pins.length && f !== 'pin' && !term) {
    html += `<section class="sm3-sec pin wide"><div class="sm3-h"><span class="material-icons" style="color:#f59e0b">star</span><b>ปักหมุด</b><span class="sm3-n">${pins.length}</span></div><div class="sm3-grid">${pins.map((s => tile(s, s.group_name || 'ทั่วไป'))).join('')}</div></section>`;
  }
  const groups = {};
  list.forEach((s => {
    const g = s.owner ? window.MY_SHEET_GROUP : s.group_name || 'ทั่วไป';
    (groups[g] = groups[g] || []).push(s);
  }));
  const names = Object.keys(groups).sort(((a, b) => a === window.MY_SHEET_GROUP ? -1 : b === window.MY_SHEET_GROUP ? 1 : a.localeCompare(b, 'th')));
  html += '<div class="sm3-wrap">' + names.map((g => {
    const items = groups[g];
    const mine = g === window.MY_SHEET_GROUP;
    const gc = mine ? '#10b981' : window.sheetColorOf(items[0]);
    return `<section class="sm3-sec${items.length > 3 ? ' wide' : ''}" style="--gc:${gc}"><div class="sm3-h"><span class="sm3-dot"></span><b>${esc(g)}</b>${mine ? '<span class="sm2-lock"><span class="material-icons">lock</span>เห็นเฉพาะคุณ</span>' : ''}<span class="sm3-n">${items.length}</span></div><div class="sm3-grid">${items.map((s => tile(s))).join('')}</div></section>`;
  })).join('') + '</div>';
  container.innerHTML = html;
};

window.togglePin = function(e, id) {
  if (e) e.stopPropagation();
  const key = String(id);
  let pinned = window.getPinnedSheets();
  pinned = pinned.includes(key) ? pinned.filter(p => p !== key) : pinned.concat(key);
  window.safeSetItem('pinned_sheets', JSON.stringify(pinned));
  renderSheetMenu();
};

const CALC_STORAGE_KEY = 'calc_local_team_list';

window.initCalculator = async function() {
  const teamSelect = document.getElementById('calcTeamSelect');
  const deductInput = document.getElementById('calcDeductAmount');
  const saveBtn = document.getElementById('btnSaveCalc');
  const lockIcon = document.getElementById('calcLockIcon');
  const addBtn = document.getElementById('btnCalcAdd');
  const delBtn = document.getElementById('btnCalcDelete');
  let isAdmin = canPerm('sheet_manage');
  if (teamSelect) {
    teamSelect.innerHTML = '';
    const teamNames = window.GLOBAL_SHEETS.filter((s => !s.owner && s.group_name !== 'วันหยุด / เปลี่ยนกะ' && s.group_name !== 'แก้ไขข้อมูล' && s.group_name !== 'งาน OD')).map((s => s.name || s.title)).filter(Boolean);
    let uniqueTeams = [ ...new Set(teamNames) ];
    const localTeams = JSON.parse(localStorage.getItem(CALC_STORAGE_KEY) || '[]');
    uniqueTeams = [ ...new Set([ ...uniqueTeams, ...localTeams ]) ];
    if (uniqueTeams.length > 0) {
      teamSelect.innerHTML = uniqueTeams.map(t => `<option value="${window.shEsc(t)}">${window.shEsc(t)}</option>`).join('');
    } else {
      teamSelect.innerHTML = `<option value="General">ทั่วไป</option>`;
    }
    const savedTeam = localStorage.getItem('calc_saved_team');
    if (savedTeam && uniqueTeams.includes(savedTeam)) {
      teamSelect.value = savedTeam;
    }
  }
  if (deductInput && saveBtn && lockIcon) {
    if (isAdmin) {
      deductInput.disabled = false;
      deductInput.className = "sh-in deduct";
      saveBtn.classList.remove('hidden');
      lockIcon.innerText = 'lock_open';
      lockIcon.classList.remove('text-red-400', 'opacity-50');
      lockIcon.classList.add('text-green-500', 'opacity-100');
      if (addBtn) addBtn.classList.remove('hidden');
      if (delBtn) delBtn.classList.remove('hidden');
    } else {
      deductInput.disabled = true;
      deductInput.className = "sh-in deduct";
      saveBtn.classList.add('hidden');
      lockIcon.innerText = 'lock';
      lockIcon.classList.remove('text-green-500', 'opacity-100');
      lockIcon.classList.add('text-red-400', 'opacity-50');
      if (addBtn) addBtn.classList.add('hidden');
      if (delBtn) delBtn.classList.add('hidden');
    }
  }
  loadCalcSettings();
};

window.loadCalcSettings = async function() {
  const selectElem = document.getElementById('calcTeamSelect');
  if (!selectElem) return;
  const team = selectElem.value;
  if (!team) return;
  window.safeSetItem('calc_saved_team', team);
  const token = window._calcLoadToken = (window._calcLoadToken || 0) + 1;
  let savedVal = 0;
  try {
    if (typeof appDB !== 'undefined') {
      const {data: data} = await appDB.from('settings').select('value').eq('key', `calc_deduct_${team}`).maybeSingle();
      if (data && data.value) savedVal = parseFloat(data.value) || 0;
    }
  } catch (e) {}
  if (token !== window._calcLoadToken) return;
  const deductElem = document.getElementById('calcDeductAmount');
  if (deductElem) deductElem.value = savedVal;
  calculateMoney();
};

window.calculateMoney = function() {
  const inputElem = document.getElementById('calcInputAmount');
  const deductElem = document.getElementById('calcDeductAmount');
  const displayElem = document.getElementById('calcResultDisplay');
  if (!inputElem || !deductElem || !displayElem) return;
  if (String(inputElem.value).trim() === '') {
    displayElem.innerText = '–';
    displayElem.dataset.state = 'empty';
    return;
  }
  const amount = parseFloat(inputElem.value) || 0;
  const deduct = parseFloat(deductElem.value) || 0;
  const result = amount - deduct;
  displayElem.innerText = result.toLocaleString('en-US', {
    maximumFractionDigits: 2
  });
  displayElem.dataset.state = result < 0 ? 'neg' : result > 0 ? 'pos' : 'zero';
};

window.saveCalcSettings = async function() {
  if (!canPerm('sheet_manage')) return Swal.fire('ไม่มีสิทธิ์', 'แก้ยอดหักได้เฉพาะหัวหน้า', 'error');
  const team = document.getElementById('calcTeamSelect').value;
  const deductVal = document.getElementById('calcDeductAmount').value;
  if (!team) return;
  if (deductVal !== '' && !isFinite(parseFloat(deductVal))) return Swal.fire('ตัวเลขไม่ถูกต้อง', '', 'warning');
  if (typeof appDB !== 'undefined') {
    Swal.fire({
      title: 'กำลังบันทึก...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });
    const {error: error} = await appDB.from('settings').upsert([ {
      key: `calc_deduct_${team}`,
      value: deductVal
    } ]);
    if (!error) {
      Swal.fire({
        icon: 'success',
        title: 'บันทึกค่าหักแล้ว',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1500
      });
      calculateMoney();
    } else {
      Swal.fire('ข้อผิดพลาด', 'บันทึกไม่สำเร็จ', 'error');
    }
  }
};

window.addNewCalcTeam = async function() {
  const {value: newTeam} = await Swal.fire({
    title: 'เพิ่มชื่อเว็บ/ทีม',
    input: 'text',
    inputPlaceholder: 'พิมพ์ชื่อเว็บตรงนี้...',
    showCancelButton: true
  });
  if (newTeam) {
    let localTeams = JSON.parse(localStorage.getItem(CALC_STORAGE_KEY) || '[]');
    if (!localTeams.includes(newTeam)) {
      localTeams.push(newTeam);
      window.safeSetItem(CALC_STORAGE_KEY, JSON.stringify(localTeams));
      await initCalculator();
      document.getElementById('calcTeamSelect').value = newTeam;
      loadCalcSettings();
    }
  }
};

window.deleteCalcTeam = async function() {
  const team = document.getElementById('calcTeamSelect').value;
  if (!team) return;
  const local = JSON.parse(localStorage.getItem(CALC_STORAGE_KEY) || '[]');
  if (!local.includes(team)) return Swal.fire('ลบไม่ได้', `"${team}" มาจากรายการชีตของทีม ลบได้เฉพาะชื่อที่เพิ่มเองด้วยปุ่ม +`, 'info');
  const result = await Swal.fire({
    title: `ลบ ${team}?`,
    text: "คุณต้องการลบรายชื่อนี้ออกจากเครื่องคิดเลขใช่หรือไม่?",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444'
  });
  if (result.isConfirmed) {
    let localTeams = JSON.parse(localStorage.getItem(CALC_STORAGE_KEY) || '[]');
    localTeams = localTeams.filter((t => t !== team));
    window.safeSetItem(CALC_STORAGE_KEY, JSON.stringify(localTeams));
    await initCalculator();
  }
};

window.copyCalcResult = function() {
  const amount = parseFloat(document.getElementById('calcInputAmount').value) || 0;
  const deduct = parseFloat(document.getElementById('calcDeductAmount').value) || 0;
  const result = amount - deduct;
  const textToCopy = result.toString();
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(textToCopy).then((() => {
      Swal.fire({
        icon: 'success',
        title: 'คัดลอก: ' + textToCopy,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1e3
      });
    })).catch((err => {
      fallbackCopyText(textToCopy);
    }));
  } else {
    fallbackCopyText(textToCopy);
  }
};

function fallbackCopyText(text) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.position = "fixed";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    const successful = document.execCommand('copy');
    if (successful) Swal.fire({
      icon: 'success',
      title: 'คัดลอก: ' + text,
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 1e3
    }); else Swal.fire({
      icon: 'error',
      title: 'คัดลอกไม่สำเร็จ',
      toast: true
    });
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'คัดลอกไม่สำเร็จ',
      toast: true
    });
  }
  document.body.removeChild(textArea);
}
