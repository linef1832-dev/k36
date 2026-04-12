let currentCalendarDate = new Date();
let currentViewDept = 'AM'; 
window.activeLeaveType = 'X'; 
let deptSettings = {
    AM: { limit: 4, startM: '', endM: '', startA: '', endA: '', startN: '', endN: '', isOpen: false, quotaM: 0, quotaA: 0, quotaN: 0, viewMonth: '', startDay: '', endDay: '' },
    OD: { limit: 4, startM: '', endM: '', startA: '', endA: '', startN: '', endN: '', isOpen: false, quotaM: 0, quotaA: 0, quotaN: 0, viewMonth: '', startDay: '', endDay: '' },
    NEW: { limit: 4, startM: '', endM: '', startA: '', endA: '', startN: '', endN: '', isOpen: false, quotaM: 0, quotaA: 0, quotaN: 0, viewMonth: '', startDay: '', endDay: '' },
    TRAINER: { limit: 4, startM: '', endM: '', startA: '', endA: '', startN: '', endN: '', isOpen: false, quotaM: 0, quotaA: 0, quotaN: 0, viewMonth: '', startDay: '', endDay: '' }
};
let allLeaveData = [];  
let leaveSubscription = null; 
let settingsSubscription = null;
let isEditingLeave = false;
let editLeaveTimer;

window.setLeaveType = function(type) {
    window.activeLeaveType = type;
    document.querySelectorAll('.leave-type-btn').forEach(btn => {
        btn.classList.remove('ring-2', 'ring-offset-1', 'scale-105', 'opacity-100', 'ring-red-500', 'ring-yellow-400', 'ring-pink-500', 'ring-green-500', 'ring-blue-500', 'ring-amber-800', 'ring-yellow-700');
        btn.classList.add('opacity-50');
    });
    const activeBtn = document.getElementById('ltBtn_' + type);
    if(activeBtn) {
        activeBtn.classList.remove('opacity-50');
        activeBtn.classList.add('ring-2', 'ring-offset-1', 'scale-105', 'opacity-100');
        if(type === 'X') activeBtn.classList.add('ring-red-500');
        if(type === 'XX') activeBtn.classList.add('ring-yellow-400');
        if(type === 'X4') activeBtn.classList.add('ring-pink-500');
        if(type === 'KL') activeBtn.classList.add('ring-green-500');
        if(type === 'TX') activeBtn.classList.add('ring-blue-500');
        if(type === 'PN') activeBtn.classList.add('ring-amber-800');
        if(type === 'KP') activeBtn.classList.add('ring-yellow-700');
    }
};

