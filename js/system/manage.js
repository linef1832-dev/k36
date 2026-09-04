// ════════════════════════════════════════════════════════════════════
// 📦 system/manage.js — ส่วนที่ 2/4 ของระบบแกนกลาง (จัดการพนักงาน/สิทธิ์/ตั้งค่า) (แยกจาก system_core.js เดิม 3,170 บรรทัด)
// เนื้อหา: ตั้งเวลาเปลี่ยนกะล่วงหน้า, จัดการแผนก, เปลี่ยน PIN, ดึงการตั้งค่า, ประวัติโควตา
// ⚠️ ลำดับโหลด: system/users → system/manage → system/permissions → system/admin
// ตัวแปร top-level แชร์ข้ามไฟล์อัตโนมัติ — ห้ามสลับลำดับ
// ════════════════════════════════════════════════════════════════════
// 🟢 แก้ไขปุ่มกดเพิ่มรายการรอรัน (ตั้งเวลาเปลี่ยนกะล่วงหน้า)
// =========================================================

window.addToPendingList = function() {
    const shift = document.getElementById('indivTargetShift').value;
    const dateVal = document.getElementById('indivDate').value;

    const checkedBoxes = document.querySelectorAll('.indiv-user-cb:checked');
    if (checkedBoxes.length === 0) return Swal.fire('ไม่ได้เลือก', 'กรุณาติ๊กเลือกพนักงานอย่างน้อย 1 คน', 'warning');
    if (!dateVal) return Swal.fire('ไม่ได้เลือกเวลา', 'กรุณาระบุวัน/เวลาที่มีผล', 'warning');

    let addedCount = 0;

    checkedBoxes.forEach(cb => {
        let userId = cb.value;
        if(!isNaN(Number(userId))) userId = Number(userId);
        const userName = cb.dataset.name;

        pendingSchedules.push({
            user_id: userId,
            user_name: userName,
            target_shift: shift,
            scheduled_for: new Date(dateVal).toISOString()
        });
        
        cb.checked = false; // เอาติ๊กถูกออกให้หลังเพิ่มเสร็จ
        addedCount++;
    });

    renderPendingTable();
    
    // เอาติ๊กถูกออกจากช่อง "เลือกทั้งหมด" ด้วย
    const selectAllCb = document.querySelector('input[onchange="toggleSelectAllIndiv(this)"]');
    if(selectAllCb) selectAllCb.checked = false;

    const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
    Toast.fire({ icon: 'success', title: `เพิ่ม ${addedCount} รายการรอรันแล้ว` });
};

window.renderPendingTable = function() {
    const tbody = document.getElementById('pendingTableBody');
    const container = document.getElementById('pendingListContainer');
    const countSpan = document.getElementById('pendingCount');
    if(!tbody || !container) return;

    // ถ้ามีรายการค้างอยู่ ให้โชว์กล่องรอรัน ถ้าไม่มีให้ซ่อนไว้
    if (pendingSchedules.length > 0) {
        container.classList.remove('hidden');
        container.classList.add('flex'); // บังคับแสดงให้เห็นแบบ Flex
    } else {
        container.classList.add('hidden');
        container.classList.remove('flex');
    }
    
    if(countSpan) countSpan.innerText = pendingSchedules.length;
    tbody.innerHTML = pendingSchedules.map((item, index) => `
        <tr class="border-b border-gray-600/50">
            <td class="p-1.5">${item.user_name}</td>
            <td class="p-1.5 font-bold text-yellow-200">${item.target_shift}</td>
            <td class="p-1.5 font-mono">${new Date(item.scheduled_for).toLocaleString('th-TH')}</td>
            <td class="p-1.5 text-center">
                <button onclick="removeFromPendingList(${index})" class="text-red-400 hover:text-red-300 font-bold bg-slate-800 px-2 py-0.5 rounded transition">x</button>
            </td>
        </tr>
    `).join('');
};

window.removeFromPendingList = function(index) {
    pendingSchedules.splice(index, 1);
    renderPendingTable();
};

async function commitIndividualSchedules() {
    if (!window.sysRequireAdmin()) return;

    if(pendingSchedules.length === 0) return;

    Swal.fire({title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading()});
    
    const insertData = pendingSchedules.map(item => ({
        task_type: 'individual_shift_update',
        payload: { user_id: item.user_id, user_name: item.user_name, target_shift: item.target_shift },
        scheduled_for: item.scheduled_for,
        status: 'pending'
    }));

    const { error } = await appDB.from('scheduled_tasks').insert(insertData);

    if (error) {
        Swal.fire('Error', error.message, 'error');
    } else {
        pendingSchedules = [];
        renderPendingTable();
        if(typeof fetchIndividualTasks === 'function') fetchIndividualTasks();

        if(typeof processPendingTasks === 'function') await processPendingTasks();

        Swal.fire('สำเร็จ', 'บันทึกรายการเปลี่ยนกะล่วงหน้าเรียบร้อย', 'success');
    }
}
async function manualRefreshIndiv() {
    if(typeof fetchIndividualTasks === 'function') await fetchIndividualTasks();
    const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1500, timerProgressBar: true });
    Toast.fire({ icon: 'success', title: 'รีเฟรชประวัติแล้ว' });
}

async function fetchIndividualTasks() {
     // 🌟 [FIX] ก่อนดึงข้อมูลมาแสดง ให้ลองประมวลผลคิวที่เลยเวลาก่อน
     // เพื่อให้สถานะ pending → completed อัตโนมัติเมื่อถึงเวลา (ไม่ต้องรอแอดมิน commit คิวใหม่)
     try {
         if (typeof processPendingTasks === 'function') await processPendingTasks();
     } catch(e) { console.warn('[fetchIndividualTasks] processPendingTasks error:', e); }

     const {data} = await appDB.from('scheduled_tasks')
        .select('*')
        .eq('task_type', 'individual_shift_update')
        .order('scheduled_for', {ascending: true});
     
     GLOBAL_INDIV_TASKS = data || [];
     renderIndivTaskLog(GLOBAL_INDIV_TASKS);
}

function renderIndivTaskLog(data) {
     const pendingContainer = document.getElementById('indivTaskLogPending');
     const completedContainer = document.getElementById('indivTaskLogCompleted');
     if(!pendingContainer || !completedContainer) return;
     
     let counts = { 'กะเช้า': 0, 'กะกลาง': 0, 'กะดึก': 0 };
     if(data) {
         data.forEach(t => {
             if(t.payload && t.payload.target_shift && counts[t.payload.target_shift] !== undefined) {
                 counts[t.payload.target_shift]++;
             }
         });
     }
     
     if(document.getElementById('sumIndivM')) document.getElementById('sumIndivM').innerText = counts['กะเช้า'];
     if(document.getElementById('sumIndivA')) document.getElementById('sumIndivA').innerText = counts['กะกลาง'];
     if(document.getElementById('sumIndivN')) document.getElementById('sumIndivN').innerText = counts['กะดึก'];

     if(!data || data.length === 0) { 
         pendingContainer.innerHTML = '<span class="text-gray-500 italic">ไม่มีข้อมูล</span>';
         completedContainer.innerHTML = '<span class="text-gray-500 italic">ไม่มีข้อมูล</span>';
         return; 
     }
     
     const pendingHTML = data.filter(t => t.status === 'pending').map(t => createIndivLogItem(t)).join('');
     const completedHTML = data.filter(t => t.status === 'completed').map(t => createIndivLogItem(t, true)).join('');

     pendingContainer.innerHTML = pendingHTML || '<span class="text-gray-500 italic">ไม่มีรายการรอ</span>';
     completedContainer.innerHTML = completedHTML || '<span class="text-gray-500 italic">ไม่มีประวัติ</span>';
}

function createIndivLogItem(t, isCompleted = false) {
     const time = new Date(t.scheduled_for).toLocaleString('th-TH');
     const p = t.payload;
     const statusBadge = isCompleted ? '<span class="text-[9px] bg-green-900 text-green-300 px-1 rounded">สำเร็จ</span>' : '';
     const shiftClass = p.target_shift === 'กะเช้า' ? 'text-orange-300' : (p.target_shift === 'กะกลาง' ? 'text-blue-300' : 'text-purple-300');
     
     return `<div class="flex justify-between border-b border-gray-700 py-1 indiv-log-item" data-shift="${p.target_shift}">
        <span><span class="text-white font-bold user-name-span">${p.user_name}</span> -> <span class="${shiftClass}">${p.target_shift}</span> <span class="text-[9px] text-gray-500">[${time}]</span> ${statusBadge}</span>
        <span onclick="deleteTask(${t.id})" class="text-red-400 cursor-pointer material-icons text-xs hover:text-red-200">delete</span>
     </div>`;
}

