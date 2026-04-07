let pendingSummaryData = []; 
let viewMode = 'preview'; 
let summaryActiveWebFilter = 'ALL';
window.uploadedFileDates = window.uploadedFileDates || new Set();
window.pendingFileNames = window.pendingFileNames || []; 
window.availableSummaryDates = [];
window.selectedSummaryDates = window.selectedSummaryDates || new Set();
let summaryRenderTimer;

let summarySubscription = null;

// 🟢 ฟังก์ชันคอยดักฟังเวลามีเครื่องอื่นกดบันทึกยอด
window.subscribeSummaryChanges = function() {
    if (!window.appDB) return;
    if (summarySubscription) window.appDB.removeChannel(summarySubscription);

    summarySubscription = window.appDB.channel('summary-updates')
    .on('broadcast', { event: 'force_summary_reload' }, async (payload) => {
        const currentDate = document.getElementById('summaryDateFilter') ? document.getElementById('summaryDateFilter').value : '';
        // ถ้ายืนอยู่หน้าประวัติของวันที่ตรงกับที่มีการบันทึก ให้แอบรีเฟรชข้อมูลเงียบๆ
        if (viewMode === 'history' && payload?.payload?.date === currentDate) {
            await window.fetchHistoricalSummary(true);
        }
    }).subscribe();
};

window.initSummaryDate = async function() {
    Swal.fire({title: 'กำลังโหลดข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
    try {
        const dateInput = document.getElementById('summaryDateFilter');
        if(dateInput && !dateInput.value) {
            const today = new Date();
            const offset = today.getTimezoneOffset() * 60000;
            dateInput.value = (new Date(today - offset)).toISOString().split('T')[0];
        }
        
        await loadWebLogos();
        if (typeof fetchAvailableDates === 'function') await fetchAvailableDates();
        
        // 🌟 เพิ่มบรรทัดนี้: บังคับโหลดรายชื่อพนักงานก่อน เพื่อให้ระบบรู้จักกะการทำงาน
        if (typeof fetchUsers === 'function' && (!window.GLOBAL_USER_LIST || window.GLOBAL_USER_LIST.length === 0)) {
            await fetchUsers();
        }

        await window.fetchHistoricalSummary(true);

        // เปิดใช้งานระบบเรียลไทม์
        if (typeof window.subscribeSummaryChanges === 'function') window.subscribeSummaryChanges();
        
    } catch(e) { console.error(e); } 
    finally { Swal.close(); }
}

// โหลดรูปโลโก้จาก Database
window.loadWebLogos = async function() {
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', 'summary_web_logos').single();
        if (data && data.value) {
            window.summaryWebLogos = JSON.parse(data.value);
            if (typeof SETTINGS !== 'undefined') SETTINGS['summary_web_logos'] = data.value;
        } else {
            window.summaryWebLogos = {};
        }
    } catch (e) {
        window.summaryWebLogos = {};
    }
}

// ฟังก์ชันดึงวันที่ย้อนหลัง (สร้างปุ่มประวัติ)
window.fetchAvailableDates = async function() {
    try {
        const { data } = await appDB.from('transaction_daily_summary').select('date');
        if (data) {
            window.availableSummaryDates = [...new Set(data.map(d => d.date))];
        }
    } catch (e) { console.error("Fetch dates error:", e); }
}

function getShiftFromName(name) {
    if (!window.GLOBAL_USER_LIST || window.GLOBAL_USER_LIST.length === 0) return 'UNKNOWN';
    const searchName = name.toLowerCase().replace(/[^a-z0-9ก-๙]/g, ''); 
    let foundUser = window.GLOBAL_USER_LIST.find(u => {
        const dbName = u.username.toLowerCase().replace(/[^a-z0-9ก-๙]/g, '');
        return dbName === searchName || (dbName.length > 2 && (dbName.includes(searchName) || searchName.includes(dbName)));
    });
    
    let shift = foundUser && foundUser.allowed_shift ? foundUser.allowed_shift : 'UNKNOWN';
    if (shift === 'all' || shift === '') shift = 'UNKNOWN';
    return shift;
}

function parseAmount(val) {
    if(!val) return 0;
    if(typeof val === 'number') return val;
    let cleanVal = String(val).replace(/[^0-9.-]+/g, ''); 
    return parseFloat(cleanVal) || 0;
}

function getRealDbUser(rawName) {
    if (!window.GLOBAL_USER_LIST || window.GLOBAL_USER_LIST.length === 0) return null;
    const searchName = rawName.toLowerCase().replace(/[^a-z0-9ก-๙]/g, ''); 
    
    let match = window.GLOBAL_USER_LIST.find(u => u.username.toLowerCase().replace(/[^a-z0-9ก-๙]/g, '') === searchName);
    if (match) return match;

    if (searchName.match(/^[man]/)) {
        const strippedSearchName = searchName.substring(1);
        match = window.GLOBAL_USER_LIST.find(u => u.username.toLowerCase().replace(/[^a-z0-9ก-๙]/g, '') === strippedSearchName);
        if (match) return match;
    }

    const sortedUsers = [...window.GLOBAL_USER_LIST].sort((a, b) => b.username.length - a.username.length);
    match = sortedUsers.find(u => {
        const dbName = u.username.toLowerCase().replace(/[^a-z0-9ก-๙]/g, '');
        return dbName.length > 2 && (searchName.includes(dbName) || dbName.includes(searchName));
    });
    return match || null;
}

window.handleDragOverExcel = function(e) {
    e.preventDefault(); e.stopPropagation();
    e.currentTarget.classList.add('scale-[1.03]', 'bg-slate-100', 'dark:bg-slate-700');
};

window.handleDragLeaveExcel = function(e) {
    e.preventDefault(); e.stopPropagation();
    e.currentTarget.classList.remove('scale-[1.03]', 'bg-slate-100', 'dark:bg-slate-700');
};

window.handleDropExcel = function(e, systemName) {
    e.preventDefault(); e.stopPropagation();
    e.currentTarget.classList.remove('scale-[1.03]', 'bg-slate-100', 'dark:bg-slate-700');
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        window.processExcelUpload(e, systemName);
    }
};