window.switchDept = function(dept) {
    currentViewDept = dept;
    ['AM', 'OD', 'NEW', 'TRAINER'].forEach(d => {
        const btn = document.getElementById(`btn${d}`);
        if(!btn) return;
        if(d === dept) {
            btn.classList.add('active');
            btn.classList.remove('text-rose-600', 'text-fuchsia-600', 'text-cyan-500', 'text-indigo-500');
            if(d === 'AM') btn.classList.add('text-rose-600');
            if(d === 'OD') btn.classList.add('text-fuchsia-600');
            if(d === 'NEW') btn.classList.add('text-cyan-500');
            if(d === 'TRAINER') btn.classList.add('text-indigo-500');
        } else {
            btn.classList.remove('active', 'text-rose-600', 'text-fuchsia-600', 'text-cyan-500', 'text-indigo-500');
        }
    });

    const label = document.getElementById('currentDeptLabel');
    const targetLabel = document.getElementById('settingTargetLabel');
    const saveLabel = document.getElementById('saveBtnLabel');
    
    let displayDeptName = dept;
    if (dept === 'NEW') displayDeptName = 'พนักงานใหม่';
    if (dept === 'TRAINER') displayDeptName = 'ผู้สอน';

    if(label) label.innerText = displayDeptName;
    if(targetLabel) targetLabel.innerText = displayDeptName;
    if(saveLabel) saveLabel.innerText = displayDeptName;

    let colorClass = 'bg-rose-600'; 
    if(dept === 'OD') colorClass = 'bg-fuchsia-600';
    if(dept === 'NEW') colorClass = 'bg-cyan-600';
    if(dept === 'TRAINER') colorClass = 'bg-indigo-600';
    if(label) label.className = `text-[10px] ${colorClass} px-2 rounded shadow transition-colors duration-300`;

    const btnManage = document.getElementById('btnManageNewStaff');
    if(btnManage) {
        if(dept === 'NEW') btnManage.classList.remove('hidden');
        else btnManage.classList.add('hidden');   
    }

    updateAdminInputs();
    
    if(typeof updateMonthPicker === 'function') updateMonthPicker();
    
    const tbody = document.getElementById('tableBody');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="33" class="text-center py-20 text-gray-400"><span class="material-icons animate-spin text-5xl ${colorClass.replace('bg-', 'text-')} mb-2">sync</span><br><span class="font-bold">กำลังโหลดตารางเดือนนี้...</span></td></tr>`;
    }
    
    setTimeout(() => { renderLeaveTable(); checkBookingWindow(); }, 50);
};

function updateAdminInputs() {
    const s = deptSettings[currentViewDept];
    if(!s) return; 
    
    if(document.getElementById('setPersonLimit')) document.getElementById('setPersonLimit').value = s.limit || 4;
    if(document.getElementById('setStartM')) document.getElementById('setStartM').value = s.startM || '';
    if(document.getElementById('setEndM')) document.getElementById('setEndM').value = s.endM || '';
    if(document.getElementById('setStartA')) document.getElementById('setStartA').value = s.startA || '';
    if(document.getElementById('setEndA')) document.getElementById('setEndA').value = s.endA || '';
    if(document.getElementById('setStartN')) document.getElementById('setStartN').value = s.startN || '';
    if(document.getElementById('setEndN')) document.getElementById('setEndN').value = s.endN || '';

    if(document.getElementById('setForceOpen')) document.getElementById('setForceOpen').checked = s.isOpen || false;
    
    if(document.getElementById('setQuotaM')) document.getElementById('setQuotaM').value = s.quotaM || 0;
    if(document.getElementById('setQuotaA')) document.getElementById('setQuotaA').value = s.quotaA || 0;
    if(document.getElementById('setQuotaN')) document.getElementById('setQuotaN').value = s.quotaN || 0;

    if(document.getElementById('setAllowedMonth')) document.getElementById('setAllowedMonth').value = s.viewMonth || '';
    if(document.getElementById('setStartDay')) document.getElementById('setStartDay').value = s.startDay || '';
    if(document.getElementById('setEndDay')) document.getElementById('setEndDay').value = s.endDay || '';
    
    const timeGroup = document.getElementById('timeSettingsGroup');
    if(timeGroup) {
        timeGroup.classList.remove('opacity-30', 'pointer-events-none');
    }
}

const forceOpenCb = document.getElementById('setForceOpen');
if(forceOpenCb) forceOpenCb.addEventListener('change', (e) => { toggleTimeInputs(e.target.checked); });

window.initLeaveTable = async function() {
    if(typeof updateMonthPicker === 'function') updateMonthPicker();
    await loadLeaveSettings();
    
    if (currentUser.role === 'manager' || currentUser.role === 'admin') {
        const controls = document.getElementById('leaveManagerControls');
        if(controls) controls.classList.remove('hidden');
        const btnExport = document.getElementById('btnExportExcel');
        if(btnExport) btnExport.classList.remove('hidden');
        const typeToolbar = document.getElementById('leaveTypeToolbar');
        if(typeToolbar) typeToolbar.classList.remove('hidden');
    } else {
        const controls = document.getElementById('leaveManagerControls');
        if(controls) controls.classList.add('hidden');
        const btnExport = document.getElementById('btnExportExcel');
        if(btnExport) btnExport.classList.add('hidden');
        const typeToolbar = document.getElementById('leaveTypeToolbar');
        if(typeToolbar) typeToolbar.classList.add('hidden');
    }

    if (GLOBAL_USER_LIST.length === 0 && typeof fetchUsers === 'function') {
        Swal.fire({title: 'โหลดรายชื่อ...', didOpen: () => Swal.showLoading()});
        await fetchUsers(); 
        Swal.close();
    }
    
    await fetchLeaveData(); 
    subscribeLeaveChanges(); 
    subscribeSettingsChanges();
    
    // ==========================================
    // 🟢 จุดที่แก้ไข: ดักจับแผนกแปลกๆ ให้แสดงหน้า AM
    // ==========================================
    const allowedDepts = ['AM', 'OD', 'NEW', 'TRAINER'];
    let myDept = currentUser.department || 'AM';
    
    // ถ้ายูสเซอร์อยู่แผนกแปลกๆ (เช่น AMQL) ให้เปลี่ยนเป็น AM อัตโนมัติ (หรือจะแก้เป็น 'TRAINER' ก็ได้ครับ)
    if (!allowedDepts.includes(myDept)) {
        myDept = 'AM'; 
    }
    
    switchDept(myDept); 
    // ==========================================
    
    if (window.leaveCheckInterval) {
        clearInterval(window.leaveCheckInterval);
    }

    window.leaveCheckInterval = setInterval(() => {
        const leaveAppEl = document.getElementById('leaveApp');
        if(!leaveAppEl || leaveAppEl.classList.contains('hidden')) return;
        checkBookingWindow();
    }, 1000);
}

async function loadLeaveSettings() {
    const { data, error } = await appDB.from('settings')
        .select('key, value')
        .not('key', 'like', 'duty_roster_%')
        .not('key', 'like', 'report_TRAINER_%')
        .neq('key', 'app_files_data')
        .neq('key', 'menu_access_rules')
        .neq('key', 'duty_access_matrix')
        .neq('key', 'duty_custom_roles')
        .neq('key', 'discord_channels')
        .neq('key', 'discord_custom_names');

    if (data) {
        ['AM', 'OD', 'NEW', 'TRAINER'].forEach(dept => {
            const getDbValue = (keySuffix, defaultVal) => {
                const row = data.find(d => d.key === `${dept}_${keySuffix}`);
                return row ? row.value : defaultVal;
            };
            deptSettings[dept].limit = parseInt(getDbValue('limit', '4')) || 4;
            deptSettings[dept].startM = getDbValue('startM', '');
            deptSettings[dept].endM = getDbValue('endM', '');
            deptSettings[dept].startA = getDbValue('startA', '');
            deptSettings[dept].endA = getDbValue('endA', '');
            deptSettings[dept].startN = getDbValue('startN', '');
            deptSettings[dept].endN = getDbValue('endN', '');
            deptSettings[dept].isOpen = (getDbValue('is_open', 'false') === 'true');
            deptSettings[dept].quotaM = parseInt(getDbValue('quota_m', '0')) || 0;
            deptSettings[dept].quotaA = parseInt(getDbValue('quota_a', '0')) || 0;
            deptSettings[dept].quotaN = parseInt(getDbValue('quota_n', '0')) || 0;
            deptSettings[dept].viewMonth = getDbValue('view_month', '');
            deptSettings[dept].startDay = parseInt(getDbValue('lock_start', '')) || '';
            deptSettings[dept].endDay = parseInt(getDbValue('lock_end', '')) || '';
        });
    }
    updateAdminInputs();
    renderLeaveTable(); 
    checkBookingWindow();
}

window.checkBookingWindow = function(targetShift) {
    const now = new Date();
    const s = deptSettings[currentViewDept] || {};

    const getStatus = (name, startStr, endStr) => {
        let msg = "", isOpen = true;
        if (s.isOpen) {
            msg = `✅ ${name} เปิดจอง (ตลอด)`; isOpen = true;
        } else {
            const start = startStr ? new Date(startStr) : null;
            const end = endStr ? new Date(endStr) : null;
            if (!start || !end) {
                msg = `⚠️ ${name} ปิด (ไม่ตั้งเวลา)`; isOpen = false;
            } else if (now < start) {
                msg = `⏳ ${name} เปิด: ${start.toLocaleString('th-TH', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'})}`; isOpen = false;
            } else if (now > end) {
                msg = `⛔ ${name} ปิดจองแล้ว`; isOpen = false;
            } else {
                msg = `✅ ${name} ถึง: ${end.toLocaleString('th-TH', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'})}`; isOpen = true;
            }
        }
        return { msg, isOpen };
    };

    if (targetShift) {
        let startStr = '', endStr = '';
        if (targetShift.includes('เช้า')) { startStr = s.startM; endStr = s.endM; }
        else if (targetShift.includes('กลาง')) { startStr = s.startA; endStr = s.endA; }
        else if (targetShift.includes('ดึก')) { startStr = s.startN; endStr = s.endN; }
        return getStatus(targetShift, startStr, endStr).isOpen;
    }

    const stM = getStatus('เช้า', s.startM, s.endM);
    const stA = getStatus('กลาง', s.startA, s.endA);
    const stN = getStatus('ดึก', s.startN, s.endN);

    const statusText = document.getElementById('bookingStatusText');
    const rtDot = document.getElementById('rtStatus');

    if(statusText) {
        const makeBadge = (st) => {
            if (st.isOpen) return `<span class="text-[10px] text-green-400 font-bold bg-green-900/30 border border-green-800/50 px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">${st.msg}</span>`;
            return `<span class="text-[10px] text-red-400 font-bold bg-red-900/30 border border-red-800/50 px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">${st.msg}</span>`;
        };
        
        const newStatusHtml = `<div class="flex flex-wrap items-center gap-1.5 mt-1">${makeBadge(stM)}${makeBadge(stA)}${makeBadge(stN)}</div>`;
        if (statusText.innerHTML !== newStatusHtml) {
            statusText.innerHTML = newStatusHtml;
        }
    }
    if(rtDot) rtDot.classList.add('realtime-active');
    return true;
}

