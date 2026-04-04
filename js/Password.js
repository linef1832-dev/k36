// ==========================================
// 🔐 2. ระบบจัดการรหัสผ่าน (PASSWORD MANAGER)
// ==========================================

// ฟังก์ชันเริ่มต้นตอนเข้าหน้า Password
async function initPasswordApp() {
    if (!currentUser) return; 
    const isAdmin = (currentUser.role === 'manager' || currentUser.role === 'admin');

    // ถ้าเป็นแอดมิน ให้โชว์ปุ่มดูรหัสผ่านของพนักงานคนอื่น
    if(isAdmin) {
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
    
    const isAdmin = (currentUser.role === 'manager' || currentUser.role === 'admin');
    let query = appDB.from('user_passwords').select(`*, users(username)`); 

    if(!isAdmin) {
        // พนักงานปกติ ดึงแค่ของตัวเอง
        query = query.eq('user_id', currentUser.id);
    } else {
        // แอดมิน ดึงตามที่ Filter ไว้
        const filterId = document.getElementById('pwdUserFilter').value;
        if(filterId && filterId !== 'all') query = query.eq('user_id', filterId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    
    if(error) { grid.innerHTML = `<div class="col-span-full text-center text-red-500">โหลดข้อมูลไม่สำเร็จ: ${error.message}</div>`; return; }
    if(!data || data.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center text-gray-400 py-10 flex flex-col items-center gap-2"><span class="material-icons text-5xl opacity-20">no_encryption</span><span>ยังไม่มีรหัสผ่านที่บันทึกไว้</span></div>`;
        return;
    }

    // วาดการ์ดแสดงรหัสผ่าน
    grid.innerHTML = data.map(item => {
        const ownerName = item.users ? item.users.username : 'Unknown';
        const ownerBadge = isAdmin ? `<div class="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm flex items-center gap-1"><span class="material-icons text-[10px]">person</span> ${ownerName}</div>` : '';
        const delBtn = (isAdmin || item.user_id === currentUser.id) ? `<button onclick="deletePassword(${item.id})" class="text-red-400 hover:text-red-600 text-xs font-bold flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition"><span class="material-icons text-sm">delete</span> ลบ</button>` : '';

        return `
        <div class="pwd-card bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 relative group hover:shadow-md transition">
            ${ownerBadge}
            <div class="flex items-center gap-3 mb-3">
                <div class="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0"><span class="material-icons text-xl">language</span></div>
                <div class="overflow-hidden">
                    <h4 class="font-bold text-slate-800 dark:text-white truncate text-base">${item.site_name}</h4>
                    ${item.site_url ? `<a href="${item.site_url}" target="_blank" class="text-xs text-blue-500 hover:underline truncate block">${item.site_url}</a>` : ''}
                </div>
            </div>
            <div class="space-y-2 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                <div class="flex justify-between items-center text-xs">
                    <span class="text-gray-500">User:</span>
                    <div class="flex items-center gap-1">
                        <span class="font-mono font-bold text-slate-700 dark:text-gray-300 select-all">${item.login_user || '-'}</span>
                        <button onclick="copyText('${item.login_user}')" class="text-gray-400 hover:text-blue-500"><span class="material-icons text-xs">content_copy</span></button>
                    </div>
                </div>
                <div class="flex justify-between items-center text-xs">
                    <span class="text-gray-500">Pass:</span>
                    <div class="flex items-center gap-1">
                        <span class="font-mono font-bold text-red-600 dark:text-red-400 blur-sm hover:blur-none transition cursor-pointer select-all" onclick="this.classList.toggle('blur-sm')">${item.login_pass}</span>
                        <button onclick="copyText('${item.login_pass}')" class="text-gray-400 hover:text-blue-500"><span class="material-icons text-xs">content_copy</span></button>
                    </div>
                </div>
            </div>
            <div class="mt-3 flex justify-end gap-2 border-t pt-2 dark:border-slate-700">${delBtn}</div>
        </div>`;
    }).join('');
}

// เปิดป๊อปอัปเพิ่มรหัสผ่าน
window.openAddPwdModal = function() {
    document.getElementById('pwdModal').classList.remove('hidden');
    ['pwdSite','pwdUrl','pwdUser','pwdPass'].forEach(id => document.getElementById(id).value = '');
}

// บันทึกรหัสผ่านใหม่
window.savePassword = async function(e) {
    e.preventDefault();
    Swal.fire({title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading()});
    
    const { error } = await appDB.from('user_passwords').insert([{
        user_id: currentUser.id,
        site_name: document.getElementById('pwdSite').value,
        site_url: document.getElementById('pwdUrl').value,
        login_user: document.getElementById('pwdUser').value,
        login_pass: document.getElementById('pwdPass').value
    }]);

    if(error) Swal.fire('Error', error.message, 'error');
    else {
        document.getElementById('pwdModal').classList.add('hidden');
        fetchPasswords();
        Swal.fire({icon: 'success', title: 'บันทึกเรียบร้อย', timer: 1500, showConfirmButton: false});
    }
}

// ลบรหัสผ่าน
window.deletePassword = async function(id) {
    const result = await Swal.fire({ title: 'ลบรหัสผ่านนี้?', text: "ไม่สามารถกู้คืนได้", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'ลบเลย' });
    if (result.isConfirmed) {
        await appDB.from('user_passwords').delete().eq('id', id);
        fetchPasswords();
        Swal.fire('Deleted', '', 'success');
    }
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
    Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1000 }).fire({ icon: 'success', title: 'คัดลอกแล้ว' });
}