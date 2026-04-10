// ==========================================
// 🚨 ระบบจัดการใบปรับ (Fine System - Full Experience)
// ==========================================
let globalFines = [];
let currentFineState = {
    empId: null,
    empName: null,
    empDept: null,
    empWeb: null,
    ruleId: null,
    ruleData: null,
    note: ''
};
let currentRuleCategory = null;
let currentManageCatIndex = 0;

// 🌟 กฎระเบียบเริ่มต้น
const DEFAULT_RULE_SETS = [
    {
        category: 'OKVIP - กฎระเบียบออนไลน์',
        rules: [
            { id: 'on_1', type: 'ปรับ', chapter: '2', item: '1', penalty: '100 THB', desc: 'เช็คชื่อสายเกินเวลาปกติ (สายเกิน 1 ชม. ไม่ได้รับค่าแรง)' },
            { id: 'on_2', type: 'หักค่าแรง', chapter: '2', item: '2', penalty: 'หักค่าแรง 2 วัน', desc: 'ไม่ได้เช็คชื่อ 2 ครั้ง ถือว่าขาดงาน (ขาดต่อเนื่อง 2 วันถือว่าหนี)' },
            { id: 'on_3', type: 'หักค่าแรง', chapter: '2', item: '3', penalty: 'หักค่าแรง 1 วัน', desc: 'โทรติดต่อกัน 3 ครั้ง ไม่มีการรับสาย หรือไม่ได้ทำการเช็คชื่อ' },
            { id: 'on_4', type: 'ปรับ', chapter: '2', item: '4', penalty: '100 THB', desc: 'ถ่ายรูปไม่เห็นจอคอมและคีย์บอร์ด 4 มุม / ไม่เห็นข้อมือ / รูปมืด' },
            { id: 'on_5', type: 'ปรับ', chapter: '3', item: '1', penalty: '300 THB', desc: 'ไม่ปฏิบัติตามคำสั่ง / ทำงานด้วยอารมณ์พฤติกรรมไม่เหมาะสม (ร้ายแรงเลิกจ้าง)' },
            { id: 'on_6', type: 'ปรับ', chapter: '3', item: '2', penalty: '150 THB', desc: 'ไม่ตั้งใจทำงาน ไม่รอบคอบ ไม่กระตือรือร้น ทำให้เกิดข้อผิดพลาด' },
            { id: 'on_7', type: 'ปรับ', chapter: '3', item: '3', penalty: '150 THB', desc: 'ทำงานล่าช้า ผัดวันประกันพรุ่ง ไม่มีความร่วมมือระหว่างแผนก' },
            { id: 'on_8', type: 'ปรับ', chapter: '3', item: '4', penalty: '150 THB', desc: 'ไม่ทำงานตามกระบวนการ ทำให้เกิดความเสียหาย' },
            { id: 'on_9', type: 'ปรับ', chapter: '3', item: '5', penalty: '500 THB', desc: 'มีพฤติกรรมทำลายผลประโยชน์บริษัท (ร้ายแรงเลิกจ้าง)' },
            { id: 'on_10', type: 'ปรับ', chapter: '3', item: '6', penalty: '500 THB', desc: 'ไม่รายงานข้อมูล ปิดบัง ให้ข้อมูลเท็จ ปกป้องผู้กระทำผิด' },
            { id: 'on_11', type: 'เลิกจ้าง', chapter: '3', item: '7', penalty: 'เลิกจ้างทันที', desc: 'ทำงานมากกว่า 1 งาน / ใช้เรซูเม่ปลอม / ทำงานนอก / แชร์คอมพิวเตอร์' },
            { id: 'on_12', type: 'ปรับ', chapter: '3', item: '8', penalty: '2,500 THB', desc: 'ไม่ปฏิบัติตามจรรยาบรรณ / ขโมยข้อมูล / ปลอมแปลงข้อมูล / สมัครบัญชีเอง' }
        ]
    },
    {
        category: 'OKVIP - กฎระเบียบทำงานที่บ้าน (WFH)',
        rules: [
            { id: 'wf_1', type: 'ปรับ', chapter: '2', item: '1', penalty: '300 THB', desc: 'การมาสายหรือกลับก่อนเวลา (สายเกิน 30 นาที ไม่ได้รับค่าจ้างวันนั้น)' },
            { id: 'wf_2', type: 'ปรับ', chapter: '2', item: '2', penalty: '300 THB', desc: 'อัปโหลดรูปเช็กชื่อที่ไม่เป็นไปตามข้อกำหนด และไม่ได้เช็กชื่อใหม่' },
            { id: 'wf_3', type: 'หักค่าแรง', chapter: '2', item: '3', penalty: 'หักค่าแรง 1 วัน', desc: 'ไม่อยู่ในตำแหน่งทำงาน หรือไม่ได้รับสายโทรศัพท์ต่อเนื่อง 3 ครั้ง' },
            { id: 'wf_4', type: 'ขาดงาน', chapter: '2', item: '4', penalty: 'ปรับ 3 เท่า', desc: 'ไม่มาทำงานโดยไม่ได้รับอนุญาตถือเป็นการขาดงาน' },
            { id: 'wf_5', type: 'ปรับ', chapter: '3', item: '1', penalty: '300 THB', desc: 'ใช้อุปกรณ์เล่นเกม/ดูวิดีโอ/ช้อปปิ้ง ส่งผลกระทบต่องาน' },
            { id: 'wf_6', type: 'ปรับ', chapter: '3', item: '2', penalty: '1,000 THB', desc: 'ลบประวัติแชทของบัญชีงานโดยไม่ได้รับอนุญาต' },
            { id: 'wf_7', type: 'ปรับ', chapter: '3', item: '3', penalty: '1,000 THB', desc: 'ไม่เชื่อฟังคนเบื้องบน หรือไม่ปฏิบัติตามการมอบหมาย (ร้ายแรงเลิกจ้าง)' },
            { id: 'wf_8', type: 'ปรับ', chapter: '3', item: '4', penalty: '1,000 THB', desc: 'ทำงานอื่นนอกเหนือจากงานของบริษัท หรือทำกิจกรรมที่ก่อความเสียหาย' },
            { id: 'wf_9', type: 'ปรับ', chapter: '3', item: '5', penalty: '300 THB', desc: 'กินข้าวระหว่างเวลางาน หรือเข้าทำงานหลังดื่มแอลกอฮอล์' },
            { id: 'wf_10', type: 'ปรับ', chapter: '3', item: '6', penalty: '500 THB', desc: 'ทำงานล่าช้า ขาดความกระตือรือร้น หรือประสานงานข้ามแผนกไม่ดี' },
            { id: 'wf_11', type: 'ปรับ', chapter: '3', item: '7', penalty: '500 THB', desc: 'รับไฟล์ลิงก์คนแปลกหน้า ขาดความระมัดระวังด้านความปลอดภัย' },
            { id: 'wf_12', type: 'ปรับ', chapter: '4', item: '1', penalty: '1,000 THB', desc: 'ยุยง ข่มขู่ ทะเลาะวิวาท คุกคาม ถ่ายภาพผู้อื่นโดยเจตนาร้าย (ร้ายแรงเลิกจ้าง)' },
            { id: 'wf_13', type: 'ปรับ', chapter: '4', item: '3', penalty: '5,000 THB', desc: 'ขโมย ยักยอกทรัพย์ ขโมยข้อมูล ปลอมแปลงข้อมูล' }
        ]
    },
    {
        category: 'OKVIP - กฎระเบียบสำนักงาน',
        rules: [
            { id: 'of_1', type: 'ตักเตือน', chapter: '2', item: '1', penalty: 'คัดกฎ 1 รอบ', desc: 'การมาสาย หรือ กลับก่อนเวลา (สาย 30 นาที ไม่ได้ค่าแรง / 3 ชม. ขาดงาน)' },
            { id: 'of_2', type: 'ปรับ', chapter: '2', item: '3', penalty: '100 THB', desc: 'ไม่สแกนบัตรเข้า-ออกงานตามเวลาปกติ' },
            { id: 'of_3', type: 'ขาดงาน', chapter: '2', item: '4', penalty: 'ปรับ 3 เท่า', desc: 'การขาดงาน ไม่มาทำงานโดยไม่ได้รับอนุญาต' },
            { id: 'of_4', type: 'ปรับ', chapter: '2', item: '5', penalty: '100 - 300 THB', desc: 'ออกจากหน้างานชั่วคราวเกิน 5 นาที (100 บ.) / ภายใน 30 นาที (300 บ.)' },
            { id: 'of_5', type: 'ปรับ', chapter: '3', item: '1', penalty: '1,000 THB', desc: 'พกอุปกรณ์อิเล็กทรอนิกส์ส่วนตัว (มือถือ) ไปพื้นที่สำนักงาน (ไม่ได้เก็บล็อกเกอร์)' },
            { id: 'of_6', type: 'ตักเตือน', chapter: '3', item: '2', penalty: 'คัดกฎ 1 รอบ', desc: 'ดูวิดีโอ ช้อปปิ้ง ใส่หูฟังฟังเพลง เล่นเกม นอนหลับ หยอกล้อ' },
            { id: 'of_7', type: 'ปรับ', chapter: '3', item: '3', penalty: '1,000 THB', desc: 'นำอุปกรณ์ส่วนตัวเชื่อมเครือข่ายบริษัท / ลบประวัติแชทงาน' },
            { id: 'of_8', type: 'ปรับ', chapter: '3', item: '6', penalty: '300 THB', desc: 'กินข้าวในสำนักงาน นำของกลิ่นแรงเข้ามา หรือดื่มแอลกอฮอล์' },
            { id: 'of_9', type: 'ปรับ', chapter: '4', item: '1', penalty: '300 - 500 THB', desc: 'ก่อเรื่อง ติดแอลกอฮอล์ เสียงดังในหอพัก' },
            { id: 'of_10', type: 'ปรับ', chapter: '4', item: '3', penalty: '300 - 500 THB', desc: 'ผู้ชายเข้าห้องพักผู้หญิง / ผู้หญิงเข้าห้องผู้อื่นโดยไม่ได้รับอนุญาต' },
            { id: 'of_11', type: 'ปรับ', chapter: '4', item: '8', penalty: '500 THB', desc: 'ใช้เครื่องใช้ไฟฟ้ากำลังสูง ประกอบอาหารในหอพัก นำวัตถุไวไฟเข้า' },
            { id: 'of_12', type: 'ปรับ', chapter: '5', item: '1', penalty: '1,000 THB', desc: 'ทะเลาะวิวาท ข่มขู่ ใส่ร้ายป้ายสี (ร้ายแรงเชิญออก)' },
            { id: 'of_13', type: 'ปรับ', chapter: '5', item: '4', penalty: '5,000 THB', desc: 'ขโมย ครอบครองทรัพย์สินสาธารณะ ขโมยข้อมูล' }
        ]
    }
];

