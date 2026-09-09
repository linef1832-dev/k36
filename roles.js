// ════════════════════════════════════════════════════════════════════
// 📦 duty/roles.js — ส่วนที่ 3/6 ของหน้าจัดหน้าที่/เวร (แยกจาก duty.js เดิม 5,478 บรรทัด)
// เนื้อหา: หน้าที่สำคัญ/พิเศษ, ล้างงานรอง, AI จัดรองด่วน (2-Pass), ปุ่มบนแถบเครื่องมือ
// ⚠️ ลำดับโหลด (PAGE_SCRIPTS ใน global.js): duty/core → duty/dragdrop → duty/roles → duty/tools → duty/support → duty/rotation
// ตัวแปร top-level (currentDutyDept, sortedTeams ฯลฯ) แชร์ข้ามไฟล์กันอัตโนมัติ — scope เดียวกัน
// ════════════════════════════════════════════════════════════════════
// ==========================================
// 🌟 ระบบหน้าที่สำคัญ / พิเศษ (แสดงผลซ้ายมือ)
// ==========================================

window.ensureImportantTasksContainer = function() {
    let container = document.getElementById('importantTasksPanel');
    if (!container) {
        const resultGrid = document.getElementById('dutyResultGrid');
        const matrixGrid = document.getElementById('dutyMatrixGrid');
        const gridParent = resultGrid.parentElement;
        
        if (gridParent.id === 'dutyRosterWrapper') return;

        const wrapper = document.createElement('div');
        wrapper.id = 'dutyRosterWrapper';
        wrapper.className = 'flex flex-col xl:flex-row gap-5 w-full items-start';
        
        const leftPanel = document.createElement('div');
        leftPanel.id = 'importantTasksPanel';
        leftPanel.className = 'w-full xl:w-[340px] shrink-0 hidden transition-all';
        
        const rightPanel = document.createElement('div');
        rightPanel.id = 'mainRosterPanel';
        rightPanel.className = 'flex-1 min-w-0 w-full';
        
        gridParent.insertBefore(wrapper, resultGrid);
        rightPanel.appendChild(resultGrid);
        if(matrixGrid) rightPanel.appendChild(matrixGrid);
        
        wrapper.appendChild(leftPanel);
        wrapper.appendChild(rightPanel);
    }
};

