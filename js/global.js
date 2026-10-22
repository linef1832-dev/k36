const DB_URL = 'https://evuzlihhbicmuvpjwwln.supabase.co';

window._srvOffset = 0;

window._srvSyncedAt = 0;

window.syncServerTime = async function(force) {
  try {
    if (!force && Date.now() - window._srvSyncedAt < 5 * 60 * 1e3) return;
    const res = await fetch(DB_URL + '/rest/v1/', {
      method: 'HEAD',
      headers: {
        apikey: DB_KEY,
        Authorization: 'Bearer ' + DB_KEY
      },
      cache: 'no-store'
    });
    const hdr = res.headers.get('date');
    if (hdr) {
      const srv = new Date(hdr).getTime() + 500;
      window._srvOffset = srv - Date.now();
      window._srvSyncedAt = Date.now();
    }
  } catch (e) {}
};

window.serverNow = function() {
  return new Date(Date.now() + (window._srvOffset || 0));
};

const DB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2dXpsaWhoYmljbXV2cGp3d2xuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1Nzk0OTIsImV4cCI6MjEwNDE1NTQ5Mn0.QZdqTS3c9rsMBdRVyakqAPYwQULhzff7hBrvM3zqAUA';

window.canPerm = function(permId) {
  return typeof window.hasUserPerm === 'function' && window.hasUserPerm(permId);
};

let appDB;

let currentUser = {};

let TEAM_LIST = [ 'Jun88', 'MK8', 'F168', 'PG688', 'JL69', 'NM9', 'VV72', 'TH26', 'BT678', 'K188' ];

let GLOBAL_USER_LIST = [];

Object.defineProperty(window, 'currentUser', {
  get: function() {
    return currentUser;
  },
  set: function(v) {
    currentUser = v;
  },
  configurable: true,
  enumerable: true
});

Object.defineProperty(window, 'GLOBAL_USER_LIST', {
  get: function() {
    return GLOBAL_USER_LIST;
  },
  set: function(v) {
    GLOBAL_USER_LIST = v;
  },
  configurable: true,
  enumerable: true
});

window.safeSetItem = function(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn('[safeSetItem] localStorage error:', e);
  }
};

window.safeGetItem = function(key, fallback) {
  try {
    const val = localStorage.getItem(key);
    return val !== null ? val : fallback !== undefined ? fallback : null;
  } catch (e) {
    console.warn('[safeGetItem] localStorage error:', e);
    return fallback !== undefined ? fallback : null;
  }
};