window.COMPANY_RULE_SETS = [];

window.initFineApp = async function() {
    const hasManagePerm = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('fine_manage') : false;
    const isAdmin = hasManagePerm || (currentUser.role === 'manager' || currentUser.role === 'admin');

    if (isAdmin && typeof fetchUsers === 'function' && (!GLOBAL_USER_LIST || GLOBAL_USER_LIST.length === 0)) {
        await fetchUsers();
    }

    if (!isAdmin) {
        document.getElementById('tabFineCreate').classList.add('hidden');
        document.getElementById('tabFineManage').classList.add('hidden');
        switchFineTab('history');
        document.getElementById('thAction').style.display = 'none';
    } else {
        await loadCompanyRules();
        populateFineFilters();
        switchFineTab('create');
    }

    await fetchFinesData(isAdmin);
};

window.switchFineTab = function(tab) {
    ['create', 'history', 'manage'].forEach(t => {
        document.getElementById('fineTab' + t.charAt(0).toUpperCase() + t.slice(1)).classList.add('hidden');
        document.getElementById('fineTab' + t.charAt(0).toUpperCase() + t.slice(1)).classList.remove('flex');
        
        const btn = document.getElementById('tabFine' + t.charAt(0).toUpperCase() + t.slice(1));
        if(btn) btn.className = "px-5 py-2.5 rounded-xl text-sm font-bold transition-all text-gray-400 hover:text-white hover:bg-slate-800 flex items-center gap-2 border border-transparent";
    });

    const activeTab = document.getElementById('fineTab' + tab.charAt(0).toUpperCase() + tab.slice(1));
    const activeBtn = document.getElementById('tabFine' + tab.charAt(0).toUpperCase() + tab.slice(1));
    
    if (activeTab) { activeTab.classList.remove('hidden'); activeTab.classList.add('flex'); }
    if (activeBtn) { activeBtn.className = "px-5 py-2.5 rounded-xl text-sm font-bold transition-all bg-orange-500/10 text-orange-500 border border-orange-500/50 flex items-center gap-2 shadow-sm"; }

    if(tab === 'create') {
        renderFineEmpList();
        renderFineRuleList();
    } else if (tab === 'manage') {
        renderManageCategories();
    }
};

