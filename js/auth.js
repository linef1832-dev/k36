// ==========================================
// 🔐 ระบบจัดการ PIN 6 หลัก และ Login
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

        // 🌟 [เติมบรรทัดนี้] อัปเดตเมนูให้ตรงกับสิทธิ์พนักงานคนนี้
        if (typeof applySidebarPermissions === 'function') applySidebarPermissions();
        
        document.getElementById('login-container').innerHTML = ''; // ลบหน้า login ทิ้ง
        document.getElementById('main-layout').classList.remove('hidden'); // โชว์กรอบหลัก
        showPage('dashboard'); // โหลดหน้า Dashboard มาแสดง

    } catch (err) {
        console.error("Login Exception:", err);
        Swal.close(); clearPinInputs();
        Swal.fire('Error', 'เกิดข้อผิดพลาดในการเชื่อมต่อระบบ', 'error');
    }
}

function logout() { 
    sessionStorage.removeItem('user_platinum_plus'); 
    location.reload(); // รีเฟรชหน้าเว็บ 1 ที เพื่อกลับไปสภาพเริ่มต้น
}