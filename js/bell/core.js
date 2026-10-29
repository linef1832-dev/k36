window._bellRtSub = window._bellRtSub || null;

window._bellUsers = window._bellUsers || [];

window._bellPresence = window._bellPresence || {};

window._bellSelected = window._bellSelected || new Set;

window._bellSearch = '';

window._bellFilter = 'all';

window._bellRelease = window._bellRelease || null;

window._bellSounds = window._bellSounds || [];

window._bellSound = window._bellSound || null;

window._bellHistory = [];

window._bellHistPeriod = '7';

const BELL_ONLINE_WINDOW_MS = 60 * 1e3;

const BELL_RELEASE_KEY = 'bell_app_release';

const BELL_SOUNDS_KEY = 'bell_sounds';

const BELL_SOUND_KEY = 'bell_sound';

const BELL_BUCKET = 'bell-app';

const BELL_DEFAULT_SOUND = {
  name: '🚨 ไซเรน BIZ Checker (ค่าเริ่มต้น)',
  url: ''
};

function bell_now() {
  return typeof window.serverNow === 'function' ? window.serverNow() : new Date;
}

function bell_uuid() {
  try {
    return crypto.randomUUID();
  } catch (e) {
    return 'r' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }
}

function bell_esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c])));
}

function bell_timeTxt(ts) {
  try {
    return new Date(ts).toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (e) {
    return '';
  }
}

function bell_full(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleString('th-TH');
  } catch (e) {
    return '';
  }
}

function bell_hms(sec) {
  sec = Math.round(Number(sec) || 0);
  const m = Math.floor(sec / 60), s = sec % 60;
  return m ? `${m} นาที ${s} วิ` : `${s} วิ`;
}

function bell_isOnline(p) {
  return !!(p && p.last_seen && bell_now().getTime() - new Date(p.last_seen).getTime() < BELL_ONLINE_WINDOW_MS);
}

function bell_can(id) {
  return typeof window.hasUserPerm !== 'function' ? true : window.hasUserPerm(id);
}

