// ════════════════════════════════════════════════════════════════════
// 📦 swap/view.js — ส่วนที่ 2/4 ของระบบสลับกะ (แยกจาก swap.js เดิม 1,633 บรรทัด)
// เนื้อหา: ตัวกรอง, ดึงตารางมาแสดง, ค้นหา, ลบ/กู้คืน
// ⚠️ ลำดับโหลด: swap/core → swap/view → swap/admin → swap/extras (ห้ามสลับ — ตัวแปร top-level แชร์ scope เดียวกัน)
// ════════════════════════════════════════════════════════════════════
// 👁️ ตัวกรองหน้าสลับกะ (Filter)
// ==========================================
window.setSwapTypeFilter = function(type) {
    activeSwapTypeFilter = type;
    document.querySelectorAll('.swap-filter-btn').forEach(btn => {
        btn.classList.remove('ring-2', 'ring-blue-400', 'scale-[1.02]');
        btn.classList.add('opacity-60');
        if (btn.id === 'btnFilterSwapall') btn.classList.replace('bg-blue-600', 'bg-slate-600');
    });
    
    const activeBtn = document.getElementById(`btnFilterSwap${type}`);
    if (activeBtn) {
        activeBtn.classList.remove('opacity-60');
        activeBtn.classList.add('scale-[1.02]', 'ring-2', 'ring-blue-400');
        if (type === 'all') activeBtn.classList.replace('bg-slate-600', 'bg-blue-600');
    }
    window.filterSwapSchedule(); 
};

window.setSwapDeptFilter = function(dept) {
    activeSwapDeptFilter = dept;
    ['AM', 'OD', 'TRAINER'].forEach(d => {
        const btn = document.getElementById(`btnSwapDept${d}`);
        if (btn) { if (d === dept) btn.classList.add('active'); else btn.classList.remove('active'); }
    });

    const deptSelect = document.getElementById('swapDeptSelect');
    if (deptSelect && deptSelect.value !== dept) { deptSelect.value = dept; if(typeof clearExcludeStaff === 'function') clearExcludeStaff(); }
    
    window.fetchPublicSwapSchedule(); 
    if(typeof checkSwapBackup === 'function') window.checkSwapBackup(); 
};

