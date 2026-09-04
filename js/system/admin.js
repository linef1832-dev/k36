// ════════════════════════════════════════════════════════════════════
// 📦 system/admin.js — ส่วนที่ 4/4 ของระบบแกนกลาง (จัดการพนักงาน/สิทธิ์/ตั้งค่า) (แยกจาก system_core.js เดิม 3,170 บรรทัด)
// เนื้อหา: สลับหน้าแอดมิน/ประวัติ, ล้างกระดาน (ตามแผนก/กะ), กู้คืนข้อมูล
// ⚠️ ลำดับโหลด: system/users → system/manage → system/permissions → system/admin
// ตัวแปร top-level แชร์ข้ามไฟล์อัตโนมัติ — ห้ามสลับลำดับ
// ════════════════════════════════════════════════════════════════════
// 🟢 ควบคุมการสลับหน้า (แอดมิน / ประวัติ / หน้าหลัก)
// ==========================================
window.openAdminPanel = async function() {
    if (!window.sysRequireAdmin()) return;   // 🔒
    // 🌟 1. เปิดวงกลมหมุนๆ บังคับให้เบราว์เซอร์รอก่อน
    Swal.fire({title: 'กำลังดึงรายชื่อพนักงาน...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});

    if (!document.getElementById('adminPanel')) {
        if(typeof showPage === 'function') await showPage('dashboard');
        if(typeof initDashboard === 'function') initDashboard(); // เตรียมตารางไว้เบื้องหลัง
    }

    // 🌟 2. หัวใจสำคัญ: ถ้าข้อมูลพนักงานยังไม่มี ให้บังคับดึงข้อมูลให้เสร็จ (await) ก่อนไปต่อ
    if (!window.GLOBAL_USER_LIST || window.GLOBAL_USER_LIST.length === 0) {
        if (typeof fetchUsers === 'function') {
            await fetchUsers(); 
        }
    } else {
        // ถ้ามีข้อมูลอยู่แล้ว สั่งให้มันวาดตารางอัปเดตรอไว้เลย
        if (typeof renderUserTableDirectly === 'function') window.renderUserTableDirectly();
    }

    // ซ่อนหน้าหลัก+ประวัติ และโชว์หน้าแอดมินทันที
    if(document.getElementById('mainContentArea')) document.getElementById('mainContentArea').classList.add('hidden');
    if(document.getElementById('logsPage')) {
        document.getElementById('logsPage').classList.add('hidden');
        document.getElementById('logsPage').classList.remove('flex');
    }
    
    const adminPanel = document.getElementById('adminPanel');
    if(adminPanel) {
        adminPanel.classList.remove('hidden');
        adminPanel.classList.add('flex');
    }
    
    // 🌟 3. ดึงสิทธิ์ของการเข้าถึงแต่ละแท็บ (บังคับเช็คตาม Checkbox 100%)
    const canSeeSettings = (typeof window.hasUserPerm === 'function' && window.hasUserPerm('admin_settings'));
    const canSeeUsers = (typeof window.hasUserPerm === 'function' && window.hasUserPerm('admin_users'));
    const canSeePerms = (typeof window.hasUserPerm === 'function' && window.hasUserPerm('admin_perms'));
    const canSeeInfo = (typeof window.hasUserPerm === 'function' && window.hasUserPerm('admin_info'));
    
    // 🌟 4. สั่งซ่อน/โชว์ ปุ่มแท็บด้านบน ตามสิทธิ์ที่พนักงานคนนั้นมี
    const btnSettings = document.getElementById('btnAdminTab_settings');
    const btnUsers = document.getElementById('btnAdminTab_users');
    const btnPerms = document.getElementById('btnAdminTab_perms');
    const btnInfo = document.getElementById('btnAdminTab_quotalog');

    if(btnSettings) btnSettings.style.display = canSeeSettings ? '' : 'none';
    if(btnUsers) btnUsers.style.display = canSeeUsers ? '' : 'none';
    if(btnPerms) btnPerms.style.display = canSeePerms ? '' : 'none';
    if(btnInfo) btnInfo.style.display = canSeeInfo ? '' : 'none';

    // 🌟 5. สั่งให้ระบบ "เปิดแท็บแรก" ที่พนักงานคนนั้นมีสิทธิ์เห็นโดยอัตโนมัติ
    if (typeof switchAdminTab === 'function') {
        if (canSeeSettings) switchAdminTab('settings');
        else if (canSeeUsers) switchAdminTab('users');
        else if (canSeePerms) switchAdminTab('perms');
        else if (canSeeInfo) switchAdminTab('quotalog');
    }

    // 🌟 6. ข้อมูลมาครบ วาดตารางเสร็จ สั่งปิดวงกลมหมุนๆ ได้
    Swal.close();
};

// =========================================================
// 🔴 ฟังก์ชันล้างกระดาน (เลือก ลบตามแผนก / ตามกะ ได้ + กู้คืนได้)
// =========================================================
window.clearAllSchedules = async function() {
    if (!window.sysRequireAdmin()) return;

    const dateInput = document.getElementById('clearScheduleDate');
    const deptInput = document.getElementById('clearScheduleDept');
    const shiftInput = document.getElementById('clearScheduleShift');

    const dateVal = dateInput ? dateInput.value : '';
    const deptVal = deptInput ? deptInput.value : 'all';
    const shiftVal = shiftInput ? shiftInput.value : 'all';

    if (!dateVal) return Swal.fire('แจ้งเตือน', 'กรุณาเลือกวันที่ ที่ต้องการล้างข้อมูลก่อนครับ', 'warning');

    let targetText = `วันที่: <b class="text-red-500">${dateVal}</b>`;
    if(deptVal !== 'all') targetText += `<br>แผนก: <b class="text-sky-400">${deptVal}</b>`;
    else targetText += `<br>แผนก: <b class="text-gray-300">ทั้งหมด</b>`;
    if(shiftVal !== 'all') targetText += `<br>กะ: <b class="text-orange-400">${shiftVal}</b>`;
    else targetText += `<br>กะ: <b class="text-gray-300">ทั้งหมด</b>`;

    const confirm = await Swal.fire({
        title: 'ยืนยันการล้างกระดาน?',
        html: `คุณกำลังจะลบข้อมูลการลงเวลาตามเงื่อนไขนี้:<br><br><div class="bg-slate-900 p-4 rounded-lg border border-slate-700 text-left w-fit mx-auto text-sm shadow-inner">${targetText}</div><br><span class="text-xs text-gray-400">พนักงานในกลุ่มนี้จะต้องเข้ามาลงเวลาใหม่ ทำต่อหรือไม่?</span>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'ใช่, ล้างข้อมูลเลย!',
        cancelButtonText: 'ยกเลิก',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl border border-slate-600' }
    });

    if (confirm.isConfirmed) {
        Swal.fire({title: 'กำลังประมวลผล...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
        
        try {
            // 🌟 1. ค้นหาและ "แบ็คอัพ" ข้อมูลชุดนี้เก็บไว้ในกระเป๋าก่อนลบ
            let backupQuery = appDB.from('schedules').select('*').eq('work_date', dateVal);
            if (deptVal !== 'all') backupQuery = backupQuery.eq('department', deptVal);
            if (shiftVal !== 'all') backupQuery = backupQuery.eq('shift_name', shiftVal);
            
            const { data: backupData, error: backupErr } = await backupQuery;
            if (backupErr) throw backupErr;

            if (!backupData || backupData.length === 0) {
                return Swal.fire('ไม่พบข้อมูล', 'ไม่มีประวัติการลงเวลาในเงื่อนไขที่เลือกครับ', 'info');
            }

            // เก็บใส่ Session Storage (หน่วยความจำชั่วคราว)
            sessionStorage.setItem('temp_schedule_backup', JSON.stringify(backupData));

            // 🌟 2. สั่งลบจริง
            let delQuery = appDB.from('schedules').delete().eq('work_date', dateVal);
            if (deptVal !== 'all') delQuery = delQuery.eq('department', deptVal);
            if (shiftVal !== 'all') delQuery = delQuery.eq('shift_name', shiftVal);

            const { error } = await delQuery;
            if (error) throw error;

            if (typeof logAction === 'function') await logAction('ล้างกระดาน', `แอดมินลบเวลากินข้าว วันที่ ${dateVal} [${deptVal}] [${shiftVal}]`);
            
            Swal.fire('ล้างข้อมูลสำเร็จ!', `ลบข้อมูลไปทั้งหมด ${backupData.length} รายการ (สามารถกดกู้คืนได้หากลบผิด)`, 'success');
            
            // 🌟 3. โชว์ปุ่มสีเขียว "กู้คืน" ขึ้นมา
            const undoBtn = document.getElementById('undoScheduleBtn');
            if (undoBtn) undoBtn.classList.remove('hidden');
            
            if (document.getElementById('wDate') && document.getElementById('wDate').value === dateVal) {
                if (typeof fetchData === 'function') fetchData();
            }
            
        } catch (e) {
            console.error(e);
            Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถล้างข้อมูลได้: ' + e.message, 'error');
        }
    }
};

// =========================================================
// 🟢 ฟังก์ชันกู้คืนข้อมูล (กรณีแอดมินมือลั่น)
// =========================================================
window.undoClearSchedules = async function() {
    if (!window.sysRequireAdmin()) return;

    const backupStr = sessionStorage.getItem('temp_schedule_backup');
    if (!backupStr) return Swal.fire('ไม่พบข้อมูล', 'ไม่มีข้อมูลให้กู้คืนแล้วครับ', 'error');
    
    const backupData = JSON.parse(backupStr);

    const confirm = await Swal.fire({
        title: 'ยืนยันการกู้คืน?',
        text: `คุณต้องการกู้คืนข้อมูลการลงเวลาจำนวน ${backupData.length} รายการ ที่เพิ่งลบทิ้งไปใช่หรือไม่?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'ใช่, นำข้อมูลกลับมา!',
        cancelButtonText: 'ยกเลิก',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl border border-slate-600' }
    });

    if (confirm.isConfirmed) {
        Swal.fire({title: 'กำลังกู้คืนข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
        try {
            // โยนข้อมูลที่ก๊อปปี้ไว้ กลับเข้าไปในฐานข้อมูล
            const { error } = await appDB.from('schedules').insert(backupData);
            if (error) throw error;

            // กู้คืนเสร็จ ล้างกระเป๋า และซ่อนปุ่ม
            sessionStorage.removeItem('temp_schedule_backup');
            document.getElementById('undoScheduleBtn')?.classList.add('hidden');

            if (typeof logAction === 'function') await logAction('กู้คืนข้อมูล', `แอดมินกู้คืนข้อมูลการลงเวลาจำนวน ${backupData.length} รายการ`);

            Swal.fire('กู้คืนสำเร็จ!', 'ข้อมูลกลับมาอยู่ที่เดิมเรียบร้อยแล้วครับ', 'success');

            if (typeof fetchData === 'function') fetchData();

        } catch(e) {
            console.error(e);
            Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถกู้คืนได้: ' + e.message, 'error');
        }
    }
};

// ====== Modal แก้ไข Discord/Telegram ID ======

window.openEditUserModal = function(id) {
    if (!window.sysRequireAdmin()) return;

    const user = GLOBAL_USER_LIST.find(u => String(u.id) === String(id));
    if (!user) return;
    document.getElementById('editUserId').value = id;
    document.getElementById('editUserName').value = user.username || '';
    document.getElementById('editDiscordId').value = user.discord_id || '';
    document.getElementById('editTelegramId').value = user.telegram_id || '';
    if(document.getElementById('editTag')) document.getElementById('editTag').value = user.tag || '';
    const modal = document.getElementById('editUserModal');
    if (!modal) return;
    modal.style.display = 'flex';
};

window.closeEditUserModal = function() {
    const modal = document.getElementById('editUserModal');
    if (!modal) return;
    modal.style.display = 'none';
};

window.saveEditUser = async function() {
    if (!window.sysRequireAdmin()) return;

    const id = document.getElementById('editUserId').value;
    const username = document.getElementById('editUserName').value.trim();
    const discordId = document.getElementById('editDiscordId').value.trim();
    const telegramId = document.getElementById('editTelegramId').value.trim();
    const tag = document.getElementById('editTag')?.value.trim() || null;

    if (!username) return Swal.fire('ข้อมูลไม่ครบ', 'กรุณาใส่ชื่อพนักงาน', 'warning');

    Swal.fire({ title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading() });

    const { error } = await appDB.from('users').update({
        username: username,
        discord_id: discordId || null,
        telegram_id: telegramId || null,
        tag: tag || null
    }).eq('id', id);

    if (error) return Swal.fire('Error', error.message, 'error');

    const idx = GLOBAL_USER_LIST.findIndex(u => String(u.id) === String(id));
    if (idx !== -1) {
        GLOBAL_USER_LIST[idx].username = username;
        GLOBAL_USER_LIST[idx].discord_id = discordId || null;
        GLOBAL_USER_LIST[idx].telegram_id = telegramId || null;
        GLOBAL_USER_LIST[idx].tag = tag || null;
    }

    closeEditUserModal();
    window.renderUserTableDirectly();
    Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', timer: 1500, showConfirmButton: false });
};
