let _caseData = [];

let _casePage = 1;

const _casePageSize = 50;

let _caseDate = null;

let _caseSite = 'ALL';

let _caseType = 'ALL';

let _caseTab = 'stats';

window.initWithdrawalReport = async function() {
  _casePage = 1;
  _activeTypeFilter = 'ALL';
  _activeShiftFilter = 'ALL';
  _caseDate = null;
  _setDefaultDate();
  const firstTab = [ 'stats', 'summary', 'log', 'settings' ].find(_canViewTab) || 'stats';
  if (_canViewTab(firstTab)) window.switchCaseTab(firstTab);
  await _loadShiftMap();
  await _loadBotStatus();
  await _loadCaseData();
  _subscribeRealtimeCases();
};

window.initCaseReport = window.initWithdrawalReport;

let _realtimeCaseSub = null;

function _subscribeRealtimeCases() {
  if (!appDB) return;
  if (_realtimeCaseSub) {
    try {
      appDB.removeChannel(_realtimeCaseSub);
    } catch (e) {}
  }
  _realtimeCaseSub = appDB.channel('tg-case-realtime').on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'tg_case_logs'
  }, (payload => {
    const row = payload && payload.new || {};
    if (row.msg_date && _caseDate && row.msg_date !== _caseDate && row.msg_date < _caseDate) return;
    if (document.hidden) {
      window._caseRtStale = true;
      return;
    }
    clearTimeout(window._caseRtTimer);
    window._caseRtTimer = setTimeout((() => {
      _setDefaultDate();
      _loadCaseData(true);
      if (_caseTab === 'summary') loadSummary(true);
    }), 1500);
  })).subscribe();
  if (!window._caseVisBound) {
    window._caseVisBound = true;
    document.addEventListener('visibilitychange', (() => {
      if (!document.hidden && window._caseRtStale && document.getElementById('caseStaffGrid')) {
        window._caseRtStale = false;
        _setDefaultDate();
        _loadCaseData(true);
        if (_caseTab === 'summary') loadSummary(true);
      }
    }));
  }
  if (typeof window.registerPageSubscription === 'function') {
    window.registerPageSubscription(_realtimeCaseSub);
  }
}

const _TAB_COLORS = {
  stats: {
    active: '#4f46e5',
    shadow: 'rgba(79,70,229,0.4)',
    perm: 'withdrawal_report_stats'
  },
  summary: {
    active: '#7c3aed',
    shadow: 'rgba(124,58,237,0.4)',
    perm: 'withdrawal_report_summary'
  },
  log: {
    active: '#0369a1',
    shadow: 'rgba(3,105,161,0.4)',
    perm: 'withdrawal_report_log'
  },
  settings: {
    active: '#047857',
    shadow: 'rgba(4,120,87,0.4)',
    perm: 'withdrawal_report_bot'
  }
};

function _canViewTab(tab) {
  const cfg = _TAB_COLORS[tab];
  if (!cfg?.perm) return true;
  if (typeof window.hasUserPerm === 'function') return window.hasUserPerm(cfg.perm);
  return false;
}

window.switchCaseTab = function(tab) {
  if (!_canViewTab(tab)) {
    Swal.fire({
      icon: 'warning',
      title: 'ไม่มีสิทธิ์',
      text: 'คุณไม่มีสิทธิ์เข้าถึงแท็บนี้',
      timer: 2e3,
      showConfirmButton: false
    });
    return;
  }
  _caseTab = tab;
  [ 'stats', 'summary', 'log', 'settings' ].forEach((t => {
    const el = document.getElementById(`caseTab-${t}`);
    const btn = document.getElementById(`tab-${t}`);
    if (el) {
      el.classList.toggle('hidden', t !== tab);
      el.style.display = t === tab ? t === 'stats' || t === 'summary' ? 'flex' : '' : 'none';
    }
    if (btn) {
      const canView = _canViewTab(t);
      btn.classList.toggle('wr-on', t === tab);
      btn.classList.toggle('wr-lock', !canView);
      btn.title = canView ? '' : 'ไม่มีสิทธิ์เข้าถึง';
    }
  }));
  const fb = document.getElementById('caseFilterBar');
  if (fb) fb.style.display = tab === 'stats' || tab === 'log' ? '' : 'none';
  if (tab === 'summary') loadSummary();
};

