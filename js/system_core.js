let userCurrentPage = 1;
let userRowsPerPage = 5; // เปลี่ยนค่าเริ่มต้นเป็น 5 คน
let allowedViewMonth = ''; 
let allowedStartDay = 0;   
let allowedEndDay = 31;   

let SETTINGS = { 
    quota_total_เช้า: 50, quota_total_กลาง: 50, quota_total_ดึก: 50,
    open_time_เช้า: '00:00', close_time_เช้า: '23:59',
    open_time_กลาง: '00:00', close_time_กลาง: '23:59',
    open_time_ดึก: '00:00', close_time_ดึก: '23:59',
    daily_limit: 2,
    period_limit: 1
};
let SHIFT_GROUPS = {};
let currentSpecificTimeFilter = null; 
let globalScheduleData = [];
let pendingSchedules = []; 
let GLOBAL_INDIV_TASKS = [];
let ACTIVE_SHIFTS_CONFIG = ['กะเช้า', 'กะกลาง', 'กะดึก']; 

let GLOBAL_SHEETS = [];
const SHEET_BASE = "https://docs.google.com/spreadsheets/d"; 

async function fetchSheets() {
    const { data, error } = await appDB.from('external_sheets').select('*').order('group_name', {ascending: true});
    if(data) {
        GLOBAL_SHEETS = data;
        if(typeof renderSheetMenu === 'function') renderSheetMenu();
        if((currentUser.role === 'manager' || currentUser.role === 'admin') && typeof renderAdminSheetList === 'function') {
            renderAdminSheetList();
        }
    }
}

async function addSheet() {
    const name = document.getElementById('newSheetName').value.trim();
    const group = document.getElementById('newSheetGroup').value.trim() || 'ทั่วไป';
    const url = document.getElementById('newSheetUrl').value.trim();
    const color = document.getElementById('newSheetColor').value;
    
    if(!name || !url) return Swal.fire('ข้อมูลไม่ครบ', 'กรุณาใส่ชื่อและลิงก์', 'warning');
    
    let sheetId = url;
    let gid = null;

    const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if(idMatch) {
        sheetId = idMatch[1];
        const gidMatch = url.match(/[?&#]gid=([0-9]+)/); 
        if (gidMatch) {
            gid = gidMatch[1];
        }
    } 
    
    const { error } = await appDB.from('external_sheets').insert([{
        name: name,
        group_name: group,
        sheet_id: sheetId,
        gid: gid, 
        color: color
    }]);
    
    if(error) return Swal.fire('Error', error.message, 'error');
    
    document.getElementById('newSheetName').value = '';
    document.getElementById('newSheetUrl').value = '';
    
    await fetchSheets();
    renderAdminSheetList();
    Swal.fire('สำเร็จ', 'เพิ่มรายการเรียบร้อย', 'success');
}

async function deleteSheet(id) {
    Swal.fire({
        title: 'ลบตาราง?', text: "ไม่สามารถกู้คืนได้", icon: 'warning',
        showCancelButton: true, confirmButtonText: 'ลบ', confirmButtonColor: '#d33'
    }).then(async (result) => {
        if(result.isConfirmed) {
            await appDB.from('external_sheets').delete().eq('id', id);
            await fetchSheets();
            renderAdminSheetList();
        }
    });
}

let userSubscription = null;
function subscribeUserChanges() {
    if (userSubscription) appDB.removeChannel(userSubscription);
    
    userSubscription = appDB.channel('user-updates')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, (payload) => {
            const updatedUser = payload.new;
            const idx = GLOBAL_USER_LIST.findIndex(u => String(u.id) === String(updatedUser.id));
            if (idx !== -1) {
                GLOBAL_USER_LIST[idx] = updatedUser;
            }

            if (currentUser && String(currentUser.id) === String(updatedUser.id)) {
                let isChanged = false;
                let msg = '';

                if (currentUser.allowed_shift !== updatedUser.allowed_shift) {
                    currentUser.allowed_shift = updatedUser.allowed_shift;
                    msg = `แอดมินเปลี่ยนกะของคุณเป็น "${updatedUser.allowed_shift}"`;
                    if (typeof renderShiftButtons === 'function') {
                        renderShiftButtons(currentUser.allowed_shift);
                    }
                    isChanged = true;
                }

                if (currentUser.team !== updatedUser.team) {
                    currentUser.team = updatedUser.team;
                    msg = `แอดมินเปลี่ยนทีมของคุณเป็น "${updatedUser.team || 'ไม่มีทีม'}"`;
                    const dailyTeamSelect = document.getElementById('dailyTeam');
                    if (dailyTeamSelect) {
                        dailyTeamSelect.value = updatedUser.team || TEAM_LIST[0] || '';
                        if (typeof handleTeamChange === 'function') handleTeamChange();
                    }
                    isChanged = true;
                }

                if (isChanged) {
                    sessionStorage.setItem('user_platinum_plus', JSON.stringify(currentUser));
                    const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 5000 });
                    Toast.fire({ icon: 'info', title: msg });
                    if (typeof fetchData === 'function') fetchData();
                }
            }
        })
        .subscribe();
}

function handleDateChange() { document.getElementById('displayDate').innerText = new Date(document.getElementById('wDate').value).toLocaleDateString('th-TH'); refreshTimeSlots(); fetchData(); }
function handleTeamChange() { const team = document.getElementById('dailyTeam').value; const isRemember = document.getElementById('rememberTeam').checked; if (isRemember) localStorage.setItem(`last_team_${currentUser.username}`, team); refreshTimeSlots(); fetchData(); }
function toggleRememberTeam() { const isRemember = document.getElementById('rememberTeam').checked; if (isRemember) { const team = document.getElementById('dailyTeam').value; localStorage.setItem(`last_team_${currentUser.username}`, team); } else { localStorage.removeItem(`last_team_${currentUser.username}`); } }
function getPeriodForTime(shift, time) { const groups = SHIFT_GROUPS[shift]; if(!groups) return null; for(const [p, ts] of Object.entries(groups)) { if(ts.includes(time)) return p; } return null; }

function checkBookingTime(shiftName) {
    if(['manager', 'admin'].includes(currentUser.role)) return { allowed: true };
    
    const suffix = shiftName.replace('กะ', '');
    const openStr = SETTINGS[`open_time_${suffix}`];
    const closeStr = SETTINGS[`close_time_${suffix}`];
    
    if (!openStr || !closeStr) return { allowed: true };

    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();

    const [oH, oM] = openStr.split(':').map(Number);
    const [cH, cM] = closeStr.split(':').map(Number);
    const openMins = oH * 60 + oM;
    const closeMins = cH * 60 + cM;

    let isOpen = false;
    if (closeMins > openMins) {
        isOpen = (nowMins >= openMins && nowMins <= closeMins);
    } else {
        isOpen = (nowMins >= openMins || nowMins <= closeMins);
    }

    if (!isOpen) return { allowed: false, msg: `ขณะนี้อยู่นอกเวลาทำการของ ${shiftName} (${openStr} - ${closeStr})` };
    return { allowed: true };
}