window.renderImportantTasksPanel = function() {
    const panel = document.getElementById('importantTasksPanel');
    if (!panel) return;
    
    const isTrainerDept = window.isTrainerDept();
    const isAMDept = (currentDutyDept === 'AM');

    // แท็บที่ไม่ใช่ AMQL และไม่ใช่ AM → ซ่อน panel ทั้งหมด
    if (!isTrainerDept && !isAMDept) { panel.classList.add('hidden'); return; }

    panel.classList.remove('hidden');
    const isAdmin = window.isDutyAdmin();

    // ===== โหลดผลรวมห้องที่บันทึกไว้ =====
    const targetDate = document.getElementById('dutyDate').value;
    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    // [FIX] อ่านจากค่าที่ refreshDutyData โหลดมาจาก DB (เดิมอ่าน localStorage เห็นแค่เครื่องเดียว)
    const savedRooms = Array.isArray(window.savedMergeRooms) ? window.savedMergeRooms : [];

    const isSaved = savedRooms.length > 0;
    const isEditing = window.currentMergeRooms && window.currentMergeRooms.length > 0 && !isSaved;

    // ===== render ส่วนรวมห้อง =====
    let mergeBodyHtml = '';

    if (isSaved) {
        // แสดงผลที่บันทึกแล้ว + ปุ่มลบ
        mergeBodyHtml = savedRooms.map(room => {
            const teamsHtml = room.teams.map(team => {
                const colorClass = TEAM_COLORS[team] || TEAM_COLORS['DEFAULT'];
                return `<span class="text-[11px] font-black px-2 py-0.5 rounded-lg border ${colorClass.border} ${colorClass.lightBg} ${colorClass.lightText}">${team}</span>`;
            }).join('');
            return `
                <div class="flex items-center gap-2 py-1.5 border-b border-slate-700/50 last:border-0">
                    <span class="w-5 h-5 rounded-full bg-violet-600 text-white text-[10px] font-black flex items-center justify-center shrink-0">${room.id}</span>
                    <div class="flex flex-wrap gap-1">${teamsHtml}</div>
                </div>`;
        }).join('');
    } else {
        // โหมดแก้ไข — drag & drop ในตัว
        const rooms = window.currentMergeRooms || [];
        if (rooms.length > 0) {
            mergeBodyHtml = rooms.map(room => {
                const teamsHtml = room.teams.map(team => {
                    const colorClass = TEAM_COLORS[team] || TEAM_COLORS['DEFAULT'];
                    return `
                        <span class="inline-flex items-center text-[11px] font-black px-2 py-0.5 rounded-lg border ${colorClass.border} ${colorClass.lightBg} ${colorClass.lightText} cursor-grab active:cursor-grabbing select-none"
                              draggable="true"
                              ondragstart="window.mergeRoomDragStart(event, ${room.id}, '${team}')"
                              ondragend="window.mergeRoomDragEnd(event)">${team}</span>`;
                }).join('');
                return `
                    <div class="merge-room-drop py-1.5 border-b border-slate-700/50 last:border-0 transition-colors rounded"
                         ondragover="window.mergeRoomDragOver(event)"
                         ondrop="window.mergeRoomDropInline(event, ${room.id})">
                        <div class="flex items-start gap-2">
                            <span class="w-5 h-5 rounded-full bg-violet-600 text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">${room.id}</span>
                            <div class="flex flex-wrap gap-1">${teamsHtml}</div>
                        </div>
                    </div>`;
            }).join('');
        } else {
            mergeBodyHtml = `<div class="text-center text-[11px] text-slate-500 font-bold py-2">กดสุ่มรวมห้องเพื่อเริ่ม</div>`;
        }
    }

    const mergeHtml = `
        <div class="bg-[#151f32] border border-violet-700/60 rounded-2xl shadow-lg overflow-hidden mt-3">
            <div class="bg-gradient-to-r from-violet-700 to-purple-600 text-white px-3 py-2 flex justify-between items-center">
                <div class="flex items-center gap-1.5">
                    <span class="material-icons text-[16px]">meeting_room</span>
                    <h4 class="font-black text-xs tracking-wide">การรวมห้อง Discord</h4>
                </div>
                <div class="flex gap-1">
                    ${isAMDept ? '' : isSaved ? `
                        <button onclick="window.deleteMergeRooms()" class="bg-red-600/80 hover:bg-red-600 px-2 py-1 rounded text-[10px] font-bold transition flex items-center gap-1 border border-red-400/50 active:scale-95">
                            <span class="material-icons text-[11px]">delete</span> ลบ
                        </button>` : `
                        <button onclick="window.shuffleMergeRoomsInline()" class="bg-black/20 hover:bg-black/30 px-2 py-1 rounded text-[10px] font-bold transition flex items-center gap-1 border border-white/20 active:scale-95">
                            <span class="material-icons text-[11px]">shuffle</span> สุ่ม
                        </button>
                        ${(window.currentMergeRooms && window.currentMergeRooms.length > 0) ? `
                        <button onclick="window.saveMergeRooms()" class="bg-emerald-600 hover:bg-emerald-500 px-2 py-1 rounded text-[10px] font-bold transition flex items-center gap-1 border border-emerald-400/50 active:scale-95">
                            <span class="material-icons text-[11px]">save</span> บันทึก
                        </button>` : ''}
                    `}
                </div>
            </div>
            <div class="p-2.5 flex flex-col">${mergeBodyHtml}</div>
        </div>`;
    
    let html = `
        <div class="bg-[#151f32] border border-slate-700/80 rounded-2xl shadow-lg flex flex-col max-h-[750px] overflow-hidden">
            <div class="bg-gradient-to-r from-amber-600 to-yellow-500 text-white p-3 flex justify-between items-center shadow-md shrink-0">
                <div class="flex items-center gap-2">
                    <span class="material-icons">star</span>
                    <h4 class="font-black text-sm tracking-wide">หน้าที่ประจำ / พิเศษ</h4>
                </div>
                <div class="flex gap-1">
                    ${isAdmin ? `<button onclick="window.randomizeImportantTasks()" class="bg-indigo-600 hover:bg-indigo-500 px-2 py-1 rounded text-[10px] font-bold shadow-inner transition flex items-center gap-1 border border-indigo-400 active:scale-95"><span class="material-icons text-[12px]">casino</span> สุ่มลงงาน</button>` : ''}
                    ${isAdmin ? `<button onclick="window.addImportantTask()" class="bg-black/20 hover:bg-black/30 px-2 py-1 rounded text-[10px] font-bold shadow-inner transition flex items-center gap-1 border border-white/20 active:scale-95"><span class="material-icons text-[12px]">add</span> เพิ่ม</button>` : ''}
                </div>
            </div>
            <div class="p-3 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3">
    `;
    
    // 🌟 ดึงงานทั้งหมดมาโชว์ (ทั้งงานในปัจจุบัน และงานเก่าในอดีตที่เคยมีคนทำ)
    const allTasksToShow = [...new Set([...window.globalImportantTasks, ...Object.keys(window.currentImportantAssigns)])];
    
    if (allTasksToShow.length === 0) {
        html += `<div class="text-center py-10 text-gray-500 text-xs font-bold border border-dashed border-slate-700 rounded-xl bg-slate-900/50">แอดมินยังไม่ได้ตั้งค่างานพิเศษ</div>`;
    } else {
        allTasksToShow.forEach(task => {
            const assignedUser = window.currentImportantAssigns[task];
            const isLegacy = !window.globalImportantTasks.includes(task); // เช็คว่าเป็นงานที่ถูกลบไปแล้วรึเปล่า
            
            let statusHtml = '';
            let boxClass = '';
            
            if (assignedUser) {
                // 🌟 แก้ไข: ใช้การเช็ค Key ของ Object แทน .includes() เพื่อแก้บั๊ก
                const isLocked = !!(window.lockedImportantTasks && window.lockedImportantTasks[task]); 
                boxClass = isLocked ? 'border-amber-500/50 bg-amber-900/10 hover:border-amber-400' : 'border-emerald-500/30 bg-emerald-900/10 hover:border-emerald-400';
                const lockIcon = isLocked ? 'lock' : 'lock_open';
                const lockColor = isLocked ? 'text-amber-500' : 'text-gray-400 hover:text-slate-700 dark:hover:text-white';
                
                statusHtml = `
                    <div class="mt-2.5 flex items-center justify-between ${isLocked ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800/50' : 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800/50'} px-2.5 py-1.5 rounded-lg border shadow-inner transition-colors">
                        <div class="flex items-center gap-1.5 ${isLocked ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'} font-extrabold text-[12px]">
                            <span class="material-icons text-[16px]">${isLocked ? 'badge' : 'person_check'}</span> ${assignedUser}
                            ${isLocked ? '<span class="text-[9px] bg-amber-200 dark:bg-amber-800/50 text-amber-800 dark:text-amber-300 px-1 rounded ml-1">หน้าที่ประจำ</span>' : ''}
                        </div>
                        ${(isAdmin && !isLegacy) ? `
                        <div class="flex gap-1">
                            <button onclick="window.toggleLockImportantTask('${task}')" class="${lockColor} bg-white dark:bg-slate-800 rounded px-1.5 py-0.5 shadow-sm border border-gray-200 dark:border-slate-700 transition hover:bg-slate-50 dark:hover:bg-slate-700" title="ตั้ง/ยกเลิก เป็นหน้าที่ประจำ"><span class="material-icons text-[14px] block">${lockIcon}</span></button>
                            <button onclick="window.unassignImportantTask('${task}')" class="text-red-400 hover:text-red-500 bg-white dark:bg-slate-800 rounded px-1.5 py-0.5 shadow-sm border border-red-200 dark:border-red-900/50 transition hover:bg-red-50" title="ปลดคนนี้ออก"><span class="material-icons text-[14px] block">close</span></button>
                        </div>
                        ` : ''}
                    </div>
                `;
            } else {
                boxClass = 'border-red-500/50 bg-red-900/10 hover:border-red-400';
                statusHtml = `
                    <div class="mt-2.5 flex items-center justify-between bg-red-50 dark:bg-red-900/30 px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-800/50 animate-pulse shadow-inner">
                        <div class="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-extrabold text-[12px]">
                            <span class="material-icons text-[16px]">warning</span> ยังไม่มีคนดูแล
                        </div>
                        ${(isAdmin && !isLegacy) ? `<button onclick="window.assignImportantTask('${task}')" class="bg-red-600 hover:bg-red-500 text-white px-2.5 py-1 rounded text-[10px] font-bold shadow-md transition border border-red-500 active:scale-95">เลือกคน</button>` : ''}
                    </div>
                `;
            }
            
            html += `
                <div class="p-3 rounded-xl border transition shadow-sm group bg-slate-800 ${boxClass}">
                    <div class="flex justify-between items-start gap-2">
                        <div class="font-bold text-sm text-slate-200 leading-tight flex-1">
                            ${task}
                            ${isLegacy ? '<span class="text-[9px] text-gray-500 ml-1 font-normal">(งานนี้ถูกลบแล้ว)</span>' : ''}
                        </div>
                        ${(isAdmin && !isLegacy) ? `<button onclick="window.deleteImportantTask('${task}')" class="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition bg-slate-900 rounded p-1.5 shadow-inner border border-slate-700" title="ลบงานนี้ทิ้งถาวร"><span class="material-icons text-[14px] block">delete</span></button>` : ''}
                    </div>
                    ${statusHtml}
                </div>
            `;
        });
    }
    html += `</div></div>`;
    // แท็บ AM แสดงแค่ส่วนรวมห้อง ไม่มีงานพิเศษ
    panel.innerHTML = isAMDept ? mergeHtml : (html + mergeHtml);

    // แท็บ AM เพิ่มส่วนคำนวณช่วยเว็บต่อท้าย
    if (isAMDept) window.renderHelpCalcPanel();
};

