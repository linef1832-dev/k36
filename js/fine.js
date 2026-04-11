// ==========================================
// 🚨 ระบบจัดการใบปรับ (Fine System) V6 (Strict HTML/JS Separation)
// ==========================================
let globalFines = [];
let globalFineRules = [];

const okvipRules = [
    "[ออนไลน์] เช็คชื่อสายเกิน 10 นาที (ปรับ 100) / เกิน 1 ชม. (ไม่ได้ค่าแรง)",
    "[ออนไลน์] ไม่ได้เช็คชื่อ 2 ครั้ง (ขาดงาน ไม่ได้ค่าแรง 2 วัน)",
    "[ออนไลน์] ไม่รับสาย OA สุ่มโทรติดต่อกัน 3 ครั้ง (ไม่ได้ค่าแรง)",
    "[ออนไลน์] รูปเช็คชื่อไม่ได้มาตรฐาน / ไม่เห็นจอ / ข้อมือ / มืด (ปรับ 100)",
    "[ออนไลน์] ไม่ปฏิบัติตามคำสั่ง / ทำงานด้วยอารมณ์ (ปรับ 300)",
    "[ออนไลน์] ไม่ตั้งใจทำงาน / พูดจาไม่สุภาพ (ปรับ 150)",
    "[ออนไลน์] ทำงานล่าช้า / ไม่ร่วมมือระหว่างแผนก (ปรับ 150)",
    "[ออนไลน์] ไม่ทำงานตามกระบวนการจนเกิดความเสียหาย (ปรับ 150)",
    "[ออนไลน์] ทำลายผลประโยชน์บริษัท (ปรับ 500 / ร้ายแรงเลิกจ้าง)",
    "[ออนไลน์] ปิดบังข้อมูล / ให้ข้อมูลเท็จ / ปกป้องคนผิด (ปรับ 500)",
    "[ออนไลน์] รับงานซ้อน / ใช้เรซูเม่ปลอม / ใช้คอมเครื่องเดียวกัน (เลิกจ้าง)",
    "[ออนไลน์] ขโมยข้อมูล / ปลอมแปลงข้อมูล / สมัครบัญชีเว็บตัวเอง (ปรับ 2,500 + คืนเงิน)",

    "[WFH] มาสาย / กลับก่อนเวลา 10-30 นาที (ปรับ 300) / เกิน 30 นาที (ไม่ได้ค่าแรง)",
    "[WFH] รูปเช็คชื่อไม่ได้มาตรฐาน (ปรับ 300)",
    "[WFH] ไม่อยู่หน้างาน / ไม่รับสาย 3 ครั้ง (หักค่าจ้าง 1 วัน)",
    "[WFH] ให้คนอื่นทำแทน / ทำงานซ้อน 2 งาน (เลิกจ้าง)",
    "[WFH] ขาดงานไม่แจ้ง / ติดต่อไม่ได้เกิน 24 ชม. (หัก 3 เท่า / เลิกจ้าง)",
    "[WFH] เล่นเกม / ดูวิดีโอ / ช้อปปิ้ง เวลางาน (ปรับ 300)",
    "[WFH] ลบประวัติแชทโดยไม่ได้รับอนุญาต (ปรับ 1,000)",
    "[WFH] ไม่เชื่อฟัง / ทำงานตามอารมณ์ / ก้าวร้าว (ปรับ 1,000)",
    "[WFH] รับงานนอก / ทำพฤติกรรมกระทบความสามัคคี (ปรับ 1,000)",
    "[WFH] กินข้าวเวลางาน / ดื่มแอลกอฮอล์ (ปรับ 300)",
    "[WFH] ไม่ตั้งใจทำงาน / พฤติกรรมไม่เหมาะสม (ปรับ 300)",
    "[WFH] ทำงานล่าช้า / ประสานงานข้ามแผนกไม่ดี (ปรับ 500)",
    "[WFH] ไม่ทำตามขั้นตอนจนเกิดความเสียหาย (ปรับ 300)",
    "[WFH] ปกปิดข้อมูล / รายงานเท็จ / ปกปิดความผิด (ปรับ 300)",
    "[WFH] รับไฟล์แปลกปลอม / ขาดความระมัดระวังด้านความปลอดภัย (ปรับ 500)",
    "[WFH] ยุยงสร้างความขัดแย้ง / ด่าทอ / คุกคาม (ปรับ 1,000)",
    "[WFH] พูดจาไม่สุภาพ / โจมตีบุคคล (ปรับ 300)",
    "[WFH] ขโมย / ยักยอกทรัพย์ / ปลอมแปลงข้อมูล (ปรับ 5,000 + คืนเงิน)",

    "[ออฟฟิศ] มาสาย / กลับก่อน / ไม่อยู่หน้างาน (ปรับ 100-300 / คัดกฎ / ไม่ได้ค่าแรง)",
    "[ออฟฟิศ] ไม่สแกนบัตรเข้า-ออกงาน (ปรับ 100)",
    "[ออฟฟิศ] ขาดงานไม่แจ้ง (ปรับ 3 เท่าของค่าแรง)",
    "[ออฟฟิศ] พกโทรศัพท์ / อุปกรณ์ส่วนตัวเข้าพื้นที่ทำงาน (ปรับ 1,000)",
    "[ออฟฟิศ] ลบประวัติแชท / ใช้อุปกรณ์บริษัททำเรื่องส่วนตัว (ปรับ 1,000)",
    "[ออฟฟิศ] รับงานนอก / ทำพฤติกรรมกระทบความสามัคคี (ปรับ 1,000)",
    "[ออฟฟิศ] กินอาหารในสำนักงาน / ดื่มแอลกอฮอล์ (ปรับ 300)",
    "[ออฟฟิศ] ไม่ตั้งใจทำงาน / ปกปิดข้อมูล / ให้ข้อมูลเท็จ (ปรับ 300)",
    "[ออฟฟิศ] รับไฟล์แปลกปลอม / ขาดความระมัดระวังด้านความปลอดภัย (ปรับ 500)",
    "[ออฟฟิศ] ก่อเรื่อง / เสียงดัง / ดื่มแอลกอฮอล์ในหอพัก (ปรับ 300-500)",
    "[ออฟฟิศ] เลี้ยงสัตว์ / ทิ้งขยะไม่เป็นที่ / สูบบุหรี่ผิดที่ (ปรับ 300)",
    "[ออฟฟิศ] ชายเข้าห้องหญิง (ปรับ 500) / หญิงเข้าห้องผู้อื่นโดยไม่ขอ (ปรับ 300)",
    "[ออฟฟิศ] ทำกิจกรรมรบกวนผู้อื่นหลังตี 3 / ออกนอกหอพักตี 3-6 (ปรับ 300)",
    "[ออฟฟิศ] เล่นการพนัน / ยาเสพติด / ไสยศาสตร์ (ปรับ 5,000 + เลิกจ้าง)",
    "[ออฟฟิศ] พาคนนอกเข้าพื้นที่สำนักงานหรือหอพัก (ปรับ 500)",
    "[ออฟฟิศ] แอบใช้เครื่องใช้ไฟฟ้ากำลังสูง / ทำอาหารในหอพัก (ปรับ 500)",
    "[ออฟฟิศ] ยุยงสร้างความขัดแย้ง / ด่าทอ / คุกคาม (ปรับ 1,000 + คัดกฎ)",
    "[ออฟฟิศ] ไม่ปิดน้ำไฟ / ทำลายทรัพย์สินบริษัท (ปรับ 300 + ชดใช้ราคาจริง)",
    "[ออฟฟิศ] ขโมย / ปลอมแปลงข้อมูล / ยักยอกทรัพย์ (ปรับ 5,000 + คืนเงิน)"
];

