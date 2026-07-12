// ==========================================
// 🔐 ระบบจัดการ PIN 6 หลัก และ Login (V4 + Fingerprint)
// ==========================================
// 🌟 V4 Strategy:
//   1. Heartbeat ใช้ ipify.org (ฟรี ไม่จำกัด) เช็ค IP + FP
//   2. ถ้า IP เปลี่ยน → ค่อยเรียก ipapi.co ดึงข้อมูล Geo + ISP
//   3. ถ้า FP เปลี่ยน → บันทึกแยกเป็น event 'fp_change' (สลับเครื่อง!)
//   4. Insert Supabase เฉพาะตอนเปลี่ยนเท่านั้น
// ==========================================

// ==========================================================
// 🆔 [V4] Browser Fingerprint Module (Inline - Self-contained)
// ==========================================================

// 🎨 Canvas Fingerprint (ค่าจะต่างกันตาม GPU/Driver/OS)
function _fpCanvas() {
    try {
        const canvas = document.createElement('canvas');
        canvas.width = 280; canvas.height = 60;
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
    } catch (e) { return 'canvas-err'; }
}

// 🎮 WebGL Fingerprint (GPU vendor/renderer)
function _fpWebGL() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) return 'no-webgl';
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const vendor = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : '';
        const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
        return `${vendor}|${renderer}`;
    } catch (e) { return 'webgl-err'; }
}

// 🔤 SHA-256 → ตัด 16 ตัวอักษรแรก
async function _fpHash(text) {
    try {
        const buf = new TextEncoder().encode(text);
        const hash = await crypto.subtle.digest('SHA-256', buf);
        return Array.from(new Uint8Array(hash))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('').substring(0, 16);
    } catch (e) {
        // Fallback simple hash
        let h = 0;
        for (let i = 0; i < text.length; i++) {
            h = ((h << 5) - h) + text.charCodeAt(i); h |= 0;
        }
        return Math.abs(h).toString(16).padStart(16, '0').substring(0, 16);
    }
}

// 🆔 ฟังก์ชันหลัก: สร้าง Browser Fingerprint
window.getBrowserFingerprint = async function() {
    const parts = [
        navigator.userAgent || '',
        navigator.language || '',
        (navigator.languages || []).join(','),
        navigator.platform || '',
        `${screen.width}x${screen.height}x${screen.colorDepth}`,
        `${screen.availWidth}x${screen.availHeight}`,
        window.devicePixelRatio || 1,
        (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch(e){ return ''; }})(),
        new Date().getTimezoneOffset(),
        navigator.hardwareConcurrency || 0,
        navigator.deviceMemory || 0,
        navigator.maxTouchPoints || 0,
        _fpCanvas(),
        _fpWebGL(),
        navigator.cookieEnabled ? 1 : 0,
        'ontouchstart' in window ? 1 : 0
    ];
    return await _fpHash(parts.join('||'));
};

// 💾 Cache ใน sessionStorage (ไม่คำนวณซ้ำ)
window.getBrowserFingerprintCached = async function() {
    const cached = sessionStorage.getItem('__device_fp');
    if (cached && cached.length === 16) return cached;
    const fp = await window.getBrowserFingerprint();
    sessionStorage.setItem('__device_fp', fp);
    return fp;
};

// ==========================================
// 🔢 ระบบ PIN
// ==========================================

function setupPinInputs() {
    const inputs = document.querySelectorAll('.pin-box');
    if(inputs.length === 0) return;

    inputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, ''); 
            const val = e.target.value;
            if (val.length >= 1) {
                if (val.length > 1) e.target.value = val.slice(0, 1); 
                if (index < inputs.length - 1) inputs[index + 1].focus();
                checkAutoSubmit();
            }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                inputs[index - 1].focus();
                inputs[index - 1].value = '';
            }
            if (e.key === 'ArrowLeft' && index > 0) inputs[index - 1].focus();
            if (e.key === 'ArrowRight' && index < inputs.length - 1) inputs[index + 1].focus();
        });
        input.addEventListener('select', (e) => e.preventDefault());
        input.addEventListener('click', (e) => e.target.select());
    });
}

function handlePinPaste(e) {
    e.preventDefault();
    const pasteData = (e.clipboardData || window.clipboardData).getData('text');
    const pin = pasteData.replace(/\D/g, '').substring(0, 6); 
    const inputs = document.querySelectorAll('.pin-box');
    
    pin.split('').forEach((char, index) => {
        if (inputs[index]) inputs[index].value = char;
    });
    
    const nextIndex = Math.min(pin.length, inputs.length - 1);
    if(pin.length === 6) {
        inputs[inputs.length-1].focus();
        checkAutoSubmit();
    } else {
        inputs[nextIndex].focus();
    }
}