window.toggleLockImportantTask = async function(taskName) {
    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    const impLockKey = `duty_important_permanent_lock_${currentDutyDept}_${shiftFilter}`;

    if (Array.isArray(window.lockedImportantTasks)) window.lockedImportantTasks = {};

    if (window.lockedImportantTasks && window.lockedImportantTasks[taskName]) {
        delete window.lockedImportantTasks[taskName];
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'ปลดจากหน้าที่ประจำแล้ว', showConfirmButton: false, timer: 1500 });
    } else {
        const assignedName = window.currentImportantAssigns[taskName];   // [FIX] เดิมชื่อ currentUser ทับตัวแปร global
        if (!assignedName) return Swal.fire('เตือน', 'กรุณาเลือกคนก่อน ถึงจะตั้งเป็นหน้าที่ประจำได้ครับ', 'warning');
        window.lockedImportantTasks[taskName] = assignedName;
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'ตั้งเป็นหน้าที่ประจำสำเร็จ!', showConfirmButton: false, timer: 1500 });
    }
    
    window.clearSettingCache(); await appDB.from('settings').upsert([{ key: impLockKey, value: JSON.stringify(window.lockedImportantTasks) }]);
    window.renderImportantTasksPanel();
};

window.randomizeImportantTasks = async function() {
    if (window.globalImportantTasks.length === 0) return Swal.fire('ไม่มีงาน', 'กรุณาเพิ่มหน้าที่สำคัญก่อนทำการสุ่มครับ', 'warning');
    
    const targetDate = document.getElementById('dutyDate').value;
    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    
    let availableStaff = window.getDutyActiveStaff(shiftFilter, { anyRole: true }).map(u => u.username);
    
    if (availableStaff.length === 0) return Swal.fire('ไม่มีพนักงาน', 'ไม่พบรายชื่อผู้สอนในกะนี้ครับ', 'error');

    const assignedStaff = Object.values(window.currentImportantAssigns);
    availableStaff = availableStaff.filter(name => !assignedStaff.includes(name));
    
    availableStaff = availableStaff.sort(() => Math.random() - 0.5);
    
    let staffIndex = 0;
    let assignedCount = 0;
    
    window.globalImportantTasks.forEach(task => {
        if (!window.currentImportantAssigns[task]) { 
            if (staffIndex < availableStaff.length) {
                window.currentImportantAssigns[task] = availableStaff[staffIndex];
                staffIndex++;
                assignedCount++;
            }
        }
    });
    
    Swal.fire({title: 'กำลังสุ่มและจัดเรียงงาน...', didOpen: () => Swal.showLoading()});
    
    const impAssignKey = `duty_important_assign_${currentDutyDept}_${targetDate}_${shiftFilter}`;
    window.clearSettingCache(); await appDB.from('settings').upsert([{ key: impAssignKey, value: JSON.stringify(window.currentImportantAssigns) }]);
    
    window.renderImportantTasksPanel();
    Swal.close();
    window.debouncedBroadcast('duty-updates', 'force_reload');
    
    if (assignedCount > 0) {
        Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 }).fire({ icon: 'success', title: `สุ่มสำเร็จ ${assignedCount} หน้าที่` });
    } else {
        Swal.fire('เตือน', 'ไม่มีหน้าที่ว่าง หรือไม่มีพนักงานเหลือให้สุ่มแล้วครับ', 'info');
    }
};

window.addImportantTask = async function() {
    const { value: taskName } = await Swal.fire({
        title: 'เพิ่มหน้าที่สำคัญ / พิเศษ',
        input: 'text',
        inputPlaceholder: 'เช่น ดูแลระบบฝากถอน, เช็คแชท VIP...',
        showCancelButton: true,
        confirmButtonText: 'บันทึก',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#f59e0b',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl' }
    });
    
    if (taskName) {
        const name = taskName.trim();
        if (window.globalImportantTasks.includes(name)) return Swal.fire('เตือน', 'มีหน้าที่นี้อยู่ในระบบแล้วครับ', 'warning');
        
        const shiftFilter = document.getElementById('dutyShiftSelect').value;
        window.globalImportantTasks.push(name);
        Swal.fire({title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading()});
        
        const impListKey = `duty_important_tasks_list_${currentDutyDept}_${shiftFilter}`;
        window.clearSettingCache(); await appDB.from('settings').upsert([{ key: impListKey, value: JSON.stringify(window.globalImportantTasks) }]);
        
        window.renderImportantTasksPanel();
        Swal.close();
    }
};