function _setDefaultDate() {
  const th = new Date(Date.now() + 7 * 60 * 60 * 1e3);
  _caseDate = th.toISOString().slice(0, 10);
  const picker = document.getElementById('caseDatePicker');
  if (picker) picker.value = _caseDate;
  const label = document.getElementById('caseTodayLabel');
  if (label) {
    const d = new Date(_caseDate);
    label.textContent = `📅 วันที่ ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`;
  }
}

window.setCaseDateToday = function() {
  const th = new Date(Date.now() + 7 * 60 * 60 * 1e3);
  _caseDate = th.toISOString().slice(0, 10);
  const picker = document.getElementById('caseDatePicker');
  if (picker) picker.value = _caseDate;
  _loadCaseData();
};

window.applyFilters = function() {
  _caseSite = document.getElementById('caseSiteFilter').value;
  _caseType = document.getElementById('caseTypeFilter').value;
  _casePage = 1;
  _loadCaseData();
};

window._caseFetchAll = async function(build) {
  const PAGE = 1e3;
  let all = [], from = 0;
  for (let guard = 0; guard < 200; guard++) {
    const {data: data, error: error} = await build().range(from, from + PAGE - 1);
    if (error) throw error;
    all = all.concat(data || []);
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return all;
};

async function _loadCaseData(silent) {
  const grid = document.getElementById('caseStaffGrid');
  const logBody = document.getElementById('caseLogBody');
  if (!silent || !_caseData.length) {
    if (grid) grid.innerHTML = `<div class="wr-empty"><span class="material-icons animate-spin">sync</span>กำลังโหลด…</div>`;
    if (logBody) logBody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px"><span class="material-icons animate-spin">sync</span></td></tr>`;
  }
  const reqId = window._caseReqId = (window._caseReqId || 0) + 1;
  try {
    const data = await window._caseFetchAll((() => {
      let q = appDB.from('tg_case_logs').select('*').eq('msg_date', _caseDate).order('created_at', {
        ascending: false
      });
      if (_caseSite !== 'ALL') q = q.eq('site', _caseSite);
      if (_caseType !== 'ALL') q = q.eq('case_type', _caseType);
      return q;
    }));
    if (reqId !== window._caseReqId) return;
    _caseData = data || [];
    _renderSummary();
    _renderStaffGrid();
    _renderLogTable();
  } catch (e) {
    if (reqId !== window._caseReqId) return;
    const em = window.escapeHtml(e.message || String(e));
    if (grid) grid.innerHTML = `<div class="wr-empty" style="color:var(--k-red-tx)"><span class="material-icons">error_outline</span>โหลดข้อมูลไม่สำเร็จ: ${em}</div>`;
    if (logBody) logBody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--k-red-tx)">Error: ${em}</td></tr>`;
  }
}

function _caseGroup(d) {
  const t = (d.case_type || '').toLowerCase();
  const msg = (d.message_text || '').toLowerCase();
  const qt = (d.quoted_text || '').toLowerCase();
  const combined = t + ' ' + msg + ' ' + qt;
  if (/เช็คเทิร์|เช็คเทิน|ลบเทิร์|ลบเทิน|ล้างเทิร์|ล้างเทิน|เช็คเทิร|ลบเทิร|ล้างเทิร/.test(combined)) return 'เช็ค';
  if (/ปลดบล็อค|ปลดบล็อก|ปลด/.test(combined)) return 'ปลด';
  return 'other';
}

