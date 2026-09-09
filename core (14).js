// ════════════════════════════════════════════════════════════════════
// 📦 sop/core.js — ส่วนที่ 1/4 ของหน้าคู่มือ SOP (แยกจาก sop.js เดิม 3,451 บรรทัด)
// เนื้อหา: แกนหลัก: init, สลับแท็บ, หมวดหมู่, โหลด/บันทึกข้อมูล, ตัวกรอง, วาดรายการ, ตัวนับแท็บ
// ⚠️ ลำดับโหลด (PAGE_SCRIPTS ใน global.js): sop/core → sop/rules → sop/manage → sop/share
// ตัวแปร top-level แชร์ข้ามไฟล์อัตโนมัติ — ต้องโหลดหลัง core เสมอ
// ════════════════════════════════════════════════════════════════════
// ==========================================
// 📋 ระบบ SOP V2 — คู่มือการทำงานพรีเมียม
// ฟีเจอร์: ไฟล์แนบ, ปักหมุด, ระดับความสำคัญ, ระบุกะ, Tags,
//         Copy 1คลิก, View count, Read receipts, ประวัติแก้ไข
// เก็บใน Supabase: settings table
//   key: sop_data       → array ของกฎทั้งหมด
//   key: sop_categories → array ของหมวดหมู่
// ==========================================

let globalSOPData = [];
let globalSOPCategories = [];
let globalStandaloneRules = [];      // V4: กติกาแบบ standalone (Tab 1)
let currentSopId = null;
let sopPinFilterActive = false;
let sopAttachmentsBuffer = [];
let sopRulesBuffer = [];
let sopActiveTab = 'rules';

// 🔒 [FIX] เช็คสิทธิ์ "ในฟังก์ชัน" — เดิมเช็คแค่ซ่อนปุ่ม ใครเปิด F12 ก็เรียกลบ/แก้ SOP ได้
window.sopCanManage = function() {
    if (typeof currentUser === 'undefined' || !currentUser) return false;
    if (['manager', 'admin'].includes(currentUser.role)) return true;
    return typeof window.hasUserPerm === 'function' && window.hasUserPerm('sop_manage');
};
window.sopCanSendTg = function() {
    if (typeof currentUser === 'undefined' || !currentUser) return false;
    return ['manager', 'admin', 'trainer'].includes(currentUser.role) || window.sopCanManage();
};
window.sopRequire = function(fn) {
    if (fn()) return true;
    Swal.fire('ไม่มีสิทธิ์', 'คุณไม่มีสิทธิ์ใช้งานส่วนนี้ครับ', 'error');
    return false;
};

