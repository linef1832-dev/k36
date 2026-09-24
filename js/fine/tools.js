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

    // 🌟 4. นับจำนวนครั้งที่ทำผิด — ของใครของมัน (ชื่อเดียวกัน + กฎข้อเดียวกัน)
    //    ⚠️ บั๊กเดิม: ถ้ากด "บันทึกใบปรับ" ก่อนแล้วค่อยกดสร้างข้อความ ใบที่เพิ่งบันทึกจะถูกนับเป็น "ครั้งก่อน" ด้วย
    //       → ความผิดครั้งแรกของคนใหม่โชว์เป็น "ครั้งที่ 2"  จึงต้องตัดใบที่เพิ่งออกให้คนนี้เมื่อกี้ออกก่อน
    const _mine = globalFines.filter(f => String(f.user_name).toLowerCase() === String(empName).toLowerCase() && f.rule_text === ruleText);
    const _justSaved = _mine.some(f => {
        const sameIssuer = !currentUser || !f.issued_by || String(f.issued_by).toLowerCase() === String(currentUser.username || '').toLowerCase();
        const recent = (Date.now() - new Date(f.created_at).getTime()) < 15 * 60 * 1000;   // ออกไปไม่เกิน 15 นาที
        const sameDay = !offenseDateVal || !f.offense_date || String(f.offense_date).slice(0, 10) === offenseDateVal;
        return sameIssuer && recent && sameDay;
    });
    const currentCount = _mine.length + (_justSaved ? 0 : 1);

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