// ==========================================
// 📊 ดึงตารางสลับกะมาแสดง
// ==========================================
window.fetchPublicSwapSchedule = async function() {
    const box = document.getElementById('publicSwapList');
    if (!box) return;
    box.innerHTML = `<div class="col-span-full flex flex-col items-center justify-center py-10"><span class="material-icons animate-spin text-blue-500 text-4xl mb-2">sync</span><span class="text-gray-500 font-bold text-sm">กำลังดึงข้อมูลตารางสลับกะ...</span></div>`;

    try {
        const statusFilterEl = document.getElementById('swapStatusFilter');
        const statusMode = statusFilterEl ? statusFilterEl.value : 'pending';
        let statusesToFetch = statusMode === 'pending' ? ['pending', 'info_only'] : ['completed'];

        let query = appDB.from('scheduled_tasks').select('id, task_type, payload, scheduled_for, status, created_at').eq('task_type', 'individual_shift_update').in('status', statusesToFetch);
        if (statusMode === 'pending') query = query.order('status', { ascending: false }).order('scheduled_for', { ascending: true });
        else query = query.order('scheduled_for', { ascending: false }).limit(200);

        const { data, error } = await query;
        if (error) throw error;

        let countMorning = 0; let countNight = 0; let countSame = 0; let validDataCount = 0; let html = '';

        if (data && data.length > 0) {
            const safeUserList = (typeof GLOBAL_USER_LIST !== 'undefined') ? GLOBAL_USER_LIST : [];
            window._swapScheduleTasks = Object.fromEntries(data.map(t => [t.id, t]));

            html = data.map(task => {
                let p = {}; try { p = typeof task.payload === 'string' ? JSON.parse(task.payload) : (task.payload || {}); } catch(e) {}
                const userName = String(p.user_name || 'ไม่ทราบชื่อ'); 
                const targetShift = String(p.target_shift || '');
                let origShift = String(p.original_shift || ''); 

                const dbUser = safeUserList.find(u => u.username === userName);
                const userDept = dbUser ? (dbUser.department || 'AM') : 'AM';

                if (activeSwapDeptFilter !== 'ALL') {
                    if (activeSwapDeptFilter === 'TRAINER') { if (userDept === 'AM' || userDept === 'OD') return ''; } 
                    else { if (userDept !== activeSwapDeptFilter) return ''; }
                }

                validDataCount++; 
                if (!origShift && (task.status === 'info_only' || targetShift === 'คงเดิม')) {
                    if (p.display_desc && p.display_desc.includes('เช้า')) origShift = 'กะเช้า';
                    if (p.display_desc && p.display_desc.includes('ดึก')) origShift = 'กะดึก';
                }
                
                let dateStr = '-'; let prevDateStr = '-';
                if (task.scheduled_for) {
                    const dateObj = new Date(task.scheduled_for);
                    dateStr = dateObj.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
                    const prevDateObj = new Date(dateObj); prevDateObj.setDate(prevDateObj.getDate() - 1);
                    prevDateStr = prevDateObj.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
                }

                let icon = '', bgClass = '', txtClass = '', actionTitle = '', detailHtml = '';
                let swapTypeForFilter = 'same'; 

                if (task.status === 'info_only' || targetShift === 'คงเดิม') {
                    if (origShift === 'กะเช้า') { icon = 'wb_sunny'; actionTitle = 'ไม่ได้สลับกะ (อยู่เช้าต่อ)'; bgClass = 'bg-slate-800 border-orange-900/30 opacity-90'; txtClass = 'text-orange-400'; } 
                    else if (origShift === 'กะดึก') { icon = 'dark_mode'; actionTitle = 'ไม่ได้สลับกะ (อยู่ดึกต่อ)'; bgClass = 'bg-slate-800 border-purple-900/30 opacity-90'; txtClass = 'text-purple-400'; } 
                    else { icon = 'person_off'; actionTitle = 'ไม่ได้สลับกะ (อยู่กะเดิม)'; bgClass = 'bg-slate-800 border-gray-600 opacity-90'; txtClass = 'text-gray-400'; }
                    detailHtml = `<span class="text-gray-400">${p.display_desc || 'อยู่กะเดิมในรอบนี้'}</span>`;
                    swapTypeForFilter = 'same'; countSame++; 
                } 
                else if (targetShift === 'กะดึก') {
                    icon = 'dark_mode'; bgClass = 'bg-[#1e1b4b] border-purple-900/50'; txtClass = 'text-purple-400'; actionTitle = 'สลับไปดึก';
                    if (p.display_desc) {
                        const sep = p.display_desc.includes(' → ') ? ' → ' : ' | ';
                        const parts = p.display_desc.split(sep);
                        if (parts.length >= 2) {
                            const colors = ['text-orange-400', 'text-purple-400', 'text-purple-300'];
                            detailHtml = parts.map((part, i) => `<span class="block text-xs font-bold mt-0.5 ${colors[i]||'text-purple-400'}">${part}</span>`).join('');
                        } else {
                            detailHtml = `<span class="text-orange-400 font-bold text-xs">${p.display_desc}</span>`;
                        }
                    } else {
                        detailHtml = `<span class="text-purple-400 font-bold text-xs">เริ่มเข้าดึกวันที่: <b class="text-gray-200">${dateStr}</b></span>`;
                    }
                    swapTypeForFilter = 'night'; countNight++;
                }
                else if (targetShift === 'กะเช้า') {
                    icon = 'wb_sunny'; bgClass = 'bg-[#422006] border-orange-900/50'; txtClass = 'text-orange-500'; actionTitle = 'สลับไปเช้า';
                    if (p.display_desc) {
                        const sep = p.display_desc.includes(' → ') ? ' → ' : ' | ';
                        const parts = p.display_desc.split(sep);
                        if (parts.length >= 2) {
                            const colors = ['text-purple-400', 'text-yellow-400', 'text-green-400'];
                            detailHtml = parts.map((part, i) => `<span class="block text-xs font-bold mt-0.5 ${colors[i]||'text-purple-400'}">${part}</span>`).join('');
                        } else {
                            detailHtml = `<span class="text-purple-400 font-bold text-xs">${p.display_desc}</span>`;
                        }
                    } else {
                        detailHtml = `<span class="text-purple-400 font-bold text-xs">เริ่มเข้าเช้าวันที่: <b class="text-green-400">${dateStr}</b></span>`;
                    }
                    swapTypeForFilter = 'morning'; countMorning++;
                }

                let completedBadge = '';
                if (task.status === 'completed') {
                    bgClass = bgClass.replace(/border-(purple|orange)-900\/50/g, 'border-green-900/50').replace('bg-[#1e1b4b]', 'bg-slate-900').replace('bg-[#422006]', 'bg-slate-900');
                    completedBadge = `<div class="absolute -top-3 -right-2 bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 border border-green-400 z-20"><span class="material-icons text-[10px]">check_circle</span> สำเร็จแล้ว</div>`;
                    txtClass = 'text-gray-400'; 
                }

                const isMe = userName === (currentUser.username || '');
                const myHighlight = isMe ? 'ring-2 ring-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] scale-[1.02] z-10' : '';
                const safeSearchName = userName.toLowerCase();
                
                const isGlobalAdmin = (currentUser && (currentUser.role === 'manager' || currentUser.role === 'admin'));
                const canManageSwap = isGlobalAdmin || (typeof window.hasUserPerm === 'function' && window.hasUserPerm('swap_manage'));
                const adminDelete = canManageSwap ? `<button onclick="deleteTask(${task.id}); setTimeout(fetchPublicSwapSchedule, 500);" class="absolute top-2 right-2 text-red-500 hover:text-red-400 p-1 bg-black/20 rounded-lg transition z-20" title="${task.status === 'completed' ? 'ลบประวัตินี้' : 'ยกเลิกคิวนี้'}"><span class="material-icons text-sm">delete</span></button>` : '';

                let displayDeptBadge = userDept;
                if (userDept !== 'AM' && userDept !== 'OD') displayDeptBadge = 'AMQL';

                const canEditSaved = canManageSwap && task.status !== 'completed';
                const userNameHtml = canEditSaved
                    ? `<span onclick="openSavedSwapMenu(${task.id})" class="cursor-pointer hover:underline hover:text-blue-300 transition" title="คลิกเพื่อจัดการ">${userName}</span>`
                    : userName;

                return window.renderTemplate('tpl-swap-schedule-item', {
                    bgClass: bgClass,
                    myHighlight: myHighlight,
                    safeSearchName: safeSearchName,
                    swapTypeForFilter: swapTypeForFilter,
                    userDept: userDept,
                    completedBadge: completedBadge,
                    adminDelete: adminDelete,
                    txtClass: txtClass,
                    icon: icon,
                    userNameHtml: userNameHtml,
                    displayDeptBadge: displayDeptBadge,
                    isMeBadge: isMe ? '<span class="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded shadow-sm">คุณ</span>' : '',
                    actionTitle: actionTitle,
                    detailHtml: detailHtml
                });
            }).join('');
        }

        if (validDataCount === 0) {
            const noDataMsg = statusMode === 'pending' ? 'ไม่มีกำหนดการสลับกะในช่วงนี้' : 'ยังไม่มีประวัติการสลับกะที่สำเร็จแล้ว';
            box.innerHTML = `<div class="col-span-full text-center text-gray-400 py-8 bg-slate-800/50 rounded-xl border border-dashed border-slate-600">${noDataMsg}</div>`;
        } else { box.innerHTML = html; }

        const isGlobalAdminStat = (currentUser && (currentUser.role === 'manager' || currentUser.role === 'admin'));
        const canManageSwapStat = isGlobalAdminStat || (typeof window.hasUserPerm === 'function' && window.hasUserPerm('swap_manage'));
        
        if (isGlobalAdminStat || canManageSwapStat) {
            const elMorning = document.getElementById('statSwapMorning'); const elNight = document.getElementById('statSwapNight'); const elSame = document.getElementById('statSwapSame');
            if (elMorning) { elMorning.innerText = countMorning; elMorning.style.color = '#ffffff'; }
            if (elNight) { elNight.innerText = countNight; elNight.style.color = '#ffffff'; }
            if (elSame) { elSame.innerText = countSame; elSame.style.color = '#ffffff'; }
        }

        window.filterSwapSchedule();
    } catch (err) {
        box.innerHTML = `<div class="col-span-full text-center text-red-500 py-6">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>`;
    }
}

