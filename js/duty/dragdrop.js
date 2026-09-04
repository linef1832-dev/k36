// ════════════════════════════════════════════════════════════════════
// 📦 duty/dragdrop.js — ส่วนที่ 2/6 ของหน้าจัดหน้าที่/เวร (แยกจาก duty.js เดิม 5,478 บรรทัด)
// เนื้อหา: ระบบลากวางคน (Drag & Drop) ทั้งหมด
// ⚠️ ลำดับโหลด (PAGE_SCRIPTS ใน global.js): duty/core → duty/dragdrop → duty/roles → duty/tools → duty/support → duty/rotation
// ตัวแปร top-level (currentDutyDept, sortedTeams ฯลฯ) แชร์ข้ามไฟล์กันอัตโนมัติ — scope เดียวกัน
// ════════════════════════════════════════════════════════════════════
// ==========================================
// 🚀 ระบบลากวาง (Drag & Drop)
// ==========================================
let draggedUser = null;

function cleanupDragEffects() {
    const tooltip = document.getElementById('drag-access-tooltip');
    if (tooltip) tooltip.style.display = 'none';
    document.querySelectorAll('.duty-site-card').forEach(card => {
        card.classList.remove('ring-4', 'ring-green-500', 'shadow-[0_0_15px_rgba(34,197,94,0.4)]', 'opacity-40', 'grayscale');
    });
}

document.addEventListener('dragover', (e) => {
    const tooltip = document.getElementById('drag-access-tooltip');
    if (tooltip && tooltip.style.display === 'block') {
        tooltip.style.left = (e.clientX + 15) + 'px'; tooltip.style.top = (e.clientY + 15) + 'px';
    }
});

window.handleDragStart = function(event, userId, username, fromTeam) {
    const canDrag = window.isDutyAdmin();
    if (!canDrag) { event.preventDefault(); return; }
    if(!userId || userId === 'undefined') { event.preventDefault(); return; }
    draggedUser = { id: userId, username: username, fromTeam: fromTeam };
    event.dataTransfer.effectAllowed = "move";
    setTimeout(() => event.target.classList.add('opacity-50', 'scale-95'), 0);

    const userAccess = dutyAccessMatrix[userId] || [];
    let accessText = userAccess.length > 0 ? userAccess.join(', ') : 'ไม่มีสิทธิ์เลย';

    let tooltip = document.getElementById('drag-access-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div'); tooltip.id = 'drag-access-tooltip';
        tooltip.className = 'fixed z-[9999] pointer-events-none bg-slate-900 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-2xl border border-indigo-500 opacity-95';
        document.body.appendChild(tooltip);
    }
    tooltip.innerHTML = `<div class="text-indigo-300 text-[10px] mb-1">สิทธิ์ของ ${username}:</div><div class="text-green-400 text-sm">${accessText}</div>`;
    tooltip.style.display = 'block';

    document.querySelectorAll('.duty-site-card').forEach(card => {
        const teamName = card.querySelector('h4').innerText.trim();
        if (userAccess.includes(teamName)) card.classList.add('ring-4', 'ring-green-500', 'shadow-[0_0_15px_rgba(34,197,94,0.4)]');
        else card.classList.add('opacity-40', 'grayscale');
    });
};

window.handleDragOver = function(event) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; };