function filterIndivTaskLog(shiftFilter = "") {
    const searchInput = document.getElementById('indivHistorySearch');
    const nameFilter = searchInput ? searchInput.value.toLowerCase() : '';
    const items = document.querySelectorAll('.indiv-log-item');
    
    items.forEach(item => {
        const nameSpan = item.querySelector('.user-name-span');
        const itemShift = item.dataset.shift;
        let show = true;

        if (nameFilter && nameSpan) {
            if (nameSpan.innerText.toLowerCase().indexOf(nameFilter) === -1) show = false;
        }
        
        if (shiftFilter && itemShift !== shiftFilter) show = false;

        if (show) item.classList.remove('hidden');
        else item.classList.add('hidden');
    });
}

async function deleteTask(id) { if (!window.sysRequireAdmin()) return; 
    Swal.fire({
        title: 'ยืนยันลบ?', text: "ต้องการลบรายการนี้ใช่หรือไม่ (วันหยุด XX ที่ระบบลงให้จากรายการนี้จะถูกลบออกจากตารางวันหยุดด้วย)", icon: 'warning',
        showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'ใช่, ลบเลย!', cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
        if (result.isConfirmed) {
            // 🌟 [ลบ XX ตาม] ดึงข้อมูลคิวก่อนลบ เพื่อตามไปลบช่องเหลือง XX ที่คิวนี้เคยลงไว้ในตารางวันหยุด
            // กติกาวัน XX (ตามตอนสร้างใน confirmAndSaveSwapPlan): สลับไปดึก/กลาง = วันเดียวกับคิว | สลับไปเช้า = วันพักก่อนหน้า 1 วัน
            let xxCleanup = null;
            try {
                const { data: taskRow } = await appDB.from('scheduled_tasks').select('*').eq('id', id).maybeSingle();
                if (taskRow && taskRow.task_type === 'individual_shift_update' && taskRow.payload &&
                    taskRow.payload.user_id && taskRow.payload.target_shift !== 'คงเดิม') {
                    const d = new Date(taskRow.scheduled_for);
                    if ((taskRow.payload.target_shift || '').includes('เช้า')) d.setDate(d.getDate() - 1);
                    const xxDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    xxCleanup = { user_id: taskRow.payload.user_id, date: xxDate };
                }
            } catch (e) { console.error('เตรียมลบ XX:', e); }

            const { error } = await appDB.from('scheduled_tasks').delete().eq('id', id); 
            if(error) {
                Swal.fire('Error', error.message, 'error');
            } else {
                // ลบ XX ของคน+วันนั้น (เฉพาะที่ reason = 'XX' เท่านั้น — วันลาประเภทอื่นไม่โดนแตะ)
                if (xxCleanup) {
                    try {
                        await appDB.from('leave_requests').delete()
                            .eq('user_id', xxCleanup.user_id)
                            .eq('leave_date', xxCleanup.date)
                            .eq('reason', 'XX');
                    } catch (e) { console.error('ลบ XX:', e); }
                }
                if(typeof fetchTasks === 'function') fetchTasks(); 
                if(typeof fetchIndividualTasks === 'function') fetchIndividualTasks(); 
                if(typeof fetchLeaveData === 'function') fetchLeaveData();   // รีเฟรชตารางวันหยุด → เหลืองหายทันที
                Swal.fire('ลบสำเร็จ!', 'ลบรายการและวันหยุด XX ที่เกี่ยวข้องเรียบร้อยแล้ว', 'success');
            }
        }
    });
}

async function fetchTasks() { 
    const {data}=await appDB.from('scheduled_tasks').select('*').neq('task_type', 'individual_shift_update').order('created_at',{ascending:false}).limit(5); 
    const taskLog = document.getElementById('taskLog');
    if(taskLog) {
        taskLog.innerHTML=(data || []).map(t=>`<div class="flex justify-between border-b border-gray-700 py-1"><span>${new Date(t.scheduled_for).toLocaleString('th-TH')} ${t.payload.from}->${t.payload.to}</span><span onclick="deleteTask(${t.id})" class="text-red-400 cursor-pointer material-icons text-xs">delete</span></div>`).join(''); 
    }
}

window.processPendingTasks = async function() { if (!window.sysIsAdmin()) return;   // ตัวประมวลผลเบื้องหลัง — เงียบ ไม่เด้ง popup
   
    try {
        const now = new Date().toISOString(); 
        const {data} = await appDB.from('scheduled_tasks').select('*').eq('status','pending').lte('scheduled_for',now); 
        
        if(data && data.length > 0){ 
            let updateCount = 0;
            const completedTaskIds = []; // 🌟 [เพิ่มใหม่] สร้างตะกร้าเก็บ ID ที่ทำเสร็จแล้ว

            for(let t of data){ 
                let p = t.payload;
                if (typeof p === 'string') {
                    try { p = JSON.parse(p); } catch(e) { p = {}; }
                }

                if (t.task_type === 'move_shift') { 
                    await appDB.from('users').update({allowed_shift: p.to}).eq('allowed_shift', p.from); 
                } 
                else if (t.task_type === 'individual_shift_update') { 
                    const targetName = p.user_name;
                    const targetShift = p.target_shift;
                    
                    if (targetName && targetShift && targetShift !== 'คงเดิม') {
                        const { error: uErr } = await appDB.from('users')
                            .update({ allowed_shift: targetShift })
                            .eq('username', targetName); 
                        
                        if(uErr) console.error("อัปเดตกะไม่สำเร็จ:", uErr);
                    }
                } 
                
                completedTaskIds.push(t.id); // 🌟 [ปรับใหม่] เก็บ ID โยนลงตะกร้า (ยังไม่ยิง DB)
                updateCount++;
            } 
            
            // 🌟 [ปรับใหม่] ยิงคำสั่งอัปเดตสถานะ 'completed' รวดเดียวจบ! (ลดภาระเซิร์ฟเวอร์มหาศาล)
            if (completedTaskIds.length > 0) {
                const { error: bulkErr } = await appDB.from('scheduled_tasks').update({status:'completed'}).in('id', completedTaskIds);
                if (bulkErr) console.error('[processPendingTasks] อัปเดต status=completed ไม่สำเร็จ:', bulkErr);
            }
            
            if(typeof fetchTasks === 'function') fetchTasks(); 
            if(typeof fetchIndividualTasks === 'function') fetchIndividualTasks(); 
            if(typeof fetchUsers === 'function') await fetchUsers(); 

            const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
            Toast.fire({ icon: 'success', title: `ถึงเวลาย้ายกะอัตโนมัติสำเร็จ ${updateCount} คน` });
        } 
    } catch (error) {
        console.error("Auto Shift Error:", error);
    }
};

function renderOperatingHours() {
    const container = document.getElementById('operatingTimeContainer');
    if(!container) return;
    container.innerHTML = '';
    
    const shifts = new Set();
    Object.keys(SETTINGS).forEach(k => {
        if(k.startsWith('open_time_')) shifts.add(k.replace('open_time_', ''));
    });
    
    if(!shifts.has('เช้า')) shifts.add('เช้า');
    if(!shifts.has('กลาง')) shifts.add('กลาง');
    if(!shifts.has('ดึก')) shifts.add('ดึก');

    let opHtml = ''; // 🌟 [ปรับใหม่]

    shifts.forEach(suffix => {
        const openVal = SETTINGS[`open_time_${suffix}`] || '00:00';
        const closeVal = SETTINGS[`close_time_${suffix}`] || '23:59';
        const color = suffix === 'เช้า' ? 'orange' : (suffix === 'กลาง' ? 'blue' : 'purple');
        
        // 🌟 [ปรับใหม่]
        opHtml += `
            <div class="flex items-center gap-2 text-xs operating-row bg-slate-900/50 p-1 rounded border border-slate-700">
                <span class="w-10 text-${color}-300 font-bold capitalize shift-label">${suffix}:</span>
                <input type="time" class="bg-slate-800 text-white p-1 rounded border border-slate-600 text-center flex-1 open-input" value="${openVal}">
                <span class="text-gray-500">-</span>
                <input type="time" class="bg-slate-800 text-white p-1 rounded border border-slate-600 text-center flex-1 close-input" value="${closeVal}">
                <button onclick="deleteOperatingShift('${suffix}')" class="text-red-400 hover:text-red-300 ml-1"><span class="material-icons text-sm">close</span></button>
            </div>
        `;
    });
    
    // 🌟 [ปรับใหม่]
    container.innerHTML = opHtml;
}