function _renderSummary() {
  const total = _caseData.length;
  const del = 0;
  const chk = _caseData.filter((d => _caseGroup(d) === 'เช็ค')).length;
  const unb = _caseData.filter((d => _caseGroup(d) === 'ปลด')).length;
  const other = _caseData.filter((d => _caseGroup(d) === 'other')).length;
  document.getElementById('caseTotal').textContent = total.toLocaleString();
  document.getElementById('caseDeleteTurn').textContent = del.toLocaleString();
  document.getElementById('caseCheckTurn').textContent = chk.toLocaleString();
  document.getElementById('caseUnblock').textContent = unb.toLocaleString();
  const otherEl = document.getElementById('caseOther');
  if (otherEl) otherEl.textContent = other.toLocaleString();
  _updateCardActiveStyle();
}

let _activeTypeFilter = 'ALL';

function _updateCardActiveStyle() {
  [ [ 'cardAll', 'ALL' ], [ 'cardChk', 'เช็ค' ], [ 'cardUnb', 'ปลด' ], [ 'cardOther', 'other' ] ].forEach((([id, k]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('on', _activeTypeFilter === k);
    el.classList.toggle('dim', !(_activeTypeFilter === 'ALL' || _activeTypeFilter === k));
  }));
}

window.filterByType = function(type) {
  _activeTypeFilter = _activeTypeFilter === type ? 'ALL' : type;
  _updateCardActiveStyle();
  _renderStaffGrid();
};

function _getShift(name, fullName, shiftMap) {
  if (shiftMap && shiftMap[name]) return shiftMap[name];
  const src = fullName || name || '';
  if (/08.00-20.00|08:00-20:00/i.test(src)) return 'กะเช้า';
  if (/20.00-08.00|20:00-08:00/i.test(src)) return 'กะดึก';
  if (/กะกลาง|12.00-24.00|12:00-00:00/i.test(src)) return 'กะกลาง';
  return 'ไม่ระบุ';
}

let _shiftMap = {};

async function _loadShiftMap() {
  try {
    const data = await window.getUsersCached();
    _shiftMap = {};
    (data || []).forEach((u => {
      if (u.username && u.allowed_shift) {
        _shiftMap[u.username] = u.allowed_shift;
      }
    }));
  } catch (e) {
    console.warn('loadShiftMap:', e);
  }
}

let _activeShiftFilter = 'ALL';

window.filterByShift = function(shift) {
  _activeShiftFilter = _activeShiftFilter === shift ? 'ALL' : shift;
  [ 'ALL', 'กะเช้า', 'กะกลาง', 'กะดึก', 'ไม่ระบุ' ].forEach((s => {
    const el = document.getElementById('shiftBtn-' + s);
    if (el) el.classList.toggle('wr-on', _activeShiftFilter === s);
  }));
  _renderStaffGrid();
};

function _renderStaffGrid() {
  const counts = {};
  _caseData.forEach((d => {
    const k = d.sender_name;
    const t = d.case_type || '';
    const shift = _getShift(k, d.full_name, _shiftMap);
    const matchType = _activeTypeFilter === 'ALL' || _activeTypeFilter === 'ลบ' && t.includes('ลบ') || _activeTypeFilter === 'เช็ค' && _caseGroup(d) === 'เช็ค' || _activeTypeFilter === 'ปลด' && _caseGroup(d) === 'ปลด' || _activeTypeFilter === 'other' && _caseGroup(d) === 'other';
    const matchShift = _activeShiftFilter === 'ALL' || shift === _activeShiftFilter;
    if (!matchType || !matchShift) return;
    if (!counts[k]) counts[k] = {
      total: 0,
      "ลบ": 0,
      "เช็ค": 0,
      "ปลด": 0,
      reply: 0,
      sites: {},
      shift: shift,
      fullName: d.full_name || ''
    };
    counts[k].total++;
    const grp = _caseGroup(d);
    if (grp === 'เช็ค') counts[k].เช็ค++; else if (t.includes('ปลด')) counts[k].ปลด++; else counts[k].reply++;
    const site = d.site || 'OTHER';
    counts[k].sites[site] = (counts[k].sites[site] || 0) + 1;
  }));
  window._staffCounts = counts;
  _renderStaffCards(counts, document.querySelector('input[oninput*="searchStaff"]')?.value || '');
}

