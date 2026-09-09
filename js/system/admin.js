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
    window._openingAdminPanel = true;   // 🚩 บอก showPage ว่า "กำลังจะเปิดแผงตั้งค่า อย่าเพิ่งบังคับกลับหน้าหลัก"
    setTimeout(() => { window._openingAdminPanel = false; }, 8000);   // ⛑️ กันธงค้างถ้ามี error กลางทาง
    // 🌟 1. เปิดวงกลมหมุนๆ บังคับให้เบราว์เซอร์รอก่อน
    Swal.fire({title: 'กำลังดึงรายชื่อพนักงาน...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});

    if (!document.getElementById('adminPanel')) {
        if(typeof showPage === 'function') await showPage('dashboard');
        // 🐛 [FIX กดครั้งแรกไม่เปิด] showPage แปะ DOM ใน requestAnimationFrame ทีหลัง await —
        // จังหวะนี้แผงอาจยังไม่อยู่ใน DOM → รอจนกว่าจะโผล่ (สูงสุด ~2 วิ) แล้วค่อยไปต่อ
        for (let i = 0; i < 40 && !document.getElementById('adminPanel'); i++) {
            await new Promise(r => setTimeout(r, 50));
        }
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
    // 🚩 ปลดธง "หลัง" rAF ของ view transition ผ่านไปแล้ว (2 เฟรม)
    // เดิมปลดทันที → rAF ของ showPage (ซึ่งถูก transition หน่วงมาช้า) มาเห็นธงถูกปลดแล้ว
    // เลยเข้าใจผิดว่าไม่มีใครกำลังเปิดแผง → สั่งปิดแผงที่เพิ่งเปิดทิ้ง (ต้นเหตุอาการกดสองที!)
    requestAnimationFrame(() => requestAnimationFrame(() => { window._openingAdminPanel = false; }));
    
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

    // 🧩 เติมแผนกในการ์ดล้างกระดาน + เช็คปุ่มกู้คืนค้าง
    window.populateClearScheduleDept();
    window.syncUndoScheduleBtn();
    window.setClearScheduleDefaultDate();

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
// 🧰 ดึง schedules ของวันนั้น "ทุกแถว" (Supabase ส่งได้ทีละ 1000 → วนหน้าเอง)
window.selectAllSchedulesByDate = async function(dateVal) {
    const PAGE = 1000;
    let all = [], from = 0;
    while (true) {
        const { data, error } = await appDB.from('schedules').select('*')
            .eq('work_date', dateVal).order('id', { ascending: true }).range(from, from + PAGE - 1);
        if (error) throw error;
        all = all.concat(data || []);
        if (!data || data.length < PAGE) break;
        from += PAGE;
    }
    return all;
};

// 🧩 เติมตัวเลือก "แผนก" ในการ์ดล้างกระดานจากแผนกจริงในระบบ (เดิม hardcode แค่ AM/OD)
window.populateClearScheduleDept = function() {
    const sel = document.getElementById('clearScheduleDept');
    if (!sel) return;
    const keep = sel.value || 'all';
    const depts = (typeof window.getSystemDepts === 'function') ? window.getSystemDepts() : ['AM', 'OD', 'AMQL'];
    let html = '<option value="all">🌐 ทุกแผนก</option>';
    depts.forEach(d => { html += `<option value="${d}">เฉพาะ ${d}</option>`; });
    sel.innerHTML = html;
    sel.value = [...sel.options].some(o => o.value === keep) ? keep : 'all';
};

// 🟢 ถ้ายังมีแบ็คอัพค้างใน session (เช่น รีเฟรชหน้า) ให้ปุ่มกู้คืนโผล่กลับมา
window.syncUndoScheduleBtn = function() {
    const btn = document.getElementById('undoScheduleBtn');
    if (!btn) return;
    btn.classList.toggle('hidden', !sessionStorage.getItem('temp_schedule_backup'));
};

// =========================================================
// 📡 ช่องแจ้งเตือนกระดาน (Supabase Broadcast) — ไม่ต้องมีตารางเพิ่ม
//   แอดมินล้าง/กู้คืน → ส่ง event ไปทุกเครื่องที่เปิดเว็บอยู่
//   เครื่องที่ชื่อตัวเองอยู่ในรายการ → เด้ง toast + รีเฟรชตารางให้เอง (ไม่ต้อง F5)
// =========================================================
let _boardChannel = null;
window.subscribeBoardEvents = function() {
    if (!window.appDB) return;
    if (_boardChannel) { try { appDB.removeChannel(_boardChannel); } catch (e) {} }

    const _localToday = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0]; };
    const _refreshBoard = () => {
        try { if (typeof window.refreshTimeSlots === 'function') window.refreshTimeSlots(); } catch (e) {}
        try { if (typeof fetchData === 'function') fetchData(); } catch (e) {}
    };
    const _toast = (icon, title, text) => Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 9000, timerProgressBar: true })
        .fire({ icon, title, text });
    const _isMe = (names) => currentUser && Array.isArray(names) && names.some(n => String(n || '').trim().toLowerCase() === String(currentUser.username || '').trim().toLowerCase());
    const _cond = (p) => `วันที่ ${p.date}${p.dept !== 'all' ? ' · แผนก ' + p.dept : ''}${p.shift !== 'all' ? ' · ' + p.shift : ''}`;

    _boardChannel = appDB.channel('board-events', { config: { broadcast: { self: false } } })
        .on('broadcast', { event: 'schedule_cleared' }, ({ payload: p }) => {
            if (!p) return;
            if (_isMe(p.names)) {
                const mine = (p.items || []).filter(i => String(i.staff_name || '').toLowerCase() === String(currentUser.username || '').toLowerCase());
                const slots = mine.map(i => `${i.shift_name} ${i.time_slot}`).join(', ');
                _toast('warning', '⚠️ เวลาพักของคุณถูกล้างโดยแอดมิน', `${_cond(p)}${slots ? ' — ' + slots : ''} กรุณาลงเวลาใหม่`);
            }
            _refreshBoard();
        })
        .on('broadcast', { event: 'schedule_restored' }, ({ payload: p }) => {
            if (!p) return;
            if (_isMe(p.names)) _toast('success', '✅ เวลาพักของคุณถูกกู้คืนแล้ว', `${_cond(p)} — ไม่ต้องลงใหม่`);
            _refreshBoard();
        })
        .subscribe();
    window._boardChannel = _boardChannel;
};

