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
        const deptsToTry = ['AM', 'OD'];
        if (typeof currentUser !== 'undefined' && currentUser && currentUser.dept) {
            if (!deptsToTry.includes(currentUser.dept)) deptsToTry.unshift(currentUser.dept);
        }
        
        // กะที่ใช้ — ถ้า shiftFilterUi = 'ALL' ลองทุกกะ
        const shiftsToTry = (shiftFilterUi && shiftFilterUi !== 'ALL') 
            ? [shiftFilterUi]
            : ['กะเช้า', 'กะบ่าย', 'กะดึก'];
        
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

window.exportSummaryToExcel = async function() {
    if (!pendingSummaryData || pendingSummaryData.length === 0) return Swal.fire('ไม่มีข้อมูล', 'ไม่มีข้อมูลสำหรับดาวน์โหลด กรุณาอัปโหลดไฟล์ให้เรียบร้อย', 'warning');

    // เรียกฟังก์ชันแอบโหลดก่อน
    window.loadExcelLibrary(async function() {
        Swal.fire({ title: 'กำลังสร้างไฟล์ Excel...', text: 'จัดระเบียบตามรูปแบบใหม่...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        try {
            const shiftFilter = document.getElementById('summaryShiftFilter') ? document.getElementById('summaryShiftFilter').value : 'ALL';
            const odFilter = document.getElementById('summaryOdFilter') ? document.getElementById('summaryOdFilter').value : 'ALL';
            
            let filteredData = pendingSummaryData;
            if (shiftFilter !== 'ALL') filteredData = filteredData.filter(item => item.shift === shiftFilter || (shiftFilter==='UNKNOWN' && item.shift==='กะอิสระ'));
            if (odFilter !== 'ALL') filteredData = filteredData.filter(item => item.odType === odFilter || (item.odType === undefined && odFilter === 'ปกติ'));
            if (typeof summaryActiveWebFilter !== 'undefined' && summaryActiveWebFilter !== 'ALL') filteredData = filteredData.filter(item => item.website === summaryActiveWebFilter);

            const targetWebOrder = ['Jun88', 'MK8', 'VV72', 'TH26', 'F168', 'PG688', 'JL69', 'NM9', 'BT678', 'K188'];

            // 🌟 [NEW] โหลดข้อมูลจัดเวร (หลัก/รอง) ของวันที่นั้น
            const dutyAssignmentMap = await window.loadDutyAssignmentMap(filteredData, shiftFilter);

            let empGroups = {};
            filteredData.forEach(item => {
                if(!empGroups[item.empName]) {
                    empGroups[item.empName] = { 
                        name: item.empName, shift: item.shift === 'UNKNOWN' ? 'UNKNOWN' : item.shift.replace('กะ', ''), odType: item.odType || 'ปกติ',
                        totalApproved: 0, totalReject: 0, grandTotal: 0, websData: {} 
                    };
                    targetWebOrder.forEach(w => { empGroups[item.empName].websData[w] = { approved: 0, reject: 0, total: 0 }; });
                }
                
                empGroups[item.empName].totalApproved += (item.approvedCount || 0);
                empGroups[item.empName].totalReject += (item.rejectCount || 0);
                empGroups[item.empName].grandTotal += (item.count || 0);
                
                const webKey = targetWebOrder.find(w => w.toLowerCase() === item.website.toLowerCase());
                if (webKey) {
                    empGroups[item.empName].websData[webKey].approved += (item.approvedCount || 0);
                    empGroups[item.empName].websData[webKey].reject += (item.rejectCount || 0);
                    empGroups[item.empName].websData[webKey].total += (item.count || 0);
                }
            });

            const wb = new ExcelJS.Workbook();
            const ws = wb.addWorksheet(`สรุปยอดแยกเว็บ`);

            let headers = ['ลำดับ', 'ชื่อพนักงาน', 'กะ', 'แผนก'];
            // 1. สร้างคอลัมน์ สำเร็จ/ปฏิเสธ/รวม ของแต่ละเว็บ
            targetWebOrder.forEach(w => { headers.push(`${w} (สำเร็จ)`); headers.push(`${w} (ปฏิเสธ)`); headers.push(`${w} (รวม)`); });
            // 2. สร้างคอลัมน์ รวมทั้งสิ้น
            headers.push('รวมสำเร็จ'); headers.push('รวมปฏิเสธ'); headers.push('รวมทั้งสิ้น');
            
            // ขยับช่องว่างและเพิ่มคอลัมน์อ้างอิง (ชื่อ และ กะ)
            headers.push('', '', 'ชื่อพนักงาน (อ้างอิง)', 'กะ (อ้างอิง)');

            // 3. สร้างคอลัมน์ สรุปยอด ของแต่ละเว็บ ไว้ท้ายสุด
            targetWebOrder.forEach(w => { headers.push(`${w} (สรุปยอด)`); });

            let titleDateStr = '';
            if (viewMode === 'preview' && window.uploadedFileDates && window.uploadedFileDates.size > 0) {
                const datesArr = Array.from(window.uploadedFileDates).sort();
                if (datesArr.length === 1) {
                    const [y, m, d] = datesArr[0].split('-'); titleDateStr = `วันที่ ${d} เดือน ${m} ${y}`;
                } else {
                    const formattedDates = datesArr.map(d => { const [yy, mm, dd] = d.split('-'); return `${dd}/${mm}/${yy}`; });
                    titleDateStr = `ข้อมูลรวมหลายวัน: ${formattedDates.join(', ')}`;
                }
            } else {
                const dateVal = document.getElementById('summaryDateFilter').value;
                if (dateVal) { const [y, m, d] = dateVal.split('-'); titleDateStr = `วันที่ ${d} เดือน ${m} ${y}`; } 
                else { titleDateStr = 'ข้อมูลพรีวิว (ยังไม่ได้บันทึก)'; }
            }

            const titleRow = ws.addRow([titleDateStr]);
            ws.mergeCells(1, 1, 1, headers.length); 
            titleRow.height = 30;
            titleRow.getCell(1).font = { size: 16, bold: true, color: { argb: 'FF000000' } };
            titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }; 
            titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
            titleRow.getCell(1).border = { top: {style:'medium'}, left: {style:'medium'}, bottom: {style:'medium'}, right: {style:'medium'} };

            const headerRow = ws.addRow(headers); headerRow.height = 25;
            const headerColors = ['FFDBEAFE', 'FFDCFCE7', 'FFFEE2E2', 'FFFEF3C7', 'FFF3E8FF', 'FFFFEDD5', 'FFCCFBF1', 'FFE0E7FF', 'FFFCE7F3', 'FFE2E8F0'];
            const dataBgColors = ['FFF0F9FF', 'FFF0FDF4', 'FFFEF2F2', 'FFFFFBEB', 'FFFAF5FF', 'FFFFF7ED', 'FFF0FDFA', 'FFEEF2FF', 'FFFDF2F8', 'FFF8FAFC'];

            headerRow.eachCell((cell, colNumber) => {
                cell.font = { bold: true }; cell.alignment = { horizontal: 'center', vertical: 'middle' };
                if (colNumber <= 4) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } }; 
                    cell.font.color = { argb: 'FFFFFFFF' };
                    cell.border = { top: {style:'medium'}, left: {style:'medium'}, bottom: {style:'medium'}, right: {style:'thin', color: {argb:'FF94A3B8'}} };
                } else if (colNumber > 4 && colNumber <= 34) {
                    const webIndex = Math.floor((colNumber - 5) / 3);
                    const isLastInGroup = (colNumber - 5) % 3 === 2; const isFirstInGroup = (colNumber - 5) % 3 === 0;
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerColors[webIndex % headerColors.length] } };
                    cell.font.color = { argb: 'FF0F172A' };
                    let rightBorder = isLastInGroup ? 'medium' : 'thin'; let leftBorder = isFirstInGroup ? 'medium' : 'thin';
                    cell.border = { top: {style:'medium'}, bottom: {style:'medium'}, right: {style:rightBorder, color:{argb:'FF94A3B8'}}, left: {style:leftBorder, color:{argb:'FF94A3B8'}} };
                } else if (colNumber > 34 && colNumber <= 37) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } }; 
                    cell.font.color = { argb: 'FFFFFFFF' };
                    cell.border = { top: {style:'medium'}, left: {style:'medium'}, bottom: {style:'medium'}, right: {style:'medium'} };
                } else if (colNumber > 37 && colNumber <= 41) {
                    if (colNumber >= 40) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } }; 
                        cell.font.color = { argb: 'FFFFFFFF' };
                        cell.border = { top: {style:'medium'}, left: {style:'medium'}, bottom: {style:'medium'}, right: {style:'medium'} };
                    }
                } else {
                    const webIndex = colNumber - 42;
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerColors[webIndex % headerColors.length] } };
                    cell.font.color = { argb: 'FF0F172A' };
                    cell.border = { top: {style:'medium'}, left: {style:'thin', color:{argb:'FF94A3B8'}}, bottom: {style:'medium'}, right: {style:'thin', color:{argb:'FF94A3B8'}} };
                }
            });

            ws.views = [{ state: 'frozen', xSplit: 4, ySplit: 2 }];

            let rowIndex = 1;
            Object.values(empGroups).sort((a, b) => b.totalApproved - a.totalApproved).forEach((emp) => {
                // 🌟 [NEW] ต่อชื่อพนักงานด้วย (หลัก XXX) (รอง YYY) จาก duty assignment
                let displayName = emp.name;
                const dutyInfo = dutyAssignmentMap[emp.name.toLowerCase()];
                if (dutyInfo) {
                    const parts = [];
                    if (dutyInfo.main) parts.push(`หลัก ${dutyInfo.main}`);
                    if (dutyInfo.secondary) parts.push(`รอง ${dutyInfo.secondary}`);
                    if (parts.length > 0) {
                        displayName = `${emp.name} (${parts.join(') (')})`;
                    }
                }
                
                let rowData = [ rowIndex++, displayName, emp.shift, emp.odType === 'ปกติ' ? 'UNKNOWN' : emp.odType ];
                targetWebOrder.forEach(w => { rowData.push(emp.websData[w].approved); rowData.push(emp.websData[w].reject); rowData.push(emp.websData[w].total); });
                rowData.push(emp.totalApproved); rowData.push(emp.totalReject); rowData.push(emp.grandTotal); 
                
                // เพิ่มข้อมูลอ้างอิง ชื่อพนักงาน และ กะ
                rowData.push('', '', emp.name, emp.shift);

                targetWebOrder.forEach(w => { rowData.push(emp.websData[w].total); });

                const empRow = ws.addRow(rowData);

                empRow.eachCell((cell, colNumber) => {
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    if (colNumber <= 4) {
                        cell.border = { top: {style:'thin', color:{argb:'FFCBD5E1'}}, bottom: {style:'thin', color:{argb:'FFCBD5E1'}}, left: {style:'thin', color:{argb:'FFCBD5E1'}}, right: {style:'thin', color:{argb:'FFCBD5E1'}} };
                        if (colNumber === 2) { cell.font = { bold: true }; cell.alignment = { vertical: 'middle', horizontal: 'left' }; }
                        if (colNumber === 3) {
                            cell.font = { bold: true };
                            if (cell.value === 'เช้า') { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEDD5' } }; cell.font.color = { argb: 'FFEA580C' }; } 
                            else if (cell.value === 'กลาง') { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } }; cell.font.color = { argb: 'FF2563EB' }; } 
                            else if (cell.value === 'ดึก') { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E8FF' } }; cell.font.color = { argb: 'FF9333EA' }; } 
                            else if (cell.value === 'อิสระ' || cell.value === 'all') { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } }; cell.font.color = { argb: 'FF059669' }; cell.value = 'อิสระ'; }
                        }
                    } else if (colNumber > 4 && colNumber <= 34) {
                        const webIndex = Math.floor((colNumber - 5) / 3); const colIdxInGroup = (colNumber - 5) % 3; 
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: dataBgColors[webIndex % dataBgColors.length] } };
                        let rightBorder = colIdxInGroup === 2 ? 'medium' : 'thin'; let leftBorder = colIdxInGroup === 0 ? 'medium' : 'thin';
                        cell.border = { top: {style:'thin', color:{argb:'FFCBD5E1'}}, bottom: {style:'thin', color:{argb:'FFCBD5E1'}}, right: {style:rightBorder, color:{argb:'FF94A3B8'}}, left: {style:leftBorder, color:{argb:'FF94A3B8'}} };
                        if (cell.value > 0) {
                            if (colIdxInGroup === 0) cell.font = { color: { argb: 'FF16A34A' }, bold: true }; 
                            if (colIdxInGroup === 1) cell.font = { color: { argb: 'FFDC2626' }, bold: true }; 
                            if (colIdxInGroup === 2) cell.font = { color: { argb: 'FF2563EB' }, bold: true }; 
                        } else { cell.font = { color: { argb: 'FF94A3B8' } }; }
                    } else if (colNumber > 34 && colNumber <= 37) {
                        cell.border = { top: {style:'thin', color:{argb:'FFCBD5E1'}}, bottom: {style:'thin', color:{argb:'FFCBD5E1'}}, left: {style:'thin', color:{argb:'FFCBD5E1'}}, right: {style:'thin', color:{argb:'FFCBD5E1'}} };
                        if (cell.value > 0) {
                            if (colNumber === 35) cell.font = { color: { argb: 'FF16A34A' }, bold: true }; 
                            if (colNumber === 36) cell.font = { color: { argb: 'FFDC2626' }, bold: true }; 
                            if (colNumber === 37) { cell.font = { color: { argb: 'FF000000' }, bold: true }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE047' } }; }
                        } else { if (colNumber === 37) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE047' } }; } }
                    } else if (colNumber > 37 && colNumber <= 41) {
                        if (colNumber >= 40) {
                            cell.font = { bold: true }; cell.alignment = { vertical: 'middle', horizontal: colNumber === 40 ? 'left' : 'center' };
                            cell.border = { top: {style:'thin', color:{argb:'FFCBD5E1'}}, bottom: {style:'thin', color:{argb:'FFCBD5E1'}}, left: {style:'thin', color:{argb:'FFCBD5E1'}}, right: {style:'thin', color:{argb:'FFCBD5E1'}} };
                            
                            // ใส่สีให้คอลัมน์กะอ้างอิง (คอลัมน์ที่ 41)
                            if (colNumber === 41) {
                                if (cell.value === 'เช้า') { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEDD5' } }; cell.font.color = { argb: 'FFEA580C' }; } 
                                else if (cell.value === 'กลาง') { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } }; cell.font.color = { argb: 'FF2563EB' }; } 
                                else if (cell.value === 'ดึก') { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E8FF' } }; cell.font.color = { argb: 'FF9333EA' }; } 
                                else if (cell.value === 'อิสระ' || cell.value === 'all') { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } }; cell.font.color = { argb: 'FF059669' }; cell.value = 'อิสระ'; }
                            }
                        }
                    } else {
                        const webIndex = colNumber - 42;
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: dataBgColors[webIndex % dataBgColors.length] } };
                        cell.border = { top: {style:'thin', color:{argb:'FFCBD5E1'}}, bottom: {style:'thin', color:{argb:'FFCBD5E1'}}, left: {style:'thin', color:{argb:'FF94A3B8'}}, right: {style:'thin', color:{argb:'FF94A3B8'}} };
                        if (cell.value > 0) cell.font = { color: { argb: 'FF2563EB' }, bold: true }; 
                        else cell.font = { color: { argb: 'FF94A3B8' } }; 
                    }
                });
            });

            ws.columns.forEach((col, index) => {
                if (index === 0) col.width = 8; 
                else if (index === 1) col.width = 25; 
                else if (index === 2) col.width = 10; 
                else if (index === 3) col.width = 12; 
                else if (index >= 34 && index < 37) col.width = 15; 
                else if (index === 37 || index === 38) col.width = 5; 
                else if (index === 39) col.width = 25; 
                else if (index === 40) col.width = 12; 
                else if (index >= 41) col.width = 16; 
                else col.width = 11; 
            });

            const buffer = await wb.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url; link.download = `สรุปยอดรวมแต่ละเว็บ_ครบถ้วน.xlsx`; document.body.appendChild(link);
            link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);

            Swal.fire({ icon: 'success', title: 'ดาวน์โหลดไฟล์ Excel สำเร็จ!', timer: 1500, showConfirmButton: false });
        } catch (error) { Swal.fire('เกิดข้อผิดพลาด', 'ดาวน์โหลด Excel ไม่สำเร็จ: ' + error.message, 'error'); }
    });
};