// -----------------------------------------
// ดึงกฎจาก Supabase
// -----------------------------------------
async function loadCompanyRules() {
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', 'fine_rules_v2').single();
        if (data && data.value) {
            window.COMPANY_RULE_SETS = JSON.parse(data.value);
        } else {
            window.COMPANY_RULE_SETS = JSON.parse(JSON.stringify(DEFAULT_RULE_SETS)); 
            await saveCompanyRules();
        }
    } catch(e) {
        window.COMPANY_RULE_SETS = JSON.parse(JSON.stringify(DEFAULT_RULE_SETS));
    }
    renderRuleCategoryTabs(); 
}

async function saveCompanyRules() {
    await appDB.from('settings').upsert([{ key: 'fine_rules_v2', value: JSON.stringify(window.COMPANY_RULE_SETS) }]);
    renderRuleCategoryTabs();
}

window.renderRuleCategoryTabs = function() {
    const container = document.getElementById('fineCategoryTabs');
    if(!container) return;
    
    if(!currentRuleCategory && window.COMPANY_RULE_SETS.length > 0) {
        currentRuleCategory = window.COMPANY_RULE_SETS[0].category;
    }

    container.innerHTML = window.COMPANY_RULE_SETS.map((cat, idx) => {
        const isActive = currentRuleCategory === cat.category;
        const cls = isActive ? 'rule-cat-btn active px-4 py-1.5 rounded-lg text-xs font-bold transition-all bg-indigo-600 text-white shadow-md border border-indigo-500 whitespace-nowrap' 
                             : 'rule-cat-btn px-4 py-1.5 rounded-lg text-xs font-bold transition-all bg-slate-800 text-gray-400 hover:text-white border border-slate-600 whitespace-nowrap';
        return `<button type="button" onclick="switchRuleCategory('${cat.category}')" class="${cls}">${cat.category}</button>`;
    }).join('');
};

