// ==========================================
// 🔐 ระบบจัดการรหัสผ่าน (PASSWORD MANAGER)
// ==========================================
async function initPasswordApp() {
    if (!currentUser) return;
    const isGlobalAdmin = (currentUser.role === 'manager' || currentUser.role === 'admin');
    const canViewAll = isGlobalAdmin || (typeof window.hasUserPerm === 'function' && window.hasUserPerm('password_view_all'));

    if (canViewAll) {
        document.getElementById('pwdManagerControls')?.classList.remove('hidden');
        document.getElementById('pwdStaffLabel')?.classList.add('hidden');

        // [FIX] ดึง user list จาก getUsersCached() โดยตรง
        try {
            const users = await window.getUsersCached();
            _pwdPopulateUserDropdown(users);
        } catch(e) {
            _pwdPopulateUserDropdown([]);
        }
    } else {
        document.getElementById('pwdManagerControls')?.classList.add('hidden');
        document.getElementById('pwdStaffLabel')?.classList.remove('hidden');
    }
    fetchPasswords();
}

// แยกฟังก์ชัน populate dropdown ออกมา — รับ users array โดยตรง
function _pwdPopulateUserDropdown(users) {
    const userSelect = document.getElementById('pwdUserFilter');
    if (!userSelect) return;
    const list = users || window.GLOBAL_USER_LIST || [];
    const oldVal = userSelect.value;
    userSelect.innerHTML = `<option value="all">-- ดูทั้งหมด --</option>`;
    list
        .filter(u => u && u.username)
        .sort((a, b) => String(a.username).localeCompare(String(b.username)))
        .forEach(u => {
            userSelect.innerHTML += `<option value="${u.id}">${u.username}</option>`;
        });
    if (oldVal) userSelect.value = oldVal;
}

// ฟังก์ชันดึงข้อมูลรหัสผ่าน
window.fetchPasswords = async function() {
    const grid = document.getElementById('pwdGrid');
    if (!grid) return;
    grid.innerHTML = '<div class="col-span-full text-center py-10"><span class="material-icons animate-spin text-amber-500 text-4xl">sync</span></div>';
    const isGlobalAdmin = (currentUser.role === 'manager' || currentUser.role === 'admin');
    const canViewAll = isGlobalAdmin || (typeof window.hasUserPerm === 'function' && window.hasUserPerm('password_view_all'));
    let query = appDB.from('user_passwords').select(`*, users(username)`);
    if (!canViewAll) {
        query = query.eq('user_id', currentUser.id);
    } else {
        const filterId = document.getElementById('pwdUserFilter')?.value;
        if (filterId && filterId !== 'all') query = query.eq('user_id', filterId);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) { grid.innerHTML = `<div class="col-span-full text-center text-red-500">โหลดข้อมูลไม่สำเร็จ: ${error.message}</div>`; return; }
    if (!data || data.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center text-gray-400 py-10 flex flex-col items-center gap-2"><span class="material-icons text-5xl opacity-20">no_encryption</span><span>ยังไม่มีรหัสผ่านที่บันทึกไว้</span></div>`;
        return;
    }
    grid.innerHTML = data.map(item => {
        const ownerName = item.users ? item.users.username : 'Unknown';
        const ownerBadge = canViewAll ? `<div class="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm flex items-center gap-1"><span class="material-icons text-[10px]">person</span> ${ownerName}</div>` : '';
        const delBtn = (isGlobalAdmin || item.user_id === currentUser.id) ? `<button onclick="deletePassword(${item.id})" class="text-red-400 hover:text-red-600 text-xs font-bold flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition"><span class="material-icons text-sm">delete</span> ลบ</button>` : '';
        const urlHtml = item.site_url ? `<a href="${item.site_url}" target="_blank" class="text-xs text-blue-500 hover:underline truncate block">${item.site_url}</a>` : '';
        return window.renderTemplate('tpl-pwd-card', {
            ownerBadge, site_name: item.site_name, urlHtml,
            id: item.id, login_user: item.login_user || '-',
            login_pass: item.login_pass, delBtn
        });
    }).join('');
}

window.openAddPwdModal = function() {
    document.getElementById('pwdModal').classList.remove('hidden');
    document.getElementById('pwdSite').value = '';
    document.getElementById('pwdUrl').value = '';
    document.getElementById('pwdUser').value = '';
    document.getElementById('pwdPass').value = '';
}

window.savePassword = async function(e) {
    e.preventDefault();
    const site = document.getElementById('pwdSite').value;
    const url = document.getElementById('pwdUrl').value;
    const user = document.getElementById('pwdUser').value;
    const pass = document.getElementById('pwdPass').value;
    Swal.fire({ title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading() });
    const { error } = await appDB.from('user_passwords').insert([{
        user_id: currentUser.id, site_name: site,
        site_url: url, login_user: user, login_pass: pass
    }]);
    if (error) {
        Swal.fire('Error', error.message, 'error');
    } else {
        document.getElementById('pwdModal').classList.add('hidden');
        fetchPasswords();
        Swal.fire({ icon: 'success', title: 'บันทึกเรียบร้อย', timer: 1500, showConfirmButton: false });
    }
}

window.deletePassword = async function(id) {
    Swal.fire({
        title: 'ลบรหัสผ่านนี้?', text: "ไม่สามารถกู้คืนได้",
        icon: 'warning', showCancelButton: true,
        confirmButtonColor: '#d33', confirmButtonText: 'ลบเลย'
    }).then(async (result) => {
        if (result.isConfirmed) {
            await appDB.from('user_passwords').delete().eq('id', id);
            fetchPasswords();
            Swal.fire('Deleted', '', 'success');
        }
    });
}