window.openManageSystemModal = async function() {
    let customSystems = JSON.parse(localStorage.getItem('custom_web_systems') || '{}');
    let defaultWebList = (typeof TEAM_LIST !== 'undefined' && TEAM_LIST.length > 0) ? TEAM_LIST : ['Jun88', 'MK8', 'F168', 'PG688', 'JL69', 'NM9', 'VV72', 'TH26'];

    let html = '<div class="flex flex-col gap-3 max-h-[50vh] overflow-y-auto p-1 custom-scrollbar text-sm">';
    defaultWebList.forEach(web => {
        let currentSys = customSystems[web];
        if (!currentSys) {
            if(['Jun88', 'MK8', 'VV72', 'TH26'].includes(web)) currentSys = 'K36';
            else if(['F168'].includes(web)) currentSys = 'WG';
            else if(['PG688', 'JL69', 'NM9'].includes(web)) currentSys = 'TCG';
            else currentSys = 'SYSTEM';
        }
        
        html += getTpl('tpl-manage-system-item', {
            web: web,
            selSystem: currentSys === 'SYSTEM' ? 'selected' : '',
            selK36: currentSys === 'K36' ? 'selected' : '',
            selWg: currentSys === 'WG' ? 'selected' : '',
            selTcg: currentSys === 'TCG' ? 'selected' : ''
        });
    });
    html += '</div>';

    const { isConfirmed } = await Swal.fire({
        title: '<div class="text-xl font-black text-sky-400 flex items-center justify-center gap-2"><span class="material-icons">settings_applications</span> ตั้งค่าหลังบ้านให้เว็บไซต์</div>',
        html: `<p class="text-xs text-gray-400 mb-3">ตั้งค่าตรงนี้ก่อนอัปโหลดไฟล์ Excel ข้อมูลจะได้เข้าถูกกล่อง</p>${html}`,
        showCancelButton: true, confirmButtonText: 'บันทึกการตั้งค่า', cancelButtonText: 'ปิด', confirmButtonColor: '#0ea5e9', cancelButtonColor: '#64748b',
        customClass: { popup: 'dark:bg-slate-900 dark:text-white rounded-3xl' }
    });

    if (isConfirmed) {
        defaultWebList.forEach(web => {
            const sel = document.getElementById(`sys_select_modal_${web}`);
            if(sel) customSystems[web] = sel.value;
        });
        window.safeSetItem('custom_web_systems', JSON.stringify(customSystems));

        if (typeof pendingSummaryData !== 'undefined') {
            pendingSummaryData.forEach(item => {
                if (customSystems[item.website]) item.system = customSystems[item.website];
            });
        }
        Swal.fire({icon: 'success', title: 'บันทึกสำเร็จ', text: 'คราวหน้าอัปโหลด Excel ระบบจะดึงเข้ากล่องให้ถูกต้องเลย', timer: 2000, showConfirmButton: false});
        if (typeof debounceRenderSummary === 'function') debounceRenderSummary();
    }
};