function getPinValue() {
    let pin = '';
    document.querySelectorAll('.pin-box').forEach(input => pin += input.value);
    return pin;
}

function clearPinInputs() {
    document.querySelectorAll('.pin-box').forEach(input => input.value = '');
}

function checkAutoSubmit() {
    const pin = getPinValue();
    if (pin.length === 6) {
        setTimeout(() => {
            const form = document.getElementById('loginForm');
            if (form) form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }, 100);
    }
}

// ==========================================================
// 🌐 [V4] ระบบเก็บประวัติ IP + FP - แยก 2 จังหวะ
// ==========================================================

// ⚙️ ตั้งค่า
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;   // เช็คทุก 5 นาที
const PROBE_TIMEOUT_MS      = 5000;             // timeout API 5 วินาที

// 🔑 ตัวแปรกลาง
window._ipHeartbeatInterval = null;
window._lastKnownIp = null;
window._lastKnownFp = null;
window._ipFailCount = 0;
window._ipVisibilityHandlerAttached = false;

// 🚀 [Step 1] เช็ค IP เร็วๆ — ใช้หลาย API หมุนกัน เพื่อกัน rate limit
async function probeCurrentIp() {
    const probes = [
        async () => {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
            try {
                const r = await fetch('https://api.ipify.org?format=json', { signal: ctrl.signal });
                const d = await r.json();
                return d.ip || null;
            } finally { clearTimeout(t); }
        },
        async () => {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
            try {
                const r = await fetch('https://www.cloudflare.com/cdn-cgi/trace', { signal: ctrl.signal });
                const txt = await r.text();
                const m = txt.match(/ip=([^\s]+)/);
                return m ? m[1] : null;
            } finally { clearTimeout(t); }
        },
        async () => {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
            try {
                const r = await fetch('https://api64.ipify.org?format=json', { signal: ctrl.signal });
                const d = await r.json();
                return d.ip || null;
            } finally { clearTimeout(t); }
        }
    ];

    for (const probe of probes) {
        try {
            const ip = await probe();
            if (ip) return ip;
        } catch (e) { /* ลองตัวต่อไป */ }
    }
    return null;
}

// 🌍 [Step 2] ดึงข้อมูลละเอียด — เรียกเฉพาะตอน IP เปลี่ยน (V5: เพิ่ม lat/lng/timezone/asn)
async function fetchIpDetails(ip) {
    const fallback = { ip: ip || 'unknown', country: '-', city: '-', isp: '-', latitude: null, longitude: null, timezone: null, asn: null };
    
    try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
        const r = await fetch(`https://ipapi.co/${ip}/json/`, { signal: ctrl.signal });
        clearTimeout(t);
        if (r.ok) {
            const d = await r.json();
            if (!d.error) {
                return {
                    ip:        d.ip || ip,
                    country:   d.country_name || '-',
                    city:      d.city || '-',
                    isp:       d.org || '-',
                    latitude:  d.latitude  || null,
                    longitude: d.longitude || null,
                    timezone:  d.timezone  || null,
                    asn:       d.asn       || null
                };
            }
        }
    } catch (e) { /* ใช้ fallback */ }
    
    try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
        const r = await fetch(`https://ipwho.is/${ip}`, { signal: ctrl.signal });
        clearTimeout(t);
        if (r.ok) {
            const d = await r.json();
            if (d.success !== false) {
                return {
                    ip:        d.ip || ip,
                    country:   d.country || '-',
                    city:      d.city || '-',
                    isp:       (d.connection && d.connection.isp) || '-',
                    latitude:  d.latitude  || null,
                    longitude: d.longitude || null,
                    timezone:  d.timezone  || null,
                    asn:       (d.connection && d.connection.asn) ? String(d.connection.asn) : null
                };
            }
        }
    } catch (e) {}
    
    return fallback;
}

// 💾 บันทึก Log ลง Supabase (V5: เพิ่ม lat/lng/timezone/asn)
async function writeIpLog(user, ipInfo, eventType, fingerprint) {
    if (!user || !user.id || !appDB) return;
    try {
        await appDB.from('user_ip_logs').insert([{
            user_id:     user.id,
            username:    user.username,
            ip_address:  ipInfo.ip,
            user_agent:  navigator.userAgent,
            country:     ipInfo.country,
            city:        ipInfo.city,
            isp:         ipInfo.isp,
            event_type:  eventType,
            fingerprint: fingerprint || null,
            latitude:    ipInfo.latitude  || null,
            longitude:   ipInfo.longitude || null,
            timezone:    ipInfo.timezone  || null,
            asn:         ipInfo.asn       || null
        }]);
    } catch (err) {
        console.warn('IP log error:', err);
    }
}