async function fetchLeaveData() {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth() + 1;
    const daysInMonth = new Date(year, month, 0).getDate();
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-${daysInMonth}`;
    
    const { data } = await appDB.from('leave_requests').select('*').gte('leave_date', startDate).lte('leave_date', endDate);
    if(data) {
        allLeaveData = data;
        renderLeaveTable();
    }
}

function subscribeLeaveChanges() {
    if(leaveSubscription) appDB.removeChannel(leaveSubscription);
    leaveSubscription = appDB.channel('leave-updates')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, (payload) => {
        if (window.isEditingLeave) return;
        
        const leaveAppEl = document.getElementById('leaveApp');
        if (leaveAppEl && !leaveAppEl.classList.contains('hidden')) {
            
            let changedUserId = null;

            if (payload.eventType === 'INSERT') {
                allLeaveData.push(payload.new);
                changedUserId = payload.new.user_id;
            } else if (payload.eventType === 'DELETE') {
                const deletedItem = allLeaveData.find(l => String(l.id) === String(payload.old.id));
                if (deletedItem) changedUserId = deletedItem.user_id;
                allLeaveData = allLeaveData.filter(l => String(l.id) !== String(payload.old.id));
            }

            if (!changedUserId) return;

            const tUser = GLOBAL_USER_LIST.find(u => String(u.id) === String(changedUserId));
            const tDept = tUser ? (tUser.department || 'AM') : 'AM';
            const tRole = tUser ? (tUser.role || 'staff').toLowerCase() : 'staff';
            
            let shouldRenderTable = false;
            if (currentViewDept === 'TRAINER' && (tDept === 'TRAINER' || tRole === 'trainer')) shouldRenderTable = true;
            else if (currentViewDept === 'NEW' && tDept === 'NEW') shouldRenderTable = true;
            else if (tRole === 'staff' && tDept === currentViewDept) shouldRenderTable = true;

            if (shouldRenderTable) {
                window.renderLeaveTable(); 
                flashRealtimeDot();
            }
        }
    }).subscribe();
}

function subscribeSettingsChanges() {
    if(settingsSubscription) appDB.removeChannel(settingsSubscription);
    settingsSubscription = appDB.channel('settings-updates')
    // 🌟 ส่วนที่ 1: ฟังคำสั่ง Broadcast (สำหรับสั่งให้โหลดใหม่แบบเจาะจง)
    .on('broadcast', { event: 'force_leave_reload' }, async () => {
        const leaveAppEl = document.getElementById('leaveApp');
        if (leaveAppEl && !leaveAppEl.classList.contains('hidden')) {
            await loadLeaveSettings();
            flashRealtimeDot();
        }
    })
    // 🌟 ส่วนที่ 2: เพิ่มใหม่! ดักฟังการเปลี่ยนแปลงข้อมูลในตาราง settings โดยตรง
    .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, async (payload) => {
        // เช็คว่าถ้าเป็นคีย์ที่เกี่ยวกับการตั้งค่าหน้าลางาน (มี _is_open, _quota, _limit, _start, _end)
        if (payload.new && payload.new.key && (
            payload.new.key.includes('_is_open') || 
            payload.new.key.includes('_quota') || 
            payload.new.key.includes('_limit') ||
            payload.new.key.includes('time_') ||
            payload.new.key.includes('lock_') ||
            payload.new.key.includes('_start') ||
            payload.new.key.includes('_end')
        )) {
            const leaveAppEl = document.getElementById('leaveApp');
            // เช็คว่าผู้ใช้อยู่หน้าลางานพอดีไหม ถ้าอยู่ก็ให้โหลดการตั้งค่าใหม่มาอัปเดตหน้าจอทันที
            if (leaveAppEl && !leaveAppEl.classList.contains('hidden')) {
                await loadLeaveSettings();
                flashRealtimeDot();
            }
        }
    })
    .subscribe();
}

function flashRealtimeDot() {
    const rtDot = document.getElementById('rtStatus');
    if(rtDot) { rtDot.style.backgroundColor = '#facc15'; setTimeout(() => rtDot.style.backgroundColor = '#4ade80', 300); }
}

if (!document.getElementById('crosshair-dynamic-style')) {
    const style = document.createElement('style');
    style.id = 'crosshair-dynamic-style';
    document.head.appendChild(style);
}

window.highlightCell = function(cell, colIndex, isEnter) {
    const row = cell.parentElement;
    const styleTag = document.getElementById('crosshair-dynamic-style');

    if (isEnter) {
        row.classList.add('hover-row-active');
        cell.classList.add('hover-cell-active');
        const cssIndex = colIndex + 3;
        const isDark = document.documentElement.classList.contains('dark');
        const bgColor = isDark ? '#374151' : '#fff7ed'; 
        styleTag.innerHTML = `
            #leaveTableMain tbody tr td:nth-child(${cssIndex}):not(.is-booked),
            #leaveTableMain thead tr th:nth-child(${cssIndex}) {
                background-color: ${bgColor} !important;
            }
        `;
    } else {
        row.classList.remove('hover-row-active');
        cell.classList.remove('hover-cell-active');
        styleTag.innerHTML = '';
    }
};

window.renderLeaveTable = function() {
    const thead = document.getElementById('tableHeaderRow');
    const tbody = document.getElementById('tableBody');
    const searchInput = document.getElementById('leaveSearchInput');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : ''; 
    const shiftFilterSelect = document.getElementById('leaveShiftFilter');
    const shiftFilter = shiftFilterSelect ? shiftFilterSelect.value : 'all'; 
    
    if(!thead || !tbody) return;
    thead.innerHTML = ''; tbody.innerHTML = '';

    // 🌟 แก้บั๊กเส้นตารางหาย: ลบคลาสที่ทำให้เส้นขอบชนกันออก
    tbody.classList.remove('divide-y', 'divide-gray-100', 'dark:divide-slate-700');

    const s = deptSettings[currentViewDept] || { limit: 4, quotaM: 0, quotaA: 0, quotaN: 0 }; 
    const isAdmin = (currentUser.role === 'manager' || currentUser.role === 'admin');
    const picker = document.getElementById('viewMonthPicker');
    const btnPrev = document.getElementById('btnPrevMonth');
    const btnNext = document.getElementById('btnNextMonth');

    if (!isAdmin && s.viewMonth) {
        if(picker) { picker.disabled = true; picker.classList.add('opacity-50', 'cursor-not-allowed'); }
        if(btnPrev) btnPrev.classList.add('hidden');
        if(btnNext) btnNext.classList.add('hidden');
        const currentY = currentCalendarDate.getFullYear();
        const currentM = String(currentCalendarDate.getMonth() + 1).padStart(2, '0');
        if (`${currentY}-${currentM}` !== s.viewMonth) {
            const [y, m] = s.viewMonth.split('-');
            currentCalendarDate = new Date(parseInt(y), parseInt(m)-1, 1);
            if(typeof updateMonthPicker === 'function') updateMonthPicker();
        }
    } else {
        if(picker) { picker.disabled = false; picker.classList.remove('opacity-50', 'cursor-not-allowed'); }
        if(btnPrev) btnPrev.classList.remove('hidden');
        if(btnNext) btnNext.classList.remove('hidden');
    }

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    if(typeof checkBookingWindow === 'function') checkBookingWindow();

    const allDeptUsers = GLOBAL_USER_LIST.filter(u => {
        const uDept = u.department || 'AM';
        const uRole = u.role ? u.role.toLowerCase() : 'staff'; 

        if (currentViewDept === 'TRAINER') {
            return uDept === 'TRAINER' || uRole === 'trainer'; 
        } else if (currentViewDept === 'NEW') {
            return uDept === 'NEW';
        } else {
            return uRole === 'staff' && uDept === currentViewDept; 
        }
    });
    const allDeptUserIds = new Set(allDeptUsers.map(u => u.id));
    const userShiftMapAll = {};
    allDeptUsers.forEach(u => userShiftMapAll[u.id] = u.allowed_shift || 'all');

    const staffListToRender = allDeptUsers.filter(u => 
        u.username.toLowerCase().includes(searchTerm) &&
        (shiftFilter === 'all' || u.allowed_shift === shiftFilter)
    ).sort((a,b) => a.username.localeCompare(b.username));

    const bookedMap = new Map(); 
    const personalCounts = {};    
    const shiftDailyCounts = {}; 

   allLeaveData.forEach(l => {
        if (!allDeptUserIds.has(l.user_id)) return;
        
        const rsn = (l.reason === 'Table-Booking' || !l.reason) ? 'X' : l.reason;
        bookedMap.set(`${l.user_id}_${l.leave_date}`, rsn);
        
        const uShift = userShiftMapAll[l.user_id];
        const shiftKey = `${l.leave_date}_${uShift}`;
        if(!shiftDailyCounts[shiftKey]) shiftDailyCounts[shiftKey] = 0;
        shiftDailyCounts[shiftKey]++;

        const lDate = new Date(l.leave_date);
        if (lDate.getMonth() === month && lDate.getFullYear() === year) {
            // 🌟 แก้ไข: เปลี่ยนการเก็บข้อมูลให้มีทั้งยอดรวม และแยกประเภทย่อย
            if(!personalCounts[l.user_id]) {
                personalCounts[l.user_id] = { total: 0, details: {} };
            }
            personalCounts[l.user_id].total++;
            
            if(!personalCounts[l.user_id].details[rsn]) {
                personalCounts[l.user_id].details[rsn] = 0;
            }
            personalCounts[l.user_id].details[rsn]++;
        }
    });

    let displayDeptText = currentViewDept;
    if(currentViewDept === 'NEW') displayDeptText = 'พนักงานใหม่';
    if(currentViewDept === 'TRAINER') displayDeptText = 'ผู้สอน';

    let headerHtml = `
        <th class="p-2 sticky left-0 z-30 bg-slate-50 dark:bg-slate-800 border-b border-r dark:border-slate-700 w-[40px] min-w-[40px] max-w-[40px] text-center">No.</th>
        <th class="p-2 sticky left-[39px] z-30 bg-slate-50 dark:bg-slate-800 border-b border-r dark:border-slate-700 w-[140px] min-w-[140px] max-w-[140px] text-left pl-4">
            รายชื่อ (${displayDeptText})
        </th>
    `;
    
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        
        const countM = shiftDailyCounts[`${dateStr}_กะเช้า`] || 0;
        const countA = shiftDailyCounts[`${dateStr}_กะกลาง`] || 0;
        const countN = shiftDailyCounts[`${dateStr}_กะดึก`] || 0;

        const isFullM = countM >= (s.quotaM || 0);
        const isFullA = countA >= (s.quotaA || 0);
        const isFullN = countN >= (s.quotaN || 0);
        
        const textM = isFullM ? 'text-red-500 dark:text-red-400' : 'text-slate-700 dark:text-gray-200';
        const textA = isFullA ? 'text-red-500 dark:text-red-400' : 'text-slate-700 dark:text-gray-200';
        const textN = isFullN ? 'text-red-500 dark:text-red-400' : 'text-slate-700 dark:text-gray-200';
        
        let bgClass = "bg-slate-50 dark:bg-slate-800";
        let isLocked = false;
        if (s.startDay && d < s.startDay) isLocked = true;
        if (s.endDay && d > s.endDay) isLocked = true;
        if (isLocked) bgClass = "bg-gray-200 dark:bg-slate-950 opacity-60";

        headerHtml += `<th class="p-1.5 border-b border-r dark:border-slate-700 min-w-[75px] align-top ${bgClass}">
            <div class="text-[14px] text-slate-800 dark:text-white font-extrabold text-center mb-1 pb-0.5 border-b border-gray-200 dark:border-slate-600">${d}</div>
            <div class="flex flex-col gap-1">
                <div class="flex justify-between items-center">
                    <span class="text-[10px] font-bold text-orange-500">เช้า</span>
                    <span class="text-[11px] font-mono font-bold ${textM}">${countM}/${s.quotaM || 0}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-[10px] font-bold text-blue-500">กลาง</span>
                    <span class="text-[11px] font-mono font-bold ${textA}">${countA}/${s.quotaA || 0}</span>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-[10px] font-bold text-purple-400">ดึก</span>
                    <span class="text-[11px] font-mono font-bold ${textN}">${countN}/${s.quotaN || 0}</span>
                </div>
            </div>
        </th>`;
    }
    thead.innerHTML = headerHtml;

    let bodyHtml = '';
    staffListToRender.forEach((u, index) => {
        const isMe = u.id === currentUser.id;
        const nameClass = isMe ? "text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-900/10" : "";
        const rowClass = isMe ? "bg-rose-50/30 dark:bg-rose-900/5" : "";
        
        // 🌟 ดึงข้อมูลที่นับแบบแยกประเภทแล้วออกมาใช้
        const myLeaveData = personalCounts[u.id] || { total: 0, details: {} };
        
        // 🌟 แก้ไข: ให้ดึงเฉพาะยอดของประเภท "X" มาใช้คำนวณโควตาและแสดงในวงกลม
        const myTotal = myLeaveData.details['X'] || 0; 
        const isPersonalFull = myTotal >= s.limit;

        let targetQuota = s.quotaM || 2; 
        if(u.allowed_shift === 'กะเช้า') targetQuota = s.quotaM;
        else if(u.allowed_shift === 'กะกลาง') targetQuota = s.quotaA;
        else if(u.allowed_shift === 'กะดึก') targetQuota = s.quotaN;

        let removeBtn = '';
        if (isAdmin && (currentViewDept === 'NEW' || currentViewDept === 'TRAINER')) {
            if(typeof removeFromNewDept === 'function') {
                removeBtn = `<button onclick="removeFromNewDept(${u.id}, '${u.username}')" class="ml-1 text-gray-400 hover:text-red-500 transition"><span class="material-icons text-[10px]">close</span></button>`;
            }
        }

        // 🌟 สร้าง HTML แสดงจำนวนลางานแยกตามประเภท ให้ครบทุกแบบตามหน้าเว็บคุณ
        let breakdownHtml = '';
        if (myTotal > 0) {
            const detailItems = [];
            // กำหนดสีให้ครบตามประเภทการลาเลยครับ
            const colors = {
                'X': 'text-red-500 font-black',
                'XX': 'text-yellow-600 font-black',
                'X4': 'text-pink-500 font-black',
                'KL': 'text-green-600 font-black',
                'TX': 'text-blue-500 font-black',
                'TL': 'text-blue-500 font-black',
                'PN': 'text-amber-700 font-black',
                'KP': 'text-yellow-800 font-black'
            };
            
            for (const [rsn, count] of Object.entries(myLeaveData.details)) {
                // เผื่อมีค่า Table-Booking หลุดมา ให้โชว์เป็น X
                let displayRsn = (rsn === 'Table-Booking') ? 'X' : rsn;
                const colorCls = colors[displayRsn] || 'text-gray-500 font-black';
                
                // เช็คกันซ้ำ
                if (!detailItems.some(item => item.includes(`>${displayRsn}:`))) {
                    detailItems.push(`<span class="${colorCls} bg-slate-100 dark:bg-slate-800 px-1 rounded shadow-sm border border-gray-200 dark:border-slate-600">${displayRsn}:${count}</span>`);
                }
            }
            breakdownHtml = `<div class="text-[9px] leading-tight mt-1.5 flex flex-wrap gap-x-1 gap-y-1">${detailItems.join('')}</div>`;
        }

        let rowHtml = `<tr class="transition ${rowClass} border-b border-gray-200 dark:border-slate-700">`;
        rowHtml += `<td class="p-2 sticky left-0 z-10 bg-white dark:bg-slate-900 border-r border-b border-gray-200 dark:border-slate-700 text-[10px] text-center text-gray-400 font-mono w-[40px] min-w-[40px] max-w-[40px]">${index + 1}</td>`;
        
        // 🌟 เอา breakdownHtml ไปใส่ใต้ชื่อพนักงาน (เพิ่มการตีเส้นขอบให้ชัวร์)
        rowHtml += `<td class="p-2 sticky left-[39px] z-10 bg-white dark:bg-slate-900 border-r border-b border-gray-200 dark:border-slate-700 text-xs ${nameClass} w-[140px] min-w-[140px] max-w-[140px]">
            <div class="flex justify-between items-start gap-1">
                <div class="flex flex-col min-w-0 flex-1">
                    <div class="flex items-center"><span class="truncate max-w-[70px] font-bold text-[13px]">${u.username}</span>${removeBtn}</div>
                    ${breakdownHtml}
                </div>
                <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 mt-0.5 ${isPersonalFull ? 'bg-red-100 text-red-600 border-red-200' : 'bg-gray-100 text-gray-500 border-gray-200 shadow-inner'}">${myTotal}/${s.limit}</span>
            </div>
        </td>`;

        let isThisUserShiftOpen = true;
        if (typeof checkBookingWindow === 'function') {
            isThisUserShiftOpen = checkBookingWindow(u.allowed_shift);
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            
            const leaveReason = bookedMap.get(`${u.id}_${dateStr}`);
            const isBooked = !!leaveReason;
            
            const shiftCountKey = `${dateStr}_${u.allowed_shift}`;
            const currentShiftCount = shiftDailyCounts[shiftCountKey] || 0;
            const isShiftFull = currentShiftCount >= targetQuota;
            
            let isDateLocked = false;
            if (s.startDay && d < s.startDay) isDateLocked = true;
            if (s.endDay && d > s.endDay) isDateLocked = true;

            let cellClass = "cursor-pointer";
            let cellContent = "";
            let baseDeptColor = 'bg-rose-500'; 
            if(currentViewDept === 'OD') baseDeptColor = 'bg-fuchsia-500';
            if(currentViewDept === 'NEW') baseDeptColor = 'bg-cyan-500';
            if(currentViewDept === 'TRAINER') baseDeptColor = 'bg-indigo-500';

            if (isDateLocked && !isAdmin) {
                cellClass = "bg-gray-300 dark:bg-slate-950 cursor-not-allowed opacity-30"; 
            } else if (isBooked) {
                let finalColor = 'bg-red-500'; 
                let finalText = '✕';
                let textColor = 'text-white';
                
                if (leaveReason === 'X' || leaveReason === 'Table-Booking') { 
                    finalColor = 'bg-red-500'; finalText = '✕'; 
                }
                else if (leaveReason === 'XX') { 
                    finalColor = 'bg-yellow-400'; finalText = 'XX'; textColor = 'text-yellow-900'; 
                }
                else if (leaveReason === 'X4') { 
                    finalColor = 'bg-pink-500'; finalText = 'X4'; 
                } 
                else if (leaveReason === 'KL') {
                    finalColor = 'bg-green-500'; finalText = 'KL';
                } else if (leaveReason === 'TL' || leaveReason === 'TX') {
                    finalColor = 'bg-blue-500'; finalText = leaveReason;
                } else if (leaveReason === 'PN') {
                    finalColor = 'bg-amber-800'; finalText = 'PN'; textColor = 'text-white';
                } else if (leaveReason === 'KP') {
                    finalColor = 'bg-yellow-700'; finalText = 'KP'; textColor = 'text-white';
                } else {
                    finalColor = baseDeptColor; finalText = leaveReason;
                }

                cellClass = `${finalColor} ${textColor} font-bold cursor-pointer text-sm leading-none pb-1 is-booked shadow-inner`;
                cellContent = finalText; 
            } else if (isShiftFull && !isAdmin) { 
                cellClass = "bg-gray-100 dark:bg-slate-800 cursor-not-allowed opacity-30"; 
            } else if (!isBooked && isPersonalFull && !isAdmin && isMe) {
                cellClass = "bg-gray-50 dark:bg-slate-800/50 cursor-not-allowed opacity-50"; 
            }

            let hoverAttr = `onmouseover="highlightCell(this, ${d-1}, true)" onmouseout="highlightCell(this, ${d-1}, false)"`;
            let clickAttr = "";
            
            if (isDateLocked && !isAdmin) {
                if(isMe) clickAttr = `onclick="Swal.fire({icon:'error', title:'ล็อกวัน', text:'วันที่นี้ถูกล็อก ไม่สามารถทำรายการได้', timer:1500, showConfirmButton:false})"`;
            } else if (!isThisUserShiftOpen && !isAdmin && isMe) {
                clickAttr = `onclick="Swal.fire({icon:'error', title:'ปิดจองแล้ว', text:'อยู่นอกเวลาทำรายการของกะคุณ', timer:2000, showConfirmButton:false})"`;
            } else if (isMe || isAdmin) {
                if (isBooked) {
                    clickAttr = `onclick="toggleLeaveTable('${dateStr}', 'remove', ${u.id}, '${u.username}', '${u.allowed_shift}')"`;
                } else if (!isShiftFull || isAdmin) { 
                    if (!isPersonalFull || isAdmin) {
                        clickAttr = `onclick="toggleLeaveTable('${dateStr}', 'add', ${u.id}, '${u.username}', '${u.allowed_shift}')"`;
                    } else if (isMe) {
                        clickAttr = `onclick="Swal.fire({icon:'warning', title:'ครบโควตา', text:'คุณใช้สิทธิ์ครบ ${s.limit} วันแล้ว', timer:1500, showConfirmButton:false})"`;
                    }
                }
            }
            
            rowHtml += `<td class="border-r border-b dark:border-slate-700 text-center ${cellClass}" ${clickAttr} ${hoverAttr}>${cellContent}</td>`;
        }
        rowHtml += `</tr>`;
        bodyHtml += rowHtml;
    });
    
    if(staffListToRender.length === 0) bodyHtml = `<tr><td colspan="${daysInMonth + 2}" class="p-10 text-center text-gray-400">ไม่พบรายชื่อในแผนก ${displayDeptText}</td></tr>`;
    tbody.innerHTML = bodyHtml;
};

window.changeMonth = function(step) { currentCalendarDate.setMonth(currentCalendarDate.getMonth() + step); updateMonthPicker(); fetchLeaveData(); }
window.updateMonthPicker = function() { 
    const y = currentCalendarDate.getFullYear(); const m = String(currentCalendarDate.getMonth() + 1).padStart(2, '0'); 
    if(document.getElementById('viewMonthPicker')) document.getElementById('viewMonthPicker').value = `${y}-${m}`; 
    window.updateThaiMonthDisplay();
}
window.jumpToMonth = function() { const val = document.getElementById('viewMonthPicker').value; if(val) { const [y, m] = val.split('-'); currentCalendarDate = new Date(parseInt(y), parseInt(m)-1, 1); fetchLeaveData(); } }

window.updateThaiMonthDisplay = function() {
    const thaiMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    const viewPicker = document.getElementById('viewMonthPicker');
    const viewDisplay = document.getElementById('viewMonthDisplay');
    if (viewPicker && viewDisplay && viewPicker.value) {
        const [y, m] = viewPicker.value.split('-');
        viewDisplay.innerText = `${thaiMonths[parseInt(m) - 1]} ${parseInt(y) + 543}`;
    }
    const setPicker = document.getElementById('setAllowedMonth');
    const setDisplay = document.getElementById('setMonthDisplay');
    if (setPicker && setDisplay) {
        if (setPicker.value) {
            const [y, m] = setPicker.value.split('-');
            setDisplay.innerText = `${thaiMonths[parseInt(m) - 1]} ${parseInt(y) + 543}`;
        } else {
            setDisplay.innerText = 'เลือกเดือน';
        }
    }
};

window.changeAdminMonth = function(step) {
    const inputEl = document.getElementById('setAllowedMonth');
    if (!inputEl) return;

    let currentVal = inputEl.value;
    let d;

    if (currentVal) {
        const [y, m] = currentVal.split('-');
        d = new Date(parseInt(y), parseInt(m) - 1, 1);
    } else {
        d = new Date();
    }

    d.setMonth(d.getMonth() + step);

    const newY = d.getFullYear();
    const newM = String(d.getMonth() + 1).padStart(2, '0');
    
    inputEl.value = `${newY}-${newM}`;
    
    if (typeof window.updateThaiMonthDisplay === 'function') {
        window.updateThaiMonthDisplay();
    }
};

window.toggleLeaveTable = async function(dateStr, action, targetUserId, targetUserName, targetUserShift) {
    const typeToSave = window.activeLeaveType || 'X';

    if (action === 'remove') {
        const result = await Swal.fire({
            title: 'ยืนยันการลบ?',
            text: `ยกเลิกรายการของ ${targetUserName} วันที่ ${dateStr} ใช่หรือไม่?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'ใช่, ลบเลย!',
            cancelButtonText: 'ยกเลิก'
        });
        if (!result.isConfirmed) return;
    }

    window.isEditingLeave = true; 
    Swal.fire({title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});

    try {
        if (action === 'add') {
            const { error } = await appDB.from('leave_requests').insert([
                { 
                    user_id: targetUserId, 
                    user_name: targetUserName,
                    leave_date: dateStr, 
                    reason: typeToSave, 
                    status: 'approved' 
                }
            ]);
            if (error) throw error;
            
            // 🌟 แก้ไข: เรียกใช้ logLeaveAction เพื่อให้มันบันทึกลงตาราง leave_logs ให้ถูกต้อง
            await logLeaveAction(`จอง [${typeToSave}]`, targetUserId, targetUserName, dateStr);

       } else if (action === 'remove') {
            const { error } = await appDB.from('leave_requests')
                .delete()
                .eq('user_id', targetUserId)
                .eq('leave_date', dateStr);
            
            if (error) throw error;

            // 🌟 แก้ไข: เรียกใช้ logLeaveAction เพื่อบันทึกประวัติการยกเลิก
            await logLeaveAction('ยกเลิก', targetUserId, targetUserName, dateStr);
        }
        
        // 🌟 อัปเดตตารางด้วยข้อมูลล่าสุดจากฐานข้อมูลโดยตรง (ชัวร์และแม่นยำ 100%)
        await fetchLeaveData(); 
        Swal.fire({ icon: 'success', title: action === 'add' ? 'บันทึกสำเร็จ' : 'ลบสำเร็จ', showConfirmButton: false, timer: 1000 });

    } catch (error) {
        console.error('Toggle Leave Error:', error);
        Swal.fire('ข้อผิดพลาด', error.message, 'error');
    } finally {
        setTimeout(() => { window.isEditingLeave = false; }, 500); 
    }
};

