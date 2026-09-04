// ════════════════════════════════════════════════════════════════════
// 📦 swap/extras.js — ส่วนที่ 4/4 ของระบบสลับกะ (แยกจาก swap.js เดิม 1,633 บรรทัด)
// เนื้อหา: ลากวาง (Drag & Drop), Export รูปแบบ AMOL
// ⚠️ ลำดับโหลด: swap/core → swap/view → swap/admin → swap/extras (ห้ามสลับ — ตัวแปร top-level แชร์ scope เดียวกัน)
// ════════════════════════════════════════════════════════════════════
// 🖱️ ระบบลากวาง (Drag & Drop) ในหน้าสลับกะ
// ==========================================
window.swapDragStart = function(event, userId, fromDayIndex, shiftType) {
    draggedSwapUser = { id: userId, fromDay: fromDayIndex, shiftType: shiftType };
    event.dataTransfer.effectAllowed = "move";
    event.target.classList.add('opacity-50', 'scale-90');
};

window.swapDragOver = function(event, shiftType) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (draggedSwapUser && draggedSwapUser.shiftType === shiftType) {
        event.currentTarget.classList.add('bg-slate-700/50', 'ring-2', 'ring-sky-500', 'rounded-lg');
    }
};

window.swapDragLeave = function(event) {
    event.currentTarget.classList.remove('bg-slate-700/50', 'ring-2', 'ring-sky-500', 'rounded-lg');
};

window.swapDrop = function(event, toDayIndex, shiftType) {
    event.preventDefault();
    event.currentTarget.classList.remove('bg-slate-700/50', 'ring-2', 'ring-sky-500', 'rounded-lg');

    if (!draggedSwapUser) return;
    
    if (draggedSwapUser.shiftType !== shiftType) {
        Swal.fire({icon: 'error', title: 'ผิดช่อง!', text: 'ลากข้ามประเภทกะไม่ได้ครับ', confirmButtonColor: '#ef4444'});
        draggedSwapUser = null;
        window.renderSwapPlanPreviewUI();
        return;
    }

    if (draggedSwapUser.fromDay === toDayIndex) {
        draggedSwapUser = null;
        window.renderSwapPlanPreviewUI();
        return;
    }

    const userId = draggedSwapUser.id;
    const targetPlan = generatedSwapPlan[toDayIndex];
    const userLeaves = window.globalUserLeaves ? (window.globalUserLeaves[userId] || new Set()) : new Set();

    let hasConflict = false;
    let conflictMsg = '';

    const targetDateStr = targetPlan.targetDate;

    // 🌟 ดักจับการลากวาง: ใช้เกณฑ์เดียวกับตอนกดคำนวณ (แยกตามทิศทาง)
    if (hasSwapLeaveConflict(targetDateStr, shiftType, userLeaves)) {
        hasConflict = true;
        conflictMsg = getSwapConflictMsg(shiftType);
    }

    if (hasConflict) {
        Swal.fire({icon: 'warning', title: 'ย้ายไม่ได้!', text: conflictMsg, confirmButtonColor: '#f59e0b'});
        draggedSwapUser = null;
        window.renderSwapPlanPreviewUI(); 
        return;
    }

    const sourcePlan = generatedSwapPlan[draggedSwapUser.fromDay];
    const sourceArray = shiftType === 'MtoN' ? sourcePlan.morningToNight : sourcePlan.nightToMorning;
    const userIndex = sourceArray.findIndex(u => String(u.id) === String(userId));
    
    if (userIndex > -1) {
        const userObj = sourceArray.splice(userIndex, 1)[0]; 
        const targetArray = shiftType === 'MtoN' ? targetPlan.morningToNight : targetPlan.nightToMorning;
        targetArray.push(userObj); 
    }

    draggedSwapUser = null;
    window.renderSwapPlanPreviewUI(); 
};