function bell_verCmp(a, b) {
  const pa = String(a || '').replace(/^v/i, '').split('.').map((x => parseInt(x, 10) || 0));
  const pb = String(b || '').replace(/^v/i, '').split('.').map((x => parseInt(x, 10) || 0));
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

function bell_setStatus(msg, kind) {
  const el = document.getElementById('bellStatus');
  if (!el) return;
  const colors = {
    ok: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    warn: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    err: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
  };
  el.className = 'mx-4 mt-3 p-3 rounded-xl text-sm font-bold text-center ' + (colors[kind] || colors.ok);
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(window._bellStatusTimer);
  window._bellStatusTimer = setTimeout((() => el.classList.add('hidden')), 4e3);
}

async function bell_getSetting(key) {
  const {data: data, error: error} = await window.appDB.from('settings').select('value').eq('key', key).maybeSingle();
  if (error) throw error;
  if (!data || !data.value) return null;
  try {
    return JSON.parse(data.value);
  } catch (e) {
    return null;
  }
}

async function bell_setSetting(key, obj) {
  const r = await window.appDB.from('settings').upsert([ {
    key: key,
    value: JSON.stringify(obj)
  } ]);
  if (r.error) throw r.error;
}

window.bell_loadUsers = async function() {
  const {data: data, error: error} = await window.appDB.from('users').select('id, username, team, department, role, allowed_shift').order('username', {
    ascending: true
  });
  if (error) throw error;
  window._bellUsers = data || [];
};

window.bell_loadPresence = async function() {
  const {data: data, error: error} = await window.appDB.from('bell_presence').select('*');
  if (error) throw error;
  const map = {};
  (data || []).forEach((p => {
    map[String(p.user_id)] = p;
  }));
  window._bellPresence = map;
};

window.bell_load = async function() {
  if (!window.appDB) return;
  try {
    await Promise.all([ window.bell_loadUsers(), window.bell_loadPresence(), window.bell_loadShifts(), window.bell_loadRelease() ]);
    if (!window._bellShTimer) window._bellShTimer = setInterval((() => {
      const pg = document.getElementById('bellApp');
      if (document.hidden || !pg || !pg.isConnected || pg.offsetParent === null) return;
      window.bell_loadShifts().then((() => {
        try {
          bell_render();
        } catch (e) {}
      }));
    }), 5 * 60 * 1e3);
    bell_render();
  } catch (e) {
    bell_setStatus('โหลดข้อมูลไม่สำเร็จ: ' + (e.message || e), 'err');
  }
};

window.bell_refreshPresence = async function() {
  if (!window.appDB) return;
  try {
    await window.bell_loadPresence();
    bell_render();
  } catch (e) {}
};

function bell_rows() {
  return window._bellUsers.map((u => {
    const id = String(u.id);
    const p = window._bellPresence[id];
    const online = bell_isOnline(p);
    let st = 'offline';
    if (online) st = p.status === 'ringing' ? 'ringing' : p.status === 'confirmed' ? 'confirmed' : 'online';
    return {
      id: id,
      username: u.username,
      team: u.team || '',
      department: u.department || '',
      role: u.role || '',
      online: online,
      st: st,
      p: p || null
    };
  }));
}

function bell_visibleRows() {
  const q = (window._bellSearch || '').trim().toLowerCase();
  return bell_rows().filter((r => {
    if (window._bellDept && window._bellDept !== 'ALL' && (r.department || '').trim() !== window._bellDept) return false;
    if (window._bellFilter === 'online' && !r.online) return false;
    if (window._bellFilter === 'offline' && r.online) return false;
    if (!q) return true;
    return (r.username || '').toLowerCase().includes(q) || (r.team || '').toLowerCase().includes(q) || (r.department || '').toLowerCase().includes(q);
  })).sort(((a, b) => {
    const rank = r => r.st === 'ringing' ? 0 : r.st === 'confirmed' ? 1 : r.online ? 2 : 3;
    return rank(a) - rank(b) || (a.username || '').localeCompare(b.username || '', 'th');
  }));
}

window.bell_onSearch = function(v) {
  window._bellSearch = v || '';
  bell_render();
};

window.bell_setFilter = function(f) {
  window._bellFilter = f;
  bell_render();
};

const BELL_BADGE = {
  offline: {
    t: '⚫ ยังไม่เปิดแอป',
    c: 'offline'
  },
  online: {
    t: '🟢 เปิดแอปอยู่',
    c: 'online'
  },
  ringing: {
    t: '🔔 รอยืนยัน...',
    c: 'ringing'
  },
  confirmed: {
    t: '✅ ยืนยันแล้ว',
    c: 'confirmed'
  }
};

if (window._bellTick) clearInterval(window._bellTick);

window._bellTick = setInterval((() => {
  if (document.hidden || !document.getElementById('bellList')) return;
  const now = Date.now();
  const fmt = sec => sec < 60 ? sec + ' วิ' : Math.floor(sec / 60) + ' นาที';
  document.querySelectorAll('#bellApp [data-wait-since]').forEach((el => {
    const t = new Date(el.dataset.waitSince).getTime();
    if (!isNaN(t)) el.textContent = (el.dataset.prefix || '') + fmt(Math.max(0, Math.round((now - t) / 1e3)));
  }));
}), 1e3);

const BELL_AV_COLORS = [ '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#14b8a6', '#6366f1', '#f97316', '#0ea5e9' ];

function bell_avColor(name) {
  let h = 0;
  String(name || '').split('').forEach((c => {
    h = h * 31 + c.charCodeAt(0) >>> 0;
  }));
  return BELL_AV_COLORS[h % BELL_AV_COLORS.length];
}

function bell_renderSide(all) {
  const ringing = all.filter((r => r.st === 'ringing')).sort(((a, b) => new Date(a.p && a.p.ring_at || 0) - new Date(b.p && b.p.ring_at || 0)));
  const box = document.getElementById('bellWaitList');
  if (box) box.innerHTML = ringing.length ? ringing.map((r => `<div class="bl-wait"><span class="material-icons" style="font-size:16px;color:#f97316">notifications_active</span><b>${bell_esc(r.username)}</b><span data-wait-since="${bell_esc(r.p && r.p.ring_at || '')}" data-prefix="รอ "></span></div>`)).join('') : '<div class="bl-wait-empty">ยังไม่มีคนที่รอยืนยัน</div>';
  const line = document.getElementById('bellStatLine');
  if (line) {
    const on = all.filter((r => r.online)).length;
    line.innerHTML = `เปิดแอป <b class="on">${on}</b> / ${all.length} คน${ringing.length ? ` · รอยืนยัน <b class="rg">${ringing.length}</b>` : ''}`;
  }
  const bar = document.getElementById('bellSelBar');
  if (bar) bar.style.display = window._bellCanRing ? '' : 'none';
}

window.bell_render = function() {
  const all = bell_rows();
  const setTxt = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  setTxt('bellCountAll', all.length);
  setTxt('bellCountOnline', all.filter((r => r.online)).length);
  setTxt('bellCountOffline', all.filter((r => !r.online)).length);
  setTxt('bellCountWaiting', all.filter((r => r.st === 'ringing')).length);
  setTxt('bellCountConfirmed', all.filter((r => r.st === 'confirmed')).length);
  document.querySelectorAll('#bellFilterBar .bell-fbtn').forEach((b => b.classList.toggle('active', b.dataset.f === window._bellFilter)));
  const onlineIds = new Set(all.filter((r => r.online)).map((r => r.id)));
  [ ...window._bellSelected ].forEach((id => {
    if (!onlineIds.has(id)) window._bellSelected.delete(id);
  }));
  setTxt('bellSelCount', window._bellSelected.size);
  setTxt('bellSelCount2', window._bellSelected.size);
  const sr = document.querySelector('.bell-selring');
  if (sr) sr.disabled = window._bellSelected.size === 0;
  bell_renderGroups(all);
  bell_renderSide(all);
  const list = document.getElementById('bellList');
  if (!list) return;
  const vis = bell_visibleRows();
  if (vis.length === 0) {
    list.innerHTML = `<div class="bl-wait-empty" style="grid-column:1/-1;padding:30px">${window._bellUsers.length ? 'ไม่พบรายชื่อที่ตรงกับการค้นหา' : 'ยังไม่มีพนักงานในระบบ'}</div>`;
    return;
  }
  const relVer = window._bellRelease && window._bellRelease.version;
  list.innerHTML = vis.map((r => {
    const badge = BELL_BADGE[r.st];
    const checked = window._bellSelected.has(r.id) ? 'checked' : '';
    const ver = r.p && r.p.app_version;
    const outdated = ver && relVer && bell_verCmp(relVer, ver) > 0;
    const verBadge = r.online && ver ? `<span class="bell-ver ${outdated ? 'outdated' : ''}">v${bell_esc(ver)}${outdated ? ' ⚠️ ตกรุ่น' : ''}</span>` : '';
    let when = '';
    if (r.p && r.p.ring_at && (r.st === 'ringing' || r.st === 'confirmed')) {
      const rt = `<span class="bw-ring">📣 เรียก ${bell_timeTxt(r.p.ring_at)}</span>`;
      if (r.st === 'confirmed' && r.p.confirmed_at) {
        const sec = Math.max(0, (new Date(r.p.confirmed_at) - new Date(r.p.ring_at)) / 1e3);
        when = `${rt}<span class="bw-ok">✅ ตอบ ${bell_timeTxt(r.p.confirmed_at)}</span><span class="bw-sec">${sec < 60 ? sec.toFixed(1) + ' วิ' : Math.floor(sec / 60) + ' นาที ' + Math.round(sec % 60) + ' วิ'}</span>`;
      } else {
        const sec = Math.max(0, Math.round((Date.now() - new Date(r.p.ring_at)) / 1e3));
        when = `${rt}<span class="bw-wait" data-wait-since="${bell_esc(r.p.ring_at)}" data-prefix="⏳ รอ ">⏳ รอ ${sec < 60 ? sec + ' วิ' : Math.floor(sec / 60) + ' นาที'}</span>`;
      }
    }
    const ringBtn = window._bellCanRing && r.online ? `\n            <button onclick="bell_ringOne('${r.id}')" class="bell-ringbtn"><span class="material-icons" style="font-size:14px">notifications_active</span> เรียก</button>` : '';
    return `\n        <div class="bell-row ${r.online ? '' : 'offline'} ${window._bellSelected.has(r.id) ? 'sel' : ''}" ${r.online ? `onclick="if(!event.target.closest('button'))bell_toggleOne('${r.id}', !window._bellSelected.has('${r.id}'))"` : 'title="ยังไม่เปิดแอป เรียกไม่ได้"'}>\n            <span class="bell-check"></span>\n            <span class="bl-av" style="--av:${bell_avColor(r.username)}">${bell_esc(String(r.username || '?').slice(0, 2).toUpperCase())}<i class="${r.st === 'offline' ? '' : r.st === 'online' ? 'on' : r.st}"></i></span>\n            <div class="flex-1 min-w-0">\n                <div class="bell-name truncate">${bell_esc(r.username)}${bell_shiftOf(r) ? `<span class="bell-shtag">กะ${bell_shiftOf(r)}</span>` : ''} ${verBadge}</div>\n                <div class="bell-sub">${bell_esc(r.team || '-')}${r.department ? ' · ' + bell_esc(r.department) : ''}</div>\n                <div class="bell-when">${when}</div>\n            </div>\n            <span class="bell-badge ${badge.c}">${badge.t}</span>\n            ${ringBtn}\n        </div>`;
  })).join('');
};

window._bellShift = {};

function bell_workDate() {
  const t = new Date;
  if (t.getHours() < 8) t.setDate(t.getDate() - 1);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

function bell_normShift(v) {
  v = String(v || '');
  return /เช้า/.test(v) ? 'เช้า' : /กลาง|บ่าย/.test(v) ? 'กลาง' : /ดึก/.test(v) ? 'ดึก' : '';
}

window.bell_loadShifts = async function() {
  try {
    const {data: data} = await window.appDB.from('schedules').select('staff_name, shift_name').eq('work_date', bell_workDate());
    const m = {};
    (data || []).forEach((r => {
      const sh = bell_normShift(r.shift_name);
      if (sh) m[(r.staff_name || '').toLowerCase().trim()] = sh;
    }));
    window._bellShift = m;
  } catch (e) {
    window._bellShift = {};
  }
};

function bell_shiftOf(r) {
  return window._bellShift[(r.username || '').toLowerCase().trim()] || '';
}

window._bellDept = window._bellDept || 'ALL';

window.bell_setDept = function(d) {
  window._bellDept = d;
  window._bellSelected = new Set;
  const sa = document.getElementById('bellSelectAll');
  if (sa) sa.checked = false;
  bell_render();
};

const bell_inDept = r => !window._bellDept || window._bellDept === 'ALL' || (r.department || '').trim() === window._bellDept;

function bell_renderDept(all) {
  const el = document.getElementById('bellDeptChips');
  if (!el) return;
  const g = {};
  all.forEach((r => {
    const d = (r.department || '').trim();
    if (!d) return;
    const x = g[d] || (g[d] = {
      t: 0,
      on: 0
    });
    x.t++;
    if (r.online) x.on++;
  }));
  const keys = Object.keys(g).sort(((a, b) => a.localeCompare(b, 'th')));
  if (window._bellDept !== 'ALL' && !g[window._bellDept]) window._bellDept = 'ALL';
  const onAll = all.filter((r => r.online)).length;
  el.innerHTML = `<button class="bell-dchip ${window._bellDept === 'ALL' ? 'active' : ''}" onclick="bell_setDept('ALL')">ทุกแผนก<span class="n">${onAll}</span></button>` + keys.map((k => `<button class="bell-dchip ${window._bellDept === k ? 'active' : ''}" onclick="bell_setDept('${bell_esc(k).replace(/'/g, "\\'")}')" title="ออนไลน์ ${g[k].on}/${g[k].t} คน">${bell_esc(k)}<span class="n">${g[k].on}</span></button>`)).join('');
}

function bell_renderGroups(all) {
  bell_renderDept(all);
  all = all.filter(bell_inDept);
  [ 'เช้า', 'กลาง', 'ดึก' ].forEach((sh => {
    const on = all.filter((r => r.online && bell_shiftOf(r) === sh)).length;
    const n = document.getElementById('bellShN_' + sh);
    if (n) n.textContent = on;
    const b = document.querySelector(`.bell-shift[data-s="${sh}"]`);
    if (b) {
      b.disabled = on === 0;
      b.title = on ? `เรียกกะ${sh}ที่เปิดแอป ${on} คน` : `ไม่มีกะ${sh}เปิดแอปอยู่`;
    }
  }));
}

window.bell_ringShift = function(sh) {
  const rows = bell_rows().filter((r => r.online && bell_shiftOf(r) === sh && bell_inDept(r)));
  const dl = window._bellDept && window._bellDept !== 'ALL' ? ` แผนก ${window._bellDept}` : '';
  if (!rows.length) {
    bell_setStatus(`ไม่มีพนักงานกะ${sh}${dl}เปิดแอปอยู่`, 'warn');
    return;
  }
  const go = () => bell_ring(rows);
  if (window.Swal) {
    Swal.fire({
      icon: 'question',
      title: `เรียกกะ${sh}${dl}?`,
      text: `ทั้งหมด ${rows.length} คนที่เปิดแอปอยู่`,
      showCancelButton: true,
      confirmButtonText: '🔔 เรียกเลย',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#f59e0b'
    }).then((r => {
      if (r.isConfirmed) go();
    }));
  } else if (confirm(`เรียกพนักงานกะ${sh}${dl} ทั้งหมด ${rows.length} คน?`)) go();
};

window.bell_toggleOne = function(id, on) {
  if (on) window._bellSelected.add(String(id)); else window._bellSelected.delete(String(id));
  bell_render();
};

window.bell_toggleSelectAll = function(cb) {
  const vis = bell_visibleRows().filter((r => r.online));
  if (cb.checked) vis.forEach((r => window._bellSelected.add(r.id))); else vis.forEach((r => window._bellSelected.delete(r.id)));
  bell_render();
};

window.bell_clearSelection = function() {
  window._bellSelected = new Set;
  const sa = document.getElementById('bellSelectAll');
  if (sa) sa.checked = false;
  bell_render();
};

async function bell_ring(rows) {
  if (!window.appDB) return;
  rows = (rows || []).filter((r => r.online));
  if (rows.length === 0) {
    bell_setStatus('ยังไม่ได้เลือกพนักงานที่เปิดแอปอยู่', 'warn');
    return;
  }
  const nowIso = bell_now().toISOString();
  const rungBy = window.currentUser && window.currentUser.username || 'admin';
  let ok = 0;
  const btn = document.querySelector('.bell-selring');
  if (btn) btn.disabled = true;
  bell_setStatus(`🔔 กำลังเรียก ${rows.length} คน…`, 'warn');
  await Promise.all(rows.map((async r => {
    const token = bell_uuid();
    try {
      const up = await window.appDB.from('bell_presence').update({
        status: 'ringing',
        ring_token: token,
        ring_at: nowIso,
        confirmed_at: null
      }).eq('user_id', r.id).select('user_id');
      if (up.error) throw up.error;
      if (Array.isArray(up.data) && up.data.length === 0) throw new Error('ไม่พบสถานะแอปของ ' + r.username);
      const ins = await window.appDB.from('bell_history').insert([ {
        user_id: r.id,
        username: r.username,
        name: r.username,
        team: r.team,
        ring_token: token,
        rung_by: rungBy,
        ring_at: nowIso,
        status: 'รอยืนยัน'
      } ]);
      if (ins.error) throw ins.error;
      ok++;
    } catch (e) {
      console.error('ring error', r.id, e);
    }
  })));
  bell_setStatus(`🔔 เรียกแล้ว ${ok}/${rows.length} คน`, ok ? 'ok' : 'err');
  window._bellSelected = new Set;
  const sa = document.getElementById('bellSelectAll');
  if (sa) sa.checked = false;
  window.bell_refreshPresence();
}

window.bell_ringSelected = function() {
  const rows = bell_rows().filter((r => window._bellSelected.has(r.id)));
  if (rows.length === 0) {
    bell_setStatus('ติ๊กเลือกพนักงานก่อน แล้วค่อยกดเรียก', 'warn');
    return;
  }
  bell_ring(rows);
};

window.bell_ringOne = function(id) {
  const r = bell_rows().find((x => x.id === String(id)));
  if (r) bell_ring([ r ]);
};

window.bell_subscribe = function() {
  if (!window.appDB) return;
  if (window._bellRtSub) {
    try {
      window.appDB.removeChannel(window._bellRtSub);
    } catch (e) {}
  }
  window._bellRtSub = window.appDB.channel('bell-presence-live').on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'bell_presence'
  }, (function() {
    if (window._currentPageName !== 'bell') return;
    window.bell_refreshPresence();
  })).subscribe();
  if (typeof window.registerPageSubscription === 'function') window.registerPageSubscription(window._bellRtSub);
};