window.executeSaveSettings = async function() {
    try {
        Swal.fire({ title: 'กำลังบันทึกข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const q = document.getElementById('setQuota')?.value || "0";
        const p = document.getElementById('setPersonLimit')?.value || "4";
        const sM = document.getElementById('setStartM')?.value || '';
        const eM = document.getElementById('setEndM')?.value || '';
        const sA = document.getElementById('setStartA')?.value || '';
        const eA = document.getElementById('setEndA')?.value || '';
        const sN = document.getElementById('setStartN')?.value || '';
        const eN = document.getElementById('setEndN')?.value || '';
        const forceOpen = document.getElementById('setForceOpen')?.checked || false;
        const qM = document.getElementById('setQuotaM')?.value || "0";
        const qA = document.getElementById('setQuotaA')?.value || "0";
        const qN = document.getElementById('setQuotaN')?.value || "0";
        const viewMonth = document.getElementById('setAllowedMonth')?.value || '';
        const sDay = document.getElementById('setStartDay')?.value || '';
        const eDay = document.getElementById('setEndDay')?.value || '';
        const dept = typeof currentViewDept !== 'undefined' ? currentViewDept : 'AM';

        if (typeof deptSettings !== 'undefined') {
            deptSettings[dept] = { quota: parseInt(q), limit: parseInt(p), startM: sM, endM: eM, startA: sA, endA: eA, startN: sN, endN: eN, isOpen: forceOpen, quotaM: parseInt(qM), quotaA: parseInt(qA), quotaN: parseInt(qN), viewMonth: viewMonth, startDay: parseInt(sDay), endDay: parseInt(eDay) };
        }

        const updates = [
            { key: `${dept}_quota`, value: String(q) }, { key: `${dept}_limit`, value: String(p) },
            { key: `${dept}_startM`, value: sM }, { key: `${dept}_endM`, value: eM },
            { key: `${dept}_startA`, value: sA }, { key: `${dept}_endA`, value: eA },
            { key: `${dept}_startN`, value: sN }, { key: `${dept}_endN`, value: eN },
            { key: `${dept}_is_open`, value: String(forceOpen) },
            { key: `${dept}_quota_m`, value: String(qM) }, { key: `${dept}_quota_a`, value: String(qA) }, { key: `${dept}_quota_n`, value: String(qN) },
            { key: `${dept}_view_month`, value: viewMonth },
            { key: `${dept}_lock_start`, value: String(sDay) }, { key: `${dept}_lock_end`, value: String(eDay) }       
        ];

        const { error } = await appDB.from('settings').upsert(updates);
        if (error) throw error;
        appDB.channel('settings-updates').send({ type: 'broadcast', event: 'force_leave_reload' });

        if (viewMonth && typeof currentCalendarDate !== 'undefined') {
            const [y, m] = viewMonth.split('-');
            currentCalendarDate = new Date(parseInt(y), parseInt(m) - 1, 1);
            if (typeof updateMonthPicker === 'function') updateMonthPicker();
        }

        setTimeout(async () => {
            if (typeof checkBookingWindow === 'function') checkBookingWindow();
            if (typeof fetchLeaveData === 'function') await fetchLeaveData(); 
            Swal.fire({ icon: 'success', title: `บันทึกเรียบร้อย!`, showConfirmButton: false, timer: 1500 });
        }, 100);
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด!', text: err.message || 'ไม่สามารถบันทึกได้' });
    }
};

window.exportLeaveToExcel = async function() {
    // 1. เช็คข้อมูลพนักงานก่อน
    if (!GLOBAL_USER_LIST || GLOBAL_USER_LIST.length === 0) return Swal.fire('ข้อมูลยังไม่พร้อม', 'กรุณารอสักครู่แล้วลองใหม่', 'warning');

    // 2. เรียกใช้ฟังก์ชันแอบโหลด ExcelJS (ดึงมาจากที่เราสร้างไว้ใน summary.js)
    window.loadExcelLibrary(async function() {
        Swal.fire({ title: 'กำลังสร้างไฟล์ Excel...', text: 'รอสักครู่นะครับ', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        
        try {
            const year = currentCalendarDate.getFullYear();
            const month = currentCalendarDate.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const monthNamesThai = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
            const monthName = `${monthNamesThai[month]} ${year}`;

            const staffList = GLOBAL_USER_LIST.filter(u => {
                const uDept = u.department || 'AM';
                if (currentViewDept === 'TRAINER') return uDept === 'TRAINER';
                if (currentViewDept === 'NEW') return uDept === 'NEW';
                return u.role === 'staff' && uDept === currentViewDept;
            }).sort((a,b) => a.username.localeCompare(b.username));

            if (staffList.length === 0) { Swal.close(); return Swal.fire('ไม่มีข้อมูล', `ไม่มีรายชื่อพนักงานในแผนก ${currentViewDept}`, 'warning'); }

            const bookedMap = new Map();
            allLeaveData.forEach(l => { const rsn = (l.reason === 'Table-Booking' || !l.reason) ? 'X' : l.reason; bookedMap.set(`${l.user_id}_${l.leave_date}`, rsn); });

            const styleMap = {
                'X':  { bg: 'FFEF4444', font: 'FFFFFFFF' }, 'XX': { bg: 'FFFACC15', font: 'FF854D0E' },
                'X4': { bg: 'FFEC4899', font: 'FFFFFFFF' }, 'KL': { bg: 'FF22C55E', font: 'FFFFFFFF' },
                'TL': { bg: 'FF3B82F6', font: 'FFFFFFFF' }, 'TX': { bg: 'FF3B82F6', font: 'FFFFFFFF' },
                'PN': { bg: 'FF92400E', font: 'FFFFFFFF' },
                'KP': { bg: 'FFA16207', font: 'FFFFFFFF' }
            };

            const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet(`วันหยุด ${currentViewDept}`);
            ws.views = [{ state: 'frozen', xSplit: 4, ySplit: 1 }];

            let headers = ['ลำดับ', 'ชื่อพนักงาน', 'กะที่ทำ', 'รวมวันหยุด'];
            for (let d = 1; d <= daysInMonth; d++) headers.push(String(d)); 
            const headerRow = ws.addRow(headers);
            
            headerRow.eachCell((cell) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
                cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border = { top: {style:'thin', color: {argb:'FF334155'}}, left: {style:'thin', color: {argb:'FF334155'}}, bottom: {style:'thin', color: {argb:'FF334155'}}, right: {style:'thin', color: {argb:'FF334155'}} };
            });

            staffList.forEach((u, index) => {
                let rowData = [ index + 1, u.username, (u.allowed_shift || '-').replace('กะ', ''), 0 ];
                let leaveCount = 0; let dailyReasons = [];
                for (let d = 1; d <= daysInMonth; d++) {
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    let rsn = bookedMap.get(`${u.id}_${dateStr}`);
                    if (rsn) { leaveCount++; if(rsn === 'Table-Booking') rsn = 'X'; dailyReasons.push(rsn); } else { dailyReasons.push(''); }
                }
                rowData[3] = leaveCount; 
                const excelRow = ws.addRow(rowData.concat(dailyReasons));

                for (let d = 1; d <= daysInMonth; d++) {
                    const cellVal = dailyReasons[d - 1]; const cell = excelRow.getCell(d + 4); 
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    cell.border = { top: {style:'thin', color: {argb:'FFE2E8F0'}}, left: {style:'thin', color: {argb:'FFE2E8F0'}}, bottom: {style:'thin', color: {argb:'FFE2E8F0'}}, right: {style:'thin', color: {argb:'FFE2E8F0'}} };
                    if (cellVal && styleMap[cellVal]) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: styleMap[cellVal].bg } };
                        cell.font = { color: { argb: styleMap[cellVal].font }, bold: true };
                    }
                }
                excelRow.getCell(1).alignment = { horizontal: 'center' }; excelRow.getCell(2).font = { bold: true }; excelRow.getCell(3).alignment = { horizontal: 'center' }; excelRow.getCell(4).alignment = { horizontal: 'center' }; excelRow.getCell(4).font = { bold: true, color: { argb: 'FFEF4444' } }; 
            });

            ws.columns.forEach((col, index) => {
                if (index === 0) col.width = 6; else if (index === 1) col.width = 20; else if (index === 2) col.width = 10; else if (index === 3) col.width = 12; else col.width = 5; 
            });

            const buffer = await wb.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url; link.download = `ตารางวันหยุด_${currentViewDept}_${monthName}.xlsx`; document.body.appendChild(link);
            link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);

            Swal.fire({ icon: 'success', title: 'ดาวน์โหลดไฟล์ Excel สำเร็จ!', timer: 1500, showConfirmButton: false });
        } catch (err) { Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถสร้างไฟล์ Excel ได้: ' + err.message, 'error'); }
    });
};