// ==========================================
// 📊 Export ตารางสลับกะ — รูปแบบ AMOL
// ==========================================
window.exportSwapReport = async function() {
    if (typeof ExcelJS === 'undefined') {
        try {
            Swal.fire({ title: 'กำลังเตรียม Excel...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            await new Promise((res, rej) => {
                const s = document.createElement('script');
                s.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
                s.onload = res; s.onerror = () => rej(new Error('โหลด ExcelJS ไม่ได้'));
                document.head.appendChild(s);
            });
        } catch(e) { return Swal.fire('Error', e.message, 'error'); }
    }

    Swal.fire({ title: 'กำลังดึงข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const { data: tasks, error } = await appDB
        .from('scheduled_tasks')
        .select('id, payload, scheduled_for, status')
        .eq('task_type', 'individual_shift_update')
        .in('status', ['pending', 'completed', 'info_only'])
        .order('scheduled_for', { ascending: true });

    if (error || !tasks || tasks.length === 0) {
        return Swal.fire('ไม่พบข้อมูล', 'ยังไม่มีตารางสลับกะ', 'warning');
    }

    // parse
    const shiftMap = {}, userMeta = {};
    let minDate = null;

    tasks.filter(t => t.status !== 'info_only').forEach(t => {
        let p = t.payload;
        if (typeof p === 'string') { try { p = JSON.parse(p); } catch(e) { p = {}; } }
        const name = p.user_name || p.username || '-';
        if (!name || name === '-') return;

        const d = new Date(t.scheduled_for);
        const day = d.getDate();
        if (!minDate || d < minDate) minDate = new Date(d.getFullYear(), d.getMonth(), 1);

        const label = p.target_shift === 'กะเช้า' ? 'เช้า'
                    : p.target_shift === 'กะดึก'  ? 'ดึก'
                    : p.target_shift === 'กะกลาง' ? 'กลาง'
                    : (p.target_shift || '');

        if (!shiftMap[name]) shiftMap[name] = {};
        shiftMap[name][day] = label;

        if (!userMeta[name]) {
            const u = typeof GLOBAL_USER_LIST !== 'undefined' ? GLOBAL_USER_LIST.find(x => x.username === name) : null;
            userMeta[name] = {
                web:   u?.team || u?.department || '-',
                dept:  u?.department || '-',
                shift: u?.allowed_shift === 'กะเช้า' ? 'เช้า' : u?.allowed_shift === 'กะดึก' ? 'ดึก' : (u?.allowed_shift || '-'),
                pos:   u?.role || 'NV'
            };
        }
    });

    if (!minDate) return Swal.fire('ไม่พบข้อมูล', '', 'warning');

    const YEAR = minDate.getFullYear();
    const MONTH = minDate.getMonth();
    const daysInMonth = new Date(YEAR, MONTH + 1, 0).getDate();
    const thaiMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
                        'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
    const monthThai = `${thaiMonths[MONTH]} ${YEAR + 543}`;

    // สีตรงแบบ AMOL
    const C = {
        title:   'FFE2EFD9', header:  'FFFFC000', daySun:  'FFFFD966',
        morning: 'FFB6D7A8', night:   'FFB6D7A8',
        secAm:   'FFFFD966', secNt:   'FF6FA8DC',
        X:       'FFFB9DAD', KL:      'FF548135', TX:      'FF00B0F0',
        change:  'FFFFFF00', am_cell: 'FFFFC000', nt_cell: 'FF9FC5E8',
    };

    const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
    const font = (color='FF000000', bold=false, size=10) => ({ name: 'Arial', color: { argb: color }, bold, size });
    const align = (h='center', v='middle') => ({ horizontal: h, vertical: v });
    const border = () => {
        const s = { style: 'thin', color: { argb: 'FFCCCCCC' } };
        return { left: s, right: s, top: s, bottom: s };
    };

    const getCellStyle = (label, rowBg) => {
        let bg = rowBg, fc = 'FF000000', bold = false;
        if (label === 'X')       { bg = C.X; }
        else if (label === 'KL') { bg = C.KL; fc = 'FFFFFFFF'; bold = true; }
        else if (label === 'TX') { bg = C.TX; fc = 'FFFFFFFF'; }
        else if (label === 'เปลี่ยน') { bg = C.change; bold = true; }
        else if (label === 'เช้า')    { bg = C.am_cell; }
        else if (label === 'ดึก')     { bg = C.nt_cell; }
        return { bg, fc, bold };
    };

    const COL_STT=2, COL_NAME=3, COL_WEB=4, COL_DEPT=5, COL_SHFT=6, COL_POS=7, COL_D1=8;
    const lastCol = COL_D1 + daysInMonth - 1;

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('ตารางสลับกะ');

    // col widths
    ws.getColumn(1).width = 2.5;
    ws.getColumn(2).width = 5;
    ws.getColumn(3).width = 14;
    ws.getColumn(4).width = 8;
    ws.getColumn(5).width = 7;
    ws.getColumn(6).width = 6;
    ws.getColumn(7).width = 7;
    for (let d = 1; d <= daysInMonth; d++) ws.getColumn(COL_D1+d-1).width = 4.5;

    // ROW 1: Title
    ws.getRow(1).height = 22;
    const r1 = ws.getCell(1, 1);
    r1.value = `ตารางสลับกะ  ${monthThai}`;
    r1.fill = fill(C.title); r1.font = font('FF000000', true, 13);
    r1.alignment = align('center');
    ws.mergeCells(1, 1, 1, lastCol);

    // ROW 2-3: เว้น
    ws.getRow(2).height = 4; ws.getRow(3).height = 4;

    // ROW 4: Header
    ws.getRow(4).height = 20;
    [[COL_STT,'STT'],[COL_NAME,'ชื่อ'],[COL_WEB,'เว็บ'],[COL_DEPT,'แผนก'],[COL_SHFT,'เข้ากะ'],[COL_POS,'ตำแหน่ง']].forEach(([col,h]) => {
        const c = ws.getCell(4, col);
        c.value = h; c.fill = fill(C.header);
        c.font = font('FF000000', true, 10);
        c.alignment = align(); c.border = border();
    });
    for (let d = 1; d <= daysInMonth; d++) {
        const c = ws.getCell(4, COL_D1+d-1);
        c.value = d; c.fill = fill(C.header);
        c.font = font('FF000000', true, 9);
        c.alignment = align(); c.border = border();
    }

    // ROW 5: วันในสัปดาห์
    ws.getRow(5).height = 13;
    const thaiDays = ['อา','จ','อ','พ','พฤ','ศ','ส'];
    for (let d = 1; d <= daysInMonth; d++) {
        const dt = new Date(YEAR, MONTH, d);
        const dow = (dt.getDay()); // 0=อา
        const c = ws.getCell(5, COL_D1+d-1);
        c.value = thaiDays[dow];
        c.fill = fill(dow === 0 ? C.daySun : C.header);
        c.font = font('FF000000', false, 8);
        c.alignment = align(); c.border = border();
    }

    // แบ่ง user ตามกะ
    const morning = Object.keys(shiftMap).filter(n => userMeta[n]?.shift === 'เช้า').sort();
    const night   = Object.keys(shiftMap).filter(n => userMeta[n]?.shift === 'ดึก').sort();
    const others  = Object.keys(shiftMap).filter(n => !morning.includes(n) && !night.includes(n)).sort();

    let rowNum = 6;

    const addSection = (label, bg) => {
        ws.getRow(rowNum).height = 15;
        const c = ws.getCell(rowNum, 1);
        c.value = label; c.fill = fill(bg);
        c.font = font('FF000000', true, 10);
        c.alignment = align('left');
        ws.mergeCells(rowNum, 1, rowNum, lastCol);
        rowNum++;
    };

    const addUserRow = (name, idx) => {
        ws.getRow(rowNum).height = 16;
        const meta = userMeta[name] || {};
        const days = shiftMap[name] || {};
        const rowBg = meta.shift === 'ดึก' ? C.night : C.morning;

        [[1,''],[COL_STT,idx+1],[COL_NAME,name],[COL_WEB,meta.web||'-'],[COL_DEPT,meta.dept||'-'],[COL_SHFT,meta.shift||'-'],[COL_POS,meta.pos||'NV']].forEach(([col,val]) => {
            const c = ws.getCell(rowNum, col);
            c.value = val; c.fill = fill(rowBg);
            c.font = font('FF000000', col===COL_NAME, col===COL_STT?9:10);
            c.alignment = align(col===COL_NAME?'left':'center');
            c.border = border();
        });

        for (let d = 1; d <= daysInMonth; d++) {
            const label = days[d] || '';
            const c = ws.getCell(rowNum, COL_D1+d-1);
            const { bg, fc, bold } = getCellStyle(label, rowBg);
            c.value = label;
            c.fill = fill(bg); c.font = font(fc, bold, 9);
            c.alignment = align(); c.border = border();
        }
        rowNum++;
    };

    if (morning.length > 0) {
        addSection('☀  กะเช้า', C.secAm);
        morning.forEach((n, i) => addUserRow(n, i));
    }
    if (night.length > 0) {
        ws.getRow(rowNum).height = 4; rowNum++;
        addSection('🌙  กะดึก', C.secNt);
        night.forEach((n, i) => addUserRow(n, i));
    }
    if (others.length > 0) {
        ws.getRow(rowNum).height = 4; rowNum++;
        addSection('👥  อื่น', 'FFCCCCCC');
        others.forEach((n, i) => addUserRow(n, i));
    }

    ws.views = [{ state: 'frozen', xSplit: 7, ySplit: 5 }];

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `ตารางสลับกะ_${monthThai}.xlsx`;
    a.click(); URL.revokeObjectURL(url);

    const total = morning.length + night.length + others.length;
    Swal.fire({ icon: 'success', title: 'ดาวน์โหลดสำเร็จ!', text: `${total} คน × ${daysInMonth} วัน`, timer: 1800, showConfirmButton: false });
};
