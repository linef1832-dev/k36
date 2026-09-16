// ════════════════════════════════════════════════════════════════════
// 📊 breaktable/core.js — หน้า "ตารางลงเวลาพักทั้งหมด" (ใครลงกินข้าวกี่โมง)
// ใช้ตาราง/ตัวกรอง/ฟังก์ชันเดิมจาก system/users.js (fetchData, renderTableRows, updateTableSummary) ทั้งหมด
// หน้านี้แค่: ตั้งวันที่เริ่มต้น → เรียก fetchData → ฟัง realtime ให้ตารางอัปเดตเอง
// ════════════════════════════════════════════════════════════════════
window.initBreakTable = async function() {
    const d = document.getElementById('wDate');
    if (d && !d.value) {
        // วันเริ่มต้น = วันนี้ (00:00-07:59 ถือเป็นเมื่อวาน — กะดึกคร่อมวัน เหมือนหน้าหลัก)
        const t = new Date(); if (t.getHours() < 8) t.setDate(t.getDate() - 1);
        d.value = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    }
    const disp = document.getElementById('displayDate');
    if (disp && d) disp.innerText = new Date(d.value).toLocaleDateString('th-TH');
    if (typeof fetchData === 'function') await fetchData();
    // 📡 realtime: ใช้ตัวเดียวกับหน้าหลัก (ฟัง schedules/settings แล้วอัปเดตตาราง)
    if (typeof window.subscribeDashboardChanges === 'function') { try { window.subscribeDashboardChanges(); } catch (e) {} }
};