window.initFineApp = async function() {
    const hasManagePerm = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('fine_manage') : false;
    const isAdmin = hasManagePerm || (currentUser.role === 'manager' || currentUser.role === 'admin');

    if (isAdmin && typeof fetchUsers === 'function' && (!GLOBAL_USER_LIST || GLOBAL_USER_LIST.length === 0)) {
        await fetchUsers();
    }

    const adminControls = document.getElementById('fineAdminControls');
    const tableContainer = document.getElementById('fineTableContainer');
    const tabsContainer = document.getElementById('fineTabsContainer');
    
    if (isAdmin) {
        adminControls.classList.remove('hidden');
        tabsContainer.classList.remove('hidden'); 
        tableContainer.classList.remove('lg:col-span-12');
        tableContainer.classList.add('lg:col-span-8');
        document.getElementById('fineSubtitle').innerText = "ออกใบปรับและดูประวัติทั้งหมด";
        document.getElementById('tableFineTitle').innerHTML = '<span class="material-icons text-blue-500">list_alt</span> รายการใบปรับทั้งหมดในระบบ';
        document.getElementById('thEmpName').style.display = '';
        document.getElementById('thAction').style.display = '';
        
        populateEmpSelect(); 
    } else {
        adminControls.classList.add('hidden');
        tabsContainer.classList.add('hidden'); 
        tableContainer.classList.remove('lg:col-span-8');
        tableContainer.classList.add('lg:col-span-12');
        document.getElementById('fineSubtitle').innerText = "ดูประวัติใบปรับของคุณ";
        document.getElementById('tableFineTitle').innerHTML = '<span class="material-icons text-blue-500">list_alt</span> ใบปรับของฉัน';
        document.getElementById('thEmpName').style.display = 'none';
        document.getElementById('thAction').style.display = 'none';
    }

    switchFineTab('issue');
    await loadFineRules();
    await fetchFinesData(isAdmin);
};

