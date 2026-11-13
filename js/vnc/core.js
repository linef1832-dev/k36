(function() {
  // ============================================================
  // ควบคุมเซิร์ฟเวอร์ (VNC) — ใช้ noVNC ต่อ websockify บนเซิร์ฟเวอร์
  // รายการเซิร์ฟเวอร์เก็บใน settings key 'vnc_servers' (ไม่เก็บรหัสผ่านในฐานข้อมูล)
  // ============================================================
  const SETTINGS_KEY = 'vnc_servers';
  const NOVNC_URL = 'https://cdn.jsdelivr.net/gh/novnc/noVNC@v1.5.0/core/rfb.js';
  const PW_PREFIX = 'vnc_pw_';

  let servers = [];
  let RFB = null;
  let rfb = null;
  let current = null;
  let userClosed = false;
  let lastRemoteClip = '';
  const statusCache = {};
  const view = {
    viewOnly: false,
    scale: 'fit',
    quality: 6
  };

  const $ = id => document.getElementById(id);
  const esc = v => window.escapeHtml ? window.escapeHtml(v) : String(v == null ? '' : v);
  const can = id => typeof window.hasUserPerm === 'function' && window.hasUserPerm(id);
  const canControl = () => can('vnc_control');
  const canManage = () => can('vnc_manage');
  const log = (a, d) => {
    try {
      if (typeof logAction === 'function') logAction(a, d);
    } catch (e) {}
  };

  // ---------- data ----------
  function normalize(v) {
    const arr = Array.isArray(v) ? v : [];
    return arr.filter(x => x && x.id && x.url).map(x => ({
      id: String(x.id),
      name: String(x.name || 'ไม่มีชื่อ'),
      url: String(x.url),
      note: String(x.note || '')
    }));
  }

  async function loadData() {
    try {
      const {data, error} = await appDB.from('settings').select('value').eq('key', SETTINGS_KEY).maybeSingle();
      if (error) throw error;
      let v = data && data.value;
      if (typeof v === 'string') v = JSON.parse(v);
      servers = normalize(v);
      return true;
    } catch (e) {
      console.error('โหลด vnc_servers:', e);
      return false;
    }
  }

  async function saveData() {
    const {error} = await appDB.from('settings').upsert([ {
      key: SETTINGS_KEY,
      value: JSON.stringify(servers)
    } ]);
    if (error) {
      Swal.fire('บันทึกไม่สำเร็จ', error.message, 'error');
      return false;
    }
    return true;
  }

  // โหลดค่าล่าสุดก่อนแก้ทุกครั้ง กันแอดมิน 2 คนเขียนทับกัน
  async function mutate(fn) {
    if (!await loadData()) {
      Swal.fire('โหลดข้อมูลไม่สำเร็จ', 'ลองใหม่อีกครั้ง', 'error');
      return false;
    }
    const backup = JSON.parse(JSON.stringify(servers));
    fn(servers);
    if (await saveData()) {
      renderList();
      return true;
    }
    servers = backup;
    renderList();
    return false;
  }

  function validUrl(u) {
    if (!/^wss?:\/\/[^\s/]+/i.test(u)) return 'URL ต้องขึ้นต้นด้วย wss://';
    if (location.protocol === 'https:' && /^ws:\/\//i.test(u)) return 'เว็บนี้เป็น https ต้องใช้ wss:// เท่านั้น (ws:// จะถูกเบราว์เซอร์บล็อก)';
    return '';
  }

  // ---------- status check (เปิด websocket แล้วปิดทันที) ----------
  function probe(url) {
    return new Promise(resolve => {
      let done = false;
      let ws;
      const finish = ok => {
        if (done) return;
        done = true;
        try {
          ws && ws.close();
        } catch (e) {}
        resolve(ok);
      };
      try {
        ws = new WebSocket(url, [ 'binary' ]);
      } catch (e) {
        return resolve(false);
      }
      ws.onopen = () => finish(true);
      ws.onerror = () => finish(false);
      setTimeout(() => finish(false), 6000);
    });
  }

  function paintStatus(id) {
    const el = $('vncSt_' + id);
    if (!el) return;
    const s = statusCache[id];
    el.className = 'vn-dot' + (s === true ? ' ok' : s === false ? ' bad' : '');
    el.innerHTML = '<i></i>' + (s === true ? 'ออนไลน์' : s === false ? 'ติดต่อไม่ได้' : 'กำลังตรวจ...');
  }

  window.vncRefreshList = async function() {
    if (!await loadData()) return;
    renderList();
    servers.forEach(s => {
      statusCache[s.id] = undefined;
      paintStatus(s.id);
      probe(s.url).then(ok => {
        statusCache[s.id] = ok;
        paintStatus(s.id);
      });
    });
  };

  // ---------- list ----------
  function hostOf(u) {
    try {
      return new URL(u.replace(/^ws/i, 'http')).host;
    } catch (e) {
      return u;
    }
  }

  function renderList() {
    const box = $('vncList');
    if (!box) return;
    const addBtn = $('vncAddBtn');
    if (addBtn) addBtn.classList.toggle('hidden', !canManage());
    if (!servers.length) {
      box.innerHTML = `<div class="vn-empty" style="grid-column:1/-1">
          <span class="material-icons" style="font-size:40px;display:block;margin-bottom:6px">dns</span>
          ยังไม่มีเซิร์ฟเวอร์${canManage() ? ' — กด "เพิ่มเซิร์ฟเวอร์" ด้านบน' : ''}
        </div>`;
      return;
    }
    const manage = canManage();
    box.innerHTML = servers.map(s => {
      const id = esc(s.id);
      return `<div class="vn-card">
        <div class="vn-card-h">
          <div class="vn-card-ic"><span class="material-icons">dns</span></div>
          <div style="min-width:0">
            <div class="vn-card-n">${esc(s.name)}</div>
            <div class="vn-card-u">${esc(hostOf(s.url))}</div>
          </div>
          <span class="vn-dot" id="vncSt_${id}"><i></i>กำลังตรวจ...</span>
        </div>
        ${s.note ? `<div class="vn-card-note">${esc(s.note)}</div>` : ''}
        <div class="vn-card-f">
          <button class="vn-btn pri sm" onclick="vncConnect('${id}')"><span class="material-icons">login</span>เข้าควบคุม</button>
          ${localHasPw(s.id) ? `<button class="vn-btn sm" onclick="vncForgetPw('${id}')" title="ลบรหัสที่จำไว้ในเครื่องนี้"><span class="material-icons">key_off</span></button>` : ''}
          ${manage ? `<button class="vn-btn sm" onclick="vncEditServer('${id}')"><span class="material-icons">edit</span>แก้ไข</button>
          <button class="vn-btn sm dng" onclick="vncDeleteServer('${id}')"><span class="material-icons">delete</span></button>` : ''}
        </div>
      </div>`;
    }).join('');
    servers.forEach(s => paintStatus(s.id));
  }

  // ---------- add / edit / delete ----------
  window.vncEditServer = async function(id) {
    if (!canManage()) return;
    const cur = id ? servers.find(x => x.id === id) : null;
    const {value} = await Swal.fire({
      title: cur ? 'แก้ไขเซิร์ฟเวอร์' : 'เพิ่มเซิร์ฟเวอร์',
      html: `<div style="display:flex;flex-direction:column;gap:8px;text-align:left">
          <label style="font-size:12px;font-weight:700">ชื่อเรียก</label>
          <input id="vncFName" class="swal2-input" style="margin:0" placeholder="เช่น VPS บอท 1" value="${esc(cur ? cur.name : '')}">
          <label style="font-size:12px;font-weight:700">WebSocket URL</label>
          <input id="vncFUrl" class="swal2-input" style="margin:0;font-family:monospace;font-size:14px" placeholder="wss://vnc1.example.com" value="${esc(cur ? cur.url : '')}">
          <label style="font-size:12px;font-weight:700">หมายเหตุ (ไม่บังคับ)</label>
          <input id="vncFNote" class="swal2-input" style="margin:0" placeholder="ใช้ทำอะไร" value="${esc(cur ? cur.note : '')}">
          <div style="font-size:11.5px;opacity:.7">ไม่ต้องใส่รหัสผ่านตรงนี้ ระบบจะถามตอนกดเข้าควบคุม และไม่เก็บลงฐานข้อมูล</div>
        </div>`,
      showCancelButton: true,
      confirmButtonText: 'บันทึก',
      cancelButtonText: 'ยกเลิก',
      focusConfirm: false,
      preConfirm: () => {
        const name = $('vncFName').value.trim();
        const url = $('vncFUrl').value.trim();
        const note = $('vncFNote').value.trim();
        if (!name) return Swal.showValidationMessage('ใส่ชื่อเรียก');
        const err = validUrl(url);
        if (err) return Swal.showValidationMessage(err);
        return {name, url, note};
      }
    });
    if (!value) return;
    const ok = await mutate(list => {
      if (cur) {
        const t = list.find(x => x.id === cur.id);
        if (t) Object.assign(t, value);
        else list.push(Object.assign({id: cur.id}, value));
      } else {
        list.push(Object.assign({id: 'v' + Date.now().toString(36)}, value));
      }
    });
    if (ok) {
      log(cur ? 'VNC_EDIT' : 'VNC_ADD', `${value.name} (${hostOf(value.url)})`);
      window.vncRefreshList();
    }
  };

  window.vncDeleteServer = async function(id) {
    if (!canManage()) return;
    const cur = servers.find(x => x.id === id);
    if (!cur) return;
    const r = await Swal.fire({
      icon: 'warning',
      title: 'ลบเซิร์ฟเวอร์นี้?',
      text: cur.name,
      showCancelButton: true,
      confirmButtonText: 'ลบ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#dc2626'
    });
    if (!r.isConfirmed) return;
    if (await mutate(list => {
      const i = list.findIndex(x => x.id === id);
      if (i >= 0) list.splice(i, 1);
    })) {
      log('VNC_DELETE', cur.name);
      try {
        localStorage.removeItem(PW_PREFIX + id);
      } catch (e) {}
    }
  };

  // ---------- local password memory (เฉพาะเบราว์เซอร์นี้) ----------
  function localHasPw(id) {
    try {
      return !!localStorage.getItem(PW_PREFIX + id);
    } catch (e) {
      return false;
    }
  }

  window.vncForgetPw = function(id) {
    try {
      localStorage.removeItem(PW_PREFIX + id);
    } catch (e) {}
    renderList();
    if (window.Swal) Swal.fire({icon: 'success', title: 'ลบรหัสที่จำไว้แล้ว', timer: 1100, showConfirmButton: false});
  };

  async function askPassword(server) {
    const {value} = await Swal.fire({
      title: 'รหัส VNC',
      html: `<div style="font-size:13px;margin-bottom:8px">${esc(server.name)}</div>
        <input id="vncPw" type="password" class="swal2-input" style="margin:0" autocomplete="off" placeholder="รหัสผ่าน VNC">
        <label style="display:flex;align-items:center;gap:8px;justify-content:center;margin-top:12px;font-size:13px">
          <input id="vncPwRemember" type="checkbox"> จำรหัสในเบราว์เซอร์นี้
        </label>`,
      showCancelButton: true,
      confirmButtonText: 'เชื่อมต่อ',
      cancelButtonText: 'ยกเลิก',
      focusConfirm: false,
      didOpen: () => {
        const i = $('vncPw');
        if (i) {
          i.focus();
          i.addEventListener('keydown', e => {
            if (e.key === 'Enter') Swal.clickConfirm();
          });
        }
      },
      preConfirm: () => {
        const pw = $('vncPw').value;
        if (!pw) return Swal.showValidationMessage('ใส่รหัสผ่าน');
        return {pw, remember: $('vncPwRemember').checked};
      }
    });
    if (!value) return null;
    if (value.remember) {
      try {
        localStorage.setItem(PW_PREFIX + server.id, value.pw);
      } catch (e) {}
    }
    return value.pw;
  }

  // ---------- noVNC ----------
  async function loadRFB() {
    if (RFB) return RFB;
    const mod = await import(NOVNC_URL);
    RFB = mod.default;
    return RFB;
  }

  function setOverlay(text, spin) {
    const o = $('vncOverlay');
    if (!o) return;
    if (text == null) {
      o.style.display = 'none';
      return;
    }
    o.style.display = 'flex';
    o.innerHTML = (spin ? '<div class="vn-spin"></div>' : '<span class="material-icons" style="font-size:36px;color:#f87171">link_off</span>') +
      `<div>${esc(text)}</div>`;
  }

  function setViewerStatus(kind, text) {
    const el = $('vncViewerStatus');
    if (!el) return;
    el.className = 'vn-dot' + (kind ? ' ' + kind : '');
    el.innerHTML = '<i></i>' + esc(text);
  }

  function showViewer(on) {
    const v = $('vncViewer');
    const list = $('vncList');
    const head = $('vncHeadBtns');
    if (v) {
      v.classList.toggle('hidden', !on);
      v.style.display = on ? 'flex' : 'none';
    }
    if (list) list.style.display = on ? 'none' : '';
    if (head) head.style.display = on ? 'none' : '';
  }

  function clearScreen() {
    const sc = $('vncScreen');
    if (!sc) return;
    Array.from(sc.children).forEach(c => {
      if (c.id !== 'vncOverlay') c.remove();
    });
  }

  function applyView() {
    const ctrl = canControl();
    if (!ctrl) view.viewOnly = true;
    const vb = $('vncViewOnlyBtn');
    if (vb) {
      vb.classList.toggle('on', view.viewOnly);
      vb.disabled = !ctrl;
      vb.title = ctrl ? 'สลับโหมดดูอย่างเดียว' : 'คุณมีสิทธิ์ดูอย่างเดียว';
    }
    const badge = $('vncViewOnlyBadge');
    if (badge) badge.classList.toggle('hidden', !view.viewOnly);
    [ 'vncCadBtn', 'vncClipBtn' ].forEach(id => {
      const b = $(id);
      if (b) b.disabled = view.viewOnly;
    });
    const ss = $('vncScaleSel');
    if (ss) ss.value = view.scale;
    const qs = $('vncQualitySel');
    if (qs) qs.value = String(view.quality);
    if (!rfb) return;
    rfb.viewOnly = view.viewOnly;
    rfb.scaleViewport = view.scale === 'fit';
    rfb.clipViewport = view.scale === 'real';
    rfb.resizeSession = view.scale === 'remote';
    rfb.qualityLevel = view.quality;
    rfb.compressionLevel = view.quality <= 2 ? 9 : 2;
  }

  window.vncConnect = async function(id) {
    const server = servers.find(x => x.id === id);
    if (!server) return;
    if (rfb) closeRfb(true);

    let pw = null;
    try {
      pw = localStorage.getItem(PW_PREFIX + id);
    } catch (e) {}
    if (!pw) pw = await askPassword(server);
    if (!pw) return;

    current = server;
    userClosed = false;
    lastRemoteClip = '';
    view.viewOnly = !canControl();
    showViewer(true);
    clearScreen();
    $('vncViewerName').textContent = server.name;
    setViewerStatus('', 'กำลังเชื่อมต่อ');
    setOverlay('กำลังโหลดตัวเชื่อมต่อ...', true);

    try {
      await loadRFB();
    } catch (e) {
      console.error(e);
      setOverlay('โหลด noVNC ไม่สำเร็จ (เช็กอินเทอร์เน็ต)', false);
      setViewerStatus('bad', 'ล้มเหลว');
      return;
    }
    if (!current || current.id !== id) return;

    setOverlay('กำลังเชื่อมต่อ ' + hostOf(server.url) + ' ...', true);
    let r;
    try {
      r = new RFB($('vncScreen'), server.url, {
        credentials: {password: pw},
        shared: true
      });
    } catch (e) {
      setOverlay('URL ไม่ถูกต้อง: ' + e.message, false);
      setViewerStatus('bad', 'ล้มเหลว');
      return;
    }
    rfb = r;
    r.background = '#000';
    r.focusOnClick = true;
    applyView();

    r.addEventListener('connect', () => {
      if (rfb !== r) return;
      setOverlay(null);
      setViewerStatus('ok', 'เชื่อมต่อแล้ว');
      applyView();
      r.focus();
      log('VNC_CONNECT', `${server.name} (${hostOf(server.url)})${view.viewOnly ? ' [ดูอย่างเดียว]' : ''}`);
    });
    r.addEventListener('credentialsrequired', () => {
      // รหัสที่จำไว้ผิด/เซิร์ฟเวอร์ขอใหม่
      try {
        localStorage.removeItem(PW_PREFIX + id);
      } catch (e) {}
      askPassword(server).then(p => {
        if (!p || rfb !== r) return closeRfb(true);
        r.sendCredentials({password: p});
      });
    });
    r.addEventListener('securityfailure', e => {
      if (rfb !== r) return;
      try {
        localStorage.removeItem(PW_PREFIX + id);
      } catch (er) {}
      userClosed = true;
      setOverlay('รหัสผ่านไม่ถูกต้อง' + (e.detail && e.detail.reason ? ' — ' + e.detail.reason : ''), false);
      setViewerStatus('bad', 'รหัสผิด');
      log('VNC_AUTH_FAIL', server.name);
    });
    r.addEventListener('disconnect', e => {
      if (rfb !== r) return;
      rfb = null;
      log('VNC_DISCONNECT', server.name);
      if (userClosed) {
        if ($('vncOverlay') && $('vncOverlay').style.display !== 'none') return; // แสดงข้อความ error ค้างไว้
        backToList();
        return;
      }
      setOverlay(e.detail && e.detail.clean ? 'เซิร์ฟเวอร์ปิดการเชื่อมต่อ' : 'การเชื่อมต่อหลุด / ติดต่อเซิร์ฟเวอร์ไม่ได้', false);
      setViewerStatus('bad', 'หลุด');
    });
    r.addEventListener('clipboard', e => {
      lastRemoteClip = (e.detail && e.detail.text) || '';
    });
    r.addEventListener('desktopname', e => {
      if (e.detail && e.detail.name) $('vncScreen').title = e.detail.name;
    });
  };

  function closeRfb(silent) {
    userClosed = true;
    const r = rfb;
    rfb = null;
    if (r) {
      try {
        r.disconnect();
      } catch (e) {}
      if (current) log('VNC_DISCONNECT', current.name);
    }
    if (silent) backToList();
  }

  function backToList() {
    if (document.fullscreenElement) {
      try {
        document.exitFullscreen();
      } catch (e) {}
    }
    clearScreen();
    setOverlay('กำลังเชื่อมต่อ...', true);
    showViewer(false);
    current = null;
    renderList();
  }

  window.vncDisconnect = function() {
    closeRfb(true);
  };

  // ---------- toolbar ----------
  window.vncToggleViewOnly = function() {
    if (!canControl()) return;
    view.viewOnly = !view.viewOnly;
    applyView();
  };

  window.vncSetScale = function(v) {
    view.scale = v;
    applyView();
  };

  window.vncSetQuality = function(v) {
    view.quality = parseInt(v, 10) || 6;
    applyView();
  };

  window.vncCtrlAltDel = async function() {
    if (!rfb || view.viewOnly) return;
    const r = await Swal.fire({
      icon: 'question',
      title: 'ส่ง Ctrl+Alt+Del?',
      text: 'บน Linux บางระบบจะเป็นการรีบูตเครื่อง',
      showCancelButton: true,
      confirmButtonText: 'ส่ง',
      cancelButtonText: 'ยกเลิก'
    });
    if (r.isConfirmed && rfb) {
      rfb.sendCtrlAltDel();
      log('VNC_CAD', current ? current.name : '');
    }
  };

  window.vncClipboard = async function() {
    if (!rfb || view.viewOnly) return;
    const res = await Swal.fire({
      title: 'คลิปบอร์ด',
      html: `<div style="text-align:left;font-size:12px;font-weight:700;margin-bottom:4px">ข้อความที่คัดลอกจากเซิร์ฟเวอร์ล่าสุด</div>
        <textarea id="vncClipRemote" class="swal2-textarea" style="margin:0 0 12px;width:100%;height:80px;font-family:monospace;font-size:12px" readonly>${esc(lastRemoteClip)}</textarea>
        <div style="text-align:left;font-size:12px;font-weight:700;margin-bottom:4px">ส่งข้อความไปเซิร์ฟเวอร์ (แล้วกด Ctrl+V ในจอ)</div>
        <textarea id="vncClipSend" class="swal2-textarea" style="margin:0;width:100%;height:100px;font-family:monospace;font-size:12px" placeholder="วางข้อความที่นี่"></textarea>`,
      showCancelButton: true,
      showDenyButton: !!lastRemoteClip,
      confirmButtonText: 'ส่งไปเซิร์ฟเวอร์',
      denyButtonText: 'คัดลอกของเซิร์ฟเวอร์',
      cancelButtonText: 'ปิด',
      preConfirm: () => $('vncClipSend').value
    });
    if (res.isConfirmed && rfb && res.value) {
      rfb.clipboardPasteFrom(res.value);
      rfb.focus();
    } else if (res.isDenied) {
      try {
        await navigator.clipboard.writeText(lastRemoteClip);
        Swal.fire({icon: 'success', title: 'คัดลอกแล้ว', timer: 900, showConfirmButton: false});
      } catch (e) {
        Swal.fire('คัดลอกไม่ได้', 'เบราว์เซอร์ไม่อนุญาต', 'error');
      }
    }
  };

  window.vncFullscreen = function() {
    const v = $('vncViewer');
    if (!v) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else if (v.requestFullscreen) v.requestFullscreen().then(() => rfb && rfb.focus()).catch(() => {});
  };

  // ---------- init ----------
  window.initVncApp = async function() {
    const app = $('vncApp');
    const noPerm = $('vncNoPerm');
    const head = $('vncHeadBtns');
    if (!can('vnc')) {
      if (noPerm) noPerm.classList.remove('hidden');
      if (app) {
        app.classList.add('hidden');
        app.style.display = 'none';
      }
      if (head) head.style.display = 'none';
      return;
    }
    if (noPerm) noPerm.classList.add('hidden');
    if (app) {
      app.classList.remove('hidden');
      app.style.display = 'flex';
    }
    // เริ่มใหม่ทุกครั้ง (หน้าอาจถูกกู้จาก snapshot)
    if (rfb) closeRfb(false);
    current = null;
    showViewer(false);
    clearScreen();
    // ออกจากหน้านี้ = ตัดการเชื่อมต่อ
    window._pageLeaveHook = function() {
      if (rfb) closeRfb(true);
    };
    await window.vncRefreshList();
  };

  window.addEventListener('beforeunload', () => {
    if (rfb) {
      try {
        rfb.disconnect();
      } catch (e) {}
    }
  });
})();