window.openManageLogoModal = async function() {
    let defaultWebList = (typeof TEAM_LIST !== 'undefined' && TEAM_LIST.length > 0) ? TEAM_LIST : ['Jun88', 'MK8', 'F168', 'PG688', 'JL69', 'NM9', 'VV72', 'TH26', 'BT678', 'K188'];
    let optionsHtml = defaultWebList.map(w => `<option value="${w}">${w}</option>`).join('');

    const { value: selectedWeb } = await Swal.fire({
        title: 'เลือกเว็บไซต์',
        html: `
            <p class="text-sm text-gray-400 mb-4">ต้องการเปลี่ยนโลโก้ของเว็บไหนครับ?</p>
            <select id="swal-web-select" class="w-full p-3 rounded-xl border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white font-bold outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-inner">
                <option value="">-- เลือกเว็บไซต์ --</option>
                ${optionsHtml}
            </select>
        `,
        showCancelButton: true, confirmButtonColor: '#f59e0b', cancelButtonColor: '#64748b', confirmButtonText: 'ถัดไป', cancelButtonText: 'ยกเลิก',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl' },
        preConfirm: () => {
            const val = document.getElementById('swal-web-select').value;
            if (!val) { Swal.showValidationMessage('กรุณาเลือกเว็บไซต์ก่อนครับ'); return false; }
            return val;
        }
    });

    if (selectedWeb) {
        document.getElementById('webLogoKey').value = selectedWeb;
        document.getElementById('webLogoTargetName').innerText = selectedWeb;
        document.getElementById('webLogoUrlInput').value = '';
        document.getElementById('webLogoFileInput').value = '';
        
        const currentLogo = window.summaryWebLogos && window.summaryWebLogos[selectedWeb];
        const previewBox = document.getElementById('currentWebLogoPreviewBox');
        const previewImg = document.getElementById('currentWebLogoPreview');
        
        if (currentLogo) { previewImg.src = currentLogo; previewBox.classList.remove('hidden'); } 
        else { previewBox.classList.add('hidden'); }
        document.getElementById('webLogoModal').classList.remove('hidden');
    }
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
        const yesterdayDates = dates.map(d => {
            const dt = new Date(d);
            dt.setDate(dt.getDate() - 1);
            return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
        });

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
                        diffFromYesterday: 0
                    };
                }
                groupedData[key].count += parseInt(r.count) || 0;
                groupedData[key].totalAmount += parseFloat(r.total_amount) || 0;
                groupedData[key].approvedCount += (r.approved_count !== null ? parseInt(r.approved_count) : (parseInt(r.count) || 0));
                groupedData[key].rejectCount += parseInt(r.reject_count) || 0;
                
                // 🌟 คำนวณส่วนต่างหลังจากบวกทบยอดของวันนี้เสร็จแล้ว
                groupedData[key].diffFromYesterday = groupedData[key].count - groupedData[key].yestCount;
            });
        }

        pendingSummaryData = Object.values(groupedData);
        viewMode = 'monthly_history'; 
        window.uploadedFileDates = new Set(dates);

        renderSummaryDashboard();
        fetchLeaderboardData();
        Swal.close();
    } catch (e) { Swal.fire('Error', e.message, 'error'); }
};

const _originalClearSummaryDataForMulti = window.clearSummaryData;
window.clearSummaryData = function() {
    window.selectedSummaryDates.clear(); 
    _originalClearSummaryDataForMulti();
};

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
                await appDB.from('transaction_daily_summary').delete().eq('date', dateStr);
                await appDB.from('settings').update({ value: '[]' }).eq('key', 'saved_excel_files');
                
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
    renderSummaryDashboard();
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

            const { error: uploadError } = await appDB.storage.from('staff_images').upload(`logos/${fileName}`, file, { cacheControl: '31536000', upsert: true });
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
