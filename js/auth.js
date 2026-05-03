// ==========================================
// 🔐 ระบบจัดการ PIN 6 หลัก และ Login (V2 - มี IP Heartbeat)
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
// 🌐 [V2] ระบบเก็บประวัติ IP + ตรวจ IP เปลี่ยนระหว่างใช้งาน
// ==========================================================

// 🔑 ตัวแปรกลางสำหรับ Heartbeat
window._ipHeartbeatInterval = null;
window._lastKnownIp = null;
window._ipVisibilityHandlerAttached = false;

// 🌐 ดึงข้อมูล IP จาก API ภายนอก (ipapi.co เป็นตัวหลัก, ipify เป็นสำรอง)
async function fetchCurrentIpInfo() {
    let ipInfo = { ip: 'unknown', country: '-', city: '-', isp: '-' };
    try {
        const res = await fetch('https://ipapi.co/json/');
        if (res.ok) {
            const data = await res.json();
            ipInfo = {
                ip:      data.ip || 'unknown',
                country: data.country_name || '-',
                city:    data.city || '-',
                isp:     data.org || '-'
            };
        }
    } catch (e) {
        try {
            const r2 = await fetch('https://api.ipify.org?format=json');
            const d2 = await r2.json();
            ipInfo.ip = d2.ip || 'unknown';
        } catch(_) { /* ปล่อยเป็น unknown */ }
    }
    return ipInfo;
}

// 💾 บันทึก Log ลงฐานข้อมูล
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
            event_type: eventType   // 🌟 'login' หรือ 'ip_change'
        }]);
    } catch (err) {
        console.warn('IP log error:', err);
    }
}

// 🚀 เรียกตอน Login สำเร็จ
async function recordUserLoginIP(user) {
    if (!user || !user.id || !appDB) return;
    const ipInfo = await fetchCurrentIpInfo();
    await writeIpLog(user, ipInfo, 'login');

    // 🌟 จำ IP นี้ไว้สำหรับเปรียบเทียบใน Heartbeat
    window._lastKnownIp = ipInfo.ip;
    sessionStorage.setItem('last_known_ip', ipInfo.ip);
}

// ⏰ Heartbeat - ตรวจ IP ทุก 5 นาที ขณะใช้งาน
async function checkIpHeartbeat() {
    const userStr = sessionStorage.getItem('user_platinum_plus');
    if (!userStr) {
        // ไม่มี user แล้ว → หยุด Heartbeat
        stopIpHeartbeat();
        return;
    }
    
    let user;
    try { user = JSON.parse(userStr); } catch(e) { return; }
    if (!user || !user.id) return;

    // 🌟 อย่าวิ่งถ้าหน้าเว็บไม่ได้เปิดอยู่ (ประหยัด API call)
    if (document.hidden) return;

    try {
        const ipInfo = await fetchCurrentIpInfo();
        if (!ipInfo.ip || ipInfo.ip === 'unknown') return;

        // ดึง IP เดิมที่จำไว้ (จากตัวแปรกลาง หรือ sessionStorage)
        const lastIp = window._lastKnownIp || sessionStorage.getItem('last_known_ip');

        if (lastIp && lastIp !== ipInfo.ip) {
            // 🚨 IP เปลี่ยน! บันทึกเป็น ip_change
            console.log(`[IP Watch] IP changed: ${lastIp} → ${ipInfo.ip}`);
            await writeIpLog(user, ipInfo, 'ip_change');
            window._lastKnownIp = ipInfo.ip;
            sessionStorage.setItem('last_known_ip', ipInfo.ip);
        } else if (!lastIp) {
            // ไม่เคยมี IP เก็บไว้ (เช่น เปิดเว็บค้างจาก Login เก่า) → จำ IP ปัจจุบันไว้
            window._lastKnownIp = ipInfo.ip;
            sessionStorage.setItem('last_known_ip', ipInfo.ip);
        }
    } catch(e) {
        console.warn('Heartbeat error:', e);
    }
}

// ▶️ เริ่ม Heartbeat (เรียกตอน Login เสร็จ และตอนเปิดเว็บใหม่ที่ยังมี Session)
window.startIpHeartbeat = function() {
    // ป้องกันสร้างซ้ำ
    if (window._ipHeartbeatInterval) return;
    
    // ⏰ ตรวจทุก 5 นาที (300,000 ms)
    window._ipHeartbeatInterval = setInterval(checkIpHeartbeat, 5 * 60 * 1000);
    
    // 🌟 ตรวจทันทีตอนกลับมาที่หน้าเว็บ (เผื่อพึ่งสลับ network กลับมา)
    if (!window._ipVisibilityHandlerAttached) {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) checkIpHeartbeat();
        });
        window._ipVisibilityHandlerAttached = true;
    }
    
    console.log('[IP Watch] Heartbeat started (every 5 min)');
};

// ⏸️ หยุด Heartbeat (ตอน Logout)
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
        
        // 🌟 ล็อกอินสำเร็จ เข้าสู่ระบบเลย
        currentUser = user; 
        sessionStorage.setItem('user_platinum_plus', JSON.stringify(user));

        // 🌐 [V2] บันทึก IP ตอน Login + เริ่ม Heartbeat ตามไป (ไม่ block UI)
        recordUserLoginIP(user).then(() => window.startIpHeartbeat());

        // 🌟 อัปเดตเมนูให้ตรงกับสิทธิ์พนักงานคนนี้
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
    // 🌐 [V2] หยุด Heartbeat ก่อน Logout
    if (typeof window.stopIpHeartbeat === 'function') window.stopIpHeartbeat();
    
    sessionStorage.removeItem('user_platinum_plus'); 
    sessionStorage.removeItem('last_known_ip');
    localStorage.removeItem('cached_menu_rules');
    location.reload(); 
}

// ==========================================
// 🔄 ดึงชื่อที่จำไว้ + เริ่ม Heartbeat ถ้ามี Session อยู่
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

        // 🌐 [V2] ถ้ามีคน Login ค้างไว้ (Refresh หน้า) → เริ่ม Heartbeat ต่อ
        const savedUser = sessionStorage.getItem('user_platinum_plus');
        if (savedUser && typeof window.startIpHeartbeat === 'function') {
            // 🌟 รอให้ appDB พร้อม (init ใน global.js) ก่อนค่อยเริ่ม
            const startTimer = setInterval(() => {
                if (typeof appDB !== 'undefined' && appDB) {
                    clearInterval(startTimer);
                    // ตรวจ IP ครั้งแรกเลยทันที (เผื่อ IP เปลี่ยนระหว่างปิดเปิดเบราว์เซอร์)
                    checkIpHeartbeat();
                    window.startIpHeartbeat();
                }
            }, 500);
            
            // กันไว้: หยุดพยายามหลัง 30 วินาที
            setTimeout(() => clearInterval(startTimer), 30000);
        }
    }, 200); 
});