window.bell_openHistory = async function() {
  const m = document.getElementById('bellMainView'), h = document.getElementById('bellHistoryView');
  if (m) m.classList.add('hidden');
  if (h) h.classList.remove('hidden');
  try {
    window.scrollTo(0, 0);
  } catch (e) {}
  await window.bell_loadHistory();
};

window.bell_closeHistory = function() {
  const m = document.getElementById('bellMainView'), h = document.getElementById('bellHistoryView');
  if (h) h.classList.add('hidden');
  if (m) m.classList.remove('hidden');
};

window.bell_loadHistory = async function() {
  if (!window.appDB) return;
  try {
    const {data: data, error: error} = await window.appDB.from('bell_history').select('*').order('ring_at', {
      ascending: false
    }).limit(2e3);
    if (error) throw error;
    window._bellHistory = data || [];
  } catch (e) {
    window._bellHistory = [];
    bell_setStatus('โหลดประวัติไม่สำเร็จ: ' + (e.message || e), 'err');
  }
  bell_renderHistory();
};

window.bell_setHistPeriod = function(p) {
  window._bellHistPeriod = p;
  window._bellHistPage = 1;
  bell_renderHistory();
};

window._bellHistDept = window._bellHistDept || 'ALL';

window._bellHistShift = window._bellHistShift || 'ALL';