window.switchRuleCategory = function(cat) {
    currentRuleCategory = cat;
    renderRuleCategoryTabs();
    
    document.getElementById('searchFineRule').value = '';
    document.getElementById('filterRuleType').value = 'ALL';
    currentFineState.ruleId = null;
    currentFineState.ruleData = null;
    
    renderFineRuleList();
    updateFinePattern();
};

function populateFineFilters() {
    const teamFilter = document.getElementById('filterFineTeam');
    if (teamFilter && typeof TEAM_LIST !== 'undefined') {
        teamFilter.innerHTML = '<option value="ALL">ทุกเว็บ/ทีม</option>' + TEAM_LIST.map(t => `<option value="${t}">${t}</option>`).join('');
    }
}

// -----------------------------------------
// TAB 1: ฝั่งซ้าย (รายชื่อพนักงาน)
// -----------------------------------------
window.renderFineEmpList = function() {
    const listDiv = document.getElementById('fineEmpList');
    const term = document.getElementById('searchFineEmp').value.toLowerCase();
    const dept = document.getElementById('filterFineDept').value;
    const team = document.getElementById('filterFineTeam').value;
    
    if (!listDiv || !GLOBAL_USER_LIST) return;

    let filtered = GLOBAL_USER_LIST.filter(u => {
        const uDept = u.department || 'AM';
        const uTeam = u.team || '';
        
        const matchName = u.username.toLowerCase().includes(term);
        const matchDept = dept === 'ALL' || uDept === dept;
        const matchTeam = team === 'ALL' || uTeam === team;
        
        return matchName && matchDept && matchTeam;
    }).sort((a, b) => a.username.localeCompare(b.username));

    if(filtered.length === 0) {
        listDiv.innerHTML = '<div class="text-center text-gray-500 text-xs py-10">ไม่พบรายชื่อพนักงาน</div>';
        return;
    }

    listDiv.innerHTML = filtered.map(u => {
        const isSelected = currentFineState.empId === u.id;
        const bgClass = isSelected ? 'bg-orange-500/20 border-orange-500 shadow-inner' : 'bg-slate-900 border-slate-700 hover:border-slate-500';
        const textClass = isSelected ? 'text-orange-400' : 'text-gray-200';
        const uDept = u.department || 'AM';
        const uTeam = u.team || '-';

        return `
            <div onclick="selectFineEmp('${u.id}', '${u.username}', '${uDept}', '${uTeam}')" class="p-3 rounded-xl border cursor-pointer transition flex flex-col gap-2 ${bgClass}">
                <div class="flex justify-between items-center">
                    <div class="font-black text-sm ${textClass}">${u.username}</div>
                    <div class="text-[9px] bg-emerald-900/30 text-emerald-400 px-2 py-0.5 rounded border border-emerald-800">สะอาด</div>
                </div>
                <div class="flex items-center gap-1.5">
                    <span class="text-[9px] bg-slate-800 text-gray-400 px-1.5 py-0.5 rounded border border-slate-600">${uDept}</span>
                    <span class="text-[9px] bg-slate-800 text-gray-400 px-1.5 py-0.5 rounded border border-slate-600 truncate max-w-[100px]">${uTeam}</span>
                </div>
            </div>
        `;
    }).join('');
};

window.selectFineEmp = function(id, name, dept, web) {
    currentFineState.empId = id;
    currentFineState.empName = name;
    currentFineState.empDept = dept;
    currentFineState.empWeb = web;
    renderFineEmpList();
    updateFinePattern();
};