// 🚀 เรียกตอน Login สำเร็จ — ดึงข้อมูลครบและบันทึกเป็น 'login'
async function recordUserLoginIP(user) {
    if (!user || !user.id || !appDB) return;
    
    // 🆔 สร้าง FP (parallel กับการดึง IP เพื่อความเร็ว)
    const [ip, fp] = await Promise.all([
        probeCurrentIp(),
        window.getBrowserFingerprintCached()
    ]);
    
    if (!ip) {
        // 🌟 ดึง IP ไม่ได้เลย → log แบบไม่มีข้อมูล แต่ยังให้ Login ผ่าน
        await writeIpLog(user, { ip: 'unknown', country: '-', city: '-', isp: '-' }, 'login', fp);
        // 🆔 จำ FP ไว้แม้ไม่มี IP
        window._lastKnownFp = fp;
        sessionStorage.setItem('last_known_fp', fp);
        return;
    }

    const details = await fetchIpDetails(ip);
    await writeIpLog(user, details, 'login', fp);

    // 🌟 จำ IP + FP ไว้สำหรับเปรียบเทียบใน Heartbeat
    window._lastKnownIp = ip;
    window._lastKnownFp = fp;
    sessionStorage.setItem('last_known_ip', ip);
    sessionStorage.setItem('last_known_fp', fp);
}

// ⏰ Heartbeat - ทุก 5 นาที (ใช้ ipify เร็วๆ ไม่กิน quota)
async function checkIpHeartbeat() {
    const userStr = sessionStorage.getItem('user_platinum_plus');
    if (!userStr) {
        stopIpHeartbeat();
        return;
    }
    
    let user;
    try { user = JSON.parse(userStr); } catch(e) { return; }
    if (!user || !user.id) return;

    // 🌟 อย่าเช็คถ้าหน้าเว็บถูกซ่อน (Tab ปิด / Minimize) → ประหยัด API
    if (document.hidden) return;

    // 🌟 [Step 1] เช็ค IP + FP เร็วๆ (ทำพร้อมกัน)
    const [ip, fp] = await Promise.all([
        probeCurrentIp(),
        window.getBrowserFingerprintCached()
    ]);
    
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

    // 🟢 ทั้ง IP และ FP เหมือนเดิม → ไม่ต้องทำอะไร (ไม่เขียน DB เลย ✅)
    if (!ipChanged && !fpChanged && lastIp && lastFp) return;

    // 🟡 ไม่เคยมีข้อมูลเก็บไว้ → จำไว้ก่อน ไม่ต้อง log (กรณี F5 reload)
    if (!lastIp || !lastFp) {
        window._lastKnownIp = ip;
        window._lastKnownFp = fp;
        sessionStorage.setItem('last_known_ip', ip);
        sessionStorage.setItem('last_known_fp', fp);
        return;
    }

    // 🌍 ดึงรายละเอียด IP เฉพาะตอน IP เปลี่ยน
    const details = ipChanged
        ? await fetchIpDetails(ip)
        : { ip: ip, country: '-', city: '-', isp: '-' };

    // 🚨 IP เปลี่ยน → บันทึก ip_change
    if (ipChanged) {
        console.log(`[IP Watch] IP changed: ${lastIp} → ${ip}`);
        await writeIpLog(user, details, 'ip_change', fp);
        window._lastKnownIp = ip;
        sessionStorage.setItem('last_known_ip', ip);
    }

    // 🚨 FP เปลี่ยน → บันทึก fp_change (สลับเครื่อง! สำคัญมาก)
    if (fpChanged) {
        console.warn(`[FP Watch] Fingerprint changed: ${lastFp} → ${fp} - อาจมีการสลับเครื่อง!`);
        await writeIpLog(user, details, 'fp_change', fp);
        window._lastKnownFp = fp;
        sessionStorage.setItem('last_known_fp', fp);
    }
}