window.deleteImportantTask = async function(taskName) {
    const res = await Swal.fire({
        title: 'ลบหน้าที่นี้?',
        text: `ต้องการลบ "${taskName}" ออกจากรายการงานพิเศษใช่หรือไม่? (ลบทิ้งถาวร)`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'ลบทิ้งเลย',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl' }
    });
    
    if (res.isConfirmed) {
        window.globalImportantTasks = window.globalImportantTasks.filter(t => t !== taskName);
        delete window.currentImportantAssigns[taskName]; 
        if (window.lockedImportantTasks) delete window.lockedImportantTasks[taskName]; 
        
        Swal.fire({title: 'กำลังลบ...', didOpen: () => Swal.showLoading()});
        const targetDate = document.getElementById('dutyDate').value;
        const shiftFilter = document.getElementById('dutyShiftSelect').value;
        
        const listKey = `duty_important_tasks_list_${currentDutyDept}_${shiftFilter}`;
        const assignKey = `duty_important_assign_${currentDutyDept}_${targetDate}_${shiftFilter}`;
        const lockKey = `duty_important_permanent_lock_${currentDutyDept}_${shiftFilter}`;
        
        window.clearSettingCache(); await appDB.from('settings').upsert([
            { key: listKey, value: JSON.stringify(window.globalImportantTasks) },
            { key: assignKey, value: JSON.stringify(window.currentImportantAssigns) },
            { key: lockKey, value: JSON.stringify(window.lockedImportantTasks) }
        ]);
        window.renderImportantTasksPanel();
        Swal.close();
    }
};

window.assignImportantTask = async function(taskName) {
    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    const activeStaff = window.getDutyActiveStaff(shiftFilter, { anyRole: true });
    
    if (activeStaff.length === 0) return Swal.fire('ไม่มีรายชื่อ', 'ไม่มีผู้สอนที่พร้อมทำงานในกะนี้เลยครับ', 'error');
    
    let options = {};
    activeStaff.sort((a,b) => a.username.localeCompare(b.username)).forEach(u => options[u.username] = u.username);
    
    const { value: selectedUser } = await Swal.fire({
        title: `<div class="text-sm text-gray-400 mb-1">มอบหมายงาน:</div><div class="text-amber-500 font-black">${taskName}</div>`,
        input: 'select',
        inputOptions: options,
        inputPlaceholder: '-- เลือกผู้รับผิดชอบงานนี้ --',
        showCancelButton: true,
        confirmButtonText: 'มอบหมาย',
        confirmButtonColor: '#10b981',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl' }
    });
    
    if (selectedUser) {
        const prevAssignee = window.currentImportantAssigns[taskName] || null;
        window.currentImportantAssigns[taskName] = selectedUser;
        Swal.fire({title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading()});

        const targetDate = document.getElementById('dutyDate').value;
        const impAssignKey = `duty_important_assign_${currentDutyDept}_${targetDate}_${shiftFilter}`;

        window.clearSettingCache(); await appDB.from('settings').upsert([{ key: impAssignKey, value: JSON.stringify(window.currentImportantAssigns) }]);

        // 🟢 บันทึก log การมอบหมายงานสำคัญ
        const logDetail = prevAssignee && prevAssignee !== selectedUser
            ? `เปลี่ยนผู้รับผิดชอบงาน "${taskName}": ${prevAssignee} → ${selectedUser}`
            : `มอบหมายงาน "${taskName}" ให้ ${selectedUser}`;
        await appDB.from('system_logs').insert([{
            action_type: 'ย้ายหน้าที่',
            performed_by: currentUser.username,
            target_details: `${logDetail} (กะ: ${shiftFilter}, วันที่: ${targetDate})`
        }]);

        window.renderImportantTasksPanel();
        Swal.close();
        window.debouncedBroadcast('duty-updates', 'force_reload');
    }
};

window.unassignImportantTask = async function(taskName) {
    const prevAssignee = window.currentImportantAssigns[taskName] || null;
    delete window.currentImportantAssigns[taskName];

    const targetDate = document.getElementById('dutyDate').value;
    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    const impAssignKey = `duty_important_assign_${currentDutyDept}_${targetDate}_${shiftFilter}`;
    const impLockKey = `duty_important_permanent_lock_${currentDutyDept}_${shiftFilter}`;

    let keysToUpdate = [ { key: impAssignKey, value: JSON.stringify(window.currentImportantAssigns) } ];

    if (window.lockedImportantTasks && window.lockedImportantTasks[taskName]) {
        delete window.lockedImportantTasks[taskName];
        keysToUpdate.push({ key: impLockKey, value: JSON.stringify(window.lockedImportantTasks) });
    }

    Swal.fire({title: 'กำลังปลดคน...', didOpen: () => Swal.showLoading()});
    window.clearSettingCache(); await appDB.from('settings').upsert(keysToUpdate);

    // 🟢 บันทึก log การปลดคนออกจากงานสำคัญ
    if (prevAssignee) {
        await appDB.from('system_logs').insert([{
            action_type: 'ย้ายหน้าที่',
            performed_by: currentUser.username,
            target_details: `ปลด ${prevAssignee} ออกจากงาน "${taskName}" (กะ: ${shiftFilter}, วันที่: ${targetDate})`
        }]);
    }

    window.renderImportantTasksPanel();
    Swal.close();
    window.debouncedBroadcast('duty-updates', 'force_reload');
};

