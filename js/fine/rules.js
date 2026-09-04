// ════════════════════════════════════════════════════════════════════
// 📦 fine/rules.js — ส่วนที่ 2/4 ของระบบใบปรับ (แยกจาก fine.js เดิม 1,782 บรรทัด)
// เนื้อหา: หมายเหตุสำเร็จรูปผูกกฎ, จัดการกฎ (Accordion), รูปภาพ + Ctrl+V
// ⚠️ ลำดับโหลด: fine/core → fine/rules → fine/records → fine/tools (ห้ามสลับ — ตัวแปร top-level แชร์ scope เดียวกัน)
// ════════════════════════════════════════════════════════════════════
// 🌟 1. การจัดการ หมายเหตุสำเร็จรูป (Notes) แบบผูกกับกฎ
// ===============================================
async function loadFineNotes() {
    try {
        const { data } = await window.getSettingCached('fine_notes_data');
        if (data && data.value) {
            let parsed = JSON.parse(data.value);
            // 🌟 Migration: ถ้าข้อมูลเดิมเป็นแค่ Array ของ String (ข้อมูลเก่า) ให้แปลงเป็น Object
            if (parsed.length > 0 && typeof parsed[0] === 'string') {
                globalFineNotes = parsed.map(text => ({ text: text, rule: 'ALL' }));
                await appDB.from('settings').upsert([{ key: 'fine_notes_data', value: JSON.stringify(globalFineNotes) }]);
            } else {
                globalFineNotes = parsed;
            }
        } else {
            // ค่าเริ่มต้นของใหม่
            globalFineNotes = defaultNotes.map(text => ({ text: text, rule: 'ALL' }));
            await appDB.from('settings').upsert([{ key: 'fine_notes_data', value: JSON.stringify(globalFineNotes) }]);
        }
        renderNotesDropdown();
    } catch(e) { 
        globalFineNotes = defaultNotes.map(text => ({ text: text, rule: 'ALL' }));
        renderNotesDropdown(); 
    }
}

// อัปเดต Dropdown เลือกกฎในหน้าตั้งค่าหมายเหตุ
function updateNewNoteRuleDropdown() {
    const select = document.getElementById('newNoteRuleSelect');
    if (!select) return;
    let html = '<option value="ALL" class="text-gray-500 font-bold">-- ใช้ได้กับทุกกฎ (ทั่วไป) --</option>';
    globalFineRules.forEach(r => {
        // 🌟 เพิ่มระบบแยกสีให้ Dropdown
        let colorStyle = '';
        if (r.includes('[ออนไลน์]')) colorStyle = 'color: #3b82f6; font-weight: bold; background-color: #1e293b;'; // สีฟ้า
        else if (r.includes('[WFH]')) colorStyle = 'color: #10b981; font-weight: bold; background-color: #1e293b;'; // สีเขียว
        else if (r.includes('[ออฟฟิศ]')) colorStyle = 'color: #f59e0b; font-weight: bold; background-color: #1e293b;'; // สีส้ม
        else colorStyle = 'color: #cbd5e1; background-color: #1e293b;';

        html += `<option value="${r}" style="${colorStyle}">${r}</option>`;
    });
    select.innerHTML = html;
}