// ▶️ เริ่ม Heartbeat
window.startIpHeartbeat = function() {
    if (window._ipHeartbeatInterval) return; // ป้องกันสร้างซ้ำ
    
    window._ipHeartbeatInterval = setInterval(checkIpHeartbeat, HEARTBEAT_INTERVAL_MS);
    
    // 🌟 ตรวจทันทีตอนกลับมาที่ Tab (เผื่อพึ่งสลับ network)
    if (!window._ipVisibilityHandlerAttached) {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) checkIpHeartbeat();
        });
        window._ipVisibilityHandlerAttached = true;
    }
    
    console.log(`[IP+FP Watch] Heartbeat started (every ${HEARTBEAT_INTERVAL_MS/60000} min)`);
};

// ⏸️ หยุด Heartbeat
window.stopIpHeartbeat = function() {
    if (window._ipHeartbeatInterval) {
        clearInterval(window._ipHeartbeatInterval);
        window._ipHeartbeatInterval = null;
    }
};

// ==========================================
// 🔑 ฟังก์ชัน Login หลัก
// ==========================================
async function handleLogin(e) {
    if(e) e.preventDefault(); 
    const name = document.getElementById('loginName').value.trim(); 
    const pinInput = getPinValue(); 
    const remember = document.getElementById('rememberMe').checked;
    
    if(!name) return Swal.fire('แจ้งเตือน', 'กรุณากรอกชื่อพนักงาน', 'warning');
    if(pinInput.length !== 6) return; 

    Swal.fire({
        html: `
            <div style="padding:20px 10px">
                <div style="position:relative;width:60px;height:60px;margin:0 auto 16px">
                    <div style="position:absolute;inset:0;border-radius:50%;border:3px solid rgba(220,0,0,0.15)"></div>
                    <div style="position:absolute;inset:0;border-radius:50%;border:3px solid transparent;border-top-color:#cc0000;animation:spin .8s linear infinite"></div>
                    <div style="position:absolute;inset:8px;border-radius:50%;border:2px solid transparent;border-top-color:#ff6666;animation:spin .6s linear infinite reverse"></div>
                    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">
                        <svg width="22" height="22" viewBox="0 0 36 36" fill="none"><rect width="36" height="36" rx="8" fill="#111"/><polygon points="7,9 12,4 21,18 12,32 7,27 15,18" fill="#cc0000"/><polygon points="15,18 21,18 23,23 18,28 12,28" fill="#ff4444" opacity="0.85"/></svg>
                    </div>
                </div>
                <div style="font-size:15px;font-weight:700;color:#fff;margin-bottom:4px">กำลังตรวจสอบ</div>
                <div style="font-size:12px;color:#94a3b8">กรุณารอสักครู่...</div>
            </div>
            <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
        `,
        allowOutsideClick: false,
        showConfirmButton: false,
        background: '#0b1120',
        backdrop: 'rgba(0,0,0,0.7)',
        customClass: { popup: 'rounded-3xl border border-slate-700/50' }
    });

    try {
        const { data: users, error } = await appDB.from('users').select('*').ilike('username', name);
        
        if (error) {
            Swal.close(); clearPinInputs();
            return Swal.fire('Database Error', error.message, 'error');
        }

        if (!users || users.length === 0) { 
            Swal.close(); clearPinInputs(); 
            return Swal.fire({
                html: `
                    <div style="padding:16px 8px">
                        <div style="width:64px;height:64px;margin:0 auto 16px;background:rgba(234,179,8,0.12);border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid rgba(234,179,8,0.3)">
                            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        </div>
                        <div style="font-size:18px;font-weight:800;color:#fff;margin-bottom:8px">ไม่พบชื่อพนักงาน</div>
                        <div style="font-size:13px;color:#94a3b8">โปรดตรวจสอบตัวสะกดแล้วลองใหม่</div>
                    </div>
                `,
                background: '#0b1120',
                backdrop: 'rgba(0,0,0,0.75)',
                showConfirmButton: true,
                confirmButtonText: 'ลองใหม่',
                confirmButtonColor: '#854d0e',
                customClass: { popup: 'rounded-3xl border border-yellow-900/40', confirmButton: 'rounded-xl font-bold px-6' }
            }); 
        }

        const user = users[0];

        if (!user.password) {
            const { error: updateError } = await appDB.from('users').update({ password: pinInput }).eq('id', user.id);
            if (updateError) { 
                Swal.close(); clearPinInputs(); 
                return Swal.fire('Error', 'ไม่สามารถบันทึกรหัส PIN ได้', 'error'); 
            }
            user.password = pinInput; 
            await Swal.fire({ icon: 'success', title: 'ตั้งรหัส PIN สำเร็จ!', timer: 2000 });
        } 
        else if (user.password !== pinInput) {
            Swal.close(); clearPinInputs(); 
            if(typeof window.shakeLoginCard==='function') window.shakeLoginCard();
            return Swal.fire({
                html: `
                    <div style="padding:16px 8px">
                        <div style="width:64px;height:64px;margin:0 auto 16px;background:rgba(220,38,38,0.12);border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid rgba(220,38,38,0.3)">
                            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </div>
                        <div style="font-size:18px;font-weight:800;color:#fff;margin-bottom:8px">รหัส PIN ไม่ถูกต้อง</div>
                        <div style="font-size:13px;color:#94a3b8">กรุณาตรวจสอบรหัส PIN แล้วลองใหม่อีกครั้ง</div>
                    </div>
                `,
                background: '#0b1120',
                backdrop: 'rgba(0,0,0,0.75)',
                showConfirmButton: true,
                confirmButtonText: 'ลองใหม่',
                confirmButtonColor: '#cc0000',
                customClass: { popup: 'rounded-3xl border border-red-900/40', confirmButton: 'rounded-xl font-bold px-6' }
            });
        }

        if (remember) window.safeSetItem('remember_me_name', user.username); 
        else localStorage.removeItem('remember_me_name');
        
        if(typeof window.pinSuccessAnim==='function') window.pinSuccessAnim();
        await new Promise(r=>setTimeout(r,350));
        clearPinInputs();
        Swal.close();
        
        // 🌟 ล็อกอินสำเร็จ
        currentUser = user; 
        sessionStorage.setItem('user_platinum_plus', JSON.stringify(user));

        // 🌐 [V4] บันทึก IP + FP + เริ่ม Heartbeat (ไม่ block UI)
        recordUserLoginIP(user).then(() => window.startIpHeartbeat());

        if (typeof applySidebarPermissions === 'function') applySidebarPermissions();
        
        document.getElementById('login-container').innerHTML = ''; 
        document.getElementById('main-layout').classList.remove('hidden');
        showPage('dashboard');

    } catch (err) {
        console.error("Login Exception:", err);
        Swal.close(); clearPinInputs();
        Swal.fire({
                html: `
                    <div style="padding:16px 8px">
                        <div style="width:64px;height:64px;margin:0 auto 16px;background:rgba(220,38,38,0.12);border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid rgba(220,38,38,0.3)">
                            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        </div>
                        <div style="font-size:18px;font-weight:800;color:#fff;margin-bottom:8px">เชื่อมต่อไม่สำเร็จ</div>
                        <div style="font-size:13px;color:#94a3b8">เกิดข้อผิดพลาดในการเชื่อมต่อระบบ</div>
                    </div>
                `,
                background: '#0b1120',
                backdrop: 'rgba(0,0,0,0.75)',
                showConfirmButton: true,
                confirmButtonText: 'ตกลง',
                confirmButtonColor: '#cc0000',
                customClass: { popup: 'rounded-3xl border border-red-900/40', confirmButton: 'rounded-xl font-bold px-6' }
            });
    }
}