window._bellHistPage = 1;

const BELL_HIST_PER = 25;

function bell_histUser(r) {
  const us = window._bellUsers || [];
  return us.find((u => r.user_id != null && String(u.id) === String(r.user_id))) || us.find((u => String(u.username || '').toLowerCase() === String(r.username || r.name || '').toLowerCase())) || null;
}

function bell_histDept(r) {
  const u = bell_histUser(r);
  return u && u.department || '';
}

function bell_histShift(r) {
  const u = bell_histUser(r);
  const sh = String(u && u.allowed_shift || '');
  return sh.replace('กะ', '') || '';
}

window.bell_setHistDept = function(d) {
  window._bellHistDept = d;
  window._bellHistPage = 1;
  bell_renderHistory();
};

window.bell_setHistShift = function(sh) {
  window._bellHistShift = sh;
  window._bellHistPage = 1;
  bell_renderHistory();
};

window.bell_histGoto = function(p) {
  window._bellHistPage = p;
  bell_renderHistory();
  const t = document.getElementById('bellHistBody');
  if (t) t.closest('.bl-card').scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
};

window.bell_onHistSearch = function() {
  window._bellHistPage = 1;
  bell_renderHistory();
};

function bell_histFiltered() {
  const q = ((document.getElementById('bellHistSearch') || {}).value || '').trim().toLowerCase();
  const p = window._bellHistPeriod;
  let since = null;
  const now = bell_now();
  if (p === 'today') {
    since = new Date(now);
    since.setHours(0, 0, 0, 0);
  } else if (p === '7' || p === '30') {
    since = new Date(now.getTime() - parseInt(p, 10) * 864e5);
  }
  const dF = window._bellHistDept, sF = window._bellHistShift;
  return window._bellHistory.filter((r => {
    if (since && new Date(r.ring_at) < since) return false;
    if (dF !== 'ALL' && bell_histDept(r) !== dF) return false;
    if (sF !== 'ALL' && bell_histShift(r) !== sF) return false;
    if (!q) return true;
    return (r.name || r.username || '').toLowerCase().includes(q) || (r.team || '').toLowerCase().includes(q) || (r.rung_by || '').toLowerCase().includes(q);
  }));
}

