let withdrawalReportData = [];
let staffDutyMap = {}; 

// 🟢 ตัวแปรสำหรับ Pagination
let withdrawalCurrentPage = 1;
const WITHDRAWAL_PAGE_SIZE = 50;

const W_SUPABASE_LOGS_URL = 'https://zedbbtjxuidfubpiauyb.supabase.co/rest/v1/staff_withdrawal_logs';
const W_SUPABASE_SETTING_URL = 'https://zedbbtjxuidfubpiauyb.supabase.co/rest/v1/settings';
const W_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplZGJidGp4dWlkZnVicGlhdXliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2MjQ2ODgsImV4cCI6MjA4MzIwMDY4OH0.4orJyfFcOwnZcnHFjLOTLXaqFNeapCVe9yCxj3rLMBM';

window.initWithdrawalReport = async function() {
    const tbody = document.getElementById('withdrawalReportBody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-10"><span class="material-icons animate-spin text-emerald-500">sync</span> กำลังประมวลผลข้อมูลและตารางงาน...</td></tr>';
    
    // Reset หน้าเป็น 1 ทุกครั้งที่รีเฟรช
    withdrawalCurrentPage = 1;
    
    try {
        // 🟢 คำนวณช่วงเวลา "วันนี้ตามเวลาไทย" (UTC+7)
        // 00:00:00 ของวันนี้ที่ไทย = 17:00:00 UTC ของเมื่อวาน
        const now = new Date();
        const thOffsetMs = 7 * 60 * 60 * 1000; // +7 ชั่วโมง
        
        // เวลา "ตอนนี้" ในไทย (ใช้คำนวณวันที่ไทย)
        const nowInTh = new Date(now.getTime() + thOffsetMs);
        const yyyy = nowInTh.getUTCFullYear();
        const mm = String(nowInTh.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(nowInTh.getUTCDate()).padStart(2, '0');
        const todayDateStr = `${yyyy}-${mm}-${dd}`; // ใช้ค้นหา duty roster
        
        // จุดเริ่มต้นของวันไทย แปลงกลับเป็น UTC ISO เพื่อ query
        const startOfDayThUtc = new Date(Date.UTC(yyyy, nowInTh.getUTCMonth(), nowInTh.getUTCDate(), 0, 0, 0));
        const startUtcIso = new Date(startOfDayThUtc.getTime() - thOffsetMs).toISOString();
        
        // จุดสิ้นสุดของวันไทย (เริ่มต้นของวันถัดไป)
        const endOfDayThUtc = new Date(Date.UTC(yyyy, nowInTh.getUTCMonth(), nowInTh.getUTCDate() + 1, 0, 0, 0));
        const endUtcIso = new Date(endOfDayThUtc.getTime() - thOffsetMs).toISOString();

        // 🟢 ดึงตารางจัดงานของวันนี้
        staffDutyMap = {};
        const rosterRes = await fetch(`${W_SUPABASE_SETTING_URL}?select=value,key&key=ilike.*duty_roster_*${todayDateStr}*`, {
            method: 'GET', headers: { 'apikey': W_SUPABASE_KEY, 'Authorization': `Bearer ${W_SUPABASE_KEY}` }
        });
        
        if (rosterRes.ok) {
            const rosterRows = await rosterRes.json();
            rosterRows.forEach(row => {
                try {
                    const rosterObj = JSON.parse(row.value);
                    for (const primaryTeam in rosterObj) {
                        rosterObj[primaryTeam].forEach(u => {
                            if (!u.username.includes('ขาดคน')) {
                                staffDutyMap[u.username.toLowerCase()] = {
                                    primary: primaryTeam,
                                    secondary: u.secondary_team || null
                                };
                            }
                        });
                    }
                } catch(e) {}
            });
        }

        // 🟢 ดึงเฉพาะรายการที่อยู่ในวันนี้ (เวลาไทย) - กรองทั้ง gte และ lt
        const logRes = await fetch(`${W_SUPABASE_LOGS_URL}?select=*&created_at=gte.${startUtcIso}&created_at=lt.${endUtcIso}&order=created_at.desc`, {
            method: 'GET', headers: { 'apikey': W_SUPABASE_KEY, 'Authorization': `Bearer ${W_SUPABASE_KEY}` }
        });

        if (logRes.ok) {
            withdrawalReportData = await logRes.json();
            renderWithdrawalDashboard(); 
            renderWithdrawalTable();     
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-10 text-red-500">ไม่สามารถดึงข้อมูลประวัติได้</td></tr>';
        }
    } catch (error) {
        console.error('Withdrawal Report Error:', error);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-10 text-red-500">เกิดข้อผิดพลาดในการเชื่อมต่อ</td></tr>';
    }
};

window.renderWithdrawalDashboard = function() {
    let total = withdrawalReportData.length;
    let primaryTotalCount = 0;
    let secondaryTotalCount = 0;
    let staffStats = {};

    withdrawalReportData.forEach(row => {
        let sys = row.backend_system;
        let rawName = row.staff_username || 'ไม่ระบุตัวตน';
        let sName = rawName.toLowerCase();
        
        if (!staffStats[sName]) {
            staffStats[sName] = { 
                displayName: rawName,
                total: 0, primaryCount: 0, secondaryCount: 0, otherCount: 0,
                assignedPrimary: staffDutyMap[sName] ? staffDutyMap[sName].primary : 'ไม่มีงานหลัก',
                assignedSecondary: staffDutyMap[sName] && staffDutyMap[sName].secondary ? staffDutyMap[sName].secondary : '-'
            };
        }

        staffStats[sName].total++;

        let dutyInfo = staffDutyMap[sName];
        if (dutyInfo && sys === dutyInfo.primary) {
            staffStats[sName].primaryCount++;
            primaryTotalCount++;
        } else if (dutyInfo && sys === dutyInfo.secondary) {
            staffStats[sName].secondaryCount++;
            secondaryTotalCount++;
        } else {
            staffStats[sName].otherCount++;
        }
    });

    document.getElementById('sumTotal').innerText = total.toLocaleString();
    document.getElementById('sumPrimary').innerText = primaryTotalCount.toLocaleString();
    document.getElementById('sumSecondary').innerText = secondaryTotalCount.toLocaleString();

    const staffGrid = document.getElementById('staffSummaryGrid');
    if (total === 0) {
        staffGrid.innerHTML = '<div class="col-span-full text-center text-gray-500 text-xs py-4">ยังไม่มีพนักงานทำรายการในกะนี้</div>';
    } else {
        let staffHtml = '';
        let sortedStaff = Object.entries(staffStats).sort((a,b) => b[1].total - a[1].total);

        sortedStaff.forEach(([name, data]) => {
            staffHtml += `
                <div class="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex justify-between items-center shadow-sm hover:border-emerald-500/50 transition">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center font-black text-sm shadow-inner shrink-0 border border-emerald-500/30">
                            ${data.displayName.substring(0,2).toUpperCase()}
                        </div>
                        <div>
                            <div class="font-bold text-slate-800 dark:text-white text-[15px] tracking-wide uppercase">${data.displayName}</div>
                            <div class="text-[10px] text-gray-500 dark:text-gray-400 font-bold mt-1 flex flex-wrap gap-1">
                                <span class="bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">หลัก (${data.assignedPrimary}): ${data.primaryCount}</span>
                                <span class="bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20">รอง (${data.assignedSecondary}): ${data.secondaryCount}</span>
                                ${data.otherCount > 0 ? `<span class="bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded border border-red-500/20">เว็บอื่น: ${data.otherCount}</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="text-right shrink-0 ml-2">
                        <div class="text-3xl font-black text-slate-800 dark:text-white leading-none">${data.total}</div>
                        <div class="text-[10px] text-emerald-500 font-bold">รายการ</div>
                    </div>
                </div>
            `;
        });
        staffGrid.innerHTML = staffHtml;
    }
};

window.renderWithdrawalTable = function() {
    const tbody = document.getElementById('withdrawalReportBody');
    if (!tbody) return;
    
    if (withdrawalReportData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-10 text-gray-500">ไม่มีประวัติการกดในวันนี้</td></tr>';
        renderWithdrawalPagination(0);
        return;
    }

    // 🟢 คำนวณ Pagination
    const totalRecords = withdrawalReportData.length;
    const totalPages = Math.max(1, Math.ceil(totalRecords / WITHDRAWAL_PAGE_SIZE));
    if (withdrawalCurrentPage > totalPages) withdrawalCurrentPage = totalPages;
    
    const startIdx = (withdrawalCurrentPage - 1) * WITHDRAWAL_PAGE_SIZE;
    const endIdx = Math.min(startIdx + WITHDRAWAL_PAGE_SIZE, totalRecords);
    const pageData = withdrawalReportData.slice(startIdx, endIdx);
    
    tbody.innerHTML = pageData.map((row, index) => {
        const dateObj = new Date(row.created_at);
        const formattedDate = dateObj.toLocaleString('th-TH');
        
        let actionBadge = row.action_type === 'Approve' 
            ? '<span class="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold">อนุมัติ</span>' 
            : '<span class="bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded text-[10px] font-bold">ปฏิเสธ</span>';

        let sName = (row.staff_username || '').toLowerCase();
        let dutyInfo = staffDutyMap[sName];
        let statusDutyBadge = '<span class="text-gray-400 font-bold text-[10px]">นอกหน้าที่ / ไม่ระบุ</span>';
        
        if (dutyInfo) {
            if (row.backend_system === dutyInfo.primary) {
                statusDutyBadge = '<span class="bg-blue-500 text-white px-2 py-0.5 rounded text-[10px] font-bold shadow-sm">งานหลัก</span>';
            } else if (row.backend_system === dutyInfo.secondary) {
                statusDutyBadge = '<span class="bg-amber-500 text-white px-2 py-0.5 rounded text-[10px] font-bold shadow-sm">งานรอง</span>';
            }
        }

        return `
            <tr class="hover:bg-slate-800 transition border-b border-slate-700/50">
                <td class="p-3 text-center text-xs text-gray-500">${startIdx + index + 1}</td>
                <td class="p-3 text-xs text-gray-400 font-mono">${formattedDate}</td>
                <td class="p-3 font-bold text-white text-xs uppercase">${row.staff_username}</td>
                <td class="p-3 text-emerald-400 font-bold text-xs">${row.backend_system}</td>
                <td class="p-3">${statusDutyBadge}</td>
                <td class="p-3 text-center">${actionBadge}</td>
            </tr>`;
    }).join('');
    
    renderWithdrawalPagination(totalRecords);
};

// 🟢 ฟังก์ชันใหม่: สร้าง UI Pagination
window.renderWithdrawalPagination = function(totalRecords) {
    const container = document.getElementById('withdrawalPagination');
    if (!container) return;
    
    if (totalRecords === 0) {
        container.innerHTML = '';
        return;
    }
    
    const totalPages = Math.max(1, Math.ceil(totalRecords / WITHDRAWAL_PAGE_SIZE));
    const startIdx = (withdrawalCurrentPage - 1) * WITHDRAWAL_PAGE_SIZE;
    const endIdx = Math.min(startIdx + WITHDRAWAL_PAGE_SIZE, totalRecords);
    
    // สร้างปุ่มเลขหน้า (แสดงไม่เกิน 7 ปุ่ม)
    let pageButtons = '';
    let startPage = Math.max(1, withdrawalCurrentPage - 3);
    let endPage = Math.min(totalPages, startPage + 6);
    if (endPage - startPage < 6) startPage = Math.max(1, endPage - 6);
    
    if (startPage > 1) {
        pageButtons += `<button onclick="goToWithdrawalPage(1)" class="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-700 text-gray-300 hover:bg-slate-600 transition">1</button>`;
        if (startPage > 2) pageButtons += `<span class="text-gray-500 px-1">...</span>`;
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const isActive = i === withdrawalCurrentPage;
        pageButtons += `<button onclick="goToWithdrawalPage(${i})" class="px-3 py-1.5 text-xs font-bold rounded-lg transition ${isActive ? 'bg-emerald-500 text-white shadow-md' : 'bg-slate-700 text-gray-300 hover:bg-slate-600'}">${i}</button>`;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) pageButtons += `<span class="text-gray-500 px-1">...</span>`;
        pageButtons += `<button onclick="goToWithdrawalPage(${totalPages})" class="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-700 text-gray-300 hover:bg-slate-600 transition">${totalPages}</button>`;
    }
    
    const prevDisabled = withdrawalCurrentPage <= 1;
    const nextDisabled = withdrawalCurrentPage >= totalPages;
    
    container.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-slate-700/50 bg-slate-900/50">
            <div class="text-xs text-gray-400 font-bold">
                แสดง <span class="text-emerald-400">${startIdx + 1}-${endIdx}</span> จากทั้งหมด <span class="text-emerald-400">${totalRecords.toLocaleString()}</span> รายการ
            </div>
            <div class="flex items-center gap-1.5 flex-wrap">
                <button onclick="goToWithdrawalPage(${withdrawalCurrentPage - 1})" ${prevDisabled ? 'disabled' : ''} class="px-3 py-1.5 text-xs font-bold rounded-lg ${prevDisabled ? 'bg-slate-800 text-gray-600 cursor-not-allowed' : 'bg-slate-700 text-gray-300 hover:bg-slate-600'} transition flex items-center gap-1">
                    <span class="material-icons text-sm">chevron_left</span> ก่อนหน้า
                </button>
                ${pageButtons}
                <button onclick="goToWithdrawalPage(${withdrawalCurrentPage + 1})" ${nextDisabled ? 'disabled' : ''} class="px-3 py-1.5 text-xs font-bold rounded-lg ${nextDisabled ? 'bg-slate-800 text-gray-600 cursor-not-allowed' : 'bg-slate-700 text-gray-300 hover:bg-slate-600'} transition flex items-center gap-1">
                    ถัดไป <span class="material-icons text-sm">chevron_right</span>
                </button>
            </div>
        </div>
    `;
};

// 🟢 ฟังก์ชันใหม่: เปลี่ยนหน้า
window.goToWithdrawalPage = function(page) {
    const totalPages = Math.max(1, Math.ceil(withdrawalReportData.length / WITHDRAWAL_PAGE_SIZE));
    if (page < 1 || page > totalPages) return;
    withdrawalCurrentPage = page;
    renderWithdrawalTable();
    
    // Scroll ตารางขึ้นบนสุด
    const tableWrap = document.getElementById('withdrawalTableWrap');
    if (tableWrap) tableWrap.scrollTop = 0;
};

window.exportWithdrawalToExcel = function() {
    if (withdrawalReportData.length === 0) {
        Swal.fire('แจ้งเตือน', 'ไม่มีข้อมูลสำหรับดาวน์โหลด', 'warning'); return;
    }
    
    if (typeof window.loadExcelLibrary === 'function') {
        window.loadExcelLibrary(processExcel);
    } else {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
        script.onload = () => processExcel();
        document.head.appendChild(script);
    }

    function processExcel() {
        Swal.fire({ title: 'กำลังโหลด Excel...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const excelData = withdrawalReportData.map((row, index) => {
            let sName = (row.staff_username || '').toLowerCase();
            let dutyInfo = staffDutyMap[sName];
            let dutyType = 'นอกหน้าที่';
            
            if (dutyInfo) {
                if (row.backend_system === dutyInfo.primary) dutyType = 'งานหลัก';
                else if (row.backend_system === dutyInfo.secondary) dutyType = 'งานรอง';
            }

            return {
                "ลำดับ": index + 1,
                "วัน-เวลาที่ทำรายการ": new Date(row.created_at).toLocaleString('th-TH'),
                "รหัสพนักงาน": row.staff_username,
                "ระบบที่กดถอน": row.backend_system,
                "ประเภทหน้าที่": dutyType,
                "สถานะ (Approve/Reject)": row.action_type === 'Approve' ? 'อนุมัติ' : 'ปฏิเสธ'
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Withdrawal_Logs");
        
        const dateStr = new Date().toISOString().split('T')[0];
        XLSX.writeFile(workbook, `Staff_Withdrawal_Report_${dateStr}.xlsx`);
        Swal.fire({ icon: 'success', title: 'ดาวน์โหลดสำเร็จ', timer: 1500, showConfirmButton: false });
    }
};