async function addOperatingShift() {
    if (!window.sysRequireAdmin()) return;

    const { value: name } = await Swal.fire({
        title: 'ชื่อกะใหม่ (เช่น เช้า, สาย, ดึก)',
        input: 'text',
        showCancelButton: true
    });
    
    if (name) {
        if(SETTINGS[`open_time_${name}`]) return Swal.fire('Error', 'มีกะนี้อยู่แล้ว', 'error');
        
        SETTINGS[`open_time_${name}`] = '00:00';
        SETTINGS[`close_time_${name}`] = '23:59';
        renderOperatingHours();
    }
}

async function deleteOperatingShift(suffix) {
    if (!window.sysRequireAdmin()) return;

    Swal.fire({
        title: `ลบกะ "${suffix}"?`,
        text: "การลบนี้จะทำให้การเช็คเวลาสำหรับกะนี้หายไป (แต่ไม่ลบข้อมูลในตาราง)",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'ลบ'
    }).then(async (result) => {
        if (result.isConfirmed) {
              // [FIX] เดิม like '%_<กะ>' กิน quota_total_<กะ> ไปด้วย ทำให้โควตาหายถาวร — ระบุคีย์ตรง ๆ แทน
              await appDB.from('settings').delete().in('key', [`open_time_${suffix}`, `close_time_${suffix}`]);
              delete SETTINGS[`open_time_${suffix}`];
              delete SETTINGS[`close_time_${suffix}`];
              if(typeof loadSettings === 'function') await loadSettings();
              renderOperatingHours();
        }
    });
}

async function saveTimeSettings() { if (!window.sysRequireAdmin()) return; 
    const updates = [];
    const container = document.getElementById('operatingTimeContainer');
    const rows = container.querySelectorAll('.operating-row');
    
    rows.forEach(row => {
        const suffix = row.querySelector('.shift-label').innerText.replace(':', '').trim();
        const openVal = row.querySelector('.open-input').value;
        const closeVal = row.querySelector('.close-input').value;
        
        updates.push({key: `open_time_${suffix}`, value: openVal});
        updates.push({key: `close_time_${suffix}`, value: closeVal});
    });

    await appDB.from('settings').upsert(updates); 
    updates.forEach(u => SETTINGS[u.key] = u.value);
    Swal.fire('Saved','บันทึกเวลาเปิด-ปิดเรียบร้อย','success'); 
}

async function saveDailyLimit() { if (!window.sysRequireAdmin()) return; 
    const dailyVal = document.getElementById('dailyLimitInput').value; 
    const periodVal = document.getElementById('periodLimitInput').value; 
    await appDB.from('settings').upsert([{ key: 'daily_limit', value: dailyVal }, { key: 'period_limit', value: periodVal }]); 
    SETTINGS.daily_limit = parseInt(dailyVal); SETTINGS.period_limit = parseInt(periodVal); 
    
    if(document.getElementById('limitDisplay')) document.getElementById('limitDisplay').innerText = dailyVal; 
    if(document.getElementById('periodLimitDisplay')) document.getElementById('periodLimitDisplay').innerText = periodVal;
    
    Swal.fire('Saved', '', 'success'); 
}

// ==========================================
// 🛠️ อัปเดต Dropdown แผนกให้เป็นแบบไดนามิก (หน้าจัดการพนักงาน)
// ==========================================
window.populateAdminDeptSelects = function() {
    let dbDepts = [];
    try { dbDepts = JSON.parse(SETTINGS['custom_departments'] || '[]'); } catch(e) {}
    
    // 🌟 ดึงเฉพาะ AM, OD และแผนกที่สร้างใหม่ในหน้าตั้งค่าเท่านั้น! (ลบการสแกนพนักงานเก่าทิ้งถาวร)
    let availableDepts = new Set(['AM', 'OD', 'AMQL', ...dbDepts]);
    const deptListArray = window.getSystemDepts();

    // 1. อัปเดตช่อง "เลือกแผนกตอนเพิ่มพนักงานใหม่" (ขวาสุด)
    const newDeptSelect = document.getElementById('newDept');
    if (newDeptSelect) {
        let html = '';
        deptListArray.forEach(d => {
            html += `<option value="${d}">แผนก ${d}</option>`;
        });
        newDeptSelect.innerHTML = html;
    }

    // 2. อัปเดตช่อง "ตัวกรองค้นหาแผนก" (ซ้ายสุด)
    const filterUserDept = document.getElementById('filterUserDept');
    if (filterUserDept) {
        const currentVal = filterUserDept.value;
        let html = '<option value="all">ทุกแผนก</option>';
        deptListArray.forEach(d => {
            html += `<option value="${d}">แผนก ${d}</option>`;
        });
        filterUserDept.innerHTML = html;
        filterUserDept.value = currentVal || 'all';
    }
};

async function addUsersBulk() {
    if (!window.sysRequireAdmin()) return;

    const text = document.getElementById('newUsersArea').value.trim(); 
    const s = document.getElementById('newAllowedShift').value; 
    const tm = document.getElementById('newTeam').value; 
    const cType = document.getElementById('newCheckType').value; 
    const dept = document.getElementById('newDept').value; 
    
    if(!text) return;
    
    const names = text.split('\n').map(n => n.trim()).filter(n => n);
    
    Swal.fire({title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading()});
    
    const discordId = (document.getElementById('newDiscordId')?.value || '').trim();
    const telegramId = (document.getElementById('newTelegramId')?.value || '').trim();
    const newTag = (document.getElementById('newTag')?.value || '').trim();

    const { error } = await appDB.from('users').insert(names.map(n => ({ 
        username: n, 
        allowed_shift: s, 
        team: tm || null, 
        role: 'staff', 
        check_type: cType,
        department: dept,
        discord_id: discordId || null,
        telegram_id: telegramId || null,
        tag: newTag || null
    })));
    
    if(!error) { 
        document.getElementById('newUsersArea').value='';
        if(document.getElementById('newDiscordId')) document.getElementById('newDiscordId').value = '';
        if(document.getElementById('newTelegramId')) document.getElementById('newTelegramId').value = '';
        if(document.getElementById('newTag')) document.getElementById('newTag').value = '';
        if(typeof fetchUsers === 'function') fetchUsers(); 
        Swal.fire('สำเร็จ', `เพิ่มพนักงาน ${names.length} คน ลงแผนก ${dept} เรียบร้อย`, 'success'); 
    } else {
        Swal.fire('Error', error.message, 'error');
    }
}

function populateIndivUserSelect(filter = "") {
    const container = document.getElementById('indivUserListContainer');
    if (!container) return;
    container.innerHTML = '';
    
    const sortedData = [...GLOBAL_USER_LIST].sort((a,b) => a.username.localeCompare(b.username));
    
    let count = 0;
    sortedData.forEach(u => {
        if (filter === "" || u.username.toLowerCase().includes(filter.toLowerCase())) {
            const shiftColor = u.allowed_shift === 'กะเช้า' ? 'text-orange-600' : (u.allowed_shift === 'กะกลาง' ? 'text-blue-600' : 'text-purple-600');
            
            const itemDiv = document.createElement('div');
            itemDiv.className = "flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 border-b border-gray-100 last:border-0 cursor-pointer select-none transition";
            itemDiv.innerHTML = `
                <input type="checkbox" class="indiv-user-cb w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer" value="${u.id}" data-name="${u.username}">
                <div class="flex-1 text-xs flex justify-between items-center">
                    <span class="font-bold text-slate-700">${u.username}</span>${window.getTagBadge ? window.getTagBadge(u.tag, u.department) : ""}
                    <span class="text-[9px] ${shiftColor} bg-gray-100 px-1.5 py-0.5 rounded ml-1 font-bold">${u.allowed_shift}</span>
                </div>
            `;
            itemDiv.onclick = (e) => {
                if(e.target.type !== 'checkbox') {
                    const cb = itemDiv.querySelector('input');
                    cb.checked = !cb.checked;
                }
            };
            container.appendChild(itemDiv);
            count++;
        }
    });

    if(count === 0) container.innerHTML = '<div class="text-center text-gray-400 text-xs py-4">ไม่พบรายชื่อ</div>';
}