// ==========================================
// 🔍 ฟังก์ชันค้นหา & กรอง
// ==========================================
window.filterSwapSchedule = function() {
    const input = document.getElementById('searchSwapSchedule');
    if (!input) return;
    const filterText = input.value.toLowerCase();
    const items = document.querySelectorAll('.swap-item');
    
    let foundCount = 0;
    items.forEach(item => {
        const name = item.dataset.name || ''; const type = item.dataset.swaptype || ''; const dept = item.dataset.dept || 'AM'; 
        
        const matchName = name.includes(filterText);
        const matchType = (activeSwapTypeFilter === 'all') || (type === activeSwapTypeFilter);
        let matchDept = false;
        if (activeSwapDeptFilter === 'TRAINER') matchDept = (dept !== 'AM' && dept !== 'OD'); 
        else matchDept = (dept === activeSwapDeptFilter);

        if (matchName && matchType && matchDept) { item.style.display = 'flex'; foundCount++; } 
        else { item.style.display = 'none'; }
    });

    const box = document.getElementById('publicSwapList');
    let noResultMsg = document.getElementById('noSwapResult');
    
    if (foundCount === 0 && (filterText !== '' || activeSwapTypeFilter !== 'all' || activeSwapDeptFilter !== 'ALL')) {
        if (!noResultMsg) box.insertAdjacentHTML('beforeend', `<div id="noSwapResult" class="col-span-full text-center text-gray-400 py-6">ไม่พบรายชื่อตามเงื่อนไขที่ค้นหา</div>`);
        else noResultMsg.style.display = 'block';
    } else if (noResultMsg) { noResultMsg.style.display = 'none'; }
}

