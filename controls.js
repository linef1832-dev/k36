// ════════════════════════════════════════════════════════════════════
// 📦 leave/controls.js — ส่วนที่ 3/3 ของระบบลา/พัก (แยกจาก leave.js เดิม 1,676 บรรทัด)
// เนื้อหา: เปลี่ยนเดือน/ปฏิทิน, toggle รายการ, บันทึกตั้งค่า, หน่วงค้นหา
// ⚠️ ลำดับโหลด: leave/core → leave/table → leave/controls (ห้ามสลับ — ตัวแปร top-level แชร์ scope เดียวกัน)
// ════════════════════════════════════════════════════════════════════
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

        // [FIX] sync is_open ให้ AMQL/ODQL ตามไปด้วยเสมอ
        if (dept === 'AM') updates.push({ key: 'AMQL_is_open', value: String(forceOpen) });
        if (dept === 'OD') updates.push({ key: 'ODQL_is_open', value: String(forceOpen) });

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
                return u.role === 'staff' && uDept === currentViewDept;
            }).sort((a,b) => a.username.localeCompare(b.username));

            if (staffList.length === 0) { Swal.close(); return Swal.fire('ไม่มีข้อมูล', `ไม่มีรายชื่อพนักงานในแผนก ${currentViewDept}`, 'warning'); }

            const bookedMap = new Map();
            allLeaveData.forEach(l => { 
                const cleanDate = String(l.leave_date || '').split('T')[0].split(' ')[0];
                const rsn = (l.reason === 'Table-Booking' || !l.reason) ? 'X' : l.reason; 
                bookedMap.set(`${l.user_id}_${cleanDate}`, rsn); 
            });

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

        // [FIX] หน้า AMQL บันทึกลง AM, ODQL บันทึกลง OD เพราะระบบอ่านค่าจาก AM/OD
        let _saveDept = currentViewDept;
        if (currentViewDept === 'AMQL') _saveDept = 'AM';
        else if (currentViewDept === 'ODQL') _saveDept = 'OD';

        const upsertRows = [{ key: `${_saveDept}_is_open`, value: statusValue }];
        // sync ค่ากลับให้ตัวเองด้วย กันสับสน
        if (_saveDept !== currentViewDept) {
            upsertRows.push({ key: `${currentViewDept}_is_open`, value: statusValue });
        }

        const { error } = await appDB.from('settings').upsert(upsertRows);

        if (error) throw error;

        if(deptSettings[_saveDept]) deptSettings[_saveDept].isOpen = isChecked;
        if(deptSettings[currentViewDept]) deptSettings[currentViewDept].isOpen = isChecked;

        Swal.fire({ 
            icon: 'success', title: 'บันทึกสำเร็จ!', 
            text: `ระบบจองวันหยุดถูก ${isChecked ? 'เปิด' : 'ปิด'} แล้ว`, 
            timer: 1500, showConfirmButton: false 
        });

    } catch (error) {
        console.error('Toggle Leave Error:', error);
        Swal.fire('เกิดข้อผิดพลาด', error.message, 'error');
        if(document.getElementById('setForceOpen')) document.getElementById('setForceOpen').checked = !isChecked; 
    }
};

