// ==========================================
// 🔐 ระบบจัดการ PIN 6 หลัก และ Login (V3 Optimized)
// ==========================================
// 🌟 V3 Strategy:
//   1. Heartbeat ใช้ ipify.org (ฟรี ไม่จำกัด) เช็คแค่ IP เร็วๆ
//   2. ถ้า IP เปลี่ยน → ค่อยเรียก ipapi.co ดึงข้อมูล Geo + ISP
//   3. Insert Supabase เฉพาะตอนเปลี่ยนเท่านั้น
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
// 🌐 [V3] ระบบเก็บประวัติ IP - แยก 2 จังหวะ
// ==========================================================

// ⚙️ ตั้งค่า
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;   // เช็คทุก 5 นาที (ผู้ใช้เลือก)
const PROBE_TIMEOUT_MS      = 5000;             // timeout API 5 วินาที

// 🔑 ตัวแปรกลาง
window._ipHeartbeatInterval = null;
window._lastKnownIp = null;
window._ipFailCount = 0;
window._ipVisibilityHandlerAttached = false;

// 🚀 [Step 1] เช็ค IP เร็วๆ — ใช้หลาย API หมุนกัน เพื่อกัน rate limit
async function probeCurrentIp() {
    // 🌟 ลำดับการลอง: ipify (ไม่จำกัด) → cloudflare (ไม่จำกัด) → ipapi (สำรอง)
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

// 🌍 [Step 2] ดึงข้อมูลละเอียด — เรียกเฉพาะตอน IP เปลี่ยน
async function fetchIpDetails(ip) {
    const fallback = { ip: ip || 'unknown', country: '-', city: '-', isp: '-' };
    
    try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
        // 🌟 ipapi.co รับ IP เฉพาะตัวเลย ไม่ต้อง /json/
        const r = await fetch(`https://ipapi.co/${ip}/json/`, { signal: ctrl.signal });
        clearTimeout(t);
        if (r.ok) {
            const d = await r.json();
            return {
                ip:      d.ip || ip,
                country: d.country_name || '-',
                city:    d.city || '-',
                isp:     d.org || '-'
            };
        }
    } catch (e) { /* ใช้ fallback */ }
    
    // 🌟 ตัวสำรอง (ipwho.is - ฟรี ไม่จำกัด)
    try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
        const r = await fetch(`https://ipwho.is/${ip}`, { signal: ctrl.signal });
        clearTimeout(t);
        if (r.ok) {
            const d = await r.json();
            if (d.success !== false) {
                return {
                    ip:      d.ip || ip,
                    country: d.country || '-',
                    city:    d.city || '-',
                    isp:     (d.connection && d.connection.isp) || '-'
                };
            }
        }
    } catch (e) {}
    
    return fallback;
}

// 💾 บันทึก Log ลง Supabase
async function writeIpLog(user, ipInfo, eventType) {
    if (!user || !user.id || !appDB) return;
    try {
        await appDB.from('user_ip_logs').insert([{
            user_id:    user.id,
            username:   user.username,
            ip_address: ipInfo.ip,
            user_agent: navigator.userAgent,
            country:    ipInfo.country,
            city:       ipInfo.city,
            isp:        ipInfo.isp,
            event_type: eventType
        }]);
    } catch (err) {
        console.warn('IP log error:', err);
    }
}