// -----------------------------------------
// TAB 1: ฝั่งขวา (กฎและแพทเทิร์น)
// -----------------------------------------
window.renderFineRuleList = function() {
    const listDiv = document.getElementById('fineRuleList');
    if (!listDiv) return;

    const term = document.getElementById('searchFineRule').value.toLowerCase();
    const filterType = document.getElementById('filterRuleType').value;

    const targetSet = window.COMPANY_RULE_SETS.find(s => s.category === currentRuleCategory);
    if (!targetSet) return;

    let filteredRules = targetSet.rules.filter(rule => {
        const matchTerm = rule.desc.toLowerCase().includes(term) || rule.penalty.toLowerCase().includes(term);
        const matchType = filterType === 'ALL' || rule.type === filterType;
        return matchTerm && matchType;
    });

    if(filteredRules.length === 0) {
        listDiv.innerHTML = '<div class="text-center text-gray-500 text-xs py-10">ไม่พบกฎในหมวดหมู่นี้</div>';
        return;
    }

    let html = '';
    filteredRules.forEach(rule => {
        const isSelected = currentFineState.ruleId === rule.id;
        const bgClass = isSelected ? 'bg-orange-900/20 border-orange-500 shadow-md' : 'bg-slate-900 border-slate-700 hover:border-slate-500';
        
        let typeColor = 'bg-gray-800 text-gray-300 border-gray-600';
        if(rule.type === 'ปรับ') typeColor = 'bg-orange-900/50 text-orange-400 border-orange-700';
        if(rule.type === 'เลิกจ้าง') typeColor = 'bg-red-900/50 text-red-400 border-red-700';
        if(rule.type === 'ขาดงาน' || rule.type === 'หักค่าแรง') typeColor = 'bg-fuchsia-900/50 text-fuchsia-400 border-fuchsia-700';
        if(rule.type === 'ตักเตือน') typeColor = 'bg-yellow-900/50 text-yellow-400 border-yellow-700';

        const ruleJson = JSON.stringify(rule).replace(/"/g, '&quot;');

        html += `
            <div onclick="selectFineRule('${rule.id}', '${ruleJson}')" class="p-3.5 rounded-xl border cursor-pointer transition flex gap-3 ${bgClass}">
                <div class="pt-0.5 shrink-0">
                    <div class="w-4 h-4 rounded border ${isSelected ? 'bg-orange-500 border-orange-500 flex items-center justify-center' : 'bg-slate-800 border-slate-500'}">
                        ${isSelected ? '<span class="material-icons text-white text-[12px] font-bold">check</span>' : ''}
                    </div>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex flex-wrap gap-2 items-center mb-2">
                        <span class="text-[10px] px-2 py-0.5 rounded border font-bold shadow-sm ${typeColor}">${rule.type}</span>
                        <span class="text-[10px] bg-blue-900/30 text-blue-400 border border-blue-800 px-2 py-0.5 rounded font-bold">บทที่ ${rule.chapter}</span>
                        <span class="text-[10px] bg-purple-900/30 text-purple-400 border border-purple-800 px-2 py-0.5 rounded font-bold">ข้อ ${rule.item}</span>
                    </div>
                    <div class="text-sm font-bold text-white mb-1 leading-snug">${rule.desc}</div>
                    <div class="text-xs font-mono font-bold text-red-400">${rule.penalty}</div>
                </div>
            </div>
        `;
    });
    
    listDiv.innerHTML = html;
};

window.selectFineRule = function(id, ruleJson) {
    currentFineState.ruleId = id;
    currentFineState.ruleData = JSON.parse(ruleJson.replace(/&quot;/g, '"'));
    renderFineRuleList();
    updateFinePattern();
};

window.updateFinePattern = function() {
    currentFineState.note = document.getElementById('fineExtraNote').value.trim();
    const preview = document.getElementById('finePatternPreview');
    
    if (!currentFineState.empName || !currentFineState.ruleData) {
        preview.innerHTML = '<span class="text-gray-500">กรุณาเลือกพนักงาน และ กฎ เพื่อสร้างแพทเทิร์น...</span>';
        return;
    }

    const eName = currentFineState.empName;
    const eWeb = currentFineState.empWeb && currentFineState.empWeb !== '-' ? `-${currentFineState.empWeb}` : '';
    const r = currentFineState.ruleData;
    
    let noteTxt = currentFineState.note ? ` - ${currentFineState.note}` : '';
    const text = `${r.type} ${eName}${eWeb} บทที่ ${r.chapter} ข้อที่ ${r.item} ${r.penalty} (${r.desc}${noteTxt})`;
    
    preview.innerHTML = `<span class="text-white">${text}</span>`;
};

window.copyFinePattern = function() {
    const preview = document.getElementById('finePatternPreview');
    if (!currentFineState.empName || !currentFineState.ruleData) {
        return Swal.fire('ยังไม่สมบูรณ์', 'กรุณาเลือกพนักงานและกฎก่อนก๊อปปี้ครับ', 'warning');
    }
    
    navigator.clipboard.writeText(preview.innerText);
    const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
    Toast.fire({ icon: 'success', title: 'คัดลอกแพทเทิร์นแล้ว' });
};

window.submitNewFine = async function() {
    if (!currentFineState.empName || !currentFineState.ruleData) {
        return Swal.fire('ข้อมูลไม่ครบ', 'กรุณาเลือกพนักงาน และ กฎ ที่ต้องการปรับ', 'warning');
    }

    Swal.fire({title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});

    try {
        const r = currentFineState.ruleData;
        const amountMatch = r.penalty.match(/\d+(,\d+)?/g);
        let amountNum = 0;
        if (amountMatch) {
            amountNum = parseInt(amountMatch[0].replace(/,/g, ''));
        }

        const { error: dbError } = await appDB.from('fines').insert([{
            user_id: currentFineState.empId,
            user_name: currentFineState.empName,
            rule_text: `บทที่ ${r.chapter} ข้อ ${r.item} (${currentRuleCategory})`,
            note: `[${r.penalty}] ${r.desc} ${currentFineState.note ? ' - ' + currentFineState.note : ''}`,
            amount: amountNum,
            issued_by: currentUser.username
        }]);

        if (dbError) throw dbError;

        Swal.fire({icon: 'success', title: 'บันทึกการปรับสำเร็จ', timer: 1500, showConfirmButton: false});
        
        currentFineState = { empId: null, empName: null, empDept: null, empWeb: null, ruleId: null, ruleData: null, note: '' };
        document.getElementById('fineExtraNote').value = '';
        renderFineEmpList();
        renderFineRuleList();
        updateFinePattern();
        
        fetchFinesData(true);

    } catch (err) {
        Swal.fire('Error', err.message, 'error');
    }
};

// -----------------------------------------
// TAB 2: ตารางประวัติ
// -----------------------------------------
window.fetchFinesData = async function(isAdmin) {
    const tbody = document.getElementById('fineHistoryBody');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-10"><span class="material-icons animate-spin text-red-500">sync</span> โหลดข้อมูล...</td></tr>';

    try {
        let query = appDB.from('fines').select('*').order('created_at', { ascending: false });
        if (!isAdmin) query = query.eq('user_name', currentUser.username);

        const { data, error } = await query;
        if (error) throw error;
        
        globalFines = data || [];
        renderFineHistoryTable(isAdmin);
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-10 text-red-500">เกิดข้อผิดพลาดในการโหลดประวัติ<br><span class="text-xs text-gray-500">${e.message}</span></td></tr>`;
    }
};

window.renderFineHistoryTable = function(isAdminOverride) {
    const hasManagePerm = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('fine_manage') : false;
    const isAdmin = isAdminOverride !== undefined ? isAdminOverride : (hasManagePerm || currentUser.role === 'manager' || currentUser.role === 'admin');
    
    const tbody = document.getElementById('fineHistoryBody');
    const term = document.getElementById('historySearchInput') ? document.getElementById('historySearchInput').value.toLowerCase() : '';
    
    const filtered = globalFines.filter(f => 
        (f.user_name && f.user_name.toLowerCase().includes(term)) || 
        (f.rule_text && f.rule_text.toLowerCase().includes(term)) ||
        (f.note && f.note.toLowerCase().includes(term))
    );

    let totalAmount = 0;
    filtered.forEach(f => { totalAmount += Number(f.amount) || 0; });
    const totalAmountEl = document.getElementById('fineTotalAmount');
    if (totalAmountEl) totalAmountEl.innerText = `฿${totalAmount.toLocaleString('en-US')}`;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-10 text-gray-500">ไม่พบประวัติใบปรับ</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(f => {
        const d = new Date(f.created_at);
        const dateStr = d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' }) + ' ' + d.toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'});
        
        const amountDisplay = f.amount > 0 ? `<span class="font-mono text-red-500 font-bold bg-red-500/10 px-2.5 py-1 rounded border border-red-500/30">฿${f.amount}</span>` : '<span class="text-gray-500">-</span>';

        const delBtn = isAdmin ? `<button onclick="deleteFine(${f.id})" class="text-red-400 hover:text-white bg-slate-800 hover:bg-red-500 p-1.5 rounded-lg transition border border-slate-600 shadow-sm"><span class="material-icons text-[16px] block">delete</span></button>` : '';
        const actionCol = isAdmin ? `<td class="p-4 text-center align-top pt-6">${delBtn}</td>` : '';

        let ruleDisplay = `<span class="bg-red-900/30 text-red-400 px-3 py-1.5 rounded-lg border border-red-800/50 shadow-sm inline-block font-bold">${f.rule_text}</span>`;
        if (f.note && f.note.trim() !== '') {
            ruleDisplay += `<div class="mt-2 text-yellow-500 text-xs font-bold flex items-start gap-1.5 w-fit max-w-[400px]"><span class="material-icons text-[16px] shrink-0 mt-0.5">info</span><span class="whitespace-normal break-words leading-relaxed">${f.note}</span></div>`;
        }

        return `
        <tr class="hover:bg-slate-800/50 transition border-b border-slate-700/50 group">
            <td class="p-4 text-xs text-gray-500 font-mono align-top pt-6">${dateStr}</td>
            <td class="p-4 font-black text-white align-top pt-6 text-sm">${f.user_name}</td>
            <td class="p-4 text-xs align-top pt-5 pb-5">${ruleDisplay}</td>
            <td class="p-4 text-center align-top pt-6">${amountDisplay}</td>
            <td class="p-4 text-center align-top pt-6 text-gray-500 text-xs">- ไม่มีรูป -</td>
            ${actionCol}
        </tr>`;
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