window.loadLeaveStatusConfig = async function() {
    try {
        // [FIX] อ่านจาก deptSettings ที่โหลดมาถูกต้องแล้ว
        if (!window.leaveStatusConfig) window.leaveStatusConfig = {};
        ['AM','OD','TRAINER','AMQL','ODQL','SPECIAL','NEW'].forEach(dept => {
            if (deptSettings[dept]) {
                window.leaveStatusConfig[dept] = deptSettings[dept].isOpen ? 'true' : 'false';
            }
        });
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

setTimeout(async () => {
    // รอ appDB พร้อมก่อน (สูงสุด 5 วินาที)
    let waited = 0;
    while (typeof appDB === 'undefined' && waited < 5000) {
        await new Promise(r => setTimeout(r, 200));
        waited += 200;
    }
    if (typeof loadLeaveStatusConfig === 'function') loadLeaveStatusConfig();
}, 500);

setTimeout(() => {
    const targetNode = document.getElementById('settingTargetLabel');
    if (targetNode) {
        const observer = new MutationObserver(() => { updateLeaveToggleUI(); });
        observer.observe(targetNode, { childList: true, characterData: true, subtree: true });
    }
}, 1000);

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

// =========================================
// 🌟 ระบบหน่วงเวลาช่องค้นหา (พิมพ์เสร็จค่อยหา)
// =========================================
let leaveSearchTimeout = null;
window.onLeaveSearch = function() {
    clearTimeout(leaveSearchTimeout);
    leaveSearchTimeout = setTimeout(() => {
        renderLeaveTable(); // สั่งวาดตารางเมื่อหยุดพิมพ์ไปแล้ว 300ms
    }, 300); 
};

window.openManageSpecialModal = async function() {
    const users = GLOBAL_USER_LIST.filter(u => u.role === 'staff' || u.role === 'manager' || u.role === 'admin').sort((a, b) => a.username.localeCompare(b.username));
    
    // โหลดข้อมูลล่าสุดกันเหนียว
    window.specialGroupUserIds = window.specialGroupUserIds || [];

    let html = `
        <div class="flex flex-col h-full text-left">
            <div class="sticky top-0 bg-white dark:bg-slate-800 z-10 pb-2 border-b border-gray-200 dark:border-gray-600 mb-2">
                <input type="text" id="specialSearchInput" onkeyup="filterSpecialList()" placeholder="🔍 พิมพ์ชื่อเพื่อค้นหา..." 
                    class="w-full p-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-amber-500 transition font-bold text-sm">
            </div>
            <div id="specialListContainer" class="max-h-[50vh] overflow-y-auto custom-scrollbar pr-1">
    `;
    
    users.forEach(u => {
        // เช็คว่าเคยถูกติ๊กเลือกไว้ในกลุ่มพิเศษหรือยัง
        const isSpecial = window.specialGroupUserIds.includes(String(u.id)); 
        const currentDept = u.department || 'AM';
        
        let badgeColor = 'bg-blue-100 text-blue-700';
        if(currentDept === 'OD') badgeColor = 'bg-pink-100 text-pink-700';
        else if(currentDept === 'TRAINER') badgeColor = 'bg-cyan-100 text-cyan-700';
        
        html += `
            <label class="flex items-center justify-between p-2 hover:bg-amber-50 dark:hover:bg-slate-700/50 rounded-lg cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-0 transition group">
                <div class="flex items-center gap-2">
                    <span class="staff-name font-bold text-sm text-slate-700 dark:text-gray-200 group-hover:text-amber-600 transition">${u.username}</span>
                    <span class="text-[9px] font-bold ${badgeColor} px-1.5 py-0.5 rounded border border-black/5 shadow-sm">${currentDept}</span>
                </div>
                <input type="checkbox" class="special-cb w-5 h-5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer border-gray-300" value="${u.id}" ${isSpecial ? 'checked' : ''}>
            </label>
        `;
    });
    html += '</div></div>';

    const { value: selectedIds } = await Swal.fire({
        title: 'จัดการรายชื่อ (พนักงานใหม่)', html: html, showCancelButton: true, confirmButtonText: 'บันทึก', confirmButtonColor: '#f59e0b', cancelButtonText: 'ยกเลิก', width: '400px',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white' },
        preConfirm: () => {
            const checkboxes = document.querySelectorAll('.special-cb:checked');
            const ids = []; checkboxes.forEach(cb => ids.push(String(cb.value))); return ids;
        }
    });

    if (selectedIds) {
        Swal.fire({title: 'กำลังบันทึกกลุ่ม...', didOpen: () => Swal.showLoading()});
        
        // 🌟 บันทึก ID ลงในตั้งค่าระบบ โดยไม่ไปแตะแผนกหลักของพนักงาน
        window.specialGroupUserIds = selectedIds;
        await appDB.from('settings').upsert([{ key: 'leave_special_users', value: JSON.stringify(window.specialGroupUserIds) }]);

        window.renderLeaveTable();
        Swal.fire({ icon: 'success', title: 'สำเร็จ', text: 'อัปเดตรายชื่อในกลุ่มเรียบร้อย', timer: 2000, showConfirmButton: false });
    }
};

window.filterSpecialList = function() {
    const input = document.getElementById('specialSearchInput'); const filter = input.value.toLowerCase();
    const container = document.getElementById('specialListContainer'); const labels = container.getElementsByTagName('label');
    for (let i = 0; i < labels.length; i++) {
        const nameSpan = labels[i].querySelector('.staff-name');
        if (nameSpan) {
            const txtValue = nameSpan.textContent || nameSpan.innerText;
            labels[i].style.display = txtValue.toLowerCase().indexOf(filter) > -1 ? "flex" : "none";
        }
    }
};

window.removeFromSpecialDept = async function(id, username) {
    Swal.fire({
        title: 'ยืนยันการนำออก?',
        text: `ต้องการเอา ${username} ออกจากกลุ่มพิเศษนี้ใช่หรือไม่? (พนักงานจะยังอยู่ในแผนกปกติ)`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#f59e0b',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'ใช่, นำออกเลย',
        cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({title: 'กำลังนำออก...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
            
            // 🌟 ลบ ID ออกจาก Array แล้วบันทึกกลับลงไป
            window.specialGroupUserIds = window.specialGroupUserIds.filter(uid => String(uid) !== String(id));
            await appDB.from('settings').upsert([{ key: 'leave_special_users', value: JSON.stringify(window.specialGroupUserIds) }]);
            
            window.renderLeaveTable();
            Swal.fire({ icon: 'success', title: 'นำออกสำเร็จ', timer: 1500, showConfirmButton: false });
        }
    });
};

// ฟังก์ชันสำหรับดึงสีของป้ายวันหยุดแต่ละประเภท
function getLeaveBadgeStyle(reason, baseDeptColor) {
    if (reason === 'X') return 'bg-red-500 border border-red-600';
    if (reason === 'XX') return 'bg-yellow-400 text-yellow-900 border border-yellow-500';
    if (reason === 'X4') return 'bg-fuchsia-500 border border-fuchsia-600';
    if (reason === 'KL') return 'bg-green-500 border border-green-600';
    if (reason === 'TX') return 'bg-blue-500 border border-blue-600';
    if (reason === 'PN') return 'bg-orange-500 border border-orange-600';
    if (reason === 'KP') return 'bg-stone-500 border border-stone-600';
    return baseDeptColor;
}

// ผูกเข้ากับ window เผื่อมีการเรียกใช้จากจุดอื่น
window.getLeaveBadgeStyle = getLeaveBadgeStyle;

// ฟังก์ชันรับสัญญาณเรียลไทม์เวลาแอดมินกดสลับกะ
window.subscribeScheduledTasksChanges = function() {
    if(window.scheduledTasksSubscription) appDB.removeChannel(window.scheduledTasksSubscription);
    window.scheduledTasksSubscription = appDB.channel('tasks-leave-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_tasks' }, (payload) => {
        const leaveAppEl = document.getElementById('leaveApp');
        if (leaveAppEl && !leaveAppEl.classList.contains('hidden')) {
            if (typeof fetchLeaveData === 'function') fetchLeaveData();
        }
    }).subscribe();
    if (typeof window.registerPageSubscription === 'function') window.registerPageSubscription(window.scheduledTasksSubscription);
};

// ผูกฟังก์ชันเข้ากับ window ป้องกัน error หาไม่เจอ
if (typeof subscribeScheduledTasksChanges === 'undefined') {
    var subscribeScheduledTasksChanges = window.subscribeScheduledTasksChanges;
}