window.processExcelUpload = async function(event, fallbackSystemName) {
    let files = [];
    if (event.dataTransfer && event.dataTransfer.files.length > 0) files = Array.from(event.dataTransfer.files);
    else if (event.target && event.target.files.length > 0) files = Array.from(event.target.files);

    if (files.length === 0) return;

    Swal.fire({
        title: `กำลังประมวลผล ${files.length} ไฟล์...`, html: 'ระบบกำลังดึงข้อมูลและคัดกรองกะของพนักงาน...',
        allowOutsideClick: false, didOpen: () => Swal.showLoading()
    });

    try {
        let totalExtracted = 0; let skippedFiles = []; let errorFiles = [];
        let savedFilesList = [];
        if (typeof appDB !== 'undefined') {
            const { data: savedFilesData } = await appDB.from('settings').select('value').eq('key', 'saved_excel_files').single();
            if (savedFilesData && savedFilesData.value) savedFilesList = JSON.parse(savedFilesData.value);
        }

        for (let fIndex = 0; fIndex < files.length; fIndex++) {
            let file = files[fIndex];
            const fileName = file.name.toLowerCase();

            Swal.update({ html: `กำลังวิเคราะห์ไฟล์ที่ ${fIndex + 1}/${files.length}<br><b class="text-sky-500">${file.name}</b>` });

            if (!fileName.endsWith('.csv') && !fileName.endsWith('.xlsx')) { skippedFiles.push(`${file.name} (ไม่ใช่ไฟล์ Excel/CSV)`); continue; }
            if (window.pendingFileNames.includes(fileName)) { skippedFiles.push(`${file.name} (ซ้ำในรอบนี้)`); continue; }
            window.pendingFileNames.push(fileName);

            let fileSystem = 'K36'; 
            if (fileName.includes('jl69') || fileName.includes('nm9') || fileName.includes('pg688')) fileSystem = 'TCG';
            else if (fileName.includes('f168')) fileSystem = 'WG';

            try {
                let parsedRowsData = [];
                if (fileName.endsWith('.csv')) {
                    const text = await file.text();
                    const parseCSV = (str) => {
                        const rows = []; let currentRow = []; let currentCell = ''; let inQuotes = false;
                        for (let i = 0; i < str.length; i++) {
                            let cc = str[i], nc = str[i + 1];
                            if (cc === '"' && inQuotes && nc === '"') { currentCell += '"'; i++; } 
                            else if (cc === '"') { inQuotes = !inQuotes; } 
                            else if (cc === ',' && !inQuotes) { currentRow.push(currentCell.trim()); currentCell = ''; } 
                            else if ((cc === '\n' || cc === '\r') && !inQuotes) {
                                if (cc === '\r' && nc === '\n') i++; 
                                currentRow.push(currentCell.trim());
                                if (currentRow.some(v => v !== '')) rows.push(currentRow); 
                                currentRow = []; currentCell = '';
                            } else { currentCell += cc; }
                        }
                        if (currentCell !== '' || currentRow.length > 0) {
                            currentRow.push(currentCell.trim());
                            if (currentRow.some(v => v !== '')) rows.push(currentRow);
                        }
                        return rows;
                    };
                    parsedRowsData = parseCSV(text);
                } else {
                    const wb = new ExcelJS.Workbook();
                    const buffer = await file.arrayBuffer();
                    await wb.xlsx.load(buffer);
                    const ws = wb.worksheets[0]; 
                    ws.eachRow((row, rowNumber) => {
                        let cols = [];
                        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                            let val = cell.value;
                            if (val && typeof val === 'object' && val.text) val = val.text;
                            if (val && val instanceof Date) {
                                const offset = val.getTimezoneOffset() * 60000;
                                const localDate = new Date(val - offset);
                                const ds = localDate.toISOString().split('T')[0];
                                const ts = localDate.toISOString().split('T')[1].split('.')[0];
                                val = `${ds} ${ts}`; 
                            }
                            cols[colNumber - 1] = String(val || '');
                        });
                        for(let i=0; i<cols.length; i++) { if(cols[i]===undefined) cols[i]=''; }
                        parsedRowsData.push(cols);
                    });
                }

                const webNameMap = { 'vv72': 'VV72', 'jun88': 'Jun88', 'mk8': 'MK8', 'th26': 'TH26', 'bt678': 'BT678', 'k188': 'K188', 'nm9': 'NM9', 'pg688': 'PG688', 'jl69': 'JL69', 'f168': 'F168' };
                let colMap = { amount: -1, status: -1, emp: -1, web: -1 };
                let headerFound = false; let startDataRow = 1;

                for (let r = 0; r < Math.min(10, parsedRowsData.length); r++) {
                    if(!parsedRowsData[r]) continue;
                    let rowClean = parsedRowsData[r].map(c => String(c).replace(/[\s\r\n]+/g, '').toLowerCase());
                    
                    if (fileSystem === 'TCG') {
                        let cEmp = rowClean.findIndex(c => c.includes('ข้อมูลการอนุมัติครั้งแรก'));
                        let cStat = rowClean.findIndex(c => c === 'สถานะ' || c === 'status');
                        let cAmt = rowClean.findIndex(c => c.includes('จำนวนที่จ่ายจริง'));
                        let cWeb = rowClean.findIndex(c => c === 'แบรนด์' || c === 'brand');

                        if (cEmp !== -1 && cStat !== -1 && cAmt !== -1) {
                            colMap = { emp: cEmp, status: cStat, amount: cAmt, web: cWeb !== -1 ? cWeb : -1 };
                            headerFound = true; startDataRow = r + 1; break;
                        }
                    } else { 
                        let cEmp = rowClean.findIndex(c => c.includes('riskverification'));
                        let cStat = rowClean.findIndex(c => c === 'status' || c === 'สถานะ');
                        let cAmt = rowClean.findIndex(c => c.includes('actualw/d'));

                        if (cEmp === -1) cEmp = rowClean.findIndex(c => c.includes('approvedby') || c.includes('ตรวจสอบโดย'));

                        if (cEmp !== -1 && cStat !== -1 && cAmt !== -1) {
                            colMap = { emp: cEmp, status: cStat, amount: cAmt, web: cEmp };
                            headerFound = true; startDataRow = r + 1; break;
                        }
                    }
                }

                if (!headerFound) {
                    if (fileSystem === 'TCG') colMap = { amount: 16, status: 22, web: 23, emp: 24 };
                    else colMap = { amount: 25, status: 31, web: 33, emp: 33 };
                }

                let defaultWeb = '';
                for (let w of Object.keys(webNameMap)) { if (fileName.includes(w)) { defaultWeb = webNameMap[w]; break; } }
                
                if (!defaultWeb) {
                    for (let r = startDataRow; r < Math.min(startDataRow + 50, parsedRowsData.length); r++) {
                        if (!parsedRowsData[r]) continue;
                        if (fileSystem === 'TCG') {
                            let rawWeb = colMap.web !== -1 ? String(parsedRowsData[r][colMap.web] || '').trim().toLowerCase() : '';
                            for (let w of Object.keys(webNameMap)) { if (rawWeb.startsWith(w.substring(0, 2)) || rawWeb.includes(w)) { defaultWeb = webNameMap[w]; break; } }
                        } else {
                            let rawApp = colMap.emp !== -1 ? String(parsedRowsData[r][colMap.emp] || '').trim().toLowerCase() : '';
                            let fw = rawApp.split(/[\s\r\n]+/)[0] || '';
                            for (let w of Object.keys(webNameMap)) { if (fw.endsWith(w)) { defaultWeb = webNameMap[w]; break; } }
                        }
                        if (defaultWeb) break;
                    }
                }
                if (!defaultWeb) defaultWeb = fileSystem === 'TCG' ? 'PG688' : 'Jun88'; 

                let extractedRows = []; let detectedDate = null;

                for (let i = startDataRow; i < parsedRowsData.length; i++) {
                    let cellData = parsedRowsData[i];
                    if (!cellData || cellData.length < 3) continue; 

                    let empName = ''; let amount = 0; let webName = '';
                    let txStatus = 'Approved'; let odType = 'ปกติ'; let rowDate = null;

                    for (let c of cellData) {
                        const strC = String(c).trim();
                        let match = strC.match(/(202\d-\d{1,2}-\d{1,2})(?:\s+(\d{1,2}):\d{2}:\d{2})?/);
                        let altMatch = strC.match(/(\d{1,2})\/(\d{1,2})\/(202\d)(?:\s+(\d{1,2}):\d{2}(?::\d{2})?)?/);
                        let rowDateStr = null; let hour = null;

                        if (match) { rowDateStr = match[1]; hour = match[2] ? parseInt(match[2], 10) : null; } 
                        else if (altMatch) {
                            let p1 = parseInt(altMatch[1], 10); let p2 = parseInt(altMatch[2], 10);
                            let y = altMatch[3]; let m = p2 > 12 ? p1 : p2; let d = p2 > 12 ? p2 : p1; 
                            rowDateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                            hour = altMatch[4] ? parseInt(altMatch[4], 10) : null;
                        }

                        if (rowDateStr) {
                            rowDate = rowDateStr;
                            if (hour !== null && hour >= 0 && hour < 8) {
                                let dObj = new Date(rowDate); dObj.setDate(dObj.getDate() - 1);
                                rowDate = `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, '0')}-${String(dObj.getDate()).padStart(2, '0')}`;
                            }
                            window.uploadedFileDates.add(rowDate); 
                            break; 
                        }
                    }
                    if (!detectedDate && rowDate) detectedDate = rowDate; 

                    amount = parseAmount(cellData[colMap.amount]);
                    let rawStatus = String(cellData[colMap.status] || '').toUpperCase();
                    let rawApproveStr = String(cellData[colMap.emp] || '').trim().toLowerCase();

                    if (fileSystem === 'TCG' && colMap.web !== -1) {
                        let rawWeb = String(cellData[colMap.web] || '').trim().toLowerCase();
                        for (let w of Object.keys(webNameMap)) { if (rawWeb.startsWith(w.substring(0, 2)) || rawWeb.includes(w)) { webName = webNameMap[w]; break; } }
                    }

                    if (rawStatus.includes('REJECT') || rawStatus.includes('DECLINE') || rawStatus.includes('CANCEL') || rawStatus.includes('FAIL') || rawStatus.includes('REFUND') || rawStatus.includes('ปฏิเสธ') || rawStatus.includes('ยกเลิก')) {
                        txStatus = 'Reject'; amount = 0;
                    }

                    let firstWord = rawApproveStr.split(/[\s\r\n]+/)[0] || ''; 
                    
                    if (firstWord && firstWord !== 'system' && firstWord !== 'auto' && firstWord !== '-' && firstWord !== 'nan' && !firstWord.includes('202') && firstWord !== 'null') {
                        for (let w of Object.keys(webNameMap)) {
                            if (firstWord.endsWith(w)) {
                                if (fileSystem === 'K36') webName = webNameMap[w]; 
                                firstWord = firstWord.replace(w, '');
                                break;
                            }
                        }

                        if(firstWord.startsWith('odol')) { odType = 'ODOL'; firstWord = firstWord.replace('odol', ''); }
                        else if(firstWord.startsWith('odo')) { odType = 'OD'; firstWord = firstWord.replace('odo', ''); }
                        else if(firstWord.startsWith('od')) { odType = 'OD'; firstWord = firstWord.replace('od', ''); }
                        else if(firstWord.startsWith('am')) { odType = 'AM'; firstWord = firstWord.replace('am', ''); }
                        else if(firstWord.startsWith('fttt')) { odType = 'ปกติ'; firstWord = firstWord.replace('fttt', ''); }
                        else if(firstWord.startsWith('ftt')) { odType = 'ปกติ'; firstWord = firstWord.replace('ftt', ''); }
                        else if(firstWord.startsWith('ft')) { odType = 'ปกติ'; firstWord = firstWord.replace('ft', ''); }
                        
                        firstWord = firstWord.replace(/(\d+|vv)$/i, ''); empName = firstWord;
                    } else { continue; }

                    if (!empName || empName.length < 2 || /^[\d\W]+$/.test(empName)) continue; 
                    const sysWords = ['system', 'auto', 'null', 'nan', 'admin', 'api', 'bot'];
                    if (sysWords.includes(empName.toLowerCase())) continue;
                    
                    if (!webName) webName = defaultWeb; 

                    const realUser = getRealDbUser(empName);
                    let finalShift = 'UNKNOWN';
                    if (realUser) {
                        empName = realUser.username; 
                        finalShift = realUser.allowed_shift || 'UNKNOWN';
                        if (finalShift === 'all' || finalShift === '') finalShift = 'UNKNOWN';
                    }

                    const finalRowDate = rowDate || detectedDate || document.getElementById('summaryDateFilter').value;
                    extractedRows.push({ empName, amount, website: webName, system: fileSystem, status: txStatus, odType: odType, date: finalRowDate, shift: finalShift });
                }

                const targetDate = detectedDate || document.getElementById('summaryDateFilter').value;
                const targetObj = new Date(targetDate);
                const yestObj = new Date(targetObj); yestObj.setDate(yestObj.getDate() - 1);
                const yesterdayStr = yestObj.toISOString().split('T')[0];

                let yestMap = {};
                if (typeof appDB !== 'undefined') {
                    const { data: yestData } = await appDB.from('transaction_daily_summary').select('employee_name, website, count').eq('date', yesterdayStr);
                    if (yestData) yestData.forEach(r => yestMap[`${r.employee_name}_${r.website}`] = r.count);
                }

                extractedRows.forEach(row => {
                    let existingIndex = pendingSummaryData.findIndex(p => p.empName === row.empName && p.website === row.website && p.date === row.date);
                    const yestCount = yestMap[`${row.empName}_${row.website}`] || 0;

                    let customSystems = JSON.parse(localStorage.getItem('custom_web_systems') || '{}');
                    if (customSystems[row.website]) { row.system = customSystems[row.website]; }

                    if (existingIndex > -1) {
                        pendingSummaryData[existingIndex].count += 1;
                        pendingSummaryData[existingIndex].totalAmount += row.amount; 
                        if (row.status === 'Reject') pendingSummaryData[existingIndex].rejectCount = (pendingSummaryData[existingIndex].rejectCount || 0) + 1;
                        else pendingSummaryData[existingIndex].approvedCount = (pendingSummaryData[existingIndex].approvedCount || 0) + 1;
                        pendingSummaryData[existingIndex].diffFromYesterday = pendingSummaryData[existingIndex].count - yestCount;
                    } else {
                        pendingSummaryData.push({
                            date: row.date, empName: row.empName, website: row.website, system: row.system, shift: row.shift, odType: row.odType,
                            count: 1, approvedCount: row.status !== 'Reject' ? 1 : 0, rejectCount: row.status === 'Reject' ? 1 : 0,
                            totalAmount: row.amount, yestCount: yestCount, diffFromYesterday: 1 - yestCount
                        });
                    }
                });
                totalExtracted += extractedRows.length;
            } catch (e) {
                console.error(`Error in file ${file.name}:`, e);
                window.pendingFileNames = window.pendingFileNames.filter(n => n !== fileName);
                errorFiles.push(`${file.name} (${e.message})`);
            }
        } 

        const dateSpan = document.getElementById('summaryFileDates');
        if(dateSpan) {
            if (window.uploadedFileDates.size > 0) {
                const dateArr = Array.from(window.uploadedFileDates).sort().map(d => {
                    const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`;
                });
                dateSpan.innerText = dateArr.join(', ');
                dateSpan.className = "text-emerald-500 font-black"; 
            } else { dateSpan.innerText = '-'; }
        }

        viewMode = 'preview';
        renderSummaryDashboard();
        fetchLeaderboardData();

        let resultHtml = `ดึงข้อมูลมาได้ <b>${totalExtracted}</b> รายการ (เฉพาะ OD)<br><span class="text-sm text-green-600 font-bold">(ยอดถูกบวกทบกันเรียบร้อยแล้ว)</span>`;
        if (skippedFiles.length > 0) resultHtml += `<br><br><span class="text-xs text-orange-500"><b>ข้ามไฟล์ซ้ำ:</b><br>${skippedFiles.join('<br>')}</span>`;
        if (errorFiles.length > 0) resultHtml += `<br><br><span class="text-xs text-red-500"><b>ไฟล์ที่มีปัญหา:</b><br>${errorFiles.join('<br>')}</span>`;

        if (totalExtracted > 0) Swal.fire({ icon: 'success', title: 'ประมวลผลเสร็จสิ้น!', html: resultHtml, showConfirmButton: true, confirmButtonColor: '#10b981' });
        else Swal.fire({ icon: 'warning', title: 'เสร็จสิ้น (ไม่ได้ข้อมูลเพิ่ม)', html: resultHtml, showConfirmButton: true, confirmButtonColor: '#f59e0b' });
        
    } catch (e) { Swal.fire('Error', 'เกิดข้อผิดพลาดในระบบ: ' + e.message, 'error'); }
    if (event.target && event.target.type === 'file') event.target.value = ''; 
};

window.debounceRenderSummary = function() {
    clearTimeout(summaryRenderTimer);
    summaryRenderTimer = setTimeout(() => { window.renderSummaryDashboard(); }, 200);
};

window.renderSummaryDashboard = function() {
    if (typeof SETTINGS !== 'undefined' && SETTINGS['summary_web_logos']) {
        try { window.summaryWebLogos = typeof SETTINGS['summary_web_logos'] === 'string' ? JSON.parse(SETTINGS['summary_web_logos']) : SETTINGS['summary_web_logos']; } 
        catch(e) { window.summaryWebLogos = {}; }
    } else if (typeof window.summaryWebLogos === 'undefined') { window.summaryWebLogos = {}; }
    const safeWebLogos = window.summaryWebLogos;

    const mainBox = document.getElementById('summaryTableBody');
    const webBox = document.getElementById('summaryWebGrid');
    const statsBox = document.getElementById('shiftSummaryStats');
    
    const shiftFilter = document.getElementById('summaryShiftFilter') ? document.getElementById('summaryShiftFilter').value : 'ALL';
    const odFilter = document.getElementById('summaryOdFilter') ? document.getElementById('summaryOdFilter').value : 'ALL';
    const searchKeyword = document.getElementById('summarySearch') ? document.getElementById('summarySearch').value.toLowerCase().trim() : '';

    if (webBox) webBox.className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 p-1";
    if (mainBox) mainBox.className = "flex-1 overflow-y-auto custom-scrollbar pr-2 content-start";

    const hasData = typeof pendingSummaryData !== 'undefined' && pendingSummaryData.length > 0;

    if (!hasData) {
        let datesHtml = '';
        if (window.availableSummaryDates && window.availableSummaryDates.length > 0) {
            const sortedDates = window.availableSummaryDates.sort((a,b) => new Date(b) - new Date(a));
            datesHtml = `
            <div class="mt-8 w-full max-w-4xl animate-fade-in-up mx-auto">
                <div class="bg-[#151f32] p-5 md:p-8 rounded-3xl border border-slate-700 shadow-2xl relative overflow-hidden">
                    <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 border-b border-slate-700/80 pb-6">
                        <div class="flex items-center gap-4">
                            <div class="w-14 h-14 rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30 shadow-inner shrink-0">
                                <span class="material-icons text-3xl">date_range</span>
                            </div>
                            <div class="text-left">
                                <h3 class="text-lg md:text-xl font-black text-white tracking-wide">เลือกวันที่ต้องการดูข้อมูล</h3>
                                <p class="text-xs text-sky-400/80 font-bold mt-0.5">หรือเลือกหลายๆ วันพร้อมกันเพื่อนำยอดมาบวกทบกันได้</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-600 shadow-inner w-full md:w-auto">
                            <span class="material-icons text-gray-500 pl-2 text-[18px]">search</span>
                            <input type="date" id="searchAvailableDate" onchange="if(this.value){ toggleSummaryDate(this.value); this.value=''; }" class="bg-transparent text-white text-sm outline-none px-2 py-1.5 cursor-pointer font-mono w-full" title="ค้นหาวันที่อื่นๆ">
                        </div>
                    </div>
                    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3" id="availableDatesContainer">` + 
            sortedDates.map(d => {
                const [y, m, day] = d.split('-');
                const isSelected = window.selectedSummaryDates.has(d);
                const cardClass = isSelected ? 'bg-gradient-to-br from-sky-500 to-blue-600 border-transparent shadow-[0_0_15px_rgba(14,165,233,0.4)] scale-105 z-10' : 'bg-slate-800 border-slate-600 hover:border-sky-400 hover:bg-slate-700';
                const textClass = isSelected ? 'text-white' : 'text-gray-300';
                const iconClass = isSelected ? 'text-white' : 'text-gray-500';

                return `
                <div class="relative group flex flex-col transition-all duration-300 rounded-xl border ${cardClass}">
                    <button onclick="toggleSummaryDate('${d}')" class="flex-1 px-3 py-3.5 flex flex-col items-center justify-center gap-1.5 w-full outline-none">
                        <span class="material-icons ${iconClass} text-[22px] transition-colors">${isSelected ? 'check_circle' : 'radio_button_unchecked'}</span>
                        <span class="font-black ${textClass} text-sm tracking-wider">${day}/${m}/${y.substring(2)}</span>
                    </button>
                    <div class="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                        <button onclick="deleteSummaryDate('${d}')" class="bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center shadow-lg hover:bg-red-400 hover:scale-110 transition-transform border-2 border-[#151f32]" title="ลบข้อมูลของวันนี้ทิ้งถาวร">
                            <span class="material-icons text-[12px]">delete</span>
                        </button>
                    </div>
                </div>`;
            }).join('') + `
                    </div>
                    <div class="mt-6 pt-5 border-t border-slate-700/80 flex flex-col sm:flex-row justify-between items-center gap-4 bg-[#0b1120] -mx-8 -mb-8 px-8 py-5">
                        <div class="text-sm font-bold text-gray-400 bg-slate-900 px-4 py-2.5 rounded-xl border border-slate-700 shadow-inner flex items-center gap-2">
                            <span class="material-icons text-lg">shopping_cart</span>
                            เลือกไว้: <span class="text-sky-400 font-black text-xl w-6 text-center leading-none">${window.selectedSummaryDates.size}</span> วัน
                        </div>
                        <div class="flex gap-2 w-full sm:w-auto">
                            <button onclick="window.selectedSummaryDates.clear(); renderSummaryDashboard();" class="flex-1 sm:flex-none px-4 py-2 bg-slate-800 hover:bg-slate-700 text-gray-300 rounded-xl text-xs font-bold transition border border-slate-600">
                                ล้างการเลือก
                            </button>
                            <button onclick="fetchMultipleHistoricalSummary()" class="flex-1 sm:flex-none px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-black shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 transform active:scale-95 disabled:opacity-50 disabled:grayscale" ${window.selectedSummaryDates.size === 0 ? 'disabled' : ''}>
                                <span class="material-icons text-[18px]">visibility</span> ดูยอดสรุป
                            </button>
                        </div>
                    </div>
                </div>
            </div>`;
        }

        if(mainBox) mainBox.innerHTML = `<div class="text-center py-10 flex flex-col items-center w-full">${datesHtml}</div>`;
        if(statsBox) statsBox.innerHTML = '<div class="text-center text-gray-400 text-sm py-2 w-full">ยังไม่มีข้อมูลยอดรวม</div>';
        
    } else {
        let shiftStats = { 'กะเช้า': 0, 'กะกลาง': 0, 'กะดึก': 0, 'UNKNOWN': 0, 'TOTAL': 0, 'APPROVED': 0, 'REJECT': 0 };
        
        let filteredData = pendingSummaryData;
        if (shiftFilter !== 'ALL') filteredData = filteredData.filter(item => item.shift === shiftFilter);
        if (odFilter !== 'ALL') filteredData = filteredData.filter(item => item.odType === odFilter || (item.odType === undefined && odFilter === 'ปกติ'));
        if (typeof summaryActiveWebFilter !== 'undefined' && summaryActiveWebFilter !== 'ALL') filteredData = filteredData.filter(item => item.website === summaryActiveWebFilter);

        filteredData = filteredData.filter(item => !item.empName.toLowerCase().includes('system') && !item.empName.toLowerCase().includes('auto'));

        filteredData.forEach(item => {
            shiftStats.TOTAL += item.count;
            shiftStats.APPROVED += (item.approvedCount || 0);
            shiftStats.REJECT += (item.rejectCount || 0);
            if(shiftStats[item.shift] !== undefined) shiftStats[item.shift] += item.count;
            else shiftStats['UNKNOWN'] += item.count;
        });

        if (statsBox) {
            statsBox.innerHTML = `
                <div class="px-4 py-2 bg-slate-900 rounded-xl border border-slate-700 text-center min-w-[120px] shadow-inner flex-1">
                    <div class="text-[10px] text-gray-500 font-bold mb-0.5 uppercase tracking-widest">ยอดรวมทั้งหมด</div>
                    <div class="text-xl font-black text-white">${shiftStats.TOTAL.toLocaleString()}</div>
                    <div class="flex justify-center gap-2 mt-1 text-[9px] font-bold">
                        <span class="text-emerald-400">✅ ${shiftStats.APPROVED.toLocaleString()}</span>
                        <span class="text-red-400">❌ ${shiftStats.REJECT.toLocaleString()}</span>
                    </div>
                </div>
                <div class="px-4 py-2 bg-orange-900/20 rounded-xl border border-orange-900/50 text-center min-w-[100px] shadow-sm flex flex-col justify-center">
                    <div class="text-[10px] text-orange-400 font-bold mb-0.5">☀️ กะเช้า</div>
                    <div class="text-xl font-black text-orange-500">${shiftStats['กะเช้า'].toLocaleString()}</div>
                </div>
                <div class="px-4 py-2 bg-blue-900/20 rounded-xl border border-blue-900/50 text-center min-w-[100px] shadow-sm flex flex-col justify-center">
                    <div class="text-[10px] text-blue-400 font-bold mb-0.5">🌤️ กะกลาง</div>
                    <div class="text-xl font-black text-blue-500">${shiftStats['กะกลาง'].toLocaleString()}</div>
                </div>
                <div class="px-4 py-2 bg-purple-900/20 rounded-xl border border-purple-900/50 text-center min-w-[100px] shadow-sm flex flex-col justify-center">
                    <div class="text-[10px] text-purple-400 font-bold mb-0.5">🌙 กะดึก</div>
                    <div class="text-xl font-black text-purple-500">${shiftStats['กะดึก'].toLocaleString()}</div>
                </div>
            `;
        }

        if (mainBox) {
            if (filteredData.length === 0) {
                mainBox.innerHTML = `<div class="text-center py-20 text-gray-400 font-bold flex flex-col items-center"><span class="material-icons text-7xl mb-4 opacity-20">search_off</span>ไม่พบข้อมูลตามเงื่อนไขที่เลือก</div>`;
            } else {
                let htmlArr = [];
                
                if (viewMode === 'history' || viewMode === 'monthly_history') {
                    htmlArr.push(`
                    <div class="flex justify-between items-center mb-4 bg-slate-800 p-2 pl-4 rounded-xl border border-slate-600 shadow-sm">
                        <span class="text-sky-400 text-xs font-bold flex items-center gap-1"><span class="material-icons text-[14px]">history</span> โหมดดูข้อมูลย้อนหลัง</span>
                        <button onclick="clearSummaryData()" class="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 shadow border border-slate-500">
                            <span class="material-icons text-sm">arrow_back</span> กลับไปหน้าเลือกวันที่
                        </button>
                    </div>
                    `);
                }

                let dateGroups = {};
                filteredData.forEach(item => {
                    let itemDate = item.date || document.getElementById('summaryDateFilter').value || 'ไม่ระบุวันที่';
                    if(!dateGroups[itemDate]) {
                        dateGroups[itemDate] = { totalCount: 0, totalMoney: 0, totalApproved: 0, totalReject: 0, emps: {} };
                    }
                    let dGroup = dateGroups[itemDate];
                    dGroup.totalCount += item.count;
                    dGroup.totalMoney += item.totalAmount;
                    dGroup.totalApproved += (item.approvedCount || 0);
                    dGroup.totalReject += (item.rejectCount || 0);

                    if(!dGroup.emps[item.empName]) {
                        dGroup.emps[item.empName] = { totalCount: 0, totalMoney: 0, totalApproved: 0, totalReject: 0, webs: [], shift: item.shift, odType: item.odType || 'ปกติ' };
                    }
                    dGroup.emps[item.empName].totalCount += item.count;
                    dGroup.emps[item.empName].totalApproved += (item.approvedCount || 0);
                    dGroup.emps[item.empName].totalReject += (item.rejectCount || 0);
                    dGroup.emps[item.empName].totalMoney += item.totalAmount;
                    dGroup.emps[item.empName].webs.push(item);
                });

                const sortedDates = Object.keys(dateGroups).sort((a, b) => new Date(b) - new Date(a));

                sortedDates.forEach((dateStr) => {
                    const dGroup = dateGroups[dateStr];
                    let displayDate = dateStr;
                    if(dateStr.includes('-')) {
                        const [y, m, d] = dateStr.split('-');
                        const monthNames = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
                        displayDate = `วันที่ ${parseInt(d)} ${monthNames[parseInt(m)-1]} ${parseInt(y)+543}`;
                    }

                    htmlArr.push(`
                    <div class="bg-slate-800 border border-slate-600 rounded-2xl mb-4 overflow-hidden shadow-lg transform-gpu transition-all">
                        <div class="flex justify-between items-center p-4 bg-indigo-900/60 hover:bg-indigo-800 transition cursor-pointer border-b border-indigo-500/30" 
                             onclick="this.nextElementSibling.classList.toggle('hidden'); const icon = this.querySelector('.toggle-icon'); icon.innerText = icon.innerText === 'expand_more' ? 'expand_less' : 'expand_more';">
                            <div class="flex items-center gap-4 overflow-hidden pr-2">
                                <div class="w-12 h-12 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-black text-xl border border-indigo-500/30 shadow-inner shrink-0">
                                    <span class="material-icons">calendar_month</span>
                                </div>
                                <div class="flex flex-col min-w-0">
                                    <span class="font-black text-white text-lg md:text-xl truncate tracking-wide">${displayDate}</span>
                                    <span class="text-[11px] text-indigo-300 font-bold flex items-center gap-1"><span class="material-icons text-[12px]">group</span> พนักงาน ${Object.keys(dGroup.emps).length} คน</span>
                                </div>
                            </div>
                            <div class="flex items-center gap-4 shrink-0 pl-2">
                                <div class="text-right flex flex-col items-end hidden sm:flex">
                                    <span class="font-black text-emerald-400 text-lg md:text-xl leading-none">${dGroup.totalCount.toLocaleString()} <span class="text-[10px] text-gray-500 font-normal">ยอดรวม</span></span>
                                    <div class="flex gap-1 mt-1">
                                        <span class="text-[9px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30">✅ ${dGroup.totalApproved}</span>
                                        <span class="text-[9px] font-bold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/30">❌ ${dGroup.totalReject}</span>
                                    </div>
                                </div>
                                <div class="w-8 h-8 rounded-full bg-slate-900/50 flex items-center justify-center border border-slate-700">
                                    <span class="material-icons text-gray-400 text-xl toggle-icon transition-transform">expand_more</span>
                                </div>
                            </div>
                        </div>
                        <div class="${sortedDates.length === 1 ? '' : 'hidden'} p-4 bg-slate-900/30">
                    `);

                    let sortedEmps = Object.keys(dGroup.emps).sort((a, b) => dGroup.emps[b].totalCount - dGroup.emps[a].totalCount);
                    if (searchKeyword !== '') sortedEmps = sortedEmps.filter(name => name.toLowerCase().includes(searchKeyword));

                    if (sortedEmps.length === 0) {
                        htmlArr.push(`<div class="text-center py-10 text-gray-400 font-bold">ไม่พบพนักงานชื่อ "${searchKeyword}" ในวันนี้</div>`);
                    } else {
                        sortedEmps.forEach((name, index) => {
                            const data = dGroup.emps[name];
                            let shiftBadgeHtml = '';
                            if (data.shift === 'กะเช้า') shiftBadgeHtml = '<span class="text-[10px] bg-orange-500/20 text-orange-400 border border-orange-500/50 px-2 py-0.5 rounded shadow-sm">เช้า</span>';
                            else if (data.shift === 'กะกลาง') shiftBadgeHtml = '<span class="text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/50 px-2 py-0.5 rounded shadow-sm">กลาง</span>';
                            else if (data.shift === 'กะดึก') shiftBadgeHtml = '<span class="text-[10px] bg-purple-500/20 text-purple-400 border border-purple-500/50 px-2 py-0.5 rounded shadow-sm">ดึก</span>';
                            else shiftBadgeHtml = '<span class="text-[10px] bg-gray-500/20 text-gray-400 border border-gray-500/50 px-2 py-0.5 rounded shadow-sm">UNKNOWN</span>';
                            
                            let odBadge = '';
                            if (data.odType === 'OD') odBadge = '<span class="text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full ml-1 font-bold shadow">OD</span>';
                            if (data.odType === 'ODOL') odBadge = '<span class="text-[9px] bg-pink-600 text-white px-1.5 py-0.5 rounded-full ml-1 font-bold shadow">ODOL</span>';

                            let webTags = data.webs.map(w => {
                                let diffNum = w.count - (w.yestCount || 0);
                                let diffHtml = '';
                                if (diffNum > 0) diffHtml = `<span class="text-emerald-400 font-bold bg-emerald-900/30 px-1.5 py-0.5 rounded flex items-center gap-0.5 border border-emerald-800/50 text-[10px] shadow-sm"><span class="material-icons text-[10px]">trending_up</span> +${diffNum}</span>`;
                                else if (diffNum < 0) diffHtml = `<span class="text-red-400 font-bold bg-red-900/30 px-1.5 py-0.5 rounded flex items-center gap-0.5 border border-red-800/50 text-[10px] shadow-sm"><span class="material-icons text-[10px]">trending_down</span> ${diffNum}</span>`;
                                else diffHtml = `<span class="text-gray-400 bg-gray-800 px-2 py-0.5 rounded text-[10px] border border-gray-600 shadow-sm">คงที่</span>`;

                                // 🚨 เอา class ที่เป็นตัวการทำให้หน่วงออกทั้งหมด (transform-gpu, will-change, transition ซับซ้อน)
                                return `
                                <div class="bg-[#0b1120] p-3 rounded-xl border border-slate-700/80 shadow-inner flex flex-col justify-between hover:border-sky-500/50 relative overflow-hidden group/card">
                                    <div class="flex justify-between items-start mb-2 border-b border-slate-700/50 pb-2">
                                        <span class="font-black text-white text-sm tracking-wider flex items-center gap-1.5"><span class="material-icons text-[16px] text-sky-400">language</span> ${w.website}</span>
                                        ${diffHtml}
                                    </div>
                                    <div class="flex items-center justify-between mb-2 px-1">
                                        <div class="text-center">
                                            <div class="text-[9px] text-gray-500 font-bold mb-0.5 tracking-wide">เมื่อวาน</div>
                                            <div class="font-black text-gray-400 text-sm leading-none">${w.yestCount || 0} <span class="text-[9px] font-normal text-gray-500">ยอด</span></div>
                                        </div>
                                        <div class="text-slate-600 material-icons text-[16px] group-hover/card:text-sky-500">arrow_forward</div>
                                        <div class="text-center">
                                            <div class="text-[9px] text-sky-400 font-bold mb-0.5 tracking-wide">วันนี้</div>
                                            <div class="font-black text-sky-400 text-lg leading-none">${w.count} <span class="text-[9px] font-normal text-sky-700">ยอด</span></div>
                                        </div>
                                    </div>
                                    <div class="flex justify-between gap-1 mb-2">
                                        <div class="flex-1 bg-emerald-900/20 text-emerald-400 text-[9px] font-bold px-1.5 py-0.5 rounded border border-emerald-800/30 text-center">✅ สำเร็จ: ${w.approvedCount || 0}</div>
                                        <div class="flex-1 bg-red-900/20 text-red-400 text-[9px] font-bold px-1.5 py-0.5 rounded border border-red-800/30 text-center">❌ ปฏิเสธ: ${w.rejectCount || 0}</div>
                                    </div>
                                    <div class="bg-emerald-900/20 px-2 py-1.5 rounded-lg border border-emerald-800/30 flex justify-between items-center mt-auto shadow-sm">
                                        <span class="text-[9px] text-emerald-500 font-bold">รวมเป็นเงิน</span>
                                        <span class="font-mono font-bold text-emerald-400 text-sm">฿${w.totalAmount.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                                    </div>
                                </div>`;
                            }).join('');

                            let quickWebBadges = data.webs.map(w => `<span class="bg-slate-900 border border-slate-600 px-1.5 py-0.5 rounded text-[10px] text-gray-300 whitespace-nowrap shadow-sm"><b class="text-sky-400">${w.website}:</b> ${w.count}</span>`).join('');

                            // 🚨 สร้างแถบธรรมดา ไม่ต้องบังคับการ์ดจอวาดแล้ว
                            htmlArr.push(`
                            <div class="bg-slate-800 border border-slate-700 rounded-xl mb-3 overflow-hidden shadow-sm hover:shadow-md">
                                <div class="flex justify-between items-center p-3 bg-slate-800 hover:bg-slate-700 cursor-pointer" onclick="this.nextElementSibling.classList.toggle('hidden')">
                                    <div class="flex items-center gap-3 overflow-hidden pr-2">
                                        <div class="w-8 h-8 rounded-full bg-slate-700 text-gray-400 flex items-center justify-center font-black text-xs border border-slate-600 shadow-inner shrink-0">${index + 1}</div>
                                        <div class="flex flex-col min-w-0">
                                            <div class="flex items-center gap-2 mb-1"><span class="font-black text-white text-sm md:text-base truncate">${name}${odBadge}</span>${shiftBadgeHtml}</div>
                                            <div class="flex flex-wrap gap-1">${quickWebBadges}</div>
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-3 shrink-0 pl-2">
                                        <div class="text-right flex flex-col items-end">
                                            <span class="font-black text-emerald-400 text-base md:text-lg leading-none">${data.totalCount} <span class="text-[10px] text-gray-500 font-normal">ยอด</span></span>
                                        </div>
                                        <span class="material-icons text-gray-500 text-sm">expand_more</span>
                                    </div>
                                </div>
                                <div class="hidden p-3 bg-slate-900/80 border-t border-slate-700">
                                    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">${webTags}</div>
                                </div>
                            </div>`);
                        });
                    }
                    htmlArr.push(`</div></div>`);
                });
                
                if (viewMode === 'history' || viewMode === 'monthly_history') {
                    let datesHtml = '';
                    if (window.availableSummaryDates && window.availableSummaryDates.length > 0) {
                        const sortedDates = window.availableSummaryDates.sort((a,b) => new Date(b) - new Date(a));
                        datesHtml = `
                        <div class="mt-8 w-full max-w-4xl animate-fade-in-up mx-auto">
                            <div class="bg-[#151f32] p-5 md:p-8 rounded-3xl border border-slate-700 shadow-2xl relative overflow-hidden">
                                <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 border-b border-slate-700/80 pb-6">
                                    <div class="flex items-center gap-4">
                                        <div class="w-14 h-14 rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30 shadow-inner shrink-0">
                                            <span class="material-icons text-3xl">date_range</span>
                                        </div>
                                        <div class="text-left">
                                            <h3 class="text-lg md:text-xl font-black text-white tracking-wide">เลือกวันที่ต้องการดูข้อมูล</h3>
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-2 bg-slate-900 p-1.5 rounded-xl border border-slate-600 shadow-inner w-full md:w-auto">
                                        <span class="material-icons text-gray-500 pl-2 text-[18px]">search</span>
                                        <input type="date" id="searchAvailableDate" onchange="if(this.value){ toggleSummaryDate(this.value); this.value=''; }" class="bg-transparent text-white text-sm outline-none px-2 py-1.5 cursor-pointer font-mono w-full" title="ค้นหาวันที่อื่นๆ">
                                    </div>
                                </div>
                                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3" id="availableDatesContainer">` + 
                        sortedDates.map(d => {
                            const [y, m, day] = d.split('-');
                            const isSelected = window.selectedSummaryDates.has(d);
                            const cardClass = isSelected ? 'bg-gradient-to-br from-sky-500 to-blue-600 border-transparent shadow-[0_0_15px_rgba(14,165,233,0.4)] scale-105 z-10' : 'bg-slate-800 border-slate-600 hover:border-sky-400 hover:bg-slate-700';
                            const textClass = isSelected ? 'text-white' : 'text-gray-300';
                            const iconClass = isSelected ? 'text-white' : 'text-gray-500';

                            return `
                            <div class="relative group flex flex-col transition-all duration-300 rounded-xl border ${cardClass}">
                                <button onclick="toggleSummaryDate('${d}')" class="flex-1 px-3 py-3.5 flex flex-col items-center justify-center gap-1.5 w-full outline-none">
                                    <span class="material-icons ${iconClass} text-[22px] transition-colors">${isSelected ? 'check_circle' : 'radio_button_unchecked'}</span>
                                    <span class="font-black ${textClass} text-sm tracking-wider">${day}/${m}/${y.substring(2)}</span>
                                </button>
                                <div class="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                    <button onclick="deleteSummaryDate('${d}')" class="bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center shadow-lg hover:bg-red-400 hover:scale-110 transition-transform border-2 border-[#151f32]" title="ลบข้อมูลของวันนี้ทิ้งถาวร">
                                        <span class="material-icons text-[12px]">delete</span>
                                    </button>
                                </div>
                            </div>`;
                        }).join('') + `
                                </div>
                                <div class="mt-6 pt-5 border-t border-slate-700/80 flex flex-col sm:flex-row justify-between items-center gap-4 bg-[#0b1120] -mx-8 -mb-8 px-8 py-5">
                                    <div class="text-sm font-bold text-gray-400 bg-slate-900 px-4 py-2.5 rounded-xl border border-slate-700 shadow-inner flex items-center gap-2">
                                        <span class="material-icons text-lg">shopping_cart</span>
                                        เลือกไว้: <span class="text-sky-400 font-black text-xl w-6 text-center leading-none">${window.selectedSummaryDates.size}</span> วัน
                                    </div>
                                    <div class="flex gap-2 w-full sm:w-auto">
                                        <button onclick="window.selectedSummaryDates.clear(); renderSummaryDashboard();" class="flex-1 sm:flex-none px-4 py-2 bg-slate-800 hover:bg-slate-700 text-gray-300 rounded-xl text-xs font-bold transition border border-slate-600">
                                            ล้างการเลือก
                                        </button>
                                        <button onclick="fetchMultipleHistoricalSummary()" class="flex-1 sm:flex-none px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-black shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 transform active:scale-95 disabled:opacity-50 disabled:grayscale" ${window.selectedSummaryDates.size === 0 ? 'disabled' : ''}>
                                            <span class="material-icons text-[18px]">visibility</span> ดูยอดสรุป
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>`;
                    }
                    htmlArr.push(`
                    <div class="w-full mt-8 border-t border-slate-700/50 pt-8 pb-4">
                        <div class="text-center mb-2">
                            <span class="text-lg font-black text-white tracking-wide">ดูประวัติย้อนหลังวันอื่นๆ</span>
                        </div>
                        ${datesHtml}
                    </div>`);
                }

                mainBox.innerHTML = htmlArr.join('');
            }
        }
    }

    if (webBox) {
        let webAgg = {};
        let defaultWebList = (typeof TEAM_LIST !== 'undefined' && TEAM_LIST.length > 0) ? TEAM_LIST : ['Jun88', 'MK8', 'F168', 'PG688', 'JL69', 'NM9', 'VV72', 'TH26', 'BT678', 'K188']; 
        let customSystems = JSON.parse(localStorage.getItem('custom_web_systems') || '{}');

        defaultWebList.forEach(web => {
            let sysLabel = 'SYSTEM';
            if (customSystems[web]) sysLabel = customSystems[web];
            else {
                if(['Jun88', 'MK8', 'VV72', 'TH26', 'BT678', 'K188'].includes(web)) sysLabel = 'K36';
                else if(['F168'].includes(web)) sysLabel = 'WG';
                else if(['PG688', 'JL69', 'NM9'].includes(web)) sysLabel = 'TCG';
            }
            webAgg[web] = { count: 0, amount: 0, sys: sysLabel };
        });

        if (hasData) {
            let dataForWebCards = pendingSummaryData;
            if (shiftFilter !== 'ALL') dataForWebCards = dataForWebCards.filter(item => item.shift === shiftFilter);
            if (odFilter !== 'ALL') dataForWebCards = dataForWebCards.filter(item => item.odType === odFilter || (item.odType === undefined && odFilter === 'ปกติ'));

            dataForWebCards.forEach(item => {
                if (!webAgg[item.website]) webAgg[item.website] = { count: 0, amount: 0, sys: item.system || 'SYSTEM' };
                webAgg[item.website].count += item.count;
                webAgg[item.website].amount += item.totalAmount;
                if (item.system) webAgg[item.website].sys = item.system;
            });
        }

        if (Object.keys(webAgg).length > 0) {
            webBox.innerHTML = Object.keys(webAgg).map(web => {
                const w = webAgg[web];
                const defaultImg = `https://ui-avatars.com/api/?name=${web}&background=random&color=fff&size=256`;
                const imgUrl = safeWebLogos[web] ? safeWebLogos[web] : defaultImg;
                
                const isActive = (typeof summaryActiveWebFilter !== 'undefined' && summaryActiveWebFilter === web);
                const cardStyle = isActive ? 'ring-2 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)] z-20 scale-[1.02]' : 'hover:border-sky-500 hover:shadow-lg opacity-95 hover:opacity-100';
                const filterBadge = isActive ? '<div class="absolute top-3 left-3 bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md z-30 flex items-center gap-1"><span class="material-icons text-[10px]">check_circle</span> กำลังดู</div>' : '';

                return `
                <div class="relative group transition-transform duration-300 rounded-2xl border border-slate-700 shadow-sm ${cardStyle} bg-[#151f32] overflow-hidden flex flex-col min-h-[180px]">
                    <div onclick="toggleSummaryWebFilter('${web}')" class="cursor-pointer flex flex-col flex-1 relative z-10">
                        <div class="relative w-full h-28 sm:h-32 bg-[#0b1120] flex items-center justify-center shrink-0 border-b border-slate-800">
                            <div class="absolute inset-0 bg-cover bg-center opacity-20 group-hover:scale-105 transition-transform duration-500" style="background-image: url('${imgUrl}')"></div>
                            <div class="absolute inset-0 bg-gradient-to-t from-[#151f32] to-transparent z-0"></div>
                            <div class="bg-white rounded-2xl p-1 shadow-lg z-10 w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                <img src="${imgUrl}" loading="lazy" class="max-w-full max-h-full object-contain rounded-xl">
                            </div>
                            <div class="absolute top-0 right-0 bg-indigo-600 text-white text-[9px] sm:text-[10px] px-3 py-1 rounded-bl-xl z-20 font-black shadow-md tracking-wider">${w.sys}</div>
                            ${filterBadge}
                        </div>
                        <div class="p-4 flex flex-col justify-between flex-1 bg-[#151f32]">
                            <div class="flex justify-between items-end mb-3">
                                <h4 class="font-black text-white text-lg sm:text-xl truncate pr-2 tracking-wide">${web}</h4>
                                <div class="text-right flex flex-col items-end">
                                    <span class="text-sm sm:text-base font-black ${w.count > 0 ? 'text-sky-400' : 'text-gray-500'} leading-none">${w.count.toLocaleString()}</span>
                                    <span class="text-[9px] sm:text-[10px] font-bold text-gray-600 uppercase tracking-widest mt-1">รายการ</span>
                                </div>
                            </div>
                            <div class="text-sm sm:text-base font-black font-mono ${w.amount > 0 ? 'text-emerald-400 bg-[#0b1120] border-emerald-900/50' : 'text-gray-500 bg-slate-800 border-slate-700'} px-3 py-2 rounded-xl w-full border shadow-inner text-center truncate tracking-wider">
                                ฿${w.amount.toLocaleString('en-US', {minimumFractionDigits: 2})}
                            </div>
                        </div>
                    </div>
                </div>`;
            }).join('');
        }
    }
};

window.fetchLeaderboardData = async function() {
    const lbBox = document.getElementById('summaryLeaderboard');
    const modeEl = document.getElementById('leaderboardMode');
    const monthInput = document.getElementById('leaderboardMonth');
    const odFilter = document.getElementById('summaryOdFilter') ? document.getElementById('summaryOdFilter').value : 'ALL';
    
    if(!lbBox) return;

    let lbShiftFilter = document.getElementById('leaderboardShiftFilter');
    let lbWebFilter = document.getElementById('leaderboardWebFilter');
    
    if (!lbWebFilter && modeEl) {
        let webOptions = (typeof TEAM_LIST !== 'undefined' && TEAM_LIST.length > 0) ? TEAM_LIST : ['Jun88', 'MK8', 'F168', 'PG688', 'JL69', 'NM9', 'VV72', 'TH26', 'BT678', 'K188'];
        const filterHtml = `
            <select id="leaderboardShiftFilter" onchange="fetchLeaderboardData()" class="bg-transparent text-sky-400 text-[10px] font-bold outline-none cursor-pointer pr-1 border-r border-gray-600 mr-2">
                <option value="ALL" class="bg-slate-800 text-white">⏱️ รวมทุกกะ</option>
                <option value="กะเช้า" class="bg-slate-800 text-white">☀️ เช้า</option>
                <option value="กะกลาง" class="bg-slate-800 text-white">🌤️ กลาง</option>
                <option value="กะดึก" class="bg-slate-800 text-white">🌙 ดึก</option>
            </select>
            <select id="leaderboardWebFilter" onchange="fetchLeaderboardData()" class="bg-transparent text-emerald-400 text-[10px] font-bold outline-none cursor-pointer pr-1 border-r border-gray-600 mr-2">
                <option value="ALL" class="bg-slate-800 text-white">🏆 รวมทุกเว็บ</option>
                ${webOptions.map(w => `<option value="${w}" class="bg-slate-800 text-white">${w}</option>`).join('')}
            </select>
        `;
        modeEl.insertAdjacentHTML('beforebegin', filterHtml);
        lbShiftFilter = document.getElementById('leaderboardShiftFilter');
        lbWebFilter = document.getElementById('leaderboardWebFilter');
    }

    let mode = 'monthly';
    if(modeEl) mode = modeEl.value;
    const selectedWeb = lbWebFilter ? lbWebFilter.value : 'ALL';
    const shiftFilter = lbShiftFilter ? lbShiftFilter.value : 'ALL';

    if (monthInput) {
        if (mode === 'monthly') {
            monthInput.classList.remove('hidden');
            if(!monthInput.value) {
                const d = new Date();
                monthInput.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            }
        } else {
            monthInput.classList.add('hidden');
        }
    }

    lbBox.innerHTML = '<div class="text-center py-10 text-gray-400"><span class="material-icons animate-spin text-3xl mb-2">sync</span><br>กำลังคำนวณอันดับ...</div>';

    if (viewMode === 'preview' && pendingSummaryData.length > 0) {
        let aggMap = {};
        
        let targetData = pendingSummaryData;
        if (shiftFilter !== 'ALL') targetData = targetData.filter(i => i.shift === shiftFilter);
        if (odFilter !== 'ALL') targetData = targetData.filter(i => i.odType === odFilter || (i.odType === undefined && odFilter === 'ปกติ'));
        if (selectedWeb !== 'ALL') targetData = targetData.filter(i => i.website === selectedWeb); 

        targetData.forEach(r => {
            const name = r.empName;
            if (!name || name.toLowerCase().includes('system') || name.toLowerCase().includes('auto')) return;

            if (!aggMap[name]) aggMap[name] = { totalCount: 0, totalMoney: 0, totalApproved: 0, totalReject: 0, shift: r.shift };
            aggMap[name].totalCount += r.count;
            aggMap[name].totalMoney += r.totalAmount;
            aggMap[name].totalApproved += (r.approvedCount || 0);
            aggMap[name].totalReject += (r.rejectCount || 0);
        });

        drawLeaderboardFromMap(aggMap, lbBox);
        return;
    }

    try {
        let query = appDB.from('transaction_daily_summary').select('*');
        
        if (mode === 'monthly' && monthInput && monthInput.value) {
            const [year, month] = monthInput.value.split('-');
            const startDate = `${year}-${month}-01`;
            const endDate = new Date(year, month, 0).toISOString().split('T')[0];
            query = query.gte('date', startDate).lte('date', endDate);
        }
        
        if (selectedWeb !== 'ALL') {
            query = query.eq('website', selectedWeb);
        }

        const { data, error } = await query;
        if (error) throw error;

        if (!data || data.length === 0) {
            lbBox.innerHTML = '<div class="text-center py-10 text-gray-400 font-bold">ไม่มีข้อมูลจัดอันดับ</div>';
            return;
        }

        let aggMap = {};
        data.forEach(r => {
            const name = r.employee_name;
            if (!name || name.toLowerCase().includes('system') || name.toLowerCase().includes('auto')) return;

            const shift = typeof getShiftFromName === 'function' ? getShiftFromName(name) : 'UNKNOWN';
            if (shiftFilter !== 'ALL' && shift !== shiftFilter) return;
            
            if (!aggMap[name]) aggMap[name] = { totalCount: 0, totalMoney: 0, totalApproved: 0, totalReject: 0, shift: shift };
            aggMap[name].totalCount += parseInt(r.count) || 0;
            aggMap[name].totalMoney += parseFloat(r.total_amount) || 0;
            
            const appCount = (r.approved_count !== undefined && r.approved_count !== null) ? parseInt(r.approved_count) : parseInt(r.count) || 0;
            const rejCount = (r.reject_count !== undefined && r.reject_count !== null) ? parseInt(r.reject_count) : 0;

            aggMap[name].totalApproved += appCount;
            aggMap[name].totalReject += rejCount;
        });

        drawLeaderboardFromMap(aggMap, lbBox);

    } catch (e) {
        lbBox.innerHTML = '<div class="text-center py-10 text-red-500 font-bold">โหลดข้อมูลผิดพลาด</div>';
    }
};

function drawLeaderboardFromMap(aggMap, lbBox) {
    const sortedEmps = Object.keys(aggMap).sort((a, b) => {
        if (aggMap[b].totalCount !== aggMap[a].totalCount) {
            return aggMap[b].totalCount - aggMap[a].totalCount; 
        }
        return aggMap[b].totalApproved - aggMap[a].totalApproved; 
    });

    if(sortedEmps.length === 0) {
        lbBox.innerHTML = `<div class="text-center py-10 text-gray-400 font-bold">ไม่พบข้อมูล</div>`;
        return;
    }

    lbBox.innerHTML = sortedEmps.map((name, i) => {
        const d = aggMap[name];
        let medalClass = ''; let medalText = i + 1;
        if (i === 0) medalClass = 'bg-gradient-to-br from-yellow-300 to-amber-500 text-amber-950 scale-110 shadow-[0_0_10px_rgba(245,158,11,0.6)]';
        else if (i === 1) medalClass = 'bg-gradient-to-br from-gray-300 to-gray-400 text-gray-800 scale-105 shadow-md'; 
        else if (i === 2) medalClass = 'bg-gradient-to-br from-orange-400 to-orange-600 text-orange-50 scale-105 shadow-md'; 
        else medalClass = 'bg-slate-700 text-slate-400 border border-slate-600'; 

        return `
        <div class="leaderboard-item flex flex-col p-3 rounded-xl hover:bg-slate-700 transition border-b border-slate-700/50 last:border-0" data-name="${name}">
            <div class="flex items-center justify-between mb-1.5">
                <div class="flex items-center gap-3 overflow-hidden">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shrink-0 transition-transform ${medalClass}">${medalText}</div>
                    <span class="font-bold text-white text-base truncate">${name}</span>
                </div>
                <div class="text-right flex flex-col items-end">
                    <span class="font-black text-sky-400 bg-sky-900/30 px-2 py-0.5 rounded-md text-lg leading-none border border-sky-800/50" title="ยอดรวมทั้งหมด">
                        ${d.totalCount} <span class="text-[10px] text-sky-500/80 font-normal">รวม</span>
                    </span>
                    <div class="flex gap-1.5 mt-1.5 text-xs font-bold">
                        <span class="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 shadow-sm" title="สำเร็จ">✅ ${d.totalApproved}</span>
                        <span class="text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20 shadow-sm" title="ปฏิเสธ">❌ ${d.totalReject}</span>
                    </div>
                </div>
            </div>
            <div class="flex justify-end w-full mt-1">
                <span class="font-mono font-bold text-emerald-400 text-[11px] bg-slate-900 px-2 py-1 rounded shadow-inner border border-slate-700">
                    ฿${d.totalMoney.toLocaleString('en-US', {minimumFractionDigits: 2})}
                </span>
            </div>
        </div>`;
    }).join('');

    if(typeof window.filterSummaryLeaderboard === 'function') window.filterSummaryLeaderboard();
}

window.saveSummaryToSupabase = async function() {
    if (viewMode === 'monthly_history') return Swal.fire('ข้อมูลรายเดือน', 'นี่คือข้อมูลสรุปรวมทั้งเดือนจากฐานข้อมูล ไม่สามารถบันทึกซ้ำได้ครับ', 'info');
    if (!pendingSummaryData || pendingSummaryData.length === 0) return Swal.fire('ไม่มีข้อมูล', 'กรุณาอัปโหลดไฟล์ให้เรียบร้อยก่อนบันทึก', 'warning');

    Swal.fire({title: 'กำลังบันทึกข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});

    try {
        const fallbackDate = document.getElementById('summaryDateFilter').value;
        const groupedData = {};
        
        pendingSummaryData.forEach(item => {
            const dateVal = item.date || fallbackDate;
            const empName = (item.empName || '').trim();
            const web = (item.website || '').trim();
            
            const key = `${dateVal}_${empName.toLowerCase()}_${web.toLowerCase()}`;

            if (!groupedData[key]) {
                groupedData[key] = {
                    date: dateVal, employee_name: empName, website: web, system: item.system || 'UNKNOWN',
                    count: item.count || 0, total_amount: item.totalAmount || 0,
                    approved_count: item.approvedCount || 0, reject_count: item.rejectCount || 0
                };
            } else {
                groupedData[key].count += (item.count || 0);
                groupedData[key].total_amount += (item.totalAmount || 0);
                groupedData[key].approved_count += (item.approvedCount || 0);
                groupedData[key].reject_count += (item.rejectCount || 0);
            }
        });

        const finalInsertData = Object.values(groupedData);

        const chunkSize = 500;
        for (let i = 0; i < finalInsertData.length; i += chunkSize) {
            const chunk = finalInsertData.slice(i, i + chunkSize);
            const { error } = await appDB.from('transaction_daily_summary').upsert(chunk, { onConflict: 'date,employee_name,website' });
            if (error) throw error;
        }

        if (window.pendingFileNames && window.pendingFileNames.length > 0) {
            const { data: savedFilesData } = await appDB.from('settings').select('value').eq('key', 'saved_excel_files').single();
            let savedFilesList = savedFilesData && savedFilesData.value ? JSON.parse(savedFilesData.value) : [];
            savedFilesList = [...new Set([...savedFilesList, ...window.pendingFileNames])];
            await appDB.from('settings').upsert([{ key: 'saved_excel_files', value: JSON.stringify(savedFilesList) }]);
            window.pendingFileNames = []; 
        }

        Swal.fire({icon: 'success', title: 'บันทึกสำเร็จ', timer: 1500, showConfirmButton: false});
        
        viewMode = 'history';
        await fetchAvailableDates(); 
        document.getElementById('summaryDateFilter').value = fallbackDate; 
        await window.fetchHistoricalSummary(true); 

        if (window.appDB && window.appDB.channel) {
            window.appDB.channel('summary-updates').send({
                type: 'broadcast', event: 'force_summary_reload', payload: { date: fallbackDate }
            });
        }
    } catch(e) {
        Swal.fire('Error', e.message, 'error');
    }
};

window.fetchHistoricalSummary = async function(silent = false) {
    const dateVal = document.getElementById('summaryDateFilter') ? document.getElementById('summaryDateFilter').value : '';
    if (!dateVal) return;

    if (!silent) Swal.fire({ title: 'กำลังดึงข้อมูลรายวัน...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const targetObj = new Date(dateVal);
        const yestObj = new Date(targetObj);
        yestObj.setDate(yestObj.getDate() - 1);
        const yesterdayStr = yestObj.toISOString().split('T')[0];

        const [todayRes, yestRes] = await Promise.all([
            appDB.from('transaction_daily_summary').select('*').eq('date', dateVal),
            appDB.from('transaction_daily_summary').select('employee_name, website, count').eq('date', yesterdayStr)
        ]);

        if (todayRes.error) throw todayRes.error;

        let yestMap = {};
        if (yestRes.data) yestRes.data.forEach(r => yestMap[`${r.employee_name}_${r.website}`] = parseInt(r.count) || 0);

        if (todayRes.data && todayRes.data.length > 0) {
            let mappedData = todayRes.data.map(r => {
                const todayCount = parseInt(r.count) || 0;
                const yestCount = yestMap[`${r.employee_name}_${r.website}`] || 0;
                const appCount = (r.approved_count !== undefined && r.approved_count !== null) ? parseInt(r.approved_count) : todayCount;
                const rejCount = (r.reject_count !== undefined && r.reject_count !== null) ? parseInt(r.reject_count) : 0;

                return {
                    empName: r.employee_name, website: r.website, system: r.system, count: todayCount, totalAmount: parseFloat(r.total_amount) || 0,
                    shift: typeof getShiftFromName === 'function' ? getShiftFromName(r.employee_name) : 'UNKNOWN', 
                    yestCount: yestCount, diffFromYesterday: todayCount - yestCount,
                    approvedCount: appCount, rejectCount: rejCount
                };
            });
            
            pendingSummaryData = mappedData; 
            viewMode = 'history';
            
            renderSummaryDashboard(); 
            fetchLeaderboardData();
            
            if (!silent) {
                Swal.fire({ icon: 'success', title: 'ดึงข้อมูลสำเร็จ', timer: 1000, showConfirmButton: false });
            } else {
                Swal.close(); 
            }
        } else {
            pendingSummaryData = []; 
            renderSummaryDashboard(); 
            fetchLeaderboardData();
            if (!silent) Swal.fire('ไม่มีข้อมูล', `ไม่มีข้อมูลสรุปยอดของวันที่ ${dateVal}`, 'info');
        }
    } catch (e) { 
        if (!silent) Swal.fire('Error', e.message, 'error'); 
        console.error("Fetch Summary Error:", e);
    }
};

window.exportSummaryToExcel = async function() {
    if (typeof ExcelJS === 'undefined') return Swal.fire('ระบบไม่พร้อม', 'กรุณารอโหลดสคริปต์ ExcelJS สักครู่', 'warning');
    if (!pendingSummaryData || pendingSummaryData.length === 0) return Swal.fire('ไม่มีข้อมูล', 'ไม่มีข้อมูลสำหรับดาวน์โหลด กรุณาอัปโหลดไฟล์ให้เรียบร้อย', 'warning');

    Swal.fire({ title: 'กำลังสร้างไฟล์ Excel...', text: 'จัดระเบียบตามรูปแบบใหม่...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const shiftFilter = document.getElementById('summaryShiftFilter') ? document.getElementById('summaryShiftFilter').value : 'ALL';
        const odFilter = document.getElementById('summaryOdFilter') ? document.getElementById('summaryOdFilter').value : 'ALL';
        
        let filteredData = pendingSummaryData;
        if (shiftFilter !== 'ALL') filteredData = filteredData.filter(item => item.shift === shiftFilter);
        if (odFilter !== 'ALL') filteredData = filteredData.filter(item => item.odType === odFilter || (item.odType === undefined && odFilter === 'ปกติ'));
        if (typeof summaryActiveWebFilter !== 'undefined' && summaryActiveWebFilter !== 'ALL') filteredData = filteredData.filter(item => item.website === summaryActiveWebFilter);

        const targetWebOrder = ['Jun88', 'MK8', 'VV72', 'TH26', 'F168', 'PG688', 'JL69', 'NM9', 'BT678', 'K188'];

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
        targetWebOrder.forEach(w => { headers.push(`${w} (สำเร็จ)`); headers.push(`${w} (ปฏิเสธ)`); headers.push(`${w} (รวม)`); });
        headers.push('รวมสำเร็จ'); headers.push('รวมปฏิเสธ'); headers.push('รวมทั้งสิ้น');

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
            } else if (colNumber > 4 && colNumber <= 4 + (targetWebOrder.length * 3)) {
                const webIndex = Math.floor((colNumber - 5) / 3);
                const isLastInGroup = (colNumber - 5) % 3 === 2; const isFirstInGroup = (colNumber - 5) % 3 === 0;
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerColors[webIndex % headerColors.length] } };
                cell.font.color = { argb: 'FF0F172A' };
                let rightBorder = isLastInGroup ? 'medium' : 'thin'; let leftBorder = isFirstInGroup ? 'medium' : 'thin';
                cell.border = { top: {style:'medium'}, bottom: {style:'medium'}, right: {style:rightBorder, color:{argb:'FF94A3B8'}}, left: {style:leftBorder, color:{argb:'FF94A3B8'}} };
            } else {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } }; 
                cell.font.color = { argb: 'FFFFFFFF' };
                cell.border = { top: {style:'medium'}, left: {style:'medium'}, bottom: {style:'medium'}, right: {style:'medium'} };
            }
        });

        ws.views = [{ state: 'frozen', xSplit: 4, ySplit: 2 }];

        let rowIndex = 1;
        Object.values(empGroups).sort((a, b) => b.totalApproved - a.totalApproved).forEach((emp) => {
            let rowData = [ rowIndex++, emp.name, emp.shift, emp.odType === 'ปกติ' ? 'UNKNOWN' : emp.odType ];
            targetWebOrder.forEach(w => { rowData.push(emp.websData[w].approved); rowData.push(emp.websData[w].reject); rowData.push(emp.websData[w].total); });
            rowData.push(emp.totalApproved); rowData.push(emp.totalReject); rowData.push(emp.grandTotal); 

            const empRow = ws.addRow(rowData);

            empRow.eachCell((cell, colNumber) => {
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                if (colNumber <= 4) {
                    cell.border = { top: {style:'thin', color:{argb:'FFCBD5E1'}}, bottom: {style:'thin', color:{argb:'FFCBD5E1'}}, left: {style:'thin', color:{argb:'FFCBD5E1'}}, right: {style:'thin', color:{argb:'FFCBD5E1'}} };
                    if (colNumber === 2) { cell.font = { bold: true }; cell.alignment = { vertical: 'middle', horizontal: 'left' }; }
                } else if (colNumber > 4 && colNumber <= 4 + (targetWebOrder.length * 3)) {
                    const webIndex = Math.floor((colNumber - 5) / 3); const colIdxInGroup = (colNumber - 5) % 3; 
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: dataBgColors[webIndex % dataBgColors.length] } };
                    let rightBorder = colIdxInGroup === 2 ? 'medium' : 'thin'; let leftBorder = colIdxInGroup === 0 ? 'medium' : 'thin';
                    cell.border = { top: {style:'thin', color:{argb:'FFCBD5E1'}}, bottom: {style:'thin', color:{argb:'FFCBD5E1'}}, right: {style:rightBorder, color:{argb:'FF94A3B8'}}, left: {style:leftBorder, color:{argb:'FF94A3B8'}} };
                    if (cell.value > 0) {
                        if (colIdxInGroup === 0) cell.font = { color: { argb: 'FF16A34A' }, bold: true }; 
                        if (colIdxInGroup === 1) cell.font = { color: { argb: 'FFDC2626' }, bold: true }; 
                        if (colIdxInGroup === 2) cell.font = { color: { argb: 'FF2563EB' }, bold: true }; 
                    } else { cell.font = { color: { argb: 'FF94A3B8' } }; }
                } else {
                    cell.border = { top: {style:'thin', color:{argb:'FFCBD5E1'}}, bottom: {style:'thin', color:{argb:'FFCBD5E1'}}, left: {style:'thin', color:{argb:'FFCBD5E1'}}, right: {style:'thin', color:{argb:'FFCBD5E1'}} };
                    if (cell.value > 0) {
                        if (colNumber === 4 + (targetWebOrder.length * 3) + 1) cell.font = { color: { argb: 'FF16A34A' }, bold: true }; 
                        if (colNumber === 4 + (targetWebOrder.length * 3) + 2) cell.font = { color: { argb: 'FFDC2626' }, bold: true }; 
                        if (colNumber === 4 + (targetWebOrder.length * 3) + 3) {
                            cell.font = { color: { argb: 'FF000000' }, bold: true }; 
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE047' } }; 
                        }
                    } else {
                        if (colNumber === 4 + (targetWebOrder.length * 3) + 3) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE047' } }; }
                    }
                }
            });
        });

        ws.columns.forEach((col, index) => {
            if (index === 0) col.width = 8; else if (index === 1) col.width = 25; else if (index === 2) col.width = 12; else if (index === 3) col.width = 12; else if (index >= ws.columns.length - 3) col.width = 15; else col.width = 11; 
        });

        const buffer = await wb.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url; link.download = `สรุปยอดรวมแต่ละเว็บ_ครบถ้วน.xlsx`; document.body.appendChild(link);
        link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);

        Swal.fire({ icon: 'success', title: 'ดาวน์โหลดไฟล์ Excel สำเร็จ!', timer: 1500, showConfirmButton: false });
    } catch (error) { Swal.fire('เกิดข้อผิดพลาด', 'ดาวน์โหลด Excel ไม่สำเร็จ: ' + error.message, 'error'); }
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
        html += `
        <div class="flex justify-between items-center bg-slate-800 p-3 rounded-xl border border-slate-600 shadow-sm hover:border-sky-500 transition">
            <div class="font-black text-white text-base">${web}</div>
            <select id="sys_select_modal_${web}" class="bg-slate-900 border border-slate-500 text-sky-400 font-bold p-2 rounded-lg outline-none cursor-pointer focus:ring-2 focus:ring-sky-500">
                <option value="SYSTEM" ${currentSys==='SYSTEM'?'selected':''}>- ไม่ระบุ -</option>
                <option value="K36" ${currentSys==='K36'?'selected':''}>K36</option>
                <option value="WG" ${currentSys==='WG'?'selected':''}>WG</option>
                <option value="TCG" ${currentSys==='TCG'?'selected':''}>TCG</option>
            </select>
        </div>`;
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
        localStorage.setItem('custom_web_systems', JSON.stringify(customSystems));

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
        const { data, error } = await appDB.from('transaction_daily_summary').select('*').in('date', dates);
        if (error) throw error;

        let groupedData = {};
        const sortedDatesForTitle = dates.sort((a, b) => new Date(b) - new Date(a)).map(d => {
            const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`;
        }).join(', ');
        const combinedDateLabel = `ข้อมูลรวมหลายวัน: ${sortedDatesForTitle}`;

        if (data && data.length > 0) {
            data.forEach(r => {
                const key = `${r.employee_name}_${r.website}`;
                if (!groupedData[key]) {
                    groupedData[key] = {
                        date: combinedDateLabel, empName: r.employee_name, website: r.website, system: r.system || 'UNKNOWN',
                        count: 0, totalAmount: 0, approvedCount: 0, rejectCount: 0,
                        shift: typeof getShiftFromName === 'function' ? getShiftFromName(r.employee_name) : 'UNKNOWN',
                        yestCount: 0, diffFromYesterday: 0
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
        window.uploadedFileDates = new Set(dates);

        renderSummaryDashboard();
        fetchLeaderboardData();
        Swal.close();
    } catch (e) { Swal.fire('Error', e.message, 'error'); }
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
                
                if (typeof fetchAvailableDates === 'function') await fetchAvailableDates();
                
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
            const file = fileInput.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `logo_${web}_${Date.now()}.${fileExt}`;

            const { error: uploadError } = await appDB.storage.from('staff_images').upload(`logos/${fileName}`, file, { cacheControl: '3600', upsert: true });
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

        document.getElementById('webLogoModal').classList.add('hidden');
        if (typeof window.renderSummaryDashboard === 'function') window.renderSummaryDashboard();
        
        Swal.fire({icon: 'success', title: 'บันทึกโลโก้สำเร็จ!', timer: 1500, showConfirmButton: false});

    } catch (err) {
        Swal.fire('Error', err.message, 'error');
    }
};