// 🌟 เรนเดอร์ Dropdown ในหน้า "ออกใบปรับ" และ แยกคอลัมน์การ์ดหมายเหตุ (อัปเดตใหม่ 3 คอลัมน์)
window.renderNotesDropdown = function(selectedRule = '') {
    const noteSelect = document.getElementById('fineNoteSelect');
    if (noteSelect) {
        let filteredNotes = globalFineNotes;
        
        if (selectedRule) {
            filteredNotes = globalFineNotes.filter(n => n.rule === 'ALL' || n.rule === selectedRule);
        } else {
            filteredNotes = globalFineNotes.filter(n => n.rule === 'ALL');
        }

        noteSelect.innerHTML = '<option value="">-- เลือกหมายเหตุสำเร็จรูป (ไม่บังคับ) --</option>' + 
            filteredNotes.map(n => `<option value="${n.text}">${n.text}</option>`).join('');
    }

    const listDiv = document.getElementById('fineNotesListFull');
    if (listDiv) {
        if (globalFineNotes.length === 0) {
            listDiv.className = ""; // ล้างคลาสกริดออก
            listDiv.innerHTML = `<div class="col-span-full text-center py-4 text-gray-500 text-sm">ยังไม่มีหมายเหตุสำเร็จรูปในระบบ</div>`;
            return;
        }

        // 🌟 1. แยกกลุ่มข้อมูลตามหมวดหมู่
        const groups = { 'ALL': [], 'ออนไลน์': [], 'WFH': [], 'ออฟฟิศ': [] };
        
        globalFineNotes.forEach((n, idx) => {
            if (n.rule.includes('[ออนไลน์]')) groups['ออนไลน์'].push({ n, idx });
            else if (n.rule.includes('[WFH]')) groups['WFH'].push({ n, idx });
            else if (n.rule.includes('[ออฟฟิศ]')) groups['ออฟฟิศ'].push({ n, idx });
            else groups['ALL'].push({ n, idx });
        });

        // 🌟 2. ฟังก์ชันช่วยสร้าง HTML ของการ์ด
        const buildCards = (items, ruleColorClass) => {
            return items.map(item => {
                let displayRule = item.n.rule === 'ALL' ? 'ใช้ได้กับทุกกฎ (ทั่วไป)' : item.n.rule;
                return window.renderTemplate('tpl-fine-note-item', {
                    noteText: item.n.text,
                    ruleText: displayRule,
                    ruleColor: ruleColorClass,
                    index: item.idx
                });
            }).join('');
        };

        // 🌟 3. สร้าง Layout ใหม่: ทั่วไปอยู่ด้านบนสุดยาวๆ, والبقيةอยู่เป็น 3 คอลัมน์ด้านล่าง
        listDiv.className = "flex flex-col gap-6 w-full"; // เปลี่ยน Parent เป็น Flex Column
        
        let html = '';

        // --- ส่วนที่ 1: หมวดหมู่ทั่วไป (โชว์ถ้ามีข้อมูล) ---
        if (groups['ALL'].length > 0) {
            html += `
                <div class="w-full mb-2">
                    <div class="flex items-center gap-1.5 text-sm font-black text-gray-400 border-b border-slate-700 pb-2 mb-3">
                        <span class="material-icons text-[18px]">public</span> ทั่วไป (ใช้ได้กับทุกกฎ)
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        ${buildCards(groups['ALL'], 'text-gray-500 dark:text-gray-400')}
                    </div>
                </div>
            `;
        }

        // --- ส่วนที่ 2: หมวดหมู่หลัก (แบ่ง 3 คอลัมน์พอดี) ---
        html += `<div class="grid grid-cols-1 md:grid-cols-3 gap-6 items-start w-full">`;
        
        // คอลัมน์ออนไลน์
        html += `
            <div class="flex flex-col gap-3">
                <div class="flex items-center gap-1.5 text-sm font-black text-blue-400 border-b border-slate-700 pb-2 mb-1">
                    <span class="material-icons text-[18px]">language</span> ออนไลน์
                </div>
                ${buildCards(groups['ออนไลน์'], 'text-blue-500 dark:text-blue-400')}
            </div>
        `;

        // คอลัมน์ WFH
        html += `
            <div class="flex flex-col gap-3">
                <div class="flex items-center gap-1.5 text-sm font-black text-emerald-400 border-b border-slate-700 pb-2 mb-1">
                    <span class="material-icons text-[18px]">home_work</span> WFH
                </div>
                ${buildCards(groups['WFH'], 'text-emerald-600 dark:text-emerald-400')}
            </div>
        `;

        // คอลัมน์ ออฟฟิศ
        html += `
            <div class="flex flex-col gap-3">
                <div class="flex items-center gap-1.5 text-sm font-black text-orange-400 border-b border-slate-700 pb-2 mb-1">
                    <span class="material-icons text-[18px]">domain</span> ออฟฟิศ
                </div>
                ${buildCards(groups['ออฟฟิศ'], 'text-orange-500 dark:text-orange-400')}
            </div>
        `;

        html += `</div>`; // ปิดกริด 3 คอลัมน์

        listDiv.innerHTML = html;
    }
}