// -----------------------------------------
// TAB 3: จัดการกฎ
// -----------------------------------------
window.renderManageCategories = function() {
    const listDiv = document.getElementById('manageCategoryList');
    if(!listDiv) return;

    listDiv.innerHTML = window.COMPANY_RULE_SETS.map((cat, idx) => {
        const isActive = currentManageCatIndex === idx;
        const bg = isActive ? 'bg-orange-500/10 border-orange-500' : 'bg-slate-800 border-slate-600 hover:border-slate-500';
        return `
            <div class="p-3 rounded-xl border cursor-pointer transition ${bg}" onclick="selectManageCategory(${idx})">
                <div class="flex justify-between items-center mb-2">
                    <span class="font-bold text-white text-sm truncate">${cat.category}</span>
                    <span class="text-[10px] bg-slate-900 text-gray-400 px-2 py-0.5 rounded border border-slate-600">${cat.rules.length}</span>
                </div>
                <div class="flex gap-2">
                    <button onclick="event.stopPropagation(); editCategoryName(${idx})" class="flex-1 bg-slate-700 hover:bg-slate-600 text-white p-1 rounded transition text-xs font-bold"><span class="material-icons text-[12px] align-middle">edit</span> แก้ไข</button>
                    <button onclick="event.stopPropagation(); deleteCategory(${idx})" class="bg-red-900/30 hover:bg-red-500 text-red-400 hover:text-white p-1 rounded transition w-8"><span class="material-icons text-[12px] align-middle">delete</span></button>
                </div>
            </div>
        `;
    }).join('');

    renderManageRules();
};