window.handleDrop = async function(event, toTeam) {
    event.preventDefault();
    if (window.blockIfPreview()) { draggedUser = null; return; }   // โหมดตัวอย่าง: ห้ามเขียนตารางลง DB
    if (!draggedUser) return;
    const { id, username, fromTeam } = draggedUser;

    document.querySelectorAll('.duty-user-card').forEach(el => el.classList.remove('opacity-50', 'scale-95'));
    cleanupDragEffects();

    if (fromTeam === toTeam) { draggedUser = null; return; }

    const targetDate = document.getElementById('dutyDate').value;
    const shiftFilter = document.getElementById('dutyShiftSelect').value;

    if (toTeam === 'leaveList' || event.target.closest('#dutyLeaveList')) {
        const { value: leaveReason } = await Swal.fire({
            title: '<div class="text-red-500 font-black">ระบุสถานะการหยุด</div>',
            html: `
                <div class="text-sm font-bold text-gray-500 dark:text-gray-400 mb-4">
                    พนักงาน: <span class="text-xl text-slate-800 dark:text-white uppercase tracking-wider">${username}</span>
                </div>
                <select id="leaveReasonSelect" class="w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white font-bold text-sm outline-none focus:ring-2 focus:ring-red-500 shadow-inner cursor-pointer appearance-none transition">
                    <option value="" disabled selected>-- เลือกสาเหตุการหยุด --</option>
                    <option value="X">❌ วันหยุดปกติ (X)</option>
                    <option value="KL">📝 ลากิจ (KL)</option>
                    <option value="PN">🏖️ พักร้อน (PN)</option>
                    <option value="XX">⏳ เปลี่ยนกะ / รอเข้ากะ (XX)</option>
                    <option value="TL">🔄 สลับวันหยุด (TL / TX)</option>
                    <option value="X4">⏱️ ลาครึ่งวัน (X4)</option>
                    <option value="ขาดงาน">🚫 ขาดงาน (ไม่แจ้งล่วงหน้า)</option>
                </select>
            `,
            showCancelButton: true, confirmButtonText: 'บันทึกสถานะ', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#ef4444', cancelButtonColor: '#64748b',
            customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl shadow-2xl border border-slate-700' },
            preConfirm: () => {
                const val = document.getElementById('leaveReasonSelect').value;
                if (!val) { Swal.showValidationMessage('กรุณาเลือกสาเหตุด้วยครับ!'); return false; }
                return val;
            }
        });

        if (!leaveReason) { draggedUser = null; return; }

        Swal.fire({title: 'กำลังย้ายข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
        try {
            if (currentRosterData[fromTeam]) {
                currentRosterData[fromTeam] = currentRosterData[fromTeam].filter(u => String(u.id) !== String(id));
                const saveKey = getDutySaveKey(targetDate, shiftFilter);
                window.clearSettingCache(); await appDB.from('settings').upsert([{ key: saveKey, value: JSON.stringify(currentRosterData) }]);
            }

            const { error: leaveErr } = await appDB.from('leave_requests').insert([{ user_id: id, user_name: username, leave_date: targetDate, reason: leaveReason, status: 'approved' }]);
            if (leaveErr) throw leaveErr;

            await appDB.from('system_logs').insert([{ action_type: 'ย้ายหน้าที่', performed_by: currentUser.username, target_details: `ย้าย ${username} จากเว็บ ${fromTeam} ไปอยู่โซนลาหยุด (${leaveReason}) วันที่: ${targetDate}` }]);
            window.debouncedBroadcast('duty-updates', 'force_reload');
            await window.refreshDutyData();

            Swal.fire({icon: 'success', title: 'อัปเดตสถานะสำเร็จ!', timer: 1500, showConfirmButton: false});
        } catch (err) { Swal.fire('เกิดข้อผิดพลาด', err.message, 'error'); }
        
        draggedUser = null;
        return;
    }

    const userAccess = dutyAccessMatrix[id] || [];
    if (!userAccess.includes(toTeam)) {
        Swal.fire({ icon: 'error', title: 'ย้ายไม่ได้!', text: `ไม่อนุญาต! ${username} ไม่มีสิทธิ์หลังบ้านเว็บ ${toTeam} นะคะ`, confirmButtonText: 'ตกลง', confirmButtonColor: '#d33' });
        draggedUser = null; return;
    }

    // 🌟 NEW: เก็บ "ใครเป็นคนจัดเข้า fromTeam ตั้งแต่แรก" ก่อนที่จะ filter ออก
    const originalUserInFromTeam = currentRosterData[fromTeam].find(u => String(u.id) === String(id));
    const originalAssignedBy = originalUserInFromTeam?.assigned_by || 'ไม่ทราบ';

    currentRosterData[fromTeam] = currentRosterData[fromTeam].filter(u => String(u.id) !== String(id));

    const fullUserObj = GLOBAL_USER_LIST.find(u => String(u.id) === String(id));
    if (fullUserObj) {
        if(!currentRosterData[toTeam]) currentRosterData[toTeam] = [];
        currentRosterData[toTeam].push({
            ...fullUserObj,
            assigned_by: currentUser.username,        // คนล่าสุดที่ย้าย
            assigned_at: new Date().toISOString()
        });
    }

    const saveKey = getDutySaveKey(targetDate, shiftFilter);

    Swal.fire({title: 'กำลังอัปเดตตาราง...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});

    try {
        window.clearSettingCache(); const { error: _upsertErr } = await appDB.from('settings').upsert([{ key: saveKey, value: JSON.stringify(currentRosterData) }]);
        if (_upsertErr) throw _upsertErr;

        // 📌 ถ้าคนนี้ถูกล็อก "อยู่ต่อ" ไว้ ให้ย้าย pin ตามไปเว็บใหม่ด้วย
        // ไม่งั้นวันพรุ่งนี้ระบบจะดึงเขากลับไปเว็บเดิมสวนทางกับที่เพิ่งย้ายมา
        let pinMovedNote = '';
        const movedPin = window.getLiveStayPin(id, targetDate);
        if (movedPin && movedPin.team !== toTeam) {
            const oldTeam = movedPin.team;
            movedPin.team = toTeam;
            window.dutyStayPins[String(id)] = movedPin;
            try {
                await window.saveStayPins();
                pinMovedNote = `<div style="margin-top:8px;font-size:11.5px;color:#b45309">📌 ย้ายการล็อก "อยู่ต่อ" จาก <b>${oldTeam}</b> ไป <b>${toTeam}</b> ให้แล้ว (ถึง ${window.dutyFmtShortDate(movedPin.until)})</div>`;
            } catch (pinErr) { console.warn('[stayPin] move failed', pinErr); }
        }

        // 🟢 บันทึก log การย้ายระหว่างเว็บ — แสดงทั้ง "คนจัดเดิม" และ "คนย้าย"
        await appDB.from('system_logs').insert([{
            action_type: 'ย้ายหน้าที่',
            performed_by: currentUser.username,
            target_details: `ย้าย ${username} จากเว็บ [${fromTeam}] (จัดโดย ${originalAssignedBy}) → [${toTeam}] (กะ: ${shiftFilter}, วันที่: ${targetDate})`
        }]);

        window.renderRosterGrid(currentRosterData);
        if (typeof window.updateDutyStats === 'function') window.updateDutyStats();

        window.debouncedBroadcast('duty-updates', 'force_reload');
        if (pinMovedNote) Swal.fire({ icon: 'success', title: 'ย้ายสำเร็จ', html: pinMovedNote, timer: 2600, showConfirmButton: false });
        else Swal.fire({icon: 'success', title: 'ย้ายสำเร็จ', timer: 1000, showConfirmButton: false});
    } catch (e) {
        console.error(e);
        Swal.fire('Error', 'เกิดข้อผิดพลาดในการบันทึกข้อมูล', 'error');
        window.refreshDutyData();
    }
    draggedUser = null;
};

document.addEventListener('dragend', (e) => {
    if(e.target.classList && e.target.classList.contains('duty-user-card')) e.target.classList.remove('opacity-50', 'scale-95');
    cleanupDragEffects(); draggedUser = null;
});

// (ลบโค้ดที่ไม่ได้ใช้ออก 11 บรรทัด — ไม่ถูกเรียก)

window.openTrainerReportModal = async function(team) {
    const targetDate = document.getElementById('dutyDate').value;
    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    
    const reportKey = `report_${currentDutyDept}_${targetDate}_${shiftFilter}`;
    const baseDept = currentDutyDept.replace('TRAINER_', '').replace('QL', ''); 
    const rosterKey = `duty_roster_${baseDept}_${targetDate}_${shiftFilter}`;

    let currentReports = {}; let rosterData = {};

    Swal.fire({title: 'กำลังดึงข้อมูลตารางงาน...', didOpen: () => Swal.showLoading()});
    try {
        const { data } = await appDB.from('settings').select('*').in('key', [reportKey, rosterKey]);
        if (data) {
            const reportRow = data.find(d => d.key === reportKey);
            if (reportRow && reportRow.value) currentReports = JSON.parse(reportRow.value);

            const rosterRow = data.find(d => d.key === rosterKey);
            if (rosterRow && rosterRow.value) rosterData = JSON.parse(rosterRow.value);
        }
    } catch(e) {}
    Swal.close();

    const tr = currentReports[team] || { missed: 0, checker: currentUser.username, score: '', bad_behavior: '', mistakes: [] };
    window._currentAssignedStaff = rosterData[team] ? rosterData[team].filter(u => !u.username.includes('ขาดคน')) : [];
    const datalistOptions = GLOBAL_USER_LIST.map(u => `<option value="${u.username}">`).join('');

    const htmlForm = `
        <div class="text-left space-y-4">
            <datalist id="employee_list_modal">${datalistOptions}</datalist>
            <div class="bg-blue-50 dark:bg-slate-700 p-3 rounded-lg border border-blue-200 dark:border-slate-600">
                <label class="block text-xs font-bold text-blue-800 dark:text-blue-300 mb-1">👮 ผู้เช็คชื่อ (ล็อกชื่ออัตโนมัติ)</label>
                <input type="text" id="trChecker" value="${tr.checker || currentUser.username}" class="w-full p-2 border rounded bg-gray-200 dark:bg-slate-900 dark:text-gray-400 outline-none font-bold text-sm cursor-not-allowed border-gray-300" readonly>
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-bold text-slate-700 dark:text-gray-300 mb-1">🚨 แชทหลุด (จำนวน)</label>
                    <input type="number" id="trMissed" value="${tr.missed}" min="0" class="w-full p-2 border rounded bg-gray-50 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-red-400 font-bold text-center text-lg text-red-600">
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-700 dark:text-gray-300 mb-1">⭐ คะแนนการตอบแชท</label>
                    <select id="trScore" class="w-full p-2 border rounded bg-gray-50 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-amber-400 font-bold text-center text-lg">
                        <option value="">- เลือก -</option>
                        ${[10,9,8,7,6,5,4,3,2,1,0].map(s => `<option value="${s}" ${String(tr.score) === String(s) ? 'selected' : ''}>${s} / 10</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="border border-red-200 dark:border-red-900 rounded p-3 bg-red-50/50 dark:bg-red-900/20">
                <label class="text-xs font-bold text-red-600 dark:text-red-400 mb-2 flex items-center gap-1"><span class="material-icons text-sm">warning</span> บันทึกพฤติกรรมไม่เหมาะสม / ทำผิด</label>
                <div id="mistakes_container" class="space-y-3"></div>
                <button type="button" onclick="addMistakeRow()" class="mt-2 w-full text-xs bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded shadow transition font-bold border border-red-700">+ เพิ่มพนักงานนอกทีม (พิมพ์ชื่อเอง)</button>
            </div>
        </div>
    `;

    const { isConfirmed, value: parsedData } = await Swal.fire({
        title: `การทำงานเว็บ ${team}`, html: htmlForm, showCancelButton: true, confirmButtonText: 'บันทึกข้อมูล', confirmButtonColor: '#f59e0b', cancelButtonText: 'ยกเลิก', width: '600px',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white' },
        didOpen: () => {
            const mistakesContainer = document.querySelector('.swal2-container #mistakes_container');
            if (mistakesContainer) {
                mistakesContainer.innerHTML = ''; 
                if (window._currentAssignedStaff && window._currentAssignedStaff.length > 0) {
                    window._currentAssignedStaff.forEach(u => {
                        const oldMistake = tr.mistakes.find(m => m.empName === u.username);
                        if (oldMistake) window.addMistakeRow(oldMistake.empName, oldMistake.note, oldMistake.images);
                        else window.addMistakeRow(u.username, '', []); 
                    });
                    tr.mistakes.forEach(m => {
                        if (!window._currentAssignedStaff.find(u => u.username === m.empName)) window.addMistakeRow(m.empName, m.note, m.images);
                    });
                } else if (tr.mistakes && tr.mistakes.length > 0) {
                    tr.mistakes.forEach(m => window.addMistakeRow(m.empName, m.note, m.images));
                }
            }
        },
        preConfirm: () => {
            const checkerVal = document.querySelector('.swal2-container #trChecker').value;
            const missedVal = parseInt(document.querySelector('.swal2-container #trMissed').value) || 0;
            const scoreVal = document.querySelector('.swal2-container #trScore').value;

            let mistakes = [];
            document.querySelectorAll('.swal2-container .mistake-row').forEach(row => {
                const selectVal = row.querySelector('.mistake-emp-select').value;
                const manualVal = row.querySelector('.mistake-emp-manual').value.trim();
                let empName = selectVal === 'อื่นๆ' ? manualVal : selectVal;
                let note = row.querySelector('.mistake-note').value.trim();
                
                let images = [];
                row.querySelectorAll('.pasted-img').forEach(img => { images.push(img.src); });

                if (empName && (note !== '' || images.length > 0)) mistakes.push({ empName: empName, note: note, images: images });
            });

            return { checkerVal, missedVal, scoreVal, mistakes };
        }
    });

    if (isConfirmed && parsedData) {
        currentReports[team] = {
            checker: parsedData.checkerVal || currentUser.username, missed: parsedData.missedVal, score: parsedData.scoreVal || '-', bad_behavior: '-', 
            mistakes: parsedData.mistakes, updatedBy: currentUser.username, updatedAt: new Date().toISOString()
        };

        Swal.fire({title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading()});
        appDB.from('settings').upsert([{ key: reportKey, value: JSON.stringify(currentReports) }]).then(({error}) => {
            if (error) { Swal.fire('Error', error.message, 'error'); } 
            else {
                Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', timer: 1000, showConfirmButton: false });
                window.refreshDutyData();
                window.debouncedBroadcast('duty-updates', 'force_reload');
                // 🌟 [แก้บัค Realtime] เรียก helper เพื่อ insert log + broadcast (แทน monkey-patch เดิมที่ไม่ทำงาน)
                if (typeof window.broadcastTrainerReportChange === 'function') {
                    window.broadcastTrainerReportChange(reportKey);
                }
            }
        });
    }
};

window.addMistakeRow = function(empName = '', note = '', images = []) {
    const container = document.querySelector('.swal2-container #mistakes_container');
    if(!container) return;
    
    const rowId = 'mistake_' + Date.now() + Math.floor(Math.random() * 1000);
    
    let imagesHtml = '';
    if (images && images.length > 0) {
        images.forEach(src => { imagesHtml += `<div class="relative inline-block" title="คลิกสองครั้งเพื่อลบ"><img src="${src}" class="h-16 w-auto border rounded shadow-sm pasted-img cursor-pointer hover:opacity-80 transition" ondblclick="this.parentElement.remove()" onclick="window.open('${src}','_blank')"></div>`; });
    }

    let staffOptionsHTML = '<option value="">-- เลือกพนักงานในทีม --</option>';
    let isOtherName = true;

    if (window._currentAssignedStaff && window._currentAssignedStaff.length > 0) {
        window._currentAssignedStaff.forEach(u => {
            const isSelected = (empName === u.username) ? 'selected' : '';
            if (isSelected) isOtherName = false;
            staffOptionsHTML += `<option value="${u.username}" ${isSelected}>${u.username}</option>`;
        });
    }
    
    if (!empName) isOtherName = false;
    staffOptionsHTML += `<option value="อื่นๆ" ${isOtherName ? 'selected' : ''}>-- คนอื่นๆ (พิมพ์ชื่อเอง) --</option>`;

    const html = `
        <div id="${rowId}" class="mistake-row border border-red-200 dark:border-red-800 p-3 rounded bg-white dark:bg-slate-800 relative shadow-sm">
            <button type="button" onclick="document.getElementById('${rowId}').remove()" class="absolute top-2 right-2 text-red-500 hover:text-red-700 text-xs font-bold bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded transition">❌ ลบกล่องนี้</button>
            <div class="mb-2 pr-16">
                <label class="text-[10px] font-bold text-gray-500 dark:text-gray-400">ชื่อพนักงาน:</label>
                <select class="mistake-emp-select w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded p-1.5 text-xs mt-0.5 outline-none focus:border-red-500 font-bold text-blue-600" onchange="this.nextElementSibling.style.display = this.value === 'อื่นๆ' ? 'block' : 'none'">${staffOptionsHTML}</select>
                <input type="text" list="employee_list_modal" class="mistake-emp-manual w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded p-1.5 text-xs mt-1 outline-none focus:border-red-500" placeholder="พิมพ์ชื่อพนักงาน..." value="${isOtherName ? empName : ''}" style="display: ${isOtherName ? 'block' : 'none'}">
            </div>
            <div class="mb-2">
                <label class="text-[10px] font-bold text-gray-500 dark:text-gray-400">รายละเอียดความผิด:</label>
                <textarea class="mistake-note w-full border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded p-1.5 text-xs mt-0.5 outline-none focus:border-red-500" rows="1" placeholder="พิมพ์ความผิด (ถ้าไม่มี ปล่อยว่างได้)"></textarea>
            </div>
            <div>
                <label class="text-[10px] font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1"><span class="material-icons text-[12px]">image</span> วางรูปลงกล่องด้านล่าง (Ctrl+V / วาง URL ก็ได้):</label>
                <div class="paste-image-area w-full min-h-[50px] border-2 border-dashed border-gray-300 dark:border-slate-600 rounded mt-0.5 p-2 text-center text-gray-400 text-xs focus:border-red-500 outline-none flex flex-wrap gap-2 items-center justify-center dark:bg-slate-900 transition cursor-text" contenteditable="true" oninput="handleUrlPaste(event, this)">
                    ${imagesHtml || 'คลิกที่นี่แล้วกด Ctrl+V เพื่อวางรูปภาพ'}
                </div>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', html);
    setTimeout(() => { document.getElementById(rowId).querySelector('.mistake-note').value = note; }, 10);
};

window.handleUrlPaste = function(e, div) {
    const text = div.innerText.trim();
    if (text.startsWith('http') && (text.match(/\.(jpeg|jpg|gif|png)$/) || text.includes('imgur') || text.includes('googleusercontent'))) {
        e.preventDefault(); div.innerHTML = ''; 
        let wrapper = document.createElement("div"); wrapper.className = "relative inline-block"; wrapper.title = "คลิกสองครั้งเพื่อลบ";
        let img = document.createElement("img"); img.src = text; img.className = "h-16 w-auto border rounded shadow-sm pasted-img cursor-pointer hover:opacity-80 transition";
        img.ondblclick = function() { wrapper.remove(); }; 
        wrapper.appendChild(img); div.appendChild(wrapper);
    } else if (text !== '' && !text.includes('คลิกที่นี่')) {
         setTimeout(()=> div.innerHTML = div.innerHTML.replace(text, ''), 10);
    }
};
document.addEventListener('paste', function(e) {
    let target = e.target;
    while (target && target.nodeName !== 'BODY') {
        if (target.classList && target.classList.contains('paste-image-area')) break;
        target = target.parentNode;
    }

    if (target && target.classList && target.classList.contains('paste-image-area')) {
        let items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let index in items) {
            let item = items[index];
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                e.preventDefault(); 
                let blob = item.getAsFile();
                let reader = new FileReader();
                reader.onload = function(event) {
                    if (target.innerHTML.includes("คลิกที่นี่แล้วกด Ctrl+V")) target.innerHTML = ''; 
                    
                    let wrapper = document.createElement("div"); wrapper.className = "relative inline-block"; wrapper.title = "คลิกสองครั้งเพื่อลบ";
                    let img = document.createElement("img"); img.src = event.target.result; img.className = "h-16 w-auto border rounded shadow-sm pasted-img cursor-pointer hover:opacity-80 transition";
                    img.ondblclick = function() { wrapper.remove(); }; 
                    wrapper.appendChild(img); target.appendChild(wrapper);
                };
                reader.readAsDataURL(blob);
            }
        }
    }
});

window.openDutyHistoryModal = async function() {
    Swal.fire({title: 'กำลังโหลดประวัติ...', didOpen: () => Swal.showLoading()});
    try {
        const { data, error } = await appDB.from('system_logs').select('*').in('action_type', ['จัดหน้าที่', 'สุ่มจัดหน้าที่', 'แจกงานรอง', 'ล้างงานรอง', 'ล้างตารางงาน', 'ประเมินงานผู้สอน', 'ย้ายหน้าที่', 'กู้คืนตารางงาน', 'รวมห้อง Discord', 'จัดซัพพอร์ต', 'ล็อกอยู่ต่อ']).order('created_at', { ascending: false }).limit(50);
        if (error) throw error;

        let rows = '';
        if (!data || data.length === 0) {
            rows = `<tr><td colspan="4" class="text-center p-6 text-gray-500 font-bold">ยังไม่มีประวัติการทำรายการ</td></tr>`;
        } else {
            data.forEach(log => {
                const time = new Date(log.created_at).toLocaleString('th-TH', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'});
                let badgeColor = 'text-blue-600 bg-blue-100 border-blue-200';
                if (log.action_type === 'ล้างตารางงาน') badgeColor = 'text-red-600 bg-red-100 border-red-200';
                if (log.action_type === 'ประเมินงานผู้สอน') badgeColor = 'text-amber-600 bg-amber-100 border-amber-200';
                if (log.action_type === 'ย้ายหน้าที่') badgeColor = 'text-purple-600 bg-purple-100 border-purple-200';
                if (log.action_type === 'สุ่มจัดหน้าที่') badgeColor = 'text-emerald-600 bg-emerald-100 border-emerald-200';
                if (log.action_type === 'แจกงานรอง') badgeColor = 'text-cyan-600 bg-cyan-100 border-cyan-200';
                if (log.action_type === 'ล้างงานรอง') badgeColor = 'text-sky-700 bg-sky-100 border-sky-300';
                if (log.action_type === 'กู้คืนตารางงาน') badgeColor = 'text-emerald-600 bg-emerald-100 border-emerald-200';
                if (log.action_type === 'รวมห้อง Discord') badgeColor = 'text-violet-600 bg-violet-100 border-violet-200';
                if (log.action_type === 'จัดซัพพอร์ต') badgeColor = 'text-teal-700 bg-teal-100 border-teal-300';
                if (log.action_type === 'ล็อกอยู่ต่อ') badgeColor = 'text-amber-700 bg-amber-100 border-amber-300';

                rows += `
                    <tr class="border-b dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition text-xs">
                        <td class="px-3 py-2 font-mono text-gray-500 whitespace-nowrap">${time}</td>
                        <td class="px-3 py-2 font-bold text-slate-700 dark:text-gray-200">${log.performed_by}</td>
                        <td class="px-3 py-2 whitespace-nowrap"><span class="${badgeColor} px-2 py-0.5 rounded border shadow-sm font-bold text-[10px]">${log.action_type}</span></td>
                        <td class="px-3 py-2 text-gray-600 dark:text-gray-400">${log.target_details}</td>
                    </tr>
                `;
            });
        }

        const htmlContent = `
            <div class="text-left overflow-hidden rounded-lg border border-gray-300 dark:border-slate-600 shadow-inner bg-white dark:bg-slate-900">
                <div class="max-h-[60vh] overflow-y-auto custom-scrollbar">
                    <table class="w-full text-left">
                        <thead class="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-gray-300 sticky top-0 z-10 shadow-sm">
                            <tr class="text-xs uppercase tracking-wider">
                                <th class="px-3 py-2 font-bold">วัน-เวลา</th><th class="px-3 py-2 font-bold">ผู้ทำรายการ</th><th class="px-3 py-2 font-bold">ประเภท</th><th class="px-3 py-2 font-bold">รายละเอียด</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
        `;

        Swal.fire({
            title: '<div class="flex items-center justify-center gap-2"><span class="material-icons text-indigo-500">history</span> ประวัติระบบจัดหน้าที่</div>',
            html: htmlContent, width: '750px', showConfirmButton: false, showCloseButton: true,
            customClass: { popup: 'dark:bg-slate-800 dark:text-white' }
        });

    } catch (e) { Swal.fire('Error', 'ไม่สามารถโหลดประวัติได้: ' + e.message, 'error'); }
};

// (ตัดระบบโควตาพักแบบนับคน/คำนวณออโต้ออก — เปลี่ยนเป็น "คนคุมขั้นต่ำต่อเว็บ" ตั้งค่าในหน้าจัดการระบบ)



window.renderDutyAccessTable = function() {
    const head = document.getElementById('dutyAccessHead');
    const body = document.getElementById('dutyAccessBody');
    if(!head || !body) return;
    
    let staff = GLOBAL_USER_LIST.filter(u => {
        let uDept = u.department || 'AM';
        if (uDept === 'TRAINER') uDept = 'AMQL'; 

        if (window.isTrainerDept()) {
            return uDept === currentDutyDept; 
        } else {
            return u.role === 'staff' && uDept === currentDutyDept;
        }
    });

    // 🌟 ดึงลิสต์รายชื่อเว็บมาตรฐานมาใช้
    let headHtml = `<tr><th class="p-2 bg-slate-200 dark:bg-slate-800 border-r dark:border-slate-700 min-w-[120px]">ชื่อพนักงาน</th>`;
    sortedTeams.forEach(team => { headHtml += `<th class="p-2 text-center text-[10px] font-extrabold truncate max-w-[50px] border-r dark:border-slate-700" title="${team}">${team}</th>`; });
    headHtml += `</tr>`;
    head.innerHTML = headHtml;
    
    const shiftFilter = document.getElementById('settingShiftFilter') ? document.getElementById('settingShiftFilter').value : 'all';
    const searchFilter = document.getElementById('settingSearchInput') ? document.getElementById('settingSearchInput').value.toLowerCase() : '';

    if (shiftFilter !== 'all') staff = staff.filter(u => u.allowed_shift === shiftFilter);
    if (searchFilter) staff = staff.filter(u => u.username.toLowerCase().includes(searchFilter));
    
    staff.sort((a,b) => a.username.localeCompare(b.username));
    
    const countEl = document.getElementById('dutyStaffCount');
    if(countEl) countEl.innerText = `${staff.length} คน`;

    let bodyHtml = '';
    staff.forEach(u => {
        const shiftColor = u.allowed_shift === 'กะเช้า' ? 'text-orange-500' : (u.allowed_shift === 'กะกลาง' ? 'text-blue-500' : 'text-purple-500');
        
        let roleBadge = '';
        if (u.role === 'manager' || u.role === 'admin') {
            roleBadge = `<span class="text-[9px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded border border-red-200 shadow-sm ml-1">Manager</span>`;
        }

        const userAccess = dutyAccessMatrix[String(u.id)] || [];
        const validAccessCount = userAccess.filter(t => sortedTeams.includes(t)).length; 

        let noAccessWarning = '';
        let rowBgClass = 'hover:bg-slate-50 dark:hover:bg-slate-800/50'; 

        if (validAccessCount === 0) {
            noAccessWarning = `<span class="text-[9px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded shadow-sm ml-1 animate-pulse" title="พนักงานคนนี้จะจัดตารางไม่ได้เพราะไม่มีสิทธิ์เว็บใดเลย">ไม่มีสิทธิ์</span>`;
            rowBgClass = 'bg-red-50/50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40';
        }

        let rowHtml = `<tr class="${rowBgClass} transition">
            <td class="p-2 font-bold text-slate-700 dark:text-gray-200 border-r dark:border-slate-700 flex justify-between items-center">
                <div class="flex items-center flex-wrap">
                    <span>${u.username}</span>
                    ${roleBadge}
                    ${noAccessWarning} </div>
                <span class="text-[9px] ${shiftColor} bg-gray-100 dark:bg-slate-900 px-1 rounded border dark:border-slate-600 shrink-0 ml-1">${u.allowed_shift.replace('กะ','')}</span>
            </td>`;
        
        sortedTeams.forEach(team => {
            const isChecked = userAccess.includes(team) ? 'checked' : '';
            rowHtml += `<td class="p-1 text-center border-r dark:border-slate-700 bg-white dark:bg-transparent"><input type="checkbox" class="duty-check w-5 h-5 text-green-500 rounded cursor-pointer border-gray-300 focus:ring-green-500 shadow-sm transition" onchange="updateLocalDutyAccess('${u.id}', '${team}', this.checked)" ${isChecked}></td>`;
        });
        rowHtml += `</tr>`;
        bodyHtml += rowHtml;
    });
    
    if(staff.length === 0) bodyHtml = `<tr><td colspan="${sortedTeams.length+1}" class="p-8 text-center text-gray-400">ไม่พบพนักงานที่ค้นหา</td></tr>`;
    body.innerHTML = bodyHtml;
}

window.updateLocalDutyAccess = function(uid, team, isChecked) {
    uid = String(uid); if(!dutyAccessMatrix[uid]) dutyAccessMatrix[uid] = [];
    if(isChecked) { 
        if(!dutyAccessMatrix[uid].includes(team)) dutyAccessMatrix[uid].push(team); 
    } else { 
        dutyAccessMatrix[uid] = dutyAccessMatrix[uid].filter(t => t !== team); 
    }
}

window.saveDutyAccess = async function() {
    Swal.fire({title: 'กำลังบันทึกสิทธิ์...', didOpen: () => Swal.showLoading()});
    try {
        window.clearSettingCache(); await appDB.from('settings').upsert([{ key: 'duty_access_matrix', value: JSON.stringify(dutyAccessMatrix) }]);
        Swal.fire({icon: 'success', title: 'บันทึกสำเร็จ', timer: 1000, showConfirmButton: false});
    } catch(e) { Swal.fire('Error', e.message, 'error'); }
}

window.renderRoleEditorList = function() {
    const team = document.getElementById('roleEditorTeam').value;
    const listDiv = document.getElementById('roleEditorList');
    if(!team || !customDutyRoles[team]) { listDiv.innerHTML = ''; return; }
    const roles = customDutyRoles[team];
    if(roles.length === 0) { listDiv.innerHTML = '<div class="text-center text-gray-400 text-xs py-4">ไม่มีหัวข้อในเว็บนี้</div>'; return; }
    listDiv.innerHTML = roles.map((r, idx) => `<div class="flex justify-between items-center bg-white dark:bg-slate-800 p-2 rounded shadow-sm border border-gray-200 dark:border-slate-700"><span class="text-xs font-bold text-slate-700 dark:text-gray-200">${r}</span><button onclick="removeDutyRole('${team}', ${idx})" class="text-red-400 hover:text-red-600"><span class="material-icons text-sm">close</span></button></div>`).join('');
}

window.addDutyRole = async function() {
    const team = document.getElementById('roleEditorTeam').value; const input = document.getElementById('newRoleInput'); const val = input.value.trim();
    if(!val || !team) return;
    if(!customDutyRoles[team]) customDutyRoles[team] = [];
    customDutyRoles[team].push(val); input.value = ''; window.renderRoleEditorList(); await window.saveCustomRolesToDB();
    // ถ้าแก้หัวข้อให้ render ตาราง OD ใหม่ด้วยเผื่อเปิดอยู่
    if (document.getElementById('dutyMatrixGrid') && !document.getElementById('dutyMatrixGrid').classList.contains('hidden')) {
        window.renderTrainerOdMatrix(currentRosterData);
    }
}

window.removeDutyRole = async function(team, idx) {
    if(customDutyRoles[team]) { 
        customDutyRoles[team].splice(idx, 1); 
        window.renderRoleEditorList(); 
        await window.saveCustomRolesToDB(); 
        // ถ้าแก้หัวข้อให้ render ตาราง OD ใหม่ด้วยเผื่อเปิดอยู่
        if (document.getElementById('dutyMatrixGrid') && !document.getElementById('dutyMatrixGrid').classList.contains('hidden')) {
            window.renderTrainerOdMatrix(currentRosterData);
        }
    }
}

window.saveCustomRolesToDB = async function() { window.clearSettingCache(); await appDB.from('settings').upsert([{ key: 'duty_custom_roles', value: JSON.stringify(customDutyRoles) }]); }

window.renderDutyRequirements = function() {
    const container = document.getElementById('dutyRequirements');
    if(!container) return;
    container.innerHTML = '';
    const savedReqs = JSON.parse(window.safeGetItem(`duty_reqs_${currentDutyDept}`, '{}') || '{}');

    sortedTeams.forEach((team, index) => {
        const reqKey = `req_${team}`;
        const defaultVal = savedReqs[reqKey] || 0;
        const colorClass = TEAM_COLORS[team] || TEAM_COLORS['DEFAULT'];

        container.innerHTML += `
            <div class="flex items-center bg-white dark:bg-slate-800 rounded-lg border border-gray-300 dark:border-slate-600 shadow-sm overflow-hidden group hover:border-indigo-400 transition">
                <div class="flex flex-col items-center border-r border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 w-5">
                    <button onclick="moveTeam('${team}', -1)" class="text-gray-400 hover:text-indigo-600 leading-none h-4 ${index === 0 ? 'invisible' : ''}">◀</button>
                    <button onclick="moveTeam('${team}', 1)" class="text-gray-400 hover:text-indigo-600 leading-none h-4 ${index === sortedTeams.length-1 ? 'invisible' : ''}">▶</button>
                </div>
                <div class="${colorClass.bg} ${colorClass.text} text-[11px] font-extrabold px-2 py-1.5 w-16 text-center border-r ${colorClass.border} truncate" title="${team}">${team}</div>
                <input type="number" id="${reqKey}" onchange="window.manualAdjustReq('${team}')" class="req-input w-12 text-center text-sm font-bold bg-transparent outline-none text-slate-800 dark:text-white py-1" value="${defaultVal}" min="0">
            </div>
        `;
    });
}

window.manualAdjustReq = function(changedTeam) {
    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    
    const activeStaff = window.getDutyActiveStaff(shiftFilter);
    
    const availableCount = activeStaff.length;
    if (availableCount === 0) return; 

    let reqs = {};
    let totalReq = 0;
    sortedTeams.forEach(team => {
        const val = parseInt(document.getElementById(`req_${team}`).value) || 0;
        reqs[team] = val;
        totalReq += val;
    });

    const changedInput = document.getElementById(`req_${changedTeam}`);
    let changedVal = parseInt(changedInput.value) || 0;

    if (changedVal < 0) {
        changedVal = 0;
        reqs[changedTeam] = 0;
        totalReq = Object.values(reqs).reduce((a,b) => a+b, 0);
    }

    let diff = totalReq - availableCount;

    if (diff === 0) {
        window.updateDutyStats();
        return; 
    }

    let safeLoopLimit = 1000;

    while (diff > 0 && safeLoopLimit-- > 0) {
        let maxTeam = null; let maxVal = -1;
        sortedTeams.forEach(t => {
            if (t !== changedTeam && reqs[t] > maxVal && reqs[t] > 0) { maxVal = reqs[t]; maxTeam = t; }
        });
        if (maxTeam) { reqs[maxTeam]--; diff--; } 
        else { reqs[changedTeam]--; diff--; }
    }

    while (diff < 0 && safeLoopLimit-- > 0) {
        let minTeam = null; let minVal = Infinity;
        sortedTeams.forEach(t => {
            if (t !== changedTeam && reqs[t] < minVal) { minVal = reqs[t]; minTeam = t; }
        });
        if (minTeam) { reqs[minTeam]++; diff++; } 
        else { reqs[changedTeam]++; diff++; }
    }

    const reqsToSave = {};
    sortedTeams.forEach(team => {
        const input = document.getElementById(`req_${team}`);
        if (input) input.value = reqs[team];
        reqsToSave[`req_${team}`] = reqs[team];
    });
    
    window.safeSetItem(`duty_reqs_${currentDutyDept}`, JSON.stringify(reqsToSave));
    window.updateDutyStats();
};

window.autoSuggestRequirements = function() {
    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    const targetDate = document.getElementById('dutyDate').value;
    if(!targetDate) return Swal.fire('!', 'กรุณาเลือกวันที่ก่อน', 'warning');

    const activeStaff = window.getDutyActiveStaff(shiftFilter);

    if(activeStaff.length === 0) return Swal.fire('ไม่มีข้อมูล', 'ไม่มีพนักงานว่างในกะนี้เลย', 'info');

    let suggestedReqs = {};
    sortedTeams.forEach(t => suggestedReqs[t] = 0);

    let pool = [...activeStaff].sort(() => Math.random() - 0.5);
    let unassignedUsers = []; 

    pool.forEach(u => {
        const access = dutyAccessMatrix[String(u.id)] || [];
        const validAccess = access.filter(t => sortedTeams.includes(t));

        if (validAccess.length > 0) {
            let minTeam = validAccess[0];
            let minVal = suggestedReqs[minTeam];
            for (let i = 1; i < validAccess.length; i++) {
                if (suggestedReqs[validAccess[i]] < minVal) {
                    minTeam = validAccess[i];
                    minVal = suggestedReqs[validAccess[i]];
                }
            }
            suggestedReqs[minTeam]++;
        } else {
            unassignedUsers.push(u.username); 
        }
    });

    sortedTeams.forEach(team => {
        const input = document.getElementById(`req_${team}`);
        if (input) input.value = suggestedReqs[team];
    });

    const reqsToSave = {};
    sortedTeams.forEach(team => reqsToSave[`req_${team}`] = suggestedReqs[team]);
    window.safeSetItem(`duty_reqs_${currentDutyDept}`, JSON.stringify(reqsToSave));

    window.updateDutyStats();

    if (unassignedUsers.length > 0) {
        Swal.fire({
            icon: 'warning', 
            title: 'มีคนไม่มีสิทธิ์!', 
            html: `ระบบดึงคนมาคำนวณทั้งหมด ${activeStaff.length} คน<br>แต่พบพนักงาน <b>${unassignedUsers.length} คน</b> ที่ไม่มีสิทธิ์เข้าเว็บใดๆ เลย:<br><br><span class="text-red-500 font-bold">${unassignedUsers.join(', ')}</span><br><br><span class="text-[10px] text-gray-500">*ถ้าชื่อเหล่านี้เป็นคนกะอื่น ให้ไปเช็คหน้า "จัดการพนักงาน" ว่าตั้งกะเป็น "กะอิสระ" ทิ้งไว้หรือไม่ครับ</span>`
        });
    } else {
        const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
        Toast.fire({ icon: 'success', title: 'คำนวณยอดคนออโต้สำเร็จ!' });
    }
}

window.updateDutyStats = function() {
    const shiftFilter = document.getElementById('dutyShiftSelect').value;
    const statusBar = document.getElementById('dutyStatusBar');
    if(!statusBar) return;

    const activeStaff = window.getDutyActiveStaff(shiftFilter);
    
    const availableCount = activeStaff.length;

    let requiredCount = 0;
    document.querySelectorAll('.req-input').forEach(input => {
        requiredCount += (parseInt(input.value) || 0);
    });

    let statusHTML = '';
    let statusClass = 'p-2 text-center text-xs font-bold transition-colors duration-300 border-b shadow-sm ';

    if (requiredCount === 0) {
        statusClass += 'bg-gray-200 text-gray-600 border-gray-300 dark:bg-slate-800 dark:border-slate-700';
        statusHTML = `ℹ️ กรุณาใส่จำนวนคนให้แต่ละเว็บ (คนมาทำงานกะนี้: ${availableCount} คน)`;
    } else if (availableCount === requiredCount) {
        statusClass += 'bg-green-500 text-white border-green-600 shadow-[0_0_10px_rgba(34,197,94,0.5)]';
        statusHTML = `✅ ยอดเยี่ยม! จัดคนพอดีเป๊ะ (ว่าง: ${availableCount} คน | ต้องการ: ${requiredCount} คน)`;
    } else if (requiredCount > availableCount) {
        statusClass += 'bg-red-500 text-white border-red-600 shadow-[0_0_10px_rgba(239,68,68,0.5)]';
        statusHTML = `❌ ขาดคน! คุณใส่เลขเกิน (ว่าง: ${availableCount} คน | ต้องการ: ${requiredCount} คน)`;
    } else {
        statusClass += 'bg-amber-400 text-amber-900 border-amber-500 shadow-[0_0_10px_rgba(251,191,36,0.5)]';
        statusHTML = `⚠️ มีคนเหลือว่างงาน! (ว่าง: ${availableCount} คน | ต้องการแค่: ${requiredCount} คน)`;
    }

    statusBar.className = statusClass;
    statusBar.innerHTML = statusHTML;
}

// 🌟 [แก้บัค Realtime] Helper สำหรับ broadcast การเปลี่ยนแปลงและ log
// ใช้แทน monkey-patch เดิมที่ไม่ทำงาน (เพราะ appDB.from() คืน object ใหม่ทุกครั้ง)
// เรียกฟังก์ชันนี้หลังจาก upsert report สำเร็จ
window.broadcastTrainerReportChange = async function(reportKey) {
    try {
        const parts = reportKey.split('_');
        if (window.isTrainerDept(parts[1])) {
            const dateStr = parts[parts.length - 2];
            const shiftStr = parts[parts.length - 1];
            
            await appDB.from('system_logs').insert([{ 
                action_type: 'ประเมินงานผู้สอน', 
                performed_by: currentUser.username, 
                target_details: `ลงข้อมูลประเมินการทำงาน (กะ: ${shiftStr}, วันที่: ${dateStr})` 
            }]);
            
            window.debouncedBroadcast('duty-updates', 'force_reload');
        }
    } catch(e) { console.warn('broadcastTrainerReportChange error:', e); }
};


let dutySearchTimeout = null;
window.onDutySearch = function() {
    clearTimeout(dutySearchTimeout);
    dutySearchTimeout = setTimeout(() => {
        filterDutyResult(); 
    }, 300); 
};

// 🌟 [แก้บัค Realtime ผู้สอน] Key สำหรับเก็บการเปลี่ยน role ใน DB
// แยกตาม วันที่ + กะ + แผนก (เพื่อให้แต่ละกะของแต่ละวันมีค่าของตัวเอง)
window.getTrainerMatrixRoleKey = function(dept, dateStr, shift) {
    return `trainer_matrix_roles_${dept}_${dateStr}_${shift}`;
};

window.renderTrainerOdMatrix = async function(rosterData) {
    const matrixGrid = document.getElementById('dutyMatrixGrid');
    if (!matrixGrid) return;

    // 🔒 เช็คสิทธิ์การแก้ไข (ถ้าเป็นผู้สอน จะแก้ไขหน้าตารางของตัวเองไม่ได้)
    let canEdit = window.isDutyAdmin();
    if (window.isTrainerDept()) {
        if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
            canEdit = false;
        }
    }
    
    let disableAttr = canEdit ? '' : 'disabled';
    let cursorClass = canEdit ? 'cursor-pointer hover:shadow-md' : 'cursor-default pointer-events-none appearance-none opacity-100'; 

    // 🌟 [แก้บัค Realtime ผู้สอน] โหลด override role ที่บันทึกไว้จาก DB
    const targetDate = document.getElementById('dutyDate') ? document.getElementById('dutyDate').value : '';
    const shiftFilterForKey = document.getElementById('dutyShiftSelect') ? document.getElementById('dutyShiftSelect').value : 'all';
    const matrixRoleKey = window.getTrainerMatrixRoleKey(currentDutyDept, targetDate, shiftFilterForKey);
    let savedRoleOverrides = {};
    try {
        if (targetDate) {
            const { data } = await window.getSettingCached(matrixRoleKey);
            if (data && data.value) savedRoleOverrides = JSON.parse(data.value);
        }
    } catch(e) { console.warn('Load trainer matrix roles failed:', e); savedRoleOverrides = {}; }

    const matrixWebsites = ['Jun88', 'MK8', 'VV72', 'TH26', 'K188', 'BT678', 'PG688', 'JL69', 'NM9', 'F168'];

    const webColors = {
        'Jun88': 'bg-blue-600 text-white',
        'MK8': 'bg-black text-yellow-400',
        'VV72': 'bg-red-800 text-white',     // [FIX] ให้ตรงกับ TEAM_COLORS (เดิมเขียว ไม่ตรงกับการ์ดหน้าหลัก)
        'TH26': 'bg-gray-700 text-white',
        'K188': 'bg-sky-500 text-white',
        'BT678': 'bg-red-600 text-white',
        'PG688': 'bg-amber-100 text-amber-900',
        'JL69': 'bg-slate-600 text-white',
        'NM9': 'bg-pink-600 text-white',
        'F168': 'bg-orange-600 text-white',
    };

    const shiftFilter = document.getElementById('dutyShiftSelect') ? document.getElementById('dutyShiftSelect').value : 'all';

    const staffList = GLOBAL_USER_LIST.filter(u => {
        let isOdTrainer = false;
        if (u.department === 'ODQL' || u.department === 'TRAINER_OD') isOdTrainer = true;
        if (u.department === 'OD' && (u.role === 'trainer' || u.role === 'TRAINER')) isOdTrainer = true;
        
        if (!isOdTrainer) return false;
        if (shiftFilter !== 'all') {
             if (u.allowed_shift !== shiftFilter && u.allowed_shift !== 'all') return false;
        }
        return true;
    });

    const leaveIds = new Set(window.currentDutyLeaveData.map(l => String(l.user_id)));
    const activeTrainers = staffList.filter(u => !leaveIds.has(String(u.id)));

    let userTaskRoles = {}; 
    let globalPoolIndex = 0; 

    matrixWebsites.forEach(web => {
        let webTasks = customDutyRoles[web] || ['ไม่มีหัวข้อ'];
        if (webTasks.length === 0) webTasks = ['-'];
        
        let primaryUsers = (rosterData[web] || []).filter(u => !u.username.includes('ขาดคน'));
        
        if (primaryUsers.length === 0 && activeTrainers.length > 0) {
            let pool = activeTrainers.length > 0 ? activeTrainers : primaryUsers;
            
            webTasks.forEach((task, tIdx) => {
                // 🌟 กฎเหล็ก: แบนงานหลักข้ามกะ

                if (pool.length > 0) {
                    let uJob = pool[globalPoolIndex % pool.length];
                    if (!userTaskRoles[uJob.id]) userTaskRoles[uJob.id] = {};
                    if (!userTaskRoles[uJob.id][web]) userTaskRoles[uJob.id][web] = {};
                    userTaskRoles[uJob.id][web][tIdx] = 'job';
                    
                    if (pool.length > 1) {
                        let uSup = pool[(globalPoolIndex + 1) % pool.length];
                        if (!userTaskRoles[uSup.id]) userTaskRoles[uSup.id] = {};
                        if (!userTaskRoles[uSup.id][web]) userTaskRoles[uSup.id][web] = {};
                        userTaskRoles[uSup.id][web][tIdx] = 'sup';
                    }
                    globalPoolIndex++; 
                }
            });
        } else {
            primaryUsers.sort((a,b) => a.username.localeCompare(b.username));
            
            if (web === 'F168') {
                webTasks.forEach((task, tIdx) => {
                    // 🌟 กฎเหล็ก: แบนงานหลักข้ามกะ

                    if (primaryUsers.length > 0) {
                        let uJob1 = primaryUsers[tIdx % primaryUsers.length];
                        if (!userTaskRoles[uJob1.id]) userTaskRoles[uJob1.id] = {};
                        if (!userTaskRoles[uJob1.id][web]) userTaskRoles[uJob1.id][web] = {};
                        userTaskRoles[uJob1.id][web][tIdx] = 'job';
                        
                        if (primaryUsers.length > 1) {
                            let uJob2 = primaryUsers[(tIdx + 1) % primaryUsers.length];
                            if (!userTaskRoles[uJob2.id]) userTaskRoles[uJob2.id] = {};
                            if (!userTaskRoles[uJob2.id][web]) userTaskRoles[uJob2.id][web] = {};
                            userTaskRoles[uJob2.id][web][tIdx] = 'job';
                        }

                        if (primaryUsers.length > 2) {
                            let uJob3 = primaryUsers[(tIdx + 2) % primaryUsers.length];
                            if (!userTaskRoles[uJob3.id]) userTaskRoles[uJob3.id] = {};
                            if (!userTaskRoles[uJob3.id][web]) userTaskRoles[uJob3.id][web] = {};
                            userTaskRoles[uJob3.id][web][tIdx] = 'job';
                        }
                        
                        if (primaryUsers.length > 3) {
                            for (let i = 3; i < primaryUsers.length; i++) {
                                let uSup = primaryUsers[(tIdx + i) % primaryUsers.length];
                                if (!userTaskRoles[uSup.id]) userTaskRoles[uSup.id] = {};
                                if (!userTaskRoles[uSup.id][web]) userTaskRoles[uSup.id][web] = {};
                                userTaskRoles[uSup.id][web][tIdx] = 'sup';
                            }
                        }
                    }
                });
            } else {
                // 🌟 เว็บปกติอื่นๆ: ดักจับและ "แบน" หัวข้อที่ไม่ตรงกะทิ้งไปเลย
                let allowedTaskIndices = [];
                webTasks.forEach((task, i) => {
                    allowedTaskIndices.push(i);
                });

                // เรียงลำดับความสำคัญของหัวข้อที่รอดจากการแบน
                allowedTaskIndices.sort((a, b) => {
                    let taskA = webTasks[a];
                    let taskB = webTasks[b];
                    const getScore = (task) => {
                        return 50;
                    };
                    return getScore(taskB) - getScore(taskA);
                });

                if (allowedTaskIndices.length > 0) {
                    primaryUsers.forEach((u, pIdx) => {
                        let tIdx = allowedTaskIndices[pIdx % allowedTaskIndices.length];
                        if (!userTaskRoles[u.id]) userTaskRoles[u.id] = {};
                        if (!userTaskRoles[u.id][web]) userTaskRoles[u.id][web] = {};
                        userTaskRoles[u.id][web][tIdx] = 'job';
                    });
                }
            }
        }
    });

    for (const pWeb in rosterData) {
        let standbyUsers = (rosterData[pWeb] || []).filter(u => u.secondary_team && matrixWebsites.includes(u.secondary_team) && !u.username.includes('ขาดคน'));
        standbyUsers.sort((a,b) => a.username.localeCompare(b.username));

        standbyUsers.forEach((u, idx) => {
            let sWeb = u.secondary_team;
            if (!userTaskRoles[u.id]) userTaskRoles[u.id] = {};
            if (!userTaskRoles[u.id][sWeb]) userTaskRoles[u.id][sWeb] = {};
            
            let sWebTasks = customDutyRoles[sWeb] || ['ไม่มีหัวข้อ'];
            if(sWebTasks.length === 0) sWebTasks = ['-'];
            
            let sTaskIndex = (idx + 1) % sWebTasks.length;
            for (let offset = 0; offset < sWebTasks.length; offset++) {
                let currentTry = (sTaskIndex + offset) % sWebTasks.length;
                if (!userTaskRoles[u.id][sWeb][currentTry]) {
                    userTaskRoles[u.id][sWeb][currentTry] = 'sup';
                    break;
                }
            }
        });
    }

    let html = `
        <style>
            .od-divider { border-right: 3px solid #64748b !important; }
            .dark .od-divider, html.dark .od-divider { border-right: 3px solid #000000 !important; }
        </style>
        <div class="w-full min-w-max border border-slate-600 shadow-sm rounded-lg overflow-hidden">
        <table class="w-full text-center border-collapse whitespace-nowrap dark:text-white">`; 
    
    html += `<thead class="bg-slate-200 dark:bg-slate-900 border-b border-slate-400 dark:border-slate-700"><tr>`;
    html += `<th rowspan="2" class="border border-slate-300 dark:border-slate-700 p-3 w-[1%] whitespace-nowrap text-base">กะ</th>`;
    html += `<th rowspan="2" class="border border-slate-300 dark:border-slate-700 p-3 w-[180px] min-w-[180px] whitespace-nowrap text-[15px] od-divider">รายชื่อผู้ดูแล</th>`;
    
    matrixWebsites.forEach(web => {
        let webTasks = customDutyRoles[web] || ['ไม่มีหัวข้อ'];
        if (webTasks.length === 0) webTasks = ['-'];

        let bgColor = webColors[web] || 'bg-slate-700 text-white';
        html += `<th colspan="${webTasks.length}" class="border border-slate-300 dark:border-slate-700 p-2 font-black text-base tracking-wide od-divider ${bgColor}">${web}</th>`;
    });
    html += `</tr><tr>`;
    
    matrixWebsites.forEach(web => {
        let webTasks = customDutyRoles[web] || ['ไม่มีหัวข้อ'];
        if (webTasks.length === 0) webTasks = ['-'];
        
        webTasks.forEach((task, tIdx) => {
            let dividerClass = (tIdx === webTasks.length - 1) ? 'od-divider' : '';
            html += `<th class="border border-slate-300 dark:border-slate-700 p-2.5 text-[13px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-gray-300 min-w-[100px] max-w-[130px] truncate ${dividerClass}" title="${task}">${task}</th>`;
        });
    });
    html += `</tr></thead><tbody>`;

    const shiftGroups = {};
    staffList.forEach(u => {
        const s = u.allowed_shift || 'all';
        if (!shiftGroups[s]) shiftGroups[s] = [];
        shiftGroups[s].push(u);
    });

    const shiftOrder = ['กะเช้า', 'กะกลาง', 'กะดึก', 'all'];
    const sortedShifts = Object.keys(shiftGroups).sort((a, b) => {
        let ia = shiftOrder.indexOf(a); if(ia === -1) ia = 99;
        let ib = shiftOrder.indexOf(b); if(ib === -1) ib = 99;
        return ia - ib;
    });

    sortedShifts.forEach(shift => {
        const shiftStaff = shiftGroups[shift];
        if (shiftStaff.length === 0) return;

        let shiftNameDisplay = shift.replace('กะ', '');
        if (shift === 'all') shiftNameDisplay = 'อิสระ';

        let shiftColor = 'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-200';
        if (shift === 'กะดึก') shiftColor = 'bg-purple-200 text-purple-900 dark:bg-purple-900 dark:text-purple-200';
        else if (shift === 'กะเช้า') shiftColor = 'bg-orange-200 text-orange-900 dark:bg-orange-900 dark:text-orange-200';
        else if (shift === 'กะกลาง') shiftColor = 'bg-blue-200 text-blue-900 dark:bg-blue-900 dark:text-blue-200';
        else if (shift === 'all') shiftColor = 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200';

        shiftStaff.forEach((user, index) => {
            let isLeave = leaveIds.has(String(user.id));
            let rowOpacity = isLeave ? 'opacity-60 bg-red-50/50 dark:bg-red-900/20' : 'hover:bg-slate-100 dark:hover:bg-slate-800/50';
            
            html += `<tr class="${rowOpacity} transition border-b border-slate-200 dark:border-slate-700">`;
            
            if (index === 0) {
                html += `<td rowspan="${shiftStaff.length}" class="border border-slate-300 dark:border-slate-700 font-black text-[15px] ${shiftColor}">${shiftNameDisplay}</td>`;
            }
            
            let nameColor = isLeave ? 'text-red-500' : 'text-green-600 dark:text-green-400';
            let leaveTag = isLeave ? '<span class="text-[11px] bg-red-500 text-white px-1.5 py-0.5 rounded shadow-sm ml-1">ลาหยุด</span>' : '';
            
            html += `<td class="border border-slate-300 dark:border-slate-700 p-3 text-left font-bold ${nameColor} pl-3 text-[15px] od-divider">
                <div class="flex items-center">
                    <span class="uppercase">${user.username}</span> ${leaveTag}
                </div>
            </td>`;
            
            matrixWebsites.forEach(web => {
                let webTasks = customDutyRoles[web] || ['ไม่มีหัวข้อ'];
                if (webTasks.length === 0) webTasks = ['-'];
                
                webTasks.forEach((task, tIdx) => {
                    let dividerClass = (tIdx === webTasks.length - 1) ? 'od-divider' : '';

                    if (task === '-') {
                        html += `<td class="border border-slate-300 dark:border-slate-700 p-2 bg-gray-100 dark:bg-slate-800/50 ${dividerClass}"></td>`;
                    } else {
                        let role = 'not';
                        if (isLeave) {
                            role = 'off';
                        } else if (userTaskRoles[user.id] && userTaskRoles[user.id][web] && userTaskRoles[user.id][web][tIdx]) {
                            role = userTaskRoles[user.id][web][tIdx];
                        }

                        // 🌟 [แก้บัค Realtime ผู้สอน] ใช้ค่าที่บันทึกใน DB ทับค่าจาก algorithm สุ่ม
                        const overrideKey = `${user.id}_${web}_${tIdx}`;
                        if (savedRoleOverrides[overrideKey] !== undefined) {
                            role = savedRoleOverrides[overrideKey];
                        }

                        let selNot = role === 'not' ? 'selected' : '';
                        let selJob = role === 'job' ? 'selected' : '';
                        let selSup = role === 'sup' ? 'selected' : '';
                        let selOff = role === 'off' ? 'selected' : '';

                        let selectClass = `text-[13px] p-1.5 rounded outline-none ${cursorClass} border font-bold focus:ring-2 focus:ring-blue-500 w-full min-w-[90px] text-center shadow-sm transition `;
                        if (role === 'job') selectClass += "bg-green-50 dark:bg-green-900/30 text-green-600 border-green-300 dark:border-green-700";
                        else if (role === 'sup') selectClass += "bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 border-yellow-300 dark:border-yellow-700";
                        else if (role === 'off') selectClass += "bg-gray-100 dark:bg-slate-800 text-gray-500 border-gray-300 dark:border-slate-600";
                        else selectClass += "bg-white dark:bg-slate-800 text-gray-500 border-gray-300 dark:border-slate-600";

                        // 🌟 [แก้บัค Realtime ผู้สอน] เมื่อ user เปลี่ยน → บันทึกลง DB ทันที + broadcast
                        let onChangeAttr = canEdit ? `onchange="window.saveTrainerMatrixRole('${user.id}', '${web}', ${tIdx}, this.value); this.className = this.options[this.selectedIndex].className + ' text-[13px] p-1.5 rounded outline-none ${cursorClass} border font-bold focus:ring-2 focus:ring-blue-500 w-full min-w-[90px] text-center shadow-sm transition'"` : '';

                        html += `<td class="border border-slate-300 dark:border-slate-700 p-1.5 ${dividerClass}">
                            <select class="${selectClass}" ${disableAttr} ${onChangeAttr}>
                                <option value="not" class="bg-white dark:bg-slate-800 text-gray-500" ${selNot}>🚫 Not</option>
                                <option value="job" class="bg-green-50 dark:bg-green-900/30 text-green-600" ${selJob}>✅ Job</option>
                                <option value="sup" class="bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600" ${selSup}>👉 Sup</option>
                                <option value="off" class="bg-gray-100 dark:bg-slate-800 text-gray-500" ${selOff}>⛔ OFF</option>
                            </select>
                        </td>`;
                    }
                });
            });
            html += `</tr>`;
        });
    });

    html += `</tbody></table></div>`;
    matrixGrid.innerHTML = html;
};

// 🌟 [แก้บัค Realtime ผู้สอน] บันทึกการเปลี่ยน role ของช่องใดช่องหนึ่งลง DB + broadcast
// เรียกจาก onchange ของ <select> แต่ละช่อง — บันทึกแบบ incremental ไม่ต้องส่งทั้งตาราง
window.saveTrainerMatrixRole = async function(userId, web, taskIdx, newRole) {
    try {
        const targetDate = document.getElementById('dutyDate') ? document.getElementById('dutyDate').value : '';
        const shiftFilter = document.getElementById('dutyShiftSelect') ? document.getElementById('dutyShiftSelect').value : 'all';
        if (!targetDate) {
            Swal.fire('!', 'กรุณาเลือกวันที่ก่อน', 'warning');
            return;
        }

        const matrixRoleKey = window.getTrainerMatrixRoleKey(currentDutyDept, targetDate, shiftFilter);
        const overrideKey = `${userId}_${web}_${taskIdx}`;

        // โหลดค่าเก่าก่อน (เพื่อ merge ไม่ใช่ทับ)
        let current = {};
        try {
            const { data } = await window.getSettingCached(matrixRoleKey);
            if (data && data.value) current = JSON.parse(data.value);
        } catch(e) {}

        current[overrideKey] = newRole;

        window.clearSettingCache(); const { error: _matrixErr } = await appDB.from('settings').upsert([{ key: matrixRoleKey, value: JSON.stringify(current) }]);
        if (_matrixErr) {
            Swal.fire('Error', 'บันทึกไม่สำเร็จ: ' + _matrixErr.message, 'error');
            return;
        }

        // log
        try {
            const user = (window.GLOBAL_USER_LIST || []).find(u => String(u.id) === String(userId));
            const userName = user ? user.username : userId;
            await appDB.from('system_logs').insert([{
                action_type: 'จัดหน้าที่',
                performed_by: currentUser.username,
                target_details: `เปลี่ยน role ของ ${userName} ที่ [${web}] หัวข้อ #${taskIdx} → ${newRole} (${currentDutyDept}, ${shiftFilter}, ${targetDate})`
            }]);
        } catch(e) {}

        // broadcast ให้เครื่องอื่นรู้
        try { window.debouncedBroadcast('duty-updates', 'force_reload'); } catch(e) {}
    } catch (err) {
        console.error('saveTrainerMatrixRole error:', err);
        Swal.fire('Error', err.message, 'error');
    }
};