window.addFineNotePage = async function() {
    const ruleSelect = document.getElementById('newNoteRuleSelect');
    const input = document.getElementById('newNoteInputPage');
    if(!input || !ruleSelect) return;
    
    const textVal = input.value.trim();
    const ruleVal = ruleSelect.value;
    
    if(!textVal) return Swal.fire('ข้อมูลว่างเปล่า', 'กรุณาพิมพ์ข้อความหมายเหตุก่อนครับ', 'warning');
    
    Swal.fire({title: 'กำลังเพิ่ม...', didOpen: () => Swal.showLoading()});
    globalFineNotes.push({ text: textVal, rule: ruleVal }); 
    input.value = '';
    
    await appDB.from('settings').upsert([{ key: 'fine_notes_data', value: JSON.stringify(globalFineNotes) }]);
    renderNotesDropdown();
    Swal.fire({icon: 'success', title: 'เพิ่มสำเร็จ', timer: 1000, showConfirmButton: false});
}

window.editFineNotePage = async function(idx) {
    const currentNote = globalFineNotes[idx];
    
    // สร้าง Dropdown กฎสำหรับ Popup แก้ไข
    let ruleOptionsHtml = '<option value="ALL" style="color: #6b7280; font-weight: bold; background-color: #1e293b;">-- ใช้ได้กับทุกกฎ (ทั่วไป) --</option>';
    globalFineRules.forEach(r => {
        const isSelected = r === currentNote.rule ? 'selected' : '';
        
        // 🌟 เพิ่มระบบแยกสีให้ Dropdown ใน Popup
        let colorStyle = '';
        if (r.includes('[ออนไลน์]')) colorStyle = 'color: #3b82f6; font-weight: bold; background-color: #1e293b;'; // สีฟ้า
        else if (r.includes('[WFH]')) colorStyle = 'color: #10b981; font-weight: bold; background-color: #1e293b;'; // สีเขียว
        else if (r.includes('[ออฟฟิศ]')) colorStyle = 'color: #f59e0b; font-weight: bold; background-color: #1e293b;'; // สีส้ม
        else colorStyle = 'color: #cbd5e1; background-color: #1e293b;';

        ruleOptionsHtml += `<option value="${r}" ${isSelected} style="${colorStyle}">${r}</option>`;
    });
    
    const { isConfirmed, value: parsedData } = await Swal.fire({
        title: '<span class="text-amber-500">แก้ไขข้อความหมายเหตุ</span>',
        html: `
            <div class="text-left space-y-3 mt-4">
                <div>
                    <label class="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">กฎที่ต้องการผูก</label>
                    <select id="swalEditNoteRule" class="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white font-bold outline-none focus:border-yellow-500 shadow-sm cursor-pointer">${ruleOptionsHtml}</select>
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">ข้อความหมายเหตุ</label>
                    <input type="text" id="swalEditNoteText" value="${currentNote.text}" class="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white font-bold outline-none focus:border-yellow-500 shadow-sm">
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
            const rule = document.getElementById('swalEditNoteRule').value;
            const text = document.getElementById('swalEditNoteText').value.trim();
            if (!text) { Swal.showValidationMessage('กรุณากรอกข้อความ!'); return false; }
            return { rule, text };
        }
    });

    if (isConfirmed && parsedData) {
        if (parsedData.text !== currentNote.text || parsedData.rule !== currentNote.rule) {
            Swal.fire({title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading()});
            globalFineNotes[idx] = { text: parsedData.text, rule: parsedData.rule };
            await appDB.from('settings').upsert([{ key: 'fine_notes_data', value: JSON.stringify(globalFineNotes) }]);
            renderNotesDropdown();
            Swal.fire({icon: 'success', title: 'แก้ไขสำเร็จ', timer: 1000, showConfirmButton: false});
        }
    }
};

window.removeFineNotePage = async function(idx) {
    const res = await Swal.fire({
        title: 'ลบหมายเหตุข้อนี้?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonText: 'ยกเลิก',
        confirmButtonText: 'ลบทิ้ง'
    });

    if (res.isConfirmed) {
        Swal.fire({title: 'กำลังลบ...', didOpen: () => Swal.showLoading()});
        globalFineNotes.splice(idx, 1);
        await appDB.from('settings').upsert([{ key: 'fine_notes_data', value: JSON.stringify(globalFineNotes) }]);
        renderNotesDropdown();
        Swal.fire({icon: 'success', title: 'ลบสำเร็จ', timer: 1000, showConfirmButton: false});
    }
}

// ===============================================
// 🌟 2. การจัดการกฎ (Accordion UI + Dropdown Auto Fill + Amount Type)
// ===============================================
async function loadFineRules() {
    try {
        const { data } = await window.getSettingCached('fine_rules_data');
        if (data && data.value) {
            globalFineRules = JSON.parse(data.value);
            if (globalFineRules.length < 5) {
                globalFineRules = okvipRules;
                await appDB.from('settings').upsert([{ key: 'fine_rules_data', value: JSON.stringify(globalFineRules) }]);
            }
        } else {
            globalFineRules = okvipRules;
            await appDB.from('settings').upsert([{ key: 'fine_rules_data', value: JSON.stringify(globalFineRules) }]);
        }
        renderRulesDropdown();
        updateNewNoteRuleDropdown(); // 🌟 อัปเดต Dropdown ในหน้าหมายเหตุด้วย
    } catch(e) { 
        globalFineRules = okvipRules; 
        renderRulesDropdown(); 
        updateNewNoteRuleDropdown();
    }
}

window.toggleFineAmountInput = function() {
    const typeSelect = document.getElementById('finePenaltyType');
    const amtInput = document.getElementById('fineAmount');
    if(!typeSelect || !amtInput) return;

    if (typeSelect.value === 'nowage') {
        amtInput.value = '';
        amtInput.disabled = true;
        amtInput.classList.add('opacity-50', 'cursor-not-allowed', 'bg-gray-200', 'dark:bg-slate-800');
    } else {
        amtInput.disabled = false;
        amtInput.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-gray-200', 'dark:bg-slate-800');
    }
};

window.filterRulesByCategory = function() {
    const catSelect = document.getElementById('fineCategorySelect');
    const ruleSelect = document.getElementById('fineRuleSelect');
    const amountInput = document.getElementById('fineAmount');
    
    if(amountInput) amountInput.value = '';

    if (!catSelect || !ruleSelect) return;
    
    const cat = catSelect.value;
    if (!cat) {
        ruleSelect.innerHTML = '<option value="">-- เลือกหมวดหมู่ทางซ้ายก่อน --</option>';
        ruleSelect.disabled = true;
        renderNotesDropdown(''); // ล้างหมายเหตุ
        return;
    }

    ruleSelect.disabled = false;
    let filteredRules = [];
    
    globalFineRules.forEach(r => {
        if (cat === 'ออนไลน์' && r.includes('[ออนไลน์]')) filteredRules.push(r);
        else if (cat === 'WFH' && r.includes('[WFH]')) filteredRules.push(r);
        else if (cat === 'ออฟฟิศ' && r.includes('[ออฟฟิศ]')) filteredRules.push(r);
        else if (cat === 'อื่นๆ' && !r.includes('[ออนไลน์]') && !r.includes('[WFH]') && !r.includes('[ออฟฟิศ]')) filteredRules.push(r);
    });

    if (filteredRules.length === 0) {
        ruleSelect.innerHTML = '<option value="">-- ไม่มีกฎในหมวดนี้ --</option>';
        ruleSelect.disabled = true;
        renderNotesDropdown(''); // ล้างหมายเหตุ
        return;
    }

    ruleSelect.innerHTML = '<option value="">-- เลือกหัวข้อที่ผิด --</option>' + filteredRules.map(r => `<option value="${r}">${r}</option>`).join('');

    ruleSelect.onchange = function() {
        const typeSelect = document.getElementById('finePenaltyType');
        const amtInput = document.getElementById('fineAmount');
        
        // 🌟 เมื่อเปลี่ยนกฎ ให้เรียกอัปเดตหมายเหตุ
        renderNotesDropdown(this.value);

        if (!typeSelect || !amtInput) return;

        if (this.value) {
            if (this.value.includes('ไม่ได้ค่าแรง')) {
                typeSelect.value = 'nowage';
                window.toggleFineAmountInput();
            } else {
                typeSelect.value = 'money';
                window.toggleFineAmountInput();
                
                const match = this.value.match(/ปรับ\s*([\d,]+)/);
                if (match && match[1].replace(/,/g, '').length >= 3) {
                    amtInput.value = parseInt(match[1].replace(/,/g, ''), 10);
                } else {
                    amtInput.value = ''; 
                }
            }
        } else {
            typeSelect.value = 'money';
            amtInput.value = '';
            window.toggleFineAmountInput();
        }
    };
}

window.toggleRuleGroup = function(groupId, btn) {
    const groupDiv = document.getElementById(groupId);
    if(!groupDiv) return;
    const icon = btn.querySelector('.material-icons:last-child');
    if (groupDiv.classList.contains('hidden')) {
        groupDiv.classList.remove('hidden');
        groupDiv.classList.add('flex');
        if(icon) icon.style.transform = 'rotate(0deg)';
    } else {
        groupDiv.classList.add('hidden');
        groupDiv.classList.remove('flex');
        if(icon) icon.style.transform = 'rotate(-90deg)';
    }
}

function renderRulesDropdown() {
    const catSelect = document.getElementById('fineCategorySelect');
    if (catSelect) {
        catSelect.value = "";
        window.filterRulesByCategory(); 
    }

    const listDivFull = document.getElementById('fineRulesListFull');
    const countSpan = document.getElementById('ruleCount');

    if (listDivFull) {
        if(countSpan) countSpan.innerText = globalFineRules.length;
        
        if (globalFineRules.length === 0) {
            listDivFull.innerHTML = `<div class="text-center py-10 text-gray-400 font-bold bg-slate-100 dark:bg-slate-900 rounded-xl">ไม่มีหัวข้อกฎหมายในระบบ</div>`;
            return;
        }

        const groups = { 'ออนไลน์': [], 'WFH': [], 'ออฟฟิศ': [], 'อื่นๆ': [] };
        globalFineRules.forEach((r, idx) => {
            if (r.includes('[ออนไลน์]')) groups['ออนไลน์'].push({ text: r, index: idx });
            else if (r.includes('[WFH]')) groups['WFH'].push({ text: r, index: idx });
            else if (r.includes('[ออฟฟิศ]')) groups['ออฟฟิศ'].push({ text: r, index: idx });
            else groups['อื่นๆ'].push({ text: r, index: idx });
        });

        let html = '';
        const buildGroupHtml = (title, items, icon, colorClass) => {
            if (items.length === 0) return '';
            const groupId = 'group_' + title;
            
            let itemsHtml = items.map((item, i) => {
                return window.renderTemplate('tpl-fine-rule-item', {
                    badgeClass: colorClass.badge,
                    indexDisplay: i + 1,
                    text: item.text,
                    rawIndex: item.index
                });
            }).join('');

            return window.renderTemplate('tpl-fine-rule-group', {
                groupId: groupId,
                headerClass: colorClass.header,
                icon: icon,
                title: title,
                count: items.length,
                itemsHtml: itemsHtml
            });
        };

        html += buildGroupHtml('ออนไลน์', groups['ออนไลน์'], 'language', { header: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/60', badge: 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400' });
        html += buildGroupHtml('WFH', groups['WFH'], 'home_work', { header: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/60', badge: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400' });
        html += buildGroupHtml('ออฟฟิศ', groups['ออฟฟิศ'], 'domain', { header: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/60', badge: 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400' });
        html += buildGroupHtml('อื่นๆ', groups['อื่นๆ'], 'list', { header: 'bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-700', badge: 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-400' });

        listDivFull.innerHTML = html;
    }
}

window.addFineRulePage = async function() {
    const catInput = document.getElementById('newRuleCategory');
    const textInput = document.getElementById('newRuleInputPage');
    const typeSelect = document.getElementById('newRulePenaltyType'); // เพิ่มมาใหม่
    const amtInput = document.getElementById('newRuleAmount');

    const category = catInput ? catInput.value : 'อื่นๆ';
    const textVal = textInput ? textInput.value.trim() : '';
    const penaltyType = typeSelect ? typeSelect.value : 'money';
    const amtVal = amtInput ? amtInput.value.trim() : '';

    if(!textVal) return Swal.fire('ข้อมูลว่างเปล่า', 'กรุณาพิมพ์รายละเอียดความผิดก่อนครับ', 'warning');
    
    let finalRuleString = `[${category}] ${textVal}`;

    // 🌟 ดักจับประเภทบทลงโทษ
    if (penaltyType === 'nowage') {
        finalRuleString += ` (ไม่ได้ค่าแรง)`;
    } else if (amtVal && parseInt(amtVal) > 0) {
        const formattedAmt = parseInt(amtVal).toLocaleString('en-US');
        finalRuleString += ` (ปรับ ${formattedAmt})`;
    }
    
    Swal.fire({title: 'กำลังเพิ่มกฎ...', didOpen: () => Swal.showLoading()});
    globalFineRules.push(finalRuleString); 
    
    // เคลียร์ค่าฟอร์มให้กลับเป็นเหมือนเดิม
    if(textInput) textInput.value = '';
    if(amtInput) amtInput.value = '';
    if(typeSelect) {
        typeSelect.value = 'money';
        amtInput.disabled = false;
    }
    
    await appDB.from('settings').upsert([{ key: 'fine_rules_data', value: JSON.stringify(globalFineRules) }]);
    renderRulesDropdown();
    updateNewNoteRuleDropdown();
    Swal.fire({icon: 'success', title: 'เพิ่มสำเร็จ', timer: 1000, showConfirmButton: false});
}

window.editFineRulePage = async function(idx) {
    const currentRule = globalFineRules[idx];
    
    let currentCategory = 'อื่นๆ';
    let currentDetail = currentRule;
    let currentAmount = '';
    let isNoWage = false; // 🌟 เพิ่มตัวแปรเช็ค

    const catMatch = currentRule.match(/^\[(.*?)\]\s*/);
    if (catMatch) {
        currentCategory = catMatch[1].trim(); 
        currentDetail = currentDetail.replace(catMatch[0], ''); 
    }

    // 🌟 ตรวจสอบว่ากฎเก่าระบุว่า "ไม่ได้ค่าแรง" ไว้หรือไม่
    if (currentDetail.includes('(ไม่ได้ค่าแรง)')) {
        isNoWage = true;
        currentDetail = currentDetail.replace(/\s*\(ไม่ได้ค่าแรง\)/, '');
    } else {
        const amtMatch = currentDetail.match(/\s*\(ปรับ\s*([\d,]+)\)$/);
        if (amtMatch) {
            currentAmount = amtMatch[1].replace(/,/g, '');
            currentDetail = currentDetail.replace(amtMatch[0], ''); 
        }
    }
    
    const htmlForm = window.renderTemplate('tpl-fine-edit-rule-form', {
        selOnline: currentCategory === 'ออนไลน์' ? 'selected="selected"' : '',
        selWFH: currentCategory === 'WFH' ? 'selected="selected"' : '',
        selOffice: currentCategory === 'ออฟฟิศ' ? 'selected="selected"' : '',
        selOther: currentCategory === 'อื่นๆ' ? 'selected="selected"' : '',
        selMoney: !isNoWage ? 'selected="selected"' : '', // 🌟 ดันค่าลง Popup
        selNoWage: isNoWage ? 'selected="selected"' : '', // 🌟 ดันค่าลง Popup
        amtDisabled: isNoWage ? 'disabled' : '',          // 🌟 ดันค่าลง Popup
        currentDetail: currentDetail,
        currentAmount: currentAmount
    });

    const { isConfirmed, value: parsedData } = await Swal.fire({
        title: '<div class="text-xl font-black text-amber-500 flex items-center justify-center gap-2"><span class="material-icons">edit</span> แก้ไขหัวข้อกฎ</div>',
        html: htmlForm,
        showCancelButton: true,
        confirmButtonText: 'บันทึกการแก้ไข',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#f59e0b',
        cancelButtonColor: '#64748b',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl border border-slate-600 shadow-2xl' },
        
        didOpen: () => {
            const catSelect = document.getElementById('editRuleCategory');
            if (catSelect) {
                catSelect.value = currentCategory;
            }
        },

        preConfirm: () => {
            const cat = document.getElementById('editRuleCategory').value;
            const detail = document.getElementById('editRuleDetail').value.trim();
            const penType = document.getElementById('editRulePenaltyType').value;
            const amt = document.getElementById('editRuleAmount').value.trim();
            if (!detail) {
                Swal.showValidationMessage('กรุณากรอกรายละเอียดความผิด!');
                return false;
            }
            return { cat, detail, penType, amt };
        }
    });

    if (isConfirmed && parsedData) {
        let finalRuleString = `[${parsedData.cat}] ${parsedData.detail}`;
        
        // 🌟 ประกอบสตริงกฎใหม่ให้ถูกต้อง
        if (parsedData.penType === 'nowage') {
            finalRuleString += ` (ไม่ได้ค่าแรง)`;
        } else if (parsedData.amt && parseInt(parsedData.amt) > 0) {
            const formattedAmt = parseInt(parsedData.amt).toLocaleString('en-US');
            finalRuleString += ` (ปรับ ${formattedAmt})`;
        }

        if (finalRuleString !== currentRule) {
            Swal.fire({title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading()});
            globalFineRules[idx] = finalRuleString;
            await appDB.from('settings').upsert([{ key: 'fine_rules_data', value: JSON.stringify(globalFineRules) }]);
            renderRulesDropdown(); 
            updateNewNoteRuleDropdown();
            Swal.fire({icon: 'success', title: 'แก้ไขสำเร็จ', timer: 1000, showConfirmButton: false});
        }
    }
};

window.removeFineRulePage = async function(idx) {
    const res = await Swal.fire({
        title: 'ลบกฎข้อนี้?',
        text: `คุณต้องการลบ "${globalFineRules[idx]}" ออกจากระบบใช่หรือไม่?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'ลบทิ้ง'
    });

    if (res.isConfirmed) {
        Swal.fire({title: 'กำลังลบ...', didOpen: () => Swal.showLoading()});
        globalFineRules.splice(idx, 1);
        await appDB.from('settings').upsert([{ key: 'fine_rules_data', value: JSON.stringify(globalFineRules) }]);
        renderRulesDropdown();
        Swal.fire({icon: 'success', title: 'ลบสำเร็จ', timer: 1000, showConfirmButton: false});
    }
}

