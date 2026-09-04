// ════════════════════════════════════════════════════════════════════
// 📦 fine/tools.js — ส่วนที่ 4/4 ของระบบใบปรับ (แยกจาก fine.js เดิม 1,782 บรรทัด)
// เนื้อหา: แก้ไขย้อนหลัง, สร้าง/คัดลอกข้อความ, ช่องเปอร์เซ็นต์, หน่วงค้นหา
// ⚠️ ลำดับโหลด: fine/core → fine/rules → fine/records → fine/tools (ห้ามสลับ — ตัวแปร top-level แชร์ scope เดียวกัน)
// ════════════════════════════════════════════════════════════════════
// 🌟 ฟังก์ชันแก้ไขข้อมูลใบปรับย้อนหลัง
// =========================================
window.editFineRecord = async function(id) {
    // 1. หาข้อมูลใบปรับที่แอดมินกดแก้ไข
    const fineRecord = globalFines.find(f => String(f.id) === String(id));
    if (!fineRecord) return Swal.fire('Error', 'ไม่พบข้อมูลใบปรับนี้', 'error');

    // 2. ดึงวันที่ทำผิดเดิมมาโชว์ (ถ้าไม่มี ให้ดึงจาก created_at)
    let currentOffenseDate = '';
    if (fineRecord.offense_date) {
        currentOffenseDate = fineRecord.offense_date.split('T')[0];
    } else {
        currentOffenseDate = fineRecord.created_at.split('T')[0];
    }

    // 3. ดึงกฎทั้งหมดมาเป็นตัวเลือก (ตั้งค่า default เป็นกฎเดิม)
    let ruleOptionsHtml = '';
    globalFineRules.forEach(r => {
        const isSelected = r === fineRecord.rule_text ? 'selected' : '';
        ruleOptionsHtml += `<option value="${r}" ${isSelected}>${r}</option>`;
    });

    // 4. ดึงจำนวนเงินเดิม (ถ้า -1 คือตัดค่าแรง)
    let currentAmount = fineRecord.amount === -1 ? '' : fineRecord.amount;
    let isNoWage = fineRecord.amount === -1;

    // 5. แสดงหน้าต่าง Popup ฟอร์มแก้ไข
    const { isConfirmed, value: parsedData } = await Swal.fire({
        title: '<div class="text-xl font-black text-amber-500 flex items-center justify-center gap-2"><span class="material-icons">edit_note</span> แก้ไขข้อมูลใบปรับ</div>',
        html: `
            <div class="text-left space-y-4 mt-4">
                <div>
                    <label class="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">วันที่ทำผิด (เหตุเกิดวันที่)</label>
                    <input type="date" id="swalEditOffenseDate" value="${currentOffenseDate}" class="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white font-bold outline-none focus:border-amber-500 shadow-sm cursor-pointer transition">
                </div>
                <div>
                    <label class="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">กฎ / ความผิด</label>
                    <select id="swalEditRule" class="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white font-bold outline-none focus:border-amber-500 shadow-sm cursor-pointer transition">
                        ${ruleOptionsHtml}
                    </select>
                </div>
                <div>
                    <label class="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">หมายเหตุเพิ่มเติม</label>
                    <input type="text" id="swalEditNote" value="${fineRecord.note || ''}" placeholder="พิมพ์หมายเหตุเพิ่มเติม..." class="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white font-bold outline-none focus:border-amber-500 shadow-sm transition">
                </div>
                <div>
                    <label class="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">ค่าปรับ</label>
                    <div class="flex gap-2">
                        <select id="swalEditPenaltyType" onchange="document.getElementById('swalEditAmount').disabled = this.value === 'nowage'; if(this.value === 'nowage') document.getElementById('swalEditAmount').value = '';" class="w-[45%] p-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white font-bold outline-none focus:border-amber-500 shadow-sm cursor-pointer transition">
                            <option value="money" ${!isNoWage ? 'selected' : ''}>ระบุเงิน (บาท)</option>
                            <option value="nowage" ${isNoWage ? 'selected' : ''}>ไม่ได้รับค่าแรง</option>
                        </select>
                        <input type="number" id="swalEditAmount" value="${currentAmount}" ${isNoWage ? 'disabled' : ''} placeholder="ระบุตัวเลข (ไม่ต้องใส่ลูกน้ำ)" class="flex-1 p-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white font-bold outline-none focus:border-amber-500 shadow-sm transition disabled:opacity-50">
                    </div>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'บันทึกการแก้ไข',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#f59e0b',
        cancelButtonColor: '#64748b',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl border border-slate-600 shadow-2xl' },
        preConfirm: () => {
            const offenseDate = document.getElementById('swalEditOffenseDate').value;
            const ruleText = document.getElementById('swalEditRule').value;
            const note = document.getElementById('swalEditNote').value.trim();
            const penaltyType = document.getElementById('swalEditPenaltyType').value;
            const amountInput = document.getElementById('swalEditAmount').value.trim();
            
            let finalAmount = 0;
            if (penaltyType === 'nowage') finalAmount = -1;
            else finalAmount = parseInt(amountInput) || 0;

            if (!offenseDate) { Swal.showValidationMessage('กรุณาระบุวันที่เกิดเหตุ!'); return false; }
            if (!ruleText) { Swal.showValidationMessage('กรุณาเลือกกฎ!'); return false; }

            return { offenseDate, ruleText, note, amount: finalAmount };
        }
    });

    if (isConfirmed && parsedData) {
        Swal.fire({title: 'กำลังอัปเดตข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
        
        try {
            // 6. อัปเดตข้อมูลขึ้นฐานข้อมูล
            const { error } = await appDB.from('fines').update({
                offense_date: parsedData.offenseDate,
                rule_text: parsedData.ruleText,
                note: parsedData.note,
                amount: parsedData.amount
            }).eq('id', id);

            if (error) throw error;

            // 7. แก้ไขข้อมูลในตัวแปรบนหน้าจอ (ไม่ต้องดึงใหม่จาก Server ช่วยให้ทำงานเร็วขึ้น)
            const idx = globalFines.findIndex(f => String(f.id) === String(id));
            if (idx > -1) {
                globalFines[idx].offense_date = parsedData.offenseDate;
                globalFines[idx].rule_text = parsedData.ruleText;
                globalFines[idx].note = parsedData.note;
                globalFines[idx].amount = parsedData.amount;
            }

            renderFineTable(); // วาดตารางใหม่
            
            // อัปเดตสถิติ (ถ้าเปิดหน้าสถิติอยู่)
            if (typeof renderFineStats === 'function' && document.getElementById('fineContent_stats') && !document.getElementById('fineContent_stats').classList.contains('hidden')) {
                renderFineStats();
            }

            Swal.fire({icon: 'success', title: 'แก้ไขสำเร็จ', timer: 1500, showConfirmButton: false});

        } catch (e) {
            Swal.fire('Error', e.message, 'error');
        }
    }
};

// =========================================
// 🌟 ฟังก์ชันสร้างข้อความสำหรับคัดลอก (Copy Text) แบบหลายบรรทัด
// =========================================
window.generateFineText = function() {
    const empInput = document.getElementById('fineEmpInput');
    const ruleSelect = document.getElementById('fineRuleSelect');
    
    if (!empInput || !ruleSelect) return;

    let empName = empInput.value.trim();
    const targetUser = (typeof GLOBAL_USER_LIST !== 'undefined' && GLOBAL_USER_LIST) ? GLOBAL_USER_LIST.find(u => String(u.username).toLowerCase() === String(empName).toLowerCase()) : null;
    if (targetUser) empName = targetUser.username; 
    
    const ruleText = ruleSelect.value;
    
    if (!empName || !ruleText) {
        return Swal.fire('ข้อมูลไม่ครบ', 'กรุณาระบุพนักงานและหัวข้อกฎหมายก่อนครับ', 'warning');
    }

    const noteSelect = document.getElementById('fineNoteSelect') ? document.getElementById('fineNoteSelect').value : '';
    const noteInput = document.getElementById('fineNoteInput') ? document.getElementById('fineNoteInput').value.trim() : '';
    
    // 🌟 1. จัดการหมายเหตุให้เนียนกริ๊บ ไม่มีวงเล็บซ้อน
    let finalNote = noteSelect;
    if (finalNote.startsWith('(') && finalNote.endsWith(')')) {
        finalNote = finalNote.substring(1, finalNote.length - 1).trim();
    }

    if (noteInput) {
        if (finalNote) {
            if (finalNote.includes(' นาที')) {
                finalNote = finalNote.replace(' นาที', ` ${noteInput} นาที`);
            } else if (finalNote.includes(' ครั้ง')) {
                finalNote = finalNote.replace(' ครั้ง', ` ${noteInput} ครั้ง`);
            } else if (finalNote.includes(' วัน')) {
                finalNote = finalNote.replace(' วัน', ` ${noteInput} วัน`);
            } else if (finalNote.includes('...')) {
                finalNote = finalNote.replace('...', noteInput);
            } else {
                finalNote = `${finalNote} ${noteInput}`;
            }
            finalNote = finalNote.replace(/\s+/g, ' '); 
        } else {
            finalNote = noteInput;
        }
    }

    // 🌟 2. แยกส่วนหัวข้อกฎ (บท/ข้อ) และ รายละเอียดความผิด
    let cleanRule = ruleText.replace(/^\s*\[.*?\]\s*/, ''); // ตัด [ออนไลน์], [WFH] ทิ้ง
    cleanRule = cleanRule.replace(/\s*\([^)]*(ปรับ|ค่าแรง|เลิกจ้าง|คืนเงิน|THB|บาท)[^)]*\)/gi, '').trim(); // ตัดยอดเงินวงเล็บท้ายทิ้ง

    let ruleHeader = cleanRule;
    let ruleDesc = "";
    
    const match = cleanRule.match(/^(บทที่\s*[\d\.]+\s*ข้อ(?:ที่)?\s*[\d\.]+)\s+(.*)$/);
    if (match) {
        ruleHeader = match[1].trim();
        ruleDesc = match[2].trim();
    }

    // 🌟 3. ดึงวันที่กระทำผิด
    const offenseDateVal = document.getElementById('fineOffenseDate') ? document.getElementById('fineOffenseDate').value : '';
    let dateStr = '';
    if (offenseDateVal) {
        const [y, m, d] = offenseDateVal.split('-');
        dateStr = `${d}/${m}/${y}`;
    } else {
        const now = new Date();
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yyyy = now.getFullYear();
        dateStr = `${dd}/${mm}/${yyyy}`;
    }

    // 🌟 4. นับจำนวนครั้งที่ทำผิด
    const pastFines = globalFines.filter(f => String(f.user_name).toLowerCase() === String(empName).toLowerCase() && f.rule_text === ruleText).length;
    const currentCount = pastFines + 1;

    // 🌟 5. การคิดเปอร์เซ็นต์
    const isPercentChecked = document.getElementById('fineUsePercent') ? document.getElementById('fineUsePercent').checked : false;
    let percentText = "";
    if (isPercentChecked && typeof window.calculatePercentTotal === 'function') {
        const percentFineAmount = window.calculatePercentTotal();
        if (percentFineAmount > 0) {
            const baseVol = document.getElementById('finePercentBaseAmount').value;
            const rateVal = document.getElementById('finePercentRate').value;
            percentText = `เสียหาย ${parseInt(baseVol).toLocaleString('en-US')} - ${rateVal} % = ${percentFineAmount.toLocaleString('en-US')} บ.`;
        }
    }

    // 🌟 6. ประกอบร่างข้อความหลัก
    let resultText = `${empName} ${ruleHeader}`;
    
    if (ruleDesc) {
        resultText += ` - ${ruleDesc}`;
    }
    
    if (finalNote) {
        resultText += ` (${finalNote.trim()})`;
    }

    // ต่อด้วยวันที่ด้านท้ายสุด
    resultText += ` ${dateStr}`;
    
    // 🌟 ถ้ามีการติ๊กใช้งาน "คิดค่าปรับ %" ถึงจะขึ้นบรรทัดใหม่และแสดง "ครั้งที่..."
    if (percentText) {
        resultText += `\n${percentText} ครั้งที่ ${currentCount}`;
    }

    const resultBox = document.getElementById('fineTextResultBox');
    const textArea = document.getElementById('fineTextResult');
    if (resultBox && textArea) {
        textArea.value = resultText;
        textArea.rows = percentText ? 3 : 2; // ปรับขนาดกล่องข้อความให้พอดี
        resultBox.classList.remove('hidden');
    }
};

// =========================================
// 🌟 ฟังก์ชันคัดลอกข้อความ
// =========================================
window.copyFineText = function() {
    const textArea = document.getElementById('fineTextResult');
    if (!textArea || !textArea.value) return;
    
    navigator.clipboard.writeText(textArea.value).then(() => {
        const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
        Toast.fire({ icon: 'success', title: 'คัดลอกข้อความแล้ว!' });
    }).catch(err => {
        Swal.fire('Error', 'เบราว์เซอร์ไม่รองรับการคัดลอกอัตโนมัติ', 'error');
    });
};
// =========================================
// 🌟 ฟังก์ชันคำนวณและแสดงช่องใส่เปอร์เซ็นต์
// =========================================
window.togglePercentCalc = function() {
    const box = document.getElementById('finePercentCalcBox');
    const isChecked = document.getElementById('fineUsePercent').checked;
    const baseAmtInput = document.getElementById('finePercentBaseAmount');
    
    if (isChecked) {
        if(box) {
            box.classList.remove('hidden');
            box.classList.add('flex');
        }
        if(baseAmtInput) baseAmtInput.focus();
    } else {
        if(box) {
            box.classList.add('hidden');
            box.classList.remove('flex');
        }
        if(baseAmtInput) baseAmtInput.value = '';
        if(document.getElementById('finePercentRate')) document.getElementById('finePercentRate').value = '10';
        if(document.getElementById('finePercentResultText')) document.getElementById('finePercentResultText').innerText = '฿0';
    }
}

window.calculatePercentTotal = function() {
    const baseAmt = parseInt(document.getElementById('finePercentBaseAmount').value) || 0;
    const rate = parseInt(document.getElementById('finePercentRate').value) || 10;
    const result = Math.floor(baseAmt * (rate / 100)); // ปัดเศษลงเป็นจำนวนเต็ม
    
    if(document.getElementById('finePercentResultText')) {
        document.getElementById('finePercentResultText').innerText = `฿${result.toLocaleString('en-US')}`;
    }
    
    return result;
}

// =========================================
// 🌟 ระบบหน่วงเวลาช่องค้นหา (พิมพ์เสร็จค่อยหา)
// =========================================
let fineSearchTimeout = null;

window.onFineSearch = function() {
    clearTimeout(fineSearchTimeout); // ยกเลิกคำสั่งเดิมถ้ายังพิมพ์ไม่เสร็จ
    fineSearchTimeout = setTimeout(() => {
        renderFineTable(); // สั่งวาดตารางเมื่อหยุดพิมพ์ไปแล้ว 300ms (0.3 วินาที)
    }, 300); 
};
