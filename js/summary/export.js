// ════════════════════════════════════════════════════════════════════
// 📦 summary/export.js — ส่วนที่ 2/2 ของหน้าสรุปยอดทำรายการ (แยกจาก summary.js เดิม 2,048 บรรทัด)
// เนื้อหา: โหลด duty assignment (หลัก/รอง) + ส่งออก Excel
// ⚠️ ลำดับโหลด: summary/core → summary/export
// ตัวแปร top-level แชร์ข้ามไฟล์อัตโนมัติ — ห้ามสลับลำดับ
// ════════════════════════════════════════════════════════════════════
// 🌟 โหลด duty assignment (หลัก/รอง) สำหรับ export Excel
// อ่านจาก settings ตาราง key = duty_roster_{dept}_{date}_{shift}
// คืนค่า: { [username_lowercase]: { main: 'PG688', secondary: 'NM9' } }
// ==========================================
window.loadDutyAssignmentMap = async function(filteredData, shiftFilterUi) {
    const map = {};
    if (typeof appDB === 'undefined') return map;
    
    try {
        // หาวันที่จากข้อมูลที่กำลังจะ export — โดยปกติเป็นวันเดียวกัน
        const dates = [...new Set((filteredData || []).map(r => r.date).filter(Boolean))];
        if (dates.length === 0) {
            const dEl = document.getElementById('summaryDateFilter');
            if (dEl && dEl.value) dates.push(dEl.value);
        }
        if (dates.length === 0) return map;
        
        // แผนกของ user — ปกติเป็น AM/OD (ใช้ currentUser หรือ default 'AM')
        // ลองหลายๆ แผนกที่อาจเก็บข้อมูลไว้
        const deptsToTry = ['AM', 'OD', 'AMQL', 'ODQL'];
        const myDept = (typeof currentUser !== 'undefined' && currentUser) ? (currentUser.department || currentUser.dept) : '';
        if (myDept && !deptsToTry.includes(myDept)) deptsToTry.unshift(myDept);
        
        // กะที่ใช้ — ถ้า shiftFilterUi = 'ALL' ลองทุกกะ
        const shiftsToTry = (shiftFilterUi && shiftFilterUi !== 'ALL') 
            ? [shiftFilterUi]
            : ['กะเช้า', 'กะกลาง', 'กะดึก'];   // [แก้] เดิมใช้ "กะบ่าย" ซึ่งหน้าจัดหน้าที่ไม่มี → คนกะกลางไม่มีเว็บหลัก/รองใน Excel
        
        // สร้าง keys ทั้งหมดที่จะ query
        const keys = [];
        dates.forEach(date => {
            deptsToTry.forEach(dept => {
                shiftsToTry.forEach(shift => {
                    keys.push(`duty_roster_${dept}_${date}_${shift}`);
                });
            });
        });
        
        if (keys.length === 0) return map;
        
        const { data, error } = await appDB.from('settings').select('key, value').in('key', keys);
        if (error || !data) return map;
        
        // Parse roster data ทุกๆ key
        data.forEach(row => {
            if (!row.value) return;
            try {
                const rosterData = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
                // rosterData = { "Jun88": [ {username, secondary_team, ...}, ... ], "PG688": [...] }
                Object.keys(rosterData).forEach(primaryTeam => {
                    const arr = rosterData[primaryTeam];
                    if (!Array.isArray(arr)) return;
                    arr.forEach(u => {
                        if (!u || !u.username) return;
                        if (String(u.username).includes('ขาดคน')) return;
                        const key = String(u.username).toLowerCase().trim();
                        // ใส่ใน map (กรณีคนเดียวอยู่หลายกะ — ใช้ตัวแรกที่เจอ ไม่ทับ)
                        if (!map[key]) {
                            map[key] = {
                                main: primaryTeam,
                                secondary: u.secondary_team || null
                            };
                        }
                    });
                });
            } catch(e) {
                console.warn('parse roster failed:', row.key, e);
            }
        });
    } catch(e) {
        console.error('loadDutyAssignmentMap error:', e);
    }
    
    return map;
};