window.filterSwapToMyself = function() {
    const input = document.getElementById('searchSwapSchedule');
    if (input && currentUser && currentUser.username) {
        input.value = currentUser.username; filterSwapSchedule(); 
    }
}

window.highlightSwapPreview = function() {
    const input = document.getElementById('searchSwapPreview');
    if (!input) return;
    const term = input.value.toLowerCase().trim();
    const tags = document.querySelectorAll('#planDaysContainer span[draggable="true"]');

    tags.forEach(tag => {
        const name = tag.innerText.toLowerCase();
        if (term === '') {
            tag.classList.remove('ring-2', 'ring-offset-1', 'ring-red-600', 'font-black', 'shadow-md', 'z-10', 'relative');
            tag.style.opacity = '1';
        } else if (name.includes(term)) {
            tag.classList.add('ring-2', 'ring-offset-1', 'ring-red-600', 'font-black', 'shadow-md', 'z-10', 'relative');
            tag.style.opacity = '1';
        } else {
            tag.classList.remove('ring-2', 'ring-offset-1', 'ring-red-600', 'font-black', 'shadow-md', 'z-10', 'relative');
            tag.style.opacity = '0.2';
        }
    });
};

// ==========================================
// 🗑️ ลบ และ กู้คืน ตารางสลับกะ
// ==========================================
window.checkSwapBackup = function() {
    const btn = document.getElementById('btnRestoreSwap');
    if (!btn) return;
    const backupData = localStorage.getItem(`backup_swap_${activeSwapDeptFilter}`);
    if (backupData && JSON.parse(backupData).length > 0) btn.classList.remove('hidden');
    else btn.classList.add('hidden');
};