window.restoreOKVIPRules = async function() {
    const res = await Swal.fire({
        title: 'คืนค่าเริ่มต้น?',
        text: `คุณต้องการโหลดกฎตั้งต้นของ "OKVIP" ชุดใหม่เข้ามาทับกฎเดิมใช่หรือไม่? (กฎที่คุณสร้างเองจะหายไปทั้งหมด)`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#f59e0b',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'ใช่, คืนค่าเลย'
    });

    if (res.isConfirmed) {
        Swal.fire({title: 'กำลังดึงข้อมูล OKVIP...', didOpen: () => Swal.showLoading()});
        globalFineRules = [...okvipRules];
        await appDB.from('settings').upsert([{ key: 'fine_rules_data', value: JSON.stringify(globalFineRules) }]);
        renderRulesDropdown();
        Swal.fire({icon: 'success', title: 'คืนค่าสำเร็จ!', text: 'ระบบอัปเดตเป็นกฎของ OKVIP ให้เรียบร้อยครับ', timer: 2000, showConfirmButton: false});
    }
}

// -----------------------------------------
// จัดการรูปภาพ & ระบบ Ctrl+V
// -----------------------------------------
window.previewFineImg = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const imgPreview = document.getElementById('fineImgPreview');
            const previewBox = document.getElementById('fineImgPreviewBox');
            const pasteArea = document.getElementById('finePasteArea');
            if(imgPreview) imgPreview.src = e.target.result;
            if(previewBox) previewBox.classList.remove('hidden');
            if(pasteArea) pasteArea.classList.add('hidden');
        };
        reader.readAsDataURL(input.files[0]);
    }
};