// 🚀 เรียกตอน Login สำเร็จ — ดึงข้อมูลครบและบันทึกเป็น 'login'
async function recordUserLoginIP(user) {
    if (!user || !user.id || !appDB) return;
    
    const ip = await probeCurrentIp();
    if (!ip) {
        // 🌟 ดึง IP ไม่ได้เลย → log แบบไม่มีข้อมูล แต่ยังให้ Login ผ่าน
        await writeIpLog(user, { ip: 'unknown', country: '-', city: '-', isp: '-' }, 'login');
        return;
    }

    const details = await fetchIpDetails(ip);
    await writeIpLog(user, details, 'login');

    // 🌟 จำ IP นี้ไว้สำหรับเปรียบเทียบใน Heartbeat
    window._lastKnownIp = ip;
    sessionStorage.setItem('last_known_ip', ip);
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

    // 🌟 [Step 1] เช็ค IP เร็วๆ (ฟรี ไม่จำกัด)
    const ip = await probeCurrentIp();
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

    // 🟢 IP เหมือนเดิม → ไม่ต้องทำอะไร (ไม่เขียน DB เลย ✅)
    if (lastIp === ip) return;

    // 🟡 ไม่เคยมี IP เก็บไว้ → จำไว้ก่อน ไม่ต้อง log (กรณี F5 reload)
    if (!lastIp) {
        window._lastKnownIp = ip;
        sessionStorage.setItem('last_known_ip', ip);
        return;
    }

    // 🚨 [Step 2] IP เปลี่ยน! → ค่อยเรียก API ละเอียด + บันทึก DB
    console.log(`[IP Watch] IP changed: ${lastIp} → ${ip}`);
    const details = await fetchIpDetails(ip);
    await writeIpLog(user, details, 'ip_change');
    
    window._lastKnownIp = ip;
    sessionStorage.setItem('last_known_ip', ip);
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
    
    console.log(`[IP Watch] Heartbeat started (every ${HEARTBEAT_INTERVAL_MS/60000} min)`);
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

    Swal.fire({title: 'กำลังตรวจสอบ...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});

    try {
        const { data: users, error } = await appDB.from('users').select('*').ilike('username', name);
        
        if (error) {
            Swal.close(); clearPinInputs();
            return Swal.fire('Database Error', error.message, 'error');
        }

        if (!users || users.length === 0) { 
            Swal.close(); clearPinInputs(); 
            return Swal.fire('Error', 'ไม่พบชื่อพนักงานนี้ในระบบ (โปรดเช็คตัวสะกด)', 'error'); 
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
            return Swal.fire('ผิดพลาด', 'รหัส PIN ไม่ถูกต้อง', 'error');
        }

        if (remember) localStorage.setItem('remember_me_name', user.username); 
        else localStorage.removeItem('remember_me_name');
        
        clearPinInputs();
        Swal.close();
        
        // 🌟 ล็อกอินสำเร็จ
        currentUser = user; 
        sessionStorage.setItem('user_platinum_plus', JSON.stringify(user));

        // 🌐 [V3] บันทึก IP + เริ่ม Heartbeat (ไม่ block UI)
        recordUserLoginIP(user).then(() => window.startIpHeartbeat());

        if (typeof applySidebarPermissions === 'function') applySidebarPermissions();
        
        document.getElementById('login-container').innerHTML = ''; 
        document.getElementById('main-layout').classList.remove('hidden');
        showPage('dashboard');

    } catch (err) {
        console.error("Login Exception:", err);
        Swal.close(); clearPinInputs();
        Swal.fire('Error', 'เกิดข้อผิดพลาดในการเชื่อมต่อระบบ', 'error');
    }
}

function logout() { 
    if (typeof window.stopIpHeartbeat === 'function') window.stopIpHeartbeat();
    
    sessionStorage.removeItem('user_platinum_plus'); 
    sessionStorage.removeItem('last_known_ip');
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

        // 🌐 [V3] ถ้ามีคน Login ค้างไว้ (Refresh) → เริ่ม Heartbeat ต่อ
        const savedUser = sessionStorage.getItem('user_platinum_plus');
        if (savedUser && typeof window.startIpHeartbeat === 'function') {
            const startTimer = setInterval(() => {
                if (typeof appDB !== 'undefined' && appDB) {
                    clearInterval(startTimer);
                    // ตรวจ IP ครั้งแรกทันที (เผื่อ IP เปลี่ยนระหว่างปิดเปิดเบราว์เซอร์)
                    checkIpHeartbeat();
                    window.startIpHeartbeat();
                }
            }, 500);
            
            setTimeout(() => clearInterval(startTimer), 30000);
        }
    }, 200); 
});