function filterIndivUserSelect() {
    const searchVal = document.getElementById('indivSearchUser').value;
    populateIndivUserSelect(searchVal);
}

window.toggleSelectAllIndiv = function(source) {
    const checkboxes = document.querySelectorAll('.indiv-user-cb');
    checkboxes.forEach(cb => cb.checked = source.checked);
}

let isFetchingUsers = false;
async function fetchUsers(forceRefresh = false) {
    // [FIX] เดิมมีการ์ด cache "ถ้ามีรายชื่ออยู่แล้วไม่ต้องโหลดใหม่" ซึ่งไม่เคยทำงาน
    //       เพราะอ่าน window.GLOBAL_USER_LIST แต่ที่อื่นเขียนตัวแปรตรง ๆ (คนละตัวกัน)
    //       พอผูกสองตัวเข้าด้วยกันแล้ว การ์ดนี้จะเริ่มทำงานทันที และทำให้จุดที่เรียก
    //       fetchUsers() หลังลบ/ย้าย/เพิ่มพนักงาน ได้รายชื่อชุดเก่า → เอาการ์ดออก
    //       จุดที่ต้องการประหยัด query เช็ค GLOBAL_USER_LIST.length ก่อนเรียกอยู่แล้ว

    if (isFetchingUsers) return;
    isFetchingUsers = true;

    try {
        const { data } = await appDB.from('users').select('*').order('created_at', {ascending: false});
        const box = document.getElementById('userTableBody'); 
        if(box) box.innerHTML = '';
        GLOBAL_USER_LIST = data || [];
        
        if(typeof populateIndivUserSelect === 'function') populateIndivUserSelect();
        if(typeof populateAdminDeptSelects === 'function') populateAdminDeptSelects();

        requestAnimationFrame(() => {
            if(typeof fastRecalculateStats === 'function') fastRecalculateStats();
            if(typeof renderUserTableDirectly === 'function') renderUserTableDirectly(); 
        });
    } catch(e) {
        console.error("Fetch User Error:", e);
    } finally {
        isFetchingUsers = false;
    }
}

window.renderUserTableDirectly = function() {
    const box = document.getElementById('userTableBody');
    if(!box || GLOBAL_USER_LIST.length === 0) return;

    // 1. ดึงคำค้นหาและตัวกรอง
    const inputSearch = document.getElementById('searchUser') ? document.getElementById('searchUser').value.toLowerCase() : '';
    const shiftFilter = document.getElementById('filterUserShift') ? document.getElementById('filterUserShift').value : 'all';
    const deptFilter = document.getElementById('filterUserDept') ? document.getElementById('filterUserDept').value : 'all';

    // 2. กรองข้อมูลจาก Array โดยตรง
    let filteredUsers = GLOBAL_USER_LIST.filter(u => {
        const matchName = u.username.toLowerCase().includes(inputSearch);
        const matchShift = (shiftFilter === 'all') || (u.allowed_shift === shiftFilter);
        const matchDept = (deptFilter === 'all') || ((u.department || 'AM') === deptFilter);
        return matchName && matchShift && matchDept;
    });

    // 3. ตัดแบ่งหน้า (Pagination)
    let totalUsers = filteredUsers.length;
    let totalPages = userRowsPerPage === 'all' ? 1 : Math.ceil(totalUsers / parseInt(userRowsPerPage));
    
    // ป้องกันกรณีอยู่หน้าที่ลึกๆ แล้วค้นหาชื่อจนเหลือหน้าลดลง
    if (userCurrentPage > totalPages) userCurrentPage = Math.max(1, totalPages);

    let paginatedUsers = filteredUsers;
    let startIndex = 0;
    
    if (userRowsPerPage !== 'all') {
        startIndex = (userCurrentPage - 1) * parseInt(userRowsPerPage);
        paginatedUsers = filteredUsers.slice(startIndex, startIndex + parseInt(userRowsPerPage));
    }

    // 4. เตรียมข้อมูล Dropdown สิทธิ์ต่างๆ (ดึงแบบไดนามิกจากฐานข้อมูล)
    let dbDepts = [];
    try { dbDepts = JSON.parse(SETTINGS['custom_departments'] || '[]'); } catch(e) {}
    
    let availableDepts = new Set(['AM', 'OD', 'AMQL', ...dbDepts]);
    const deptListArray = window.getSystemDepts();
    
    let dbRoles = [];
    try { dbRoles = JSON.parse(SETTINGS['custom_roles'] || '[]'); } catch(e) {}
    
    let rawRoles = ['staff', 'trainer', 'manager', ...dbRoles];
    const uniqueRoles = [...new Set(rawRoles)];
    const roleOptions = uniqueRoles.map(r => ({ val: r, label: r.toUpperCase() }));

    // 5. วาดตาราง (เฉพาะคนที่อยู่ในหน้านี้)
    let html = '';
    paginatedUsers.forEach((u, index) => {
        const displayIndex = startIndex + index + 1; // ลำดับที่ถูกต้อง

        let currentDep = u.department || 'AM';
        if (currentDep === 'TRAINER') currentDep = 'AM'; // ซ่อนแค่ TRAINER
        
        let depColor = currentDep === 'OD' ? 'text-pink-400' : (currentDep === 'AM' ? 'text-blue-400' : (currentDep === 'NEW' ? 'text-emerald-400' : 'text-teal-400'));
        
        let depBadge = `<select onchange="updateUserDepartment(${u.id}, this.value)" class="bg-slate-900 ${depColor} text-[10px] p-1.5 rounded-md border border-slate-700 font-bold outline-none cursor-pointer hover:bg-slate-950 shadow-inner text-center w-[60px]">`;
        
        // ถ้าเป็นพนักงานใหม่ (NEW) ให้มีตัวเลือก NEW โผล่มาให้เห็นชัดๆ ไม่หลอกตา
        if (currentDep === 'NEW') {
            depBadge += `<option value="NEW" selected class="text-white">NEW</option>`;
        }
        
        deptListArray.forEach(dName => { depBadge += `<option value="${dName}" ${currentDep === dName ? 'selected' : ''} class="text-white">${dName}</option>`; });
        depBadge += `</select>`;
        
        const teamBadge = `<button class="bg-indigo-900/50 text-indigo-300 text-xs px-2.5 py-1 rounded-md font-bold hover:bg-indigo-800 transition border border-indigo-700/50 shadow-inner" onclick="updateUserTeam('${u.id}', '${u.team || ''}')">${u.team || '-'}</button>`;
        
        let shiftColor = u.allowed_shift === 'กะเช้า' ? 'text-orange-400' : (u.allowed_shift === 'กะกลาง' ? 'text-blue-400' : (u.allowed_shift === 'กะดึก' ? 'text-purple-400' : 'text-gray-400'));
        let shiftSelect = `<select onchange="updateUserShift(this, ${u.id}, this.value)" class="bg-slate-900 ${shiftColor} text-xs p-1.5 rounded-md border border-slate-700 font-bold outline-none cursor-pointer hover:bg-slate-950 shadow-inner text-center">`;
        ['all', 'กะเช้า', 'กะกลาง', 'กะดึก'].forEach(opt => { shiftSelect += `<option value="${opt}" ${u.allowed_shift === opt ? 'selected' : ''} class="text-white">${opt}</option>`; });
        shiftSelect += `</select>`;

        const checkType = u.check_type || 'team';
        const typeBadge = `<button class="${checkType === 'shift' ? 'bg-fuchsia-900/40 text-fuchsia-400 border-fuchsia-800/50' : 'bg-emerald-900/40 text-emerald-400 border-emerald-800/50'} text-[10px] px-2 py-1 rounded-md font-bold hover:opacity-80 border shadow-inner transition" onclick="updateCheckType(this, ${u.id}, '${checkType}')">${checkType === 'shift' ? 'เน้นกะ' : 'เน้นทีม'}</button>`;

        let roleColor = (u.role === 'manager' || u.role === 'admin') ? 'text-red-400' : (u.role !== 'staff' ? 'text-fuchsia-400' : 'text-gray-400');
        let currentRoleVal = (u.role === 'admin') ? 'manager' : (u.role || 'staff');
        let roleBadge = `<select onchange="updateUserRole(this, ${u.id}, this.value)" class="bg-slate-900 ${roleColor} text-xs p-1.5 rounded-md border border-slate-700 font-bold outline-none cursor-pointer hover:bg-slate-950 shadow-inner text-center capitalize">`;
        roleOptions.forEach(opt => { roleBadge += `<option value="${opt.val}" ${currentRoleVal === opt.val ? 'selected' : ''} class="text-white">${opt.label}</option>`; });
        roleBadge += `</select>`;

        // 🔐 [SECURITY] ไม่โชว์ PIN จริงอีกต่อไป (PIN อยู่ฝั่ง server) — โชว์แค่ว่าตั้งแล้วหรือยัง
        const pinDisplay = u.has_pin 
            ? `<div class="flex items-center justify-center gap-1 group"><span class="font-mono text-amber-400 font-bold bg-amber-900/20 px-2 py-1 rounded-md border border-amber-700/50 tracking-widest text-xs" title="ตั้ง PIN แล้ว">••••••</span><button onclick="resetUserPin(${u.id}, '${u.username}')" class="text-slate-500 hover:text-red-400 p-1 bg-slate-800 rounded-md transition opacity-0 group-hover:opacity-100" title="ล้างรหัสผ่านให้ตั้งใหม่"><span class="material-icons text-[14px]">lock_reset</span></button></div>` 
            : `<div class="flex items-center justify-center gap-1 group"><span class="text-slate-500 text-[10px] italic bg-slate-800 px-2 py-1 rounded-md">ยังไม่ตั้ง</span><button onclick="resetUserPin(${u.id}, '${u.username}')" class="text-slate-500 hover:text-green-400 p-1 bg-slate-800 rounded-md transition opacity-0 group-hover:opacity-100" title="รีเซ็ต"><span class="material-icons text-[14px]">refresh</span></button></div>`;

        // avatar สีสลับตาม index
        const avatarColors = [
            {bg:'#1e3a5f',color:'#60a5fa'},{bg:'#1a2e1a',color:'#4ade80'},
            {bg:'#3b1f1f',color:'#f87171'},{bg:'#2d1f3d',color:'#c084fc'},
            {bg:'#1f2d3d',color:'#38bdf8'},{bg:'#3d2d1f',color:'#fb923c'},
            {bg:'#1f3d2d',color:'#34d399'},{bg:'#3d1f2d',color:'#f472b6'},
        ];
        const ac = avatarColors[displayIndex % avatarColors.length];

        const disBadge = `<span style="font-size:8.5px;font-weight:700;color:#c084fc;background:#2d1f3d;border:0.5px solid rgba(124,58,237,.35);padding:1px 5px;border-radius:3px;letter-spacing:.4px;flex-shrink:0;">DIS</span>`;
        const telBadge = `<span style="font-size:8.5px;font-weight:700;color:#38bdf8;background:#0c2a3d;border:0.5px solid rgba(2,132,199,.35);padding:1px 5px;border-radius:3px;letter-spacing:.4px;flex-shrink:0;">TEL</span>`;
        const discordChip = u.discord_id
            ? `<span style="display:inline-flex;align-items:center;gap:4px;">${disBadge}<span style="font-size:10px;color:#94a3b8;font-family:monospace;letter-spacing:.2px;" title="${u.discord_id}">${u.discord_id}</span></span>`
            : `<span style="display:inline-flex;align-items:center;gap:4px;">${disBadge}<span style="font-size:10px;color:#475569;font-style:italic;">ยังไม่มี</span></span>`;
        const telegramChip = u.telegram_id
            ? `<span style="display:inline-flex;align-items:center;gap:4px;">${telBadge}<span style="font-size:10px;color:#94a3b8;font-family:monospace;letter-spacing:.2px;" title="${u.telegram_id}">${u.telegram_id}</span></span>`
            : `<span style="display:inline-flex;align-items:center;gap:4px;">${telBadge}<span style="font-size:10px;color:#475569;font-style:italic;">ยังไม่มี</span></span>`;
        const idRow = `<div style="margin-top:4px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">${discordChip}${telegramChip}</div>`;

        html += `
            <tr class="staff-row hover:bg-slate-700/30 transition duration-200">
                <td class="p-3 text-center border-b border-slate-700/50"><input type="checkbox" class="user-check w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500 cursor-pointer" value="${u.id}"></td>
                <td class="p-3 text-left border-b border-slate-700/50">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <div style="width:34px;height:34px;border-radius:50%;background:${ac.bg};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:${ac.color};flex-shrink:0;letter-spacing:.5px;">${u.username.substring(0,2).toUpperCase()}</div>
                        <div style="min-width:0;flex:1;">
                            <div style="display:flex;align-items:center;gap:5px;">
                                <span style="font-weight:500;color:var(--text-primary);font-size:13px;">${u.username}</span>${window.getTagBadge ? window.getTagBadge(u.tag, u.department) : ""}
                                <button class="row-edit-btn" onclick="window.openEditUserModal(${u.id})" style="border:none;background:none;padding:3px;cursor:pointer;color:#475569;line-height:1;border-radius:5px;opacity:0;transition:opacity .15s,color .15s,background .15s;display:inline-flex;align-items:center;justify-content:center;" title="แก้ไข" onmouseenter="this.style.color='#c084fc';this.style.background='rgba(192,132,252,.12)'" onmouseleave="this.style.color='#475569';this.style.background='none'"><span class="material-icons" style="font-size:14px;">edit</span></button>
                            </div>
                            ${idRow}
                        </div>
                    </div>
                </td>
                <td class="p-3 text-center border-b border-slate-700/50">${depBadge}</td>
                <td class="p-3 text-center border-b border-slate-700/50">${teamBadge}</td>
                <td class="p-3 text-center border-b border-slate-700/50">${shiftSelect}</td>
                <td class="p-3 text-center border-b border-slate-700/50 bg-black/10">${pinDisplay}</td>
                <td class="p-3 text-center border-b border-slate-700/50">${typeBadge}</td> 
                <td class="p-3 text-center border-b border-slate-700/50">${roleBadge}</td>
            </tr>`;
    });
    
    if (paginatedUsers.length === 0) {
        html = `<tr><td colspan="8" class="text-center p-10 text-gray-400">ไม่พบรายชื่อพนักงานตามเงื่อนไขที่ค้นหา</td></tr>`;
    }

    box.innerHTML = html;

    // 6. วาดปุ่มควบคุมหน้า (Pagination Controls)
    window.renderPaginationControls(totalUsers, totalPages);
    
    if(typeof populateTeamSelects === 'function') populateTeamSelects();
};

