function _fpCanvas() {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 280;
    canvas.height = 60;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-canvas';
    ctx.textBaseline = 'top';
    ctx.font = '14px "Arial"';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('FP-Check 🌐 ตรวจสอบ', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('FP-Check 🌐 ตรวจสอบ', 4, 17);
    return canvas.toDataURL();
  } catch (e) {
    return 'canvas-err';
  }
}

function _fpWebGL() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return 'no-webgl';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const vendor = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : '';
    const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
    return `${vendor}|${renderer}`;
  } catch (e) {
    return 'webgl-err';
  }
}

async function _fpHash(text) {
  try {
    const buf = (new TextEncoder).encode(text);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map((b => b.toString(16).padStart(2, '0'))).join('').substring(0, 16);
  } catch (e) {
    let h = 0;
    for (let i = 0; i < text.length; i++) {
      h = (h << 5) - h + text.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h).toString(16).padStart(16, '0').substring(0, 16);
  }
}

window.getBrowserFingerprint = async function() {
  const parts = [ navigator.userAgent || '', navigator.language || '', (navigator.languages || []).join(','), navigator.platform || '', `${screen.width}x${screen.height}x${screen.colorDepth}`, `${screen.availWidth}x${screen.availHeight}`, window.devicePixelRatio || 1, (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch (e) {
      return '';
    }
  })(), (new Date).getTimezoneOffset(), navigator.hardwareConcurrency || 0, navigator.deviceMemory || 0, navigator.maxTouchPoints || 0, _fpCanvas(), _fpWebGL(), navigator.cookieEnabled ? 1 : 0, 'ontouchstart' in window ? 1 : 0 ];
  return await _fpHash(parts.join('||'));
};

window.getBrowserFingerprintCached = async function() {
  const cached = sessionStorage.getItem('__device_fp');
  if (cached && cached.length === 16) return cached;
  const fp = await window.getBrowserFingerprint();
  sessionStorage.setItem('__device_fp', fp);
  return fp;
};

function setupPinInputs() {
  const inputs = document.querySelectorAll('.pin-box');
  if (inputs.length === 0) return;
  inputs.forEach(((input, index) => {
    input.addEventListener('input', (e => {
      e.target.value = e.target.value.replace(/[^0-9]/g, '');
      const val = e.target.value;
      if (val.length >= 1) {
        if (val.length > 1) e.target.value = val.slice(0, 1);
        if (index < inputs.length - 1) inputs[index + 1].focus();
        checkAutoSubmit();
      }
    }));
    input.addEventListener('keydown', (e => {
      if (e.key === 'Backspace' && !e.target.value && index > 0) {
        inputs[index - 1].focus();
        inputs[index - 1].value = '';
      }
      if (e.key === 'ArrowLeft' && index > 0) inputs[index - 1].focus();
      if (e.key === 'ArrowRight' && index < inputs.length - 1) inputs[index + 1].focus();
    }));
    input.addEventListener('select', (e => e.preventDefault()));
    input.addEventListener('click', (e => e.target.select()));
  }));
}

function handlePinPaste(e) {
  e.preventDefault();
  const pasteData = (e.clipboardData || window.clipboardData).getData('text');
  const pin = pasteData.replace(/\D/g, '').substring(0, 6);
  const inputs = document.querySelectorAll('.pin-box');
  pin.split('').forEach(((char, index) => {
    if (inputs[index]) inputs[index].value = char;
  }));
  const nextIndex = Math.min(pin.length, inputs.length - 1);
  if (pin.length === 6) {
    inputs[inputs.length - 1].focus();
    checkAutoSubmit();
  } else {
    inputs[nextIndex].focus();
  }
}

function getPinValue() {
  let pin = '';
  document.querySelectorAll('.pin-box').forEach((input => pin += input.value));
  return pin;
}

function clearPinInputs() {
  document.querySelectorAll('.pin-box').forEach((input => input.value = ''));
}

function checkAutoSubmit() {
  const pin = getPinValue();
  if (pin.length === 6) {
    setTimeout((() => {
      const form = document.getElementById('loginForm');
      if (form) form.dispatchEvent(new Event('submit', {
        cancelable: true,
        bubbles: true
      }));
    }), 100);
  }
}

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1e3;

const PROBE_TIMEOUT_MS = 5e3;

window._ipHeartbeatInterval = null;