window.openHistoryModal = async function() {
    let htmlContent = `
        <div class="text-left w-full">
            <div class="relative mb-4">
                <span class="material-icons absolute left-3 top-3 text-gray-400 text-lg">search</span>
                <input type="text" id="historySearch" placeholder="พิมพ์ชื่อพนักงานเพื่อค้นหา..." class="w-full pl-10 pr-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner transition" onkeyup="debounceHistorySearch()">
            </div>
            <div class="overflow-hidden rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
                <div class="overflow-y-auto max-h-[60vh] custom-scrollbar">
                    <table class="w-full text-sm text-left">
                        <thead class="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-slate-100 dark:bg-slate-900 sticky top-0 z-10 shadow-sm">
                            <tr><th class="px-4 py-3 font-bold w-[15%]">เวลาที่กด</th><th class="px-4 py-3 font-bold w-[30%]">ชื่อพนักงาน</th><th class="px-4 py-3 font-bold w-[30%]">สถานะ / ทำรายการ</th><th class="px-4 py-3 font-bold w-[25%]">สำหรับวันที่</th></tr>
                        </thead>
                        <tbody id="historyTableBody" class="divide-y divide-gray-100 dark:divide-slate-700/50">
                            <tr><td colspan="4" class="text-center p-10"><span class="material-icons animate-spin text-4xl text-indigo-500">sync</span></td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    Swal.fire({
        title: `
            <div class="flex items-center gap-3 border-b border-slate-200 dark:border-slate-700 pb-3">
                <div class="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner"><span class="material-icons text-xl">history</span></div>
                <div class="text-left">
                    <div class="text-xl font-black text-slate-800 dark:text-white tracking-wide">ประวัติการกด <span class="text-indigo-500">(${currentViewDept})</span></div>
                    <div class="text-xs text-gray-500 font-normal mt-0.5">แสดงข้อมูลการ จอง/ยกเลิก วันหยุดล่าสุด</div>
                </div>
            </div>
        `,
        html: htmlContent, width: '700px', showConfirmButton: false, showCloseButton: true,
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-[1.5rem] shadow-2xl p-6' },
        didOpen: () => { fetchHistoryLogs(); }
    });
}

window.debounceHistorySearch = function() {
    clearTimeout(window.historySearchTimer); 
    window.historySearchTimer = setTimeout(() => {
        fetchHistoryLogs(); 
    }, 500); 
};

window.fetchHistoryLogs = async function() {
    const search = document.getElementById('historySearch').value.trim();
    const tbody = document.getElementById('historyTableBody');
    let query = appDB.from('leave_logs').select('*').eq('department', currentViewDept).order('created_at', { ascending: false }).limit(100);
    if (search) query = query.ilike('username', `%${search}%`);

    const { data, error } = await query;
    if (error || !data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center p-10 text-gray-400 font-bold flex flex-col items-center"><span class="material-icons text-5xl opacity-20 mb-2">search_off</span>ไม่พบข้อมูลประวัติ</td></tr>`;
        return;
    }

    const thaiMonths = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
    let rows = '';
    data.forEach(log => {
        const dateObj = new Date(log.created_at);
        const timeStr = dateObj.toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'});
        const dateStr = dateObj.toLocaleDateString('th-TH', {day: '2-digit', month:'short'});
        
        let displayLeaveDate = log.leave_date;
        try { const [lY, lM, lD] = log.leave_date.split('-'); displayLeaveDate = `${parseInt(lD)} ${thaiMonths[parseInt(lM)-1]} ${parseInt(lY)+543}`; } catch(e) {}
        
        let actionBadge = ''; let rowClass = 'hover:bg-slate-50 dark:hover:bg-slate-700/30 transition duration-200';

        if (log.action_type.includes('จอง')) {
            let leaveType = log.action_type.replace('จอง [', '').replace(']', '').trim();
            if(!leaveType || leaveType === 'จอง') leaveType = 'X';
            actionBadge = `<div class="flex items-center gap-1.5"><span class="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 px-2 py-1 rounded-md text-[11px] font-black flex items-center gap-1 shadow-sm"><span class="material-icons text-[14px]">event_available</span> จอง</span><span class="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-gray-200 border border-slate-300 dark:border-slate-600 px-2 py-1 rounded-md text-[10px] font-bold shadow-sm">${leaveType}</span></div>`;
        } else {
            rowClass = 'bg-red-50/40 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20 transition duration-200';
            actionBadge = `<div class="flex items-center gap-1.5"><span class="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 px-2 py-1 rounded-md text-[11px] font-black flex items-center gap-1 shadow-sm"><span class="material-icons text-[14px]">event_busy</span> ยกเลิก</span></div>`;
        }

        let actorHtml = log.actor_name !== log.username ? `<div class="text-[10px] text-orange-500 dark:text-orange-400 mt-1 flex items-center gap-1 font-bold"><span class="material-icons text-[12px]">support_agent</span> แอดมิน ${log.actor_name} กดให้</div>` : `<div class="text-[10px] text-gray-400 mt-1 flex items-center gap-1"><span class="material-icons text-[12px]">touch_app</span> กดด้วยตัวเอง</div>`;

        rows += `<tr class="${rowClass}"><td class="px-4 py-3 align-top"><div class="font-mono text-xs font-black text-indigo-500 dark:text-indigo-400">${timeStr} น.</div><div class="text-[10px] text-gray-500 font-bold mt-0.5">${dateStr}</div></td><td class="px-4 py-3 align-top"><div class="font-black text-sm text-slate-800 dark:text-white tracking-wide">${log.username}</div>${actorHtml}</td><td class="px-4 py-3 align-top">${actionBadge}</td><td class="px-4 py-3 align-top"><div class="font-extrabold text-xs text-slate-700 dark:text-gray-200 bg-white dark:bg-slate-900 inline-block px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-1.5 w-fit"><span class="material-icons text-gray-400 text-[14px]">today</span> ${displayLeaveDate}</div></td></tr>`;
    });
    tbody.innerHTML = rows;
}

