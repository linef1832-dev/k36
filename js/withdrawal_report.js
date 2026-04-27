let withdrawalReportData = [];

// API Key และ URL จาก Supabase 
const W_SUPABASE_URL = 'https://zedbbtjxuidfubpiauyb.supabase.co/rest/v1/staff_withdrawal_logs';
const W_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplZGJidGp4dWlkZnVicGlhdXliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2MjQ2ODgsImV4cCI6MjA4MzIwMDY4OH0.4orJyfFcOwnZcnHFjLOTLXaqFNeapCVe9yCxj3rLMBM';

window.initWithdrawalReport = async function() {
    const tbody = document.getElementById('withdrawalReportBody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-10"><span class="material-icons animate-spin text-emerald-500">sync</span> กำลังดึงข้อมูลล่าสุด...</td></tr>';
    
    try {
        const response = await fetch(`${W_SUPABASE_URL}?select=*&order=created_at.desc`, {
            method: 'GET',
            headers: {
                'apikey': W_SUPABASE_KEY,
                'Authorization': `Bearer ${W_SUPABASE_KEY}`
            }
        });

        if (response.ok) {
            withdrawalReportData = await response.json();
            renderWithdrawalTable();
        } else {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-10 text-red-500">ไม่สามารถดึงข้อมูลได้ (โปรดตรวจสอบสิทธิ์ Supabase)</td></tr>';
        }
    } catch (error) {
        console.error('Error:', error);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-10 text-red-500">เกิดข้อผิดพลาดในการเชื่อมต่อ</td></tr>';
    }
};

window.renderWithdrawalTable = function() {
    const tbody = document.getElementById('withdrawalReportBody');
    if (!tbody) return;
    
    if (withdrawalReportData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-10 text-gray-500">ยังไม่มีข้อมูลการทำรายการจากส่วนขยายพนักงาน</td></tr>';
        return;
    }
    
    tbody.innerHTML = withdrawalReportData.map((row, index) => {
        const dateObj = new Date(row.created_at);
        const formattedDate = dateObj.toLocaleString('th-TH');
        
        let actionBadge = row.action_type === 'Approve' 
            ? '<span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded text-[10px] font-bold shadow-sm">อนุมัติ</span>' 
            : '<span class="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-1 rounded text-[10px] font-bold shadow-sm">ปฏิเสธ</span>';

        let backendBadge = row.backend_system === 'Jun88'
            ? '<span class="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded text-[10px] font-bold">Jun88</span>'
            : `<span class="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] font-bold">${row.backend_system}</span>`;
            
        return `
            <tr class="hover:bg-slate-800 transition border-b border-slate-700/50">
                <td class="p-4 text-center text-xs text-gray-500">${index + 1}</td>
                <td class="p-4 text-xs text-gray-400 font-mono">${formattedDate}</td>
                <td class="p-4 font-black text-white">${row.staff_username}</td>
                <td class="p-4">${backendBadge}</td>
                <td class="p-4 text-center">${actionBadge}</td>
            </tr>
        `;
    }).join('');
};

window.exportWithdrawalToExcel = function() {
    if (withdrawalReportData.length === 0) {
        Swal.fire('แจ้งเตือน', 'ไม่มีข้อมูลสำหรับดาวน์โหลด', 'warning');
        return;
    }
    
    // เรียกใช้ระบบโหลด ExcelJS ของคุณที่อยู่ในหน้า Summary
    window.loadExcelLibrary(async function() {
        Swal.fire({ title: 'กำลังสร้างไฟล์ Excel...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        
        try {
            const wb = new ExcelJS.Workbook();
            const ws = wb.addWorksheet('รายงานการถอน');
            
            ws.columns = [
                { header: 'ลำดับ', key: 'index', width: 10 },
                { header: 'วัน-เวลาที่ทำรายการ', key: 'date', width: 25 },
                { header: 'รหัสพนักงาน', key: 'staff', width: 20 },
                { header: 'ระบบที่ทำรายการ', key: 'system', width: 15 },
                { header: 'สถานะ (Approve/Reject)', key: 'action', width: 25 }
            ];
            
            // ตกแต่ง Header
            ws.getRow(1).eachCell(cell => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });
            
            withdrawalReportData.forEach((row, idx) => {
                ws.addRow({
                    index: idx + 1,
                    date: new Date(row.created_at).toLocaleString('th-TH'),
                    staff: row.staff_username,
                    system: row.backend_system,
                    action: row.action_type === 'Approve' ? 'อนุมัติ' : 'ปฏิเสธ'
                });
            });
            
            const buffer = await wb.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            
            const dateStr = new Date().toISOString().split('T')[0];
            link.download = `Staff_Withdrawal_Report_${dateStr}.xlsx`;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            Swal.fire({ icon: 'success', title: 'ดาวน์โหลดสำเร็จ', timer: 1500, showConfirmButton: false });
        } catch (e) {
            Swal.fire('Error', 'ไม่สามารถดาวน์โหลดไฟล์ได้: ' + e.message, 'error');
        }
    });
};