window._lastKnownIp = null;

window._lastKnownFp = null;

window._ipFailCount = 0;

window._ipVisibilityHandlerAttached = false;

window._ipProbe = {
  p: null,
  ts: 0
};

window._finishLoginAfterIp = async function(user, remember) {
  if (remember) window.safeSetItem('remember_me_name', user.username); else localStorage.removeItem('remember_me_name');
  if (typeof window.pinSuccessAnim === 'function') window.pinSuccessAnim();
  if (typeof window._loginBeepSuccess === 'function') window._loginBeepSuccess();
  await new Promise((r => setTimeout(r, 120)));
  clearPinInputs();
  Swal.close();
  currentUser = user;
  user._loginAt = Date.now();
  sessionStorage.setItem('user_platinum_plus', JSON.stringify(user));
  if (typeof window.subscribeUserChanges === 'function') window.subscribeUserChanges();
  if (typeof window.subscribeBoardEvents === 'function') window.subscribeBoardEvents();
  recordUserLoginIP(user).then((() => window.startIpHeartbeat()));
  if (typeof window.startVersionWatch === 'function') window.startVersionWatch();
  if (typeof applySidebarPermissions === 'function') applySidebarPermissions();
  document.getElementById('login-container').innerHTML = '';
  document.getElementById('main-layout').classList.remove('hidden');
  showPage('dashboard');
};

window._waitForAllowedIp = function(user, remember, ipCfg, matchesFn, firstIp) {
  let timer = null;
  let checking = false;
  Swal.fire({
    html: `\n            <div style="padding:16px 8px">\n                <div style="width:64px;height:64px;margin:0 auto 16px;background:rgba(232,193,90,0.1);border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid rgba(232,193,90,0.35)">\n                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#E8C15A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3z"/></svg>\n                </div>\n                <div style="font-size:18px;font-weight:800;color:var(--k-tx-strong);margin-bottom:8px">IP ยังไม่ได้รับอนุญาต</div>\n                <div style="font-size:13px;color:var(--k-tx3);line-height:1.8">\n                    IP ปัจจุบัน: <span id="ipWaitCur" style="font-family:monospace;color:var(--k-red-tx);font-weight:700">${firstIp || 'ตรวจไม่ได้'}</span>\n                    <span style="display:inline-block;width:10px;height:10px;border:2px solid #E8C15A;border-top-color:transparent;border-radius:50%;margin-left:6px;vertical-align:-1px;animation:ipspin 0.8s linear infinite"></span><br>\n                    เปิด VPN ให้ตรง IP ที่กำหนดได้เลย<br><b style="color:var(--k-gold-tx)">ระบบเช็คให้อัตโนมัติ ผ่านปุ๊บพาเข้าทันที</b>\n                </div>\n                <style>@keyframes ipspin{to{transform:rotate(360deg)}}</style>\n            </div>`,
    background: '#0b1120',
    backdrop: 'rgba(0,0,0,0.85)',
    allowOutsideClick: false,
    showConfirmButton: true,
    confirmButtonText: 'ยกเลิก',
    confirmButtonColor: '#334155',
    customClass: {
      popup: 'rounded-3xl border border-yellow-900/40',
      confirmButton: 'rounded-xl font-bold px-6'
    },
    didOpen: () => {
      timer = setInterval((async () => {
        if (checking) return;
        checking = true;
        try {
          const ip = await probeCurrentIp().catch((() => null));
          window._ipProbe = {
            p: Promise.resolve(ip),
            ts: Date.now()
          };
          const el = document.getElementById('ipWaitCur');
          if (el && ip) el.textContent = ip;
          const ok = ip && (ipCfg.ips || []).some((x => matchesFn(ip, x.ip)));
          if (ok) {
            clearInterval(timer);
            timer = null;
            if (el) el.style.color = '#4ade80';
            try {
              await appDB.from('system_logs').insert([ {
                action_type: 'IP ผ่านหลังเปิด VPN',
                performed_by: user.username,
                target_details: `IP ใหม่ ${ip} อยู่ในรายการอนุญาต — เข้าระบบอัตโนมัติ`
              } ]);
            } catch (e) {}
            await window._finishLoginAfterIp(user, remember);
          }
        } finally {
          checking = false;
        }
      }), 4e3);
    },
    willClose: () => {
      if (timer) clearInterval(timer);
    }
  });
};