window.clearFineImg = function(e) {
    if(e) e.preventDefault(); 
    const fileInput = document.getElementById('fineImageInput');
    const imgPreview = document.getElementById('fineImgPreview');
    const previewBox = document.getElementById('fineImgPreviewBox');
    const pasteArea = document.getElementById('finePasteArea');
    
    if(fileInput) fileInput.value = '';
    if(imgPreview) imgPreview.src = '';
    if(previewBox) previewBox.classList.add('hidden');
    if(pasteArea) pasteArea.classList.remove('hidden');
};

window.viewFineImage = function(url) {
    const expImg = document.getElementById('fineExpandedImg');
    const modal = document.getElementById('fineImageModal');
    if(expImg) expImg.src = url;
    if(modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

document.addEventListener('paste', function(e) {
    const fileInput = document.getElementById('fineImageInput');
    const fineApp = document.getElementById('fineContent_issue');
    
    if (!fileInput || !fineApp || fineApp.classList.contains('hidden')) return;

    let items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let index in items) {
        let item = items[index];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
            e.preventDefault();
            let blob = item.getAsFile();
            const file = new File([blob], "pasted_image.png", { type: item.type });
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            fileInput.files = dataTransfer.files;
            window.previewFineImg(fileInput); 
            break; 
        }
    }
});

// -----------------------------------------