window.switchFineTab = function(tabName) {
    const issueTab = document.getElementById('fineContent_issue');
    const rulesTab = document.getElementById('fineContent_rules');
    const btnIssue = document.getElementById('tabFineIssue');
    const btnRules = document.getElementById('tabFineRules');

    if (tabName === 'issue') {
        issueTab.classList.remove('hidden');
        issueTab.classList.add('grid');
        rulesTab.classList.add('hidden');
        rulesTab.classList.remove('block');

        btnIssue.className = "whitespace-nowrap px-4 py-2 rounded-full font-bold text-sm transition-all bg-red-500 text-white shadow-md flex items-center gap-1 border border-red-400";
        btnRules.className = "whitespace-nowrap px-4 py-2 rounded-full font-bold text-sm transition-all bg-slate-800 text-gray-300 hover:text-white flex items-center gap-1 border border-slate-600";
    } else {
        issueTab.classList.add('hidden');
        issueTab.classList.remove('grid');
        rulesTab.classList.remove('hidden');
        rulesTab.classList.add('block');

        btnRules.className = "whitespace-nowrap px-4 py-2 rounded-full font-bold text-sm transition-all bg-amber-500 text-slate-900 shadow-md flex items-center gap-1 border border-amber-400";
        btnIssue.className = "whitespace-nowrap px-4 py-2 rounded-full font-bold text-sm transition-all bg-slate-800 text-gray-300 hover:text-white flex items-center gap-1 border border-slate-600";
    }
};

function populateEmpSelect() {
    const dropdown = document.getElementById('fineEmpDropdown');
    if (!dropdown || !GLOBAL_USER_LIST) return;
    
    const sortedUsers = [...GLOBAL_USER_LIST].sort((a, b) => a.username.localeCompare(b.username));
    dropdown.innerHTML = sortedUsers.map(u => {
        return window.renderTemplate('tpl-fine-emp-item', {
            username: u.username,
            dept: u.department || 'AM'
        });
    }).join('');
}

window.showEmpDropdown = function() {
    document.getElementById('fineEmpDropdown').classList.remove('hidden');
}

window.filterEmpDropdown = function() {
    const term = document.getElementById('fineEmpInput').value.toLowerCase();
    const items = document.querySelectorAll('.fine-emp-item');
    items.forEach(item => {
        const name = item.querySelector('.font-bold').innerText.toLowerCase();
        if(name.includes(term)) item.style.display = 'flex';
        else item.style.display = 'none';
    });
}

window.selectFineEmp = function(name) {
    document.getElementById('fineEmpInput').value = name;
    document.getElementById('fineEmpDropdown').classList.add('hidden');
}

document.addEventListener('click', function(e) {
    const input = document.getElementById('fineEmpInput');
    const dropdown = document.getElementById('fineEmpDropdown');
    if (input && dropdown && !input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.add('hidden');
    }
});