window.toggleLeaveStatus = async function(isChecked) {
    const statusValue = isChecked ? 'true' : 'false'; 
    
    Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        if (typeof appDB === 'undefined') throw new Error('ไม่พบตัวแปรเชื่อมต่อฐานข้อมูล');

        const { error } = await appDB.from('settings').upsert([
            { key: `${currentViewDept}_is_open`, value: statusValue } 
        ]);

        if (error) throw error;

        if(deptSettings[currentViewDept]) {
            deptSettings[currentViewDept].isOpen = isChecked;
        }

        Swal.fire({ 
            icon: 'success', title: 'บันทึกสำเร็จ!', 
            text: `ระบบจองวันหยุดแผนก ${currentViewDept} ถูก ${isChecked ? 'เปิด' : 'ปิด'} แล้ว`, 
            timer: 1500, showConfirmButton: false 
        });

    } catch (error) {
        console.error('Toggle Leave Error:', error);
        Swal.fire('เกิดข้อผิดพลาด', error.message, 'error');
        document.getElementById('setForceOpen').checked = !isChecked; 
    }
};

window.loadLeaveStatusConfig = async function() {
    try {
        const { data } = await appDB.from('settings').select('*').like('key', 'leave_status_%');
        if (data) {
            data.forEach(item => {
                const dept = item.key.replace('leave_status_', '');
                window.leaveStatusConfig[dept] = item.value;
            });
        }
        updateLeaveToggleUI(); 
    } catch(e) { console.error('Load Leave Status Error:', e); }
};