window.prewarmIpProbe = function() {
  if (window._ipProbe.p && Date.now() - window._ipProbe.ts < 12e4) return window._ipProbe.p;
  window._ipProbe = {
    p: probeCurrentIp().catch((() => null)),
    ts: Date.now()
  };
  return window._ipProbe.p;
};

async function probeCurrentIp() {
  const probes = [ async () => {
    const ctrl = new AbortController;
    const t = setTimeout((() => ctrl.abort()), PROBE_TIMEOUT_MS);
    try {
      const r = await fetch('https://api.ipify.org?format=json', {
        signal: ctrl.signal
      });
      const d = await r.json();
      return d.ip || null;
    } finally {
      clearTimeout(t);
    }
  }, async () => {
    const ctrl = new AbortController;
    const t = setTimeout((() => ctrl.abort()), PROBE_TIMEOUT_MS);
    try {
      const r = await fetch('https://www.cloudflare.com/cdn-cgi/trace', {
        signal: ctrl.signal
      });
      const txt = await r.text();
      const m = txt.match(/ip=([^\s]+)/);
      return m ? m[1] : null;
    } finally {
      clearTimeout(t);
    }
  }, async () => {
    const ctrl = new AbortController;
    const t = setTimeout((() => ctrl.abort()), PROBE_TIMEOUT_MS);
    try {
      const r = await fetch('https://api64.ipify.org?format=json', {
        signal: ctrl.signal
      });
      const d = await r.json();
      return d.ip || null;
    } finally {
      clearTimeout(t);
    }
  } ];
  for (const probe of probes) {
    try {
      const ip = await probe();
      if (ip) return ip;
    } catch (e) {}
  }
  return null;
}

async function fetchIpDetails(ip) {
  const fallback = {
    ip: ip || 'unknown',
    country: '-',
    city: '-',
    isp: '-',
    latitude: null,
    longitude: null,
    timezone: null,
    asn: null
  };
  try {
    const ctrl = new AbortController;
    const t = setTimeout((() => ctrl.abort()), PROBE_TIMEOUT_MS);
    const r = await fetch(`https://ipapi.co/${ip}/json/`, {
      signal: ctrl.signal
    });
    clearTimeout(t);
    if (r.ok) {
      const d = await r.json();
      if (!d.error) {
        return {
          ip: d.ip || ip,
          country: d.country_name || '-',
          city: d.city || '-',
          isp: d.org || '-',
          latitude: d.latitude || null,
          longitude: d.longitude || null,
          timezone: d.timezone || null,
          asn: d.asn || null
        };
      }
    }
  } catch (e) {}
  try {
    const ctrl = new AbortController;
    const t = setTimeout((() => ctrl.abort()), PROBE_TIMEOUT_MS);
    const r = await fetch(`https://ipwho.is/${ip}`, {
      signal: ctrl.signal
    });
    clearTimeout(t);
    if (r.ok) {
      const d = await r.json();
      if (d.success !== false) {
        return {
          ip: d.ip || ip,
          country: d.country || '-',
          city: d.city || '-',
          isp: d.connection && d.connection.isp || '-',
          latitude: d.latitude || null,
          longitude: d.longitude || null,
          timezone: d.timezone || null,
          asn: d.connection && d.connection.asn ? String(d.connection.asn) : null
        };
      }
    }
  } catch (e) {}
  return fallback;
}

async function writeIpLog(user, ipInfo, eventType, fingerprint) {
  if (!user || !user.id || !appDB) return;
  try {
    await appDB.from('user_ip_logs').insert([ {
      user_id: user.id,
      username: user.username,
      ip_address: ipInfo.ip,
      user_agent: navigator.userAgent,
      country: ipInfo.country,
      city: ipInfo.city,
      isp: ipInfo.isp,
      event_type: eventType,
      fingerprint: fingerprint || null,
      latitude: ipInfo.latitude || null,
      longitude: ipInfo.longitude || null,
      timezone: ipInfo.timezone || null,
      asn: ipInfo.asn || null
    } ]);
  } catch (err) {
    console.warn('IP log error:', err);
  }
}