window.renderPaginationControls = function(totalUsers, totalPages) {
    let paginationBox = document.getElementById('userPaginationControls');
    
    if (!paginationBox) {
        const tableContainer = document.getElementById('userTableBody').closest('.max-h-\\[500px\\]').parentElement;
        tableContainer.insertAdjacentHTML('beforeend', `<div id="userPaginationControls" class="p-4 bg-slate-900 border-t border-slate-700 flex flex-wrap justify-between items-center gap-4 text-sm text-gray-400"></div>`);
        paginationBox = document.getElementById('userPaginationControls');
    }

    if (totalUsers === 0) {
        paginationBox.innerHTML = '';
        return;
    }

    let startCount = userRowsPerPage === 'all' ? 1 : ((userCurrentPage - 1) * parseInt(userRowsPerPage)) + 1;
    let endCount = userRowsPerPage === 'all' ? totalUsers : Math.min(userCurrentPage * parseInt(userRowsPerPage), totalUsers);

    paginationBox.innerHTML = `
        <div class="flex items-center gap-3">
            <span class="font-bold">แสดง:</span>
           <select onchange="userRowsPerPage = this.value; userCurrentPage = 1; window.renderUserTableDirectly();" class="bg-slate-800 border border-slate-600 text-white rounded p-1 outline-none font-bold">
                <option value="5" ${userRowsPerPage == 5 ? 'selected' : ''}>5</option>
                <option value="10" ${userRowsPerPage == 10 ? 'selected' : ''}>10</option>
                <option value="50" ${userRowsPerPage == 50 ? 'selected' : ''}>50</option>
                <option value="100" ${userRowsPerPage == 100 ? 'selected' : ''}>100</option>
                <option value="all" ${userRowsPerPage === 'all' ? 'selected' : ''}>ทั้งหมด</option>
            </select>
            <span class="hidden sm:inline">คน (รายการที่ ${startCount} - ${endCount} จาก ${totalUsers})</span>
        </div>
        <div class="flex items-center gap-2">
            <button onclick="if(userCurrentPage > 1) { userCurrentPage--; window.renderUserTableDirectly(); }" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold transition disabled:opacity-30 disabled:cursor-not-allowed" ${userCurrentPage === 1 ? 'disabled' : ''}>◀ ก่อนหน้า</button>
            <span class="text-white font-bold px-3">หน้า ${userCurrentPage} / ${totalPages}</span>
            <button onclick="if(userCurrentPage < ${totalPages}) { userCurrentPage++; window.renderUserTableDirectly(); }" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold transition disabled:opacity-30 disabled:cursor-not-allowed" ${userCurrentPage >= totalPages ? 'disabled' : ''}>ถัดไป ▶</button>
        </div>
    `;
};