window.bell_renderHistory = function() {
  document.querySelectorAll('#bellHistPeriod .bell-pbtn').forEach((b => b.classList.toggle('active', b.dataset.p === window._bellHistPeriod)));
  const depts = [ ...new Set(((window._bellHistory || []).map(bell_histDept)).filter(Boolean)) ].sort();
  const dBox = document.getElementById('bellHistDept');
  if (dBox) dBox.innerHTML = [ 'ALL' ].concat(depts).map((d => `<button type="button" data-d="${bell_esc(d)}" onclick="bell_setHistDept(this.dataset.d)" class="bell-pbtn${window._bellHistDept === d ? ' active' : ''}">${d === 'ALL' ? 'ทุกแผนก' : bell_esc(d)}</button>`)).join('');
  document.querySelectorAll('#bellHistShift .bell-pbtn').forEach((b => b.classList.toggle('active', b.dataset.s === window._bellHistShift)));
  const rows = bell_histFiltered();
  const cnt = document.getElementById('bellHistCount');
  const body = document.getElementById('bellHistBody');
  const pag = document.getElementById('bellHistPager');
  if (!body) return;
  if (rows.length === 0) {
    if (cnt) cnt.textContent = '0 รายการ';
    if (pag) pag.innerHTML = '';
    body.innerHTML = '<tr><td colspan="9" class="text-center bell-hist-muted py-8">ไม่มีประวัติในช่วงที่เลือก</td></tr>';
    return;
  }
  const pages = Math.max(1, Math.ceil(rows.length / BELL_HIST_PER));
  window._bellHistPage = Math.min(Math.max(1, window._bellHistPage || 1), pages);
  const pg = window._bellHistPage;
  const pageRows = rows.slice((pg - 1) * BELL_HIST_PER, pg * BELL_HIST_PER);
  if (cnt) cnt.textContent = `${rows.length.toLocaleString('en-US')} รายการ`;
  if (pag) {
    if (pages <= 1) pag.innerHTML = ''; else {
      const nums = [];
      for (let p = 1; p <= pages; p++) {
        if (p === 1 || p === pages || Math.abs(p - pg) <= 2) nums.push(p); else if (nums[nums.length - 1] !== '…') nums.push('…');
      }
      const b = (lbl, p, on, dis) => `<button type="button" class="bl-pg${on ? ' on' : ''}" ${dis ? 'disabled' : `onclick="bell_histGoto(${p})"`}>${lbl}</button>`;
      pag.innerHTML = `<span class="bl-pg-info">หน้า ${pg}/${pages} · แสดง ${(pg - 1) * BELL_HIST_PER + 1}–${(pg - 1) * BELL_HIST_PER + pageRows.length} จาก ${rows.length.toLocaleString('en-US')}</span><div class="bl-pg-btns">${b('‹', pg - 1, false, pg === 1)}${nums.map((p => p === '…' ? '<span class="bl-pg-dots">…</span>' : b(p, p, p === pg, false))).join('')}${b('›', pg + 1, false, pg === pages)}</div>`;
    }
  }
  body.innerHTML = pageRows.map((r => {
    const done = r.status === 'เข้างานแล้ว';
    const dep = bell_histDept(r), sh = bell_histShift(r);
    return `<tr class="bell-hist-row">\n            <td class="font-bold">${bell_esc(r.name || r.username || '')}</td>\n            <td class="text-center bell-hist-muted">${bell_esc(dep || '-')}</td>\n            <td class="text-center bell-hist-muted">${sh ? 'กะ' + bell_esc(sh) : '-'}</td>\n            <td class="text-center bell-hist-muted">${bell_esc(r.team || '-')}</td>\n            <td class="text-center">${bell_esc(bell_full(r.ring_at))}</td>\n            <td class="text-center">${bell_esc(bell_full(r.confirmed_at)) || '-'}</td>\n            <td class="text-center">${r.elapsed_sec != null ? bell_hms(r.elapsed_sec) : '-'}</td>\n            <td class="text-center"><span class="bell-badge ${done ? 'confirmed' : 'ringing'}" style="animation:none">${bell_esc(r.status || '')}</span></td>\n            <td class="text-center bell-hist-muted">${bell_esc(r.rung_by || '')}</td>\n        </tr>`;
  })).join('');
};