window.escapeHtml = function(s) {
  if (s === undefined || s === null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};

window.escapeAttr = function(s) {
  const t = window.escapeHtml(s);
  if (/^\s*(javascript|data|vbscript):/i.test(String(s || ''))) return '#';
  return t;
};

window.escapeJsAttr = function(s) {
  return window.escapeHtml(String(s === undefined || s === null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
};

window.compressImageFile = async function(file, opts) {
  try {
    const o = Object.assign({
      maxDim: 1600,
      quality: .82,
      minBytes: 150 * 1024
    }, opts || {});
    if (!file || !(file instanceof Blob)) return file;
    const type = (file.type || '').toLowerCase();
    if (!type.startsWith('image/') || type === 'image/gif' || type === 'image/svg+xml') return file;
    let bmp;
    try {
      bmp = await createImageBitmap(file);
    } catch (e) {
      return file;
    }
    const scale = Math.min(1, o.maxDim / Math.max(bmp.width, bmp.height));
    if (scale >= 1 && file.size <= o.minBytes) {
      bmp.close && bmp.close();
      return file;
    }
    const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close && bmp.close();
    const outType = o.outType || (type === 'image/png' ? 'image/png' : type === 'image/webp' ? 'image/webp' : 'image/jpeg');
    const blob = await new Promise((res => canvas.toBlob(res, outType, outType === 'image/png' ? undefined : o.quality)));
    if (!blob || blob.size >= file.size) return file;
    const out = new File([ blob ], file.name || 'image', {
      type: outType,
      lastModified: Date.now()
    });
    console.log(`[compressImage] ${file.name}: ${(file.size / 1024).toFixed(0)}KB → ${(out.size / 1024).toFixed(0)}KB (${w}x${h})`);
    return out;
  } catch (e) {
    return file;
  }
};

window.selectAllRows = async function(buildQuery, pageSize) {
  const size = pageSize || 1e3;
  let from = 0;
  let out = [];
  for (let guard = 0; guard < 500; guard++) {
    const {data: data, error: error} = await buildQuery().range(from, from + size - 1);
    if (error) return {
      data: out.length ? out : null,
      error: error
    };
    if (!data || data.length === 0) break;
    out = out.concat(data);
    if (data.length < size) break;
    from += size;
  }
  return {
    data: out,
    error: null
  };
};

window._showDbError = function(msg) {
  try {
    if (!document.body) return;
    let box = document.getElementById('dbErrorBanner');
    if (!box) {
      box = document.createElement('div');
      box.id = 'dbErrorBanner';
      box.style.cssText = 'position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:2147483000;max-width:min(560px,92vw);display:flex;align-items:flex-start;gap:10px;padding:12px 16px;border-radius:14px;background:#7f1d1d;border:1px solid #ef4444;color:#fee2e2;font-size:13px;line-height:1.5;box-shadow:0 12px 32px -8px rgba(0,0,0,.6);cursor:pointer;';
      box.title = 'คลิกเพื่อปิด';
      box.onclick = function() {
        box.remove();
      };
      document.body.appendChild(box);
    }
    box.textContent = '';
    const ic = document.createElement('span');
    ic.className = 'material-icons';
    ic.style.cssText = 'font-size:18px;color:#fca5a5;flex-shrink:0';
    ic.textContent = 'error_outline';
    const wrap = document.createElement('span');
    const t1 = document.createElement('b');
    t1.style.cssText = 'display:block;margin-bottom:2px';
    t1.textContent = 'บันทึกลงฐานข้อมูลไม่สำเร็จ';
    const t2 = document.createElement('span');
    t2.style.cssText = 'opacity:.9;word-break:break-word';
    t2.textContent = msg;
    wrap.appendChild(t1);
    wrap.appendChild(t2);
    box.appendChild(ic);
    box.appendChild(wrap);
    clearTimeout(box._t);
    box._t = setTimeout((function() {
      if (box.parentNode) box.remove();
    }), 9e3);
  } catch (e) {
    console.warn('[_showDbError]', e);
  }
};

window._installDbWriteGuard = function(db) {
  if (!db || typeof db.from !== 'function' || db.__writeGuardOn) return;
  db.__writeGuardOn = true;
  let lastMsg = '', lastAt = 0;
  const QUIET_TABLES = [ 'user_ip_logs', 'system_logs' ];
  const notify = function(err, table) {
    try {
      console.error('[เขียนฐานข้อมูลไม่สำเร็จ]', err);
      const msg = err && (err.message || err.details || err.hint) || 'ไม่ทราบสาเหตุ';
      const now = Date.now();
      if (QUIET_TABLES.indexOf(table) !== -1) return;
      if (msg === lastMsg && now - lastAt < 4e3) return;
      lastMsg = msg;
      lastAt = now;
      window._showDbError(msg);
    } catch (e) {}
  };
  const watch = function(builder, table) {
    try {
      if (!builder || typeof builder.then !== 'function' || builder.__dbWatched) return builder;
      builder.__dbWatched = true;
      const origThen = builder.then.bind(builder);
      builder.then = function(onOk, onErr) {
        return origThen((function(res) {
          if (res && res.error) notify(res.error, table);
          return onOk ? onOk(res) : res;
        }), onErr);
      };
    } catch (e) {}
    return builder;
  };
  const origFrom = db.from.bind(db);
  db.from = function(table) {
    const qb = origFrom(table);
    try {
      [ 'insert', 'update', 'upsert', 'delete' ].forEach((function(m) {
        const orig = qb[m];
        if (typeof orig !== 'function') return;
        qb[m] = function() {
          return watch(orig.apply(qb, arguments), table);
        };
      }));
    } catch (e) {}
    return qb;
  };
};

window._showAppError = function(msg, src) {
  try {
    if (!document.body) return;
    let box = document.getElementById('appErrorBanner');
    if (!box) {
      box = document.createElement('div');
      box.id = 'appErrorBanner';
      box.style.cssText = 'position:fixed;bottom:16px;left:16px;z-index:2147482000;max-width:min(420px,88vw);display:flex;align-items:flex-start;gap:9px;padding:11px 14px;border-radius:12px;background:#78350f;border:1px solid #f59e0b;color:#fef3c7;font-size:12.5px;line-height:1.5;box-shadow:0 10px 28px -8px rgba(0,0,0,.6);cursor:pointer;';
      box.title = 'คลิกเพื่อปิด';
      box.onclick = function() {
        box.remove();
      };
      document.body.appendChild(box);
    }
    box.textContent = '';
    const ic = document.createElement('span');
    ic.className = 'material-icons';
    ic.style.cssText = 'font-size:17px;color:#fcd34d;flex-shrink:0';
    ic.textContent = 'warning_amber';
    const wrap = document.createElement('span');
    const t1 = document.createElement('b');
    t1.style.cssText = 'display:block;margin-bottom:2px';
    t1.textContent = 'ระบบมีข้อผิดพลาด บางส่วนของหน้าอาจไม่ทำงาน';
    const t2 = document.createElement('span');
    t2.style.cssText = 'opacity:.9;word-break:break-word;font-size:11.5px';
    t2.textContent = msg + (src ? '  (' + src + ')' : '');
    wrap.appendChild(t1);
    wrap.appendChild(t2);
    box.appendChild(ic);
    box.appendChild(wrap);
    clearTimeout(box._t);
    box._t = setTimeout((function() {
      if (box.parentNode) box.remove();
    }), 12e3);
  } catch (e) {}
};

(function() {
  const seen = new Set;
  let shown = 0;
  const MAX_BANNERS = 3;
  window._appErrors = [];
  function record(kind, msg, src) {
    try {
      msg = String(msg || 'ไม่ทราบสาเหตุ');
      window._appErrors.push({
        "เวลา": (new Date).toLocaleTimeString('th-TH'),
        "ประเภท": kind,
        "ข้อความ": msg,
        "ที่มา": src || '-'
      });
      if (window._appErrors.length > 20) window._appErrors.shift();
      console.error('[แอปมีข้อผิดพลาด]', kind, msg, src || '');
      const key = kind + '|' + msg;
      if (seen.has(key) || shown >= MAX_BANNERS) return;
      seen.add(key);
      shown++;
      window._showAppError(msg, src);
    } catch (e) {}
  }
  window.addEventListener('error', (function(e) {
    if (!e || !e.message) return;
    const file = (e.filename || '').split('/').pop().split('?')[0];
    record('error', e.message, file ? file + ':' + (e.lineno || '?') : '');
  }));
  window.addEventListener('unhandledrejection', (function(e) {
    const r = e && e.reason;
    record('promise', r && (r.message || r.details) || r, '');
  }));
  window.showAppErrors = function() {
    if (!window._appErrors.length) {
      console.log('✅ ยังไม่พบข้อผิดพลาด');
      return [];
    }
    console.table(window._appErrors);
    return window._appErrors;
  };
})();

document.addEventListener('DOMContentLoaded', (async () => {
  window.syncThemeUI();
  if (window.supabase) {
    appDB = window.supabase.createClient(DB_URL, DB_KEY);
    if (typeof window.syncServerTime === 'function') window.syncServerTime(true);
    window.appDB = appDB;
    try {
      window._installDbWriteGuard(appDB);
    } catch (e) {
      console.warn('[dbWriteGuard]', e);
    }
  }
  const savedUser = sessionStorage.getItem('user_platinum_plus');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    if (appDB && currentUser && currentUser.id) {
      try {
        const {data: kick} = await appDB.from('settings').select('value').eq('key', `force_logout_${currentUser.id}`).maybeSingle();
        const kickedAt = kick && kick.value ? parseInt(kick.value, 10) : 0;
        if (kickedAt && kickedAt > (currentUser._loginAt || 0)) {
          sessionStorage.removeItem('user_platinum_plus');
          currentUser = null;
          window.currentUser = null;
          Swal.fire({
            icon: 'warning',
            title: 'คุณถูกให้ออกจากระบบ',
            text: 'ผู้ดูแลระบบให้คุณออกจากระบบ กรุณาล็อกอินใหม่',
            confirmButtonText: 'ตกลง'
          });
          document.getElementById('loading').classList.add('hidden');
          showLogin();
          return;
        }
      } catch (e) {}
    }
    setTimeout((() => {
      if (typeof window.subscribeUserChanges === 'function') window.subscribeUserChanges();
    }), 300);
    setTimeout((() => {
      if (typeof window.subscribeBoardEvents === 'function') window.subscribeBoardEvents();
    }), 300);
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('main-layout').classList.remove('hidden');
    if (appDB) {
      try {
        const {data: data} = await appDB.from('settings').select('value').eq('key', 'dept_menu_rules').maybeSingle();
        if (data && data.value) {
          if (typeof SETTINGS !== 'undefined') {
            SETTINGS['dept_menu_rules'] = data.value;
          }
          window.safeSetItem('cached_menu_rules', data.value);
        }
      } catch (e) {
        console.warn('[startup] dept_menu_rules fetch failed, falling back to cache', e);
      }
    }
    window.openPageFromHash();
  } else {
    showLogin();
  }
}));

window.openPageFromHash = function() {
  const raw = (location.hash || '').replace('#', '').trim();
  const name = /^[a-z0-9_]+$/i.test(raw) ? raw : '';
  if (!name || name === 'dashboard') return showPage('dashboard');
  const btn = document.querySelector(`button[onclick*="showPage('${name}')"]`);
  const hiddenByPerm = btn && (btn.classList.contains('hidden') || btn.style.display === 'none');
  if (!btn || hiddenByPerm) {
    try {
      history.replaceState({
        page: 'dashboard'
      }, '', '#dashboard');
    } catch (e) {}
    return showPage('dashboard');
  }
  return showPage(name);
};

window.addEventListener('popstate', (() => {
  const name = (location.hash || '').replace('#', '').trim() || 'dashboard';
  if (name === window._currentPageName) return;
  window._navFromHash = true;
  Promise.resolve(showPage(name)).finally((() => {
    window._navFromHash = false;
  }));
}));

function setHtmlAndRunScripts(container, html) {
  container.innerHTML = html;
  const oldScripts = container.querySelectorAll('script');
  oldScripts.forEach((oldScript => {
    const newScript = document.createElement('script');
    Array.from(oldScript.attributes).forEach((attr => newScript.setAttribute(attr.name, attr.value)));
    newScript.textContent = oldScript.textContent;
    oldScript.parentNode.replaceChild(newScript, oldScript);
  }));
}

async function showLogin() {
  const loading = document.getElementById('loading');
  if (loading) loading.classList.remove('hidden');
  try {
    const response = await fetch(`./pages/login/login.html?v=${window._APP_VERSION || Date.now()}`);
    setTimeout((() => {
      if (typeof window.prewarmIpProbe === 'function') window.prewarmIpProbe();
    }), 800);
    const html = await response.text();
    setHtmlAndRunScripts(document.getElementById('login-container'), html);
    if (typeof setupPinInputs === 'function') setupPinInputs();
    const savedName = localStorage.getItem('remember_me_name');
    if (savedName && document.getElementById('loginName')) {
      document.getElementById('loginName').value = savedName;
      document.getElementById('rememberMe').checked = true;
    }
  } catch (err) {
    console.error('Error loading login:', err);
  } finally {
    if (loading) loading.classList.add('hidden');
    if (!window._warmedUp) setTimeout((() => window._warmupAllPages()), 4e3);
  }
}

window._reqCache = {};

window.cachedQuery = async function(key, fn, ttlMs = 15e3) {
  const now = Date.now();
  const hit = window._reqCache[key];
  if (hit && now - hit.ts < ttlMs) return hit.promise;
  const promise = Promise.resolve().then(fn);
  window._reqCache[key] = {
    ts: now,
    promise: promise
  };
  promise.catch((() => {
    delete window._reqCache[key];
  }));
  return promise;
};

window.clearQueryCache = function(prefix) {
  if (!prefix) {
    window._reqCache = {};
    return;
  }
  Object.keys(window._reqCache).forEach((k => {
    if (k.startsWith(prefix)) delete window._reqCache[k];
  }));
};

window.checkBigLogos = async function(limitKB = 200) {
  try {
    const logos = window.summaryWebLogos || {};
    const names = Object.keys(logos);
    if (!names.length) {
      console.log('⚠️ ยังไม่มีข้อมูลโลโก้ (ลองเข้าหน้าสรุปยอดก่อน แล้วรันใหม่)');
      return;
    }
    console.log(`🔍 กำลังตรวจโลโก้ ${names.length} เว็บ...`);
    const rows = [];
    for (const web of names) {
      const url = logos[web];
      if (!url) continue;
      try {
        const res = await fetch(url, {
          method: 'HEAD'
        });
        const kb = Math.round((+res.headers.get('content-length') || 0) / 1024);
        rows.push({
          "เว็บ": web,
          "ขนาด_KB": kb,
          "สถานะ": kb > limitKB ? '🔴 ใหญ่เกิน ควรย่อ' : '✅ โอเค',
          "ลิงก์": url
        });
      } catch (e) {
        rows.push({
          "เว็บ": web,
          "ขนาด_KB": '?',
          "สถานะ": '⚠️ เช็คไม่ได้',
          "ลิงก์": url
        });
      }
    }
    rows.sort(((a, b) => (+b.ขนาด_KB || 0) - (+a.ขนาด_KB || 0)));
    console.table(rows);
    const big = rows.filter((r => +r.ขนาด_KB > limitKB));
    if (big.length) {
      console.log(`\n🔴 พบ ${big.length} เว็บที่โลโก้ใหญ่เกิน ${limitKB} KB:`);
      big.forEach((b => console.log(`   • ${b.เว็บ} = ${b.ขนาด_KB} KB`)));
      console.log('\n💡 วิธีแก้: ไปหน้าสรุปยอด → คลิกโลโก้เว็บนั้น → อัปรูปเดิมใหม่อีกครั้ง');
      console.log('   ระบบจะย่อให้อัตโนมัติเหลือ ~20-50 KB');
    } else {
      console.log('✅ โลโก้ทุกเว็บขนาดเหมาะสมแล้ว');
    }
    return rows;
  } catch (e) {
    console.error('เช็คโลโก้ไม่สำเร็จ:', e);
  }
};

window.compressImage = async function(file, opts = {}) {
  const maxW = opts.maxWidth || 800;
  const maxH = opts.maxHeight || 800;
  const quality = opts.quality || .85;
  const skipUnder = (opts.skipUnderKB || 150) * 1024;
  if (!file || !file.type || !file.type.startsWith('image/')) return file;
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
  if (file.size <= skipUnder) return file;
  try {
    const dataUrl = await new Promise(((res, rej) => {
      const r = new FileReader;
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    }));
    const img = await new Promise(((res, rej) => {
      const i = new Image;
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = dataUrl;
    }));
    let {width: w, height: h} = img;
    if (w <= maxW && h <= maxH && file.size < 400 * 1024) return file;
    const ratio = Math.min(maxW / w, maxH / h, 1);
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise((res => canvas.toBlob(res, 'image/webp', quality)));
    if (!blob || blob.size >= file.size) return file;
    const newName = file.name.replace(/\.[^.]+$/, '') + '.webp';
    const out = new File([ blob ], newName, {
      type: 'image/webp'
    });
    console.log(`[ย่อรูป] ${file.name}: ${(file.size / 1024).toFixed(0)}KB → ${(out.size / 1024).toFixed(0)}KB`);
    return out;
  } catch (e) {
    console.warn('[ย่อรูป] ล้มเหลว ใช้ไฟล์เดิม', e);
    return file;
  }
};

const pageCache = {};

const domSnapshot = {};

window._currentPageName = null;

window._refreshChipTimer = null;

window._buildRefreshChip = function() {
  if (document.getElementById('pageRefreshChip')) return;
  const el = document.createElement('div');
  el.id = 'pageRefreshChip';
  el.innerHTML = `<span class="material-icons animate-spin" style="font-size:14px;color:var(--k-gold-tx)">sync</span> กำลังอัปเดตข้อมูล...`;
  el.style.cssText = 'position:fixed;bottom:18px;right:18px;z-index:9999;display:flex;align-items:center;gap:6px;padding:7px 14px;border-radius:999px;background:rgba(10,16,29,0.92);border:1px solid rgba(232,193,90,0.35);color:#f5e3ae;font-size:11px;font-weight:700;box-shadow:0 8px 24px -8px rgba(0,0,0,0.6);backdrop-filter:blur(4px);transition:opacity .25s;';
  document.body.appendChild(el);
};

window._showRefreshChip = function() {
  if (window._refreshChipTimer || document.getElementById('pageRefreshChip')) return;
  window._refreshChipTimer = setTimeout((() => {
    window._refreshChipTimer = null;
    window._buildRefreshChip();
  }), 600);
};

window._hideRefreshChip = function() {
  if (window._refreshChipTimer) {
    clearTimeout(window._refreshChipTimer);
    window._refreshChipTimer = null;
  }
  const el = document.getElementById('pageRefreshChip');
  if (!el) return;
  el.style.opacity = '0';
  setTimeout((() => el.remove()), 300);
};

const VERSION_CHECK_INTERVAL_MS = 3 * 60 * 1e3;

window._versionCheckInterval = null;

window._newVersionDetected = false;

window.checkForNewVersion = async function() {
  if (window._newVersionDetected) return;
  try {
    const res = await fetch('./index.html?_vc=' + Date.now(), {
      cache: 'no-store'
    });
    if (!res.ok) return;
    const html = await res.text();
    const m = html.match(/_APP_VERSION\s*=\s*["']([^"']+)["']/);
    if (!m) return;
    const liveVersion = m[1];
    const myVersion = String(window._APP_VERSION || '');
    if (liveVersion && myVersion && liveVersion !== myVersion) {
      window._newVersionDetected = true;
      window._showNewVersionBanner();
    }
  } catch (e) {}
};

window._showNewVersionBanner = function() {
  if (document.getElementById('newVersionBanner')) return;
  const el = document.createElement('div');
  el.id = 'newVersionBanner';
  el.innerHTML = `\n        <span class="material-icons" style="font-size:18px;color:var(--k-gold-tx)">new_releases</span>\n        <span>มีการอัปเดตระบบใหม่ — กดเพื่อโหลดหน้าล่าสุด</span>\n        <button onclick="location.reload()" style="margin-left:6px;padding:6px 14px;border-radius:8px;background:#E8C15A;color:#101828;font-weight:900;font-size:12.5px;border:none;cursor:pointer;white-space:nowrap;box-shadow:0 2px 10px rgba(232,193,90,0.4)">อัปเดตเลย</button>\n    `;
  el.style.cssText = 'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:100000;display:flex;align-items:center;gap:10px;padding:11px 16px;border-radius:14px;background:rgba(10,16,29,0.97);border:1px solid rgba(232,193,90,0.5);color:#f5e3ae;font-size:13px;font-weight:700;box-shadow:0 12px 32px -8px rgba(0,0,0,0.7);backdrop-filter:blur(6px);max-width:92vw;';
  document.body.appendChild(el);
};

window.startVersionWatch = function() {
  if (window._versionCheckInterval) return;
  window._versionCheckInterval = setInterval(window.checkForNewVersion, VERSION_CHECK_INTERVAL_MS);
  if (!window._versionVisibilityHandlerAttached) {
    document.addEventListener('visibilitychange', (() => {
      if (!document.hidden) window.checkForNewVersion();
    }));
    window._versionVisibilityHandlerAttached = true;
  }
  console.log(`[Version Watch] เริ่มเช็คอัปเดตทุก ${VERSION_CHECK_INTERVAL_MS / 6e4} นาที`);
};

window._pageSubscriptions = window._pageSubscriptions || new Set;

window.registerPageSubscription = function(channel) {
  if (!channel) return channel;
  window._pageSubscriptions.add(channel);
  return channel;
};

window.cleanupPageSubscriptions = function() {
  if (!appDB || !window._pageSubscriptions || window._pageSubscriptions.size === 0) return;
  window._pageSubscriptions.forEach((ch => {
    try {
      appDB.removeChannel(ch);
    } catch (e) {}
  }));
  window._pageSubscriptions.clear();
};

window._pageIntervals = window._pageIntervals || new Set;

window.registerPageInterval = function(intervalId) {
  if (!intervalId) return intervalId;
  window._pageIntervals.add(intervalId);
  return intervalId;
};

window.cleanupPageIntervals = function() {
  if (!window._pageIntervals || window._pageIntervals.size === 0) return;
  window._pageIntervals.forEach((id => {
    try {
      clearInterval(id);
    } catch (e) {}
  }));
  window._pageIntervals.clear();
};

const PAGE_SCRIPTS = {
  bell: [ 'bell/core' ],
  oa_chat: [ 'oa_chat/core' ],
  breaktable: [ 'breaktable/core' ],
  break_audit: [ 'break_audit/core' ],
  staff_record: [ 'staff_record/core' ],
  leave: [ 'leave/core', 'leave/table', 'leave/controls', 'swap/core', 'swap/view', 'swap/admin', 'swap/extras' ],
  swap: [ 'leave/core', 'leave/table', 'leave/controls', 'swap/core', 'swap/view', 'swap/admin', 'swap/extras' ],
  duty: [ 'duty/core', 'duty/dragdrop', 'duty/roles', 'duty/tools', 'duty/support', 'duty/rotation' ],
  discord: [ 'discord/core', 'discord/history', 'discord/message', 'discord/breaktrack', 'discord/tts', 'discord/chatcount' ],
  summary: [ 'summary/core', 'summary/export' ],
  telegram: [ 'telegram/Telegram' ],
  password: [ 'password/Password' ],
  files: [ 'files/FilesApp' ],
  od_config: [ 'od_config/config', 'od_config/history' ],
  kbiz: [ 'kbiz/core', 'kbiz/ops' ],
  gallery: [ 'gallery/core', 'gallery/ui' ],
  logo_editor: [ 'logo_editor/core', 'logo_editor/erase', 'logo_editor/tools', 'logo_editor/extras' ],
  fine: [ 'fine/core', 'fine/rules', 'fine/records', 'fine/tools' ],
  withdrawal_report: [ 'withdrawal_report/stats', 'withdrawal_report/bot' ],
  sop: [ 'sop/core', 'sop/rules', 'sop/manage', 'sop/share' ],
  ip_check: [ 'ip_check/core', 'ip_check/tabs', 'ip_check/risk', 'ip_check/alerts' ],
  ip_allow: [ 'ip_allow/ip_allow' ],
  slip_check: [ 'slip_check/core', 'slip_check/scan', 'slip_check/history' ]
};

window._loadedScripts = {};

window.loadScript = function(name) {
  if (window._loadedScripts[name]) return window._loadedScripts[name];
  window._loadedScripts[name] = new Promise(((resolve, reject) => {
    const el = document.createElement('script');
    el.src = `./js/${name}.js?v=${window._APP_VERSION || Date.now()}`;
    el.onload = () => resolve(name);
    el.onerror = () => {
      delete window._loadedScripts[name];
      reject(new Error(`โหลดไฟล์ ${name}.js ไม่สำเร็จ`));
    };
    document.head.appendChild(el);
  }));
  return window._loadedScripts[name];
};

window.loadPageScripts = async function(pageName) {
  const list = PAGE_SCRIPTS[pageName] || [];
  for (const n of list) await window.loadScript(n);
};

window.lazyStub = function(fnName, scriptName) {
  if (typeof window[fnName] === 'function') return;
  const stub = async function(...args) {
    const list = Array.isArray(scriptName) ? scriptName : [ scriptName ];
    for (const sn of list) await window.loadScript(sn);
    if (typeof window[fnName] === 'function' && window[fnName] !== stub) return window[fnName](...args);
    throw new Error(`${fnName} ไม่พบใน ${list.join(', ')}`);
  };
  window[fnName] = stub;
};

window.lazyStub('loadExcelLibrary', [ 'summary/core', 'summary/export' ]);

window.lazyStub('initSlipCheck', [ 'slip_check/core', 'slip_check/scan', 'slip_check/history' ]);

window.lazyStub('initOdConfig', [ 'od_config/config', 'od_config/history' ]);

window.breakCapByRule = function(total) {
  if (!total || total <= 0) return 0;
  if (total <= 4) return 1;
  if (total <= 7) return 2;
  if (total <= 10) return 3;
  if (total <= 14) return 4;
  if (total <= 20) return 5;
  if (total <= 25) return 6;
  if (total <= 30) return 7;
  return 8;
};

window._breakMinRemainCfg = null;

window.breakCapByHeadcount = function(n) {
  n = parseInt(n) || 0;
  if (n <= 1) return n;
  if (n <= 4) return 1;
  if (n <= 7) return 2;
  if (n <= 10) return 3;
  if (n <= 14) return 4;
  if (n <= 20) return 5;
  if (n <= 25) return 6;
  if (n <= 30) return 7;
  if (n <= 35) return 8;
  if (n <= 40) return 9;
  if (n <= 45) return 10;
  if (n <= 50) return 11;
  return 11 + Math.ceil((n - 50) / 5);
};

window.getBreakGapMin = function() {
  const S = typeof SETTINGS !== 'undefined' && SETTINGS ? SETTINGS : {};
  const v = parseInt(S.break_gap_min);
  return isNaN(v) || v < 0 ? 0 : v;
};

window.isSlotTooClose = function(slotA, slotB, gapMin) {
  const gap = gapMin === undefined ? window.getBreakGapMin() : parseInt(gapMin) || 0;
  const toM = s => {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(s || ''));
    return m ? +m[1] * 60 + +m[2] : null;
  };
  const pa = String(slotA || '').split('-'), pb = String(slotB || '').split('-');
  if (pa.length !== 2 || pb.length !== 2) return false;
  const a1 = toM(pa[0]), a2 = toM(pa[1]), b1 = toM(pb[0]), b2 = toM(pb[1]);
  if ([ a1, a2, b1, b2 ].some((v => v === null))) return false;
  if (gap <= 0) return pa[1] === pb[0] || pb[1] === pa[0];
  const d1 = (b1 - a2 + 1440) % 1440;
  const d2 = (a1 - b2 + 1440) % 1440;
  return Math.min(d1, d2) < gap;
};

window.fmtGapText = function(min) {
  min = parseInt(min) || 0;
  if (min <= 0) return '';
  const h = Math.floor(min / 60), m = min % 60;
  return (h ? `${h} ชม.` : '') + (m ? `${h ? ' ' : ''}${m} นาที` : '');
};

window._breakWebGroups = null;

window.loadBreakWebGroups = async function(force) {
  if (window._breakWebGroups && !force) return window._breakWebGroups;
  try {
    const {data: data} = await appDB.from('settings').select('value').eq('key', 'break_web_groups').maybeSingle();
    window._breakWebGroups = data && data.value ? JSON.parse(data.value) : {};
  } catch (e) {
    window._breakWebGroups = window._breakWebGroups || {};
  }
  return window._breakWebGroups;
};

window.getBreakWebPool = function(dept, team, shift) {
  const groups = window.getWebGroupsOf(dept, shift);
  for (const g of groups) {
    if (Array.isArray(g) && g.includes(team)) {
      const members = [ ...new Set(g.filter(Boolean)) ];
      return {
        key: members.slice().sort().join(' + '),
        members: members,
        grouped: members.length > 1
      };
    }
  }
  return {
    key: team,
    members: [ team ],
    grouped: false
  };
};

window.getWebGroupsOf = function(dept, shift) {
  const all = window._breakWebGroups || {};
  const d = all[dept];
  if (Array.isArray(d)) return d;
  if (d && typeof d === "object") {
    const g = d[shift];
    if (Array.isArray(g)) return g;
  }
  return [];
};

window.poolMembers = function(covMap, dept, team) {
  const pool = window.getBreakWebPool(dept, team, covMap && covMap.shift || "");
  const out = new Set;
  pool.members.forEach((t => {
    const s = covMap && covMap.combined && covMap.combined[t] || new Set;
    s.forEach((n => out.add(n)));
  }));
  return {
    pool: pool,
    members: out
  };
};

window.loadBreakMinRemainCfg = async function(force) {
  if (window._breakMinRemainCfg && !force) return window._breakMinRemainCfg;
  try {
    const {data: data} = await appDB.from('settings').select('value').eq('key', 'break_min_remain').maybeSingle();
    window._breakMinRemainCfg = data && data.value ? JSON.parse(data.value) : {};
  } catch (e) {
    window._breakMinRemainCfg = window._breakMinRemainCfg || {};
  }
  return window._breakMinRemainCfg;
};

window.getBreakMinRemain = function(dept, shift, team) {
  const n = window.getBreakMinRemainRaw(dept, shift, team);
  return n === null ? 1 : n;
};

window.getBreakMinRemainRaw = function(dept, shift, team) {
  const c = window._breakMinRemainCfg || {};
  const v = c && c[dept] && c[dept][shift] ? c[dept][shift][team] : undefined;
  if (v === undefined || v === null || v === '') return null;
  const n = parseInt(v, 10);
  return isNaN(n) || n < 0 ? null : n;
};

window.buildCoverageMap = function(roster, dept, shift) {
  const webs = {};
  const websOf = {};
  const combined = {};
  const combinedOf = {};
  for (const team in roster || {}) {
    (roster[team] || []).forEach((u => {
      if (!u || !u.username || String(u.username).includes('ขาดคน')) return;
      const add = t => {
        if (!t) return;
        (webs[t] = webs[t] || new Set).add(u.username);
        websOf[u.username] = websOf[u.username] || [];
        if (!websOf[u.username].includes(t)) websOf[u.username].push(t);
      };
      const addCombined = tm => {
        if (!tm) return;
        (combined[tm] = combined[tm] || new Set).add(u.username);
        combinedOf[u.username] = combinedOf[u.username] || [];
        if (!combinedOf[u.username].includes(tm)) combinedOf[u.username].push(tm);
      };
      add(`${team} (หลัก)`);
      addCombined(team);
      if (u.secondary_team) {
        add(`${u.secondary_team} (รอง)`);
        addCombined(u.secondary_team);
      }
    }));
  }
  return {
    webs: webs,
    websOf: websOf,
    combined: combined,
    combinedOf: combinedOf,
    dept: dept || '',
    shift: shift || ''
  };
};

window.checkCoverage = function(username, covMap, slotBookings) {
  const myTeams = covMap && covMap.combinedOf && covMap.combinedOf[username] || [];
  if (myTeams.length === 0) return {
    ok: true,
    problems: [],
    canLeave: Infinity
  };
  const onBreak = new Set((slotBookings || []).map((b => b.staff_name)).filter(Boolean));
  const dept = covMap && covMap.dept || "";
  const problems = [];
  let canLeave = Infinity;
  const seen = new Set;
  myTeams.forEach((team => {
    const {pool: pool, members: members} = window.poolMembers(covMap, dept, team);
    if (seen.has(pool.key)) return;
    seen.add(pool.key);
    if (members.size < 2) return;
    let raw = null;
    pool.members.forEach((t => {
      const v = window.getBreakMinRemainRaw(dept, covMap.shift, t);
      if (v !== null) raw = raw === null ? v : Math.max(raw, v);
    }));
    const cap = raw === null ? Math.min(members.size, window.breakCapByHeadcount(members.size)) : Math.max(0, members.size - raw);
    const minRemain = members.size - cap;
    let used = 0;
    members.forEach((n => {
      if (n !== username && onBreak.has(n)) used++;
    }));
    if (used >= cap) problems.push({
      team: pool.key + ' (' + (raw === null ? 'เพดานอัตโนมัติ เหลือเฝ้า' : 'ตั้งเอง เหลือเฝ้า') + ' ' + minRemain + ')',
      used: used,
      cap: cap,
      total: members.size
    });
    canLeave = Math.min(canLeave, Math.max(0, cap - used));
  }));
  return {
    ok: problems.length === 0,
    problems: problems,
    canLeave: canLeave
  };
};

async function showPage(pageName) {
  const loading = document.getElementById('loading');
  window.cleanupPageSubscriptions();
  window.cleanupPageIntervals();
  document.querySelectorAll('#gdPreview').forEach((el => el.remove()));
  const _prevApp = document.getElementById('app-content');
  if (window._currentPageName && _prevApp && _prevApp.innerHTML && _prevApp.innerHTML.length > 50) {
    domSnapshot[window._currentPageName] = _prevApp.innerHTML;
  }
  const _snapReady = !!domSnapshot[pageName];
  const _scriptsReady = typeof PAGE_SCRIPTS !== 'undefined' ? (PAGE_SCRIPTS[pageName] || []).every((n => window._loadedScripts && window._loadedScripts[n])) : false;
  const _instant = _snapReady && _scriptsReady && !!pageCache[pageName];
  try {
    if (!pageCache[pageName] && loading) loading.classList.remove('hidden');
    if (!pageCache[pageName]) {
      const _v = window._APP_VERSION || Date.now();
      const response = await fetch(`./pages/${pageName}/${pageName}.html?v=${_v}`);
      if (!response.ok) throw new Error('Page not found');
      pageCache[pageName] = await response.text();
    }
    if (loading && !_instant) loading.classList.remove('hidden');
    await window.loadPageScripts(pageName);
    const usedSnapshot = !!domSnapshot[pageName];
    const htmlContent = domSnapshot[pageName] || pageCache[pageName];
    const updateDOM = () => {
      const appContent = document.getElementById('app-content');
      appContent.innerHTML = htmlContent;
      appContent.classList.remove('hidden');
      window._currentPageName = pageName;
      try {
        if (!window._navFromHash && location.hash.slice(1) !== pageName) {
          history.pushState({
            page: pageName
          }, '', '#' + pageName);
        }
      } catch (e) {}
      document.querySelectorAll('.nm-menu-title').forEach((el => el.classList.remove('active')));
      const activeBtn = document.querySelector(`button[onclick*="showPage('${pageName}')"]`);
      if (activeBtn) activeBtn.classList.add('active');
      requestAnimationFrame((async () => {
        if (usedSnapshot && window._showRefreshChip) window._showRefreshChip();
        if (document.getElementById('uName') && currentUser && currentUser.username) {
          document.getElementById('uName').innerText = currentUser.username;
        }
        if (pageName === 'dashboard') {
          if (!window._openingAdminPanel && !window._openingLogsPage) {
            let _subWasOpen = false;
            [ 'adminPanel', 'logsPage' ].forEach((id => {
              const el = document.getElementById(id);
              if (el && !el.classList.contains('hidden')) {
                el.classList.add('hidden');
                el.classList.remove('flex');
                _subWasOpen = true;
              }
            }));
            if (_subWasOpen) {
              const mc = document.getElementById('mainContentArea');
              if (mc) mc.classList.remove('hidden');
            }
          } else {
            const mc = document.getElementById('mainContentArea');
            if (mc) mc.classList.add('hidden');
            if (window._openingAdminPanel) {
              const ap = document.getElementById('adminPanel');
              if (ap) {
                ap.classList.remove('hidden');
                ap.classList.add('flex');
              }
            }
            if (window._openingLogsPage) {
              const lp = document.getElementById('logsPage');
              if (lp) {
                lp.classList.remove('hidden');
                lp.classList.add('flex');
              }
            }
          }
          if (typeof initDashboard === 'function') initDashboard();
          if (typeof refreshAdminData === 'function') refreshAdminData();
          if (canPerm('admin_users')) {
            if (document.getElementById('userManagerUIBlock')) {
              document.getElementById('userManagerUIBlock').classList.remove('hidden');
              document.getElementById('userManagerUIBlock').classList.add('flex');
            }
          }
        } else if (pageName === 'fine') {
          if (typeof initFineApp === 'function') await initFineApp();
        } else if (pageName === 'sop') {
          if (typeof initSopApp === 'function') await initSopApp();
          if (typeof subscribeSopChanges === 'function') subscribeSopChanges();
        } else if (pageName === 'od_center') {
          if (typeof initOdCenterApp === 'function') await initOdCenterApp();
        } else if (pageName === 'breaktable') {
          if (typeof initBreakTable === 'function') await initBreakTable();
        } else if (pageName === 'break_audit') {
          if (typeof initBreakAudit === 'function') await initBreakAudit();
        } else if (pageName === 'leave') {
          if (typeof initLeaveTable === 'function') await initLeaveTable();
        } else if (pageName === 'gallery') {
          if (typeof initGalleryApp === 'function') initGalleryApp();
        } else if (pageName === 'logo_editor') {
          if (typeof initLogoEditorApp === 'function') initLogoEditorApp();
        } else if (pageName === 'duty') {
          if (typeof initDutyApp === 'function') await initDutyApp();
        } else if (pageName === 'discord') {
          if (typeof applyDiscordPermissions === 'function') applyDiscordPermissions();
        } else if (pageName === 'withdrawal_report') {
          if (typeof initWithdrawalReport === 'function') await initWithdrawalReport();
        } else if (pageName === 'summary') {
          if (typeof initSummaryDate === 'function') await initSummaryDate();
        } else if (pageName === 'telegram') {
          if (typeof initTelegramApp === 'function') await initTelegramApp();
        } else if (pageName === 'password') {
          if (typeof initPasswordApp === 'function') await initPasswordApp();
        } else if (pageName === 'files') {
          if (typeof initFilesApp === 'function') await initFilesApp();
        } else if (pageName === 'od_config') {
          if (typeof initOdConfig === 'function') await initOdConfig();
          if (typeof subscribeOdConfigChanges === 'function') subscribeOdConfigChanges();
        } else if (pageName === 'sheet') {
          if (typeof fetchSheets === 'function') await fetchSheets();
          if (typeof renderSheetMenu === 'function') renderSheetMenu();
          if (typeof renderRecentTabs === 'function') renderRecentTabs();
          if (canPerm('sheet_manage')) {
            if (document.getElementById('sheetAdminControls')) document.getElementById('sheetAdminControls').classList.remove('hidden');
          }
          const sheetApp = document.getElementById('sheetApp');
          if (sheetApp) {
            sheetApp.classList.remove('hidden');
            sheetApp.classList.add('flex');
          }
          if (document.getElementById('sheetMenu')) document.getElementById('sheetMenu').classList.remove('hidden');
          if (document.getElementById('sheetViewer')) {
            document.getElementById('sheetViewer').classList.add('hidden');
            document.getElementById('sheetViewer').classList.remove('flex');
          }
        } else if (pageName === 'kbiz') {
          if (typeof fetchKbizData === 'function') await fetchKbizData();
          if (typeof subscribeKbizChanges === 'function') subscribeKbizChanges();
        } else if (pageName === 'swap') {
          if (typeof openAutoSwapModal === 'function') await openAutoSwapModal();
        } else if (pageName === 'ip_check') {
          if (typeof initIpCheckApp === 'function') await initIpCheckApp();
        } else if (pageName === 'ip_allow') {
          if (typeof initIpAllowApp === 'function') await initIpAllowApp();
        } else if (pageName === 'slip_check') {
          if (typeof window.initSlipCheck === 'function') await window.initSlipCheck();
        } else if (pageName === 'bell') {
          if (typeof initBell === 'function') await initBell();
        } else if (pageName === 'oa_chat') {
          if (typeof initOaChat === 'function') await initOaChat();
        } else if (pageName === 'staff_record') {
          if (typeof initStaffRecord === 'function') await initStaffRecord();
        }
        if (window._hideRefreshChip) window._hideRefreshChip();
        const _appNow = document.getElementById('app-content');
        if (_appNow && window._currentPageName === pageName) {
          domSnapshot[pageName] = _appNow.innerHTML;
        }
      }));
    };
    updateDOM();
  } catch (err) {
    console.error(err);
    document.getElementById('app-content').innerHTML = `<div class="p-10 text-center text-red-500 font-bold">เกิดข้อผิดพลาดในการโหลดหน้า ${pageName}<br><br><span class="text-xs text-gray-500">${err.message}</span></div>`;
  } finally {
    if (loading) loading.classList.add('hidden');
    if (!window._warmedUp) setTimeout((() => window._warmupAllPages()), 4e3);
  }
}

window.syncThemeUI = function() {
  const dark = window._themeMode ? window._themeMode === 'dark' : document.documentElement.classList.contains('dark');
  const icon = document.getElementById('themeIcon');
  if (icon) icon.innerText = dark ? 'light_mode' : 'dark_mode';
  const cb = document.getElementById('themeToggleCb');
  if (cb) cb.checked = dark;
};

window.setTheme = function(mode) {
  const root = document.documentElement;
  window._themeMode = mode;
  const apply = () => {
    root.classList.add('theme-noanim');
    root.classList.toggle('dark', window._themeMode === 'dark');
    window.syncThemeUI();
    requestAnimationFrame((() => requestAnimationFrame((() => root.classList.remove('theme-noanim')))));
  };
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  try {
    localStorage.setItem('theme', mode);
  } catch (e) {}
  window.syncThemeUI();
  if (window._themeVT) {
    try {
      window._themeVT.skipTransition();
    } catch (e) {}
    window._themeVT = null;
  }
  let started = false;
  if (document.startViewTransition && !reduce && document.visibilityState === 'visible') {
    try {
      const vt = document.startViewTransition(apply);
      window._themeVT = vt;
      started = true;
      vt.finished.catch((() => {})).finally((() => {
        if (window._themeVT === vt) window._themeVT = null;
      }));
    } catch (e) {
      started = false;
    }
  }
  if (!started) apply();
  window.dispatchEvent(new CustomEvent('k-themechange', {
    detail: {
      mode: mode
    }
  }));
};

function toggleTheme() {
  const cur = window._themeMode || (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  window.setTheme(cur === 'dark' ? 'light' : 'dark');
}

window.toggleTheme = toggleTheme;

window.renderTemplate = function(templateId, data = {}) {
  const tpl = document.getElementById(templateId);
  if (!tpl) return '';
  let html = tpl.innerHTML;
  for (const key in data) {
    html = html.split(`{{${key}}}`).join(data[key] !== undefined && data[key] !== null ? data[key] : '');
  }
  return html;
};

window.deleteCustomPermDept = async function(dept) {
  Swal.fire({
    title: `ลบแผนก ${dept}?`,
    text: 'ลบแล้วจะไม่แสดงในตารางอีก',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'ลบเลย',
    customClass: {
      popup: 'dark:bg-slate-800 dark:text-white rounded-3xl'
    }
  }).then((async result => {
    if (result.isConfirmed) {
      Swal.fire({
        title: 'กำลังลบ...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });
      let dbDepts = [];
      try {
        dbDepts = JSON.parse(SETTINGS['custom_departments'] || '[]');
      } catch (e) {}
      dbDepts = dbDepts.filter((d => d !== dept));
      SETTINGS['custom_departments'] = JSON.stringify(dbDepts);
      await appDB.from('settings').upsert([ {
        key: 'custom_departments',
        value: JSON.stringify(dbDepts)
      } ]);
      window.renderPermsTable();
      Swal.fire({
        icon: 'success',
        title: 'ลบแผนกสำเร็จ',
        timer: 1e3,
        showConfirmButton: false
      });
    }
  }));
};

window.renameCustomPermDept = async function(oldDept) {
  const {value: newDeptRaw} = await Swal.fire({
    title: `เปลี่ยนชื่อแผนก ${oldDept}`,
    input: 'text',
    inputValue: oldDept,
    inputPlaceholder: 'พิมพ์ชื่อแผนกใหม่...',
    showCancelButton: true,
    confirmButtonText: 'บันทึกการเปลี่ยนแปลง',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#f59e0b',
    customClass: {
      popup: 'dark:bg-slate-800 dark:text-white rounded-3xl'
    }
  });
  if (newDeptRaw) {
    const newDept = newDeptRaw.toUpperCase().trim();
    if (!newDept || newDept === oldDept) return;
    let dbDepts = [];
    try {
      dbDepts = JSON.parse(SETTINGS['custom_departments'] || '[]');
    } catch (e) {}
    if (dbDepts.includes(newDept) || [ 'AM', 'OD', 'AMQL' ].includes(newDept)) {
      return Swal.fire('เตือน', 'มีแผนกชื่อนี้อยู่ในระบบแล้วครับ', 'warning');
    }
    Swal.fire({
      title: 'กำลังอัปเดตข้อมูลทั้งระบบ...',
      text: 'โปรดรอสักครู่...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });
    try {
      dbDepts = dbDepts.map((d => d === oldDept ? newDept : d));
      SETTINGS['custom_departments'] = JSON.stringify(dbDepts);
      let newPerms = JSON.parse(JSON.stringify(MENU_PERMS));
      Object.keys(newPerms).forEach((key => {
        if (key.startsWith(oldDept + '_')) {
          const newKey = key.replace(oldDept + '_', newDept + '_');
          newPerms[newKey] = newPerms[key];
          delete newPerms[key];
        }
      }));
      MENU_PERMS = newPerms;
      SETTINGS['dept_menu_rules'] = JSON.stringify(MENU_PERMS);
      window.safeSetItem('cached_menu_rules', JSON.stringify(MENU_PERMS));
      await appDB.from('settings').upsert([ {
        key: 'custom_departments',
        value: JSON.stringify(dbDepts)
      }, {
        key: 'dept_menu_rules',
        value: JSON.stringify(MENU_PERMS)
      } ]);
      await appDB.from('users').update({
        department: newDept
      }).eq('department', oldDept);
      if (typeof GLOBAL_USER_LIST !== 'undefined') {
        GLOBAL_USER_LIST.forEach((u => {
          if (u.department === oldDept) u.department = newDept;
        }));
      }
      window.renderPermsTable();
      if (typeof populateAdminDeptSelects === 'function') populateAdminDeptSelects();
      Swal.fire({
        icon: 'success',
        title: 'เปลี่ยนชื่อแผนกสำเร็จ!',
        text: `ระบบอัปเดตแท็กของพนักงานทุกคนเป็น ${newDept} เรียบร้อยแล้วครับ 🎉`,
        timer: 2500,
        showConfirmButton: false
      });
    } catch (e) {
      console.error(e);
      Swal.fire('Error', 'เกิดข้อผิดพลาด: ' + e.message, 'error');
    }
  }
};

const _settingsCache = {};

const _SETTINGS_TTL = 5 * 60 * 1e3;

window.getSettingCached = async function(key) {
  const now = Date.now();
  if (_settingsCache[key] && now - _settingsCache[key].ts < _SETTINGS_TTL) {
    return _settingsCache[key].value;
  }
  try {
    const {data: data} = await appDB.from('settings').select('value').eq('key', key).maybeSingle();
    const val = data?.value ?? null;
    _settingsCache[key] = {
      value: val,
      ts: now
    };
    return val;
  } catch (e) {
    return _settingsCache[key]?.value ?? null;
  }
};

window.clearSettingCache = function(key) {
  if (key) delete _settingsCache[key]; else Object.keys(_settingsCache).forEach((k => delete _settingsCache[k]));
};

let _usersCacheTs = 0;

const _USERS_TTL = 3 * 60 * 1e3;

window.getUsersCached = async function() {
  const now = Date.now();
  if (GLOBAL_USER_LIST.length > 0 && now - _usersCacheTs < _USERS_TTL) {
    return GLOBAL_USER_LIST;
  }
  try {
    const {data: data} = await appDB.from('users').select('*');
    if (data) {
      GLOBAL_USER_LIST = data;
      _usersCacheTs = now;
    }
    return GLOBAL_USER_LIST;
  } catch (e) {
    return GLOBAL_USER_LIST;
  }
};

window.clearUsersCache = function() {
  _usersCacheTs = 0;
};

(function() {
  const _timers = {};
  const _own = {};
  function _findJoined(name) {
    try {
      const list = appDB.getChannels && appDB.getChannels() || [];
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        if (!c || !c.topic) continue;
        if ((c.topic === name || c.topic === 'realtime:' + name) && c.state === 'joined') return c;
      }
    } catch (e) {}
    return null;
  }
  function _emit(name, event) {
    try {
      if (typeof appDB === 'undefined' || !appDB || !appDB.channel) return;
      const joined = _findJoined(name);
      if (joined) {
        joined.send({
          type: 'broadcast',
          event: event
        });
        return;
      }
      let entry = _own[name];
      if (!entry) {
        const ch = appDB.channel(name);
        entry = _own[name] = {
          ch: ch,
          ready: false,
          queue: []
        };
        ch.subscribe((function(status) {
          if (status !== 'SUBSCRIBED') return;
          entry.ready = true;
          const pending = entry.queue;
          entry.queue = [];
          pending.forEach((function(ev) {
            try {
              ch.send({
                type: 'broadcast',
                event: ev
              });
            } catch (e) {}
          }));
        }));
      }
      if (entry.ready) entry.ch.send({
        type: 'broadcast',
        event: event
      }); else if (entry.queue.indexOf(event) === -1) entry.queue.push(event);
    } catch (e) {
      console.warn('[debouncedBroadcast] failed:', e);
    }
  }
  window.debouncedBroadcast = function(channel, event, delay) {
    delay = delay || 800;
    if (_timers[channel]) clearTimeout(_timers[channel]);
    _timers[channel] = setTimeout((function() {
      delete _timers[channel];
      _emit(channel, event || 'force_reload');
    }), delay);
  };
})();

window.TAG_OPTIONS = [ {
  value: 'ONLINE',
  label: 'ONLINE',
  desc: 'ออนไลน์ — ถ่ายรูปเช็คชื่อ'
}, {
  value: 'TEMP',
  label: 'TEMP',
  desc: 'ออนไลน์ชั่วคราว — ถ่ายรูปอีกกลุ่ม'
}, {
  value: 'ONSITE',
  label: 'ONSITE',
  desc: 'หน้างาน — ไม่ต้องถ่ายรูป'
} ];

window.getDeptPrefix = function(department) {
  const d = String(department || '').toUpperCase();
  if (d.startsWith('AM')) return 'AM';
  if (d.startsWith('OD')) return 'OD';
  return d || '';
};

window.getTagBadge = function(tag, department) {
  if (!tag) return '';
  const palette = {
    AM: {
      solid: '#16a34a',
      tint: '#86efac',
      glow: 'rgba(22,163,74,.45)'
    },
    OD: {
      solid: '#ea580c',
      tint: '#fdba74',
      glow: 'rgba(234,88,12,.45)'
    }
  };
  const prefix = window.getDeptPrefix(department);
  const p = palette[prefix] || {
    solid: '#475569',
    tint: '#cbd5e1',
    glow: 'rgba(71,85,105,.4)'
  };
  const H = 18;
  const wrap = `display:inline-flex;align-items:stretch;margin-left:7px;vertical-align:middle;` + `border-radius:999px;overflow:hidden;font-size:9px;line-height:1;` + `white-space:nowrap;flex-shrink:0;height:${H}px;` + `box-shadow:0 1px 3px ${p.glow}, inset 0 0 0 1px ${p.solid}66;`;
  const cell = `display:flex;align-items:center;justify-content:center;box-sizing:border-box;height:100%;`;
  const left = cell + `background:${p.solid};color:#fff;padding:0 8.1px 0 9px;` + `font-weight:900;letter-spacing:.9px;text-shadow:0 1px 1px rgba(0,0,0,.28);`;
  const right = cell + `background:#0f172a;color:${p.tint};padding:0 9px 0 10px;` + `font-weight:800;letter-spacing:1px;border-left:1px solid rgba(255,255,255,.14);`;
  const nudge = `position:relative;top:.5px;display:block;`;
  const cellHtml = (style, txt) => `<span style="${style}"><span style="${nudge}">${txt}</span></span>`;
  if (!prefix) return `<span style="${wrap}">${cellHtml(right, tag)}</span>`;
  return `<span style="${wrap}">${cellHtml(left, prefix)}${cellHtml(right, tag)}</span>`;
};

window.getTagBadgeByName = function(name) {
  if (!window.GLOBAL_USER_LIST || !name) return '';
  const u = window.GLOBAL_USER_LIST.find((x => x.username && x.username.toLowerCase() === name.toLowerCase()));
  return u ? window.getTagBadge(u.tag, u.department) : '';
};

window._qnavItems = function() {
  const seen = new Set;
  const items = [];
  document.querySelectorAll("#sidebarNav [onclick*=\"showPage('\"]").forEach((btn => {
    if (btn.classList.contains('hidden')) return;
    const m = (btn.getAttribute('onclick') || '').match(/showPage\('([^']+)'\)/);
    if (!m || seen.has(m[1])) return;
    seen.add(m[1]);
    const label = btn.innerText.replace(/\s+/g, ' ').trim();
    if (label) items.push({
      page: m[1],
      label: label
    });
  }));
  return items;
};

window.openQuickNav = function() {
  let box = document.getElementById('quickNavBox');
  if (!box) {
    box = document.createElement('div');
    box.id = 'quickNavBox';
    box.style.cssText = 'position:fixed;inset:0;z-index:99990;display:none;align-items:flex-start;justify-content:center;padding-top:14vh;background:rgba(2,6,23,.75);backdrop-filter:blur(3px)';
    box.innerHTML = `\n            <div style="width:min(520px,92vw);background:var(--k-panel2);border:1px solid rgba(232,193,90,.35);border-radius:16px;box-shadow:0 24px 80px rgba(0,0,0,.7);overflow:hidden">\n                <div style="display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid rgba(148,163,184,.15)">\n                    <span class="material-icons" style="color:var(--k-gold-tx);font-size:20px">bolt</span>\n                    <input id="quickNavInput" placeholder="พิมพ์ชื่อหน้า... (เช่น ชีต, คลังรูป, จัดเวร)" autocomplete="off"\n                        style="flex:1;background:transparent;border:0;outline:none;color:var(--k-tx);font-size:15px;font-weight:600">\n                    <span style="font-size:10px;color:var(--k-mute);border:1px solid var(--k-line2);border-radius:5px;padding:2px 6px">Esc ปิด</span>\n                </div>\n                <div id="quickNavList" style="max-height:46vh;overflow-y:auto;padding:6px"></div>\n            </div>`;
    document.body.appendChild(box);
    box.addEventListener('mousedown', (e => {
      if (e.target === box) window.closeQuickNav();
    }));
    const input = box.querySelector('#quickNavInput');
    input.addEventListener('input', (() => window._qnavRender()));
    input.addEventListener('keydown', (e => {
      const rows = box.querySelectorAll('.qnav-row');
      let idx = [ ...rows ].findIndex((r => r.dataset.sel === '1'));
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        window._qnavSelect(rows, Math.min(rows.length - 1, idx + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        window._qnavSelect(rows, Math.max(0, idx - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const r = rows[idx >= 0 ? idx : 0];
        if (r) r.click();
      } else if (e.key === 'Escape') {
        window.closeQuickNav();
      }
    }));
  }
  box.style.display = 'flex';
  const input = box.querySelector('#quickNavInput');
  input.value = '';
  window._qnavRender();
  setTimeout((() => input.focus()), 30);
};

window.closeQuickNav = function() {
  const b = document.getElementById('quickNavBox');
  if (b) b.style.display = 'none';
};

window._qnavSelect = function(rows, i) {
  rows.forEach(((r, x) => {
    r.dataset.sel = x === i ? '1' : '';
    r.style.background = x === i ? 'rgba(232,193,90,.14)' : 'transparent';
    r.style.borderColor = x === i ? 'rgba(232,193,90,.4)' : 'transparent';
  }));
  if (rows[i]) rows[i].scrollIntoView({
    block: 'nearest'
  });
};

window._qnavRender = function() {
  const list = document.getElementById('quickNavList');
  if (!list) return;
  const q = (document.getElementById('quickNavInput').value || '').toLowerCase().trim();
  const items = window._qnavItems().filter((it => !q || it.label.toLowerCase().includes(q) || it.page.toLowerCase().includes(q)));
  if (!items.length) {
    list.innerHTML = '<div style="text-align:center;color:var(--k-mute);padding:20px;font-size:13px">ไม่พบหน้าที่ค้นหา</div>';
    return;
  }
  list.innerHTML = items.map(((it, i) => `\n        <div class="qnav-row" data-sel="${i === 0 ? '1' : ''}" onclick="closeQuickNav();showPage('${it.page}')"\n            onmouseenter="window._qnavSelect(document.querySelectorAll('.qnav-row'), ${i})"\n            style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;cursor:pointer;border:1px solid ${i === 0 ? 'rgba(232,193,90,.4)' : 'transparent'};background:${i === 0 ? 'rgba(232,193,90,.14)' : 'transparent'};color:var(--k-tx);font-size:14px;font-weight:600">\n            <span class="material-icons" style="font-size:17px;color:var(--k-tx3)">arrow_forward</span>${it.label}\n            <span style="margin-left:auto;font-size:10px;color:var(--k-mute3)">${it.page}</span>\n        </div>`)).join('');
};

document.addEventListener('keydown', (e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    window.openQuickNav();
  }
}));

window._prefetched = new Set;

window._prefetchPage = async function(name) {
  if (window._prefetched.has(name)) return;
  window._prefetched.add(name);
  try {
    const v = window._APP_VERSION || '';
    if (typeof pageCache !== 'undefined' && !pageCache[name]) {
      const r = await fetch(`./pages/${name}/${name}.html?v=${v}`);
      if (r.ok) pageCache[name] = await r.text();
    }
    if (typeof PAGE_SCRIPTS !== 'undefined') {
      for (const sn of PAGE_SCRIPTS[name] || []) {
        if (!window._loadedScripts || !window._loadedScripts[sn]) fetch(`./js/${sn}.js?v=${v}`).catch((() => {}));
      }
    }
  } catch (e) {
    window._prefetched.delete(name);
  }
};

document.addEventListener('mouseover', (e => {
  const btn = e.target.closest && e.target.closest("[onclick*=\"showPage('\"]");
  if (!btn) return;
  const m = (btn.getAttribute('onclick') || '').match(/showPage\('([^']+)'\)/);
  if (m) window._prefetchPage(m[1]);
}));

window._warmedUp = false;

window._warmupAllPages = async function() {
  if (window._warmedUp) return;
  window._warmedUp = true;
  const names = [ ...new Set([ ...typeof PAGE_SCRIPTS !== 'undefined' ? Object.keys(PAGE_SCRIPTS) : [], 'dashboard', 'announcement' ]) ];
  for (const n of names) {
    if (window._currentPageName === n) continue;
    await window._prefetchPage(n);
    await new Promise((r => setTimeout(r, 200)));
  }
  console.log('⚡ warm-up ครบทุกหน้าแล้ว — สลับหน้าจากนี้ไม่ต้องรอโหลดไฟล์อีก');
};

(function() {
  const bar = document.createElement('div');
  bar.id = 'netStatusBar';
  bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;display:none;align-items:center;justify-content:center;gap:8px;padding:8px;font-weight:800;font-size:13px;color:#fff;font-family:Sarabun,sans-serif';
  document.body.appendChild(bar);
  let hideTimer = null;
  const show = (msg, bg, autoHide) => {
    clearTimeout(hideTimer);
    bar.style.background = bg;
    bar.innerHTML = msg;
    bar.style.display = 'flex';
    if (autoHide) hideTimer = setTimeout((() => bar.style.display = 'none'), 3e3);
  };
  window.addEventListener('offline', (() => show('<span class="material-icons" style="font-size:17px">wifi_off</span> อินเทอร์เน็ตหลุด — ข้อมูลจะยังไม่ถูกบันทึกจนกว่าเน็ตจะกลับมา', '#dc2626', false)));
  window.addEventListener('online', (() => show('<span class="material-icons" style="font-size:17px">wifi</span> เน็ตกลับมาแล้ว ใช้งานต่อได้เลย', '#16a34a', true)));
})();

window.dbCache = {
  _m: new Map,
  get(key) {
    const e = this._m.get(key);
    if (e && Date.now() < e.exp) return e.val;
    this._m.delete(key);
    return undefined;
  },
  set(key, val, ttlMs) {
    this._m.set(key, {
      val: val,
      exp: Date.now() + (ttlMs || 6e4)
    });
  },
  bust(prefix) {
    [ ...this._m.keys() ].forEach((k => {
      if (!prefix || k.startsWith(prefix)) this._m.delete(k);
    }));
  }
};