function _renderStaffCards(counts, search) {
  const grid = document.getElementById('caseStaffGrid');
  if (!grid) return;
  const sorted = Object.entries(counts).filter((([name]) => !search || name.toLowerCase().includes(search.toLowerCase()))).filter((([, c]) => c.total > 0)).sort(((a, b) => b[1].total - a[1].total));
  if (sorted.length === 0) {
    grid.innerHTML = `<div class="wr-empty"><span class="material-icons">inbox</span>${search ? 'ไม่พบชื่อที่ค้นหา' : 'ยังไม่มีเคสในวันนี้'}</div>`;
    return;
  }
  const max = sorted[0][1].total || 1;
  const esc = window.escapeHtml, escA = window.escapeAttr || window.escapeHtml;
  grid.innerHTML = sorted.map((([name, c], i) => window._caseCardHtml(name, c, i, max, esc, escA, true))).join('');
}

window._caseShiftView = function(shift) {
  const s = String(shift || 'ไม่ระบุ');
  const color = s === 'กะเช้า' ? '#f59e0b' : s === 'กะกลาง' ? '#0ea5e9' : s === 'กะดึก' ? '#818cf8' : '#64748b';
  const icon = s === 'กะเช้า' ? '🌅' : s === 'กะกลาง' ? '☀️' : s === 'กะดึก' ? '🌙' : '❓';
  return {
    color: color,
    label: `${icon} ${s}`
  };
};

window._caseDisplayName = function(name) {
  const m = String(name || '').match(/^[^-]+-([^-]+)-/);
  return m ? m[1] : String(name || '');
};

window._caseCardHtml = function(name, c, i, max, esc, escA, clickable) {
  const pct = Math.round(c.total / max * 100);
  const medals = [ '🥇', '🥈', '🥉' ];
  const sv = window._caseShiftView(c.shift || _getShift(name, c.fullName, _shiftMap));
  const chk = c.เช็ค || 0, unb = c.ปลด || 0, oth = c.reply != null ? c.reply : c.other || 0;
  const tags = [ chk ? `<span class="wr-tag" style="--tc:#10b981">เช็ค/ลบ/ล้าง ${chk}</span>` : '', unb ? `<span class="wr-tag" style="--tc:#f59e0b">ปลด ${unb}</span>` : '', oth ? `<span class="wr-tag" style="--tc:#64748b">อื่นๆ ${oth}</span>` : '' ].filter(Boolean).join('');
  const sites = c.sites ? Object.entries(c.sites).sort(((a, b) => b[1] - a[1])).map((([s, n]) => `<span class="wr-tag" style="--tc:#0ea5e9">${esc(s)} ×${n}</span>`)).join('') : '';
  const disp = c.display || window._caseDisplayName(name);
  return `<div class="${clickable ? 'wr-sc' : 'wr-rk'}${i === 0 && clickable ? ' top' : ''}"${clickable ? ` role="button" tabindex="0" onclick="openStaffDetail(this.dataset.name)" onkeydown="if(event.key==='Enter')openStaffDetail(this.dataset.name)" data-name="${escA(name)}"` : ''}>
    ${clickable ? `<div class="wr-sc-h"><span class="wr-md">${medals[i] || '#' + (i + 1)}</span><span class="wr-nm" title="${escA(name)}">${esc(disp)}</span><span class="wr-num">${c.total}</span></div>
    <span class="wr-sh" style="--sc:${sv.color}">${esc(sv.label)}</span>
    <div class="wr-barx"><i style="width:${pct}%"></i></div>
    <div class="wr-tags">${tags}</div>${sites ? `<div class="wr-tags" style="margin-top:4px">${sites}</div>` : ''}` : `<span class="wr-md">${medals[i] || '#' + (i + 1)}</span>
    <div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:8px;margin-bottom:5px"><span class="wr-nm" style="flex:none;max-width:60%">${esc(disp)}</span><span class="wr-sh" style="--sc:${sv.color};margin:0">${esc(sv.label)}</span></div>
    <div class="wr-barx"><i style="width:${pct}%"></i></div><div class="wr-tags">${tags}</div></div>
    <span class="wr-num">${c.total}</span>`}
  </div>`;
};