// ===============================================
// 🌟 การจัดการกฎ (Accordion UI + Dropdown Auto Fill)
// ===============================================
async function loadFineRules() {
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', 'fine_rules_data').single();
        if (data && data.value) {
            globalFineRules = JSON.parse(data.value);
            if (globalFineRules.length < 20) {
                globalFineRules = okvipRules;
                await appDB.from('settings').upsert([{ key: 'fine_rules_data', value: JSON.stringify(globalFineRules) }]);
            }
        } else {
            globalFineRules = okvipRules;
            await appDB.from('settings').upsert([{ key: 'fine_rules_data', value: JSON.stringify(globalFineRules) }]);
        }
        renderRulesDropdown();
    } catch(e) { 
        globalFineRules = okvipRules; 
        renderRulesDropdown(); 
    }
}

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
        return;
    }

    ruleSelect.innerHTML = '<option value="">-- เลือกหัวข้อที่ผิด --</option>' + filteredRules.map(r => `<option value="${r}">${r}</option>`).join('');

    ruleSelect.onchange = function() {
        const amtInput = document.getElementById('fineAmount');
        if (this.value && amtInput) {
            const match = this.value.match(/ปรับ\s*([\d,]+)/);
            if (match && match[1].replace(/,/g, '').length >= 3) {
                amtInput.value = parseInt(match[1].replace(/,/g, ''), 10);
            } else {
                amtInput.value = ''; 
            }
        } else if (amtInput) {
            amtInput.value = '';
        }
    };
}

window.toggleRuleGroup = function(groupId, btn) {
    const groupDiv = document.getElementById(groupId);
    const icon = btn.querySelector('.material-icons:last-child');
    if (groupDiv.classList.contains('hidden')) {
        groupDiv.classList.remove('hidden');
        groupDiv.classList.add('flex');
        icon.style.transform = 'rotate(0deg)';
    } else {
        groupDiv.classList.add('hidden');
        groupDiv.classList.remove('flex');
        icon.style.transform = 'rotate(-90deg)';
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
            
            // 🌟 ใช้งาน Template สำหรับ Item
            let itemsHtml = items.map((item, i) => {
                return window.renderTemplate('tpl-fine-rule-item', {
                    badgeClass: colorClass.badge,
                    indexDisplay: i + 1,
                    text: item.text,
                    rawIndex: item.index
                });
            }).join('');

            // 🌟 ใช้งาน Template สำหรับ Group
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
    const amtInput = document.getElementById('newRuleAmount');

    const category = catInput ? catInput.value : 'อื่นๆ';
    const textVal = textInput.value.trim();
    const amtVal = amtInput ? amtInput.value.trim() : '';

    if(!textVal) return Swal.fire('ข้อมูลว่างเปล่า', 'กรุณาพิมพ์รายละเอียดความผิดก่อนครับ', 'warning');
    
    let finalRuleString = `[${category}] ${textVal}`;

    if (amtVal && parseInt(amtVal) > 0) {
        const formattedAmt = parseInt(amtVal).toLocaleString('en-US');
        finalRuleString += ` (ปรับ ${formattedAmt})`;
    }
    
    Swal.fire({title: 'กำลังเพิ่มกฎ...', didOpen: () => Swal.showLoading()});
    globalFineRules.push(finalRuleString); 
    
    textInput.value = '';
    if(amtInput) amtInput.value = '';
    
    await appDB.from('settings').upsert([{ key: 'fine_rules_data', value: JSON.stringify(globalFineRules) }]);
    renderRulesDropdown();
    Swal.fire({icon: 'success', title: 'เพิ่มสำเร็จ', timer: 1000, showConfirmButton: false});
}

window.editFineRulePage = async function(idx) {
    const currentRule = globalFineRules[idx];
    
    const { value: newRuleText } = await Swal.fire({
        title: '<span class="text-amber-500">แก้ไขหัวข้อกฎ</span>',
        input: 'textarea',
        inputValue: currentRule,
        inputPlaceholder: 'พิมพ์รายละเอียดกฎตรงนี้...',
        showCancelButton: true,
        confirmButtonText: 'บันทึกการแก้ไข',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#f59e0b',
        cancelButtonColor: '#64748b',
        inputValidator: (value) => {
            if (!value.trim()) {
                return 'กรุณากรอกข้อความกฎหมาย!';
            }
        },
        customClass: { 
            popup: 'dark:bg-slate-800 dark:text-white rounded-3xl border border-slate-600 shadow-2xl',
            input: 'bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white rounded-xl'
        }
    });

    if (newRuleText && newRuleText.trim() !== currentRule) {
        Swal.fire({title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading()});
        globalFineRules[idx] = newRuleText.trim();
        await appDB.from('settings').upsert([{ key: 'fine_rules_data', value: JSON.stringify(globalFineRules) }]);
        renderRulesDropdown();
        Swal.fire({icon: 'success', title: 'แก้ไขสำเร็จ', timer: 1000, showConfirmButton: false});
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
        text: `ระบบจะล้างกฎที่คุณพิมพ์เองทั้งหมด และโหลดกฎตั้งต้นของ "OKVIP" เข้ามาแทน คุณแน่ใจหรือไม่?`,
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
            document.getElementById('fineImgPreview').src = e.target.result;
            document.getElementById('fineImgPreviewBox').classList.remove('hidden');
            document.getElementById('finePasteArea').classList.add('hidden');
        };
        reader.readAsDataURL(input.files[0]);
    }
};