window.selectManageCategory = function(idx) {
    currentManageCatIndex = idx;
    renderManageCategories();
};

window.renderManageRules = function() {
    const tbody = document.getElementById('manageRuleTableBody');
    const title = document.getElementById('manageRuleTitle');
    if(!tbody || window.COMPANY_RULE_SETS.length === 0) return;

    const cat = window.COMPANY_RULE_SETS[currentManageCatIndex];
    title.innerText = `รายการกฎ — ${cat.category}`;

    const term = document.getElementById('searchManageRule').value.toLowerCase();
    const filtered = cat.rules.filter(r => r.desc.toLowerCase().includes(term) || r.penalty.toLowerCase().includes(term) || r.type.toLowerCase().includes(term));

    if(filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center p-8 text-gray-500">ไม่พบข้อมูลกฎในหมวดนี้</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map((r, rIdx) => {
        let typeColor = 'bg-gray-800 text-gray-300 border-gray-600';
        if(r.type === 'ปรับ') typeColor = 'bg-orange-900/50 text-orange-400 border-orange-700';
        if(r.type === 'เลิกจ้าง') typeColor = 'bg-red-900/50 text-red-400 border-red-700';
        if(r.type === 'ขาดงาน' || r.type === 'หักค่าแรง') typeColor = 'bg-fuchsia-900/50 text-fuchsia-400 border-fuchsia-700';
        if(r.type === 'ตักเตือน') typeColor = 'bg-yellow-900/50 text-yellow-400 border-yellow-700';

        return `
            <tr class="hover:bg-slate-800/50 border-b border-slate-700/50 transition">
                <td class="p-4"><span class="text-[10px] px-2 py-1 rounded border font-bold ${typeColor}">${r.type}</span></td>
                <td class="p-4 text-center text-white font-bold">${r.chapter}</td>
                <td class="p-4 text-center text-white font-bold">${r.item}</td>
                <td class="p-4 text-red-400 font-bold text-xs">${r.penalty}</td>
                <td class="p-4 text-gray-300 text-xs truncate max-w-[250px]" title="${r.desc}">${r.desc}</td>
                <td class="p-4 text-center">
                    <button onclick="deleteRuleItem(${rIdx})" class="bg-red-900/30 hover:bg-red-500 text-red-400 hover:text-white p-1.5 rounded transition"><span class="material-icons text-[16px] block">delete</span></button>
                </td>
            </tr>
        `;
    }).join('');
};