window.saveData = async function(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSave'); 
    btn.disabled = true; 
    btn.innerHTML = '<span class="animate-spin material-icons">sync</span> กำลังบันทึก...';
    
    const shiftEl = document.querySelector('input[name="shift"]:checked');
    if(!shiftEl) { window.resetBtn(); return Swal.fire('เตือน', 'กรุณาเลือกกะ', 'warning'); }

    const sName = shiftEl.value;
    const timeCheck = window.checkBookingTime ? window.checkBookingTime(sName) : {allowed: true};
    if (!timeCheck.allowed) { window.resetBtn(); return Swal.fire('ปิดจอง', timeCheck.msg, 'error'); }

    const select = document.getElementById('tSlot');
    const dateVal = document.getElementById('wDate').value;
    const timeVal = select.value;
    
    // 🌟 --- โค้ดดักลงเวลาล่วงหน้า (ล็อกไม่ให้จองข้ามวัน) --- 🌟
    const todayObj = new Date();
    const currentHour = todayObj.getHours(); 
    
    const realTodayStr = new Date(todayObj.getTime() - (todayObj.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    const yesterdayObj = new Date(todayObj);
    yesterdayObj.setDate(yesterdayObj.getDate() - 1);
    const realYesterdayStr = new Date(yesterdayObj.getTime() - (yesterdayObj.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    let isAllowedDate = (dateVal === realTodayStr);
    
    // อนุโลมให้กะดึกลงเวลาของเมื่อวานได้ถึง 07:59 น.
    if (currentHour >= 0 && currentHour < 8) {
        if (dateVal === realYesterdayStr) {
            isAllowedDate = true;
        }
    }

    // 🛑 ตรวจสอบสิทธิ์: ถ้าไม่ใช่แอดมิน และเลือกวันที่ไม่ใช่วันนี้ บล็อกทันที!
    if (!['manager', 'admin'].includes(currentUser.role) && !isAllowedDate) {
        window.resetBtn();
        return Swal.fire('ไม่อนุญาต', 'ลงเวลาได้เฉพาะของ "วันนี้" เท่านั้น<br><span class="text-xs text-gray-500">(เลือกตามวันที่ตัวเองทำงานเท่านั้นนะจ๊ะ)</span>', 'error');
    }
    // 🌟 --------------------------------------------------- 🌟

    let activeTeam = TEAM_LIST[0];
    const dt = document.getElementById('dailyTeam');
    if(dt && dt.value) activeTeam = dt.value; else if(currentUser.team) activeTeam = currentUser.team;

    const myDep = currentUser.department || 'AM';

    const { data: myBookings } = await appDB.from('schedules').select('*').eq('work_date', dateVal).eq('staff_name', currentUser.username);
    const dailyLimit = parseInt(SETTINGS.daily_limit || 2);
    if (myBookings.length >= dailyLimit) { window.resetBtn(); return Swal.fire('ครบโควตา', `คุณลงครบ ${dailyLimit} รอบต่อวันแล้ว`, 'error'); }

    const targetPeriod = select.options[select.selectedIndex].dataset.period;
    const periodLimit = parseInt(SETTINGS.period_limit || 1);
    
    const checkPeriod = typeof getPeriodForTime === 'function' ? getPeriodForTime : () => targetPeriod; 
    const countInPeriod = myBookings.filter(b => b.shift_name === sName && checkPeriod(sName, b.time_slot) === targetPeriod).length;
    if (countInPeriod >= periodLimit) { window.resetBtn(); return Swal.fire('ซ้ำ!', `คุณลงช่วง "${targetPeriod}" ครบ ${periodLimit} ครั้งแล้ว`, 'error'); }

    const shiftSuffix = sName.replace('กะ','');
    const { data: slotBookings } = await appDB.from('schedules').select('*').eq('work_date', dateVal).eq('shift_name', sName).eq('time_slot', timeVal);
    
    let limitTotal = 0;
    if (myDep === 'OD') {
        limitTotal = parseInt(SETTINGS[`quota_od_${shiftSuffix}`] || 5);
    } else {
        limitTotal = parseInt(SETTINGS[`quota_total_${shiftSuffix}`] || SETTINGS[`quota_total_${sName}`] || 50);
    }
    
    let limitTeam = 5;
    if (SETTINGS[`quota_team_${activeTeam}_${myDep}_${shiftSuffix}`] !== undefined) {
        limitTeam = parseInt(SETTINGS[`quota_team_${activeTeam}_${myDep}_${shiftSuffix}`]);
    } else if (SETTINGS[`quota_team_${activeTeam}_${shiftSuffix}`] !== undefined) {
        limitTeam = parseInt(SETTINGS[`quota_team_${activeTeam}_${shiftSuffix}`]);
    }

    const useTeamLogic = (currentUser.check_type !== 'shift');
    const countTotal = slotBookings.filter(b => (b.department || 'AM') === myDep).length;
    const countTeam = slotBookings.filter(b => b.team === activeTeam && (b.department || 'AM') === myDep).length;

    if (countTotal >= limitTotal) { window.resetBtn(); return Swal.fire('เต็มแล้ว', `โควตาแผนก ${myDep} เต็มแล้ว`, 'error'); }
    if (useTeamLogic && countTeam >= limitTeam) { window.resetBtn(); return Swal.fire('เต็มแล้ว', `โควตาทีม ${activeTeam} (${shiftSuffix}) เต็มแล้ว`, 'error'); }

    const { error } = await appDB.from('schedules').insert([{ 
        work_date: dateVal, 
        staff_name: currentUser.username, 
        team: activeTeam, 
        shift_name: sName, 
        time_slot: timeVal,
        department: myDep 
    }]);
    
    if (error) { window.resetBtn(); Swal.fire('Error', error.message, 'error'); } 
    else { 
        if(typeof logAction === 'function') await logAction('ลงเวลา', `ลงเวลา ${sName} ${timeVal} (${activeTeam}) [${myDep}]`);
        Swal.fire({icon:'success', title:'บันทึกสำเร็จ', timer:800, showConfirmButton:false}); 
        if(typeof refreshTimeSlots === 'function') await refreshTimeSlots(); 
        window.resetBtn();
    }
};

window.resetBtn = function() { 
    const btn = document.getElementById('btnSave'); 
    if(btn) {
        btn.disabled = false; 
        btn.innerHTML = '<span class="material-icons">save</span> บันทึกข้อมูล'; 
    }
};

async function manualRefresh() { await fetchData(); const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1500, timerProgressBar: true }); Toast.fire({ icon: 'success', title: 'อัปเดตข้อมูลแล้ว' }); }

// 🌟 เพิ่มระบบหน่วงเวลาการค้นหาหน้า Dashboard (วางเพิ่มไว้ด้านบน)
let dashboardSearchTimer;

window.debounceDashboardSearch = function() {
    clearTimeout(dashboardSearchTimer);
    dashboardSearchTimer = setTimeout(() => {
        // ใช้ข้อมูลที่ดึงมาแล้ว (globalScheduleData) มากรองแทนการยิง DB ใหม่
        if (typeof renderTableRows === 'function' && globalScheduleData) {
            renderTableRows(globalScheduleData);
        }
    }, 300);
};

function filterTableBySpecificTime(time, shiftName) { 
    currentSpecificTimeFilter = { time: time, shift: shiftName }; 
    document.getElementById('clearFilterBtn').classList.remove('hidden'); 
    renderTableRows(globalScheduleData); 
}

function clearSpecificTimeFilter() { 
    currentSpecificTimeFilter = null; 
    document.getElementById('clearFilterBtn').classList.add('hidden'); 
    renderTableRows(globalScheduleData); 
}

async function fetchData() {
    const dateEl = document.getElementById('wDate');
    const teamEl = document.getElementById('tableTeamFilter');
    
    // 🌟 ดัก Error: ถ้าไม่ได้อยู่หน้า Dashboard และไม่มีช่องให้ดึงค่า ให้หยุดการทำงานเลย
    if (!dateEl || !teamEl) return;

    const dateVal = dateEl.value;
    const tableTeam = teamEl.value;
    if(!dateVal) return;

    updateTableSummary([]); 
    const tBody = document.getElementById('dataTableBody');
    if(tBody) tBody.innerHTML = `<tr><td colspan="6" class="text-center py-10 text-gray-400"><span class="animate-spin material-icons text-3xl text-blue-500 mb-2">sync</span><br><b>กำลังดึงข้อมูล...</b></td></tr>`;

    let query = appDB.from('schedules').select('id, work_date, staff_name, team, shift_name, time_slot, department').eq('work_date', dateVal);
    if (tableTeam !== 'all') { query = query.eq('team', tableTeam); } 
    if (!['manager', 'admin'].includes(currentUser.role)) { 
        if (['กะเช้า', 'กะกลาง', 'กะดึก'].includes(currentUser.allowed_shift)) { query = query.eq('shift_name', currentUser.allowed_shift); } 
    }

   const { data } = await query;
    if (data) {
        data.sort((a, b) => {
            const pA = getPeriodForTime(a.shift_name, a.time_slot); const pB = getPeriodForTime(b.shift_name, b.time_slot);
            const pOrder = {'ช่วงที่ 1': 1, 'ช่วงที่ 2': 2, 'ช่วงที่ 3': 3};
            if (pOrder[pA] !== pOrder[pB]) return pOrder[pA] - pOrder[pB];
            return a.time_slot.localeCompare(b.time_slot);
        });
        globalScheduleData = data; 
        
        // 🌟 เพิ่มระบบดึงค่าตัวกรองและส่งข้อมูลไปสรุปยอด
        const deptFilterForSummary = document.getElementById('summaryDeptFilter') ? document.getElementById('summaryDeptFilter').value : 'all';
        let dataForSummary = data;
        if (deptFilterForSummary !== 'all') {
            dataForSummary = data.filter(i => (i.department || 'AM') === deptFilterForSummary);
        }
        
        updateTableSummary(dataForSummary); 
        renderTableRows(data);
    }
}

function renderTableRows(data) {
    const periodEl = document.getElementById('periodFilter');
    const filterVal = periodEl ? periodEl.value : 'all';

    const searchEl = document.getElementById('tableSearch');
    const searchName = searchEl ? searchEl.value.toLowerCase() : '';

    const deptFilterEl = document.getElementById('tableDeptFilter');
    const deptFilterVal = deptFilterEl ? deptFilterEl.value : 'all';

    // ---- ให้เพิ่ม 2 บรรทัดนี้ต่อท้ายลงไป ----
    const shiftFilterEl = document.getElementById('tableShiftFilter');
    const shiftFilterVal = shiftFilterEl ? shiftFilterEl.value : 'all';
    const box = document.getElementById('dataTableBody'); 
    
    // 🌟 แก้ไขจุดที่ 1: ดัก Error ไว้ตรงนี้ ถ้าหาตารางไม่เจอ ให้หยุดทำงานไปเลย
    if (!box) return; 

    box.innerHTML = '';
    let filteredData = data;
    
    // กรองช่วงเวลา
    if (filterVal !== 'all') filteredData = filteredData.filter(item => getPeriodForTime(item.shift_name, item.time_slot) === filterVal);
    
    // กรองชื่อ
    if (searchName) filteredData = filteredData.filter(i => i.staff_name.toLowerCase().includes(searchName));
    
    // กรองแผนก
    if (deptFilterVal !== 'all') {
        filteredData = filteredData.filter(i => (i.department || 'AM') === deptFilterVal);
    }
    
    // 🌟 กรองกะ (ที่เพิ่มเข้ามาใหม่)
    if (typeof shiftFilterVal !== 'undefined' && shiftFilterVal !== 'all') {
        filteredData = filteredData.filter(i => i.shift_name === shiftFilterVal);
    }
    
    // กรองปุ่มเวลาย่อย
    if (currentSpecificTimeFilter) {
        filteredData = filteredData.filter(i => 
            i.time_slot === currentSpecificTimeFilter.time && 
            i.shift_name === currentSpecificTimeFilter.shift
        );
    }

    if(filteredData.length === 0) { box.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-gray-400">ไม่พบข้อมูล</td></tr>`; return; }
    
    let htmlContent = ''; 

    filteredData.forEach(i => {
        const periodName = getPeriodForTime(i.shift_name, i.time_slot);
        
        let displayPeriod = periodName || '<span class="material-icons text-[12px] animate-spin">sync</span>';
        let pClass = 'text-gray-500 border-transparent'; 
        
        if (periodName === 'ช่วงที่ 1') pClass = 'text-green-600 dark:text-green-400 border-current'; 
        else if (periodName === 'ช่วงที่ 2') pClass = 'text-orange-500 dark:text-orange-400 border-current'; 
        else if (periodName === 'ช่วงที่ 3') pClass = 'text-purple-600 dark:text-purple-400 border-current';
        else if (!periodName) pClass = 'text-gray-400 border-gray-400/50 border-dashed bg-gray-100 dark:bg-slate-800';
        
        const canDelete = ['manager', 'admin'].includes(currentUser.role) || i.staff_name === currentUser.username;
        let delBtn = canDelete ? `<button onclick="delSch(${i.id}, '${i.shift_name}')" class="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-2 rounded-lg bg-red-50 dark:bg-red-900/30 transition"><span class="material-icons text-lg">delete</span></button>` : '';
        
        const deptColor = (i.department === 'OD') ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700';

        htmlContent += `<tr class="border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50">
            <td class="px-6 py-4 w-32 text-center"><div class="flex justify-center"><span class="${pClass} font-extrabold text-sm border px-2 py-0.5 rounded-full whitespace-nowrap flex items-center justify-center min-w-[60px] min-h-[28px]">${displayPeriod}</span></div></td>
            <td class="px-6 py-4 font-bold text-slate-700 dark:text-gray-200">${i.staff_name}</td>
            <td class="px-6 py-4 flex items-center gap-1">
                <span class="px-2 py-1 rounded bg-indigo-100 text-indigo-800 text-xs font-bold">${i.team || '-'}</span>
                <span class="text-[9px] font-bold px-1.5 py-0.5 rounded ${deptColor}">${i.department || 'AM'}</span>
            </td>
            <td class="px-6 py-4"><span class="px-3 py-1 rounded-full text-xs font-bold bg-gray-200 text-slate-700 dark:bg-slate-600 dark:text-white">${i.shift_name}</span></td>
            <td class="px-6 py-4 font-mono text-base text-slate-700 dark:text-gray-300">${i.time_slot}</td>
            <td class="px-6 py-4 text-center">${delBtn}</td>
        </tr>`;
    });
    
    // 🌟 แก้ไขจุดที่ 2: เช็คอีกรอบให้ชัวร์ก่อนสั่งยัดข้อมูล
    if (box) box.innerHTML = htmlContent;
}

function updateTableSummary(data) {
    const container = document.getElementById('tableSummary'); 
    if(!container) return;
    container.innerHTML = '';
    const counts = {}; 
    
    data.forEach(item => { 
        const key = `${item.shift_name}|${item.time_slot}`; 
        counts[key] = (counts[key] || 0) + 1; 
    });
    
    let shiftsToShow = ACTIVE_SHIFTS_CONFIG;
    if (!['manager', 'admin'].includes(currentUser.role)) { 
        if (shiftsToShow.includes(currentUser.allowed_shift)) { 
            shiftsToShow = [currentUser.allowed_shift]; 
        } 
    }

    const pColors = { 'ช่วงที่ 1': 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700', 'ช่วงที่ 2': 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-700', 'ช่วงที่ 3': 'bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700' };
    const pTextColors = { 'ช่วงที่ 1': 'text-green-700 dark:text-green-300', 'ช่วงที่ 2': 'text-orange-700 dark:text-orange-300', 'ช่วงที่ 3': 'text-purple-700 dark:text-purple-300' };
    
    let html = '<div class="flex flex-col gap-6 w-full">';
    
    shiftsToShow.forEach(shift => {
        if (!SHIFT_GROUPS[shift]) return; 
        
        const shiftSpecificData = data.filter(d => d.shift_name === shift);
        const uniquePeople = new Set(shiftSpecificData.map(item => item.staff_name));
        const shiftTotal = uniquePeople.size;

        html += `<div class="bg-white/50 dark:bg-slate-700/50 rounded-lg p-3 border border-slate-200 dark:border-slate-600">
            <div class="font-bold text-sm text-blue-600 dark:text-blue-300 mb-3 border-b border-slate-300 dark:border-slate-500 pb-1 flex justify-between items-center">
                <span>${shift}</span>
                <span class="bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full text-xs border border-blue-200 dark:border-blue-800 shadow-sm text-slate-600 dark:text-slate-300">
                    รวม <span class="text-blue-600 dark:text-blue-400 font-extrabold text-sm">${shiftTotal}</span> คน
                </span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">`;
            
        for (const [periodName, timeSlots] of Object.entries(SHIFT_GROUPS[shift])) {
            const colClass = pColors[periodName] || 'bg-gray-50 dark:bg-gray-800'; 
            const textClass = pTextColors[periodName] || 'text-gray-500';
            html += `<div class="flex flex-col gap-2 p-2 rounded border ${colClass}"><span class="text-[11px] font-extrabold uppercase text-center ${textClass} mb-1">${periodName}</span>`;
            timeSlots.forEach(t => {
                const count = counts[`${shift}|${t}`] || 0; 
                const isActive = currentSpecificTimeFilter && currentSpecificTimeFilter.time === t && currentSpecificTimeFilter.shift === shift;
                const btnClass = count === 0 ? 'btn-slot-empty' : (isActive ? 'btn-slot-active' : 'btn-slot-filled');
                html += `<button onclick="filterTableBySpecificTime('${t}', '${shift}')" class="text-[12px] px-3 py-1.5 rounded border transition flex justify-between items-center shadow-sm w-full group ${btnClass}"><span class="font-mono">${t}</span><span class="font-bold text-[11px]">${count}</span></button>`;
            }); 
            html += `</div>`;
        } 
        html += `</div></div>`;
    }); 
    html += '</div>'; 
    container.innerHTML = html;
}

async function delSch(id, shiftName) { 
    const timeCheck = checkBookingTime(shiftName);
    if (!timeCheck.allowed) { return Swal.fire('ลบไม่ได้', timeCheck.msg, 'error'); }

    const { data: item } = await appDB.from('schedules').select('*').eq('id', id).single();
    Swal.fire({ title: 'ยืนยันการลบ?', text: "ต้องการลบรายการนี้ใช่ไหม", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'ลบเลย!', cancelButtonText: 'ยกเลิก' }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({title: 'กำลังลบ...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
            const { error } = await appDB.from('schedules').delete().eq('id', id); 
            if(error) { Swal.fire('Error', error.message, 'error'); return; }
            if(item) await logAction('ลบรายการ', `ลบรายการของ ${item.staff_name} (${item.shift_name} ${item.time_slot})`);
            Swal.fire('ลบสำเร็จ!', '', 'success'); await refreshTimeSlots(); await fetchData(); 
        }
    })
}

async function logAction(action, detail) { await appDB.from('system_logs').insert([{ action_type: action, performed_by: currentUser.username, target_details: detail }]); }

async function fetchLogs() {
    const dateVal = document.getElementById('logDate') ? document.getElementById('logDate').value : ''; 
    const actionVal = document.getElementById('logAction') ? document.getElementById('logAction').value : ''; 
    const userVal = document.getElementById('logUser') ? document.getElementById('logUser').value.toLowerCase() : '';
    
    let query = appDB.from('system_logs').select('*').order('log_date', {ascending: false});
    
    if(dateVal) {
        query = query.gte('log_date', dateVal + 'T00:00:00').lte('log_date', dateVal + 'T23:59:59');
    } else {
        query = query.limit(100); 
    }

    if(actionVal) query = query.eq('action_type', actionVal);
    
    const { data } = await query;
    const box = document.getElementById('logTableBody'); 
    if(!box) return;
    box.innerHTML = '';
    
    if(data) {
        const filtered = data.filter(log => { 
            return (!userVal || log.performed_by.toLowerCase().includes(userVal)); 
        });
        
        if(filtered.length === 0) { box.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-gray-400">ไม่พบประวัติ</td></tr>`; return; }
        
        let logsHtml = ''; // 🌟 [ปรับใหม่]
        
        filtered.forEach(log => {
            const time = new Date(log.log_date).toLocaleString('th-TH'); const badgeColor = log.action_type === 'ลงเวลา' ? 'bg-green-100 text-green-800' : (log.action_type === 'ลบรายการ' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800');
            // 🌟 [ปรับใหม่]
            logsHtml += `<tr class="border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800"><td class="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">${time}</td><td class="px-4 py-2 font-bold">${log.performed_by}</td><td class="px-4 py-2"><span class="px-2 py-1 rounded text-xs font-bold ${badgeColor}">${log.action_type}</span></td><td class="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">${log.target_details}</td></tr>`;
        });
        
        // 🌟 [ปรับใหม่]
        box.innerHTML = logsHtml;
    }
}

async function refreshAdminData() {
    const btn = document.querySelector('button[onclick="refreshAdminData()"] span'); 
    if(btn) btn.classList.add('animate-spin');
    await fetchUsers(); await fetchTasks(); await fetchIndividualTasks(); await loadSettings(); 
    if(typeof renderQuotaSettings === 'function') renderQuotaSettings(); 
    if(typeof populateTeamSelects === 'function') populateTeamSelects(); 
    if(typeof renderOperatingHours === 'function') renderOperatingHours();
    setTimeout(() => { if(btn) btn.classList.remove('animate-spin'); }, 800);
    //const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1000 }); Toast.fire({ icon: 'success', title: 'รีเฟรชข้อมูลแล้ว' });
}

window.updateUserRole = async function(selectEl, id, newRole) {
    const user = GLOBAL_USER_LIST.find(u => String(u.id) === String(id));
    if(user) user.role = newRole;

    selectEl.classList.remove('text-gray-400', 'text-red-400', 'text-fuchsia-400');
    if (newRole === 'manager' || newRole === 'admin') selectEl.classList.add('text-red-400');
    else if (newRole !== 'staff') selectEl.classList.add('text-fuchsia-400');
    else selectEl.classList.add('text-gray-400');

    appDB.from('users').update({ role: newRole }).eq('id', id).then(({error}) => {
        if (error) Swal.fire('เกิดข้อผิดพลาด', error.message, 'error');
    });
    
    const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1000 });
    Toast.fire({ icon: 'success', title: `เปลี่ยนสิทธิ์เป็น ${newRole}` });
}
        
window.updateCheckType = async function(btn, id, currentType) { 
    const newType = currentType === 'shift' ? 'team' : 'shift';
    
    const { error } = await appDB.from('users').update({ check_type: newType }).eq('id', id);

    if (error) {
        return Swal.fire('เกิดข้อผิดพลาด', error.message, 'error');
    }

    btn.innerText = newType === 'shift' ? 'เน้นกะ' : 'เน้นทีม';
    btn.className = `text-[10px] px-2 py-1 rounded-md font-bold hover:opacity-80 border shadow-inner transition ${newType === 'shift' ? 'bg-fuchsia-900/40 text-fuchsia-400 border-fuchsia-800/50' : 'bg-emerald-900/40 text-emerald-400 border-emerald-800/50'}`;
    btn.setAttribute('onclick', `updateCheckType(this, ${id}, '${newType}')`);

    const user = GLOBAL_USER_LIST.find(u => u.id === id);
    if(user) user.check_type = newType;

    const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1000 });
    Toast.fire({ icon: 'success', title: `เปลี่ยนเป็น${newType === 'shift' ? 'เน้นกะ' : 'เน้นทีม'}แล้ว` });
}

window.updateUserTeam = async function(id, currentTeam) {
    let options = {}; TEAM_LIST.forEach(t => options[t] = t); options[''] = 'อิสระ (ไม่สังกัดทีม)';
    const { value: team } = await Swal.fire({ 
        title: 'เปลี่ยนทีมสังกัด', 
        input: 'select', 
        inputOptions: options, 
        inputValue: currentTeam || '', 
        showCancelButton: true, 
        confirmButtonText: 'บันทึก', 
        cancelButtonText: 'ยกเลิก',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white' }
    });
    
    if (team !== undefined) { 
        Swal.fire({title: 'กำลังย้ายทีม...', didOpen: () => Swal.showLoading()});
        await appDB.from('users').update({ team: team || null }).eq('id', id); 
        fetchUsers(); 
        const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1000 }); 
        Toast.fire({ icon: 'success', title: 'เปลี่ยนทีมเรียบร้อย' }); 
    }
}