// ==========================================
// 📥 ส่งออก Excel (ออกแบบใหม่: อ่านง่าย ไม่ต้องเลื่อนขวาไกล)
//   ชีต 1 "สรุปรายคน"     : แบ่งกลุ่มตามกะ · 1 คอลัมน์ต่อเว็บ (เฉพาะเว็บที่มียอด) · หลัก/รอง แยกคอลัมน์ · รวมย่อยต่อกะ + รวมทั้งหมด
//   ชีต 2 "สรุปตามเว็บ"    : ยอด / สำเร็จ / ปฏิเสธ / ยอดเงิน / สัดส่วน ของแต่ละเว็บ
//   ชีต 3 "รายละเอียด"     : สำเร็จ-ปฏิเสธ-รวม แยกทุกเว็บ (แบบเดิม สำหรับคนที่ต้องการดูละเอียด)
// ใช้ข้อมูลตามตัวกรองที่เลือกบนหน้าจอ (กะ / ประเภท / เว็บที่กดเลือก)
// ==========================================
window.exportSummaryToExcel = async function() {
    if (!pendingSummaryData || pendingSummaryData.length === 0) return Swal.fire('ไม่มีข้อมูล', 'ไม่มีข้อมูลสำหรับดาวน์โหลด กรุณาเลือกวันที่หรืออัปโหลดไฟล์ก่อน', 'warning');

    window.loadExcelLibrary(async function() {
        Swal.fire({ title: 'กำลังสร้างไฟล์ Excel...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        try {
            const shiftFilter = document.getElementById('summaryShiftFilter') ? document.getElementById('summaryShiftFilter').value : 'ALL';
            const odFilter = document.getElementById('summaryOdFilter') ? document.getElementById('summaryOdFilter').value : 'ALL';
            let filteredData = pendingSummaryData.filter(item => !String(item.empName || '').toLowerCase().match(/system|auto/));
            if (shiftFilter !== 'ALL') filteredData = filteredData.filter(item => smShiftMatch(item, shiftFilter));
            if (odFilter !== 'ALL') filteredData = filteredData.filter(item => item.odType === odFilter || (item.odType === undefined && odFilter === 'ปกติ'));
            if (typeof summaryActiveWebFilter !== 'undefined' && summaryActiveWebFilter !== 'ALL') filteredData = filteredData.filter(item => item.website === summaryActiveWebFilter);
            if (!filteredData.length) { Swal.fire('ไม่มีข้อมูล', 'ไม่มีข้อมูลตามตัวกรองที่เลือก', 'info'); return; }

            // ลำดับเว็บ: ชุดหลัก + เว็บใหม่ (จากหน้าตั้งค่า / ที่มีในข้อมูล)
            const allWebs = ['Jun88', 'MK8', 'VV72', 'TH26', 'F168', 'PG688', 'JL69', 'NM9', 'BT678', 'K188'];
            smWebList().concat(filteredData.map(x => x.website)).forEach(w => { if (w && !allWebs.some(t => t.toLowerCase() === String(w).toLowerCase())) allWebs.push(w); });
            const webKey = (w) => allWebs.find(t => t.toLowerCase() === String(w || '').toLowerCase());

            const dutyAssignmentMap = await window.loadDutyAssignmentMap(filteredData, shiftFilter);

            // ── รวมยอดรายคน
            const emps = {};
            const webTot = {}; allWebs.forEach(w => { webTot[w] = { n: 0, ok: 0, no: 0, amt: 0 }; });
            filteredData.forEach(item => {
                const k = item.empName;
                const sh = (!item.shift || item.shift === 'UNKNOWN') ? 'ไม่ระบุ' : String(item.shift).replace('กะ', '');
                const e = emps[k] || (emps[k] = { name: k, shift: sh === 'all' ? 'อิสระ' : sh, ok: 0, no: 0, n: 0, amt: 0, webs: {} });
                const w = webKey(item.website); if (!w) return;
                const wd = e.webs[w] || (e.webs[w] = { ok: 0, no: 0, n: 0 });
                wd.ok += item.approvedCount || 0; wd.no += item.rejectCount || 0; wd.n += item.count || 0;
                e.ok += item.approvedCount || 0; e.no += item.rejectCount || 0; e.n += item.count || 0; e.amt += item.totalAmount || 0;
                const t = webTot[w]; t.n += item.count || 0; t.ok += item.approvedCount || 0; t.no += item.rejectCount || 0; t.amt += item.totalAmount || 0;
            });
            const webs = allWebs.filter(w => webTot[w].n > 0);   // ⚡ เฉพาะเว็บที่มียอด → ตารางแคบ อ่านง่าย
            const empList = Object.values(emps);
            const G = empList.reduce((a, e) => ({ ok: a.ok + e.ok, no: a.no + e.no, n: a.n + e.n, amt: a.amt + e.amt }), { ok: 0, no: 0, n: 0, amt: 0 });

            // ── หัวเรื่อง (วันที่)
            let titleDateStr = '';
            if (viewMode === 'preview' && window.uploadedFileDates && window.uploadedFileDates.size > 0) {
                const ds = Array.from(window.uploadedFileDates).sort();
                titleDateStr = ds.length === 1 ? smThaiDate(ds[0]) : `รวม ${ds.length} วัน: ` + ds.map(d => smThaiDate(d, true)).join(', ');
            } else if (window.selectedSummaryDates && window.selectedSummaryDates.size > 1) {
                const ds = Array.from(window.selectedSummaryDates).sort();
                titleDateStr = `รวม ${ds.length} วัน: ` + ds.map(d => smThaiDate(d, true)).join(', ');
            } else {
                const dv = (document.getElementById('summaryDateFilter') || {}).value;
                titleDateStr = dv ? smThaiDate(dv) : 'ข้อมูลพรีวิว (ยังไม่ได้บันทึก)';
            }
            const notes = [];
            if (shiftFilter !== 'ALL') notes.push(shiftFilter === 'UNKNOWN' ? 'ไม่ระบุกะ' : shiftFilter);
            if (odFilter !== 'ALL') notes.push(odFilter);
            if (typeof summaryActiveWebFilter !== 'undefined' && summaryActiveWebFilter !== 'ALL') notes.push('เว็บ ' + summaryActiveWebFilter);

            // ── สไตล์
            const FONT = 'Tahoma';
            const C = { ink: 'FF0F172A', mute: 'FF64748B', line: 'FFE2E8F0', head: 'FF1E293B', gold: 'FFE8C15A', goldBg: 'FFFEF3C7', zebra: 'FFF8FAFC', ok: 'FF15803D', no: 'FFDC2626' };
            const SHIFT = { 'เช้า': ['FFFFF7ED', 'FFC2410C', '☀️'], 'กลาง': ['FFEFF6FF', 'FF1D4ED8', '🌤️'], 'ดึก': ['FFF5F3FF', 'FF6D28D9', '🌙'], 'อิสระ': ['FFECFDF5', 'FF047857', '🔄'], 'ไม่ระบุ': ['FFF1F5F9', 'FF475569', '❔'] };
            const fill = (c) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: c } });
            const bLine = { style: 'thin', color: { argb: C.line } };
            const NUM = '#,##0;-#,##0;"–"';           // 0 แสดงเป็น – ตาไม่ล้า
            const MONEY = '#,##0.00;-#,##0.00;"–"';
            const wb = new ExcelJS.Workbook(); wb.creator = 'K36';

            // หัวชีต: ชื่อ + วันที่ + ตัวเลขสรุป
            const sheetHead = (ws, title, lastCol) => {
                const L = ws.getColumn(lastCol).letter;
                ws.mergeCells(`A1:${L}1`); Object.assign(ws.getCell('A1'), { value: title });
                ws.getCell('A1').font = { name: FONT, size: 16, bold: true, color: { argb: C.ink } };
                ws.mergeCells(`A2:${L}2`); ws.getCell('A2').value = titleDateStr + (notes.length ? '   ·   ตัวกรอง: ' + notes.join(' · ') : '');
                ws.getCell('A2').font = { name: FONT, size: 11, bold: true, color: { argb: 'FFB45309' } };
                ws.mergeCells(`A3:${L}3`);
                ws.getCell('A3').value = `ยอดรวม ${G.n.toLocaleString()} รายการ   ·   สำเร็จ ${G.ok.toLocaleString()}   ·   ปฏิเสธ ${G.no.toLocaleString()}   ·   พนักงาน ${empList.length} คน   ·   ยอดเงิน ฿${G.amt.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
                ws.getCell('A3').font = { name: FONT, size: 10, bold: true, color: { argb: C.mute } };
                ws.getRow(1).height = 26; ws.getRow(2).height = 18; ws.getRow(3).height = 18;
                return 5;   // แถวหัวตาราง
            };
            const headRow = (ws, r, labels, opts = {}) => {
                const row = ws.getRow(r); row.height = 30;
                labels.forEach((v, i) => {
                    const c = row.getCell(i + 1); c.value = v;
                    c.font = { name: FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
                    c.fill = fill(opts.gold && opts.gold.includes(i + 1) ? 'FFB45309' : C.head);
                    c.alignment = { horizontal: i < (opts.leftCols || 0) ? 'left' : 'center', vertical: 'middle', wrapText: true, indent: i < (opts.leftCols || 0) ? 1 : 0 };
                    c.border = { bottom: { style: 'medium', color: { argb: C.gold } } };
                });
            };

            // ═════════ ชีต 1: สรุปรายคน ═════════
            const ws = wb.addWorksheet('สรุปรายคน', { views: [{ showGridLines: false }] });
            // ลำดับ | ชื่อ | กะ | หลัก | รอง | เว็บ... | สำเร็จ | ปฏิเสธ | รวม | ยอดเงิน
            const cols = ['#', 'ชื่อพนักงาน', 'กะ', 'เว็บหลัก', 'เว็บรอง', ...webs, 'สำเร็จ', 'ปฏิเสธ', 'รวม', 'ยอดเงิน (฿)'];
            const cW0 = 6, cOK = cW0 + webs.length, cNO = cOK + 1, cTOT = cOK + 2, cAMT = cOK + 3;
            let r = sheetHead(ws, 'สรุปยอดทำรายการ · รายคน', cols.length);
            headRow(ws, r, cols, { leftCols: 2, gold: [cTOT] });
            const headerRowNo = r; r++;
            const ORDER = ['เช้า', 'กลาง', 'ดึก', 'อิสระ', 'ไม่ระบุ'];
            const shifts = [...new Set(empList.map(e => e.shift))].sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99));
            let no = 1;
            const writeNums = (row, vals, bold, color) => vals.forEach(([col, v, fmt]) => { const c = row.getCell(col); c.value = v; c.numFmt = fmt || NUM; c.alignment = { horizontal: 'center', vertical: 'middle' }; c.font = { name: FONT, size: 10, bold: !!bold, color: { argb: color || C.ink } }; });
            shifts.forEach(sh => {
                const [bg, tx, ic] = SHIFT[sh] || SHIFT['ไม่ระบุ'];
                const list = empList.filter(e => e.shift === sh).sort((a, b) => b.n - a.n || b.ok - a.ok);
                const sub = list.reduce((a, e) => ({ ok: a.ok + e.ok, no: a.no + e.no, n: a.n + e.n, amt: a.amt + e.amt }), { ok: 0, no: 0, n: 0, amt: 0 });
                // แถบชื่อกะ
                ws.mergeCells(r, 1, r, cols.length);
                const band = ws.getCell(r, 1);
                band.value = `${ic}  กะ${sh === 'ไม่ระบุ' ? 'ไม่ระบุ' : sh}   ·   ${list.length} คน   ·   ${sub.n.toLocaleString()} รายการ   ·   เฉลี่ย ${(sub.n / Math.max(1, list.length)).toFixed(1)} ต่อคน`;
                band.font = { name: FONT, size: 11, bold: true, color: { argb: tx } }; band.fill = fill(bg);
                band.alignment = { vertical: 'middle', indent: 1 }; band.border = { left: { style: 'thick', color: { argb: tx } } };
                ws.getRow(r).height = 24; r++;
                list.forEach((e, i) => {
                    const row = ws.getRow(r); row.height = 20;
                    const d = dutyAssignmentMap[String(e.name).toLowerCase()] || {};
                    [[1, no++], [2, e.name], [3, e.shift], [4, d.main || ''], [5, d.secondary || '']].forEach(([c, v]) => { row.getCell(c).value = v; });
                    for (let c = 1; c <= cols.length; c++) {
                        const cell = row.getCell(c);
                        cell.font = { name: FONT, size: 10, color: { argb: C.ink } };
                        cell.alignment = { horizontal: c === 2 ? 'left' : 'center', vertical: 'middle', indent: c === 2 ? 1 : 0 };
                        cell.border = { bottom: bLine };
                        if (i % 2 === 1) cell.fill = fill(C.zebra);
                    }
                    row.getCell(1).font = { name: FONT, size: 9, color: { argb: C.mute } };
                    row.getCell(2).font = { name: FONT, size: 10, bold: true, color: { argb: C.ink } };
                    row.getCell(3).font = { name: FONT, size: 10, bold: true, color: { argb: tx } };
                    row.getCell(4).font = { name: FONT, size: 10, bold: true, color: { argb: 'FFB45309' } };
                    row.getCell(5).font = { name: FONT, size: 10, color: { argb: C.mute } };
                    webs.forEach((w, j) => { const c = row.getCell(cW0 + j); c.value = (e.webs[w] || {}).n || 0; c.numFmt = NUM; c.font = { name: FONT, size: 10, color: { argb: c.value ? 'FF1D4ED8' : 'FFCBD5E1' } }; });
                    writeNums(row, [[cOK, e.ok, NUM], [cNO, e.no, NUM]], true);
                    row.getCell(cOK).font = { name: FONT, size: 10, bold: true, color: { argb: e.ok ? C.ok : 'FFCBD5E1' } };
                    row.getCell(cNO).font = { name: FONT, size: 10, bold: true, color: { argb: e.no ? C.no : 'FFCBD5E1' } };
                    const ct = row.getCell(cTOT); ct.value = e.n; ct.numFmt = NUM; ct.fill = fill(C.goldBg); ct.font = { name: FONT, size: 11, bold: true, color: { argb: C.ink } };
                    const ca = row.getCell(cAMT); ca.value = e.amt; ca.numFmt = MONEY; ca.alignment = { horizontal: 'right', vertical: 'middle' }; ca.font = { name: FONT, size: 10, color: { argb: 'FF047857' } };
                    r++;
                });
                // รวมย่อยของกะ
                const row = ws.getRow(r); row.height = 22;
                ws.mergeCells(r, 1, r, 5); row.getCell(1).value = `รวมกะ${sh}`;
                row.getCell(1).alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
                webs.forEach((w, j) => { const c = row.getCell(cW0 + j); c.value = list.reduce((a, e) => a + ((e.webs[w] || {}).n || 0), 0); c.numFmt = NUM; });
                row.getCell(cOK).value = sub.ok; row.getCell(cNO).value = sub.no; row.getCell(cTOT).value = sub.n; row.getCell(cAMT).value = sub.amt;
                for (let c = 1; c <= cols.length; c++) {
                    const cell = row.getCell(c);
                    cell.font = { name: FONT, size: 10, bold: true, color: { argb: tx } }; cell.fill = fill(bg);
                    if (c > 5) { cell.numFmt = c === cAMT ? MONEY : NUM; cell.alignment = { horizontal: c === cAMT ? 'right' : 'center', vertical: 'middle' }; }
                    cell.border = { top: { style: 'thin', color: { argb: tx } } };
                }
                r += 2;   // เว้น 1 แถวคั่นกะ
            });
            // รวมทั้งหมด
            {
                const row = ws.getRow(r); row.height = 26;
                ws.mergeCells(r, 1, r, 5); row.getCell(1).value = 'รวมทั้งหมด';
                webs.forEach((w, j) => { row.getCell(cW0 + j).value = webTot[w].n; });
                row.getCell(cOK).value = G.ok; row.getCell(cNO).value = G.no; row.getCell(cTOT).value = G.n; row.getCell(cAMT).value = G.amt;
                for (let c = 1; c <= cols.length; c++) {
                    const cell = row.getCell(c);
                    cell.font = { name: FONT, size: 11, bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = fill(C.head);
                    cell.alignment = { horizontal: c === 1 ? 'right' : (c === cAMT ? 'right' : 'center'), vertical: 'middle', indent: c === 1 ? 1 : 0 };
                    if (c > 5) cell.numFmt = c === cAMT ? MONEY : NUM;
                }
                row.getCell(cTOT).fill = fill(C.gold); row.getCell(cTOT).font = { name: FONT, size: 12, bold: true, color: { argb: C.ink } };
            }
            // ความกว้าง + ตรึงหัว/ชื่อ + พิมพ์พอดีหน้า
            const widths = { 1: 5, 2: 22, 3: 8, 4: 10, 5: 10 };
            for (let c = 1; c <= cols.length; c++) ws.getColumn(c).width = widths[c] || (c === cAMT ? 15 : (c >= cOK ? 10 : 9));
            ws.views = [{ state: 'frozen', xSplit: 2, ySplit: headerRowNo, showGridLines: false }];
            ws.autoFilter = { from: { row: headerRowNo, column: 1 }, to: { row: headerRowNo, column: cols.length } };
            ws.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: `${headerRowNo}:${headerRowNo}`, margins: { left: .4, right: .4, top: .5, bottom: .5, header: .3, footer: .3 } };

            // ═════════ ชีต 2: สรุปตามเว็บ ═════════
            const w2 = wb.addWorksheet('สรุปตามเว็บ', { views: [{ showGridLines: false }] });
            const cols2 = ['เว็บ', 'หลังบ้าน', 'รายการ', 'สำเร็จ', 'ปฏิเสธ', 'สัดส่วน', 'ยอดเงิน (฿)'];
            let r2 = sheetHead(w2, 'สรุปยอดทำรายการ · ตามเว็บ', cols2.length);
            headRow(w2, r2, cols2, { leftCols: 1, gold: [3] }); const h2 = r2; r2++;
            const csys = smCustomSystems();
            webs.slice().sort((a, b) => webTot[b].n - webTot[a].n).forEach((w, i) => {
                const t = webTot[w], row = w2.getRow(r2); row.height = 22;
                row.values = [w, smSystemOf(w, csys) === 'SYSTEM' ? '-' : smSystemOf(w, csys), t.n, t.ok, t.no, G.n ? t.n / G.n : 0, t.amt];
                for (let c = 1; c <= cols2.length; c++) {
                    const cell = row.getCell(c);
                    cell.font = { name: FONT, size: 10, bold: c === 1 || c === 3, color: { argb: c === 4 ? C.ok : c === 5 ? C.no : c === 7 ? 'FF047857' : C.ink } };
                    cell.alignment = { horizontal: c === 1 ? 'left' : (c === 7 ? 'right' : 'center'), vertical: 'middle', indent: c === 1 ? 1 : 0 };
                    cell.border = { bottom: bLine }; if (i % 2) cell.fill = fill(C.zebra);
                }
                [3, 4, 5].forEach(c => { row.getCell(c).numFmt = NUM; }); row.getCell(6).numFmt = '0.0%'; row.getCell(7).numFmt = MONEY;
                row.getCell(3).fill = fill(C.goldBg);
                r2++;
            });
            {
                const row = w2.getRow(r2); row.height = 24;
                row.values = ['รวมทั้งหมด', '', G.n, G.ok, G.no, G.n ? 1 : 0, G.amt];
                for (let c = 1; c <= cols2.length; c++) { const cell = row.getCell(c); cell.font = { name: FONT, size: 11, bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = fill(C.head); cell.alignment = { horizontal: c === 1 ? 'left' : (c === 7 ? 'right' : 'center'), vertical: 'middle', indent: c === 1 ? 1 : 0 }; }
                [3, 4, 5].forEach(c => { row.getCell(c).numFmt = NUM; }); row.getCell(6).numFmt = '0.0%'; row.getCell(7).numFmt = MONEY;
                row.getCell(3).fill = fill(C.gold); row.getCell(3).font = { name: FONT, size: 12, bold: true, color: { argb: C.ink } };
            }
            // แถบสัดส่วนในช่อง "รายการ"
            if (webs.length) w2.addConditionalFormatting({ ref: `C${h2 + 1}:C${h2 + webs.length}`, rules: [{ type: 'dataBar', cfvo: [{ type: 'min' }, { type: 'max' }], color: { argb: 'FFE8C15A' }, gradient: false }] });
            [18, 12, 13, 12, 12, 12, 20].forEach((wd, i) => { w2.getColumn(i + 1).width = wd; });
            w2.pageSetup = { orientation: 'portrait', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
            w2.views = [{ state: 'frozen', ySplit: h2, showGridLines: false }];

            // ═════════ ชีต 3: รายละเอียด (สำเร็จ/ปฏิเสธ/รวม แยกเว็บ) ═════════
            const w3 = wb.addWorksheet('รายละเอียด', { views: [{ showGridLines: false }] });
            const lastC3 = 3 + webs.length * 3 + 3;
            let r3 = sheetHead(w3, 'รายละเอียดสำเร็จ / ปฏิเสธ แยกเว็บ', lastC3);
            // หัว 2 ชั้น: ชื่อเว็บ (รวม 3 ช่อง) / สำเร็จ-ปฏิเสธ-รวม
            const top = w3.getRow(r3), sub3 = w3.getRow(r3 + 1);
            [['#', 1], ['ชื่อพนักงาน', 2], ['กะ', 3]].forEach(([v, c]) => { w3.mergeCells(r3, c, r3 + 1, c); top.getCell(c).value = v; });
            webs.forEach((w, j) => { const c0 = 4 + j * 3; w3.mergeCells(r3, c0, r3, c0 + 2); top.getCell(c0).value = w; ['สำเร็จ', 'ปฏิเสธ', 'รวม'].forEach((v, k) => { sub3.getCell(c0 + k).value = v; }); });
            const cT3 = 4 + webs.length * 3; w3.mergeCells(r3, cT3, r3, cT3 + 2); top.getCell(cT3).value = 'รวมทั้งหมด'; ['สำเร็จ', 'ปฏิเสธ', 'รวม'].forEach((v, k) => { sub3.getCell(cT3 + k).value = v; });
            [top, sub3].forEach(row => { row.height = 22; for (let c = 1; c <= lastC3; c++) { const cell = row.getCell(c); cell.font = { name: FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = fill(c >= cT3 ? 'FFB45309' : C.head); cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.border = { left: (c >= 4 && (c - 4) % 3 === 0) ? { style: 'thin', color: { argb: 'FF475569' } } : undefined }; } });
            r3 += 2; const h3 = r3 - 1;
            empList.slice().sort((a, b) => b.n - a.n).forEach((e, i) => {
                const vals = [i + 1, e.name, e.shift];
                webs.forEach(w => { const d = e.webs[w] || {}; vals.push(d.ok || 0, d.no || 0, d.n || 0); });
                vals.push(e.ok, e.no, e.n);
                const row = w3.getRow(r3); row.values = vals; row.height = 19;
                for (let c = 1; c <= lastC3; c++) {
                    const cell = row.getCell(c); const k = (c - 4) % 3;
                    cell.alignment = { horizontal: c === 2 ? 'left' : 'center', vertical: 'middle', indent: c === 2 ? 1 : 0 };
                    cell.font = { name: FONT, size: 10, bold: c === 2 || (c >= 4 && k === 2), color: { argb: c < 4 ? C.ink : (!cell.value ? 'FFCBD5E1' : k === 0 ? C.ok : k === 1 ? C.no : C.ink) } };
                    if (c >= 4) cell.numFmt = NUM;
                    cell.border = { bottom: bLine, left: (c >= 4 && k === 0) ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined };
                    if (i % 2) cell.fill = fill(C.zebra);
                    if (c >= cT3) cell.fill = fill(C.goldBg);
                }
                r3++;
            });
            for (let c = 1; c <= lastC3; c++) w3.getColumn(c).width = c === 1 ? 5 : c === 2 ? 22 : c === 3 ? 8 : 8;
            w3.views = [{ state: 'frozen', xSplit: 3, ySplit: h3, showGridLines: false }];
            w3.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: `${h3 - 1}:${h3}` };

            const buffer = await wb.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `สรุปยอดทำรายการ_${titleDateStr.replace(/[\\/:*?"<>|]/g, '-').slice(0, 60)}.xlsx`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 2000);
            Swal.fire({ icon: 'success', title: 'ดาวน์โหลดไฟล์ Excel สำเร็จ!', timer: 1500, showConfirmButton: false });
        } catch (error) { console.error(error); Swal.fire('เกิดข้อผิดพลาด', 'ดาวน์โหลด Excel ไม่สำเร็จ: ' + error.message, 'error'); }
    });
};
// "18 ตุลาคม 2569" / แบบสั้น "18 ต.ค."
function smThaiDate(d, short) {
    const p = String(d).split('-'); if (p.length !== 3) return d;
    const full = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
    return short ? `${+p[2]} ${SM_TH_MON[+p[1] - 1]}` : `วันที่ ${+p[2]} ${full[+p[1] - 1]} ${+p[0] + 543}`;
}

// ⚙️ ตั้งค่าหลังบ้านของแต่ละเว็บ (ใช้จริง: ระบบอ่านไฟล์ตามค่านี้) + เพิ่มเว็บใหม่ได้เอง
//    บันทึกลงฐานข้อมูล → ทุกคนทุกเครื่องใช้ชุดเดียวกัน
window.openManageSystemModal = async function() {
    if (!window.smWebSystems && typeof window.smLoadWebSystems === 'function') await window.smLoadWebSystems();
    const cs = Object.assign({}, smCustomSystems());
    const esc = (v) => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const SYS = [['K36', '#60a5fa'], ['WG', '#34d399'], ['TCG', '#f472b6'], ['SYSTEM', '#94a3b8']];
    const segs = (web, cur) => SYS.map(([k, c]) => `<button type="button" data-web="${esc(web)}" data-sys="${k}" class="mws-seg${cur === k ? ' on' : ''}" style="--c:${c}">${k === 'SYSTEM' ? 'ไม่ระบุ' : k}</button>`).join('');
    const row = (web, isNew) => `<div class="mws-row" data-web="${esc(web)}"><b>${esc(web)}${isNew ? ' <small>ใหม่</small>' : ''}</b><div class="mws-segs">${segs(web, smSystemOf(web, cs))}</div></div>`;
    const base = (typeof TEAM_LIST !== 'undefined' && TEAM_LIST.length) ? TEAM_LIST : SM_DEFAULT_WEBS;
    const html = `
        <style>
            .mws-list{display:flex;flex-direction:column;gap:6px;max-height:46vh;overflow-y:auto;padding:2px;text-align:left}
            .mws-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border-radius:12px;background:var(--k-panel2,#0f1829);border:1px solid var(--k-line,#1e293b)}
            .mws-row b{font-size:14px;font-weight:900;color:var(--k-tx-strong,#fff)} .mws-row small{font-size:10px;padding:1px 6px;border-radius:99px;background:#E8C15A;color:#1b1406;margin-left:4px}
            .mws-segs{display:flex;gap:3px;padding:3px;border-radius:10px;background:var(--k-sunk,#0b1222)}
            .mws-seg{height:28px;padding:0 10px;border-radius:8px;font-size:12px;font-weight:800;color:var(--k-mute,#94a3b8)}
            .mws-seg.on{background:color-mix(in srgb,var(--c) 22%,transparent);color:var(--c);box-shadow:inset 0 0 0 1px var(--c)}
            .mws-add{display:flex;gap:6px;margin-top:12px;padding-top:12px;border-top:1px dashed var(--k-line2,#334155)}
            .mws-add input{flex:1;min-width:0;height:38px;padding:0 12px;border-radius:10px;background:var(--k-field,#0b1222);border:1px solid var(--k-line3,#334155);color:var(--k-tx-strong,#fff);font-weight:800;outline:none}
            .mws-add select{height:38px;padding:0 8px;border-radius:10px;background:var(--k-field,#0b1222);border:1px solid var(--k-line3,#334155);color:var(--k-tx-strong,#fff);font-weight:800}
            .mws-add button{height:38px;padding:0 14px;border-radius:10px;background:#E8C15A;color:#1b1406;font-weight:900}
            .mws-tip{font-size:12px;color:var(--k-mute,#94a3b8);margin:0 0 10px;text-align:left;line-height:1.5}
        </style>
        <p class="mws-tip">ระบบจะอ่านไฟล์ Excel ตามที่ตั้งตรงนี้ (ดูจากชื่อเว็บในชื่อไฟล์) · มีเว็บใหม่ → เพิ่มด้านล่างแล้วเลือกหลังบ้าน</p>
        <div class="mws-list" id="mwsList">${smWebList().map(w => row(w, !base.some(x => x.toLowerCase() === w.toLowerCase()))).join('')}</div>
        <div class="mws-add">
            <input id="mwsNewWeb" placeholder="ชื่อเว็บใหม่ เช่น AB99" maxlength="20">
            <select id="mwsNewSys"><option value="K36">K36</option><option value="WG">WG</option><option value="TCG">TCG</option></select>
            <button type="button" id="mwsAddBtn">+ เพิ่ม</button>
        </div>`;

    const { isConfirmed } = await Swal.fire({
        title: 'ตั้งค่าหลังบ้านให้เว็บไซต์',
        html,
        width: 560,
        showCancelButton: true, confirmButtonText: 'บันทึก', cancelButtonText: 'ปิด', confirmButtonColor: '#E8C15A', cancelButtonColor: '#64748b',
        customClass: { popup: 'rounded-3xl' },
        didOpen: (pop) => {
            const list = pop.querySelector('#mwsList');
            list.addEventListener('click', (e) => {
                const b = e.target.closest('.mws-seg'); if (!b) return;
                cs[b.dataset.web] = b.dataset.sys;
                list.querySelectorAll(`.mws-seg[data-web="${CSS.escape(b.dataset.web)}"]`).forEach(x => x.classList.toggle('on', x === b));
            });
            const add = () => {
                const inp = pop.querySelector('#mwsNewWeb'); const name = inp.value.trim().replace(/\s+/g, '');
                if (!name) return inp.focus();
                if (!/^[A-Za-z0-9ก-๙]{2,20}$/.test(name)) { Swal.showValidationMessage('ชื่อเว็บใช้ได้เฉพาะตัวอักษร/ตัวเลข 2–20 ตัว'); return; }
                if (smWebList().concat(Object.keys(cs)).some(w => w.toLowerCase() === name.toLowerCase())) { Swal.showValidationMessage(`มีเว็บ ${name} อยู่แล้ว`); return; }
                Swal.resetValidationMessage();
                cs[name] = pop.querySelector('#mwsNewSys').value;
                list.insertAdjacentHTML('beforeend', row(name, true));
                list.lastElementChild.scrollIntoView({ block: 'nearest' });
                inp.value = '';
            };
            pop.querySelector('#mwsAddBtn').addEventListener('click', add);
            pop.querySelector('#mwsNewWeb').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
        }
    });
    if (!isConfirmed) return;

    try {
        const { error } = await appDB.from('settings').upsert([{ key: 'summary_web_systems', value: JSON.stringify(cs) }]);
        if (error) throw error;
        window.smWebSystems = cs;
        try { window.safeSetItem('custom_web_systems', JSON.stringify(cs)); } catch (e) {}
        if (window.clearQueryCache) window.clearQueryCache('sum_websys');
        if (typeof pendingSummaryData !== 'undefined') pendingSummaryData.forEach(item => { const v = smSystemOf(item.website, cs); if (v !== 'SYSTEM') item.system = v; });
        // ตัวเลือกเว็บของอันดับ: เติมใหม่ (มีเว็บใหม่)
        const lbw = document.getElementById('leaderboardWebFilter');
        if (lbw) { const cur = lbw.value; lbw.innerHTML = '<option value="ALL">ทุกเว็บ</option>' + smWebList().map(w => `<option value="${esc(w)}">${esc(w)}</option>`).join(''); lbw.value = cur; }
        Swal.fire({ icon: 'success', title: 'บันทึกแล้ว', text: 'อัปโหลดไฟล์ครั้งต่อไป ระบบจะอ่านตามหลังบ้านที่ตั้งไว้', timer: 1800, showConfirmButton: false });
        if (typeof window.renderSummaryDashboard === 'function') window.renderSummaryDashboard();
    } catch (e) {
        Swal.fire('บันทึกไม่สำเร็จ', e.message || String(e), 'error');
    }
};

// 🖼️ จัดการโลโก้ — หน้าต่างเดียว: เลือกเว็บจากรูป → ใส่รูปใหม่ → บันทึก
// (เดิม 2 ขั้น: หน้าต่างเลือกเว็บจาก dropdown → กด "ถัดไป" → ค่อยเปิดหน้าต่างใส่รูป)
window.openManageLogoModal = function(webName) {
    const webs = smWebList();
    const logos = window.summaryWebLogos || {};
    const esc = (v) => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const picker = document.getElementById('webLogoPicker');
    if (picker) picker.innerHTML = webs.map(w => `<button type="button" class="lg-w" data-web="${esc(w)}" onclick="smPickLogoWeb('${esc(w)}')">
            <span class="lg-img">${logos[w] ? `<img src="${esc(logos[w])}" alt="">` : `<i>${esc(String(w).slice(0, 3))}</i>`}</span>${esc(w)}</button>`).join('');
    // เลือกให้ก่อน: เว็บที่กำลังกรองอยู่ (ถ้ามี) ไม่งั้นเว็บแรก
    const first = webName || ((typeof summaryActiveWebFilter !== 'undefined' && summaryActiveWebFilter !== 'ALL') ? summaryActiveWebFilter : webs[0]);
    window.smPickLogoWeb(first);
    document.getElementById('webLogoModal').classList.remove('hidden');
};
window.smPickLogoWeb = function(web) {
    document.getElementById('webLogoKey').value = web;
    document.getElementById('webLogoTargetName').innerText = web;
    document.getElementById('webLogoUrlInput').value = '';
    document.getElementById('webLogoFileInput').value = '';
    document.querySelectorAll('#webLogoPicker .lg-w').forEach(b => b.classList.toggle('on', b.dataset.web === web));
    const currentLogo = window.summaryWebLogos && window.summaryWebLogos[web];
    const previewBox = document.getElementById('currentWebLogoPreviewBox');
    const previewImg = document.getElementById('currentWebLogoPreview');
    if (currentLogo) { previewImg.src = currentLogo; previewBox.classList.remove('hidden'); }
    else { previewBox.classList.add('hidden'); }
};

window.fetchMultipleHistoricalSummary = async function() {
    const dates = Array.from(window.selectedSummaryDates);
    if (dates.length === 0) return Swal.fire('เตือน', 'กรุณาเลือกวันที่อย่างน้อย 1 วัน', 'warning');

    Swal.fire({ title: 'กำลังรวมข้อมูล...', text: `ดึงข้อมูล ${dates.length} วันมาบวกทบกัน`, allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        // 🌟 [แก้บัคกะ] บังคับรีเฟรชรายชื่อพนักงาน + ล้าง cache กะ ก่อนรวมยอดหลายวัน
        if (typeof window.refreshUserListForSummary === 'function') {
            await window.refreshUserListForSummary();
        } else if (typeof fetchUsers === 'function') {
            try { await fetchUsers(true); } catch(e) { console.warn('fetchUsers refresh failed', e); }
        }

        // 🌟 สร้าง Array ของวันที่เมื่อวานให้ตรงกับทุกวันที่เลือก
        const yesterdayDates = dates.map(d => window.getYesterdayDateStr(d));

        // [FIX] ทั้งสามคำขอเดิมถูกตัดที่ 1000 แถวโดยไม่แจ้ง error — ยิ่งเลือกหลายวันยิ่งขาดมาก
        // ห่อด้วย selectAllRows ให้ดึงครบทุกหน้า และใส่ order เพื่อให้การแบ่งหน้าเสถียร
        const [mainRes, schRes, yestRes] = await Promise.all([
            window.selectAllRows(() => appDB.from('transaction_daily_summary').select('date, employee_name, website, count, approved_count, reject_count, total_amount').in('date', dates).order('id', { ascending: true })),
            window.selectAllRows(() => appDB.from('schedules').select('work_date, staff_name, shift_name').in('work_date', dates).order('id', { ascending: true })),
            window.selectAllRows(() => appDB.from('transaction_daily_summary').select('date, employee_name, website, count').in('date', yesterdayDates).order('id', { ascending: true }))   // 🌟 ดึงข้อมูลของวันที่ก่อนหน้าทั้งหมด
        ]);
        
        if (mainRes.error) throw mainRes.error;
        
        const data = mainRes.data || [];
        const schData = schRes.data || [];
        const yestData = yestRes.data || [];

        let schMap = {};
        schData.forEach(s => schMap[`${s.work_date}_${(s.staff_name || '').toLowerCase().trim()}`] = s.shift_name);

        let yestMap = {};
        // 🌟 รวมยอดของเมื่อวานทั้งหมด
        yestData.forEach(r => {
            const key = window.cleanKeyStr(r.employee_name, r.website);
            if (!yestMap[key]) yestMap[key] = 0;
            yestMap[key] += parseInt(r.count) || 0;
        });

        let groupedData = {};
        const sortedDatesForTitle = dates.sort((a, b) => new Date(b) - new Date(a)).map(d => {
            const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`;
        }).join(', ');
        const combinedDateLabel = `ข้อมูลรวมหลายวัน: ${sortedDatesForTitle}`;

        if (data && data.length > 0) {
            data.forEach(r => {
                const key = window.cleanKeyStr(r.employee_name, r.website);
                
                let empKey = (r.employee_name || '').toLowerCase().trim();
                // 🌟 [แก้บัคกะ v3] ใช้ raw allowed_shift จาก user object โดยตรง
                const realUser = typeof getRealDbUser === 'function' ? getRealDbUser(r.employee_name) : null;
                let actualShift;
                
                if (realUser && realUser.allowed_shift) {
                    const rawShift = String(realUser.allowed_shift).trim().toLowerCase();
                    if (rawShift && rawShift !== 'all' && rawShift !== 'กะอิสระ' && rawShift !== 'อิสระ') {
                        actualShift = realUser.allowed_shift;
                    } else {
                        actualShift = schMap[`${r.date}_${empKey}`] || realUser.allowed_shift;
                    }
                } else {
                    actualShift = schMap[`${r.date}_${empKey}`] 
                        || (typeof getShiftFromName === 'function' ? getShiftFromName(r.employee_name) : 'UNKNOWN');
                }
                
                actualShift = window.normalizeShiftName(actualShift);

                if (!groupedData[key]) {
                    groupedData[key] = {
                        date: combinedDateLabel, empName: r.employee_name, website: r.website, system: r.system || 'UNKNOWN',
                        count: 0, totalAmount: 0, approvedCount: 0, rejectCount: 0,
                        shift: actualShift, 
                        yestCount: yestMap[key] || 0, // 🌟 ดึงค่ายอดของเมื่อวานมาใช้
                    };
                }
                groupedData[key].count += parseInt(r.count) || 0;
                groupedData[key].totalAmount += parseFloat(r.total_amount) || 0;
                groupedData[key].approvedCount += (r.approved_count !== null ? parseInt(r.approved_count) : (parseInt(r.count) || 0));
                groupedData[key].rejectCount += parseInt(r.reject_count) || 0;
            });
        }

        pendingSummaryData = Object.values(groupedData);
        viewMode = 'monthly_history'; 
        window.uploadedFileDates.clear();   // [แก้] เดิมเอาวันที่ที่เลือกไปใส่ "วันที่ในไฟล์อัปโหลด" → อัปไฟล์ต่อแล้ววันที่ปนกัน

        renderSummaryDashboard();
        fetchLeaderboardData();
        Swal.close();
    } catch (e) { Swal.fire('Error', e.message, 'error'); }
};

// (ตัวห่อ clearSummaryData เดิมลบแล้ว — ฟังก์ชันหลักใน summary/core.js ล้างวันที่ที่เลือกให้อยู่แล้ว)

window.deleteSummaryDate = function(dateStr) {
    const [y, m, day] = dateStr.split('-');
    const displayDate = `${day}/${m}/${y}`;

    Swal.fire({
        title: `ลบข้อมูลวันที่ ${displayDate}?`, text: "ข้อมูลสรุปยอดของวันนี้จะถูกลบทิ้งอย่างถาวร!", icon: 'warning',
        showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#64748b', confirmButtonText: 'ลบทิ้งเลย', cancelButtonText: 'ยกเลิก',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl' }
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({ title: 'กำลังลบ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            try {
                const { error: delErr } = await appDB.from('transaction_daily_summary').delete().eq('date', dateStr);
                if (delErr) throw delErr;   // [แก้] เดิมไม่เช็ค → ลบไม่สำเร็จแต่ขึ้นว่าลบสำเร็จ
                await appDB.from('settings').update({ value: '[]' }).eq('key', 'saved_excel_files');
                if (window.clearQueryCache) window.clearQueryCache('sum_');
                if (window._sumCache) delete window._sumCache[`daily_${dateStr}`];
                
                window.selectedSummaryDates.delete(dateStr);
                window.pendingFileNames = []; 
                window.uploadedFileDates.clear(); 
                
                if (typeof fetchAvailableDates === 'function') await fetchAvailableDates(true);
                
                if (pendingSummaryData.length === 0) {
                    renderSummaryDashboard();
                    Swal.fire({ icon: 'success', title: 'ลบสำเร็จ', timer: 1500, showConfirmButton: false });
                } else {
                    clearSummaryData(); Swal.close();
                }
            } catch (e) { Swal.fire('Error', e.message, 'error'); }
        }
    });
};

window.toggleSummaryDate = function(dateStr) {
    if (window.selectedSummaryDates.has(dateStr)) window.selectedSummaryDates.delete(dateStr);
    else window.selectedSummaryDates.add(dateStr);
    window.renderDateSelector();   // วาดแค่ชิปวันที่ (เดิมวาดทั้งหน้าใหม่ทุกครั้งที่กดเลือกวัน)
};

window.saveWebLogo = async function() {
    const web = document.getElementById('webLogoKey').value;
    const urlInput = document.getElementById('webLogoUrlInput').value.trim();
    const fileInput = document.getElementById('webLogoFileInput');
    
    if (!urlInput && (!fileInput.files || fileInput.files.length === 0)) {
        return Swal.fire('เตือน', 'กรุณาใส่ลิงก์ URL หรือ อัปโหลดรูปภาพ', 'warning');
    }

    Swal.fire({title: 'กำลังบันทึกโลโก้...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});

    let finalUrl = urlInput;

    try {
        if (fileInput.files && fileInput.files.length > 0) {
            let file = fileInput.files[0];
            // 🖼️ ย่อโลโก้ก่อนอัป (โลโก้ไม่ต้องใหญ่ 400px ก็คมแล้ว) — ลดจากหลาย MB เหลือหลักสิบ KB
            if (typeof window.compressImage === 'function') {
                const before = file.size;
                file = await window.compressImage(file, { maxWidth: 400, maxHeight: 400, quality: 0.9, skipUnderKB: 60 });
                if (file.size < before) {
                    Swal.update({ html: `<div class="text-sm">ย่อรูปจาก ${(before/1024).toFixed(0)} KB → <b class="text-emerald-400">${(file.size/1024).toFixed(0)} KB</b><br>กำลังอัปโหลด...</div>` });
                }
            }
            const fileExt = (file.name.split('.').pop() || 'webp');
            const fileName = `logo_${web}_${Date.now()}.${fileExt}`;

            const { error: uploadError } = await appDB.storage.from('staff_images').upload(`logos/${fileName}`, await window.compressImageFile(file, { maxDim: 900, quality: 0.85 }), { cacheControl: '31536000', upsert: true });
            if (uploadError) throw new Error('อัปโหลดรูปไม่สำเร็จ: ' + uploadError.message);
            const { data: publicUrlData } = appDB.storage.from('staff_images').getPublicUrl(`logos/${fileName}`);
            finalUrl = publicUrlData.publicUrl;
        }

        window.summaryWebLogos = window.summaryWebLogos || {};
        window.summaryWebLogos[web] = finalUrl;
        
        if (typeof SETTINGS !== 'undefined') {
            SETTINGS['summary_web_logos'] = JSON.stringify(window.summaryWebLogos);
        }

        await appDB.from('settings').upsert([{ key: 'summary_web_logos', value: JSON.stringify(window.summaryWebLogos) }]);
        if (window.clearQueryCache) window.clearQueryCache('sum_logos');

        document.getElementById('webLogoModal').classList.add('hidden');
        if (typeof window.renderSummaryDashboard === 'function') window.renderSummaryDashboard();
        
        Swal.fire({icon: 'success', title: 'บันทึกโลโก้สำเร็จ!', timer: 1500, showConfirmButton: false});

    } catch (err) {
        Swal.fire('Error', err.message, 'error');
    }
};
