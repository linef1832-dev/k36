// ==========================================
// 🔐 2. ระบบจัดการรหัสผ่าน (PASSWORD MANAGER)
// ==========================================

// ฟังก์ชันเริ่มต้นตอนเข้าหน้า Password
async function initPasswordApp() {
    if (!currentUser) return;
    const isGlobalAdmin = (currentUser.role === 'manager' || currentUser.role === 'admin');
    const canViewAll = isGlobalAdmin || (typeof window.hasUserPerm === 'function' && window.hasUserPerm('password_view_all'));

    // ถ้ามีสิทธิ์ดูทั้งหมด ให้โชว์ปุ่มดูรหัสผ่านของพนักงานคนอื่น
    if(canViewAll) {
        document.getElementById('pwdManagerControls')?.classList.remove('hidden');
        document.getElementById('pwdStaffLabel')?.classList.add('hidden');
        
        const userSelect = document.getElementById('pwdUserFilter');
        if (userSelect && window.GLOBAL_USER_LIST) {
            const oldVal = userSelect.value;
            userSelect.innerHTML = `<option value="all" class="bg-white dark:bg-slate-800 text-slate-800 dark:text-white">-- ดูทั้งหมด --</option>`;
            
            // ดึงชื่อพนักงานทั้งหมดมาใส่ใน Dropdown
            window.GLOBAL_USER_LIST.filter(u => u && u.username).sort((a,b) => String(a.username).localeCompare(String(b.username))).forEach(u => {
                userSelect.innerHTML += `<option value="${u.id}" class="bg-white dark:bg-slate-800 text-slate-800 dark:text-white">${u.username}</option>`;
            });
            if(oldVal) userSelect.value = oldVal;
        }
    } else {
        document.getElementById('pwdManagerControls')?.classList.add('hidden');
        document.getElementById('pwdStaffLabel')?.classList.remove('hidden');
    }
    fetchPasswords();
}

// ฟังก์ชันดึงข้อมูลรหัสผ่าน
window.fetchPasswords = async function() {
    const grid = document.getElementById('pwdGrid');
    if(!grid) return;
    grid.innerHTML = '<div class="col-span-full text-center py-10"><span class="material-icons animate-spin text-amber-500 text-4xl">sync</span></div>';

    const isGlobalAdmin = (currentUser.role === 'manager' || currentUser.role === 'admin');
    const canViewAll = isGlobalAdmin || (typeof window.hasUserPerm === 'function' && window.hasUserPerm('password_view_all'));
    let query = appDB.from('user_passwords').select(`*, users(username)`);

    if(!canViewAll) {
        // ไม่มีสิทธิ์ดูทุกคน → ดึงแค่ของตัวเอง
        query = query.eq('user_id', currentUser.id);
    } else {
        // มีสิทธิ์ดูทุกคน → ดึงตามที่ Filter ไว้
        const filterId = document.getElementById('pwdUserFilter').value;
        if(filterId && filterId !== 'all') query = query.eq('user_id', filterId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    
    if(error) { grid.innerHTML = `<div class="col-span-full text-center text-red-500">โหลดข้อมูลไม่สำเร็จ: ${error.message}</div>`; return; }
    if(!data || data.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center text-gray-400 py-10 flex flex-col items-center gap-2"><span class="material-icons text-5xl opacity-20">no_encryption</span><span>ยังไม่มีรหัสผ่านที่บันทึกไว้</span></div>`;
        return;
    }

    // วาดการ์ดแสดงรหัสผ่านโดยใช้ Template
    grid.innerHTML = data.map(item => {
        const ownerName = item.users ? item.users.username : 'Unknown';
        const ownerBadge = canViewAll ? `<div class="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm flex items-center gap-1"><span class="material-icons text-[10px]">person</span> ${ownerName}</div>` : '';
        // ลบได้ถ้าเป็น admin/manager หรือเป็นเจ้าของรหัสนั้น (ไม่ให้คนที่มีแค่สิทธิ์ "ดูทุกคน" ลบได้)
        const delBtn = (isGlobalAdmin || item.user_id === currentUser.id) ? `<button onclick="deletePassword(${item.id})" class="text-red-400 hover:text-red-600 text-xs font-bold flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition"><span class="material-icons text-sm">delete</span> ลบ</button>` : '';
        const urlHtml = item.site_url ? `<a href="${item.site_url}" target="_blank" class="text-xs text-blue-500 hover:underline truncate block">${item.site_url}</a>` : '';

        // ส่งข้อมูลเข้า Template
        return window.renderTemplate('tpl-pwd-card', {
            ownerBadge: ownerBadge,
            site_name: item.site_name,
            urlHtml: urlHtml,
            id: item.id,
            login_user: item.login_user || '-',
            login_pass: item.login_pass,
            delBtn: delBtn
        });
    }).join('');
}

// เปิดป๊อปอัปเพิ่มรหัสผ่าน
window.openAddPwdModal = function() {
    document.getElementById('pwdModal').classList.remove('hidden');
    document.getElementById('pwdSite').value = '';
    document.getElementById('pwdUrl').value = '';
    document.getElementById('pwdUser').value = '';
    document.getElementById('pwdPass').value = '';
}

// บันทึกรหัสผ่านใหม่
window.savePassword = async function(e) {
    e.preventDefault();
    const site = document.getElementById('pwdSite').value;
    const url = document.getElementById('pwdUrl').value;
    const user = document.getElementById('pwdUser').value;
    const pass = document.getElementById('pwdPass').value;

    Swal.fire({title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading()});

    const { error } = await appDB.from('user_passwords').insert([{
        user_id: currentUser.id,
        site_name: site,
        site_url: url,
        login_user: user,
        login_pass: pass
    }]);

    if(error) {
        Swal.fire('Error', error.message, 'error');
    } else {
        document.getElementById('pwdModal').classList.add('hidden');
        fetchPasswords();
        Swal.fire({icon: 'success', title: 'บันทึกเรียบร้อย', timer: 1500, showConfirmButton: false});
    }
}

// ลบรหัสผ่าน
window.deletePassword = async function(id) {
    Swal.fire({
        title: 'ลบรหัสผ่านนี้?',
        text: "ไม่สามารถกู้คืนได้",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'ลบเลย'
    }).then(async (result) => {
        if (result.isConfirmed) {
            await appDB.from('user_passwords').delete().eq('id', id);
            fetchPasswords();
            Swal.fire('Deleted', '', 'success');
        }
    });
}

// ค้นหารหัสผ่าน
window.filterPwdCards = function() {
    const filter = document.getElementById('pwdSearchInput').value.toUpperCase().trim();
    const cards = document.querySelectorAll('.pwd-card');
    cards.forEach(card => {
        const txtValue = card.textContent || card.innerText;
        card.style.display = txtValue.toUpperCase().indexOf(filter) > -1 ? "" : "none";
    });
}

// คัดลอกข้อความ
window.copyText = function(txt) {
    if(!txt) return;
    navigator.clipboard.writeText(txt);
    const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1000 });
    Toast.fire({ icon: 'success', title: 'คัดลอกแล้ว' });
}