window.deleteAllSwapSchedules = async function() {
    const isGlobalAdmin = (currentUser && (currentUser.role === 'manager' || currentUser.role === 'admin'));
    const canManageSwap = isGlobalAdmin || (typeof window.hasUserPerm === 'function' && window.hasUserPerm('swap_manage'));
    if (!canManageSwap) return;
    
    let deptName = activeSwapDeptFilter === 'TRAINER' ? 'ผู้สอน' : activeSwapDeptFilter;

    Swal.fire({
        title: `ล้างตารางสลับกะ ${deptName}?`, text: `ข้อมูลการสลับกะจะถูกลบ (สามารถกดกู้คืนได้ภายหลัง)`, icon: 'warning',
        showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'ใช่, ลบทิ้งเลย', cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({ title: 'กำลังลบข้อมูล...', didOpen: () => Swal.showLoading() });
            try {
                const { data } = await appDB.from('scheduled_tasks').select('id, task_type, payload, scheduled_for, status').eq('task_type', 'individual_shift_update');
                if (data && data.length > 0) {
                    const idsToDelete = []; const tasksToBackup = [];
                    const safeUserList = (typeof GLOBAL_USER_LIST !== 'undefined') ? GLOBAL_USER_LIST : [];

                    data.forEach(task => {
                        let p = {}; try { p = typeof task.payload === 'string' ? JSON.parse(task.payload) : task.payload; } catch(e){}
                        const dbUser = safeUserList.find(u => u.username === p.user_name);
                        const uDept = dbUser ? (dbUser.department || 'AM') : 'AM';
                        
                        let isMatch = false;
                        if (activeSwapDeptFilter === 'TRAINER') isMatch = (uDept !== 'AM' && uDept !== 'OD');
                        else isMatch = (uDept === activeSwapDeptFilter);

                        if (isMatch) { idsToDelete.push(task.id); tasksToBackup.push(task); }
                    });

                    if (idsToDelete.length > 0) {
                        window.safeSetItem(`backup_swap_${activeSwapDeptFilter}`, JSON.stringify(tasksToBackup));
                        await appDB.from('scheduled_tasks').delete().in('id', idsToDelete);
                    }
                }
                
                if(typeof logAction === 'function') await logAction('Auto Swap Delete', `ลบตารางสลับกะเฉพาะแผนก ${deptName} แล้ว`);

                Swal.fire('ลบสำเร็จ', `เคลียร์ข้อมูลของแผนก ${deptName} เรียบร้อย`, 'success');
                fetchPublicSwapSchedule(); checkSwapBackup(); 
            } catch (err) { Swal.fire('Error', 'ไม่สามารถลบข้อมูลได้', 'error'); }
        }
    });
}

window.restoreDeletedSwapSchedules = async function() {
    const backupData = localStorage.getItem(`backup_swap_${activeSwapDeptFilter}`);
    if (!backupData) return Swal.fire('ไม่พบข้อมูล', 'ไม่มีข้อมูลที่สามารถกู้คืนได้ในขณะนี้', 'error');

    let tasksToRestore = [];
    try { tasksToRestore = JSON.parse(backupData); } catch(e) { return Swal.fire('Error', 'ข้อมูลสำรองเสียหาย', 'error'); }
    if (tasksToRestore.length === 0) return Swal.fire('ไม่พบข้อมูล', 'ข้อมูลสำรองว่างเปล่า', 'error');

    Swal.fire({
        title: 'กู้คืนข้อมูล?', text: `ระบบจะนำตารางสลับกะที่เพิ่งลบไป ${tasksToRestore.length} รายการ กลับมาใช้งานอีกครั้ง`, icon: 'question',
        showCancelButton: true, confirmButtonColor: '#10b981', confirmButtonText: 'กู้คืนเลย', cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({title: 'กำลังกู้คืน...', didOpen: () => Swal.showLoading()});
            try {
                const insertPayload = tasksToRestore.map(t => { const { id, created_at, ...rest } = t; return rest; });
                const { error } = await appDB.from('scheduled_tasks').insert(insertPayload);
                if (error) throw error;

                localStorage.removeItem(`backup_swap_${activeSwapDeptFilter}`);
                
                if(typeof logAction === 'function') {
                    let deptName = activeSwapDeptFilter === 'TRAINER' ? 'ผู้สอน' : activeSwapDeptFilter;
                    await logAction('Auto Swap Restore', `กู้คืนตารางสลับกะแผนก ${deptName}`);
                }

                Swal.fire('กู้คืนสำเร็จ', 'ข้อมูลสลับกะกลับมาเรียบร้อยแล้ว', 'success');
                fetchPublicSwapSchedule(); checkSwapBackup(); 
            } catch (err) { Swal.fire('Error', 'เกิดข้อผิดพลาดในการกู้คืน', 'error'); }
        }
    });
};

// ==========================================