window.updateLeaveToggleUI = function() {
    const toggleBtn = document.getElementById('setForceOpen');
    if (!toggleBtn) return;

    // 🌟 เช็คค่าที่ดึงมาจาก Database ล่าสุดของแผนกปัจจุบันมาอัปเดตสวิตช์
    const s = deptSettings[currentViewDept];
    if (s && s.isOpen !== undefined) {
        toggleBtn.checked = s.isOpen;
    }
};

setTimeout(() => {
    if(typeof loadLeaveStatusConfig === 'function') loadLeaveStatusConfig();
}, 500);

setTimeout(() => {
    const targetNode = document.getElementById('settingTargetLabel');
    if (targetNode) {
        const observer = new MutationObserver(() => { updateLeaveToggleUI(); });
        observer.observe(targetNode, { childList: true, characterData: true, subtree: true });
    }
}, 1000);

window.filterNewStaffList = function() {
    const input = document.getElementById('newStaffSearchInput');
    const filter = input.value.toLowerCase();
    const container = document.getElementById('newStaffListContainer');
    const labels = container.getElementsByTagName('label');
    for (let i = 0; i < labels.length; i++) {
        const nameSpan = labels[i].querySelector('.staff-name');
        if (nameSpan) {
            const txtValue = nameSpan.textContent || nameSpan.innerText;
            labels[i].style.display = txtValue.toLowerCase().indexOf(filter) > -1 ? "flex" : "none";
        }
    }
};