window.filterPwdCards = function() {
    const filter = document.getElementById('pwdSearchInput').value.toUpperCase().trim();
    document.querySelectorAll('.pwd-card').forEach(card => {
        card.style.display = (card.textContent || card.innerText).toUpperCase().includes(filter) ? "" : "none";
    });
}

window.copyText = function(txt) {
    if (!txt) return;
    navigator.clipboard.writeText(txt);
    Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1000 })
        .fire({ icon: 'success', title: 'คัดลอกแล้ว' });
}

// ==========================================
// 💪 Password Strength Meter
// ==========================================
window.checkPwdStrength = function(val) {
    const bar   = document.getElementById('pwdStrengthBar');
    const label = document.getElementById('pwdStrengthLabel');
    if (!bar || !label) return;
    if (!val) { bar.style.width='0%'; label.textContent=''; return; }

    let score = 0;
    if (val.length >= 8)  score++;
    if (val.length >= 12) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;

    const levels = [
        { pct:'20%', color:'#ef4444', text:'🔴 อ่อนมาก' },
        { pct:'40%', color:'#f97316', text:'🟠 อ่อน' },
        { pct:'60%', color:'#eab308', text:'🟡 ปานกลาง' },
        { pct:'80%', color:'#22c55e', text:'🟢 แข็งแรง' },
        { pct:'100%',color:'#10b981', text:'✅ แข็งแรงมาก' },
    ];
    const lv = levels[Math.min(score, 4)];
    bar.style.width      = lv.pct;
    bar.style.background = lv.color;
    label.textContent    = lv.text;
};

// ==========================================
// 🎲 Generate Strong Password
// ==========================================
window.generatePassword = function() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=';
    let pwd = '';
    // บังคับให้มีทุก category
    pwd += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random()*26)];
    pwd += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random()*26)];
    pwd += '0123456789'[Math.floor(Math.random()*10)];
    pwd += '!@#$%^&*'[Math.floor(Math.random()*8)];
    // เติมให้ครบ 16 ตัว
    for (let i = 4; i < 16; i++) {
        pwd += chars[Math.floor(Math.random() * chars.length)];
    }
    // shuffle
    pwd = pwd.split('').sort(() => Math.random() - 0.5).join('');

    const inp = document.getElementById('pwdPass');
    if (inp) {
        inp.value = pwd;
        inp.type = 'text'; // แสดงให้เห็น
        window.checkPwdStrength(pwd);
        // flash สีเขียวสั้นๆ
        inp.style.borderColor = '#22c55e';
        inp.style.boxShadow   = '0 0 0 3px rgba(34,197,94,0.2)';
        setTimeout(() => { inp.style.borderColor=''; inp.style.boxShadow=''; }, 1000);
    }
    // copy ไปด้วยเลย
    navigator.clipboard.writeText(pwd).catch(()=>{});
    // toast
    Swal.mixin({ toast:true, position:'top-end', showConfirmButton:false, timer:1800 })
        .fire({ icon:'success', title:'🎲 สร้างรหัสผ่านแล้ว', text:'คัดลอกไปแล้วด้วย' });
};

// ==========================================
// ⚡ Copy Flash (ปุ่มเปลี่ยนเป็น ✓ ชั่วคราว)
// ==========================================
window.copyTextFlash = function(txt, btnEl) {
    if (!txt) return;
    navigator.clipboard.writeText(txt).then(() => {
        if (!btnEl) return;
        const orig = btnEl.innerHTML;
        btnEl.innerHTML = '<span class="material-icons text-xs text-green-500">check</span>';
        btnEl.style.pointerEvents = 'none';
        setTimeout(() => {
            btnEl.innerHTML = orig;
            btnEl.style.pointerEvents = '';
        }, 1500);
    });
};

// ==========================================
// 🔍 Search Highlight
// ==========================================
window.filterPwdCards = function() {
    const filter = document.getElementById('pwdSearchInput').value.trim();
    const cards  = document.querySelectorAll('.pwd-card');
    cards.forEach(card => {
        const txt = card.getAttribute('data-search') || card.textContent;
        if (!filter) {
            card.style.display = '';
            return;
        }
        if (txt.toLowerCase().includes(filter.toLowerCase())) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
};

// ==========================================
// 🔒 Auto-hide password หลัง 5 วิ
// ==========================================
window._pwdAutoHideTimers = {};
window.togglePwdVisible = function(id, el) {
    const span = document.getElementById('pass_' + id);
    if (!span) return;
    const isHidden = span.classList.contains('blur-sm');
    if (isHidden) {
        // แสดง
        span.classList.remove('blur-sm');
        el.innerHTML = '<span class="material-icons text-xs">visibility_off</span>';
        // auto-hide หลัง 5 วิ
        clearTimeout(window._pwdAutoHideTimers[id]);
        window._pwdAutoHideTimers[id] = setTimeout(() => {
            span.classList.add('blur-sm');
            if (el) el.innerHTML = '<span class="material-icons text-xs">visibility</span>';
        }, 5000);
    } else {
        // ซ่อน
        span.classList.add('blur-sm');
        el.innerHTML = '<span class="material-icons text-xs">visibility</span>';
        clearTimeout(window._pwdAutoHideTimers[id]);
    }
};