// ════════════════════════════════════════════════════════════════════
// ✨ ดรอปดาวน์พรีเมียม (fx-select) — ครอบ <select> เดิมของฟอร์มออกใบปรับ
//   • <select> ตัวจริงยังอยู่ (ซ่อนไว้) ค่า/onchange/innerHTML ทำงานเหมือนเดิมทุกอย่าง
//   • วาดปุ่ม + แผงรายการเอง: หัวกลุ่มชัด, ช่องค้นหา (เมื่อรายการยาว), ไฮไลต์ตัวที่เลือก, กดคีย์บอร์ดได้
//   • ตามการเปลี่ยนแปลงของ select อัตโนมัติ (เปลี่ยนรายการ / disabled / ตั้งค่าจากโค้ด)
// ════════════════════════════════════════════════════════════════════
(function () {
    if (window.__fxSelectReady) return;
    window.__fxSelectReady = true;

    const CSS = `
    .fx-sel{position:relative}
    .fx-sel:not([class*='w-']){width:100%}
    .fx-sel select{position:absolute!important;opacity:0;pointer-events:none;width:1px;height:1px;left:0;top:0}
    .fx-btn{display:flex;align-items:center;gap:8px;width:100%;min-height:44px;padding:8px 12px;border-radius:12px;cursor:pointer;text-align:left;
        background:linear-gradient(180deg,#111a2e,#0b1220);border:1px solid rgba(148,163,184,.25);color:#f1f5f9;font-weight:800;font-size:13.5px;
        box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 1px 2px rgba(0,0,0,.35);transition:border-color .15s,box-shadow .15s}
    .fx-btn:hover{border-color:rgba(232,193,90,.55)}
    .fx-sel.open .fx-btn,.fx-btn:focus{outline:none;border-color:#E8C15A;box-shadow:0 0 0 3px rgba(232,193,90,.18)}
    .fx-btn.ph{color:#7c8aa3;font-weight:700}
    .fx-btn .fx-ic{font-size:18px;color:#E8C15A;flex:none}
    .fx-btn .fx-txt{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.35}
    .fx-btn .fx-txt small{display:block;font-size:10.5px;color:#94a3b8;font-weight:700;letter-spacing:.03em}
    .fx-btn .fx-caret{font-size:20px;color:#94a3b8;flex:none;transition:transform .15s}
    .fx-sel.open .fx-caret{transform:rotate(180deg)}
    .fx-sel.dis .fx-btn{opacity:.5;cursor:not-allowed}
    .fx-pop{position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:9999;border-radius:14px;overflow:hidden;
        background:#0b1220;border:1px solid rgba(232,193,90,.35);box-shadow:0 18px 50px rgba(0,0,0,.6),0 0 0 1px rgba(0,0,0,.4);
        transform-origin:top;animation:fxPop .12s ease-out}
    @keyframes fxPop{from{opacity:0;transform:scaleY(.96) translateY(-4px)}to{opacity:1;transform:none}}
    .fx-search{display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid rgba(148,163,184,.15);background:#0f172a}
    .fx-search .material-icons{font-size:18px;color:#94a3b8}
    .fx-search input{flex:1;background:transparent;border:0;outline:none;color:#f1f5f9;font-size:13px;font-weight:700}
    .fx-list{max-height:min(360px,60vh);overflow-y:auto;padding:6px;scrollbar-width:thin;scrollbar-color:rgba(232,193,90,.4) transparent}
    .fx-grp{position:sticky;top:0;z-index:1;margin:6px 2px 2px;padding:5px 10px;border-radius:8px;font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;
        color:#0b1120;background:linear-gradient(90deg,#f5e3ae,#E8C15A);box-shadow:0 2px 8px rgba(232,193,90,.2)}
    .fx-opt{display:flex;align-items:center;gap:10px;padding:9px 10px;margin:2px 0;border-radius:10px;cursor:pointer;color:#e2e8f0;font-size:13px;font-weight:700;line-height:1.35;border:1px solid transparent}
    .fx-opt .fx-no{flex:none;min-width:52px;padding:2px 8px;border-radius:999px;text-align:center;font-size:11px;font-weight:900;color:#E8C15A;background:rgba(232,193,90,.12);border:1px solid rgba(232,193,90,.35);font-variant-numeric:tabular-nums}
    .fx-opt .fx-lb{flex:1;min-width:0}
    .fx-opt .fx-pen{flex:none;font-size:11px;font-weight:800;color:#fca5a5;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.35);padding:2px 8px;border-radius:999px;white-space:nowrap}
    .fx-opt .fx-pen.nowage{color:#fcd34d;background:rgba(245,158,11,.12);border-color:rgba(245,158,11,.4)}
    .fx-opt:hover,.fx-opt.act{background:rgba(232,193,90,.1);border-color:rgba(232,193,90,.3)}
    .fx-opt.sel{background:rgba(37,99,235,.22);border-color:rgba(96,165,250,.5);color:#fff}
    .fx-opt.sel .fx-lb::after{content:'check';font-family:'Material Icons';font-size:16px;color:#60a5fa;float:right;margin-left:8px}
    .fx-opt.ph{color:#7c8aa3;font-weight:700}
    .fx-empty{padding:16px;text-align:center;color:#64748b;font-size:12.5px;font-weight:700}
    html:not(.dark) .fx-btn{background:#fff;border-color:#cbd5e1;color:#0f172a;box-shadow:0 1px 2px rgba(0,0,0,.06)}
    html:not(.dark) .fx-pop,html:not(.dark) .fx-search{background:#fff;border-color:rgba(232,193,90,.6)}
    html:not(.dark) .fx-search input,html:not(.dark) .fx-opt{color:#0f172a}
    html:not(.dark) .fx-opt.sel{background:rgba(37,99,235,.12)}
    `;
    const st = document.createElement('style'); st.id = 'fx-select-css'; st.textContent = CSS; document.head.appendChild(st);

    const esc = t => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const PEN_RE = /\s*\(([^)]*(?:ปรับ|ค่าแรง|เลิกจ้าง|คืนเงิน|THB|บาท)[^)]*)\)\s*$/i;

    // แยกข้อความตัวเลือกให้เป็น เลขข้อ / ชื่อ / โทษ (สำหรับหัวข้อความผิด) — เลือกอื่นก็แค่โชว์ตรงๆ
    function parseLabel(text) {
        const m = String(text).match(/^\s*ข้อ\s*([\d.]+)\s*·\s*(.*)$/);
        let body = m ? m[2] : String(text), pen = '';
        const pm = body.match(PEN_RE);
        if (pm) { pen = pm[1].trim(); body = body.replace(PEN_RE, '').trim(); }
        return { no: m ? m[1] : '', body, pen };
    }

    function enhance(sel, opt = {}) {
        if (!sel || sel.__fx) return;
        const wrap = document.createElement('div'); wrap.className = 'fx-sel';
        // ย้ายคลาสความกว้าง (w-full / w-[45%] ...) จาก select มาไว้ที่ตัวครอบ ให้เลย์เอาต์เดิมไม่เปลี่ยน
        Array.from(sel.classList).filter(c => /^(w-|flex-|shrink|grow)/.test(c)).forEach(c => { wrap.classList.add(c); });
        sel.parentNode.insertBefore(wrap, sel); wrap.appendChild(sel);
        const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'fx-btn'; wrap.appendChild(btn);
        let pop = null, filter = '', act = -1;
        const fx = { sel, wrap, btn, opt, render, sync };
        sel.__fx = fx;

        function items() {
            const out = []; let grp = '';
            Array.from(sel.children).forEach(ch => {
                if (ch.tagName === 'OPTGROUP') { grp = ch.label.replace(/━/g, '').trim(); Array.from(ch.children).forEach(o => out.push({ o, grp })); }
                else out.push({ o: ch, grp: '' });
            });
            return out;
        }
        function sync() {
            const o = sel.options[sel.selectedIndex];
            const isPh = !sel.value;
            btn.classList.toggle('ph', isPh);
            wrap.classList.toggle('dis', sel.disabled);
            btn.disabled = sel.disabled;
            let txt = o ? o.textContent : '';
            let sub = '';
            if (!isPh && o && o.parentNode.tagName === 'OPTGROUP') sub = o.parentNode.label.replace(/━/g, '').trim();
            const p = parseLabel(txt);
            const main = p.no ? `ข้อ ${p.no} · ${p.body}${p.pen ? ` (${p.pen})` : ''}` : txt;
            btn.innerHTML = `<span class="material-icons fx-ic">${esc(opt.icon || 'list')}</span><span class="fx-txt">${esc(main)}${sub ? `<small>${esc(sub)}</small>` : ''}</span><span class="material-icons fx-caret">expand_more</span>`;
        }
        function close() { if (pop) { pop.remove(); pop = null; } wrap.classList.remove('open'); filter = ''; act = -1; }
        function choose(val) { sel.value = val; sel.dispatchEvent(new Event('change', { bubbles: true })); close(); sync(); btn.focus(); }
        function render() {
            if (!pop) return;
            const list = pop.querySelector('.fx-list');
            const all = items().filter(x => !filter || (x.o.textContent + ' ' + x.grp).toLowerCase().includes(filter.toLowerCase()));
            if (!all.length) { list.innerHTML = '<div class="fx-empty">ไม่พบรายการ</div>'; return; }
            let html = '', lastGrp = null; const rows = [];
            all.forEach(x => {
                if (x.grp && x.grp !== lastGrp) { html += `<div class="fx-grp">${esc(x.grp)}</div>`; lastGrp = x.grp; }
                const p = parseLabel(x.o.textContent);
                const isPh = !x.o.value;
                const i = rows.length; rows.push(x.o.value);
                html += `<div class="fx-opt ${isPh ? 'ph' : ''} ${x.o.value === sel.value && !isPh ? 'sel' : ''} ${i === act ? 'act' : ''}" data-i="${i}" data-v="${esc(x.o.value)}">`
                    + (p.no ? `<span class="fx-no">ข้อ ${esc(p.no)}</span>` : '')
                    + `<span class="fx-lb">${esc(p.body)}</span>`
                    + (p.pen ? `<span class="fx-pen ${/ค่าแรง|เลิกจ้าง/.test(p.pen) ? 'nowage' : ''}">${esc(p.pen)}</span>` : '')
                    + `</div>`;
            });
            list.innerHTML = html;
            list.__rows = rows;
            const a = list.querySelector('.fx-opt.act'); if (a) a.scrollIntoView({ block: 'nearest' });
        }
        function open() {
            if (sel.disabled || pop) return;
            document.querySelectorAll('.fx-sel.open').forEach(w => w !== wrap && w.querySelector('select').__fx.close());
            pop = document.createElement('div'); pop.className = 'fx-pop';
            const many = sel.options.length > 7;
            pop.innerHTML = (many ? `<div class="fx-search"><span class="material-icons">search</span><input placeholder="พิมพ์ค้นหา..." autocomplete="off"></div>` : '') + `<div class="fx-list"></div>`;
            wrap.appendChild(pop); wrap.classList.add('open');
            // เปิดขึ้นบนถ้าด้านล่างไม่พอ
            const r = wrap.getBoundingClientRect();
            if (window.innerHeight - r.bottom < 300 && r.top > 300) { pop.style.top = 'auto'; pop.style.bottom = 'calc(100% + 6px)'; pop.style.transformOrigin = 'bottom'; }
            const inp = pop.querySelector('input');
            if (inp) { inp.addEventListener('input', () => { filter = inp.value; act = -1; render(); }); setTimeout(() => inp.focus(), 0); }
            pop.addEventListener('mousedown', e => e.preventDefault());
            pop.addEventListener('click', e => { const o = e.target.closest('.fx-opt'); if (o) choose(o.dataset.v); });
            const cur = items().findIndex(x => x.o.value === sel.value && x.o.value); act = cur;
            render();
        }
        fx.close = close;
        btn.addEventListener('click', () => pop ? close() : open());
        wrap.addEventListener('keydown', e => {
            if (!pop) { if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } return; }
            const list = pop.querySelector('.fx-list'); const n = (list.__rows || []).length;
            if (e.key === 'Escape') { e.preventDefault(); close(); btn.focus(); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); act = Math.min(n - 1, act + 1); render(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); act = Math.max(0, act - 1); render(); }
            else if (e.key === 'Enter') { e.preventDefault(); if (act >= 0 && list.__rows) choose(list.__rows[act]); }
        });
        document.addEventListener('click', e => { if (pop && !wrap.contains(e.target)) close(); });
        sel.addEventListener('change', sync);
        new MutationObserver(() => { sync(); if (pop) render(); }).observe(sel, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
        // ค่าที่โค้ดตั้งตรงๆ (sel.value = '') ไม่ยิง event → เช็คเบาๆ เป็นระยะ
        let lastV = sel.value; setInterval(() => { if (sel.value !== lastV) { lastV = sel.value; sync(); } }, 400);
        sync();
    }

    window.enhanceFineSelects = function () {
        enhance(document.getElementById('fineCategorySelect'), { icon: 'category' });
        enhance(document.getElementById('fineRuleSelect'), { icon: 'gavel' });
        enhance(document.getElementById('fineNoteSelect'), { icon: 'sticky_note_2' });
        enhance(document.getElementById('finePenaltyType'), { icon: 'payments' });
    };
})();