async function recordUserLoginIP(user) {
  if (!user || !user.id || !appDB) return;
  const [ip, fp] = await Promise.all([ probeCurrentIp(), window.getBrowserFingerprintCached() ]);
  if (!ip) {
    await writeIpLog(user, {
      ip: 'unknown',
      country: '-',
      city: '-',
      isp: '-'
    }, 'login', fp);
    window._lastKnownFp = fp;
    sessionStorage.setItem('last_known_fp', fp);
    return;
  }
  const details = await fetchIpDetails(ip);
  await writeIpLog(user, details, 'login', fp);
  window._lastKnownIp = ip;
  window._lastKnownFp = fp;
  sessionStorage.setItem('last_known_ip', ip);
  sessionStorage.setItem('last_known_fp', fp);
}

async function checkIpHeartbeat() {
  const userStr = sessionStorage.getItem('user_platinum_plus');
  if (!userStr) {
    stopIpHeartbeat();
    return;
  }
  let user;
  try {
    user = JSON.parse(userStr);
  } catch (e) {
    return;
  }
  if (!user || !user.id) return;
  if (document.hidden) return;
  const [ip, fp] = await Promise.all([ probeCurrentIp(), window.getBrowserFingerprintCached() ]);
  if (!ip) {
    window._ipFailCount++;
    if (window._ipFailCount >= 3) {
      console.warn('[IP Watch] เช็ค IP ล้มเหลว 3 ครั้งติดต่อกัน');
      window._ipFailCount = 0;
    }
    return;
  }
  window._ipFailCount = 0;
  const lastIp = window._lastKnownIp || sessionStorage.getItem('last_known_ip');
  const lastFp = window._lastKnownFp || sessionStorage.getItem('last_known_fp');
  const ipChanged = lastIp && lastIp !== ip;
  const fpChanged = lastFp && lastFp !== fp;
  if (!ipChanged && !fpChanged && lastIp && lastFp) return;
  if (!lastIp || !lastFp) {
    window._lastKnownIp = ip;
    window._lastKnownFp = fp;
    sessionStorage.setItem('last_known_ip', ip);
    sessionStorage.setItem('last_known_fp', fp);
    return;
  }
  const details = ipChanged ? await fetchIpDetails(ip) : {
    ip: ip,
    country: '-',
    city: '-',
    isp: '-'
  };
  if (ipChanged) {
    console.log(`[IP Watch] IP changed: ${lastIp} → ${ip}`);
    await writeIpLog(user, details, 'ip_change', fp);
    window._lastKnownIp = ip;
    sessionStorage.setItem('last_known_ip', ip);
  }
  if (fpChanged) {
    console.warn(`[FP Watch] Fingerprint changed: ${lastFp} → ${fp} - อาจมีการสลับเครื่อง!`);
    await writeIpLog(user, details, 'fp_change', fp);
    window._lastKnownFp = fp;
    sessionStorage.setItem('last_known_fp', fp);
  }
}

window.startIpHeartbeat = function() {
  if (window._ipHeartbeatInterval) return;
  window._ipHeartbeatInterval = setInterval(checkIpHeartbeat, HEARTBEAT_INTERVAL_MS);
  if (!window._ipVisibilityHandlerAttached) {
    document.addEventListener('visibilitychange', (() => {
      if (!document.hidden) checkIpHeartbeat();
    }));
    window._ipVisibilityHandlerAttached = true;
  }
  console.log(`[IP+FP Watch] Heartbeat started (every ${HEARTBEAT_INTERVAL_MS / 6e4} min)`);
};

window.stopIpHeartbeat = function() {
  if (window._ipHeartbeatInterval) {
    clearInterval(window._ipHeartbeatInterval);
    window._ipHeartbeatInterval = null;
  }
};