function fastRecalculateStats() {
    let stats = { 'กะเช้า': { total: 0, AM: 0, OD: 0 }, 'กะกลาง': { total: 0, AM: 0, OD: 0 }, 'กะดึก': { total: 0, AM: 0, OD: 0 } };
    GLOBAL_USER_LIST.forEach(u => {
        if (stats[u.allowed_shift]) {
            stats[u.allowed_shift].total++; 
            if (u.department === 'OD') stats[u.allowed_shift].OD++;
            else stats[u.allowed_shift].AM++;
        }
    });

    const updateBox = (elId, st) => {
        const el = document.getElementById(elId);
        if(el) {
            if(el.querySelector('.stat-total')) el.querySelector('.stat-total').innerText = st.total;
            if(el.querySelector('.stat-am')) el.querySelector('.stat-am').innerText = st.AM;
            if(el.querySelector('.stat-od')) el.querySelector('.stat-od').innerText = st.OD;
        }
    };
    updateBox('countShiftM', stats['กะเช้า']);
    updateBox('countShiftA', stats['กะกลาง']);
    updateBox('countShiftN', stats['กะดึก']);
}

window.updateUserDepartment = async function(id, newDept) {
    if (!window.sysRequireAdmin()) return;

    const user = GLOBAL_USER_LIST.find(u => String(u.id) === String(id));
    if(user) user.department = newDept;
    if(typeof fastRecalculateStats === 'function') fastRecalculateStats();

    const selectEl = document.querySelector(`select[onchange*="updateUserDepartment(${id}"]`);
    if (selectEl) {
        selectEl.classList.remove('text-blue-400', 'text-pink-400', 'text-teal-400');
        if (newDept === 'OD') selectEl.classList.add('text-pink-400');
        else if (newDept === 'AM') selectEl.classList.add('text-blue-400');
        else selectEl.classList.add('text-teal-400');
    }

    appDB.from('users').update({ department: newDept }).eq('id', id).then(({error}) => {
        if (error) {
            Swal.fire('เกิดข้อผิดพลาด', error.message, 'error');
            if(typeof fetchUsers === 'function') fetchUsers(); 
        }
    });

    const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1000 });
    Toast.fire({ icon: 'success', title: `ย้ายไปแผนก ${newDept} แล้ว` });
}

// ==========================================
// 🟢 ระบบจัดการรหัสผ่าน (เปลี่ยน PIN)
// ==========================================

window.openChangePinModal = function() {
    if(document.getElementById('newPin1')) document.getElementById('newPin1').value = '';
    if(document.getElementById('newPin2')) document.getElementById('newPin2').value = '';
    if(document.getElementById('oldPin')) document.getElementById('oldPin').value = '';
    const modal = document.getElementById('changePinModal');
    if(modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex'); 
    }
};