window.updateUserShift = async function(selectEl, id, newShift) {
    selectEl.classList.remove('text-orange-400', 'text-blue-400', 'text-purple-400', 'text-gray-400');
    if(newShift === 'กะเช้า') selectEl.classList.add('text-orange-400');
    else if(newShift === 'กะกลาง') selectEl.classList.add('text-blue-400');
    else if(newShift === 'กะดึก') selectEl.classList.add('text-purple-400');
    else selectEl.classList.add('text-gray-400');

    const user = GLOBAL_USER_LIST.find(u => String(u.id) === String(id));
    if(user) user.allowed_shift = newShift;
    if(typeof fastRecalculateStats === 'function') fastRecalculateStats();

    if (currentUser && String(currentUser.id) === String(id)) {
        currentUser.allowed_shift = newShift;
        sessionStorage.setItem('user_platinum_plus', JSON.stringify(currentUser)); 
        
        if (typeof renderShiftButtons === 'function') {
            renderShiftButtons(newShift);
        }
        if (typeof fetchData === 'function') {
            fetchData();
        }
    }

    const { error } = await appDB.from('users').update({ allowed_shift: newShift }).eq('id', id);

    if (error) {
        console.error("Shift Update Error:", error);
        return Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกกะลงฐานข้อมูลได้', 'error');
    }
    
    const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1000 });
    Toast.fire({ icon: 'success', title: 'อัปเดตกะเรียบร้อย' });
};

function toggleSelectAll(source) { 
    document.querySelectorAll('.user-check').forEach(cb => cb.checked = source.checked); 
}
        
async function moveSelectedUsers() {
    const target = document.getElementById('moveTargetShift').value; 
    if(!target) return Swal.fire('!', 'เลือกกะปลายทางก่อน', 'warning');
    
    const ids = Array.from(document.querySelectorAll('.user-check:checked')).map(cb => cb.value); 
    if(ids.length === 0) return Swal.fire('!', 'เลือกพนักงานก่อน', 'warning');
    
    Swal.fire({
        title: 'ยืนยันการย้ายกะ?',
        text: `ต้องการย้าย ${ids.length} คน ไปยัง "${target}" ใช่หรือไม่?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3b82f6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'ยืนยัน ย้ายเลย!',
        cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({title: 'กำลังดำเนินการ...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
            await appDB.from('users').update({ allowed_shift: target }).in('id', ids);
            await logAction('ย้ายกะ', `ย้าย ${ids.length} คน ไป ${target}`);
            fetchUsers(); 
            Swal.fire({ title: 'สำเร็จ!', text: 'ย้ายกะพนักงานเรียบร้อยแล้ว', icon: 'success', confirmButtonText: 'ตกลง' });
        }
    });
}

async function moveSelectedUsersTeam() {
    const target = document.getElementById('moveTargetTeam').value; if(!target) return Swal.fire('!', 'เลือกทีมปลายทางก่อน', 'warning');
    const ids = Array.from(document.querySelectorAll('.user-check:checked')).map(cb => cb.value); if(ids.length === 0) return Swal.fire('!', 'เลือกพนักงานก่อน', 'warning');
    
    Swal.fire({
        title: 'ยืนยันการย้ายทีม?',
        text: `ต้องการย้าย ${ids.length} คน ไปยังทีม "${target}" ใช่หรือไม่?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#0d9488',
        cancelButtonColor: '#d33',
        confirmButtonText: 'ยืนยัน ย้ายเลย!',
        cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({title: 'กำลังดำเนินการ...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
            await appDB.from('users').update({ team: target }).in('id', ids);
            await logAction('ย้ายทีม', `ย้าย ${ids.length} คน ไปทีม ${target}`);
            fetchUsers(); 
            Swal.fire({ title: 'สำเร็จ!', text: 'ย้ายทีมพนักงานเรียบร้อยแล้ว', icon: 'success', confirmButtonText: 'ตกลง' });
        }
    });
}

async function deleteSelectedUsers() {
    const ids = Array.from(document.querySelectorAll('.user-check:checked')).map(cb => cb.value); 
    if(ids.length === 0) return Swal.fire('!', 'เลือกรายชื่อก่อน', 'warning');
    
    Swal.fire({
        title: 'ยืนยันการลบ?',
        text: `คุณต้องการลบ ${ids.length} รายชื่อที่เลือกใช่หรือไม่?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'ลบเลย',
        cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({title: 'กำลังลบ...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
            await appDB.from('users').delete().in('id', ids);
            await logAction('ลบพนักงาน', `ลบพนักงาน ${ids.length} คน`);
            fetchUsers(); 
            Swal.fire('ลบสำเร็จ', 'ลบรายชื่อเรียบร้อยแล้ว', 'success');
        }
    });
}

window.searchEmployee = function() {
    userCurrentPage = 1; 
    window.renderUserTableDirectly();
};

async function addScheduledTask() { 
    const f=document.getElementById('schFrom').value, t=document.getElementById('schTo').value, d=document.getElementById('schDate').value; 
    if(!d) return Swal.fire('!', 'กรุณาระบุวันเวลา', 'warning');
    await appDB.from('scheduled_tasks').insert([{task_type:'move_shift', payload:{from:f, to:t}, scheduled_for:new Date(d).toISOString()}]); 
    Swal.fire('OK','ตั้งเวลาย้ายกะแล้ว','success'); fetchTasks(); 
}

async function moveNowInstant() {
    const f=document.getElementById('schFrom').value, t=document.getElementById('schTo').value; if(f===t) return Swal.fire('!', 'กะต้นทางและปลายทางเหมือนกัน', 'warning');
    Swal.fire({ title: `ย้ายทันที?`, text: `ย้ายทุกคนจาก "${f}" ไป "${t}" เดี๋ยวนี้เลยไหม?`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'ย้ายเลย!', cancelButtonText: 'ยกเลิก' }).then(async (result) => {
        if(result.isConfirmed) {
            Swal.fire({title: 'กำลังประมวลผล...', didOpen: () => Swal.showLoading()});
            await appDB.from('users').update({allowed_shift: t}).eq('allowed_shift', f);
            await logAction('ย้ายกะด่วน', `ย้ายทุกคนจาก ${f} ไป ${t} (Manual)`);
            fetchUsers(); Swal.fire('สำเร็จ', `ย้ายเรียบร้อยแล้ว`, 'success');
        }
    });
}

// =========================================================
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

async function deleteTask(id) { 
    Swal.fire({
        title: 'ยืนยันลบ?', text: "ต้องการลบรายการนี้ออกจากประวัติใช่หรือไม่", icon: 'warning',
        showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'ใช่, ลบเลย!', cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
        if (result.isConfirmed) {
            const { error } = await appDB.from('scheduled_tasks').delete().eq('id', id); 
            if(error) {
                Swal.fire('Error', error.message, 'error');
            } else {
                if(typeof fetchTasks === 'function') fetchTasks(); 
                if(typeof fetchIndividualTasks === 'function') fetchIndividualTasks(); 
                Swal.fire('ลบสำเร็จ!', 'รายการถูกลบเรียบร้อยแล้ว', 'success');
            }
        }
    });
}

async function fetchTasks() { 
    const {data}=await appDB.from('scheduled_tasks').select('*').neq('task_type', 'individual_shift_update').order('created_at',{ascending:false}).limit(5); 
    const taskLog = document.getElementById('taskLog');
    if(taskLog) {
        taskLog.innerHTML=data.map(t=>`<div class="flex justify-between border-b border-gray-700 py-1"><span>${new Date(t.scheduled_for).toLocaleString('th-TH')} ${t.payload.from}->${t.payload.to}</span><span onclick="deleteTask(${t.id})" class="text-red-400 cursor-pointer material-icons text-xs">delete</span></div>`).join(''); 
    }
}

window.processPendingTasks = async function() { 
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
                await appDB.from('scheduled_tasks').update({status:'completed'}).in('id', completedTaskIds);
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
    Swal.fire({
        title: `ลบกะ "${suffix}"?`,
        text: "การลบนี้จะทำให้การเช็คเวลาสำหรับกะนี้หายไป (แต่ไม่ลบข้อมูลในตาราง)",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'ลบ'
    }).then(async (result) => {
        if (result.isConfirmed) {
              await appDB.from('settings').delete().like('key', `%_${suffix}`);
              delete SETTINGS[`open_time_${suffix}`];
              delete SETTINGS[`close_time_${suffix}`];
              if(typeof loadSettings === 'function') await loadSettings();
              renderOperatingHours();
        }
    });
}

async function saveTimeSettings() { 
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

async function saveDailyLimit() { 
    const dailyVal = document.getElementById('dailyLimitInput').value; 
    const periodVal = document.getElementById('periodLimitInput').value; 
    await appDB.from('settings').upsert([{ key: 'daily_limit', value: dailyVal }, { key: 'period_limit', value: periodVal }]); 
    SETTINGS.daily_limit = parseInt(dailyVal); SETTINGS.period_limit = parseInt(periodVal); 
    
    if(document.getElementById('limitDisplay')) document.getElementById('limitDisplay').innerText = dailyVal; 
    if(document.getElementById('periodLimitDisplay')) document.getElementById('periodLimitDisplay').innerText = periodVal;
    
    Swal.fire('Saved', '', 'success'); 
}

async function addUsersBulk() {
    const text = document.getElementById('newUsersArea').value.trim(); 
    const s = document.getElementById('newAllowedShift').value; 
    const tm = document.getElementById('newTeam').value; 
    const cType = document.getElementById('newCheckType').value; 
    const dept = document.getElementById('newDept').value; 
    
    if(!text) return;
    
    const names = text.split('\n').map(n => n.trim()).filter(n => n);
    
    Swal.fire({title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading()});
    
    const { error } = await appDB.from('users').insert(names.map(n => ({ 
        username: n, 
        allowed_shift: s, 
        team: tm || null, 
        role: 'staff', 
        check_type: cType,
        department: dept 
    })));
    
    if(!error) { 
        document.getElementById('newUsersArea').value=''; 
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
                    <span class="font-bold text-slate-700">${u.username}</span>
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
    if (!forceRefresh && window.GLOBAL_USER_LIST && window.GLOBAL_USER_LIST.length > 0) {
        if(typeof populateIndivUserSelect === 'function') populateIndivUserSelect();
        if(typeof fastRecalculateStats === 'function') fastRecalculateStats();
        return;
    }

    if (isFetchingUsers) return;
    isFetchingUsers = true;

    try {
        const { data } = await appDB.from('users').select('*').order('created_at', {ascending: false});
        const box = document.getElementById('userTableBody'); 
        if(box) box.innerHTML = '';
        GLOBAL_USER_LIST = data || [];
        
        if(typeof populateIndivUserSelect === 'function') populateIndivUserSelect();

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

    // 4. เตรียมข้อมูล Dropdown สิทธิ์ต่างๆ 
    let availableDepts = new Set([...(typeof permDepartmentsList !== 'undefined' ? permDepartmentsList : ['AM', 'OD'])]);
    GLOBAL_USER_LIST.forEach(u => { 
        if(u.department && u.department !== 'TRAINER' && u.department !== 'NEW') availableDepts.add(u.department); 
    });
    availableDepts.delete('TRAINER'); availableDepts.delete('NEW');
    const deptListArray = Array.from(availableDepts).sort();
    
    let rawRoles = typeof permRolesList !== 'undefined' ? permRolesList : ['staff', 'trainer', 'manager'];
    if (!rawRoles.includes('manager')) rawRoles.push('manager');
    const uniqueRoles = [...new Set(rawRoles)];
    const roleOptions = uniqueRoles.map(r => ({ val: r, label: r.charAt(0).toUpperCase() + r.slice(1) }));

    // 5. วาดตาราง (เฉพาะคนที่อยู่ในหน้านี้)
    let html = '';
    paginatedUsers.forEach((u, index) => {
        const displayIndex = startIndex + index + 1; // ลำดับที่ถูกต้อง

        let currentDep = u.department || 'AM';
        if (currentDep === 'TRAINER' || currentDep === 'NEW') currentDep = 'AM';
        let depColor = currentDep === 'OD' ? 'text-pink-400' : (currentDep === 'AM' ? 'text-blue-400' : 'text-teal-400');
        
        let depBadge = `<select onchange="updateUserDepartment(${u.id}, this.value)" class="bg-slate-900 ${depColor} text-[10px] p-1.5 rounded-md border border-slate-700 font-bold outline-none cursor-pointer hover:bg-slate-950 shadow-inner text-center w-[60px]">`;
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

        const pinDisplay = u.password 
            ? `<div class="flex items-center justify-center gap-1 group"><span class="font-mono text-amber-400 font-bold bg-amber-900/20 px-2 py-1 rounded-md border border-amber-700/50 tracking-widest text-xs">${u.password}</span><button onclick="resetUserPin(${u.id}, '${u.username}')" class="text-slate-500 hover:text-red-400 p-1 bg-slate-800 rounded-md transition opacity-0 group-hover:opacity-100" title="ล้างรหัสผ่านให้ตั้งใหม่"><span class="material-icons text-[14px]">lock_reset</span></button></div>` 
            : `<div class="flex items-center justify-center gap-1 group"><span class="text-slate-500 text-[10px] italic bg-slate-800 px-2 py-1 rounded-md">ยังไม่ตั้ง</span><button onclick="resetUserPin(${u.id}, '${u.username}')" class="text-slate-500 hover:text-green-400 p-1 bg-slate-800 rounded-md transition opacity-0 group-hover:opacity-100" title="รีเซ็ต"><span class="material-icons text-[14px]">refresh</span></button></div>`;

        html += `
            <tr class="hover:bg-slate-700/30 transition duration-200 group">
                <td class="p-3 text-center border-b border-slate-700/50"><input type="checkbox" class="user-check w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500 cursor-pointer" value="${u.id}"></td>
                <td class="p-3 text-gray-100 text-sm font-extrabold text-left border-b border-slate-700/50 flex items-center gap-2">
                    <span class="text-[10px] text-gray-500 w-5 text-right mr-1">${displayIndex}.</span>
                    <div class="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 text-xs shadow-inner group-hover:text-white transition">${u.username.substring(0,2).toUpperCase()}</div>
                    ${u.username}
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

window.searchEmployee = function() {
    userCurrentPage = 1; 
    window.renderUserTableDirectly();
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
        const { error } = await appDB.from('users').update({ password: pin1 }).eq('id', currentUser.id);
        if (error) throw error;

        currentUser.password = pin1;
        sessionStorage.setItem('user_platinum_plus', JSON.stringify(currentUser));
        
        closeChangePinModal();
        Swal.fire({ icon: 'success', title: 'เปลี่ยนรหัสสำเร็จ!', text: 'คราวหน้ากรุณาใช้รหัสผ่านใหม่นี้เข้าสู่ระบบครับ', timer: 2000, showConfirmButton: false });
    } catch (err) {
        console.error(err);
        Swal.fire('Error', 'เกิดข้อผิดพลาดในการเปลี่ยนรหัส: ' + err.message, 'error');
    }
};

window.resetUserPin = async function(id, username) {
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
            Swal.fire({title: 'กำลังล้างรหัส...', didOpen: () => Swal.showLoading()});
            const { error } = await appDB.from('users').update({ password: null }).eq('id', id);
            
            if (error) {
                Swal.fire('Error', error.message, 'error');
            } else {
                if(typeof fetchUsers === 'function') fetchUsers(); 
                Swal.fire({icon: 'success', title: 'สำเร็จ', text: `รีเซ็ตรหัสของ ${username} แล้ว`, timer: 1500, showConfirmButton: false});
            }
        }
    });
}