window.clearFineImg = function(e) {
    if(e) e.preventDefault(); 
    document.getElementById('fineImageInput').value = '';
    document.getElementById('fineImgPreview').src = '';
    document.getElementById('fineImgPreviewBox').classList.add('hidden');
    document.getElementById('finePasteArea').classList.remove('hidden');
};

window.viewFineImage = function(url) {
    document.getElementById('fineExpandedImg').src = url;
    const modal = document.getElementById('fineImageModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
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
// บันทึกใบปรับ
// -----------------------------------------
window.submitFine = async function(e) {
    e.preventDefault();
    const empName = document.getElementById('fineEmpInput').value.trim();
    const ruleText = document.getElementById('fineRuleSelect').value;
    const noteText = document.getElementById('fineNote').value.trim(); 
    const amount = document.getElementById('fineAmount').value || 0;
    const fileInput = document.getElementById('fineImageInput');

    if(!empName || !ruleText) return Swal.fire('ข้อมูลไม่ครบ', 'กรุณาระบุพนักงานและหัวข้อกฎให้ครบถ้วน', 'warning');

    const targetUser = GLOBAL_USER_LIST.find(u => u.username === empName);
    if (!targetUser) {
        return Swal.fire('ไม่พบพนักงาน', 'โปรดตรวจสอบชื่อพนักงานที่พิมพ์อีกครั้ง', 'warning');
    }
    const targetId = targetUser.id;

    Swal.fire({title: 'กำลังบันทึกใบปรับ...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});

    let imageUrl = '';
    try {
        if (fileInput.files && fileInput.files.length > 0) {
            Swal.update({text: 'กำลังอัปโหลดหลักฐาน...'});
            const file = fileInput.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `fine_${Date.now()}_${Math.floor(Math.random() * 1000)}.${fileExt}`;

            const { error: uploadError } = await appDB.storage.from('staff_images').upload(`fines/${fileName}`, file, { cacheControl: '3600', upsert: false });
            if (uploadError) throw new Error('อัปโหลดรูปไม่สำเร็จ');
            const { data: publicUrlData } = appDB.storage.from('staff_images').getPublicUrl(`fines/${fileName}`);
            imageUrl = publicUrlData.publicUrl;
        }

        const { error: dbError } = await appDB.from('fines').insert([{
            user_id: targetId,
            user_name: empName,
            rule_text: ruleText,
            note: noteText,
            amount: amount,
            evidence_url: imageUrl,
            issued_by: currentUser.username
        }]);

        if (dbError) throw dbError;

        Swal.fire({icon: 'success', title: 'ออกใบปรับสำเร็จ', timer: 1500, showConfirmButton: false});
        
        document.getElementById('fineEmpInput').value = '';
        const catSelect = document.getElementById('fineCategorySelect');
        if(catSelect) catSelect.value = '';
        window.filterRulesByCategory(); 
        
        document.getElementById('fineNote').value = '';
        document.getElementById('fineAmount').value = '';
        clearFineImg();
        
        fetchFinesData(true);

    } catch (err) {
        Swal.fire('Error', err.message, 'error');
    }
};

// -----------------------------------------
// ดึงข้อมูลและวาดตาราง
// -----------------------------------------
window.fetchFinesData = async function(isAdmin) {
    const tbody = document.getElementById('fineTableBody');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-10"><span class="material-icons animate-spin text-red-500">sync</span> โหลดข้อมูล...</td></tr>';

    try {
        let query = appDB.from('fines').select('*').order('created_at', { ascending: false });
        if (!isAdmin) {
            query = query.eq('user_name', currentUser.username);
        }

        const { data, error } = await query;
        if (error) throw error;
        
        globalFines = data || [];
        renderFineTable(isAdmin);

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-10 text-red-500">เกิดข้อผิดพลาด หรือยังไม่ได้สร้าง Table 'fines' ใน Supabase<br><span class="text-xs text-gray-500">${e.message}</span></td></tr>`;
    }
};

window.renderFineTable = function(isAdminOverride) {
    const hasManagePerm = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('fine_manage') : false;
    const isAdmin = isAdminOverride !== undefined ? isAdminOverride : (hasManagePerm || currentUser.role === 'manager' || currentUser.role === 'admin');
    
    const tbody = document.getElementById('fineTableBody');
    const term = document.getElementById('fineSearchInput') ? document.getElementById('fineSearchInput').value.toLowerCase() : '';
    
    const filtered = globalFines.filter(f => 
        (f.user_name && f.user_name.toLowerCase().includes(term)) || 
        (f.rule_text && f.rule_text.toLowerCase().includes(term)) ||
        (f.note && f.note.toLowerCase().includes(term))
    );

    let totalAmount = 0;
    filtered.forEach(f => {
        totalAmount += Number(f.amount) || 0;
    });
    
    const totalAmountEl = document.getElementById('fineTotalAmount');
    if (totalAmountEl) {
        totalAmountEl.innerText = `฿${totalAmount.toLocaleString('en-US')}`;
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-10 text-gray-400">ไม่พบประวัติใบปรับ</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(f => {
        const d = new Date(f.created_at);
        const dateStr = d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' }) + ' ' + d.toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'});
        
        const amountDisplay = f.amount > 0 ? window.renderTemplate('tpl-fine-history-amount-badge', { amount: f.amount.toLocaleString('en-US') }) : '<span class="text-gray-400">-</span>';
        
        const imgDisplay = f.evidence_url ? window.renderTemplate('tpl-fine-history-img-btn', { url: f.evidence_url }) : '<span class="text-gray-400 text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded border dark:border-slate-700">- ไม่มีรูป -</span>';

        const delBtn = isAdmin ? window.renderTemplate('tpl-fine-history-del-btn', { id: f.id }) : '';
        const empCol = isAdmin ? window.renderTemplate('tpl-fine-history-emp-col', { username: f.user_name }) : '';
        const actionCol = isAdmin ? window.renderTemplate('tpl-fine-history-action-col', { delBtn: delBtn }) : '';

        // 🌟 ใช้งาน Template แทนการใช้ HTML แบบ String แบบดิบๆ
        let noteHtml = '';
        if (f.note && f.note.trim() !== '') {
            noteHtml = window.renderTemplate('tpl-fine-history-note', { note: f.note });
        }
        
        const ruleDisplay = `<span class="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-800/50 shadow-sm inline-block">${f.rule_text}</span>${noteHtml}`;

        return window.renderTemplate('tpl-fine-history-row', {
            dateStr: dateStr,
            empCol: empCol,
            ruleDisplay: ruleDisplay,
            amountDisplay: amountDisplay,
            imgDisplay: imgDisplay,
            actionCol: actionCol
        });
    }).join('');
};

window.deleteFine = async function(id) {
    const res = await Swal.fire({title: 'ลบรายการนี้?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'ลบทิ้ง'});
    if(res.isConfirmed) {
        Swal.fire({title: 'กำลังลบ...', didOpen: () => Swal.showLoading()});
        await appDB.from('fines').delete().eq('id', id);
        fetchFinesData(true);
        Swal.fire('ลบสำเร็จ', '', 'success');
    }
}