const SOP_PRIORITY_OPTIONS = [
    { id: 'high',   label: '🔴 สำคัญมาก',  color: 'red',    border: 'border-red-500',    bg: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700' },
    { id: 'medium', label: '🟡 ปานกลาง',   color: 'amber',  border: 'border-amber-400',  bg: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700' },
    { id: 'low',    label: '🟢 ทั่วไป',    color: 'emerald',border: 'border-emerald-400',bg: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700' }
];

const SOP_SHIFT_OPTIONS = [
    { id: 'morning', label: '🌅 กะเช้า', short: 'เช้า', color: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700' },
    { id: 'mid',     label: '☀️ กะกลาง', short: 'กลาง', color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700' },
    { id: 'night',   label: '🌃 กะดึก',  short: 'ดึก',  color: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700' }
];

// ==========================================
// 🚀 INIT
// ==========================================
window.initSopApp = async function() {
    const hasManagePerm = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('sop_manage') : false;
    const isAdmin = hasManagePerm || (currentUser && (currentUser.role === 'manager' || currentUser.role === 'admin'));

    const adminControls = document.getElementById('sopAdminControls');
    if (adminControls) {
        if (isAdmin) adminControls.classList.remove('hidden');
        else adminControls.classList.add('hidden');
    }
    const rulesAdminControls = document.getElementById('sopRulesAdminControls');
    if (rulesAdminControls) {
        if (isAdmin) rulesAdminControls.classList.remove('hidden');
        else rulesAdminControls.classList.add('hidden');
    }

    currentSopId = null;
    sopPinFilterActive = false;
    sop_updatePinFilterBtn();
    document.getElementById('sopReaderContent').innerHTML = window.renderTemplate('tpl-sop-empty');

    await sop_loadCategories();
    await sop_fetchData();
    await sop_loadTelegramConfig();
    await sop_loadGroups();

    // V3.4: ตั้ง tab default = "กติกา"
    sopActiveTab = 'rules';
    sop_switchTab('rules');
};

// ==========================================
// 🆕 V3.4: TAB SWITCHER
// ==========================================
window.sop_switchTab = function(tabName) {
    sopActiveTab = tabName;

    const tabRules = document.getElementById('sopTab_rules');
    const tabSop = document.getElementById('sopTab_sop');
    const btnRules = document.getElementById('sopTabBtn_rules');
    const btnSop = document.getElementById('sopTabBtn_sop');

    if (tabName === 'rules') {
        if (tabRules) { tabRules.classList.remove('hidden'); tabRules.classList.add('flex'); }
        if (tabSop)   { tabSop.classList.add('hidden');     tabSop.classList.remove('flex'); }
        if (btnRules) {
            btnRules.classList.remove('bg-slate-100', 'dark:bg-slate-900', 'text-slate-600', 'dark:text-gray-400', 'border-gray-300', 'dark:border-slate-600', 'hover:bg-slate-200', 'dark:hover:bg-slate-700');
            btnRules.classList.add('bg-gradient-to-b', 'from-orange-500', 'to-amber-500', 'text-white', 'border-orange-400', '-mb-px');
        }
        if (btnSop) {
            btnSop.classList.add('bg-slate-100', 'dark:bg-slate-900', 'text-slate-600', 'dark:text-gray-400', 'border-gray-300', 'dark:border-slate-600', 'hover:bg-slate-200', 'dark:hover:bg-slate-700');
            btnSop.classList.remove('bg-gradient-to-b', 'from-rose-500', 'to-pink-500', 'text-white', 'border-rose-400', '-mb-px');
        }
        sop_renderRulesCategoryDropdown();
        sop_renderAllRulesPage();
    } else {
        if (tabRules) { tabRules.classList.add('hidden');     tabRules.classList.remove('flex'); }
        if (tabSop)   { tabSop.classList.remove('hidden');   tabSop.classList.add('flex'); }
        if (btnSop) {
            btnSop.classList.remove('bg-slate-100', 'dark:bg-slate-900', 'text-slate-600', 'dark:text-gray-400', 'border-gray-300', 'dark:border-slate-600', 'hover:bg-slate-200', 'dark:hover:bg-slate-700');
            btnSop.classList.add('bg-gradient-to-b', 'from-rose-500', 'to-pink-500', 'text-white', 'border-rose-400', '-mb-px');
        }
        if (btnRules) {
            btnRules.classList.add('bg-slate-100', 'dark:bg-slate-900', 'text-slate-600', 'dark:text-gray-400', 'border-gray-300', 'dark:border-slate-600', 'hover:bg-slate-200', 'dark:hover:bg-slate-700');
            btnRules.classList.remove('bg-gradient-to-b', 'from-orange-500', 'to-amber-500', 'text-white', 'border-orange-400', '-mb-px');
        }
    }
};

// ==========================================
// 📂 CATEGORIES
// ==========================================
window.sop_loadCategories = async function() {
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', 'sop_categories').single();
        if (data && data.value) {
            globalSOPCategories = JSON.parse(data.value);
        } else {
            globalSOPCategories = [
                { id: 'การฝาก',    name: '💰 การฝาก',    color: '#10b981' }, // เขียว
                { id: 'การถอน',    name: '💸 การถอน',    color: '#f97316' }, // ส้ม
                { id: 'เครดิต',    name: '🪙 เครดิต',    color: '#eab308' }, // เหลือง
                { id: 'เคสพิเศษ',  name: '⚠️ เคสพิเศษ',  color: '#ef4444' }, // แดง
                { id: 'กฎทั่วไป',  name: '📌 กฎทั่วไป',  color: '#3b82f6' }  // ฟ้า
            ];
            await appDB.from('settings').upsert([{ key: 'sop_categories', value: JSON.stringify(globalSOPCategories) }]);
        }
        // ทำ default field สำหรับหมวดเก่าที่ไม่มี color
        let needsSave = false;
        const defaultColors = ['#10b981', '#f97316', '#eab308', '#ef4444', '#3b82f6', '#a855f7', '#ec4899'];
        globalSOPCategories.forEach((c, i) => {
            if (!c.color) { c.color = defaultColors[i % defaultColors.length]; needsSave = true; }
        });
        if (needsSave) await appDB.from('settings').upsert([{ key: 'sop_categories', value: JSON.stringify(globalSOPCategories) }]);

        sop_renderCategoryDropdowns();
    } catch (e) {
        console.error('sop_loadCategories error:', e);
        globalSOPCategories = [];
    }
};

window.sop_renderCategoryDropdowns = function() {
    const filterSelect = document.getElementById('sopCategory');
    if (filterSelect) {
        const currentVal = filterSelect.value;
        let html = '<option value="ALL">📂 ทุกหมวดหมู่</option>';
        globalSOPCategories.forEach(c => html += `<option value="${c.id}">${c.name}</option>`);
        filterSelect.innerHTML = html;
        if (currentVal && (currentVal === 'ALL' || globalSOPCategories.some(c => c.id === currentVal))) filterSelect.value = currentVal;
        else filterSelect.value = 'ALL';
    }
    sop_renderRulesCategoryDropdown();
};

window.sop_renderRulesCategoryDropdown = function() {
    const filterSelect = document.getElementById('sopRulesCatFilter');
    if (!filterSelect) return;
    const currentVal = filterSelect.value;
    let html = '<option value="ALL">📂 ทุกหมวดหมู่</option>';
    globalSOPCategories.forEach(c => html += `<option value="${c.id}">${c.name}</option>`);
    filterSelect.innerHTML = html;
    if (currentVal && (currentVal === 'ALL' || globalSOPCategories.some(c => c.id === currentVal))) filterSelect.value = currentVal;
    else filterSelect.value = 'ALL';
};

window.sop_manageCategories = function() {
    if (!window.sopRequire(window.sopCanManage)) return;

    const palette = [
        { val: '#10b981', name: 'เขียว' },
        { val: '#22c55e', name: 'เขียวสด' },
        { val: '#06b6d4', name: 'ฟ้าอมเขียว' },
        { val: '#3b82f6', name: 'ฟ้า' },
        { val: '#6366f1', name: 'น้ำเงิน' },
        { val: '#8b5cf6', name: 'ม่วง' },
        { val: '#a855f7', name: 'ม่วงสด' },
        { val: '#ec4899', name: 'ชมพู' },
        { val: '#ef4444', name: 'แดง' },
        { val: '#f97316', name: 'ส้ม' },
        { val: '#f59e0b', name: 'ส้มทอง' },
        { val: '#eab308', name: 'เหลือง' },
        { val: '#84cc16', name: 'เขียวมะนาว' },
        { val: '#64748b', name: 'เทา' }
    ];

    function buildPalette(currentColor, attr) {
        return palette.map(c => `
            <button type="button" onclick="this.parentNode.querySelectorAll('button').forEach(b=>b.classList.remove('ring-2','ring-slate-900','dark:ring-white','scale-110')); this.classList.add('ring-2','ring-slate-900','dark:ring-white','scale-110'); this.parentNode.dataset.${attr} = '${c.val}';"
                class="w-6 h-6 rounded-md border border-gray-300 dark:border-slate-600 shadow-sm transition ${currentColor === c.val ? 'ring-2 ring-slate-900 dark:ring-white scale-110' : ''}"
                style="background-color: ${c.val};" title="${c.name}"></button>
        `).join('');
    }

    function buildList() {
        if (globalSOPCategories.length === 0) return '<div class="text-center text-gray-500 text-sm py-4">ไม่มีหมวดหมู่</div>';
        return globalSOPCategories.map((c, idx) => `
            <div class="bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl mb-2 shadow-sm overflow-hidden">
                <div class="px-3 py-2 flex justify-between items-center gap-2" style="border-left: 6px solid ${c.color || '#f97316'};">
                    <span class="text-slate-800 dark:text-white font-bold text-sm flex-1 truncate">${c.name}</span>
                    <button onclick="document.getElementById('sopCatPalette_${idx}').classList.toggle('hidden')" class="text-blue-400 hover:text-white bg-white dark:bg-slate-800 hover:bg-blue-500 px-2 py-1.5 rounded-lg transition shadow-sm border border-gray-200 dark:border-slate-700" title="เปลี่ยนสี"><span class="material-icons text-[16px]">palette</span></button>
                    <button onclick="sop_deleteCategory(${idx})" class="text-red-400 hover:text-white bg-white dark:bg-slate-800 hover:bg-red-500 px-2 py-1.5 rounded-lg transition shadow-sm border border-gray-200 dark:border-slate-700" title="ลบหมวดหมู่"><span class="material-icons text-[16px]">delete</span></button>
                </div>
                <div id="sopCatPalette_${idx}" class="hidden px-3 py-2 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
                    <div class="text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-wider">เลือกสีหมวด</div>
                    <div class="flex flex-wrap gap-1.5" data-color="${c.color || '#f97316'}" id="sopCatPaletteBtns_${idx}">
                        ${buildPalette(c.color || '#f97316', 'color')}
                    </div>
                    <button onclick="sop_saveCategoryColor(${idx})" class="mt-2 w-full bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 rounded-lg text-xs font-bold transition active:scale-95 shadow-sm flex items-center justify-center gap-1"><span class="material-icons text-[14px]">check</span>บันทึกสี</button>
                </div>
            </div>
        `).join('');
    }

    window.renderSopManageCatHtml = buildList;

    const initialPaletteHtml = buildPalette('#f97316', 'newcatcolor');

    const htmlContent = `
        <div class="text-left mt-4">
            <div class="bg-slate-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-3 mb-4">
                <div class="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">เพิ่มหมวดหมู่ใหม่</div>
                <input type="text" id="newSopCatName" placeholder="พิมพ์ชื่อหมวดหมู่ใหม่..." class="w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-slate-800 dark:text-white rounded-xl p-2.5 text-sm outline-none focus:border-rose-500 shadow-inner font-bold mb-2">
                <div class="text-[10px] font-bold text-gray-500 mb-1.5">เลือกสี:</div>
                <div class="flex flex-wrap gap-1.5 mb-2" data-newcatcolor="#f97316" id="sopNewCatPalette">${initialPaletteHtml}</div>
                <button onclick="sop_addCategory()" class="w-full bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-xl font-bold shadow-md transition active:scale-95 flex items-center justify-center gap-1 border border-rose-500"><span class="material-icons text-sm">add</span> เพิ่มหมวดหมู่</button>
            </div>
            <div class="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest mb-2 border-b border-gray-200 dark:border-slate-700 pb-1">หมวดหมู่ที่มีอยู่</div>
            <div id="sopCatListContainer" class="max-h-[40vh] overflow-y-auto custom-scrollbar pr-2 pb-2">
                ${buildList()}
            </div>
        </div>
    `;

    Swal.fire({
        title: '<div class="text-xl font-black text-slate-800 dark:text-white flex items-center justify-center gap-2"><span class="material-icons text-rose-500">category</span> จัดการหมวดหมู่</div>',
        html: htmlContent,
        showConfirmButton: false,
        showCloseButton: true,
        width: '560px',
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-2xl' }
    });
};

window.sop_saveCategoryColor = async function(idx) {
    if (!window.sopRequire(window.sopCanManage)) return;

    const palette = document.getElementById(`sopCatPaletteBtns_${idx}`);
    if (!palette) return;
    const newColor = palette.dataset.color;
    if (!newColor || !globalSOPCategories[idx]) return;
    globalSOPCategories[idx].color = newColor;
    await appDB.from('settings').upsert([{ key: 'sop_categories', value: JSON.stringify(globalSOPCategories) }]);
    document.getElementById('sopCatListContainer').innerHTML = window.renderSopManageCatHtml();
    sop_renderAllRulesPage();
    sop_renderList();
    sop_showInlineToast('เปลี่ยนสีหมวดแล้ว ✅', 'success');
};

window.sop_addCategory = async function() {
    if (!window.sopRequire(window.sopCanManage)) return;

    const input = document.getElementById('newSopCatName');
    const val = input.value.trim();
    if (!val) return;
    const id = val.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').trim() || val;
    if (globalSOPCategories.some(c => c.id === id || c.name === val)) {
        Swal.showValidationMessage('มีหมวดหมู่นี้ในระบบแล้วครับ'); return;
    }
    Swal.resetValidationMessage();
    // ดึงสีจาก palette
    const palette = document.getElementById('sopNewCatPalette');
    const color = (palette && palette.dataset.newcatcolor) || '#f97316';
    globalSOPCategories.push({ id, name: val, color });
    input.value = '';
    document.getElementById('sopCatListContainer').innerHTML = window.renderSopManageCatHtml();
    await appDB.from('settings').upsert([{ key: 'sop_categories', value: JSON.stringify(globalSOPCategories) }]);
    sop_renderCategoryDropdowns();
    sop_renderAllRulesPage();
};

window.sop_deleteCategory = async function(idx) {
    if (!window.sopRequire(window.sopCanManage)) return;

    const cat = globalSOPCategories[idx];
    const usedCount = globalSOPData.filter(r => r.category === cat.id).length;
    let warnText = `ต้องการลบหมวด "${cat.name}" ใช่หรือไม่?`;
    if (usedCount > 0) warnText += `\n\n⚠️ มีกฎ ${usedCount} ข้อใช้หมวดนี้อยู่`;
    const confirm = await Swal.fire({
        title: 'ยืนยันลบหมวดหมู่?', text: warnText, icon: 'warning', showCancelButton: true,
        confirmButtonColor: '#ef4444', cancelButtonColor: '#64748b', confirmButtonText: 'ลบทิ้ง', cancelButtonText: 'ยกเลิก'
    });
    if (confirm.isConfirmed) {
        globalSOPCategories.splice(idx, 1);
        document.getElementById('sopCatListContainer').innerHTML = window.renderSopManageCatHtml();
        await appDB.from('settings').upsert([{ key: 'sop_categories', value: JSON.stringify(globalSOPCategories) }]);
        sop_renderCategoryDropdowns();
        sop_renderList();
    }
};

// ==========================================
// 📥 FETCH / SAVE
// ==========================================
window.sop_fetchData = async function() {
    const container = document.getElementById('sopListContainer');
    if (container) container.innerHTML = '<div class="text-center text-gray-500 py-10"><span class="material-icons animate-spin mb-2">sync</span><br>กำลังโหลด...</div>';
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', 'sop_data').single();
        if (data && data.value) {
            globalSOPData = JSON.parse(data.value);
        } else {
            globalSOPData = [];
        }
        // ทำ default field ที่อาจไม่มีใน V1/V2/V3
        globalSOPData.forEach(r => {
            if (!r.priority) r.priority = 'medium';
            if (typeof r.pinned !== 'boolean') r.pinned = false;
            if (!Array.isArray(r.shifts)) r.shifts = ['all'];
            if (!Array.isArray(r.tags)) r.tags = [];
            if (!Array.isArray(r.attachments)) r.attachments = [];
            if (typeof r.view_count !== 'number') r.view_count = 0;
            if (!Array.isArray(r.read_by)) r.read_by = [];
            if (!Array.isArray(r.history)) r.history = [];
            if (!Array.isArray(r.rules)) r.rules = [];
            r.rules.forEach(rule => {
                if (!rule.color) rule.color = '';
                if (!rule.subgroup) rule.subgroup = '';
                if (!Array.isArray(rule.images)) rule.images = [];
            });
            if (!r.voice_url) r.voice_url = ''; // V6: voice note
        });
        sop_sortData();
        sop_renderList();
        if (currentSopId) sop_readRule(currentSopId, true);

        // V4: โหลด standalone rules (Tab 1)
        await sop_fetchStandaloneRules();
    } catch (e) {
        console.error('sop_fetchData error:', e);
        globalSOPData = [];
        sop_renderList();
    }
};

// V4: โหลด/บันทึก standalone rules (กติกาที่อยู่ใน Tab "กติกาขั้นตอน" — ไม่ผูกกับ SOP)
window.sop_fetchStandaloneRules = async function() {
    try {
        const { data } = await appDB.from('settings').select('value').eq('key', 'sop_rules_standalone').single();
        if (data && data.value) {
            globalStandaloneRules = JSON.parse(data.value);
        } else {
            globalStandaloneRules = [];
        }
        // default fields
        globalStandaloneRules.forEach(r => {
            if (!r.color) r.color = '';
            if (!r.subgroup) r.subgroup = '';
            if (!Array.isArray(r.images)) r.images = [];
            if (!r.type) r.type = 'do';
            if (!r.title) r.title = '';
            if (!r.text) r.text = '';
            if (typeof r.pinned !== 'boolean') r.pinned = false;
            if (!Array.isArray(r.read_by)) r.read_by = []; // V6: เก็บ username คนที่อ่าน
            if (!r.voice_url) r.voice_url = ''; // V6: voice note URL
        });
        sop_updateUnreadBadge();
    } catch (e) {
        console.warn('sop_fetchStandaloneRules error (treating as empty):', e);
        globalStandaloneRules = [];
        sop_updateUnreadBadge();
    }
};

window.sop_saveStandaloneRules = async function() {
    await appDB.from('settings').upsert([{ key: 'sop_rules_standalone', value: JSON.stringify(globalStandaloneRules) }]);
    sop_updateUnreadBadge();
};

// V6: นับ OD/กติกา ที่ผู้ใช้ปัจจุบันยังไม่อ่าน → แสดงที่ Bell badge
window.sop_updateUnreadBadge = function() {
    const badge = document.getElementById('sopUnreadBadge');
    if (!badge) return;
    const myUsername = (currentUser && currentUser.username) || '';
    if (!myUsername) { badge.classList.add('hidden'); return; }

    let count = 0;
    // ขั้นตอน (SOP) - ใช้ read_by
    (globalSOPData || []).forEach(r => {
        const readBy = r.read_by || [];
        if (!readBy.includes(myUsername)) count++;
    });
    // กติกา (Standalone) - ใช้ read_by
    (globalStandaloneRules || []).forEach(r => {
        const readBy = r.read_by || [];
        if (!readBy.includes(myUsername)) count++;
    });

    if (count > 0) {
        badge.classList.remove('hidden');
        badge.innerText = count > 99 ? '99+' : count;
    } else {
        badge.classList.add('hidden');
    }
};

window.sop_saveAllData = async function() {
    await appDB.from('settings').upsert([{ key: 'sop_data', value: JSON.stringify(globalSOPData) }]);
    sop_updateUnreadBadge();
};

function sop_sortData() {
    // ปักหมุดบนสุด → priority สูง → ล่าสุด
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    globalSOPData.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        const pa = priorityOrder[a.priority] ?? 1;
        const pb = priorityOrder[b.priority] ?? 1;
        if (pa !== pb) return pa - pb;
        return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
    });
}

// ==========================================
// 🎚️ FILTERS
// ==========================================
window.sop_togglePinFilter = function() {
    sopPinFilterActive = !sopPinFilterActive;
    sop_updatePinFilterBtn();
    sop_renderList();
};

function sop_updatePinFilterBtn() {
    const btn = document.getElementById('sopPinFilterBtn');
    if (!btn) return;
    if (sopPinFilterActive) {
        btn.classList.remove('bg-slate-100', 'dark:bg-slate-900', 'text-slate-700', 'dark:text-gray-300');
        btn.classList.add('bg-amber-500', 'text-white', 'border-amber-400');
    } else {
        btn.classList.add('bg-slate-100', 'dark:bg-slate-900', 'text-slate-700', 'dark:text-gray-300');
        btn.classList.remove('bg-amber-500', 'text-white', 'border-amber-400');
    }
}

// ==========================================
// 📜 RENDER LIST
// ==========================================
window.sop_renderList = function() {
    const term = document.getElementById('sopSearch') ? document.getElementById('sopSearch').value.toLowerCase() : '';
    const cat = document.getElementById('sopCategory') ? document.getElementById('sopCategory').value : 'ALL';
    const shiftF = document.getElementById('sopShiftFilter') ? document.getElementById('sopShiftFilter').value : 'ALL';
    const pri = document.getElementById('sopPriorityFilter') ? document.getElementById('sopPriorityFilter').value : 'ALL';
    const container = document.getElementById('sopListContainer');
    const countEl = document.getElementById('sopCount');
    if (!container) return;

    let filtered = globalSOPData.filter(item => {
        const tagText = (item.tags || []).join(' ').toLowerCase();
        const matchSearch = (item.title || '').toLowerCase().includes(term) ||
                            (item.content || '').toLowerCase().includes(term) ||
                            (item.examples || '').toLowerCase().includes(term) ||
                            tagText.includes(term);
        const matchCat = (cat === 'ALL' || item.category === cat);
        const itemShifts = item.shifts || ['all'];
        const matchShift = (shiftF === 'ALL') || itemShifts.includes('all') || itemShifts.includes(shiftF);
        const matchPri = (pri === 'ALL' || item.priority === pri);
        const matchPin = !sopPinFilterActive || item.pinned;
        return matchSearch && matchCat && matchShift && matchPri && matchPin;
    });

    if (countEl) countEl.innerText = `${filtered.length}/${globalSOPData.length}`;

    // V3.4: อัพเดทเลขแท็บ
    sop_updateTabCounters();

    if (globalSOPData.length === 0) {
        const isAdmin = (currentUser && (currentUser.role === 'manager' || currentUser.role === 'admin'));
        const hint = isAdmin ? 'กดปุ่ม "เพิ่มกฎใหม่" เพื่อเริ่ม' : 'รอผู้ดูแลเพิ่มกฎ';
        container.innerHTML = window.renderTemplate('tpl-sop-no-rules', { hint });
        return;
    }
    if (filtered.length === 0) {
        container.innerHTML = window.renderTemplate('tpl-sop-no-rules', { hint: 'ไม่พบกฎตามเงื่อนไข' });
        return;
    }

    const myUsername = (currentUser && currentUser.username) || '';

    // V4.2: จัดกลุ่มตามหมวดหมู่
    const groupedByCategory = {};
    filtered.forEach(item => {
        const catKey = item.category || '__uncat__';
        if (!groupedByCategory[catKey]) groupedByCategory[catKey] = [];
        groupedByCategory[catKey].push(item);
    });

    // เรียงลำดับหมวด: ตาม globalSOPCategories ก่อน → unmatched ท้าย
    const orderedCatKeys = [];
    globalSOPCategories.forEach(c => { if (groupedByCategory[c.id]) orderedCatKeys.push(c.id); });
    Object.keys(groupedByCategory).forEach(k => { if (!orderedCatKeys.includes(k)) orderedCatKeys.push(k); });

    function buildItemHtml(item) {
        let icon = 'rule', iconColor = 'text-gray-500 dark:text-gray-400';
        const cs = item.category || '';
        if (cs.includes('ฝาก'))     { icon = 'savings';        iconColor = 'text-emerald-500 dark:text-emerald-400'; }
        else if (cs.includes('ถอน')) { icon = 'payments';       iconColor = 'text-blue-500 dark:text-blue-400'; }
        else if (cs.includes('เครดิต')) { icon = 'monetization_on'; iconColor = 'text-amber-500 dark:text-amber-400'; }
        else if (cs.includes('พิเศษ')) { icon = 'warning';        iconColor = 'text-rose-500 dark:text-rose-400'; }
        else if (cs.includes('ทั่วไป')) { icon = 'menu_book';      iconColor = 'text-purple-500 dark:text-purple-400'; }

        const displayCat = globalSOPCategories.find(x => x.id === item.category)?.name || item.category;
        const dateRaw = item.updated_at || item.created_at;
        const date = dateRaw ? new Date(dateRaw).toLocaleDateString('th-TH') : '-';

        const priorityOpt = SOP_PRIORITY_OPTIONS.find(p => p.id === item.priority) || SOP_PRIORITY_OPTIONS[1];
        const priorityBorder = priorityOpt.border;
        const priorityBadge = item.priority === 'high'
            ? '<span class="text-[10px] mr-0.5" title="สำคัญมาก">🔴</span>'
            : (item.priority === 'medium' ? '<span class="text-[10px] mr-0.5" title="ปานกลาง">🟡</span>' : '<span class="text-[10px] mr-0.5" title="ทั่วไป">🟢</span>');

        const pinIcon = item.pinned ? '<span class="absolute top-1.5 right-1.5 material-icons text-amber-500 text-[16px]" title="ปักหมุด">push_pin</span>' : '';

        const shifts = item.shifts || ['all'];
        let shiftBadges = '';
        if (!shifts.includes('all')) {
            shifts.forEach(s => {
                const sOpt = SOP_SHIFT_OPTIONS.find(x => x.id === s);
                if (sOpt) shiftBadges += `<span class="text-[9px] px-1.5 py-0.5 rounded ${sOpt.color} border">${sOpt.short}</span>`;
            });
        } else {
            shiftBadges = '<span class="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-600">ทุกกะ</span>';
        }

        const readBy = item.read_by || [];
        const isReadByMe = readBy.includes(myUsername);
        let readIndicator = '';
        if (readBy.length > 0) {
            readIndicator = isReadByMe
                ? `<span class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 flex items-center gap-0.5"><span class="material-icons text-[10px]">verified</span>อ่านแล้ว</span>`
                : `<span class="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-gray-300 border border-slate-200 dark:border-slate-600 flex items-center gap-0.5"><span class="material-icons text-[10px]">groups</span>${readBy.length} คน</span>`;
        }

        let tagsHtml = '';
        if (item.tags && item.tags.length > 0) {
            tagsHtml = '<div class="flex flex-wrap gap-1 mt-1.5">' + item.tags.slice(0, 4).map(t => `<span class="text-[9px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700">#${t}</span>`).join('') + (item.tags.length > 4 ? `<span class="text-[9px] px-1 text-gray-500">+${item.tags.length - 4}</span>` : '') + '</div>';
        }

        const attCount = (item.attachments || []).length;
        const attachmentIcon = attCount > 0
            ? `<span class="flex items-center gap-0.5 text-amber-600 dark:text-amber-400"><span class="material-icons text-[11px]">attach_file</span>${attCount}</span>`
            : '';

        // V6: voice icon
        const voiceIcon = item.voice_url
            ? `<span class="flex items-center gap-0.5 text-rose-600 dark:text-rose-400" title="มีเสียงอธิบาย"><span class="material-icons text-[11px]">mic</span></span>`
            : '';

        const activeBg = currentSopId === item.id
            ? 'bg-rose-50 dark:bg-rose-900/20 border border-rose-400 ring-2 ring-rose-300 dark:ring-rose-700'
            : 'bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 hover:border-rose-400 dark:hover:border-rose-500/50 hover:bg-white dark:hover:bg-slate-800';

        // V4.3: ปุ่มย้ายหมวดเร็ว (เฉพาะ admin)
        const hasManagePermLi = typeof window.hasUserPerm === 'function' ? window.hasUserPerm('sop_manage') : false;
        const isAdminLi = hasManagePermLi || (currentUser && (currentUser.role === 'manager' || currentUser.role === 'admin'));
        const moveCategoryBtn = isAdminLi
            ? `<button onclick="event.stopPropagation(); sop_quickMoveCategory('${item.id}')" class="ml-auto bg-white dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-gray-400 hover:text-blue-500 px-2 py-1 rounded-lg transition border border-gray-200 dark:border-slate-700 shadow-sm flex items-center gap-1" title="ย้ายไปหมวดอื่น"><span class="material-icons text-[12px]">drive_file_move</span>ย้ายหมวด</button>`
            : '';

        return window.renderTemplate('tpl-sop-list-item', {
            id: item.id,
            activeBg, iconColor, icon,
            priorityBorder, priorityBadge,
            pinIcon,
            title: item.title || '(ไม่มีชื่อ)',
            displayCat: displayCat || 'ไม่ระบุหมวด',
            shiftBadges, readIndicator, tagsHtml,
            date,
            viewCount: item.view_count || 0,
            attachmentIcon,
            voiceIcon,
            rulesCountBadge: '',
            moveCategoryBtn
        });
    }

    if (!window._sopCollapsedCats) window._sopCollapsedCats = new Set();

    let listHtml = '';
    orderedCatKeys.forEach(catKey => {
        const items = groupedByCategory[catKey];
        const catObj = globalSOPCategories.find(c => c.id === catKey);
        const catLabel = catKey === '__uncat__' ? '(ไม่ระบุหมวด)' : (catObj ? catObj.name : catKey);
        const catColor = catObj?.color || '#64748b';
        const isCollapsed = window._sopCollapsedCats.has(catKey);

        let catIcon = 'rule';
        if (catLabel.includes('ฝาก'))     catIcon = 'savings';
        else if (catLabel.includes('ถอน')) catIcon = 'payments';
        else if (catLabel.includes('เครดิต')) catIcon = 'monetization_on';
        else if (catLabel.includes('พิเศษ')) catIcon = 'warning';
        else if (catLabel.includes('ทั่วไป')) catIcon = 'menu_book';

        const itemsHtml = items.map(buildItemHtml).join('');
        const safeCatKey = (catKey || '').replace(/'/g, '');
        listHtml += `
            <div class="rounded-xl overflow-hidden shadow-sm mb-3 border border-gray-200 dark:border-slate-700">
                <div onclick="sop_toggleCatFolder('${safeCatKey}')" class="cursor-pointer text-white px-3 py-2 flex items-center gap-2 transition" style="background: ${catColor};">
                    <span class="material-icons text-[18px]">${catIcon}</span>
                    <span class="font-black text-sm tracking-wide flex-1 truncate">${(catLabel).replace(/</g, '&lt;')}</span>
                    <span class="bg-white/20 text-white text-[10px] font-black px-2 py-0.5 rounded-full">${items.length}</span>
                    <span class="material-icons text-white transition ${isCollapsed ? '' : 'rotate-180'} text-[18px]">expand_more</span>
                </div>
                ${isCollapsed ? '' : `<div class="bg-slate-50 dark:bg-slate-900/30 p-2 space-y-2">${itemsHtml}</div>`}
            </div>
        `;
    });

    container.innerHTML = listHtml;
};

// V4.2: toggle category folder
window.sop_toggleCatFolder = function(catKey) {
    if (!window._sopCollapsedCats) window._sopCollapsedCats = new Set();
    if (window._sopCollapsedCats.has(catKey)) window._sopCollapsedCats.delete(catKey);
    else window._sopCollapsedCats.add(catKey);
    sop_renderList();
};

// V4.3: ย้ายกฎไปหมวดอื่นแบบรวดเร็ว
window.sop_quickMoveCategory = async function(ruleId) {
    if (!window.sopRequire(window.sopCanManage)) return;

    const item = globalSOPData.find(r => String(r.id) === String(ruleId));
    if (!item) return;

    const currentCatLabel = globalSOPCategories.find(c => c.id === item.category)?.name || item.category || 'ไม่ระบุ';

    const optionsHtml = globalSOPCategories.map(c => {
        const isCurrent = c.id === item.category;
        const color = c.color || '#64748b';
        return `
            <button type="button" data-catid="${c.id}" onclick="document.querySelectorAll('.qmCatBtn').forEach(b=>b.classList.remove('ring-2','ring-blue-500','scale-[1.02]')); this.classList.add('ring-2','ring-blue-500','scale-[1.02]'); document.getElementById('qmSelected').value='${c.id}';" 
                class="qmCatBtn w-full text-left p-3 rounded-xl border-2 ${isCurrent ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 opacity-60' : 'border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 hover:border-blue-400'} transition flex items-center gap-3 mb-2 shadow-sm" ${isCurrent ? 'disabled' : ''}>
                <div class="w-5 h-5 rounded-md shrink-0" style="background-color: ${color};"></div>
                <span class="text-sm font-bold text-slate-800 dark:text-white flex-1">${c.name}</span>
                ${isCurrent ? '<span class="text-[10px] font-bold text-amber-600 dark:text-amber-400">หมวดปัจจุบัน</span>' : ''}
            </button>
        `;
    }).join('');

    const formHtml = `
        <div class="text-left">
            <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-xl p-3 mb-4 text-sm">
                <div class="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-1">กฎที่จะย้าย</div>
                <div class="font-bold text-slate-800 dark:text-white">${(item.title || '(ไม่มีชื่อ)').replace(/</g, '&lt;')}</div>
                <div class="text-xs text-gray-500 mt-1">หมวดปัจจุบัน: <span class="font-bold">${currentCatLabel}</span></div>
            </div>
            <div class="text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-2">เลือกหมวดใหม่</div>
            <div class="max-h-[40vh] overflow-y-auto custom-scrollbar pr-1">${optionsHtml}</div>
            <input type="hidden" id="qmSelected" value="">
        </div>
    `;

    const result = await Swal.fire({
        title: '<div class="text-xl font-black text-slate-800 dark:text-white flex items-center justify-center gap-2"><span class="material-icons text-blue-500">drive_file_move</span> ย้ายไปหมวดอื่น</div>',
        html: formHtml,
        width: '500px',
        showCancelButton: true,
        confirmButtonText: '<span class="material-icons text-sm align-middle mr-1">check</span> ย้าย',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#3b82f6',
        cancelButtonColor: '#64748b',
        focusConfirm: false,
        customClass: { popup: 'dark:bg-slate-800 dark:text-white rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-2xl' },
        preConfirm: () => {
            const newCat = document.getElementById('qmSelected').value;
            if (!newCat) { Swal.showValidationMessage('กรุณาเลือกหมวดใหม่'); return false; }
            if (newCat === item.category) { Swal.showValidationMessage('นี่คือหมวดเดิมอยู่แล้ว'); return false; }
            return { newCat };
        }
    });

    if (!result.isConfirmed || !result.value) return;

    Swal.fire({ title: 'กำลังย้าย...', didOpen: () => Swal.showLoading() });
    try {
        const oldCat = currentCatLabel;
        const newCatLabel = globalSOPCategories.find(c => c.id === result.value.newCat)?.name || result.value.newCat;
        const authorName = (currentUser && (currentUser.username || currentUser.name)) || 'ผู้ใช้';
        const nowIso = new Date().toISOString();

        const idx = globalSOPData.findIndex(x => String(x.id) === String(ruleId));
        if (idx !== -1) {
            globalSOPData[idx].category = result.value.newCat;
            globalSOPData[idx].updated_at = nowIso;
            globalSOPData[idx].last_editor = authorName;
            if (!Array.isArray(globalSOPData[idx].history)) globalSOPData[idx].history = [];
            globalSOPData[idx].history.push({
                timestamp: nowIso,
                editor: authorName,
                title_before: globalSOPData[idx].title,
                action: `ย้ายหมวด: ${oldCat} → ${newCatLabel}`
            });
            while (globalSOPData[idx].history.length > 5) globalSOPData[idx].history.shift();
        }

        await sop_saveAllData();
        sop_sortData();
        sop_renderList();
        sop_updateTabCounters();
        Swal.fire({ icon: 'success', title: `ย้ายไป "${newCatLabel}" แล้ว!`, timer: 1200, showConfirmButton: false });
    } catch (e) {
        Swal.fire('Error', e.message || 'ย้ายไม่สำเร็จ', 'error');
    }
};


// ==========================================
// 🔢 V3.4: TAB COUNTERS
// ==========================================
window.sop_updateTabCounters = function() {
    const sopBadge   = document.getElementById('sopTabSopCount');
    const rulesBadge = document.getElementById('sopTabRulesCount');
    const myUsername = (currentUser && currentUser.username) || '';

    if (sopBadge) sopBadge.innerText = globalSOPData.length;

    if (rulesBadge) {
        const total   = (globalStandaloneRules || []).length;
        const unread  = (globalStandaloneRules || []).filter(r => {
            const readBy = r.read_by || [];
            return !readBy.includes(myUsername);
        }).length;
        rulesBadge.innerText = total;
        // ถ้ามีที่ยังไม่อ่าน — ขึ้น badge แดงบน tab
        const tabBtn = document.getElementById('sopTabBtn_rules');
        let newBadge = document.getElementById('sopRulesNewBadge');
        if (unread > 0) {
            if (!newBadge) {
                newBadge = document.createElement('span');
                newBadge.id = 'sopRulesNewBadge';
                newBadge.className = 'bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full';
                if (tabBtn) tabBtn.appendChild(newBadge);
            }
            newBadge.innerText = unread > 99 ? '99+' : unread;
            newBadge.style.display = '';
        } else if (newBadge) {
            newBadge.style.display = 'none';
        }
    }
};