// ====================================================
// ระบบกระดานประกาศ (Announcements) - จำเป็นต้องมีให้ครบ ไม่ให้ Error
// ====================================================
let globalAnnouncement = null;

window.previewAnnounceImg = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('announceImgPreview').src = e.target.result;
            document.getElementById('announceImgPreviewBox').classList.remove('hidden');
        };
        reader.readAsDataURL(input.files[0]);
    }
};

window.clearAnnounceImg = function() {
    document.getElementById('announceImageFile').value = '';
    document.getElementById('announceImageUrl').value = '';
    document.getElementById('announceImgPreview').src = '';
    document.getElementById('announceImgPreviewBox').classList.add('hidden');
};

async function renderAnnouncementUI() {
    const displayBox = document.getElementById('currentAnnouncementDisplay');
    if(!displayBox) return;
    displayBox.innerHTML = '<span class="material-icons animate-spin text-4xl text-yellow-500">sync</span>';
    
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', 'system_announcement').single();
        if (data && data.value) {
            globalAnnouncement = JSON.parse(data.value);
            
            let html = '';
            if (!globalAnnouncement.isActive) {
                html = `<div class="text-gray-400 font-bold flex flex-col items-center gap-2"><span class="material-icons text-5xl opacity-30">notifications_off</span> ขณะนี้ไม่มีประกาศจากระบบครับ</div>`;
            } else {
                let imgHtml = globalAnnouncement.image ? `<img src="${globalAnnouncement.image}" class="w-full max-w-lg mx-auto rounded-xl shadow-md mb-6 border border-gray-200 dark:border-slate-700">` : '';
                let timeHtml = '';
                if (globalAnnouncement.scheduledTime) timeHtml += `<span class="bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded-md">เริ่ม: ${new Date(globalAnnouncement.scheduledTime).toLocaleString('th-TH')}</span> `;
                if (globalAnnouncement.endTime) timeHtml += `<span class="bg-red-500/20 text-red-500 px-2 py-1 rounded-md">สิ้นสุด: ${new Date(globalAnnouncement.endTime).toLocaleString('th-TH')}</span>`;

                html = `
                    ${imgHtml}
                    <h3 class="text-2xl md:text-3xl font-black text-orange-500 mb-4">${globalAnnouncement.title || 'ประกาศ'}</h3>
                    <div class="text-slate-600 dark:text-gray-300 text-sm md:text-base whitespace-pre-line leading-relaxed px-4 md:px-10 text-left bg-orange-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-orange-100 dark:border-slate-700">
                        ${globalAnnouncement.text}
                    </div>
                    <div class="mt-6 flex flex-wrap justify-center gap-2 text-[10px] font-bold">
                        <span class="text-gray-400 px-2 py-1">อัปเดตล่าสุด: ${new Date(globalAnnouncement.timestamp).toLocaleString('th-TH')}</span>
                        ${timeHtml}
                    </div>
                `;
            }
            displayBox.innerHTML = html;

            if(document.getElementById('announceTitle')) {
                document.getElementById('announceTitle').value = globalAnnouncement.title || '';
                document.getElementById('announceText').value = globalAnnouncement.text || '';
                document.getElementById('announceIsActive').checked = globalAnnouncement.isActive;
                document.getElementById('announceScheduleTime').value = globalAnnouncement.scheduledTime || '';
                document.getElementById('announceEndTime').value = globalAnnouncement.endTime || '';
                
                document.getElementById('announceImageFile').value = '';
                document.getElementById('announceImageUrl').value = globalAnnouncement.image || '';
                if (globalAnnouncement.image) {
                    document.getElementById('announceImgPreview').src = globalAnnouncement.image;
                    document.getElementById('announceImgPreviewBox').classList.remove('hidden');
                } else {
                    document.getElementById('announceImgPreviewBox').classList.add('hidden');
                }
            }
            
        } else {
            displayBox.innerHTML = `<div class="text-gray-400 font-bold flex flex-col items-center gap-2"><span class="material-icons text-5xl opacity-30">notifications_off</span> ขณะนี้ไม่มีประกาศจากระบบครับ</div>`;
        }
    } catch(e) {
        displayBox.innerHTML = '<div class="text-red-500">ไม่สามารถดึงข้อมูลประกาศได้</div>';
    }
}