window.searchStaff = function(val) {
  _renderStaffCards(window._staffCounts || {}, val);
};

let _myCaseOnly = false;

window.toggleMyCase = function() {
  _myCaseOnly = !_myCaseOnly;
  const btn = document.getElementById('btnMyCase');
  if (btn) btn.classList.toggle('wr-on', _myCaseOnly);
  if (_myCaseOnly) {
    const myName = (window.currentUser || {}).username || '';
    const counts = window._staffCounts || {};
    const matched = Object.keys(counts).find((k => {
      if (k === myName) return true;
      const m = k.match(/^[^-]+-([^-]+)-/);
      return m && m[1].toLowerCase() === myName.toLowerCase();
    }));
    const inp = document.getElementById('staffSearchInput');
    if (inp) inp.value = matched || myName;
    _renderStaffCards(counts, matched || myName);
  } else {
    const inp = document.getElementById('staffSearchInput');
    if (inp) inp.value = '';
    _renderStaffCards(window._staffCounts || {}, '');
  }
};

window.openStaffDetail = function(name) {
  const rows = _caseData.filter((d => d.sender_name === name)).sort(((a, b) => new Date(a.created_at) - new Date(b.created_at)));
  const esc = window.escapeHtml;
  const badge = t => {
    if ((t || '').includes('ลบ')) return `<span style="background:rgba(59,130,246,0.25);color:light-dark(#0352aa,#93c5fd);padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;">${esc(t)}</span>`;
    if ((t || '').includes('เช็ค')) return `<span style="background:rgba(16,185,129,0.25);color:light-dark(#199564,#6ee7b7);padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;">${esc(t)}</span>`;
    if ((t || '').includes('ปลด')) return `<span style="background:rgba(245,158,11,0.25);color:light-dark(#aa8903,#fde68a);padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;">${esc(t)}</span>`;
    return `<span style="background:rgba(100,116,139,0.25);color:var(--k-tx2);padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;">${esc(t || 'reply')}</span>`;
  };
  const html = rows.map(((d, i) => {
    const t = new Date(d.created_at).toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Bangkok'
    });
    const rawMsg = d.message_text || '';
    const isTimestamp = /^\d{4}-\d{2}-\d{2}/.test(rawMsg.trim());
    const myMsg = esc(isTimestamp ? '—' : rawMsg || '—');
    const quotedMsg = esc(d.quoted_text || '');
    const qf = esc(d.quoted_from || '—');
    return `\n        <div style="background:var(--k-panel2);border-radius:10px;padding:12px 14px;border:1px solid var(--k-line);">\n            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">\n                <span style="font-size:11px;color:var(--k-mute);font-weight:700;font-family:monospace;">${i + 1}. ${t}</span>\n                ${badge(d.case_type)}\n                <span style="font-size:11px;color:light-dark(#0676a8,#38bdf8);font-weight:700;">${esc(d.site || '')}</span>\n            </div>\n            ${quotedMsg ? `\n            <div style="background:var(--k-card);border-left:3px solid var(--k-line3);border-radius:6px;padding:8px 10px;margin-bottom:8px;">\n                <div style="font-size:10px;color:var(--k-mute);font-weight:700;margin-bottom:3px;">📌 ข้อความต้นทาง (จาก ${qf})</div>\n                <div style="font-size:12px;color:var(--k-tx3);line-height:1.5;">${quotedMsg}</div>\n            </div>` : ''}\n            <div style="display:flex;align-items:flex-start;gap:8px;">\n                <span style="font-size:11px;color:#7c3aed;font-weight:700;flex-shrink:0;">↩ ตอบ:</span>\n                <div style="font-size:13px;color:var(--k-tx);line-height:1.5;">${myMsg}</div>\n            </div>\n        </div>`;
  })).join('');
  Swal.fire({
    title: `<span style="font-size:16px;">📋 ${esc(name)} — ${rows.length} เคส</span>`,
    html: `<div style="display:flex;flex-direction:column;gap:8px;max-height:420px;overflow-y:auto;text-align:left;">${html}</div>`,
    confirmButtonText: 'ปิด',
    confirmButtonColor: '#7c3aed',
    width: '600px'
  });
};