async function handleLogin(e) {
  if (e) e.preventDefault();
  const name = document.getElementById('loginName').value.trim();
  const pinInput = getPinValue();
  const remember = document.getElementById('rememberMe').checked;
  if (!name) return Swal.fire('แจ้งเตือน', 'กรุณากรอกชื่อพนักงาน', 'warning');
  if (pinInput.length !== 6) return;
  Swal.fire({
    html: `\n            <div style="padding:20px 10px">\n                <div style="position:relative;width:60px;height:60px;margin:0 auto 16px">\n                    <div style="position:absolute;inset:0;border-radius:50%;border:3px solid rgba(220,0,0,0.15)"></div>\n                    <div style="position:absolute;inset:0;border-radius:50%;border:3px solid transparent;border-top-color:#cc0000;animation:spin .8s linear infinite"></div>\n                    <div style="position:absolute;inset:8px;border-radius:50%;border:2px solid transparent;border-top-color:#ff6666;animation:spin .6s linear infinite reverse"></div>\n                    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">\n                        <svg width="22" height="22" viewBox="0 0 36 36" fill="none"><rect width="36" height="36" rx="8" fill="#111"/><polygon points="7,9 12,4 21,18 12,32 7,27 15,18" fill="#cc0000"/><polygon points="15,18 21,18 23,23 18,28 12,28" fill="#ff4444" opacity="0.85"/></svg>\n                    </div>\n                </div>\n                <div style="font-size:15px;font-weight:700;color:var(--k-tx-strong);margin-bottom:4px">กำลังตรวจสอบ</div>\n                <div style="font-size:12px;color:var(--k-tx3)">กรุณารอสักครู่...</div>\n            </div>\n            <style>@keyframes spin{to{transform:rotate(360deg)}}</style>\n        `,
    allowOutsideClick: false,
    showConfirmButton: false,
    background: '#0b1120',
    backdrop: 'rgba(0,0,0,0.7)',
    customClass: {
      popup: 'rounded-3xl border border-slate-700/50'
    }
  });
  try {
    const _wlPromise = appDB.from('settings').select('value').eq('key', 'ip_whitelist').maybeSingle().then((r => r)).catch((() => ({
      data: null
    })));
    window.prewarmIpProbe();
    const {data: loginRes, error: error} = await appDB.rpc('verify_login', {
      p_username: name,
      p_pin: pinInput
    });
    const loginStatus = loginRes && loginRes.status;
    const users = loginStatus === 'ok' || loginStatus === 'first_set' ? [ loginRes.user ] : [];
    if (error) {
      Swal.close();
      clearPinInputs();
      return Swal.fire('Database Error', error.message, 'error');
    }
    if (loginStatus === 'not_found') {
      Swal.close();
      clearPinInputs();
      return Swal.fire({
        html: `\n                    <div style="padding:16px 8px">\n                        <div style="width:64px;height:64px;margin:0 auto 16px;background:rgba(234,179,8,0.12);border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid rgba(234,179,8,0.3)">\n                            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>\n                        </div>\n                        <div style="font-size:18px;font-weight:800;color:var(--k-tx-strong);margin-bottom:8px">ไม่พบชื่อพนักงาน</div>\n                        <div style="font-size:13px;color:var(--k-tx3)">โปรดตรวจสอบตัวสะกดแล้วลองใหม่</div>\n                    </div>\n                `,
        background: '#0b1120',
        backdrop: 'rgba(0,0,0,0.75)',
        showConfirmButton: true,
        confirmButtonText: 'ลองใหม่',
        confirmButtonColor: '#854d0e',
        customClass: {
          popup: 'rounded-3xl border border-yellow-900/40',
          confirmButton: 'rounded-xl font-bold px-6'
        }
      });
    }
    const user = users[0] || null;
    if (loginStatus === 'first_set') {
      await Swal.fire({
        icon: 'success',
        title: 'ตั้งรหัส PIN สำเร็จ!',
        timer: 2e3
      });
    } else if (loginStatus !== 'ok') {
      Swal.close();
      clearPinInputs();
      if (typeof window.shakeLoginCard === 'function') window.shakeLoginCard();
      if (typeof window._loginBeepError === 'function') window._loginBeepError();
      return Swal.fire({
        html: `\n                    <div style="padding:16px 8px">\n                        <div style="width:64px;height:64px;margin:0 auto 16px;background:rgba(220,38,38,0.12);border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid rgba(220,38,38,0.3)">\n                            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>\n                        </div>\n                        <div style="font-size:18px;font-weight:800;color:var(--k-tx-strong);margin-bottom:8px">รหัส PIN ไม่ถูกต้อง</div>\n                        <div style="font-size:13px;color:var(--k-tx3)">กรุณาตรวจสอบรหัส PIN แล้วลองใหม่อีกครั้ง</div>\n                    </div>\n                `,
        background: '#0b1120',
        backdrop: 'rgba(0,0,0,0.75)',
        showConfirmButton: true,
        confirmButtonText: 'ลองใหม่',
        confirmButtonColor: '#cc0000',
        customClass: {
          popup: 'rounded-3xl border border-red-900/40',
          confirmButton: 'rounded-xl font-bold px-6'
        }
      });
    }
    try {
      const {data: ipCfgRow} = await _wlPromise;
      const ipCfg = ipCfgRow && ipCfgRow.value ? JSON.parse(ipCfgRow.value) : null;
      if (ipCfg && ipCfg.enabled && user) {
        const curIp = await window.prewarmIpProbe();
        const matches = (ip, pattern) => {
          if (!ip || !pattern) return false;
          if (pattern.includes('*')) return ip.startsWith(pattern.replace(/\*+$/, ''));
          return ip === pattern;
        };
        let allowed = curIp && (ipCfg.ips || []).some((x => matches(curIp, x.ip)));
        let liveIp = curIp;
        if (!allowed) {
          liveIp = await probeCurrentIp().catch((() => null)) || curIp;
          window._ipProbe = {
            p: Promise.resolve(liveIp),
            ts: Date.now()
          };
          allowed = liveIp && (ipCfg.ips || []).some((x => matches(liveIp, x.ip)));
        }
        if (!allowed) {
          try {
            await appDB.from('system_logs').insert([ {
              action_type: 'ถูกบล็อก IP',
              performed_by: user.username,
              target_details: `พยายามเข้าระบบจาก IP ${liveIp || 'ตรวจไม่ได้'} ซึ่งไม่อยู่ในรายการที่อนุญาต`
            } ]);
          } catch (e2) {}
          Swal.close();
          clearPinInputs();
          if (typeof window.shakeLoginCard === 'function') window.shakeLoginCard();
          window._waitForAllowedIp(user, remember, ipCfg, matches, liveIp);
          return;
        }
      }
    } catch (ipErr) {
      console.error('IP allowlist check:', ipErr);
    }
    await window._finishLoginAfterIp(user, remember);
  } catch (err) {
    console.error("Login Exception:", err);
    Swal.close();
    clearPinInputs();
    Swal.fire({
      html: `\n                    <div style="padding:16px 8px">\n                        <div style="width:64px;height:64px;margin:0 auto 16px;background:rgba(220,38,38,0.12);border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid rgba(220,38,38,0.3)">\n                            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>\n                        </div>\n                        <div style="font-size:18px;font-weight:800;color:var(--k-tx-strong);margin-bottom:8px">เชื่อมต่อไม่สำเร็จ</div>\n                        <div style="font-size:13px;color:var(--k-tx3)">เกิดข้อผิดพลาดในการเชื่อมต่อระบบ</div>\n                    </div>\n                `,
      background: '#0b1120',
      backdrop: 'rgba(0,0,0,0.75)',
      showConfirmButton: true,
      confirmButtonText: 'ตกลง',
      confirmButtonColor: '#cc0000',
      customClass: {
        popup: 'rounded-3xl border border-red-900/40',
        confirmButton: 'rounded-xl font-bold px-6'
      }
    });
  }
}