window.addNewRuleCategory = async function() {
    const { value: catName } = await Swal.fire({
        title: 'เพิ่มหมวดหมู่ใหม่',
        input: 'text',
        inputPlaceholder: 'เช่น กฎระเบียบแผนก IT...',
        showCancelButton: true,
        confirmButtonColor: '#ea580c',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl' }
    });
    if(catName) {
        window.COMPANY_RULE_SETS.push({ category: catName, rules: [] });
        currentManageCatIndex = window.COMPANY_RULE_SETS.length - 1;
        await saveCompanyRules();
        renderManageCategories();
    }
};

window.editCategoryName = async function(idx) {
    const { value: catName } = await Swal.fire({
        title: 'เปลี่ยนชื่อหมวดหมู่',
        input: 'text',
        inputValue: window.COMPANY_RULE_SETS[idx].category,
        showCancelButton: true,
        confirmButtonColor: '#ea580c',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl' }
    });
    if(catName) {
        window.COMPANY_RULE_SETS[idx].category = catName;
        await saveCompanyRules();
        renderManageCategories();
    }
};

window.deleteCategory = async function(idx) {
    const res = await Swal.fire({title: 'ลบหมวดหมู่นี้?', text: 'กฎที่อยู่ข้างในจะหายไปทั้งหมด', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'ลบทิ้ง'});
    if(res.isConfirmed) {
        window.COMPANY_RULE_SETS.splice(idx, 1);
        currentManageCatIndex = 0;
        await saveCompanyRules();
        renderManageCategories();
    }
};

window.addNewRuleItem = async function() {
    if(window.COMPANY_RULE_SETS.length === 0) return Swal.fire('Error', 'ต้องสร้างหมวดหมู่ก่อนครับ', 'warning');
    
    const { value: formValues } = await Swal.fire({
        title: 'เพิ่มข้อกฎใหม่',
        html: `
            <div class="flex flex-col gap-3 text-left">
                <label class="text-xs text-gray-400">ประเภท (เช่น ปรับ, ขาดงาน, เลิกจ้าง)</label>
                <input id="swal-type" class="w-full p-3 rounded-lg bg-slate-900 border border-slate-600 text-white outline-none focus:border-orange-500" value="ปรับ">
                
                <div class="flex gap-3">
                    <div class="flex-1">
                        <label class="text-xs text-gray-400">บทที่</label>
                        <input id="swal-chapter" class="w-full p-3 rounded-lg bg-slate-900 border border-slate-600 text-white outline-none focus:border-orange-500">
                    </div>
                    <div class="flex-1">
                        <label class="text-xs text-gray-400">ข้อที่</label>
                        <input id="swal-item" class="w-full p-3 rounded-lg bg-slate-900 border border-slate-600 text-white outline-none focus:border-orange-500">
                    </div>
                </div>

                <label class="text-xs text-gray-400">บทลงโทษ (เช่น 300 THB)</label>
                <input id="swal-penalty" class="w-full p-3 rounded-lg bg-slate-900 border border-slate-600 text-white outline-none focus:border-orange-500">
                
                <label class="text-xs text-gray-400">รายละเอียดหมายเหตุ</label>
                <textarea id="swal-desc" rows="2" class="w-full p-3 rounded-lg bg-slate-900 border border-slate-600 text-white outline-none focus:border-orange-500"></textarea>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'บันทึกกฎ',
        confirmButtonColor: '#ea580c',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-3xl' },
        preConfirm: () => {
            return {
                id: 'r_' + Date.now(),
                type: document.getElementById('swal-type').value || 'ปรับ',
                chapter: document.getElementById('swal-chapter').value || '-',
                item: document.getElementById('swal-item').value || '-',
                penalty: document.getElementById('swal-penalty').value || '-',
                desc: document.getElementById('swal-desc').value || '-'
            }
        }
    });
    if(formValues) {
        window.COMPANY_RULE_SETS[currentManageCatIndex].rules.push(formValues);
        await saveCompanyRules();
        renderManageRules();
    }
};

window.deleteRuleItem = async function(rIdx) {
    const res = await Swal.fire({title: 'ลบกฎข้อนี้?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'ลบเลย'});
    if(res.isConfirmed) {
        window.COMPANY_RULE_SETS[currentManageCatIndex].rules.splice(rIdx, 1);
        await saveCompanyRules();
        renderManageRules();
    }
};