// ส่ง event (ถ้าช่องยังไม่พร้อม จะข้ามเงียบๆ ไม่ทำให้การลบล้ม)
async function _broadcastBoard(event, payload) {
    try {
        if (!_boardChannel) window.subscribeBoardEvents();
        if (!_boardChannel) return;
        await _boardChannel.send({ type: 'broadcast', event, payload });
    } catch (e) { console.warn('[board-events] ส่งแจ้งเตือนไม่สำเร็จ', e); }
}

function _boardPayload(rows, dateVal, deptVal, shiftVal) {
    return {
        date: dateVal, dept: deptVal, shift: shiftVal,
        names: [...new Set(rows.map(r => r.staff_name).filter(Boolean))],
        items: rows.map(r => ({ staff_name: r.staff_name, shift_name: r.shift_name, time_slot: r.time_slot })),
        by: currentUser ? currentUser.username : 'admin', at: Date.now()
    };
}

// 🗓️ ตั้งค่าวันที่เริ่มต้นของการ์ดล้างกระดาน = วันนี้ (ยังเลือกวันอื่นได้ตามปกติ)
window.setClearScheduleDefaultDate = function() {
    const el = document.getElementById('clearScheduleDate');
    if (!el || el.value) return;
    const d = new Date();
    el.value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
};

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
            // 🌟 1. ดึงข้อมูล "ทั้งวัน" มาก่อน แล้วค่อยกรองแผนก/กะฝั่งเว็บ
            // 🐛 [FIX ลบไม่ครบ/ลบผิดกลุ่ม] เดิมกรองด้วย .eq('department', ...) ตรงๆ ที่ DB
            //   → แถวเก่าที่ department เป็น null/ว่าง (ระบบทั้งเว็บถือว่าเป็น AM) ไม่ถูกลบ
            //   → ค่าที่มีช่องว่าง/ตัวพิมพ์เล็ก-ใหญ่ต่างกัน (เช่น "am ", "Od") ก็หลุดรอด
            //   → แผนกที่ไม่ใช่ AM/OD (AMQL หรือแผนกที่สร้างเพิ่ม) เลือกลบไม่ได้เลย
            const allRows = await window.selectAllSchedulesByDate(dateVal);

            const normDept  = v => String(v || 'AM').trim().toUpperCase();   // null/ว่าง = AM (ตรงกับ dashboard.js)
            const normShift = v => String(v || '').trim();
            const wantDept  = normDept(deptVal);
            const wantShift = normShift(shiftVal);

            const backupData = allRows.filter(r =>
                (deptVal === 'all'  || normDept(r.department)  === wantDept) &&
                (shiftVal === 'all' || normShift(r.shift_name) === wantShift)
            );

            if (backupData.length === 0) {
                return Swal.fire('ไม่พบข้อมูล', 'ไม่มีประวัติการลงเวลาในเงื่อนไขที่เลือกครับ', 'info');
            }

            // เก็บใส่ Session Storage (หน่วยความจำชั่วคราว)
            sessionStorage.setItem('temp_schedule_backup', JSON.stringify(backupData));

            // 🌟 2. สั่งลบ "ตาม id ที่แบ็คอัพไว้เท่านั้น" → สิ่งที่ลบ = สิ่งที่กู้คืนได้ 100% เสมอ
            const ids = backupData.map(r => r.id).filter(id => id !== null && id !== undefined);
            if (ids.length !== backupData.length) throw new Error('พบแถวที่ไม่มี id — ยกเลิกการลบเพื่อความปลอดภัย');

            const CHUNK = 200;   // กัน URL ยาวเกินเมื่อ .in() มี id เยอะ
            let deletedCount = 0;
            for (let i = 0; i < ids.length; i += CHUNK) {
                const part = ids.slice(i, i + CHUNK);
                const { data: delRows, error } = await appDB.from('schedules').delete().in('id', part).select('id');
                if (error) throw error;
                // ถ้า DB ไม่คืนแถว (RLS/นโยบาย) ให้ถือว่าลบครบตามที่สั่ง
                deletedCount += Array.isArray(delRows) && delRows.length ? delRows.length : part.length;
            }
            if (deletedCount !== ids.length) {
                console.warn(`[ล้างกระดาน] ตั้งใจลบ ${ids.length} แต่ลบได้ ${deletedCount} (อาจมีคนลบไปก่อน)`);
            }

            if (typeof logAction === 'function') await logAction('ล้างกระดาน', `แอดมินลบเวลากินข้าว วันที่ ${dateVal} [${deptVal}] [${shiftVal}]`);
            
            Swal.fire('ล้างข้อมูลสำเร็จ!', `ลบข้อมูลไปทั้งหมด ${deletedCount} รายการ (สามารถกดกู้คืนได้หากลบผิด)`, 'success');
            
            // 🌟 3. โชว์ปุ่มสีเขียว "กู้คืน" ขึ้นมา
            const undoBtn = document.getElementById('undoScheduleBtn');
            if (undoBtn) undoBtn.classList.remove('hidden');

            // 📡 4. แจ้งเตือนคนที่ถูกลบ (ทุกเครื่องที่เปิดอยู่) + รีเฟรชกระดานฝั่งแอดมินทันที
            await _broadcastBoard('schedule_cleared', _boardPayload(backupData, dateVal, deptVal, shiftVal));
            if (typeof window.refreshTimeSlots === 'function') window.refreshTimeSlots();
            if (typeof fetchData === 'function') fetchData();
            
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
            // 🛡️ ใช้ upsert ตาม id — ถ้าบางแถวถูกกู้ไปแล้ว/ยังอยู่ จะไม่ error ซ้ำ id
            const { error } = await appDB.from('schedules').upsert(backupData, { onConflict: 'id' });
            if (error) throw error;

            // กู้คืนเสร็จ ล้างกระเป๋า และซ่อนปุ่ม
            sessionStorage.removeItem('temp_schedule_backup');
            document.getElementById('undoScheduleBtn')?.classList.add('hidden');

            if (typeof logAction === 'function') await logAction('กู้คืนข้อมูล', `แอดมินกู้คืนข้อมูลการลงเวลาจำนวน ${backupData.length} รายการ`);

            Swal.fire('กู้คืนสำเร็จ!', 'ข้อมูลกลับมาอยู่ที่เดิมเรียบร้อยแล้วครับ', 'success');

            // 📡 แจ้งคนที่ได้ข้อมูลคืน + รีเฟรชกระดานทันที
            const _d0 = backupData[0] || {};
            await _broadcastBoard('schedule_restored', _boardPayload(backupData, _d0.work_date || '', 'all', 'all'));
            if (typeof window.refreshTimeSlots === 'function') window.refreshTimeSlots();
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