function logout() { 
    if (typeof window.stopIpHeartbeat === 'function') window.stopIpHeartbeat();
    
    sessionStorage.removeItem('user_platinum_plus'); 
    sessionStorage.removeItem('last_known_ip');
    sessionStorage.removeItem('last_known_fp');     // 🆔 ลบ FP cache ด้วย
    sessionStorage.removeItem('__device_fp');       // 🆔 ลบ FP cache device
    localStorage.removeItem('cached_menu_rules');
    location.reload(); 
}

// ==========================================
// 🔄 ดึงชื่อที่จำไว้ + เริ่ม Heartbeat ถ้ามี Session
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const savedName = localStorage.getItem('remember_me_name');
        const nameInput = document.getElementById('loginName');
        const rememberCheckbox = document.getElementById('rememberMe');

        if (savedName && nameInput && rememberCheckbox) {
            nameInput.value = savedName;
            rememberCheckbox.checked = true;
        }

        // 🌐 [V4] ถ้ามีคน Login ค้างไว้ (Refresh) → เริ่ม Heartbeat ต่อ
        const savedUser = sessionStorage.getItem('user_platinum_plus');
        if (savedUser && typeof window.startIpHeartbeat === 'function') {
            const startTimer = setInterval(() => {
                if (typeof appDB !== 'undefined' && appDB) {
                    clearInterval(startTimer);
                    // ตรวจ IP + FP ครั้งแรกทันที (เผื่อมีการเปลี่ยนระหว่างปิดเปิดเบราว์เซอร์)
                    checkIpHeartbeat();
                    window.startIpHeartbeat();
                }
            }, 500);
            
            setTimeout(() => clearInterval(startTimer), 30000);
        }
    }, 200); 
});