window.saveAnnouncement = async function() {
    const title = document.getElementById('announceTitle').value.trim();
    const text = document.getElementById('announceText').value.trim();
    const isActive = document.getElementById('announceIsActive').checked;
    const scheduleTime = document.getElementById('announceScheduleTime').value;
    const endTime = document.getElementById('announceEndTime').value;
    
    if (isActive && !text) return Swal.fire('เตือน', 'กรุณาใส่เนื้อหาประกาศด้วยครับ', 'warning');

    Swal.fire({title: 'กำลังบันทึกและจัดการรูปภาพ...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});

    let finalImageUrl = document.getElementById('announceImageUrl').value;
    const fileInput = document.getElementById('announceImageFile');

    try {
        if (fileInput.files && fileInput.files.length > 0) {
            Swal.update({text: 'กำลังอัปโหลดรูปภาพใหม่...'});
            const file = fileInput.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `announce_${Date.now()}.${fileExt}`;

            const { error: uploadError } = await appDB.storage
                .from('staff_images') 
                .upload(`announcements/${fileName}`, file, { cacheControl: '3600', upsert: false });

            if (uploadError) throw new Error('อัปโหลดรูปไม่สำเร็จ: ' + uploadError.message);
            const { data: publicUrlData } = appDB.storage.from('staff_images').getPublicUrl(`announcements/${fileName}`);
            finalImageUrl = publicUrlData.publicUrl;
        }

        const payload = {
            id: Date.now().toString(), 
            title: title,
            text: text,
            image: finalImageUrl,
            isActive: isActive,
            scheduledTime: scheduleTime,
            endTime: endTime,
            timestamp: Date.now()
        };

        await appDB.from('settings').upsert([{ key: 'system_announcement', value: JSON.stringify(payload) }]);
        globalAnnouncement = payload;
        
        renderAnnouncementUI();
        Swal.fire({icon: 'success', title: 'สำเร็จ!', text: 'บันทึกประกาศเรียบร้อยแล้ว พนักงานจะเห็นภายใน 1 นาที', timer: 2000, showConfirmButton: false});
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
};

window.deleteAnnouncement = async function() {
    const confirm = await Swal.fire({
        title: 'ลบประกาศนี้ทิ้ง?',
        text: 'ประกาศที่กำลังแสดงอยู่ หรือที่ตั้งเวลาไว้ จะถูกลบออกทั้งหมด!',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'ลบทิ้งเลย'
    });

    if (confirm.isConfirmed) {
        Swal.fire({title: 'กำลังล้างข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
        
        try {
            const payload = {
                id: Date.now().toString(),
                title: '', text: '', image: '', isActive: false, scheduledTime: '', endTime: '', timestamp: Date.now()
            };
            
            await appDB.from('settings').upsert([{ key: 'system_announcement', value: JSON.stringify(payload) }]);
            globalAnnouncement = payload;
            
            if(document.getElementById('announceTitle')) {
                document.getElementById('announceTitle').value = '';
                document.getElementById('announceText').value = '';
                document.getElementById('announceIsActive').checked = false;
                document.getElementById('announceScheduleTime').value = '';
                document.getElementById('announceEndTime').value = '';
            }
            if (typeof clearAnnounceImg === 'function') clearAnnounceImg();
            
            renderAnnouncementUI();
            Swal.fire({icon: 'success', title: 'ลบประกาศเรียบร้อย', timer: 1500, showConfirmButton: false});
        } catch (e) {
            Swal.fire('Error', e.message, 'error');
        }
    }
};

window.checkAndShowAnnouncementPopup = async function(isSilentCheck = false) {
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', 'system_announcement').single();
        if (data && data.value) {
            const announce = JSON.parse(data.value);
            
            if (!announce.isActive) return;

            const now = new Date();
            if (announce.scheduledTime && now < new Date(announce.scheduledTime)) return; 
            if (announce.endTime && now > new Date(announce.endTime)) return; 

            const lastSeenId = localStorage.getItem('seen_announcement_id');
            
            if (isSilentCheck && Swal.isVisible()) return;

            if (lastSeenId !== announce.id) {
                let imgHtml = announce.image ? `<img src="${announce.image}" style="max-width: 100%; border-radius: 12px; margin-bottom: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">` : '';
                
                Swal.fire({
                    title: `<div class="text-2xl font-black text-orange-500 tracking-wide">${announce.title || '📢 ประกาศจากระบบ'}</div>`,
                    html: `
                        ${imgHtml}
                        <div class="text-left text-sm text-slate-700 dark:text-gray-200 whitespace-pre-line leading-relaxed p-4 bg-orange-50 dark:bg-slate-800 rounded-xl border border-orange-100 dark:border-slate-700">
                            ${announce.text}
                        </div>
                    `,
                    confirmButtonText: 'รับทราบ',
                    confirmButtonColor: '#f97316',
                    allowOutsideClick: false, 
                    customClass: { popup: 'dark:bg-slate-900 dark:text-white rounded-3xl border border-slate-700 shadow-2xl' }
                }).then((result) => {
                    if (result.isConfirmed) {
                        localStorage.setItem('seen_announcement_id', announce.id); 
                    }
                });
            }
        }
    } catch(e) { console.log('No announcement data'); }
};

window.updateAnnounceBadge = function() {
    const badge = document.getElementById('announceNotiBadge');
    if (!badge) return;

    if (globalAnnouncement && globalAnnouncement.isActive) {
        const now = new Date();
        if (globalAnnouncement.scheduledTime && now < new Date(globalAnnouncement.scheduledTime)) {
            badge.classList.add('hidden'); return;
        }
        if (globalAnnouncement.endTime && now > new Date(globalAnnouncement.endTime)) {
            badge.classList.add('hidden'); return;
        }

        const lastSeenId = localStorage.getItem('seen_announcement_id');
        if (lastSeenId !== globalAnnouncement.id) {
            badge.classList.remove('hidden'); 
        } else {
            badge.classList.add('hidden'); 
        }
    } else {
        badge.classList.add('hidden'); 
    }
};

window.forceShowAnnouncementPopup = async function() {
    try {
        Swal.fire({title: 'กำลังดึงประกาศ...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
        
        const { data } = await appDB.from('settings').select('value').eq('key', 'system_announcement').single();
        if (data && data.value) {
            const announce = JSON.parse(data.value);
            globalAnnouncement = announce; 
            
            if (!announce.isActive) {
                if (typeof updateAnnounceBadge === 'function') updateAnnounceBadge();
                return Swal.fire({
                    icon: 'info',
                    title: 'ไม่มีประกาศ',
                    text: 'ขณะนี้แอดมินปิดการแสดงประกาศไว้ครับ',
                    confirmButtonColor: '#3b82f6'
                });
            }

            localStorage.setItem('seen_announcement_id', announce.id);
            if (typeof updateAnnounceBadge === 'function') updateAnnounceBadge();

            let imgHtml = announce.image ? `<img src="${announce.image}" style="max-width: 100%; border-radius: 12px; margin-bottom: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">` : '';
            
            Swal.fire({
                title: `<div class="text-2xl font-black text-orange-500 tracking-wide">${announce.title || '📢 ประกาศจากระบบ'}</div>`,
                html: `
                    ${imgHtml}
                    <div class="text-left text-sm text-slate-700 dark:text-gray-200 whitespace-pre-line leading-relaxed p-4 bg-orange-50 dark:bg-slate-800 rounded-xl border border-orange-100 dark:border-slate-700">
                        ${announce.text}
                    </div>
                `,
                confirmButtonText: 'ปิดหน้าต่าง',
                confirmButtonColor: '#64748b',
                customClass: { popup: 'dark:bg-slate-900 dark:text-white rounded-3xl border border-slate-700 shadow-2xl' }
            });
        } else {
            Swal.fire('ไม่มีประกาศ', 'ไม่พบข้อมูลประกาศในระบบ', 'info');
        }
    } catch(e) { 
        Swal.fire('Error', 'ไม่สามารถดึงข้อมูลได้', 'error'); 
    }
};

// 🌟 [ปรับปรุงใหม่] ไม่ยิง Database พร่ำเพรื่อ เช็คเวลาผ่านตัวแปรในเครื่องแทน
setInterval(() => {
    if (typeof currentUser !== 'undefined' && currentUser.id && typeof globalAnnouncement !== 'undefined' && globalAnnouncement && globalAnnouncement.isActive) {
        const now = new Date();
        // เช็คเวลาจากข้อมูลที่มีอยู่แล้วในระบบ (ไม่ต้องไปกวน Database)
        if (globalAnnouncement.scheduledTime && now < new Date(globalAnnouncement.scheduledTime)) return;
        if (globalAnnouncement.endTime && now > new Date(globalAnnouncement.endTime)) return;

        const lastSeenId = localStorage.getItem('seen_announcement_id');
        // ถ้าถึงเวลาประกาศแล้ว และพนักงานยังไม่เคยเห็น ค่อยยิงไปดึงข้อมูลเพื่อโชว์ป๊อปอัป
        if (globalAnnouncement.id && lastSeenId !== globalAnnouncement.id && typeof Swal !== 'undefined' && !Swal.isVisible()) {
            if (typeof window.checkAndShowAnnouncementPopup === 'function') {
                window.checkAndShowAnnouncementPopup(true); 
            }
        }
    }
}, 60000);

// =========================================================
// ⚙️ ระบบดึงการตั้งค่า (คืนชีพดีไซน์เดิม 100%)
// =========================================================

window.loadSettings = async function() {
    try {
        const { data } = await appDB.from('settings').select('*')
            .not('key', 'like', 'duty_roster_%')
            .not('key', 'like', 'report_TRAINER_%');
            
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

// 🟢 คืนชีพดีไซน์หน้า "โควตาการเข้างาน" ดึงเว็บให้ครบ 10 เว็บตามฐานข้อมูล
window.renderQuotaSettings = function() {
    const container = document.getElementById('quotaSettingsContainer');
    if (!container) return;
    
    let amHtml = ''; let odHtml = '';
    
    // ดึงรายชื่อทีมทั้งหมด 10 ทีม และเรียงลำดับ A-Z
    const allTeams = [...TEAM_LIST].sort((a, b) => a.localeCompare(b));

    // สร้างตารางให้แผนก AM
    allTeams.forEach(team => {
        const qM = SETTINGS[`quota_team_${team}_AM_เช้า`] || 1; 
        const qA = SETTINGS[`quota_team_${team}_AM_กลาง`] || 0; 
        const qN = SETTINGS[`quota_team_${team}_AM_ดึก`] || 1;
        amHtml += `
        <div class="flex items-center gap-2 quota-row-team group min-w-max">
            <input type="hidden" class="key-input" value="${team}"><input type="hidden" class="dept-input" value="AM">
            <div class="bg-[#f0fdf4] dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-slate-800 dark:text-emerald-100 font-bold px-3 py-1.5 rounded-md w-24 shrink-0 text-xs shadow-sm truncate text-center">${team}</div>
            <input type="number" id="quota_team_${team}_AM_เช้า" class="val-m w-16 shrink-0 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-center font-bold text-sm rounded-md py-1.5 outline-none focus:border-amber-500" value="${qM}">
            <input type="number" id="quota_team_${team}_AM_กลาง" class="val-a w-16 shrink-0 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-center font-bold text-sm rounded-md py-1.5 outline-none focus:border-amber-500" value="${qA}">
            <input type="number" id="quota_team_${team}_AM_ดึก" class="val-n w-16 shrink-0 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-center font-bold text-sm rounded-md py-1.5 outline-none focus:border-amber-500" value="${qN}">
            <button onclick="this.parentElement.remove()" class="text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full w-6 h-6 shrink-0 flex items-center justify-center transition"><span class="material-icons text-[14px]">cancel</span></button>
        </div>`;
    });

    // สร้างตารางให้แผนก OD
    allTeams.forEach(team => {
        const qM = SETTINGS[`quota_team_${team}_OD_เช้า`] || 1; 
        const qA = SETTINGS[`quota_team_${team}_OD_กลาง`] || 0; 
        const qN = SETTINGS[`quota_team_${team}_OD_ดึก`] || 1;
        odHtml += `
        <div class="flex items-center gap-2 quota-row-team group min-w-max">
            <input type="hidden" class="key-input" value="${team}"><input type="hidden" class="dept-input" value="OD">
            <div class="bg-[#f0fdf4] dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-slate-800 dark:text-emerald-100 font-bold px-3 py-1.5 rounded-md w-24 shrink-0 text-xs shadow-sm truncate text-center">${team}</div>
            <input type="number" id="quota_team_${team}_OD_เช้า" class="val-m w-16 shrink-0 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-center font-bold text-sm rounded-md py-1.5 outline-none focus:border-amber-500" value="${qM}">
            <input type="number" id="quota_team_${team}_OD_กลาง" class="val-a w-16 shrink-0 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-center font-bold text-sm rounded-md py-1.5 outline-none focus:border-amber-500" value="${qA}">
            <input type="number" id="quota_team_${team}_OD_ดึก" class="val-n w-16 shrink-0 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-center font-bold text-sm rounded-md py-1.5 outline-none focus:border-amber-500" value="${qN}">
            <button onclick="this.parentElement.remove()" class="text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full w-6 h-6 shrink-0 flex items-center justify-center transition"><span class="material-icons text-[14px]">cancel</span></button>
        </div>`;
    });

    container.innerHTML = `
        <div class="flex flex-col gap-6 w-full mt-2">
            <div class="bg-[#151f32] rounded-xl border border-slate-700/80 shadow-inner p-5 w-full">
                <div class="flex justify-between items-center mb-4 border-b border-slate-700/50 pb-2">
                    <h5 class="text-white font-bold text-sm tracking-wide">รวมทั้งกะ (ภาพรวม):</h5>
                </div>
                
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div>
                        <div class="text-xs font-bold text-blue-400 mb-2 flex items-center gap-1.5"><div class="w-3 h-3 bg-blue-500 rounded-sm shadow-sm"></div> โควตา AM รวม:</div>
                        <div class="space-y-2 pl-4">
                            <div class="flex items-center justify-between gap-4 quota-row-total"><input type="hidden" class="key-input" value="เช้า"><div class="w-1/2 bg-blue-50 dark:bg-slate-800 border border-blue-100 dark:border-slate-600 text-slate-700 dark:text-gray-300 text-center rounded-md p-1.5 text-xs font-bold shadow-sm">กะเช้า</div><input type="number" id="quota_total_เช้า" class="val-input w-1/2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white text-center rounded-md p-1.5 font-bold shadow-inner outline-none focus:ring-2 focus:ring-blue-500" value="${SETTINGS.quota_total_เช้า || 12}"></div>
                            <div class="flex items-center justify-between gap-4 quota-row-total"><input type="hidden" class="key-input" value="กลาง"><div class="w-1/2 bg-blue-50 dark:bg-slate-800 border border-blue-100 dark:border-slate-600 text-slate-700 dark:text-gray-300 text-center rounded-md p-1.5 text-xs font-bold shadow-sm">กะกลาง</div><input type="number" id="quota_total_กลาง" class="val-input w-1/2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white text-center rounded-md p-1.5 font-bold shadow-inner outline-none focus:ring-2 focus:ring-blue-500" value="${SETTINGS.quota_total_กลาง || 0}"></div>
                            <div class="flex items-center justify-between gap-4 quota-row-total"><input type="hidden" class="key-input" value="ดึก"><div class="w-1/2 bg-blue-50 dark:bg-slate-800 border border-blue-100 dark:border-slate-600 text-slate-700 dark:text-gray-300 text-center rounded-md p-1.5 text-xs font-bold shadow-sm">กะดึก</div><input type="number" id="quota_total_ดึก" class="val-input w-1/2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white text-center rounded-md p-1.5 font-bold shadow-inner outline-none focus:ring-2 focus:ring-blue-500" value="${SETTINGS.quota_total_ดึก || 16}"></div>
                        </div>
                    </div>
                    <div>
                        <div class="text-xs font-bold text-pink-400 mb-2 flex items-center gap-1.5"><div class="w-3 h-3 bg-pink-500 rounded-sm shadow-sm"></div> โควตา OD รวม:</div>
                        <div class="space-y-2 pl-4">
                            <div class="flex items-center justify-between gap-4 quota-row-od"><input type="hidden" class="key-input" value="เช้า"><div class="w-1/2 bg-pink-50 dark:bg-[#2b1b2e] border border-pink-100 dark:border-pink-900/50 text-pink-700 dark:text-pink-300 text-center rounded-md p-1.5 text-xs font-bold shadow-sm">OD กะเช้า</div><input type="number" id="quota_od_เช้า" class="val-input w-1/2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white text-center rounded-md p-1.5 font-bold shadow-inner outline-none focus:ring-2 focus:ring-pink-500" value="${SETTINGS.quota_od_เช้า || 9}"></div>
                            <div class="flex items-center justify-between gap-4 quota-row-od"><input type="hidden" class="key-input" value="กลาง"><div class="w-1/2 bg-pink-50 dark:bg-[#2b1b2e] border border-pink-100 dark:border-pink-900/50 text-pink-700 dark:text-pink-300 text-center rounded-md p-1.5 text-xs font-bold shadow-sm">OD กะกลาง</div><input type="number" id="quota_od_กลาง" class="val-input w-1/2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white text-center rounded-md p-1.5 font-bold shadow-inner outline-none focus:ring-2 focus:ring-pink-500" value="${SETTINGS.quota_od_กลาง || 0}"></div>
                            <div class="flex items-center justify-between gap-4 quota-row-od"><input type="hidden" class="key-input" value="ดึก"><div class="w-1/2 bg-pink-50 dark:bg-[#2b1b2e] border border-pink-100 dark:border-pink-900/50 text-pink-700 dark:text-pink-300 text-center rounded-md p-1.5 text-xs font-bold shadow-sm">OD กะดึก</div><input type="number" id="quota_od_ดึก" class="val-input w-1/2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white text-center rounded-md p-1.5 font-bold shadow-inner outline-none focus:ring-2 focus:ring-pink-500" value="${SETTINGS.quota_od_ดึก || 9}"></div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 w-full">
                <div class="bg-[#151f32] rounded-xl border border-slate-700/80 shadow-inner p-4 flex flex-col h-[500px]">
                    <div class="flex justify-between items-center mb-3 border-b border-slate-700/50 pb-2 shrink-0">
                        <h5 class="text-blue-300 font-bold text-xs flex items-center gap-1.5"><span class="material-icons text-[14px]">domain</span> รายทีม (AM):</h5>
                        <button onclick="addTeamManual('AM')" class="text-[10px] text-blue-400 border border-blue-500/50 px-2 py-1 rounded hover:bg-blue-900/30 transition">+ เพิ่มทีม AM</button>
                    </div>
                    <div class="flex text-[10px] font-bold text-pink-400 mb-2 px-2 min-w-max shrink-0">
                        <div class="w-24 shrink-0 text-center">ชื่อทีม</div>
                        <div class="w-16 shrink-0 text-center text-orange-400 ml-2">เช้า</div>
                        <div class="w-16 shrink-0 text-center text-blue-400 ml-2">กลาง</div>
                        <div class="w-16 shrink-0 text-center text-purple-400 ml-2">ดึก</div>
                        <div class="w-6 shrink-0 ml-2"></div>
                    </div>
                    <div class="space-y-2 flex-1 overflow-x-auto overflow-y-auto custom-scrollbar pr-1">${amHtml}</div>
                </div>

                <div class="bg-[#151f32] rounded-xl border border-slate-700/80 shadow-inner p-4 flex flex-col h-[500px]">
                    <div class="flex justify-between items-center mb-3 border-b border-slate-700/50 pb-2 shrink-0">
                        <h5 class="text-pink-300 font-bold text-xs flex items-center gap-1.5"><span class="material-icons text-[14px]">groups</span> รายทีม (OD):</h5>
                        <button onclick="addTeamManual('OD')" class="text-[10px] text-pink-400 border border-pink-500/50 px-2 py-1 rounded hover:bg-pink-900/30 transition">+ เพิ่มทีม OD</button>
                    </div>
                    <div class="flex text-[10px] font-bold text-pink-400 mb-2 px-2 min-w-max shrink-0">
                        <div class="w-24 shrink-0 text-center">ชื่อทีม</div>
                        <div class="w-16 shrink-0 text-center text-orange-400 ml-2">เช้า</div>
                        <div class="w-16 shrink-0 text-center text-blue-400 ml-2">กลาง</div>
                        <div class="w-16 shrink-0 text-center text-purple-400 ml-2">ดึก</div>
                        <div class="w-6 shrink-0 ml-2"></div>
                    </div>
                    <div class="space-y-2 flex-1 overflow-x-auto overflow-y-auto custom-scrollbar pr-1">${odHtml}</div>
                </div>
            </div>
        </div>
    `;
};

window.saveQuotaSettings = async function() {
    Swal.fire({title: 'กำลังบันทึกโควตา...', didOpen: () => Swal.showLoading()});
    const updates = [];
    ['เช้า', 'กลาง', 'ดึก'].forEach(shift => {
        let val = document.getElementById(`quota_total_${shift}`).value; updates.push({key: `quota_total_${shift}`, value: val}); SETTINGS[`quota_total_${shift}`] = val;
        let odVal = document.getElementById(`quota_od_${shift}`).value; updates.push({key: `quota_od_${shift}`, value: odVal}); SETTINGS[`quota_od_${shift}`] = odVal;
    });

    document.querySelectorAll('.quota-row-team').forEach(row => {
        let team = row.querySelector('.key-input').value; let dept = row.querySelector('.dept-input').value;
        let qM = row.querySelector('.val-m').value; let qA = row.querySelector('.val-a').value; let qN = row.querySelector('.val-n').value;
        updates.push({key: `quota_team_${team}_${dept}_เช้า`, value: qM}); SETTINGS[`quota_team_${team}_${dept}_เช้า`] = qM;
        updates.push({key: `quota_team_${team}_${dept}_กลาง`, value: qA}); SETTINGS[`quota_team_${team}_${dept}_กลาง`] = qA;
        updates.push({key: `quota_team_${team}_${dept}_ดึก`, value: qN}); SETTINGS[`quota_team_${team}_${dept}_ดึก`] = qN;
    });

    await appDB.from('settings').upsert(updates);
    Swal.fire('สำเร็จ', 'บันทึกโควตาการเข้างานเรียบร้อยแล้ว', 'success');
};

// =========================================================
// 🟢 ระบบสิทธิ์เมนู (ดีไซน์พรีเมียม & มืออาชีพ)
// =========================================================
let MENU_PERMS = {};

const PERM_GROUPS = [
    {
        id: 'page_dashboard', name: 'หน้าหลักลงเวลา', icon: 'home', theme: 'blue',
        items: [
            {id: 'dashboard', name: 'เข้าหน้าหลักลงเวลา', isSub: false}
        ]
    },
    {
        id: 'page_leave', name: 'หน้าวันหยุด / ลางาน', icon: 'event_busy', theme: 'rose',
        items: [
            {id: 'leave', name: 'เข้าหน้าตารางวันหยุด', isSub: false},
            {id: 'leave_request', name: 'กดจอง/ยกเลิก', isSub: true},
            {id: 'leave_history', name: 'ดูประวัติ', isSub: true},
            {id: 'leave_export', name: 'โหลด Excel', isSub: true},
            {id: 'leave_am', name: '[ดูหน้า] แท็บ AM', isSub: true},
            {id: 'leave_od', name: '[ดูหน้า] แท็บ OD', isSub: true},
            {id: 'leave_new', name: '[ดูหน้า] พนักงานใหม่', isSub: true},
            {id: 'leave_trainer', name: '[ดูหน้า] ผู้สอน', isSub: true},
            {id: 'leave_manage_am', name: '⚙️ จัดการ AM', isSub: true},
            {id: 'leave_manage_od', name: '⚙️ จัดการ OD', isSub: true},
            {id: 'leave_manage_new', name: '⚙️ จัดการ พนง.ใหม่', isSub: true},
            {id: 'leave_manage_trainer', name: '⚙️ จัดการ ผู้สอน', isSub: true}
        ]
    },
    {
        id: 'page_gallery', name: 'คลังรูปภาพ', icon: 'photo_library', theme: 'pink',
        items: [
            {id: 'gallery', name: 'เข้าหน้าคลังรูปภาพ', isSub: false},
            {id: 'gallery_upload', name: 'อัปโหลดรูปภาพ', isSub: true},
            {id: 'gallery_delete', name: 'ลบรูปภาพ', isSub: true}
        ]
    },
    {
        id: 'page_password', name: 'รหัสผ่าน', icon: 'vpn_key', theme: 'amber',
        items: [
            {id: 'password', name: 'เข้าหน้าจัดการรหัสผ่าน', isSub: false}
        ]
    },
    {
        id: 'page_kb', name: 'คลังความรู้', icon: 'menu_book', theme: 'amber',
        items: [
            {id: 'kb', name: 'เข้าหน้าคลังความรู้', isSub: false},
            {id: 'kb_manage', name: 'เขียน/ลบบทความ', isSub: true}
        ]
    },
    {
        id: 'page_sheet', name: 'ตารางงาน (Sheets)', icon: 'table_view', theme: 'emerald',
        items: [
            {id: 'sheet', name: 'เข้าตารางงาน (Sheets)', isSub: false},
            {id: 'sheet_manage', name: 'เพิ่ม/แก้/ลบ ลิงก์', isSub: true}
        ]
    },
    {
        id: 'page_swap', name: 'สลับกะการทำงาน', icon: 'swap_horiz', theme: 'orange',
        items: [
            {id: 'swap', name: 'เข้าหน้าสลับกะการทำงาน', isSub: false},
            {id: 'swap_manage', name: 'แอดมินจัดการสลับกะ', isSub: true}
        ]
    },
    // ==========================================
    // 🌟 เพิ่มสิทธิ์ 2 หน้าใหม่ตรงนี้ครับ
    // ==========================================
    {
        id: 'page_usdt_calc', name: 'คำนวณ USDT / THB', icon: 'currency_exchange', theme: 'emerald',
        items: [
            {id: 'usdt_calc', name: 'เข้าหน้าคำนวณ USDT', isSub: false}
        ]
    },
    {
        id: 'page_slip_check', name: 'ตรวจสอบสลิป', icon: 'qr_code_scanner', theme: 'blue',
        items: [
            {id: 'slip_check', name: 'เข้าหน้าตรวจสอบสลิป', isSub: false},
            {id: 'slip_check_delete', name: 'ลบประวัติสลิป', isSub: true} // เพิ่มบรรทัดนี้ครับ
        ]
    },
    {
        id: 'page_duty', name: 'จัดหน้าที่ / เวร', icon: 'assignment_ind', theme: 'indigo',
        items: [
            {id: 'duty', name: 'เข้าหน้าจัดหน้าที่ / เวร', isSub: false},
            {id: 'duty_manage', name: 'สุ่มเวร & ตั้งค่าหัวข้อ', isSub: true}
        ]
    },
    {
        id: 'page_telegram', name: 'กลุ่มงาน (Telegram)', icon: 'near_me', theme: 'sky',
        items: [
            {id: 'telegram', name: 'เข้าหน้ากลุ่มงาน (Telegram)', isSub: false}
        ]
    },
    {
        id: 'page_files', name: 'คลังไฟล์ / โปรแกรม', icon: 'folder_zip', theme: 'teal',
        items: [
            {id: 'files', name: 'เข้าหน้าคลังไฟล์ / โปรแกรม', isSub: false},
            {id: 'files_manage', name: 'แอดมินคลังไฟล์', isSub: true}
        ]
    },
    {
        id: 'page_summary', name: 'สรุปยอดทำรายการ', icon: 'query_stats', theme: 'purple',
        items: [
            {id: 'summary', name: 'เข้าหน้าสรุปยอดทำรายการ', isSub: false}
        ]
    },
    {
        id: 'page_fine', name: 'ระบบใบปรับ', icon: 'gavel', theme: 'red',
        items: [
            {id: 'fine', name: 'เข้าระบบใบปรับพนักงาน', isSub: false},
            {id: 'fine_manage', name: 'ออกใบปรับ / จัดการกฎ', isSub: true},
            {id: 'fine_view_all', name: 'ดูตารางของทุกคน', isSub: true},
            {id: 'fine_stats', name: 'ดูหน้าสถิติ', isSub: true}
        ]
    },
    {
        id: 'page_announcement', name: 'กระดานประกาศ', icon: 'campaign', theme: 'orange',
        items: [
            {id: 'announcement', name: 'เข้าหน้ากระดานประกาศ', isSub: false}
        ]
    },
    {
        id: 'page_kbiz', name: 'จัดการบอท K BIZ', icon: 'smart_toy', theme: 'emerald',
        items: [
            {id: 'kbiz', name: 'เข้าหน้าจัดการบอท K BIZ', isSub: false}
        ]
    },
    {
        id: 'page_discord', name: 'เครื่องมือ DISCORD', icon: 'discord', theme: 'indigo',
        items: [
            {id: 'discord', name: 'เข้าหน้าต่างระบบ DISCORD', isSub: false},
            {id: 'ds_spy', name: 'Spy Monitor', isSub: true},
            {id: 'ds_move', name: 'ย้ายห้อง', isSub: true},
            {id: 'ds_checkin', name: 'เช็คชื่อ', isSub: true},
            {id: 'ds_manage', name: 'ฐานข้อมูล DS', isSub: true},
            {id: 'ds_log', name: 'ดูประวัติ DS', isSub: true}
        ]
    },
    {
        id: 'page_admin', name: 'เครื่องมือผู้จัดการ', icon: 'manage_accounts', theme: 'red',
        items: [
            {id: 'admin', name: 'เข้าเครื่องมือผู้จัดการ (Admin)', isSub: false},
            {id: 'admin_settings', name: 'ตั้งค่าระบบ', isSub: true},
            {id: 'admin_users', name: 'จัดการพนักงาน', isSub: true},
            {id: 'admin_perms', name: 'สิทธิ์เมนู', isSub: true},
            {id: 'admin_info', name: 'คำอธิบายสิทธิ์', isSub: true},
            {id: 'admin_logs', name: 'ประวัติระบบ (ปุ่มซ้ายล่าง)', isSub: true}
        ]
    }
];

// ฟังก์ชันคลิกพื้นที่ว่างแล้วให้ป๊อปอัปปิด
document.addEventListener('click', function(e) {
    if (!e.target.closest('.perm-cell') && !e.target.closest('.swal2-container')) {
        document.querySelectorAll('.perm-popup').forEach(el => el.classList.add('hidden'));
    }
});

// ตัวแปรเก็บว่าแต่ละบรรทัดเลือก Role อะไรอยู่ (ให้จำค่าเดิมไว้ในเครื่อง)
window.permRowSelections = JSON.parse(localStorage.getItem('saved_perm_roles')) || {
    'AM': 'STAFF',
    'OD': 'STAFF',
    'AMQL': 'TRAINER'
};

window.changePermRowRole = function(dept, newRole) {
    window.permRowSelections[dept] = newRole;
    // บันทึกค่า Dropdown ลงเครื่อง เวลาเปลี่ยนแล้วรีเฟรชจะได้ไม่เด้งกลับ
    localStorage.setItem('saved_perm_roles', JSON.stringify(window.permRowSelections));
    renderPermsTable();
};

window.renderPermsTable = function() {
    try {
        if (typeof SETTINGS['dept_menu_rules'] === 'string') MENU_PERMS = JSON.parse(SETTINGS['dept_menu_rules']);
        else if (SETTINGS['dept_menu_rules']) MENU_PERMS = SETTINGS['dept_menu_rules'];
        else MENU_PERMS = {};
    } catch(e) { MENU_PERMS = {}; }

    const tbody = document.getElementById('permTableBody');
    if(!tbody) return;

    // 🌟 1. ดึงแผนกทั้งหมดอัตโนมัติ: ดึงทั้งค่าตั้งต้น ค่าที่เคยเซฟสิทธิ์ไว้ และดึงแผนกจากพนักงานทุกคน
    let activeDepts = new Set(['AM', 'OD', 'AMQL']); 
    if (typeof GLOBAL_USER_LIST !== 'undefined') {
        GLOBAL_USER_LIST.forEach(u => {
            if (u.department && u.department !== 'NEW') activeDepts.add(u.department.toUpperCase());
        });
    }
    Object.keys(MENU_PERMS).forEach(key => {
        const deptPart = key.split('_')[0];
        if(deptPart) activeDepts.add(deptPart);
    });
    const depts = Array.from(activeDepts).sort();

    // 🌟 2. ดึง Role อัตโนมัติ: ดึงทั้งค่าตั้งต้น และดึง Role จากพนักงานทุกคน
    let rawRoles = ['STAFF', 'TRAINER', 'MANAGER'];
    if (typeof GLOBAL_USER_LIST !== 'undefined') {
        GLOBAL_USER_LIST.forEach(u => {
            if (u.role) rawRoles.push(u.role.toUpperCase());
        });
    }
    const uniqueRoles = [...new Set(rawRoles)];

    let bodyHtml = '';

    const colorClasses = {
        'blue': 'text-blue-400 bg-blue-500/10 border-blue-500/20',
        'rose': 'text-rose-400 bg-rose-500/10 border-rose-500/20',
        'pink': 'text-pink-400 bg-pink-500/10 border-pink-500/20',
        'amber': 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        'green': 'text-green-400 bg-green-500/10 border-green-500/20',
        'orange': 'text-orange-400 bg-orange-500/10 border-orange-500/20',
        'indigo': 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
        'sky': 'text-sky-400 bg-sky-500/10 border-sky-500/20',
        'emerald': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        'purple': 'text-purple-400 bg-purple-500/10 border-purple-500/20',
        'red': 'text-red-400 bg-red-500/10 border-red-500/20',
        'teal': 'text-teal-400 bg-teal-500/10 border-teal-500/20',
    };

    const themeHexColors = {
        'blue': '#3b82f6', 'rose': '#f43f5e', 'pink': '#ec4899', 'amber': '#f59e0b',
        'green': '#22c55e', 'orange': '#f97316', 'indigo': '#6366f1', 'sky': '#0ea5e9',
        'emerald': '#10b981', 'purple': '#a855f7', 'red': '#ef4444', 'teal': '#14b8a6',
    };

    depts.forEach(dept => {
        if(!window.permRowSelections[dept]) {
            if(dept === 'TRAINER' || dept === 'AMQL') window.permRowSelections[dept] = 'TRAINER';
            else window.permRowSelections[dept] = 'STAFF';
        }
        const role = window.permRowSelections[dept];
        const key = `${dept}_${role}`;
        const activePerms = MENU_PERMS[key] || [];
        
        let badgesHtml = '<div class="grid grid-cols-2 xl:grid-cols-3 gap-3 w-full content-start items-start">';
        let activeCount = 0;

        PERM_GROUPS.forEach(g => {
            const activeItemsInGroup = g.items.filter(i => activePerms.includes(i.id));
            if (activeItemsInGroup.length > 0) {
                activeCount++;
                const themeClass = colorClasses[g.theme] || colorClasses['blue'];
                const iconColor = themeClass.split(' ')[0]; 

                let itemsHtml = '';
                activeItemsInGroup.forEach(item => {
                    if (item.isSub) {
                        itemsHtml += `<span class="bg-slate-700/50 text-gray-300 border border-slate-600/50 px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap shadow-sm mt-1">${item.name}</span>`;
                    } else {
                        itemsHtml += `<span class="${themeClass} border px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap shadow-sm mt-1">${item.name}</span>`;
                    }
                });

                badgesHtml += `
                    <div class="bg-slate-800/40 border border-slate-700 rounded-xl p-3 flex flex-col shadow-inner hover:border-slate-500 transition h-fit">
                        <div class="flex items-center gap-2 border-b border-slate-700/50 pb-2 mb-1">
                            <span class="material-icons text-[16px] ${iconColor}">${g.icon}</span>
                            <span class="font-bold text-white text-[11px] truncate">${g.name}</span>
                        </div>
                        <div class="flex flex-wrap gap-1 content-start">
                            ${itemsHtml}
                        </div>
                    </div>
                `;
            }
        });
        badgesHtml += '</div>';
        if (activeCount === 0) {
            badgesHtml = `<div class="flex flex-col items-center justify-center py-6 text-gray-500 w-full"><span class="material-icons text-4xl mb-2 opacity-30">admin_panel_settings</span><span class="text-sm font-bold">คลิกที่นี่เพื่อกำหนดสิทธิ์การเข้าถึง</span></div>`;
        }

        let popupContentHtml = `
            <div id="popup_${key}" class="perm-popup absolute top-full left-0 mt-2 bg-[#0f172a] border border-slate-600 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] w-[950px] z-[99] hidden cursor-default overflow-hidden flex-col">
                
                <div class="bg-gradient-to-r from-slate-800 to-slate-900 border-b border-slate-700 p-5 flex justify-between items-center shrink-0">
                    <div class="flex items-center gap-3">
                        <div class="bg-blue-500/20 text-blue-400 p-2 rounded-xl shadow-inner border border-blue-500/30"><span class="material-icons text-xl block">tune</span></div>
                        <div>
                            <h4 class="text-white font-black text-lg leading-tight tracking-wide">จัดการสิทธิ์ <span class="text-blue-400">(${dept})</span></h4>
                            <p class="text-[10px] text-gray-400 mt-0.5">ระบุการเข้าถึงหน้าเว็บและเครื่องมือต่างๆ สำหรับ ${role}</p>
                        </div>
                    </div>
                    <button onclick="togglePermPopup('${key}')" class="text-gray-400 hover:text-white bg-slate-700/50 hover:bg-red-500 rounded-full w-8 h-8 flex items-center justify-center transition border border-slate-600 shadow-sm"><span class="material-icons text-[16px]">close</span></button>
                </div>

                <div class="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar bg-slate-900/50">
                    <div class="grid grid-cols-2 lg:grid-cols-3 gap-5 items-start">
        `;
        
        PERM_GROUPS.forEach(g => {
            const themeClass = colorClasses[g.theme] || colorClasses['blue'];
            const themeColorHex = themeHexColors[g.theme] || '#3b82f6';
            const iconColor = themeClass.split(' ')[0];
            
            popupContentHtml += `
                <div class="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-sm hover:border-slate-500 transition">
                    <div class="bg-slate-900/60 px-4 py-3 border-b border-slate-700 flex items-center gap-2">
                        <span class="material-icons text-[18px] ${iconColor}">${g.icon}</span>
                        <span class="font-bold text-white text-[11px] tracking-wide">${g.name}</span>
                    </div>
                    <div class="p-3 bg-slate-800/80 flex flex-col gap-0.5">
            `;
            
            g.items.forEach(item => {
                const isCheckedAttr = activePerms.includes(item.id) ? 'checked' : '';
                const bgOpacity = activePerms.includes(item.id) ? '1' : '0';
                const borderColor = activePerms.includes(item.id) ? 'transparent' : '';
                const marginLeft = item.isSub ? 'ml-6 pl-2 border-l-2 border-slate-600/50' : 'font-bold bg-slate-700/30 rounded-lg p-1 mb-1';
                const textStyle = item.isSub ? 'text-gray-400 text-[10px]' : 'text-gray-200 text-[11px]';
                
                popupContentHtml += `
                    <label class="relative flex items-center gap-3 ${textStyle} cursor-pointer hover:bg-slate-700 p-2 rounded-lg transition ${marginLeft} group">
                        <input type="checkbox" class="perm-cb absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" 
                               data-key="${key}" data-menu="${item.id}" ${isCheckedAttr}
                               onchange="
                                  this.nextElementSibling.style.borderColor = this.checked ? 'transparent' : '';
                                  this.nextElementSibling.querySelector('.check-bg').style.opacity = this.checked ? '1' : '0';
                                  this.nextElementSibling.querySelector('.check-icon').style.opacity = this.checked ? '1' : '0';
                                  this.nextElementSibling.querySelector('.check-icon').style.transform = this.checked ? 'scale(1)' : 'scale(0.5)';
                               ">
                        <div class="relative w-4 h-4 shrink-0 rounded border-2 border-slate-500 bg-slate-900 transition-all flex items-center justify-center shadow-inner" style="border-color: ${borderColor};">
                            <div class="check-bg absolute inset-0 rounded transition-opacity duration-200" style="background-color: ${themeColorHex}; opacity: ${bgOpacity};"></div>
                            <span class="check-icon material-icons text-[12px] text-white font-bold z-10 transition-all duration-200" style="opacity: ${bgOpacity}; transform: scale(${bgOpacity === '1' ? '1' : '0.5'});">check</span>
                        </div>
                        <span class="flex-1 select-none leading-none group-hover:text-white transition-colors pt-0.5 z-10">${item.name}</span>
                    </label>`;
            });
            popupContentHtml += `</div></div>`;
        });
        
        popupContentHtml += `
                    </div>
                </div>
                <div class="bg-slate-800 border-t border-slate-700 p-5 flex justify-between items-center shrink-0">
                    <span class="text-[10px] text-gray-500 flex items-center gap-1"><span class="material-icons text-[14px]">info</span> กดติ๊กถูกเพื่อเปิดสิทธิ์การใช้งานให้เมนูนั้นๆ</span>
                    <div class="flex gap-2">
                        <button onclick="togglePermPopup('${key}')" class="px-5 py-2.5 rounded-xl text-xs font-bold text-gray-300 hover:bg-slate-700 transition border border-slate-600 shadow-sm">ยกเลิก</button>
                        <button onclick="saveMenuPerms()" class="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-xs font-bold shadow-lg transition flex items-center gap-1 border border-blue-400 active:scale-95"><span class="material-icons text-[16px]">save</span> บันทึกสิทธิ์</button>
                    </div>
                </div>
            </div>`;

        let roleColor = role === 'TRAINER' ? 'bg-fuchsia-900/30 text-fuchsia-400 border-fuchsia-700' : (role === 'MANAGER' ? 'bg-red-900/30 text-red-400 border-red-700' : 'bg-purple-900/30 text-purple-400 border-purple-700');
        let iconColor = role === 'TRAINER' ? 'text-fuchsia-400' : (role === 'MANAGER' ? 'text-red-400' : 'text-purple-400');
        
        let roleOptionsHtml = uniqueRoles.map(r => `<option value="${r}" ${role === r ? 'selected' : ''} class="bg-slate-800 text-white font-bold">${r}</option>`).join('');

        bodyHtml += `
        <tr class="hover:bg-slate-800/30 transition border-b border-slate-700/50">
            <td class="px-6 py-5 border-r border-slate-700 align-top">
                <div class="bg-slate-900 border border-slate-600 px-3 py-3 rounded-xl font-black text-white shadow-inner text-sm w-32 text-center tracking-wider">${dept}</div>
            </td>
            
            <td class="px-6 py-5 border-r border-slate-700 align-top">
                <div class="relative w-32">
                    <select onchange="changePermRowRole('${dept}', this.value)" class="${roleColor} border px-3 py-3 rounded-xl font-black text-[11px] shadow-sm w-full outline-none cursor-pointer appearance-none focus:ring-2 focus:ring-purple-500 transition relative z-10 text-center tracking-wide">
                        ${roleOptionsHtml}
                    </select>
                    <span class="material-icons text-[14px] opacity-70 absolute right-2.5 top-3 pointer-events-none z-20 ${iconColor}">expand_more</span>
                </div>
            </td>
            
            <td class="px-6 py-5 border-r border-slate-700 align-top relative perm-cell" style="overflow: visible;">
                <div onclick="togglePermPopup('${key}')" class="bg-slate-900/30 border border-slate-700 p-4 rounded-2xl min-h-[60px] cursor-pointer hover:border-blue-500/50 hover:bg-slate-800/50 transition shadow-inner">
                    ${badgesHtml}
                </div>
                ${popupContentHtml}
            </td>

            <td class="px-6 py-5 text-center align-middle bg-slate-900/20">
                <button onclick="saveMenuPerms()" class="bg-emerald-600/10 text-emerald-400 border border-emerald-600/50 hover:bg-emerald-500 hover:text-white hover:border-emerald-400 w-16 h-16 rounded-2xl flex flex-col items-center justify-center transition shadow mx-auto group">
                    <span class="material-icons text-xl group-hover:scale-110 transition-transform">save</span>
                    <span class="text-[9px] font-bold mt-1">บันทึก</span>
                </button>
            </td>
        </tr>`;
    });
    tbody.innerHTML = bodyHtml;
};

window.saveMenuPerms = async function() {
    Swal.fire({title: 'กำลังบันทึกสิทธิ์...', didOpen: () => Swal.showLoading()});
    
    let newPerms = JSON.parse(JSON.stringify(MENU_PERMS));
    
    const visibleKeys = new Set();
    document.querySelectorAll('.perm-cb').forEach(cb => {
        visibleKeys.add(cb.getAttribute('data-key'));
    });
    
    visibleKeys.forEach(k => { newPerms[k] = []; });

    document.querySelectorAll('.perm-cb:checked').forEach(cb => {
        const key = cb.getAttribute('data-key');
        const menu = cb.getAttribute('data-menu');
        newPerms[key].push(menu);
    });

    MENU_PERMS = newPerms;
    SETTINGS['dept_menu_rules'] = JSON.stringify(MENU_PERMS);
    
    await appDB.from('settings').upsert([{ key: 'dept_menu_rules', value: JSON.stringify(MENU_PERMS) }]);
    Swal.fire({icon: 'success', title: 'บันทึกสำเร็จ', text: 'อัปเดตสิทธิ์การมองเห็นเมนูเรียบร้อยแล้ว', timer: 1500, showConfirmButton: false});
    renderPermsTable(); 
};

// ฟังก์ชันเพิ่มแผนกใหม่เข้าตารางสิทธิ์
window.addNewPermDept = async function() {
    const { value: newDept } = await Swal.fire({
        title: 'เพิ่มแผนกใหม่',
        input: 'text',
        inputLabel: 'ชื่อย่อแผนก (เช่น MARKETING, CS, VIP)',
        inputPlaceholder: 'พิมพ์ชื่อแผนก...',
        showCancelButton: true,
        confirmButtonText: 'เพิ่ม',
        cancelButtonText: 'ยกเลิก',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-2xl' },
        inputValidator: (value) => {
            if (!value) return 'กรุณาใส่ชื่อแผนกครับ!';
        }
    });

    if (newDept) {
        const upperDept = newDept.trim().toUpperCase();
        const key = `${upperDept}_STAFF`; // สร้างสิทธิ์เริ่มต้นให้เป็น STAFF
        
        if (!MENU_PERMS[key]) {
            MENU_PERMS[key] = [];
            SETTINGS['dept_menu_rules'] = JSON.stringify(MENU_PERMS);
            
            // บันทึกลงฐานข้อมูลเพื่อให้มันเซฟจำไว้
            await appDB.from('settings').upsert([{ key: 'dept_menu_rules', value: JSON.stringify(MENU_PERMS) }]);
            
            renderPermsTable();
            const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
            Toast.fire({ icon: 'success', title: `เพิ่มแผนก ${upperDept} ลงตารางสิทธิ์แล้ว` });
        } else {
            Swal.fire('แจ้งเตือน', 'มีแผนกนี้ในตารางสิทธิ์อยู่แล้วครับ', 'info');
        }
    }
};

window.saveMenuPerms = async function() {
    Swal.fire({title: 'กำลังบันทึกสิทธิ์...', didOpen: () => Swal.showLoading()});
    
    let newPerms = JSON.parse(JSON.stringify(MENU_PERMS));
    
    const visibleKeys = new Set();
    document.querySelectorAll('.perm-cb').forEach(cb => {
        visibleKeys.add(cb.getAttribute('data-key'));
    });
    
    visibleKeys.forEach(k => { newPerms[k] = []; });

    document.querySelectorAll('.perm-cb:checked').forEach(cb => {
        const key = cb.getAttribute('data-key');
        const menu = cb.getAttribute('data-menu');
        newPerms[key].push(menu);
    });

    MENU_PERMS = newPerms;
    SETTINGS['dept_menu_rules'] = JSON.stringify(MENU_PERMS);
    
    await appDB.from('settings').upsert([{ key: 'dept_menu_rules', value: JSON.stringify(MENU_PERMS) }]);
    Swal.fire({icon: 'success', title: 'บันทึกสำเร็จ', text: 'อัปเดตสิทธิ์การมองเห็นเมนูเรียบร้อยแล้ว พนักงานอาจต้องรีเฟรชหน้าเว็บ 1 ครั้งเพื่อเห็นการเปลี่ยนแปลง', timer: 2000, showConfirmButton: false});
    renderPermsTable(); 
};

window.hasUserPerm = function(menuId) {
    if (!window.currentUser) return false;
    
    // 🌟 คืนค่าบรรทัดนี้กลับมา: เพื่อให้ Admin และ Manager มองเห็นทุกเมนูและกดได้ทุกปุ่มเสมอ
    const uRoleLower = (window.currentUser.role || '').toLowerCase().trim();
    if (uRoleLower === 'admin' || uRoleLower === 'manager') return true;
    
    let perms = {};
    try { perms = typeof SETTINGS['dept_menu_rules'] === 'string' ? JSON.parse(SETTINGS['dept_menu_rules']) : (SETTINGS['dept_menu_rules'] || {}); } catch(e) {}
    
    const uDept = window.currentUser.department || 'AM';
    const uRole = uRoleLower === 'trainer' ? 'TRAINER' : 'STAFF';
    const key = `${uDept}_${uRole}`;
    
    const userPerms = perms[key] || [];
    return userPerms.includes(menuId);
};

// ฟังก์ชันสำหรับปุ่มกดเพิ่มทีมผ่านหน้าเว็บ
window.addTeamManual = function(dept) {
    Swal.fire({
        title: `เพิ่มทีมใหม่ (${dept})`,
        input: 'text',
        inputPlaceholder: 'พิมพ์ชื่อทีม / เว็บไซต์...',
        showCancelButton: true,
        confirmButtonText: 'เพิ่มทีม',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: dept === 'AM' ? '#3b82f6' : '#ec4899',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl' }
    }).then((result) => {
        if (result.isConfirmed && result.value) {
            const newTeam = result.value.trim();
            if (!TEAM_LIST.includes(newTeam)) {
                TEAM_LIST.push(newTeam); // ดันชื่อเข้าตัวแปรระบบ
                renderQuotaSettings(); // สั่งให้วาดตารางใหม่
                Swal.fire({
                    icon: 'success', 
                    title: 'เพิ่มเข้าตารางชั่วคราวแล้ว!', 
                    text: `อย่าลืมไปพิมพ์คำว่า '${newTeam}' ใส่ในไฟล์ js/global.js ด้วยนะครับ เพื่อให้มันอยู่ถาวรเวลาคนอื่นเปิดเว็บ`,
                    confirmButtonColor: '#10b981'
                });
            } else {
                Swal.fire('เตือน', 'มีชื่อทีมนี้ในระบบอยู่แล้วครับ', 'warning');
            }
        }
    });
};

// =========================================================
// 🟢 ระบบบังคับซ่อน/โชว์ เมนูด้านซ้าย (Sidebar) (V.7 ดักปุ่มประวัติระบบ)
// =========================================================
window.applySidebarPermissions = async function() {
    let user = window.currentUser;
    if (!user) {
        const savedUser = sessionStorage.getItem('user_platinum_plus');
        if (savedUser) { user = JSON.parse(savedUser); window.currentUser = user; }
        else return; 
    }

    const userRole = (user.role || '').toLowerCase().trim();
    const allMenuBtns = document.querySelectorAll('#menu-list button');
    
    // 🌟 ค้นหาปุ่ม "ประวัติระบบ" ที่แยกอยู่ด้านล่างสุด
    const logsBtn = document.querySelector('button[onclick="openLogsPage()"]');

    // 1. บังคับ "หลับตา" (ซ่อน) แบบเด็ดขาดทะลุ CSS
    allMenuBtns.forEach(btn => {
        const onClickAttr = btn.getAttribute('onclick') || '';
        // ยกเว้นหน้าหลัก กับ หน้าเปลี่ยนรหัส ให้เห็นได้ทุกคน
        if (!onClickAttr.includes('dashboard') && !onClickAttr.includes('password')) {
            btn.classList.add('hidden');
            btn.style.setProperty('display', 'none', 'important'); // บังคับซ่อนขั้นสุด
        }
    });
    document.getElementById('menu-discord')?.classList.add('hidden');
    document.getElementById('menu-admin')?.classList.add('hidden');
    
    // 🌟 สั่งหลับตาปุ่มประวัติระบบไปก่อน
    if (logsBtn) {
        logsBtn.classList.add('hidden');
        logsBtn.style.setProperty('display', 'none', 'important');
    }

    // 2. ดึงตั้งค่าจาก Database
    if (!SETTINGS['dept_menu_rules']) {
        try {
            const { data } = await appDB.from('settings').select('value').eq('key', 'dept_menu_rules').single();
            if (data && data.value) SETTINGS['dept_menu_rules'] = data.value;
        } catch(e) {}
    }

    // 3. "ลืมตา" โชว์เฉพาะปุ่มที่มีสิทธิ์
    PERM_GROUPS.forEach(group => {
        group.items.forEach(item => {
            if (item.isSub) return; 
            
            const canSee = window.hasUserPerm(item.id);
            allMenuBtns.forEach(btn => {
                const onClickAttr = btn.getAttribute('onclick') || '';
                if (onClickAttr.includes(`showPage('${item.id}')`) || onClickAttr.includes(`showPage("${item.id}")`)) {
                    if (canSee) {
                        btn.classList.remove('hidden');
                        btn.style.removeProperty('display'); // คืนค่าการแสดงผล
                    }
                }
            });
        });
    });

    // 4. ดักหมวด DISCORD
    const discordGroup = PERM_GROUPS.find(g => g.id === 'page_discord');
    if (discordGroup) {
        const hasAnyDiscordPerm = discordGroup.items.some(i => window.hasUserPerm(i.id));
        allMenuBtns.forEach(btn => {
            if ((btn.getAttribute('onclick') || '').includes("toggleSubMenu('menu-discord'")) {
                const canSeeDs = hasAnyDiscordPerm || ['admin', 'manager'].includes(userRole);
                if (canSeeDs) {
                    btn.classList.remove('hidden');
                    btn.style.removeProperty('display');
                }
            }
        });
    }

    // 5. ดักหมวด เครื่องมือผู้จัดการ
    allMenuBtns.forEach(btn => {
        const onClickAttr = btn.getAttribute('onclick') || '';
        if (onClickAttr.includes("toggleSubMenu('menu-admin'") || onClickAttr.includes("openAdminPanel()")) {
            
            // 🌟 ให้สิทธิ์คนที่ติ๊ก Checkbox หรือ เป็นแอดมินโดยตรง
            const canSeeAdmin = window.hasUserPerm('admin') || ['admin', 'manager'].includes(userRole); 
            
            if (canSeeAdmin) {
                btn.classList.remove('hidden');
                btn.style.removeProperty('display');
            }
        }
    });

    // 🌟 6. ดักปุ่ม "ประวัติระบบ" (ซ้ายล่างสุด)
    if (logsBtn) {
        // เช็คว่าถ้าเป็นแอดมินหลัก หรือ มีสิทธิ์ 'admin_logs' ก็ให้โชว์ปุ่มได้
        const canSeeLogs = ['admin', 'manager'].includes(userRole) || window.hasUserPerm('admin_logs');
        if (canSeeLogs) {
            logsBtn.classList.remove('hidden');
            logsBtn.style.removeProperty('display');
        }
    }
};

// สั่งรันทันที ป้องกันเมนูกระพริบ
applySidebarPermissions();
setTimeout(applySidebarPermissions, 500);
setTimeout(applySidebarPermissions, 1500);

// =========================================================
// 🟢 ระบบเพิ่มรอบเวลาเอง (ดึงข้อมูลเก่า + ค่าเริ่มต้น)
// =========================================================

window.applyCustomTimeSlots = function() {
    try {
        let rawData = SETTINGS['custom_time_slots'] || SETTINGS['shift_time_slots'] || SETTINGS['manual_time_slots'];
        
        if (!rawData) {
            // 💡 ถ้าในฐานข้อมูลไม่มี ให้ดึงเวลาตั้งต้น (Default) ของระบบเก่ามาใช้เลย
            const defaultTimeSlots = {
                'กะเช้า': {
                    'ช่วงที่ 1': ['08:00-08:30', '08:30-09:00', '09:00-09:30', '09:30-10:00'],
                    'ช่วงที่ 2': ['12:00-12:30', '12:30-13:00', '13:00-13:30', '13:30-14:00'],
                    'ช่วงที่ 3': ['16:00-16:30', '16:30-17:00']
                },
                'กะกลาง': {
                    'ช่วงที่ 1': ['12:00-12:30', '12:30-13:00', '13:00-13:30', '13:30-14:00'],
                    'ช่วงที่ 2': ['16:00-16:30', '16:30-17:00', '17:00-17:30', '17:30-18:00'],
                    'ช่วงที่ 3': ['20:00-20:30', '20:30-21:00', '21:00-21:30']
                },
                'กะดึก': {
                    'ช่วงที่ 1': ['20:00-20:30', '20:30-21:00', '21:00-21:30', '21:30-22:00'],
                    'ช่วงที่ 2': ['00:00-00:30', '00:30-01:00', '01:00-01:30', '01:30-02:00'],
                    'ช่วงที่ 3': ['04:00-04:30', '04:30-05:00', '05:00-05:30', '05:30-06:00']
                }
            };
            SHIFT_GROUPS = defaultTimeSlots;
        } else {
            SHIFT_GROUPS = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
        }
    } catch(e) { console.error('Error applying custom time slots:', e); }
};

window.renderManualTimeSlots = function() {
    const container = document.getElementById('manualTimeSlotsContainer');
    if (!container) return;

    let html = '';
    let count = 0;

    // ดึงค่าจาก SHIFT_GROUPS มาวาดลงตาราง
    for (const [shift, periods] of Object.entries(SHIFT_GROUPS)) {
        for (const [period, slots] of Object.entries(periods)) {
            slots.forEach(slot => {
                let sName = shift.replace('กะ', '');
                let pName = period.replace('ช่วงที่ ', 'P');
                let colorClass = sName === 'เช้า' ? 'text-orange-400' : (sName === 'กลาง' ? 'text-blue-400' : 'text-purple-400');
                
                html += `
                <div class="flex justify-between items-center bg-slate-800 p-2 rounded-lg border border-slate-600/50 shadow-sm mb-1.5">
                    <div class="flex items-center gap-2 text-[10px] font-bold ${colorClass}">
                        <span class="w-12">${sName} ${pName}</span>
                        <span class="text-gray-300 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-700 tracking-wider shadow-inner">${slot}</span>
                    </div>
                    <button type="button" onclick="deleteManualTimeSlot('${shift}', '${period}', '${slot}')" class="text-red-400 hover:text-red-500 hover:bg-red-900/30 p-1 rounded transition" title="ลบเวลา">
                        <span class="material-icons text-[14px]">delete</span>
                    </button>
                </div>`;
                count++;
            });
        }
    }

    if (count === 0) {
        container.innerHTML = '<div class="text-center text-gray-600 text-xs py-4">ยังไม่มีการตั้งค่า</div>';
    } else {
        container.innerHTML = html;
    }
};

window.addManualTimeSlot = async function() {
    const shiftSelect = document.getElementById('newTimeShift').value; 
    const periodSelect = document.getElementById('newTimePeriod').value; 
    const start = document.getElementById('newTimeStart').value;
    const end = document.getElementById('newTimeEnd').value;

    if (!start || !end) return Swal.fire('เตือน', 'กรุณาระบุเวลาให้ครบ', 'warning');
    if (start >= end) return Swal.fire('เตือน', 'เวลาเริ่มต้องน้อยกว่าเวลาจบ', 'warning');

    const timeSlot = `${start}-${end}`;

    if (!SHIFT_GROUPS[shiftSelect]) SHIFT_GROUPS[shiftSelect] = {};
    if (!SHIFT_GROUPS[shiftSelect][periodSelect]) SHIFT_GROUPS[shiftSelect][periodSelect] = [];
    
    if (SHIFT_GROUPS[shiftSelect][periodSelect].includes(timeSlot)) {
        return Swal.fire('เตือน', 'มีรอบเวลานี้อยู่แล้ว', 'warning');
    }

    SHIFT_GROUPS[shiftSelect][periodSelect].push(timeSlot);
    SHIFT_GROUPS[shiftSelect][periodSelect].sort();

    SETTINGS['custom_time_slots'] = JSON.stringify(SHIFT_GROUPS);
    
    Swal.fire({title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
    await appDB.from('settings').upsert([{ key: 'custom_time_slots', value: JSON.stringify(SHIFT_GROUPS) }]);
    
    renderManualTimeSlots();
    
    document.getElementById('newTimeStart').value = '';
    document.getElementById('newTimeEnd').value = '';
    
    Swal.fire({icon: 'success', title: 'เพิ่มสำเร็จ', timer: 1000, showConfirmButton: false});
};

window.deleteManualTimeSlot = async function(shift, period, timeSlot) {
    if (SHIFT_GROUPS[shift] && SHIFT_GROUPS[shift][period]) {
        SHIFT_GROUPS[shift][period] = SHIFT_GROUPS[shift][period].filter(t => t !== timeSlot);
        if (SHIFT_GROUPS[shift][period].length === 0) delete SHIFT_GROUPS[shift][period];
        if (Object.keys(SHIFT_GROUPS[shift]).length === 0) delete SHIFT_GROUPS[shift];
    }

    SETTINGS['custom_time_slots'] = JSON.stringify(SHIFT_GROUPS);
    
    Swal.fire({title: 'กำลังลบ...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
    await appDB.from('settings').upsert([{ key: 'custom_time_slots', value: JSON.stringify(SHIFT_GROUPS) }]);
    
    renderManualTimeSlots();
    Swal.fire({icon: 'success', title: 'ลบสำเร็จ', timer: 1000, showConfirmButton: false});
};

// ==========================================
// 🟢 ควบคุมการสลับหน้า (แอดมิน / ประวัติ / หน้าหลัก)
// ==========================================
window.openAdminPanel = async function() {
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
    const btnInfo = document.getElementById('btnAdminTab_info');

    if(btnSettings) btnSettings.style.display = canSeeSettings ? '' : 'none';
    if(btnUsers) btnUsers.style.display = canSeeUsers ? '' : 'none';
    if(btnPerms) btnPerms.style.display = canSeePerms ? '' : 'none';
    if(btnInfo) btnInfo.style.display = canSeeInfo ? '' : 'none';

    // 🌟 5. สั่งให้ระบบ "เปิดแท็บแรก" ที่พนักงานคนนั้นมีสิทธิ์เห็นโดยอัตโนมัติ
    if (typeof switchAdminTab === 'function') {
        if (canSeeSettings) switchAdminTab('settings');
        else if (canSeeUsers) switchAdminTab('users');
        else if (canSeePerms) switchAdminTab('perms');
        else if (canSeeInfo) switchAdminTab('info');
    }

    // 🌟 6. ข้อมูลมาครบ วาดตารางเสร็จ สั่งปิดวงกลมหมุนๆ ได้
    Swal.close();
};

// =========================================================
// 🔴 ฟังก์ชันล้างกระดาน (เลือก ลบตามแผนก / ตามกะ ได้ + กู้คืนได้)
// =========================================================
window.clearAllSchedules = async function() {
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

            // สั่งให้ตารางรีเฟรชตัวเอง
            if (typeof fetchData === 'function') fetchData();

        } catch(e) {
            console.error(e);
            Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถกู้คืนได้: ' + e.message, 'error');
        }
    }
};