window.openManageNewStaffModal = async function() {
    const users = GLOBAL_USER_LIST.filter(u => u.role === 'staff' || u.role === 'manager' || u.role === 'admin').sort((a, b) => a.username.localeCompare(b.username));

    let html = `
        <div class="flex flex-col h-full text-left">
            <div class="sticky top-0 bg-white dark:bg-slate-800 z-10 pb-2 border-b border-gray-200 dark:border-gray-600 mb-2">
                <input type="text" id="newStaffSearchInput" onkeyup="filterNewStaffList()" placeholder="🔍 พิมพ์ชื่อเพื่อค้นหา..." 
                    class="w-full p-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-cyan-500 transition font-bold text-sm">
            </div>
            <div id="newStaffListContainer" class="max-h-[50vh] overflow-y-auto custom-scrollbar pr-1">
    `;
    
    users.forEach(u => {
        const isNewStaff = u.department === 'NEW'; 
        const currentDept = u.department || 'AM';
        let badgeColor = 'bg-blue-100 text-blue-700';
        if(currentDept === 'OD') badgeColor = 'bg-pink-100 text-pink-700';
        else if(currentDept === 'NEW') badgeColor = 'bg-teal-100 text-teal-700';
        else if(currentDept === 'TRAINER') badgeColor = 'bg-cyan-100 text-cyan-700';
        
        let displayDept = currentDept === 'TRAINER' ? 'ผู้สอน' : (currentDept === 'NEW' ? 'พนักงานใหม่' : currentDept);
        
        html += `
            <label class="flex items-center justify-between p-2 hover:bg-cyan-50 dark:hover:bg-slate-700/50 rounded-lg cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-0 transition group">
                <div class="flex items-center gap-2">
                    <span class="staff-name font-bold text-sm text-slate-700 dark:text-gray-200 group-hover:text-cyan-700 transition">${u.username}</span>
                    <span class="text-[9px] font-bold ${badgeColor} px-1.5 py-0.5 rounded border border-black/5 shadow-sm">${displayDept}</span>
                </div>
                <input type="checkbox" class="newstaff-cb w-5 h-5 rounded text-cyan-600 focus:ring-cyan-500 cursor-pointer border-gray-300" value="${u.id}" ${isNewStaff ? 'checked' : ''}>
            </label>
        `;
    });
    html += '</div></div>';

    const { value: selectedIds } = await Swal.fire({
        title: 'ดึงรายชื่อพนักงานใหม่', html: html, showCancelButton: true, confirmButtonText: 'บันทึกรายชื่อ', confirmButtonColor: '#0891b2', cancelButtonText: 'ยกเลิก', width: '400px',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white' },
        preConfirm: () => {
            const checkboxes = document.querySelectorAll('.newstaff-cb:checked');
            const ids = []; checkboxes.forEach(cb => ids.push(String(cb.value))); return ids;
        }
    });

    if (selectedIds) {
        Swal.fire({title: 'กำลังย้ายข้อมูล...', didOpen: () => Swal.showLoading()});
        
        const selectedSet = new Set(selectedIds);
        const toAddIds = []; const toRemoveIds = []; let updateCount = 0;

        for (let i = 0; i < GLOBAL_USER_LIST.length; i++) {
            let u = GLOBAL_USER_LIST[i];
            const uidStr = String(u.id);
            const isSelected = selectedSet.has(uidStr);
            const isCurrentlyNew = u.department === 'NEW';

            if (isSelected) {
                GLOBAL_USER_LIST[i].department = 'NEW'; 
                if (!isCurrentlyNew) toAddIds.push(u.id);
                updateCount++;
            } else {
                if (isCurrentlyNew) {
                    GLOBAL_USER_LIST[i].department = 'AM'; 
                    toRemoveIds.push(u.id);
                }
            }
        }

        await new Promise(r => setTimeout(r, 50)); 
        window.renderLeaveTable(); 
        
        const promises = [];
        if (toAddIds.length > 0) promises.push(appDB.from('users').update({ department: 'NEW' }).in('id', toAddIds));
        if (toRemoveIds.length > 0) promises.push(appDB.from('users').update({ department: 'AM' }).in('id', toRemoveIds));
        await Promise.all(promises);

        Swal.fire({ icon: 'success', title: 'สำเร็จ', text: `อัปเดตรายชื่อพนักงานใหม่ ${updateCount} คน เรียบร้อยแล้ว`, timer: 2000, showConfirmButton: false });
    }
};

window.removeFromNewDept = async function(id, username) {
    Swal.fire({
        title: 'ยืนยันการนำออก?',
        text: `ต้องการย้าย ${username} กลับไปอยู่แผนก AM ใช่หรือไม่?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#0891b2',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'ใช่, ย้ายกลับเลย',
        cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({title: 'กำลังย้าย...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
            
            const userIndex = GLOBAL_USER_LIST.findIndex(u => String(u.id) === String(id));
            if (userIndex !== -1) GLOBAL_USER_LIST[userIndex].department = 'AM';
            
            const { error } = await appDB.from('users').update({ department: 'AM' }).eq('id', id);
            
            if (error) {
                Swal.fire('Error', error.message, 'error');
            } else {
                window.renderLeaveTable();
                Swal.fire({ icon: 'success', title: 'ย้ายสำเร็จ', timer: 1500, showConfirmButton: false });
            }
        }
    });
};

// ฟังก์ชันสำหรับบันทึกประวัติการจอง/ยกเลิกวันหยุด
window.logLeaveAction = async function(action, userId, username, dateStr) {
    try {
        if (typeof appDB !== 'undefined') {
            await appDB.from('leave_logs').insert({ 
                action_type: action, 
                user_id: userId, 
                username: username, 
                actor_name: (typeof currentUser !== 'undefined' && currentUser.username) ? currentUser.username : 'Unknown', 
                leave_date: dateStr, 
                department: (typeof currentViewDept !== 'undefined') ? currentViewDept : 'AM' 
            });
        }
    } catch (err) { 
        console.error("Log Error:", err); 
    }
};