window.closeChangePinModal = function() {
    const modal = document.getElementById('changePinModal');
    if(modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

window.submitChangePin = async function(e) {
    e.preventDefault();
    const pin1 = document.getElementById('newPin1').value;
    const pin2 = document.getElementById('newPin2').value;

    if (pin1.length !== 6 || pin2.length !== 6) return Swal.fire('แจ้งเตือน', 'กรุณาใส่ตัวเลขให้ครบ 6 หลัก', 'warning');
    if (pin1 !== pin2) return Swal.fire('ผิดพลาด', 'รหัสผ่านทั้งสองช่องไม่ตรงกัน!', 'error');
    if (!currentUser || !currentUser.id) return Swal.fire('ผิดพลาด', 'ไม่พบข้อมูลผู้ใช้งาน กรุณารีเฟรชหน้าเว็บ', 'error');

    Swal.fire({title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});

    try {
        // 🔐 [SECURITY] เปลี่ยน PIN ผ่าน function ฝั่ง server (ต้องยืนยัน PIN เดิม)
        const oldPinEl = document.getElementById('oldPin');
        const oldPin = oldPinEl ? oldPinEl.value : null;
        const { data: res, error } = await appDB.rpc('set_user_pin', { p_user_id: currentUser.id, p_old_pin: oldPin, p_new_pin: pin1 });
        if (error) throw error;
        if (!res || !res.ok) {
            Swal.close();
            if (res && res.reason === 'wrong_old_pin') return Swal.fire('ผิดพลาด', 'PIN เดิมไม่ถูกต้อง', 'error');
            return Swal.fire('ผิดพลาด', 'เปลี่ยน PIN ไม่สำเร็จ', 'error');
        }

        currentUser.has_pin = true;
        sessionStorage.setItem('user_platinum_plus', JSON.stringify(currentUser));
        if (oldPinEl) oldPinEl.value = '';
        
        closeChangePinModal();
        Swal.fire({ icon: 'success', title: 'เปลี่ยนรหัสสำเร็จ!', text: 'คราวหน้ากรุณาใช้รหัสผ่านใหม่นี้เข้าสู่ระบบครับ', timer: 2000, showConfirmButton: false });
    } catch (err) {
        console.error(err);
        Swal.fire('Error', 'เกิดข้อผิดพลาดในการเปลี่ยนรหัส: ' + err.message, 'error');
    }
};

window.resetUserPin = async function(id, username) {
    if (!window.sysRequireAdmin()) return;

    Swal.fire({
        title: `รีเซ็ต PIN ของ ${username}?`,
        text: "รหัสเดิมจะถูกล้าง พนักงานจะสามารถตั้ง PIN ใหม่ 6 หลักได้ตอนล็อกอินครั้งถัดไป",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#f59e0b',
        cancelButtonColor: '#475569',
        confirmButtonText: 'ล้างรหัส',
        cancelButtonText: 'ยกเลิก',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white' }
    }).then(async (result) => {
        if (result.isConfirmed) {
            // 🔐 [SECURITY] ต้องยืนยันด้วย PIN ของ admin เอง กันคนอื่นเปิด F12 มารีเซ็ต
            const { value: adminPin } = await Swal.fire({
                title: 'ยืนยันตัวตน', text: 'กรอก PIN ของคุณเพื่อยืนยันการรีเซ็ต',
                input: 'password', inputAttributes: { maxlength: 6, inputmode: 'numeric', autocomplete: 'off' },
                showCancelButton: true, confirmButtonText: 'ยืนยัน', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#f59e0b',
                customClass: { popup: 'dark:bg-slate-800 dark:text-white' }
            });
            if (!adminPin) return;

            Swal.fire({title: 'กำลังล้างรหัส...', didOpen: () => Swal.showLoading()});
            const { data: res, error } = await appDB.rpc('reset_user_pin', { p_admin_id: currentUser.id, p_admin_pin: adminPin, p_target_id: id });
            
            if (error) {
                Swal.fire('Error', error.message, 'error');
            } else if (!res || !res.ok) {
                Swal.fire('ไม่สำเร็จ', res && res.reason === 'wrong_admin_pin' ? 'PIN ของคุณไม่ถูกต้อง' : 'คุณไม่มีสิทธิ์รีเซ็ต PIN', 'error');
            } else {
                if(typeof fetchUsers === 'function') fetchUsers(); 
                Swal.fire({icon: 'success', title: 'สำเร็จ', text: `รีเซ็ตรหัสของ ${username} แล้ว`, timer: 1500, showConfirmButton: false});
            }
        }
    });
}
// ==========================================
// 🛠️ ระบบจัดการแผนกอัจฉริยะ (จัดการ AM, OD และแผนกสร้างใหม่ทั้งหมด)
// ==========================================
window.getSystemDepts = function() {
    let dbDepts = [];
    try { 
        if (SETTINGS['custom_departments']) {
            dbDepts = JSON.parse(SETTINGS['custom_departments']);
        } else {
            dbDepts = ['AM', 'OD', 'AMQL']; // ถ้าฐานข้อมูลยังว่าง ให้ใช้ 3 แผนกนี้เป็นค่าเริ่มต้น
        }
    } catch(e) { dbDepts = ['AM', 'OD', 'AMQL']; }
    return [...new Set(dbDepts)].sort();
};

window.addCustomPermDept = async function() {
    if (!window.sysRequireAdmin()) return;

    const inputEl = document.getElementById('newDeptInput');
    if (!inputEl) return Swal.fire('Error', 'ไม่พบช่องกรอกชื่อแผนก', 'error');
    
    const deptName = inputEl.value.toUpperCase().trim();
    if (!deptName) return Swal.fire('แจ้งเตือน', 'กรุณาพิมพ์ชื่อแผนกก่อนกดเพิ่มครับ', 'warning');

    let currentDepts = window.getSystemDepts();

    if (!currentDepts.includes(deptName)) {
        currentDepts.push(deptName);
        Swal.fire({title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
        
        await appDB.from('settings').upsert([{ key: 'custom_departments', value: JSON.stringify(currentDepts) }]);
        SETTINGS['custom_departments'] = JSON.stringify(currentDepts);
        
        inputEl.value = ''; 
        await window.loadSettings(); 
        if (typeof populateAdminDeptSelects === 'function') populateAdminDeptSelects();
        if (typeof renderUserTableDirectly === 'function') window.renderUserTableDirectly();
        
        Swal.fire({icon: 'success', title: 'สำเร็จ', text: `เพิ่มแผนก ${deptName} แล้ว`, timer: 1500, showConfirmButton: false});
    } else {
        Swal.fire('เตือน', 'มีแผนกนี้ในระบบแล้ว', 'warning');
    }
};

window.renameAnyDept = async function(oldDept) {
    if (!window.sysRequireAdmin()) return;

    const { value: newDeptRaw } = await Swal.fire({
        title: `เปลี่ยนชื่อแผนก ${oldDept}`,
        input: 'text',
        inputValue: oldDept,
        inputPlaceholder: 'พิมพ์ชื่อแผนกใหม่...',
        showCancelButton: true,
        confirmButtonText: 'บันทึกการเปลี่ยนแปลง',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#f59e0b',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl' }
    });

    if (newDeptRaw) {
        const newDept = newDeptRaw.toUpperCase().trim();
        if (!newDept || newDept === oldDept) return; 

        let currentDepts = window.getSystemDepts();

        if (currentDepts.includes(newDept)) {
            return Swal.fire('เตือน', 'มีแผนกชื่อนี้อยู่ในระบบแล้วครับ', 'warning');
        }

        Swal.fire({title: 'กำลังอัปเดตข้อมูลทั้งระบบ...', text: 'โปรดรอสักครู่...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});

        try {
            // 1. เปลี่ยนชื่อใน List แผนก
            currentDepts = currentDepts.map(d => d === oldDept ? newDept : d);
            SETTINGS['custom_departments'] = JSON.stringify(currentDepts);

            // 2. ย้ายสิทธิ์ (MENU_PERMS) ตามไปที่ชื่อใหม่
            let newPerms = JSON.parse(JSON.stringify(MENU_PERMS));
            Object.keys(newPerms).forEach(key => {
                if (key.startsWith(oldDept + '_')) {
                    const newKey = key.replace(oldDept + '_', newDept + '_');
                    newPerms[newKey] = newPerms[key];
                    delete newPerms[key]; 
                }
            });
            MENU_PERMS = newPerms;
            SETTINGS['dept_menu_rules'] = JSON.stringify(MENU_PERMS);
            window.safeSetItem('cached_menu_rules', JSON.stringify(MENU_PERMS));

            // 3. อัปเดตขึ้น Database (ตาราง settings)
            await appDB.from('settings').upsert([
                { key: 'custom_departments', value: JSON.stringify(currentDepts) },
                { key: 'dept_menu_rules', value: JSON.stringify(MENU_PERMS) }
            ]);

            // 4. 🔥 วิ่งไปเปลี่ยนแผนกให้ "พนักงานทุกคน" ในตาราง users อัตโนมัติ 🔥
            await appDB.from('users').update({ department: newDept }).eq('department', oldDept);

            // 5. อัปเดตข้อมูลในหน้าเว็บปัจจุบันให้ตรงกัน
            if (typeof GLOBAL_USER_LIST !== 'undefined') {
                GLOBAL_USER_LIST.forEach(u => {
                    if (u.department === oldDept) u.department = newDept;
                });
            }

            // 6. รีเฟรชหน้าจอให้ทุกอย่างอัปเดต
            window.renderPermsTable(); 
            if (typeof populateAdminDeptSelects === 'function') populateAdminDeptSelects();
            if (typeof renderUserTableDirectly === 'function') window.renderUserTableDirectly();

            Swal.fire({icon: 'success', title: 'เปลี่ยนชื่อแผนกสำเร็จ!', text: `ระบบอัปเดตแท็กของพนักงานทุกคนเป็น ${newDept} เรียบร้อยแล้วครับ 🎉`, timer: 2500, showConfirmButton: false});

        } catch (e) {
            console.error(e);
            Swal.fire('Error', 'เกิดข้อผิดพลาด: ' + e.message, 'error');
        }
    }
};
// =========================================================
// ⚙️ ระบบดึงการตั้งค่า (คืนชีพดีไซน์เดิม 100%)
// =========================================================

window.loadSettings = async function() {
    try {
        // ⚡ [PERF] SETTINGS ใช้แค่ค่าระบบตัวเล็กๆ (เวลาเปิด-ปิด, โควตา, สิทธิ์เมนู, แผนก ฯลฯ)
        // เดิมดึง "ทุกแถว" ของตาราง settings มาทุกครั้งที่เปิด dashboard รวมถึงก้อนใหญ่ที่หน้าอื่นดึงเองอยู่แล้ว
        // (ตารางเวร, backup, ซัพพอร์ต, SOP, ค่าปรับ, ประวัติสลิป/QR, ไฟล์ ...) → ตัดออกให้เหลือเฉพาะที่ใช้
        const EXCLUDE_PREFIXES = [
            'duty_%', 'backup_%', 'report_%', 'trainer_matrix_roles_%', 'standby_config_by_web',
            'sop_%', 'fine_%', 'kb_%', 'app_files_%', 'discord_%', 'qr_check_history', 'slip_check_history',
            'saved_excel_files', 'od_form_config', 'chrome_refresh_%', 'vps_%', 'standby_%'
        ];
        let q = appDB.from('settings').select('*');
        EXCLUDE_PREFIXES.forEach(pfx => { q = q.not('key', 'like', pfx); });
        const { data } = await q;
            
        if (data) { data.forEach(row => { SETTINGS[row.key] = row.value; }); }
        
        if (document.getElementById('dailyLimitInput')) document.getElementById('dailyLimitInput').value = SETTINGS.daily_limit || 2;
        if (document.getElementById('periodLimitInput')) document.getElementById('periodLimitInput').value = SETTINGS.period_limit || 1;
        if (document.getElementById('limitDisplay')) document.getElementById('limitDisplay').innerText = SETTINGS.daily_limit || 2;
        if (document.getElementById('periodLimitDisplay')) document.getElementById('periodLimitDisplay').innerText = SETTINGS.period_limit || 1;

        if (typeof renderOperatingHours === 'function') renderOperatingHours();
        if (typeof renderQuotaSettings === 'function') renderQuotaSettings();
        if (typeof renderPermsTable === 'function') renderPermsTable();
        
        if (typeof applyCustomTimeSlots === 'function') applyCustomTimeSlots();
        if (typeof renderManualTimeSlots === 'function') renderManualTimeSlots(); 
        
        // 🌟 เพิ่มบรรทัดนี้: บังคับให้โหลดช่วงเวลาใส่ Dropdown ทันทีหลังดึงข้อมูลเสร็จ
        if (typeof refreshTimeSlots === 'function') refreshTimeSlots();
        
        if (typeof fetchData === 'function') {
            const mainArea = document.getElementById('mainContentArea') || document.getElementById('app-content');
            if (mainArea && !mainArea.classList.contains('hidden')) {
                fetchData();
            }
        }
        
    } catch (e) { console.error("Load Settings Error:", e); }
};

// 🟢 หน้า "เพดานพักต่อเว็บ" — ไม่มีค่าให้ตั้ง แสดงผลที่ระบบคำนวณจากตารางหน้าที่ของวันที่เลือก (หลัก+รอง)
window.renderQuotaSettings = async function() {
    const container = document.getElementById('quotaSettingsContainer');
    if (!container) return;
    const dateEl = document.getElementById('capPreviewDate');
    const t = new Date();
    const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    const dateVal = (dateEl && dateEl.value) || today;

    const shifts = ['กะเช้า', 'กะกลาง', 'กะดึก'];
    const depts = ['AM', 'OD'];
    const keys = [];
    depts.forEach(d => shifts.forEach(sh => keys.push(`duty_roster_${d}_${dateVal}_${sh}`)));
    let rows = {};
    try {
        const { data } = await appDB.from('settings').select('key, value').in('key', keys);
        (data || []).forEach(r => { try { rows[r.key] = JSON.parse(r.value); } catch (e) {} });
    } catch (e) {}

    const allTeams = [...TEAM_LIST].sort((a, b) => a.localeCompare(b));
    const table = (dept) => {
        const maps = {};
        shifts.forEach(sh => { const r = rows[`duty_roster_${dept}_${dateVal}_${sh}`]; maps[sh] = r ? window.buildCoverageMap(r) : null; });
        const cell = (sh, team) => {
            const m = maps[sh];
            if (!m) return `<div class="w-28 shrink-0 text-center text-[10px] text-slate-600 ml-2">ยังไม่จัด</div>`;
            // 🌟 กติกาใหม่: แยกกลุ่มหลัก/รอง — คีย์ในแผนที่คือ "เว็บ (หลัก)" กับ "เว็บ (รอง)"
            const n1 = (m.webs[`${team} (หลัก)`] || new Set()).size;
            const n2 = (m.webs[`${team} (รอง)`] || new Set()).size;
            const c1 = n1 ? window.breakCapByRule(n1) : 0;
            const c2 = n2 ? window.breakCapByRule(n2) : 0;
            const any = n1 || n2;
            return `<div class="w-28 shrink-0 text-center ml-2 rounded-lg border ${any ? 'border-slate-600 bg-slate-900' : 'border-slate-800 bg-slate-900/40'} py-1 leading-tight">
                <div class="text-[10px] ${n1 ? 'text-sky-300' : 'text-slate-600'}">หลัก ${n1} → <b class="${n1 ? 'text-emerald-300' : ''}">${c1}</b></div>
                <div class="text-[10px] ${n2 ? 'text-amber-300' : 'text-slate-600'}">รอง ${n2} → <b class="${n2 ? 'text-emerald-300' : ''}">${c2}</b></div>
            </div>`;
        };
        return `
        <div class="flex text-[10px] font-bold text-pink-400 mb-2 min-w-max shrink-0">
            <div class="w-24 shrink-0 text-center">เว็บ</div>
            <div class="w-28 shrink-0 text-center text-orange-400 ml-2">เช้า</div>
            <div class="w-28 shrink-0 text-center text-blue-400 ml-2">กลาง</div>
            <div class="w-28 shrink-0 text-center text-purple-400 ml-2">ดึก</div>
        </div>
        <div class="space-y-2 flex-1 overflow-auto custom-scrollbar pr-1">
            ${allTeams.map(team => `
            <div class="flex items-center min-w-max">
                <div class="bg-[#f0fdf4] dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-slate-800 dark:text-emerald-100 font-bold px-3 py-1.5 rounded-lg w-24 text-center text-xs shrink-0">${team}</div>
                ${cell('กะเช้า', team)}${cell('กะกลาง', team)}${cell('กะดึก', team)}
            </div>`).join('')}
        </div>`;
    };

    container.innerHTML = `
        <div class="flex flex-col gap-4 w-full mt-2">
            <div class="bg-sky-900/20 border border-sky-700/40 rounded-xl p-3 text-[11px] text-sky-200 leading-relaxed flex flex-wrap items-center gap-3">
                <div class="flex-1 min-w-[260px]">
                    <b>กติกา (อัตโนมัติ ไม่มีค่าให้ตั้ง):</b> แยกนับ <b>หลัก</b> กับ <b>รอง</b> คนละกลุ่ม — หลักชนหลัก / รองชนรอง เกินเพดานไม่ได้ แต่หลักชนรองได้ · เพดานต่อกลุ่ม →
                    1-4 คน→1, 5-7→2, 8-10→3, 11-14→4, 15-20→5, 21-25→6, 26-30→7, 31+→8 · แยก AM / OD ไม่ปนกัน
                </div>
                <label class="flex items-center gap-2 text-[11px] text-slate-300 shrink-0">ดูของวันที่
                    <input type="date" id="capPreviewDate" value="${dateVal}" onchange="renderQuotaSettings()" class="bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-white text-[11px] outline-none focus:border-sky-500">
                </label>
            </div>
            <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 w-full">
                <div class="bg-[#151f32] rounded-xl border border-slate-700/80 shadow-inner p-4 flex flex-col h-[460px]">
                    <h5 class="text-blue-300 font-bold text-xs flex items-center gap-1.5 mb-3 border-b border-slate-700/50 pb-2 shrink-0"><span class="material-icons text-[14px]">domain</span> แผนก AM — คน → พักพร้อมกันได้</h5>
                    ${table('AM')}
                </div>
                <div class="bg-[#151f32] rounded-xl border border-slate-700/80 shadow-inner p-4 flex flex-col h-[460px]">
                    <h5 class="text-pink-300 font-bold text-xs flex items-center gap-1.5 mb-3 border-b border-slate-700/50 pb-2 shrink-0"><span class="material-icons text-[14px]">groups</span> แผนก OD — คน → พักพร้อมกันได้</h5>
                    ${table('OD')}
                </div>
            </div>
        </div>`;
};

// ==========================================
// 🕘 ประวัติโควตา — ดูว่าโควตาถูกเปลี่ยนเมื่อไหร่ เพราะอะไร (อัตโนมัติจากตารางหน้าที่ / กดมือ)
// ==========================================

window.renderQuotaHistory = async function() {
    const c = document.getElementById('quotaHistoryContainer');
    if (!c) return;
    c.innerHTML = '<div class="text-center py-10 text-gray-500"><span class="material-icons animate-spin mb-2 text-2xl">sync</span><br>กำลังโหลดประวัติ...</div>';
    try {
        // เพดานพักเปลี่ยนตามตารางหน้าที่ → ประวัติที่มีผล = การจัด/ย้าย/ล้าง/กู้คืน ตารางหน้าที่
        const { data, error } = await appDB.from('system_logs').select('*')
            .in('action_type', ['สุ่มจัดหน้าที่', 'ย้ายหน้าที่', 'ล้างตารางงาน', 'กู้คืนตารางงาน'])
            .order('created_at', { ascending: false }).limit(80);
        if (error) throw error;
        if (!data || data.length === 0) { c.innerHTML = '<div class="text-center py-10 text-gray-500 text-sm">ยังไม่มีประวัติ</div>'; return; }
        const esc = v => String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const fmt = d => new Date(d).toLocaleString('th-TH', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
        let html = '<div class="space-y-2">';
        data.forEach(log => {
            let badge = 'bg-slate-700 text-slate-200 border-slate-600';
            if (log.action_type === 'สุ่มจัดหน้าที่') badge = 'bg-indigo-900/40 text-indigo-300 border-indigo-700/50';
            else if (log.action_type === 'ย้ายหน้าที่') badge = 'bg-purple-900/40 text-purple-300 border-purple-700/50';
            else if (log.action_type === 'ล้างตารางงาน') badge = 'bg-red-900/40 text-red-300 border-red-700/50';
            else if (log.action_type === 'กู้คืนตารางงาน') badge = 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50';
            html += `
            <div class="bg-slate-800/50 border border-slate-700 rounded-xl p-2.5 text-[11px]">
                <div class="flex flex-wrap items-center gap-2">
                    <span class="font-mono text-gray-400">${fmt(log.created_at)}</span>
                    <span class="${badge} border px-2 py-0.5 rounded-md font-bold">${esc(log.action_type)}</span>
                    <span class="text-gray-500">โดย <b class="text-white">${esc(log.performed_by)}</b></span>
                </div>
                <div class="text-gray-300 mt-1 whitespace-pre-wrap break-words">${esc(log.target_details)}</div>
            </div>`;
        });
        html += '</div>';
        c.innerHTML = html;
    } catch (e) {
        c.innerHTML = `<div class="text-center py-6 text-red-400 text-sm">โหลดประวัติไม่สำเร็จ: ${e.message}</div>`;
    }
};

window.saveQuotaSettings = async function() {
    Swal.fire('ไม่ต้องบันทึก', 'เพดานพักต่อเว็บคำนวณอัตโนมัติจากตารางจัดหน้าที่ ไม่มีค่าให้ตั้งครับ', 'info');
};

// =========================================================