function logout() {
  if (typeof window.stopIpHeartbeat === 'function') window.stopIpHeartbeat();
  sessionStorage.removeItem('user_platinum_plus');
  sessionStorage.removeItem('last_known_ip');
  sessionStorage.removeItem('last_known_fp');
  sessionStorage.removeItem('__device_fp');
  localStorage.removeItem('cached_menu_rules');
  location.reload();
}

document.addEventListener('DOMContentLoaded', (() => {
  setTimeout((() => {
    const savedName = localStorage.getItem('remember_me_name');
    const nameInput = document.getElementById('loginName');
    const rememberCheckbox = document.getElementById('rememberMe');
    if (savedName && nameInput && rememberCheckbox) {
      nameInput.value = savedName;
      rememberCheckbox.checked = true;
    }
    const savedUser = sessionStorage.getItem('user_platinum_plus');
    if (savedUser && typeof window.startIpHeartbeat === 'function') {
      const startTimer = setInterval((() => {
        if (typeof appDB !== 'undefined' && appDB) {
          clearInterval(startTimer);
          checkIpHeartbeat();
          window.startIpHeartbeat();
          if (typeof window.startVersionWatch === 'function') window.startVersionWatch();
        }
      }), 500);
      setTimeout((() => clearInterval(startTimer)), 3e4);
    }
  }), 200);
}));
