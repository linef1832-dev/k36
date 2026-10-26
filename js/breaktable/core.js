(function() {
  const TH_MON = [ 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.' ];
  const TH_DAY = [ 'อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์' ];
  const esc = v => window.escapeHtml ? window.escapeHtml(v) : String(v ?? '');
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fmtDate = s => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
    if (!m) return s;
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return `${TH_DAY[d.getDay()]} ${d.getDate()} ${TH_MON[d.getMonth()]} ${d.getFullYear() + 543}`;
  };
  const fmtTime = ts => {
    if (!ts) return '-';
    const d = new Date(ts);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const fmtFull = ts => {
    if (!ts) return '-';
    const d = new Date(ts);
    return `${d.getDate()} ${TH_MON[d.getMonth()]} ${d.getFullYear() + 543} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };
  const SHIFT_ICON = {
    'กะเช้า': '☀️',
    'กะกลาง': '🌤️',
    'กะดึก': '🌙'
  };
  const SHIFT_CODE = {
    'กะเช้า': 'D',
    'กะกลาง': 'M',
    'กะดึก': 'N'
  };
  const AV_COLORS = [ '#2563eb', '#db2777', '#059669', '#d97706', '#7c3aed', '#0891b2', '#dc2626', '#4f46e5', '#b45309', '#0d9488' ];
  const avColor = name => AV_COLORS[[ ...String(name || '') ].reduce(((a, c) => a + c.charCodeAt(0)), 0) % AV_COLORS.length];
  const initials = name => esc(String(name || '?').replace(/[^A-Za-z0-9ก-๙]/g, '').substring(0, 2).toUpperCase() || '?');
  const avatar = (name, size) => `<span class="bt-av" style="width:${size}px;height:${size}px;border-radius:50%;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;font-weight:900;color:var(--k-tx-strong);background:${avColor(name)};font-size:${Math.round(size / 3)}px;border:2px solid var(--k-line);letter-spacing:.3px" title="${esc(name)}">${initials(name)}</span>`;
  let _rows = [];
  let _lastDate = null;
  let _sub = null;
  const $ = id => document.getElementById(id);
  const dateVal = () => $('wDate') && $('wDate').value || iso(new Date);
  function slotList(shiftFilter, deptFilter) {
    const set = new Map;
    const all = window.SHIFT_GROUPS_ALL || {};
    const depts = deptFilter === 'all' ? Object.keys(all) : [ deptFilter ];
    depts.forEach((d => Object.entries(all[d] || {}).forEach((([shift, val]) => {
      if (shiftFilter !== 'all' && shift !== shiftFilter) return;
      const arr = Array.isArray(val) ? val : [].concat(...Object.values(val || {}));
      (arr || []).forEach((sl => {
        if (!set.has(sl)) set.set(sl, new Set);
        set.get(sl).add(shift);
      }));
    }))));
    _rows.forEach((r => {
      if (!r.time_slot) return;
      if (shiftFilter !== 'all' && r.shift_name !== shiftFilter) return;
      if (deptFilter !== 'all' && (r.department || 'AM') !== deptFilter) return;
      if (!set.has(r.time_slot)) set.set(r.time_slot, new Set);
      set.get(r.time_slot).add(r.shift_name);
    }));
    const toMin = s => {
      const m = /^(\d{1,2}):(\d{2})/.exec(s);
      return m ? +m[1] * 60 + +m[2] : 9999;
    };
    return [ ...set.entries() ].sort(((a, b) => toMin(a[0]) - toMin(b[0])));
  }
  function filtered() {
    const dept = $('btDept').value, team = $('btTeam').value, shift = $('btShift').value, q = ($('btSearch').value || '').trim().toLowerCase();
    return _rows.filter((r => (dept === 'all' || (r.department || 'AM') === dept) && (team === 'all' || r.team === team) && (shift === 'all' || r.shift_name === shift) && (!q || String(r.staff_name || '').toLowerCase().includes(q))));
  }
  async function load(force) {
    const d = dateVal();
    if (!force && _lastDate === d) return;
    const {data: data, error: error} = await appDB.from('schedules').select('id, work_date, staff_name, team, shift_name, time_slot, department, created_at').eq('work_date', d);
    if (error) {
      console.error(error);
      if (_lastDate !== d) _rows = [];
    } else _rows = data || [];
    _lastDate = d;
    const u = $('btUpdatedAt');
    if (u) {
      const n = new Date;
      u.textContent = `อัปเดต ${pad(n.getHours())}:${pad(n.getMinutes())}`;
    }
  }
  function currentSlotNow() {
    const t = new Date;
    const logical = new Date(t);
    if (t.getHours() < 8) logical.setDate(logical.getDate() - 1);
    if (dateVal() !== iso(logical)) return null;
    return t.getHours() * 60 + t.getMinutes();
  }
  function slotIsNow(sl, nowMin) {
    if (nowMin === null) return false;
    const m = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/.exec(sl || '');
    if (!m) return false;
    const a = +m[1] * 60 + +m[2], b = +m[3] * 60 + +m[4];
    return a < b ? nowMin >= a && nowMin < b : nowMin >= a || nowMin < b;
  }
  let _btScrolledOnce = false;
  window.btSetShift = function(s) {
    const sel = $('btShift');
    if (!sel || sel.disabled) return;
    sel.value = s;
    btRender();
  };
  function btSyncShiftSeg() {
    const sel = $('btShift');
    if (!sel) return;
    document.querySelectorAll('#btShiftSeg button').forEach((b => {
      b.classList.toggle('on', b.dataset.s === sel.value);
      b.disabled = sel.disabled && b.dataset.s !== sel.value;
    }));
  }
  window.btGoToday = function() {
    const t = new Date;
    if (t.getHours() < 8) t.setDate(t.getDate() - 1);
    $('wDate').value = iso(t);
    _btScrolledOnce = false;
    btRender(true);
  };
  window.btRender = async function(force) {
    if (!$('btGrid')) return;
    btSyncShiftSeg();
    await load(force);
    const d = dateVal();
    const rows = filtered();
    $('btDateTitle').textContent = fmtDate(d);
    const uniqPeople = new Set(rows.map((r => String(r.staff_name || '').toLowerCase()))).size;
    $('btTotal').innerHTML = `ลงแล้ว <b style="color:var(--k-tx-strong)">${uniqPeople}</b> คน · <b style="color:var(--k-tx3)">${rows.length}</b> รายการ`;
    btRenderMissing(rows);
    const exBtn = $('btExportBtn');
    if (exBtn) exBtn.style.display = typeof window.hasUserPerm === 'function' && window.hasUserPerm('breaktable_export') ? 'inline-flex' : 'none';
    const nowMin = currentSlotNow();
    const bySlot = {};
    rows.forEach((r => (bySlot[r.time_slot] = bySlot[r.time_slot] || []).push(r)));
    const slots = slotList($('btShift').value, $('btDept').value);
    if (!slots.length) {
      $('btGrid').innerHTML = `<div style="padding:50px 16px;text-align:center;color:var(--k-mute2);font-weight:700;font-size:13px"><span class="material-icons" style="font-size:44px;opacity:.45;display:block;margin:0 auto 6px;width:auto;height:auto">event_busy</span>ไม่มีช่วงเวลาพักในตัวกรองนี้</div>`;
      return;
    }
    const groups = {};
    slots.forEach((([slot, shifts]) => {
      const key = $('btShift').value !== 'all' ? $('btShift').value : [ ...shifts ][0] || 'อื่นๆ';
      (groups[key] = groups[key] || []).push(slot);
    }));
    Object.keys(groups).forEach((sh => {
      if (typeof window.sortSlotsByShift === 'function') groups[sh] = window.sortSlotsByShift(sh, groups[sh]);
    }));
    const order = [ 'กะเช้า', 'กะกลาง', 'กะดึก' ];
    const html = Object.keys(groups).sort(((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99))).map((shift => {
      const cnt = groups[shift].reduce(((a, sl) => a + (bySlot[sl] || []).length), 0);
      const cards = groups[shift].map((sl => {
        const list = bySlot[sl] || [];
        const isNow = slotIsNow(sl, nowMin);
        const avs = list.slice(0, 3).map((r => avatar(r.staff_name, 28))).join('') + (list.length > 3 ? `<span class="bt-av bt-more" style="width:28px;height:28px;border-radius:50%;font-size:9px;display:inline-flex;align-items:center;justify-content:center;font-weight:900;border:2px solid var(--k-line);margin-left:-8px">+${list.length - 3}</span>` : '');
        return `<div class="bt-card ${list.length ? '' : 'bt-empty'} ${isNow ? 'bt-now' : ''}" onclick="btOpenSlot('${esc(sl)}')">\n                    <div><div class="bt-time">${esc(sl.replace('-', ' – '))}${isNow ? '<span class="bt-now-badge"><span class="bt-now-dot"></span>กำลังพัก</span>' : ''}</div><div class="bt-sub">${list.length ? `จองแล้ว <b style="color:var(--k-tx)">${list.length}</b> คน` : 'ยังไม่มีคนลง'}</div></div>\n                    <div style="display:flex;align-items:center;gap:8px"><div style="display:flex;align-items:center">${avs}</div><span class="bt-eye" title="ดูรายชื่อ"><span class="material-icons" style="font-size:17px">visibility</span></span></div>\n                </div>`;
      })).join('');
      return `<div class="bt-shift-h"><div style="font-weight:800;color:var(--k-tx);font-size:14px">${SHIFT_ICON[shift] || ''} ${esc(shift)}</div><span class="bt-tag">${cnt} รายการ</span></div>\n                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px">${cards}</div>`;
    })).join('');
    $('btGrid').innerHTML = html;
    if (!_btScrolledOnce && nowMin !== null) {
      _btScrolledOnce = true;
      const nowCard = $('btGrid').querySelector('.bt-now');
      if (nowCard) setTimeout((() => nowCard.scrollIntoView({
        block: 'center',
        behavior: 'smooth'
      })), 150);
    }
  };
  function shiftHoursBT(shift) {
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
  function activeShiftsNow() {
    const toM = s => {
      const m = /^(\d{1,2}):(\d{2})/.exec(String(s || ''));
      return m ? +m[1] * 60 + +m[2] : null;
    };
    const n = new Date;
    const nm = n.getHours() * 60 + n.getMinutes();
    return [ 'กะเช้า', 'กะกลาง', 'กะดึก' ].filter((sh => {
      const {open: open, close: close} = shiftHoursBT(sh);
      const o = toM(open), c = toM(close);
      if (o === null || c === null) return false;
      return o <= c ? nm >= o && nm < c : nm >= o || nm < c;
    }));
  }
  let _btLeave = {
    date: null,
    names: new Set
  };
  async function loadLeaveNames(d) {
    if (_btLeave.date === d) return _btLeave.names;
    try {
      const {data: data} = await appDB.from('leave_requests').select('user_name').eq('leave_date', d);
      _btLeave = {
        date: d,
        names: new Set((data || []).map((x => String(x.user_name || '').toLowerCase())))
      };
    } catch (e) {
      _btLeave = {
        date: d,
        names: new Set
      };
    }
    return _btLeave.names;
  }
  let _btMissingList = [];
  async function btMissingCompute() {
    const users = typeof window.getUsersCached === 'function' ? await window.getUsersCached() : window.GLOBAL_USER_LIST || [];
    const onLeave = await loadLeaveNames(dateVal());
    const dept = $('btDept').value, team = $('btTeam').value, shift = $('btShift').value, q = ($('btSearch').value || '').trim().toLowerCase();
    const loggedNames = new Set(_rows.map((r => String(r.staff_name || '').toLowerCase())));
    const act = currentSlotNow() !== null ? activeShiftsNow() : null;
    window._btActiveShifts = act;
    return (users || []).filter((u => {
      if (!u || !u.username) return false;
      if ([ 'admin', 'manager' ].includes(u.role)) return false;
      if ([ 'AMQL', 'ODQL' ].includes(String(u.department || '').toUpperCase())) return false;
      if (onLeave.has(String(u.username).toLowerCase())) return false;
      if (act && u.allowed_shift && !act.includes(u.allowed_shift)) return false;
      if (dept !== 'all' && (u.department || 'AM') !== dept) return false;
      if (team !== 'all' && u.team !== team) return false;
      if (shift !== 'all' && u.allowed_shift && u.allowed_shift !== shift) return false;
      if (q && !String(u.username).toLowerCase().includes(q)) return false;
      return !loggedNames.has(String(u.username).toLowerCase());
    })).sort(((a, b) => String(a.department || '').localeCompare(String(b.department || '')) || String(a.username).localeCompare(String(b.username), 'th')));
  }
  async function btRenderMissing() {
    const el = $('btMissing');
    if (!el) return;
    try {
      _btMissingList = await btMissingCompute();
      el.innerHTML = _btMissingList.length ? `<span class="bt-missing-badge" onclick="btOpenMissing()"><span class="material-icons" style="font-size:14px">notification_important</span> ยังไม่ลงพัก <b>${_btMissingList.length}</b> คน</span>` : `<span style="display:inline-flex;align-items:center;gap:4px;color:var(--k-green-tx);font-size:11.5px;font-weight:800"><span class="material-icons" style="font-size:14px">check_circle</span> ลงพักครบทุกคน</span>`;
    } catch (e) {
      el.innerHTML = '';
    }
  }
  window.btOpenMissing = function() {
    const byDept = {};
    _btMissingList.forEach((u => (byDept[u.department || 'AM'] = byDept[u.department || 'AM'] || []).push(u)));
    const html = Object.keys(byDept).sort().map((dep => `\n            <div style="margin-bottom:12px">\n                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span class="bt-tag" style="background:#1d4ed8;border-color:#3b82f6;color:#fff">${esc(dep)}</span><span style="font-size:11px;color:var(--k-tx3)">${byDept[dep].length} คน</span></div>\n                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:6px">\n                    ${byDept[dep].map((u => `<div style="display:flex;align-items:center;gap:8px;background:var(--k-panel2);border:1px solid var(--k-line);border-radius:10px;padding:7px 10px">${avatar(u.username, 28)}<div style="min-width:0"><div style="color:var(--k-tx);font-weight:700;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(u.username)}</div><div style="color:var(--k-tx3);font-size:10.5px">${esc(u.team || '-')} · ${esc(u.allowed_shift || 'ทุกกะ')}</div></div></div>`)).join('')}\n                </div>\n            </div>`)).join('') || '<div style="padding:20px;text-align:center;color:var(--k-mute)">ลงครบทุกคนแล้ว 🎉</div>';
    Swal.fire({
      title: `<div style="text-align:left;font-size:17px;font-weight:900;color:var(--k-amber-tx)">🔔 ยังไม่ลงพัก ${_btMissingList.length} คน</div><div style="text-align:left;font-size:11.5px;color:var(--k-tx3);font-weight:500">${fmtDate(dateVal())} · ${window._btActiveShifts ? 'เฉพาะกะที่ทำงานอยู่ตอนนี้ (' + window._btActiveShifts.join(', ') + ')' : 'ทุกกะของวันนั้น'} · ไม่นับคนลา/หยุด · ไม่นับหัวหน้า/แอดมิน</div>`,
      html: `<div style="text-align:left;max-height:60vh;overflow-y:auto">${html}</div>`,
      width: 'min(760px, 96vw)',
      background: 'var(--k-panel)',
        color: 'var(--k-tx)',
      showConfirmButton: false,
      showCloseButton: true,
      customClass: {
        popup: 'rounded-2xl'
      }
    });
  };
  let _btExcelLib = null;
  function btLoadExcelLib() {
    if (window.ExcelJS) return Promise.resolve();
    if (_btExcelLib) return _btExcelLib;
    _btExcelLib = new Promise(((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js';
      s.onload = res;
      s.onerror = () => {
        _btExcelLib = null;
        rej(new Error('โหลดตัวสร้าง Excel ไม่สำเร็จ'));
      };
      document.head.appendChild(s);
    }));
    return _btExcelLib;
  }
  window.btExportExcel = async function() {
    try {
      Swal.fire({
        title: 'กำลังสร้างไฟล์ Excel...',
        didOpen: () => Swal.showLoading(),
        background: 'var(--k-panel)',
        color: 'var(--k-tx)'
      });
      await btLoadExcelLib();
      await load(true);
      const d = dateVal();
      const toMin = s => {
        const m = /^(\d{1,2}):(\d{2})/.exec(s || '');
        return m ? +m[1] * 60 + +m[2] : 9999;
      };
      const rows = filtered().slice().sort(((a, b) => toMin(a.time_slot) - toMin(b.time_slot) || String(a.created_at || '').localeCompare(String(b.created_at || ''))));
      const wb = new ExcelJS.Workbook;
      const ws = wb.addWorksheet('ลงเวลาพัก', {
        views: [ {
          state: 'frozen',
          ySplit: 1
        } ]
      });
      ws.columns = [ {
        header: 'ช่วงเวลา',
        key: 'slot',
        width: 15
      }, {
        header: 'ชื่อ',
        key: 'name',
        width: 22
      }, {
        header: 'แผนก',
        key: 'dept',
        width: 10
      }, {
        header: 'เว็บ',
        key: 'team',
        width: 12
      }, {
        header: 'กะ',
        key: 'shift',
        width: 12
      }, {
        header: 'กดลงเมื่อ',
        key: 'at',
        width: 20
      }, {
        header: 'วันทำงาน',
        key: 'wd',
        width: 13
      } ];
      ws.getRow(1).font = {
        bold: true
      };
      ws.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: {
          argb: 'FF1E293B'
        }
      };
      ws.getRow(1).font = {
        bold: true,
        color: {
          argb: 'FFFFFFFF'
        }
      };
      rows.forEach((r => ws.addRow({
        slot: r.time_slot || '-',
        name: r.staff_name || '-',
        dept: r.department || 'AM',
        team: r.team || '-',
        shift: r.shift_name || '-',
        at: fmtFull(r.created_at),
        wd: r.work_date || d
      })));
      ws.addRow({});
      ws.addRow({
        slot: 'รวม',
        name: `${rows.length} คน`
      }).font = {
        bold: true
      };
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([ buf ], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `ลงเวลาพัก_${d}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout((() => URL.revokeObjectURL(a.href)), 2e3);
      Swal.fire({
        icon: 'success',
        title: 'โหลดไฟล์แล้ว',
        text: `ลงเวลาพัก_${d}.xlsx (${rows.length} รายการ ตามตัวกรองที่เลือก)`,
        timer: 1800,
        showConfirmButton: false,
        background: 'var(--k-panel)',
        color: 'var(--k-tx)'
      });
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'สร้างไฟล์ไม่สำเร็จ',
        text: String(e.message || e),
        background: 'var(--k-panel)',
        color: 'var(--k-tx)'
      });
    }
  };
  window.btOpenSlot = function(slot) {
    const isBoss = canPerm('schedule_delete_any');
    const me = (window.currentUser || {}).username;
    let chipKey = 'all';
    const keyOf = r => `${r.department || 'AM'} / ${r.team || '-'}`;
    window._btCurrentSlot = slot;
    const render = () => {
      const all = filtered().filter((r => r.time_slot === slot)).sort(((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || ''))));
      const t = document.querySelector('.swal2-title #btSlotCount');
      if (t) t.textContent = all.length;
      const counts = {};
      all.forEach((r => counts[keyOf(r)] = (counts[keyOf(r)] || 0) + 1));
      const list = chipKey === 'all' ? all : all.filter((r => keyOf(r) === chipKey));
      const chips = `<span class="bt-chip ${chipKey === 'all' ? 'on' : ''}" data-k="all">ทั้งหมด <b>${all.length}</b></span>` + Object.keys(counts).sort().map((k => `<span class="bt-chip ${chipKey === k ? 'on' : ''}" data-k="${esc(k)}">${esc(k)} <b>${counts[k]}</b></span>`)).join('');
      const rows = list.map((r => {
        const canDel = isBoss || r.staff_name === me;
        return `<div class="bt-row" data-id="${r.id}">\n                    <div style="display:flex;align-items:center;gap:10px;min-width:0">${avatar(r.staff_name, 32)}<b style="color:var(--k-tx);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.staff_name)}</b></div>\n                    <div><span class="bt-tag">${esc(r.department || 'AM')}</span></div>\n                    <div><span class="bt-tag">${esc(r.team || '-')}</span></div>\n                    <div style="color:var(--k-tx2);font-size:12px"><b style="background:var(--k-btn-h);padding:1px 6px;border-radius:5px;margin-right:4px">${SHIFT_CODE[r.shift_name] || '-'}</b>${esc(r.shift_name || '-')}</div>\n                    <div style="text-align:right"><div style="color:var(--k-tx);font-weight:700;font-family:monospace;display:flex;align-items:center;justify-content:flex-end;gap:4px"><span class="material-icons" style="font-size:14px;color:var(--k-tx3)">schedule</span>${fmtTime(r.created_at)}</div><div class="bt-toggle" style="font-size:11px;color:var(--k-tx3);cursor:pointer;user-select:none">▸ รายละเอียดรายการ</div></div>\n                    <div style="text-align:center">${canDel ? `<button onclick="event.stopPropagation();btDel(${r.id},'${esc(r.shift_name)}')" title="ลบรายการนี้" style="border:none;background:rgba(239,68,68,.12);color:var(--k-red-tx);width:30px;height:30px;border-radius:8px;cursor:pointer"><span class="material-icons" style="font-size:16px">delete</span></button>` : ''}</div>\n                    <div class="bt-det">ลงเมื่อ <b style="color:var(--k-tx)">${fmtFull(r.created_at)}</b> · ลงโดย <b style="color:var(--k-tx)">${esc(r.staff_name)}</b> · วันทำงาน ${esc(r.work_date)} · รหัสรายการ #${r.id}</div>\n                </div>`;
      })).join('') || `<div style="padding:30px;text-align:center;color:var(--k-mute);font-size:13px">ไม่มีรายชื่อ</div>`;
      const box = document.getElementById('btSlotBox');
      if (!box) return;
      box.innerHTML = `\n                <div style="display:flex;flex-wrap:wrap;gap:6px;padding:10px;background:var(--k-panel2);border:1px solid var(--k-line);border-radius:12px;margin-bottom:10px;align-items:center">\n                    <div style="font-size:11px;color:var(--k-tx3);margin-right:6px;line-height:1.5"><b style="color:var(--k-tx2)">สรุปตามแผนก / เว็บ</b><br>แสดง ${list.length} จาก ${all.length} คน</div>${chips}\n                </div>\n                <div class="bt-row" style="font-size:11px;color:var(--k-tx3);font-weight:800;border-bottom:1px solid var(--k-line2)"><div>ชื่อ</div><div>แผนก</div><div>เว็บ</div><div>กะ</div><div style="text-align:right">เวลาที่ลง</div><div></div></div>\n                <div style="max-height:52vh;overflow-y:auto">${rows}</div>`;
      box.querySelectorAll('.bt-chip').forEach((c => c.onclick = () => {
        chipKey = c.dataset.k;
        render();
      }));
      box.querySelectorAll('.bt-toggle').forEach((t => t.onclick = e => {
        const row = e.target.closest('.bt-row');
        row.classList.toggle('open');
        e.target.textContent = row.classList.contains('open') ? '▾ รายละเอียดรายการ' : '▸ รายละเอียดรายการ';
      }));
    };
    Swal.fire({
      title: `<div style="text-align:left"><div style="font-size:20px;font-weight:900;color:var(--k-tx-strong);font-family:monospace">${esc(slot.replace('-', ' – '))}</div><div style="font-size:12px;color:var(--k-tx3);font-weight:500">${fmtDate(dateVal())} · จองแล้ว <span id="btSlotCount">0</span> คน</div></div>`,
      html: `<div id="btSlotBox" style="text-align:left"></div>`,
      width: 'min(960px, 96vw)',
      background: 'var(--k-panel)',
        color: 'var(--k-tx)',
      showConfirmButton: false,
      showCloseButton: true,
      customClass: {
        popup: 'rounded-2xl',
        htmlContainer: 'm-0 p-0'
      },
      didOpen: render,
      willClose: () => {
        window._btRerenderSlot = null;
        window._btCurrentSlot = null;
      }
    });
    window._btRerenderSlot = render;
  };
  window.btDel = async function(id, shift) {
    if (typeof delSch === 'function') {
      await delSch(id, shift);
    } else {
      const ok = await Swal.fire({
        icon: 'warning',
        title: 'ลบรายการนี้?',
        showCancelButton: true,
        confirmButtonText: 'ลบ',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#dc2626'
      });
      if (!ok.isConfirmed) return;
      const {error: error} = await appDB.from('schedules').delete().eq('id', id);
      if (error) return Swal.fire('ลบไม่สำเร็จ', error.message, 'error');
    }
    await btRender(true);
  };
  window.btShiftDate = function(n) {
    const d = new Date(dateVal() + 'T00:00:00');
    d.setDate(d.getDate() + n);
    $('wDate').value = iso(d);
    btRender(true);
  };
  async function btFillDepts() {
    const ds = $('btDept');
    if (!ds || ds.options.length > 1) return;
    const set = new Set;
    try {
      const users = typeof window.getUsersCached === 'function' ? await window.getUsersCached() : window.GLOBAL_USER_LIST || [];
      (users || []).forEach((u => {
        if (u && u.department) set.add(String(u.department).trim());
      }));
    } catch (e) {}
    _rows.forEach((r => {
      if (r && r.department) set.add(String(r.department).trim());
    }));
    [ ...set ].filter(Boolean).sort().forEach((x => {
      const o = document.createElement('option');
      o.value = x;
      o.textContent = x;
      ds.appendChild(o);
    }));
  }
  window.initBreakTable = async function() {
    if (!$('btGrid')) return;
    const t = new Date;
    if (t.getHours() < 8) t.setDate(t.getDate() - 1);
    if (!$('wDate').value) $('wDate').value = iso(t);
    const ts = $('btTeam');
    if (ts && ts.options.length <= 1 && typeof TEAM_LIST !== 'undefined') [ ...TEAM_LIST ].sort().forEach((x => {
      const o = document.createElement('option');
      o.value = x;
      o.textContent = x;
      ts.appendChild(o);
    }));
    if (typeof window.applyCustomTimeSlots === 'function' && (!window.SHIFT_GROUPS_ALL || !Object.keys(window.SHIFT_GROUPS_ALL.AM || {}).length)) {
      try {
        await window.applyCustomTimeSlots();
      } catch (e) {}
    }
    const me = window.currentUser || {};
    const canAll = canPerm('dashboard_view_all_shifts');
    if (!canAll && [ 'กะเช้า', 'กะกลาง', 'กะดึก' ].includes(me.allowed_shift)) {
      $('btShift').value = me.allowed_shift;
      $('btShift').disabled = true;
    }
    btSyncShiftSeg();
    _btScrolledOnce = false;
    await btRender(true);
    await btFillDepts();
    if (window._btNowTimer) clearInterval(window._btNowTimer);
    window._btNowTimer = setInterval((() => {
      if (!$('btGrid')) {
        clearInterval(window._btNowTimer);
        window._btNowTimer = null;
        return;
      }
      if (!document.hidden) btRender();
    }), 6e4);
    if (!window._btVisBound) {
      window._btVisBound = true;
      document.addEventListener('visibilitychange', (() => {
        if (!document.hidden && window._btStale && $('btGrid')) {
          window._btStale = false;
          btRender(true);
        }
      }));
    }
    if (_sub) {
      try {
        appDB.removeChannel(_sub);
      } catch (e) {}
    }
    let timer = null;
    _sub = appDB.channel('breaktable-live').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'schedules'
    }, (payload => {
      const row = payload.new && payload.new.work_date ? payload.new : payload.old || {};
      const d = dateVal();
      if (row.work_date && row.work_date !== d) return;
      if (!row.work_date && row.id != null && !_rows.some((r => String(r.id) === String(row.id)))) return;
      if (document.hidden) {
        window._btStale = true;
        return;
      }
      clearTimeout(timer);
      timer = setTimeout((async () => {
        await btRender(true);
        if (Swal.isVisible() && window._btRerenderSlot) window._btRerenderSlot();
      }), 300);
    })).subscribe();
    if (typeof window.registerPageSubscription === 'function') window.registerPageSubscription(_sub);
  };
})();
