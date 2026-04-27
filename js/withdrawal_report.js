let withdrawalReportData = [];
const W_SUPABASE_URL = 'https://zedbbtjxuidfubpiauyb.supabase.co/rest/v1/staff_withdrawal_logs';
const W_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplZGJidGp4dWlkZnVicGlhdXliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2MjQ2ODgsImV4cCI6MjA4MzIwMDY4OH0.4orJyfFcOwnZcnHFjLOTLXaqFNeapCVe9yCxj3rLMBM';

window.initWithdrawalReport = async function() {
    const tbody = document.getElementById('withdrawalReportBody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-10"><span class="material-icons animate-spin text-emerald-500">sync</span> กำลังดึงข้อมูล...</td></tr>';
    
    try {
        // ดึงเฉพาะข้อมูลของ "วันนี้" (ตั้งแต่เที่ยงคืน) เพื่อให้ยอดสรุปตรงกับกะปัจจุบัน
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayIso = today.toISOString();

        const response = await fetch(`${W_SUPABASE_URL}?select=*&created_at=gte.${todayIso}&order=created_at.desc`, {
            method: 'GET',
            headers: { 'apikey': W_SUPABASE_KEY, 'Authorization': `Bearer ${W_SUPABASE_KEY}` }
        });

        if (response.ok) {
            withdrawalReportData = await response.json();
            renderWithdrawalDashboard(); // คำนวณแดชบอร์ด
            renderWithdrawalTable();     // วาดตาราง
        } else {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-10 text-red-500">ไม่สามารถดึงข้อมูลได้ (เช็คสิทธิ์ Supabase)</td></tr>';
        }
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-10 text-red-500">เกิดข้อผิดพลาดในการเชื่อมต่อ</td></tr>';
    }
};

window.renderWithdrawalDashboard = function() {
    let total = withdrawalReportData.length;
    let jun88Count = 0;
    let pg688Count = 0;
    let staffStats = {};

    // ลูปเพื่อนับยอดรวม และแยกตามชื่อพนักงาน
    withdrawalReportData.forEach(row => {
        let sys = row.backend_system;
        if (sys === 'Jun88') jun88Count++;
        if (sys === 'PG688') pg688Count++;

        let sName = row.staff_username || 'ไม่ระบุตัวตน';
        if (!staffStats[sName]) staffStats[sName] = { total: 0, Jun88: 0, PG688: 0, Approve: 0, Reject: 0 };

        staffStats[sName].total++;
        if (sys === 'Jun88') staffStats[sName].Jun88++;
        else if (sys === 'PG688') staffStats[sName].PG688++;
        
        if (row.action_type === 'Approve') staffStats[sName].Approve++;
        else staffStats[sName].Reject++;
    });

    // อัปเดตกล่องยอดรวมด้านบน
    document.getElementById('sumTotal').innerText = total.toLocaleString();
    document.getElementById('sumJun88').innerText = jun88Count.toLocaleString();
    document.getElementById('sumPG688').innerText = pg688Count.toLocaleString();

    // วาดกล่องรายบุคคล
    const staffGrid = document.getElementById('staffSummaryGrid');
    if (total === 0) {
        staffGrid.innerHTML = '<div class="col-span-full text-center text-gray-500 text-xs py-4">ยังไม่มีพนักงานทำรายการในกะนี้</div>';
    } else {
        let staffHtml = '';
        // จัดเรียงให้คนที่ทำยอดสูงสุดอยู่บนสุด
        let sortedStaff = Object.entries(staffStats).sort((a,b) => b[1].total - a[1].total);

        sortedStaff.forEach(([name, data]) => {
            staffHtml += `
                <div class="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex justify-between items-center shadow-sm hover:border-emerald-500/50 transition">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-xs shadow-inner">
                            ${name.substring(0,2).toUpperCase()}
                        </div>
                        <div>
                            <div class="font-bold text-slate-800 dark:text-white text-sm tracking-wide">${name}</div>
                            <div class="text-[10px] text-gray-500 dark:text-gray-400 font-bold mt-0.5 flex gap-1.5">
                                <span class="bg-blue-500/10 text-blue-500 px-1 rounded">J88: ${data.Jun88}</span>
                                <span class="bg-amber-500/10 text-amber-500 px-1 rounded">PG: ${data.PG688}</span>
                            </div>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-2xl font-black text-slate-800 dark:text-white leading-none">${data.total}</div>
                        <div class="text-[9px] text-emerald-500 font-bold">รายการ</div>
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
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-10 text-gray-500">ไม่มีประวัติการกดในวันนี้</td></tr>';
        return;
    }
    
    tbody.innerHTML = withdrawalReportData.map((row, index) => {
        const dateObj = new Date(row.created_at);
        const formattedDate = dateObj.toLocaleString('th-TH');
        
        let actionBadge = row.action_type === 'Approve' 
            ? '<span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold">อนุมัติ</span>' 
            : '<span class="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded text-[10px] font-bold">ปฏิเสธ</span>';

        let backendBadge = row.backend_system === 'Jun88'
            ? '<span class="text-blue-400 font-bold text-xs">Jun88</span>'
            : `<span class="text-amber-400 font-bold text-xs">${row.backend_system}</span>`;
            
        return `
            <tr class="hover:bg-slate-800 transition border-b border-slate-700/50">
                <td class="p-3 text-center text-xs text-gray-500">${index + 1}</td>
                <td class="p-3 text-xs text-gray-400 font-mono">${formattedDate}</td>
                <td class="p-3 font-bold text-white text-xs">${row.staff_username}</td>
                <td class="p-3">${backendBadge}</td>
                <td class="p-3 text-center">${actionBadge}</td>
            </tr>`;
    }).join('');
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
        const excelData = withdrawalReportData.map((row, index) => ({
            "ลำดับ": index + 1,
            "วัน-เวลาที่ทำรายการ": new Date(row.created_at).toLocaleString('th-TH'),
            "รหัสพนักงาน": row.staff_username,
            "ระบบที่ทำรายการ": row.backend_system,
            "สถานะ (Approve/Reject)": row.action_type === 'Approve' ? 'อนุมัติ' : 'ปฏิเสธ'
        }));

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Withdrawal_Logs");
        
        const dateStr = new Date().toISOString().split('T')[0];
        XLSX.writeFile(workbook, `Staff_Withdrawal_Report_${dateStr}.xlsx`);
        Swal.fire({ icon: 'success', title: 'ดาวน์โหลดสำเร็จ', timer: 1500, showConfirmButton: false });
    }
};