window.bell_exportCSV = function() {
  const rows = bell_histFiltered();
  if (rows.length === 0) {
    bell_setStatus('ไม่มีข้อมูลให้ดาวน์โหลด', 'warn');
    return;
  }
  const header = [ 'ชื่อ', 'แผนก', 'กะ', 'ทีม', 'เวลาเรียก', 'เวลายืนยัน', 'ใช้เวลา(วินาที)', 'สถานะ', 'เรียกโดย' ];
  const lines = [ header.join(',') ];
  const cell = c => {
    let v = String(c == null ? '' : c);
    if (/^[=+\-@]/.test(v)) v = "'" + v;
    return `"${v.replace(/"/g, '""')}"`;
  };
  rows.forEach((r => lines.push([ r.name || r.username || '', bell_histDept(r), bell_histShift(r) ? 'กะ' + bell_histShift(r) : '', r.team || '', bell_full(r.ring_at), bell_full(r.confirmed_at), r.elapsed_sec != null ? r.elapsed_sec : '', r.status || '', r.rung_by || '' ].map(cell).join(','))));
  const blob = new Blob([ '\ufeff' + lines.join('\r\n') ], {
    type: 'text/csv;charset=utf-8;'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ประวัติกระดิ่ง_' + (new Date).toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout((() => URL.revokeObjectURL(url)), 1e3);
};

window.bell_loadSounds = async function() {
  if (!window.appDB) return;
  try {
    window._bellSounds = await bell_getSetting(BELL_SOUNDS_KEY) || [];
    window._bellSound = await bell_getSetting(BELL_SOUND_KEY) || BELL_DEFAULT_SOUND;
  } catch (e) {
    window._bellSounds = [];
    window._bellSound = BELL_DEFAULT_SOUND;
  }
  bell_renderSounds();
};

window.bell_renderSounds = function() {
  const cur = window._bellSound || BELL_DEFAULT_SOUND;
  const curEl = document.getElementById('bellSoundCurrent');
  if (curEl) curEl.textContent = 'ใช้อยู่: ' + (cur.name || '-');
  const list = document.getElementById('bellSoundList');
  if (!list) return;
  const all = [ BELL_DEFAULT_SOUND, ...window._bellSounds ];
  list.innerHTML = all.map(((s, i) => {
    const active = (s.url || '') === (cur.url || '');
    return `<div class="bell-sound-row ${active ? 'active' : ''}">\n            <input type="radio" name="bellSoundPick" ${active ? 'checked' : ''} onchange="bell_selectSound(${i})" class="accent-pink-500">\n            <div class="bell-sound-name">${bell_esc(s.name)}</div>\n            ${s.url ? `<button onclick="bell_previewSound('${bell_esc(s.url)}')" class="bell-minibtn">▶ ฟัง</button>\n                       <button onclick="bell_removeSound(${i - 1})" class="bell-minibtn danger" title="ลบออกจากรายการ">✕</button>` : '<span class="bell-sound-hint">เสียงในแอป</span>'}\n        </div>`;
  })).join('');
};

window.bell_previewSound = function(url) {
  try {
    if (window._bellAudio) {
      window._bellAudio.pause();
    }
    window._bellAudio = new Audio(url);
    window._bellAudio.play();
  } catch (e) {}
};

window.bell_selectSound = async function(i) {
  const all = [ BELL_DEFAULT_SOUND, ...window._bellSounds ];
  const s = all[i];
  if (!s) return;
  try {
    await bell_setSetting(BELL_SOUND_KEY, {
      name: s.name,
      url: s.url || '',
      updated_at: bell_now().toISOString()
    });
    window._bellSound = s;
    bell_renderSounds();
    bell_setStatus(`🔊 ตั้งเสียงเตือนเป็น "${s.name}" แล้ว`, 'ok');
  } catch (e) {
    bell_setStatus('บันทึกเสียงไม่สำเร็จ: ' + (e.message || e), 'err');
  }
};

window.bell_removeSound = async function(idx) {
  if (idx < 0 || idx >= window._bellSounds.length) return;
  const removed = window._bellSounds[idx];
  try {
    const latest = (await bell_getSetting(BELL_SOUNDS_KEY) || []).filter((x => x && x.url !== removed.url));
    await bell_setSetting(BELL_SOUNDS_KEY, latest);
    window._bellSounds = latest;
    if (window._bellSound && window._bellSound.url === removed.url) await window.bell_selectSound(0);
    bell_renderSounds();
  } catch (e) {
    bell_setStatus('ลบไม่สำเร็จ: ' + (e.message || e), 'err');
  }
};

window.bell_uploadSound = async function() {
  if (!window.appDB) return;
  const fileEl = document.getElementById('bellSoundFile');
  const file = fileEl && fileEl.files && fileEl.files[0];
  const status = t => {
    const s = document.getElementById('bellSoundStatus');
    if (s) s.textContent = t;
  };
  if (!file) {
    bell_setStatus('กรุณาเลือกไฟล์เสียงก่อน', 'warn');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    bell_setStatus('ไฟล์เสียงต้องไม่เกิน 5 MB', 'warn');
    return;
  }
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (![ 'mp3', 'wav' ].includes(ext)) {
    bell_setStatus('รองรับเฉพาะ .mp3 หรือ .wav', 'warn');
    return;
  }
  try {
    status('⬆️ กำลังอัปโหลด...');
    const base = file.name.replace(/\.[^.]+$/, '').normalize('NFKD').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'sound';
    const path = `sounds/${Date.now()}_${base}.${ext}`;
    const up = await window.appDB.storage.from(BELL_BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: ext === 'mp3' ? 'audio/mpeg' : 'audio/wav'
    });
    if (up.error) throw up.error;
    const {data: pub} = window.appDB.storage.from(BELL_BUCKET).getPublicUrl(path);
    const entry = {
      name: file.name,
      url: pub.publicUrl,
      ext: ext,
      size: file.size,
      added_at: bell_now().toISOString()
    };
    const latest = await bell_getSetting(BELL_SOUNDS_KEY) || [];
    latest.push(entry);
    await bell_setSetting(BELL_SOUNDS_KEY, latest);
    window._bellSounds = latest;
    await window.bell_selectSound(window._bellSounds.length);
    if (fileEl) fileEl.value = '';
    status('');
    bell_setStatus(`✅ อัปโหลด "${file.name}" และตั้งเป็นเสียงเตือนแล้ว`, 'ok');
  } catch (e) {
    status('');
    bell_setStatus('อัปโหลดเสียงไม่สำเร็จ: ' + (e.message || e), 'err');
  }
};

window.bell_loadRelease = async function() {
  if (!window.appDB) return;
  try {
    window._bellRelease = await bell_getSetting(BELL_RELEASE_KEY);
  } catch (e) {
    window._bellRelease = null;
  }
  const el = document.getElementById('bellReleaseInfo');
  if (el) {
    const r = window._bellRelease;
    el.textContent = r && r.version ? `เวอร์ชันล่าสุดที่ปล่อย: v${r.version} (${bell_full(r.updated_at)})` : 'ยังไม่เคยปล่อยเวอร์ชันผ่านหน้านี้';
  }
};

window.initBell = async function() {
  window._bellSelected = new Set;
  window._bellSearch = '';
  window._bellFilter = 'all';
  window._bellDept = 'ALL';
  const si = document.getElementById('bellSearch');
  if (si) si.value = '';
  const sa = document.getElementById('bellSelectAll');
  if (sa) sa.checked = false;
  window.bell_closeHistory();
  window._bellCanRing = bell_can('bell_ring');
  const hide = (elId, show) => {
    const el = document.getElementById(elId);
    if (el) el.style.display = show ? '' : 'none';
  };
  hide('bellRingControls', window._bellCanRing);
  hide('bellSelBar', window._bellCanRing);
  hide('bellBtnHistory', bell_can('bell_history'));
  hide('bellSoundCard', bell_can('bell_sound'));
  await window.bell_loadSounds();
  await window.bell_load();
  window.bell_subscribe();
  if (typeof window.registerPageInterval === 'function') {
    window.registerPageInterval(setInterval((() => {
      if (window._currentPageName === 'bell') window.bell_render();
    }), 5e3));
  }
};