// ==========================================
// 🌟 ฟังก์ชันล้างเฉพาะงานรอง (ไม่แตะงานหลัก)
// ใช้กับปุ่ม "ล้างงานรอง" บนแถบเครื่องมือ
// ==========================================
window.clearSecondaryDuties = async function() {
    if (!window.isDutyAdmin()) return Swal.fire('ไม่มีสิทธิ์', 'เฉพาะผู้จัดเวรเท่านั้นที่ล้างงานรองได้ครับ', 'error');   // 🔒 [FIX] เดิมไม่เช็ค
    if (window.blockIfPreview()) return;   // โหมดตัวอย่าง: ห้ามเขียนตารางลง DB
    const targetDate = document.getElementById('dutyDate').value;
    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    if (!targetDate) return Swal.fire('!', 'กรุณาเลือกวันที่ก่อน', 'warning');

    const saveKey = getDutySaveKey(targetDate, shiftFilter);

    let currentDataVal = null;
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', saveKey);
        if (data && data.length > 0) currentDataVal = data[0].value;
    } catch(e) {}

    if (!currentDataVal) {
        return Swal.fire('ไม่มีตาราง', 'ยังไม่มีตารางงานในวัน/กะนี้ ไม่มีอะไรให้ล้างครับ', 'info');
    }

    let roster;
    try {
        roster = JSON.parse(currentDataVal);
    } catch(e) {
        return Swal.fire('Error', 'อ่านข้อมูลตารางไม่สำเร็จ', 'error');
    }

    // นับจำนวนคนที่มีงานรองอยู่ตอนนี้
    let countHasSecondary = 0;
    for (const team in roster) {
        (roster[team] || []).forEach(u => {
            if (u && u.secondary_team && !u.username.includes('ขาดคน')) countHasSecondary++;
        });
    }

    if (countHasSecondary === 0) {
        return Swal.fire('ไม่มีงานรอง', 'ยังไม่มีใครได้รับงานรองในวัน/กะนี้ครับ', 'info');
    }

    const confirmRes = await Swal.fire({
        title: 'ยืนยันล้างเฉพาะงานรอง?',
        html: `จะปลดงานรอง (สแตนด์บาย) ของพนักงาน <b class="text-cyan-600">${countHasSecondary} คน</b><br>วันที่ <b>${targetDate}</b> (${shiftFilter})<br><span class="text-[12px] text-gray-500 italic">⚠️ งานหลักจะไม่กระทบ</span>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#0ea5e9',
        cancelButtonColor: '#64748b',
        cancelButtonText: 'ยกเลิก',
        confirmButtonText: 'ล้างงานรองเลย',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white' }
    });

    if (!confirmRes.isConfirmed) return;

    Swal.fire({title: 'กำลังล้างงานรอง...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});

    try {
        // ล้าง secondary_team ของทุกคน (ไม่ยุ่งกับ field อื่น)
        let cleared = 0;
        for (const team in roster) {
            (roster[team] || []).forEach(u => {
                if (u && u.secondary_team) {
                    u.secondary_team = null;
                    cleared++;
                }
            });
        }

        // บันทึกกลับ DB
        window.clearSettingCache(); await appDB.from('settings').upsert([{ key: saveKey, value: JSON.stringify(roster) }]);

        // เขียน log
        try {
            await appDB.from('system_logs').insert([{
                action_type: 'ล้างงานรอง',
                performed_by: currentUser.username,
                target_details: `ล้างงานรอง (${currentDutyDept}, ${shiftFilter}, ${targetDate}) → ปลดสแตนด์บาย ${cleared} คน`
            }]);
        } catch(e) {}

        // แจ้ง client อื่นให้รีโหลด
        try {
            if (appDB.channel) window.debouncedBroadcast('duty-updates', 'force_reload');
        } catch(e) {}

        // วาดใหม่
        if (typeof window.renderRosterGrid === 'function') {
            window.renderRosterGrid(roster);
        } else if (typeof window.refreshDutyData === 'function') {
            window.refreshDutyData();
        }

        Swal.fire({
            icon: 'success',
            title: 'ล้างงานรองเรียบร้อย',
            text: `ปลดงานรองออกแล้ว ${cleared} คน`,
            timer: 1500,
            showConfirmButton: false
        });
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
};

// ==========================================
// 🌟 ระบบแจกงานรองด่วน (AI จับคู่ 1 ต่อ 1) — V2: 2-Pass System
// Pass 1: เข้มงวด (เวลาพักไม่ชน)
// Pass 2: ผ่อนเงื่อนไขเวลาพัก (เก็บตกคนที่ตกหล่น)
// ==========================================
window.quickAssignBackups = async function() {
    if (!window.isDutyAdmin()) return Swal.fire('ไม่มีสิทธิ์', 'เฉพาะผู้จัดเวรเท่านั้นที่แจกงานรองได้ครับ', 'error');   // 🔒 [FIX] เดิมไม่เช็ค
    if (window.blockIfPreview()) return;   // โหมดตัวอย่าง: ห้ามเขียนตารางลง DB
    const targetDate = document.getElementById('dutyDate').value;
    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    if (!targetDate) return Swal.fire('เตือน', 'กรุณาเลือกวันที่ก่อน', 'warning');

    const saveKey = getDutySaveKey(targetDate, shiftFilter);
    let currentDataVal = null;
    
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', saveKey);
        if (data && data.length > 0) currentDataVal = data[0].value;
    } catch(e) {}

    if (!currentDataVal) return Swal.fire('เตือน', 'คุณต้องกด "สุ่มจัดหน้าที่" (สำหรับตำแหน่งหลัก) ให้เสร็จก่อนครับ', 'warning');

    let roster = JSON.parse(currentDataVal);

    // 🕘 โหลดประวัติย้อนหลัง เพื่อกัน "งานรองซ้ำเว็บเดิมกับเมื่อวาน" (ทั้งที่เคยเป็นหลักและรอง)
    let bkRotation = null;
    try {
        if (typeof window.loadDutyRotationHistory === 'function') {
            bkRotation = await window.loadDutyRotationHistory(targetDate, shiftFilter);
        }
    } catch (e) { console.warn('[backup] โหลดประวัติไม่สำเร็จ ข้ามกฎกันซ้ำ', e); }

    // เมื่อวานคนนี้แตะเว็บนี้ไหม (หลักหรือรองก็นับ) — true = ห้ามให้ซ้ำ
    const touchedYesterday = (uid, team) =>
        !!(bkRotation && typeof window.dutyTouchedTeamYesterday === 'function'
            && window.dutyTouchedTeamYesterday(bkRotation, uid, team));

    // เว็บนี้ห่างจากครั้งล่าสุดที่แตะ (หลัก/รอง) กี่วัน — ยิ่งมากยิ่งควรได้
    const daysAwayFromTeam = (uid, team) => {
        if (!bkRotation) return Infinity;
        const p = window.dutyDaysAgoOnTeam ? window.dutyDaysAgoOnTeam(bkRotation, uid, team) : Infinity;
        const s = window.dutyDaysAgoOnSecTeam ? window.dutyDaysAgoOnSecTeam(bkRotation, uid, team) : Infinity;
        return Math.min(p, s);
    };

    Swal.fire({
        title: 'กำลังจับคู่งานรอง...', 
        html: '<span class="text-sm text-gray-500">🌱 Phase 1: เติมเว็บที่ยังไม่มีรองให้ครบก่อน...</span>', 
        allowOutsideClick: false, 
        didOpen: () => Swal.showLoading()
    });

    // 1. ดึงข้อมูลเวลาพักของทุกคนจากตารางเวลา
    let breakTimes = {};
    if (window.currentDutySchedules) {
        window.currentDutySchedules.forEach(s => {
            if (!breakTimes[s.staff_name]) breakTimes[s.staff_name] = [];
            breakTimes[s.staff_name].push(s.time_slot);
        });
    }

    // 2. หาคนที่มี "งานหลัก" แล้ว และยังไม่มี "งานรอง" มาเป็นตัวเลือก
    let availableForBackup = [];
    for (const team in roster) {
        roster[team].forEach(u => {
            if (!u.username.includes('ขาดคน') && !u.secondary_team) {
                availableForBackup.push({ ...u, primaryTeam: team });
            }
        });
    }

    // 🌟 V5 — 2 Phase System (เน้นกระจายให้ครบทุกเว็บก่อน)
    //
    // Phase 1: บังคับให้ทุกเว็บได้รองอย่างน้อย 1 คน (เดิน "ทีม" ไปหา "คน")
    //   - 1a: เช็คเวลาพัก + เช็คสิทธิ์
    //   - 1b: ผ่อนเวลาพัก + เช็คสิทธิ์
    // Phase 2: คนที่เหลือกระจายเข้าเว็บรองน้อยสุด (เดิน "คน" ไปหา "ทีม")
    //   - 2a: เช็คเวลาพัก + เช็คสิทธิ์
    //   - 2b: ผ่อนเวลาพัก + เช็คสิทธิ์

    // 🍽️ [กติกาพัก] ถ้าเอา c มาเป็นรองของ team แล้ว ช่วงพักไหนของ team จะเกินเพดานไหม
    // สมาชิกของ team = หลัก + รองที่จัดไปแล้ว + c → เพดาน = breakCapByRule(จำนวนนั้น)
    // เช็คทุกช่วงพักของ c: จำนวนสมาชิกอื่นที่พักช่วงเดียวกัน ต้อง < เพดาน
    const wouldBreakCap = (c, team) => {
        const members = [];
        (roster[team] || []).forEach(u => { if (u && u.id && !String(u.username || '').includes('ขาดคน')) members.push(u.username); });
        for (const t in roster) (roster[t] || []).forEach(u => { if (u && u.secondary_team === team && !members.includes(u.username)) members.push(u.username); });
        if (!members.includes(c.username)) members.push(c.username);
        const cap = window.breakCapByRule(members.length);
        const cBreaks = breakTimes[c.username] || [];
        for (const slot of cBreaks) {
            let others = 0;
            members.forEach(n => { if (n !== c.username && (breakTimes[n] || []).includes(slot)) others++; });
            if (others >= cap) return { slot, others, cap };
        }
        return null;
    };

    // ฟังก์ชันช่วย: ดูว่าทีมนี้มีรองกี่คนแล้ว
    const countBackupsForTeam = (team) => {
        let n = 0;
        for (const t in roster) {
            roster[t].forEach(u => { if (u.secondary_team === team) n++; });
        }
        return n;
    };

    // 🟢 Phase 1: ให้ทุกเว็บได้รองอย่างน้อย 1 คน
    // (เหลือโหมดเดียว: เคารพเพดานพักเสมอ)
    const noBackupReasons = {};   // เว็บที่หารองไม่ได้เพราะพักชน
    const phase1FillEmptyTeams = (mode) => {
        let count = 0;

        // หาเฉพาะเว็บที่ "มี primary แต่ยังไม่มีรองเลย"
        const emptyTeams = sortedTeams.filter(t => {
            const primaries = (roster[t] || []).filter(u => !u.username.includes('ขาดคน'));
            if (primaries.length === 0) return false;
            return countBackupsForTeam(t) === 0;
        });

        // สลับลำดับเพื่อกระจายงาน
        emptyTeams.sort(() => Math.random() - 0.5);

        emptyTeams.forEach(targetTeam => {
            const primaries = (roster[targetTeam] || []).filter(u => !u.username.includes('ขาดคน'));

            // คนที่ใส่ได้ — ต้องเข้าเว็บนี้ได้ + ยังไม่มีงานรอง
            let candidates = availableForBackup.filter(c => {
                if (c.secondary_team) return false;
                if (c.primaryTeam === targetTeam) return false;

                const access = dutyAccessMatrix[c.id] || [];
                if (!access.includes(targetTeam)) return false;

                // 🍽️ ต้องไม่ทำให้ช่วงพักไหนของเว็บนี้เกินเพดาน (ไม่มีโหมดผ่อนปรนแล้ว)
                if (wouldBreakCap(c, targetTeam)) return false;

                return true;
            });

            if (candidates.length === 0) { noBackupReasons[targetTeam] = 'ไม่มีใครที่พักไม่ชน'; return; }

            // 🕘 ตัดคนที่ "เมื่อวานแตะเว็บนี้" (เป็นหลักหรือรองก็ตาม) ออกก่อน
            //     ถ้าตัดแล้วไม่เหลือใครเลย ค่อยยอมใช้คนเดิม (เว็บว่างแย่กว่าซ้ำ)
            const freshCands = candidates.filter(c => !touchedYesterday(c.id, targetTeam));
            if (freshCands.length > 0) candidates = freshCands;

            // เลือกคนแบบ "ใครเข้าได้น้อยสุด ใส่ก่อน" (กันคนที่เลือกได้แต่เว็บนี้ไม่หลุด)
            candidates.sort((a, b) => {
                const accessA = (dutyAccessMatrix[a.id] || []).length;
                const accessB = (dutyAccessMatrix[b.id] || []).length;
                if (accessA !== accessB) return accessA - accessB;
                // ห่างจากเว็บนี้นานกว่า = ควรได้ก่อน
                const awayA = daysAwayFromTeam(a.id, targetTeam);
                const awayB = daysAwayFromTeam(b.id, targetTeam);
                if (awayA !== awayB) return awayB - awayA;
                return Math.random() - 0.5;
            });

            const chosen = candidates[0];
            const userInRoster = roster[chosen.primaryTeam].find(u => u.id === chosen.id);
            if (userInRoster && !userInRoster.secondary_team) {
                userInRoster.secondary_team = targetTeam;
                const availIndex = availableForBackup.findIndex(a => a.id === chosen.id);
                if (availIndex > -1) availableForBackup[availIndex].secondary_team = targetTeam;
                count++;
            }
        });

        return count;
    };

    // 🟡 Phase 2: คนที่เหลือกระจายเข้าเว็บรองน้อยสุด
    // (เหลือโหมดเดียว: เคารพเพดานพักเสมอ)
    const phase2DistributeRest = (mode) => {
        let count = 0;

        const peopleToAssign = availableForBackup
            .filter(c => !c.secondary_team)
            .sort(() => Math.random() - 0.5);

        peopleToAssign.forEach(c => {
            const cBreaks = breakTimes[c.username] || [];
            const access = dutyAccessMatrix[c.id] || [];

            let validTeams = sortedTeams.filter(t => {
                if (t === c.primaryTeam) return false;
                if (!access.includes(t)) return false;

                const primaries = (roster[t] || []).filter(u => !u.username.includes('ขาดคน'));
                if (primaries.length === 0) return false;

                if (wouldBreakCap(c, t)) return false;   // 🍽️ ไม่ทำให้เว็บนั้นพักเกินเพดาน
                return true;
            });

            if (validTeams.length === 0) return;

            // 🕘 ตัดเว็บที่ "เมื่อวานเขาแตะไปแล้ว" (เป็นหลักหรือรอง) ออกก่อน
            //     ถ้าตัดหมดไม่เหลือ ค่อยยอมใช้ของเดิม (มีรองดีกว่าไม่มี)
            const freshTeams = validTeams.filter(t => !touchedYesterday(c.id, t));
            if (freshTeams.length > 0) validTeams = freshTeams;

            // เลือกเว็บที่มีรองน้อยที่สุด (load balance) + ห่างจากเว็บนั้นนานสุด
            validTeams.sort((a, b) => {
                const cA = countBackupsForTeam(a);
                const cB = countBackupsForTeam(b);
                if (cA !== cB) return cA - cB;
                const awayA = daysAwayFromTeam(c.id, a);
                const awayB = daysAwayFromTeam(c.id, b);
                if (awayA !== awayB) return awayB - awayA;
                return Math.random() - 0.5;
            });

            const chosenTeam = validTeams[0];
            const userInRoster = roster[c.primaryTeam].find(u => u.id === c.id);
            if (userInRoster && !userInRoster.secondary_team) {
                userInRoster.secondary_team = chosenTeam;
                const availIndex = availableForBackup.findIndex(a => a.id === c.id);
                if (availIndex > -1) availableForBackup[availIndex].secondary_team = chosenTeam;
                count++;
            }
        });

        return count;
    };

    // 🟢 Phase 1: บังคับเว็บว่างให้ได้รอง — เฉพาะคนที่พักไม่ชนจนเกินเพดาน
    const pass1Count = phase1FillEmptyTeams('strict');

    // 🟢 Phase 2: คนที่เหลือกระจายเข้าเว็บรองน้อยสุด — กติกาเดียวกัน
    Swal.update({ html: '<span class="text-sm text-gray-500">📊 Phase 2: กระจายคนที่เหลือเข้าเว็บรองน้อยสุด...</span>' });
    await new Promise(r => setTimeout(r, 200));
    const pass2Count = phase2DistributeRest('strict');
    // (ตัดโหมด "ผ่อนเวลาพัก" ออก — เดิมมันยัดคนที่พักชนลงไปเงียบๆ ทำให้เว็บพักพร้อมกันเกินเพดาน)

    // นับคนที่ยังไม่มีงานรองเลย (ทั้งที่ลองทุกเว็บแล้ว)
    let totalUnassignedSlots = 0;
    for (const team in roster) {
        roster[team].forEach(u => {
            if (!u.username.includes('ขาดคน') && !u.secondary_team) totalUnassignedSlots++;
        });
    }

    // 3. บันทึกและวาดตารางใหม่
    // 🌟 NEW: สุ่มหัวข้องานรอง (จาก config ที่ตั้งใน "งานรอง") ให้แต่ละคนตามเว็บที่ไปสแตนบาย
    // (ตัดการสุ่ม "หัวข้องานรอง" ออก — แท็บงานรองถูกลบแล้ว และค่าที่สุ่มไม่เคยถูกแสดงที่ไหน → ลด 1 query)
    
    window.clearSettingCache(); await appDB.from('settings').upsert([{ key: saveKey, value: JSON.stringify(roster) }]);
    window.renderRosterGrid(roster);

    try {
        if (appDB.channel) window.debouncedBroadcast('duty-updates', 'force_reload');
    } catch(e) {}

    // เขียน log
    try {
        await appDB.from('system_logs').insert([{
            action_type: 'แจกงานรอง',
            performed_by: currentUser.username,
            target_details: `แจกงานรอง (${currentDutyDept}, ${shiftFilter}, ${targetDate}) → กระจายให้ครบ: ${pass1Count} คน, เก็บตก: ${pass2Count} คน, ไม่ได้: ${totalUnassignedSlots} คน`
        }]);
    } catch(e) {}

    // 4. แสดงผลลัพธ์แบบละเอียด
    const totalSuccess = pass1Count + pass2Count;

    // นับเว็บที่ยังไม่มีรองเลย
    let emptyTeamCount = 0;
    sortedTeams.forEach(t => {
        const primaries = (roster[t] || []).filter(u => !u.username.includes('ขาดคน'));
        if (primaries.length > 0 && countBackupsForTeam(t) === 0) emptyTeamCount++;
    });

    let resultHtml = `
        <div class="text-left text-sm space-y-2 mt-2">
            <div class="flex justify-between items-center bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-2.5 rounded-lg shadow-sm">
                <span class="font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                    <span class="material-icons text-[16px]">spa</span> Phase 1 — กระจายให้ครบทุกเว็บ:
                </span>
                <span class="font-black text-emerald-600 dark:text-emerald-400 text-base">${pass1Count} คน</span>
            </div>
            <div class="flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-2.5 rounded-lg shadow-sm">
                <span class="font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                    <span class="material-icons text-[16px]">balance</span> Phase 2 — เก็บตก/Load balance:
                </span>
                <span class="font-black text-blue-600 dark:text-blue-400 text-base">${pass2Count} คน</span>
            </div>`;

    const noBackupList = sortedTeams.filter(t => {
        const primaries = (roster[t] || []).filter(u => !u.username.includes('ขาดคน'));
        return primaries.length > 0 && countBackupsForTeam(t) === 0;
    });
    if (noBackupList.length > 0) {
        resultHtml += `
            <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-2.5 rounded-lg shadow-sm text-left">
                <div class="font-bold text-red-700 dark:text-red-300 flex items-center gap-1.5 text-xs"><span class="material-icons text-[16px]">report</span> เว็บที่หารองไม่ได้ (ทุกคนที่เข้าได้ พักชนกับคนในเว็บจนเกินเพดาน):</div>
                <div class="mt-1 text-[11px] text-red-600 dark:text-red-400 font-bold">${noBackupList.join(', ')}</div>
                <div class="mt-1 text-[10px] text-gray-500">→ ปรับเวลาพักของคนในเว็บ หรือลากคนมาเป็นรองเอง (การ์ดจะเตือนถ้าพักชน)</div>
            </div>`;
    }
    if (emptyTeamCount > 0 && noBackupList.length === 0) {
        resultHtml += `
            <div class="flex justify-between items-center bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-2.5 rounded-lg shadow-sm">
                <span class="font-bold text-red-700 dark:text-red-300 flex items-center gap-1.5">
                    <span class="material-icons text-[16px]">warning</span> เว็บที่ยังว่าง:
                </span>
                <span class="font-black text-red-600 dark:text-red-400 text-base">${emptyTeamCount} เว็บ</span>
            </div>`;
    }

    if (totalUnassignedSlots > 0) {
        resultHtml += `
            <div class="flex justify-between items-center bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-2.5 rounded-lg shadow-sm">
                <span class="font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                    <span class="material-icons text-[16px]">person_off</span> คนที่ไม่มีงานรอง:
                </span>
                <span class="font-black text-amber-600 dark:text-amber-400 text-base">${totalUnassignedSlots} คน</span>
            </div>
            <div class="text-[11px] text-gray-500 dark:text-gray-400 italic px-2 pt-1 border-t border-gray-200 dark:border-slate-700 mt-2">
                💡 <b>คนที่ไม่มีรอง</b> = ไม่มีสิทธิ์เว็บอื่น หรือเวลาพักชนกับทุกเว็บที่เข้าได้
            </div>`;
    }

    resultHtml += `</div>`;
    
    Swal.fire({
        icon: emptyTeamCount === 0 && totalUnassignedSlots === 0 ? 'success' : 'info',
        title: emptyTeamCount === 0 && totalUnassignedSlots === 0
            ? `<div class="text-emerald-500 font-black">🎉 กระจายครบทุกเว็บ + ทุกคนได้งานรอง!</div>`
            : emptyTeamCount === 0
                ? `<div class="text-emerald-500 font-black">✅ ทุกเว็บมีรองครบแล้ว</div>`
                : `<div class="text-amber-500 font-black">แจกได้ ${totalSuccess} คน</div>`,
        html: resultHtml,
        confirmButtonText: 'ตกลง',
        confirmButtonColor: totalUnassignedSlots === 0 ? '#10b981' : '#f59e0b',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl border border-slate-700 shadow-2xl' }
    });
};

// ==========================================
// 🌟 เสกปุ่ม "⚡ จัดรองด่วน (AI)" + "🧹 ล้างงานรอง"
// ⚡ [PERF] เดิมเป็น setInterval ทุก 2 วิ วิ่งตลอดเวลาแม้ไม่ได้อยู่หน้านี้ → เปลี่ยนเป็นเรียกครั้งเดียวตอน initDutyApp
// ==========================================
window.ensureDutyExtraButtons = function() {
    const dutyApp = document.getElementById('dutyApp');
    if (!dutyApp) return;

    // ─── ปุ่ม "จัดรองด่วน (AI)" — วางต่อจากปุ่มล้างตาราง ───
    if (!document.getElementById('btnQuickBackup')) {
        const clearBtn = document.querySelector('button[onclick*="clearDutyRoster"]');
        if (clearBtn) {
            const btn = document.createElement('button');
            btn.id = 'btnQuickBackup';
            btn.className = 'duty-admin-only bg-fuchsia-600 hover:bg-fuchsia-500 text-white px-3 py-1.5 rounded-md text-xs font-bold shadow-md transition flex items-center gap-1 active:scale-95 ml-3 border border-fuchsia-400';
            btn.innerHTML = '<span class="material-icons text-[14px]">bolt</span> จัดรองด่วน (AI)';
            btn.onclick = window.quickAssignBackups;
            clearBtn.parentNode.insertBefore(btn, clearBtn.nextSibling);
            if (typeof window.applyDutyRoleUI === 'function') window.applyDutyRoleUI();   // ซ่อนทันทีถ้าไม่ใช่แอดมิน
        }
    }

    // ─── ปุ่ม "ล้างงานรอง" — วางต่อจากปุ่มเพิ่มพนักงาน ───
    if (!document.getElementById('btnClearSecondary')) {
        const addStaffBtn = document.querySelector('button[onclick*="addStaffToRoster"]');
        if (addStaffBtn) {
            const btn = document.createElement('button');
            btn.id = 'btnClearSecondary';
            btn.className = 'duty-admin-only bg-cyan-600 hover:bg-cyan-500 text-white text-sm px-4 py-1.5 rounded-lg shadow-md font-bold transition flex items-center gap-1 transform active:scale-95 border border-cyan-400';
            btn.innerHTML = '<span class="material-icons text-base">layers_clear</span> ล้างงานรอง';
            btn.title = 'ล้างเฉพาะงานรอง (สแตนด์บาย) — งานหลักไม่กระทบ';
            btn.onclick = window.clearSecondaryDuties;
            addStaffBtn.parentNode.insertBefore(btn, addStaffBtn.nextSibling);
            if (typeof window.applyDutyRoleUI === 'function') window.applyDutyRoleUI();
        }
    }
};

// ==========================================