function _renderLogTable() {
  const tbody = document.getElementById('caseLogBody');
  const total = _caseData.length;
  const el = document.getElementById('caseLogCount');
  if (el) el.textContent = `ทั้งหมด ${total.toLocaleString()} รายการ`;
  const start = (_casePage - 1) * _casePageSize;
  const page = _caseData.slice(start, start + _casePageSize);
  if (page.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--k-mute2)">ไม่มีข้อมูล</td></tr>`;
    _renderPagination(0);
    return;
  }
  const esc = window.escapeHtml, escA = window.escapeAttr;
  const badge = t => {
    const v = t || 'reply';
    const c = v.includes('ลบ') ? '#3b82f6' : v.includes('เช็ค') ? '#10b981' : v.includes('ปลด') ? '#f59e0b' : '#64748b';
    return `<span class="wr-tag" style="--tc:${c}">${esc(v)}</span>`;
  };
  tbody.innerHTML = page.map(((d, i) => {
    const ts = new Date(d.created_at);
    const t = ts.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Asia/Bangkok'
    });
    const rawMsg2 = d.message_text || '';
    const msg = /^\d{4}-\d{2}-\d{2}/.test(rawMsg2.trim()) ? '—' : rawMsg2.slice(0, 60) + (rawMsg2.length > 60 ? '…' : '');
    return `<tr><td style="text-align:center;color:var(--k-mute2);font-size:12px">${start + i + 1}</td><td style="font-family:ui-monospace,monospace;font-size:12px">${t}</td><td style="font-weight:800;color:var(--k-tx-strong)">${esc(window._caseDisplayName(d.sender_name))}</td><td>${badge(d.case_type)}</td><td style="font-weight:800;color:#0ea5e9;font-size:12px">${esc(d.site || '—')}</td><td style="font-size:12px;color:var(--k-mute)">${esc(d.quoted_from || '—')}</td><td style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px" title="${escA(d.message_text || '')}">${esc(msg || '—')}</td></tr>`;
  })).join('');
  _renderPagination(total);
}

function _renderPagination(total) {
  const pages = Math.ceil(total / _casePageSize);
  const el = document.getElementById('casePagination');
  if (!el) return;
  if (pages <= 1) {
    el.innerHTML = '';
    return;
  }
  if (_casePage > pages) _casePage = pages;
  const from = (_casePage - 1) * _casePageSize + 1;
  const to = Math.min(_casePage * _casePageSize, total);
  const nums = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - _casePage) <= 2) nums.push(p); else if (nums[nums.length - 1] !== '…') nums.push('…');
  }
  const b = (lbl, p, on, dis) => `<button type="button" class="wr-pg${on ? ' on' : ''}" ${dis ? 'disabled' : `onclick="window._caseGo(${p})"`}>${lbl}</button>`;
  el.innerHTML = `<span>แสดง ${from}–${to} จาก ${total.toLocaleString()}</span><div style="display:flex;gap:4px;flex-wrap:wrap">${b('‹', _casePage - 1, false, _casePage === 1)}${nums.map((p => p === '…' ? '<span style="padding:0 2px">…</span>' : b(p, p, p === _casePage, false))).join('')}${b('›', _casePage + 1, false, _casePage === pages)}</div>`;
}

window._caseGo = p => {
  _casePage = p;
  _renderLogTable();
};

window._casePrev = () => {
  _casePage--;
  _renderLogTable();
};

window._caseNext = () => {
  _casePage++;
  _renderLogTable();
};
